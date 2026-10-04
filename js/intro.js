/* Foundations, the shelf for topics 2–5: the zoom. The 3D picture (js/cell3d.js) fills the screen; the size ruler on the
   left shows how big the view is; the caption says what each level is, in the words the exam uses.
   Each level waits for the reader: nothing moves on until a button is pressed. The film of Eric Betzig
   appears, and plays, only when the reader reaches the cell. */
import { mount, PARTS, LEVELS, importRetry } from './cell3d.js?v=1791108252';
const VERSION = new URL(import.meta.url).searchParams.get('v') || '';   // (the page's stamp: index.html loads intro.js?v=…)

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// What a tapped part is, in exam words. syl = named in the 0610 syllabus.
const INFO = {
  body:      { syl: true,  name: 'organism', does: 'A living thing. This one is a human.', size: 'She was 1.7 m tall.' },
  ovary:     { syl: true,  does: 'Produces eggs (the female gametes), and the hormone oestrogen.', size: 'About 3 cm long.' },
  oviduct:   { syl: true,  does: 'Carries the egg from the ovary to the uterus. Fertilisation takes place here.', size: 'About 10 cm long.' },
  uterus:    { syl: true,  does: 'Where the embryo implants and the fetus develops. Its wall is mostly muscle.', size: 'About 7.5 cm long.' },
  cervix:    { syl: true,  does: 'A ring of muscle at the lower end of the uterus. It keeps the fetus in the uterus until birth, when it widens.', size: 'About 3 cm long.' },
  vagina:    { syl: true,  does: 'Sperm are deposited here, and the baby passes through it at birth.', size: '' },
  bladder:   { syl: true,  does: 'Stores urine.', size: '' },
  rectum:    { syl: true,  does: 'The last part of the large intestine: it stores faeces.', size: '' },
  hip:       { syl: false, does: 'One of the two hip bones. With the sacrum they make the pelvis, which protects the organs inside it.', size: '' },
  sacrum:    { syl: false, does: 'Five vertebrae joined into one bone, at the back of the pelvis.', size: '' },
  coccyx:    { syl: false, does: 'The tail bone: the last few small vertebrae, joined together.', size: '' },
  vertebrae: { syl: false, does: 'Bones of the backbone. These are the lowest two of the lower back.', size: '' },
  femur:     { syl: false, does: 'The thigh bone, the longest bone of the body.', size: '' },
  muscle:    { syl: true,  name: 'muscle tissue', does: 'Most of the wall of the uterus. It contracts strongly to push the baby out at birth.', size: 'Here about 1 cm thick.' },
  lining_u:  { syl: true,  name: 'lining of the uterus', does: 'The tissue an embryo implants in. It thickens every month and is lost in menstruation.', size: 'Thin here: this woman was 59, past the menopause.' },
  connective:{ syl: false, name: 'connective tissue', does: 'Tissue of fibres and scattered cells that holds other tissues together. Most of the cervix is made of it.', size: '' },
  lining_c:  { syl: false, name: 'lining of the cervix', does: 'One layer of tall cells that make mucus. It folds deep into the wall as crypts.', size: 'One cell thick: about 30 µm.' },
  cover:     { syl: false, name: 'outer covering', does: 'A thin, smooth layer over the outside of the uterus.', size: '' },
  canal:     { syl: false, name: 'canal of the cervix', does: 'The narrow way from the vagina into the uterus. Sperm swim through it; at birth it widens to about 10 cm.', size: '' },
  tcell:     { syl: false, name: 'lining cell, on the surface of the canal', does: 'A tall cell that makes mucus. Thousands of cells like it, side by side, make this tissue.', size: 'About 30 µm tall and 7 µm across.' },
  tnucleus:  { syl: true,  name: 'nucleus', does: 'Contains the genetic material (DNA), which controls the activities of the cell. In these cells it sits near the base.', size: 'About 5 µm wide and 10 µm long.' },
  capillary: { syl: true,  name: 'small blood vessel', does: 'Carries blood through the tissue. Substances pass between the blood and the cells through its thin wall. The red discs inside are red blood cells.', size: '' },
  rbc:       { syl: true,  name: 'red blood cell', does: 'Carries oxygen round the body, joined to haemoglobin.', size: 'About 7.5 µm across.' },
  gcell:     { syl: false, name: 'lining cell of a crypt', does: 'A tall cell that makes mucus, like the cells on the surface. The mucus made in a crypt flows out onto the surface of the canal.', size: 'About 65 µm tall here.' },
  mucus:     { syl: false, name: 'mucus, inside the crypt', does: 'A thick, slippery liquid made by the lining cells. It protects the lining.', size: '' },
  crypt:     { syl: false, name: 'crypt', does: 'A deep fold of the lining into the wall. It makes more surface for making mucus.', size: '3 to 5 mm deep.' },
  section:   { syl: false, name: 'cut face', does: '', size: '' },
  tissue:    { syl: true,  does: 'A group of cells with similar structures, working together to perform a shared function.', size: '' },
  cell:      { syl: true,  name: 'cell membrane', does: 'Controls the movement of substances into and out of the cell.',
               size: 'This cell is about 6 µm high and spreads more than 48 µm across the sapphire disc.' },
  sacs:      { syl: false, name: 'lysosomes and endosomes', does: 'Small sacs: lysosomes break down worn-out parts of the cell; endosomes sort what the cell takes in.', size: '' },
  membrane:  { syl: true,  does: 'Controls the movement of substances into and out of the cell.',
               size: 'About 8 nm thick. You see its inner side, where the cell sits on the sapphire disc.' },
  nucleus:   { syl: true,  does: 'Contains the genetic material (DNA), which controls the activities of the cell.',
               size: 'This nucleus is 21 µm long, 14 µm wide and 5 µm high.' },
  cytoplasm: { syl: true,  name: 'cytoplasm', does: 'Where most of the chemical reactions of the cell take place.',
               size: 'It is not empty: it is full of protein molecules, too small to show at this zoom.' },
  ribo:      { syl: true,  does: 'Where proteins are made (protein synthesis).',
               size: 'About 25 to 30 nm across. Many sit in small groups, each group reading one strand of RNA.' },
  mito:      { syl: true,  does: 'Where aerobic respiration takes place, releasing energy for the cell.',
               size: 'In this cell most are about 0.3 µm wide, and many are long and branched.' },
  er:        { syl: false, does: 'A network of membrane tubes and flat sacs. Many proteins and lipids are made on it or inside it.',
               size: 'Its tubes are about 50 to 100 nm wide. It joins the membrane around the nucleus.' },
  golgi:     { syl: false, does: 'Stacks of flat membrane sacs that change proteins and pack them into vesicles.',
               size: 'In this cell it forms a ring about 10 µm across, around the centrioles.' },
  vesicle:   { syl: false, does: 'A small sac made of membrane that carries substances around the cell.', size: 'Most are 50 to 60 nm across.' },
  lyso:      { syl: false, does: 'A sac of digestive enzymes. It breaks down worn-out parts of the cell, and substances the cell has taken in.', size: '' },
  endo:      { syl: false, does: 'A sac that sorts the substances the cell has taken in from outside.', size: '' },
  sacs:      { syl: false, does: 'Lysosomes break down worn-out parts of the cell; endosomes sort what the cell takes in.', size: '' },
  ld:        { syl: false, does: 'A store of fat (lipid).', size: '' },
  mt:        { syl: false, does: 'A hollow tube of protein. Motor proteins carry vesicles along it.', size: '25 nm wide.' },
  cut:       { syl: false, name: 'the edge of the imaged block', does: 'The microscope imaged only a block of the cell, 48 µm by 33 µm. Here the block ends; the cell goes on beyond it.', size: '' },
  centriole: { syl: false, does: 'A short cylinder made of nine groups of three microtubules. Many microtubules start from the pair at the centre of the cell.',
               size: 'About 250 nm wide and 500 nm long.' },
  molecule:  { syl: false, name: 'a molecule', does: '', size: '' },
  npore:     { syl: false, does: 'A channel through the two membranes around the nucleus. Messenger RNA leaves the nucleus through it.', size: 'About 120 nm across.' },
};
const BEYOND = ['er', 'golgi', 'vesicle', 'lyso', 'endo', 'ld', 'mt', 'centriole', 'npore'];

// What each level is. def: the exam's own wording where the syllabus has one; here: what you see;
// more: opened only by "More". mag: how many times larger the next level shows things.
const TEXT = {
  organism: {
    def: '<b>Organism</b>: a living thing. This whole woman is one organism.',
    here: 'A real woman’s body, recorded slice by slice for a medical atlas.',
    more: '<ul class="chips"><li><b>1.7 m</b><span>her height</span></li><li><b>30 million million</b><span>about how many cells a body has</span></li><li><b>7</b><span>levels, from her body to its molecules</span></li></ul><p class="hint">Scroll to zoom in and out through all seven levels. Scroll to zoom in and out. Point at a part to see its name.</p>',
    go: 'an organ system', mag: '× 8' },
  system: {
    def: '<b>Organ system</b>: a group of organs with related functions, working together to perform body functions.',
    here: 'Her reproductive system: the ovaries, the oviducts, the uterus, the cervix and the vagina.',
    more: '<p class="hint">Tap an organ to see what it does. Scroll to zoom in and out.</p>',
    go: 'an organ', mag: '× 2.5' },
  organ: {
    def: '<b>Organ</b>: a structure made up of a group of tissues, working together to perform specific functions.',
    here: 'The uterus and its cervix, cut open. The wall is made of different tissues: muscle tissue, connective tissue and a lining.',
    more: '<p>The uterus (dark pink) is mostly muscle tissue. The cervix, its narrow lower part (pale pink), is mostly connective tissue. A lining covers the inside of both.</p><p>Next, you go into the lining of the canal of the cervix.</p><p class="hint">The cut face is coloured like a stained slide under a microscope. Point at a tissue to see its name.</p>',
    go: 'a tissue', mag: '× 160' },
  tissue: {
    def: '<b>Tissue</b>: a group of cells with similar structures, working together to perform a shared function.',
    here: 'The lining of the cervix: one layer of tall cells, all alike, that make mucus. Each nucleus (violet) sits near the base of its cell.',
    more: '<p>The slide is not one tissue. It shows <b>two different tissues</b> of the cervix:</p>' +
      '<p><b>Lining tissue</b>, at the top: one layer of tall cells, all alike, that make mucus. The zoom goes into this tissue. The crypt is not a third tissue: it is the same lining, folded deep into the wall.</p>' +
      '<p><b>Connective tissue</b>, below it: cells spread far apart, with fibres between them. It holds the lining in place and carries the small blood vessels.</p>' +
      '<p>Cells of one kind make a <b>tissue</b>; several tissues working together make an <b>organ</b>, here the cervix.</p>' +
      '<p class="hint">The 3D is a model of this slide: inside the green frame it matches the photograph. The colours are those of the stain: nuclei purple, the rest pink.</p>',
    go: 'one cell', mag: '× 10' },
  cell: {
    def: '<b>Cell</b>: the basic unit of every living organism.',
    here: 'The middle of one real HeLa cell, a cell like the ones lining the cervix, grown flat in a laboratory. An electron microscope photographed this block of it in 3D: the cell goes on beyond the straight edges.',
    more: '<p>In 1951, cells like those in the lining of the cervix were taken from a cancer of a woman called <b>Henrietta Lacks</b>, without asking her. They still divide in laboratories today, and are called <b>HeLa cells</b>.</p>' +
      '<p>The microscope imaged a block 48 µm by 33 µm. This cell is bigger: where the block cuts it (the striped faces), it goes on. So you see the middle of the cell, round its nucleus, and the nucleus looks larger than it is: in the block it takes up about a quarter of the cell. It is also large because HeLa cells are cancer cells, whose nuclei are bigger than healthy ones.</p>' +
      '<p>Between the organelles the cytoplasm is <b>not empty</b>: it is full of ribosomes and proteins, too small to draw at this zoom. In the photograph below they are the grey grains.</p>' +
      '<p>Near the cell membrane there are fewer large organelles than near the nucleus. In this cell, mitochondria fill about 3 parts in 100 of the space near the edge, and about 8 near the nucleus; the endoplasmic reticulum fills about 2 and about 11. Small sacs and thin tubes of endoplasmic reticulum reach all the way to the edge.</p>' +
      '<figure class="cap__fig"><div class="cap__figimg"><img src="assets/cell/em-section.webp?v=6" alt="An electron micrograph: one slice through this cell, from the glass up. The cell membrane is at the top, the nucleus on the right, the cytoplasm in between; on the left the cell gets thinner and goes on" width="750" height="400" loading="lazy"><img src="assets/cell/em-section-outline.png?v=6" alt="" width="750" height="400" loading="lazy"></div>' +
      '<figcaption>One real slice through the block, 12 µm across: the glass at the bottom, the membrane at the top, the nucleus on the right. On the left the cell gets thinner and goes on past the block. Each part the computer found is outlined in its colour in the 3D.</figcaption></figure>' +
      '<p>This one grew flat on a sapphire disc. Scientists froze it very fast, then set it in hard resin. A beam of ions removed a layer about 5 nanometres thick, and an electron microscope photographed the new surface. This was repeated more than 6,000 times, and a computer found every part of the cell.</p>' +
      '<ul class="chips"><li><b>48 µm</b><span>width of the block imaged</span></li><li><b>6 µm</b><span>height of the cell</span></li><li><b>21 µm</b><span>length of its nucleus</span></li></ul>' +
      '<p><b>On the picture: Eric Betzig</b>, Nobel Prize in Chemistry 2014, for microscopes that see single molecules in living cells. Listen to what he says about the pictures of cells in biology books.</p>' +
      '<details class="words"><summary>Read what he says</summary><p>“Almost everything you learn in biology textbooks is a hallucination. You guys have probably seen on the web: here’s a cargo on a kinesin walking along a microtubule like this. And it’s all in this vast empty space. I don’t know any cell that’s a bunch of vast empty space. I’m sorry, it’s crowded […]. There’s a hundred trillion water molecules in every cell. There’s ten billion protein molecules. There’s ten billion carbohydrates. There’s ten billion… It’s by far the most complex matter in the known universe. We understand the interiors of neutron stars far better than we understand the interior of cells. There’s a reason why only 9% of the drugs that enter phase one come out of phase three: because we don’t know what […] we’re doing. We don’t know the real mechanisms that are going on. And when you start to […] look at the dynamics, not just the structure, you realise that you had it all wrong. And you realise that so many of the things that they thought they knew, you can’t be sure that they know. We have to reinvestigate all of it.”</p></details>' +
      '<p class="hint">From the <a href="https://www.youtube.com/watch?v=RUB37QhWNkw" target="_blank" rel="noopener">632nm podcast, episode 61</a>. Three swear words are silenced.</p>',
    go: 'the organelles', mag: '× 7' },
  inside: {
    def: '<b>Organelles</b>: the parts inside a cell. Each one here is at its real size and in its real place.',
    here: 'You are in the cytoplasm beside the nucleus, just under the cell membrane. It is crowded: mitochondria, endoplasmic reticulum, ribosomes, vesicles.',
    more: '<p>In this box, 7.5 µm across, the microscope found:</p><ul class="chips"><li><b data-count="ribosomes">553,130</b><span>ribosomes</span></li><li><b data-count="vesicles">2,361</b><span>vesicles</span></li><li><b data-count="pores">144</b><span>pores in the nucleus</span></li><li><b data-count="microtubuleUm">225 µm</b><span>of microtubules</span></li></ul>' +
      '<p>Only the ribosomes near you are drawn. There are about 2,000 in every cubic micrometre of cytoplasm: if all of them were drawn, at their real size, you could not see anything else.</p>' +
      '<p><b>Are mitochondria really this shape?</b> In this cell, yes. 7 in 10 are short, under 2&nbsp;µm long; the rest are longer tubes, up to 14&nbsp;µm, and they hold three quarters of all the mitochondria. Mitochondria join together and divide again all the time. A thin slice through a short one or a tube shows an oval: that is the shape in the photograph beside, and in books. <button class="linkbtn" type="button" data-open="diagram">See it step by step</button></p>' +
      '<p>The dark space between them is <b>not empty</b>. It is cytoplasm, full of molecules too small to show here: about 140 million protein molecules, and about a million million water molecules, in this box alone.</p>' +
      '<p class="hint">Point at any part to see its name. Your syllabus names only some of these parts: press “Only the syllabus parts” to see the difference.</p>',
    go: 'the molecules', mag: '× 50' },
  molecules: {
    def: '<b>Molecules</b>: a model of the cytoplasm, with every protein drawn at its real shape and size.',
    here: 'A motor protein, kinesin, walks along a microtubule and pulls a vesicle, 8 nm a step. There is no empty space around it. The film showed this same scene, a vesicle pulled along a microtubule; here the space around it is crowded, as in a real cell.',
    more: '<p>This is a <b>model</b>, not a measurement: no microscope can yet show every molecule in a whole cell. It uses the real shape of each kind of protein (Protein Data Bank) and how many of each kind a HeLa cell holds.</p>' +
      '<p>It is shown as a slice 70 nm thick: the molecules in front of the microtubule are left out, so that you can see it.</p>' +
      '<p>Kinesin really takes about 100 steps every second; here it takes one. In the time of one real step, the molecules around it move hundreds of nanometres: at that speed they would be a blur, so here they move only when the vesicle reaches them.</p>' +
      '<p class="hint">Tap a molecule to see what it is.</p>',
    go: null, mag: '' },
};
const SAID_SHORT = { organism: 'Organism', system: 'Organ system', organ: 'Organ', tissue: 'Tissue', cell: 'Cell', inside: 'Organelles', molecules: 'Molecules' };

const zoom = $('#zoom'), gl = $('#gl');
const video = $('#filmVideo');
let cell = null, busy = false, filmPlayed = false;

// ---------- the ruler ----------
const TOP_M = 2.2, BOT_M = 6e-9;
const yOf = m => (Math.log10(TOP_M) - Math.log10(m)) / (Math.log10(TOP_M) - Math.log10(BOT_M)) * 100;
function drawRuler() {
  const sc = $('#rulerScale');
  const ticks = [[1, '1 m'], [0.1, '10 cm'], [0.01, '1 cm'], [1e-3, '1 mm'], [1e-4, '100 µm'], [1e-5, '10 µm'], [1e-6, '1 µm'], [1e-7, '100 nm'], [1e-8, '10 nm']];
  sc.innerHTML = ticks.map(([m, l]) => `<div class="tick" style="top:${yOf(m)}%"><span>${l}</span></div>`).join('');
  spreadStops();
  drawTopicBrackets();
}

// ---------- the topics: each sits at the levels of the zoom it is about ----------
const TOPICS = window.TOPICS || [], EXTRAS = window.EXTRAS || [];
const stopY = l => parseFloat($('.stop[data-level="' + l + '"]').style.top);   // where spreadStops put it, px
const LEVEL_NAME = { organism: 'Organism', system: 'Organ system', organ: 'Organ', tissue: 'Tissue', cell: 'Cell', inside: 'Organelles', molecules: 'Molecules' };
function drawTopicBrackets() {
  const host = $('#rulerTopics'); if (!host) return;
  const groups = [];                       // topics with the same levels share one bracket (4 and 5)
  for (const t of TOPICS) {
    const key = t.levels.join(',');
    const g = groups.find(x => x.key === key);
    if (g) g.topics.push(t); else groups.push({ key, levels: t.levels, topics: [t] });
  }
  host.innerHTML = groups.map((g, i) => {
    const a = stopY(g.levels[0]), b = stopY(g.levels[g.levels.length - 1]);
    const top = Math.min(a, b) - (a === b ? 11 : 6), h = Math.abs(b - a) + (a === b ? 22 : 12);
    const nos = (g.topics.length > 1 ? 'Topics ' : 'Topic ') + g.topics.map(t => t.no).join(' and ');
    const names = g.topics.map(t => 'Topic ' + t.no + ', ' + t.title).join('; ');
    return `<button class="bracket" type="button" data-no="${g.topics[0].no}" style="top:${top}px;height:${h}px;--x:${i === 1 ? 12 : 0}px" aria-label="${names}"><span>${nos}</span></button>`;
  }).join('');
  $$('.bracket', host).forEach(b => b.addEventListener('click', () => openTopics(Number(b.dataset.no))));
}
function topicPills(level) {
  const here = TOPICS.filter(t => t.levels.includes(level)), extras = EXTRAS.filter(x => x.levels.includes(level));
  const pill = t => t.status === 'live' && t.url
    ? `<a class="tpill tpill--live" href="${t.url}"><b>Topic ${t.no}</b> ${t.title} <i>Open →</i></a>`
    : `<button class="tpill" type="button" data-no="${t.no}"><b>Topic ${t.no}</b> ${t.title} <i>being built</i></button>`;
  const xpill = x => `<a class="tpill tpill--live tpill--x" href="${x.url}"><b>${x.kind === 'sim' ? 'Sim' : 'Practical'}</b> ${x.title}${x.ibOnly ? ' (IB)' : ''} <i>Open →</i></a>`;
  $('#capTopics').innerHTML = here.length || extras.length ? '<span class="cap__topicslbl">Here:</span>' + here.map(pill).join('') + extras.map(xpill).join('') : '';
  $$('#capTopics button.tpill').forEach(b => b.addEventListener('click', () => openTopics(Number(b.dataset.no))));
}
function openTopics(no) {
  const list = $('#topicList');
  list.innerHTML = TOPICS.map(t => `<section class="topic" id="topic-${t.no}">
      <h3><span class="topic__no">${t.no}</span>${t.title}</h3>
      <p>${t.blurb}</p>
      <p class="topic__where">In the zoom: ${t.levels.map(l => LEVEL_NAME[l]).join(' → ')}</p>
      <p class="topic__go">${t.status === 'live' && t.url ? `<a class="btn btn--go" href="${t.url}">Open the ${t.lab}</a>` : `<span class="topic__build">Its lab is being built.</span>`}
        <button class="btn" type="button" data-level="${t.levels[0]}">Show me where</button></p>
    </section>`).join('') +
    `<h3 class="topic__also">Also on this shelf</h3>` + EXTRAS.map(x => `<p class="topic__x"><a href="${x.url}"><b>${x.title}</b></a>${x.ibOnly ? ' (IB)' : ''}: ${x.sub}</p>`).join('');
  $$('#topicList button[data-level]').forEach(b => b.addEventListener('click', () => { $('#topics').close(); go(b.dataset.level); }));
  $('#topics').showModal();
  if (no) { const el = $('#topic-' + no); if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('is-picked'); setTimeout(() => el.classList.remove('is-picked'), 1600); } }
}
// Each level sits at its real size on the ruler. Two levels close in size (an organ system, 20 cm, and an
// organ, 8 cm) are moved apart just enough that their circles and names never touch: a few pixels, less than
// the width of a circle, so the ruler still reads true.
function spreadStops() {
  const stops = $$('.stop'), H = $('#ruler').clientHeight || 1, gap = 24;
  const ys = stops.map(b => yOf(Number(b.dataset.m)) / 100 * H);
  for (let pass = 0; pass < 6; pass++)
    for (let i = 1; i < ys.length; i++) {
      const d = ys[i] - ys[i - 1];
      if (d < gap) { ys[i - 1] -= (gap - d) / 2; ys[i] += (gap - d) / 2; }
    }
  stops.forEach((b, i) => { b.style.top = ys[i].toFixed(1) + 'px'; });
}
window.addEventListener('resize', () => drawRuler());
function fmtM(m) {
  if (m >= 1) return (Math.round(m * 10) / 10) + ' m';
  if (m >= 0.01) return Math.round(m * 100) + ' cm';
  if (m >= 1e-3) return (Math.round(m * 1e4) / 10) + ' mm';
  if (m >= 1e-6) { const u = m * 1e6; return (u >= 100 ? Math.round(u) : Math.round(u * 10) / 10) + ' µm'; }
  return Math.round(m * 1e9) + ' nm';
}
function setNow(m) { $('#capView').textContent = 'the view: ' + fmtM(m) + ' across'; }

function setLevelUI(level) {
  const i = LEVELS.indexOf(level), t = TEXT[level];
  $$('.stop').forEach(b => {
    const j = LEVELS.indexOf(b.dataset.level);
    b.setAttribute('aria-current', String(j === i)); b.classList.toggle('is-done', j < i);
  });
  $('#capN').textContent = 'Level ' + (i + 1) + ' of 7';
  $('#capLevel').textContent = SAID_SHORT[level];
  $('#capDef').innerHTML = t.def;
  $('#capHere').textContent = t.here;
  $('#capMore').innerHTML = t.more;
  topicPills(level);
  $$('.bracket').forEach(b => { const tp = TOPICS.find(x => x.no === Number(b.dataset.no)); b.classList.toggle('is-here', !!tp && tp.levels.includes(level)); });
  fillCounts();
  setMore(false);
  const go = $('#btnGo');
  go.innerHTML = t.go ? 'Zoom in <b>' + t.mag + '</b>: ' + t.go : 'Start again';
  $('#btnBack').hidden = i === 0;
  $('#sylSwitch').hidden = level !== 'inside';
  $('#capNotice').hidden = level !== 'cell' && level !== 'inside';
  setNow(Number($('.stop[data-level="' + level + '"]').dataset.m));
  hideCard();
  const below = i >= LEVELS.indexOf('cell');
  if (!below) { video.pause(); $('#film').hidden = true; $('#filmPill').hidden = true; }
  zoom.style.setProperty('--caph', $('#cap').offsetHeight + 'px');
  zoom.classList.remove('text-first');           // (each level starts with its picture)
  // (and at the top of its text, More closed: scrolled down inside More at one level, the next opened scrolled down,
  // its definition out of sight; Daniel, 4 Oct)
  setMore(false); $('#cap').scrollTop = 0; $('#capMore').scrollTop = 0;
  fitCap();
}
// tell the picture how much of the screen the ruler and the caption take: on a laptop the caption is a column
// on the right, so the picture is centred between the ruler and the caption; on a phone it is at the bottom
function inset() {
  if (!cell) return;
  const narrow = zoom.clientWidth < 760;
  const capBox = $('#cap').getBoundingClientRect();
  // a photograph or the film at the top right takes room too: the picture (and its names) keep clear of it
  const side = zoom.classList.contains('more-open') ? null : [$('#film'), $('#micro'), $('#micro2'), $('#emfig')].find(x => !x.hidden);
  // (the film's note stands to its left: the picture keeps clear of it too)
  const note = $('.filmnote'), nr = side && side.id === 'film' ? note.getBoundingClientRect() : null;
  const sideLeft = side ? Math.min(side.getBoundingClientRect().left, nr && nr.width ? nr.left : Infinity) : Infinity;
  const left = Math.min(capBox.left, sideLeft);
  // (the names keep clear of what stands over the picture: the scale bar, and on a phone the ruler)
  const zr = zoom.getBoundingClientRect(), box = sel => { const r = $(sel).getBoundingClientRect(); return [r.left - zr.left - 6, r.top - zr.top - 6, r.right - zr.left + 6, r.bottom - zr.top + 6].map(Math.round); };
  const scale = box('#scalebar'); scale[2] = Math.max(scale[2], scale[0] + Math.round(zoom.clientWidth * 0.2) + 60);   // (its width is set a moment later: its widest)
  // (on a phone the page's title runs over the picture: the names keep below it)
  const headB = Math.round(($('.top') || $('header')).getBoundingClientRect().bottom - zr.top + 4);
  // (and on a phone, the slide at the top right: a name ran under it)
  const sideBox = narrow && side ? box('#' + side.id) : null;
  cell.setInset(narrow ? { left: 30, right: 0, top: Math.max(60, headB), bottom: zoom.clientHeight - capBox.top + 8, avoid: [box('#ruler'), scale, ...(sideBox ? [sideBox] : [])] }
    : { left: 272, right: zoom.clientWidth - left + 6, top: 60, bottom: 0, avoid: [scale] });
}
window.addEventListener('resize', () => inset());
// On a laptop, "More" lets the caption take the whole right-hand column: the film or the photograph steps aside
// while it is open (the film plays on), else the caption has a strip a few lines high to show it in.
function setMore(open) {
  $('#capMore').hidden = !open;
  $('#btnMore').setAttribute('aria-expanded', String(open));
  $('#btnMore').textContent = open ? 'Less' : 'More';
  zoom.classList.toggle('more-open', open && zoom.clientWidth >= 760);
  fitCap();
  zoom.style.setProperty('--caph', $('#cap').offsetHeight + 'px');
}
$('#btnMore').addEventListener('click', () => setMore($('#capMore').hidden));

// ---------- mitochondria: book drawing or real cell? ----------
// The steps (js/mitodemo.js, its own small 3D picture) are loaded the first time the window opens.
let demo = null, demoLoading = null;
async function openDiagram() {
  $('#diagram').showModal();
  if (demo) { demo.restart(); return; }
  if (demoLoading) return;
  const box = $('#mitoDemo');
  demoLoading = importRetry('./mitodemo.js?v=1791108252').then(m => m.start(box, { v: VERSION })).then(d => {
    demo = d;
    $('.md__next', box).disabled = false;
    $('.md__next', box).addEventListener('click', () => demo.next());
    $('.md__back', box).addEventListener('click', () => demo.back());
  }).catch(e => { console.error(e); demoLoading = null; $('.md__text', box).textContent = 'The 3D steps could not be shown just now (close this and open it again to try again). The text below says the same.'; });
}
$('#capNotice').addEventListener('click', openDiagram);
$('#diagramClose').addEventListener('click', () => $('#diagram').close());
$('#capMore').addEventListener('click', e => { if (e.target.closest('[data-open="diagram"]')) openDiagram(); });

// ---------- the film ----------
// A browser lets a film play with sound only after the reader has pressed something on the page. The first
// press anywhere "unlocks" the film (it plays for an instant, muted, and stops), so that it can start by
// itself later, with sound, when the reader arrives at the cell.
let unlocked = false;
function unlock() {
  if (unlocked) return; unlocked = true;
  video.muted = true;
  const p = video.play();
  if (p) p.then(() => { video.pause(); video.currentTime = 0; video.muted = false; }).catch(() => { video.muted = false; });
}
document.addEventListener('pointerdown', unlock, { capture: true, once: true });
document.addEventListener('keydown', unlock, { capture: true, once: true });
function playFilm(fromStart) {
  $('#film').hidden = false; $('#filmPill').hidden = true; fitCap();
  if (fromStart) video.currentTime = 0;
  video.muted = false;
  const p = video.play();
  if (p) p.catch(() => {        // this browser still wants a press: play without sound and offer it
    video.muted = true; video.play().catch(() => {});
    $('#filmSound').hidden = false;
  });
}
$('#filmSound').addEventListener('click', () => { video.muted = false; $('#filmSound').hidden = true; video.play(); });
$('#filmPlay').addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });
video.addEventListener('play', () => { $('#filmPlay').textContent = '❚❚'; $('#filmPlay').setAttribute('aria-label', 'Pause'); });
video.addEventListener('pause', () => { $('#filmPlay').textContent = '▶'; $('#filmPlay').setAttribute('aria-label', 'Play'); });
video.addEventListener('ended', () => { $('#film').hidden = true; $('#filmPill').hidden = false; });
$('#filmClose').addEventListener('click', () => { video.pause(); $('#film').hidden = true; $('#filmPill').hidden = false; });
$('#filmPill').addEventListener('click', () => playFilm(video.ended));

// ---------- the name under the pointer ----------
const tip = $('#hovertip');
// (only while the pointer is on the picture itself: over the caption, a photograph or a button, never)
let onPicture = false;
document.addEventListener('pointerover', e => { onPicture = e.target.tagName === 'CANVAS' && !!e.target.closest('#gl'); if (!onPicture) tip.hidden = true; }, true);
function showTip(p) {
  if (!p || !p.part || !onPicture) { tip.hidden = true; return; }
  const info = INFO[p.part] || {}, part = PARTS[p.part] || {};
  const name = p.part === 'molecule' && p.label ? p.label : (info.name || part.name || p.part);
  tip.querySelector('span').textContent = cap(name);
  tip.style.setProperty('--c', '#' + (part.col != null ? part.col.toString(16).padStart(6, '0') : '888888'));
  tip.hidden = false;
  // (never over the text card, a slide, the film or its note: beside the pointer on the other side, else not at all;
  // Daniel, 4 Oct: a name ran over the molecules' definition)
  const W = zoom.clientWidth, zr = zoom.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, y = Math.max(8, p.y - 12);
  const boxes = ['#cap', '#film', '.filmnote', '#micro', '#micro2', '#emfig', '#tapcard'].map(sel => $(sel)).filter(Boolean)
    .map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
  const hits = x => boxes.some(r => x < r.right - zr.left + 6 && x + w > r.left - zr.left - 6 && y < r.bottom - zr.top + 6 && y + h > r.top - zr.top - 6);
  let x = Math.min(p.x + 16, W - w - 10);
  if (hits(x)) x = p.x - 16 - w;
  if (x < 4 || hits(x)) { tip.hidden = true; return; }
  tip.style.transform = `translate(${x}px,${y}px)`;
}

// ---------- the photograph beside the model (tissue level) ----------
// each pin's name goes beside, below or above its dot: the first place that fits inside the picture without
// covering another name (else the one that fits best); so no name is ever cut by the edge of the picture
function fitPins(fig) {
  const box = $('.micro__img', fig); if (!box) return;
  const W = box.clientWidth, H = box.clientHeight, placed = [];
  $$('.pin', fig).forEach(p => {
    if (!$('span', p)) { const t = [...p.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); [...p.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); const sp = document.createElement('span'); sp.textContent = t; p.appendChild(sp); }
    const sp = $('span', p), w = sp.offsetWidth, h = sp.offsetHeight, x = p.offsetLeft, y = p.offsetTop;
    const tries = [[9, -h / 2], [-9 - w, -h / 2], [-w / 2, 8], [-w / 2, -8 - h]];
    const score = ([dx, dy]) => {
      const r = [x + dx, y + dy, x + dx + w, y + dy + h];
      const out = Math.max(0, 2 - r[0]) + Math.max(0, r[2] - (W - 2)) + Math.max(0, 2 - r[1]) + Math.max(0, r[3] - (H - 2));
      const hit = placed.reduce((s, q) => s + Math.max(0, Math.min(r[2], q[2]) - Math.max(r[0], q[0])) * Math.max(0, Math.min(r[3], q[3]) - Math.max(r[1], q[1])), 0);
      return [out * 1000 + hit, r];
    };
    let best = null;
    for (const t of tries) { const [sc, r] = score(t); if (!best || sc < best[0]) best = [sc, r, t]; if (sc === 0) break; }
    let [, r, [dx, dy]] = best;
    // still over an edge: slide the name inside (the dot stays where it is)
    const shiftX = Math.max(2 - r[0], Math.min(0, (W - 2) - r[2])), shiftY = Math.max(2 - r[1], Math.min(0, (H - 2) - r[3]));
    dx += shiftX; dy += shiftY;
    placed.push([x + dx, y + dy, x + dx + w, y + dy + h]);
    sp.style.setProperty('--tx', Math.round(dx) + 'px'); sp.style.setProperty('--ty', Math.round(dy) + 'px');
  });
}

// The tissue's photograph: each name in the column beside the picture, at the height of its place (moved apart
// where two would touch), and a thin line from the name to the dot on the place (Daniel, 4 Oct: the names on the
// small picture overlapped and hid what they named)
function callouts(fig) {
  const box = $('.micro__img', fig), col = $('.micro__labels', fig), svg = $('.micro__lines', fig);
  if (!box || !col || !svg || fig.hidden) return;
  const fr = fig.getBoundingClientRect(), br = box.getBoundingClientRect(), cr = col.getBoundingClientRect();
  if (!br.height) return;
  const pins = $$('.pin', fig).map(p => ({ x: br.left - fr.left + p.offsetLeft, y: br.top - fr.top + p.offsetTop,
    text: p.textContent.trim(), c: getComputedStyle(p).getPropertyValue('--c').trim() }));
  // each name on its pin's own row, so its line is level (the pins are chosen a full row apart: trace_tissue.py);
  // only if two came too close would one move, and its line bend once
  pins.sort((a, b) => a.y - b.y);
  const gap = 40, top = br.top - fr.top + 12, bottom = br.bottom - fr.top - 12;
  let y = -Infinity; pins.forEach(q => { q.ly = Math.max(q.y, y + gap, top); y = q.ly; });
  let lim = bottom; for (let i = pins.length - 1; i >= 0; i--) { pins[i].ly = Math.min(pins[i].ly, lim); lim = pins[i].ly - gap; }
  col.textContent = '';
  const ns = 'http://www.w3.org/2000/svg';
  svg.setAttribute('width', fr.width); svg.setAttribute('height', fr.height); svg.textContent = '';
  // the line starts just after the name, well clear of the photograph's edge, and ends ON the structure: no dots at
  // either end (they hid what they pointed at: Daniel, 4 Oct)
  const xL = cr.right - fr.left - 24, xE = br.left - fr.left + 10;
  for (const q of pins) {
    const s = document.createElement('span'); s.textContent = q.text; s.style.top = (q.ly - (cr.top - fr.top)) + 'px';
    col.appendChild(s);
    const d = Math.abs(q.ly - q.y) < 1 ? `M${xL} ${q.ly} L${q.x} ${q.y}` : `M${xL} ${q.ly} L${xE} ${q.ly} L${q.x} ${q.y}`;
    for (const [w, c] of [[3.2, 'rgba(0,0,0,.5)'], [1.3, 'rgba(255,255,255,.95)']]) {
      const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', 'none');
      path.setAttribute('stroke', c); path.setAttribute('stroke-width', w); path.setAttribute('stroke-linejoin', 'round'); svg.appendChild(path);
    }
  }
}
window.addEventListener('resize', () => callouts($('#micro')));
$('#micro img').addEventListener('load', () => callouts($('#micro')));

// The caption keeps clear of whatever stands at the top right: the film, or the photograph.
// On a laptop the right-hand column holds the picture (a photograph or the film) above and the text card below, one
// width (--colw), sharing the column's height: the text keeps its own height up to 45% of the column (beyond that it
// scrolls, and says so), the picture is sized to the rest. Laid out again whenever anything in the column changes
// size, at every level and on every resize (Daniel, 4 Oct: going back from the cell to the tissue, the text card ran
// under the photograph: the film had gone in another step, and the card's top was still the film's).
function fitCap() {
  const narrow = zoom.clientWidth < 760, zr = zoom.getBoundingClientRect();
  const side = zoom.classList.contains('more-open') ? null : [$('#film'), $('#micro'), $('#micro2'), $('#emfig')].find(x => !x.hidden);
  // (a slide shown: the picture first, the text short)
  const pf = !!side && side.id !== 'film' && !narrow && !zoom.classList.contains('text-first');
  if (zoom.classList.contains('pic-first') !== pf) zoom.classList.toggle('pic-first', pf);
  if ((!side || !side.classList.contains('is-big')) && zoom.classList.contains('pic-big')) { $$('.micro.is-big').forEach(f => f.classList.remove('is-big')); zoom.classList.remove('pic-big'); if (cell) cell.pause(false); }
  if (side && !narrow) sizeSide(side);
  if (side && side.classList.contains('is-big')) { inset(); scrollCue(); return; }     // (enlarged: over everything, the column stays)
  const top = Math.round(side ? side.getBoundingClientRect().bottom - zr.top + 12 : 96);
  if (zoom.style.getPropertyValue('--captop') !== top + 'px') zoom.style.setProperty('--captop', top + 'px');
  inset(); scrollCue();
}
function sizeSide(side) {
  const colH = zoom.clientHeight - 96 - 18, cap = $('#cap');
  const room = colH - Math.min(cap.scrollHeight, colH * (colH < 650 ? 0.5 : 0.45)) - 12;   // what the text leaves (half, on a short screen)
  if (side.id === 'film') { zoom.style.setProperty('--filmh', Math.round(Math.max(200, Math.min(430, room))) + 'px'); return; }
  const img = $('.micro__img img', side);
  if (!img || zoom.classList.contains('text-first')) return;
  const ar = (img.naturalWidth || +img.getAttribute('width')) / (img.naturalHeight || +img.getAttribute('height'));
  img.style.width = 'auto'; img.style.height = '0px';
  const other = side.getBoundingClientRect().height;                   // the panel without its picture
  const call = side.classList.contains('micro--callouts');
  if (side.classList.contains('is-big')) {                             // enlarged: as big as the screen allows
    // (its width follows the picture: measured with the picture in, else its text wraps narrow and tall)
    const fit = () => { const o = side.getBoundingClientRect().height - img.getBoundingClientRect().height;
      img.style.height = Math.round(Math.max(200, Math.min(innerHeight * 0.9 - o, (innerWidth * 0.92 - (call ? 170 : 0)) / ar))) + 'px'; };
    img.style.height = Math.round(innerHeight * 0.6) + 'px'; fit(); fit();
    if (side.id === 'micro') callouts(side);
    return;
  }
  const availW = side.clientWidth - (call ? 150 : 0) - 2;
  img.style.height = Math.round(Math.max(110, Math.min(room - other, availW / ar))) + 'px';
  if (side.id === 'micro') callouts(side);
}
// more to read in the text card: a fade and "Scroll for more" just above the buttons, until the end is reached
function scrollCue() {
  const c = $('#cap'), can = c.scrollHeight > c.clientHeight + 4 && c.scrollTop + c.clientHeight < c.scrollHeight - 8;
  if (c.classList.contains('can-scroll') !== can) c.classList.toggle('can-scroll', can);
}
$('#cap').addEventListener('scroll', scrollCue, { passive: true });
{ const ro = new ResizeObserver(() => requestAnimationFrame(fitCap));
  ['#film', '#micro', '#micro2', '#emfig', '.cap__more'].forEach(sel => ro.observe($(sel)));
  $$('.micro__img img').forEach(im => im.addEventListener('load', () => requestAnimationFrame(fitCap))); }
// a press on the text gives it the whole column (the photograph shrinks to its heading); a press on the heading brings
// the photograph back
$('#cap').addEventListener('click', e => {
  if (e.target.closest('button, a, summary, details, figure') || zoom.classList.contains('text-first')) return;
  if (!$('#cap').classList.contains('can-scroll') && $('#capMore').hidden) return;     // (it all shows already)
  zoom.classList.add('text-first'); fitCap();
});
// a press on a slide shows it as big as the screen allows, over a darkened picture; a press anywhere (or Esc) puts it
// back (Daniel, 4 Oct: "if I click on the image, it should make the whole image huge")
function bigSlide(f, big) {
  $$('.micro.is-big').forEach(x => x.classList.remove('is-big'));
  if (f) f.classList.toggle('is-big', big);
  zoom.classList.toggle('pic-big', !!f && big); if (cell) cell.pause(!!f && big); fitCap();
}
$$('.micro').forEach(f => f.addEventListener('click', e => {
  e.stopPropagation();
  if (zoom.classList.contains('text-first')) { zoom.classList.remove('text-first'); fitCap(); return; }
  if (zoom.clientWidth < 760) return;                                   // (a phone: the slide stays as it is)
  bigSlide(f, !f.classList.contains('is-big'));
}));
zoom.addEventListener('click', () => { if (zoom.classList.contains('pic-big')) bigSlide(null, false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && zoom.classList.contains('pic-big')) bigSlide(null, false); });

// ---------- the tap card ----------
function hideCard() { $('#tapcard').hidden = true; }
function showCard(p) {
  if (!p.part) { hideCard(); return; }
  const info = INFO[p.part] || {}, part = PARTS[p.part] || {};
  const card = $('#tapcard');
  $('.tapcard__name', card).textContent = cap(p.part === 'molecule' && p.label ? p.label : (info.name || part.name || p.part));
  const badge = $('.tapcard__badge', card);
  badge.textContent = p.part === 'molecule' ? 'A model: real shape and size' : info.syl ? 'Named in your syllabus' : 'Not named in your syllabus';
  badge.className = 'tapcard__badge ' + (info.syl && p.part !== 'molecule' ? 'is-syl' : 'is-beyond');
  $('.tapcard__does', card).textContent = info.does || '';
  $('.tapcard__does', card).hidden = !info.does;
  $('.tapcard__size', card).textContent = info.size || '';
  $('.tapcard__size', card).hidden = !info.size;
  card.style.setProperty('--c', '#' + (part.col != null ? part.col.toString(16).padStart(6, '0') : '888888'));
  card.hidden = false;
  const W = zoom.clientWidth, H = zoom.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
  const cb = $('#cap').getBoundingClientRect(), narrow = W < 760;
  const right = narrow ? W : cb.left, bottom = narrow ? cb.top : H;      // the card keeps clear of the caption
  let x = p.x + 16, y = p.y - ch / 2;
  if (x + cw > right - 12) x = p.x - cw - 16;
  x = Math.max(12, Math.min(right - cw - 12, x)); y = Math.max(70, Math.min(bottom - ch - 10, y));
  card.style.left = x + 'px'; card.style.top = y + 'px';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- moving between levels ----------
async function go(to) {
  if (busy || !cell || to === cell.level || zoom.classList.contains('is-loading')) return;
  busy = true;
  $$('.cap button, .stop').forEach(b => { b.disabled = true; });
  hideCard();
  try { await cell.goTo(to); } catch (e) { console.error(e); }
  setLevelUI(cell.level);
  busy = false;
  $$('.cap button, .stop').forEach(b => { b.disabled = false; });
}
const fmt = n => Math.round(n).toLocaleString('en-GB');
function fillCounts() {
  if (!cell || !cell.counts) return;
  $$('[data-count]').forEach(b => {
    const k = b.dataset.count, c = cell.counts;
    if (c[k] != null) b.textContent = k === 'microtubuleUm' ? fmt(c[k]) + ' µm' : fmt(c[k]);
  });
}

async function start() {
  drawRuler();
  $('#btnGo').addEventListener('click', () => { const i = LEVELS.indexOf(cell.level); go(i < LEVELS.length - 1 ? LEVELS[i + 1] : LEVELS[0]); });
  $('#btnBack').addEventListener('click', () => { const i = LEVELS.indexOf(cell.level); if (i > 0) go(LEVELS[i - 1]); });
  $$('.stop').forEach(b => b.addEventListener('click', () => go(b.dataset.level)));
  $('.tapcard__x').addEventListener('click', hideCard);
  $('#aboutBtn').addEventListener('click', () => $('#about').showModal());
  $('#topicsBtn').addEventListener('click', () => openTopics());
  $('#topicsClose').addEventListener('click', () => $('#topics').close());
  $('#aboutClose').addEventListener('click', () => $('#about').close());
  $('#sylSwitch').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    BEYOND.forEach(p => cell.setShown(p, !on));
    hideCard();
  });
  try {
    const Q = new URLSearchParams(location.search);
    cell = await mount(gl, { v: '1791108252', test: Q.get('test') === '1',
      samples: Q.has('msaa') ? Number(Q.get('msaa')) : undefined, dprCap: Q.has('dpr') ? Number(Q.get('dpr')) : undefined, depthUint: Q.get('depth') === 'u', notags: Q.get('notags') === '1' });
  } catch (e) {
    console.error(e);
    $('#loading').hidden = true; $('#nogl').hidden = false;
    return;
  }
  window.cell = cell;
  setLevelUI('organism');
  // The page waits until every level is downloaded and ready to draw: nothing can be pressed or scrolled until then
  // (at most 60 s: then it opens anyway, and what is missing loads as the reader reaches it)
  cell.on('loadstage', st => {
    $('#loadText').textContent = st.k < st.n ? 'Getting ' + st.label + ' ready (' + (st.k + 1) + ' of ' + st.n + ')' : 'Ready';
    $('#loadBar').style.width = Math.round(st.k / st.n * 100) + '%';
  });
  await Promise.race([cell.allReady.catch(e => console.error(e)), new Promise(r => setTimeout(r, 60000))]);
  $('#loadBar').style.width = '100%';
  zoom.classList.remove('is-loading');
  $('#loading').classList.add('is-done');
  // scrolling moves through the levels by itself: the caption follows the level nearest the view
  cell.on('level', l => { if (!busy) setLevelUI(l); else { $('#capLevel').textContent = SAID_SHORT[l]; setMore(false); $('#cap').scrollTop = 0; } })
    .on('pick', showCard)
    .on('hover', showTip)
    .on('z', z => {
      // the real thing beside the model: the light micrograph at the tissue, the electron micrograph among the organelles
      // (each stays for a good stretch of the zoom, and says what it is before it appears: .is-in)
      const m = z > 2.86 && z <= 3.27, m2 = z > 3.27 && z < 3.58, e = z > 4.62 && z < 5.38;
      if ($('#micro').hidden === m || $('#micro2').hidden === m2 || $('#emfig').hidden === e) {
        for (const [f, on] of [[$('#micro'), m], [$('#micro2'), m2], [$('#emfig'), e]]) {
          if (f.hidden !== on) continue;
          f.hidden = !on; f.classList.remove('is-in');
          if (on) requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('is-in')));
        }
        if (!$('#micro2').hidden) fitPins($('#micro2'));
        if (!$('#micro').hidden) requestAnimationFrame(() => callouts($('#micro')));
        // the film and the micrograph share the top right: the film steps aside
        if (e) { video.pause(); $('#film').hidden = true; }
        fitCap();
      }
      // the film's button, whenever the film has been seen, is closed, and the reader is at the cell or below (checked at
      // every step: checked only when a photograph came or went, it never came back after going back up and in again)
      const pill = filmPlayed && z >= 3.5 && !e && $('#film').hidden;
      if ($('#filmPill').hidden === pill) $('#filmPill').hidden = !pill;
    })
    .on('scale', s => {
      const sb = $('#scalebar'); $('i', sb).style.width = Math.round(s.px) + 'px'; $('span', sb).textContent = s.label;
      // the ruler's marker follows the real width of the view
      if (!busy) setNow(zoom.clientWidth / s.px * s.um * 1e-6);
    });
  // the film plays by itself the first time the reader reaches the cell; coming back to the cell, it is there again,
  // paused where it was (Daniel, 4 Oct: after going back and in again, the film had gone)
  cell.on('arrive', l => {
    if (l !== 'cell') return;
    if (!filmPlayed) { filmPlayed = true; playFilm(true); }
    else if ($('#film').hidden) { $('#film').hidden = false; $('#filmPill').hidden = true; fitCap(); }
  });
  // (the organelles' file is the biggest: its own progress fills the bar between steps 3 and 4)
  cell.on('progress', f => { if (zoom.classList.contains('is-loading')) $('#loadBar').style.width = Math.round((2 + f) / 5 * 100) + '%'; });
  cell.insideReady.then(fillCounts);
}
start();
