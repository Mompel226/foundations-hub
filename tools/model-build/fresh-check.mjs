// A first visit, as a pupil makes it: the page loaded fresh, then Zoom in pressed through all seven levels; at each
// level, are the names there? Daniel, 4 Oct: on his MacBook, a fresh load showed no names at the organ system.
//   node fresh-check.mjs <url> [--slow 4] [--bps 600000] [--runs 3] [--at <ms after the loading screen goes>]
// --slow: the processor slowed that many times; --bps: the network's bytes a second (both as a slower laptop on a school
// network). Prints one line per run: the seconds the loading screen stayed, and each level's names (count); exits 1 if
// any level that has names showed none, or the page threw an error.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const url = argv[0], runs = Number(opt('runs', 3)), slow = Number(opt('slow', 0)), bps = Number(opt('bps', 0)), at = Number(opt('at', 0));
const LEVELS = ['organism', 'system', 'organ', 'tissue', 'cell', 'inside', 'molecules'];
let bad = 0;
for (let run = 0; run < runs; run++) {
  const port = 9400 + ((process.pid + run) % 400), prof = mkdtempSync(join(tmpdir(), 'freshcheck-'));
  const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof,
    '--no-first-run', '--hide-scrollbars', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--window-size=1440,900', '--force-device-scale-factor=2', 'about:blank'], { stdio: 'ignore' });
  let info; for (let i = 0; i < 100; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (info.length) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const ws = new WebSocket(info.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m.result || m); wait.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200)); };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; wait.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async expr => (await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true })).result?.value;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  if (bps) await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: bps, uploadThroughput: 3e5 });
  if (slow) await send('Emulation.setCPUThrottlingRate', { rate: slow });
  await send('Page.navigate', { url });
  const t0 = Date.now();
  const loaded = await ev(`for (let i = 0; i < 2400 && !(window.cell && !document.querySelector('#zoom').classList.contains('is-loading')); i++) await new Promise(r => setTimeout(r, 50));
    return !!window.cell && !document.querySelector('#zoom').classList.contains('is-loading')`);
  const loadS = ((Date.now() - t0) / 1000).toFixed(1);
  if (at) await new Promise(r => setTimeout(r, at));
  const levels = [];
  for (let i = 1; i < LEVELS.length; i++) {
    const r = await ev(`document.querySelector('#btnGo').click();
      for (let k = 0; k < 900 && !(cell.level === '${LEVELS[i]}' && !cell.flying); k++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 1500));
      const names = [...document.querySelectorAll('.tags.is-shown .tag')].filter(e => !e.hidden).length;
      return { level: cell.level, names, why: (cell.tagWhy || []).length }`);
    levels.push(r);
  }
  const line = levels.map(r => `${r.level} ${r.names}`).join(' · ');
  const missing = levels.filter(r => !r.names);
  if (!loaded || missing.length || errors.length) bad++;
  console.log(`run ${run + 1}: loading ${loadS} s${loaded ? '' : ' (NEVER FINISHED)'} | ${line}${missing.length ? '  ← NO NAMES at ' + missing.map(r => r.level).join(', ') : ''}${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  ws.close(); proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
}
console.log(bad ? `${bad} of ${runs} runs had a problem` : `all ${runs} runs: every level named`);
process.exit(bad ? 1 : 0);
