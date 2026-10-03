/* The tissue level: a MODEL of a block of the lining of the canal of the cervix, cut open on its front face, in µm.

   What it shows, and where the numbers come from:
     one layer of tall columnar cells that make mucus, each nucleus near the base of its cell (IARC Screening
     Group's atlas, "Anatomical considerations – columnar epithelium"; the micrograph beside it): cells about 30 µm tall and 7 µm across, nuclei about 5 by 10 µm,
     measured on Häggström's photographs (the same scale as the rest of the zoom: nuclei about 6 µm across);
     a crypt: the lining folds down into the wall (crypts reach 3-5 mm; here 0.6 mm of one, with a lumen
     about 0.1 mm wide);
     below the cells, connective tissue: fibres, the long nuclei of fibroblasts, a few white blood cells, and
     blood capillaries about 8 µm across with red blood cells in them.
   Made up: the exact place of every cell, nucleus and fibre (at random, at those sizes).
   The colours are those of the usual stain (haematoxylin and eosin), as in the photograph and the cut face of
   the organ.

   Frame: origin on the surface of the lining at the mouth of the crypt (the point the zoom dives to on the
   cut organ), +y out of the lining into the canal, +z out of the cut face towards the reader.

   build(THREE, group) -> { target, labels, single, setSingle(on), parts }
*/
const H_CELL = 30, PITCH = 7, R_HEX = 3.9, L = 1000, BOTTOM = -900, DEPTH = 300, CRYPT_W = 80;
const COL = { side: 0xD9B3CC, top: 0xF0E6F1, cut: 0xE8C9DD, mucin: 0xF4EDF4, nucleus: 0x5B4BB5, stroma: 0xEBB0C3, stromaSide: 0xDE9DB3 };

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// The base of the lining (where the cells sit on the connective tissue), from the left edge of the block, down the
// left wall of the crypt, up its right wall, to the right edge. Each sample: position (x, y) and the direction the
// cells point (into the canal or into the crypt).
function basalPath() {
  const pts = [], step = 0.5, y0 = -H_CELL;
  const wave = x => 2.5 * Math.sin(x / 47) + 1.5 * Math.sin(x / 19 + 1.3);
  const rc = 22;                                  // the radius of the crypt's two rounded mouths
  for (let x = -L; x <= -CRYPT_W - rc; x += step) pts.push([x, y0 + wave(x), 0, 1]);
  for (let a = 0; a <= Math.PI / 2; a += step / rc) pts.push([-CRYPT_W - rc + Math.sin(a) * rc, y0 - rc + Math.cos(a) * rc, Math.sin(a), Math.cos(a)]);
  for (let y = y0 - rc; y >= BOTTOM; y -= step) pts.push([-CRYPT_W, y, 1, 0]);
  const right = [];
  for (let y = BOTTOM; y <= y0 - rc; y += step) right.push([CRYPT_W, y, -1, 0]);
  for (let a = Math.PI / 2; a >= 0; a -= step / rc) right.push([CRYPT_W + rc - Math.sin(a) * rc, y0 - rc + Math.cos(a) * rc, -Math.sin(a), Math.cos(a)]);
  for (let x = CRYPT_W + rc; x <= L; x += step) right.push([x, y0 + wave(x), 0, 1]);
  const all = pts.concat(right);
  let s = 0; all[0].push(0);
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i];
    // the gap between the bottom of the crypt's two walls is not part of the lining
    s += Math.abs(a[1] - BOTTOM) < 1e-6 && Math.abs(b[1] - BOTTOM) < 1e-6 ? 0 : Math.hypot(b[0] - a[0], b[1] - a[1]);
    b.push(s);
  }
  return all;                                     // [x, y, nx, ny, s]
}
function atS(path, s) {
  let lo = 0, hi = path.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][4] < s) lo = m; else hi = m; }
  const a = path[lo], b = path[hi], t = b[4] > a[4] ? (s - a[4]) / (b[4] - a[4]) : 0;
  const nx = a[2] + (b[2] - a[2]) * t, ny = a[3] + (b[3] - a[3]) * t, n = Math.hypot(nx, ny) || 1;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, nx / n, ny / n];
}

// A columnar cell: a six-sided column, base at y = 0, a low dome on top. cut: only the half behind z = 0, with a flat
// face at z = 0 coloured as the stain colours it (pale apical part full of mucus, pink below).
function cellGeometry(THREE, cut) {
  const pos = [], col = [], c = new THREE.Color();
  const ring = k => { const a = Math.PI / 6 + k * Math.PI / 3; return [Math.cos(a) * R_HEX, Math.sin(a) * R_HEX]; };   // [x, z]
  const push = (p, hex) => { pos.push(...p); c.setHex(hex); col.push(c.r, c.g, c.b); };
  const tri = (a, b, d, ha, hb, hd) => { push(a, ha); push(b, hb ?? ha); push(d, hd ?? ha); };
  const top = H_CELL, dome = 1.6;
  const keep = ([x, z]) => !cut || z <= 0;
  const clipZ = (p, q) => { const t = p[1] / (p[1] - q[1]); return [p[0] + (q[0] - p[0]) * t, 0]; };   // where an edge meets z = 0
  let poly = [0, 1, 2, 3, 4, 5].map(ring);
  if (cut) {                                       // the hexagon cut by z = 0, keeping z <= 0
    const out = [];
    for (let i = 0; i < 6; i++) {
      const p = poly[i], q = poly[(i + 1) % 6];
      if (keep(p)) out.push(p);
      if (keep(p) !== keep(q)) out.push(clipZ(p, q));
    }
    poly = out;
  }
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if (cut && Math.abs(p[1]) < 1e-6 && Math.abs(q[1]) < 1e-6) continue;   // the cut edge: the face below fills it
    tri([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], top, q[1]], COL.side);
    tri([p[0], 0, p[1]], [q[0], top, q[1]], [p[0], top, p[1]], COL.side);
    tri([p[0], top, p[1]], [q[0], top, q[1]], [0, top + dome, cut ? Math.min(0, 0) : 0], COL.top);   // the dome
  }
  if (cut) {
    // the cut face: a rectangle from the base to the top, pink at the base and pale (mucus) in the upper part
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

// The connective tissue's cut face, painted: pale pink fibres, the long dark nuclei of fibroblasts, a few round
// nuclei of white blood cells, and capillaries with red blood cells. 1 pixel = 1 µm.
function stromaTexture(THREE, path) {
  const W = 2 * L, H = Math.round(-BOTTOM) + 4;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rnd(11);
  const X = x => x + L, Y = y => -y;              // µm -> pixel
  g.fillStyle = '#EBB0C3'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 350; i++) {                // collagen fibres: wavy pink strokes, mostly along the lining
    const x = r() * W, y = r() * H, len = 30 + r() * 90, a = (r() - 0.5) * 0.9;
    g.strokeStyle = `rgba(${200 + r() * 30 | 0},${110 + r() * 40 | 0},${140 + r() * 30 | 0},${0.25 + r() * 0.35})`;
    g.lineWidth = 0.8 + r() * 1.6; g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.33, y + Math.sin(a * 5) * 6 + len * a * 0.3, x + len * 0.66, y - 5 + len * a * 0.6, x + len, y + len * a);
    g.stroke();
  }
  const caps = [];
  for (let i = 0; i < W * H / 35000; i++) {        // capillaries: wall, lumen, one or two red blood cells
    const x = r() * W, y = 40 + r() * (H - 60), rad = 4 + r() * 1.5;
    caps.push([x - L, -y, rad]);
    g.fillStyle = '#F6E3EA'; g.beginPath(); g.ellipse(x, y, rad + 1.8, rad + 1.4, r() * 3, 0, 7); g.fill();
    g.strokeStyle = '#B04C78'; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = '#D9364C'; g.beginPath(); g.ellipse(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2, 3.7, 3.2, r() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < W * H / 1750; i++) {         // fibroblast nuclei: long, dark
    const x = r() * W, y = r() * H, a = (r() - 0.5) * 0.8;
    g.fillStyle = `rgba(${70 + r() * 20 | 0},${40 + r() * 15 | 0},${120 + r() * 30 | 0},0.92)`;
    g.beginPath(); g.ellipse(x, y, 5 + r() * 3, 1.3 + r() * 0.8, a, 0, 7); g.fill();
  }
  for (let i = 0; i < W * H / 13000; i++) {        // white blood cells (lymphocytes): small round dark nuclei
    const x = r() * W, y = r() * H;
    g.fillStyle = '#3E2A78'; g.beginPath(); g.arc(x, y, 2.6 + r() * 0.6, 0, 7); g.fill();
  }
  // the basement membrane: a thin, denser pink line under the cells
  g.strokeStyle = '#D77FA0'; g.lineWidth = 1.6; g.beginPath();
  path.forEach((p, i) => { const fn = i ? 'lineTo' : 'moveTo'; g[fn](X(p[0]), Y(p[1])); }); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, W, H, caps };
}

export function build(THREE, group) {
  const path = basalPath(), total = path[path.length - 1][4];
  const r = rnd(5);
  const full = [], front = [];
  const rows = Math.floor(DEPTH / PITCH);
  for (let k = 0; k <= rows; k++) {
    const off = (k % 2) * PITCH / 2;
    for (let s = off + PITCH / 2; s < total - PITCH / 2; s += PITCH) {
      const [x, y, nx, ny] = atS(path, s);
      const e = { x, y, z: -k * PITCH * 0.866, nx, ny, h: 0.94 + r() * 0.1, rot: (r() - 0.5) * 0.12 };
      (k === 0 ? front : full).push(e);
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3();
  const pose = (e, extraY = 0) => {
    q.setFromUnitVectors(up, nv.set(e.nx, e.ny, 0));
    m4.compose(v.set(e.x, e.y, e.z), q, sc.set(1, e.h + extraY, 1));
    return m4;
  };
  const cells = new THREE.InstancedMesh(cellGeometry(THREE, false), mat, full.length);
  full.forEach((e, i) => cells.setMatrixAt(i, pose(e)));
  cells.userData.part = 'tcell'; cells.computeBoundingSphere();
  const cutCells = new THREE.InstancedMesh(cellGeometry(THREE, true), mat, front.length);
  front.forEach((e, i) => cutCells.setMatrixAt(i, pose(e)));
  cutCells.userData.part = 'tcell'; cutCells.computeBoundingSphere();

  // the nuclei of the cut cells, cut too: half an ellipsoid, 5 µm wide and 10 µm long, its flat side on the face
  const ng = new THREE.SphereGeometry(1, 16, 10, Math.PI, Math.PI);   // the half with z <= 0
  ng.scale(2.5, 5.2, 2.5);
  const capG = new THREE.CircleGeometry(1, 16); capG.scale(2.5, 5.2, 1);
  const nucMat = new THREE.MeshLambertMaterial({ color: COL.nucleus, side: THREE.DoubleSide });
  const nuclei = new THREE.InstancedMesh(ng, nucMat, front.length), caps = new THREE.InstancedMesh(capG, nucMat, front.length);
  front.forEach((e, i) => {
    const hgt = 6.5 + r() * 2.5;                  // the centre of the nucleus, above the base of the cell
    q.setFromUnitVectors(up, nv.set(e.nx, e.ny, 0));
    const c = new THREE.Vector3(e.x + e.nx * hgt, e.y + e.ny * hgt, 0.04);
    m4.compose(c, q, sc.set(1, 0.9 + r() * 0.25, 1)); nuclei.setMatrixAt(i, m4); caps.setMatrixAt(i, m4);
  });
  nuclei.userData.part = 'tnucleus'; caps.userData.part = 'tnucleus';
  nuclei.computeBoundingSphere(); caps.computeBoundingSphere();

  // the connective tissue: the region under the lining, either side of the crypt, as a solid block
  const st = stromaTexture(THREE, path);
  const half = (side) => {
    const sh = new THREE.Shape();
    const pts = path.filter((p, i) => i % 8 === 0 && (side < 0 ? p[0] <= -CRYPT_W + 1e-6 : p[0] >= CRYPT_W - 1e-6));   // every 4 µm is enough
    const ordered = side < 0 ? pts : pts.slice().reverse();
    sh.moveTo(side * L, BOTTOM);
    ordered.forEach(p => sh.lineTo(p[0], p[1]));
    sh.lineTo(side * CRYPT_W, BOTTOM);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: false, steps: 1, curveSegments: 4 });
    geo.translate(0, 0, -DEPTH);
    // the faces' uv are their x, y in µm: make them the texture's
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + L) / st.W, 1 + uv.getY(i) / st.H);
    return geo;
  };
  const faceMat = new THREE.MeshLambertMaterial({ map: st.tex });
  const sideMat = new THREE.MeshLambertMaterial({ color: COL.stromaSide });
  const stroma = new THREE.Group();
  for (const sd of [-1, 1]) { const m = new THREE.Mesh(half(sd), [faceMat, sideMat]); m.userData.part = 'connective'; stroma.add(m); }
  stroma.userData.part = 'connective';

  group.add(cells, cutCells, nuclei, caps, stroma);

  // the cell the zoom goes into next: one on the surface, a few rows back from the face, right of the crypt
  const pick = full.filter(e => e.ny > 0.99 && e.x > 130 && e.x < 175 && e.z < -25 && e.z > -40)[0] || full[0];
  const top = new THREE.Vector3(pick.x, pick.y + H_CELL * pick.h + 1.6, pick.z);
  const single = new THREE.Mesh(cellGeometry(THREE, false), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a1030 }));
  single.matrixAutoUpdate = false; single.matrix.copy(pose(pick)); single.visible = false; single.userData.part = 'tcell';
  group.add(single);

  // where things are named (tissue frame, µm): [x, y, z], the size used to decide when a name is readable.
  // On the right of the crypt, in the middle of the view; one on the top surface, left of it.
  const fe = front.find(e => e.x > 240 && e.x < 260 && e.ny > 0.99) || front[0];
  const cap0 = st.caps.slice().sort((a, b) => Math.hypot(a[0] - 260, a[1] + 300) - Math.hypot(b[0] - 260, b[1] + 300))[0] || st.caps[0];
  const labels = [
    { part: 'tcell', text: 'Lining cells: one layer, all alike', p: [fe.x, fe.y + 24, 0.1], r: 15 },
    { part: 'tnucleus', text: 'Nucleus', p: [fe.x + 4 * PITCH, fe.y + 8, 0.2], r: 14 },
    { part: 'connective', text: 'Connective tissue', p: [420, -520, 0.1], r: 90 },
    { part: 'capillary', text: 'Blood capillary', p: [cap0[0], cap0[1], 0.1], r: 14 },
    { part: 'crypt', text: 'A crypt: the lining folds into the wall', p: [0, -300, 0.1], r: 60 },
    { part: 'tcell', text: 'Each cell makes mucus', p: [-180, 4, -110], r: 25 },
  ];
  // the slice the photograph shows: a frame on the cut face, right of the crypt, the photograph's shape
  const frame = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: 0x8fe3c8, transparent: true, opacity: 0, depthTest: false, toneMapped: false });
  const fx0 = 120, fx1 = 640, fy1 = 36, fy0 = fy1 - (fx1 - fx0) * 1692 / 1100, bar = 5;
  for (const [x, y, w, h] of [[fx0, fy0, fx1 - fx0, bar], [fx0, fy1 - bar, fx1 - fx0, bar], [fx0, fy0, bar, fy1 - fy0], [fx1 - bar, fy0, bar, fy1 - fy0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm); m.position.set(x + w / 2, y + h / 2, 1.5); m.renderOrder = 6; frame.add(m);
  }
  group.add(frame);
  return {
    target: { top: top.toArray(), base: [pick.x, pick.y, pick.z] },
    labels, single, frame, frameMat: fm,
    setSingle(on) { single.visible = on; },
    parts: { cells, cutCells, nuclei, caps, stroma },
    materials: [mat, nucMat, faceMat, sideMat, single.material],
    size: { L, BOTTOM, DEPTH, H_CELL },
  };
}
