# How the zoom's files were made

Every file in `assets/` except the photographs and the film comes from these scripts. They download
open data into `~/Library/Caches/biology-hub/` (outside OneDrive, never published) and write the
web files into `../../assets/`. Python needs numpy, scipy, scikit-image, trimesh and fast_simplification;
`gltf/` needs `npm install` once (gltf-transform 4.5 and meshoptimizer, as in `gltf/package.json`).

| Level | Run, in order | Writes |
|---|---|---|
| organism, system, organ | `python3 fetch_hra.py` → `python3 build_anatomy.py` → `node gltf/pack.mjs ../../assets/body/anatomy.glb <cache>/anatomy/a_*.glb` (not the old `a_bones.glb`) | `assets/body/anatomy.glb` |
| the organ cut open | after the tissue (below): `node shots.mjs "<page>?test=1" /tmp/bk --steps "$(cat bake-face.js)" --save ~/Library/Caches/biology-hub/tissue/tissue-face.png` (the tissue model's front face, flat), then `python3 build_section.py` | `assets/body/section.*`, `section-map.png` |
| tissue | `python3 trace_tissue.py` (traces the micrograph; `js/tissue3d.js` builds the model from it in the browser) | `assets/tissue/trace.json` |
| cell | `python3 build_whole.py` → `node gltf/pack.mjs ../../assets/cell/whole.glb <cache>/openorganelle/whole/w_*.glb` | `assets/cell/whole.glb` |
| organelles | `python3 fetch_roi.py` → `python3 build_meshes.py` → `node gltf/zones.mjs <cache>/openorganelle/cell3d <name> <budget>` for each organelle → `node gltf/pack.mjs ../../assets/cell/organelles.glb …` | `assets/cell/organelles.glb` |
| organelles (small things) | `python3 instances.py <class> s1 [--voxels]` (ribo, vesicle, np, mt-out with --voxels, cent with --voxels) → `python3 build_small.py` | `assets/cell/small.bin` |
| organelles' electron micrograph | `python3 build_em_slice.py` (one image of the stack, the plane z = 13.2 µm, at s2) | `assets/cell/em-section.*`, `em-slice.json` |
| mitochondria, oval or tube (the panel) | `python3 build_mito_demo.py` (after `fetch_roi.py`; two mitochondria the slice crosses, and the photograph round each at 8 nm) | `assets/cell/mito-demo.*` |
| molecules | `python3 build_molecules.py` → `node gltf/pack.mjs ../../assets/mol/molecules.glb <cache>/molecules/m_*.glb` | `assets/mol/*` |

The organ's face is painted from the tissue model where the zoom goes in, so after any change to the tissue's front
face (`trace.json`, `js/tissue3d.js`), bake the face again and rebuild the section.

The whole cell (`build_whole.py`) is checked against the labels it is made from: ER 88% of its voxels within 70 nm
of the drawn surface, mitochondria 99%, and the lysosomes and endosomes under 12 voxels drawn as balls (a wider
smoothing once drew 29% of the ER, and the cell's edge looked empty). Measure again after changing a blur or a level.

The budgets used for `zones.mjs`: er 400000, mito 90000, endo 60000, lyso 50000, ld 4000 (with `1` after it: one
tile), nucleus 70000, membrane 50000 (golgi 400000 when the box holds Golgi; the box beside the nucleus has none).
Each organelle is written in 3 × 3 tiles, so the page draws only the ones in view (4 Oct: the dive ran at 30 frames a
second with one mesh each).

The organelles' box (`build_meshes.SCENE_UM`, `cell3d.js` `BOX`) is the cytoplasm beside the nucleus, on its left.
Four things must agree when it moves: `zones.mjs` `FOCUS` (full detail round what the reader looks at), the
crop in `build_small.py` (the box ± 0.25 µm), the slice plane in `build_em_slice.py` (across the line of sight,
about 2 µm ahead), and `cell3d.js` `DIVE_END` (the end of the straight way in, found by a search: in the
cytoplasm, the line in through the box's top, the nearest organelles about 1 µm away across the view).

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
