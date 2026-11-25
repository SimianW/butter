// MAIN world: authoritative turn/block geometry, restored before layout. Stored layout records are
// seek/layout-persistence-main.js and lean preview text is seek/layout-lean-main.js; both load
// before this file, which calls their factories.
// ChatGPT's answer structure (blocks, preview items, markdown columns, a turn's message id) is read
// through the page reader, page/reader-main.js.
(() => {
  const core = globalThis.__butterSeekCore,
    page = globalThis.__butterPageReader,
    persistenceOf = globalThis.__butterLayoutPersistence,
    leanOf = globalThis.__butterLayoutLean;
  if (!core || !page || !persistenceOf || !leanOf) return;
  // Lean text for the preview (lean, styleKey): seek/layout-lean-main.js.
  const { lean, styleKey, clearStyles } = leanOf();
  const S = {
    observed: 0,
    records: 0,
    refreshes: 0,
    rejected: {},
    recordMs: 0,
    recordMax: 0,
    restored: 0,
    blocksRestored: 0,
    restoreMisses: {},
    hooks: 0,
    parked: 0,
    released: 0,
    held: 0,
    hits: [],
  };
  // Dev build only: dev/recorder-main.js sets a listener through __butterLayoutCache.tap. Unset in
  // the store build, so each hook below is one null check and builds no summary.
  let tap = null;
  const emit = (type, fields, key) => {
    try {
      tap(type, fields, key);
    } catch {}
  };
  const turns = new Map(); // turnKey -> entry (see core.mergeRecord)
  const live = new Set(),
    meta = new WeakMap(),
    skipped = new WeakSet(),
    stale = new WeakSet(), // queued for a record that has not succeeded yet
    verified = new WeakMap(), // turn element -> the entry its last successful record produced
    outcomes = new WeakMap(), // last completed recording attempt; reason codes only
    contentH = new WeakMap(),
    leanCache = new WeakMap(),
    mathGeometry = new WeakMap(),
    applied = new WeakSet(); // turns restore() gave their recorded sizes
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] || null;
  // Any answer column serves for width and font. Reading one inside a turn that content-visibility
  // skips forced style and layout of that whole turn (a DisplayLock update: 0.6 s for a long answer).
  const shownColumn = (s) => {
    const first = page.firstColumn(s);
    if (!first || !skipped.has(first.closest?.('[data-turn-key]'))) return first;
    for (const c of page.columnsIn(s)) if (!skipped.has(c.closest('[data-turn-key]'))) return c;
    return first; // every answer skipped: nothing cheaper to read
  };
  const scroller = () =>
    [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
  // Stored layout records: seek/layout-persistence-main.js. Its listeners register here.
  const persistence = persistenceOf({ turns, conv, scroller, shownColumn });

  const complete = (t) =>
    !t.matches('[data-talvt-turn-state="in_progress"]') &&
    !t.querySelector('[data-talvt-turn-state="in_progress"]') &&
    (t.matches('[data-talvt-turn-state="complete"]') ||
      !!t.querySelector('[data-talvt-turn-state="complete"]'));
  // A turn whose answer is being generated, from the send until it reads complete. The cache leaves
  // it alone: no observers, queries or measuring (there is nothing to record until it completes),
  // and while one is generated nothing is measured in idle time either, because measuring forces
  // style and layout of a document that every streamed chunk dirties. On completion the turn is
  // watched afresh and everything queued meanwhile is measured.
  // A sent question appears as a turn that reads complete but holds no answer yet; seconds later it
  // turns in_progress. Measuring then (the previous answer, re-queued by the insertion) forced a
  // 0.4 s style recalc, and every style recalc for the rest of the stream ran about 30% slower.
  const BUSY = '[data-talvt-turn-state="in_progress"]';
  const PENDING_MS = 15000; // a send that never starts streaming stops holding idle measuring
  const busy = new Map(); // turn element -> { since, streamed }
  const streams = (t) => t.matches(BUSY) || !!t.querySelector(BUSY);
  const generating = (t) =>
    !complete(t) || (!!t.querySelector('[data-user-message-bubble]') && !page.hasAnswer(t));
  // ChatGPT's markdown renderer reveals a streamed answer gradually. Only while it does so does it
  // render the revealed prefix instead of the full text, and only then does its markdown root carry
  // .AdaptiveStreaming (hashed: AdaptiveStreaming-xxxxxx). The turn may already read complete, so a
  // snapshot then holds just the first paragraphs of the answer.
  const revealing = (t) => !!t.querySelector('[class*="AdaptiveStreaming"]');
  const mathReady = (t) =>
    [...t.querySelectorAll('[data-math-source]')].every((e) => e.querySelector('.katex'));
  const identity = page.turnMessageId;
  const offList = () =>
    (document.documentElement?.getAttribute?.('data-butter-off') || '').split(/\s+/);
  const disabled = () => !!document.documentElement?.hasAttribute?.('data-butter-disabled');
  const cvOff = () => disabled() || offList().includes('cv');
  // Records serve the seek preview and remount restore (cv); stored ones load only with seek on.
  const needed = () => {
    const off = offList();
    return !disabled() && !(off.includes('seek') && off.includes('cv'));
  };
  // Fast wheel scrolling crosses the content-visibility boundary constantly. A block coming back
  // into view re-queues its turn only when this element's last record is gone or replaced, or the
  // turn changed since: DOM changes (message, blocks), size changes and resizes all queue the turn,
  // which marks it stale. Re-measuring an unchanged turn forced layout of every item inside the
  // scroll frames, and even a DOM check per event costs ms on a long turn, so this one is O(1).
  document.addEventListener(
    'contentvisibilityautostatechange',
    (e) => {
      if (e.skipped) skipped.add(e.target);
      else {
        skipped.delete(e.target);
        const t = e.target.closest?.('[data-turn-key]');
        if (t && meta.has(t) && (stale.has(t) || verified.get(t) !== turns.get(t.dataset.turnKey)))
          queue(t);
      }
    },
    true,
  );

  const resetStyles = () => {
    clearStyles();
    for (const t of live) queue(t);
  };
  window.addEventListener?.('resize', resetStyles);
  if (document.documentElement)
    new MutationObserver(resetStyles).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-appearance-theme'],
    });

  const scWidths = new WeakMap();
  const pending = new Set(),
    recheck = new WeakSet(),
    changes = new WeakMap(); // turn element -> queue count, so a measure in slices sees changes
  // Measuring reads layout for every item of a turn. It runs only in idle time, in slices of SLICE
  // items between checks of the idle deadline, so a turn first seen while the page scrolls is
  // recorded while it is still rendered, without taking a scroll frame. Turns already recorded are
  // never queued just for coming back into view (see the content-visibility listener above), and a
  // remounted copy of a recorded, unchanged turn adopts its record instead of measuring again.
  const SLICE = 24,
    RESERVE = 1; // ms of the idle period left alone
  let idle = 0,
    job = null;
  const schedule = () => {
    if (idle) return;
    idle = globalThis.requestIdleCallback ? requestIdleCallback(work) : setTimeout(work, 0);
  };
  const queue = (t) => {
    pending.add(t);
    stale.add(t);
    changes.set(t, (changes.get(t) || 0) + 1);
    schedule();
  };
  // Releases turns that completed without a state change reaching the observer, and says whether
  // idle measuring must wait for an answer being generated.
  const holding = () => {
    let hold = false;
    for (const [t, b] of busy) {
      if (!t.isConnected) busy.delete(t);
      else if (!generating(t)) release(t);
      else if (streams(t)) hold = b.streamed = true;
      else if (b.streamed)
        continue; // stopped without completing: nothing to record, no hold
      else if (performance.now() - b.since < PENDING_MS) hold = true;
      else release(t, true); // a send that never started streaming: watch it as it is
    }
    return hold;
  };
  function work(deadline) {
    idle = 0;
    if (busy.size && holding()) {
      S.held++;
      idle = setTimeout(() => {
        idle = 0;
        schedule();
      }, 1000);
      return;
    }
    if (globalThis.__butterSeeking?.()) {
      idle = setTimeout(() => {
        idle = 0;
        schedule();
      }, 100);
      return;
    }
    run(deadline?.timeRemaining ? () => deadline.timeRemaining() : () => Infinity);
    if (job || pending.size) schedule();
  }
  function run(left) {
    while (left() > RESERVE) {
      if (!job) {
        const t = pending.values().next().value;
        if (!t) return;
        pending.delete(t);
        job = begin(t, scroller());
        continue;
      }
      if (step(job, left)) job = null;
    }
  }
  // Everything still queued, now (a seek press, tests).
  const measure = () => run(() => Infinity);
  // A turn's geometry box. A display: contents block (ChatGPT's widgets, e.g. a learning card) has
  // no box of its own: its children's boxes stand in, or it would read as 0 px and at the page top.
  const box = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width || r.height || !el.getClientRects || el.getClientRects().length) return r;
    let top = Infinity,
      bottom = -Infinity,
      left = Infinity,
      right = -Infinity;
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
      const x = box(c);
      if (!x.width && !x.height) continue;
      top = Math.min(top, x.top);
      left = Math.min(left, x.left);
      bottom = Math.max(bottom, x.top + x.height);
      right = Math.max(right, x.left + x.width);
    }
    return top === Infinity ? r : { top, left, width: right - left, height: bottom - top };
  };
  const boxless = (el) => !!el.getClientRects && el.getClientRects().length === 0;
  // A block skipped by the streaming rule before it ever rendered is only its placeholder size
  // (contain-intrinsic-size 120px: a display formula read as 152 px). stream/offscreen.js marks a
  // block data-butter-seen only once it has rendered at its real size; until then, a block it held
  // back (data-butter-unrendered) stays skipped after the answer completes.
  const placeholder = (b, t) => {
    if (!skipped.has(b) || b.hasAttribute?.('data-butter-seen')) return false;
    if (b.hasAttribute?.('data-butter-unrendered') && !cvOff()) return true;
    if (applied.has(t)) return false;
    if (getComputedStyle(b).contentVisibility === 'auto') return true;
    skipped.delete(b); // no longer content-visibility: auto, so no event said it stopped skipping
    return false;
  };
  function reject(t, reason) {
    outcomes.set(t, { reason });
    S.rejected[reason] = (S.rejected[reason] || 0) + 1;
    if (tap) emit('rejection', { reason }, t.dataset.turnKey);
    // The class going away is not observed, and an answer revealed in full by then may not
    // resize or mutate again, so look once more shortly after.
    if (reason === 'revealing' && !recheck.has(t)) {
      recheck.add(t);
      setTimeout(() => {
        recheck.delete(t);
        queue(t);
      }, 500);
    }
    if (reason === 'zero-block')
      S.lastZero = [...page.blocksIn(t)]
        .filter((b) => !(contentH.get(b) > 0))
        .slice(0, 8)
        .map((b) => ({ tag: b.tagName, observed: contentH.get(b) ?? null }));
  }
  const timed = (fn) => {
    const t0 = performance.now();
    const out = fn();
    const ms = performance.now() - t0;
    S.recordMs += ms;
    S.recordMax = Math.max(S.recordMax, ms);
    return out;
  };
  // Starts a measure of t: the cheap checks, then the item list. Returns the job, or null when the
  // snapshot is rejected (or the record adopted) without reading any item.
  function begin(t, sc) {
    if (!needed() || !t.isConnected || !sc || !sc.contains(t)) return null;
    return timed(() => {
      const key = t.dataset.turnKey,
        c = conv();
      const isComplete = complete(t),
        isRevealing = isComplete && revealing(t),
        ready = isComplete && mathReady(t),
        isSkipped = skipped.has(t);
      const snap = {
        conv: c,
        complete: isComplete,
        revealing: isRevealing,
        mathReady: ready,
        skipped: isSkipped,
      };
      let els;
      if (isComplete && !isRevealing && ready && !isSkipped) {
        els = [...page.blocksIn(t)];
        // Register blocks that appeared after the turn was first seen; a block without an observed
        // size makes this snapshot non-authoritative (RO re-queues the turn).
        for (const b of els) register(b, t);
        snap.placeholder = els.some((b) => placeholder(b, t));
      }
      const prev = turns.get(key);
      if (!core.validateSnapshot({ ...snap, h: 1, blocks: [1] })) {
        if (adopt(t, prev, c, els)) return null;
        return {
          t,
          sc,
          key,
          c,
          snap,
          els,
          changes: changes.get(t),
          all: [...page.previewItemsIn(t)],
          items: [],
        };
      }
      finish({ t, sc, key, c, snap }, null);
      return null;
    });
  }
  // ChatGPT remounts turns as they scroll in and out. A new element for a recorded message, at the
  // recorded width with the recorded turn, row and block sizes, is the same layout: no measure.
  function adopt(t, prev, c, els) {
    if (
      !prev?.ready ||
      prev.fromStorage ||
      prev.conv !== c ||
      verified.get(t) === prev ||
      prev.items.some((it) => it.approx) // measure: the new copy may show what was estimated
    )
      return false;
    const row = t.parentElement;
    if (
      prev.msg !== identity(t) ||
      prev.vw !== innerWidth ||
      prev.h !== contentH.get(t) ||
      prev.blocks.length !== els.length ||
      els.some((b, i) => prev.blocks[i] !== contentH.get(b)) ||
      prev.rowH !== row?.getBoundingClientRect().height
    )
      return false;
    S.adopted = (S.adopted || 0) + 1;
    outcomes.set(t, { reason: null });
    stale.delete(t);
    verified.set(t, prev);
    return true;
  }
  // Content of a lean() result, without its element references.
  const signature = (x) =>
    x.text + '\0' + x.math.map((m) => `${m.start},${m.end},${+m.display}`).join(';');
  // A display formula never measured: about one rendered row per TeX row, within its block.
  const ESTIMATED_ROW = 40;
  const estimateDisplay = (tex, blockH) =>
    Math.min(blockH, ESTIMATED_ROW * (1 + (tex.match(/\\\\|\\cr(?![a-zA-Z])/g) || []).length));
  // Reads the next items of a job until the idle deadline. Returns true when the job is done.
  function step(j, left) {
    const { t, sc } = j;
    if (changes.get(t) !== j.changes || !t.isConnected || skipped.has(t)) return true; // re-queued, gone or skipped (stale: queued again on reveal)
    if (!needed()) return true; // seek and cv turned off since begin()
    return timed(() => {
      const rr = t.parentElement.getBoundingClientRect(),
        sr = sc.getBoundingClientRect(),
        column = page.firstColumn(t)?.getBoundingClientRect();
      do {
        for (const end = Math.min(j.all.length, j.items.length + SLICE); j.items.length < end; ) {
          const el = j.all[j.items.length];
          const r = box(el);
          const hidden = skipped.has(el);
          let text = leanCache.get(el);
          if (text == null || (text.spatial && !hidden)) {
            text = lean(el, !hidden);
            leanCache.set(el, text);
          }
          let math,
            approx = false;
          // Descendant reads force layout inside a skipped block (widget rows, formula boxes). Reuse
          // the geometry measured while it was on screen if its content and box are unchanged. Any
          // mutation in the turn (ChatGPT's hover action bar) drops leanCache, so compare content,
          // not the cached object; a widget's rows are compared by its row-free text.
          if (hidden && (text.spatial || text.math.some((m) => m.display))) {
            const cached = mathGeometry.get(el);
            if (
              cached &&
              cached.w === r.width &&
              cached.h === r.height &&
              (cached.text === text || cached.sig === signature(text))
            ) {
              text = cached.text;
              math = cached.math;
            } else {
              // Never on screen in this layout. Its box is real (a seen block skips at its
              // remembered size; an unrendered one is rejected as a placeholder in begin()), so the
              // answer stays usable; only the rows or formula boxes inside are estimates. The item
              // is flagged, the record is not persisted, and the turn stays queued for its reveal.
              approx = true;
              math = text.math.map(({ element: _element, ...m }) => ({
                ...m,
                h: m.display ? estimateDisplay(text.text.slice(m.start, m.end), r.height) : 0,
              }));
            }
          } else {
            // Text/offsets survive resize, but each formula's own box must be refreshed.
            math = text.math.map(({ element, ...m }) => ({
              ...m,
              h: m.display ? box(element).height : 0,
            }));
            if (!hidden)
              mathGeometry.set(el, {
                text,
                sig: signature(text.spatial ? lean(el, false) : text),
                w: r.width,
                h: r.height,
                math,
              });
          }
          const span = core.previewItemSpan(
            { left: r.left - sr.left - sc.clientLeft, w: r.width },
            column && { left: column.left - sr.left - sc.clientLeft, w: column.width },
          );
          j.items.push({
            top: r.top - rr.top,
            h: r.height,
            ...span,
            user: el.matches('[data-user-message-bubble]'),
            css: styleKey(el),
            text: text.text,
            math,
            ...(approx && { approx }),
          });
        }
      } while (j.items.length < j.all.length && left() > RESERVE);
      if (j.items.length < j.all.length) return false;
      finish(j, rr);
      return true;
    });
  }
  function finish(j, rr) {
    const { t, sc, key, c } = j;
    let snap = j.snap,
      layout = null;
    if (rr) {
      const tr = t.getBoundingClientRect();
      const { vw, sw } = __butterLayoutCheck.layoutFingerprint({
        vw: innerWidth,
        sw: sc.clientWidth,
      });
      snap = {
        ...snap,
        h: contentH.get(t) ?? t.clientHeight,
        rowH: rr.height,
        turnOffset: tr.top - rr.top,
        turnH: tr.height,
        w: rr.width,
        vw,
        sw,
        msg: identity(t),
        blocks: j.els.map((b) => contentH.get(b) ?? (boxless(b) ? box(b).height : 0)),
        items: j.items,
      };
      layout = document.documentElement ? persistence.refreshLayout(sc) : null;
    }
    if (snap.sw != null) scWidths.set(sc, snap.sw);
    const prev = turns.get(key);
    // Estimates (see step) stand in only where nothing was measured: never over a record measured
    // in full. A block coming into view queues the turn again (stale); only a full record is stored.
    const approx = !!snap.items?.some((it) => it.approx);
    const { entry, reason } =
      approx && prev?.ready && prev.conv === c && !prev.items.some((it) => it.approx)
        ? { entry: prev, reason: 'estimated' }
        : core.mergeRecord(prev?.conv === c ? prev : null, snap, performance.now());
    if (reason) reject(t, reason);
    else {
      outcomes.set(t, { reason: null });
      if (prev?.ready) S.refreshes++;
      S.records++;
      if (approx) S.approx = (S.approx || 0) + 1;
      else stale.delete(t);
      if (tap)
        emit(
          'record',
          {
            items: entry.items.length,
            blocks: entry.blocks.length,
            refresh: !!prev?.ready,
            approx,
          },
          key,
        );
      verified.set(t, entry);
      turns.delete(key);
      turns.set(key, entry);
      if (!approx) persistence.record(key, entry, sc, layout);
    }
    while (turns.size > 64) turns.delete(turns.keys().next().value);
  }

  const ro = new ResizeObserver((es) => {
    for (const r of es) {
      const m = meta.get(r.target);
      if (!m || !r.target.isConnected) continue;
      const h = r.contentRect.height;
      if (h > 0) contentH.set(r.target, h);
      queue(m.turn);
    }
  });
  const register = (b, t) => {
    if (meta.get(b)?.observing) return;
    meta.set(b, { turn: t, observing: true });
    meta.get(t)?.blocks?.add(b);
    ro.observe(b);
  };
  // The turn element's own size changes whenever blocks stream in or math typesets, so observing it
  // re-queues a record. Register blocks immediately on insertion, before their first layout.
  const watch = (t, settled = false) => {
    if (meta.has(t) || !t.dataset.turnKey || busy.has(t)) return;
    if (!settled && generating(t)) {
      park(t);
      return;
    }
    live.add(t);
    // The record's rowH is the row's height; the row can grow outside the turn (no mutation inside
    // [data-turn-key]), so observe it too or the record goes stale without a new reveal re-measure.
    const row = t.parentElement;
    meta.set(t, { turn: t, blocks: new Set(), row });
    ro.observe(t);
    if (row && meta.get(row)?.turn !== t) {
      meta.set(row, { turn: t }); // a remounted turn in a reused row takes the row over
      ro.observe(row);
    }
    for (const b of page.blocksIn(t)) register(b, t);
    S.observed++;
    queue(t);
  };
  // Stops watching a turn whose answer is being generated (see busy above).
  function park(t) {
    if (!busy.has(t)) {
      busy.set(t, { since: performance.now(), streamed: false });
      S.parked++;
    }
    schedule(); // holding() polls it, in case its completion reaches no observer
    pending.delete(t);
    if (job?.t === t) job = null;
    if (applied.has(t)) unrestore(t); // the regenerated answer's blocks are not the recorded ones
    const m = meta.get(t);
    if (!m) return;
    ro.unobserve(t);
    if (m.row && meta.get(m.row)?.turn === t) {
      ro.unobserve(m.row);
      meta.delete(m.row);
    }
    for (const b of m.blocks || []) {
      ro.unobserve(b);
      meta.get(b).observing = false;
    }
    meta.delete(t);
    live.delete(t);
  }
  function release(t, settled = false) {
    busy.delete(t);
    S.released++;
    for (const el of page.previewItemsIn(t)) leanCache.delete(el);
    watch(t, settled);
  }
  new MutationObserver((rs) => {
    let removed = false;
    const dirty = new Set(),
      states = new Set(); // turns whose generation state may have changed
    for (const r of rs) {
      if (r.removedNodes?.length) removed = true;
      const parent = (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest?.(
        '[data-turn-key]',
      );
      // stream/offscreen.js marks a block seen up to a second after it rendered, often once it is
      // skipped again with no reveal left to come. A turn rejected for that placeholder (or still
      // holding estimates) is queued again; nothing in it changed, so its lean text is kept.
      if (r.attributeName === 'data-butter-seen') {
        if (parent && meta.has(parent) && stale.has(parent)) queue(parent);
        continue;
      }
      let state = r.attributeName === 'data-talvt-turn-state';
      for (const n of r.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute('data-turn-key')) watch(n);
        else if (parent)
          state ||=
            n.hasAttribute('data-talvt-turn-state') ||
            (!!n.firstElementChild && !!n.querySelector('[data-talvt-turn-state]'));
        else if (n.firstElementChild)
          n.querySelectorAll('[data-turn-key]').forEach((t) => watch(t));
      }
      if (!parent) continue;
      if (state) states.add(parent);
      // A generating turn's only interesting change is its state.
      if (state || !busy.has(parent)) dirty.add(parent);
    }
    for (const t of dirty) {
      if (busy.has(t)) {
        if (!generating(t)) release(t);
        continue;
      }
      if (states.has(t) && t.dataset.turnKey && generating(t)) {
        park(t);
        continue;
      }
      for (const b of meta.get(t)?.blocks || [])
        if (!b.isConnected) {
          ro.unobserve(b);
          meta.get(b).observing = false;
          meta.get(t).blocks.delete(b);
        }
      for (const b of page.blocksIn(t)) register(b, t);
      for (const el of page.previewItemsIn(t)) leanCache.delete(el);
      queue(t);
    }
    if (removed)
      for (const t of live) {
        if (t.isConnected) continue;
        const e = turns.get(t.dataset.turnKey);
        if (e) e.removed = true;
        ro.unobserve(t);
        const row = meta.get(t)?.row;
        if (row && meta.get(row)?.turn === t) {
          ro.unobserve(row);
          meta.delete(row);
        }
        for (const b of meta.get(t)?.blocks || []) {
          ro.unobserve(b);
          meta.get(b).observing = false;
        }
        meta.get(t)?.blocks?.clear();
        live.delete(t);
      }
  }).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-talvt-turn-state', 'data-math-source', 'data-butter-seen'],
  });
  // document_start normally precedes the turns; also handle turns already present at startup.
  // Scrolling alone produces no child mutation to register an existing single/last turn.
  document.querySelectorAll('[data-turn-key]').forEach((t) => watch(t));

  // Adopted geometry must still match current source, layout and expiry at each use.
  const currentEntry = (key, sc) => {
    const e = turns.get(key);
    if (e?.fromStorage && !persistence.valid(key, e, sc || scroller())) {
      turns.delete(key);
      return null;
    }
    return e;
  };
  // Restore only when identity, width, completeness and every block size still agree.
  // Inline content-visibility is the cv feature: with cv (or Butter) off, leave turns as they are.
  const restore = (t) => {
    if (cvOff()) return;
    const e = currentEntry(t.dataset.turnKey, t.closest('.thread-scroll-container'));
    const bs = page.blocksIn(t);
    const why = core.canRestore(e, {
      conv: conv(),
      vw: innerWidth,
      sw: scWidths.get(t.closest('.thread-scroll-container')),
      complete: complete(t),
      msg: identity(t),
      mathReady: mathReady(t),
      blockCount: bs.length,
    });
    if (why) {
      S.restoreMisses[why] = (S.restoreMisses[why] || 0) + 1;
      if (S.hits.length < 200)
        S.hits.push({
          t: performance.now(),
          key: t.dataset.turnKey,
          miss: why,
          live: bs.length,
          cached: e?.blocks.length ?? null,
        });
      return;
    }
    t.style.contentVisibility = 'auto';
    t.style.containIntrinsicSize = `auto ${e.h}px`;
    let n = 0;
    bs.forEach((b, i) => {
      b.style.contentVisibility = 'auto';
      b.style.containIntrinsicSize = `auto ${e.blocks[i]}px`;
      n++;
    });
    applied.add(t);
    S.restored++;
    S.blocksRestored += n;
    if (tap) emit('restore', { blocks: n }, t.dataset.turnKey);
    if (S.hits.length < 200)
      S.hits.push({ t: performance.now(), key: t.dataset.turnKey, h: e.h, n });
  };
  const unrestore = (t) => {
    for (const el of [t, ...page.blocksIn(t)]) {
      el.style.contentVisibility = '';
      el.style.containIntrinsicSize = '';
    }
    applied.delete(t);
  };
  let wasNeeded = needed();
  if (document.documentElement)
    new MutationObserver(() => {
      if (cvOff()) for (const t of live) if (applied.has(t)) unrestore(t);
      if (needed() && !wasNeeded) for (const t of live) queue(t);
      wasNeeded = needed();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-butter-off', 'data-butter-disabled'],
    });
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  if (d?.configurable && d.get)
    Object.defineProperty(Element.prototype, 'clientWidth', {
      ...d,
      get() {
        S.hooks++;
        if (
          this.firstElementChild?.classList.contains('text-size-chat') &&
          this.closest('[data-user-message-bubble]')
        ) {
          const sc = this.closest('.thread-scroll-container');
          if (sc)
            for (const t of sc.querySelectorAll('[data-turn-key]'))
              if (!applied.has(t) && !busy.has(t)) restore(t);
        }
        return Reflect.apply(d.get, this, []);
      },
    });

  // Read API for seek/preview-main.js (same world). Records carry chat text: never dump them.
  const recordDecision = (e, conversation) => ({
    hasRecord: !!e,
    convMatches: e ? e.conv === conversation : null,
    items: e?.items?.length ?? 0,
    blocks: e?.blocks?.length ?? 0,
    sw: Number.isFinite(e?.sw) ? e.sw : null,
    rowH: Number.isFinite(e?.rowH) ? e.rowH : null,
    fromStorage: !!e?.fromStorage,
  });
  globalThis.__butterLayoutCache = {
    ...persistence,
    // Dev build: the recorder's listener for record, rejection and restore (type, fields, turn key).
    set tap(listener) {
      tap = typeof listener === 'function' ? listener : null;
    },
    column: shownColumn,
    flush: () => persistence.flush(),
    flushMeasurements: measure,
    // Diagnostics only: recorder status for one mounted turn element, as booleans and reason codes.
    diagnostics: (t) => ({
      observed: meta.has(t),
      generating: busy.has(t),
      queued: pending.has(t),
      measuring: job?.t === t,
      attempted: outcomes.has(t),
      lastRejection: outcomes.get(t)?.reason ?? null,
    }),
    get: (key, preparedScroller) => {
      const sc = preparedScroller || scroller();
      if (!preparedScroller && turns.get(key)?.fromStorage) persistence.refreshLayout(sc);
      const e = currentEntry(key, sc);
      return e && e.conv === conv() ? e : null;
    },
    coverage: (ids) => {
      const sc = scroller();
      if (ids.some((id) => turns.get(id)?.fromStorage)) persistence.refreshLayout(sc);
      return core.coverage((k) => currentEntry(k, sc), ids, { conv: conv(), vw: innerWidth });
    },
    // One synchronous consumer path: hydrate/adopt disk records, then validate every entry.
    prepare: (sc, ids) => {
      const conversation = conv(),
        before = ids.map((id) => turns.get(id)),
        beforeDecisions = before.map((e) => recordDecision(e, conversation));
      // A press right after wheel scrolling: measure turns still waiting for the scroll to settle.
      measure();
      const stored = persistence.records(sc);
      scWidths.set(sc, sc.clientWidth);
      for (const [id, e] of Object.entries(stored)) if (!turns.has(id)) turns.set(id, e);
      const records = {},
        decisions = [];
      for (const [index, id] of ids.entries()) {
        const candidate = turns.get(id);
        const e = currentEntry(id, sc);
        if (e?.conv === conversation) records[id] = e;
        decisions.push({
          before: beforeDecisions[index],
          after: recordDecision(e, conversation),
          recordChanged: before[index] !== e,
          storedAvailable: !!stored[id],
          retiredStored: !!candidate && !e,
          reason: e && e.conv !== conversation ? 'conv-mismatch' : null,
        });
      }
      return { records, storedTurns: Object.keys(stored).length, decisions };
    },
    adopt: (records, sc) => {
      scWidths.set(sc, sc.clientWidth);
      for (const [id, e] of Object.entries(records)) if (!turns.has(id)) turns.set(id, e);
    },
  };
  window.__heightCacheDump = () => ({
    stats: { ...S, hits: S.hits.slice(-50) },
    entries: [...turns].map(([k, e]) => ({
      k: k.slice(0, 8),
      h: Math.round(e.h),
      rowH: Math.round(e.rowH || 0),
      n: e.blocks.length,
      items: e.items.length,
      zero: e.blocks.filter((h) => !(h > 0)).length,
      removed: e.removed,
      records: e.records,
    })),
  });
})();
