"""The whole cell, coarse (64 nm voxels; the Golgi at 32 nm), for the intro's first view from outside.

    python3 build_whole.py   -> cache whole/*.glb, then gltf/pack.mjs makes ../../assets/cell/whole.glb

The cell: the volume that is not extracellular space, split from its two neighbours (their nuclei sit at the
field's corners) by a watershed from each nucleus over the plasma-membrane label. The imaged block is
48 x 33 x 6.4 µm and the cell's thin edges run beyond it on three sides: the surface is left open there.
"""
import os, json
import numpy as np
from scipy import ndimage as ndi
from skimage import measure
from skimage.segmentation import watershed
import fast_simplification, trimesh
import n5fetch as N
from build_meshes import ORIGIN_UM

WORK = os.path.expanduser("~/Library/Caches/biology-hub/openorganelle/whole/")
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


def mesh(mask, vox_nm, sigma, budget, name, close_edges=True):
    vol = ndi.gaussian_filter(mask.astype(np.float32), sigma)
    if close_edges:
        vol = np.pad(vol, 1)
    v, f, _, _ = measure.marching_cubes(vol, 0.5, spacing=(vox_nm[2] / 1000, vox_nm[1] / 1000, vox_nm[0] / 1000))
    v = v[:, ::-1] - (np.array(vox_nm) / 1000 if close_edges else 0)
    v = v + np.array(vox_nm) / 2000  # voxel centres
    if len(f) > budget:
        v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), 1 - budget / len(f), agg=6)
    m = trimesh.Trimesh(v, f, process=True)
    trimesh.smoothing.filter_taubin(m, iterations=6)
    m.apply_translation(-ORIGIN_UM)
    m.export(os.path.join(WORK, name + ".glb"))
    print(name, len(m.faces), "triangles", np.round(m.bounds, 2).tolist(), flush=True)


if __name__ == "__main__":
    cell = cell_mask()
    v4 = N.voxel_nm("labels/nucleus_seg", "s4")
    v3 = N.voxel_nm("labels/golgi_seg", "s3")
    nuc = N.read_all("labels/nucleus_seg", "s4") == 1
    mesh(cell, v4, 1.2, 70000, "w_cell")
    mesh(nuc, v4, 1.2, 24000, "w_nucleus")
    mito = (N.read_all("labels/mito_seg", "s4") > 0) & cell
    mesh(mito, v4, 0.8, 110000, "w_mito")
    g = N.read_all("labels/golgi_seg", "s3") > 0
    mesh(g, v3, 0.8, 30000, "w_golgi")
    ly = ((N.read_all("labels/lyso_seg", "s4") > 0) | (N.read_all("labels/endo_seg", "s4") > 0)) & cell
    mesh(ly, v4, 0.7, 24000, "w_sacs")
    nl = N.read_all("labels/nucleolus_seg", "s4") > 0
    mesh(nl & nuc, v4, 0.9, 12000, "w_nucleolus")
