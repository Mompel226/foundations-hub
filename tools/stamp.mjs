// Stamp every file the page loads with one version, so browsers fetch the new files after a change.
//   node tools/stamp.mjs        (from the lab folder)
// Writes version.txt and replaces ?v=<old> on the page's own CSS and JS (never three.js's ?v=0.185.1).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v = String(Math.floor(Date.now() / 1000));
const edits = {
  'index.html': s => s.replace(/(css\/app\.css|js\/intro\.js)\?v=[\w.]+/g, `$1?v=${v}`),
  'js/intro.js': s => s.replace(/(\.\/cell3d\.js)\?v=[\w.]+/g, `$1?v=${v}`).replace(/mount\(gl, \{ v: '[\w.]+'/, `mount(gl, { v: '${v}'`),
};
for (const [f, fn] of Object.entries(edits)) {
  const p = join(root, f), s = readFileSync(p, 'utf8'), t = fn(s);
  if (t === s) throw new Error('stamp: nothing replaced in ' + f);
  writeFileSync(p, t);
}
writeFileSync(join(root, 'version.txt'), v + '\n');
console.log('stamped', v);
