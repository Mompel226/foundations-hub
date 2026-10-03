// How heavy is the page on a real laptop screen? Loads it in headless Chrome at the size and pixel density given,
// with the self-turning ON, records every main-thread task longer than 50 ms, times a frame at each level, then
// scrolls with the wheel from the body to the molecules and back, as a reader would, and counts the frames.
//   node perf.mjs <url> [--w 1440 --h 900 --dpr 2]
// Good: about 120 frames in 2 s at the first level; no long tasks after loading; while scrolling, most frames
// under 20 ms (two pictures are drawn where two levels blend, so those frames cost about twice as much).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const url = argv[0], w = Number(opt('w', 1440)), h = Number(opt('h', 900)), dpr = Number(opt('dpr', 2));
const port = 9700 + (process.pid % 200);
const prof = mkdtempSync(join(tmpdir(), 'cellperf-'));
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run',
  '--hide-scrollbars', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--window-size=' + w + ',' + h,
  '--force-device-scale-factor=' + dpr, 'about:blank'], { stdio: 'ignore' });
const guard = setTimeout(() => { console.log('TIMEOUT'); proc.kill('SIGKILL'); process.exit(2); }, 300000);
let info;
for (let i = 0; i < 150; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (info.length) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const ws = new WebSocket(info.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const wait = new Map(); const logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.args.map(a => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + m.params.exceptionDetails.exception?.description); if (m.id && wait.has(m.id)) { const [ok, no] = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); } };
const send = (method, params = {}) => new Promise((ok, no) => { const n = ++id; wait.set(n, [ok, no]); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true});
  window.__raf=0; window.__gaps=[]; window.__zg=[]; let __l=0; (function f(t){ window.__raf++; if(__l) { window.__gaps.push(t-__l); if (window.cell) window.__zg.push([window.cell.Z, t-__l]); } __l=t; requestAnimationFrame(f); })(0);` });
const t0 = Date.now();
await send('Page.navigate', { url });
await ev(`for (let i=0;i<600 && !(window.cell && window.cell.counts && window.cell.counts.ribosomes);i++) await new Promise(r=>setTimeout(r,100));`);
console.log('loaded (organelles ready) after', Date.now() - t0, 'ms; canvas', await ev(`const c=document.querySelector('#gl canvas'); return c.width+'x'+c.height;`));
const raf = await ev(`const a=window.__raf; await new Promise(r=>setTimeout(r,2000)); return window.__raf-a;`);
console.log('animation frames in 2 s at the organism level (auto-turning):', raf);
console.log('long tasks while loading [start ms, duration ms]:', JSON.stringify(await ev('return window.__long')));
const timeFrames = `const g=cell.renderer.getContext(); const T=[]; for(let k=0;k<6;k++){ cell.camera.rotateY(0.01); const t=performance.now(); cell.render(); g.finish(); T.push(Math.round(performance.now()-t)); } return T.join(' ');`;
const LV = ['organism', 'system', 'organ', 'tissue', 'cell', 'inside', 'molecules'];
for (const [i, lv] of (argv.includes('--scrollonly') ? [] : LV.entries())) {
  await ev(`await cell.setZ(${i});`);
  console.log(lv.padEnd(9), 'frame ms:', await ev(timeFrames));
}
for (const z of (argv.includes('--scrollonly') ? [] : [2.85, 3.6, 4.65, 5.45])) { await ev(`await cell.setZ(${z});`); console.log(('Z ' + z).padEnd(9), 'frame ms (two levels blended):', await ev(timeFrames)); }
// scroll from the top to the bottom and back with the wheel, 60 events a second
await ev(`await cell.setZ(0);`);
const lt0 = await ev('return window.__long.length');
if (argv.includes('--profile')) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 }); await send('Profiler.start'); }
const res = await ev(`
  const cv = document.querySelector('#gl canvas'), r = cv.getBoundingClientRect();
  window.__gaps.length = 0; const a = window.__raf, t = performance.now(); let maxZ = 0; const seen = new Set();
  for (const dir of [1, -1]) for (let k = 0; k < 1100; k++) {
    maxZ = Math.max(maxZ, cell.Z); seen.add(document.querySelector('#capLevel').textContent);
    cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -dir * 9, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
    await new Promise(res => setTimeout(res, 16));
    if (dir === 1 && cell.Z >= 6) break;
    if (dir === -1 && cell.Z <= 0) break;
  }
  const g = window.__gaps.slice().sort((x, y) => x - y);
  return { frames: window.__raf - a, seconds: ((performance.now() - t) / 1000).toFixed(1), median: Math.round(g[g.length >> 1]), p95: Math.round(g[Math.floor(g.length * 0.95)]), worst: Math.round(g[g.length - 1]), deepestZ: +maxZ.toFixed(2), endZ: cell.Z, captions: [...seen].join(' > ') };`);
// the buttons: "Zoom in" from the organism glides to the organ system, and "Back" returns
const btn = argv.includes('--scrollonly') ? 'not tried' : await ev(`document.querySelector('#btnGo').click(); await new Promise(r => setTimeout(r, 5500)); const a = [cell.Z, document.querySelector('#capLevel').textContent];
  document.querySelector('#btnBack').click(); await new Promise(r => setTimeout(r, 5500)); return a.concat([cell.Z, document.querySelector('#capLevel').textContent]).join(' / ');`);
console.log('buttons (Zoom in, then Back):', btn);
console.log('scroll down and up again:', JSON.stringify(res));
console.log('   the slowest frames [Z, ms]:', await ev(`return JSON.stringify(window.__zg.slice(-1500).filter(x => x[1] > 100).map(([z, g]) => [+z.toFixed(2), Math.round(g)]))`));
console.log('   median frame ms by stretch of the zoom:', await ev(`const b = {}; for (const [z, g] of window.__zg.slice(-1500)) { const k = (Math.floor(z * 4) / 4).toFixed(2); (b[k] = b[k] || []).push(g); }
  return Object.keys(b).sort((x, y) => x - y).map(k => k + ':' + Math.round(b[k].sort((x, y) => x - y)[b[k].length >> 1])).join(' ');`));
// a median of 33 can be half the frames on time and half late: the share of late frames (over 20 ms) tells which
console.log('   frames over 20 ms by stretch (% of n):', await ev(`const b = {}; for (const [z, g] of window.__zg.slice(-1500)) { const k = (Math.floor(z * 4) / 4).toFixed(2); (b[k] = b[k] || []).push(g); }
  return Object.keys(b).sort((x, y) => x - y).map(k => k + ':' + Math.round(100 * b[k].filter(g => g > 20).length / b[k].length) + '%/' + b[k].length).join(' ');`));
if (argv.includes('--profile')) {
  const { profile } = await send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; let i = 0;
  for (const sId of profile.samples) { const n = byId.get(sId); const k = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url.split('/').pop() || '') + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i++] || 0)); }
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('   where the time went (self, % of', Math.round(tot / 1000), 'ms):');
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, t]) => console.log('     ', (t / tot * 100).toFixed(1).padStart(5), '%', k));
}
console.log('   long tasks while scrolling:', JSON.stringify(await ev(`return window.__long.slice(${lt0})`)));
if (logs.length) console.log('console errors and warnings:', logs.slice(0, 8).join(' | '));
clearTimeout(guard); ws.close(); proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
