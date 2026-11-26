// Ad-hoc, issue #171 stage 1b: with no extension, which script-dispatched "leave" gesture clears ChatGPT's end pin
// (`cc.current.bottom`) so that a jump to questions 0–2 of `math12` is held, and do a reader's own inputs hold?
//
// LAB_ID=2 LAB_OWNER=<held lock owner> EXT= LP=<lp.json> LP_URL='/76629\.HASH\.js' PHASES=g1,c1,c2,g2,xa,xb,xc
//   [N=10] [OUT=<raw json>] [FIXTURE=math12] node notes/runs/2026-11-24-rail-jump-gesture/adhoc/gesture.mjs
//
// Phases (each trial: set the end pin and confirm `__pinNow() === true`, do the move, hold check 6 s):
//   g1  the scrollbar gesture from page JS (pointerdown on the scroller, scrollTop write, `scroll` event, pointerup),
//       N trials; trials 1–3 with a text selection made in the last answer first; then 2 more with a menu open.
//   c1  control: plain scrollTop write to q0, q1, q2, twice each.
//   c2  control: real thumb drag from the end to q0, q1, q2 (twice each), then real wheel to q0 (twice).
//   g2  one synthetic wheel notch away (deltaY −120) then the write, N trials (1–3 with a selection), 3 in the order
//       write-then-wheel, 2 with a menu open.
//   xa  g1 from an isolated world (CDP Page.createIsolatedWorld), 3 trials.
//   xb  g1 ending at the chat's end from mid-chat with the pin clear (3), and a 0 px g1 at the end, pinned (3).
//   xc  g1 to q0, then writes at +300/+900/+1600 ms (±365 px) and one at +3100 ms; hold 6 s after the last.
// Hold check: per-frame [t, scrollTop, scrollHeight, clientHeight, target mounted] for 6 s; "pulled" = back within
// one viewport of the end; growth = an ROgrow/ROtail logpoint hit with m > 0, or the target mounted and
// scrollHeight changed. Output: TRIAL lines (JSON) and REPORT summary lines. Measurement only: exit 0, 2 on setup error.
// Send guard on; nothing is typed, Enter is never pressed. Logs hold numbers, labels and minified names only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.resolve(here, '../../../../lab/harness');
const L = await import(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs'));
const { thumbAt } = await import(path.join(harness, 'seek-live-page.mjs'));

const env = process.env;
const PHASES = (env.PHASES || 'g1').split(',');
const N = Number(env.N || 10);
const HOLD = 6000, ARROW = 15;
const OUT = env.OUT || path.join(os.homedir(), '.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-gesture', `g-${Date.now()}.json`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (!env.LAB_OWNER || held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
if (env.EXT !== '') { console.error('this stage runs with EXT= (empty): no extension'); process.exit(2); }
const scrub = (s) => String(s).replace(/(?:https?|chrome-extension):\/\/[^\s"'):]+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>').split(os.homedir()).join('~');
const raw = { trials: [] };
const lp = [];
let browser, exit = 0, lpValid = false;

// ---- In the page (main world) ----
function install() {
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
  window.__sc = sc;
  // ChatGPT's pin ref: the hook ref whose current is exactly {bottom, top}, above the scroller (stage 1a's pinNow).
  window.__pinNow = () => {
    const s = sc(); if (!s) return null;
    let f = s[Object.keys(s).find((k) => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const found = [];
      for (let h = f.memoizedState, i = 0; h && typeof h === 'object' && 'next' in h && i < 400; h = h.next, i++) {
        const v = h.memoizedState, c = v && typeof v === 'object' && 'current' in v ? v.current : null;
        if (c && typeof c === 'object' && typeof c.bottom === 'boolean' && typeof c.top === 'boolean' && Object.keys(c).length === 2) found.push(c.bottom);
      }
      if (found.length) return found.length === 1 ? found[0] : 'multi:' + found.join(',');
    }
    return 'none';
  };
  // ChatGPT's question order and height map (as rail-jump-live-page.mjs's nativeOrder).
  const order = () => {
    const s = sc(), t = s?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const e = f.memoizedProps?.entries;
      if (Array.isArray(e) && e.length && e.every((x) => typeof x?.turnKey === 'string')) {
        const ids = e.map((x) => x.turnKey); let heights = {};
        for (let h = f.memoizedState, i = 0; h && i < 80; h = h.next, i++) { const v = h.memoizedState; if (v && typeof v === 'object' && !Array.isArray(v) && ids.some((id) => typeof v[id] === 'number')) { heights = v; break; } }
        return { ids, heights };
      }
    }
    return { ids: [], heights: {} };
  };
  window.__order = order;
  window.__geo = () => { const s = sc(), r = s.getBoundingClientRect(); return { y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight, end: s.scrollHeight - s.clientHeight, top: r.top, left: r.left, right: r.right, pin: window.__pinNow(), now: performance.now() }; };
  // Where question j's turn starts (mounted: measured; else the sum of ChatGPT's stored heights before it).
  window.__qpos = (j) => {
    const s = sc(), o = order(), id = o.ids[j];
    const el = id && s.querySelector(`[data-turn-key="${CSS.escape(id)}"]`), b = el?.getBoundingClientRect();
    if (b && b.height > 0) return { pos: Math.round(s.scrollTop + b.top - s.getBoundingClientRect().top), how: 'mounted' };
    if (id && o.ids.slice(0, j).every((k) => o.heights[k])) return { pos: Math.round(o.ids.slice(0, j).reduce((a, k) => a + o.heights[k], 0)), how: 'heights' };
    return { pos: null, how: 'unknown', n: o.ids.length };
  };
  // ChatGPT's own scrollTo calls on the scroller (only MAIN-world code runs here: no extension).
  window.__stl = [];
  const orig = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (...a) {
    try { if (this.classList?.contains('thread-scroll-container')) { const o = a[0]; const top = o && typeof o === 'object' ? o.top : a[1]; window.__stl.push({ t: performance.now(), top: top == null ? null : Math.round(top), y: Math.round(this.scrollTop), h: this.scrollHeight, vh: this.clientHeight }); } } catch {}
    return orig.apply(this, a);
  };
  // Side effects: focus (tag and role only), selection, open menus/dialogs, composer text unchanged and focus.
  const composer = () => document.querySelector('#prompt-textarea') || document.querySelector('.ProseMirror');
  let compText = null;
  const vis = (q) => [...document.querySelectorAll(q)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).length;
  window.__vis = vis;
  window.__side = (mark) => {
    const a = document.activeElement, sel = getSelection(), c = composer();
    const text = c ? c.textContent : null;
    if (mark) compText = text;
    return { ae: a ? a.tagName.toLowerCase() + (a.getAttribute('role') ? '[' + a.getAttribute('role') + ']' : '') : null, selCollapsed: sel.isCollapsed, selRanges: sel.rangeCount, selLen: sel.toString().length,
      menus: vis('[role="menu"]'), dialogs: vis('[role="dialog"]'), compLen: text == null ? null : text.length, compSame: mark ? true : text === compText, compFocus: !!c && c.contains(document.activeElement) };
  };
  window.__selectInAnswer = () => {
    const vh = innerHeight;
    const as = [...sc().querySelectorAll('[data-turn-key] p, [data-turn-key] li')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top > 80 && r.bottom < vh - 200; });
    for (const el of as.reverse()) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim().length > 8 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
      const n = w.nextNode(); if (!n) continue;
      const r = document.createRange(); r.setStart(n, 0); r.setEnd(n, Math.min(12, n.textContent.length));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      return sel.toString().length;
    }
    return 0;
  };
  // Hold check sampler: one row per frame from now for `ms` ms.
  window.__holdStart = (ms, j) => {
    const t0 = performance.now(), frames = [], pins = [], id = j == null ? null : order().ids[j];
    let done;
    window.__holdP = new Promise((r) => { done = () => { pins.push([Math.round(performance.now() - t0), window.__pinNow()]); r({ t0, frames, pins, stl: window.__stl.filter((x) => x.t >= t0).map((x) => ({ ...x, t: Math.round(x.t - t0) })) }); }; });
    const tick = () => {
      const s = sc(), now = performance.now() - t0;
      const el = id && s.querySelector(`[data-turn-key="${CSS.escape(id)}"]`), b = el?.getBoundingClientRect();
      frames.push([Math.round(now), Math.round(s.scrollTop), s.scrollHeight, s.clientHeight, b && b.height > 0 ? 1 : 0]);
      if (frames.length % 20 === 1) pins.push([Math.round(now), window.__pinNow()]);
      if (now < ms) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
    return t0;
  };
}

// G1, the scrollbar gesture, as a self-contained function so it can run in the main or an isolated world.
const G1 = (dest) => {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find((x) => x.clientHeight > 0);
  const r = s.getBoundingClientRect(), x = Math.round(r.right - 5), y = Math.round(r.top + r.height / 2);
  const init = { bubbles: true, cancelable: true, composed: true, view: window, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, screenX: x, screenY: y };
  const h0 = s.scrollHeight, y0 = Math.round(s.scrollTop);
  s.dispatchEvent(new PointerEvent('pointerdown', init));
  s.scrollTop = dest;
  const h1 = s.scrollHeight, y1 = Math.round(s.scrollTop);
  s.dispatchEvent(new Event('scroll'));
  s.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  return { h0, h1, hSame: h0 === h1, y0, y1 };
};
// G2, one synthetic wheel notch away from the end, then (or before) the write. Main world (reads the pin between).
const G2 = (dest, writeFirst) => {
  const s = window.__sc(), r = s.getBoundingClientRect();
  const x = Math.round((r.left + r.right) / 2), y = Math.round(r.top + r.height / 2);
  const init = { bubbles: true, cancelable: true, composed: true, view: window, deltaX: 0, deltaY: -120, deltaZ: 0, deltaMode: 0, clientX: x, clientY: y, screenX: x, screenY: y };
  const y0 = Math.round(s.scrollTop);
  if (writeFirst) s.scrollTop = dest;
  const ev = new WheelEvent('wheel', init);
  s.dispatchEvent(ev);
  const pinMid = window.__pinNow(), yMid = Math.round(s.scrollTop);
  if (!writeFirst) s.scrollTop = dest;
  return { y0, yMid, y1: Math.round(s.scrollTop), pinMid, defaultPrevented: ev.defaultPrevented };
};

try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: '', LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  let context; ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  console.log('EXTENSIONS', JSON.stringify((L.browserArgs(lab)?.extensions || []).length));
  const page = context.pages().find((p) => /^https:\/\/chatgpt\.com\//.test(p.url())) || context.pages()[0] || await context.newPage();
  for (const o of context.pages()) if (o !== page) await o.close();
  page.on('console', (m) => {
    const t = m.text(); if (!t.startsWith('__LP ')) return;
    const [, label, at, ...rest] = t.split(' ');
    let v = rest.join(' '); try { v = JSON.parse(v); } catch {}
    lp.push({ label, t: Number(at), v });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  const chunks = new Set(); let resolved = 0;
  cdp.on('Debugger.scriptParsed', (e) => { if (env.LP_URL && new RegExp(env.LP_URL.replace('HASH', '[0-9a-f]+')).test(e.url)) chunks.add(path.basename(new URL(e.url).pathname)); });
  cdp.on('Debugger.breakpointResolved', () => { resolved++; });
  await cdp.send('Debugger.enable');
  const lpDefs = env.LP ? JSON.parse(fs.readFileSync(env.LP, 'utf8')) : [];
  for (const p of lpDefs) {
    const cond = `(console.debug('__LP ' + ${JSON.stringify(p.label)} + ' ' + Math.round(performance.now()) + ' ' + (()=>{try{return JSON.stringify(${p.expr || 'null'})}catch(e){return 'err:'+e.message}})()), false)`;
    const r = await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: env.LP_URL.replace('HASH', p.chunk || '[0-9a-f]+'), lineNumber: p.line, columnNumber: p.col, condition: cond });
    resolved += r.locations.length;
  }
  await page.bringToFront();
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, env.FIXTURE || 'math12'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  await page.evaluate(install);
  await pause(4000);
  // Load all earlier history (scrollTop 280 → 0 until the question count is stable).
  let previous = -1, stable = 0;
  for (let n = 0; n < 30 && stable < 3; n++) {
    await page.evaluate(() => { window.__sc().scrollTop = 280; }); await pause(30);
    await page.evaluate(() => { window.__sc().scrollTop = 0; }); await pause(900);
    const q = await page.evaluate(() => window.__order().ids.length);
    stable = q === previous ? stable + 1 : 0; previous = q;
  }
  lpValid = [...chunks].length > 0 && [...chunks].every((c) => lpDefs.some((p) => c.includes(p.chunk)));
  console.log('LOGPOINTS', JSON.stringify({ set: lpDefs.length, resolved, chunks: [...chunks], known: [...new Set(lpDefs.map((p) => p.chunk))], valid: lpValid }));
  // Question positions (q0 at the top is mounted now; q1, q2 from ChatGPT's stored heights, else by mounting them).
  const POS = [];
  for (let j = 0; j < 3; j++) {
    let q = await page.evaluate((j) => window.__qpos(j), j);
    for (let k = 0; q.pos == null && k < 12; k++) {
      // Walk down from the top until the turn mounts (setup writes, not measured).
      await page.evaluate((k) => { const s = window.__sc(); s.scrollTop = Math.min(s.scrollHeight - s.clientHeight, (k + 1) * 12000); }, k);
      await pause(500);
      q = await page.evaluate((j) => window.__qpos(j), j);
    }
    POS.push(q);
  }
  const DEST = POS.map((q) => Math.max(0, (q.pos ?? 0) - 64));
  const g0 = await page.evaluate(() => window.__geo());
  console.log('FIXTURE', JSON.stringify({ questions: previous, height: g0.h, vh: g0.vh, pos: POS, dest: DEST, pin: g0.pin }));
  raw.fixture = { questions: previous, height: g0.h, vh: g0.vh, pos: POS, dest: DEST };
  if (POS.some((q) => q.pos == null)) throw Error('question position unknown');

  const geo = () => page.evaluate(() => window.__geo());
  // Set the end pin: chat at the end; if the pin is clear, a real 1 px wheel notch down at the end (ChatGPT's
  // scrollToBottom); fallback: write 300 px above the end and three real notches down. Returns the pin and how.
  const pinSet = async () => {
    const how = [];
    for (let a = 0; a < 3; a++) {
      await page.evaluate(() => { const s = window.__sc(); s.scrollTop = s.scrollHeight; });
      await pause(400);
      let g = await geo(); how.push(`end:${g.pin}`);
      if (g.pin === true) return { pin: true, how };
      await page.mouse.move(1000, 420); await page.mouse.wheel(0, 1); await pause(600);
      g = await geo(); how.push(`wheel1:${g.pin}`);
      if (g.pin === true) return { pin: true, how };
      await page.evaluate(() => { const s = window.__sc(); s.scrollTop = s.scrollHeight - s.clientHeight - 300; });
      await pause(300);
      for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, 200); await pause(250); }
      await pause(800);
      g = await geo(); how.push(`notches:${g.pin}`);
      if (g.pin === true) return { pin: true, how };
    }
    return { pin: false, how };
  };
  const openMenu = async () => {
    const turn = page.locator('[data-message-author-role="assistant"]').last();
    await turn.hover().catch(() => {});
    await pause(300);
    for (const sel of ['button[aria-label="More actions"]', '[data-testid="conversation-options-button"]']) {
      const b = page.locator(sel).filter({ visible: true }).last();
      if (await b.count().catch(() => 0)) {
        await b.click({ timeout: 3000 }).catch(() => {});
        await pause(500);
        const m = await page.evaluate(() => window.__vis('[role="menu"]'));
        if (m > 0) return { opened: true, via: sel.includes('More') ? 'turn more actions' : 'conversation options', menus: m };
      }
    }
    return { opened: false };
  };
  const closeMenu = async () => {
    for (let k = 0; k < 2; k++) {
      const m = await page.evaluate(() => window.__vis('[role="menu"]'));
      if (!m) return; await page.keyboard.press('Escape'); await pause(300);
    }
  };
  const lpGrowth = (t0, t1) => lp.filter((h) => h.t >= t0 && h.t <= t1 && (h.label === 'ROgrow' || h.label === 'ROtail') && h.v && h.v.m > 0).map((h) => ({ l: h.label, t: Math.round(h.t - t0), m: h.v.m, pin: h.v.pin }));
  const lpPinWrites = (t0, t1) => lp.filter((h) => h.t >= t0 && h.t <= t1 && ['ao', 'cE', 'cy', 'cH', 'ar', 'pdown', 'cO'].includes(h.label)).map((h) => `${h.label}@${Math.round(h.t - t0)}:${h.v && typeof h.v === 'object' ? JSON.stringify(Object.fromEntries(Object.entries(h.v).filter(([k]) => ['pin', 'a', 'b', 'pt', 'onSc', 'type', 'dir', 'src', 'cb'].includes(k)))) : ''}`);
  // Collect a hold check and classify it.
  const finish = async (rec, t0Hint) => {
    const res = await page.evaluate(() => window.__holdP);
    const { frames, pins, stl, t0 } = res;
    let left = false, pulledAt = null;
    for (const [t, y, h, vh] of frames) { const dist = h - vh - y; if (dist > vh) left = true; else if (left && pulledAt == null) pulledAt = t; }
    const hChange = frames.some((f, k) => k && f[2] !== frames[k - 1][2]);
    const mounted = frames.some((f) => f[4]);
    const lg = lpValid ? lpGrowth(Math.min(t0, t0Hint ?? t0) - 5, t0 + frames.at(-1)[0] + 5) : [];
    const growth = lg.length > 0 || (hChange && mounted);
    rec.lpGrowthInHold = lg.filter((x) => x.t >= (t0 - Math.min(t0, t0Hint ?? t0))).length;
    const endWrites = stl.filter((c) => c.top != null && c.top >= c.h - c.vh - 2 && c.y < c.h - 2 * c.vh).length;
    Object.assign(rec, {
      landY: frames[0]?.[1], endY: frames.at(-1)?.[1], hRange: [Math.min(...frames.map((f) => f[2])), Math.max(...frames.map((f) => f[2]))], left, pulledAt, mounted, hChange, lpGrowth: lg, growth,
      chatgptEndScrollTo: endWrites, pins: pins.map(([t, p]) => `${t}:${p}`).join(' '), pinEnd: pins.at(-1)?.[1],
      hold: !left ? 'never left the end' : pulledAt != null ? 'pulled' : growth ? 'held' : 'no growth, proves nothing',
      lpPin: lpPinWrites((t0Hint ?? t0) - 50, t0 + frames.at(-1)[0] + 5).slice(0, 30),
    });
    rec.frames = frames.filter((_, k) => k % 6 === 0 || k === frames.length - 1);
  };
  const log = (rec) => { const { frames, ...rest } = rec; raw.trials.push(rec); console.log(`TRIAL ${JSON.stringify(rest)}`); fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(raw)); };
  const startTrial = async (phase, i, j, extra = {}) => {
    const ps = await pinSet();
    return { phase, i, q: j, dest: j == null ? null : DEST[j], pinSet: ps.how.join(','), pinBefore: ps.pin, ...extra };
  };

  // A main-world move: `body` runs between the side-effect reads, then the hold starts in the same task.
  const mainMove = (body, j) => page.evaluate(`(() => { const before = window.__side(true); const pin0 = window.__pinNow(); const g = (${body}); const pinAfter = window.__pinNow(); const after = window.__side(false); const t0 = window.__holdStart(${HOLD}, ${j}); return { pin0, pinAfter, before, after, g, t0 }; })()`);

  async function g1Trial(phase, i, j, opts = {}) {
    const rec = await startTrial(phase, i, j, opts);
    if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); return; }
    if (opts.sel) rec.selMade = await page.evaluate(() => window.__selectInAnswer());
    if (opts.menu) rec.menu = await openMenu();
    const m = await mainMove(`(${G1.toString()})(${DEST[j]})`, j);
    Object.assign(rec, { pin0: m.pin0, pinAfter: m.pinAfter, g: m.g, before: m.before, after: m.after });
    await pause(HOLD + 300);
    await finish(rec, m.t0);
    if (opts.menu) { rec.afterHold = await page.evaluate(() => window.__side(false)); await closeMenu(); }
    await page.evaluate(() => getSelection().removeAllRanges());
    log(rec);
  }
  async function g2Trial(phase, i, j, opts = {}) {
    const rec = await startTrial(phase, i, j, opts);
    if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); return; }
    if (opts.sel) rec.selMade = await page.evaluate(() => window.__selectInAnswer());
    if (opts.menu) rec.menu = await openMenu();
    const m = await mainMove(`(${G2.toString()})(${DEST[j]}, ${!!opts.writeFirst})`, j);
    Object.assign(rec, { pin0: m.pin0, pinMid: m.g.pinMid, pinAfter: m.pinAfter, g: m.g, before: m.before, after: m.after });
    await pause(80);
    rec.pinNextTask = (await geo()).pin;
    await pause(HOLD + 220);
    await finish(rec, m.t0);
    if (opts.menu) { rec.afterHold = await page.evaluate(() => window.__side(false)); await closeMenu(); }
    await page.evaluate(() => getSelection().removeAllRanges());
    log(rec);
  }
  const summary = (phase) => {
    const ts = raw.trials.filter((t) => t.phase === phase);
    const c = (f) => ts.filter(f).length;
    console.log(`REPORT ${phase}: trials ${ts.length}; pinBefore true ${c((t) => t.pinBefore === true)}; pin false after ${c((t) => t.pinAfter === false)} of ${ts.length}; pin false at hold end ${c((t) => t.pinEnd === false)}; pulled ${c((t) => t.hold === 'pulled')}; held ${c((t) => t.hold === 'held')}; no growth ${c((t) => t.hold === 'no growth, proves nothing')}; growth ${c((t) => t.growth)}`);
  };

  for (const phase of PHASES) {
    if (phase === 'g1') {
      for (let i = 0; i < N; i++) await g1Trial('g1', i + 1, i % 3, i < 3 ? { sel: true } : {});
      for (let i = 0; i < 2; i++) await g1Trial('g1-menu', N + i + 1, i % 3, { menu: true });
    } else if (phase === 'c1') {
      for (let i = 0; i < 6; i++) {
        const j = i % 3, rec = await startTrial('c1', i + 1, j);
        if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); continue; }
        const m = await mainMove(`(() => { window.__sc().scrollTop = ${DEST[j]}; return { y1: Math.round(window.__sc().scrollTop) }; })()`, j);
        Object.assign(rec, { pin0: m.pin0, pinAfter: m.pinAfter, g: m.g });
        await pause(HOLD + 300); await finish(rec, m.t0); log(rec);
      }
    } else if (phase === 'c2') {
      for (let i = 0; i < 6; i++) {
        const j = i % 3, rec = await startTrial('c2-drag', i + 1, j);
        if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); continue; }
        const g = await geo();
        const end1 = thumbAt(g, 1, ARROW), from = { x: end1.x, y: Math.round(g.top + g.vh - 18) };
        const f = DEST[j] / (g.h - g.vh), to = { x: from.x, y: Math.max(Math.round(g.top + 2), thumbAt(g, f, ARROW).y + from.y - end1.y) };
        rec.before = await page.evaluate(() => window.__side(true));
        const tDown = await page.evaluate(() => performance.now());
        await page.mouse.move(from.x, from.y); await page.mouse.down();
        for (let k = 1; k <= 4; k++) { await page.mouse.move(from.x, Math.round(from.y + (to.y - from.y) * k / 4), { steps: 4 }); await pause(250); }
        await pause(300);
        await page.mouse.up();
        const m = await page.evaluate((j) => ({ pinAfter: window.__pinNow(), y: Math.round(window.__sc().scrollTop), after: window.__side(false), t0: window.__holdStart(6000, j) }), j);
        Object.assign(rec, { thumb: [from.y, to.y], pinAfter: m.pinAfter, g: { y1: m.y }, after: m.after });
        await page.mouse.move(1000, 420);
        await pause(HOLD + 300); await finish(rec, tDown); log(rec);
      }
      for (let i = 0; i < 2; i++) {
        const rec = await startTrial('c2-wheel', i + 1, 0);
        if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); continue; }
        rec.before = await page.evaluate(() => window.__side(true));
        const tDown = await page.evaluate(() => performance.now());
        await page.mouse.move(1000, 420);
        const steps = [];
        for (let k = 0; k < 5; k++) {
          const y = (await geo()).y;
          if (y - DEST[0] < 2000) break;
          await page.mouse.wheel(0, -(y - DEST[0]));
          await pause(1500);
          steps.push([Math.round(y), (await geo()).y]);
        }
        let y = (await geo()).y;
        rec.wheelSteps = steps;
        if (y - DEST[0] > 2000) {
          // The browser would not travel that far: one real notch up, then a scrollTop write.
          rec.fallback = 'notch up + write';
          await page.mouse.wheel(0, -120); await pause(100);
          await page.evaluate((d) => { window.__sc().scrollTop = d; }, DEST[0]);
          y = (await geo()).y;
        }
        const m = await page.evaluate(() => ({ pinAfter: window.__pinNow(), y: Math.round(window.__sc().scrollTop), after: window.__side(false), t0: window.__holdStart(6000, 0) }));
        Object.assign(rec, { pinAfter: m.pinAfter, g: { y1: m.y }, after: m.after });
        await pause(HOLD + 300); await finish(rec, tDown); log(rec);
      }
    } else if (phase === 'g2') {
      for (let i = 0; i < N; i++) await g2Trial('g2', i + 1, i % 3, i < 3 ? { sel: true } : {});
      for (let i = 0; i < 3; i++) await g2Trial('g2-writefirst', i + 1, i % 3, { writeFirst: true });
      for (let i = 0; i < 2; i++) await g2Trial('g2-menu', i + 1, i % 3, { menu: true });
    } else if (phase === 'xa') {
      const { frameTree } = await cdp.send('Page.getFrameTree');
      for (let i = 0; i < 3; i++) {
        const j = i % 3, rec = await startTrial('xa-isolated', i + 1, j);
        if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); continue; }
        const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: `g1iso${i}` });
        rec.before = await page.evaluate(() => window.__side(true));
        rec.pin0 = (await geo()).pin;
        const r = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression: `(${G1.toString()})(${DEST[j]})`, returnByValue: true });
        const m = await page.evaluate((j) => ({ pinAfter: window.__pinNow(), after: window.__side(false), t0: window.__holdStart(6000, j) }), j);
        Object.assign(rec, { g: r.result?.value ?? r.exceptionDetails?.text, pinAfter: m.pinAfter, after: m.after, note: 'pin read in the main world in the next CDP call' });
        await pause(HOLD + 300); await finish(rec, m.t0); log(rec);
      }
    } else if (phase === 'xb') {
      for (let i = 0; i < 3; i++) {
        // From mid-chat with the pin clear: a write to mid-chat and a real notch up, then G1 to the end.
        const rec = { phase: 'xb-midToEnd', i: i + 1 };
        await page.evaluate(() => { const s = window.__sc(); s.scrollTop = Math.round((s.scrollHeight - s.clientHeight) * 0.5); });
        await pause(400); await page.mouse.move(1000, 420); await page.mouse.wheel(0, -120); await pause(700);
        const g = await geo(); rec.pinBefore = g.pin; rec.startY = g.y;
        const m = await page.evaluate(`(() => { const pin0 = window.__pinNow(); const g = (${G1.toString()})(window.__sc().scrollHeight - window.__sc().clientHeight); return { pin0, pinAfter: window.__pinNow(), g, dist: Math.round(window.__sc().scrollHeight - window.__sc().clientHeight - window.__sc().scrollTop) }; })()`);
        await pause(1500);
        Object.assign(rec, { pin0: m.pin0, pinAfter: m.pinAfter, g: m.g, distAfter: m.dist, pin1500: (await geo()).pin });
        log(rec);
      }
      for (let i = 0; i < 3; i++) {
        const rec = await startTrial('xb-zeroAtEnd', i + 1, null);
        const m = await page.evaluate(`(() => { const pin0 = window.__pinNow(); const g = (${G1.toString()})(window.__sc().scrollTop); return { pin0, pinAfter: window.__pinNow(), g }; })()`);
        await pause(1500);
        Object.assign(rec, { pin0: m.pin0, pinAfter: m.pinAfter, g: m.g, pin1500: (await geo()).pin });
        log(rec);
      }
    } else if (phase === 'xc') {
      for (let i = 0; i < 3; i++) {
        const rec = await startTrial('xc-followups', i + 1, 0);
        if (!rec.pinBefore) { rec.hold = 'skipped: pin not set'; log(rec); continue; }
        const d = DEST[0];
        const m = await page.evaluate(`(() => { const pin0 = window.__pinNow(); const g = (${G1.toString()})(${d}); const pinAfter = window.__pinNow(); const t0 = window.__holdStart(${3100 + HOLD}, 0); return { pin0, pinAfter, g, t0 }; })()`);
        Object.assign(rec, { pin0: m.pin0, pinAfter: m.pinAfter, g: m.g, writes: [] });
        const tStart = Date.now();
        for (const [at, to] of [[300, d + 365], [900, d], [1600, d + 365], [3100, d]]) {
          await pause(Math.max(0, at - (Date.now() - tStart)));
          const w = await page.evaluate((to) => { const s = window.__sc(); s.scrollTop = to; return { y: Math.round(s.scrollTop), pin: window.__pinNow() }; }, to);
          rec.writes.push({ at: Date.now() - tStart, to, ...w });
        }
        await pause(HOLD + 300);
        await finish(rec, m.t0); log(rec);
      }
    }
    for (const p of [...new Set(raw.trials.map((t) => t.phase))].filter((p) => p.startsWith(phase))) summary(p);
  }
} catch (e) { console.log('HARNESS ERROR:', scrub(e.stack || e.message)); exit = 2; } finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(raw));
  await browser?.close().catch(() => {});
}
console.log(`EXIT ${exit}; raw ${scrub(OUT)}`);
process.exit(exit);
