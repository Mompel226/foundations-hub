"""Two real electron-microscope pictures of the same HeLa cell (jrc_hela-2, Janelia, CC BY 4.0), from the raw
FIB-SEM volume, with each organelle the computer found outlined in the colour it has in the 3D.

    python3 build_em_slice.py   -> ../../assets/cell/em-slice.webp, em-outline.png, em-slice.json
                                       the organelles level's picture: the cut through the green frame in front
                                       of the reader, square to their gaze (the frame is drawn in the 3D)
                                   ../../assets/cell/em-section.webp, em-section-outline.png
                                       the cell level's picture ("More"): one image of the stack across the
                                       whole width, so it shows the block is a section of the cell

The window. The reader stops at the end of the straight way in (cell3d.js DIVE_END), looking along DIVE. The
window is a plane square to that gaze, 2 µm ahead, 1.4 x 1.3 µm: it fills the part of the screen the panels leave
free. The microscope photographed planes of constant z; this plane is tipped to them, so it is re-sampled from
the stack (full resolution, 4 x 4 x 5.24 nm voxels, trilinear): real measurements, on a plane the reader faces.
The outlines come from the same segmentations the 3D was built from (fetch_roi.py, scale s2), smoothed.
Image axes: right = the reader's right, up = the reader's up. If DIVE_END moves, run this again.

The section: the plane z = 13.2 µm of the dataset, one image of the stack (scale s2, 16 nm pixels), from the
coverslip up (dataset y 0-6.4 µm), across 12 µm of x; the detailed box outlined in green.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
import n5fetch as N
from fetch_roi import OUT as ROI
from build_meshes import ORIGIN_UM, SCENE_UM

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../../assets/cell/")
COL = {"nucleus": "#5b4bb5", "er": "#2fa38c", "mito": "#e8613a", "golgi": "#e3a72f", "lyso": "#d1497b", "endo": "#b898c8",
       "ld": "#f3e6a1", "pm": "#e2c6dd"}
SEG = {"nucleus": "nucleus_seg", "er": "er_seg", "mito": "mito_seg", "golgi": "golgi_seg", "lyso": "lyso_seg", "endo": "endo_seg",
       "ld": "ld_seg", "pm": "pm_seg"}
RAW = "em/fibsem-uint16"

# the reader's stop and gaze (cell3d.js: VIEWS.cell.pos and DIVE_END), scene µm
CELL_VIEW = np.array([-44.0, 36.0, 40.0])
DIVE_END = np.array([-14.35, 3.78, -1.09])
AHEAD, A, B, NM = 2.0, (-0.7, 0.7), (-0.65, 0.65), 4.0       # µm ahead; half-widths along right and up (µm); nm per px

SECTION_Z, SECTION_X = 13.2, (5.0, 17.0)                    # dataset µm


def contrast(img, mask=None):
    """Stretch between the 0.5th and 99.5th percentile of the cell; membranes dark on pale, as microscopists show it."""
    v = img[mask] if mask is not None else img[img > 0]
    lo, hi = np.percentile(v, [0.5, 99.5])
    g = np.clip((img - lo) / (hi - lo), 0, 1)
    return 1 - g if np.median(g) < 0.5 else g


def masks_at(coords_um):
    """Each class's mask at the given dataset points (µm, shape [3, ...] as x, y, z), smoothed from the s2 labels."""
    out = {}
    ne_cache = None
    for name, seg in SEG.items():
        p = os.path.join(ROI, f"{seg}_s2.npz")
        if not os.path.exists(p):
            continue
        z = np.load(p); v, o, vox = z["v"], z["origin_vox"], z["vox_nm"]                 # v[z, y, x]; o = x, y, z
        idx = [coords_um[2] * 1000 / vox[2] - o[2], coords_um[1] * 1000 / vox[1] - o[1], coords_um[0] * 1000 / vox[0] - o[0]]
        m = ndi.map_coordinates((v > 0).astype(np.float32), idx, order=1, mode="constant") > 0.5
        if ne_cache is None:
            ne = np.load(os.path.join(ROI, "ne_seg_s2.npz"))["v"] > 0
            ne_cache = ndi.map_coordinates(ne.astype(np.float32), idx, order=1, mode="constant") > 0.5
        # as in the 3D (build_meshes.py): the envelope round the nucleus is labelled as ER; it belongs to the nucleus
        if name == "er": m &= ~ndi.binary_dilation(ne_cache, iterations=2)
        if name == "nucleus": m = ndi.binary_fill_holes(m | ne_cache)
        out[name] = m
    return out


def outline(masks, W, H, keep, pm_width=1):
    """An RGBA overlay: the edge of each mask (inside `keep`) in its colour; and where to name each class."""
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov); labels = {}
    for name, m in masks.items():
        m = m & keep
        if not m.any():
            continue
        if name == "pm": m = ndi.binary_dilation(m, iterations=pm_width)
        edge = m & ~ndi.binary_erosion(m, iterations=1)
        col = tuple(int(COL[name][i:i + 2], 16) for i in (1, 3, 5)) + (235,)
        r = max(1.0, W / 560)
        for yy, xx in zip(*np.nonzero(edge)):
            d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=col)
        lab, n = ndi.label(m)
        k = int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))) + 1
        cy, cx = ndi.center_of_mass(lab == k)
        labels[name] = [round(cx / W * 100, 1), round(cy / H * 100, 1)]
    return ov, d, labels


def window():
    d = DIVE_END - CELL_VIEW; d /= np.linalg.norm(d)
    r = np.array([-d[2], 0, d[0]]); r /= np.linalg.norm(r)
    u = np.cross(r, d)
    C = DIVE_END + AHEAD * d
    W, H = int(round((A[1] - A[0]) * 1000 / NM)), int(round((B[1] - B[0]) * 1000 / NM))
    a = A[0] + (np.arange(W) + 0.5) * NM / 1000
    b = B[1] - (np.arange(H) + 0.5) * NM / 1000                                      # rows from the top
    P = C[:, None, None] + r[:, None, None] * a[None, None, :] + u[:, None, None] * b[None, :, None]   # [3, H, W] scene
    D = P + np.array(ORIGIN_UM)[:, None, None]                                         # dataset µm
    vx, vy, vz = N.voxel_nm(RAW, "s0")
    lo = [int(np.floor(D[i].min() * 1000 / s)) - 2 for i, s in enumerate((vx, vy, vz))]
    hi = [int(np.ceil(D[i].max() * 1000 / s)) + 2 for i, s in enumerate((vx, vy, vz))]
    vol = N.read(RAW, "s0", lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]).astype(np.float32)   # [z, y, x]
    idx = [D[2] * 1000 / vz - lo[2], D[1] * 1000 / vy - lo[1], D[0] * 1000 / vx - lo[0]]
    img = ndi.map_coordinates(vol, idx, order=1)
    g = contrast(img, img > 0)
    Image.fromarray((g * 255).astype(np.uint8)).save(OUT + "em-slice.webp", quality=88, method=6)
    ov, dr, labels = outline(masks_at(D), W, H, np.ones((H, W), bool))
    # the ribosomes the plane cuts (instance segmentation, as small.bin): a ring round each, in their 3D colour
    rb = np.load(os.path.join(ROI, "inst_ribo_seg_s1.npz"))
    keep = rb["count"] >= 3
    Q = rb["centre"][keep] - np.array(ORIGIN_UM) - C                                   # scene µm, from the window's middle
    rad = (3 * rb["count"][keep] * np.prod(rb["vox_nm"]) / 4 / np.pi) ** (1 / 3) / 1000
    off, qa, qb = Q @ np.cross(r, u), Q @ r, Q @ u
    cut = (np.abs(off) < rad) & (qa > A[0]) & (qa < A[1]) & (qb > B[0]) & (qb < B[1])
    ring = (0x6a, 0x46, 0xa8, 245)
    for x_, y_ in zip((qa[cut] - A[0]) * 1000 / NM, (B[1] - qb[cut]) * 1000 / NM):
        dr.ellipse([x_ - 4, y_ - 4, x_ + 4, y_ + 4], outline=ring, width=2)
    if cut.any():
        k = int(np.argmin((qa[cut] - 0.0) ** 2 + (qb[cut] + 0.3) ** 2))
        labels["ribo"] = [round((qa[cut][k] - A[0]) / (A[1] - A[0]) * 100, 1), round((B[1] - qb[cut][k]) / (B[1] - B[0]) * 100, 1)]
    print(f"ribosomes cut by the window: {int(cut.sum())}")
    ov.save(OUT + "em-outline.png", optimize=True)
    meta = {"plane": {"c": C.round(4).tolist(), "r": r.round(5).tolist(), "u": u.round(5).tolist(), "a": list(A), "b": list(B)},
            "size": [W, H], "nm_per_px": NM, "labels": labels, "block_vox": [hi[i] - lo[i] for i in range(3)]}
    json.dump(meta, open(OUT + "em-slice.json", "w"), indent=1)
    print(f"window {W} x {H} px ({W * NM / 1000:.2f} x {H * NM / 1000:.2f} µm) at {C.round(2)}; labels {labels}")


def section():
    vx, vy, vz = N.voxel_nm(RAW, "s2")
    zi = int(round(SECTION_Z * 1000 / vz))
    x0, x1 = int(round(SECTION_X[0] * 1000 / vx)), int(round(SECTION_X[1] * 1000 / vx))
    Y = N.attrs(RAW, "s2")["dimensions"][1]
    img = N.read(RAW, "s2", x0, x1, 0, Y, zi, zi + 1)[0][::-1].astype(np.float32)      # rows: y from the top; cols: x
    g = contrast(img)
    # the ion beam leaves faint vertical stripes ("curtains") in these images: each column's offset from its
    # neighbours, measured over the cell, is taken away (a light touch: only narrow stripes are removed)
    cellmask = img > np.percentile(img[img > 0], 5)
    colmean = np.array([np.median(g[cellmask[:, j], j]) if cellmask[:, j].sum() > 20 else np.nan for j in range(g.shape[1])])
    colmean = np.where(np.isnan(colmean), np.nanmedian(colmean), colmean)
    g = np.clip(g - (colmean - ndi.median_filter(colmean, size=15))[None, :] * 0.9, 0, 1)
    H, W = g.shape
    Image.fromarray((g * 255).astype(np.uint8)).save(OUT + "em-section.webp", quality=86, method=6)
    xs = SECTION_X[0] + (np.arange(W) + 0.5) * vx / 1000
    ys = (H - 1 - np.arange(H) + 0.5) * vy / 1000
    D = np.stack([np.broadcast_to(xs[None, :], (H, W)), np.broadcast_to(ys[:, None], (H, W)), np.full((H, W), SECTION_Z)])
    keep = ((D[0] >= SCENE_UM["x"][0]) & (D[0] <= SCENE_UM["x"][1]) & (D[1] >= SCENE_UM["y"][0]) & (D[1] <= SCENE_UM["y"][1]))
    ov, dr, _ = outline(masks_at(D), W, H, keep)
    bx0 = (SCENE_UM["x"][0] - SECTION_X[0]) * 1000 / vx; bx1 = (SCENE_UM["x"][1] - SECTION_X[0]) * 1000 / vx
    dr.rectangle([bx0, H - 1 - SCENE_UM["y"][1] * 1000 / vy, bx1, H - 1], outline=(143, 227, 200, 255), width=3)
    ov.save(OUT + "em-section-outline.png", optimize=True)
    print(f"section {W} x {H} px ({W * vx / 1000:.1f} x {H * vy / 1000:.1f} µm); cache {N.cache_mb():.0f} MB")


if __name__ == "__main__":
    window()
    section()
