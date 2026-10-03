"""Fetch the region of the HeLa cell the intro stands in, and keep it as compressed arrays.

    python3 fetch_roi.py            # every class below
    python3 fetch_roi.py er_seg     # one class

The region (ROI) is the cytoplasm beside the nucleus, on its left (dataset x 7-15 µm): the thickest cytoplasm in the
cell with no nucleus over it (2.9 µm on average), rich in mitochondria and ER, so the zoom can dive straight down into
it through the cell membrane. (Until 3 Oct the region was under the nucleus, round the centrosome, where the
cytoplasm is 1.6 µm thick and the way in had to pass under the nucleus.)
Units: micrometres in the dataset's own frame (x, y, z; y = 0 is the coverslip side).
"""
import os, sys, time
import numpy as np
import n5fetch as N

ROI_UM = dict(x=(5.0, 17.0), y=(0.0, 4.6), z=(10.0, 21.5))
OUT = os.path.expanduser("~/Library/Caches/biology-hub/openorganelle/roi/")
# class -> scale fetched for the ROI
CLASSES = {
    "er_seg": "s2", "mito_seg": "s2", "golgi_seg": "s2", "endo_seg": "s2", "lyso_seg": "s2", "ld_seg": "s2",
    "nucleus_seg": "s2", "ecs_seg": "s2", "pm_seg": "s2",
}


def roi_vox(dataset, scale):
    vx, vy, vz = N.voxel_nm(dataset, scale)
    f = lambda a, v: int(round(a * 1000 / v))
    return (f(ROI_UM["x"][0], vx), f(ROI_UM["x"][1], vx), f(ROI_UM["y"][0], vy), f(ROI_UM["y"][1], vy),
            f(ROI_UM["z"][0], vz), f(ROI_UM["z"][1], vz)), (vx, vy, vz)


def fetch(name, scale):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}_{scale}.npz")
    if os.path.exists(path):
        return path
    t = time.time()
    (x0, x1, y0, y1, z0, z1), vox = roi_vox("labels/" + name, scale)
    v = N.read("labels/" + name, scale, x0, x1, y0, y1, z0, z1)
    np.savez_compressed(path, v=v, origin_vox=np.array([x0, y0, z0]), vox_nm=np.array(vox))
    print(f"{name} {scale} {v.shape} {v.dtype} nonzero {int((v > 0).sum())} in {time.time() - t:.0f}s;"
          f" cache {N.cache_mb():.0f} MB", flush=True)
    return path


if __name__ == "__main__":
    names = sys.argv[1:] or list(CLASSES)
    for n in names:
        fetch(n, CLASSES.get(n, "s2"))
