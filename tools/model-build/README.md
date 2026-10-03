# How the zoom's files were made

Every file in `assets/` except the photographs and the film comes from these scripts. They download
open data into `~/Library/Caches/biology-hub/` (outside OneDrive, never published) and write the
web files into `../../assets/`. Python needs numpy, scipy, scikit-image, trimesh and fast_simplification;
`gltf/` needs `npm install` once (gltf-transform 4.5 and meshoptimizer, as in `gltf/package.json`).

| Level | Run, in order | Writes |
|---|---|---|
| organism, system, organ | `python3 fetch_hra.py` → `python3 build_anatomy.py` → `node gltf/pack.mjs ../../assets/body/anatomy.glb <cache>/anatomy/a_*.glb` | `assets/body/anatomy.glb` |
| cell | `python3 build_whole.py` → `node gltf/pack.mjs ../../assets/cell/whole.glb <cache>/openorganelle/whole/w_*.glb` | `assets/cell/whole.glb` |
| organelles | `python3 fetch_roi.py` → `python3 build_meshes.py` → `node gltf/zones.mjs <cache>/openorganelle/cell3d <name> <budget>` for each organelle → `node gltf/pack.mjs ../../assets/cell/organelles.glb …` | `assets/cell/organelles.glb` |
| organelles (small things) | `python3 instances.py <class> s1 [--voxels]` (ribo, vesicle, np, mt-out with --voxels, cent with --voxels) → `python3 build_small.py` | `assets/cell/small.bin` |
| the way in | `python3 path_in.py` (prints the path pasted into `js/cell3d.js` PATH_IN) | — |
| molecules | `python3 build_molecules.py` → `node gltf/pack.mjs ../../assets/mol/molecules.glb <cache>/molecules/m_*.glb` | `assets/mol/*` |

The budgets used for `zones.mjs`: er 520000, golgi 400000, mito 90000, endo 90000, lyso 50000, ld 4000,
nucleus 70000, membrane 50000.

`shots.mjs` drives real-time headless Chrome for checks: open the page with `?test=1` (no self-turning,
which stalls screenshots), step with `cell.goTo(level)` and `cell.seekFlight(1)`.
