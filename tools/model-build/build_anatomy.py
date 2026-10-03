"""The organism, organ-system and organ steps: a real female body and her reproductive system, from the HuBMAP
Human Reference Atlas (United Female v1.10, Visible Human Female, CC BY 4.0), parts read by fetch_hra.py.

    python3 build_anatomy.py   -> cache anatomy/a_*.glb, then gltf/pack.mjs makes ../../assets/body/anatomy.glb

Groups (each one mesh, named): skin, bones, bladder, rectum, vagina, uterus, cervix, tubes, ovaries.
Units: metres, the Atlas's own frame (y up, +z the front of the body).
"""
import glob, os
import numpy as np
import fast_simplification, trimesh

SRC = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/parts/")
OUT = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/")
GROUPS = {
    "skin":    (["skin"], 22000),
    "bones":   (["sacrum", "coccyx", "ilium_compact_bone_L", "ilium_compact_bone_R", "lumbar_vertebra_4", "lumbar_vertebra_5", "femur_L", "femur_R"], 26000),
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

for name, (parts, budget) in GROUPS.items():
    V, F, off = [], [], 0
    for p in parts:
        d = np.load(os.path.join(SRC, "VH_F_" + p + ".npz"))
        V.append(d["v"]); F.append(d["f"] + off); off += len(d["v"])
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
