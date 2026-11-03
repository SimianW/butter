// MAIN world: authoritative turn/block geometry and lean preview text, restored before layout.
(() => {
  const core = globalThis.__butterSeekCore;
  if (!core) return;
  const S = { observed: 0, records: 0, refreshes: 0, rejected: {}, recordMs: 0, recordMax: 0, restored: 0, blocksRestored: 0, restoreMisses: {}, hooks: 0, hits: [] };
  const turns = new Map();                    // turnKey -> entry (see core.mergeRecord)
  const live = new Set(), meta = new WeakMap(), skipped = new WeakSet(), contentH = new WeakMap(), leanCache = new WeakMap();
  const BLOCK = '[data-markdown-text-style="assistant-message"] > :not([data-wide-block]):not(hr)';
  const ITEMS = '[data-user-message-bubble], [data-markdown-text-style="assistant-message"] > *';
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] || null;
  const scroller = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const complete = t => !t.matches('[data-talvt-turn-state="in_progress"]') && !t.querySelector('[data-talvt-turn-state="in_progress"]') &&
    (t.matches('[data-talvt-turn-state="complete"]') || !!t.querySelector('[data-talvt-turn-state="complete"]'));
  const mathReady = t => [...t.querySelectorAll('[data-math-source]')].every(e => e.querySelector('.katex'));
  const identity = t => t.querySelector('[data-message-author-role="assistant"]')?.getAttribute('data-message-id') || t.querySelector('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
  document.addEventListener('contentvisibilityautostatechange', e => { if (e.skipped) skipped.add(e.target); else { skipped.delete(e.target); const t = e.target.closest?.('[data-turn-key]'); if (t && meta.has(t)) queue(t); } }, true);

  // Lean text for the preview: TeX source for math, list bullets, no buttons/SVG. Capped.
  const CAP = 4000;
  const BLOCKY = /^(P|LI|H[1-6]|PRE|TR|BLOCKQUOTE|DIV|UL|OL|TABLE|THEAD|TBODY|SECTION|FIGURE)$/;
  function lean(el, blockHeight) {
    let out = ''; const math = [];
    const walk = n => {
      if (out.length > CAP) return;
      if (n.nodeType === 3) { out += n.data; return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BUTTON' || tag === 'svg' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'IMG') return;
      const cls = n.classList;
      if (cls.contains('katex-display') || cls.contains('katex')) {
        const tex = n.querySelector('annotation')?.textContent ?? n.closest('[data-math-source]')?.getAttribute('data-math-source') ?? '';
        const display = cls.contains('katex-display');
        const start = out.length; out += tex; math.push({ start, end: out.length, display, h: display ? blockHeight : 0 }); return;
      }
      if (tag === 'BR') { out += '\n'; return; }
      const block = BLOCKY.test(tag);
      if (block && out && !out.endsWith('\n')) out += '\n';
      if (tag === 'LI') out += '• ';
      for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (tag === 'TD' || tag === 'TH') out += '  ';
      if (block && !out.endsWith('\n')) out += '\n';
    };
    walk(el);
    const trim = out.length - out.trimStart().length;
    const text = out.trim().slice(0, CAP);
    return { text, math: math.map(m => ({ ...m, start: m.start - trim, end: m.end - trim })).filter(m => m.start >= 0 && m.end <= text.length) };
  }
  // One computed-style read per distinct element class; reused by the preview as inline CSS.
  const styles = new Map();
  function styleKey(el) {
    const key = el.tagName + '.' + el.className;
    if (!styles.has(key)) {
      const c = getComputedStyle(el);
      styles.set(key, { id: styles.size, css: `font:${c.fontStyle} ${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.fontFamily};padding:${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft};border-radius:${c.borderRadius};background:${c.backgroundColor};color:${c.color};text-align:${c.textAlign}` });
      while (styles.size > 200) styles.delete(styles.keys().next().value);
    }
    return styles.get(key).css;
  }

  const resetStyles = () => { styles.clear(); for (const t of live) queue(t); };
  window.addEventListener?.('resize', resetStyles);
  if (document.documentElement) new MutationObserver(resetStyles).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-appearance-theme'] });

  const scWidths = new WeakMap();
  const pending = new Set(); let idle = 0;
  const queue = t => { pending.add(t); if (!idle) idle = requestAnimationFrame(flush); };
  function flush() {
    idle = 0;
    if (globalThis.__butterSeeking?.()) { idle = requestAnimationFrame(flush); return; }
    const sc = scroller();
    const batch = [...pending]; pending.clear();
    const layout = batch.length ? globalThis.__butterLayoutStore?.refreshLayout(sc) : null;
    for (const t of batch) record(t, sc, layout);
  }
  function record(t, sc, layout) {
    if (document.documentElement?.hasAttribute('data-butter-disabled') || !t.isConnected || !sc || !sc.contains(t)) return;
    const key = t.dataset.turnKey, c = conv();
    const t0 = performance.now();
    const isComplete = complete(t), ready = isComplete && mathReady(t), isSkipped = skipped.has(t);
    let snap = { conv: c, complete: isComplete, mathReady: ready, skipped: isSkipped };
    if (isComplete && ready && !isSkipped) {
      const row = t.parentElement, rr = row.getBoundingClientRect(), tr = t.getBoundingClientRect(), sr = sc.getBoundingClientRect();
      // Register blocks that appeared after the turn was first seen; a
      // block without an observed size makes this snapshot non-authoritative (RO re-queues the turn).
      const els = [...t.querySelectorAll(BLOCK)];
      for (const b of els) register(b, t);
      const blocks = els.map(b => contentH.get(b) ?? 0);
      const items = [...t.querySelectorAll(ITEMS)].map(el => {
        const r = el.getBoundingClientRect();
        let text = leanCache.get(el); if (text == null) { text = lean(el, r.height); leanCache.set(el, text); }
        return { top: r.top - rr.top, h: r.height, left: r.left - sr.left - sc.clientLeft, w: r.width, user: el.matches('[data-user-message-bubble]'), css: styleKey(el), text: text.text, math: text.math };
      });
      const {vw,sw} = globalThis.__butterLayoutCheck.layoutFingerprint({vw:innerWidth,sw:sc.clientWidth});
      snap = { ...snap, h: contentH.get(t) ?? t.clientHeight, rowH: rr.height, turnOffset: tr.top - rr.top, turnH: tr.height, w: rr.width, vw, sw, msg: identity(t), blocks, items };
    }
    if (snap.sw != null) scWidths.set(sc, snap.sw);
    const prev = turns.get(key);
    const { entry, changed, reason } = core.mergeRecord(prev?.conv === c ? prev : null, snap, performance.now());
    if (reason) { S.rejected[reason] = (S.rejected[reason] || 0) + 1; if (reason === 'zero-block') S.lastZero = [...t.querySelectorAll(BLOCK)].filter(b => !(contentH.get(b) > 0)).slice(0, 8).map(b => ({ tag: b.tagName, observed: contentH.get(b) ?? null })); }
    else { if (prev?.ready) S.refreshes++; S.records++; turns.delete(key); turns.set(key, entry); globalThis.__butterLayoutStore?.record(key, entry, sc, layout); }
    while (turns.size > 64) turns.delete(turns.keys().next().value);
    const ms = performance.now() - t0; S.recordMs += ms; S.recordMax = Math.max(S.recordMax, ms);
    void changed;
  }

  const ro = new ResizeObserver(es => {
    for (const r of es) {
      const m = meta.get(r.target);
      if (!m || !r.target.isConnected) continue;
      const h = r.contentRect.height;
      if (h > 0) contentH.set(r.target, h);
      queue(m.turn);
    }
  });
  const register = (b, t) => { if (meta.get(b)?.observing) return; meta.set(b, { turn: t, observing: true }); meta.get(t)?.blocks?.add(b); ro.observe(b); };
  // The turn element's own size changes whenever blocks stream in or math typesets, so observing it
  // re-queues a record. Register blocks immediately on insertion, before their first layout.
  const watch = t => {
    if (meta.has(t) || !t.dataset.turnKey) return;
    live.add(t); meta.set(t, { turn: t, blocks: new Set() }); ro.observe(t); for (const b of t.querySelectorAll(BLOCK)) register(b, t); S.observed++;
    queue(t);
  };
  new MutationObserver(rs => {
    let removed = false; const dirty = new Set();
    for (const r of rs) {
      if (r.removedNodes?.length) removed = true;
      const parent = (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest?.('[data-turn-key]');
      if (parent) dirty.add(parent);
      for (const n of r.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute('data-turn-key')) watch(n);
        else if (n.firstElementChild) n.querySelectorAll('[data-turn-key]').forEach(watch);
      }
    }
    for (const t of dirty) { for (const b of meta.get(t)?.blocks || []) if (!b.isConnected) { ro.unobserve(b); meta.get(b).observing = false; meta.get(t).blocks.delete(b); } for (const b of t.querySelectorAll(BLOCK)) register(b, t); for (const el of t.querySelectorAll(ITEMS)) leanCache.delete(el); queue(t); }
    if (removed) for (const t of live) {
      if (t.isConnected) continue;
      const e = turns.get(t.dataset.turnKey); if (e) e.removed = true;
      ro.unobserve(t); for (const b of meta.get(t)?.blocks || []) { ro.unobserve(b); meta.get(b).observing = false; } meta.get(t)?.blocks?.clear();
      live.delete(t);
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-talvt-turn-state', 'data-math-source'] });

  // Adopted geometry must still match current source, layout and expiry at each use.
  const currentEntry = (key, sc) => {
    const e = turns.get(key);
    if (e?.fromStorage && !globalThis.__butterLayoutStore?.valid(key, e, sc || scroller())) { turns.delete(key); return null; }
    return e;
  };
  // Restore only when identity, width, completeness and every block size still agree.
  const restore = t => {
    if (document.documentElement?.hasAttribute('data-butter-disabled')) return;
    const e = currentEntry(t.dataset.turnKey, t.closest('.thread-scroll-container'));
    const bs = t.querySelectorAll(BLOCK);
    const why = core.canRestore(e, { conv: conv(), vw: innerWidth, sw: scWidths.get(t.closest('.thread-scroll-container')), complete: complete(t), msg: identity(t), mathReady: mathReady(t), blockCount: bs.length });
    if (why) { S.restoreMisses[why] = (S.restoreMisses[why] || 0) + 1; if (S.hits.length < 200) S.hits.push({ t: performance.now(), key: t.dataset.turnKey, miss: why, live: bs.length, cached: e?.blocks.length ?? null }); return; }
    t.style.contentVisibility = 'auto'; t.style.containIntrinsicSize = `auto ${e.h}px`;
    let n = 0; bs.forEach((b, i) => { b.style.contentVisibility = 'auto'; b.style.containIntrinsicSize = `auto ${e.blocks[i]}px`; n++; });
    applied.add(t); S.restored++; S.blocksRestored += n;
    if (S.hits.length < 200) S.hits.push({ t: performance.now(), key: t.dataset.turnKey, h: e.h, n });
  };
  const applied = new WeakSet();
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  if (d?.configurable && d.get) Object.defineProperty(Element.prototype, 'clientWidth', { ...d, get() {
    S.hooks++;
    if (this.firstElementChild?.classList.contains('text-size-chat') && this.closest('[data-user-message-bubble]')) {
      const sc = this.closest('.thread-scroll-container');
      if (sc) for (const t of sc.querySelectorAll('[data-turn-key]')) if (!applied.has(t)) { restore(t); }
    }
    return Reflect.apply(d.get, this, []);
  } });

  // Read API for seek/preview-main.js (same world). Records carry chat text: never dump them.
  globalThis.__butterHeightCache = {
    get: (key, preparedScroller) => { const sc = preparedScroller || scroller(); if (!preparedScroller && turns.get(key)?.fromStorage) globalThis.__butterLayoutStore?.refreshLayout(sc); const e = currentEntry(key, sc); return e && e.conv === conv() ? e : null; },
    coverage: ids => { const sc = scroller(); if (ids.some(id => turns.get(id)?.fromStorage)) globalThis.__butterLayoutStore?.refreshLayout(sc); return core.coverage(k => currentEntry(k, sc), ids, { conv: conv(), vw: innerWidth }); },
    flush,
    invalidate: c => { for (const [id, e] of turns) if (e.conv === c) turns.delete(id); },
    adopt: (records, sc) => { scWidths.set(sc, sc.clientWidth); for (const [id, e] of Object.entries(records)) if (!turns.has(id)) turns.set(id, e); },
  };
  window.__heightCacheDump = () => ({ stats: { ...S, hits: S.hits.slice(-50) }, entries: [...turns].map(([k, e]) => ({ k: k.slice(0, 8), h: Math.round(e.h), rowH: Math.round(e.rowH || 0), n: e.blocks.length, items: e.items.length, zero: e.blocks.filter(h => !(h > 0)).length, removed: e.removed, records: e.records })) });
})();
