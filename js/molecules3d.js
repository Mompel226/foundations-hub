/* The molecule level: a MODEL of a slab of cytoplasm 0.2 µm wide and 70 nm thick (a cross-section, as in
   David Goodsell's paintings), loaded only when the reader zooms in this far.

   Measured, and used here:  the shape and size of each kind of protein (Protein Data Bank; drawn from its
   alpha-carbons), how many of each kind a HeLa cell holds (Mueller et al. 2020, Nature 583:819, via PaxDb),
   3 million protein molecules per µm³ (Milo 2013), the microtubule lattice (13 protofilaments, 8 nm tubulin
   dimers, 25 nm wide), kinesin's 8 nm steps, hand over hand, on one protofilament, towards the plus end
   (Yildiz et al. 2004, Science 303:676), the vesicle's size (this cell's median, 56 nm).
   Made up for the picture: where each molecule sits and which way it points (at random, never overlapping),
   the kinesin's stalk and light chains (drawn as simple shapes), and the timing: kinesin takes about 100 steps
   a second; here it takes one a second. In that time the other molecules would move hundreds of nanometres:
   they would be a blur, so here they only make way for the vesicle.

   build(THREE, group, opts) -> { start, tick(dt), animating(), enterControls(camera, canvas, wake), leaveControls(), labels }
*/
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js?v=0.185.1';
import { MeshoptDecoder } from './vendor/three/examples/jsm/libs/meshopt_decoder.module.js?v=0.185.1';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js?v=0.185.1';

const STEP_NM = 0.008, STEPS = 10, STEP_S = 1.0;

export async function build(THREE, group, opts = {}) {
  const v = opts.v || '1';
  const [gltf, buf, meta] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/mol/molecules.glb?v=' + v),
    fetch('assets/mol/crowd.bin?v=' + v).then(r => r.arrayBuffer()),
    fetch('assets/mol/crowd.json?v=' + v).then(r => r.json()),
  ]);
  const geo = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const k = o.name.replace(/^m_/, '').replace(/_\d+$/, '');
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);          // undo the quantisation transform: geometry in µm, centred
    if (!g.attributes.normal) g.computeVertexNormals();
    geo[k] = g;
  });
  const mat = k => new THREE.MeshLambertMaterial({ color: meta.colours[k] ?? 0x999999 });
  // the crowd ends in a disc with a soft edge, not in the slab's square corners (seen from further away on the
  // way in, a square of molecules floating among the organelles looked made up); the microtubule runs on past it
  const DISC = { c: [0, 0.015], r: 0.1, soft: 0.014 };
  const discMat = k => {
    const m = mat(k);
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDisc;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 dp = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  dp = instanceMatrix * dp;\n  #endif\n  vDisc = dp.xy; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vDisc;')
        .replace('void main() {', `void main() {
  { float rr = length(vDisc - vec2(${DISC.c[0]}, ${DISC.c[1]})), e = rr - ${(DISC.r - DISC.soft).toFixed(4)};
    if (rr > ${DISC.r.toFixed(4)} || (e > 0.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) < e / ${DISC.soft.toFixed(4)})) discard; }`);
    };
    m.customProgramCacheKey = () => 'disc';
    return m;
  };
  const labels = meta.labels;

  // ---------- the crowd ----------
  const dv = new DataView(buf);
  const n = dv.getUint32(8, true);
  const byType = {};
  for (let i = 0, o = 12; i < n; i++, o += 17) {
    const t = meta.names[dv.getUint8(o)];
    const p = [dv.getFloat32(o + 1, true), dv.getFloat32(o + 5, true), dv.getFloat32(o + 9, true)];
    const q = [dv.getInt8(o + 13) / 127, dv.getInt8(o + 14) / 127, dv.getInt8(o + 15) / 127, dv.getInt8(o + 16) / 127];
    (byType[t] = byType[t] || []).push({ p, q });
  }
  const crowd = [];     // every instance: { mesh, i, home, pos, quat, r }
  const m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  // the cross-section: molecules between the eye and the microtubule's plane are left out, so the
  // microtubule, the kinesin and the vesicle can be seen (as in a painting of a slice of a cell)
  const CUT = 0.011, target = new THREE.Vector3(0, 0.02, 0), toEye = new THREE.Vector3(0, 0, 1);
  const place = c => { m4.compose(c.pos, c.quat, c.cut ? zero : one); c.mesh.setMatrixAt(c.i, m4); c.mesh.instanceMatrix.needsUpdate = true; };
  function recut(camera) {
    toEye.copy(camera.position).sub(target).normalize();
    for (const c of crowd) {
      const cut = c.home.clone().sub(target).dot(toEye) > CUT;
      if (cut !== c.cut) { c.cut = cut; place(c); }
    }
  }
  for (const [k, list] of Object.entries(byType)) {
    if (!geo[k]) continue;
    const mesh = new THREE.InstancedMesh(geo[k], discMat(k), list.length);
    mesh.userData.part = 'molecule'; mesh.userData.label = labels[k];
    geo[k].computeBoundingSphere();
    const r = geo[k].boundingSphere.radius;
    list.forEach((it, i) => {
      const quat = new THREE.Quaternion(...it.q).normalize(), home = new THREE.Vector3(...it.p);
      m4.compose(home, quat, one); mesh.setMatrixAt(i, m4);
      crowd.push({ mesh, i, home, pos: home.clone(), quat, r: r * 0.75, cut: false });
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // ---------- the microtubule: 13 protofilaments of alpha/beta tubulin, plus end towards +x ----------
  const PF = 13, Rm = 0.0102, x0 = -0.112, x1 = 0.112;
  const per = Math.ceil((x1 - x0) / 0.008);
  const tubA = new THREE.InstancedMesh(geo.tub_a, mat('tub_a'), PF * per), tubB = new THREE.InstancedMesh(geo.tub_b, mat('tub_b'), PF * per);
  tubA.userData.part = tubB.userData.part = 'molecule';
  tubA.userData.label = 'alpha-tubulin, part of a microtubule'; tubB.userData.label = 'beta-tubulin, part of a microtubule';
  // which protofilament faces the vesicle (+y): the kinesin walks on it
  let top = 0, best = -2;
  let k = 0;
  for (let p = 0; p < PF; p++) {
    const phi = p / PF * Math.PI * 2;
    if (Math.sin(phi) > best) { best = Math.sin(phi); top = p; }
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), phi);
    const off = p * 0.00092;                     // the three-start helix: 0.92 nm per protofilament
    for (let j = 0; j < per; j++) {
      const x = x0 + j * 0.008 + off;
      const y = Math.sin(phi) * Rm, z = Math.cos(phi) * Rm;
      m4.compose(new THREE.Vector3(x, y, z), rot, one); tubA.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x + 0.004, y, z), rot, one); tubB.setMatrixAt(k, m4);
      k++;
    }
  }
  [tubA, tubB].forEach(m => { m.computeBoundingSphere(); group.add(m); });
  const phiTop = top / PF * Math.PI * 2, offTop = top * 0.00092;
  const surfY = Math.sin(phiTop) * (Rm + 0.0065), surfZ = Math.cos(phiTop) * (Rm + 0.0065);

  // ---------- ribosomes (a short polysome) ----------
  const ribo = new THREE.InstancedMesh(geo.ribo, mat('ribo'), meta.ribosomes.length);
  ribo.userData.part = 'molecule'; ribo.userData.label = labels.ribo;
  meta.ribosomes.forEach((p, i) => { m4.compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 1.3, i * 2.1, i * 0.7)), one); ribo.setMatrixAt(i, m4); });
  ribo.computeBoundingSphere(); group.add(ribo);

  // ---------- the vesicle, and the kinesin that pulls it ----------
  const V = meta.vesicle;
  const ves = new THREE.Mesh(new THREE.IcosahedronGeometry(V.r, 4), new THREE.MeshLambertMaterial({ color: 0xe9dcc0 }));
  ves.userData.part = 'molecule'; ves.userData.label = 'a vesicle (its membrane is a double layer of lipids)';
  group.add(ves);
  // the motor is the one thing here that is lit from within, so the eye finds it in the crowd
  const kinMat = c => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 });
  const headA = new THREE.Mesh(geo.kin_a, kinMat(0xff9a2e)), headB = new THREE.Mesh(geo.kin_b, kinMat(0xffb04d));
  headA.userData.part = headB.userData.part = 'molecule';
  headA.userData.label = headB.userData.label = 'kinesin, a motor protein (one of its two heads)';
  group.add(headA, headB);
  const stalkMat = new THREE.MeshLambertMaterial({ color: 0xffa23a, emissive: 0xffa23a, emissiveIntensity: 0.3 });
  const stalk = new THREE.Mesh(new THREE.BufferGeometry(), stalkMat);
  stalk.userData.part = 'molecule'; stalk.userData.label = 'kinesin’s stalk (drawn as a simple coiled rod)';
  group.add(stalk);
  const tails = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0032, 12, 8), new THREE.MeshLambertMaterial({ color: 0xf6d18a }), 2);
  tails.userData.part = 'molecule'; tails.userData.label = 'kinesin’s light chains, which hold the cargo (drawn as simple shapes)';
  group.add(tails);

  // the walk: heads at sA, sB on the top protofilament (x positions); the step is hand over hand
  const startX = -0.02 + offTop;
  const state = { t: 0, playing: true };
  const ease = u => u * u * (3 - 2 * u);
  function pose(t) {
    const total = STEPS * STEP_S;
    const tt = Math.min(t, total);
    const i = Math.floor(tt / STEP_S), u = (tt - i * STEP_S) / STEP_S;
    // before step i: rear head at startX + i*8 nm, front at +8 nm more; heads swap roles each step
    const rear = startX + i * STEP_NM, front = rear + STEP_NM;
    const moving = i % 2 === 0 ? headA : headB, still = i % 2 === 0 ? headB : headA;
    let mx, my = surfY, mz = surfZ;
    if (i >= STEPS) { mx = rear; }
    else if (u < 0.25) { mx = rear; my += 0.003 * ease(u / 0.25); }
    else if (u < 0.75) { const w = ease((u - 0.25) / 0.5); mx = rear + 2 * STEP_NM * w; my += 0.003 + 0.006 * Math.sin(Math.PI * w); mz += 0.004 * Math.sin(Math.PI * w); }
    else if (u < 0.9) { mx = rear + 2 * STEP_NM; my += 0.003 * (1 - ease((u - 0.75) / 0.15)); }
    else { mx = rear + 2 * STEP_NM; }
    moving.position.set(mx, my, mz); still.position.set(front, surfY, surfZ);
    moving.rotation.set(0, 0, i < STEPS && u > 0.25 && u < 0.75 ? Math.PI * ease((u - 0.25) / 0.5) : 0);
    still.rotation.set(0, 0, 0);
    // the neck, between the heads and a little above them
    const neck = new THREE.Vector3((moving.position.x + still.position.x) / 2, surfY + 0.007, surfZ * 0.5);
    // the cargo trails behind, 25 nm back, and catches up a little after each step
    const lag = 0.025;
    ves.position.set(neck.x - lag, V.c[1] + 0.0015 * Math.sin(t * 2.1), V.c[2] + 0.002 * Math.sin(t * 1.3));
    // the stalk: a gentle curve from the neck to the bottom of the vesicle, with a hinge half way
    const tailP = ves.position.clone().add(new THREE.Vector3(0.006, -V.r * 0.92, 0));
    const mid = neck.clone().lerp(tailP, 0.5).add(new THREE.Vector3(0.006, 0.002, 0.003));
    const curve = new THREE.CatmullRomCurve3([neck, mid, tailP]);
    stalk.geometry.dispose();
    stalk.geometry = new THREE.TubeGeometry(curve, 24, 0.0013, 6, false);
    m4.compose(tailP.clone().add(new THREE.Vector3(-0.003, 0.001, 0.003)), new THREE.Quaternion(), one); tails.setMatrixAt(0, m4);
    m4.compose(tailP.clone().add(new THREE.Vector3(0.003, 0.001, -0.003)), new THREE.Quaternion(), one); tails.setMatrixAt(1, m4);
    tails.instanceMatrix.needsUpdate = true;
    // the crowd makes way: anything inside the vesicle's reach is pushed out, and drifts home after
    for (const c of crowd) {
      const d = c.pos.distanceTo(ves.position), need = V.r + c.r;
      const dh = c.home.distanceTo(ves.position);
      let goal = c.home;
      if (dh < need + 0.004) {
        const dir = c.home.clone().sub(ves.position); if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0);
        goal = ves.position.clone().add(dir.normalize().multiplyScalar(need + 0.004));
      }
      if (c.pos.distanceToSquared(goal) > 1e-12 || d < need) {
        c.pos.lerp(goal, 0.25);
        place(c);
      }
    }
  }
  pose(0);

  let orbit = null;
  const start = {
    legA: null, legB: [[0.03, 0.05, 0.95], [0.012, 0.035, 0.45], [0.0, 0.03, 0.2]],
    end: { pos: [0.0, 0.03, 0.17], at: [-0.01, 0.03, 0.0] },
  };
  return {
    start, labels,
    // the way in: straight ahead from wherever the reader stands among the organelles
    setFrom(camera) {
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      start.legA = [camera.position.clone().addScaledVector(d, 0.12).toArray(), camera.position.clone().addScaledVector(d, 0.25).toArray()];
    },
    tick(dt) {
      if (!state.playing) return;
      state.t += dt;
      const loop = STEPS * STEP_S + 2.5;
      if (state.t > loop) { state.t = 0; for (const c of crowd) c.pos.copy(c.home); }
      pose(state.t);
    },
    animating() { return state.playing; },
    play(on) { state.playing = on; },
    get playing() { return state.playing; },
    seek(t) { state.t = t; pose(t); },
    // where the moving things are now, for their names (model frame, µm)
    where() { return { vesicle: ves.position.toArray(), kinesin: headA.position.clone().lerp(headB.position, 0.5).toArray() }; },
    recut,
    enterControls(camera, canvas, wake) {
      recut(camera);
      orbit = new OrbitControls(camera, canvas);
      orbit.target.set(-0.01, 0.03, 0); orbit.enableDamping = true; orbit.enablePan = false;
      orbit.minDistance = 0.1; orbit.maxDistance = 0.45;
      orbit.minAzimuthAngle = -0.9; orbit.maxAzimuthAngle = 0.9; orbit.minPolarAngle = 0.8; orbit.maxPolarAngle = 2.3;
      orbit.addEventListener('change', () => { recut(camera); wake(); }); orbit.update();
    },
    leaveControls() { if (orbit) { orbit.dispose(); orbit = null; } },
    update() { if (orbit) orbit.update(); },
  };
}
