// Real ChatGPT only; owns/restores a lab unless LAB_OWNER names an already-held lock.
// EXT=/snap-readable/dev/butter loads exactly that extension; EXT= is the native control.
// LAB_ID=2 FIXTURES=math9,math12 OUT=<numeric-results.json> LABEL=head SMOOTHER=off
// RECORD=1 records first failing examples via x11grab (private MP4s in /tmp).
// With the extension it turns the rail on (Experimental, off on a new install) and puts the stored
// options back as found. Each jump starts from a named start state (rail-jump-start.mjs):
// `top-unpinned`, `end-pinned` (`top` and `bottom` are their aliases), `previous` (where the last jump
// ended) or a question's index. Per fixture, after loading earlier history, a control writes
// scrollTop to question 0 with the end pin set and no rail jump: `REPORT control <fixture> pulled|held`.
// ONLY=<json steps> replaces the sequence: [{"from":"end-pinned","to":0}, ...]; a negative `to` counts
// from the last question; `"reload": true` runs the step right after the reload, before earlier
// history loads. HOLD_MS (3000) is how long a top start must hold.
// Verdict lines: `PASS jump <fixture> <start>→<to>`, `FAIL jump ...: <why>` (a failed or visibly
// detoured jump), `PASS anchoring (<n> wheel unpins with cv on)` or `FAIL anchoring ...` (with
// Butter's `cv` setting on, the chat's scroll anchoring on at a wheel unpin's check, each such check
// also a `REPORT anchoring on` line; no line when no check ran with `cv` on), and
// `PASS control (<k> of <n> pulled)` or `FAIL control ...` when no fixture's control was pulled (the
// run could not see the end pull). A fixture whose control held only gets a REPORT: its end-pinned
// PASS lines are not evidence there. Exit 1 on any FAIL; 2 on a setup error, including a start that will not hold
// (`SETUP-ERROR jump ...`; the run goes on without that jump), which takes precedence.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { installScrollProbe } from './rail-jump-scroll-probe.mjs';
import { installProbe, classify } from './rail-jump-live-page.mjs';
import { STATES, startName, sameStart, setStart, control, endWriters } from './rail-jump-start.mjs';

const fixtures = (process.env.FIXTURES || 'math9,math12').split(',');
const label = process.env.LABEL || 'loaded';
const ONLY = process.env.ONLY ? JSON.parse(process.env.ONLY) : null;
for (const { from } of ONLY ?? []) if (!STATES.includes(startName(from)) && from !== 'previous' && !Number.isInteger(from)) {
  console.error(`ONLY: unknown start ${JSON.stringify(from)} (${[...STATES, 'top', 'bottom', 'previous'].join(', ')} or a question index)`);
  process.exit(2);
}
const borrowed = !!process.env.LAB_OWNER;
const lab = borrowed ? { ...L.getLab(process.env.LAB_ID || 2), owner: process.env.LAB_OWNER }
  : L.acquire(process.env.LAB_ID || 'auto', { owner: `rail-jump-live-${process.pid}`, needsFixture: fixtures[0], wait: 1800, perf: true });
const summary = { label, at: new Date().toISOString(), lab: lab.id, fixtures: [], jumps: [], controls: [], setupErrors: [], guard: { enabled: true, sendAttempts: 0, blockedMutations: 0 }, cleanup: {}, unpinChecks: [] };
let browser, context, page, ff, worker, previousSettings, cdp, fails = 0;
const worlds = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const HOLD_MS = Number(process.env.HOLD_MS ?? 3000);
// The default sequence: one jump right after the reload (from the end; before earlier history has
// loaded, a start at the top cannot hold: ChatGPT loads a page and moves the chat), then from both
// start states to every question, then four from where the previous jump ended.
const sequence = n => [
  { from: 'end-pinned', to: 0, reload: true },
  ...Array.from({ length: n }, (_, to) => ({ from: 'top-unpinned', to })),
  ...Array.from({ length: n }, (_, to) => ({ from: 'end-pinned', to })),
  { from: 'previous', to: 0 }, { from: 'previous', to: 1 }, { from: 'previous', to: -1 }, { from: 'previous', to: -2 },
];
// The per-frame evidence is tens of MB of raw capture: it stays local (notes/runs/README.md).
const out = process.env.OUT || path.join(L.root(), 'captures/rail-jump-live', `${label}.json`);
const recordings = new Set();
const nativeEvidence = process.env.NATIVE_EVIDENCE ?? path.resolve('notes/runs/2026-11-16-rail-jump-live/cause-native.json');
async function recordStart(id, phase) {
  if (process.env.RECORD_PHASE && process.env.RECORD_PHASE !== phase) return null;
  if (process.env.RECORD !== '1' || (recordings.has('detour') && recordings.has('failed'))) return null;
  const file = path.join(os.tmpdir(), `rail-jump-${process.pid}-${id}.mp4`);
  ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30',
    '-video_size', '1020x912', '-i', `${lab.display}+580,88`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  ff.on('error', () => {});
  await pause(300); return file;
}
async function recordStop(file, result) {
  if (!file) return;
  const proc = ff; ff = null;
  proc.stdin.write('q');
  const code = await new Promise(resolve => proc.on('close', resolve));
  if (code !== 0) throw Error('x11grab failed');
  // Retain candidates privately until a human/agent watches and approves the sanitized GIF.
  if (process.env.RECORD_ALL === '1' || (result.class !== 'clean' && !recordings.has(result.class))) {
    recordings.add(result.class); result.recording = file;
  } else fs.rmSync(file);
}
async function prepare() {
  const handle = await page.waitForFunction(() => {
    try { return window.__railJumpLive.prepare(); } catch { return false; }
  }, null, { timeout: 15000, polling: 100 });
  const value = await handle.jsonValue(); await handle.dispose(); return value;
}
async function open(name, settle = 0, earlier = true) {
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, name), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  if (worker) await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(installProbe);
  if (worker && process.env.PROBE !== '0') {
    const isolated = [...worlds.values()].find(c => c.origin.startsWith('chrome-extension://') && !c.auxData?.isDefault);
    if (!isolated) throw Error('Butter isolated execution context not found');
    await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: `(${installScrollProbe.toString()})('ISOLATED')` });
  }
  // Load earlier pages with ordinary scroll writes for identical setup with and without Butter.
  let previous = 0, stable = 0;
  for (let n = 0; earlier && n < 20 && stable < 3; n++) {
    await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = 280; });
    await page.waitForTimeout(30);
    await page.evaluate(() => window.__railJumpLive.edge('top'));
    await page.waitForTimeout(700);
    const state = await prepare();
    stable = state.questions === previous ? stable + 1 : 0; previous = state.questions;
  }
  if (settle) await page.waitForTimeout(settle);
  return prepare();
}
// The browser's scroll anchoring on the chat's content (stream/containment.css): whether Butter's
// `cv` setting is on (`data-butter-off` on <html> does not hold it), and each of the scroller's
// children: whether it holds the turns and its computed overflow-anchor. ChatGPT's own non-turn
// child computes none with or without Butter.
const anchoring = () => page.evaluate(() => {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  return { cv: !(document.documentElement.getAttribute('data-butter-off') || '').split(/\s+/).includes('cv'),
    children: [...s.children].map(c => ({ turns: !!c.querySelector('[data-turn-key]'), overflowAnchor: getComputedStyle(c).overflowAnchor })) };
});
// With `cv` on, every child of the scroller computes none (the rule names them all); with `cv` off
// the check only reports (null).
const anchoringOff = a => a.cv ? a.children.every(c => c.overflowAnchor === 'none') : null;
async function unpin() {
  const before = worker && await anchoring();
  // Wheel in the chat (not the rail) cancels any completed jump's following observer.
  await page.mouse.move(1000, 420); await page.mouse.wheel(0, 1);
  await page.waitForTimeout(50);
  if (!worker) return;
  // Pinned (before the wheel) and unpinned (after it), with `cv` on the browser's scroll anchoring
  // stays off for the chat's content.
  const check = { before, ...await anchoring() };
  const off = [before, check].map(anchoringOff);
  check.ok = off.includes(false) ? false : off[1];
  summary.unpinChecks.push(check);
  if (check.ok === false) console.log(`REPORT anchoring on with cv at a wheel unpin: ${JSON.stringify(check)}`);
}
const pinText = p => p == null ? 'null' : String(p);
async function jump(name, from, to, phase) {
  const tag = `${name} ${from}→${to}`;
  const meta = await prepare();
  if (!Number.isInteger(to) || to < 0 || to >= meta.questions) {
    summary.setupErrors.push({ jump: tag, why: `no question ${to}` });
    console.log(`SETUP-ERROR jump ${tag}: no question ${to} (${meta.questions} questions)`); return;
  }
  let calibration = null, start;
  if (!worker) {
    const original = await page.evaluate(() => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight).scrollTop);
    calibration = await page.evaluate(to => window.__railJumpLive.calibrate(to), to);
    if (from === 'previous') {
      await page.evaluate(original => { [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight).scrollTop = original; }, original);
      await page.waitForTimeout(700);
    }
  }
  if (Number.isInteger(from)) {
    await unpin();
    await page.evaluate(from => window.__railJumpLive.calibrate(from), from);
    await page.evaluate(from => window.__railJumpLive.position(from), from);
    await page.waitForTimeout(700);
    start = { state: `question-${from}`, ok: true, pin: await page.evaluate(() => window.__railJumpLive.pin()) };
  } else if (from === 'previous') {
    start = { state: 'previous', ok: true, pin: await page.evaluate(() => window.__railJumpLive.pin()) };
  } else {
    // ChatGPT can move or re-pin during setup: a start that will not hold is not a measured jump.
    start = await setStart(page, from, { unpin, holdMs: HOLD_MS });
    if (!start.ok) {
      summary.setupErrors.push({ jump: tag, phase, start });
      console.log(`SETUP-ERROR jump ${tag}: the ${from} start did not hold after ${start.attempts} attempts (${start.why}; pin ${pinText(start.pin)})`);
      return;
    }
  }
  if (start.pin == null) console.log(`REPORT pin ${tag}: ChatGPT's end pin was unreadable at the start (null); the start is not checked against it`);
  const file = await recordStart(summary.jumps.length + 1, phase);
  let traceEvents = [];
  const traceData = e => traceEvents.push(...e.value);
  if (process.env.TRACE === '1') {
    cdp.on('Tracing.dataCollected', traceData);
    await cdp.send('Tracing.start', { categories: process.env.TRACE_CATEGORIES || 'blink,blink.user_timing', options: 'record-as-much-as-possible' });
  }
  await page.evaluate(({ to, native }) => window.__railJumpLive.start(to, native), { to, native: !worker });
  if (worker) {
    const tick = page.locator('chatgpt-butter-nav .tick').nth(to);
    // Trusted CDP mouse click, without the locator's auto-scroll-to-view side effect.
    const box = await tick.boundingBox();
    if (!box) throw Error('target tick has no box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(1000, 420);
  } else await page.evaluate(to => window.__railJumpLive.nativeJump(to), to);
  await page.waitForFunction(() => window.__railJumpLive.done(), null, { timeout: 90000, polling: 100 });
  const data = await page.evaluate(() => window.__railJumpLive.result());
  if (process.env.TRACE === '1') {
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); await complete; cdp.off('Tracing.dataCollected', traceData);
    const marker = traceEvents.find(e => e.name === 'rail-cause-start' || (e.name === 'TimeStamp' && e.args?.data?.message === 'rail-cause-start'));
    const firstCall = data.scrollCalls.find(e => e.kind === 'scrollTo:before');
    const firstOffset = traceEvents.find(e => e.name === 'ScrollableArea::SetScrollOffset' && e.args?.offset?.includes(String(firstCall?.args[0]?.top)));
    const origin = marker?.ts ?? (firstOffset && firstCall ? firstOffset.ts - firstCall.t*1000 : null);
    const numeric = value => typeof value === 'number' || typeof value === 'boolean' || (typeof value === 'string' && /^(?:k)?(?:User|Programmatic|Clamping|Compositor|Anchoring|ScrollStart|Auto|Instant|Smooth)$/.test(value)) || (typeof value === 'string' && /^[-+\d., ()\[\]e]+$/.test(value)) ? value : Array.isArray(value) ? value.map(numeric) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,numeric(v)]).filter(([,v])=>v!==undefined)) : undefined;
    data.browserTrace = traceEvents.filter(e => /ScrollAnchor|ScrollAnimation|ScrollOffset|scroll animation|scroll offset animation|^NotifyAnimationFinished$|^SetScrollOffset$|^Type$|^Adjust$|^ComputeAdjustment$|^FindAnchor$/.test(e.name)).map(e => ({ name:e.name, pid:e.pid, tid:e.tid, t: origin == null ? null : (e.ts-origin)/1000, ph:e.ph, args:numeric(e.args) }));
  }
  if (worker && !data.events.some(e => e.type === 'rail-jump')) throw Error('click produced no dev rail trace; not a measured jump');
  const result = { case: name, from, to, phase, startState: start, calibration, ...classify(data), ...data, endWriters: endWriters(data.scrollCalls) };
  await recordStop(file, result);
  if (nativeEvidence && fs.existsSync(nativeEvidence) && worker) {
    const native = JSON.parse(fs.readFileSync(nativeEvidence));
    const proof = native.jumps.find(j => j.case === name && j.frames.at(-1).targetIndex === result.frames.at(-1).targetIndex && sameStart(j, from, start) && j.to === to && j.phase === phase && Math.abs(j.start - result.start) <= 32 && ((!result.failed || (j.failed && j.failureReason === result.failureReason)) && (!result.detour || (j.detour && (!result.losses.length || j.losses.length) && (!result.excursions.length || j.excursions.length)))) && (j.failed || j.detour));
    if (proof && result.class !== 'clean') { result.nativeAssertion = result.class; result.class = 'native'; result.nativeEvidence = nativeEvidence; }
  }
  summary.jumps.push(result);
  const why = result.class === 'clean' ? `samples=${result.samples}` : `positions=${JSON.stringify(result.changes.map(p => [p.t, Math.round(p.y)]))} targetTop=${result.targetTop} reversals=${result.reversals.length}`;
  console.log(`${label} ${name} from=${from} pin=${pinText(start.pin)} to=${to} phase=${phase} class=${result.class} ${why} pinAtClick=${pinText(result.pinAtStart)} pinAtEnd=${pinText(result.pinAtEnd)}`);
  const last = result.frames.at(-1), end = Math.round(last.h - last.vh);
  const writers = result.endWriters.length ? `; writes to the chat's end: ${JSON.stringify(result.endWriters)}` : '';
  verdict(['clean', 'native'].includes(result.class), `jump ${tag}`, `${result.failed ? `failed (${result.failureReason})` : 'visibly detoured'}, ended at ${Math.round(result.final)} of end ${end}${writers}`);
  if (result.class === 'native') console.log(`REPORT jump ${tag}: ${result.nativeAssertion} as without Butter (${result.nativeEvidence})`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(summary));
}
async function runControl(name) {
  const c = { case: name, ...await control(page, { unpin }) };
  summary.controls.push(c);
  if (!c.ok) {
    summary.setupErrors.push({ control: name, start: c.start });
    console.log(`SETUP-ERROR control ${name}: the end-pinned start did not hold (${c.start.why}; pin ${pinText(c.start.pin)})`); return;
  }
  const how = c.pulled ? `pulled (back at the end at ${c.at} ms)` : c.at === 'never-left' ? 'held (never left the end region)' : 'held';
  const note = c.pulled ? '' : `; ${name}'s end-pinned PASS lines are not evidence that a pull was prevented`;
  console.log(`REPORT control ${name} ${how}: write ${c.write} with pin ${pinText(c.start.pin)}, pin after ${pinText(c.pinAtEnd)}; [ms, scrollTop, scrollHeight, vh] every 500 ms ${JSON.stringify(c.trace)}${note}`);
}
try {
  if (Object.hasOwn(process.env, 'EXT')) {
    execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...process.env, LAB_ID: String(lab.id), LAB_EXTENSIONS: process.env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
    for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  }
  ({ browser, context } = await L.connect(lab));
  await L.sendGuard(context, lab);
  await context.route('**/*', route => {
    const req = route.request(), u = new URL(req.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) {
      summary.guard.blockedMutations++;
      if (/^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname)) summary.guard.sendAttempts++;
    }
    return route.fallback();
  });
  const extDir = L.browserArgs(lab)?.extensions[0];
  summary.extension = extDir || null;
  if (extDir) {
    const id = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
    worker = await context.newPage();
    await worker.goto(`chrome-extension://${id}/popup/popup.html`);
  }
  summary.build = worker ? await worker.evaluate(() => chrome.runtime.getManifest().version_name) : 'no extension';
  summary.chromium = browser.version();
  summary.instrumentation = { probes: process.env.PROBE !== '0', tracing: process.env.TRACE === '1', categories: process.env.TRACE === '1' ? process.env.TRACE_CATEGORIES || 'blink,blink.user_timing' : null };
  const custom = process.env.SMOOTHER === 'off' || process.env.OPTS;
  if (custom && !worker) throw Error('SMOOTHER and OPTS need the extension');
  if (worker) {
    // The fixtures load earlier history: Smoother scrolling (off on a new install and after the
    // update to defaults version 2) is switched on with the rail; OPTS or SMOOTHER set the rest.
    previousSettings = await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter ?? null);
    const opts = process.env.OPTS ? JSON.parse(process.env.OPTS) : custom ? { container: false, cv: false, throttle: false } : {};
    const base = custom ? { container: true, cv: true, throttle: true } : {};
    summary.opts = opts;
    await worker.evaluate(async ({ opts, base }) => { const { butter = {} } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: { ...butter, opts: { ...butter.opts, ...base, rail: true, older: true, seek: true, ...opts } } }); }, { opts, base });
  }
  page = context.pages().find(p => p !== worker) || await context.newPage();
  for (const other of context.pages()) if (other !== page && other !== worker) await other.close();
  cdp = await context.newCDPSession(page);
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.set(context.id, context));
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  if (process.env.PROBE !== '0') await page.addInitScript(installScrollProbe, 'MAIN');
  await page.bringToFront();
  // A negative `to` counts from the last of the `n` questions loaded.
  const run = async (name, steps, n, phase) => { for (const [k, s] of steps.entries()) await jump(name, startName(s.from), s.to < 0 ? n + s.to : s.to, phase(k)); };
  for (const name of fixtures) {
    // Immediately after the reload exposes its rail (before loading all earlier history).
    const cold = (ONLY ?? sequence(0)).filter(s => s.reload);
    if (cold.length) await run(name, cold, (await open(name, 0, false)).questions, () => 'reload');
    const meta = await open(name); summary.fixtures.push({ name, ...meta });
    if (meta.questions < 2 || (worker && !meta.trace)) throw Error('fixture/trace precondition failed');
    console.log(`FIXTURE ${name} ${JSON.stringify(meta)}`);
    await runControl(name);
    // From both start states to every tick, including unmounted turns. The first trip follows
    // setup; later ones use the settled page. Extra adjacent and far transitions start at the
    // previous target.
    await run(name, (ONLY ?? sequence(meta.questions)).filter(s => !s.reload), meta.questions, k => k === 0 ? 'reload-setup' : 'settled');
    await unpin(); // the last jump's pin ends too
  }
  const cvChecks = summary.unpinChecks.filter(c => c.ok !== null), anchoringOn = cvChecks.filter(c => c.ok === false).length;
  if (cvChecks.length) verdict(!anchoringOn, `anchoring (${cvChecks.length} wheel unpins with cv on)`, `the chat's scroll anchoring was on at ${anchoringOn} of them (REPORT anchoring lines)`);
  const ran = summary.controls.filter(c => c.ok), pulled = summary.controls.filter(c => c.pulled);
  if (ran.length) verdict(pulled.length > 0, `control (${pulled.length} of ${ran.length} pulled)`, 'no fixture\'s control was pulled (no pin or no growth after the write): this run cannot see the end pull');
  summary.counts = Object.fromEntries(fixtures.map(name => [name, Object.fromEntries(['clean', 'detour', 'failed', 'native'].map(c => [c, summary.jumps.filter(j => j.case === name && j.class === c).length]))]));
  summary.metrics = { jumps: summary.jumps.length, failed: summary.jumps.filter(j=>j.failed).length, visibleDetour: summary.jumps.filter(j=>j.detour).length, native: summary.jumps.filter(j=>j.class === 'native').length, gated: summary.jumps.filter(j=>!['clean','native'].includes(j.class)).length, postCompletion: summary.jumps.filter(j=>j.postCompletion.length).length, postCompletionEventMoves: summary.jumps.filter(j=>j.postEndMoves.length).length, afterLanding: summary.jumps.filter(j=>j.afterLanding.length).length, rawReversal: summary.jumps.filter(j=>j.reversals.length).length, rawReversalCount: summary.jumps.reduce((n,j)=>n+j.reversals.length,0), unpinChecks: summary.unpinChecks.length, anchoringOn: summary.unpinChecks.filter(c => c.ok === false).length, cvOff: summary.unpinChecks.filter(c => c.ok === null).length,
    starts: Object.fromEntries(['top-unpinned', 'end-pinned', 'previous'].map(s => [s, summary.jumps.filter(j => j.from === s).length])), pinUnread: summary.jumps.filter(j => j.startState.pin == null).length,
    controls: summary.controls.length, controlsPulled: summary.controls.filter(c => c.pulled).length, setupErrors: summary.setupErrors.length, fails };
  console.log(`SUMMARY ${JSON.stringify(summary.metrics)}`);
  process.exitCode = summary.setupErrors.length ? 2 : fails ? 1 : 0;
} catch (error) {
  summary.error = error.message.replace(/https?:\/\/\S+/g, '<private-url>');
  console.error(`HARNESS ERROR: ${summary.error}`); process.exitCode = 2;
} finally {
  if (ff) { ff.stdin.write('q'); await new Promise(resolve => ff.on('close', resolve)); }
  if (previousSettings !== undefined && worker) {
    const back = await worker.evaluate(async value => { await (value == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: value })); return (await chrome.storage.local.get('butter')).butter ?? null; }, previousSettings).catch(() => undefined);
    summary.cleanup.optionsPutBack = JSON.stringify(back) === JSON.stringify(previousSettings);
    console.log(`REPORT options put back: same as before ${summary.cleanup.optionsPutBack}`);
  }
  await browser?.close().catch(() => {});
  if (!borrowed) {
    try { const restored = await L.restore(lab, { log: () => {} }); summary.cleanup.restored = restored.ok; }
    finally { summary.cleanup.released = L.release(lab); }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(summary));
  console.log(`EXIT ${process.exitCode || 0}; evidence ${out}`);
}
