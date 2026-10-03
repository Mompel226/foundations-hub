"""Read parts of Janelia's open HeLa cell (OpenOrganelle jrc_hela-2) straight from its public N5 store.

The data: Xu et al. 2021, Nature 599:147 (FIB-SEM) and Heinrich et al. 2021, Nature 599:141 (organelle
segmentations), CC BY 4.0, s3://janelia-cosem-datasets/jrc_hela-2/jrc_hela-2.n5/.

Blocks are cached in ~/Library/Caches/biology-hub/openorganelle/ (outside OneDrive, never published), so a
block is downloaded once. Axes follow the N5 attributes: x, y, z. Arrays returned here are indexed [z, y, x].
"""
import gzip, json, os, struct, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np

BASE = "https://janelia-cosem-datasets.s3.amazonaws.com/jrc_hela-2/jrc_hela-2.n5/"
CACHE = os.path.expanduser("~/Library/Caches/biology-hub/openorganelle/jrc_hela-2.n5/")
DTYPES = {"uint8": ">u1", "uint16": ">u2", "uint32": ">u4", "uint64": ">u8", "int8": ">i1", "int16": ">i2",
          "int32": ">i4", "int64": ">i8", "float32": ">f4", "float64": ">f8"}


def _get(key):
    """Bytes of one object, from the cache or the store. None when the block does not exist (all empty)."""
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    if os.path.exists(path + ".none"):
        return None
    try:
        data = urllib.request.urlopen(BASE + key, timeout=60).read()
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):  # S3 answers 403 for a missing key in a listable bucket
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path + ".none", "w").close()
            return None
        raise
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".part", "wb") as f:
        f.write(data)
    os.replace(path + ".part", path)
    return data


def attrs(dataset, scale):
    return json.loads(_get(f"{dataset}/{scale}/attributes.json"))


def voxel_nm(dataset, scale):
    """(x, y, z) voxel size in nm at this scale."""
    a = attrs(dataset, scale)
    return tuple(a["pixelResolution"]["dimensions"])


def _block(dataset, scale, a, bx, by, bz):
    raw = _get(f"{dataset}/{scale}/{bx}/{by}/{bz}")
    if raw is None:
        return None
    mode, ndim = struct.unpack(">HH", raw[:4])
    dims = struct.unpack(">" + "I" * ndim, raw[4:4 + 4 * ndim])
    off = 4 + 4 * ndim + (4 if mode == 1 else 0)
    comp = a["compression"]["type"]
    body = raw[off:]
    if comp == "gzip":
        body = gzip.decompress(body)
    elif comp != "raw":
        raise ValueError("compression " + comp)
    arr = np.frombuffer(body, dtype=DTYPES[a["dataType"]], count=int(np.prod(dims)))
    return arr.reshape(dims[::-1])  # N5 is x-fastest: [z, y, x]


def read(dataset, scale, x0, x1, y0, y1, z0, z1, workers=16):
    """Voxels [z0:z1, y0:y1, x0:x1] (in this scale's voxel units) as a native-endian numpy array."""
    a = attrs(dataset, scale)
    X, Y, Z = a["dimensions"]
    bs = a["blockSize"]
    x0, y0, z0 = max(0, x0), max(0, y0), max(0, z0)
    x1, y1, z1 = min(X, x1), min(Y, y1), min(Z, z1)
    out = np.zeros((z1 - z0, y1 - y0, x1 - x0), dtype=DTYPES[a["dataType"]].replace(">", "<"))
    jobs = [(bx, by, bz) for bz in range(z0 // bs[2], (z1 - 1) // bs[2] + 1)
            for by in range(y0 // bs[1], (y1 - 1) // bs[1] + 1)
            for bx in range(x0 // bs[0], (x1 - 1) // bs[0] + 1)]

    def one(j):
        bx, by, bz = j
        return j, _block(dataset, scale, a, bx, by, bz)

    with ThreadPoolExecutor(workers) as ex:
        for (bx, by, bz), blk in ex.map(one, jobs):
            if blk is None:
                continue
            gx, gy, gz = bx * bs[0], by * bs[1], bz * bs[2]
            sx0, sy0, sz0 = max(x0, gx), max(y0, gy), max(z0, gz)
            sx1, sy1, sz1 = min(x1, gx + blk.shape[2]), min(y1, gy + blk.shape[1]), min(z1, gz + blk.shape[0])
            if sx1 <= sx0 or sy1 <= sy0 or sz1 <= sz0:
                continue
            out[sz0 - z0:sz1 - z0, sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = \
                blk[sz0 - gz:sz1 - gz, sy0 - gy:sy1 - gy, sx0 - gx:sx1 - gx]
    return out


def read_all(dataset, scale, workers=16):
    a = attrs(dataset, scale)
    X, Y, Z = a["dimensions"]
    return read(dataset, scale, 0, X, 0, Y, 0, Z, workers)


def cache_mb():
    tot = 0
    for root, _, files in os.walk(CACHE):
        for f in files:
            tot += os.path.getsize(os.path.join(root, f))
    return tot / 1e6


if __name__ == "__main__":
    ds, sc = sys.argv[1], sys.argv[2]
    v = read_all(ds, sc)
    print(ds, sc, v.shape, v.dtype, "nonzero", int((v > 0).sum()), "ids", len(np.unique(v)) - 1, "cache MB", round(cache_mb(), 1))
