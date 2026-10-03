"""The small things, packed for the page: ribosomes, vesicles, nuclear pores, microtubule centre lines, centrioles.

    python3 build_small.py      -> ../../assets/cell/small.bin (+ a summary printed)

Everything comes from the measured segmentations (instances.py). What is a choice here is said where it is made:
- a ribosome is drawn at its true volume (the segmentation gives each one an equal-volume ball, radius ~11 nm);
- a vesicle keeps its measured volume, drawn as a ball of that volume;
- a nuclear pore is drawn at its true size (120 nm across), facing out of the nucleus at the place it was found;
- a microtubule is drawn as a 25 nm tube along the centre line of its voxels (the segmentation gives pieces;
  pieces are not joined, so a long microtubule may show as several);
- a centriole: its centre, axis and length from its voxels.

File layout (little-endian): magic "CELL", u32 version, then sections, each: 4-char tag, u32 count, payload.
Positions are scene micrometres (origin = build_meshes.ORIGIN_UM) quantised to u16 over BOX (below).
"""
import json, os, struct
import numpy as np
from scipy import ndimage as ndi
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree
from fetch_roi import OUT as ROI, ROI_UM
from build_meshes import ORIGIN_UM

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "..", "..", "assets", "cell", "small.bin")
LO = np.array([ROI_UM["x"][0], ROI_UM["y"][0], ROI_UM["z"][0]]) - ORIGIN_UM
HI = np.array([ROI_UM["x"][1], ROI_UM["y"][1], ROI_UM["z"][1]]) - ORIGIN_UM


def q16(p):
    return np.clip(np.round((p - LO) / (HI - LO) * 65535), 0, 65535).astype("<u2")


def inst(name):
    return np.load(os.path.join(ROI, f"inst_{name}_s1.npz"))


def centreline(P, link=0.03):
    """Ordered centre line through one microtubule's voxels: the longest shortest path in a 30 nm graph."""
    if len(P) < 8:
        return None
    tree = cKDTree(P)
    pairs = tree.query_pairs(link, output_type="ndarray")
    if len(pairs) == 0:
        return None
    d = np.linalg.norm(P[pairs[:, 0]] - P[pairs[:, 1]], axis=1)
    n = len(P)
    G = csr_matrix((np.r_[d, d], (np.r_[pairs[:, 0], pairs[:, 1]], np.r_[pairs[:, 1], pairs[:, 0]])), shape=(n, n))
    ncomp, lab = connected_components(G, directed=False)
    big = np.bincount(lab).argmax()
    keep = np.nonzero(lab == big)[0]
    a = keep[0]
    dist = dijkstra(G, indices=a)
    b = keep[np.argmax(np.where(np.isfinite(dist[keep]), dist[keep], -1))]
    dist_b, pred = dijkstra(G, indices=b, return_predecessors=True)
    c = keep[np.argmax(np.where(np.isfinite(dist_b[keep]), dist_b[keep], -1))]
    path = [c]
    while path[-1] != b and pred[path[-1]] >= 0:
        path.append(pred[path[-1]])
    path = np.array(path)
    if len(path) < 3:
        return None
    # each path node -> the mean of the voxels near it (pulls the line to the tube's middle), then resample
    near = tree.query_ball_point(P[path], 0.02)
    mid = np.array([P[i].mean(0) for i in near])
    seg = np.linalg.norm(np.diff(mid, axis=0), axis=1)
    s = np.r_[0, np.cumsum(seg)]
    L = s[-1]
    if L < 0.08:
        return None
    k = max(2, int(np.ceil(L / 0.05)) + 1)
    t = np.linspace(0, L, k)
    line = np.stack([np.interp(t, s, mid[:, i]) for i in range(3)], 1)
    # light smoothing of inner points
    if len(line) > 4:
        sm = line.copy()
        sm[1:-1] = (line[:-2] + 2 * line[1:-1] + line[2:]) / 4
        line = sm
    return line


def main():
    out = bytearray(b"CELL" + struct.pack("<I", 1))
    summary = {}

    # ribosomes
    r = inst("ribo_seg")
    keep = r["count"] >= 3
    P = r["centre"][keep] - ORIGIN_UM
    order = np.lexsort((P[:, 0], P[:, 1], P[:, 2]))
    P = P[order]
    out += b"RIBO" + struct.pack("<I", len(P)) + q16(P).tobytes()
    vol = r["count"][keep] * np.prod(r["vox_nm"])
    summary["ribosomes"] = dict(n=int(len(P)), radius_nm_median=float(np.median((3 * vol / 4 / np.pi) ** (1 / 3))))

    # vesicles
    v = inst("vesicle_seg")
    keep = v["count"] >= 3
    P = v["centre"][keep] - ORIGIN_UM
    rad = (3 * v["count"][keep] * np.prod(v["vox_nm"]) / 4 / np.pi) ** (1 / 3)
    out += b"VESI" + struct.pack("<I", len(P)) + q16(P).tobytes() + np.clip(np.round(rad), 1, 255).astype("u1").tobytes()
    summary["vesicles"] = dict(n=int(len(P)), radius_nm_p50=float(np.median(rad)))

    # nuclear pores: normal from the smoothed nucleus mask
    d = np.load(os.path.join(ROI, "nucleus_seg_s2.npz"))
    nuc = ndi.gaussian_filter((d["v"] == 1).astype(np.float32), 3)
    gz, gy, gx = np.gradient(nuc)
    ov, vox = d["origin_vox"], d["vox_nm"]
    npi = inst("np_seg")
    keep = npi["count"] >= 50
    C = npi["centre"][keep]
    idx = np.round((C * 1000 / vox) - ov).astype(int)            # x, y, z voxel
    idx = np.clip(idx, 0, np.array(nuc.shape[::-1]) - 1)
    g = np.stack([gx[idx[:, 2], idx[:, 1], idx[:, 0]], gy[idx[:, 2], idx[:, 1], idx[:, 0]],
                  gz[idx[:, 2], idx[:, 1], idx[:, 0]] * vox[0] / vox[2]], 1)
    nrm = -g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)   # out of the nucleus
    P = C - ORIGIN_UM
    out += b"NPOR" + struct.pack("<I", len(P)) + q16(P).tobytes() + np.round(nrm * 127).astype("i1").tobytes()
    summary["nuclear_pores"] = dict(n=int(len(P)))

    # microtubules
    m = inst("mt-out_seg")
    V = m["voxels"]
    lines = []
    for i in np.unique(V[:, 3]).astype(int):
        Pi = V[V[:, 3] == i, :3].astype(np.float64)
        ln = centreline(Pi)
        if ln is not None:
            lines.append(ln - ORIGIN_UM)
    pts = np.concatenate(lines)
    out += b"MTUB" + struct.pack("<I", len(lines)) + np.array([len(l) for l in lines], "<u2").tobytes() + q16(pts).tobytes()
    summary["microtubules"] = dict(pieces=len(lines), total_length_um=float(sum(np.linalg.norm(np.diff(l, axis=0), axis=1).sum() for l in lines)))

    # centrioles
    c = inst("cent_seg")
    V = c["voxels"]
    cents = []
    for i in np.unique(V[:, 3]).astype(int):
        Pi = V[V[:, 3] == i, :3].astype(np.float64)
        mu = Pi.mean(0)
        w, U = np.linalg.eigh(np.cov((Pi - mu).T))
        ax = U[:, -1]
        proj = (Pi - mu) @ ax
        length = float(np.percentile(proj, 98) - np.percentile(proj, 2))
        rad = float(np.percentile(np.linalg.norm((Pi - mu) - np.outer(proj, ax), axis=1), 95))
        cents.append((mu - ORIGIN_UM, ax, length, rad, len(Pi)))
    out += b"CENT" + struct.pack("<I", len(cents))
    for mu, ax, length, rad, n in cents:
        out += struct.pack("<7f", *mu, *ax, length)
    summary["centrioles"] = [dict(centre=np.round(mu, 3).tolist(), length_um=round(length, 3), radius_um=round(rad, 3), voxels=n) for mu, ax, length, rad, n in cents]

    out += b"BOX " + struct.pack("<I", 1) + struct.pack("<6f", *LO, *HI)
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    open(DEST, "wb").write(out)
    summary["bytes"] = len(out)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
