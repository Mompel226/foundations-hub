// How heavy is the page on a real laptop screen? Loads it in headless Chrome at the size and pixel density
// given, records every main-thread task longer than 50 ms while it loads, then times frames at each level.
//   node perf.mjs <url> [--w 1440 --h 900 --dpr 2]
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
const guard = setTimeout(() => { console.log('TIMEOUT'); proc.kill('SIGKILL'); process.exit(2); }, 240000);
let info;
for (let i = 0; i < 150; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (info.length) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const ws = new WebSocket(info.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const wait = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { const [ok, no] = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); } };
const send = (method, params = {}) => new Promise((ok, no) => { const n = ++id; wait.set(n, [ok, no]); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true});
  window.__raf=0; (function f(){ window.__raf++; requestAnimationFrame(f); })();` });
const t0 = Date.now();
await send('Page.navigate', { url });
await ev(`for (let i=0;i<600 && !(window.cell && window.cell.counts && window.cell.counts.ribosomes);i++) await new Promise(r=>setTimeout(r,100));`);
console.log('loaded (organelles ready) after', Date.now() - t0, 'ms; canvas', await ev(`const c=document.querySelector('#gl canvas'); return c.width+'x'+c.height;`));
const raf = await ev(`const a=window.__raf; await new Promise(r=>setTimeout(r,2000)); return window.__raf-a;`);
console.log('animation frames in 2 s at the organism level (auto-turning):', raf);
console.log('long tasks while loading [start ms, duration ms]:', JSON.stringify(await ev('return window.__long')));
const timeFrames = `const g=cell.renderer.getContext(); const T=[]; for(let k=0;k<8;k++){ cell.camera.rotateY(0.02); const t=performance.now(); cell.render(); g.finish(); T.push(Math.round(performance.now()-t)); } return T.join(' ');`;
for (const lv of ['organism', 'cell', 'inside', 'molecules']) {
  if (lv !== 'organism') await ev(`window.__p=cell.goTo('${lv}'); for(let k=0;k<200;k++){ await new Promise(r=>setTimeout(r,100)); if(cell.flying) cell.seekFlight(1); if(cell.level==='${lv}' && !cell.flying) break; } await window.__p;`);
  const lt0 = await ev('return window.__long.length');
  console.log(lv, 'frame ms (render + GPU finish):', await ev(timeFrames));
  const t = Date.now(); await ev(`cell.view(cell.camera.position.toArray(), [0,0,0].map((x,i)=>cell.camera.position.getComponent(i)+0.0001)); await new Promise(r=>setTimeout(r,800));`);
  console.log('   long tasks since:', JSON.stringify(await ev(`return window.__long.slice(${lt0})`)));
}
clearTimeout(guard); ws.close(); proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
