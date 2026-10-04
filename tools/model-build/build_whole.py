"""The whole cell, coarse (64 nm voxels; the Golgi at 32 nm), for the intro's first view from outside.

    python3 build_whole.py   -> cache whole/*.glb, then gltf/pack.mjs makes ../../assets/cell/whole.glb

The cell: the volume that is not extracellular space, split from its two neighbours (their nuclei sit at the
field's corners) by a watershed from each nucleus over the plasma-membrane label. The imaged block is
48 x 33 x 6.4 µm and the cell runs beyond it on three sides (8-15% of those faces of the block are this cell):
what is shown is the middle of one cell. Where the block cuts it, the surface is a separate mesh, w_cut, so the
page can show it as a cut, not as the cell's edge.
The endoplasmic reticulum is drawn too (w_er), coarse, so that every large organelle is there from the first view.
"""
import os, json, subprocess
import numpy as np
from scipy import ndimage as ndi
from skimage import measure
from skimage.segmentation import watershed
import fast_simplification, trimesh
import n5fetch as N
from build_meshes import ORIGIN_UM

WORK = os.path.expanduser("~/Library/Caches/biology-hub/openorganelle/whole/")
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(WORK, exist_ok=True)


def cell_mask():
    path = os.path.join(WORK, "cell_s4.npz")
    if os.path.exists(path):
        return np.load(path)["cell"]
    ecs = N.read_all("labels/ecs_seg", "s4") > 0
    pm = N.read_all("labels/pm_seg", "s4") > 0
    nuc = N.read_all("labels/nucleus_seg", "s4")
    inside = ~ecs
    sep = inside & ~ndi.binary_dilation(pm, iterations=1)
    lab, _ = ndi.label(sep)
    k = np.bincount(lab[nuc == 1])[1:].argmax() + 1
    region = ndi.binary_dilation(lab == k, iterations=1) & inside
    markers = np.zeros(nuc.shape, np.int32)
    for i in (1, 2, 3):
        markers[nuc == i] = i
    cell = ndi.binary_fill_holes(watershed(ndi.gaussian_filter(pm.astype(np.float32), 1.0), markers, mask=region) == 1)
    np.savez_compressed(path, cell=cell)
    return cell


def separate(ids):
    """An instance label (each mitochondrion its own number) as one mask, with a gap where two different ones touch:
    made into one mask straight away, touching mitochondria became one long branched piece (22 in one, 4 Oct)."""
    b = np.zeros(ids.shape, bool)
    for ax in range(3):
        for sh in (1, -1):
            w = np.roll(ids, sh, axis=ax); b |= (ids > 0) & (w > 0) & (w != ids)
    return (ids > 0) & ~b


def small_ones(mask, vox_nm, max_vox):
    """The pieces of fewer than max_vox voxels, each as a small ball of its own volume at its own place (µm, the
    same frame as mesh()): blurred into a surface they vanished, and four in five lysosomes and endosomes were missing
    from the whole cell, most of them those spread through the cytoplasm out to the membrane (4 Oct)."""
    lab, n = ndi.label(mask)
    sizes = np.bincount(lab.ravel())
    ids = np.nonzero((sizes < max_vox) & (np.arange(len(sizes)) > 0))[0]
    cents = ndi.center_of_mass(mask, lab, ids)
    vx, vy, vz = (np.array(vox_nm) / 1000)
    ball = trimesh.creation.icosphere(subdivisions=0)
    parts = []
    for i, (cz, cy, cx) in zip(ids, cents):
        r = (3 * sizes[i] * vx * vy * vz / (4 * np.pi)) ** (1 / 3)
        b = ball.copy(); b.apply_scale(r); b.apply_translation([cx * vx + vx / 2, cy * vy + vy / 2, cz * vz + vz / 2]); parts.append(b)
    print("small pieces as balls", len(parts), flush=True)
    small = np.isin(lab, ids)
    return trimesh.util.concatenate(parts), mask & ~small


def simplify(m, target, error):
    """meshoptimizer's simplifier (gltf/simplify.mjs), triangles kept well shaped; it stops at `error` (µm) even above
    the target."""
    pf, xf, of = (os.path.join(WORK, "_s." + e) for e in ("f32", "u32", "out.u32"))
    m.vertices.astype(np.float32).tofile(pf); m.faces.astype(np.uint32).tofile(xf)
    r = subprocess.run(["node", os.path.join(HERE, "gltf", "simplify.mjs"), pf, xf, str(int(target)), str(error), of],
                       capture_output=True, text=True)
    if r.returncode: raise RuntimeError("simplify.mjs: " + r.stderr[-600:])
    f = np.fromfile(of, np.uint32).reshape(-1, 3)
    for p in (pf, xf, of): os.remove(p)
    out = trimesh.Trimesh(m.vertices, f, process=False); out.remove_unreferenced_vertices()
    print("  simplified", len(m.faces), "->", len(f), r.stdout.strip(), flush=True)
    return out


def needles(m):
    """How many triangles are long and thin (longer than 250 nm, under 30 nm high; and longer than 300 nm and 12 times
    longer than high), and the longest edge (µm): the streaks of 4 Oct. Kept near nought."""
    tri = m.vertices[m.faces]; L = np.max(np.linalg.norm(tri[:, [1, 2, 0]] - tri, axis=2), axis=1)
    h = 2 * m.area_faces / np.maximum(L, 1e-9)
    return int(((L > 0.25) & (h < 0.03)).sum()), int(((L > 0.3) & (h < L / 12)).sum()), round(float(L.max()), 3)


def mesh(mask, vox_nm, sigma, budget, name, close_edges=True, split_cut=False, min_vox=0, iso=0.5, min_faces=0, extra=None, err_vox=0.5):
    # clean before neat: pieces of fewer than min_vox voxels are dropped (at 64 nm a piece of ER or a lysosome a few
    # voxels big became a needle when simplified, and the cell looked full of dashes: Daniel, 4 Oct, "I'd rather the
    # students be looking at something that looks clean"); a lower iso-level (iso) with a wider blur makes thin ER
    # into smooth, continuous tubes, a little thicker than it is
    if min_vox:
        lab, n = ndi.label(mask)
        if n:
            sizes = np.bincount(lab.ravel()); keep = sizes >= min_vox; keep[0] = False
            mask = keep[lab]
            print(name, "pieces kept", int(keep.sum()), "of", n, flush=True)
    vol = ndi.gaussian_filter(mask.astype(np.float32), sigma)
    if close_edges:
        vol = np.pad(vol, 1)
    v, f, _, _ = measure.marching_cubes(vol, iso, spacing=(vox_nm[2] / 1000, vox_nm[1] / 1000, vox_nm[0] / 1000))
    v = v[:, ::-1] - (np.array(vox_nm) / 1000 if close_edges else 0)
    v = v + np.array(vox_nm) / 2000  # voxel centres
    # smoothed FIRST, on the even triangles of the marching cubes, then simplified keeping the triangles well shaped
    # (meshoptimizer, Regularize; error at most half a voxel). Simplified first and smoothed after, thin tubes became
    # needles micrometres long, and the page drew them as streaks (Daniel, 4 Oct: 17,500 needles in the ER, 11 µm long)
    m = trimesh.Trimesh(v, f, process=False); m.merge_vertices()
    trimesh.smoothing.filter_taubin(m, iterations=6)
    if len(m.faces) > budget:
        m = simplify(m, budget, err_vox * min(vox_nm) / 1000)
        # what is left of long slivers (the rims of the thinnest sheets: up to 5 µm long and 5 nm high) is taken out:
        # it adds nothing to the picture but a line; the gap left is narrower than a pixel
        tri = m.vertices[m.faces]; L = np.max(np.linalg.norm(tri[:, [1, 2, 0]] - tri, axis=2), axis=1)
        sliver = (L > 0.3) & (2 * m.area_faces / np.maximum(L, 1e-9) < L / 12)      # long, and 12 times longer than high
        if sliver.any():
            m = trimesh.Trimesh(m.vertices, m.faces[~sliver], process=False); m.remove_unreferenced_vertices()
            print("  slivers taken out", int(sliver.sum()), flush=True)
    if min_faces:
        # pieces of a few triangles become needles when simplified (the "dashes"): only those are dropped
        parts = m.split(only_watertight=False)
        keep = [q for q in parts if len(q.faces) >= min_faces]
        print(name, "pieces kept", len(keep), "of", len(parts), flush=True)
        m = trimesh.util.concatenate(keep)
    cut = None
    if split_cut:
        # the faces that lie on a side or the top of the imaged block: where the block cuts the cell
        size = np.array(mask.shape[::-1]) * np.array(vox_nm) / 1000
        P = m.vertices; tol = 0.12
        on = (P[:, 0] < tol) | (P[:, 0] > size[0] - tol) | (P[:, 2] < tol) | (P[:, 2] > size[2] - tol) | (P[:, 1] > size[1] - tol)
        fc = on[m.faces].all(1)
        cut = trimesh.Trimesh(m.vertices.copy(), m.faces[fc], process=True)
        m = trimesh.Trimesh(m.vertices.copy(), m.faces[~fc], process=True)
        print(name, "cut faces", int(fc.sum()))
    for part, nm in ((m, name), (cut, "w_cut")):
        if part is None: continue
        if extra is not None and part is m: part = m = trimesh.util.concatenate([m, extra])
        print(nm, "needles", needles(part), flush=True)
        part.apply_translation(-ORIGIN_UM)
        part.export(os.path.join(WORK, nm + ".glb"))
        print(nm, len(part.faces), "triangles", np.round(part.bounds, 2).tolist(), flush=True)


if __name__ == "__main__":
    cell = cell_mask()
    v4 = N.voxel_nm("labels/nucleus_seg", "s4")
    v3 = N.voxel_nm("labels/golgi_seg", "s3")
    nuc = N.read_all("labels/nucleus_seg", "s4") == 1
    mesh(cell, v4, 1.2, 70000, "w_cell", split_cut=True, err_vox=1.0)   # (smooth surfaces: a voxel of error is not seen)
    mesh(nuc, v4, 1.2, 24000, "w_nucleus", err_vox=1.0)
    mito = separate(N.read_all("labels/mito_seg", "s4") * cell)
    mesh(mito, v4, 0.6, 120000, "w_mito", min_faces=24, iso=0.55)
    g = N.read_all("labels/golgi_seg", "s3") > 0
    mesh(g, v3, 0.9, 30000, "w_golgi", min_vox=40)
    ly = ((N.read_all("labels/lyso_seg", "s4") > 0) | (N.read_all("labels/endo_seg", "s4") > 0)) & cell
    balls, ly = small_ones(ly, v4, 12)
    mesh(ly, v4, 0.6, 40000, "w_sacs", iso=0.4, min_faces=24, extra=balls)
    # the ER at its true thickness (blur 0.5 voxel, level 0.3): measured on 6,000 of its voxels, 88% lie within 70 nm
    # of the drawn surface (80% more than 6 µm from the nucleus). The wider blur used before (1 voxel, level 0.33,
    # pieces under 40 faces dropped) drew 29% of it (25% far out), and the edge of the cell, where the ER is thin
    # tubes, looked empty (Daniel, 4 Oct: "on the edge of the cell membrane there is basically nothing")
    er = (N.read_all("labels/er_seg", "s4") > 0) & cell & ~ndi.binary_dilation(nuc, iterations=1)
    mesh(er, v4, 0.5, 420000, "w_er", iso=0.3, min_faces=16)   # (stops near 680,000: the half-voxel limit)
    nl = N.read_all("labels/nucleolus_seg", "s4") > 0
    mesh(nl & nuc, v4, 0.9, 12000, "w_nucleolus", err_vox=1.0)
