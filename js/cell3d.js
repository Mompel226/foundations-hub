/* Foundations, the shelf for topics 2–5: a zoom from a whole human down to the molecules of one real cell.

   The seven levels of Topic 2's ladder, one scene:
     organism   a real woman's body                     assets/body/anatomy.glb   HuBMAP Human Reference Atlas,
     system     her reproductive system                                            United Female v1.10 (Visible
     organ      the uterus and its cervix, cut open      assets/body/section.*      Human Female, NLM), CC BY 4.0
     tissue     a model of the lining of the cervix      js/tissue3d.js (sizes measured on M. Häggström's micrographs)
     cell       one real HeLa cell, whole                assets/cell/whole.glb
     inside     the organelles round its centrosome      assets/cell/organelles.glb + small.bin
     molecules  a model of 0.15 µm of cytoplasm          js/molecules3d.js, loaded only when asked for
   The cell: Janelia Research Campus, FIB-SEM (Xu et al. 2021, Nature 599:147), organelles found by Heinrich
   et al. 2021 (Nature 599:141); OpenOrganelle jrc_hela-2, CC BY 4.0. Meshes made by tools/model-build/.

   ONE ZOOM, NO JUMPS. Everything is drawn in micrometres, in one frame: the tissue's (its origin is the point on
   the lining of the cervix's canal where the zoom dives in; +y out of the lining). The body is scaled a million
   times and turned to fit round it; the HeLa cell sits where one lining cell is; the organelles sit in the cell.
   The reader's place in the zoom is one number, Z: 0 organism, 1 organ system ... 6 molecules. Scrolling moves Z,
   so does every button; everything that is shown (which level fades in, the knife that opens the organ, the haze)
   follows from Z (stateAt), and the camera follows the path between the two levels on either side of Z. Coming
   back out is the same path, backwards.

   mount(el, opts) -> controller (see the return at the end).
*/
import * as THREE from './vendor/three/build/three.module.min.js?v=0.185.1';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js?v=0.185.1';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js?v=0.185.1';
import { MeshoptDecoder } from './vendor/three/examples/jsm/libs/meshopt_decoder.module.js?v=0.185.1';
import { mergeVertices } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js?v=0.185.1';
import { build as buildTissue } from './tissue3d.js?v=1791035616';

export const LEVELS = ['organism', 'system', 'organ', 'tissue', 'cell', 'inside', 'molecules'];
const GROUP = { organism: 'body', system: 'body', organ: 'body', tissue: 'tissue', cell: 'cell', inside: 'inside', molecules: 'mol' };
const FRAME = { body: 'body', tissue: 'tissue', single: 'tissue', cell: 'cell', inside: 'cell', mol: 'mol' };
const SCALE = { body: 1e6, tissue: 1, cell: 1, mol: 1 };          // µm in one unit of each frame

// Colours are a choice: most of these structures are smaller than the wavelength of light. The same thing keeps
// its colour at every level: the nucleus is the same violet in the tissue, the cell and the organelles; the cells of
// the lining and the HeLa cell are the same pale lilac; the uterus is the pink of its muscle and the cervix the
// pale pink of its connective tissue, as their cut faces show.
export const PARTS = {
  body:      { name: 'the body (her skin)', col: 0xb9cfdd },
  hip:       { name: 'hip bone', col: 0xb9b2a2 },
  sacrum:    { name: 'sacrum', col: 0xb9b2a2 },
  coccyx:    { name: 'coccyx (tail bone)', col: 0xb9b2a2 },
  vertebrae: { name: 'lumbar vertebrae (backbone)', col: 0xb9b2a2 },
  femur:     { name: 'femur (thigh bone)', col: 0xb9b2a2 },
  bladder:   { name: 'bladder', col: 0xd8b85a },
  rectum:    { name: 'rectum', col: 0xa98063 },
  vagina:    { name: 'vagina', col: 0xc77d98 },
  uterus:    { name: 'uterus', col: 0xc8566f },
  cervix:    { name: 'cervix', col: 0xebb0c3 },
  oviduct:   { name: 'oviduct', col: 0xe58fa0 },
  ovary:     { name: 'ovary', col: 0xf1c34f },
  muscle:    { name: 'muscle tissue', col: 0xc2566f },
  lining_u:  { name: 'lining of the uterus', col: 0x9c5fa8 },
  connective:{ name: 'connective tissue', col: 0xebb0c3 },
  lining_c:  { name: 'lining of the cervix', col: 0x6a3f9c },
  cover:     { name: 'outer covering', col: 0xf4d6df },
  canal:     { name: 'canal of the cervix', col: 0x3b2742 },
  tcell:     { name: 'lining cell', col: 0xd9b3cc },
  tnucleus:  { name: 'nucleus', col: 0x5b4bb5 },
  capillary: { name: 'blood capillary', col: 0xd9364c },
  crypt:     { name: 'crypt', col: 0x6a3f9c },
  cell:      { name: 'cell membrane', col: 0xe2c6dd },
  membrane:  { name: 'cell membrane', col: 0xe2c6dd },
  nucleus:   { name: 'nucleus', col: 0x5b4bb5 },
  nucleolus: { name: 'nucleolus', col: 0x2b3a86 },
  er:        { name: 'endoplasmic reticulum', col: 0x2fa38c },
  golgi:     { name: 'Golgi apparatus', col: 0xe3a72f },
  mito:      { name: 'mitochondrion', col: 0xe8613a },
  endo:      { name: 'endosome', col: 0xb898c8 },
  lyso:      { name: 'lysosome', col: 0xd1497b },
  sacs:      { name: 'lysosomes and endosomes', col: 0xd1497b },
  ld:        { name: 'lipid droplet', col: 0xf3e6a1 },
  vesicle:   { name: 'vesicle', col: 0xe9dcc0 },
  ribo:      { name: 'ribosome', col: 0x6a46a8 },
  mt:        { name: 'microtubule', col: 0x9fe7f5 },
  npore:     { name: 'nuclear pore', col: 0xf08a7a },
  centriole: { name: 'centriole', col: 0xb9d36a },
  cytoplasm: { name: 'cytoplasm', col: 0x8a7f99 },
  emslice:   { name: 'the slice in the photograph', col: 0x8fe3c8 },
  molecule:  { name: 'a molecule', col: 0x9aa7b3 },
};
const BONES = new Set(['hip', 'sacrum', 'coccyx', 'vertebrae', 'femur']);
const BODY_PART = { skin: 'body', tubes: 'oviduct', ovaries: 'ovary' };
// How see-through each body part is at the three body levels (1 = solid)
const BODY_LOOK = {
  organism: { skin: 1.0, bones: 0.0, bladder: 0.0, rectum: 0.0, vagina: 1, uterus: 1, cervix: 1, tubes: 1, ovaries: 1 },
  system:   { skin: 0.16, bones: 0.10, bladder: 0.18, rectum: 0.18, vagina: 1, uterus: 1, cervix: 1, tubes: 1, ovaries: 1 },
  organ:    { skin: 0.0, bones: 0.05, bladder: 0.08, rectum: 0.08, vagina: 0.30, uterus: 1, cervix: 1, tubes: 0.35, ovaries: 0.35 },
};

const FOG = 0x1d2733, CYTO = 0x3a3550;   // the background outside cells, and the haze of the cytoplasm
// How each level is drawn, in its own frame's units: haze per unit, ambient-occlusion radius and strength, outlines.
const LOOK = {
  organism:  { fog: 0.0,   aoRadius: 0.03,  ao: 0.6, edge: 0.5 },
  system:    { fog: 0.0,   aoRadius: 0.006, ao: 0.8, edge: 0.8 },
  organ:     { fog: 0.0,   aoRadius: 0.002, ao: 0.8, edge: 0.9 },
  tissue:    { fog: 0.0,   aoRadius: 5,     ao: 0.8, edge: 0.7 },
  cell:      { fog: 0.010, aoRadius: 0.9,   ao: 0.9, edge: 0.7 },
  inside:    { fog: 0.55,  aoRadius: 0.06,  ao: 1.0, edge: 1.0 },
  molecules: { fog: 2.2,   aoRadius: 0.005, ao: 1.0, edge: 0.6 },
};
const RANGE = { organism: [0.01, 30], system: [0.002, 6], organ: [0.0004, 2], tissue: [0.6, 9000], cell: [0.05, 200], inside: [0.004, 9], molecules: [0.0004, 0.9] };
// Where each level's camera stands, in its frame's units (body: metres; tissue, cell: µm)
export const VIEWS = {
  organism:  { pos: [0.95, 0.32, 2.15], at: [0, 0.04, -0.05], orbit: [1.1, 3.6] },
  system:    { pos: [0.15, 0.21, 0.24], at: [-0.012, 0.052, -0.05], orbit: [0.16, 0.9] },
  organ:     { pos: [0.078, 0.052, -0.012], at: [-0.0105, 0.031, -0.057], orbit: [0.04, 0.3] },
  tissue:    { pos: [170, 110, 930], at: [0, -270, -30], orbit: [180, 2400] },
  cell:      { pos: [30, 26, 34], at: [-1, 1.5, -1], orbit: [12, 85] },
  inside:    { pos: [-0.248, 1.104, -0.826], at: [0.55, 1.42, -1.1] },
  molecules: { pos: [0.0, 0.03, 0.17], at: [-0.01, 0.03, 0.0] },
};
const BOX = { lo: [-3.75, 0.0, -4.65], hi: [3.75, 4.2, 2.85] };   // the detailed region (build_meshes.SCENE_UM), cell frame
const SECONDS = [4, 5, 15, 8, 12, 6];                             // each step down, when a button is pressed
// how much scrolling each step takes (1 = the usual): organ to tissue magnifies 160 times and grows the tissue out
// of the cut face, so it is given more (Daniel: "make the movement from organ to tissue slower")
const STEP_LEN = [1, 1, 2.4, 1.2, 1.4, 1];

const sm = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function mount(el, opts = {}) {
  const W = () => Math.max(1, el.clientWidth), H = () => Math.max(1, el.clientHeight);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.test });
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, opts.dprCap || (coarse ? 1.5 : 2));
  renderer.setPixelRatio(dpr);
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.localClippingEnabled = true;
  el.appendChild(renderer.domElement);
  const cv = renderer.domElement;
  cv.style.touchAction = 'none';
  cv.style.display = 'block';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 1e4, 3e7);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xf2f4ff, 0x4a4038, 1.6));
  const head = new THREE.DirectionalLight(0xffffff, 1.4); head.position.set(0.3, 0.4, 1); camera.add(head);
  // Smoothing of edges (multisampling) only where pixels are big: on a Retina screen the pixels are already half
  // the size, and 4 samples there halved the frame rate while the zoom moved (tools/model-build/perf.mjs)
  const post = makePost(renderer, { ...LOOK.organism, fogColor: FOG, samples: opts.samples ?? (dpr >= 1.75 ? 0 : 4), depthUint: !!opts.depthUint });
  post.setSize(W(), H(), dpr);

  const G = { body: new THREE.Group(), tissue: new THREE.Group(), single: new THREE.Group(), cell: new THREE.Group(), inside: new THREE.Group(), mol: new THREE.Group() };
  Object.values(G).forEach(g => { g.visible = false; g.matrixAutoUpdate = false; scene.add(g); });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const v = opts.v || '1';
  const listeners = { level: [], pick: [], hover: [], scale: [], progress: [], arrive: [], z: [] };
  const emit = (k, x) => listeners[k].forEach(f => f(x));
  const groups = {}, counts = {}, bodyMat = {}, anchors = [];
  let molApi = null;

  // ---------- the frames ----------
  const [body, SEC] = await Promise.all([
    loader.loadAsync('assets/body/anatomy.glb?v=' + v),
    fetch('assets/body/section.json?v=' + v).then(r => r.json()),
  ]);
  // body (metres) -> tissue frame (µm): the dive point to the origin, the lining's normal to +y, the cut face's
  // normal (+x of the body, towards the reader) to +z
  const P = { tissue: new THREE.Matrix4(), cell: new THREE.Matrix4(), mol: new THREE.Matrix4(), body: new THREE.Matrix4() };
  {
    const e = new THREE.Vector3(1, 0, 0), n = new THREE.Vector3().fromArray(SEC.normal).normalize(), t = new THREE.Vector3().crossVectors(n, e);
    const R = new THREE.Matrix4().makeBasis(t, n, e).transpose();
    P.body.makeTranslation(-SEC.dive[0], -SEC.dive[1], -SEC.dive[2]).premultiply(R).premultiply(new THREE.Matrix4().makeScale(1e6, 1e6, 1e6));
  }
  const Wm = new THREE.Matrix4();                 // the world from the tissue frame: moved only for the molecules
  const F = f => new THREE.Matrix4().multiplyMatrices(Wm, P[f]);
  const W3 = (f, p) => new THREE.Vector3().fromArray(p).applyMatrix4(F(f));
  const levelFrame = l => FRAME[GROUP[l]];
  const upOf = l => new THREE.Vector3(0, 1, 0).transformDirection(F(levelFrame(l)));
  const sc = l => SCALE[levelFrame(l)];
  function placeGroups() {
    for (const k in G) { G[k].matrix.copy(F(FRAME[k])); G[k].matrixWorldNeedsUpdate = true; }
    updateClips();
  }

  // ---------- levels 1-3: the body ----------
  body.scene.updateMatrixWorld(true);
  const bodyParts = {};
  body.scene.traverse(o => {
    if (!o.isMesh) return;
    const id = o.name.replace(/^a_/, '').replace(/_\d+$/, '');
    const part = BODY_PART[id] || id;
    o.userData.part = part; o.userData.bodyId = id;
    o.material = id === 'skin' ? glassMaterial(PARTS.body.col)
      : new THREE.MeshLambertMaterial({ color: PARTS[part].col, transparent: true, side: THREE.DoubleSide });
    bodyMat[id] = o.material;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    o.renderOrder = id === 'skin' ? 3 : 1;
    bodyParts[id] = o;
  });
  G.body.add(body.scene);
  // the cut face of the uterus and cervix (tools/model-build/build_section.py), just in front of the cut
  const sectionTex = await new THREE.TextureLoader().loadAsync('assets/body/section.webp?v=' + v);
  sectionTex.colorSpace = THREE.SRGBColorSpace; sectionTex.anisotropy = 8;
  const capGeo = new THREE.BufferGeometry();
  const cc = SEC.corners.map(p => [p[0] + 2e-5, p[1], p[2]]);
  capGeo.setAttribute('position', new THREE.Float32BufferAttribute([...cc[0], ...cc[1], ...cc[2], ...cc[3]], 3));
  capGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  capGeo.setIndex([0, 3, 1, 1, 3, 2]); capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({ map: sectionTex, alphaTest: 0.5, side: THREE.DoubleSide }));
  cap.userData.part = 'section'; cap.renderOrder = 2;
  G.body.add(cap);
  // which tissue each point of the cut face is (for naming what the pointer is on)
  const secMap = await new Promise(res => {
    const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data });
    }; im.onerror = () => res(null); im.src = 'assets/body/section-map.png?v=' + v;
  });
  const SEC_PART = [null, 'muscle', 'lining_u', 'connective', 'lining_c', 'cover', 'canal'];
  // the knife: everything of the body on the reader's side of the cut is clipped away (not the skin: it has gone)
  const knife = new THREE.Plane();
  let knifeOff = 1;                              // metres beyond the cut; 1 = no cut
  // (always on, parked a metre away when there is no cut: switching it off and on would rebuild the shaders)
  for (const id in bodyMat) if (id !== 'skin') bodyMat[id].clippingPlanes = [knife];
  function setKnife(off) {
    knifeOff = off;
    knife.set(new THREE.Vector3(-1, 0, 0), SEC.x + off).applyMatrix4(F('body'));
  }
  function bodyLook(a, b, k, fade) {      // see-through-ness between two body levels, k from 0 (a) to 1 (b)
    for (const id in bodyMat) {
      const key = BONES.has(id) ? 'bones' : id;
      const x = THREE.MathUtils.lerp(BODY_LOOK[a][key], BODY_LOOK[b][key], k) * fade;
      const m = bodyMat[id];
      if (m.uniforms) m.uniforms.uOpacity.value = x; else { m.opacity = x; m.depthWrite = x > 0.95; }
      m.visible = x > 0.004;
    }
  }
  // where the organs are named: a point ON each organ's surface (the one nearest the middle of its points), never
  // the middle of its box, which for a curled oviduct is empty space beside it; the two ovaries and the two
  // oviducts each on their own
  {
    const organ = (id, text, side, z) => {
      const o = bodyParts[id], p = o.geometry.attributes.position, q = new THREE.Vector3(), pts = [];
      const b = new THREE.Box3(), mid = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        q.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (side == null || Math.sign(q.x - SEC.x) === side) { pts.push(q.clone()); b.expandByPoint(q); mid.add(q); }
      }
      mid.divideScalar(Math.max(1, pts.length));
      let best = pts[0], bd = Infinity;
      for (const v of pts) { const d = v.distanceToSquared(mid); if (d < bd) { bd = d; best = v; } }
      // more places on it, spread out (each the farthest from those already chosen): from any side, one can be seen
      const cands = [best];
      for (let k = 0; k < 9; k++) {
        let far = null, fd = -1;
        for (let i = 0; i < pts.length; i += 3) { let d = Infinity; for (const c of cands) d = Math.min(d, pts[i].distanceToSquared(c)); if (d > fd) { fd = d; far = pts[i]; } }
        cands.push(far);
      }
      const s = b.getSize(new THREE.Vector3());
      anchors.push({ group: 'body', frame: 'body', p: best.toArray(), cands: cands.map(c => c.toArray()), r: Math.max(s.x, s.y, s.z) / 2, text, part: BODY_PART[id] || id, z, cut: side === 1 });
    };
    for (const sd of [-1, 1]) { organ('ovaries', 'Ovary', sd, [0.55, 2.4]); organ('tubes', 'Oviduct', sd, [0.55, 2.4]); }
    organ('uterus', 'Uterus', null, [0.55, 1.88]); organ('cervix', 'Cervix', null, [0.55, 1.75]); organ('vagina', 'Vagina', null, [0.55, 1.75]);
    organ('bladder', 'Bladder', null, [0.75, 1.6]); organ('rectum', 'Rectum', null, [0.75, 1.6]);
    const L = SEC.labels;
    const face = (k, text, part) => anchors.push({ group: 'body', frame: 'body', p: [L[k][0] + 3e-5, L[k][1], L[k][2]], r: 0.004, text, part, z: [1.9, 2.75], face: true, accept: ['section'] });
    face('muscle', 'Uterus: muscle tissue', 'muscle'); face('lining_u', 'Lining of the uterus', 'lining_u');
    face('connective', 'Cervix: connective tissue', 'connective'); face('lining_c', 'Lining of the canal', 'lining_c');
  }

  // Several places on a mesh for one name, within `radius` of a point, spread out (each the farthest from those
  // already chosen); the name goes on one that can be seen (drawTags), so it stays on its part from any side.
  // a mesh's matrix in its level's own frame (the group's), whatever the group's place in the world is just now
  function localOf(o, g) { o.updateWorldMatrix(true, false); return g.matrixWorld.clone().invert().multiply(o.matrixWorld); }
  function spreadOn(o, g, toward, radius, k = 10) {
    const p = o.geometry.attributes.position, q = new THREE.Vector3(), t = new THREE.Vector3().fromArray(toward), near = [];
    const M = localOf(o, g);
    const step = Math.max(1, Math.floor(p.count / 40000));
    for (let i = 0; i < p.count; i += step) { q.fromBufferAttribute(p, i).applyMatrix4(M); if (q.distanceTo(t) < radius) near.push(q.clone()); }
    if (!near.length) return null;
    near.sort((a, b) => a.distanceToSquared(t) - b.distanceToSquared(t));
    const out = [near[0]];
    while (out.length < k) {
      let far = null, fd = -1;
      for (let i = 0; i < near.length; i += 2) { let d = Infinity; for (const c of out) d = Math.min(d, near[i].distanceToSquared(c)); if (d > fd) { fd = d; far = near[i]; } }
      if (!far || fd < 1e-12) break; out.push(far);
    }
    return out.map(v => v.toArray());
  }

  // ---------- level 4: the tissue, a model (js/tissue3d.js), built just after the first picture ----------
  let tissue = null, slideLine = null;
  // Its cut face is traced from the micrograph beside it (assets/tissue/trace.json).
  const LIFT = 45;                               // how far the lining cell rises out of the tissue, µm
  const tissueReady = new Promise(res => setTimeout(async () => {
    const trace = await fetch('assets/tissue/trace.json?v=' + v).then(r => r.json());
    tissue = buildTissue(THREE, G.tissue, trace);
    tissue.labels.forEach(a => anchors.push({ group: 'tissue', frame: 'tissue', p: a.p, cands: a.cands, r: a.r, text: a.text, part: a.part, z: [2.86, 3.3], free: !!a.free }));
    // the slice the photograph beside it shows is outlined on the block's cut face (tissue3d's frame)
    slideLine = { material: tissue.frameMat };
    // the one lining cell the zoom goes into has a group of its own: it lifts out of the tissue and spreads flat
    G.single.add(tissue.single); tissue.single.visible = true;
    const b = tissue.target.base;
    anchors.push({ group: 'single', frame: 'tissue', p: [b[0], b[1] + 20, b[2]], r: 12, text: 'One lining cell', part: 'tcell', z: [3.12, 3.4], free: true, dyn: 'single' });
    anchors.push({ group: 'single', frame: 'tissue', p: [b[0], b[1] + 20, b[2]], r: 12, text: 'Grown in a dish, a cell like this spreads flat', part: 'tcell', z: [3.42, 3.66], free: true, dyn: 'single' });
    // the HeLa cell sits where that cell has spread: the middle of its base on the middle of the lifted cell's base
    P.cell.makeTranslation(b[0] + 0.5, b[1] + LIFT, b[2] - 0.9);
    placeGroups(); lastState = null; stateAt(Z);
    precompile(G.tissue);
    res();
  }, 60));
  // the lining cell at a point of its lift (0 in the tissue, 1 out of it) and its spreading (0 tall, 1 flat), as a
  // dish makes it: about 45 µm across and 6 µm high, like the HeLa cell that takes its place
  const singleMatrix = (lift, flat) => {
    const t = tissue.target, m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    t.pose.decompose(pos, q, s);
    pos.y += LIFT * lift;
    q.slerp(new THREE.Quaternion(), lift);                              // it stands upright as it rises
    const wide = THREE.MathUtils.lerp(1, 6.2, flat), high = THREE.MathUtils.lerp(s.y, 6 / 30, flat);
    return m.compose(pos, q, new THREE.Vector3(wide, high, wide * 0.8));
  };
  let singleAt = [0, 0, 0];
  // As soon as a level's files are here, its shaders are made in the background and its shapes are sent to the
  // graphics card (drawn once, every part, into one hidden pixel), so that scrolling into it never stalls: the
  // first drawing of the organelles moves about 50 MB and held the screen for more than a second.
  const warmRT = new THREE.WebGLRenderTarget(1, 1), warmScene = new THREE.Scene();
  // the same kinds of light as the scene's, so the shaders made here are the ones used later
  warmScene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1), new THREE.DirectionalLight(0xffffff, 1));
  async function precompile(g) {
    const was = g.visible; g.visible = true;
    try { await renderer.compileAsync(g, camera, scene); } catch (e) { /* made when first drawn instead */ }
    g.visible = was;
    await new Promise(r => setTimeout(r, 30));
    const parent = g.parent, culled = [];
    g.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    const vis = g.visible; g.visible = true; warmScene.add(g);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(warmRT); renderer.render(warmScene, camera); renderer.setRenderTarget(prev);
    parent.add(g); g.visible = vis; culled.forEach(o => { o.frustumCulled = true; });
    wake();
  }

  // ---------- level 5: the whole cell ----------
  const clipOut = [], clipIn = [];             // the whole cell's organelles outside / inside the detailed box
  for (let i = 0; i < 6; i++) { clipOut.push(new THREE.Plane()); clipIn.push(new THREE.Plane()); }
  function updateClips() {
    const M = F('cell');
    const ax = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (let i = 0; i < 3; i++) {
      // outward normals: a point inside the box is behind all six (clipped by all of them: intersection)
      clipOut[2 * i].set(ax[i].clone(), -BOX.hi[i]).applyMatrix4(M);
      clipOut[2 * i + 1].set(ax[i].clone().negate(), BOX.lo[i]).applyMatrix4(M);
      clipIn[2 * i].copy(clipOut[2 * i]).negate(); clipIn[2 * i + 1].copy(clipOut[2 * i + 1]).negate();
    }
    setKnife(knifeOff);
  }
  const wholeIn = [];                          // the copies inside the box, which fade as the detail comes in
  const cellReady = loader.loadAsync('assets/cell/whole.glb?v=' + v).then(whole => {
    const add = [];
    whole.scene.traverse(o => {
      if (!o.isMesh) return;
      const id = o.name.replace(/^w_/, '').replace(/_\d+$/, '');
      o.userData.part = id;
      if (id === 'cell') {
        // see-through, and left out of the depth buffer: the outlines and shading belong to what is inside
        o.material = new THREE.MeshLambertMaterial({ color: PARTS.cell.col, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
        o.renderOrder = 2;
      } else {
        o.material = new THREE.MeshLambertMaterial({ color: (PARTS[id] || { col: 0x999999 }).col, clippingPlanes: clipOut, clipIntersection: true });
        const twin = new THREE.Mesh(o.geometry, new THREE.MeshLambertMaterial({ color: o.material.color, clippingPlanes: clipIn }));
        twin.userData.part = id; twin.position.copy(o.position); twin.quaternion.copy(o.quaternion); twin.scale.copy(o.scale);
        add.push([o.parent, twin]); wholeIn.push(twin);
      }
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (id === 'nucleolus') o.visible = false;
    });
    add.forEach(([p, t]) => { if (t.userData.part !== 'nucleolus') p.add(t); });
    G.cell.add(whole.scene);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(52, 37), new THREE.MeshLambertMaterial({ color: 0x9fb4c6, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    glass.rotation.x = -Math.PI / 2; glass.position.set(-0.5, -0.02, 0.9); glass.updateMatrix(); glass.userData.part = 'glass';
    G.cell.add(glass); groups.glass = glass;
    precompile(G.cell);
    // names at the cell level: a point on each part, the one nearest the middle of the part
    const near = (id, toward) => {
      let o = null; whole.scene.traverse(x => { if (x.isMesh && x.userData.part === id && !o) o = x; });
      if (!o) return null;
      const p = o.geometry.attributes.position, q = new THREE.Vector3(), t = new THREE.Vector3().fromArray(toward), M = localOf(o, G.cell);
      let best = null, bd = Infinity;
      for (let i = 0; i < p.count; i += 7) { q.fromBufferAttribute(p, i).applyMatrix4(M); const d = q.distanceToSquared(t); if (d < bd) { bd = d; best = q.clone(); } }
      return best;
    };
    const meshOf = id => { let o = null; whole.scene.traverse(x => { if (x.isMesh && x.userData.part === id && !o && x.material.clippingPlanes !== clipIn) o = x; }); return o; };
    const add2 = (id, toward, text, r, radius) => {
      const p = near(id, toward); if (!p) return;
      const cands = id === 'cell' ? null : spreadOn(meshOf(id), G.cell, p.toArray(), radius);
      anchors.push({ group: 'cell', frame: 'cell', p: p.toArray(), cands, r, text, part: id, z: [3.6, 4.45], free: id === 'cell' });
    };
    add2('nucleus', [-1, 8, -1], 'Nucleus', 9, 9); add2('cell', [-18, 4, 10], 'Cell membrane', 8);
    add2('mito', [12, 4, 8], 'Mitochondria', 3, 9); add2('golgi', [4, 4, 4], 'Golgi apparatus', 3, 5);
    // named again on the way in: where the camera passes through the membrane, and the nucleus seen from below
    anchors.push({ group: 'cell', frame: 'cell', p: [0.6, 1.62, -15.4], r: 1.2, text: 'Cell membrane', part: 'cell', z: [4.36, 4.56], free: true });
    anchors.push({ group: 'cell', frame: 'cell', p: [0.3, 1.45, -6.5], r: 2.5, text: 'Nucleus, seen from below', part: 'nucleus', z: [4.52, 4.76] });
  });

  // ---------- level 6: the organelles (the biggest file, loaded last) ----------
  const insideReady = cellReady.then(async () => {
    const [gltf, buf] = await Promise.all([
      loader.loadAsync('assets/cell/organelles.glb?v=' + v, e => { if (e.total) emit('progress', e.loaded / e.total); }),
      fetch('assets/cell/small.bin?v=' + v).then(r => r.arrayBuffer()),
    ]);
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const id = o.name.replace(/_\d+$/, '');
      o.material = new THREE.MeshLambertMaterial({ color: (PARTS[id] || { col: 0x999999 }).col, vertexColors: true, side: THREE.DoubleSide });
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.userData.part = id;
    });
    G.inside.add(gltf.scene);
    const small = parseSmall(buf);
    setTimeout(() => precompile(G.inside), 0);
    groups.ribo = ribosomes(small.RIBO, G.inside);
    groups.vesicle = balls(small.VESI, PARTS.vesicle.col, G.inside);
    groups.npore = pores(small.NPOR, G.inside);
    groups.mt = tubes(small.MTUB, G.inside);
    groups.centriole = centrioles(small.CENT, G.inside);
    Object.assign(counts, {
      ribosomes: small.RIBO.length / 3, vesicles: small.VESI.r.length, pores: small.NPOR.n.length / 3,
      microtubuleUm: small.MTUB.reduce((s, L) => { let d = 0; for (let i = 3; i < L.length; i += 3) d += Math.hypot(L[i] - L[i - 3], L[i + 1] - L[i - 2], L[i + 2] - L[i - 1]); return s + d; }, 0),
    });
    // names among the organelles: for each part, the points of it nearest to places along the way in and the
    // last view (they are named when they are near enough to see and far enough to read)
    const spots = [[0.3, 2.6, -0.9], [0.4, 1.5, -1.0], [1.4, 1.5, -1.2], [-0.3, 1.2, -0.4], [0.9, 1.0, -0.6], [0.2, 2.2, -1.8]];
    const TEXT = { nucleus: 'Nucleus', er: 'Endoplasmic reticulum', golgi: 'Golgi apparatus', mito: 'Mitochondrion', lyso: 'Lysosome', endo: 'Endosome', ld: 'Lipid droplet', membrane: 'Cell membrane' };
    gltf.scene.traverse(o => {
      if (!o.isMesh || !TEXT[o.userData.part]) return;
      const p = o.geometry.attributes.position, q = new THREE.Vector3(), M = localOf(o, G.inside);
      const used = [];
      for (const s of spots) {
        const t = new THREE.Vector3().fromArray(s); let best = null, bd = Infinity;
        for (let i = 0; i < p.count; i += 11) { q.fromBufferAttribute(p, i).applyMatrix4(M); const d = q.distanceToSquared(t); if (d < bd) { bd = d; best = q.clone(); } }
        if (best && bd < 0.36 && !used.some(u => u.distanceTo(best) < 0.8)) {
          used.push(best);
          anchors.push({ group: 'inside', frame: 'cell', p: best.toArray(), cands: spreadOn(o, G.inside, best.toArray(), o.userData.part === 'nucleus' ? 0.6 : 0.25, 8), r: o.userData.part === 'nucleus' ? 1.5 : 0.18, text: TEXT[o.userData.part], part: o.userData.part, z: [4.7, 5.45] });
        }
      }
    });
    const nearest = (arr, t, stride = 3) => { let best = null, bd = Infinity; for (let i = 0; i < arr.length; i += stride) { const d = (arr[i] - t[0]) ** 2 + (arr[i + 1] - t[1]) ** 2 + (arr[i + 2] - t[2]) ** 2; if (d < bd) { bd = d; best = [arr[i], arr[i + 1], arr[i + 2]]; } } return best; };
    const R1 = nearest(small.RIBO, [0.35, 1.3, -1.0]); if (R1) anchors.push({ group: 'inside', frame: 'cell', p: R1, r: 0.03, text: 'Ribosomes', part: 'ribo', z: [4.7, 5.45] });
    const V1 = nearest(small.VESI.p, [0.5, 1.6, -1.2]); if (V1) anchors.push({ group: 'inside', frame: 'cell', p: V1, r: 0.06, text: 'Vesicle', part: 'vesicle', z: [4.7, 5.45] });
    const mtAll = []; small.MTUB.forEach(L => { for (let i = 0; i < L.length; i += 9) mtAll.push(L[i], L[i + 1], L[i + 2]); });
    const M1 = nearest(mtAll, [0.6, 1.5, -1.3]); if (M1) anchors.push({ group: 'inside', frame: 'cell', p: M1, r: 0.05, text: 'Microtubule', part: 'mt', z: [4.6, 5.45] });
    if (small.CENT.length) { const c = small.CENT.find(x => x.len >= 0.3) || small.CENT[0]; anchors.push({ group: 'inside', frame: 'cell', p: c.c, r: 0.25, text: 'Centrioles', part: 'centriole', z: [4.5, 5.45] }); }
    const NP = nearest(small.NPOR.p, [0.3, 2.4, -1.0]); if (NP) anchors.push({ group: 'inside', frame: 'cell', p: NP, r: 0.06, text: 'Nuclear pore', part: 'npore', z: [4.6, 5.45] });
    // the electron-microscope slice shown beside the organelles (build_em_slice.py): where it lies, marked in the 3D
    // by a faint sheet and a green frame, as the photograph's box is
    fetch('assets/cell/em-slice.json?v=' + v).then(r => r.json()).then(E => {
      const z0 = E.box.z[0], z1 = E.box.z[1], y0 = E.box.y[0], y1 = E.box.y[1], x = E.x;
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), new THREE.MeshBasicMaterial({ color: 0x8fe3c8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      sheet.rotation.y = Math.PI / 2; sheet.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
      const fm = new THREE.MeshBasicMaterial({ color: 0x8fe3c8, transparent: true, depthTest: false, toneMapped: false }), bar = 0.025, frame = new THREE.Group();
      for (const [zc, yc, w, h] of [[(z0 + z1) / 2, y0 + bar / 2, z1 - z0, bar], [(z0 + z1) / 2, y1 - bar / 2, z1 - z0, bar], [z0 + bar / 2, (y0 + y1) / 2, bar, y1 - y0], [z1 - bar / 2, (y0 + y1) / 2, bar, y1 - y0]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm); m.rotation.y = Math.PI / 2; m.position.set(x, yc, zc); m.renderOrder = 6; frame.add(m);
      }
      const emMark = new THREE.Group(); emMark.add(sheet, frame); emMark.visible = false; emMark.userData.part = 'emslice';
      G.inside.add(emMark); groups.emMark = emMark; groups.emFrame = fm; groups.emSheet = sheet.material;
      anchors.push({ group: 'inside', frame: 'cell', p: [x, 1.75, -0.75], r: 0.3, text: 'The slice in the photograph', part: 'emslice', z: [4.9, 5.36], free: true });
      lastState = null; stateAt(Z);
    }).catch(() => {});
    // the molecules' model (small) is made in the background a little later, so the last step never waits
    setTimeout(() => { if (!molApi) ensure(5); }, 2500);
    return small;
  });

  // ---------- what is shown, at every point of the zoom ----------
  // Where two levels meet, each is drawn whole on its own and the two pictures are blended (post.render with
  // `to` and `under`): no level is ever half drawn, so nothing turns grainy, and the screen is never empty.
  // A layer is the set of things one level shows.
  const LAYER = {
    body:   { body: 1 },
    tissue: { tissue: 1, single: 1 },
    lift:   { tissue: 1, single: 1 },          // (the lining cell rises out of the tissue, which stays below it)
    cell:   { cell: 1, twins: 1 },             // the whole cell, its organelles all coarse
    inside: { cell: 1, inside: 1 },            // the whole cell round the box, the detail in the box
    mol:    { mol: 1 },
  };
  let layers = [[LAYER.body, 1]];
  const fades = { body: 1, tissue: 0, single: 0, cell: 0, inside: 0, mol: 0 };
  function showLayer(L) {
    for (const k in G) G[k].visible = !!L[k];
    for (const t of wholeIn) t.visible = !!L.twins;
  }
  let lastState = null;
  function stateAt(Z) {
    const key = Z.toFixed(5); if (key === lastState) return; lastState = key;
    // the body: see-through-ness by level, then the knife that cuts the organ open
    if (Z <= 1) bodyLook('organism', 'system', sm(Z, 0.1, 0.8), 1);
    else bodyLook('system', 'organ', sm(Z, 1.1, 1.7), 1);
    setKnife(Z < 1.4 ? 1 : 0.06 * (1 - sm(Z, 1.4, 1.92)));
    cap.visible = Z > 1.84;
    // which levels are drawn, and how much of each: [layer, weight]
    const mixes = [[2.78, 2.92, LAYER.body, LAYER.tissue], [3.6, 3.74, LAYER.tissue, LAYER.cell],
      [4.58, 4.72, LAYER.cell, LAYER.inside], [5.35, 5.6, LAYER.inside, LAYER.mol]];
    const order = [[2.78, LAYER.body], [3.6, LAYER.tissue], [4.58, LAYER.cell], [5.35, LAYER.inside], [9, LAYER.mol]];
    layers = null;
    for (const [a, b, A, B] of mixes) if (Z > a && Z < b) { const k = sm(Z, a, b); layers = [[A, 1 - k], [B, k]]; }
    if (!layers) layers = [[order.find(([z]) => Z <= z)[1], 1]];
    if (layers.some(([L]) => L === LAYER.mol) && !molApi) layers = [[LAYER.inside, 1]];
    for (const k in fades) fades[k] = layers.reduce((s, [L, w]) => s + (L[k] ? w : 0), 0);
    // the one lining cell the zoom goes into lights up; the slice the photograph shows is outlined
    // then it rises out of the tissue (3.32-3.5) and spreads flat (3.46-3.66), and the HeLa cell takes its place
    if (tissue) {
      tissue.single.material.emissive.setHex(0x8a3c9a).multiplyScalar(sm(Z, 3.05, 3.25) * (1 - 0.6 * sm(Z, 3.5, 3.66)));
      const lift = sm(Z, 3.32, 3.5), flat = sm(Z, 3.46, 3.66);
      tissue.single.matrix.copy(singleMatrix(lift, flat)); tissue.single.matrixWorldNeedsUpdate = true;
      const b = tissue.target.base; singleAt = [b[0], b[1] + LIFT * lift + 20 * (1 - flat) + 7 * flat, b[2]];
      slideLine.material.opacity = 0.9 * sm(Z, 2.9, 2.98) * (1 - sm(Z, 3.08, 3.2));
    }
    if (groups.glass) groups.glass.visible = Z < 4.45;
    if (groups.emMark) {                         // the slice the electron micrograph shows
      const k = sm(Z, 4.86, 4.96) * (1 - sm(Z, 5.3, 5.4));
      groups.emMark.visible = k > 0.01; groups.emFrame.opacity = 0.9 * k; groups.emSheet.opacity = 0.16 * k;
    }
  }
  function draw() {
    const live = layers.filter(([, w]) => w > 0.002);
    if (live.length < 2) { showLayer(live[0][0]); post.render(scene, camera); return; }
    showLayer(live[0][0]); post.render(scene, camera, { to: true });
    showLayer(live[1][0]); post.render(scene, camera, { under: true, mix: live[1][1] });
  }

  // ---------- controls at a level: orbit for the body, the tissue and the whole cell; look-around inside ----------
  const orbit = new OrbitControls(camera, cv);
  orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.enablePan = false; orbit.enableZoom = false;
  orbit.autoRotate = !reduced && !opts.test; orbit.autoRotateSpeed = 0.35;
  orbit.addEventListener('change', () => wake());
  orbit.addEventListener('start', () => { orbit.autoRotate = false; });
  const look = { yaw: 0, pitch: 0, on: false };
  function syncLook() { const d = new THREE.Vector3(); camera.getWorldDirection(d); look.yaw = Math.atan2(d.x, -d.z); look.pitch = Math.asin(Math.max(-1, Math.min(1, d.y))); }
  function applyLook() {
    const cp = Math.cos(look.pitch);
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp)));
  }
  function setControls(l) {
    const V = VIEWS[l];
    camera.up.copy(upOf(l));
    orbit._quat.setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0)); orbit._quatInverse.copy(orbit._quat).invert();
    orbit.enabled = !!(V && V.orbit);
    look.on = l === 'inside';
    if (orbit.enabled) {
      orbit.target.copy(W3(levelFrame(l), V.at)); orbit.minDistance = V.orbit[0] * sc(l); orbit.maxDistance = V.orbit[1] * sc(l);
      orbit.minPolarAngle = 0; orbit.maxPolarAngle = l === 'cell' ? Math.PI * 0.49 : l === 'tissue' ? Math.PI * 0.62 : Math.PI;
      orbit.update();
    }
    if (look.on) syncLook();
    if (l === 'molecules' && molApi) molApi.enterControls(camera, cv, wake);
  }
  function freeControls() {
    orbit.enabled = false; look.on = false;
    if (molApi) molApi.leaveControls();
  }

  // ---------- the paths between levels ----------
  // Each is a list of camera stops, in the frames' own units; the first is the upper level's view, the last the
  // lower level's. The camera moves along a smooth curve through them, at a speed that keeps the zoom even (a
  // stretch that magnifies ten times takes as long wherever it is).
  const view = l => ({ f: levelFrame(l), pos: VIEWS[l].pos, at: VIEWS[l].at });
  let membraneTop = 6.4;
  const PATHS = [
    () => [view('organism'), { f: 'body', pos: [0.5, 0.2, 1.0], at: VIEWS.system.at }, view('system')],
    () => [view('system'), { f: 'body', pos: [0.12, 0.11, 0.07], at: [-0.011, 0.04, -0.055] }, view('organ')],
    () => [view('organ'), { f: 'tissue', pos: [6000, 9000, 26000], at: [0, 0, 0] }, { f: 'tissue', pos: [700, 1200, 4200], at: [0, -120, 0] },
      { f: 'tissue', pos: [300, 330, 1700], at: [0, -220, 0] }, view('tissue')],
    // to one lining cell, from in front and above: it lights up, rises out of the tissue, spreads flat as it does in a
    // dish, and the real HeLa cell takes its place
    () => { const b = tissue.target.base; return [view('tissue'),
      { f: 'tissue', pos: [b[0] + 50, b[1] + 90, b[2] + 170], at: [b[0], b[1] + 15, b[2]] },
      { f: 'tissue', pos: [b[0] + 40, b[1] + 95, b[2] + 120], at: [b[0], b[1] + 30, b[2]] },
      { f: 'tissue', pos: [b[0] + 45, b[1] + 100, b[2] + 75], at: [b[0], b[1] + LIFT, b[2]] }, view('cell')]; },
    // into the cell: round to its thin edge, through the membrane there, under the rim of the nucleus (the gap
    // between it and the base of the cell is about 1 µm high) and into the box of organelles from its side
    () => [view('cell'), { f: 'cell', pos: [9, 8, -36], at: [0.3, 1.4, -13] }, { f: 'cell', pos: [0.8, 2.4, -23], at: [0.3, 1.25, -9] },
      { f: 'cell', pos: [0.3, 1.6, -15.6], at: [0.3, 1.15, -6] }, { f: 'cell', pos: [0.25, 1.05, -8.5], at: [0.2, 1.15, -2] },
      { f: 'cell', pos: [-0.05, 1.0, -3.6], at: [0.3, 1.25, -1.0] }, view('inside')],
    () => [{ f: 'mol', pos: [0, 0.03, 0.6], at: [0, 0.03, 0] }, { f: 'mol', pos: [0.012, 0.035, 0.4], at: [-0.005, 0.03, 0] }, view('molecules')],
  ];
  function makeFlight(i, poseA, poseB) {
    let keys = PATHS[i]();
    keys = keys.map(k => ({ pos: W3(k.f, k.pos), at: W3(k.f, k.at) }));
    if (i === 5) keys[0] = poseA || keys[0];     // the molecules are placed where the reader was looking
    else if (poseA) keys[0] = poseA;
    if (poseB) keys[keys.length - 1] = poseB;
    const posC = new THREE.CatmullRomCurve3(keys.map(k => k.pos), false, 'centripetal');
    const atC = new THREE.CatmullRomCurve3(keys.map(k => k.at), false, 'centripetal');
    const N = 600, cum = [0]; let pp = posC.getPoint(0), pa = atC.getPoint(0);
    for (let j = 1; j <= N; j++) {
      const s = j / N, p = posC.getPoint(s), a = atC.getPoint(s);
      const d = Math.max(1e-9, p.distanceTo(a));
      cum.push(cum[j - 1] + (p.distanceTo(pp) + a.distanceTo(pa)) / d + 0.004);
      pp = p; pa = a;
    }
    const tot = cum[N];
    const sOf = u => {                           // the path's parameter at an even share u of the zoom
      const w = u * tot; let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < w) lo = m; else hi = m; }
      return (lo + (w - cum[lo]) / Math.max(1e-12, cum[hi] - cum[lo])) / N;
    };
    return { i, posC, atC, sOf, upA: upOf(LEVELS[i]), upB: upOf(LEVELS[i + 1]),
      d0: keys[0].pos.distanceTo(keys[0].at), d1: keys[keys.length - 1].pos.distanceTo(keys[keys.length - 1].at) };
  }
  const lookW = l => { const o = LOOK[l], s = sc(l); return { fog: o.fog / s, aoRadius: o.aoRadius * s, ao: o.ao, edge: o.edge }; };
  const rangeW = l => RANGE[l].map(x => x * sc(l));
  const hazeOf = l => (l === 'inside' || l === 'molecules' ? 1 : 0);
  const cFog = new THREE.Color(FOG), cCyto = new THREE.Color(CYTO);
  function haze(k) { scene.background.copy(cFog).lerp(cCyto, k); post.fogColor(scene.background); }
  let aimDist = 1;
  function applyFlight(fl, u) {
    const s = fl.sOf(u), p = fl.posC.getPoint(s), a = fl.atC.getPoint(s);
    camera.position.copy(p);
    camera.up.copy(fl.upA).lerp(fl.upB, sm(u, 0.15, 0.85)).normalize();
    camera.lookAt(a);
    const D = Math.max(1e-9, p.distanceTo(a)); aimDist = D;
    camera.near = D / 400; camera.far = D * 60; applyInset();
    // the look between the two levels, by how far the zoom has got
    const k = Math.abs(Math.log(fl.d1 / fl.d0)) > 0.3 ? THREE.MathUtils.clamp(Math.log(D / fl.d0) / Math.log(fl.d1 / fl.d0), 0, 1) : u;
    const A = lookW(LEVELS[fl.i]), B = lookW(LEVELS[fl.i + 1]), lg = (x, y) => Math.exp(THREE.MathUtils.lerp(Math.log(x), Math.log(y), k));
    post.set({ fog: THREE.MathUtils.lerp(A.fog, B.fog, k * k), aoRadius: lg(A.aoRadius, B.aoRadius), ao: THREE.MathUtils.lerp(A.ao, B.ao, k), edge: THREE.MathUtils.lerp(A.edge, B.edge, k) });
    haze(THREE.MathUtils.lerp(hazeOf(LEVELS[fl.i]), hazeOf(LEVELS[fl.i + 1]), k));
  }

  // ---------- Z: where the reader is in the zoom ----------
  let Z = 0, Zt = 0, tween = null, flight = null, restAt = 0, shownLevel = 'organism';
  const poses = {};                              // the camera where the reader left each level (they may have turned it)
  const pose = aim => ({ pos: camera.position.clone(), at: aim ? aim.clone() : orbit.enabled ? orbit.target.clone() : camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(look.on ? 0.8 : aimDist)) });
  let rebased = false;
  function rebase(toMol) {
    // the molecules' model works at the world's origin: when the zoom goes there, the world is moved round it
    const before = Wm.clone();
    if (toMol) Wm.copy(F('mol')).invert().multiply(Wm); else Wm.identity();
    rebased = toMol;
    const change = new THREE.Matrix4().multiplyMatrices(Wm, before.clone().invert());
    camera.position.applyMatrix4(change); camera.up.transformDirection(change);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(change));
    camera.quaternion.premultiply(q);
    for (const k in poses) { poses[k].pos.applyMatrix4(change); poses[k].at.applyMatrix4(change); }
    placeGroups();
  }
  async function ensure(i) {                     // what the step from level i to i+1 needs, loaded
    if (i >= 2) await tissueReady;
    if (i >= 3) await cellReady;
    if (i >= 4) {
      await insideReady;
      // where the camera passes through the top of the cell, above the way in
      const cellMesh = G.cell.getObjectByProperty('name', 'w_cell') || (() => { let o; G.cell.traverse(x => { if (x.isMesh && x.userData.part === 'cell') o = x; }); return o; })();
      if (cellMesh) {
        const r = new THREE.Raycaster(W3('cell', [0.4, 30, -0.8]), new THREE.Vector3(0, -1, 0).transformDirection(F('cell')));
        const h = r.intersectObject(cellMesh, false)[0];
        if (h) membraneTop = h.point.clone().applyMatrix4(F('cell').invert()).y;
      }
    }
    if (i >= 5 && !molApi) await (molMaking ||= makeMolecules());
  }
  let molMaking = null;                          // made once, whoever asks first
  async function makeMolecules() {
    {
      const M = await import('./molecules3d.js?v=' + v);
      molApi = await M.build(THREE, G.mol, { v, small: await insideReady });
      molApi.recut({ position: new THREE.Vector3(0, 0.02, 1) });
      const m = (text, p, r, extra = {}) => anchors.push({ group: 'mol', frame: 'mol', p, r, text, part: 'molecule', z: [5.62, 6.01], ...extra });
      m('Microtubule', [-0.05, -0.006, 0.0125], 0.012);
      m('Kinesin, a motor protein', [0, 0.02, 0.01], 0.008, { dyn: 'kinesin' });
      m('Vesicle (its cargo)', [0, 0.05, 0], 0.028, { dyn: 'vesicle' });
      m('Protein molecules, packed close', [-0.065, 0.075, -0.02], 0.02);
      precompile(G.mol);
    }
  }
  function placeMolecules() {
    // the model's slab, 0.6 µm in front of the reader, level, facing them
    const d = camera.getWorldDirection(new THREE.Vector3()); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
    const camC = camera.position.clone().applyMatrix4(F('cell').invert());
    const o = camC.clone().addScaledVector(d, 0.6).add(new THREE.Vector3(0, -0.03, 0));
    const yaw = Math.atan2(-d.x, -d.z);
    P.mol.copy(P.cell).multiply(new THREE.Matrix4().makeTranslation(o.x, o.y, o.z).multiply(new THREE.Matrix4().makeRotationY(yaw)));
  }
  function setZ(z) {
    z = THREE.MathUtils.clamp(z, 0, LEVELS.length - 1);
    const i = Math.min(LEVELS.length - 2, Math.floor(z)), u = z - i;
    const atLevel = Math.abs(z - Math.round(z)) < 1e-4;
    if (atLevel) {
      const L = Math.round(z);
      if (flight) { flight = null; }
      if (restAt !== L || Z !== z) arrive(L);
      Z = L; stateAt(Z);
      return;
    }
    if (!flight || flight.i !== i) {
      if (flight) {                            // passing a level without stopping: start the next path exactly there
        const end = i > flight.i ? 1 : 0;
        applyFlight(flight, end);
        restAt = flight.i + end; poses[restAt] = pose(flight.atC.getPoint(end));
      } else if (restAt != null) poses[restAt] = pose();
      freeControls();
      if (i === 5 && !rebased) { placeMolecules(); rebase(true); }
      else if (i !== 5 && rebased) rebase(false);
      flight = makeFlight(i, poses[i] || null, poses[i + 1] || null);
      restAt = null;
    }
    Z = z; stateAt(Z);
    applyFlight(flight, u);
    if (groups.ribo && Z > 4.3 && Z < 5.8) { const c = G.inside.worldToLocal(camera.position.clone()); groups.ribo.update(c); groups.vesicle.update(c); }
    if (molApi && Z > 5.2) molApi.recut(camera);
    const near = LEVELS[Math.round(Z)];
    if (near !== shownLevel) { shownLevel = near; emit('level', near); }
    emit('z', Z);
  }
  function arrive(L) {
    const l = LEVELS[L];
    if (L !== 6 && rebased) rebase(false);
    restAt = L; flight = null;
    const p = poses[L];
    const V = VIEWS[l];
    camera.up.copy(upOf(l));
    if (p) { camera.position.copy(p.pos); camera.lookAt(p.at); }
    else { camera.position.copy(W3(levelFrame(l), V.pos)); camera.lookAt(W3(levelFrame(l), V.at)); }
    aimDist = camera.position.distanceTo(p ? p.at : W3(levelFrame(l), V.at));
    [camera.near, camera.far] = rangeW(l); applyInset();
    post.set(lookW(l)); haze(hazeOf(l));
    setControls(l);
    if (groups.ribo && l === 'inside') { const c = G.inside.worldToLocal(camera.position.clone()); groups.ribo.update(c, true); groups.vesicle.update(c, true); }
    if (shownLevel !== l) { shownLevel = l; emit('level', l); }
    emit('arrive', l); emit('z', L);
    measureScale();
  }

  // the wheel and a pinch move Z; a button glides Z to a level
  let scrollLock = false;
  async function nudge(dz) {
    if (tween) { tween.cancel(); }
    const base = Zt;
    dz /= STEP_LEN[Math.min(STEP_LEN.length - 1, Math.floor(dz > 0 ? base : Math.max(0, base - 1e-6)))];
    const next = THREE.MathUtils.clamp(base + dz, 0, LEVELS.length - 1);
    const i = Math.floor(Math.min(next, base) + 1e-6);
    if (next > base && !scrollLock) {           // load what the next step needs before moving into it
      const need = Math.min(LEVELS.length - 2, Math.floor(next - 1e-6));
      if ((need >= 2 && !tissue) || (need >= 3 && !groups.glass) || (need >= 4 && !groups.ribo) || (need >= 5 && !molApi)) {
        scrollLock = true; emit('progress', 0); await ensure(need); scrollLock = false;
      }
    }
    if (scrollLock) return;
    Zt = next; wake();
    void i;
    // when the scrolling stops close to a level, the zoom settles on it (so that the picture can be turned).
    // Never during the scrolling: a trackpad moves Z a hundredth at a time.
    clearTimeout(settle);
    settle = setTimeout(() => { const r = Math.round(Zt); if (!tween && Math.abs(Zt - r) < 0.08 && Zt !== r) { Zt = r; wake(); } }, 450);
  }
  let settle = 0;
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    nudge(-px * 0.0011);
  }, { passive: false });
  function glide(to, secs) {
    return new Promise(async res => {
      const from = Z;
      await ensure(Math.max(0, Math.ceil(Math.max(from, to)) - 1));
      if (tween) tween.cancel();
      const t0 = performance.now(), dur = reduced ? 1 : secs * 1000;
      tween = { cancel() { tween = null; res(); }, step(now) {
        const k = Math.min(1, (now - t0) / dur);
        Zt = from + (to - from) * ease(k); Z = Zt;
        if (k >= 1) { tween = null; Zt = to; res(); }
      } };
      wake();
    });
  }

  // ---------- the pointer: turn, look, pinch to zoom, and name what is under it ----------
  const ptrs = new Map(); let downAt = null, moved = 0;
  cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; moved = 0; if (look.on) cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') hoverAt(e.clientX, e.clientY); return; }
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (ptrs.size === 2) {
      const pts = [...ptrs.values()], other = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      nudge((d1 - d0) * 0.004); return;
    }
    if (!look.on) return;
    look.yaw += (e.clientX - prev[0]) * 0.004; look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch - (e.clientY - prev[1]) * 0.004));
    applyLook(); wake();
  });
  cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); if (downAt && moved < 6 && !tween) { const p = pickAt(e.clientX, e.clientY); emit('pick', p); } downAt = null; });
  cv.addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
  cv.addEventListener('pointerleave', () => emit('hover', null));
  let hoverWant = null, hoverLast = 0;
  function hoverAt(x, y) { hoverWant = [x, y]; wake(); }

  // GPU picking: the scene drawn once into one pixel under the pointer, each part in its own colour
  const pickRT = new THREE.WebGLRenderTarget(1, 1);
  const pickCam = new THREE.Camera(); pickCam.matrixWorldAutoUpdate = false; pickCam.matrixAutoUpdate = false;
  const pickBuf = new Uint8Array(4), pickMats = [];
  const PICK_VS = `varying vec2 vUv;
    #include <common>
    #include <clipping_planes_pars_vertex>
    void main(){ vUv = uv;
    #include <begin_vertex>
    #include <project_vertex>
    #include <clipping_planes_vertex>
    }`;
  const PICK_FS = `uniform vec3 uId; uniform sampler2D map; uniform float useMap; varying vec2 vUv;
    #include <clipping_planes_pars_fragment>
    void main(){
    #include <clipping_planes_fragment>
    if (useMap > 0.5 && texture2D(map, vUv).a < 0.5) discard;
    float d = gl_FragCoord.z * 255.0;
    gl_FragColor = vec4(uId.rg, floor(d) / 255.0, fract(d)); }`;
  function pickMat(n, src) {
    if (!pickMats[n]) pickMats[n] = new THREE.ShaderMaterial({ vertexShader: PICK_VS, fragmentShader: PICK_FS, clipping: true, side: THREE.DoubleSide,
      uniforms: { uId: { value: new THREE.Color((n & 255) / 255, ((n >> 8) & 255) / 255, 0) }, map: { value: null }, useMap: { value: 0 } } });
    const m = pickMats[n];
    m.clippingPlanes = src.clippingPlanes || null; m.clipIntersection = !!src.clipIntersection;
    m.uniforms.map.value = src.map || null; m.uniforms.useMap.value = src.map ? 1 : 0;
    return m;
  }
  function shownEnough(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return false;
    const op = m.uniforms && m.uniforms.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
    return op >= (m.transparent ? 0.06 : 0.5);
  }
  function partOf(o) { for (let p = o; p; p = p.parent) if (p.userData.part) return p.userData.part; return null; }
  // a part you can see through (a faint bone, the bladder behind the uterus) hides nothing behind it
  function solidEnough(o) {
    if (!shownEnough(o)) return false;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const op = m.uniforms && m.uniforms.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
    return !m.transparent || op >= 0.5;
  }
  function gpuPick(x, y, skipShells, solidOnly) {
    const r = cv.getBoundingClientRect();
    const px = x - r.left, py = y - r.top, w = r.width, h = r.height;
    const cx = (px / w) * 2 - 1, cy = 1 - (py / h) * 2, hx = 1 / w, hy = 1 / h;
    const Mp = new THREE.Matrix4().set(1 / hx, 0, 0, -cx / hx, 0, 1 / hy, 0, -cy / hy, 0, 0, 1, 0, 0, 0, 0, 1);
    camera.updateMatrixWorld();
    pickCam.projectionMatrix.multiplyMatrices(Mp, camera.projectionMatrix); pickCam.projectionMatrixInverse.copy(pickCam.projectionMatrix).invert();
    pickCam.matrixWorld.copy(camera.matrixWorld); pickCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
    const list = [], hidden = [], swapped = [];
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine)) return;
      const shell = o.userData.part === 'body' || o.userData.part === 'cell' || o.userData.part === 'glass';
      if (o.isMesh && o.visible && o.userData.part !== 'glass' && partOf(o) && (solidOnly ? solidEnough(o) : shownEnough(o)) && !(skipShells && shell)) {
        list.push(o); swapped.push([o, o.material]); o.material = pickMat(list.length, Array.isArray(o.material) ? o.material[0] : o.material);
      } else if (o.visible) { hidden.push(o); o.visible = false; }
    });
    const bg = scene.background; scene.background = null;
    const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(pickRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, pickCam);
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, pickBuf);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevA);
    scene.background = bg;
    for (const [o, m] of swapped) o.material = m;
    for (const o of hidden) o.visible = true;
    const n = pickBuf[0] + pickBuf[1] * 256;
    return n > 0 ? list[n - 1] : null;
  }

  // What is where on the screen, a few times a second: the scene drawn small (a quarter of the size), each part in
  // its own colour with how far away it is. A name is shown only if, at its place, its own part is what you see,
  // or nothing stands in front of it: so turning the view never leaves a name floating over the wrong thing.
  // The small picture is read back without waiting for the graphics card (it arrives a frame or two later): waiting
  // for it held the page for up to 100 ms among the organelles, several times a second.
  const idRT = new THREE.WebGLRenderTarget(1, 1);
  let idBuf = null, idList = [], idW = 0, idH = 0, idAt = 0, idCam = null, idPending = false;
  function idPass(sync) {
    if (idPending && !sync) return;
    const w = Math.max(40, Math.ceil(W() / 3)), h = Math.max(30, Math.ceil(H() / 3));
    if (idRT.width !== w || idRT.height !== h) idRT.setSize(w, h);
    const buf = new Uint8Array(w * h * 4);
    camera.updateMatrixWorld();
    const list = [];
    const hidden = [], swapped = [];
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine)) return;
      const shell = o.userData.part === 'body' || o.userData.part === 'cell' || o.userData.part === 'glass' || o.userData.part === 'emslice';
      if (o.isMesh && o.visible && partOf(o) && shownEnough(o) && !shell) {
        // see-through parts are drawn first and leave no depth: they can be found where nothing solid is, but
        // never hide a solid part behind them
        const solid = solidEnough(o);
        list.push(o); swapped.push([o, o.material, o.renderOrder]);
        const m = pickMat(list.length, Array.isArray(o.material) ? o.material[0] : o.material);
        m.depthWrite = solid; o.material = m; o.renderOrder = solid ? 1 : -1;
      } else if (o.visible) { hidden.push(o); o.visible = false; }
    });
    const bg = scene.background; scene.background = null;
    const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(idRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    const snap = { vp: new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), near: camera.near, far: camera.far };
    const done = () => { idBuf = buf; idList = list; idW = w; idH = h; idCam = snap; };
    if (sync) { renderer.readRenderTargetPixels(idRT, 0, 0, w, h, buf); done(); }
    else {
      idPending = true;
      renderer.readRenderTargetPixelsAsync(idRT, 0, 0, w, h, buf).then(() => { done(); idPending = false; wake(); }, () => { idPending = false; });
    }
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevA);
    scene.background = bg;
    for (const [o, m, ro] of swapped) { o.material.depthWrite = true; o.material = m; o.renderOrder = ro; }
    for (const o of hidden) o.visible = true;
  }
  const CONTAINS = { tnucleus: ['tcell'], capillary: ['connective'], crypt: ['tcell', 'tnucleus', 'connective'] };
  const lin = z => idCam.near * idCam.far / (idCam.far - z * (idCam.far - idCam.near));
  function seen(a, p, d, strict) {
    if (a.free || !idBuf || !idCam) return true;
    const q = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(idCam.vp);
    if (q.w <= 0) return false;
    const ix = Math.floor((q.x / q.w * 0.5 + 0.5) * idW), iy = Math.floor((q.y / q.w * 0.5 + 0.5) * idH);
    const ok = a.accept || [a.part, ...(CONTAINS[a.part] || [])];
    const zA = lin(q.z / q.w * 0.5 + 0.5), tol = 0.03 * zA + 0.6 * a.r * SCALE[a.frame];
    let front = Infinity;
    if (strict) {                                  // one of several places: its own part must be there, filling a small
      const at = (x, y) => { if (x < 0 || y < 0 || x >= idW || y >= idH) return null; const k = (y * idW + x) * 4, n = idBuf[k] + idBuf[k + 1] * 256; return n ? partOf(idList[n - 1]) : null; };
      const rpx = a.r * SCALE[a.frame] / Math.max(1e-9, zA) * (idH / 2) / Math.tan(camera.fov * Math.PI / 360);
      const pts = rpx < 4 ? [[0, 0]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];       // cross round it (a small part: its pixel)
      return pts.every(([dx, dy]) => at(ix + dx, iy + dy) === a.part);
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = ix + dx, y = iy + dy; if (x < 0 || y < 0 || x >= idW || y >= idH) continue;
      const k = (y * idW + x) * 4, n = idBuf[k] + idBuf[k + 1] * 256;
      if (!n) continue;
      const o = idList[n - 1]; if (o && ok.includes(partOf(o))) return true;          // its own part is what you see
      if (dx === 0 && dy === 0) front = lin((idBuf[k + 2] + idBuf[k + 3] / 255) / 255);
    }
    if (strict) return false;                                                          // one of several places: its part must be there
    return zA <= front + tol;                                                          // or nothing is in front of it
  }
  function pickAt(x, y) {
    // what is seen: first the solid parts, then the see-through ones, then the see-through shells (skin, membrane)
    let o = gpuPick(x, y, true, true) || gpuPick(x, y, true, false) || gpuPick(x, y, false, false);
    const r = cv.getBoundingClientRect();
    let part = o ? partOf(o) : (Z > 4.5 && Z < 5.5 ? 'cytoplasm' : null), label = null;
    for (let p = o; p; p = p.parent) if (p.userData.label) { label = p.userData.label; break; }
    if (part === 'section' && secMap) {           // which tissue of the cut face
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
      const h = ray.intersectObject(cap, false)[0];
      if (h && h.uv) {
        const i = Math.min(secMap.w - 1, Math.floor(h.uv.x * secMap.w)), j = Math.min(secMap.h - 1, Math.floor((1 - h.uv.y) * secMap.h));
        part = SEC_PART[Math.round(secMap.d[(j * secMap.w + i) * 4] / 40)] || null;
      } else part = null;
    }
    return { part, label, x: x - r.left, y: y - r.top, level: shownLevel };
  }

  // ---------- names on the picture ----------
  const tagLayer = document.createElement('div'); tagLayer.className = 'tags'; el.appendChild(tagLayer);
  const tagPool = [];
  function drawTags() {
    if (opts.notags) return;
    const Wd = W(), Hd = H(), out = [];
    const f = 1 / Math.tan(camera.fov * Math.PI / 360) * Hd / 2;
    const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const q = new THREE.Vector4();
    for (const a of anchors) {
      if (Z < a.z[0] || Z > a.z[1]) continue;
      if (fades[a.group] < 0.6) continue;
      if (a.cut && knifeOff < 0.03) continue;
      let p = W3(a.frame, a.dyn === 'single' ? singleAt : a.dyn && molApi ? molApi.where()[a.dyn] : a.p);
      if (a.cands) {                               // one of its places that can be seen from here: the last one if it still can
        const order = a.last != null ? [a.last, ...a.cands.keys()].filter((v, i, arr) => arr.indexOf(v) === i) : [...a.cands.keys()];
        const i = order.find(j => seen(a, W3(a.frame, a.cands[j]), 0, true));
        if (i == null) { a.last = null; continue; }
        a.last = i; p = W3(a.frame, a.cands[i]);
      }
      const d = p.distanceTo(camera.position);
      const rpx = a.r * SCALE[a.frame] / d * f;
      if (rpx < 5 || rpx > Hd * 0.42) continue;
      if (Z > 4.4 && Z < 5.6 && d > 2.6) continue;   // too deep in the haze
      q.set(p.x, p.y, p.z, 1).applyMatrix4(vp);
      if (q.w <= 0) continue;
      const sx = (q.x / q.w * 0.5 + 0.5) * Wd, sy = (-q.y / q.w * 0.5 + 0.5) * Hd;
      if (sx < inset.left + 10 || sx + 20 + a.text.length * 7.2 > Wd - inset.right || sy < inset.top + 10 || sy > Hd - inset.bottom - 20) continue;
      if (!a.cands && !seen(a, p, d)) continue;
      out.push({ a, sx, sy, rpx });
    }
    out.sort((m, n) => n.rpx - m.rpx);
    const placed = [];
    let k = 0;
    for (const t of out) {
      const w = 14 + t.a.text.length * 7.2, h = 24;
      const box = [t.sx - 6, t.sy - h / 2, t.sx + w, t.sy + h / 2];
      if (placed.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      let n = tagPool[k];
      if (!n) { n = document.createElement('div'); n.className = 'tag'; n.innerHTML = '<i></i><span></span>'; tagLayer.appendChild(n); tagPool.push(n); }
      // only the position changes from frame to frame: the name, its colour and its showing are written when
      // they change (writing them every frame made the browser restyle every name, every frame)
      if (n.dataset.t !== t.a.text) {
        n.dataset.t = t.a.text; n.lastChild.textContent = t.a.text;
        n.style.setProperty('--c', '#' + (PARTS[t.a.part] ? PARTS[t.a.part].col : 0xffffff).toString(16).padStart(6, '0'));
      }
      n.style.transform = `translate(${Math.round(t.sx)}px,${Math.round(t.sy)}px)`;
      if (n.hidden) n.hidden = false;
      k++;
      if (k >= 7) break;
    }
    for (; k < tagPool.length; k++) if (!tagPool[k].hidden) tagPool[k].hidden = true;
  }

  // ---------- scale bar: a round size at the distance of what is in the middle ----------
  let scaleTimer = 0;
  function measureScale() {
    clearTimeout(scaleTimer);
    scaleTimer = setTimeout(() => {
      const dist = orbit.enabled ? camera.position.distanceTo(orbit.target) : look.on ? 0.8 : aimDist;
      const pxPerUm = H() / (2 * dist * Math.tan(camera.fov * Math.PI / 360));
      const want = W() * 0.16 / pxPerUm;
      const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5];
      const um = steps.reduce((b, s) => (Math.abs(Math.log(s / want)) < Math.abs(Math.log(b / want)) ? s : b), 1);
      const label = um >= 1e5 ? um / 1e4 + ' cm' : um >= 1000 ? um / 1000 + ' mm' : um < 1 ? Math.round(um * 1000) + ' nm' : um + ' µm';
      emit('scale', { px: um * pxPerUm, um, label, distance: dist });
    }, 60);
  }

  // ---------- render loop: runs only while something changes ----------
  // One frame is booked at a time. Anything that asks for a frame while one is being drawn (the orbit
  // controls report every turn they make, from inside the frame) only keeps the loop awake: booking a
  // second frame there doubled the work at every frame until the page froze.
  let raf = 0, awake = 0, lastT = 0, inFrame = false, lastScale = 0;
  function wake() { awake = 3; if (!raf && !inFrame) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0; inFrame = true;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    if (tween) tween.step(now);
    else if (Math.abs(Zt - Z) > 1e-5) { const k = 1 - Math.exp(-dt * 5); Z += (Zt - Z) * k; if (Math.abs(Zt - Z) < 2e-4) Z = Zt; }
    if (Z !== restAt || flight) setZ(Z);
    if (orbit.enabled) orbit.update();
    if (restAt === 5 && groups.ribo) { const c = G.inside.worldToLocal(camera.position.clone()); groups.ribo.update(c); groups.vesicle.update(c); }
    if (molApi && restAt === 6) { molApi.tick(dt); molApi.update(); }
    draw();
    // what is where on the screen, for the names' check: a small picture, at most eight times a second
    if (!opts.notags && Z > 0.5 && now - idAt > 120) { idPass(); idAt = now; }
    drawTags();
    if (hoverWant && now - hoverLast > 80 && !tween) {
      hoverLast = now; const [hx, hy] = hoverWant; hoverWant = null;
      const p = pickAt(hx, hy); emit('hover', p.part ? p : null);
    }
    if (flight && now - lastScale > 200) { lastScale = now; measureScale(); }
    inFrame = false;
    const moving = tween || Math.abs(Zt - Z) > 1e-5 || hoverWant;
    const busy = moving || (orbit.enabled && orbit.autoRotate) || (molApi && restAt === 6 && molApi.animating());
    if (!busy && --awake <= 0) { lastT = 0; measureScale(); return; }
    raf = requestAnimationFrame(frame);
  }
  // the picture's subject is centred in the space the page leaves free (beside the ruler and the caption)
  const inset = { left: 0, right: 0, top: 0, bottom: 0 };
  function applyInset() {
    const dx = (inset.left - inset.right) / 2, dy = (inset.bottom - inset.top) / 2;
    if (dx || dy) camera.setViewOffset(W(), H(), -dx, dy, W(), H()); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => { camera.aspect = W() / H(); applyInset(); renderer.setSize(W(), H()); post.setSize(W(), H(), dpr); wake(); measureScale(); });
  ro.observe(el);

  placeGroups();
  stateAt(0); arrive(0);
  wake();

  const api = {
    THREE, camera, scene, renderer, post, groups, counts, insideReady, cellReady, tissueReady,
    get tissue() { return tissue; },
    get level() { return LEVELS[Math.round(Z)]; },
    get Z() { return Z; },
    get Zt() { return Zt; },
    get flying() { return !!tween || Math.abs(Zt - Z) > 1e-5; },
    get molecules() { return molApi; },
    on(k, f) { listeners[k].push(f); return api; },
    setInset(o) { Object.assign(inset, o); applyInset(); wake(); },
    // glide to any level; a button press. Several levels in one glide go faster.
    async goTo(to) {
      const b = LEVELS.indexOf(to); if (b < 0) return;
      const a = Z;
      let secs = 0; for (let i = Math.floor(Math.min(a, b)); i < Math.ceil(Math.max(a, b)); i++) secs += SECONDS[i] || 3;
      if (Math.abs(b - a) > 1.01) secs = Math.min(12, secs * 0.55);
      await glide(b, secs);
    },
    // scrub: put the zoom at Z at once (for checks)
    async setZ(z) { await ensure(Math.min(5, Math.floor(z))); if (tween) tween.cancel(); Zt = z; Z = z; setZ(z); draw(); drawTags(); },
    nudge,
    setShown(part, on) {
      G.inside.traverse(o => { if (o.userData.part === part) o.visible = on; });
      if (groups[part] && groups[part].mesh) { groups[part].mesh.visible = on; if (groups[part].pts) groups[part].pts.visible = on; }
      wake();
    },
    view(pos, at) {
      camera.position.fromArray(pos); camera.lookAt(new THREE.Vector3().fromArray(at));
      if (look.on) syncLook();
      if (orbit.enabled) { orbit.target.fromArray(at); orbit.update(); }
      wake();
    },
    render() { draw(); idPass(true); drawTags(); },
    // for checks: the part under a point of the page (client px), as a tap would find it
    partAt(x, y) { return pickAt(x, y).part; },
    seekFlight() { return false; },
    stopAutoRotate() { orbit.autoRotate = false; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); orbit.dispose(); renderer.dispose(); cv.remove(); },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------------------

function parseSmall(buf) {
  const dv = new DataView(buf);
  const tag = o => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'CELL') throw new Error('small.bin: bad file');
  let o = 8;
  const sections = [];
  while (o < buf.byteLength) {
    const t = tag(o), n = dv.getUint32(o + 4, true); o += 8;
    sections.push([t, n, o]);
    if (t === 'RIBO') o += n * 6;
    else if (t === 'VESI') o += n * 7;
    else if (t === 'NPOR') o += n * 9;
    else if (t === 'MTUB') { let pts = 0; for (let i = 0; i < n; i++) pts += dv.getUint16(o + 2 * i, true); o += n * 2 + pts * 6; }
    else if (t === 'CENT') o += n * 28;
    else if (t === 'BOX ') o += 24;
    else throw new Error('small.bin: unknown section ' + t);
  }
  const boxS = sections.find(s => s[0] === 'BOX ');
  const lo = [0, 1, 2].map(i => dv.getFloat32(boxS[2] + 4 * i, true));
  const hi = [0, 1, 2].map(i => dv.getFloat32(boxS[2] + 12 + 4 * i, true));
  const deq = (off, n) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { const k = i % 3; a[i] = lo[k] + dv.getUint16(off + 2 * i, true) / 65535 * (hi[k] - lo[k]); }
    return a;
  };
  const raw = { BOX: { lo, hi } };
  for (const [t, n, off] of sections) {
    if (t === 'RIBO') raw.RIBO = deq(off, n);
    if (t === 'VESI') raw.VESI = { p: deq(off, n), r: new Uint8Array(buf.slice(off + n * 6, off + n * 7)) };
    if (t === 'NPOR') raw.NPOR = { p: deq(off, n), n: new Int8Array(buf.slice(off + n * 6, off + n * 9)) };
    if (t === 'MTUB') {
      const lens = []; for (let i = 0; i < n; i++) lens.push(dv.getUint16(off + 2 * i, true));
      const pts = deq(off + n * 2, lens.reduce((a, b) => a + b, 0));
      raw.MTUB = []; let k = 0;
      for (const L of lens) { raw.MTUB.push(pts.subarray(k * 3, (k + L) * 3)); k += L; }
    }
    if (t === 'CENT') {
      raw.CENT = [];
      for (let i = 0; i < n; i++) { const b = off + 28 * i, f = j => dv.getFloat32(b + 4 * j, true);
        raw.CENT.push({ c: [f(0), f(1), f(2)], ax: [f(3), f(4), f(5)], len: f(6) }); }
    }
  }
  return raw;
}

// The skin as glass: see-through in the middle, brighter at the edges (where you look along the surface).
function glassMaterial(col) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(col) }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float r = 1.0 - abs(dot(normalize(vN), normalize(vV))); r = pow(r, 2.2);
        gl_FragColor = vec4(uColor * (0.5 + 1.1 * r), uOpacity * (0.06 + 0.7 * r)); }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
}

function smooth(geo) { const g = mergeVertices(geo.index ? geo.toNonIndexed() : geo); g.computeVertexNormals(); return g; }

function mergeGeoms(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov;
    oi += g.index.count; ov += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// A ribosome: a large and a small subunit in their real proportions, about 25-30 nm across in all
// (the 80S ribosome, 4.3 MDa; the segmentation gives each the volume of a ball 11 nm in radius).
function ribosomeGeometry() {
  const big = new THREE.IcosahedronGeometry(0.0102, 1);
  const sm = new THREE.IcosahedronGeometry(0.0080, 1); sm.scale(1.15, 0.72, 1.0); sm.translate(0, 0.0104, 0);
  return mergeGeoms([smooth(big), smooth(sm)]);
}

// a round dot for far ribosomes (points are square without it)
let _dot = null;
function dot() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}

function rnd(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

// Ribosomes near the eye are drawn as shapes (chosen again as you move); every one as a dot beyond that.
function ribosomes(P, parent, near = 0.85) {
  const n = P.length / 3, MAX = 8000;
  const mesh = new THREE.InstancedMesh(ribosomeGeometry(), new THREE.MeshLambertMaterial({ color: PARTS.ribo.col }), MAX);
  mesh.count = 0; mesh.frustumCulled = false; mesh.userData.part = 'ribo';
  parent.add(mesh);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: PARTS.ribo.col, size: 0.026, sizeAttenuation: true,
    map: dot(), alphaTest: 0.5 }));
  parent.add(pts);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  let lastAt = null;
  return {
    mesh, pts,
    update(cam, force) {
      if (!force && lastAt && lastAt.distanceTo(cam) < 0.08) return;
      lastAt = cam.clone();
      let k = 0; const r2 = near * near;
      for (let i = 0; i < n && k < MAX; i++) {
        const dx = P[3 * i] - cam.x, dy = P[3 * i + 1] - cam.y, dz = P[3 * i + 2] - cam.z;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        e.set(rnd(i) * 6.283, rnd(i + 0.5) * 6.283, rnd(i + 0.25) * 6.283); q.setFromEuler(e);
        m4.compose(v.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]), q, s1);
        mesh.setMatrixAt(k++, m4);
      }
      mesh.count = k; mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
  };
}

function balls(V, col, parent, near = 2.4) {
  const P = V.p, R = V.r, n = R.length, MAX = 6000;
  const mesh = new THREE.InstancedMesh(smooth(new THREE.IcosahedronGeometry(1, 1)), new THREE.MeshLambertMaterial({ color: col }), MAX);
  mesh.count = 0; mesh.frustumCulled = false; mesh.userData.part = 'vesicle';
  parent.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  let lastAt = null;
  return {
    mesh,
    update(cam, force) {
      if (!force && lastAt && lastAt.distanceTo(cam) < 0.2) return;
      lastAt = cam.clone();
      let k = 0; const r2 = near * near;
      for (let i = 0; i < n && k < MAX; i++) {
        const dx = P[3 * i] - cam.x, dy = P[3 * i + 1] - cam.y, dz = P[3 * i + 2] - cam.z;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        const r = R[i] / 1000; m4.compose(v.set(P[3 * i], P[3 * i + 1], P[3 * i + 2]), q, s.set(r, r, r));
        mesh.setMatrixAt(k++, m4);
      }
      mesh.count = k; mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
  };
}

// A nuclear pore complex: an eight-spoked ring about 120 nm across.
function poreGeometry() {
  const ring = new THREE.TorusGeometry(0.043, 0.017, 10, 32); ring.rotateX(Math.PI / 2);
  const parts = [ring];
  for (let i = 0; i < 8; i++) { const s = new THREE.BoxGeometry(0.016, 0.03, 0.022); s.translate(0.06, 0, 0); s.rotateY(i * Math.PI / 4); parts.push(s); }
  return mergeGeoms(parts.map(g => (g.index ? g : mergeVertices(g))));
}

function pores(V, parent) {
  const n = V.n.length / 3;
  const mesh = new THREE.InstancedMesh(poreGeometry(), new THREE.MeshLambertMaterial({ color: PARTS.npore.col }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    nv.set(V.n[3 * i], V.n[3 * i + 1], V.n[3 * i + 2]).normalize();
    q.setFromUnitVectors(up, nv);
    m4.compose(v.set(V.p[3 * i], V.p[3 * i + 1], V.p[3 * i + 2]), q, s1);
    mesh.setMatrixAt(i, m4);
  }
  mesh.computeBoundingSphere();
  mesh.userData.part = 'npore';
  parent.add(mesh);
  return { mesh };
}

// Microtubules: tubes 25 nm across along their measured centre lines.
function tubes(lines, parent) {
  const R = 0.0125, SIDES = 10;
  let nv = 0, ni = 0;
  for (const L of lines) { const k = L.length / 3; nv += k * SIDES; ni += (k - 1) * SIDES * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), t = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), c = new THREE.Vector3();
  for (const L of lines) {
    const k = L.length / 3;
    let prevU = null;
    for (let j = 0; j < k; j++) {
      a.fromArray(L, Math.max(0, j - 1) * 3); b.fromArray(L, Math.min(k - 1, j + 1) * 3); t.subVectors(b, a).normalize();
      if (!prevU) u.crossVectors(t, Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      else u.copy(prevU).addScaledVector(t, -prevU.dot(t)).normalize();
      prevU = u.clone();
      w.crossVectors(t, u);
      c.fromArray(L, j * 3);
      for (let s = 0; s < SIDES; s++) {
        const ang = s / SIDES * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = u.x * ca + w.x * sa, ny = u.y * ca + w.y * sa, nz = u.z * ca + w.z * sa, vi = (ov + j * SIDES + s) * 3;
        pos[vi] = c.x + nx * R; pos[vi + 1] = c.y + ny * R; pos[vi + 2] = c.z + nz * R;
        nor[vi] = nx; nor[vi + 1] = ny; nor[vi + 2] = nz;
      }
      if (j < k - 1) for (let s = 0; s < SIDES; s++) {
        const s2 = (s + 1) % SIDES, A = ov + j * SIDES + s, B = ov + j * SIDES + s2, C = ov + (j + 1) * SIDES + s, D = ov + (j + 1) * SIDES + s2;
        idx.set([A, C, B, B, C, D], oi); oi += 6;
      }
    }
    ov += k * SIDES;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: PARTS.mt.col }));
  mesh.userData.part = 'mt';
  parent.add(mesh);
  return { mesh, lines };
}

// A centriole: nine triplets of microtubules in a ring about 250 nm across, about 450 nm long
// (Guichard et al. 2017). Placed and pointed as measured; only the two whole ones are drawn.
function centrioles(list, parent) {
  const grp = new THREE.Group(); grp.userData.part = 'centriole';
  const mat = new THREE.MeshLambertMaterial({ color: PARTS.centriole.col });
  const tube = new THREE.CylinderGeometry(0.0115, 0.0115, 1, 12, 1);
  for (const c of list) {
    if (c.len < 0.3) continue;
    const L = Math.min(0.5, c.len), barrel = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const ang = i / 9 * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        // the triplet blade leans about 50 degrees from the tangent, A-tubule innermost
        const blade = ang + Math.PI / 2 + 0.87, r = 0.095, off = (k - 1) * 0.021;
        const m = new THREE.Mesh(tube, mat);
        m.scale.set(1, L * (k === 2 ? 0.8 : 1), 1);
        m.position.set(Math.cos(ang) * r + Math.cos(blade) * off, 0, Math.sin(ang) * r + Math.sin(blade) * off);
        m.userData.part = 'centriole';
        barrel.add(m);
      }
    }
    barrel.position.fromArray(c.c);
    barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().fromArray(c.ax).normalize());
    grp.add(barrel);
  }
  parent.add(grp);
  return { mesh: grp };
}

// ---------------------------------------------------------------------------------------------------------
// The post pass, the look of crowded-cell pictures (Mol*, Goodsell). Three steps:
//  1. the scene into a multisampled target with a depth texture;
//  2. ambient occlusion at half size: how hidden each point is by its neighbours, read from the depth buffer;
//  3. one full-screen shader: the occlusion smoothed with a depth-aware blur, dark outlines where depth jumps,
//     and a haze that thickens with distance.
// Where two levels meet, the first is finished into a picture of its own (`to`), and the second, as it is
// finished, is blended over it (`under`, `mix`): two whole pictures, crossfaded.
function makePost(renderer, o) {
  const depth = new THREE.DepthTexture(1, 1); depth.type = o.depthUint ? THREE.UnsignedIntType : THREE.FloatType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: o.samples, type: THREE.HalfFloatType, depthTexture: depth });
  const aoRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
  const K = 20, kernel = [];
  let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < K; i++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r()).normalize();
    let sc = i / K; sc = 0.1 + 0.9 * sc * sc; v.multiplyScalar(sc * (0.5 + 0.5 * r())); kernel.push(v);
  }
  const common = `
      uniform sampler2D tDepth; uniform mat4 uProj, uInvProj; uniform vec2 uRes;
      varying vec2 vUv;
      vec3 viewPos(vec2 uv) {
        float d = texture2D(tDepth, uv).r;
        vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return p.xyz / p.w;
      }`;
  const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const U = {
    tColor: { value: rt.texture }, tDepth: { value: depth }, tAO: { value: aoRT.texture },
    uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
    uRes: { value: new THREE.Vector2(1, 1) }, uAORes: { value: new THREE.Vector2(1, 1) }, uKernel: { value: kernel },
    uRadius: { value: o.aoRadius }, uAO: { value: o.ao }, uFog: { value: o.fog },
    uFogColor: { value: new THREE.Color(o.fogColor) }, uEdge: { value: o.edge },
    tUnder: { value: null }, uMix: { value: 1 },
  };
  // 4 x 4 tile of rotations: the noise is regular, so the blur below removes it completely
  const aoMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: vert, depthTest: false, depthWrite: false,
    fragmentShader: `
      #define K ${K}
      ${common}
      uniform vec2 uAORes; uniform float uRadius; uniform vec3 uKernel[K];
      void main() {
        float d0 = texture2D(tDepth, vUv).r;
        if (d0 >= 1.0) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPos(vUv);
        vec3 N = normalize(cross(dFdx(P), dFdy(P)));
        vec2 cell = mod(floor(vUv * uAORes), 4.0);
        float a = (cell.x * 4.0 + cell.y) / 16.0 * 6.2831853 + 0.37;
        vec3 rv = vec3(cos(a), sin(a), 0.0);
        vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N);
        float occ = 0.0;
        for (int i = 0; i < K; i++) {
          vec3 S = P + TBN * uKernel[i] * uRadius;
          vec4 q = uProj * vec4(S, 1.0); vec2 suv = q.xy / q.w * 0.5 + 0.5;
          if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
          float sz = viewPos(suv).z;
          float range = smoothstep(0.0, 1.0, uRadius / abs(P.z - sz));
          occ += (sz >= S.z + uRadius * 0.03 ? 1.0 : 0.0) * range;
        }
        gl_FragColor = vec4(vec3(1.0 - occ / float(K)), 1.0);
      }`,
  });
  const mat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: vert, depthTest: false, depthWrite: false,
    fragmentShader: `
      ${common}
      uniform sampler2D tColor, tAO, tUnder; uniform vec2 uAORes; uniform float uAO, uFog, uEdge, uMix; uniform vec3 uFogColor;
      void main() {
        float d0 = texture2D(tDepth, vUv).r;
        vec3 col = texture2D(tColor, vUv).rgb;
        if (d0 < 1.0) {
          vec3 P = viewPos(vUv); float z = -P.z;
          // depth-aware 4 x 4 blur of the half-size occlusion
          float acc = 0.0, wsum = 0.0;
          vec2 ap = 1.0 / uAORes;
          for (int i = -2; i < 2; i++) for (int j = -2; j < 2; j++) {
            vec2 uv = vUv + (vec2(float(i), float(j)) + 0.5) * ap;
            float zs = -viewPos(uv).z;
            float w = exp(-abs(zs - z) / (0.02 * z + 1e-6));
            acc += texture2D(tAO, uv).r * w; wsum += w;
          }
          float ao = wsum > 0.0 ? acc / wsum : 1.0;
          col *= 1.0 - uAO * (1.0 - ao);
          vec2 px = 1.0 / uRes; float e = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 off = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
            float zn = -viewPos(vUv + off * 1.5).z;
            e = max(e, (zn - z) / z);
          }
          col = mix(col, col * 0.18, smoothstep(0.04, 0.16, e) * uEdge);
          float f = 1.0 - exp(-pow(uFog * z, 2.0));
          col = mix(col, uFogColor, f);
        } else {
          col = mix(col, uFogColor, clamp(uFog * 40.0, 0.0, 1.0));
        }
        if (uMix < 1.0) col = mix(texture2D(tUnder, vUv).rgb, col, uMix);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let under = null;                    // made the first time two levels are blended
  return {
    rt, mat,
    setSize(w, h, dpr) {
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      rt.setSize(W, H); U.uRes.value.set(W, H);
      if (under) under.setSize(W, H);
      const aw = Math.max(1, Math.round(W / 2)), ah = Math.max(1, Math.round(H / 2));
      aoRT.setSize(aw, ah); U.uAORes.value.set(aw, ah);
    },
    fogColor(c) { U.uFogColor.value.copy(c); },
    set(p) { if (p.fog != null) U.uFog.value = p.fog; if (p.aoRadius != null) U.uRadius.value = p.aoRadius; if (p.ao != null) U.uAO.value = p.ao; if (p.edge != null) U.uEdge.value = p.edge; },
    render(scene, camera, how = {}) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      U.uProj.value.copy(camera.projectionMatrix); U.uInvProj.value.copy(camera.projectionMatrixInverse);
      quad.material = aoMat; renderer.setRenderTarget(aoRT); renderer.render(qs, qc);
      if (how.to) {
        // finished into a picture of its own; drawn into a target, three.js leaves out the tone mapping, so the
        // blend below happens before it, as for one picture
        if (!under) { under = new THREE.WebGLRenderTarget(rt.width, rt.height, { type: THREE.HalfFloatType }); }
        U.uMix.value = 1; U.tUnder.value = null;      // (never read the picture being drawn into)
        quad.material = mat; renderer.setRenderTarget(under); renderer.render(qs, qc);
        return;
      }
      U.tUnder.value = how.under && under ? under.texture : null;
      U.uMix.value = how.under && under ? how.mix : 1;
      quad.material = mat; renderer.setRenderTarget(null); renderer.render(qs, qc);
      U.uMix.value = 1; U.tUnder.value = null;
    },
  };
}
