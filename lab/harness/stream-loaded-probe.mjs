// Opened (not streamed) long chat, no input: does Butter's Smoother streaming work in the background,
// and what does it cost? Written for the 2026-11-24 stream-ux-loaded check of prototype pvh (late
// hydration of held answer blocks in idle time), against head as the control.
//
// On a lock you hold (LAB_OWNER), restarts the lab browser with exactly EXT, connects with the send
// guard on, and:
//   Idle phase: opens FIXTURE fresh and, from the moment the first turn is in the scroller, samples
//     every SAMPLE ms for MS ms (no input): <html>'s data-butter-hydrated / -hydrate-pending, the
//     number of elements with data-butter-unrendered / -seen / -veil / -measure, the scroller's
//     scrollTop / scrollHeight, and the answer block (else turn) under the scroller's centre: its
//     top relative to the scroller in every sample (a move with no input is a view shift).
//     Long Animation Frames from the document's start: load window (before the first turn) and
//     idle window (MS ms after it): count, total, blocking, longest, script time by source.
//   Typing phase (TYPE_AT > 0): opens TYPE_FIXTURE (default FIXTURE) fresh, waits TYPE_AT ms after the first turn,
//     clicks the composer (refuses when it holds a draft), types 44 keys, 41 characters and 3 Backspace (as typing-lag.mjs, never
//     Enter), then selects all and deletes. Reports keydown-to-next-frame times, Event Timing
//     entries >= 16 ms, Long Animation Frames in the typing window and the hydration counters.
// IDLE=0 skips the idle phase. REPORT lines only, no verdicts. Exit 2 on a setup error. Counts, pixels and ms only: no page text,
// URLs or ids are kept.
//
// LAB_ID=1 LAB_OWNER=<owner> EXT=<unpacked build dir, or empty> LABEL=<name> [FIXTURE=math12]
//   [MS=40000] [SAMPLE=500] [TYPE_AT=3000] [TYPE_FIXTURE=<name>] [IDLE=0] [OUT=<file>] node lab/harness/stream-loaded-probe.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { heldLab, startLab } from './seek-live-page.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'math12', LABEL = env.LABEL || 'loaded';
const MS = Number(env.MS ?? 40000), SAMPLE = Number(env.SAMPLE ?? 500), TYPE_AT = Number(env.TYPE_AT ?? 3000);
const TYPE_FIXTURE = env.TYPE_FIXTURE || FIXTURE, IDLE = env.IDLE !== '0';
const OUT = env.OUT || path.join(L.root(), 'captures/stream-loaded-probe', `${LABEL}.json`);
const pause = ms => new Promise(r => setTimeout(r, ms));
const report = s => console.log(`REPORT ${s}`);
const scrub = s => String(s).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>');
if (env.EXT == null) { console.error('EXT= is required (empty: no extension)'); process.exit(2); }
const lab = heldLab(L, env);

// In the page, at document start (addInitScript). Observes Long Animation Frames and Event Timing
// from the start; once the first turn is in the scroller, samples every `sample` ms for `ms` ms.
function pageProbe({ ms, sample }) {
  if (location.hostname !== 'chatgpt.com' || window.__lp) return;
  const r1 = v => Math.round(v * 10) / 10;
  const extOrigin = /^chrome-extension:\/\/[a-p]{32}\//;
  const src = url => {
    if (!url) return 'other';
    if (/__playwright_evaluation_script__|^pptr:/.test(url)) return 'harness';
    if (extOrigin.test(url)) return 'butter';
    try { if (/(^|\.)(chatgpt|oaistatic|oaiusercontent)\.com$/.test(new URL(url).hostname)) return 'chatgpt'; } catch {}
    return 'other';
  };
  const P = (window.__lp = { loaf: [], events: [], samples: [], firstTurn: null, done: false, keys: [] });
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        const by = {};
        for (const x of e.scripts || []) {
          const k = src(x.sourceURL), b = (by[k] ||= { ms: 0, forced: 0 });
          b.ms += x.duration; b.forced += x.forcedStyleAndLayoutDuration || 0;
        }
        for (const b of Object.values(by)) { b.ms = r1(b.ms); b.forced = r1(b.forced); }
        P.loaf.push({ s: r1(e.startTime), d: r1(e.duration), b: r1(e.blockingDuration ?? Math.max(0, e.duration - 50)),
          render: r1(e.styleAndLayoutStart > 0 ? e.startTime + e.duration - e.styleAndLayoutStart : 0), by });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { P.noLoaf = true; }
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) P.events.push({ name: e.name, s: r1(e.startTime), d: e.duration, delay: r1(e.processingStart - e.startTime), proc: r1(e.processingEnd - e.processingStart) });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch { P.noEvent = true; }
  addEventListener('keydown', e => {
    const k = { s: r1(e.timeStamp) };
    P.keys.push(k);
    requestAnimationFrame(() => setTimeout(() => { k.present = r1(performance.now() - e.timeStamp); }, 0));
  }, true);
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const count = sel => document.querySelectorAll(sel).length;
  // Answer blocks that compute opacity 0 (the veil's rule; read from computed style, any build).
  const op0 = () => [...document.querySelectorAll(`${COLUMN} > *, [class*="DilResponseRoot"] > *`)].filter(b => getComputedStyle(b).opacity === '0').length;
  P.op0 = op0;
  // The answer block containing el (a child of an answer root or of a Dil response root), else its turn.
  const isRoot = e => e.matches(COLUMN) || /DilResponseRoot/.test(typeof e.className === 'string' ? e.className : '');
  const blockOf = (el, y) => {
    // A point between two blocks hits their answer root: take the child nearest to the point.
    if (el && isRoot(el) && el.children.length) {
      const d = c => { const b = c.getBoundingClientRect(); return y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0; };
      el = [...el.children].reduce((m, c) => (d(c) < d(m) ? c : m));
    }
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const p = e.parentElement;
      if (p && isRoot(p)) return { el: e, kind: 'block' };
    }
    const t = el?.closest?.('[data-turn-key]');
    return t ? { el: t, kind: 'turn' } : null;
  };
  const describe = b => {
    const turns = [...sc().querySelectorAll('[data-turn-key]')], t = b.el.closest('[data-turn-key]');
    return { kind: b.kind, turn: turns.indexOf(t), turns: turns.length, index: b.kind === 'block' ? [...b.el.parentElement.children].indexOf(b.el) : null,
      marks: ['seen', 'unrendered', 'veil', 'measure'].filter(m => b.el.hasAttribute(`data-butter-${m}`)) };
  };
  let ref = null, t0 = null;
  const centre = s => {
    const r = s.getBoundingClientRect();
    const y = r.top + r.height / 2;
    return blockOf(document.elementFromPoint(r.left + r.width / 2, y), y);
  };
  const tick = () => {
    const s = sc(), h = document.documentElement, now = performance.now();
    if (!s) return;
    const r = s.getBoundingClientRect();
    const row = { t: r1(now - t0), hyd: h.getAttribute('data-butter-hydrated'), pend: h.getAttribute('data-butter-hydrate-pending'),
      unr: count('[data-butter-unrendered]'), seen: count('[data-butter-seen]'), veil: count('[data-butter-veil]'), meas: count('[data-butter-measure]'),
      turns: s.querySelectorAll('[data-turn-key]').length, st: Math.round(s.scrollTop), sh: Math.round(s.scrollHeight), ch: s.clientHeight };
    // Every 4th sample (2 s at the default SAMPLE) and the last, to keep the style reads few.
    if (P.samples.length % 4 === 0 || now - t0 >= ms) row.op0 = op0();
    if (!ref || !ref.el.isConnected) {
      const b = centre(s);
      row.repick = !!ref; ref = b; if (b) row.ref = describe(b);
    }
    if (ref) {
      row.top = r1(ref.el.getBoundingClientRect().top - r.top);
      const now2 = centre(s);
      row.sameUnder = now2?.el === ref.el;
    }
    P.samples.push(row);
  };
  const begin = () => {
    t0 = performance.now(); P.firstTurn = r1(t0);
    tick();
    const id = setInterval(() => {
      tick();
      if (performance.now() - t0 >= ms) { clearInterval(id); P.done = true; }
    }, sample);
  };
  const wait = setInterval(() => { if (sc()?.querySelector('[data-turn-key]')) { clearInterval(wait); begin(); } }, 50);
}

const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
const r1 = v => Math.round(v * 10) / 10;
function lafSum(rows, from, to) {
  const w = rows.filter(f => f.s >= from && f.s < to);
  const by = {};
  for (const f of w) for (const [k, v] of Object.entries(f.by)) { const b = (by[k] ||= { ms: 0, forced: 0 }); b.ms += v.ms; b.forced += v.forced; }
  for (const b of Object.values(by)) { b.ms = r1(b.ms); b.forced = r1(b.forced); }
  const longest = w.reduce((m, f) => (!m || f.d > m.d ? f : m), null);
  return { n: w.length, total: r1(w.reduce((a, f) => a + f.d, 0)), blocking: r1(w.reduce((a, f) => a + f.b, 0)),
    longest: longest ? longest.d : 0, longestAt: longest ? r1(longest.s - from) : null,
    over: [100, 200, 500, 1000].map(x => w.filter(f => f.d >= x).length), bySource: by };
}
const fmtLaf = s => `LoAF ${s.n}, total ${s.total} ms, blocking ${s.blocking} ms, longest ${s.longest} ms${s.longestAt == null ? '' : ` at +${s.longestAt} ms`}, >=100/200/500/1000 ms ${s.over.join('/')}; script ms (forced) by source ${JSON.stringify(s.bySource)}`;

async function open(page, name = FIXTURE) {
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, name), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__lp?.firstTurn != null, null, { timeout: 90000, polling: 200 });
}

function idleReport(d) {
  const S = d.samples, first = S[0], last = S.at(-1);
  const num = v => (v == null ? null : Number(v));
  const hyd = S.map(s => num(s.hyd)), anyHyd = hyd.some(v => v != null);
  const firstHyd = S.find(s => num(s.hyd) > 0), lastChange = S.reduce((m, s, i) => (i && s.hyd !== S[i - 1].hyd ? s : m), null);
  const max = k => Math.max(...S.map(s => s[k] ?? 0));
  const out = {
    samples: S.length, spanMs: last.t,
    counters: anyHyd ? { hydratedFirst: num(first.hyd), hydratedLast: num(last.hyd), pendingFirst: num(first.pend), pendingMax: Math.max(...S.map(s => num(s.pend) ?? 0)), pendingLast: num(last.pend),
      firstHydratedAt: firstHyd?.t ?? null, lastChangeAt: lastChange?.t ?? null } : null,
    marks: Object.fromEntries(['unr', 'seen', 'veil', 'meas'].map(k => [k, { first: first[k], max: max(k), last: last[k] }])),
    turns: { first: first.turns, last: last.turns },
  };
  // Scroll and view shift: per-sample deltas (no input, so any change is the page's own).
  const dsh = S.slice(1).map((s, i) => s.sh - S[i].sh), dst = S.slice(1).map((s, i) => s.st - S[i].st);
  const shifts = S.slice(1).map((s, i) => (s.top != null && S[i].top != null && !s.repick ? r1(s.top - S[i].top) : null)).filter(v => v != null);
  const changes = a => a.filter(v => v !== 0).length;
  out.scroll = { shFirst: first.sh, shLast: last.sh, shMin: Math.min(...S.map(s => s.sh)), shMax: max('sh'), shChanges: changes(dsh), shMaxStep: Math.max(0, ...dsh.map(Math.abs)),
    stFirst: first.st, stLast: last.st, stMin: Math.min(...S.map(s => s.st)), stMax: max('st'), stChanges: changes(dst), stMaxStep: Math.max(0, ...dst.map(Math.abs)),
    atEndFirst: first.sh - first.ch - first.st, atEndLast: last.sh - last.ch - last.st };
  out.centre = { ref: S.find(s => s.ref)?.ref ?? null, repicks: S.filter(s => s.repick).length, netPx: S.at(-1).top != null && S[0].top != null ? r1(S.at(-1).top - S[0].top) : null,
    sumAbsPx: r1(shifts.reduce((a, v) => a + Math.abs(v), 0)), maxStepPx: Math.max(0, ...shifts.map(Math.abs)), stepsOver4: shifts.filter(v => Math.abs(v) > 4).length,
    notUnderCentre: S.filter(s => s.sameUnder === false).length };
  const load = lafSum(d.loaf, 0, d.firstTurn), idle = lafSum(d.loaf, d.firstTurn, d.firstTurn + MS);
  // The idle window in 10 s slices, to see whether frames cluster while hydration runs.
  const slices = [];
  for (let a = 0; a < MS; a += 10000) { const s = lafSum(d.loaf, d.firstTurn + a, d.firstTurn + Math.min(MS, a + 10000)); slices.push([a / 1000, s.n, s.blocking, s.longest]); }
  Object.assign(out, { loafLoad: load, loafIdle: idle, loafIdleSlices: slices, firstTurnMs: d.firstTurn, noLoaf: !!d.noLoaf });
  return out;
}

const summary = { label: LABEL, fixture: FIXTURE, at: new Date().toISOString(), lab: lab.id, ms: MS, sample: SAMPLE, typeAt: TYPE_AT, guard: { blockedMutations: 0, sendAttempts: 0, prepare: 0 } };
let browser, exit = 0;
const save = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(summary)); };
try {
  let context, page;
  ({ browser, context, page } = await startLab(L, lab, env, env.EXT));
  await context.route('**/*', route => {
    const req = route.request();
    let host = ''; try { host = new URL(req.url()).hostname; } catch {}
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (host === 'chatgpt.com' || host.endsWith('.chatgpt.com'))) {
      summary.guard.blockedMutations++;
      // A send POSTs .../conversation; .../conversation/prepare is ChatGPT warming up while one types.
      const p = new URL(req.url()).pathname;
      if (/^\/backend-api\/(?:f\/)?conversation$/.test(p)) summary.guard.sendAttempts++;
      else if (/^\/backend-api\/(?:f\/)?conversation\/prepare$/.test(p)) summary.guard.prepare++;
    }
    return route.fallback();
  });
  summary.extensions = (L.browserArgs(lab)?.extensions || []).map(e => e.replace(/^.*\/snap\/chromium\/common\//, '~snap/'));
  summary.chromium = browser.version();
  await page.addInitScript(pageProbe, { ms: MS, sample: SAMPLE });
  await page.bringToFront();

  // Idle phase.
  if (IDLE) {
  await open(page);
  await page.waitForFunction(() => window.__lp.done, null, { timeout: MS + 60000, polling: 500 });
  const d = await page.evaluate(() => ({ samples: window.__lp.samples, loaf: window.__lp.loaf, firstTurn: window.__lp.firstTurn, noLoaf: window.__lp.noLoaf, nav: !!document.querySelector('chatgpt-butter-nav'),
    blocks: document.querySelectorAll('[data-markdown-text-style="assistant-message"] > *, [class*="DilResponseRoot"] > *').length, op0After: window.__lp.op0() }));
  const idle = idleReport(d);
  Object.assign(summary, { idle, butterNav: d.nav, answerBlocks: d.blocks, idleSamples: d.samples });
  save();
  const c = idle.counters, m = idle.marks, sc = idle.scroll, ce = idle.centre;
  report(`${LABEL} ${FIXTURE}: first turn ${d.firstTurn} ms after navigation; Butter rail ${d.nav}; ${d.blocks} answer blocks in the DOM at the end; mounted turns ${idle.turns.first} → ${idle.turns.last}; ${idle.samples} samples over ${idle.spanMs} ms`);
  report(`counters: ${c ? `data-butter-hydrated ${c.hydratedFirst} → ${c.hydratedLast} (first >0 at ${c.firstHydratedAt ?? '-'} ms, last change at ${c.lastChangeAt ?? '-'} ms), hydrate-pending first ${c.pendingFirst}, max ${c.pendingMax}, last ${c.pendingLast}` : 'none on <html> (not a pvh build)'}`);
  report(`marks (first/max/last): unrendered ${m.unr.first}/${m.unr.max}/${m.unr.last}, seen ${m.seen.first}/${m.seen.max}/${m.seen.last}, veil ${m.veil.first}/${m.veil.max}/${m.veil.last}, measure ${m.meas.first}/${m.meas.max}/${m.meas.last}`);
  const o = d.samples.filter(s => typeof s.op0 === 'number');
  idle.op0 = { samples: o.length, first: o[0]?.op0 ?? null, max: Math.max(0, ...o.map(s => s.op0)), last: o.at(-1)?.op0 ?? null, after: d.op0After };
  save();
  report(`answer blocks at opacity 0 (computed; ${o.length} samples, every 4th and the last): first ${idle.op0.first}, max ${idle.op0.max}, last ${idle.op0.last}; after the window ${d.op0After}`);
  report(`scroll with no input: scrollHeight ${sc.shFirst} → ${sc.shLast} (min ${sc.shMin}, max ${sc.shMax}, ${sc.shChanges} changes, largest step ${sc.shMaxStep}); scrollTop ${sc.stFirst} → ${sc.stLast} (min ${sc.stMin}, max ${sc.stMax}, ${sc.stChanges} changes, largest step ${sc.stMaxStep}); distance from the end ${sc.atEndFirst} → ${sc.atEndLast}`);
  report(`block under the centre: ${JSON.stringify(ce.ref)}; moved net ${ce.netPx} px, sum |step| ${ce.sumAbsPx} px, largest step ${ce.maxStepPx} px, steps over 4 px ${ce.stepsOver4}, re-picked ${ce.repicks}, samples where it was no longer under the centre ${ce.notUnderCentre}`);
  report(`laf load (navigation to first turn): ${fmtLaf(idle.loafLoad)}`);
  report(`laf idle (${MS} ms from the first turn): ${fmtLaf(idle.loafIdle)}`);
  report(`laf idle per 10 s [start s, LoAF, blocking ms, longest ms]: ${JSON.stringify(idle.loafIdleSlices)}`);
  report(`counters over time [ms, hydrated, pending, unrendered, seen, measure, scrollHeight, scrollTop, centre top]: ${JSON.stringify(d.samples.filter((_, i) => i % 4 === 0 || i === d.samples.length - 1).map(s => [Math.round(s.t), s.hyd, s.pend, s.unr, s.seen, s.meas, s.sh, s.st, s.top == null ? null : Math.round(s.top)]))}`);
  }

  // Typing phase.
  if (TYPE_AT > 0) {
    await open(page, TYPE_FIXTURE);
    await page.waitForFunction(at => performance.now() - window.__lp.firstTurn >= at, TYPE_AT, { timeout: 60000, polling: 50 });
    const composer = page.locator('.ProseMirror:visible').first();
    await composer.waitFor({ timeout: 30000 });
    if ((await composer.innerText()).trim()) throw Error('composer holds a draft; refusing to type');
    await composer.click();
    const before = await page.evaluate(() => ({ t: performance.now() - window.__lp.firstTurn, at: performance.now(), hyd: document.documentElement.getAttribute('data-butter-hydrated'), pend: document.documentElement.getAttribute('data-butter-hydrate-pending'), unr: document.querySelectorAll('[data-butter-unrendered]').length }));
    const keys = [...'Typing a longer math question 1234567890.'];
    keys.splice(12, 0, 'Backspace', 'Backspace'); keys.push('Backspace');
    for (let i = 0; i < keys.length; i++) { await page.keyboard.press(keys[i] === ' ' ? 'Space' : keys[i]); await pause(80 + (i * 17 % 41)); }
    await pause(500);
    const t = await page.evaluate(() => ({ end: performance.now(), keys: window.__lp.keys, events: window.__lp.events, loaf: window.__lp.loaf, hyd: document.documentElement.getAttribute('data-butter-hydrated'), pend: document.documentElement.getAttribute('data-butter-hydrate-pending'), unr: document.querySelectorAll('[data-butter-unrendered]').length }));
    await composer.click(); await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace'); await pause(500);
    const cleared = !(await composer.innerText()).trim();
    const keyRows = t.keys.filter(k => k.s >= before.at);
    const present = keyRows.map(k => k.present).filter(Number.isFinite);
    const ev = t.events.filter(e => e.s >= before.at && e.s <= t.end);
    const byName = {};
    for (const e of ev) { const b = (byName[e.name] ||= { n: 0, max: 0 }); b.n++; b.max = Math.max(b.max, e.d); }
    const laf = lafSum(t.loaf, before.at, t.end);
    summary.typing = { startMs: r1(before.t), wallMs: r1(t.end - before.at), keys: keyRows.length, present: { p50: pct(present, 0.5), p95: pct(present, 0.95), max: present.length ? Math.max(...present) : null },
      eventsOver16: byName, laf, counters: { before: [before.hyd, before.pend, before.unr], after: [t.hyd, t.pend, t.unr] }, cleared };
    save();
    const T = summary.typing;
    report(`typing ${LABEL} ${TYPE_FIXTURE}: started ${T.startMs} ms after the first turn, ${T.keys} keys over ${T.wallMs} ms; keydown to next frame p50 ${T.present.p50} ms, p95 ${T.present.p95} ms, max ${T.present.max} ms; Event Timing entries >= 16 ms ${JSON.stringify(byName)}`);
    report(`typing laf: ${fmtLaf(laf)}`);
    report(`typing counters [hydrated, pending, unrendered]: before ${JSON.stringify(T.counters.before)}, after ${JSON.stringify(T.counters.after)}; composer cleared ${cleared}`);
    if (!cleared) { console.log('HARNESS ERROR: composer not cleared'); exit = 2; }
  }
  report(`guard: blocked mutations ${summary.guard.blockedMutations}, send attempts ${summary.guard.sendAttempts}, prepare requests ${summary.guard.prepare} (all blocked)`);
} catch (e) {
  console.log(`HARNESS ERROR: ${scrub(e.message)}`);
  summary.error = scrub(e.message); exit = 2;
} finally {
  await browser?.close().catch(() => {});
  save();
}
console.log(`SUMMARY ${LABEL}: exit ${exit}; evidence ${OUT.replace(/^\/home\/[^/]+/, '~')}`);
process.exit(exit);
