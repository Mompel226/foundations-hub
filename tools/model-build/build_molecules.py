"""The molecule level (a MODEL): real protein shapes, at their real size, in the numbers a HeLa cell holds.

    python3 build_molecules.py      -> cache molecules/m_*.glb + ../../assets/mol/crowd.bin + crowd.json

Shapes: Protein Data Bank biological assemblies (PDB data are CC0). Each shape is the surface of the molecule
drawn from its alpha-carbon (and RNA phosphorus) atoms, enclosing the volume the molecule really has
(1.21 nm3 per kDa of protein); detail finer than about 0.5 nm is smoothed away.

Numbers: Mueller et al. 2020 (Nature 583:819), HeLa, via PaxDb (parts per million of all protein molecules).
Total: 3 million protein molecules per cubic micrometre of cytoplasm (Milo 2013, BioEssays 35:1050).
A complex counts once per assembly (a GAPDH tetramer is four polypeptides, one molecule here).
"""
import gzip, json, os, re, struct
import numpy as np
from scipy import ndimage as ndi
from skimage import measure
import fast_simplification, trimesh

C = os.path.expanduser("~/Library/Caches/biology-hub/molecules/")
PDB = os.path.join(C, "pdb")
HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "..", "..", "assets", "mol")

# id: (PDB, chains filter (min residues per chain, or explicit list), genes counted, colour, label)
TYPES = {
    "gapdh":   ("1U8F", None, ["GAPDH"], 0x7aa6d9, "GAPDH, an enzyme of glycolysis"),
    "eef1a":   ("4C0S", ["A"], ["EEF1A1", "EEF1A2"], 0x8fc7a8, "eEF1A, which brings amino acids to the ribosome"),
    "pfn":     ("1FIL", None, ["PFN1", "PFN2"], 0xc3a6e0, "profilin, which binds actin"),
    "ppia":    ("3K0N", None, ["PPIA"], 0xa3c4e8, "cyclophilin A, which helps proteins fold"),
    "ldh":     ("1I10", None, ["LDHA", "LDHB"], 0x6e93cc, "lactate dehydrogenase"),
    "pkm":     ("3SRF", None, ["PKM"], 0x5d82bf, "pyruvate kinase, an enzyme of glycolysis"),
    "eno":     ("2PSN", None, ["ENO1", "ENO2", "ENO3"], 0x86b0e0, "enolase, an enzyme of glycolysis"),
    "tpi":     ("1HTI", None, ["TPI1"], 0x9bbbe6, "triose phosphate isomerase"),
    "prdx":    ("4XCS", None, ["PRDX1", "PRDX2"], 0xb4d3a0, "peroxiredoxin, which removes hydrogen peroxide"),
    "hsp90":   ("2CG9", 600, ["HSP90AA1", "HSP90AB1"], 0xe0a9c0, "Hsp90, a chaperone that helps proteins fold"),
    "ywha":    ("2O02", 200, ["YWHAB", "YWHAE", "YWHAG", "YWHAH", "YWHAQ", "YWHAZ", "SFN"], 0xd7c38e, "a 14-3-3 protein"),
    "aldo":    ("4ALD", None, ["ALDOA", "ALDOC"], 0x7896c4, "aldolase, an enzyme of glycolysis"),
    "pgk":     ("2XE7", None, ["PGK1"], 0x93a9d8, "phosphoglycerate kinase"),
    "cfl":     ("1Q8G", None, ["CFL1", "CFL2"], 0xcdb2e6, "cofilin, which cuts actin filaments"),
    "sod":     ("2C9V", None, ["SOD1"], 0xa8d6c9, "superoxide dismutase"),
    "actin":   ("1J6Z", None, ["ACTB", "ACTG1"], 0xe8907a, "actin (single molecules, not in a filament)"),
    "tub":     ("1JFF", None, ["TUBA1A", "TUBA1B", "TUBA1C", "TUBA4A", "TUBB", "TUBB2A", "TUBB4B", "TUBB6", "TUBB3"], 0x7fd3e6, "tubulin (free, not in a microtubule)"),
    "hsc70":   ("1S3X", None, ["HSPA8", "HSPA1A", "HSPA1B", "HSPA4"], 0xe7b4a0, "Hsc70, a chaperone (its ATP end only)"),
    "prot":    ("5GJR", None, ["PSMA1"], 0x9d86c6, "a proteasome, which breaks down proteins"),
    # shapes for the thousands of other kinds, each rarer: grey
    "g_ran":   ("1BYU", ["A"], [], 0x8ea7c8, "one of the thousands of other kinds of protein"),
    "g_pgam":  ("1YFK", None, [], 0x9fb5a6, "one of the thousands of other kinds of protein"),
    "g_tkt":   ("3MOS", None, [], 0xae9fc2, "one of the thousands of other kinds of protein"),
    "g_vcp":   ("3CF3", None, [], 0xc2b096, "one of the thousands of other kinds of protein"),
}
SPECIAL = {  # not packed by count: placed by the scene
    "trna":    ("1EHZ", None, 0xd879a8, "transfer RNA"),
    "ribo":    ("6QZP", None, 0x6a46a8, "ribosome"),
    "tub_a":   ("1JFF", ["A"], 0x8fe0ee, "alpha-tubulin"),
    "tub_b":   ("1JFF", ["B"], 0x63c3d8, "beta-tubulin"),
    "kin_a":   ("3KIN", ["A"], 0xffb347, "kinesin head"),
    "kin_b":   ("3KIN", ["B"], 0xffc56b, "kinesin head"),
}


def atoms(pdb, chains=None):
    """CA and P (and C4') atoms of model 1: array (n, 3) in nm, chain ids, residue counts per chain."""
    txt = gzip.open(os.path.join(PDB, pdb + ".cif.gz"), "rt").read().splitlines()
    cols, rows, inloop = [], [], False
    for i, l in enumerate(txt):
        if l.startswith("_atom_site."):
            cols.append(l.split(".")[1].strip()); inloop = True; continue
        if inloop and cols and not l.startswith("_atom_site."):
            if l.startswith("#") or l.startswith("loop_") or l.startswith("_"):
                if rows: break
                continue
            rows.append(l)
    ix = {c: k for k, c in enumerate(cols)}
    P, ch = [], []
    for r in rows:
        f = r.split()
        if len(f) < len(cols):
            continue
        if f[ix["pdbx_PDB_model_num"]] not in ("1",):
            continue
        a = f[ix["label_atom_id"]].strip('"')
        if a not in ("CA", "P", "C4'"):
            continue
        if a == "CA" and f[ix["type_symbol"]] != "C":
            continue
        c = f[ix.get("auth_asym_id", ix["label_asym_id"])]
        P.append((float(f[ix["Cartn_x"]]), float(f[ix["Cartn_y"]]), float(f[ix["Cartn_z"]]))); ch.append(c)
    P = np.array(P) / 10.0; ch = np.array(ch)
    names, counts = np.unique(ch, return_counts=True)
    keep = np.ones(len(P), bool)
    if isinstance(chains, int):
        keep = np.isin(ch, names[counts >= chains])
    elif chains:
        keep = np.isin(ch, chains)
    return P[keep], ch[keep]


def surface(P, budget, nres):
    """Surface enclosing the molecule's volume (0.135 nm3 per residue or nucleotide-equivalent)."""
    lo = P.min(0) - 1.0; hi = P.max(0) + 1.0
    span = (hi - lo).max()
    h = 0.25 if span < 20 else 0.5
    shape = np.ceil((hi - lo) / h).astype(int) + 1
    G = np.zeros(shape, np.float32)
    idx = np.round((P - lo) / h).astype(int)
    np.add.at(G, (idx[:, 0], idx[:, 1], idx[:, 2]), 1.0)
    G = ndi.gaussian_filter(G, 0.32 / h)
    target = nres * 0.135 / h ** 3
    flat = np.sort(G.ravel())[::-1]
    thr = flat[min(len(flat) - 1, int(target))]
    v, f, _, _ = measure.marching_cubes(G, thr, spacing=(h, h, h))
    v += lo
    if len(f) > budget:
        v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), 1 - budget / len(f), agg=6)
    m = trimesh.Trimesh(v, f, process=True)
    m.update_faces(m.nondegenerate_faces())
    trimesh.smoothing.filter_taubin(m, iterations=4)
    return m


def build_shapes():
    info = {}
    allt = {k: (t[0], t[1], t[3]) for k, t in TYPES.items()}
    allt.update({k: (t[0], t[1], t[2]) for k, t in SPECIAL.items()})
    for k, (pdb, chains, col) in allt.items():
        P, ch = atoms(pdb, chains)
        n = len(P)
        nch = len(np.unique(ch))
        budget = 3000 if n > 8000 else 800 if n > 2000 else 480 if n > 700 else 300
        m = surface(P, budget, n)
        c = m.centroid.copy()
        m.apply_translation(-c)
        m.apply_scale(0.001)   # nm -> µm, the scene's unit
        os.makedirs(C, exist_ok=True)
        m.export(os.path.join(C, "m_" + k + ".glb"))
        r = float(np.sqrt((m.vertices ** 2).sum(1)).max())
        vol = float(abs(m.volume)) if m.is_watertight else n * 0.135e-9
        info[k] = dict(pdb=pdb, chains=nch, residues=n, triangles=len(m.faces), radius_um=r,
                       eqr_um=(3 * n * 0.135e-9 / 4 / np.pi) ** (1 / 3), col=col)
        print(f"{k:8s} {pdb} chains {nch:3d} residues {n:6d} tris {len(m.faces):5d} max radius {r * 1000:5.1f} nm", flush=True)
    return info


def abundance():
    rows = [l.rstrip("\n").split("\t") for l in open(os.path.join(C, "9606-PXD014877_Mueller_Nature_2020_Homo_sapiens_HeLa.txt")) if not l.startswith("#")]
    return {r[0]: float(r[2]) for r in rows if len(r) >= 3}


NOT_CYTOSOL = re.compile(r"^(RPL|RPS|MRPL|MRPS|H1-|H2A|H2B|H3|H4|HNRNP|SRSF|SNRP|NPM|NCL|LMN|TOP[12]|PARP1|ATP5|NDUF|COX|UQCR|SDH|CS$|ACO2|IDH3|OGDH|MDH2|HSPD1|HSPE1|HSPA9|VDAC|SLC25|TIMM|TOMM|PHB|CALR|HSPA5|HSP90B1|P4HB|PDIA|PPIB|CANX|SEC61|KRT|VIM|TMSB|PTMA|HIST|HMGB|HMGN|SUB1|NACA|BTF3)")


if __name__ == "__main__":
    info = build_shapes()
    ab = abundance()
    tot = sum(ab.values())
    cyt = sum(v for g, v in ab.items() if not NOT_CYTOSOL.match(g))
    named = {}
    for k, t in TYPES.items():
        if k.startswith("g_"):
            continue
        ppm = sum(ab.get(g, 0) for g in t[2])
        sub = info[k]["chains"]
        if k == "prot":
            sub = 2            # each proteasome holds two copies of PSMA1
        named[k] = dict(ppm=ppm, molecules_per_million=ppm / max(1, sub))
    named_ppm = sum(v["ppm"] for v in named.values())
    other_ppm = max(0.0, cyt - named_ppm)
    out = dict(source="Mueller et al. 2020 Nature 583:819 (HeLa) via PaxDb; 3e6 proteins per µm3 (Milo 2013)",
               ppm_total=tot, ppm_cytosol=cyt, ppm_named=named_ppm, ppm_other=other_ppm, types=named, shapes=info)
    os.makedirs(DEST, exist_ok=True)
    json.dump(out, open(os.path.join(C, "composition.json"), "w"), indent=1)
    print(json.dumps({k: round(v["molecules_per_million"]) for k, v in named.items()}))
    print("cytosolic share of all protein molecules:", round(cyt / tot, 3), "named:", round(named_ppm / tot, 3), "other:", round(other_ppm / tot, 3))


# ---------------------------------------------------------------------------------------------------------
# The crowd: a slab of cytoplasm 0.2 x 0.2 µm and 70 nm thick (a cross-section, as in David Goodsell's
# paintings), with a microtubule along x at y = z = 0, a vesicle above it and the kinesin between them.
SLAB = dict(x=(-0.10, 0.10), y=(-0.085, 0.115), z=(-0.035, 0.035))
MT_R = 0.0125
VES = dict(c=(-0.045, 0.072, 0.0), r=0.028)            # the vesicle at the start of the walk
RIBOS = [(-0.062, -0.052, 0.004), (-0.030, -0.060, -0.006), (0.004, -0.055, 0.008)]   # a short polysome
TRNA_PER_UM3 = 2.5e4                                     # about 5e7 tRNA per HeLa cell, in about 2,000 µm3


def build_crowd(info, comp, seed=11):
    rng = np.random.default_rng(seed)
    V = np.prod([b - a for a, b in SLAB.values()])
    V -= np.pi * MT_R ** 2 * 0.2 + 4 / 3 * np.pi * VES["r"] ** 3 + len(RIBOS) * 4 / 3 * np.pi * 0.012 ** 3
    n_poly = 3e6 * V                                     # polypeptides in the free volume
    cyt = comp["ppm_cytosol"]
    plan = []
    for k, t in comp["types"].items():
        n = n_poly * (t["ppm"] / cyt) / max(1, info[k]["chains"] if k != "prot" else 2)
        plan.append((k, n))
    other_poly = n_poly * comp["ppm_other"] / cyt
    gshare = {"g_ran": (0.40, 1), "g_pgam": (0.30, 2), "g_tkt": (0.25, 2), "g_vcp": (0.05, 6)}
    avg = sum(w * p for w, p in gshare.values())
    for k, (w, p) in gshare.items():
        plan.append((k, other_poly / avg * w))
    plan.append(("trna", TRNA_PER_UM3 * V))
    # round with the remainders carried, biggest molecules first (they are the hardest to place)
    items = []
    for k, n in plan:
        m = int(np.floor(n)) + (1 if rng.random() < n - np.floor(n) else 0)
        items += [k] * m
    items.sort(key=lambda k: -info[k]["radius_um"])
    cell = 0.012
    grid = {}
    placed = []

    def free(p, r):
        if abs(p[2]) > SLAB["z"][1] - r * 0.4:
            return False
        if np.hypot(p[1], p[2]) < MT_R + r * 0.8:
            return False
        if np.linalg.norm(p - np.array(VES["c"])) < VES["r"] + r * 0.8:
            return False
        for q in RIBOS:
            if np.linalg.norm(p - np.array(q)) < 0.014 + r:
                return False
        # the kinesin stalk, from the heads to the vesicle
        if abs(p[0] - VES["c"][0]) < r + 0.006 and MT_R < p[1] < VES["c"][1] and abs(p[2]) < r + 0.006:
            return False
        key = tuple((p // cell).astype(int))
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                for dz in (-2, -1, 0, 1, 2):
                    for (q, rq) in grid.get((key[0] + dx, key[1] + dy, key[2] + dz), ()):
                        if np.linalg.norm(p - q) < (r + rq) * 0.82:
                            return False
        return True
    lo = np.array([SLAB["x"][0], SLAB["y"][0], SLAB["z"][0]]); hi = np.array([SLAB["x"][1], SLAB["y"][1], SLAB["z"][1]])
    missed = 0
    for k in items:
        r = max(info[k]["eqr_um"], 0.72 * info[k]["radius_um"])
        for _ in range(400):
            p = lo + rng.random(3) * (hi - lo)
            if free(p, r):
                q = rng.normal(size=4); q /= np.linalg.norm(q)
                placed.append((k, p, q))
                key = tuple((p // cell).astype(int))
                grid.setdefault(key, []).append((p, r))
                break
        else:
            missed += 1
    names = sorted(set(k for k, _, _ in placed) | {"ribo", "tub_a", "tub_b", "kin_a", "kin_b"})
    tid = {k: i for i, k in enumerate(names)}
    buf = bytearray(b"MOLS" + struct.pack("<II", 1, len(placed)))
    for k, p, q in placed:
        buf += struct.pack("<B3f4b", tid[k], *p, *np.round(q * 127).astype(int))
    open(os.path.join(DEST, "crowd.bin"), "wb").write(buf)
    vol_frac = sum(4 / 3 * np.pi * info[k]["eqr_um"] ** 3 for k, _, _ in placed) / V
    meta = dict(names=names, slab=SLAB, mt_r=MT_R, vesicle=VES, ribosomes=RIBOS, count=len(placed), missed=missed,
                polypeptides=round(n_poly), volume_fraction=round(float(vol_frac), 3),
                per_type={k: sum(1 for kk, _, _ in placed if kk == k) for k in names},
                labels={k: (TYPES.get(k) or SPECIAL.get(k))[-1] for k in names},
                colours={k: (TYPES.get(k) or SPECIAL.get(k))[3 if k in TYPES else 2] for k in names},
                source=comp["source"])
    json.dump(meta, open(os.path.join(DEST, "crowd.json"), "w"), indent=1)
    print("placed", len(placed), "missed", missed, "polypeptides", round(n_poly), "volume fraction", round(float(vol_frac), 3))
    print({k: v for k, v in meta["per_type"].items()})


if __name__ == "__main__":
    comp = json.load(open(os.path.join(C, "composition.json")))
    build_crowd(comp["shapes"], comp)
