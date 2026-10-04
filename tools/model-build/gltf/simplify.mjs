// Simplify one mesh with meshoptimizer, keeping the triangles well shaped (Regularize): a thin tube simplified by
// plain edge collapse became long, thin triangles that the page drew as streaks (Daniel, 4 Oct, the whole cell).
//   node simplify.mjs <positions.f32> <indices.u32> <target triangles> <error, in the mesh's units> <out.u32>
import { MeshoptSimplifier as M } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'node:fs';
const [pf, xf, target, error, out] = process.argv.slice(2);
await M.ready;
// (a small file comes back as a slice of a shared buffer: copy just its own bytes)
const own = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const pos = new Float32Array(own(readFileSync(pf))), idx = new Uint32Array(own(readFileSync(xf)));
const [res, err] = M.simplify(idx, pos, 3, Number(target) * 3, Number(error), ['ErrorAbsolute', 'Regularize']);
writeFileSync(out, Buffer.from(res.buffer, res.byteOffset, res.byteLength));
console.log(JSON.stringify({ triangles: res.length / 3, error: err }));
