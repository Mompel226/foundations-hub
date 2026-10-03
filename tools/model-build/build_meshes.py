"""Turn the ROI's organelle masks into full-detail surface meshes for the intro's 3D cell.
(zones.mjs then simplifies them: fine near the centrosome, coarse far away; pack.mjs compresses.)

    python3 build_meshes.py            # every class
    python3 build_meshes.py er mito    # some

Each class: mask -> light Gaussian smoothing -> marching cubes (true voxel size, so every size stays real)
-> simplification to a triangle budget -> ambient occlusion baked into the vertex colour (how enclosed each
point is by everything else within ~0.25 µm, from the same masks) -> <out>/<class>.glb, plain glTF, then
compressed by tool/compress.mjs.

Frame: micrometres, three.js axes (x right, y up, z towards the viewer). The dataset's y (height above the
coverslip) becomes y; x stays x; the dataset's z becomes z. Everything is shifted by ORIGIN_UM so the
scene's (0, 0, 0) is the place the reader starts.
"""
import json, os, sys, time
import numpy as np
from scipy import ndimage as ndi
from skimage import measure
import fast_simplification
import trimesh
from fetch_roi import OUT as ROI

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.expanduser("~/Library/Caches/biology-hub/openorganelle/cell3d/")  # uncompressed glb + meshes.json (not kept in OneDrive)
ORIGIN_UM = np.array([25.0, 0.0, 15.75])           # x, y, z in the dataset frame: under the nucleus, by the Golgi
# The part of the ROI that is meshed in detail: 7.5 x 4.6 x 7.5 µm beside the nucleus (dataset 10.9, -, 15.7).
SCENE_UM = dict(x=(7.15, 14.65), y=(0.0, 4.6), z=(11.95, 19.45))

# name -> (n5 class, how to make the mask, Gaussian sigma in voxels, iso level, triangle budget)
CLASSES = {
    "er":       ("er_seg",      "any",  0.75, 0.40, 640000),
    "mito":     ("mito_seg",    "any",  0.90, 0.50, 90000),
    "golgi":    ("golgi_seg",   "any",  0.70, 0.40, 420000),
    "endo":     ("endo_seg",    "any",  0.80, 0.45, 90000),
    "lyso":     ("lyso_seg",    "any",  0.80, 0.45, 50000),
    "ld":       ("ld_seg",      "any",  0.90, 0.50, 6000),
    "nucleus":  ("nucleus_seg", "id1",  1.60, 0.50, 60000),
    "membrane": ("ecs_seg",     "any",  1.60, 0.50, 60000),
}


def load(n5name):
    d = np.load(os.path.join(ROI, f"{n5name}_s2.npz"))
    return d["v"], d["origin_vox"], d["vox_nm"]


def mask_of(name):
    """The nuclear envelope is ER-continuous and the ER label holds it too; drawn as ER it would roof the
    whole scene. So: ER minus the envelope (ne_seg, grown by one voxel); the envelope goes with the nucleus."""
    n5, how, *_ = CLASSES[name]
    v, ov, vox = load(n5)
    m = (v == 1) if how == "id1" else (v > 0)
    if name in ("er", "nucleus"):
        ne = load("ne_seg")[0] > 0
        if name == "er":
            m &= ~ndi.binary_dilation(ne, iterations=1)
        else:
            m |= ne
    return m, ov, vox


def occupancy():
    """Everything solid, at 32 nm, for the ambient-occlusion rays (cached)."""
    path = os.path.join(ROI, "occ32.npz")
    if os.path.exists(path):
        d = np.load(path)
        return d["occ"], d["origin_um"], d["step_um"]
    occ = None
    for name in CLASSES:
        m, ov, vox = mask_of(name)
        occ = m if occ is None else (occ | m)
    # 2x2x2 downsample: solid if any of the 8 is solid
    zs, ys, xs = (s // 2 * 2 for s in occ.shape)
    o = occ[:zs, :ys, :xs].reshape(zs // 2, 2, ys // 2, 2, xs // 2, 2).any(axis=(1, 3, 5))
    origin_um = ov * vox / 1000.0  # x, y, z of voxel (0,0,0) corner
    step_um = vox * 2 / 1000.0
    np.savez_compressed(path, occ=o, origin_um=origin_um, step_um=step_um)
    return o, origin_um, step_um


def bake_ao(verts_ds, normals_ds, occ, origin_um, step_um, rays=24, reach=0.25, steps=10):
    """verts/normals in the dataset frame (µm; x, y, z). Returns 0..1, 1 = open."""
    rng = np.random.default_rng(7)
    d = rng.normal(size=(rays, 3)); d /= np.linalg.norm(d, axis=1, keepdims=True)
    shape = np.array(occ.shape)  # z, y, x
    out = np.zeros(len(verts_ds), np.float32)
    for a in range(0, len(verts_ds), 20000):
        V = verts_ds[a:a + 20000]; Nn = normals_ds[a:a + 20000]
        hits = np.zeros((len(V), rays), bool)
        dirs = np.where((Nn @ d.T)[..., None] < 0, -d[None], d[None])      # hemisphere about the normal
        cos = np.abs(Nn @ d.T)
        for k in range(1, steps + 1):
            t = reach * k / steps
            P = V[:, None, :] + Nn[:, None, :] * 0.02 + dirs * t
            idx = np.floor((P - origin_um) / step_um).astype(int)           # x, y, z
            ix, iy, iz = idx[..., 0], idx[..., 1], idx[..., 2]
            ok = (ix >= 0) & (iy >= 0) & (iz >= 0) & (ix < shape[2]) & (iy < shape[1]) & (iz < shape[0])
            s = np.zeros_like(ok)
            s[ok] = occ[iz[ok], iy[ok], ix[ok]]
            hits |= s
        out[a:a + 20000] = 1 - (hits * cos).sum(1) / cos.sum(1)
    return out


def build(name, occ_pack):
    t = time.time()
    n5, how, sigma, level, budget = CLASSES[name]
    m, ov, vox = mask_of(name)
    # keep only the detailed scene box
    lo = np.array([SCENE_UM["x"][0], SCENE_UM["y"][0], SCENE_UM["z"][0]]) * 1000 / vox - ov
    hi = np.array([SCENE_UM["x"][1], SCENE_UM["y"][1], SCENE_UM["z"][1]]) * 1000 / vox - ov
    lo = np.maximum(np.floor(lo).astype(int), 0); hi = np.minimum(np.ceil(hi).astype(int), np.array(m.shape[::-1]))
    m = m[lo[2]:hi[2], lo[1]:hi[1], lo[0]:hi[0]]
    ov = ov + lo
    vol = ndi.gaussian_filter(m.astype(np.float32), sigma=(sigma * vox[0] / vox[2], sigma, sigma))
    # pad so surfaces close at the ROI's edge rather than leaving holes (the edge is hidden in the fog)
    vol = np.pad(vol, 1)
    if vol.max() < level:
        print(name, "empty"); return None
    verts, faces, normals, _ = measure.marching_cubes(vol, level, spacing=(vox[2] / 1000, vox[1] / 1000, vox[0] / 1000),
                                                       allow_degenerate=False)
    # (z, y, x) -> dataset (x, y, z) in µm, undoing the pad
    v_ds = verts[:, ::-1] + (ov * vox / 1000.0) - vox / 1000.0
    n0 = len(faces)
    mesh = trimesh.Trimesh(v_ds, faces, process=True)
    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=8)
    occ, oo, st = occ_pack
    Nn = np.nan_to_num(mesh.vertex_normals, nan=0.0)
    bad = np.linalg.norm(Nn, axis=1) < 0.5
    Nn[bad] = (0.0, 1.0, 0.0)                      # a few degenerate corners have no normal
    ao = np.nan_to_num(bake_ao(mesh.vertices, Nn, occ, oo, st), nan=1.0)
    V = (mesh.vertices - ORIGIN_UM).astype("<f4")
    Nn = Nn.astype("<f4")
    F = mesh.faces.astype("<u4")
    os.makedirs(WORK, exist_ok=True)
    base = os.path.join(WORK, name)
    V.tofile(base + ".pos.f32"); Nn.tofile(base + ".nrm.f32"); F.tofile(base + ".idx.u32")
    np.round(np.clip(ao, 0, 1) * 255).astype("u1").tofile(base + ".ao.u8")
    info = dict(name=name, source=n5, triangles_full=int(len(mesh.faces)), budget=budget,
                vertices=int(len(mesh.vertices)), sigma_vox=sigma, iso=level,
                bounds_um=np.round(mesh.bounds, 3).tolist(), seconds=round(time.time() - t, 1))
    print(json.dumps(info), flush=True)
    return info


if __name__ == "__main__":
    names = sys.argv[1:] or list(CLASSES)
    occ_pack = occupancy()
    infos = [build(n, occ_pack) for n in names]
    manifest = os.path.join(WORK, "meshes.json")
    old = json.load(open(manifest)) if os.path.exists(manifest) else {}
    for i in infos:
        if i: old[i["name"]] = i
    json.dump(old, open(manifest, "w"), indent=1)
