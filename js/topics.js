/* ============================================================
   Foundations — the topic register
   ------------------------------------------------------------
   WHEN A LAB OPENS, this is the file to edit HERE: give its topic a `url` and set `status: 'live'`.
   A new lab also needs its row in labs-shared/labs.json, the front door's js/shelves.js, the labs
   script's LABS and the sitemap.

   no      Cambridge 0610 topic number
   title   the syllabus topic name
   lab     the app that covers it
   levels  the levels of the zoom it sits at (js/cell3d.js LEVELS): its door shows in their caption,
           and its bracket on the size ruler spans them
   blurb   one or two sentences, in plain words
   status  "live" | "build"
   url     the published lab
   EXTRAS are the other things on this shelf (a sim, an IB practical), shown at the levels they belong to.
   ============================================================ */
window.TOPICS = [
  { no: 2, title: 'Organisation of the organism', lab: 'Cells Lab',
    levels: ['organism', 'system', 'organ', 'tissue', 'cell', 'inside'],
    blurb: 'Cell, tissue, organ, organ system and organism; the parts of animal, plant and bacterial cells and what each does; specialised cells; magnification and size.',
    status: 'live', url: 'https://nlcsbiology.com/cells-lab/' },
  { no: 3, title: 'Movement into and out of cells', lab: 'a lab',
    levels: ['cell', 'inside'],
    blurb: 'Diffusion, osmosis and active transport: how substances cross the cell membrane, and the investigations the exam sets.',
    status: 'build', url: null },
  { no: 4, title: 'Biological molecules', lab: 'a lab',
    levels: ['molecules'],
    blurb: 'What carbohydrates, fats and proteins are made of, the large molecules built from smaller ones, and the food tests.',
    status: 'build', url: null },
  { no: 5, title: 'Enzymes', lab: 'a lab',
    levels: ['molecules'],
    blurb: 'Enzymes as biological catalysts, the shape of the active site, and how temperature and pH change how fast they work.',
    status: 'build', url: null },
];
window.EXTRAS = [
  { title: 'Protein & Enzyme Sim', kind: 'sim', levels: ['molecules'],
    sub: 'Topics 4 and 5 · build a protein, then watch heat and pH take it apart',
    url: 'https://nlcsbiology.com/protein-enzyme-sim/' },
  { title: 'Starch calibration curve', kind: 'practical', levels: ['molecules'], ibOnly: true,
    sub: 'IB B1.1 · worksheet, workbook and a guide to R',
    url: 'https://nlcsbiology.com/B11-starch-calibration-curve-pract/' },
];
