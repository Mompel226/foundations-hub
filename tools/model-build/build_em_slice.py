"""The real electron-microscope picture of the same HeLa cell (jrc_hela-2, Janelia, CC BY 4.0), from the raw FIB-SEM
volume, with each organelle the computer found outlined in the colour it has in the 3D.

    python3 build_em_slice.py   -> ../../assets/cell/em-section.webp, em-section-outline.png, em-slice.json

One image of the stack, the plane z = 13.2 µm of the dataset (scene z = -2.55 µm), from the coverslip up (dataset y
0-6.4 µm), across 12 µm of x (scale s2, 16 nm pixels): the cell membrane on top, the nucleus on the right, the
cytoplasm between, the glass below; the detailed box outlined in green, as the green frame in the 3D. It is shown
beside the organelles, and in the cell's "More" (it shows that the block is a section of the cell).
(A window square to the reader's gaze, re-sampled at 4 nm, was tried on 4 Oct and taken out the same day: Daniel,
"you don't really know what you're looking at… show the whole image". It is in the git history.)
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
    # where it is in the 3D (scene µm): the plane z, and the detailed box on it (the green frame drawn there)
    json.dump({"z": round(SECTION_Z - ORIGIN_UM[2], 4), "x": [SECTION_X[0] - ORIGIN_UM[0], SECTION_X[1] - ORIGIN_UM[0]],
               "box": {"x": [SCENE_UM["x"][0] - ORIGIN_UM[0], SCENE_UM["x"][1] - ORIGIN_UM[0]], "y": list(SCENE_UM["y"])},
               "size": [W, H], "nm_per_px": vx}, open(OUT + "em-slice.json", "w"), indent=1)
    print(f"section {W} x {H} px ({W * vx / 1000:.1f} x {H * vy / 1000:.1f} µm); cache {N.cache_mb():.0f} MB")


if __name__ == "__main__":
    section()
