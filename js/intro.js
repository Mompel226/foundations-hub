/* Foundations, the shelf for topics 2–5: the zoom. The 3D picture (js/cell3d.js) fills the screen; the size ruler on the
   left shows how big the view is; the caption says what each level is, in the words the exam uses.
   Each level waits for the reader: nothing moves on until a button is pressed. The film of Eric Betzig
   appears, and plays, only when the reader reaches the cell. */
import { mount, PARTS, LEVELS } from './cell3d.js?v=1791026551';

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
  pelvis:    { syl: false, does: 'The hip bones: they protect the organs of the lower abdomen.', size: '' },
  tissue:    { syl: true,  does: 'A group of cells with similar structures, working together to perform a shared function.', size: '' },
  cell:      { syl: true,  name: 'cell membrane', does: 'Controls the movement of substances into and out of the cell.',
               size: 'This cell is about 6 µm high and spreads more than 48 µm across the sapphire disc.' },
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
    more: '<ul class="chips"><li><b>1.7 m</b><span>her height</span></li><li><b>30 million million</b><span>about how many cells a body has</span></li><li><b>7</b><span>levels, from her body to its molecules</span></li></ul><p class="hint">Drag to turn the body. The ruler on the left shows how big the view is.</p>',
    go: 'an organ system', mag: '× 8' },
  system: {
    def: '<b>Organ system</b>: a group of organs with related functions, working together to perform body functions.',
    here: 'Her reproductive system: the ovaries, the oviducts, the uterus, the cervix and the vagina.',
    more: '<p class="hint">Tap an organ to see what it does. Drag to turn.</p>',
    go: 'an organ', mag: '× 2.5' },
  organ: {
    def: '<b>Organ</b>: a structure made up of a group of tissues, working together to perform specific functions.',
    here: 'The uterus. Its wall is mostly muscle tissue, with a lining inside. Its narrow lower part is the cervix (orange).',
    more: '<p>Next, you go into the lining of the cervix.</p><p class="hint">Tap a part to see what it does. Drag to turn.</p>',
    go: 'a tissue', mag: '× 160' },
  tissue: {
    def: '<b>Tissue</b>: a group of cells with similar structures, working together to perform a shared function.',
    here: 'The lining of the cervix: one layer of tall cells that make mucus. Each dark purple shape is the nucleus of one cell.',
    more: '<p>Lower down is a gland, lined by the same kind of cell.</p><p class="hint">Two real photographs through a light microscope; the stain colours the cells pink and purple. The view is about 0.5 mm across (worked out from the size of the nuclei: the photographs have no scale bar).</p>',
    go: 'one cell', mag: '× 10' },
  cell: {
    def: '<b>Cell</b>: the basic unit of every living organism.',
    here: 'One real HeLa cell, frozen and photographed in 3D by an electron microscope.',
    more: '<p>In 1951, cells like those in the lining of the cervix were taken from a cancer of a woman called <b>Henrietta Lacks</b>, without asking her. They still divide in laboratories today, and are called <b>HeLa cells</b>.</p>' +
      '<p>This one grew flat on a sapphire disc. Scientists froze it very fast, then set it in hard resin. A beam of ions removed a layer about 5 nanometres thick, and an electron microscope photographed the new surface. This was repeated more than 6,000 times, and a computer found every part of the cell.</p>' +
      '<ul class="chips"><li><b>48 µm</b><span>width of the block imaged</span></li><li><b>6 µm</b><span>height of the cell</span></li><li><b>21 µm</b><span>length of its nucleus</span></li></ul>' +
      '<p><b>On the picture: Eric Betzig</b>, Nobel Prize in Chemistry 2014, for microscopes that see single molecules in living cells. Listen to what he says about the pictures of cells in biology books.</p>' +
      '<details class="words"><summary>Read what he says</summary><p>“Almost everything you learn in biology textbooks is a hallucination. You guys have probably seen on the web: here’s a cargo on a kinesin walking along a microtubule like this. And it’s all in this vast empty space. I don’t know any cell that’s a bunch of vast empty space. I’m sorry, it’s crowded […]. There’s a hundred trillion water molecules in every cell. There’s ten billion protein molecules. There’s ten billion carbohydrates. There’s ten billion… It’s by far the most complex matter in the known universe. We understand the interiors of neutron stars far better than we understand the interior of cells. There’s a reason why only 9% of the drugs that enter phase one come out of phase three: because we don’t know what […] we’re doing. We don’t know the real mechanisms that are going on. And when you start to […] look at the dynamics, not just the structure, you realise that you had it all wrong. And you realise that so many of the things that they thought they knew, you can’t be sure that they know. We have to reinvestigate all of it.”</p></details>' +
      '<p class="hint">From the <a href="https://www.youtube.com/watch?v=RUB37QhWNkw" target="_blank" rel="noopener">632nm podcast, episode 61</a>. Three swear words are silenced. Drag to turn the cell; the white box shows where you go next.</p>',
    go: 'the organelles', mag: '× 7' },
  inside: {
    def: '<b>Organelles</b>: the parts inside a cell. Each one here is at its real size and in its real place.',
    here: 'You are in the cytoplasm, under the nucleus, by the two centrioles. It is crowded.',
    more: '<p>In this box, 7.5 µm across, the microscope found:</p><ul class="chips"><li><b data-count="ribosomes">257,653</b><span>ribosomes</span></li><li><b data-count="vesicles">12,853</b><span>vesicles</span></li><li><b data-count="pores">791</b><span>pores in the nucleus</span></li><li><b data-count="microtubuleUm">485 µm</b><span>of microtubules</span></li></ul>' +
      '<p>The dark space between them is <b>not empty</b>. It is cytoplasm, full of molecules too small to show here: about 140 million protein molecules, and about a million million water molecules, in this box alone.</p>' +
      '<p class="hint">Drag to look around. Scroll, or pinch, to move. Tap any part to see its name. Your syllabus names only some of these parts: press “Only the syllabus parts” to see the difference.</p>',
    go: 'the molecules', mag: '× 50' },
  molecules: {
    def: '<b>Molecules</b>: a model of the cytoplasm, with every protein drawn at its real shape and size.',
    here: 'A motor protein, kinesin, walks along a microtubule and pulls a vesicle, 8 nm a step. There is no empty space around it.',
    more: '<p>This is a <b>model</b>, not a measurement: no microscope can yet show every molecule in a whole cell. It uses the real shape of each kind of protein (Protein Data Bank) and how many of each kind a HeLa cell holds.</p>' +
      '<p>It is shown as a slice 70 nm thick: the molecules in front of the microtubule are left out, so that you can see it.</p>' +
      '<p>Kinesin really takes about 100 steps every second; here it takes one. In the time of one real step, the molecules around it move hundreds of nanometres: at that speed they would be a blur, so here they move only when the vesicle reaches them.</p>' +
      '<p class="hint">Drag to turn. Tap a molecule to see what it is.</p>',
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
  $$('.stop').forEach(b => { b.style.top = yOf(Number(b.dataset.m)) + '%'; });
  spreadLabels();
  drawTopicBrackets();
}

// ---------- the topics: each sits at the levels of the zoom it is about ----------
const TOPICS = window.TOPICS || [], EXTRAS = window.EXTRAS || [];
const levelM = l => Number($('.stop[data-level="' + l + '"]').dataset.m);
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
    const a = yOf(levelM(g.levels[0])), b = yOf(levelM(g.levels[g.levels.length - 1]));
    const top = Math.min(a, b) - (a === b ? 2.2 : 0.8), h = Math.abs(b - a) + (a === b ? 4.4 : 1.6);
    const nos = g.topics.map(t => t.no).join(' · ');
    const names = g.topics.map(t => 'Topic ' + t.no + ', ' + t.title).join('; ');
    return `<button class="bracket" type="button" data-no="${g.topics[0].no}" style="top:${top}%;height:${h}%;--x:${i === 1 ? 12 : 0}px" aria-label="${names}"><span>${nos}</span></button>`;
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
// two levels close in size (an organ system and an organ) keep their dots at their true sizes, but their
// names are moved apart so that they never sit on top of each other
function spreadLabels() {
  const stops = $$('.stop'), H = $('#ruler').clientHeight || 1, gap = 19;
  const ys = stops.map(b => yOf(Number(b.dataset.m)) / 100 * H);
  const shift = ys.map(() => 0);
  for (let i = 1; i < ys.length; i++) {
    const d = (ys[i] + shift[i]) - (ys[i - 1] + shift[i - 1]);
    if (d < gap) { shift[i - 1] -= (gap - d) / 2; shift[i] += (gap - d) / 2; }
  }
  stops.forEach((b, i) => { $('b', b).style.transform = shift[i] ? 'translateY(' + shift[i].toFixed(1) + 'px)' : ''; });
}
window.addEventListener('resize', () => spreadLabels());
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
  setNow(Number($('.stop[data-level="' + level + '"]').dataset.m));
  hideCard();
  const below = i >= LEVELS.indexOf('cell');
  if (!below) { video.pause(); $('#film').hidden = true; $('#filmPill').hidden = true; }
  zoom.style.setProperty('--caph', $('#cap').offsetHeight + 'px');
  inset();
}
// tell the picture how much of the screen the ruler and the caption take
function inset() {
  if (!cell) return;
  const narrow = zoom.clientWidth < 760;
  const capBox = $('#cap').getBoundingClientRect();
  cell.setInset({ left: narrow ? 30 : 210, right: 0, top: narrow ? 60 : 70, bottom: zoom.clientHeight - capBox.top + 8 });
}
window.addEventListener('resize', () => inset());
function setMore(open) {
  $('#capMore').hidden = !open;
  $('#btnMore').setAttribute('aria-expanded', String(open));
  $('#btnMore').textContent = open ? 'Less' : 'More';
  zoom.style.setProperty('--caph', $('#cap').offsetHeight + 'px');
}
$('#btnMore').addEventListener('click', () => setMore($('#capMore').hidden));

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
  $('#film').hidden = false; $('#filmPill').hidden = true;
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
  const capTop = $('#cap').getBoundingClientRect().top;
  let x = p.x + 16, y = p.y - ch / 2;
  if (x + cw > W - 12) x = p.x - cw - 16;
  x = Math.max(12, Math.min(W - cw - 12, x)); y = Math.max(70, Math.min(capTop - ch - 10, y));
  card.style.left = x + 'px'; card.style.top = y + 'px';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- moving between levels ----------
async function go(to) {
  if (busy || !cell || to === cell.level) return;
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
    cell = await mount(gl, { v: '1791026551', test: Q.get('test') === '1',
      samples: Q.has('msaa') ? Number(Q.get('msaa')) : undefined, dprCap: Q.has('dpr') ? Number(Q.get('dpr')) : undefined, depthUint: Q.get('depth') === 'u' });
  } catch (e) {
    console.error(e);
    $('#loading').hidden = true; $('#nogl').hidden = false;
    return;
  }
  window.cell = cell;
  $('#loading').classList.add('is-done');
  setLevelUI('organism');
  cell.on('level', l => { $('#capLevel').textContent = SAID_SHORT[l]; setNow(Number($('.stop[data-level="' + l + '"]').dataset.m)); })
    .on('pick', showCard)
    .on('scale', s => {
      const sb = $('#scalebar'); $('i', sb).style.width = Math.round(s.px) + 'px'; $('span', sb).textContent = s.label;
      // the ruler's marker follows the real width of the view
      if (!busy) setNow(zoom.clientWidth / s.px * s.um * 1e-6);
    });
  cell.on('arrive', l => { if (l === 'cell' && !filmPlayed) { filmPlayed = true; playFilm(true); } });
  cell.on('progress', f => { $('#loadBar').style.width = Math.round(f * 100) + '%'; });
  cell.insideReady.then(fillCounts);
}
start();
