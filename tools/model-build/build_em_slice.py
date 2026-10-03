"""The organelles level's photograph: one real electron-microscope slice of the same HeLa cell (jrc_hela-2, Janelia,
CC BY 4.0), cut straight across the reader's view, 1.75 µm in front of where they stand among the organelles.

    python3 build_em_slice.py   -> ../../assets/cell/em-slice.webp   (the slice, as the microscope saw it)
                                   ../../assets/cell/em-outline.png  (each organelle the computer found, outlined in
                                                                       its colour in the 3D, inside the detailed box)
                                   ../../assets/cell/em-slice.json   (where it is in the 3D, and where to name things)

The slice is the plane x = 26.5 µm of the dataset (scene x = 1.5 µm), from the coverslip up through the nucleus
(dataset y 0-6.4 µm), across 12 µm of z. Read at scale s2 (16 x 16 x 21 nm voxels) from the raw FIB-SEM volume;
the outlines come from the same segmentations the 3D was built from (fetch_roi.py, scale s2).
Image axes: right = scene +z, up = scene +y, which is what the reader sees looking along +x.
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
X_UM = 26.5                              # dataset x of the slice
Z_UM = (9.75, 21.75)                     # dataset z across the slice (12 µm)
SCALE = "s2"
COL = {"nucleus": "#5b4bb5", "er": "#2fa38c", "mito": "#e8613a", "golgi": "#e3a72f", "lyso": "#d1497b", "endo": "#b898c8",
       "ld": "#f3e6a1", "pm": "#e2c6dd"}
SEG = {"nucleus": "nucleus_seg", "er": "er_seg", "mito": "mito_seg", "golgi": "golgi_seg", "lyso": "lyso_seg", "endo": "endo_seg",
       "ld": "ld_seg", "pm": "pm_seg"}

vx, vy, vz = N.voxel_nm("em/fibsem-uint16", SCALE)
xi = int(round(X_UM * 1000 / vx))
z0, z1 = int(round(Z_UM[0] * 1000 / vz)), int(round(Z_UM[1] * 1000 / vz))
Y = N.attrs("em/fibsem-uint16", SCALE)["dimensions"][1]
em = N.read("em/fibsem-uint16", SCALE, xi, xi + 1, 0, Y, z0, z1)[:, :, 0]      # [z, y]
img = em.T[::-1].astype(np.float32)                                             # rows: y downwards from the top; cols: z
# contrast: stretch between the 0.5th and 99.5th percentile of the cell (not the empty resin)
lo, hi = np.percentile(img[img > 0], [0.5, 99.5])
g = np.clip((img - lo) / (hi - lo), 0, 1)
# the raw volume is dark where it is dense; shown as the microscope's users show it, membranes dark on pale
if np.median(g) < 0.5: g = 1 - g
# the ion beam leaves faint vertical stripes ("curtains") along its path: each column's offset from its
# neighbours, measured over the cell, is taken away (a light touch: only narrow stripes are removed)
cellmask = img > np.percentile(img[img > 0], 5)
colmean = np.array([np.median(g[cellmask[:, j], j]) if cellmask[:, j].sum() > 20 else np.nan for j in range(g.shape[1])])
colmean = np.where(np.isnan(colmean), np.nanmedian(colmean), colmean)
stripe = colmean - ndi.median_filter(colmean, size=15)
g = np.clip(g - stripe[None, :] * 0.9, 0, 1)
# the slice is 16 x 21 nm a pixel; resample to square pixels (16 nm), so that shapes are not stretched
H, W = g.shape
Wsq = int(round(W * vz / vy))
pic = Image.fromarray((g * 255).astype(np.uint8)).resize((Wsq, H), Image.LANCZOS)
pic.save(OUT + "em-slice.webp", quality=86, method=6)

# outlines from the segmentations, only inside the detailed box (where the 3D shows the same parts)
ov = Image.new("RGBA", (Wsq, H), (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
labels = {}
for name, seg in SEG.items():
    p = os.path.join(ROI, f"{seg}_s2.npz")
    if not os.path.exists(p):
        continue
    z = np.load(p); v, o, vox = z["v"], z["origin_vox"], z["vox_nm"]          # v[z, y, x]; o = x, y, z of voxel 0
    xs = int(round(X_UM * 1000 / vox[0])) - o[0]
    if not 0 <= xs < v.shape[2]:
        continue
    m = v[:, :, xs] > 0                                                          # [z, y]
    # as in the 3D (build_meshes.py): the envelope round the nucleus is labelled as ER; it belongs to the nucleus
    ne = np.load(os.path.join(ROI, "ne_seg_s2.npz"))["v"][:, :, xs] > 0
    if name == "er": m &= ~ndi.binary_dilation(ne, iterations=2)
    if name == "nucleus": m |= ne; m = ndi.binary_fill_holes(m)
    # into the slice's pixels: rows from the top (y down), cols along z
    zz = (np.arange(v.shape[0]) + o[2]) * vox[2] / 1000                          # µm
    yy = (np.arange(v.shape[1]) + o[1]) * vox[1] / 1000
    inbox = ((zz >= SCENE_UM["z"][0]) & (zz <= SCENE_UM["z"][1]))[:, None] & ((yy >= SCENE_UM["y"][0]) & (yy <= SCENE_UM["y"][1]))[None, :]
    m &= inbox
    if name == "pm":
        m = ndi.binary_dilation(m, iterations=1)
    edge = m & ~ndi.binary_erosion(m, iterations=1)
    ez, ey = np.nonzero(edge)
    col = tuple(int(COL[name][i:i + 2], 16) for i in (1, 3, 5)) + (235,)
    for a, b in zip(ez, ey):
        cx = (zz[a] - Z_UM[0]) * 1000 / vy                                       # square 16 nm pixels
        cy = H - 1 - yy[b] * 1000 / vy
        d.ellipse([cx - 1.3, cy - 1.3, cx + 1.3, cy + 1.3], fill=col)
    # where to name it: the middle of its biggest piece in the slice, inside the box
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
        cz, cy_ = ndi.center_of_mass(lab == k)
        labels[name] = [round(((zz[int(cz)] - Z_UM[0]) * 1000 / vy) / Wsq * 100, 1), round((H - 1 - yy[int(cy_)] * 1000 / vy) / H * 100, 1)]
# the edge of the detailed box, as on the 3D
bz0 = (SCENE_UM["z"][0] - Z_UM[0]) * 1000 / vy; bz1 = (SCENE_UM["z"][1] - Z_UM[0]) * 1000 / vy
by1 = H - 1 - SCENE_UM["y"][1] * 1000 / vy
d.rectangle([bz0, by1, bz1, H - 1], outline=(143, 227, 200, 255), width=3)
ov.save(OUT + "em-outline.png", optimize=True)

meta = {
    "x": X_UM - ORIGIN_UM[0], "z": [Z_UM[0] - ORIGIN_UM[2], Z_UM[1] - ORIGIN_UM[2]], "y": [0, Y * vy / 1000],
    "box": {"z": [SCENE_UM["z"][0] - ORIGIN_UM[2], SCENE_UM["z"][1] - ORIGIN_UM[2]], "y": list(SCENE_UM["y"])},
    "size": [Wsq, H], "nm_per_px": vy, "labels": labels,
}
json.dump(meta, open(OUT + "em-slice.json", "w"), indent=1)
print(f"slice {Wsq} x {H} px ({Wsq * vy / 1000:.1f} x {H * vy / 1000:.1f} µm); labels {labels}; cache {N.cache_mb():.0f} MB")
