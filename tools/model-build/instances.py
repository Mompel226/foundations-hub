"""Small things in the ROI, read block by block at a fine scale: every ribosome, vesicle and nuclear pore as a
centre and a size, and every voxel of the microtubules and the centrioles (for their centre lines).

    python3 instances.py ribo_seg s1
    python3 instances.py mt-out_seg s1 --voxels

Writes ~/Library/Caches/biology-hub/openorganelle/roi/inst_<class>_<scale>.npz with, per instance id:
ids, count (voxels), centre (x, y, z in micrometres, dataset frame); with --voxels also the voxel list (µm).
"""
import os, sys, time
import numpy as np
import n5fetch as N
from fetch_roi import ROI_UM, OUT
from concurrent.futures import ThreadPoolExecutor


def run(name, scale, keep_voxels=False):
    ds = "labels/" + name
    a = N.attrs(ds, scale)
    vx, vy, vz = N.voxel_nm(ds, scale)
    bs = a["blockSize"]
    X, Y, Z = a["dimensions"]
    r = lambda um, v: int(round(um * 1000 / v))
    x0, x1 = r(ROI_UM["x"][0], vx), min(X, r(ROI_UM["x"][1], vx))
    y0, y1 = r(ROI_UM["y"][0], vy), min(Y, r(ROI_UM["y"][1], vy))
    z0, z1 = r(ROI_UM["z"][0], vz), min(Z, r(ROI_UM["z"][1], vz))
    jobs = [(bx, by, bz) for bz in range(z0 // bs[2], (z1 - 1) // bs[2] + 1)
            for by in range(y0 // bs[1], (y1 - 1) // bs[1] + 1)
            for bx in range(x0 // bs[0], (x1 - 1) // bs[0] + 1)]
    parts = []
    vox_parts = []
    t = time.time()

    def one(j):
        bx, by, bz = j
        gx, gy, gz = bx * bs[0], by * bs[1], bz * bs[2]
        blk = N.read(ds, scale, max(x0, gx), min(x1, gx + bs[0]), max(y0, gy), min(y1, gy + bs[1]),
                     max(z0, gz), min(z1, gz + bs[2]), workers=1)
        zz, yy, xx = np.nonzero(blk)
        if len(zz) == 0:
            return None
        lab = blk[zz, yy, xx].astype(np.int64)
        ox, oy, oz = max(x0, gx), max(y0, gy), max(z0, gz)
        X_ = (xx + ox + 0.5) * vx / 1000
        Y_ = (yy + oy + 0.5) * vy / 1000
        Z_ = (zz + oz + 0.5) * vz / 1000
        u, inv = np.unique(lab, return_inverse=True)
        cnt = np.bincount(inv)
        sx, sy, sz = (np.bincount(inv, weights=w) for w in (X_, Y_, Z_))
        out = (u, cnt, sx, sy, sz)
        vox = np.stack([X_, Y_, Z_, lab.astype(np.float64)], 1).astype(np.float32) if keep_voxels else None
        return out, vox

    with ThreadPoolExecutor(8) as ex:
        for k, res in enumerate(ex.map(one, jobs)):
            if res is None:
                continue
            parts.append(res[0])
            if keep_voxels:
                vox_parts.append(res[1])
    u = np.concatenate([p[0] for p in parts])
    allv = [np.concatenate([p[i] for p in parts]) for i in range(1, 5)]
    ids, inv = np.unique(u, return_inverse=True)
    cnt = np.bincount(inv, weights=allv[0])
    cen = np.stack([np.bincount(inv, weights=allv[i]) for i in (1, 2, 3)], 1) / cnt[:, None]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"inst_{name}_{scale}.npz")
    extra = {}
    if keep_voxels:
        extra["voxels"] = np.concatenate(vox_parts) if vox_parts else np.zeros((0, 4), np.float32)
    np.savez_compressed(path, ids=ids, count=cnt, centre=cen, vox_nm=np.array([vx, vy, vz]), **extra)
    print(f"{name} {scale}: {len(ids)} instances, {int(cnt.sum())} voxels, {len(jobs)} blocks, "
          f"{time.time() - t:.0f}s; cache {N.cache_mb():.0f} MB", flush=True)


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2], "--voxels" in sys.argv)
