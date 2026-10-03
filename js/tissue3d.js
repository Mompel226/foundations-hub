/* The tissue level: a MODEL of a block of the lining of the canal of the cervix, cut open on its front face, in µm.

   Its front face is the micrograph beside it, traced (assets/tissue/trace.json, tools/model-build/trace_tissue.py):
   inside the green frame, the surface of the lining with its fold, the gland cut across (with a second one at
   the bottom left), and the small blood vessels are where the photograph has them, at its scale (0.38 µm a
   pixel). Outside the frame the block goes on in the same way, with a crypt opening onto the surface.
   Measured on the photograph: cells about 40 µm tall on the surface and 65 µm in the glands, each nucleus near
   the base of its cell (IARC Screening Group's atlas, "Anatomical considerations – columnar epithelium").
   Made up: the exact place of every cell, nucleus and fibre (at random, at those sizes), and the block behind
   the face (each gland runs straight back into the wall: a crypt cut across).
   Colours: those of the stain (haematoxylin and eosin), as in the photograph and the organ's cut face.

   Frame: origin on the surface of the lining in the middle of the photograph (the point the zoom dives to on
   the cut organ), +y out of the lining into the canal, +z out of the cut face towards the reader.

   build(THREE, group, trace) -> { target, labels, single, frameMat, materials, size }
*/
const PITCH = 7, R_HEX = 3.9, H_GEO = 30, L = 1000, BOTTOM = -900, DEPTH = 300;
const CRYPT_X = 640, CRYPT_HALF = 22;          // a crypt opening onto the surface, outside the photograph's frame
const COL = { side: 0xD9B3CC, top: 0xF0E6F1, cut: 0xE8C9DD, mucin: 0xF4EDF4, nucleus: 0x5B4BB5, stromaSide: 0xDE9DB3 };

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// a polyline through points, smoothed (Catmull-Rom) and resampled every `step` µm
function resample(P, step = 2) {
  const out = [];
  const at = i => P[Math.max(0, Math.min(P.length - 1, i))];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(len / (step / 4)));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  const even = [out[0]]; let carry = 0;              // even spacing
  for (let i = 1; i < out.length; i++) {
    let a = out[i - 1]; const b = out[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (carry + d >= step) { const t = (step - carry) / d; a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; even.push(a); d = Math.hypot(b[0] - a[0], b[1] - a[1]); carry = 0; }
    carry += d;
  }
  return even;
}
// the normal on the left of the direction of travel, smoothed over a few points
function normals(P) {
  const n = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  });
  return n.map((_, i) => { let x = 0, y = 0; for (let k = -3; k <= 3; k++) { const j = Math.max(0, Math.min(n.length - 1, i + k)); x += n[j][0]; y += n[j][1]; } const l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
}

// A columnar cell: a six-sided column, base at y = 0, height H_GEO (scaled per cell), a low dome on top. cut: only
// the half behind z = 0, with a flat face at z = 0 coloured as the stain colours it (pale above, pink below).
function cellGeometry(THREE, cut) {
  const pos = [], col = [], c = new THREE.Color();
  const ring = k => { const a = Math.PI / 6 + k * Math.PI / 3; return [Math.cos(a) * R_HEX, Math.sin(a) * R_HEX]; };   // [x, z]
  const push = (p, hex) => { pos.push(...p); c.setHex(hex); col.push(c.r, c.g, c.b); };
  const tri = (a, b, d, ha, hb, hd) => { push(a, ha); push(b, hb ?? ha); push(d, hd ?? ha); };
  const top = H_GEO, dome = 1.6;
  const keep = ([, z]) => !cut || z <= 0;
  const clipZ = (p, q) => { const t = p[1] / (p[1] - q[1]); return [p[0] + (q[0] - p[0]) * t, 0]; };
  let poly = [0, 1, 2, 3, 4, 5].map(ring);
  if (cut) {
    const out = [];
    for (let i = 0; i < 6; i++) { const p = poly[i], q = poly[(i + 1) % 6]; if (keep(p)) out.push(p); if (keep(p) !== keep(q)) out.push(clipZ(p, q)); }
    poly = out;
  }
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if (cut && Math.abs(p[1]) < 1e-6 && Math.abs(q[1]) < 1e-6) continue;
    tri([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], top, q[1]], COL.side);
    tri([p[0], 0, p[1]], [q[0], top, q[1]], [p[0], top, p[1]], COL.side);
    tri([p[0], top, p[1]], [q[0], top, q[1]], [0, top + dome, 0], COL.top);
  }
  if (cut) {
    const xs = poly.filter(p => Math.abs(p[1]) < 1e-6).map(p => p[0]).sort((a, b) => a - b);
    const x0 = xs[0], x1 = xs[xs.length - 1], ym = top * 0.42;
    tri([x0, 0, 0], [x1, ym, 0], [x1, 0, 0], COL.cut);
    tri([x0, 0, 0], [x0, ym, 0], [x1, ym, 0], COL.cut);
    tri([x0, ym, 0], [x1, top, 0], [x1, ym, 0], COL.cut, COL.mucin, COL.cut);
    tri([x0, ym, 0], [x0, top, 0], [x1, top, 0], COL.cut, COL.mucin, COL.mucin);
    tri([x0, top, 0], [0, top + dome, 0], [x1, top, 0], COL.mucin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// The connective tissue's cut face, painted (1 pixel = 1 µm): pale pink fibres, the long dark nuclei of fibroblasts,
// a few round nuclei of white blood cells, and the small blood vessels: the traced ones where the photograph has
// them, more of the same outside its frame.
function stromaTexture(THREE, T) {
  const W = 2 * L, TOP = 60, H = Math.round(-BOTTOM) + TOP + 4;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rnd(11);
  const X = x => x + L, Y = y => TOP - y;
  g.fillStyle = '#EBB0C3'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 350; i++) {
    const x = r() * W, y = r() * H, len = 30 + r() * 90, a = (r() - 0.5) * 0.9;
    g.strokeStyle = `rgba(${200 + r() * 30 | 0},${110 + r() * 40 | 0},${140 + r() * 30 | 0},${0.25 + r() * 0.35})`;
    g.lineWidth = 0.8 + r() * 1.6; g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.33, y + Math.sin(a * 5) * 6 + len * a * 0.3, x + len * 0.66, y - 5 + len * a * 0.6, x + len, y + len * a);
    g.stroke();
  }
  for (let i = 0; i < W * H / 1750; i++) {
    const x = r() * W, y = r() * H, a = (r() - 0.5) * 0.8;
    g.fillStyle = `rgba(${70 + r() * 20 | 0},${40 + r() * 15 | 0},${120 + r() * 30 | 0},0.92)`;
    g.beginPath(); g.ellipse(x, y, 5 + r() * 3, 1.3 + r() * 0.8, a, 0, 7); g.fill();
  }
  for (let i = 0; i < W * H / 13000; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = '#3E2A78'; g.beginPath(); g.arc(x, y, 2.6 + r() * 0.6, 0, 7); g.fill();
  }
  const vessel = (x, y, rx, ry, a) => {
    g.save(); g.translate(X(x), Y(y)); g.rotate(a);
    g.fillStyle = '#F6E3EA'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = '#B04C78'; g.lineWidth = 1.5; g.stroke();
    // red blood cells along it (7.5 µm discs), and the long nucleus of a cell of its wall
    for (let k = -rx + 5; k < rx - 4; k += 6.5) { g.fillStyle = '#E0367A'; g.beginPath(); g.ellipse(k, (r() - 0.5) * Math.max(0, ry - 5), 3.6, Math.max(1.5, Math.min(3.3, ry - 1)), r(), 0, 7); g.fill(); }
    g.fillStyle = '#4A2C86'; g.beginPath(); g.ellipse(rx * 0.3, -ry + 1.2, 5, 1.2, 0, 0, 7); g.fill();
    g.restore();
  };
  const fx = T.frame.x;
  for (const v of T.vessels) vessel(v.x, v.y, v.rx, v.ry, v.a);
  for (let i = 0; i < W * H / 30000; i++) {          // more of the same, outside the photograph's frame
    const x = (r() * 2 - 1) * L, y = BOTTOM + r() * (-BOTTOM - 60);
    if (x > fx[0] - 30 && x < fx[1] + 30) continue;
    vessel(x, y, 8 + r() * 18, 5 + r() * 5, (r() - 0.5) * 0.8);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, W, H, X, Y };
}

export function build(THREE, group, T) {
  const r = rnd(5);
  const hS = T.heights.surface;
  // ---- the lining's surface (the cells' tops), left to right: a flat stretch, down into a fold, the traced
  // surface, a flat stretch, down the left wall of a crypt; then up its right wall and on to the right edge
  const tr = T.surface;
  const wave = x => 2.5 * Math.sin(x / 47) + 1.5 * Math.sin(x / 19 + 1.3);
  const left = [[-L, wave(-L)], [-760, 1], [-600, -2], [-500, -10], [-420, -34], [-350, -78], [-300, -112], [-262, -130], [-232, -128]];
  const end = tr[tr.length - 1], right = [];
  for (let x = end[0] + 18; x < CRYPT_X - CRYPT_HALF - 50; x += 18) right.push([x, end[1] * Math.max(0, 1 - (x - end[0]) / 120) + wave(x) * Math.min(1, (x - end[0]) / 120)]);
  const mouthL = [];
  for (let a = 0; a <= 1.0001; a += 0.1) { const ang = a * Math.PI / 2; mouthL.push([CRYPT_X - CRYPT_HALF - 50 + 50 * Math.sin(ang), -50 + 50 * Math.cos(ang)]); }
  const wallL = []; for (let y = -70; y >= BOTTOM - 4; y -= 20) wallL.push([CRYPT_X - CRYPT_HALF, y]);
  const part1 = resample(left.concat(tr, right, mouthL, wallL), 2);
  const wallR = []; for (let y = BOTTOM - 4; y <= -70; y += 20) wallR.push([CRYPT_X + CRYPT_HALF, y]);
  const mouthR = [];
  for (let a = 1; a >= -0.0001; a -= 0.1) { const ang = a * Math.PI / 2; mouthR.push([CRYPT_X + CRYPT_HALF + 50 - 50 * Math.sin(ang), -50 + 50 * Math.cos(ang)]); }
  const tail = []; for (let x = CRYPT_X + CRYPT_HALF + 70; x <= L; x += 18) tail.push([x, wave(x)]);
  const part2 = resample(wallR.concat(mouthR, tail), 2);
  // ---- every lining as cells' bases every 2 µm: [x, y, nx, ny, height]
  const linings = [];
  for (const P of [part1, part2]) {
    const N = normals(P);
    linings.push({ closed: false, cells: P.map((p, i) => [p[0] - N[i][0] * hS, p[1] - N[i][1] * hS, N[i][0], N[i][1], hS]) });
  }
  // the glands, cut across: their cells sit on the outer ring and reach in to the lumen
  for (const gl of T.glands) {
    const Lm = gl.lumen;
    linings.push({ closed: true, cells: gl.basal.map(b => {
      let best = Lm[0], bd = Infinity;
      for (const p of Lm) { const d = (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2; if (d < bd) { bd = d; best = p; } }
      const d = Math.sqrt(bd) || 1;
      return [b[0], b[1], (best[0] - b[0]) / d, (best[1] - b[1]) / d, Math.max(20, d)];
    }) });
  }
  // ---- the cells, in rows going back from the cut face (the glands run straight back: crypts cut across)
  const full = [], front = [], rows = Math.floor(DEPTH / PITCH);
  const along = (cells, closed, s) => {
    const i = s / 2, a = Math.floor(i), t = i - a, n = cells.length;
    const p = cells[closed ? a % n : Math.min(n - 1, a)], q = cells[closed ? (a + 1) % n : Math.min(n - 1, a + 1)];
    return p.map((v, k) => v + (q[k] - v) * t);
  };
  for (const lin of linings) {
    const total = (lin.cells.length - (lin.closed ? 0 : 1)) * 2;
    for (let k = 0; k <= rows; k++) {
      const off = (k % 2) * PITCH / 2;
      for (let s = off + PITCH / 2; s < total - (lin.closed ? 0 : PITCH / 2); s += PITCH) {
        const [x, y, nx, ny, h] = along(lin.cells, lin.closed, s);
        const nl = Math.hypot(nx, ny) || 1;
        const e = { x, y, z: -k * PITCH * 0.866, nx: nx / nl, ny: ny / nl, h: h / H_GEO * (0.95 + r() * 0.08) };
        (k === 0 ? front : full).push(e);
      }
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3();
  const pose = e => { q.setFromUnitVectors(up, nv.set(e.nx, e.ny, 0)); m4.compose(v.set(e.x, e.y, e.z), q, sc.set(1, e.h, 1)); return m4; };
  const cells = new THREE.InstancedMesh(cellGeometry(THREE, false), mat, full.length);
  full.forEach((e, i) => cells.setMatrixAt(i, pose(e)));
  cells.userData.part = 'tcell'; cells.computeBoundingSphere();
  const cutCells = new THREE.InstancedMesh(cellGeometry(THREE, true), mat, front.length);
  front.forEach((e, i) => cutCells.setMatrixAt(i, pose(e)));
  cutCells.userData.part = 'tcell'; cutCells.computeBoundingSphere();

  // the nuclei of the cut cells, cut too, near the base of each cell (5 µm wide, 10 µm long)
  const ng = new THREE.SphereGeometry(1, 16, 10, Math.PI, Math.PI); ng.scale(2.5, 5.2, 2.5);
  const capG = new THREE.CircleGeometry(1, 16); capG.scale(2.5, 5.2, 1);
  const nucMat = new THREE.MeshLambertMaterial({ color: COL.nucleus, side: THREE.DoubleSide });
  const nuclei = new THREE.InstancedMesh(ng, nucMat, front.length), caps = new THREE.InstancedMesh(capG, nucMat, front.length);
  const nucleiAt = [];                           // where each cut nucleus is (its names go on these)
  front.forEach((e, i) => {
    const hgt = 7 + r() * 2.5 + (e.h * H_GEO - 40) * 0.12;
    nucleiAt.push([e.x + e.nx * hgt, e.y + e.ny * hgt]);
    q.setFromUnitVectors(up, nv.set(e.nx, e.ny, 0));
    m4.compose(new THREE.Vector3(e.x + e.nx * hgt, e.y + e.ny * hgt, 0.04), q, sc.set(1, 0.9 + r() * 0.25, 1));
    nuclei.setMatrixAt(i, m4); caps.setMatrixAt(i, m4);
  });
  nuclei.userData.part = 'tnucleus'; caps.userData.part = 'tnucleus';
  nuclei.computeBoundingSphere(); caps.computeBoundingSphere();

  // ---- the connective tissue: under the linings, left and right of the crypt, with the glands as holes
  const st = stromaTexture(THREE, T);
  const solid = (lin, side) => {
    const sh = new THREE.Shape();
    const B = lin.cells.filter((_, i) => i % 3 === 0).map(c => [c[0], c[1]]);
    if (side < 0) { sh.moveTo(-L, BOTTOM); sh.lineTo(-L, B[0][1]); B.forEach(p => sh.lineTo(p[0], p[1])); sh.lineTo(B[B.length - 1][0], BOTTOM); }
    else { sh.moveTo(B[0][0], BOTTOM); B.forEach(p => sh.lineTo(p[0], p[1])); sh.lineTo(L, B[B.length - 1][1]); sh.lineTo(L, BOTTOM); }
    sh.closePath();
    if (side < 0) for (const gl of T.glands) { const h = new THREE.Path(); gl.basal.filter((_, i) => i % 2 === 0).forEach((p, i) => (i ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]))); h.closePath(); sh.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: false, steps: 1, curveSegments: 2 });
    geo.translate(0, 0, -DEPTH);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, st.X(uv.getX(i)) / st.W, 1 - st.Y(uv.getY(i)) / st.H);
    return geo;
  };
  const faceMat = new THREE.MeshLambertMaterial({ map: st.tex });
  const sideMat = new THREE.MeshLambertMaterial({ color: COL.stromaSide });
  const stroma = new THREE.Group();
  [solid(linings[0], -1), solid(linings[1], 1)].forEach(g => { const m = new THREE.Mesh(g, [faceMat, sideMat]); m.userData.part = 'connective'; stroma.add(m); });
  stroma.userData.part = 'connective';
  group.add(cells, cutCells, nuclei, caps, stroma);

  // the cell the zoom goes into next: on the surface, a few rows back from the face, inside the frame
  const pick = full.filter(e => e.ny > 0.9 && e.x > 100 && e.x < 140 && e.z < -25 && e.z > -40)[0] || full[0];
  const top = new THREE.Vector3(pick.x + pick.nx * pick.h * H_GEO, pick.y + pick.ny * pick.h * H_GEO + 1.6, pick.z);
  const single = new THREE.Mesh(cellGeometry(THREE, false), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a1030 }));
  single.matrixAutoUpdate = false; single.matrix.copy(pose(pick)); single.visible = false; single.userData.part = 'tcell';

  // where things are named: the photograph's own pins, at the same places on the model's cut face
  const R = { tcell: 15, tnucleus: 14, connective: 90, capillary: 14, crypt: 60 };
  // a name on a cell or a nucleus has several places, the front cells and nuclei nearest its pin, so that from any
  // side one of them can be seen
  const nearFront = (x, y, k, f) => front.map(e => [Math.hypot(e.x - x, e.y - y), e]).sort((a, b) => a[0] - b[0]).slice(0, k).map(([, e]) => f(e));
  const labels = T.marks.map(m => {
    const l = { part: m.part, text: m.part === 'crypt' ? 'Crypt, cut across' : m.text, p: [m.um[0], m.um[1], 0.2], r: R[m.part] || 20, free: m.part === 'crypt' };
    if (m.part === 'tcell') l.cands = nearFront(m.um[0], m.um[1], 8, e => [e.x + e.nx * e.h * 15, e.y + e.ny * e.h * 15, 0.2]);
    if (m.part === 'tnucleus') l.cands = nucleiAt.map((c, i) => [c, front[i]]).sort((A, B) => Math.hypot(A[0][0] - m.um[0], A[0][1] - m.um[1]) - Math.hypot(B[0][0] - m.um[0], B[0][1] - m.um[1])).slice(0, 8).map(([c]) => [c[0], c[1], 0.3]);
    return l;
  });
  const tops = full.filter(e => e.ny > 0.95 && e.x > -200 && e.x < 200 && e.z < -60 && e.z > -200);
  labels.push({ part: 'tcell', text: 'Each cell makes mucus', p: [-120, 2, -110], r: 25,
    cands: tops.filter((_, i) => i % Math.max(1, Math.floor(tops.length / 10)) === 0).slice(0, 10).map(e => [e.x + e.nx * e.h * H_GEO, e.y + e.ny * e.h * H_GEO + 1, e.z]) });
  labels.push({ part: 'crypt', text: 'A crypt opens onto the surface', p: [CRYPT_X, -120, 0.2], r: 40, free: true });
  // the slice the photograph shows: its frame on the cut face
  const frame = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: 0x8fe3c8, transparent: true, opacity: 0, depthTest: false, toneMapped: false });
  const [fx0, fx1] = T.frame.x, [fy1, fy0] = T.frame.y, bar = 4;
  for (const [x, y, w, h] of [[fx0, fy0, fx1 - fx0, bar], [fx0, fy1 - bar, fx1 - fx0, bar], [fx0, fy0, bar, fy1 - fy0], [fx1 - bar, fy0, bar, fy1 - fy0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm); m.position.set(x + w / 2, y + h / 2, 1.5); m.renderOrder = 6; frame.add(m);
  }
  group.add(frame);
  return {
    target: { top: top.toArray(), base: [pick.x, pick.y, pick.z], h: pick.h * H_GEO, pose: pose(pick).clone() },
    labels, single, frame, frameMat: fm,
    materials: [mat, nucMat, faceMat, sideMat, single.material],
    size: { L, BOTTOM, DEPTH, H_CELL: hS, frame: T.frame },
  };
}
