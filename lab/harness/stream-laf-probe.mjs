// Page-lag probe for stream-replay-live.mjs (2026-11-23 stream recheck and long-frame diagnosis):
// Long Animation Frames (`long-animation-frame`, with `longtask` as a fallback where LoAF is
// missing) observed in the page from just before Enter until 5 s after the streamed answer
// completes, plus a timeline of marks on the same clock. Measurement only: the caller prints it as
// REPORT lines and never judges it. Durations come from the browser's own entries; nothing from
// the page's text is read (script rows hold invoker names, function names and reduced sources).
//
//   await page.evaluate(startLafProbe);           // just before Enter
//   const raw = await page.evaluate(stopLafProbe); // 5 s after the stream has completed
//   const s = summarizeLaf(raw); report(fmtLaf(s)); // per-frame REPORT lines: stream-laf-report.mjs

// In the page. Self-contained (passed to page.evaluate).
export function startLafProbe() {
  const types = (PerformanceObserver.supportedEntryTypes || []).filter(t => t === 'long-animation-frame' || t === 'longtask');
  const P = (window.__lafProbe = { start: performance.now(), end: null, enter: null, types, loaf: [], longtask: [], obs: [], marks: { inProgress: [], butter: [], settle: [], hyd: [] }, stdEnd: null });
  const extOrigin = /^chrome-extension:\/\/[a-p]{32}\//;
  const src = url => {
    if (!url) return 'other';
    if (/__playwright_evaluation_script__|^pptr:/.test(url)) return 'harness';
    if (extOrigin.test(url)) return 'butter:' + url.replace(extOrigin, '').replace(/[?#].*$/, '');
    try { const u = new URL(url); if (/(^|\.)chatgpt\.com$|(^|\.)oaistatic\.com$|(^|\.)oaiusercontent\.com$/.test(u.hostname)) return 'chatgpt:' + u.pathname.split('/').pop(); } catch {}
    return 'other';
  };
  const clean = s => String(s ?? '').replace(/https?:\/\/[^\s)]+/g, u => src(u)).replace(/chrome-extension:\/\/[a-p]{32}\/[^\s)]*/g, u => src(u)).replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>').slice(0, 160);
  const r1 = v => Math.round(v * 10) / 10;
  const keep = (type, list) => {
    for (const e of list) {
      const row = { s: r1(e.startTime), d: r1(e.duration), b: r1(typeof e.blockingDuration === 'number' ? e.blockingDuration : Math.max(0, e.duration - 50)) };
      if (type === 'longtask') { P.longtask.push(row); continue; }
      row.script = r1(e.renderStart > 0 ? e.renderStart - e.startTime : e.duration);
      row.render = r1(e.styleAndLayoutStart > 0 ? e.startTime + e.duration - e.styleAndLayoutStart : 0);
      // Between the two: rAF callbacks and other work of the rendering steps before style/layout.
      row.frameCb = r1(e.renderStart > 0 && e.styleAndLayoutStart > 0 ? e.styleAndLayoutStart - e.renderStart : 0);
      row.scripts = (e.scripts || []).map(x => ({ invokerType: x.invokerType, invoker: clean(x.invoker), fn: clean(x.sourceFunctionName), src: src(x.sourceURL), s: r1(x.startTime), d: r1(x.duration), forced: r1(x.forcedStyleAndLayoutDuration || 0), pause: r1(x.pauseDuration || 0) }));
      P.loaf.push(row);
    }
  };
  for (const type of types) {
    const o = new PerformanceObserver(l => keep(type, l.getEntries()));
    o.observe({ type, buffered: false });
    P.obs.push([type, o]);
  }
  P.keep = keep;
  // Enter, on the page's clock.
  addEventListener('keydown', e => { if (e.key === 'Enter' && P.enter == null) P.enter = e.timeStamp; }, { capture: true });
  // in_progress appearing and going away, and Butter's seen/unrendered marks: one row per observer
  // callback (the end of the task that made the change).
  const IP = '[data-talvt-turn-state="in_progress"]';
  let on = !!document.querySelector(IP);
  if (on) P.marks.inProgress.push({ t: r1(performance.now()), on: true, already: true });
  const mo = new MutationObserver(recs => {
    const now = r1(performance.now());
    let check = false, seen = 0, unr = 0, seenOff = 0, unrOff = 0;
    const hy = { measureOn: 0, measureOff: 0, veilOn: 0, veilOff: 0 }; // prototypes pv/pvh (2026-11-24 stream veil)
    for (const r of recs) {
      if (r.type === 'attributes') {
        const has = r.target.hasAttribute(r.attributeName);
        if (r.attributeName === 'data-talvt-turn-state') check = true;
        else if (r.attributeName === 'data-butter-seen') { if (has && r.oldValue === null) seen++; else if (!has) seenOff++; }
        else if (r.attributeName === 'data-butter-unrendered') { if (has && r.oldValue === null) unr++; else if (!has) unrOff++; }
        else if (r.attributeName === 'data-butter-settle') P.marks.settle.push({ t: now, on: has }); // prototype S (2026-11-24)
        else if (r.attributeName === 'data-butter-measure' || r.attributeName === 'data-butter-veil') {
          const k = r.attributeName === 'data-butter-measure' ? 'measure' : 'veil';
          if (has && r.oldValue === null) hy[k + 'On']++; else if (!has) hy[k + 'Off']++;
        }
      } else if (!check) {
        for (const n of [...r.addedNodes, ...r.removedNodes]) if (n.nodeType === 1 && (n.hasAttribute('data-talvt-turn-state') || n.querySelector('[data-talvt-turn-state]'))) { check = true; break; }
      }
    }
    if (check) {
      const now2 = !!document.querySelector(IP);
      if (now2 !== on) { on = now2; P.marks.inProgress.push({ t: now, on }); }
    }
    if (seen || unr || seenOff || unrOff) P.marks.butter.push({ t: now, seen, unrendered: unr, seenOff, unrenderedOff: unrOff });
    if (hy.measureOn || hy.measureOff || hy.veilOn || hy.veilOff) P.marks.hyd.push({ t: now, ...hy });
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-talvt-turn-state', 'data-butter-seen', 'data-butter-unrendered', 'data-butter-settle', 'data-butter-measure', 'data-butter-veil'] });
  P.mo = mo;
  return { types };
}

// In the page. Flushes queued entries, stops observing, returns the entries inside the phase.
export function stopLafProbe() {
  const P = window.__lafProbe;
  if (!P) return null;
  P.end = performance.now();
  for (const [type, o] of P.obs) { P.keep(type, o.takeRecords()); o.disconnect(); }
  P.mo.disconnect();
  const inPhase = rows => rows.filter(r => r.s >= P.start && r.s <= P.end);
  const R = window.__replay || {};
  return { start: P.start, end: P.end, stdEnd: P.stdEnd, enter: P.enter ?? P.start, types: P.types, loaf: inPhase(P.loaf), longtask: inPhase(P.longtask),
    marks: { ...P.marks, firstChunk: R.firstChunkAt ?? null, lastChunk: R.lastChunkAt ?? null, replayPost: R.started || null } };
}

// In Node.
export function summarizeLaf(raw) {
  if (!raw) return null;
  const r1 = v => Math.round(v * 10) / 10;
  const stats = rows => ({
    count: rows.length,
    totalMs: r1(rows.reduce((a, x) => a + x.d, 0)),
    blockingMs: r1(rows.reduce((a, x) => a + x.b, 0)),
    maxMs: rows.length ? r1(Math.max(...rows.map(x => x.d))) : 0,
  });
  return { phaseMs: r1(raw.end - raw.start), types: raw.types, loaf: raw.types.includes('long-animation-frame') ? stats(raw.loaf) : null, longtask: raw.types.includes('longtask') ? stats(raw.longtask) : null };
}

export function fmtLaf(s) {
  if (!s) return 'long animation frames: probe not installed';
  const f = (name, x) => (x ? `${name} ${x.count}, total ${x.totalMs} ms, blocking ${x.blockingMs} ms, longest ${x.maxMs} ms` : `${name} unsupported`);
  return `long animation frames, Enter to 5 s after stream complete (${s.phaseMs} ms): ${f('LoAF', s.loaf)}; ${f('longtask', s.longtask)}`;
}
