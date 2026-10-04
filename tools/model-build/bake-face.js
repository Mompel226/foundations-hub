// The tissue model's front face, drawn flat and unlit (the colours of the stain), 1 µm a pixel, for build_section.py:
// the organ's cut face shows the same thing where the zoom goes in.
//   node shots.mjs "<page>?test=1" /tmp/bk --w 1440 --h 900 --steps "$(cat bake-face.js)" \
//        --save ~/Library/Caches/biology-hub/tissue/tissue-face.png
// The picture covers x -1200…1200 µm and y -1100…200 µm of the tissue's frame (row 0 at y = 200); see-through where
// the model is not (the canal).
const THREE = cell.THREE, scene = cell.scene, renderer = cell.renderer, T = cell.tissue;
await cell.setZ(2.5); await new Promise(r => setTimeout(r, 1500));
let root = T.stroma; while (root.parent && root.parent !== scene) root = root.parent;
const M = root.matrixWorld.clone();
const W = 2400, H = 1300, X0 = -1200, X1 = 1200, Y0 = -1100, Y1 = 200;
const cam = new THREE.OrthographicCamera(X0, X1, Y1, Y0, 1, 3000);
cam.matrixAutoUpdate = false; cam.matrix.copy(M).multiply(new THREE.Matrix4().makeTranslation(0, 0, 1000));
cam.matrixWorld.copy(cam.matrix); cam.matrixWorldInverse.copy(cam.matrix).invert();
const vis = []; scene.children.forEach(o => { if (!o.isLight && o !== root) { vis.push([o, o.visible]); o.visible = false; } });
const rvis = root.visible; root.visible = true;
const swapped = [], off = [];
root.traverse(o => {
  if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some(m => m === T.frameMat || (m.transparent && m.opacity < 0.05))) { off.push(o); o.visible = false; return; }   // the green frame
  const nb = mats.map(m => new THREE.MeshBasicMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, vertexColors: !!m.vertexColors, side: THREE.DoubleSide }));
  swapped.push([o, o.material]); o.material = Array.isArray(o.material) ? nb : nb[0];
});
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
const bg = scene.background; scene.background = null;
const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
renderer.setRenderTarget(null); renderer.toneMapping = tm; scene.background = bg;
for (const [o, m] of swapped) o.material = m;
for (const o of off) o.visible = true;
for (const [o, v] of vis) o.visible = v;
root.visible = rvis;
const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const id = g.createImageData(W, H);
for (let y = 0; y < H; y++) id.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
g.putImageData(id, 0, 0);
return { png: c.toDataURL('image/png'), info: JSON.stringify({ X0, X1, Y0, Y1, W, H }) };
