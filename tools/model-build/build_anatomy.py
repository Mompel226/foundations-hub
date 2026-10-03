"""The organism, organ-system and organ steps: a real female body and her reproductive system, from the HuBMAP
Human Reference Atlas (United Female v1.10, Visible Human Female, CC BY 4.0), parts read by fetch_hra.py.

    python3 build_anatomy.py   -> cache anatomy/a_*.glb, then gltf/pack.mjs makes ../../assets/body/anatomy.glb

Groups (each one mesh, named): skin; the bones one mesh per kind (hip, sacrum, coccyx, vertebrae, femur), so that
each can be named when the pointer is on it; bladder, rectum, vagina, uterus, cervix, tubes, ovaries.
Units: metres, the Atlas's own frame (y up, +z the front of the body).

One change of place: each ovary is moved about 2 mm so that its upper (tubal) pole touches the fimbriae of its
oviduct (0.2-0.7 mm away), where the fimbriae fold over it in life; the Atlas leaves a gap of about 2.3 mm. Every other organ is where the Atlas puts it (checked: tubes, uterus, cervix and vagina
meet within 0.2 mm).
"""
import glob, os
import numpy as np
import fast_simplification, trimesh

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


def seat(ovary, side):
    """the smallest move (searched on a 1 mm, then a 0.25 mm grid) that brings the ovary's upper pole to
    0.2-0.7 mm from its fimbriae, while staying at least 0.4 mm from the rest of the oviduct"""
    import itertools
    from scipy.spatial import cKDTree
    tri = lambda p: trimesh.Trimesh(load(p)["v"].astype(np.float64), load(p)["f"], process=True)
    po, _ = trimesh.sample.sample_surface(tri(ovary), 1500, seed=1)
    ytop, yh = po[:, 1].max(), np.ptp(po[:, 1])
    fim = cKDTree(trimesh.sample.sample_surface(tri("fibria_of_uterine_tube_" + side), 6000, seed=2)[0])
    rest = cKDTree(np.vstack([trimesh.sample.sample_surface(tri(p), 6000, seed=3)[0] for p in
                              ("uterine_tube_infundibulum_" + side, "ampulla_of_uterine_tube_" + side, "isthmus_of_fallopian_tube_" + side)]))

    def ok(t):
        q = po + t
        df, _ = fim.query(q); k = df.argmin()
        if not 0.0002 <= df[k] <= 0.0007 or q[k, 1] < ytop + t[1] - 0.3 * yh:
            return False
        return rest.query(q, distance_upper_bound=0.001)[0].min() >= 0.0004
    best = None
    for step, span in ((1.0, 7), (0.25, 1.5)):
        c0 = np.zeros(3) if best is None else best * 1000
        R = np.arange(-span, span + 1e-9, step)
        for d in itertools.product(R, R, R):
            t = (c0 + np.array(d)) / 1000
            if ok(t) and (best is None or np.linalg.norm(t) < np.linalg.norm(best)):
                best = t
    print(f"{ovary}: moved {np.round(best * 1000, 2).tolist()} mm")
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
    if n0 > budget:
        V, F = fast_simplification.simplify(V, F, 1 - budget / n0, agg=5)
    m = trimesh.Trimesh(V, F, process=True)
    m.export(os.path.join(OUT, "a_" + name + ".glb"))
    print(f"{name:8s} {n0:7d} -> {len(m.faces):6d} triangles; bounds m {np.round(m.bounds, 3).tolist()}")
