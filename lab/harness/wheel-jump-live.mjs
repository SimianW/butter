// Live wheel scroll on a real ChatGPT fixture: does the chat jump back toward its top while the
// user wheels down? Seam 3 (docs/agents/seams.md). Takes, restores and releases the lab lock itself
// unless LAB_OWNER names a lock the caller already holds.
//
// LAB_ID=2 EXT=<unpacked build dir, empty = no extensions> LABEL=<name> [FIXTURES=ats12] [LOADS=12]
//   [STEPS=150] [OPTS=<settings json>] [PROBE=0] [RECORD=1] [OUT=<file>]
//   [RESTART=each] [MODE=arm] [SETTLE=9000] [UP=top|<n>] [FLAGS=<chromium flags>]
//   [GAP=<ms>] [TRACE=1] [PAGELOG=1] [SHIFT=1]
//   node lab/harness/wheel-jump-live.mjs
//
// Each load: a fresh page.goto of the fixture, the composer, SETTLE ms, a snapshot of the scroller
// (its and its children's overflow-anchor, scrollTop/Height, whether it opened at its end, ...), then
// real wheel input: up (to the top, or UP steps), then 700 px steps down to the end or STEPS. A jump
// back is a drop in scrollTop of more than one viewport during the wheel-down phase; the scroll probe
// (rail-jump-scroll-probe.mjs, MAIN and Butter's world) says whether a wrapped script write made it.
// MODE=arm is the 2026-11-16 scrollbar-cover arm's procedure: SETTLE 9000, `scrollTop = scrollHeight`
// until the end holds 5 times (at most 80 writes), UP=8. RESTART=each restarts the browser (same EXT
// and FLAGS) before every load. RECORD=1 screen-records the wheel-down phase (at most REC_MAX ms) and
// keeps the first failed load's MP4 (no failure: the first load's) in REC_DIR, private.
// A load where ChatGPT shows its "Could not load" page twice is skipped (REPORT), not judged.
// Diagnostics, all off by default (2026-11-16 cause run, notes/runs/2026-11-16-wheel-jump-top/cause.md):
// GAP waits that many ms before every load but the first. TRACE=1 takes a Chromium trace
// (TRACE_CATEGORIES, default `blink,blink.user_timing`) of the wheel-down phase and keeps only the
// scroll-related events, on the page's clock. PAGELOG=1 logs, without geometry reads, the mounted turns
// (chat ordinals), turn insertions and removals, and content-visibility skipping at every scroll event.
// SHIFT=1 tracks an on-screen element across every wheel step and reports the view shift: how far it
// moved on screen beyond the user's own scroll.
// Exit 1: any FAIL. Exit 2: setup error, or half the loads or more skipped.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { installScrollProbe } from './rail-jump-scroll-probe.mjs';

const env = process.env;
const fixtures = (env.FIXTURES || 'ats12').split(',');
const label = env.LABEL || 'loaded';
const arm = env.MODE === 'arm';
const LOADS = Number(env.LOADS || 12), STEPS = Number(env.STEPS || 150);
const SETTLE = Number(env.SETTLE || 9000), UP = env.UP || (arm ? '8' : 'top');
const STEP_PX = 700, STEP_WAIT = 140;
const restartEach = env.RESTART === 'each';
const probe = env.PROBE !== '0';
const GAP = Number(env.GAP || 0), trace = env.TRACE === '1', pageLog = env.PAGELOG === '1', shift = env.SHIFT === '1';
const TRACE_KEEP = /ScrollableArea|ScrollOffset|ScrollAnchor|ScrollAnimat|^Type$|^Adjust$|FindAnchor|ComputeAdjustment|wheel-jump-trace|HandleGestureScroll|HandleMouseWheel|ScrollBegin|ScrollUpdate|ScrollEnd|ScrollTo|ScrollBy/;
const CROP = { x: 580, y: 88, w: 1020, h: 912 }; // chat column and rail: no URL bar, sidebar or account
const REC_MAX = Number(env.REC_MAX || 9500);
const recDir = env.REC_DIR || path.join(L.root(), 'captures/2026-11-16-wheel-jump-top');
const out = env.OUT || path.join(L.root(), 'captures/wheel-jump-live', `${label}.json`);
const borrowed = !!env.LAB_OWNER;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const scrub = s => String(s).replace(/https?:\/\/\S+/g, '<private-url>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>');

let lab;
const summary = { label, at: new Date().toISOString(), mode: arm ? 'arm' : 'default', settleMs: SETTLE, up: UP, stepPx: STEP_PX,
  restartEach, flags: env.FLAGS || '', probes: probe, gapMs: GAP, trace, pageLog, shift, guard: { enabled: true, blockedMutations: 0, sendAttempts: 0 }, loads: [], cleanup: {} };
let browser, context, page, worker, cdp, previousSettings, extId = null, ff = null;
const worlds = new Map();
const save = () => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(summary, null, 1)); };

async function restartBrowser() {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: env.FLAGS || '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2000);
}

async function connectBrowser() {
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
  const args = L.browserArgs(lab);
  const extDir = args?.extensions[0];
  summary.extension = extDir ? path.basename(path.dirname(extDir)) + '/' + path.basename(extDir) : null;
  summary.browserFlags = args?.flags ?? null;
  worker = null; extId = null;
  if (extDir) {
    extId = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
    worker = await context.newPage();
    await worker.goto(`chrome-extension://${extId}/popup/popup.html`);
    summary.build = await worker.evaluate(() => chrome.runtime.getManifest().version_name);
    if (env.OPTS) {
      const stored = await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter ?? null);
      if (previousSettings === undefined) previousSettings = stored;
      summary.opts = JSON.parse(env.OPTS);
      await worker.evaluate(async opts => { const { butter = {} } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: { ...butter, opts: { ...butter.opts, ...opts } } }); }, summary.opts);
    }
    summary.settings = await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter?.opts ?? null);
  } else summary.build = 'no extension';
  summary.chromium = browser.version();
  page = context.pages().find(p => p !== worker) || await context.newPage();
  for (const other of context.pages()) if (other !== page && other !== worker) await other.close();
  cdp = await context.newCDPSession(page);
  worlds.clear();
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.set(context.id, context));
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  if (probe) await page.addInitScript(installScrollProbe, 'MAIN');
  if (pageLog) await page.addInitScript(installSkipLog);
  await page.bringToFront();
}

// In the page: the scroller's state, the styles the brief asks for, and a scroll-event log.
function snapshot() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  if (!s) return null;
  const html = document.documentElement;
  const turns = s.querySelectorAll('[data-turn-key]');
  const cs = getComputedStyle(s);
  return {
    t: performance.now(), y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight,
    atEnd: s.scrollTop + s.clientHeight >= s.scrollHeight - 2,
    overflowAnchor: cs.overflowAnchor,
    children: [...s.children].map(c => ({ turns: !!c.querySelector('[data-turn-key]'), overflowAnchor: getComputedStyle(c).overflowAnchor, height: Math.round(c.getBoundingClientRect().height) })),
    butterOff: html.hasAttribute('data-butter-off') ? html.getAttribute('data-butter-off') : null,
    butterAttrs: [...html.attributes].filter(a => a.name.startsWith('data-butter')).map(a => a.name),
    turns: turns.length,
    turnsCvAuto: [...turns].filter(t => getComputedStyle(t).contentVisibility === 'auto').length,
    butterHosts: [...document.querySelectorAll('chatgpt-butter-nav')].map(e => e.tagName.toLowerCase()),
    theme: html.classList.contains('dark') ? 'dark' : html.classList.contains('light') ? 'light' : html.dataset.theme || null,
    inner: [innerWidth, innerHeight], visibility: document.visibilityState,
    shift: measureShift(),
  };
  // SHIFT=1: the element shiftPick chose before this wheel step. Its on-screen move (dTop) plus the
  // user's own scroll (user: the step, cut to the scroll range before it) is the view shift; dTop plus
  // scrollTop's move is how far it moved in the chat's content (doc), which anchoring does not undo.
  function measureShift() {
    const p = window.__wheelShift;
    if (!p) return undefined;
    window.__wheelShift = null;
    if (!p.el) return { dir: p.dir, none: true };
    if (!p.el.isConnected) return { dir: p.dir, kind: p.kind, lost: true, dY: Math.round(s.scrollTop - p.y) };
    const dTop = p.el.getBoundingClientRect().top - p.top, dY = s.scrollTop - p.y;
    const user = p.dir > 0 ? Math.min(p.step, Math.max(0, p.max - p.y)) : -Math.min(p.step, Math.max(0, p.y));
    const r = v => Math.round(v * 10) / 10;
    return { dir: p.dir, kind: p.kind, dTop: r(dTop), dY: r(dY), user: r(user), visual: r(dTop + user), doc: r(dTop + dY), clamped: Math.abs(user) < p.step - 0.5 };
  }
}
// SHIFT=1, before a wheel step: an answer block (else a user message, else a turn) at 80% of the
// viewport's height for a step down, 20% for a step up, so a 700 px step keeps it on screen.
function shiftPick({ dir, step, x }) {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const r = s.getBoundingClientRect();
  const blockParent = '[data-markdown-text-style], [class*="DilResponseRoot"]';
  let el = null, kind = null;
  for (const dy of [0, -40, 40, -80, 80, -120, 120]) {
    const hit = document.elementsFromPoint(x, r.top + s.clientHeight * (dir > 0 ? 0.8 : 0.2) + dy).find(e => e !== s && s.contains(e));
    for (let e = hit; e && e !== s && !el; e = e.parentElement) {
      if (e.parentElement?.matches(blockParent) && !e.matches('[data-dil-source-message-id]')) { el = e; kind = 'block'; }
      else if (e.matches('[data-message-author-role="user"]')) { el = e; kind = 'user'; }
    }
    if (!el && hit?.closest('[data-turn-key]')) { el = hit.closest('[data-turn-key]'); kind = 'turn'; }
    if (el) break;
  }
  window.__wheelShift = { el, kind, dir, step, top: el?.getBoundingClientRect().top, y: s.scrollTop, max: s.scrollHeight - s.clientHeight };
}
// PAGELOG=1, before page scripts: which turns and answer blocks content-visibility is skipping now.
function installSkipLog() {
  if (window.__wheelSkip) return;
  const S = window.__wheelSkip = { turns: new Set(), blocks: new Set(), events: [] };
  document.addEventListener('contentvisibilityautostatechange', e => {
    const el = e.target, turn = el.matches?.('[data-turn-key]');
    (turn ? S.turns : S.blocks)[e.skipped ? 'add' : 'delete'](el);
    if (S.events.length < 50000) S.events.push([Math.round(performance.now()), turn ? 1 : 0, e.skipped ? 1 : 0, el.closest?.('[data-turn-key]') || null]);
  }, true);
}
// PAGELOG=1, wheel-down phase: per scroll event the mounted turns as chat ordinals, and the skipped and
// marked (data-butter-seen) turns and blocks; turn insertions and removals anywhere in the scroller (each
// turn sits in its own wrapper), and the inline style of the wrappers' parent when it changes. Raw
// turn keys stay in the page; only ordinals of ChatGPT's turn list leave it. No geometry reads.
function startPageLog() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const S = window.__wheelSkip;
  const order = () => {
    const t = s.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let depth = 0; f && depth < 80; depth++, f = f.return)
      if (Array.isArray(f.memoizedProps?.entries) && f.memoizedProps.entries.every(e => typeof e?.turnKey === 'string')) return f.memoizedProps.entries.map(e => e.turnKey);
    return null;
  };
  let ids = order() || [];
  const idx = el => { if (!el) return -1; let i = ids.indexOf(el.dataset.turnKey); if (i < 0) { ids = order() || ids; i = ids.indexOf(el.dataset.turnKey); } return i; };
  const turnsIn = n => n.nodeType !== 1 ? [] : n.matches('[data-turn-key]') ? [n] : n.firstElementChild ? [...n.querySelectorAll('[data-turn-key]')] : [];
  const live = set => { let n = 0; for (const el of set) if (el.isConnected) n++; else set.delete(el); return n; };
  const P = window.__wheelPage = { at: performance.now(), scroll: [], muts: [], shape: ids.length ? 'entries' : 'none', cvStart: S ? S.events.length : 0 };
  const list = s.querySelector('[data-turn-key]')?.parentElement?.parentElement;
  P.listChildren = list ? list.children.length : 0;
  let style = list?.getAttribute('style') || '';
  P.muts.push([Math.round(performance.now()), 'style', style, P.listChildren]);
  P.onScroll = () => {
    const mounted = [...s.querySelectorAll('[data-turn-key]')].map(idx);
    P.scroll.push([Math.round(performance.now()), Math.round(s.scrollTop), s.scrollHeight, mounted.length, mounted.length ? Math.min(...mounted) : -1, mounted.length ? Math.max(...mounted) : -1, ids.length,
      S ? live(S.turns) : -1, S ? live(S.blocks) : -1, s.querySelectorAll('[data-turn-key][data-butter-seen]').length, s.querySelectorAll('[data-butter-seen]:not([data-turn-key]), [data-butter-unrendered]').length]);
  };
  s.addEventListener('scroll', P.onScroll, { passive: true });
  P.mo = new MutationObserver(records => {
    const t = Math.round(performance.now());
    for (const r of records) {
      for (const n of r.addedNodes) for (const el of turnsIn(n)) P.muts.push([t, '+', idx(el), ids.length]);
      for (const n of r.removedNodes) for (const el of turnsIn(n)) P.muts.push([t, '-', ids.indexOf(el.dataset.turnKey), ids.length, S ? (S.turns.has(el) ? 1 : 0) : -1]);
    }
    const now = list?.getAttribute('style') || '';
    if (now !== style) P.muts.push([t, 'style', (style = now), list ? list.children.length : 0]);
  });
  P.mo.observe(s, { childList: true, subtree: true });
}
function stopPageLog() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const P = window.__wheelPage, S = window.__wheelSkip;
  s?.removeEventListener('scroll', P.onScroll); P.mo.disconnect();
  // Skip changes since the down phase began: [t, isTurn, skipped, its turn still connected (1/0, -1 none)].
  const cv = S ? S.events.slice(P.cvStart).map(([t, turn, skipped, el]) => [t, turn, skipped, el ? (el.isConnected ? 1 : 0) : -1]) : [];
  return { scroll: P.scroll, muts: P.muts, cv, shape: P.shape, listChildren: P.listChildren };
}
function startLog() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const w = window.__wheelJump = { log: [], writes: [] };
  w.onScroll = () => w.log.push([Math.round(performance.now()), Math.round(s.scrollTop), s.scrollHeight]);
  s.addEventListener('scroll', w.onScroll, { passive: true });
  // The probe's write records (both worlds dispatch on the scroller). Only writes, with stacks.
  w.onProbe = e => { const d = JSON.parse(e.detail); if (/:before$/.test(d.kind)) w.writes.push(d); };
  s.addEventListener('rail-scroll-probe', w.onProbe);
  document.dispatchEvent(new Event('rail-probe-start'));
}
function stopLog() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const w = window.__wheelJump;
  document.dispatchEvent(new Event('rail-probe-stop'));
  s?.removeEventListener('scroll', w.onScroll); s?.removeEventListener('rail-scroll-probe', w.onProbe);
  return { log: w.log, writes: w.writes };
}
// RECORD=1 only: a small fixed readout, labelled as the harness's, so a masked GIF still shows where the chat is.
function readout() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const d = document.createElement('div');
  d.id = 'wheel-jump-readout';
  d.style.cssText = 'position:fixed;left:604px;top:64px;z-index:2147483647;pointer-events:none;width:600px;box-sizing:border-box;font:600 22px/1.3 monospace;background:#ffeb3b;color:#000;padding:6px 10px;border:2px solid #000';
  const draw = () => { d.textContent = `scrollTop ${Math.round(s.scrollTop)} / ${s.scrollHeight - s.clientHeight}  (harness readout)`; };
  draw(); s.addEventListener('scroll', draw, { passive: true }); document.documentElement.append(d);
}

const state = () => page.evaluate(snapshot);
let pointerX = 0;
const wheel = async dy => {
  if (shift) await page.evaluate(shiftPick, { dir: Math.sign(dy), step: Math.abs(dy), x: pointerX });
  await page.mouse.wheel(0, dy); await pause(STEP_WAIT); return state();
};
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
// View shift over wheel steps: steps whose element stayed connected and whose step was not cut by the scroll range.
function shiftStats(rows) {
  const ok = rows.filter(r => r && !r.none && !r.lost && !r.clamped), v = ok.map(r => Math.abs(r.visual)), d = ok.map(r => Math.abs(r.doc));
  return { steps: rows.length, tracked: ok.length, lost: rows.filter(r => r?.lost).length, none: rows.filter(r => !r || r.none).length, clamped: rows.filter(r => r?.clamped).length,
    over4: v.filter(x => x > 4).length, median: median(v), max: v.length ? Math.max(...v) : null, docOver4: d.filter(x => x > 4).length, docMax: d.length ? Math.max(...d) : null };
}
const fmtShift = st => `${st.over4}/${st.tracked} over 4px, median ${st.median ?? '-'}, max ${st.max ?? '-'} (lost ${st.lost}, none ${st.none}, clamped ${st.clamped}; content moves >4px ${st.docOver4}, max ${st.docMax ?? '-'})`;

async function recordStart(name) {
  fs.mkdirSync(recDir, { recursive: true });
  const file = path.join(recDir, `${label}-${name}.mp4`);
  ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30',
    '-video_size', `${CROP.w}x${CROP.h}`, '-i', `${lab.display}+${CROP.x},${CROP.y}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  ff.on('error', () => {});
  await pause(400);
  return file;
}
async function recordStop() {
  if (!ff) return;
  const proc = ff; ff = null;
  proc.stdin.write('q');
  const code = await new Promise(resolve => proc.on('close', resolve));
  if (code !== 0) throw Error('x11grab failed');
}

// Jumps back: scrollTop falls more than one viewport below its peak since the last rise.
function jumpsBack(log, vh) {
  const jumps = []; let peak = -Infinity, current = null, prev = null;
  for (const [t, y, h] of log) {
    if (current && y < current.to) { current.to = y; current.toT = t; current.hTo = h; }
    else if (current && y > current.to) { current = null; peak = y; }
    if (!current && peak - y > vh) { current = { from: peak, to: y, t, fromT: prev?.[0] ?? t, toT: t, hFrom: prev?.[2] ?? h, hTo: h }; jumps.push(current); }
    if (!current) peak = Math.max(peak, y);
    prev = [t, y, h];
  }
  return jumps;
}
const frames = stack => scrub(stack || '').split('\n').slice(1, 7).map(l => l.trim());

async function oneLoad(name, i, firstAfterRestart, recordThis, retry = true) {
  const t0 = Date.now();
  await page.goto(L.fixture(lab, name), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.ProseMirror:visible').first().waitFor({ timeout: 60000 });
  const composerMs = Date.now() - t0;
  if (worker) await page.locator('chatgpt-butter-nav').waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  const settle = [];
  for (let t = 0; t < SETTLE; t += 1000) { await pause(Math.min(1000, SETTLE - t)); const s = await state(); if (s) settle.push([Math.round(s.y), s.h, s.turns]); }
  const at = await state();
  if (!at) throw Error('no visible .thread-scroll-container');
  // ChatGPT sometimes shows its "Could not load this ChatGPT conversation" page (no turns), with or
  // without Butter: not a measurement. One retry, then skip.
  if (!at.turns) return retry ? oneLoad(name, i, false, recordThis, false) : { fixture: name, i, firstAfterRestart, skipped: true, at: { ...at, t: undefined } };
  if (probe && worker) {
    const isolated = [...worlds.values()].find(c => c.origin.startsWith('chrome-extension://') && !c.auxData?.isDefault);
    if (isolated) await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: `(${installScrollProbe.toString()})('ISOLATED')` });
    else summary.isolatedProbeMissing = (summary.isolatedProbeMissing || 0) + 1;
  }
  const load = { fixture: name, i, firstAfterRestart, retried: !retry, composerMs, settle, at: { ...at, t: undefined }, readout: recordThis };
  pointerX = Math.round(at.inner[0] * 0.62);
  await page.mouse.move(pointerX, Math.round(at.inner[1] * 0.4));
  if (arm) {
    let ok = 0, n = 0;
    for (; ok < 5 && n < 80; n++) {
      const end = await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); const e = s.scrollTop + s.clientHeight >= s.scrollHeight - 2; s.scrollTop = s.scrollHeight; return e; });
      ok = end ? ok + 1 : 0; await pause(700);
    }
    load.endWrites = { writes: n, held: ok >= 5, after: await state().then(s => ({ y: Math.round(s.y), h: s.h, atEnd: s.atEnd })) };
  }
  // Wheel up: UP steps, or until scrollTop stays 0 for three steps.
  let up = 0; const upShift = [];
  for (let zero = 0; up < STEPS && (UP === 'top' ? zero < 3 : up < Number(UP)); up++) { const s = await wheel(-STEP_PX); upShift.push(s.shift); zero = s.y <= 0 ? zero + 1 : 0; }
  await pause(arm ? 2000 : 1000);
  const beforeDown = await state();
  load.up = { steps: up, y: Math.round(beforeDown.y), h: beforeDown.h };
  if (recordThis) await page.evaluate(readout);
  const file = recordThis ? await recordStart(`${name}-${i}`) : null;
  let traceEvents = null, traceMark = null, traceNames = null;
  if (trace) {
    traceEvents = []; traceNames = {};
    cdp.on('Tracing.dataCollected', e => { for (const ev of e.value) { traceNames[ev.name] = (traceNames[ev.name] || 0) + 1; if (TRACE_KEEP.test(ev.name)) traceEvents.push(ev); } });
    await cdp.send('Tracing.start', { categories: env.TRACE_CATEGORIES || 'blink,blink.user_timing', options: 'record-as-much-as-possible' });
    traceMark = await page.evaluate(() => performance.mark('wheel-jump-trace-origin').startTime);
  }
  if (pageLog) await page.evaluate(startPageLog);
  await page.evaluate(startLog);
  const steps = [], downShift = []; const recStart = Date.now();
  let reached = beforeDown.atEnd ? 0 : null;
  for (let k = 1; k <= STEPS && reached == null; k++) {
    const s = await wheel(STEP_PX);
    steps.push([Math.round(s.t), Math.round(s.y), s.h]); downShift.push(s.shift);
    if (s.atEnd) reached = k;
    if (file && ff && Date.now() - recStart > REC_MAX) await recordStop();
  }
  await pause(600);
  if (file && ff) await recordStop();
  const { log, writes } = await page.evaluate(stopLog);
  const pageData = pageLog ? await page.evaluate(stopPageLog) : null;
  let traceData = null;
  if (trace) {
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); await complete; cdp.removeAllListeners('Tracing.dataCollected');
    const mark = traceEvents.find(e => e.name === 'wheel-jump-trace-origin');
    const origin = mark ? mark.ts / 1000 - traceMark : null;
    const keepArg = v => typeof v === 'number' || typeof v === 'boolean' ? v : typeof v === 'string' ? (/^(?:k)?[A-Za-z]+$|^[-+\d., ()\[\]{}:xye]+$/.test(v) && v.length < 80 ? v : undefined)
      : Array.isArray(v) ? v.map(keepArg) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keepArg(x)]).filter(([, x]) => x !== undefined)) : undefined;
    traceData = { categories: env.TRACE_CATEGORIES || 'blink,blink.user_timing', origin: origin != null, kept: traceEvents.length,
      names: Object.entries(traceNames).sort((a, b) => b[1] - a[1]).slice(0, 120),
      events: traceEvents.filter(e => e.name !== 'wheel-jump-trace-origin').map(e => ({ name: e.name, cat: e.cat, ph: e.ph, pid: e.pid, tid: e.tid, t: origin == null ? null : Math.round((e.ts / 1000 - origin) * 1000) / 1000, dur: e.dur, args: keepArg(e.args) })) };
  }
  const end = await state();
  const stepAt = t => { const k = steps.findIndex(s => s[0] >= t); return k < 0 ? steps.length : k + 1; };
  const jumps = jumpsBack(log, at.vh).map(j => {
    // A write made the drop only if scrollTop (y, read just before the write) was still high then.
    const near = writes.filter(w => w.at > j.fromT - 1 && w.at <= j.toT + 1);
    const made = near.filter(w => w.y > j.to + at.vh);
    return { from: j.from, to: j.to, step: stepAt(j.t), afterLastStep: steps.length > 0 && j.t > steps.at(-1)[0], h: [j.hFrom, j.hTo],
      cause: !probe ? 'no probe' : made.length ? 'script write' : near.length ? 'no wrapped call (a later write found it already low)' : 'no wrapped call',
      writes: near.slice(0, 4).map(w => ({ world: w.world, kind: w.kind, value: w.value ?? w.args, y: Math.round(w.y), h: w.h, stack: frames(w.stack) })) };
  });
  const byWorld = {};
  for (const w of writes) { const k = `${w.world} ${w.kind}`; byWorld[k] = (byWorld[k] || 0) + 1; }
  Object.assign(load, { down: { steps: steps.length, reachedEnd: reached != null, endStep: reached, end: { y: Math.round(end.y), h: end.h, atEnd: end.atEnd } },
    jumps, scrollEvents: log.length, scrollLog: log, writesInDown: byWorld, recording: file ? path.basename(file) : null });
  if (pageData) load.pageLog = pageData;
  if (traceData) load.trace = traceData;
  if (shift) {
    // The scroll event that shows a drop can fire after the step's snapshot already read it, so the
    // first jump's step is also the first step whose scrollTop fell by more than a viewport.
    const dropAt = downShift.findIndex(r => r && (r.lost || r.dY < -at.vh));
    const firstJump = Math.min(jumps.length ? jumps[0].step : Infinity, dropAt < 0 ? Infinity : dropAt + 1);
    load.shift = { up: upShift, down: downShift, firstJumpStep: Number.isFinite(firstJump) ? firstJump : null,
      stats: { up: shiftStats(upShift), down: shiftStats(downShift), downBeforeFirstJump: shiftStats(downShift.slice(0, Math.max(0, Math.min(downShift.length, firstJump - 1)))) } };
  }
  return load;
}

let exit = 0;
try {
  lab = borrowed ? { ...L.getLab(Number(env.LAB_ID || 2)), owner: env.LAB_OWNER }
    : L.acquire(Number(env.LAB_ID || 2), { owner: `wheel-jump-live-${process.pid}`, needsFixture: fixtures[0], wait: 1800 });
  summary.lab = lab.id;
  if (restartEach && !Object.hasOwn(env, 'EXT')) throw Error('RESTART=each needs EXT');
  let restarted = false;
  if (Object.hasOwn(env, 'EXT')) { await restartBrowser(); restarted = true; }
  await connectBrowser();
  let keptRecording = null, count = 0, started = 0;
  for (const name of fixtures) for (let i = 1; i <= LOADS; i++) {
    if (GAP && started++) await pause(GAP);
    if (restartEach && count++ > 0) { await browser.close().catch(() => {}); await restartBrowser(); restarted = true; await connectBrowser(); }
    const recordThis = env.RECORD === '1' && !(keptRecording?.failed);
    const load = await oneLoad(name, i, restarted, recordThis);
    restarted = false;
    if (load.recording) {
      const file = path.join(recDir, load.recording);
      if (!keptRecording || (load.jumps.length && !keptRecording.failed)) {
        if (keptRecording) fs.rmSync(keptRecording.file, { force: true });
        keptRecording = { file, failed: load.jumps.length > 0 };
      } else { fs.rmSync(file, { force: true }); load.recording = null; }
    }
    summary.loads.push(load); save();
    const a = load.at;
    if (load.skipped) { console.log(`REPORT load ${name} #${i} skipped: ChatGPT did not load the chat twice (no turns mounted, scrollHeight ${a.h})`); continue; }
    console.log(`REPORT load ${name} #${i}: firstAfterRestart=${load.firstAfterRestart} retried=${load.retried} openedAtEnd=${a.atEnd} fromEnd=${Math.round(a.h - a.vh - a.y)} scrollTop=${Math.round(a.y)} scrollHeight=${a.h} clientHeight=${a.vh} overflowAnchor=${a.overflowAnchor} children=${a.children.map(c => (c.turns ? 'T:' : '') + c.overflowAnchor).join(',')} butterOff=${a.butterOff} turns=${a.turns}${load.endWrites ? ` endWrites=${JSON.stringify(load.endWrites)}` : ''}`);
    if (!load.jumps.length && load.down.reachedEnd) console.log(`PASS load ${name} #${i}: reached the end in ${load.down.endStep} steps`);
    else if (!load.jumps.length) console.log(`FAIL load ${name} #${i}: 0 jumps back, but did not reach the end in ${load.down.steps} steps (scrollTop ${load.down.end.y} of ${load.down.end.h})`);
    else {
      const j = load.jumps[0];
      console.log(`FAIL load ${name} #${i}: ${load.jumps.length} jumps back, first ${j.from} → ${j.to} at step ${j.step}`);
      console.log(`REPORT load ${name} #${i} causes: ${JSON.stringify(Object.entries(load.jumps.reduce((m, j) => (m[j.cause] = (m[j.cause] || 0) + 1, m), {})))}`);
    }
    if (load.shift) {
      const st = load.shift.stats;
      console.log(`REPORT load ${name} #${i} view shift up: ${fmtShift(st.up)}`);
      console.log(`REPORT load ${name} #${i} view shift down: ${fmtShift(st.down)}`);
      if (load.jumps.length) console.log(`REPORT load ${name} #${i} view shift down before first jump back (step ${load.shift.firstJumpStep}): ${fmtShift(st.downBeforeFirstJump)}`);
    }
    if (load.trace) console.log(`REPORT load ${name} #${i} trace: ${load.trace.kept} scroll events kept, clock ${load.trace.origin ? 'aligned' : 'NOT aligned'}`);
    if (load.pageLog) console.log(`REPORT load ${name} #${i} page log: ${load.pageLog.scroll.length} scroll rows, ${load.pageLog.muts.filter(m => m[1] !== 'style').length} turn insertions/removals, ${load.pageLog.cv.length} skip changes, turn order ${load.pageLog.shape}`);
  }
  const skipped = summary.loads.filter(l => l.skipped).length;
  const L2 = summary.loads.filter(l => !l.skipped), hs = L2.map(l => l.at.h), failed = L2.filter(l => l.jumps.length || !l.down.reachedEnd);
  const styles = [...new Set(L2.map(l => `${l.at.overflowAnchor} [${l.at.children.map(c => (c.turns ? 'T:' : '') + c.overflowAnchor).join(',')}]`))];
  console.log(`REPORT scrollHeight range ${Math.min(...hs)}–${Math.max(...hs)} over ${L2.length} loads`);
  console.log(`REPORT overflow-anchor scroller [children]: ${styles.join(' | ')}`);
  console.log(`REPORT not opened at the end: ${L2.filter(l => !l.at.atEnd).map(l => `${l.fixture} #${l.i}`).join(', ') || 'none'}`);
  console.log(`REPORT build=${summary.build} chromium=${summary.chromium} mode=${summary.mode} restartEach=${restartEach} flags=${JSON.stringify(summary.browserFlags)} guard=${JSON.stringify(summary.guard)}`);
  if (keptRecording) console.log(`REPORT recording ${path.basename(keptRecording.file)} (private, ${recDir})`);
  summary.metrics = { loads: L2.length, skipped, failed: failed.length, jumps: L2.map(l => l.jumps.length) };
  console.log(`SUMMARY ${label}: ${failed.length}/${L2.length} loads failed${skipped ? ` (${skipped} skipped: chat did not load)` : ''}`);
  exit = failed.length ? 1 : 0;
  if (skipped * 2 >= summary.loads.length) { console.error('HARNESS ERROR: half the loads or more did not load the chat'); exit = 2; }
} catch (error) {
  summary.error = scrub(error.message);
  console.error(`HARNESS ERROR: ${summary.error}`); exit = 2;
} finally {
  if (ff) await recordStop().catch(() => {});
  if (previousSettings !== undefined && worker) await worker.evaluate(v => v == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: v }), previousSettings).catch(() => {});
  await browser?.close().catch(() => {});
  if (lab && !borrowed) {
    try { const r = await L.restore(lab, { log: () => {} }); summary.cleanup.restored = r.ok; } catch (e) { summary.cleanup.restoreError = scrub(e.message); exit = exit || 2; }
    finally { try { summary.cleanup.released = L.release(lab); } catch (e) { summary.cleanup.releaseError = scrub(e.message); } }
  }
  save();
  console.log(`EXIT ${exit}; evidence ${out}`);
  process.exitCode = exit;
}
