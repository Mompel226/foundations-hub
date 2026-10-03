<div align="center">

<h1>🔬 &nbsp;Cells Lab</h1>

**Cambridge IGCSE Biology 0610 · Topic 2, Organisation of the organism**

[![Open the lab](https://img.shields.io/badge/▶_Open_the_lab-0969DA?style=for-the-badge&logoColor=white)](https://nlcsbiology.com/cells-lab/)

![7 levels](https://img.shields.io/badge/7-levels-0E2A22)
![Real data](https://img.shields.io/badge/every_level-real_data-1E7A3E)
![3D](https://img.shields.io/badge/3D-in_the_browser-0B6A8C)

by **Dr Daniel Mompel Riera** · NLCS Jeju

</div>

![Inside one real human cell: the endoplasmic reticulum, the Golgi apparatus, ribosomes, vesicles, microtubules and the two centrioles, at their real sizes and places](docs/img/screen.jpg)

---

## What a student does

Zoom from a whole human body down to the molecules of one of her cells, one level at a time, and read
what each level is in the words the exam uses:

| | |
|---|---|
| **Organism** | a real woman's body, from a medical atlas |
| **Organ system** | her reproductive system |
| **Organ** | the uterus and its cervix |
| **Tissue** | two real photographs of the lining of the cervix |
| **Cell** | one real HeLa cell, imaged in 3D by an electron microscope; Eric Betzig (Nobel Prize in Chemistry 2014) says why the pictures in biology books are wrong |
| **Organelles** | inside that cell, every part at its measured size and in its measured place: 257,653 ribosomes in one small box |
| **Molecules** | a model, labelled as one: real protein shapes in the numbers a HeLa cell holds, and a kinesin walking a microtubule through the crowd |

A size ruler down the side runs from 1 m to 10 nm, so each step shows how much bigger things get.
Tap any part to see its name, what it does, and whether the syllabus names it.

![The seven levels](docs/img/seven-levels.jpg)

> [!NOTE]
> This is the lab's opening. Its stations, with questions that mark themselves, come next.

## Where it sits

On the [Biology Hub](https://nlcsbiology.com/biology-hub/), behind the Foundations door (topics 2–5).
**← Biology Hub** at the top goes back.

<details>
<summary><b>Behind the scenes</b> — where every level comes from</summary>

<br>

- **The body and her organs**: the HuBMAP Human Reference Atlas, *United Female* v1.10, made from the
  Visible Human Female of the US National Library of Medicine (CC BY 4.0). Only the parts used were read
  from the atlas's 375 MB file.
- **The tissue**: two micrographs of the endocervix by Mikael Häggström, M.D. (CC0). Their size is
  worked out from the nuclei, because the photographs have no scale bar.
- **The cell and its organelles**: Janelia Research Campus, OpenOrganelle *jrc_hela-2* (CC BY 4.0): a
  HeLa cell frozen under high pressure, set in resin and imaged by focused-ion-beam scanning electron
  microscopy, about 6,400 slices 5 nm apart (Xu et al. 2021), its organelles found by machine learning
  (Heinrich et al. 2021). The camera flies in through a real gap in the data, 64 nm at its narrowest.
- **The molecules**: a model. Protein Data Bank shapes; protein numbers measured in HeLa cells
  (Mueller et al. 2020); 3 million protein molecules per cubic micrometre (Milo 2013). Kinesin takes
  8 nm steps; here it takes one a second instead of about a hundred.
- The picture is drawn with three.js (vendored, no CDN), with ambient occlusion, outlines and haze added
  in one pass, the style of crowded-cell paintings.

`assets/CREDITS.md` lists every source and every change; the scripts that made the files are kept
outside this repository.

</details>

## Licence

The software is AGPL-3.0 (`LICENSE`); the teaching material is CC BY-NC-SA 4.0 (`LICENSE-CONTENT`).
Third-party data, pictures and the film keep their own terms: see `NOTICE`.

Something wrong, or a suggestion? Please contact me: dmompelriera@nlcsjeju.kr
