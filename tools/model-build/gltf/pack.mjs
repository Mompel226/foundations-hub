// Merge the organelle meshes into one file and compress it for the web (meshopt, as the Circulation Lab's heart).
//   node pack.mjs <out.glb> <in1.glb> <in2.glb> ...
// Each input keeps its own mesh, named after its file (er, mito, golgi ...), so the page can colour and
// name each organelle. Positions are quantised to 14 bits per axis (the region is 12 µm wide: 0.7 nm steps).
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, reorder, quantize, meshopt, prune, dedup, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';

const [,, out, ...inputs] = process.argv;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const doc = await io.read(inputs[0]);
name(doc, inputs[0]);
for (const f of inputs.slice(1)) {
  const d = await io.read(f);
  name(d, f);
  mergeDocuments(doc, d);
}
// one scene holding every node
const root = doc.getRoot();
const scenes = root.listScenes();
const main = scenes[0];
for (const s of scenes.slice(1)) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
root.setDefaultScene(main);
await doc.transform(
  unpartition(), weld(), dedup(), prune(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' })
);
await io.write(out, doc);
let tri = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tri += p.getIndices().getCount() / 3;
console.log('wrote', out, root.listMeshes().map(m => m.getName()).join(' '), tri, 'triangles');

function name(d, file) {
  const n = path.basename(file, '.glb');
  for (const m of d.getRoot().listMeshes()) m.setName(n);
  for (const nd of d.getRoot().listNodes()) nd.setName(n);
}
