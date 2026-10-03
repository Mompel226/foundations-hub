"""A free path for the camera into the detailed region: from a point about 2.5 µm out to the clearing by the
centrosome, through gaps in the measured cell (organelles, vesicles, ribosomes and microtubules all count as
solid). Prints the path in scene µm for js/cell3d.js (VIEWS.path)."""
import numpy as np, os
from scipy import ndimage as ndi
from skimage.graph import MCP_Geometric
from build_meshes import ORIGIN_UM
R = os.path.expanduser('~/Library/Caches/biology-hub/openorganelle/roi/')
d = np.load(R + 'occ32.npz'); occ = d['occ'].copy(); o = d['origin_um']; st = d['step_um']   # [z,y,x]
def mark(P, rad):
    idx = np.floor((P - o) / st).astype(int)
    r = int(np.ceil(rad / st.min()))
    for dz in range(-r, r + 1):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx*dx*st[0]**2 + dy*dy*st[1]**2 + dz*dz*st[2]**2 > (rad + st.min()/2)**2: continue
                j = idx + [dx, dy, dz]
                ok = (j >= 0).all(1) & (j < np.array(occ.shape[::-1])).all(1)
                occ[j[ok, 2], j[ok, 1], j[ok, 0]] = True
v = np.load(R + 'inst_vesicle_seg_s1.npz'); mark(v['centre'], 0.03)
r = np.load(R + 'inst_ribo_seg_s1.npz'); mark(r['centre'], 0.013)
m = np.load(R + 'inst_mt-out_seg_s1.npz'); mark(m['voxels'][:, :3].astype(float), 0.013)
c = np.load(R + 'inst_cent_seg_s1.npz'); mark(c['voxels'][:, :3].astype(float), 0.02)
clear = ndi.distance_transform_edt(~occ, sampling=(st[2], st[1], st[0]))
goal_scene = np.array([-0.22, 1.36, -0.70])
def vox(p_scene): return tuple(np.floor((p_scene + ORIGIN_UM - o) / st).astype(int)[::-1])
cost = np.where(clear > 0.05, 1.0 / (clear ** 2), np.inf)
mcp = MCP_Geometric(cost, sampling=(st[2], st[1], st[0]))
gz = vox(goal_scene)
# the goal: the clearest point within 0.3 µm of the clearing
zz0, yy0, xx0 = np.mgrid[gz[0]-8:gz[0]+9, gz[1]-8:gz[1]+9, gz[2]-8:gz[2]+9]
k = np.argmax(clear[zz0, yy0, xx0]); gz = (zz0.flat[k], yy0.flat[k], xx0.flat[k])
print('goal clearance', round(float(clear[gz]), 3), 'at scene', np.round(np.array(gz[::-1]) * st + o + st/2 - ORIGIN_UM, 3))
goal_scene = np.array(gz[::-1]) * st + o + st/2 - ORIGIN_UM
dist, _ = mcp.find_costs([gz])
print('reachable voxels', int(np.isfinite(dist).sum()))
# candidate starts: free points 2.2-2.8 µm from the goal at height 0.9-1.8 µm, inside the detailed box
zz, yy, xx = np.nonzero(np.isfinite(dist) & (clear > 0.09))
P = np.stack([xx, yy, zz], 1) * st + o + st / 2 - ORIGIN_UM
dd = np.linalg.norm(P - goal_scene, axis=1)
ok = (dd > 2.2) & (dd < 2.8) & (P[:, 1] > 0.9) & (P[:, 1] < 1.8) & (np.abs(P[:, 0]) < 3.2) & (P[:, 2] > -4.1) & (P[:, 2] < 2.3)
best = None
for i in np.nonzero(ok)[0][np.argsort(dist[zz[ok], yy[ok], xx[ok]])[:40]]:
    path = np.array(mcp.traceback((zz[i], yy[i], xx[i])))[:, ::-1] * st + o + st / 2 - ORIGIN_UM
    mins = clear[tuple(np.array(mcp.traceback((zz[i], yy[i], xx[i]))).T)]
    score = mins.min()
    if best is None or score > best[0]: best = (score, path, P[i])
score, path, start = best
# thin to ~12 points, keep the clearance at each
L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
t = np.linspace(0, L[-1], 12)
pts = np.stack([np.interp(t, L, path[:, k]) for k in range(3)], 1)
print('length µm', round(L[-1], 2), 'narrowest clearance µm', round(float(score), 3))
print('[' + ', '.join('[' + ', '.join(f'{x:.3f}' for x in p) + ']' for p in pts) + ']')
