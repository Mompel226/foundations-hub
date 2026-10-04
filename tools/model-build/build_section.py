"""The organ, cut open: the uterus and cervix of the Atlas sliced down the middle (a plane through the canal of the
cervix), and the cut face painted with the tissues it is made of. This is the step between the organ and the tissue.

    python3 build_section.py   -> ../../assets/body/section.webp (the cut face, transparent outside the wall)
                                  ../../assets/body/section-map.png (which tissue each point is)
                                  ../../assets/body/section.json (the plane, the face's corners, where the zoom dives
                                                                  in, and where each tissue is labelled)

The outlines are the Atlas's (HuBMAP United Female v1.10): its uterus and cervix are hollow, so one slice gives the
outer surface and the cavity of the uterus and the canal of the cervix. The layers inside the wall are drawn from
what histology describes, at these widths (the woman of the Visible Human was 59, after the menopause, so her
lining is thin):
  uterus   lining (endometrium) 1.2 mm; muscle (myometrium) the rest; outer covering (perimetrium) 0.15 mm
  cervix   a single layer of tall columnar cells lines the canal and folds into the wall as crypts 3-5 mm deep
           (IARC screening atlas); the wall is mostly connective tissue, with bundles of smooth muscle;
           outer covering 0.15 mm
The colours are those of the usual stain (haematoxylin and eosin), so the cut face reads like the micrograph.
"""
import json, os
import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage

SRC = os.path.expanduser("~/Library/Caches/biology-hub/anatomy/parts/")
OUT = os.path.join(os.path.dirname(__file__), "../../assets/body/")
PX = 0.00003                                  # 30 um a pixel
RNG = np.random.default_rng(7)

def tri(p):
    d = np.load(os.path.join(SRC, "VH_F_" + p + ".npz"))
    return trimesh.Trimesh(d["v"].astype(np.float64), d["f"], process=True)

def bodies(p):
    """the part's separate surfaces, biggest first (the outer surface, then the lining of its cavity)"""
    return sorted(tri(p).split(only_watertight=False), key=lambda m: -m.area)

# the plane: through the middle of the canal of the cervix (the cervix's second surface)
canal = bodies("cervix")[1]
X = float(canal.vertices[:, 0].mean())
OUTER = {"uterus": [bodies(p)[0] for p in ("body_of_uterus", "fundus_of_uterus", "lower_uterine_segment")],
         "cervix": [bodies("cervix")[0], bodies("external_cervical_os")[0]]}
INNER = [bodies(p)[1] for p in ("body_of_uterus", "fundus_of_uterus", "lower_uterine_segment", "cervix")] + [tri("internal_cervical_os")]

def segs(meshes):
    out = []
    for m in meshes:
        s = trimesh.intersections.mesh_plane(m, [1, 0, 0], [X, 0, 0])
        if len(s): out.append(s[:, :, 1:])      # (z, y)... kept as (y, z) below
    return np.concatenate(out) if out else np.zeros((0, 2, 2))

allz = np.concatenate([segs(v).reshape(-1, 2) for v in OUTER.values()])
lo = allz.min(0) - 0.002; hi = allz.max(0) + 0.002          # (y, z) in metres
H, W = int(np.ceil((hi[0] - lo[0]) / PX)), int(np.ceil((hi[1] - lo[1]) / PX))
def pix(p):        # (y, z) -> (row, col); row 0 at the top (highest y), col 0 at the back (lowest z)
    return (hi[0] - p[..., 0]) / PX, (p[..., 1] - lo[1]) / PX

def raster(S, img, val=1):
    for a, b in S:
        n = int(max(abs(np.subtract(pix(a), pix(b)))) * 2) + 2
        t = np.linspace(0, 1, n)[:, None]
        r, c = pix(a + (b - a) * t)
        img[np.clip(r.astype(int), 0, H - 1), np.clip(c.astype(int), 0, W - 1)] = val
    return img

# the wall: inside the outer surface, outside the cavity and the canal
line_o = np.zeros((H, W), np.uint8); part = np.zeros((H, W), np.uint8)
for k, (name, ms) in enumerate(OUTER.items(), 1):
    raster(segs(ms), line_o); raster(segs(ms), part, k)
line_o = ndimage.binary_dilation(line_o, iterations=1)
line_i = ndimage.binary_dilation(raster(segs(INNER), np.zeros((H, W), np.uint8)), iterations=1)
# The canal opens at the external os, so the outer surface is not closed in the slice: the outer surface and the
# lining of the canal and cavity together make one closed outline, the wall's.
wall = ndimage.binary_fill_holes(line_o | line_i)
# the whole organ (wall, cavity and canal): the outline closed across the opening of the os (gaps up to 3.6 mm)
inside = ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_dilation(line_o | line_i, iterations=60)), iterations=60) | wall
cavity = inside & ~wall
# the cavity and the canal are one space; anything else the inner surfaces close (the fundus's second surface
# also crosses the openings of the oviducts) is wall
lab, nlab = ndimage.label(cavity)
cavity = lab == (np.argmax(ndimage.sum(cavity, lab, range(1, nlab + 1))) + 1)
line_i &= ndimage.binary_dilation(cavity, iterations=3)
wall = inside & ~cavity & ~line_i
d_in = ndimage.distance_transform_edt(~(cavity | line_i)) * PX * 1000   # mm from the cavity or canal
d_out = ndimage.distance_transform_edt(inside & ~(line_o & ~line_i)) * PX * 1000   # mm from the outer surface
d_out = np.where(cavity, 99, d_out)
outside = ~inside
# which organ each point belongs to: the organ of the nearest outer surface (1 uterus, 2 cervix)
_, (pr, pc) = ndimage.distance_transform_edt(part == 0, return_indices=True)
organ = part[pr, pc]

def smooth_noise(scale_px, aniso=None):
    n = RNG.standard_normal((H, W)).astype(np.float32)
    s = (scale_px, scale_px) if aniso is None else aniso
    n = ndimage.gaussian_filter(n, s)
    return (n - n.mean()) / (n.std() + 1e-9)

def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

img = np.zeros((H, W, 4), np.float32)
# muscle (uterus): interlacing bundles; connective tissue (cervix): paler, finely fibrous, a few muscle bundles
bundles = smooth_noise(6) * 0.6 + smooth_noise(2, (1, 4)) * 0.4
fibres = smooth_noise(1.2, (0.6, 3)) * 0.6 + smooth_noise(4) * 0.4
MUSCLE, CT, LINING_U, EPI, COVER, LUMEN, CRYPT_L = (hexc(c) for c in ("#C2566F", "#EBB0C3", "#9C5FA8", "#6A3F9C", "#F4D6DF", "#3B2742", "#EFE4EF"))
ut = wall & (organ == 1); cx = wall & (organ == 2)
img[..., :3][ut] = MUSCLE[None] * (1 + 0.09 * bundles[ut, None])
img[..., :3][cx] = CT[None] * (1 + 0.045 * fibres[cx, None])
# bundles of smooth muscle in the cervix: many next to the body of the uterus, few towards the vagina
from_ut = ndimage.distance_transform_edt(~ut) * PX * 1000
mb = cx & (smooth_noise(3, (2.5, 9)) > 1.0 + 0.5 * np.minimum(from_ut / 6, 1))
img[..., :3][mb] = (0.55 * MUSCLE[None] + 0.45 * CT[None]) * (1 + 0.06 * bundles[mb, None])
# the body of the uterus becomes the cervix over a few millimetres (the isthmus): connective tissue mixes in
from_cx = ndimage.distance_transform_edt(~cx) * PX * 1000
ct_in = ut & (from_cx < 4) & (smooth_noise(3, (2.5, 9)) > -1.2 + 0.8 * from_cx)
img[..., :3][ct_in] = CT[None] * (1 + 0.045 * fibres[ct_in, None])
# the lining of the uterus (thin, after the menopause)
el = ut & (d_in < 1.2)
img[..., :3][el] = LINING_U[None] * (1 + 0.08 * smooth_noise(1.5)[el, None])
# the crypts of the cervix: the canal's lining folds into the wall, 3 to 5 mm deep, some of them branching.
# A crypt is drawn as its lining (purple) round a narrow lumen full of mucus (pale).
canal_edge = cx & (d_in < 0.05)
grad_r, grad_c = np.gradient(ndimage.gaussian_filter(d_in, 3))
crypt = np.zeros((H, W), bool); lumen = np.zeros((H, W), bool)
def stamp(mask, r, c, rad):
    r0_, r1_ = max(0, int(r - rad)), min(H, int(r + rad) + 2); c0_, c1_ = max(0, int(c - rad)), min(W, int(c + rad) + 2)
    rr, cc = np.ogrid[r0_:r1_, c0_:c1_]
    mask[r0_:r1_, c0_:c1_] |= (rr - r) ** 2 + (cc - c) ** 2 <= rad ** 2
def into_wall(r, c):
    g = np.array([grad_r[int(r), int(c)], grad_c[int(r), int(c)]]); return g / (np.linalg.norm(g) + 1e-9)
def grow(r, c, g, length_mm, rad, straight=False, branch=True):
    turn = 0.0
    for k in range(int(length_mm / (PX * 1000))):
        if not straight:
            turn = 0.8 * turn + RNG.normal(0, 0.03)
            pull = into_wall(r, c)
            g = 0.92 * g + 0.08 * pull
            g = np.array([g[0] * np.cos(turn) - g[1] * np.sin(turn), g[0] * np.sin(turn) + g[1] * np.cos(turn)])
            g /= np.linalg.norm(g)
        r += g[0]; c += g[1]
        if not (0 <= int(r) < H and 0 <= int(c) < W) or not cx[int(r), int(c)]: return
        stamp(crypt, r, c, rad); stamp(lumen, r, c, rad - 1.4)
        if branch and k > 20 and RNG.random() < 0.012:
            a = RNG.choice([-0.7, 0.7])
            gb = np.array([g[0] * np.cos(a) - g[1] * np.sin(a), g[0] * np.sin(a) + g[1] * np.cos(a)])
            grow(r, c, gb, RNG.uniform(0.8, 1.8), rad * 0.85, branch=False)
# where the zoom dives in: the canal's lining half way along the canal, on its lower wall (the side that faces up)
lining = canal_edge & (grad_r > 0)                                      # into the wall is downwards
ly, lx = np.nonzero(lining)
mid = np.argsort(lx)[len(lx) // 2]
r0, c0 = ly[mid], lx[mid]
g0 = into_wall(r0, c0)
# the tissue's frame on this face (tissue3d.js): x along the lining, y out of the wall into the canal (µm)
n_yz = np.array([g0[0], -g0[1]]); t_yz = np.array([n_yz[1], -n_yz[0]])
P_yz = np.array([hi[0] - r0 * PX, lo[1] + c0 * PX])
def from_tissue(x, y):       # tissue µm -> (row, col)
    Y, Zb = P_yz + (x * t_yz + y * n_yz) * 1e-6
    return (hi[0] - Y) / PX, (Zb - lo[1]) / PX
# the crypt the tissue model has outside its photograph (x = 640 µm, 124 µm across with its cells), straight on
# into the wall below the block, 4 mm deep in all
rc, cc_ = from_tissue(640, 0)
grow(float(rc), float(cc_), g0.copy(), 4.0, 0.062 / (PX * 1000), straight=True, branch=False)
# the others, about every 1.5 to 2.5 mm along both walls of the canal, none within 2.6 mm of the dive (the tissue
# model's block, 2 mm across, is painted there below)
ey, ex = np.nonzero(canal_edge)
done = [(r0, c0)]
for i in RNG.permutation(len(ey)):
    r, c = ey[i], ex[i]
    if min(np.hypot(r - a, c - b) for a, b in done) < RNG.uniform(1.5, 2.5) / (PX * 1000): continue
    if np.hypot(r - r0, c - c0) < 2.6 / (PX * 1000): continue
    done.append((r, c))
    grow(float(r), float(c), into_wall(r, c), RNG.uniform(3.0, 5.0), RNG.uniform(0.09, 0.14) / (PX * 1000))
crypt &= cx; lumen &= crypt
# The cervix's lining (on the canal and in the crypts) is painted as the tissue model has it, at this scale (30 µm a
# pixel; measured on the model's face, bake-face.js): tall pale cells 40 µm, their nuclei in a row near the base. So,
# from the open space into the wall: one pale pixel (the cells), then one of the nuclei's row mixed with connective
# tissue. A solid purple band 90 µm wide was painted before, and the model, where it is drawn over the face on the way
# in, did not match it (Daniel, 4 Oct: "why is that different?")
LIN_TOP, LIN_BASE = hexc("#ECD9E7"), hexc("#D19FC2")
crypt_wall = crypt & ~lumen
crypt_in = crypt_wall & ndimage.binary_dilation(lumen, iterations=1)
crypt_out = crypt_wall & ~crypt_in
thin = crypt_in & ndimage.binary_dilation(cx & ~crypt, iterations=1)       # one pixel thick: both at once
img[..., :3][crypt_out] = LIN_BASE[None]
img[..., :3][crypt_in] = LIN_TOP[None]
img[..., :3][thin] = (0.5 * (LIN_TOP + LIN_BASE))[None]
img[..., :3][lumen] = CRYPT_L[None]
# (on the canal: the first pixel of the wall is the cells, the next the nuclei's row; the surface is where the tissue
# model has it, the dive point, so the two meet without a step)
lin_base = cx & ~crypt & ndimage.binary_dilation(canal_edge, iterations=1) & ~canal_edge
img[..., :3][lin_base] = LIN_BASE[None]
img[..., :3][canal_edge] = LIN_TOP[None]
cover = wall & (d_out < 0.15)
img[..., :3][cover] = COVER[None]
img[..., :3][cavity] = LUMEN[None]
# the surface of the cavity and the canal (the line the Atlas's inner surface makes) is lining too: left unpainted, it
# was a black, stepped edge when the zoom came close; and the edge is softened over a pixel either side
img[..., :3][line_i & (organ == 2)] = LUMEN[None]                        # (the canal, up to its lining)
img[..., :3][line_i & (organ == 1)] = LINING_U[None]
rim = ndimage.binary_dilation(cavity, iterations=2) & ndimage.binary_dilation(~cavity, iterations=2) & inside
soft = np.stack([ndimage.gaussian_filter(img[..., k], 1.0) for k in range(3)], -1)
img[..., :3][rim] = soft[rim]
# Where the zoom goes in, the face is the tissue model's own front face (tools/model-build/bake-face.js: drawn flat,
# 1 µm a pixel), so the organ shows there what the tissue level will show: its surface with the fold, the glands
# cut across, the crypt; faded into the painting round it over the block's last 150 µm
FACE = os.path.expanduser("~/Library/Caches/biology-hub/tissue/tissue-face.png")
FX0, FY1 = -1200, 200                                       # the bake's corner (µm), as in bake-face.js
face = np.asarray(Image.open(FACE).convert("RGBA")).astype(np.float32) / 255
fa = face[..., 3]
prem = [ndimage.gaussian_filter(face[..., k] * fa, 12) for k in range(3)]; fab = ndimage.gaussian_filter(fa, 12)
cellish = ndimage.binary_dilation((face[..., 1] > 190 / 255) & (fa > 0.5), iterations=20)
rows_, cols_ = np.mgrid[0:H, 0:W].astype(np.float32)
dY = (hi[0] - rows_ * PX) - P_yz[0]; dZ = (lo[1] + cols_ * PX) - P_yz[1]
tx = (dY * t_yz[0] + dZ * t_yz[1]) * 1e6; ty = (dY * n_yz[0] + dZ * n_yz[1]) * 1e6
fw = np.clip((1000 - np.abs(tx)) / 150, 0, 1) * np.clip((ty + 900) / 150, 0, 1) * (ty < 190)
fpx = [FY1 - ty, tx - FX0]                                   # (row, col) in the bake
samp = lambda a, o=1: ndimage.map_coordinates(a, fpx, order=o, mode="constant")
a_s = samp(fab)
model = np.stack([samp(c) for c in prem], -1) / np.maximum(a_s, 1e-3)[..., None] * 255
empty = np.where(ty > -120, 1, 0)[..., None] * LUMEN[None] + np.where(ty > -120, 0, 1)[..., None] * CRYPT_L[None]
col = model * a_s[..., None] + empty * (1 - a_s[..., None])
img[..., :3] = img[..., :3] * (1 - fw[..., None]) + col * fw[..., None]
inface = fw > 0.5
face_reg = np.where(samp(fa, 0) < 0.5, np.where(ty > -120, 6, 4), np.where(samp(cellish.astype(np.float32), 0) > 0.5, 4, 3))
img[..., 3] = (inside * 255).astype(np.float32)
img[..., :3] = np.clip(img[..., :3], 0, 255)
def to_body(r, c):
    return [X, float(hi[0] - r * PX), float(lo[1] + c * PX)]
P = to_body(r0, c0)
n = [0.0, float(n_yz[0]), float(n_yz[1])]                               # out of the wall, into the canal
n = (np.array(n) / np.linalg.norm(n)).tolist()

def anchor(mask, score):
    s = np.where(mask, score, -1e9); r, c = np.unravel_index(np.argmax(s), s.shape)
    return to_body(r, c)
rows = np.arange(H)[:, None] * np.ones((1, W))
cols = np.ones((H, 1)) * np.arange(W)[None, :]
far_from_dive = np.hypot(rows - r0, cols - c0)
labels = {
    "muscle": anchor(ut & (d_in > 1.6) & (d_out > 0.6), np.minimum(d_in - 1.2, d_out)),
    "lining_u": anchor(el & (d_in > 0.3), -np.abs(d_in - 0.6) - far_from_dive * 0.0),
    "connective": anchor(cx & ~crypt & ~mb & (d_in > 1.5), np.minimum(d_in, d_out) - 0.002 * far_from_dive),
    "lining_c": anchor(canal_edge, -np.abs(cols - (c0 + 60)) - np.abs(rows - r0)),
    "cover": anchor(cover & ut, d_out * 0 - np.abs(rows - rows[cover & ut].mean())),
}
Image.fromarray(img.astype(np.uint8), "RGBA").save(OUT + "section.webp", quality=88, method=6)
# which tissue each point is, for naming what the pointer is on: 0 outside, 1 muscle, 2 lining of the uterus,
# 3 connective tissue, 4 lining of the cervix (with its crypts), 5 outer covering, 6 cavity or canal
reg = np.zeros((H, W), np.uint8)
reg[ut | mb] = 1; reg[ct_in | (cx & ~mb)] = 3; reg[el] = 2; reg[crypt | canal_edge | lin_base] = 4; reg[cover] = 5; reg[cavity] = 6
reg[line_i & (organ == 2)] = 6; reg[line_i & (organ == 1)] = 2
reg[inface] = face_reg[inface]
reg[~inside] = 0
# (at half size, and where any of the four pixels is lining, lining: at a quarter size most of the crypts, a few
# pixels wide, fell between the pixels, and pointing at one named the connective tissue)
h2, w2 = H // 2 * 2, W // 2 * 2
blk = reg[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2)
reg2 = np.where((blk == 4).any(axis=(1, 3)), 4, blk[:, 0, :, 0])
Image.fromarray(reg2.astype(np.uint8) * 40, "L").save(OUT + "section-map.png", optimize=True)
# ---- the vagina, cut by the same plane (Daniel, 4 Oct: the uterus and cervix were cut open and coloured as a slide,
# the vagina beside them was not, and how it joins the cervix could not be seen). The Atlas's vagina is hollow (an
# outer and an inner surface); the cervicovaginal junction carries its walls up round the tip of the cervix (the
# fornices). Its own, coarser picture (60 µm a pixel: the zoom never goes into it): the wall (smooth muscle and
# connective tissue), its lining (stratified squamous epithelium, about 0.3 mm), and the canal, dark as the canal of
# the cervix, so that the two read as one passage. Drawn just behind the uterus and cervix face (section.webp wins).
def vagina_face():
    PXV = 0.00006
    vo, vi = bodies("vagina")[:2]
    J = tri("cervicovaginal_junction")
    cerv = [bodies("cervix")[0], tri("external_cervical_os"), bodies("cervix")[1]]
    allv = np.concatenate([segs([m]).reshape(-1, 2) for m in (vo, J)])
    lo_v, hi_v = allv.min(0) - 0.002, allv.max(0) + 0.002
    Hv, Wv = int(np.ceil((hi_v[0] - lo_v[0]) / PXV)), int(np.ceil((hi_v[1] - lo_v[1]) / PXV))
    def pixv(p):
        return (hi_v[0] - p[..., 0]) / PXV, (p[..., 1] - lo_v[1]) / PXV
    def rast(S):
        img = np.zeros((Hv, Wv), bool)
        for a, b in S:
            k = int(max(abs(np.subtract(pixv(a), pixv(b)))) * 2) + 2
            t = np.linspace(0, 1, k)[:, None]; r, c = pixv(a + (b - a) * t)
            ok = (r >= 0) & (r < Hv) & (c >= 0) & (c < Wv); img[r[ok].astype(int), c[ok].astype(int)] = True
        return img
    # (the vagina's two surfaces are open at the top, where the junction carries them on, so neither fills alone: all
    # the cut lines together divide the face into closed regions, and each is told by what borders it)
    out_l = ndimage.binary_dilation(rast(segs([vo])), iterations=1)
    inner_l = ndimage.binary_dilation(rast(segs([vi])), iterations=1)
    junc_l = ndimage.binary_dilation(rast(segs([J])), iterations=1)
    cline = ndimage.binary_dilation(rast(segs(cerv)), iterations=1)
    lines = out_l | inner_l | junc_l | cline
    regions, nreg = ndimage.label(ndimage.binary_fill_holes(lines) & ~lines)
    junc_in = ndimage.binary_fill_holes(junc_l)                                       # the fornices' walls (closed loops)
    wall_v = np.zeros((Hv, Wv), bool); lumen_v = np.zeros((Hv, Wv), bool)
    for k in range(1, nreg + 1):
        R = regions == k; edge = ndimage.binary_dilation(R, iterations=2) & ~R
        t_out, t_in, t_jn, t_cv = (edge & out_l).sum(), (edge & inner_l).sum(), (edge & junc_l).sum(), (edge & cline).sum()
        if (R & junc_in).sum() > 0.5 * R.sum() or t_out > 0.15 * edge.sum():
            wall_v |= R                                                               # between the outer surface and the canal
        elif t_in + t_jn > 0.3 * edge.sum():
            lumen_v |= R                                                              # the canal, and the vault round the cervix
        # (else: inside the cervix, which the uterus and cervix face shows)
    wall_v |= (out_l | junc_l | inner_l) & ndimage.binary_dilation(wall_v | lumen_v, iterations=3)   # (the lines are wall)
    lumen_v &= ~wall_v
    d_lum = ndimage.distance_transform_edt(~lumen_v) * PXV * 1000                       # mm from the canal
    rng = np.random.default_rng(11)
    nz = ndimage.gaussian_filter(rng.standard_normal((Hv, Wv)).astype(np.float32), (1.5, 4)); nz /= nz.std() + 1e-9
    WALL_V, LINING_V = 0.5 * MUSCLE + 0.5 * CT, hexc("#B9649C")
    img_v = np.zeros((Hv, Wv, 4), np.float32)
    img_v[..., :3][wall_v] = WALL_V[None] * (1 + 0.06 * nz[wall_v, None])
    lin = wall_v & (d_lum < 0.35)                                                   # the lining, on the canal side
    img_v[..., :3][lin] = LINING_V[None]
    img_v[..., :3][lumen_v] = LUMEN[None]
    img_v[..., 3] = ((wall_v | lumen_v) * 255).astype(np.float32)
    Image.fromarray(np.clip(img_v, 0, 255).astype(np.uint8), "RGBA").save(OUT + "section-vagina.webp", quality=88, method=6)
    def tbv(r, c):
        return [X, float(hi_v[0] - r * PXV), float(lo_v[1] + c * PXV)]
    # its name: the deepest point of the wall, in the tube below the cervix
    dw = ndimage.distance_transform_edt(wall_v)
    rows = np.arange(Hv)[:, None] * np.ones((1, Wv))
    dw[rows < Hv * 0.35] = 0
    r, c = np.unravel_index(np.argmax(dw), dw.shape)
    print(f"vagina face {Wv} x {Hv} px ({Wv * PXV * 1000:.0f} x {Hv * PXV * 1000:.0f} mm); wall px {int(wall_v.sum())}, canal px {int(lumen_v.sum())}")
    return {"corners": [tbv(0, 0), tbv(0, Wv), tbv(Hv, Wv), tbv(Hv, 0)], "px_m": PXV, "size": [Wv, Hv], "label": tbv(r, c)}


meta = {
    "x": X, "corners": [to_body(0, 0), to_body(0, W), to_body(H, W), to_body(H, 0)], "px_m": PX, "size": [W, H],
    "dive": P, "normal": n, "labels": labels, "vagina": vagina_face(),
}
json.dump(meta, open(OUT + "section.json", "w"), indent=1)
print(f"plane x = {X * 1000:.2f} mm; face {W} x {H} px ({W * PX * 1000:.0f} x {H * PX * 1000:.0f} mm); dive at "
      f"{np.round(np.array(P) * 1000, 2).tolist()} mm, normal {np.round(n, 3).tolist()}")
print("wall px", int(wall.sum()), "uterus", int(ut.sum()), "cervix", int(cx.sum()), "cavity", int(cavity.sum()), "crypt", int(crypt.sum()))
