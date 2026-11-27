// Screenshots of single frames after a find in a held, veiled block (find-frame/report.md). Drives
// Playwright's chrome-headless-shell over raw CDP with BeginFrame control: no frame runs until
// HeadlessExperimental.beginFrame, whose screenshot is that frame as drawn. The synthetic chat is
// test/helpers/veil-page.mjs's, with Butter's containment.css and a marker, blocks at their
// content's height. Then the act (MODE, below), and four frames, each saved as a PNG; the page's
// log of the target block's flags (1 veil, 2 opacity 0, 4 content skipped, 8 held) at each
// frame's rAF, after it (a task posted from the rAF) and at the state-change event goes to stdout.
//   node notes/runs/2026-11-24-veil-acceptance/final/find-frame/beginframe.mjs <out-prefix>
//   MODE=findScroll-busy|findScroll-raf|selectScroll-raf|focusScroll-raf|scroll-raf|find-raf
//   MARKER=<offscreen.js to load> (default: the checkout's)  NOVEIL=1 (no opacity rule: control)
// "-raf": the act runs in frame 0's requestAnimationFrame. "-busy": the act runs in a task that
// stays busy 60 ms while frame "b" is begun, so the frame waits for the task, as on a busy page.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const H = await import(`${root}test/helpers/veil-page.mjs`);
const pw = `${homedir()}/.cache/ms-playwright`;
const shellDir = readdirSync(pw).filter((d) => d.startsWith('chromium_headless_shell-')).sort().at(-1);
const SHELL = `${pw}/${shellDir}/chrome-headless-shell-linux64/chrome-headless-shell`;
const out = process.argv[2] || `${tmpdir()}/find-frame`;
const mode = process.env.MODE || 'findScroll-busy';

const proc = spawn(SHELL, ['--remote-debugging-port=0', '--enable-begin-frame-control',
  '--run-all-compositor-stages-before-draw', '--no-sandbox',
  `--user-data-dir=${mkdtempSync(`${tmpdir()}/find-frame-ud-`)}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/ws:\/\/\S+/); if (m) res(m[0]); });
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const wait = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (!m.id || !wait.has(m.id)) return;
  const [res, rej] = wait.get(m.id);
  wait.delete(m.id);
  if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id;
  wait.set(i, [res, rej]);
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
const { browserContextId } = await send('Target.createBrowserContext');
const { targetId } = await send('Target.createTarget', { url: 'about:blank', enableBeginFrameControl: true, browserContextId });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cmd = (m, p) => send(m, p, sessionId);
await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });

let t = 1000;
const frame = (shot) => { t += 16; return cmd('HeadlessExperimental.beginFrame', { frameTimeTicks: t, interval: 16, ...(shot && { screenshot: { format: 'png' } }) }); };
// Begins frames every few ms until `p` settles (rAF, the flush and pre-layout need frames).
const pump = async (p) => {
  let on = true;
  const loop = (async () => { while (on) { await frame(); await new Promise((r) => setTimeout(r, 4)); } })();
  try { return await p; } finally { on = false; await loop; }
};
const ev = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
};
const call = (fn, arg) => ev(`(${fn})(${JSON.stringify(arg)})`);
const sleep = (ms) => pump(new Promise((r) => setTimeout(r, ms)));
const save = (name, r) => r.screenshotData && writeFileSync(`${out}-${mode}-${name}.png`, Buffer.from(r.screenshotData, 'base64'));

let css = readFileSync(`${root}extension/stream/containment.css`, 'utf8');
if (process.env.NOVEIL) css = css.replace('opacity: 0;', '');
const js = readFileSync(process.env.MARKER || `${root}extension/stream/offscreen.js`, 'utf8');
await ev(`document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(css)} })); 0`);
await ev(`(() => { const s = document.createElement('script'); s.textContent = ${JSON.stringify(js)}; document.head.append(s); })(); 0`);
await pump(call(H.build, { turns: 2, blocks: 40, renderer: 'classic', transition: true, blockPx: H.BLOCK_PX }));
await ev(`document.head.append(Object.assign(document.createElement('style'), { textContent: '#answer p { height: auto }' })); 0`);
await sleep(1500);
await pump(call(H.scrollTo, { selector: '#answer', index: 0 }));
await pump(call(H.stream, { n: 240, perFrame: 6, math: 1 }));
await sleep(1300); // the flush holds the blocks below the fold
await ev(`document.querySelector('#answer [data-talvt-turn-state]').setAttribute('data-talvt-turn-state', 'complete'); 0`);
await sleep(2500); // pre-layout
const before = await ev(`(() => {
  const b = window.T = [...document.querySelectorAll('#answer p')].find((p) => p.textContent.includes('zq200zq'));
  b.insertAdjacentHTML('beforeend', ' <a href="#x" id="lnk">link</a>');
  window.fl = () => { const cs = getComputedStyle(b), c = b.firstElementChild;
    const skip = cs.contentVisibility === 'auto' && !c.checkVisibility({ contentVisibilityAuto: true });
    return (b.hasAttribute('data-butter-veil') ? 1 : 0) | (cs.opacity === '0' ? 2 : 0) | (skip ? 4 : 0) | (b.hasAttribute('data-butter-unrendered') ? 8 : 0); };
  window.L = [];
  addEventListener('contentvisibilityautostatechange', (e) => { if (e.target === b) L.push('event skipped=' + e.skipped + ', flags then ' + fl()); }, true);
  return fl(); })()`);
await sleep(200);
const ACTS = {
  find: `window.find('zq200zq', false, false, true, false, false, false)`,
  findScroll: `window.find('zq200zq', false, false, true, false, false, false); T.scrollIntoView({ block: 'center' })`,
  selectScroll: `{ const r = document.createRange(); r.selectNodeContents(T.firstChild); getSelection().removeAllRanges(); getSelection().addRange(r); T.scrollIntoView({ block: 'center' }); }`,
  focusScroll: `document.getElementById('lnk').focus()`,
  scroll: `T.scrollIntoView({ block: 'center' })`,
};
const [kind, where] = mode.split('-');
if (where === 'busy') {
  const p = ev(`L.push('task: act'); ${ACTS[kind]}; { const e = performance.now() + 60; while (performance.now() < e); } L.push('task: end'); 0`);
  await new Promise((r) => setTimeout(r, 15));
  const b = frame(true); // sent while the task runs
  await p;
  save('b', await b);
  await ev(`L.push('(frame b drawn)'); 0`);
} else {
  await ev(`requestAnimationFrame(() => { L.push('rAF 0: flags ' + fl() + ', act'); ${ACTS[kind]}; setTimeout(() => L.push('after frame 0: flags ' + fl())); }); 0`);
}
for (let i = 0; i < 4; i++) {
  if (i > 0 || where === 'busy') await ev(`requestAnimationFrame(() => { L.push('rAF ${i}: flags ' + fl()); setTimeout(() => L.push('after frame ${i}: flags ' + fl())); }); 0`);
  save(i, await frame(true));
  await new Promise((r) => setTimeout(r, 30));
}
console.log(`${mode}${process.env.NOVEIL ? ' (no veil rule)' : ''}: flags before ${before}`);
console.log(`  ${(await ev('L')).join('\n  ')}`);
ws.close();
proc.kill();
