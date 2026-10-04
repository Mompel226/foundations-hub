// Screenshots of the Foundations hub's 3D intro in real-time headless Chrome (the Browser pane stops drawing
// while hidden). Uses the GPU when the Mac has one, so WebGL runs at full speed.
//   node shots.mjs <url> <out-prefix> [--w 1280 --h 800 --dpr 1 --steps "js;;js;;..." --save <file.png>]
// Each step is JavaScript run in the page (awaited); after each step a screenshot <out-prefix>-<n>.png. A step that
// returns { png: <data URL> } has that picture written to the --save file (bake-face.js does).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const [url, out] = argv;
const w = Number(opt('w', 1280)), h = Number(opt('h', 800)), dpr = Number(opt('dpr', 1));
const steps = (opt('steps', '') || '').split(';;').filter(Boolean);
const port = 9600 + (process.pid % 300);
const prof = mkdtempSync(join(tmpdir(), 'cellshot-'));
const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', '--enable-gpu', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--window-size=' + w + ',' + h, '--force-device-scale-factor=' + dpr, 'about:blank'], { stdio: 'ignore' });
const guard = setTimeout(() => { console.error('timeout'); try { proc.kill('SIGKILL'); } catch {} process.exit(2); }, Number(opt('timeout', 240)) * 1000);
let info = null;
for (let i = 0; i < 150; i++) {
  try { info = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (info.length) break; } catch {}
  await new Promise(r => setTimeout(r, 100));
}
const ws = new WebSocket(info.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let id = 0; const waiting = new Map(); const logs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const [ok, no] = waiting.get(m.id); waiting.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
  else if (m.method === 'Runtime.consoleAPICalled') (process.env.LIVE && console.log('  page:', m.params.args.map(a => a.value ?? a.description ?? '').join(' ')), logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ')));
  else if (m.method === 'Runtime.exceptionThrown') (process.env.LIVE && console.log('  EXC', JSON.stringify(m.params.exceptionDetails).slice(0,400)), logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)));
  else if (m.method === 'Log.entryAdded') logs.push(m.params.entry.level + ': ' + m.params.entry.text);
};
const send = (method, params = {}) => new Promise((ok, no) => { const n = ++id; waiting.set(n, [ok, no]); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
if (opt('mobile')) await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
if (opt('bps')) { await send('Network.enable'); await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: Number(opt('bps')), uploadThroughput: 3e5 }); }   // a slow network
await send('Page.navigate', { url });
const evalp = async expr => {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};
if (!opt('nowait')) await evalp(`for (let i = 0; i < 300 && !(window.cell && window.cell.counts && window.cell.counts.ribosomes); i++) await new Promise(r => setTimeout(r, 100));`);
const gpu = await evalp(`const c=document.createElement('canvas').getContext('webgl2'); const d=c&&c.getExtension('WEBGL_debug_renderer_info'); return d? c.getParameter(d.UNMASKED_RENDERER_WEBGL):'none';`);
console.log('renderer:', gpu);
let n = 0;
const snap = async () => { const r = await send('Page.captureScreenshot', { format: 'png' }); const p = `${out}-${n++}.png`; writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('shot', p); };
await new Promise(r => setTimeout(r, 600));
await snap();
for (const s of steps) {
  const v = await evalp(s);
  if (v && v.png && opt('save')) { writeFileSync(opt('save'), Buffer.from(v.png.split(',')[1], 'base64')); console.log('wrote', opt('save'), v.info || ''); }
  else if (v !== undefined && v !== null) console.log('step ->', JSON.stringify(v).slice(0, 400));
  await new Promise(r => setTimeout(r, 400));
  await snap();
}
console.log(logs.filter(l => !/^(log|debug|info):/.test(l)).join('\n') || 'no console errors');
clearTimeout(guard);
ws.close(); proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
