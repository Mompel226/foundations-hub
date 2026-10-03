/* The Cells Lab's opening: a zoom from a whole human down to the molecules of one real cell.

   The seven rungs of Topic 2's ladder, one scene, each rung in its own units:
     organism   a real woman's body                    metres   assets/body/anatomy.glb
     system     her reproductive system                metres     HuBMAP Human Reference Atlas, United Female
     organ      the uterus and its cervix              metres     v1.10 (Visible Human Female, NLM), CC BY 4.0
     tissue     two photographs of the cervix lining   µm       assets/tissue/*.jpg (M. Häggström, CC0)
     cell       one real HeLa cell, whole              µm       assets/cell/whole.glb
     inside     the organelles round its centrosome    µm       assets/cell/organelles.glb + small.bin
     molecules  a model of 0.15 µm of cytoplasm        µm       js/molecules3d.js, loaded only when asked for
   The cell: Janelia Research Campus, FIB-SEM (Xu et al. 2021, Nature 599:147), organelles found by Heinrich
   et al. 2021 (Nature 599:141); OpenOrganelle jrc_hela-2, CC BY 4.0. Meshes made by labs/cells-lab-source/tools/
   (never published). Sizes and places are the measured ones; the colours are chosen.

   mount(el, opts) -> controller (see the return at the end).
*/
import * as THREE from './vendor/three/build/three.module.min.js?v=0.185.1';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js?v=0.185.1';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js?v=0.185.1';
import { MeshoptDecoder } from './vendor/three/examples/jsm/libs/meshopt_decoder.module.js?v=0.185.1';
import { mergeVertices } from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js?v=0.185.1';

export const LEVELS = ['organism', 'system', 'organ', 'tissue', 'cell', 'inside', 'molecules'];
const GROUP = { organism: 'body', system: 'body', organ: 'body', tissue: 'tissue', cell: 'cell', inside: 'inside', molecules: 'mol' };

// Colours are a choice: most of these structures are smaller than the wavelength of light.
export const PARTS = {
  body:      { name: 'the body (her skin)', col: 0xb9cfdd },
  pelvis:    { name: 'pelvis (hip bones)', col: 0xb9b2a2 },
  bladder:   { name: 'bladder', col: 0xd8b85a },
  rectum:    { name: 'rectum', col: 0xa98063 },
  vagina:    { name: 'vagina', col: 0xc76f8b },
  uterus:    { name: 'uterus', col: 0xd65a74 },
  cervix:    { name: 'cervix', col: 0xf2a057 },
  oviduct:   { name: 'oviduct', col: 0xe58fa0 },
  ovary:     { name: 'ovary', col: 0xf1c34f },
  cell:      { name: 'cell membrane', col: 0xd8c6a2 },
  membrane:  { name: 'cell membrane', col: 0xd8c6a2 },
  nucleus:   { name: 'nucleus', col: 0x4a63c9 },
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
};
const BODY_PART = { skin: 'body', bones: 'pelvis', bladder: 'bladder', rectum: 'rectum', vagina: 'vagina', uterus: 'uterus',
  cervix: 'cervix', tubes: 'oviduct', ovaries: 'ovary' };
// How see-through each body part is at the three body rungs (1 = solid)
const BODY_LOOK = {
  organism: { skin: 1.0, bones: 0.0, bladder: 0.0, rectum: 0.0, vagina: 1, uterus: 1, cervix: 1, tubes: 1, ovaries: 1 },
  system:   { skin: 0.16, bones: 0.10, bladder: 0.18, rectum: 0.18, vagina: 1, uterus: 1, cervix: 1, tubes: 1, ovaries: 1 },
  organ:    { skin: 0.0, bones: 0.05, bladder: 0.08, rectum: 0.08, vagina: 0.30, uterus: 1, cervix: 1, tubes: 0.35, ovaries: 0.35 },
};

const FOG = 0x1d2733;
// How each rung is drawn: haze per unit, ambient-occlusion radius (in that rung's units) and strength, outlines.
const LOOK = {
  organism:  { fog: 0.0,   aoRadius: 0.03,  ao: 0.6, edge: 0.5 },
  system:    { fog: 0.0,   aoRadius: 0.006, ao: 0.8, edge: 0.8 },
  organ:     { fog: 0.0,   aoRadius: 0.002, ao: 0.8, edge: 0.9 },
  tissue:    { fog: 0.0,   aoRadius: 1,     ao: 0.0, edge: 0.0 },
  cell:      { fog: 0.010, aoRadius: 0.9,   ao: 0.9, edge: 0.7 },
  inside:    { fog: 0.55,  aoRadius: 0.06,  ao: 1.0, edge: 1.0 },
  molecules: { fog: 2.2,   aoRadius: 0.005, ao: 1.0, edge: 0.6 },
};
const RANGE = { organism: [0.01, 30], system: [0.002, 6], organ: [0.0005, 2], tissue: [1, 6000], cell: [0.05, 200], inside: [0.004, 9], molecules: [0.0004, 0.9] };
// Where each rung's camera stands (in that rung's units)
export const VIEWS = {
  organism: { pos: [0.95, 0.32, 2.15], at: [0, 0.04, -0.05], orbit: [1.1, 3.6] },
  system:   { pos: [0.15, 0.21, 0.24], at: [-0.012, 0.052, -0.05], orbit: [0.16, 0.9] },
  organ:    { pos: [0.085, 0.07, 0.035], at: [-0.012, 0.033, -0.055], orbit: [0.05, 0.3] },
  tissue:   { pos: [0, 0, 760], at: [0, 0, 0] },
  cell:     { pos: [30, 26, 34], at: [-1, 1.5, -1], orbit: [12, 85] },
  inside:   { pos: [-0.248, 1.104, -0.826], at: [0.55, 1.42, -1.1] },
};
// The way into the organelles: a gap through the measured cell (tools/path_in.py; every organelle, vesicle,
// ribosome and microtubule counted as solid; narrowest 64 nm). It runs low, just above the cell's base.
const PATH_IN = [[-0.120, 0.944, -3.048], [-0.297, 0.671, -2.943], [-0.280, 0.420, -2.697], [-0.088, 0.464, -2.399],
  [-0.181, 0.400, -2.084], [-0.429, 0.464, -1.847], [-0.632, 0.432, -1.538], [-0.632, 0.368, -1.173],
  [-0.519, 0.368, -0.846], [-0.408, 0.618, -0.708], [-0.347, 0.877, -0.613], [-0.248, 1.104, -0.826]];
const BOX = { lo: [-3.75, 0.0, -4.65], hi: [3.75, 4.2, 2.85] };   // the detailed region (build_meshes.SCENE_UM)
// The two photographs, in µm. Their size is estimated from the nuclei (about 6 µm across): they have no scale bar.
const TISSUE = { w: 525, h: 808 };
const CELLS = { w: 90, h: 189, at: [63, 287], cell: [53.5, 296] };   // the closer photograph, turned to lie along the lining

export async function mount(el, opts = {}) {
  const W = () => Math.max(1, el.clientWidth), H = () => Math.max(1, el.clientHeight);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.test });
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  el.appendChild(renderer.domElement);
  const cv = renderer.domElement;
  cv.style.touchAction = 'none';
  cv.style.display = 'block';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.01, 30);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xf2f4ff, 0x4a4038, 1.6));
  const head = new THREE.DirectionalLight(0xffffff, 1.4); head.position.set(0.3, 0.4, 1); camera.add(head);
  const post = makePost(renderer, { ...LOOK.organism, fogColor: FOG });
  post.setSize(W(), H(), dpr);

  const G = { body: new THREE.Group(), tissue: new THREE.Group(), cell: new THREE.Group(), inside: new THREE.Group(), mol: new THREE.Group() };
  Object.values(G).forEach(g => { g.visible = false; scene.add(g); });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const v = opts.v || '1';
  const listeners = { level: [], pick: [], scale: [], progress: [], arrive: [] };
  const emit = (k, x) => listeners[k].forEach(f => f(x));
  const groups = {}, counts = {}, bodyMat = {};
  let molApi = null, level = 'organism', flight = null;

  // ---------- rungs 1-3: the body (loaded first: it is what the reader sees first) ----------
  const body = await loader.loadAsync('assets/body/anatomy.glb?v=' + v);
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
  });
  G.body.add(body.scene);
  function bodyLook(a, b, k) {      // see-through-ness between two body rungs, k from 0 (a) to 1 (b)
    for (const id in bodyMat) {
      const x = THREE.MathUtils.lerp(BODY_LOOK[a][id], BODY_LOOK[b][id], k);
      const m = bodyMat[id];
      if (m.uniforms) m.uniforms.uOpacity.value = x; else { m.opacity = x; m.depthWrite = x > 0.95; }
      m.visible = x > 0.004;
    }
  }

  // ---------- rung 4: the tissue, two real photographs ----------
  const texLoader = new THREE.TextureLoader();
  const tissueReady = Promise.all([texLoader.loadAsync('assets/tissue/endocervix-tissue.jpg?v=' + v), texLoader.loadAsync('assets/tissue/endocervix-cells.jpg?v=' + v)])
    .then(([t1, t2]) => {
      [t1, t2].forEach(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });
      const p1 = new THREE.Mesh(new THREE.PlaneGeometry(TISSUE.w, TISSUE.h), new THREE.MeshBasicMaterial({ map: t1, toneMapped: false }));
      p1.userData.part = 'tissue';
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(CELLS.w, CELLS.h), new THREE.MeshBasicMaterial({ map: t2, toneMapped: false, transparent: true, opacity: 0 }));
      p2.position.set(CELLS.at[0], CELLS.at[1], 0.5); p2.rotation.z = Math.PI / 2; p2.userData.part = 'tissue';
      G.tissue.add(p1, p2);
      groups.closer = p2;
    });

  // ---------- rung 5: the whole cell ----------
  const cellReady = loader.loadAsync('assets/cell/whole.glb?v=' + v).then(whole => {
    whole.scene.traverse(o => {
      if (!o.isMesh) return;
      const id = o.name.replace(/^w_/, '').replace(/_\d+$/, '');
      o.userData.part = id;
      if (id === 'cell') {
        // see-through, and left out of the depth buffer: the outlines and shading belong to what is inside
        o.material = new THREE.MeshLambertMaterial({ color: PARTS.cell.col, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
        o.renderOrder = 2;
      } else {
        o.material = new THREE.MeshLambertMaterial({ color: (PARTS[id] || { col: 0x999999 }).col });
      }
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (id === 'nucleolus') o.visible = false;
    });
    G.cell.add(whole.scene);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(52, 37), new THREE.MeshLambertMaterial({ color: 0x9fb4c6, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    glass.rotation.x = -Math.PI / 2; glass.position.set(-0.5, -0.02, 0.9); glass.userData.part = 'glass';
    G.cell.add(glass);
    const boxLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX.hi[0] - BOX.lo[0], BOX.hi[1] - BOX.lo[1], BOX.hi[2] - BOX.lo[2])),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
    boxLine.position.set((BOX.lo[0] + BOX.hi[0]) / 2, (BOX.lo[1] + BOX.hi[1]) / 2, (BOX.lo[2] + BOX.hi[2]) / 2);
    boxLine.renderOrder = 5;
    G.cell.add(boxLine);
  });

  // ---------- rung 6: the organelles (the biggest file, loaded last) ----------
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
    groups.ribo = ribosomes(small.RIBO, G.inside);
    groups.vesicle = balls(small.VESI, PARTS.vesicle.col, G.inside);
    groups.npore = pores(small.NPOR, G.inside);
    groups.mt = tubes(small.MTUB, G.inside);
    groups.centriole = centrioles(small.CENT, G.inside);
    Object.assign(counts, {
      ribosomes: small.RIBO.length / 3, vesicles: small.VESI.r.length, pores: small.NPOR.n.length / 3,
      microtubuleUm: small.MTUB.reduce((s, L) => { let d = 0; for (let i = 3; i < L.length; i += 3) d += Math.hypot(L[i] - L[i - 3], L[i + 1] - L[i - 2], L[i + 2] - L[i - 1]); return s + d; }, 0),
    });
    return small;
  });

  // ---------- controls: orbit for the body and the whole cell, look-around inside ----------
  const orbit = new OrbitControls(camera, cv);
  orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.enablePan = false;
  orbit.autoRotate = !reduced && !opts.test; orbit.autoRotateSpeed = 0.35;
  orbit.addEventListener('change', () => wake());
  orbit.addEventListener('start', () => { orbit.autoRotate = false; });

  const look = { yaw: 0, pitch: 0, on: false };
  function syncLook() { const d = new THREE.Vector3(); camera.getWorldDirection(d); look.yaw = Math.atan2(d.x, -d.z); look.pitch = Math.asin(Math.max(-1, Math.min(1, d.y))); }
  function applyLook() {
    const cp = Math.cos(look.pitch);
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp)));
  }
  const ptrs = new Map(); let downAt = null, moved = 0;
  cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; moved = 0; if (look.on) cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (!look.on) return;
    if (ptrs.size === 2) {
      const pts = [...ptrs.values()], other = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      walk((d1 - d0) * 0.003); return;
    }
    look.yaw += (e.clientX - prev[0]) * 0.004; look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch - (e.clientY - prev[1]) * 0.004));
    applyLook(); wake();
  });
  cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); if (downAt && moved < 6 && !flight) pickAt(e.clientX, e.clientY); downAt = null; });
  cv.addEventListener('pointercancel', e => ptrs.delete(e.pointerId));
  cv.addEventListener('wheel', e => { if (!look.on) return; e.preventDefault(); walk(-Math.sign(e.deltaY) * Math.min(0.12, Math.abs(e.deltaY) * 0.0015)); }, { passive: false });
  function walk(d) {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const p = camera.position.clone().addScaledVector(dir, d);
    for (let i = 0; i < 3; i++) p.setComponent(i, Math.max(BOX.lo[i] + (i === 1 ? 0.15 : 0.6), Math.min(BOX.hi[i] - (i === 1 ? 0.4 : 0.6), p.getComponent(i))));
    camera.position.copy(p); wake();
  }
  function setControls(l) {
    const V = VIEWS[l];
    orbit.enabled = !!(V && V.orbit);
    look.on = l === 'inside';
    if (orbit.enabled) { orbit.target.fromArray(V.at); orbit.minDistance = V.orbit[0]; orbit.maxDistance = V.orbit[1];
      orbit.maxPolarAngle = l === 'cell' ? Math.PI * 0.49 : Math.PI; orbit.update(); }
    if (look.on) syncLook();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  function isShown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; if (o.material && o.material.opacity !== undefined && o.material.opacity < 0.2) return false; return true; }
  function pickables() {
    const out = [];
    G[GROUP[level]].traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.userData.part && o.userData.part !== 'glass' && isShown(o)) out.push(o); });
    return out;
  }
  function partOf(o) { for (let p = o; p; p = p.parent) if (p.userData.part) return p.userData.part; return null; }
  function pickAt(x, y) {
    const r = cv.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    ray.near = camera.near; ray.far = camera.far;
    let hits = ray.intersectObjects(pickables(), false);
    // a see-through skin or cell membrane counts only when nothing inside it is under the pointer
    if (hits.length > 1 && (hits[0].object.userData.part === 'cell' || hits[0].object.userData.part === 'body')) hits = hits.slice(1);
    const h = hits[0];
    const part = h ? partOf(h.object) : (level === 'inside' || level === 'molecules' ? 'cytoplasm' : null);
    let label = null; for (let o = h && h.object; o; o = o.parent) if (o.userData.label) { label = o.userData.label; break; }
    emit('pick', { part, label, x: x - r.left, y: y - r.top, distance: h ? h.distance : null, level });
  }

  // ---------- scale bar: the screen length of a round size, at the distance of what is in the middle ----------
  let scaleTimer = 0;
  const UNIT_UM = { organism: 1e6, system: 1e6, organ: 1e6, tissue: 1, cell: 1, inside: 1, molecules: 1 };
  function measureScale() {
    clearTimeout(scaleTimer);
    scaleTimer = setTimeout(() => {
      ray.setFromCamera(new THREE.Vector2(0, 0), camera); ray.near = camera.near; ray.far = camera.far;
      const h = ray.intersectObjects(pickables(), false).find(x => x.object.userData.part !== 'cell' && x.object.userData.part !== 'body');
      const dist = h ? h.distance : (orbit.enabled ? camera.position.distanceTo(orbit.target) : level === 'inside' ? 1.0 : 0.08);
      const pxPerUnit = H() / (2 * dist * Math.tan(camera.fov * Math.PI / 360));
      const pxPerUm = pxPerUnit / UNIT_UM[level];
      const want = W() * 0.16 / pxPerUm;
      const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5];
      const um = steps.reduce((b, s) => (Math.abs(Math.log(s / want)) < Math.abs(Math.log(b / want)) ? s : b), 1);
      const label = um >= 1e5 ? um / 1e4 + ' cm' : um >= 1000 ? um / 1000 + ' mm' : um < 1 ? Math.round(um * 1000) + ' nm' : um + ' µm';
      emit('scale', { px: um * pxPerUm, um, label, distance: dist });
    }, 120);
  }

  // ---------- flights between rungs ----------
  // A flight has two legs joined by a moment of thick haze in which the scene changes: legA (from where the
  // camera is) runs from 0 to swapAt, legB (in the new rung) from swapAt to 1, then the view settles. Between
  // rungs of the same scene (the body) there is no haze: the parts fade as the camera moves (bodyFrom/bodyTo).
  function flyTo(t, seconds, onDone) {
    const v3 = p => new THREE.Vector3().fromArray(p);
    const legA = new THREE.CatmullRomCurve3([camera.position.clone(), ...t.legA.map(v3)], false, 'centripetal');
    const legB = t.legB && t.legB.length > 1 ? new THREE.CatmullRomCurve3(t.legB.map(v3), false, 'centripetal') : null;
    const endQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v3(t.end.pos), v3(t.end.at), new THREE.Vector3(0, 1, 0)));
    flight = { t: 0, dur: reduced ? 0.001 : seconds, legA, legB, fromQ: camera.quaternion.clone(), endQ, target: t, onDone, aimA: t.aimA && v3(t.aimA) };
    orbit.enabled = false; orbit.autoRotate = false; look.on = false;
    wake();
  }
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 2.2);
  const lookQ = (from, to) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0)));
  function stepFlight(dt) {
    const f = flight, T = f.target, sw = T.swapAt ?? 1;
    f.t = Math.min(1, f.t + dt / f.dur);
    const a = LOOK[T.from], b = LOOK[T.to];
    if (sw >= 1) {                                  // one scene: move and fade, no haze
      const s = ease(f.t);
      camera.position.copy(f.legA.getPointAt(s));
      const aim = f.aimA || new THREE.Vector3().fromArray(T.end.at);
      camera.quaternion.copy(f.fromQ).slerp(lookQ(camera.position, aim), THREE.MathUtils.smoothstep(f.t, 0, 0.35)).slerp(f.endQ, THREE.MathUtils.smoothstep(f.t, 0.7, 1));
      if (T.bodyFrom) bodyLook(T.bodyFrom, T.bodyTo, THREE.MathUtils.smoothstep(f.t, 0.1, 0.8));
      post.set({ fog: 0, aoRadius: THREE.MathUtils.lerp(a.aoRadius, b.aoRadius, s), ao: b.ao, edge: b.edge });
      if (T.during) T.during(f.t);
    } else {
      const thick = Math.max(a.fog, b.fog, T.thick || 0) * 4;
      if (f.t < sw) {
        const s = ease(f.t / sw);
        camera.position.copy(f.legA.getPointAt(s));
        const ahead = f.aimA || f.legA.getPointAt(Math.min(1, s + 0.05));
        camera.quaternion.copy(f.fromQ).slerp(lookQ(camera.position, ahead), THREE.MathUtils.smoothstep(f.t / sw, 0, 0.3));
        const k = THREE.MathUtils.smoothstep(f.t, sw - 0.2, sw);
        post.set({ fog: THREE.MathUtils.lerp(a.fog, thick, k * k), aoRadius: a.aoRadius, ao: a.ao, edge: a.edge });
        if (T.during) T.during(f.t);
      } else {
        if (!f.swapped) { f.swapped = true; showLevel(T.to); }
        const u = (f.t - sw) / (1 - sw), s = easeOut(u);
        if (f.legB) {
          camera.position.copy(f.legB.getPointAt(s));
          const ahead = f.legB.getPointAt(Math.min(1, s + 0.06));
          camera.quaternion.copy(lookQ(camera.position, ahead)).slerp(f.endQ, THREE.MathUtils.smoothstep(u, 0.75, 1));
        } else { camera.position.fromArray(T.end.pos); camera.quaternion.copy(f.endQ); }
        const k = THREE.MathUtils.smoothstep(u, 0, 0.35);
        post.set({ fog: THREE.MathUtils.lerp(thick, b.fog, k), aoRadius: b.aoRadius, ao: b.ao, edge: b.edge });
      }
    }
    if (f.t >= 1) {
      flight = null;
      if (level !== T.to) showLevel(T.to);
      if (T.bodyTo) bodyLook(T.bodyTo, T.bodyTo, 1);
      camera.position.fromArray(T.end.pos); camera.lookAt(new THREE.Vector3().fromArray(T.end.at));
      post.set(b);
      setControls(level);
      emit('arrive', level);
      f.onDone && f.onDone();
      measureScale();
    }
  }
  function showLevel(l) {
    level = l;
    for (const k in G) G[k].visible = GROUP[l] === k;
    camera.near = RANGE[l][0]; camera.far = RANGE[l][1]; applyInset();
    if (GROUP[l] === 'body') bodyLook(l, l, 1);
    if (l === 'tissue' && groups.closer) groups.closer.material.opacity = 0;
    emit('level', l);
  }

  // The flight for each step down (and the way back up). Units change at each haze.
  const C = new THREE.Vector3(CELLS.cell[0], CELLS.cell[1], 0);
  const FLIGHTS = {
    'organism>system': () => ({ legA: [[0.5, 0.2, 1.0], VIEWS.system.pos], end: VIEWS.system, from: 'organism', to: 'system', bodyFrom: 'organism', bodyTo: 'system' }),
    'system>organ':    () => ({ legA: [[0.12, 0.10, 0.12], VIEWS.organ.pos], end: VIEWS.organ, from: 'system', to: 'organ', bodyFrom: 'system', bodyTo: 'organ' }),
    'organ>tissue':    () => ({ legA: [[0.03, 0.03, -0.03], [0.002, 0.022, -0.068]], aimA: [-0.011, 0.02, -0.074],
                                legB: [[40, 120, 1900], [10, 60, 1200], VIEWS.tissue.pos], end: VIEWS.tissue, swapAt: 0.45, thick: 2, from: 'organ', to: 'tissue' }),
    'tissue>cell':     () => ({ legA: [[C.x * 0.5, C.y * 0.6, 420], [C.x, C.y, 160], [C.x, C.y, 40], [C.x, C.y, 9]], aimA: C.toArray(),
                                during: t => { if (groups.closer) groups.closer.material.opacity = THREE.MathUtils.smoothstep(t, 0.12, 0.32); },
                                legB: [[95, 110, 120], [55, 45, 62], VIEWS.cell.pos], end: VIEWS.cell, swapAt: 0.55, thick: 0.05, from: 'tissue', to: 'cell' }),
    'cell>inside':     () => ({ legA: [[14, 14, 10], [3, 8.5, -1.5], [0.2, 6.2, -2.4]], aimA: [0, 1, -1.5], legB: PATH_IN, end: VIEWS.inside, swapAt: 0.42, from: 'cell', to: 'inside' }),
    'inside>molecules': () => { const s = molApi.start; return { legA: s.legA, legB: s.legB, end: s.end, swapAt: 0.55, from: 'inside', to: 'molecules' }; },
    // back up
    'system>organism': () => ({ legA: [[0.5, 0.25, 1.1], VIEWS.organism.pos], end: VIEWS.organism, from: 'system', to: 'organism', bodyFrom: 'system', bodyTo: 'organism' }),
    'organ>system':    () => ({ legA: [VIEWS.system.pos], end: VIEWS.system, from: 'organ', to: 'system', bodyFrom: 'organ', bodyTo: 'system' }),
    'tissue>organ':    () => ({ legA: [[0, 0, 1600]], legB: [[0.002, 0.022, -0.068], [0.03, 0.04, -0.01], VIEWS.organ.pos], end: VIEWS.organ, swapAt: 0.3, thick: 2, from: 'tissue', to: 'organ' }),
    'cell>tissue':     () => ({ legA: [[60, 60, 80]], legB: [[C.x, C.y, 60], [0, 0, 500], VIEWS.tissue.pos], end: VIEWS.tissue, swapAt: 0.3, thick: 0.05, from: 'cell', to: 'tissue' }),
    'inside>cell':     () => ({ legA: [[camera.position.x, camera.position.y + 0.3, camera.position.z + 0.2]], legB: [[0.2, 6.2, -2.4], [3, 8.5, -1.5], [14, 14, 10], VIEWS.cell.pos], end: VIEWS.cell, swapAt: 0.2, from: 'inside', to: 'cell' }),
    'molecules>inside': () => ({ legA: [camera.position.toArray()], end: VIEWS.inside, swapAt: 0.4, from: 'molecules', to: 'inside' }),
  };
  const SECONDS = { 'organism>system': 4, 'system>organ': 3.5, 'organ>tissue': 5, 'tissue>cell': 7, 'cell>inside': 9, 'inside>molecules': 3.5 };

  async function step(to) {
    const key = level + '>' + to;
    if (to === 'tissue' || level === 'tissue') await tissueReady;
    if (to === 'cell' || level === 'cell') await cellReady;
    if (to === 'inside') await insideReady;
    if (to === 'molecules' && !molApi) {
      const M = await import('./molecules3d.js?v=' + v);
      molApi = await M.build(THREE, G.mol, { v, small: await insideReady });
    }
    if (level === 'molecules' && molApi) molApi.leaveControls();
    if (to === 'molecules') { molApi.setFrom(camera); molApi.recut({ position: new THREE.Vector3(0, 0.02, 1) }); }
    const secs = SECONDS[key] || 3;
    return new Promise(res => flyTo(FLIGHTS[key](), secs * (api._chain ? 0.55 : 1), () => {
      if (to === 'molecules') molApi.enterControls(camera, cv, wake);
      res();
    }));
  }

  // ---------- render loop: runs only while something changes ----------
  let raf = 0, awake = 0, lastT = 0;
  function wake() { awake = 3; if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
    if (flight) stepFlight(dt);
    if (orbit.enabled) orbit.update();
    if (level === 'inside' && groups.ribo) { groups.ribo.update(camera.position); groups.vesicle.update(camera.position); }
    if (molApi && level === 'molecules') { molApi.tick(dt); molApi.update(); }
    post.render(scene, camera);
    const busy = flight || (orbit.enabled && orbit.autoRotate) || (molApi && level === 'molecules' && molApi.animating());
    if (!busy && --awake <= 0) { lastT = 0; measureScale(); return; }
    raf = requestAnimationFrame(frame);
  }
  // the picture's subject is centred in the space the page leaves free (beside the ruler, above the caption)
  const inset = { left: 0, right: 0, top: 0, bottom: 0 };
  function applyInset() {
    const dx = (inset.left - inset.right) / 2, dy = (inset.bottom - inset.top) / 2;
    if (dx || dy) camera.setViewOffset(W(), H(), -dx, dy, W(), H()); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => { camera.aspect = W() / H(); applyInset(); renderer.setSize(W(), H()); post.setSize(W(), H(), dpr); wake(); measureScale(); });
  ro.observe(el);

  showLevel('organism');
  camera.position.fromArray(VIEWS.organism.pos); camera.lookAt(new THREE.Vector3().fromArray(VIEWS.organism.at));
  setControls('organism'); post.set(LOOK.organism);
  wake();

  const api = {
    THREE, camera, scene, renderer, post, groups, counts, insideReady, cellReady, tissueReady,
    get level() { return level; },
    get flying() { return !!flight; },
    get molecules() { return molApi; },
    on(k, f) { listeners[k].push(f); return api; },
    setInset(o) { Object.assign(inset, o); applyInset(); wake(); },
    // go to any rung, one step at a time
    async goTo(to) {
      const a = LEVELS.indexOf(level), b = LEVELS.indexOf(to);
      if (a < 0 || b < 0 || a === b || flight) return;
      const dir = b > a ? 1 : -1;
      api._chain = Math.abs(b - a) > 1;
      for (let i = a; i !== b; i += dir) await step(LEVELS[i + dir]);
      api._chain = false;
    },
    setShown(part, on) {
      G.inside.traverse(o => { if (o.userData.part === part) o.visible = on; });
      if (groups[part] && groups[part].mesh) { groups[part].mesh.visible = on; if (groups[part].pts) groups[part].pts.visible = on; }
      wake();
    },
    view(pos, at) {
      camera.position.fromArray(pos); camera.lookAt(new THREE.Vector3().fromArray(at));
      if (level === 'molecules' && molApi) molApi.recut(camera);
      if (look.on) syncLook();
      if (orbit.enabled) { orbit.target.fromArray(at); orbit.update(); }
      wake();
    },
    render() { if (groups.ribo && level === 'inside') { groups.ribo.update(camera.position, true); groups.vesicle.update(camera.position, true); } post.render(scene, camera); },
    // for checks: put a running flight at time t (0..1) and draw that frame
    seekFlight(t) { if (!flight) return false; flight.t = Math.min(1, Math.max(0, t)); stepFlight(0); post.render(scene, camera); return true; },
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
function makePost(renderer, o) {
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.FloatType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType, depthTexture: depth });
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
      uniform sampler2D tColor, tAO; uniform vec2 uAORes; uniform float uAO, uFog, uEdge; uniform vec3 uFogColor;
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
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, mat,
    setSize(w, h, dpr) {
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      rt.setSize(W, H); U.uRes.value.set(W, H);
      const aw = Math.max(1, Math.round(W / 2)), ah = Math.max(1, Math.round(H / 2));
      aoRT.setSize(aw, ah); U.uAORes.value.set(aw, ah);
    },
    set(p) { if (p.fog != null) U.uFog.value = p.fog; if (p.aoRadius != null) U.uRadius.value = p.aoRadius; if (p.ao != null) U.uAO.value = p.ao; if (p.edge != null) U.uEdge.value = p.edge; },
    render(scene, camera) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      U.uProj.value.copy(camera.projectionMatrix); U.uInvProj.value.copy(camera.projectionMatrixInverse);
      quad.material = aoMat; renderer.setRenderTarget(aoRT); renderer.render(qs, qc);
      quad.material = mat; renderer.setRenderTarget(null); renderer.render(qs, qc);
    },
  };
}
