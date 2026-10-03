// Simplify one organelle mesh by distance from the reader's starting place: full detail near, coarse far.
//   node zones.mjs <cacheDir> <name> <budget>
// Reads <name>.pos.f32 / .nrm.f32 / .idx.u32 / .ao.u8 (from build_meshes.py), writes <name>.glb.
// Three passes (far, middle, near), each simplifying only its own zone while every other vertex is locked,
// so the zones stay joined with no cracks. Normals from the full-detail surface ride along as attributes,
// so a large flat triangle is still shaded as the smooth surface it stands for.
import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

const [,, dir, name, budgetArg] = process.argv;
const FOCUS = [-0.05, 1.35, -0.9];                 // the centrosome, scene µm
const ZONES = [                                     // [max distance µm, share of the budget]
  [1.6, 0.42], [3.0, 0.36], [99, 0.22],
];
await MeshoptSimplifier.ready;
const rd = (ext, T) => { const b = readFileSync(`${dir}/${name}.${ext}`); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const P = rd('pos.f32', Float32Array), N = rd('nrm.f32', Float32Array), A = rd('ao.u8', Uint8Array);
let I = rd('idx.u32', Uint32Array).slice();
const nv = P.length / 3, budget = Number(budgetArg);
const attrs = new Float32Array(nv * 3); attrs.set(N);

function zoneOfTri(t, idx) {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < 3; k++) { const v = idx[3 * t + k]; x += P[3 * v]; y += P[3 * v + 1]; z += P[3 * v + 2]; }
  const d = Math.hypot(x / 3 - FOCUS[0], y / 3 - FOCUS[1], z / 3 - FOCUS[2]);
  return ZONES.findIndex(zz => d < zz[0]);
}
const n0 = I.length / 3;
const counts0 = [0, 0, 0];
for (let t = 0; t < n0; t++) counts0[zoneOfTri(t, I)]++;
const report = [];
for (const zi of [2, 1, 0]) {
  const nt = I.length / 3;
  const zt = new Uint8Array(nt); let mine = 0;
  for (let t = 0; t < nt; t++) { zt[t] = zoneOfTri(t, I); if (zt[t] === zi) mine++; }
  const target = Math.min(mine, Math.round(budget * ZONES[zi][1]));
  if (mine === 0 || target >= mine) { report.push(`zone ${zi}: ${mine} kept`); continue; }
  // lock every vertex used by a triangle of another zone
  const lock = new Uint8Array(nv);
  for (let t = 0; t < nt; t++) if (zt[t] !== zi) for (let k = 0; k < 3; k++) lock[I[3 * t + k]] = 1;
  const others = nt - mine;
  const [out] = MeshoptSimplifier.simplifyWithAttributes(I, P, 3, attrs, 3, [0.5, 0.5, 0.5], lock,
    (others + target) * 3, 0.02, ['Sparse']);
  report.push(`zone ${zi}: ${mine} -> ${out.length / 3 - others}`);
  I = out;
}
// compact
const used = new Int32Array(nv).fill(-1); let k = 0;
for (const v of I) if (used[v] < 0) used[v] = k++;
const pos = new Float32Array(k * 3), nrm = new Float32Array(k * 3), col = new Uint8Array(k * 4);
for (let v = 0; v < nv; v++) {
  const j = used[v]; if (j < 0) continue;
  pos.set(P.subarray(3 * v, 3 * v + 3), 3 * j);
  const nx = attrs[3 * v], ny = attrs[3 * v + 1], nz = attrs[3 * v + 2], l = Math.hypot(nx, ny, nz) || 1;
  nrm[3 * j] = nx / l; nrm[3 * j + 1] = ny / l; nrm[3 * j + 2] = nz / l;
  // ambient occlusion kept gentle: the page adds its own screen-space occlusion on top
  const g = Math.round(255 * (0.55 + 0.45 * A[v] / 255));
  col[4 * j] = col[4 * j + 1] = col[4 * j + 2] = g; col[4 * j + 3] = 255;
}
const idx = new Uint32Array(I.length); for (let i = 0; i < I.length; i++) idx[i] = used[I[i]];

const doc = new Document(); const buf = doc.createBuffer();
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buf))
  .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(col).setNormalized(true).setBuffer(buf))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf));
const mesh = doc.createMesh(name).addPrimitive(prim);
doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
await new NodeIO().write(`${dir}/${name}.glb`, doc);
console.log(`${name}: ${n0} -> ${idx.length / 3} triangles (${report.join('; ')}); start zones ${counts0.join('/')}`);
