/* Why a mitochondrion looks like an oval in a book: two real mitochondria of the HeLa cell, each in its photograph
   (the one slice the page shows) and in 3D (tools/model-build/build_mito_demo.py, assets/cell/mito-demo.*).

   A few steps, each one waits for "Next step" (the reader reads, then moves on). The photograph is a flat sheet in
   the 3D, where it was taken; the outlines on it are the computer's own, from the same labels as the 3D tubes. One
   step shows an imagined slice straight across the tube: its outline is worked out from the real tube's shape.

   start(el, { v }) -> { next(), back(), restart(), dispose() } ; el holds .md__stage and the step text and buttons
*/
import * as THREE from './vendor/three/build/three.module.min.js?v=0.185.1';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js?v=0.185.1';

const ORANGE = 0xe8613a;
const STEPS = [
  { ex: 0, cam: 'face', photo: 1, tube: 0, text: 'In a photograph from an electron microscope, a mitochondrion often looks like this: an <b>oval</b>, with folds inside (the cristae). Books draw it the same way. This one is in the photograph of this cell, outlined in orange.' },
  { ex: 0, cam: 'sheet', photo: 1, tube: 0, text: 'But the photograph shows only <b>one very thin slice</b> of the cell, about 5 nm thick: like one slice cut from a loaf of bread.' },
  { ex: 0, cam: 'side', photo: 0.82, tube: 1, text: 'The microscope photographed hundreds of slices. Put together, they show this mitochondrion in 3D: a <b>tube</b> {L} µm long and about {W} µm wide.' },
  { ex: 0, cam: 'edge', photo: 0.82, tube: 1, text: 'The slice cuts the tube <b>at a slant</b>. That is why the photograph shows an oval, not a tube.' },
  { ex: 0, cam: 'across', photo: 0, tube: 1, cut: true, text: 'An imagined slice <b>straight across</b> the same tube would show a <b>circle</b>. One tube: a circle, an oval or a long shape, depending on how the slice cuts it.' },
  { ex: 1, cam: 'face', photo: 1, tube: 0, text: 'In the same photograph, these <b>two shapes</b> look like two different mitochondria.' },
  { ex: 1, cam: 'sheet', photo: 0.6, tube: 1, text: 'In 3D they are <b>one mitochondrion</b>: a tube {L} µm long that passes through the slice twice.' },
];

export async function start(el, { v = '' } = {}) {
  const stage = el.querySelector('.md__stage'), textEl = el.querySelector('.md__text'), countEl = el.querySelector('.md__count');
  const btnNext = el.querySelector('.md__next'), btnBack = el.querySelector('.md__back');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0e141b, 1);
  renderer.localClippingEnabled = true;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(2, 3, 4); scene.add(sun);
  const label = document.createElement('span'); label.className = 'md__tag'; stage.appendChild(label);

  const [meta, gltf] = await Promise.all([
    fetch('assets/cell/mito-demo.json?v=' + v).then(r => r.json()),
    new GLTFLoader().loadAsync('assets/cell/mito-demo.glb?v=' + v),
  ]);
  const texLoader = new THREE.TextureLoader();
  const ex = await Promise.all(meta.demos.map(async (d, k) => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    // the photograph, a flat sheet where it was taken (x, y as it is shown; z out of it, towards the reader)
    const [x0, x1, y0, y1] = d.crop;
    const tex = await texLoader.loadAsync('assets/cell/' + d.image + '?v=' + v); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const photoMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: true, toneMapped: false });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), photoMat);
    photo.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); g.add(photo);
    // the computer's outlines, on both faces of the sheet
    // (they belong to the photograph: they fade with it)
    const lineMat = new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false, transparent: true }), lines = new THREE.Group();
    for (const q of d.outlines) for (const z of [0.004, -0.004]) {
      const curve = new THREE.CatmullRomCurve3(q.map(p => new THREE.Vector3(p[0], p[1], z)), true);
      lines.add(new THREE.Mesh(new THREE.TubeGeometry(curve, q.length * 2, 0.011, 6, true), lineMat));
    }
    g.add(lines);
    // the tube, from all the slices
    const src = gltf.scene.getObjectByName('mito' + (k + 1));
    const geo = (src.isMesh ? src : src.children.find(c => c.isMesh)).geometry.clone();
    geo.computeVertexNormals();
    const tubeMat = new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.55, metalness: 0, transparent: true, side: THREE.DoubleSide });
    const tube = new THREE.Mesh(geo, tubeMat); g.add(tube);
    // its long axis and middle (for the views and the imagined slice)
    const P = geo.attributes.position, c = new THREE.Vector3(), n = P.count;
    for (let i = 0; i < n; i++) c.add(new THREE.Vector3().fromBufferAttribute(P, i)); c.divideScalar(n);
    const a = new THREE.Vector3(1, 0, 0);
    for (let it = 0; it < 30; it++) {                 // power iteration on the spread of the points
      const b = new THREE.Vector3();
      for (let i = 0; i < n; i += 3) { const p = new THREE.Vector3().fromBufferAttribute(P, i).sub(c); b.addScaledVector(p, p.dot(a)); }
      a.copy(b.normalize());
    }
    if (d.across) { c.fromArray(d.across.centre); a.fromArray(d.across.axis); }
    return { d, g, photo, photoMat, lineMat, lines, tube, tubeMat, c, a, x0, x1, y0, y1 };
  }));

  // the imagined slice straight across the first tube: a grey sheet, and the outline of the cut (made from the tube's
  // own surface when the files were built: build_mito_demo.py)
  const E0 = ex[0];
  const cutGroup = new THREE.Group(); cutGroup.visible = false; E0.g.add(cutGroup);
  {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), E0.a);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    sheet.position.copy(E0.c); sheet.quaternion.copy(q); cutGroup.add(sheet);
    const big = E0.d.across.loop.map(p => new THREE.Vector3(...p));     // (worked out when the files were built)
    if (big.length > 1 && big[0].distanceTo(big[big.length - 1]) < 1e-4) big.pop();   // (a closed loop lists its first point again)
    if (big.length > 8) {
      const mat = new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false });
      const off = E0.a.clone().multiplyScalar(0.004);
      for (const o of [off, off.clone().negate()]) cutGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(big.map(p => p.clone().add(o)), true), big.length, 0.011, 6, true), mat));
      // the cut face, filled
      const inv = q.clone().invert(), flat = big.map(p => p.clone().sub(E0.c).applyQuaternion(inv));
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(flat.map(p => new THREE.Vector2(p.x, p.y)))), new THREE.MeshBasicMaterial({ color: 0xf6a27f, side: THREE.DoubleSide, toneMapped: false }));
      fill.position.copy(E0.c); fill.quaternion.copy(q); cutGroup.add(fill);
      const r = flat.map(p => p.length()), w = 2 * r.reduce((s, x) => s + x, 0) / r.length;
      cutGroup.userData.width = w;
    }
    // (on that step the tube is cut open there: the half towards the reader is taken away, and the cut face shows)
    cutGroup.userData.clip = new THREE.Plane().setFromNormalAndCoplanarPoint(E0.a.clone().negate(), E0.c);
  }

  // the views of each step
  const fov = camera.fov * Math.PI / 360;
  function viewOf(s) {
    const E = ex[s.ex], centre = new THREE.Vector3((E.x0 + E.x1) / 2, (E.y0 + E.y1) / 2, 0);
    const size = Math.max(E.x1 - E.x0, E.y1 - E.y0);
    if (s.cam === 'face') return { pos: centre.clone().add(new THREE.Vector3(0, 0, size / 2 / Math.tan(fov) * 1.08)), at: centre, up: new THREE.Vector3(0, 1, 0) };
    // from the side of the tube, the photograph seen at a slant: the tube broadside
    const z = new THREE.Vector3(0, 0, 1), side = z.clone().sub(E.a.clone().multiplyScalar(z.dot(E.a))).normalize();
    const L = E.d.length_um, at = E.c.clone().lerp(new THREE.Vector3(0, 0, 0), 0.5);
    if (s.cam === 'edge') {                          // nearly along the sheet: the slice is a line through the tube
      const dir = E.a.clone().cross(z).normalize().addScaledVector(z, 0.22).normalize();   // across the tube, in the sheet
      return { pos: at.clone().addScaledVector(dir, L * 0.62 / Math.tan(fov)), at, up: new THREE.Vector3(0, 1, 0) };
    }
    if (s.cam === 'across') {                        // looking at the cut face, a little from the side
      const dir = E.a.clone().multiplyScalar(0.8).add(side.clone().multiplyScalar(0.6)).normalize();
      return { pos: E.c.clone().addScaledVector(dir, 1.5 / Math.tan(fov)), at: E.c.clone().addScaledVector(E.a, -0.6), up: new THREE.Vector3(0, 1, 0) };
    }
    if (s.cam === 'sheet') {                         // the photograph as a sheet in space, filling the view
      const dir = side.clone().multiplyScalar(0.8).add(new THREE.Vector3(0.35, 0.45, 0)).normalize();
      return { pos: centre.clone().addScaledVector(dir, size * 0.72 / Math.tan(fov)), at: centre, up: new THREE.Vector3(0, 1, 0) };
    }
    const dir = side.clone().multiplyScalar(0.8).add(new THREE.Vector3(0.35, 0.45, 0)).normalize();
    return { pos: at.clone().addScaledVector(dir, L * 0.62 / Math.tan(fov)), at, up: new THREE.Vector3(0, 1, 0) };
  }

  let step = 0, raf = 0, from = null, to = null, t0 = 0, look = new THREE.Vector3();
  const DUR = reduced ? 1 : 1400;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => { resize(); draw(); }); ro.observe(stage);
  function placeLabel() {
    const s = STEPS[step], E = ex[s.ex];
    const p = (s.cut ? E.c.clone().add(new THREE.Vector3(0, 0.75, 0)) : new THREE.Vector3(E.x0 + 0.08, E.y1 - 0.08, 0)).project(camera);
    label.textContent = s.cut ? 'Imagined slice' : 'The photograph: one slice';
    label.style.transform = `translate(${((p.x + 1) / 2 * stage.clientWidth).toFixed(0)}px, ${((1 - p.y) / 2 * stage.clientHeight).toFixed(0)}px)`;
    label.hidden = p.z > 1 || s.cam === 'face' || s.cam === 'edge';
  }
  function draw() { renderer.render(scene, camera); placeLabel(); }
  function frame(now) {
    raf = 0;
    const k = Math.min(1, (now - t0) / DUR), e = ease(k);
    camera.position.lerpVectors(from.pos, to.pos, e);
    look.lerpVectors(from.at, to.at, e); camera.up.copy(to.up); camera.lookAt(look);
    for (const E of ex) {
      if (!E.g.visible) continue;
      E.photoMat.opacity = THREE.MathUtils.lerp(E.from.photo, E.to.photo, e);
      E.lineMat.opacity = Math.min(1, E.photoMat.opacity / 0.3); E.photo.visible = E.lines.visible = E.photoMat.opacity > 0.01;
      E.tubeMat.opacity = THREE.MathUtils.lerp(E.from.tube, E.to.tube, e);
      E.tube.visible = E.tubeMat.opacity > 0.01;
    }
    draw();
    if (k < 1) raf = requestAnimationFrame(frame);
  }
  function show(i, jump) {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[step], E = ex[s.ex];
    const switching = !E.g.visible;
    ex.forEach((X, k) => { X.g.visible = k === s.ex; });
    cutGroup.visible = !!s.cut;
    E0.tubeMat.clippingPlanes = s.cut ? [cutGroup.userData.clip] : null; E0.tubeMat.needsUpdate = true;
    from = switching || jump || !to ? viewOf(s) : { pos: camera.position.clone(), at: look.clone(), up: camera.up.clone() };
    if (switching || jump) { camera.position.copy(from.pos); look.copy(from.at); }
    to = viewOf(s);
    E.from = { photo: switching || jump ? s.photo : E.photoMat.opacity, tube: switching || jump ? s.tube : E.tubeMat.opacity };
    E.to = { photo: s.photo, tube: s.tube };
    const L = E.d.length_um.toFixed(1), W = (2 * Math.sqrt(E.d.volume_um3 / (Math.PI * E.d.length_um))).toFixed(1);
    textEl.innerHTML = s.text.replace('{L}', L).replace('{W}', W);
    countEl.textContent = 'Step ' + (step + 1) + ' of ' + STEPS.length;
    btnBack.disabled = step === 0;
    btnNext.textContent = step === STEPS.length - 1 ? 'Start again' : 'Next step';
    t0 = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
  }
  resize(); show(0, true);
  return {
    next() { show(step === STEPS.length - 1 ? 0 : step + 1, step === STEPS.length - 1); },
    back() { show(step - 1); },
    restart() { show(0, true); },
    get step() { return step; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); label.remove(); },
  };
}
