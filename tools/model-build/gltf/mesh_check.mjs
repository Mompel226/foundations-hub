// Long, thin triangles in every 3D file the page loads: the streaks Daniel saw across the cell on 4 Oct 2026 (a mesh
// simplified, then smoothed, grew triangles micrometres long and nanometres high).
//   node gltf/mesh_check.mjs          -> one line per mesh; exits 1 if any has slivers
// A sliver: a triangle whose longest edge is more than 4 times the mesh's typical (median) edge AND more than 12 times
// its own height. A few in a hundred thousand, short, cannot be seen; a long one is a line across the picture.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/');
const FILES = ['body/anatomy.glb', 'cell/whole.glb', 'cell/organelles.glb', 'cell/mito-demo.glb', 'mol/molecules.glb'];
// known and harmless: the Atlas's own uterine wall meshes carry about 550 slivers inside one continuous surface (they are
// not loose lines across a gap, as the streaks were); simplifying cleanly halves them
const KNOWN = { 'body/anatomy.glb a_uterus': 'from the Atlas source, inside a continuous surface' };
let bad = 0;
for (const f of FILES) {
  const doc = await io.read(path.join(ASSETS, f));
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pa = prim.getAttribute('POSITION'), ix = prim.getIndices(); if (!pa || !ix) continue;
      const n = pa.getCount(), P = new Float64Array(n * 3), e = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pa.getElement(i, e);
        P[3 * i] = M[0] * e[0] + M[4] * e[1] + M[8] * e[2] + M[12];
        P[3 * i + 1] = M[1] * e[0] + M[5] * e[1] + M[9] * e[2] + M[13];
        P[3 * i + 2] = M[2] * e[0] + M[6] * e[1] + M[10] * e[2] + M[14];
      }
      const I = ix.getArray(), nt = I.length / 3, L = new Float64Array(nt), H = new Float64Array(nt);
      const d = (a, b) => Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]);
      for (let t = 0; t < nt; t++) {
        const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
        const ab = d(a, b), bc = d(b, c), ca = d(c, a), s = (ab + bc + ca) / 2;
        const area = Math.sqrt(Math.max(0, s * (s - ab) * (s - bc) * (s - ca)));
        L[t] = Math.max(ab, bc, ca); H[t] = 2 * area / Math.max(L[t], 1e-12);
      }
      const med = Float64Array.from(L).sort()[nt >> 1];
      let sl = 0, worst = 0;
      for (let t = 0; t < nt; t++) if (L[t] > 4 * med && H[t] < L[t] / 12) { sl++; worst = Math.max(worst, L[t] / med); }
      const known = KNOWN[f + ' ' + (node.getName() || mesh.getName())];
      const flag = (sl > Math.max(3, 2e-5 * nt) || worst > 12) && !known;
      bad += flag;
      console.log(`${flag ? '!!' : known ? 'ok*' : 'ok'} ${f.padEnd(20)} ${(node.getName() || mesh.getName()).slice(0, 26).padEnd(26)} ${String(nt).padStart(8)} faces  slivers ${String(sl).padStart(5)}  longest ${worst.toFixed(1).padStart(5)} x typical${known ? '  (' + known + ')' : ''}`);
    }
  }
}
console.log('meshes with slivers:', bad);
process.exit(bad ? 1 : 0);
