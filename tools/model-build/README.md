# How the zoom's files were made

Every file in `assets/` except the photographs and the film comes from these scripts. They download
open data into `~/Library/Caches/biology-hub/` (outside OneDrive, never published) and write the
web files into `../../assets/`. Python needs numpy, scipy, scikit-image, trimesh and fast_simplification;
`gltf/` needs `npm install` once (gltf-transform 4.5 and meshoptimizer, as in `gltf/package.json`).

| Level | Run, in order | Writes |
|---|---|---|
| organism, system, organ | `python3 fetch_hra.py` → `python3 build_anatomy.py` → `node gltf/pack.mjs ../../assets/body/anatomy.glb <cache>/anatomy/a_*.glb` (not the old `a_bones.glb`) | `assets/body/anatomy.glb` |
| the organ cut open | `python3 build_section.py` | `assets/body/section.*`, `section-map.png` |
| tissue | none: `js/tissue3d.js` builds the model in the browser | — |
| cell | `python3 build_whole.py` → `node gltf/pack.mjs ../../assets/cell/whole.glb <cache>/openorganelle/whole/w_*.glb` | `assets/cell/whole.glb` |
| organelles | `python3 fetch_roi.py` → `python3 build_meshes.py` → `node gltf/zones.mjs <cache>/openorganelle/cell3d <name> <budget>` for each organelle → `node gltf/pack.mjs ../../assets/cell/organelles.glb …` | `assets/cell/organelles.glb` |
| organelles (small things) | `python3 instances.py <class> s1 [--voxels]` (ribo, vesicle, np, mt-out with --voxels, cent with --voxels) → `python3 build_small.py` | `assets/cell/small.bin` |
| organelles' electron micrograph | `python3 build_em_slice.py` (reads the raw FIB-SEM at s2, about 17 MB of blocks) | `assets/cell/em-slice.*`, `em-outline.png` |
| molecules | `python3 build_molecules.py` → `node gltf/pack.mjs ../../assets/mol/molecules.glb <cache>/molecules/m_*.glb` | `assets/mol/*` |

The budgets used for `zones.mjs`: er 520000, golgi 400000, mito 90000, endo 90000, lyso 50000, ld 4000,
nucleus 70000, membrane 50000.

`shots.mjs` drives real-time headless Chrome for checks: open the page with `?test=1` (no self-turning,
which stalls screenshots) and put the zoom anywhere with `await cell.setZ(z)` (0 organism … 6 molecules;
2.85 is half way from the organ's cut face into the tissue).

`perf.mjs <url> --w 1440 --h 900 --dpr 2 [--profile]` loads the page as a Retina laptop would, WITH the
self-turning on, times a frame at each level and where two levels blend, then scrolls with the wheel from the
body to the molecules and back, and prints the frame times by stretch of the zoom. Good: about 120 frames in
2 s at the start; while scrolling, a median of 17 ms and no long tasks; every caption from Organism to
Molecules passed. Run it after any change to the drawing loop (`wake()` / `frame()`), the blending, or the
scroll. Lessons: on 3 Oct a second frame booked from inside a frame froze the page; 4-sample smoothing at
Retina size halved the frame rate while moving (now off when the pixel ratio is 2); a trackpad moves Z a
hundredth at a time, so nothing may snap Z while scrolling. The page also takes `?msaa=`, `?dpr=`, `?depth=u`
and `?notags=1` to try a lighter drawing.
