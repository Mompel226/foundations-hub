"""The tissue model's cut face, traced from the micrograph beside it (assets/tissue/endocervix-tissue.jpg,
M. Häggström, CC0), so that the slice outlined on the model shows the same things in the same places.

    python3 trace_tissue.py   -> ../../assets/tissue/trace.json

Traced: the surface of the lining (the edge of the empty canal at the top), the gland cut across (the edge of
its empty lumen), the small blood vessels in the connective tissue (their pink red cells), and where the pins go.
Estimated: the scale, 0.38 µm a pixel, from the round nuclei of white blood cells (about 6-7 µm, 17-18 px);
the cells' height, from the photograph: about 40 µm on the surface, 65 µm in the gland (gland cells are taller,
IARC Screening Group's atlas); a second gland at the bottom left edge, of which the photograph shows only the
lining (its lumen is outside the picture).
Frame (µm): x to the right, y up, origin on the surface of the lining at the middle of the photograph.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTO = os.path.join(HERE, "../../assets/tissue/endocervix-tissue.jpg")
OUT = os.path.join(HERE, "../../assets/tissue/trace.json")
S = 0.38                                   # µm a pixel
H_SURF, H_GLAND = 40.0, 65.0               # cell heights, µm (measured on the photograph at this scale)

im = np.asarray(Image.open(PHOTO).convert("RGB")).astype(np.float32)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
white = ndi.binary_opening((r > 215) & (g > 210) & (b > 215), iterations=2)
lab, n = ndi.label(white)

def smooth_path(P, closed, sigma=6, step_px=2 / S):
    P = np.asarray(P, float)
    mode = "wrap" if closed else "nearest"
    P = np.c_[ndi.gaussian_filter1d(P[:, 0], sigma, mode=mode), ndi.gaussian_filter1d(P[:, 1], sigma, mode=mode)]
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    t = np.arange(0, d[-1], step_px)
    return np.c_[np.interp(t, d, P[:, 0]), np.interp(t, d, P[:, 1])]

# the canal: the empty region touching the top edge; its edge inside the picture is the surface of the lining
top = lab == lab[2, W // 2]
top = ndi.binary_fill_holes(ndi.binary_closing(top, iterations=6))
cs = max(measure.find_contours(np.pad(top, 1).astype(float), 0.5), key=len) - 1      # (row, col)
inside = (cs[:, 1] > 10) & (cs[:, 1] < W - 11) & (cs[:, 0] > 10) & (cs[:, 0] < H - 11)   # (the closing pulls the edge in)
idx = np.nonzero(inside)[0]
# the longest run of points away from the picture's edges
runs = np.split(idx, np.nonzero(np.diff(idx) > 1)[0] + 1)
run = max(runs, key=len)
surf = cs[run][:, ::-1]                                                              # (x, y) px
if surf[0, 0] > surf[-1, 0]: surf = surf[::-1]
surf = smooth_path(surf, False)

# the gland cut across: the biggest empty region inside the tissue below the surface
cands = []
for k in range(1, n + 1):
    m = lab == k
    if m[2, W // 2]: continue
    a = m.sum()
    if a < 20000: continue
    cy, cx = ndi.center_of_mass(m); cands.append((a, k, cx, cy))
_, gk, gcx, gcy = max(cands)
gm = ndi.binary_fill_holes(ndi.binary_closing(lab == gk, iterations=4))
gc = max(measure.find_contours(gm.astype(float), 0.5), key=len)[:, ::-1]
gland = smooth_path(gc, True, sigma=10)

# the pink of red blood cells: the small vessels in the connective tissue (not in the lining or the gland)
pink = ndi.binary_opening((r > 165) & (g < 125) & (b > 160) & (r - g > 80), iterations=2)
lab2, n2 = ndi.label(ndi.binary_closing(pink, iterations=4))
from scipy.spatial import cKDTree
near_surf = cKDTree(surf); near_gland = cKDTree(gland)
vessels = []
for k in range(1, n2 + 1):
    m = (lab2 == k) & pink
    a = m.sum()
    if a < 450: continue
    ys, xs = np.nonzero(m); cx, cy = xs.mean(), ys.mean()
    if near_surf.query([cx, cy])[0] < (H_SURF / S) * 1.6: continue                 # in the lining
    if near_gland.query([cx, cy])[0] < (H_GLAND / S) * 1.25: continue              # in the gland's cells
    cov = np.cov(np.c_[xs - cx, ys - cy].T); w_, v_ = np.linalg.eigh(cov)
    vessels.append({"x": cx, "y": cy, "rx": 2.2 * np.sqrt(w_[1]) + 6, "ry": 2.2 * np.sqrt(w_[0]) + 6, "a": float(np.arctan2(v_[1, 1], v_[0, 1]))})

# into µm, the model's frame
x0 = W / 2
y0 = float(np.interp(x0, surf[:, 0], surf[:, 1]))
um = lambda P: [[round((p[0] - x0) * S, 2), round((y0 - p[1]) * S, 2)] for p in P]
# the second gland (only its lining is in the picture, at the bottom left): moved left until its outer edge (lumen +
# cell height) keeps at least 15 µm from the first gland's
def ring(c, rx, ry): return np.array([[c[0] + rx * np.cos(t), c[1] + ry * np.sin(t)] for t in np.linspace(0, 2 * np.pi, 120, endpoint=False)])
def outer(P):
    c = P.mean(0); d = P - c; L = np.hypot(*d.T)[:, None]; return c + d * (1 + (H_GLAND / S) / L)
cx2 = -90
while True:
    second = ring([cx2, 1580], 90, 150)
    gap = cKDTree(outer(gland)).query(outer(second))[0].min() * S
    inside_first = measure.points_in_poly(outer(second), outer(gland)).any() if hasattr(measure, 'points_in_poly') else False
    if gap >= 15 and not inside_first: break
    cx2 -= 5
print(f"second gland centre x {cx2} px, {gap:.0f} µm from the first")
big = max(vessels, key=lambda v: v["rx"] * v["ry"])
marks = [
    {"part": "tcell", "text": "Lining cells", "px": [930, float(np.interp(930, surf[:, 0], surf[:, 1])) + 0.45 * H_SURF / S]},
    {"part": "tnucleus", "text": "Nucleus", "px": [330, float(np.interp(330, surf[:, 0], surf[:, 1])) + 0.85 * H_SURF / S]},
    {"part": "connective", "text": "Connective tissue", "px": [480, 760]},
    {"part": "capillary", "text": "Small blood vessel", "px": [big["x"], big["y"]]},
    {"part": "crypt", "text": "Crypt, cut across", "px": [gcx, gcy]},
]
for m in marks:
    m["pct"] = [round(m["px"][0] / W * 100, 1), round(m["px"][1] / H * 100, 1)]
    m["um"] = um([m["px"]])[0]
# each gland's outer edge (where its cells sit on the connective tissue): every point the cell height away from the
# lumen, found on a 1 µm grid, so the ring is smooth however wavy the lumen is
def basal_ring(lumen_um, h):
    P = np.array(lumen_um); lo = P.min(0) - h - 10; hi = P.max(0) + h + 10
    n = np.ceil(hi - lo).astype(int) + 1
    from matplotlib.path import Path as MPath
    yy, xx = np.mgrid[0:n[1], 0:n[0]]
    inside = MPath(P - lo).contains_points(np.c_[xx.ravel(), yy.ravel()]).reshape(n[1], n[0])
    dist = ndi.distance_transform_edt(~inside)
    c = max(measure.find_contours(dist, h), key=len)[:, ::-1] + lo                    # (x, y) µm
    c = smooth_path(c, True, sigma=3, step_px=2.0)
    return [[round(x, 2), round(y, 2)] for x, y in c]
glands_um = [um(gland), um(second)]
out = {
    "photo": {"w": W, "h": H, "um_per_px": S}, "frame": {"x": [round(-x0 * S, 1), round((W - x0) * S, 1)], "y": [round(y0 * S, 1), round((y0 - H) * S, 1)]},
    "heights": {"surface": H_SURF, "gland": H_GLAND},
    "surface": um(surf), "glands": [{"lumen": g, "basal": basal_ring(g, H_GLAND)} for g in glands_um],
    "vessels": [{"x": round((v["x"] - x0) * S, 1), "y": round((y0 - v["y"]) * S, 1), "rx": round(v["rx"] * S, 1), "ry": round(v["ry"] * S, 1), "a": round(-v["a"], 3)} for v in vessels],
    "marks": marks,
}
json.dump(out, open(OUT, "w"), indent=0)
print(f"surface {len(surf)} points from x {surf[0,0]:.0f} to {surf[-1,0]:.0f} px; gland {len(gland)} points round ({gcx:.0f}, {gcy:.0f}); "
      f"{len(vessels)} vessels; frame {out['frame']} µm")
