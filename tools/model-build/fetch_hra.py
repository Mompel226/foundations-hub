"""The body, the reproductive system and the uterus for the intro's first steps, from the HuBMAP Human
Reference Atlas, 3D Reference Organ for United Female v1.10 (CC BY 4.0, Visible Human Female, NLM).

Only the parts needed are read, by HTTP range requests on the 375 MB file (its table of contents is read
first). Every part keeps the Atlas's own body frame (metres).

    python3 fetch_hra.py list          # names and sizes
    python3 fetch_hra.py               # fetch -> ~/Library/Caches/biology-hub/anatomy/parts/<name>.npz
"""
import json, os, re, struct, sys, urllib.request
import numpy as np

URL = "https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb"
DIR = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/")
OUT = os.path.join(DIR, "parts")
WANT = r"^VH_F_(skin|vagina|cervicovaginal_junction|ampulla_of_uterine_tube_[LR]|isthmus_of_fallopian_tube_[LR]|fibria_of_uterine_tube_[LR]|uterine_tube_infundibulum_[LR]|left_ovary|right_ovary|abdominal_ostium_of_uterine_tube|body_of_uterus|fundus_of_uterus|lower_uterine_segment|posterior_wall_of_uterus|anterior_wall_of_uterus|cervix|internal_cervical_os|external_cervical_os|fundus_of_urinary_bladder_dome|fundus_of_urinary_bladder_base|urinary_bladder_neck_smooth_muscle|trigone_of_urinary_bladder|rectum|sacrum|coccyx|ilium_compact_bone_[LR]|lumbar_vertebra_[45]|pubic_bone.*|ischium.*|femur_[LR]|left_femur|right_femur)$"


def toc():
    path = os.path.join(DIR, "united.json")
    if not os.path.exists(path):
        os.makedirs(DIR, exist_ok=True)
        h = urllib.request.urlopen(urllib.request.Request(URL, headers={"Range": "bytes=0-19"})).read()
        clen = struct.unpack("<I", h[12:16])[0]
        js = urllib.request.urlopen(urllib.request.Request(URL, headers={"Range": f"bytes=20-{19 + clen}"})).read()
        open(path, "wb").write(js)
    js = open(path, "rb").read()
    return json.loads(js), len(js)


def world_matrices(j):
    nodes = j["nodes"]
    M = {}

    def local(n):
        if "matrix" in n:
            return np.array(n["matrix"]).reshape(4, 4).T
        T = np.eye(4)
        t = n.get("translation", [0, 0, 0]); r = n.get("rotation", [0, 0, 0, 1]); s = n.get("scale", [1, 1, 1])
        x, y, z, w = r
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        T[:3, :3] = R * np.array(s)
        T[:3, 3] = t
        return T

    def walk(i, P):
        W = P @ local(nodes[i])
        M[i] = W
        for c in nodes[i].get("children", []):
            walk(c, W)
    for root in j["scenes"][0]["nodes"]:
        walk(root, np.eye(4))
    return M


def rng(a, b):
    return urllib.request.urlopen(urllib.request.Request(URL, headers={"Range": f"bytes={a}-{b - 1}"}), timeout=120).read()


def accessor(j, base, k):
    a = j["accessors"][k]; bv = j["bufferViews"][a["bufferView"]]
    comp = {5126: ("<f4", 4), 5125: ("<u4", 4), 5123: ("<u2", 2), 5121: ("u1", 1)}[a["componentType"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    stride = bv.get("byteStride", comp[1] * n)
    start = base + bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    raw = rng(start, start + stride * (a["count"] - 1) + comp[1] * n)
    if stride == comp[1] * n:
        return np.frombuffer(raw, dtype=comp[0]).reshape(a["count"], n)
    return np.stack([np.frombuffer(raw[i * stride:i * stride + comp[1] * n], dtype=comp[0]) for i in range(a["count"])])


def main(listing):
    j, jlen = toc()
    base = 20 + jlen + 8
    M = world_matrices(j)
    os.makedirs(OUT, exist_ok=True)
    tot = 0
    for i, n in enumerate(j["nodes"]):
        nm = n.get("name", "")
        if "mesh" not in n or not re.match(WANT, nm):
            continue
        prims = j["meshes"][n["mesh"]]["primitives"]
        size = sum(j["accessors"][p["attributes"]["POSITION"]]["count"] * 12 + j["accessors"][p["indices"]]["count"] * 4 for p in prims)
        tot += size
        if listing:
            print(f"{nm:55s} {size / 1e6:7.2f} MB")
            continue
        path = os.path.join(OUT, nm + ".npz")
        if os.path.exists(path):
            continue
        V, F, off = [], [], 0
        for p in prims:
            v = accessor(j, base, p["attributes"]["POSITION"]).astype(np.float64)
            f = accessor(j, base, p["indices"]).astype(np.int64).reshape(-1, 3)
            V.append(v); F.append(f + off); off += len(v)
        V = np.concatenate(V); F = np.concatenate(F)
        W = M[i]
        V = (np.c_[V, np.ones(len(V))] @ W.T)[:, :3]
        np.savez_compressed(path, v=V.astype(np.float32), f=F.astype(np.int32), label=n.get("extras", {}).get("label", nm))
        print("got", nm, len(V), "vertices", len(F), "triangles", flush=True)
    print(f"total {tot / 1e6:.1f} MB")


if __name__ == "__main__":
    main(len(sys.argv) > 1 and sys.argv[1] == "list")
