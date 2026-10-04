"""The organism, organ-system and organ steps: a real female body and her reproductive system, from the HuBMAP
Human Reference Atlas (United Female v1.10, Visible Human Female, CC BY 4.0), parts read by fetch_hra.py.

    python3 build_anatomy.py   -> cache anatomy/a_*.glb, then gltf/pack.mjs makes ../../assets/body/anatomy.glb

Groups (each one mesh, named): skin; the bones one mesh per kind (hip, sacrum, coccyx, vertebrae, femur), so that
each can be named when the pointer is on it; bladder, rectum, vagina, uterus, cervix, tubes, ovaries.
Units: metres, the Atlas's own frame (y up, +z the front of the body).

One change of place: each ovary is moved about 4 mm so that the fimbriae of its oviduct lie on its upper (tubal) end,
as in life (seat(): a quarter of the fimbriae within 1.5 mm of it; the Atlas leaves a gap of about 2.3 mm). Every
other organ is where the Atlas puts it (checked: tubes, uterus, cervix and vagina meet within 0.2 mm).
"""
import glob, os
import numpy as np
import fast_simplification, trimesh
from build_whole import simplify

SRC = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/parts/")
OUT = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/")
GROUPS = {
    "skin":    (["skin"], 22000),
    "hip":     (["ilium_compact_bone_L", "ilium_compact_bone_R"], 12000),
    "sacrum":  (["sacrum"], 5000),
    "coccyx":  (["coccyx"], 800),
    "vertebrae": (["lumbar_vertebra_4", "lumbar_vertebra_5"], 4000),
    "femur":   (["femur_L", "femur_R"], 4200),
    "bladder": (["fundus_of_urinary_bladder_dome", "fundus_of_urinary_bladder_base", "trigone_of_urinary_bladder", "urinary_bladder_neck_smooth_muscle"], 6000),
    "rectum":  (["rectum"], 1900),
    "vagina":  (["vagina", "cervicovaginal_junction"], 6000),
    "uterus":  (["body_of_uterus", "fundus_of_uterus", "anterior_wall_of_uterus", "posterior_wall_of_uterus", "lower_uterine_segment", "internal_cervical_os"], 14000),
    "cervix":  (["cervix", "external_cervical_os"], 3500),
    "tubes":   (["ampulla_of_uterine_tube_L", "ampulla_of_uterine_tube_R", "isthmus_of_fallopian_tube_L", "isthmus_of_fallopian_tube_R",
                 "fibria_of_uterine_tube_L", "fibria_of_uterine_tube_R", "uterine_tube_infundibulum_L", "uterine_tube_infundibulum_R",
                 "abdominal_ostium_of_uterine_tube"], 14000),
    "ovaries": (["left_ovary", "right_ovary"], 830),
}

def load(p):
    return np.load(os.path.join(SRC, "VH_F_" + p + ".npz"))


def seat(ovary, side, limit=6.0):
    """The move (at most `limit` mm; a 1 mm, then a 0.25 mm grid) that lays the most of the oviduct's fimbriae on the
    ovary's upper (tubal) end, as they lie in life: the share of fimbriae within 1.5 mm of its surface. No fimbria may
    sink more than 0.5 mm into it; the rest of the oviduct stays clear (0.4 mm). The Atlas leaves a gap of about
    2.3 mm (0% within 1.5 mm); a first move (until 4 Oct 2026) only closed it to a single touching point, and the
    fimbriae looked beside the ovary, not on it (Daniel: "they seem to be not aligned with the fimbriae")."""
    import itertools
    from scipy.spatial import cKDTree
    tri = lambda p: trimesh.Trimesh(load(p)["v"].astype(np.float64), load(p)["f"], process=True)
    o = tri(ovary); so, fi = trimesh.sample.sample_surface(o, 6000, seed=1); sn = o.face_normals[fi]
    tree = cKDTree(so)
    ax = np.linalg.svd(so - so.mean(0), full_matrices=False)[2][0]; half = np.abs((so - so.mean(0)) @ ax).max()
    fim = trimesh.sample.sample_surface(tri("fibria_of_uterine_tube_" + side), 3000, seed=2)[0]
    rest = np.vstack([trimesh.sample.sample_surface(tri(p), 2000, seed=3)[0] for p in
                      ("uterine_tube_infundibulum_" + side, "ampulla_of_uterine_tube_" + side, "isthmus_of_fallopian_tube_" + side)])
    up = np.sign((fim.mean(0) - so.mean(0)) @ ax)                    # the tubal end: the end of the long axis nearer the fimbriae

    def score(t):
        q = fim - t; d, i = tree.query(q); sd = np.einsum("ij,ij->i", q - so[i], sn[i])   # > 0 outside the ovary
        if sd.min() < -0.0005:
            return None
        dr, ir = tree.query(rest - t); sr = np.einsum("ij,ij->i", (rest - t) - so[ir], sn[ir])
        if ((sr < 0.0004) & (dr < 0.003)).any():
            return None
        close = d < 0.0015
        if close.sum() < 20 or np.median(((so[i[close]] - so.mean(0)) @ ax) * up / half) < 0.4:
            return 0.0
        return close.mean()
    best, bs = np.zeros(3), score(np.zeros(3)) or 0.0
    for step, span, refine in ((1.0, limit, False), (0.25, 1.0, True)):
        c0 = best * 1000 if refine else np.zeros(3)
        R = np.arange(-span, span + 1e-9, step)
        for dd in itertools.product(R, R, R):
            t = (c0 + np.array(dd)) / 1000
            if np.linalg.norm(t) * 1000 > limit:
                continue
            sc = score(t)
            if sc is not None and (sc > bs + 1e-9 or (abs(sc - bs) < 1e-9 and np.linalg.norm(t) < np.linalg.norm(best))):
                best, bs = t, sc
    print(f"{ovary}: moved {np.round(best * 1000, 2).tolist()} mm; fimbriae within 1.5 mm of it: {bs * 100:.0f}%")
    return best


MOVE = {"left_ovary": seat("left_ovary", "L"), "right_ovary": seat("right_ovary", "R")}

for name, (parts, budget) in GROUPS.items():
    V, F, off = [], [], 0
    for p in parts:
        d = load(p)
        v = d["v"] + MOVE.get(p, 0)
        V.append(v); F.append(d["f"] + off); off += len(d["v"])
    V = np.concatenate(V).astype(np.float32); F = np.concatenate(F).astype(np.int32)
    # the Atlas stores some surfaces with their corners unshared: join them first, or simplifying shrinks
    # every triangle on its own
    m0 = trimesh.Trimesh(V, F, process=True)
    V, F = m0.vertices.astype(np.float32), m0.faces.astype(np.int32)
    n0 = len(F)
    m = trimesh.Trimesh(V, F, process=False)
    if n0 > budget:
        # meshoptimizer, triangles kept well shaped (build_whole.simplify): the plain simplifier left the uterus with
        # 110 long, thin triangles (4 Oct check, gltf/mesh_check.mjs); no error limit: the budget decides, as before
        m = simplify(m, budget, 1.0)
    m.export(os.path.join(OUT, "a_" + name + ".glb"))
    print(f"{name:8s} {n0:7d} -> {len(m.faces):6d} triangles; bounds m {np.round(m.bounds, 3).tolist()}")
