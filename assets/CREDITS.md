# Foundations: the zoom's sources, licences and changes

Every picture in the zoom is made from real data. The scripts that made the files are in
`tools/model-build/`; the downloaded data are kept outside the estate, in
`~/Library/Caches/biology-hub/`, and can be fetched again by the same scripts.

## 1–3. The body, the reproductive system, the uterus (`body/anatomy.glb`)

HuBMAP Human Reference Atlas, *3D Reference Organ for United Female*, v1.10.
https://doi.org/10.48539/HBM637.DWBM.744 — CC BY 4.0. Made from the Visible Human Female (US National
Library of Medicine). Only the parts used were read, by HTTP range requests on the 375 MB file
(`tools/fetch_hra.py`): the skin, the uterus (body, fundus, walls, lower segment, internal os), the cervix
and external os, the vagina, both oviducts and ovaries, the bladder, the rectum, the sacrum, coccyx,
both hip bones, the fourth and fifth lumbar vertebrae and both femurs.
Changes (`tools/build_anatomy.py`): parts joined into nine groups; each simplified (the skin from 266,696 to
22,000 triangles); colours added; the skin drawn as see-through glass.

## 4. The tissue (`tissue/*.jpg`)

Two photographs of the endocervix through a light microscope (H&E stain), by Mikael Häggström, M.D.,
Wikimedia Commons, CC0: *Histology of endocervix.jpg* and *Columnar cell mucosa of endocervix.jpg*.
Changes: the first resized to 1100 px wide; both saved as JPEG. Their size in the lab (about 0.5 mm and
0.09 mm across) is worked out from the nuclei (about 6 µm across); the photographs have no scale bar.

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
- The way in (`tools/path_in.py`): a path through the measured gaps, narrowest 64 nm.

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
re-encoded at a lower bit rate. **Not licensed for this site yet: permission from 632nm is needed before it is
published.**
