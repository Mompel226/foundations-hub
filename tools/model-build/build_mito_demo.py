"""Why a mitochondrion looks round in an electron micrograph: two real mitochondria of the same HeLa cell
(jrc_hela-2, Janelia, CC BY 4.0), each in 3D and in the one photograph the page shows (the slice at z = 13.2 µm).

    python3 build_mito_demo.py   -> ../../assets/cell/mito-demo.glb (the two tubes), mito-demo.json (where the slice
                                    cuts them, their outlines, sizes), mito-demo-1.webp, mito-demo-2.webp (the photograph
                                    round each)

Chosen from the 85 mitochondria of the detailed region (mito_seg, s2, 16 nm) that the slice crosses, whole inside the
region: number 74, in the photograph an oval with cristae, as in a textbook's micrograph, in 3D a tube 4.5 µm long
that the slice cuts at a slant; and number 203, a tube 7.4 µm long that the slice crosses twice, so the photograph
shows it as two shapes. (Number 271, cut nearly straight across, shows a near circle, but at this size it shows no
cristae, and a reader could not tell it is a mitochondrion: not used.)
The tubes are meshed from the same labels as the outlines (16 nm), smoothed as the organelles are; the photographs
are the raw image at 8 nm (s1), the same plane.
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure
import trimesh, fast_simplification
import n5fetch as N
from fetch_roi import OUT as ROI

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../../assets/cell/")
PLANE_Z = 13.2                                    # µm, the photograph's plane (build_em_slice.SECTION_Z)
DEMO = [(74, 2.4), (203, None)]                   # (id, crop size in µm; None: round both of its shapes)
RAW = "em/fibsem-uint16"


def contrast(img):
    lo, hi = np.percentile(img[img > 0], [0.5, 99.5])
    g = np.clip((img - lo) / (hi - lo), 0, 1)
    return 1 - g if np.median(g) < 0.5 else g


def main():
    z = np.load(os.path.join(ROI, "mito_seg_s2.npz")); v, o, vox = z["v"], z["origin_vox"], z["vox_nm"]
    vx, vy, vz = vox[0] / 1000, vox[1] / 1000, vox[2] / 1000
    zi = int(round(PLANE_Z / vz - o[2]))
    plane_um = (zi + o[2] + 0.5) * vz                 # the centre of that layer of voxels
    r1 = N.voxel_nm(RAW, "s1"); ys = N.attrs(RAW, "s1")["dimensions"][1]
    zr = int(round(plane_um * 1000 / r1[2]))
    meta = {"plane_um": round(plane_um, 4), "demos": []}
    scene = trimesh.Scene()
    for k, (mid, size) in enumerate(DEMO, 1):
        m = v == mid
        # the shapes the slice cuts: their outlines (µm, dataset x and y), from the labels at 16 nm, sub-pixel
        sec = np.pad(ndi.binary_fill_holes(m[zi]), 2)
        cs = [c for c in measure.find_contours(sec.astype(float), 0.5) if len(c) > 8]
        outlines = [[[round((c[1] - 2 + o[0] + 0.5) * vx, 4), round((c[0] - 2 + o[1] + 0.5) * vy, 4)] for c in cc[::2]] for cc in cs]
        pts = np.concatenate([np.array(q) for q in outlines])
        cx, cy = pts.mean(0)
        if size is None:
            size = float(max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1])) + 1.4)
        x0, x1, y0, y1 = cx - size / 2, cx + size / 2, max(0.0, cy - size / 2), cy + size / 2
        y1 = y0 + size
        # the photograph there, at 8 nm (rows: y from the top, as the page shows it)
        X0, X1 = int(x0 * 1000 / r1[0]), int(x1 * 1000 / r1[0]); Y0, Y1 = int(y0 * 1000 / r1[1]), min(ys, int(y1 * 1000 / r1[1]))
        img = N.read(RAW, "s1", X0, X1, Y0, Y1, zr, zr + 1)[0][::-1].astype(np.float32)
        Image.fromarray((contrast(img) * 255).astype(np.uint8)).save(OUT + f"mito-demo-{k}.webp", quality=88, method=6)
        # the tube, from all the slices, centred on the slice's middle of its shapes (local µm: x, y as in the photograph,
        # z out of the photograph towards the reader)
        vol = ndi.gaussian_filter(np.pad(m, 2).astype(np.float32), 0.7)
        vv, ff, _, _ = measure.marching_cubes(vol, 0.5, spacing=(vz, vy, vx))
        P = vv[:, ::-1] + (np.array([o[0], o[1], o[2]]) - 2 + 0.5) * np.array([vx, vy, vz])
        if len(ff) > 9000:
            P, ff = fast_simplification.simplify(P.astype(np.float32), ff.astype(np.int32), 1 - 9000 / len(ff))
        t = trimesh.Trimesh(P - [cx, cy, plane_um], ff, process=True)
        trimesh.smoothing.filter_taubin(t, iterations=6)
        t.fix_normals()
        cen = t.vertices.mean(0); ax = np.linalg.svd(t.vertices - cen, full_matrices=False)[2][0]
        L = np.ptp(t.vertices @ ax)
        # an imagined slice straight across the tube, through its middle: the outline of the cut, from the tube's
        # own surface (one closed loop)
        cut = t.section(plane_origin=cen, plane_normal=ax)
        loop = max((cut.discrete if cut is not None else []), key=len, default=[])
        scene.add_geometry(t, node_name=f"mito{k}", geom_name=f"mito{k}")
        meta["demos"].append({"id": int(mid), "image": f"mito-demo-{k}.webp", "centre": [round(cx, 3), round(cy, 3)],
                              "crop": [round(X0 * r1[0] / 1000 - cx, 4), round(X1 * r1[0] / 1000 - cx, 4), round(Y0 * r1[1] / 1000 - cy, 4), round(Y1 * r1[1] / 1000 - cy, 4)],
                              "outlines": [[[round(p[0] - cx, 4), round(p[1] - cy, 4)] for p in q] for q in outlines],
                              "length_um": round(float(L), 1), "shapes": len(outlines),
                              "across": {"centre": [round(float(x), 4) for x in cen], "axis": [round(float(x), 5) for x in ax],
                                         "loop": [[round(float(x), 4) for x in q] for q in loop[::2]]},
                              "volume_um3": round(float(m.sum() * vx * vy * vz), 3)})
        print(f"mito {mid}: {len(outlines)} shape(s) in the slice, tube {L:.1f} µm, {len(t.faces)} triangles, crop {size:.2f} µm, image {img.shape}")
    scene.export(OUT + "mito-demo.glb")
    json.dump(meta, open(OUT + "mito-demo.json", "w"), indent=1)
    print("cache", round(N.cache_mb()), "MB")


if __name__ == "__main__":
    main()
