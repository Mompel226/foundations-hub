# Foundations: the zoom's sources, licences and changes

Every picture in the zoom is made from real data, except the two models, which say so: the tissue and the
molecules. The scripts that made the files are in
`tools/model-build/`; the downloaded data are kept outside the estate, in
`~/Library/Caches/biology-hub/`, and can be fetched again by the same scripts.

## 1–3. The body, the reproductive system, the uterus (`body/anatomy.glb`)

HuBMAP Human Reference Atlas, *3D Reference Organ for United Female*, v1.10.
https://doi.org/10.48539/HBM637.DWBM.744 — CC BY 4.0. Made from the Visible Human Female (US National
Library of Medicine). Only the parts used were read, by HTTP range requests on the 375 MB file
(`tools/fetch_hra.py`): the skin, the uterus (body, fundus, walls, lower segment, internal os), the cervix
and external os, the vagina, both oviducts and ovaries, the bladder, the rectum, the sacrum, coccyx,
both hip bones, the fourth and fifth lumbar vertebrae and both femurs.
Changes (`tools/build_anatomy.py`): parts joined into groups (the bones one group per kind, so each can be
named); each simplified (the skin from 266,696 to 22,000 triangles); colours added; the skin drawn as see-through
glass. One change of place: each ovary moved by about 2 mm (left 1.7 mm, right 1.9 mm), the smallest move that
brings its upper pole to 0.2–0.7 mm from the fimbriae of its oviduct, where they fold over it in life; the Atlas
leaves a gap of about 2.3 mm. Every other organ is where the Atlas puts it (tubes, uterus, cervix and vagina meet
within 0.2 mm).

## 3b. The organ, cut open (`body/section.webp`, `section-map.png`, `section.json`)

The Atlas's uterus and cervix are hollow; one slice down the middle (through the canal of the cervix,
x = −10.5 mm) gives the real outline of the wall, the cavity of the uterus and the canal (`tools/build_section.py`).
Inside the wall the layers are drawn, not measured, at the widths histology describes: the lining of the uterus
1.2 mm (thin: the Visible Human Female was 59, after the menopause), the muscle the rest, an outer covering
0.15 mm; in the cervix, mostly connective tissue with bundles of smooth muscle, and crypts of the canal's lining
3–5 mm deep (IARC Screening Group's atlas, "Anatomical considerations – columnar epithelium",
screening.iarc.fr).
Coloured as a slide stained with haematoxylin and eosin.

## 4. The tissue: a model (`js/tissue3d.js`), traced from the photograph beside it (`tissue/*`)

The 3D tissue is a **model** of a block of the lining of the canal of the cervix, 2 mm across, cut open on its
front face. Inside the green frame its face is the first photograph, traced (`tools/trace_tissue.py` →
`tissue/trace.json`): the surface of the lining with its fold (the edge of the empty canal), the gland cut
across (the edge of its empty lumen), a second gland at the bottom left (only its lining is in the picture),
and the small blood vessels (the pink of their red cells), at the photograph's scale. Measured on the
photograph: cells about 40 µm tall on the surface and 65 µm in the glands, each nucleus near the base of its
cell. Made up: where each cell, nucleus and fibre sits, and the block behind the face (each gland runs straight
back into the wall: a crypt cut across). A crypt opening onto the surface is added outside the frame.

The photographs: the endocervix through a light microscope (H&E stain), by Mikael Häggström, M.D., Wikimedia
Commons, CC0: *Histology of endocervix.jpg* and *Columnar cell mucosa of endocervix.jpg*. Changes: the first
resized to 1100 px wide; the second turned a quarter turn so that its surface is at the top, as in the model;
both saved as JPEG. Scale (the photographs have no scale bar): 0.38 µm a pixel for the first, from the round
nuclei of white blood cells (about 6–7 µm, 17–18 px), so about 0.4 × 0.65 mm. Pins on each mark what the model
names.

From the tissue to the cell: the lining cell the zoom goes into rises out of the tissue and spreads flat, as a
cell of this kind does when it is grown in a dish; then the real HeLa cell takes its place. The rising and the
spreading are a picture of that, not a measurement.

## 5–6. The cell and its organelles (`cell/*`)

Janelia Research Campus, OpenOrganelle dataset **jrc_hela-2** (an interphase HeLa cell, high-pressure frozen,
freeze-substituted, imaged by FIB-SEM at 4 × 4 × 5.24 nm), CC BY 4.0, s3://janelia-cosem-datasets.
Xu, C.S. et al. 2021. An open-access volume electron microscopy atlas of whole cells and tissues. *Nature* 599:147.
Heinrich, L. et al. 2021. Whole-cell organelle segmentation in volume electron microscopy. *Nature* 599:141.
- `whole.glb`: the cell (split from its two neighbours by a watershed from each nucleus), its nucleus,
  mitochondria, Golgi, lysosomes and endosomes, at 64 nm (Golgi 32 nm); `tools/build_whole.py`.
- `organelles.glb`: 7.5 × 4.2 × 7.5 µm round the centrosome at 16 nm: ER (the nuclear envelope moved from the
  ER to the nucleus), mitochondria, Golgi, endosomes, lysosomes, lipid droplets, nucleus, cell membrane;
  smoothed, simplified by distance from the reader's start (`tools/build_meshes.py`, `gltf/zones.mjs`), with
  ambient occlusion baked into the vertex colours.
- `small.bin`: every ribosome (257,653), vesicle (12,853) and nuclear pore (791) in the region as a position and
  size, the centre lines of the microtubules (485 µm) and the two centrioles' positions and axes, from the
  instance segmentations at 8 nm (`tools/instances.py`, `tools/build_small.py`). Their shapes are drawn at
  real size: ribosome 25–30 nm, pore 120 nm, microtubule 25 nm, centriole 250 × 500 nm.
- The way in: round to the cell's thin edge, through the membrane there, and under the rim of the nucleus
  (a gap about 1 µm high, measured) into the box. (`tools/path_in.py`, the earlier way in through the measured
  gaps, narrowest 64 nm, is kept for reference.)
- `em-slice.webp`, `em-outline.png`, `em-slice.json`: one slice of the raw FIB-SEM volume (scale s2, 16 × 16 ×
  21 nm), at x = 26.5 µm of the dataset, 12 × 6.4 µm, straight across the reader's view among the organelles;
  contrast stretched, the ion beam's faint stripes lightened, pixels made square. The outlines are the same
  segmentations the 3D was built from, inside the detailed box only (`tools/build_em_slice.py`).

## 7. The molecules (`mol/*`) — a model

Shapes: Protein Data Bank biological assemblies (CC0): 1U8F, 4C0S, 1FIL, 3K0N, 1I10, 3SRF, 2PSN, 1HTI, 4XCS,
2CG9, 2O02, 4ALD, 2XE7, 1Q8G, 2C9V, 1J6Z, 1JFF, 3KIN, 6QZP, 5GJR, 1EHZ, 1BYU, 1YFK, 3MOS, 3CF3, 1S3X. Each is the
surface round its alpha-carbon (and RNA phosphorus) atoms, enclosing the molecule's real volume.
Numbers: Mueller, T. et al. 2020, *Nature* 583:819 (HeLa), through PaxDb; 3 million protein molecules per µm³
(Milo, R. 2013, *BioEssays* 35:1050). A slab 0.2 × 0.2 µm and 70 nm thick holds 4,441 molecules (17% of its
volume). Where each sits and which way it points are at random; the kinesin stalk and light chains are simple
shapes; kinesin steps 8 nm, hand over hand (Yildiz et al. 2004, *Science* 303:676), slowed 100 times.
`tools/build_molecules.py`, `crowd.json` lists every count.

## The film (`film/*`)

Eric Betzig on the 632nm podcast, episode 61 (8 September 2026), the podcast's own short clip, which includes
animation and microscope footage it credits to others. Three swear words silenced (18.5 s, 41.1 s, 45.3 s);
re-encoded at a lower bit rate. Shown with its source and a link to the full episode; not licensed here (see
NOTICE).
