// Forced-layout API probe and hydration counts for stream-replay-live.mjs (2026-11-24 stream
// hydrate, stage 2). Measurement only: REPORT lines, never a verdict. Nothing from the page's text
// is read: targets are described by tag, `data-*` attribute names and their place in the chat;
// stacks are `function@file:line:col` with file names only.
//
// APIPROBE=1 installs, in the page's MAIN world before ChatGPT's scripts, dormant wrappers around
// the layout-dependent DOM APIs (installApiProbe). The harness arms them APIPROBE_AT ms after Enter
// (default 100000, before the completion chunks at about 105 s) and disarms them when the
// observation window ends. While armed every call is timed; calls of at least 5 ms are kept.
//
// streamWindows() bundles the per-tick work of the window from Enter to 5 s past completion: the
// API probe's arming, the TRACE_AT trace (stream-run-opts.mjs) and one hydration sample per second
// (counts of Butter's block marks and the prototype's counters on <html>, the last turn's height,
// prototype Z's read counters; every tick for 6 s after in_progress goes).
// Stage 3 (2026-11-24 stream settle): block counts and settle marks after the window, the last
// turn's height at three moments, prototype S's settle marks and Z's fast-path counters.
// Stage 4 (2026-11-24 stream veil): veiled blocks in every sample, the tail after the standard
// window (TAIL_MS) and its hydration (stream-veil-probe.mjs). #173: rendered veiled blocks in every
// sample and after the window, for the veil-none-rendered verdict (stream-veil-verdicts.mjs).
import { traceWindow } from './stream-run-opts.mjs';
import { splitTail, tailReport, veilReport } from './stream-veil-probe.mjs';
import { veilCheckScript } from './stream-veil-verdicts.mjs';

// In the page (MAIN world, init script). Self-contained.
export function installApiProbe() {
  if (window.__apiProbe) return;
  const P = (window.__apiProbe = { armed: false, kept: [], counts: {}, bins: {}, armedAt: null, disarmedAt: null, atArm: null });
  const now = performance.now.bind(performance);
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const file = u => {
    if (!u) return '';
    const x = /^chrome-extension:\/\/[a-p]{32}\/(.*)$/.exec(u);
    if (x) return 'butter:' + x[1].replace(/[?#].*$/, '');
    return u.replace(/[?#].*$/, '').split('/').pop();
  };
  const frame = l => {
    const m = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/.exec(l);
    return m ? `${(m[1] || '').replace(/^async /, '')}@${file(m[2])}:${m[3]}:${m[4]}` : l.trim().replace(/^at /, '').slice(0, 60);
  };
  const stack = () => {
    const lim = Error.stackTraceLimit;
    Error.stackTraceLimit = 14;
    const s = new Error().stack || '';
    Error.stackTraceLimit = lim;
    // Error, stack, done, the wrapper; then the caller.
    return s.split('\n').slice(4, 12).map(frame);
  };
  const lastTurn = () => { const t = document.querySelectorAll('[data-turn-key]'); return t[t.length - 1] || null; };
  const describe = t => {
    if (t == null) return { kind: 'none' };
    if (t === window) return { kind: 'window' };
    if (t.nodeType === 9) return { kind: 'document' };
    if (t.nodeType === 3) t = t.parentElement;
    if (!(t instanceof Element)) return { kind: Object.prototype.toString.call(t).slice(8, -1) };
    const data = t.getAttributeNames().filter(n => n.startsWith('data-'));
    const where = t.matches(COLUMN) ? 'answer-root' : t.matches(BLOCKS) ? 'answer-block' : t.closest(COLUMN) ? 'in-answer'
      : t.matches('[data-turn-key]') ? 'turn' : t.closest('[data-turn-key]') ? 'in-turn' : t.matches('.thread-scroll-container') ? 'scroller'
      : t === document.documentElement ? 'html' : t === document.body ? 'body' : t.querySelector('[data-turn-key]') ? 'holds-turns' : 'elsewhere';
    const lt = lastTurn();
    const inLast = !!lt && (lt === t || lt.contains(t));
    const n = t.matches(COLUMN) || t.matches('[data-turn-key]') || where === 'holds-turns' ? t.querySelectorAll(BLOCKS).length : null;
    return { kind: 'element', tag: t.tagName.toLowerCase(), data, where, inLast, blocksInside: n };
  };
  const done = (api, target, t0) => {
    const d = now() - t0;
    const c = (P.counts[api] ||= { n: 0, ms: 0 });
    c.n++; c.ms += d;
    // Every call, also the short ones, summed per API in 50 ms bins of its start time.
    const b = ((P.bins[api] ||= {})[Math.floor(t0 / 50)] ||= [0, 0]);
    b[0]++; b[1] += d;
    if (d >= 5 && P.kept.length < 2000) P.kept.push({ api, d: Math.round(d * 10) / 10, t: Math.round(t0 * 10) / 10, target: describe(target), stack: stack() });
  };
  const getter = (proto, prop, api) => {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d?.get || !d.configurable) return;
    const g = d.get;
    Object.defineProperty(proto, prop, { ...d, get: function () { if (!P.armed) return g.call(this); const t0 = now(); try { return g.call(this); } finally { done(api, this, t0); } } });
  };
  const setter = (proto, prop, api) => {
    const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
    if (!d?.set || !d.configurable) return;
    const s = d.set;
    Object.defineProperty(proto, prop, { ...d, set: function (v) { if (!P.armed) return s.call(this, v); const t0 = now(); try { return s.call(this, v); } finally { done(api, this, t0); } } });
  };
  const method = (obj, prop, api, targetOf) => {
    const d = obj && Object.getOwnPropertyDescriptor(obj, prop);
    if (typeof d?.value !== 'function') return;
    const f = d.value;
    const w = { [prop]: function () { if (!P.armed) return f.apply(this, arguments); const t0 = now(); try { return f.apply(this, arguments); } finally { done(api, targetOf ? targetOf(this, arguments) : this, t0); } } }[prop];
    Object.defineProperty(obj, prop, { ...d, value: w });
  };
  const E = Element.prototype, HE = HTMLElement.prototype;
  for (const p of ['innerText', 'outerText']) getter(HE, p, p);
  for (const p of ['offsetTop', 'offsetLeft', 'offsetWidth', 'offsetHeight', 'offsetParent']) getter(HE, p, p);
  for (const p of ['clientTop', 'clientLeft', 'clientWidth', 'clientHeight', 'scrollTop', 'scrollLeft', 'scrollWidth', 'scrollHeight']) getter(E, p, p);
  for (const p of ['scrollTop', 'scrollLeft']) setter(E, p, `${p}=`);
  for (const p of ['getBoundingClientRect', 'getClientRects', 'scrollIntoView', 'scrollTo', 'scrollBy', 'checkVisibility']) method(E, p, `Element.${p}`);
  method(HE, 'focus', 'HTMLElement.focus');
  for (const p of ['getBoundingClientRect', 'getClientRects']) method(Range.prototype, p, `Range.${p}`, r => r.commonAncestorContainer);
  for (const p of ['scrollTo', 'scrollBy']) method(window, p, `window.${p}`, () => window);
  method(window, 'getComputedStyle', 'getComputedStyle', (_, a) => a[0]);
  method(CSSStyleDeclaration.prototype, 'getPropertyValue', 'CSSStyleDeclaration.getPropertyValue', () => null);
  // Not wrapped: reads by property name on a computed style (cs.height) flush style too, but
  // Chromium has no accessors for them to wrap (checked 2026-11-24).
  for (const p of ['elementFromPoint', 'elementsFromPoint', 'caretRangeFromPoint']) method(Document.prototype, p, `document.${p}`, () => document);
  for (const p of ['toString', 'modify', 'getRangeAt']) method(Selection.prototype, p, `Selection.${p}`, () => null);
  P.arm = () => {
    const lt = lastTurn();
    const blocks = lt ? [...lt.querySelectorAll(BLOCKS)] : [];
    P.atArm = { blocks: blocks.length, seen: blocks.filter(b => b.hasAttribute('data-butter-seen')).length, unrendered: blocks.filter(b => b.hasAttribute('data-butter-unrendered')).length, measuring: blocks.filter(b => b.hasAttribute('data-butter-measure')).length };
    P.armedAt = now(); P.armed = true;
    return P.atArm;
  };
  P.disarm = () => { P.armed = false; P.disarmedAt ??= now(); return { armedAt: P.armedAt, disarmedAt: P.disarmedAt, atArm: P.atArm, counts: P.counts, bins: P.bins, kept: P.kept }; };
}

// In the page: counts (attribute selectors and the prototype's counters on <html>), the last turn's
// height (one rect read; the harness's stream sampler already reads it every 200 ms) and prototype
// Z's read counters (stream/read-fast-main.js).
function hydrationSample() {
  const h = document.documentElement, t = document.querySelectorAll('[data-turn-key]'), last = t[t.length - 1];
  const num = n => (h.hasAttribute(n) ? Number(h.getAttribute(n)) : null);
  const z = window[Symbol.for('chatgpt-butter.read-fast')];
  const veil = last ? [...last.querySelectorAll('[data-butter-veil]')] : [];
  // Rendered veiled blocks in the last turn (veil-none-rendered; stream-veil-verdicts.mjs).
  const leaks = window.__veilCheck && last ? window.__veilCheck.count(last) : null;
  return { t: performance.now(), leaks, veiled: veil.length, veiledNotAuto: veil.filter(b => getComputedStyle(b).contentVisibility !== 'auto').length, inProgress: !!document.querySelector('[data-talvt-turn-state="in_progress"]'), hydrated: num('data-butter-hydrated'), pending: num('data-butter-hydrate-pending'),
    measuring: document.querySelectorAll('[data-butter-measure]').length, unrendered: last ? last.querySelectorAll('[data-butter-unrendered]').length : 0, seen: last ? last.querySelectorAll('[data-butter-seen]').length : 0,
    turnH: last ? Math.round(last.getBoundingClientRect().height) : null, settle: document.querySelectorAll('[data-butter-settle]').length, z: z ? { fast: z.fast, native: z.native } : null };
}

function answerGeo() {
  const sc = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const t = sc ? [...sc.querySelectorAll('[data-turn-key]')].at(-1) : null;
  const md = t?.querySelector('[data-markdown-text-style="assistant-message"]');
  const h = el => (el ? Math.round(el.getBoundingClientRect().height) : null);
  const COLUMN = '[data-markdown-text-style="assistant-message"]', KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const blocks = t ? [...t.querySelectorAll(`${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`)] : [];
  const z = window[Symbol.for('chatgpt-butter.read-fast')];
  return { turn: h(t), answer: h(md), scrollHeight: sc?.scrollHeight ?? null, leaks: window.__veilCheck?.count(document) ?? null,
    blocks: { n: blocks.length, cvAuto: blocks.filter(b => getComputedStyle(b).contentVisibility === 'auto').length, seen: blocks.filter(b => b.hasAttribute('data-butter-seen')).length,
      unrendered: blocks.filter(b => b.hasAttribute('data-butter-unrendered')).length, settleLeft: document.querySelectorAll('[data-butter-settle]').length,
      veiled: blocks.filter(b => b.hasAttribute('data-butter-veil')).length, veiledNotAuto: blocks.filter(b => b.hasAttribute('data-butter-veil') && getComputedStyle(b).contentVisibility !== 'auto').length, measuring: blocks.filter(b => b.hasAttribute('data-butter-measure')).length },
    z: z ? { fast: z.fast, native: z.native } : null };
}

const r1 = v => Math.round(v * 10) / 10;
// Frames of code the harness evaluates in the page (Playwright's evaluate wrapper).
const HARNESS = /eval at evaluate|UtilityScript\.evaluate/;

export async function streamWindows(page, cdp, env, out) {
  const api = env.APIPROBE === '1', armAt = Number(env.APIPROBE_AT || 100000);
  if (api) await page.addInitScript(installApiProbe);
  await page.addInitScript(veilCheckScript());
  const tw = traceWindow(cdp, env.TRACE_AT ? Number(env.TRACE_AT) : null, 10000, out.replace(/\.json$/, '') + '.trace.json');
  const hyd = [];
  let lastHyd = -Infinity, armed = false, goneAt = null, seenIp = false, stdMarked = false, tail = null;
  return {
    // sinceDone: ms since the harness saw the stream complete; at 5 s the standard window ends.
    async tick(el, sinceDone = null) {
      await tw.tick(el);
      if (sinceDone != null && sinceDone >= 5000 && !stdMarked) { stdMarked = true; await page.evaluate(() => { if (window.__lafProbe) window.__lafProbe.stdEnd = performance.now(); }); }
      if (api && !armed && el >= armAt) { armed = true; await page.evaluate(() => window.__apiProbe?.arm() ?? null); }
      // Once a second; every tick (about 250 ms) for 6 s after in_progress goes.
      if (el - lastHyd >= 1000 || (goneAt != null && el - goneAt < 6000)) {
        lastHyd = el;
        const s = await page.evaluate(hydrationSample).catch(() => null);
        hyd.push(s);
        if (s?.inProgress) seenIp = true; else if (s && seenIp && goneAt == null) goneAt = el;
      }
    },
    // stopLafProbe's result cut at the standard window's end; the tail is kept for finish().
    split(raw) { const x = splitTail(raw); tail = x.tail; return x.std; },
    // After stopLafProbe: disarms the probe, stops the trace, returns the REPORT lines.
    async finish(raw, summary) {
      const apiRaw = api ? await page.evaluate(() => window.__apiProbe?.disarm() ?? null) : null;
      summary.trace = await tw.finish();
      const lines = [];
      if (summary.trace.started) lines.push(`trace: ${summary.trace.events} events, started at page time ${summary.trace.pageStart} (${Math.round(summary.trace.pageStart - raw.enter)} ms after Enter)`);
      const z = raw?.enter ?? 0;
      summary.hydration = hydrationReport(hyd.filter(Boolean).map(s => ({ ...s, t: r1(s.t - z) })), summary.lafDetail, lines);
      summary.completion = completionFrame(summary.lafDetail, lines);
      // Past the window (probe disarmed): the streamed answer's height and the chat's scrollHeight.
      const g = (summary.answerGeo = await page.evaluate(answerGeo).catch(() => null));
      if (g) lines.push(`answer height after the window: last turn ${g.turn} px, answer root ${g.answer} px, scrollHeight ${g.scrollHeight} px`);
      if (g) lines.push(`blocks after the window: ${g.blocks.n} in the last turn, content-visibility auto ${g.blocks.cvAuto}, data-butter-seen ${g.blocks.seen}, data-butter-unrendered ${g.blocks.unrendered}, data-butter-settle left ${g.blocks.settleLeft}`);
      summary.stage3 = stage3Report(summary.hydration, summary.lafDetail, summary.completion, g, lines);
      const rows = summary.hydration?.rows || [];
      summary.veil = veilReport(rows, summary.lafDetail, summary.completion, g, lines);
      summary.tail = tailReport(tail, rows, g, lines, summary.lafDetail);
      if (api) summary.api = apiReport(apiRaw, z, lines, summary.completion);
      return lines;
    },
  };
}

function hydrationReport(rows, d, lines) {
  if (!rows.length) return null;
  const gone = d?.marks?.inProgressGone ?? null;
  const near = at => rows.reduce((b, r) => (Math.abs(r.t - at) < Math.abs(b.t - at) ? r : b), rows[0]);
  const fmt = r => `${r.hydrated ?? '-'}/${r.pending ?? '-'}/${r.measuring}/${r.unrendered}/${r.seen}/${r.veiled ?? '-'}`;
  const every = rows.filter((r, i) => i === 0 || Math.floor(r.t / 10000) !== Math.floor(rows[i - 1].t / 10000));
  const atGone = gone != null ? rows.find(r => r.t >= gone) ?? rows.at(-1) : null, after5 = gone != null ? near(gone + 5000) : null;
  const maxMeasuring = Math.max(...rows.map(r => r.measuring));
  lines.push(`hydration over time (s after Enter: hydrated/pending/measuring/unrendered/seen/veiled in the last turn): ${every.map(r => `${Math.round(r.t / 1000)}s:${fmt(r)}`).join(' ')}`);
  lines.push(`hydration at completion: first sample after in_progress gone (${atGone?.t ?? '-'} ms) ${atGone ? fmt(atGone) : '-'}; 5 s later (${after5?.t ?? '-'} ms) ${after5 ? fmt(after5) : '-'}; most blocks measuring at once ${maxMeasuring}`);
  return { rows, gone, atGone, after5, maxMeasuring };
}

// Stage 3: the last turn's height at three moments, settle marks and the frames around them, Z's counters.
function stage3Report(hy, d, f, g, lines) {
  const rows = (hy?.rows || []).filter(r => r.turnH != null);
  if (!rows.length || !d) return null;
  const gone = d.marks.inProgressGone, before = rows.filter(r => r.t < (f?.s ?? gone ?? Infinity)).at(-1) ?? null;
  const near = at => rows.reduce((b, r) => (Math.abs(r.t - at) < Math.abs(b.t - at) ? r : b), rows[0]);
  const at1 = gone != null ? near(gone + 1000) : null, end = rows.at(-1);
  // When the last turn reached its final height (within 1%), after in_progress went.
  const fin = g?.turn ?? end.turnH, real = gone != null ? rows.find(r => r.t >= gone && Math.abs(r.turnH - fin) <= fin * 0.01 && rows.filter(x => x.t >= r.t).every(x => Math.abs(x.turnH - fin) <= fin * 0.01)) : null;
  const fmtH = r => (r ? `${r.turnH} px at ${r.t} ms` : '-');
  lines.push(`last turn height: before the completion frame ${fmtH(before)}; 1 s after in_progress gone ${fmtH(at1)}; window end ${fmtH(end)}; after the window ${g?.turn ?? '-'} px; at its final height from ${real ? `${real.t} ms (${r1(real.t - gone)} ms after in_progress gone)` : '-'}`);
  const st = d.marks.settle || [];
  const fr = (from, to) => d.frames.filter(x => x.s + x.d >= from && x.s <= to && x.d >= 50).map(x => `${x.d}@${x.s}`);
  const offs = st.filter(m => !m.on);
  if (st.length) lines.push(`settle marks: ${st.map(m => `${m.on ? 'on' : 'off'}@${m.t}`).join(' ')}; frames >= 50 ms within 300 ms of each off: ${offs.map(m => `[${fr(m.t - 300, m.t + 300).join(' ')}]`).join(' ')}`);
  const mb = d.marks.butter.filter(m => gone != null && m.t >= gone && m.t <= gone + 6000);
  lines.push(`butter mark batches in the 6 s after in_progress gone: ${mb.map(m => `+${m.seen}s/-${m.unrenderedOff}u@${m.t} frames>=50 [${fr(m.t - 100, m.t + 100).join(' ')}]`).join(' ') || 'none'}`);
  const zs = rows.filter(r => r.z), z0 = zs.filter(r => r.t < (f?.s ?? Infinity)).at(-1), zEnd = g?.z ?? zs.at(-1)?.z;
  const out = { before, at1, end, real, settle: st, z: zEnd ?? null };
  if (zEnd) {
    lines.push(`read fast path (Z): at the window's end fast ${zEnd.fast}, native ${zEnd.native}; from the last sample before the completion frame (${z0?.t ?? '-'} ms: fast ${z0?.z.fast ?? '-'}, native ${z0?.z.native ?? '-'}) to the end: fast +${zEnd.fast - (z0?.z.fast ?? 0)}, native +${zEnd.native - (z0?.z.native ?? 0)}`);
    out.zBefore = z0 ?? null;
  }
  return out;
}

function completionFrame(d, lines) {
  const gone = d?.marks?.inProgressGone;
  if (!d || gone == null) return null;
  const f = d.frames.find(x => x.s <= gone && gone <= x.s + x.d + 1) || [...d.frames].filter(x => Math.abs(x.s - gone) < 1500).sort((a, b) => b.d - a.d)[0];
  if (!f) { lines.push('completion frame: none found around in_progress gone'); return null; }
  const sc = [...f.scripts].sort((a, b) => b.d - a.d);
  lines.push(`completion frame: start ${f.s} ms, duration ${f.d}, blocking ${f.b}, script part ${f.script}, rAF part ${f.frameCb}, render part ${f.render}; scripts ${sc.map(x => `${x.d}/${x.forced} forced ${x.src} ${x.invokerType} ${JSON.stringify(x.invoker)}`).join('; ')}`);
  return f;
}

function apiReport(a, z, lines, f) {
  if (!a) { lines.push('api probe: not installed in the page'); return null; }
  const kept = a.kept.map(k => ({ ...k, t: r1(k.t - z), harness: k.stack.some(s => HARNESS.test(s)) }));
  const page = kept.filter(k => !k.harness).sort((x, y) => y.d - x.d);
  const sums = {};
  for (const k of page) { const s = (sums[k.api] ||= { n: 0, ms: 0 }); s.n++; s.ms = r1(s.ms + k.d); }
  const all = Object.fromEntries(Object.entries(a.counts).sort((x, y) => y[1].ms - x[1].ms).slice(0, 12).map(([k, v]) => [k, { n: v.n, ms: r1(v.ms) }]));
  lines.push(`api probe: armed ${r1(a.armedAt - z)} to ${r1(a.disarmedAt - z)} ms after Enter; last turn at arming ${JSON.stringify(a.atArm)}; calls >= 5 ms: ${page.length} from the page, ${kept.length - page.length} from the harness`);
  lines.push(`api probe sums of kept calls per API: ${JSON.stringify(sums)}; all armed calls per API (top 12 by time): ${JSON.stringify(all)}`);
  const tg = t => (t.kind === 'element' ? `<${t.tag}> [${t.data.join(' ')}] ${t.where}${t.inLast ? ' in-last-turn' : ''}${t.blocksInside != null ? ` blocks ${t.blocksInside}` : ''}` : t.kind);
  // All calls (bins) starting inside the completion frame, and inside its rAF part.
  const within = (from, to) => Object.fromEntries(Object.entries(a.bins || {}).map(([k, bins]) => {
    let n = 0, ms = 0;
    for (const [i, [bn, bms]] of Object.entries(bins)) { const t = i * 50 - z; if (t + 50 > from && t < to) { n += bn; ms += bms; } }
    return [k, { n, ms: r1(ms) }];
  }).filter(([, v]) => v.n).sort((x, y) => y[1].ms - x[1].ms));
  const inFrame = f ? within(f.s, f.s + f.d) : null, inRaf = f ? within(f.s + f.script, f.s + f.script + f.frameCb) : null;
  if (f) lines.push(`api probe, all calls starting in the completion frame (${f.s}-${r1(f.s + f.d)} ms, 50 ms bins): ${JSON.stringify(inFrame)}; in its rAF part (${r1(f.s + f.script)}-${r1(f.s + f.script + f.frameCb)} ms): ${JSON.stringify(inRaf)}`);
  page.slice(0, 15).forEach((k, i) => lines.push(`api probe top ${i + 1}: ${k.api} ${k.d} ms at ${k.t} ms, target ${tg(k.target)}; stack ${k.stack.join(' < ')}`));
  return { armedAt: r1(a.armedAt - z), disarmedAt: r1(a.disarmedAt - z), atArm: a.atArm, counts: a.counts, kept, sums, inFrame, inRaf, bins: a.bins };
}
