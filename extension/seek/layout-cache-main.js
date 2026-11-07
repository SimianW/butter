// MAIN world: authoritative turn/block geometry and lean preview text, restored before layout.
(() => {
  const core = globalThis.__butterSeekCore;
  if (!core) return;
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
  const turns = new Map(); // turnKey -> entry (see core.mergeRecord)
  const live = new Set(),
    meta = new WeakMap(),
    skipped = new WeakSet(),
    stale = new WeakSet(), // queued for a record that has not succeeded yet
    verified = new WeakMap(), // turn element -> the entry its last successful record produced
    outcomes = new WeakMap(), // last completed recording attempt; reason codes only
    contentH = new WeakMap(),
    leanCache = new WeakMap(),
    applied = new WeakSet(); // turns restore() gave their recorded sizes
  const BLOCK = '[data-markdown-text-style="assistant-message"] > :not([data-wide-block]):not(hr)';
  const ITEMS = '[data-user-message-bubble], [data-markdown-text-style="assistant-message"] > *';
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] || null;
  // Any answer column serves for width and font. Reading one inside a turn that content-visibility
  // skips forced style and layout of that whole turn (a DisplayLock update: 0.6 s for a long answer).
  const MD = '[data-markdown-text-style="assistant-message"]';
  const shownColumn = (s) => {
    const first = s.querySelector(MD);
    if (!first || !skipped.has(first.closest?.('[data-turn-key]'))) return first;
    for (const c of s.querySelectorAll(MD))
      if (!skipped.has(c.closest('[data-turn-key]'))) return c;
    return first; // every answer skipped: nothing cheaper to read
  };
  const scroller = () =>
    [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
  const persistence = (() => {
    const unsupported = new Set(),
      invalidated = new Set(),
      epochs = new Map();
    document.addEventListener('butter-seek-write', (e) =>
      persistence.invalidate(e.detail.conv || location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1]),
    );
    document.addEventListener('butter-seek-data', (e) => {
      const { conv, j, before } = e.detail;
      if (!before) invalidated.delete(conv);
      const msgs =
        j.messages ||
        Object.values(j.mapping || {})
          .map((n) => n.message)
          .filter(Boolean);
      if (
        msgs.some(
          (m) =>
            !m.metadata?.is_visually_hidden_from_conversation &&
            ['user', 'assistant'].includes(m.author?.role) &&
            (!m.channel || m.channel === 'final') &&
            ((m.content?.parts || []).some((x) => typeof x !== 'string') ||
              (m.metadata?.attachments || []).length ||
              (m.metadata?.citations || []).length),
        )
      )
        unsupported.add(conv);
    });
    const c = __butterLayoutCheck,
      rows = new Map(),
      contexts = new Map(),
      memory = new Map(),
      pending = new Map();
    const S = { ready: false, loads: 0, hits: 0, writes: 0, bytes: 0, rejected: {}, errors: 0 };
    let job = 0;
    const queuePending = (turn, value) => {
      if (!pending.has(turn) && pending.size >= 256) pending.delete(pending.keys().next().value);
      pending.set(turn, value);
    };
    const reject = (why) => (S.rejected[why] = (S.rejected[why] || 0) + 1);
    const digest = async (text) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
    // Fingerprints are refreshed only outside the restore hook. Invalidations are layout-free.
    let layouts = new WeakMap();
    const invalidateLayout = () => {
      layouts = new WeakMap();
    };
    window.addEventListener?.('resize', invalidateLayout);
    document.fonts?.addEventListener('loading', invalidateLayout);
    document.fonts?.addEventListener('loadingdone', invalidateLayout);
    document.fonts?.addEventListener('loadingerror', invalidateLayout);
    if (document.documentElement)
      new MutationObserver(invalidateLayout).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-appearance-theme'],
      });
    const columns = new WeakMap(),
      owners = new WeakMap();
    const layoutObserver = new ResizeObserver((es) => {
      for (const e of es) {
        const s = owners.get(e.target);
        // observe() reports a column switched in by shownColumn at once, even at the sampled width.
        // borderWidth is untransformed like the border box; gBCR width differs under a scale.
        if (
          s &&
          columns.get(s) === e.target &&
          Math.round(e.borderBoxSize?.[0]?.inlineSize) === layouts.get(s)?.borderWidth
        )
          continue;
        layouts.delete(s || e.target);
      }
    });
    const theme = () =>
      JSON.stringify([
        document.documentElement.className,
        document.documentElement.getAttribute?.('data-theme'),
        document.documentElement.getAttribute?.('data-appearance-theme'),
      ]);
    const stamp = () =>
      JSON.stringify([
        innerWidth,
        devicePixelRatio,
        theme(),
        document.documentElement.getAttribute?.('style'),
      ]);
    const layout = (s) => {
      if (!s) return null;
      const sw = s.clientWidth,
        column = shownColumn(s);
      const width = column?.getBoundingClientRect?.().width,
        borderWidth = column?.offsetWidth;
      if (columns.get(s) !== column) {
        if (columns.get(s)) layoutObserver.unobserve(columns.get(s));
        columns.set(s, column);
        if (column) {
          owners.set(column, s);
          layoutObserver.observe(column);
        }
      }
      const value = JSON.stringify(
        c.layoutFingerprint({
          sw,
          vw: innerWidth,
          dpr: devicePixelRatio,
          font: getComputedStyle(column || s).font,
          column: width,
          theme: theme(),
          build: [...document.scripts]
            .map((e) => e.src)
            .filter((x) => x.includes('/cdn/assets/'))
            .sort()
            .join('|'),
        }),
      );
      if (!layouts.has(s)) layoutObserver.observe(s);
      layouts.set(s, { value, stamp: stamp(), borderWidth });
      return value;
    };
    const cachedLayout = (s) => {
      const x = s && layouts.get(s);
      return x && x.stamp === stamp() ? x.value : null;
    };
    const key = (ctx) => JSON.stringify([ctx.conv, ctx.turn, ctx.msg, ctx.digest, ctx.layout]);
    const hashes = new Map();
    const hashed = (value) => {
      if (!hashes.has(value)) hashes.set(value, digest(value));
      return hashes.get(value);
    };
    const layoutHashes = new Map();
    const rememberLayout = (value) => {
      if (value && !layoutHashes.has(value)) {
        layoutHashes.set(value, null);
        hashed(value).then((h) => layoutHashes.set(value, h));
      }
      return value;
    };
    const requests = new Map();
    let serial = 0,
      account = null,
      diskEnabled = false,
      generation,
      scope = 0,
      outcome = 'idle';
    document.addEventListener('butter-status-request', () => {
      const exercised = diskEnabled && !!account && outcome !== 'idle';
      document.dispatchEvent(
        new CustomEvent('butter-status-response', {
          detail: JSON.stringify({
            layout: {
              exercised,
              engaged: exercised && outcome === 'ok',
              failed: exercised && outcome === 'fail',
            },
          }),
        }),
      );
    });
    let loadedConv = null,
      loading = null,
      loadSerial = 0;
    const send = (op, data = {}) =>
      new Promise((resolve) => {
        const id = ++serial;
        const timeout = setTimeout(() => {
          requests.delete(id);
          resolve({ error: 'timeout' });
        }, 10000);
        requests.set(id, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
        document.dispatchEvent?.(
          new CustomEvent('butter-layout-request', {
            detail: JSON.stringify({ id, op, ...data }),
          }),
        );
      });
    const retire = () => {
      scope++;
      outcome = 'idle';
      loadSerial++;
      loading = null;
      memory.clear();
      pending.clear();
      generation = undefined;
      loadedConv = null;
      for (const [id, e] of turns) if (e.fromStorage) turns.delete(id);
    };
    const prefetch = (conversation) => {
      if (!diskEnabled || !account || !conversation || conversation !== conv())
        return Promise.resolve();
      if (loading?.conv === conversation) return loading.promise;
      const sequence = ++loadSerial;
      const promise = (async () => {
        const token = scope,
          owner = account,
          conv = conversation;
        const convHash = await hashed(conv);
        const result = await send('load', { account: owner, conv: convHash });
        if (sequence !== loadSerial || token !== scope || owner !== account || !diskEnabled) return;
        S.loads++;
        if (result.error || !Number.isSafeInteger(result.generation) || result.generation < 0) {
          S.ready = false;
          outcome = 'fail';
          S.errors++;
          return;
        }
        memory.clear();
        for (const x of result.records || [])
          if (ButterLayoutCodec.valid(x)) memory.set(ButterLayoutCodec.key(x), x);
        generation = result.generation;
        loadedConv = conv;
        S.ready = true;
        outcome = 'ok';
        S.bytes = [...memory.values()].reduce((n, x) => n + ButterLayoutCodec.bytes(x), 0);
      })().finally(() => {
        if (sequence === loadSerial) loading = null;
      });
      loading = { conv: conversation, promise };
      return promise;
    };
    document.addEventListener('butter-layout-response', (e) => {
      let result;
      try {
        result = JSON.parse(e.detail);
      } catch {
        return;
      }
      if (result.id) {
        requests.get(result.id)?.(result);
        requests.delete(result.id);
        return;
      }
      if (result.state) {
        const was = diskEnabled;
        diskEnabled = !!result.enabled;
        if (!diskEnabled) retire();
        else if (!was) prefetch(conv());
      }
      if (result.cleared) {
        retire();
        if (diskEnabled) prefetch(conv());
      }
    });
    document.addEventListener('butter-account', (e) => {
      const next = ButterLayoutCodec.hash(e.detail) ? e.detail : null;
      if (next === account) return;
      const previous = account;
      retire();
      if (previous) {
        turns.clear();
        contexts.clear();
        rows.clear();
        unsupported.clear();
        invalidated.clear();
        epochs.clear();
      }
      account = next;
      for (const ctx of contexts.values()) if (ctx.wire) ctx.wire.account = next;
      // A newly identified account must never reuse the previous account's warm/source state.
      if (previous) document.dispatchEvent?.(new CustomEvent('butter-layout-account-change'));
      prefetch(conv());
      if (!previous && next)
        document.dispatchEvent?.(new CustomEvent('butter-layout-account-ready'));
    });
    queueMicrotask(() => {
      document.dispatchEvent?.(
        new CustomEvent('butter-layout-request', { detail: JSON.stringify({ op: 'state' }) }),
      );
      document.dispatchEvent?.(new CustomEvent('butter-account-request'));
    });
    const persistence = {
      async setTexts(conv, texts) {
        const epoch = epochs.get(conv) || 0;
        const token = scope;
        if (diskEnabled && account && loadedConv !== conv) await prefetch(conv);
        if (invalidated.has(conv)) return;
        if (
          unsupported.has(conv) ||
          Object.values(texts).some((t) => /!\[|<img\b|<video\b/i.test(t.q + t.answer))
        ) {
          reject('unsupported-media-or-citations');
          for (const [id, ctx] of contexts) if (ctx.conv === conv) contexts.delete(id);
          return;
        }
        for (const [turn, t] of Object.entries(texts)) {
          const sig = await digest(JSON.stringify([t.q, t.answer, t.ids || [], t.msg]));
          if ((epochs.get(conv) || 0) !== epoch || token !== scope || invalidated.has(conv)) return;
          rows.set(turn, { ...t, parts: c.segments(t.answer) });
          const ctx = { conv, turn, msg: t.msg || '', digest: sig };
          ctx.wire = {
            account,
            conv: await hashed(conv),
            turn: await hashed(turn),
            msg: await hashed(ctx.msg),
            digest: sig,
          };
          if ((epochs.get(conv) || 0) !== epoch || token !== scope) return;
          contexts.set(turn, ctx);
        }
        const sc = scroller();
        if (sc) rememberLayout(layout(sc));
      },
      records(s) {
        const out = {},
          l = layout(s);
        if (!diskEnabled || !account) return out;
        rememberLayout(l);
        for (const [turn, ctx] of contexts) {
          if (!ctx.wire || ctx.wire.account !== account) continue;
          const wire = { ...ctx.wire, layout: layoutHashes.get(l) };
          const packed = memory.get(ButterLayoutCodec.key(wire));
          if (!packed) continue;
          const x = ButterLayoutCodec.unpack(packed);
          const why = c.acceptStored(x, wire);
          if (why) {
            reject(why);
            continue;
          }
          out[turn] = {
            ...c.hydrate(x, rows.get(turn).parts, rows.get(turn).q),
            ...ctx,
            layout: l,
            account,
            fromStorage: true,
          };
          S.hits++;
        }
        return out;
      },
      refreshLayout: (s) => rememberLayout(layout(s)),
      valid(turn, r, s) {
        const ctx = contexts.get(turn),
          l = cachedLayout(s);
        return !!(
          diskEnabled &&
          account &&
          r.account === account &&
          ctx &&
          l &&
          !c.acceptStored(r, { ...ctx, layout: l })
        );
      },
      record(turn, r, s, l) {
        const ctx = contexts.get(turn);
        s =
          s ||
          [...document.querySelectorAll('.thread-scroll-container')].find(
            (s) => s.clientHeight > 0,
          );
        if (!diskEnabled || !account || !ctx || ctx.conv !== conv() || !s) return;
        queuePending(turn, {
          r,
          ctx: { ...ctx, layout: l ?? layout(s) },
          account,
          scope,
          time: Date.now(),
        });
        if (!job) job = setTimeout(() => persistence.flush(), 1500);
      },
      async flush() {
        clearTimeout(job);
        job = 0;
        if (!diskEnabled || !account || globalThis.__butterSeeking?.()) return;
        const s = scroller();
        if (!s) return;
        const tokenBeforeLoad = scope;
        if (loadedConv !== conv() || generation === undefined) await prefetch(conv());
        if (tokenBeforeLoad !== scope) return;
        if (loadedConv !== conv() || generation === undefined) {
          if (pending.size && !job) job = setTimeout(() => persistence.flush(), 5000);
          return;
        }
        const batch = [...pending];
        pending.clear();
        const l = layout(s),
          token = scope,
          owner = account;
        const layoutHash = await hashed(l);
        layoutHashes.set(l, layoutHash);
        const writes = [];
        for (const [turn, queued] of batch) {
          const { r, ctx } = queued,
            current = contexts.get(turn),
            row = rows.get(turn);
          if (
            queued.scope !== scope ||
            queued.account !== account ||
            !current ||
            key(ctx) !== key({ ...current, layout: l }) ||
            ctx.msg !== r.msg ||
            !row
          )
            continue;
          const wire = { ...ctx.wire, layout: layoutHash };
          const x = ButterLayoutCodec.pack(c.geometryOnly(r, row.parts, wire, queued.time));
          const id = ButterLayoutCodec.key(x),
            old = memory.get(id);
          if (
            old &&
            JSON.stringify(old.metrics) === JSON.stringify(x.metrics) &&
            JSON.stringify(old.blocks) === JSON.stringify(x.blocks) &&
            JSON.stringify(old.items) === JSON.stringify(x.items) &&
            JSON.stringify(old.styles) === JSON.stringify(x.styles)
          )
            continue;
          if (!ButterLayoutCodec.valid(x)) continue;
          writes.push(x);
        }
        if (token !== scope || owner !== account || !diskEnabled || generation === undefined)
          return;
        if (writes.length) {
          const result = await send('put', {
            account,
            conv: await hashed(conv()),
            generation,
            records: writes,
          });
          if (token !== scope || owner !== account || !diskEnabled) return;
          if (result.error) {
            outcome = 'fail';
            S.errors++;
            if (token === scope && owner === account && diskEnabled) {
              for (const [turn, queued] of batch)
                if (!pending.has(turn)) queuePending(turn, queued);
              if (!job) job = setTimeout(() => persistence.flush(), 5000);
            }
          } else if (token === scope && owner === account && diskEnabled) {
            for (const x of writes) memory.set(ButterLayoutCodec.key(x), x);
            S.writes += writes.length;
            outcome = 'ok';
          }
        }
        S.bytes = [...memory.values()].reduce((n, x) => n + ButterLayoutCodec.bytes(x), 0);
      },
      invalidate(conv) {
        if (!conv) return;
        epochs.set(conv, (epochs.get(conv) || 0) + 1);
        invalidated.add(conv);
        for (const [id, ctx] of contexts)
          if (ctx.conv === conv) {
            contexts.delete(id);
            rows.delete(id);
            pending.delete(id);
          }
        for (const [id, e] of turns) if (e.conv === conv) turns.delete(id);
        reject('mutation-invalidated');
      },
      // Local retirement after a runtime clear; the popup owns the disk clear API.
      retire,
      dump: () => ({ ...S, entries: memory.size, pending: pending.size }),
    };

    return persistence;
  })();

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
    !complete(t) ||
    (!!t.querySelector('[data-user-message-bubble]') &&
      !t.querySelector('[data-markdown-text-style="assistant-message"]'));
  // ChatGPT's markdown renderer reveals a streamed answer gradually. Only while it does so does it
  // render the revealed prefix instead of the full text, and only then does its markdown root carry
  // .AdaptiveStreaming (hashed: AdaptiveStreaming-xxxxxx). The turn may already read complete, so a
  // snapshot then holds just the first paragraphs of the answer.
  const revealing = (t) => !!t.querySelector('[class*="AdaptiveStreaming"]');
  const mathReady = (t) =>
    [...t.querySelectorAll('[data-math-source]')].every((e) => e.querySelector('.katex'));
  const identity = (t) =>
    t.querySelector('[data-message-author-role="assistant"]')?.getAttribute('data-message-id') ||
    t
      .querySelector('[data-chatgpt-selection-message-id]')
      ?.getAttribute('data-chatgpt-selection-message-id');
  const offList = () =>
    (document.documentElement?.getAttribute?.('data-butter-off') || '').split(/\s+/);
  const disabled = () => !!document.documentElement?.hasAttribute?.('data-butter-disabled');
  const cvOff = () => disabled() || offList().includes('cv');
  // Records serve the seek preview, the layout store and remount restore (a cv feature).
  const needed = () => {
    const off = offList();
    return !disabled() && !(off.includes('seek') && off.includes('cv') && off.includes('layout'));
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

  // Lean text for the preview: TeX source for math, list bullets, no buttons/SVG. Capped.
  const CAP = 4000;
  const BLOCKY = /^(P|LI|H[1-6]|PRE|TR|BLOCKQUOTE|DIV|UL|OL|TABLE|THEAD|TBODY|SECTION|FIGURE)$/;
  function lean(el, blockHeight) {
    let out = '';
    const math = [];
    const walk = (n) => {
      if (out.length > CAP) return;
      if (n.nodeType === 3) {
        out += n.data;
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BUTTON' || tag === 'svg' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'IMG')
        return;
      const cls = n.classList;
      if (cls.contains('katex-display') || cls.contains('katex')) {
        const tex =
          n.querySelector('annotation')?.textContent ??
          n.closest('[data-math-source]')?.getAttribute('data-math-source') ??
          '';
        const display = cls.contains('katex-display');
        const start = out.length;
        out += tex;
        math.push({ start, end: out.length, display, h: display ? blockHeight : 0 });
        return;
      }
      if (tag === 'BR') {
        out += '\n';
        return;
      }
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
    return {
      text,
      math: math
        .map((m) => ({ ...m, start: m.start - trim, end: m.end - trim }))
        .filter((m) => m.start >= 0 && m.end <= text.length),
    };
  }
  // One computed-style read per distinct element class; reused by the preview as inline CSS.
  const styles = new Map();
  function styleKey(el) {
    const key = el.tagName + '.' + el.className;
    if (!styles.has(key)) {
      const c = getComputedStyle(el);
      styles.set(key, {
        id: styles.size,
        css: `font:${c.fontStyle} ${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.fontFamily};padding:${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft};border-radius:${c.borderRadius};background:${c.backgroundColor};color:${c.color};text-align:${c.textAlign}`,
      });
      while (styles.size > 200) styles.delete(styles.keys().next().value);
    }
    return styles.get(key).css;
  }

  const resetStyles = () => {
    styles.clear();
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
      S.lastZero = [...t.querySelectorAll(BLOCK)]
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
        els = [...t.querySelectorAll(BLOCK)];
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
          all: [...t.querySelectorAll(ITEMS)],
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
    if (!prev?.ready || prev.fromStorage || prev.conv !== c || verified.get(t) === prev)
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
  // Reads the next items of a job until the idle deadline. Returns true when the job is done.
  function step(j, left) {
    const { t, sc } = j;
    if (changes.get(t) !== j.changes || !t.isConnected || skipped.has(t)) return true; // re-queued, gone or skipped (stale: queued again on reveal)
    if (!needed()) return true; // seek, cv and layout turned off since begin()
    return timed(() => {
      const rr = t.parentElement.getBoundingClientRect(),
        sr = sc.getBoundingClientRect();
      do {
        for (const end = Math.min(j.all.length, j.items.length + SLICE); j.items.length < end; ) {
          const el = j.all[j.items.length];
          const r = box(el);
          let text = leanCache.get(el);
          if (text == null) {
            text = lean(el, r.height);
            leanCache.set(el, text);
          }
          j.items.push({
            top: r.top - rr.top,
            h: r.height,
            left: r.left - sr.left - sc.clientLeft,
            w: r.width,
            user: el.matches('[data-user-message-bubble]'),
            css: styleKey(el),
            text: text.text,
            math: text.math,
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
    const { entry, reason } = core.mergeRecord(
      prev?.conv === c ? prev : null,
      snap,
      performance.now(),
    );
    if (reason) reject(t, reason);
    else {
      outcomes.set(t, { reason: null });
      if (prev?.ready) S.refreshes++;
      S.records++;
      stale.delete(t);
      verified.set(t, entry);
      turns.delete(key);
      turns.set(key, entry);
      persistence.record(key, entry, sc, layout);
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
    for (const b of t.querySelectorAll(BLOCK)) register(b, t);
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
    for (const el of t.querySelectorAll(ITEMS)) leanCache.delete(el);
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
      for (const b of t.querySelectorAll(BLOCK)) register(b, t);
      for (const el of t.querySelectorAll(ITEMS)) leanCache.delete(el);
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
    attributeFilter: ['data-talvt-turn-state', 'data-math-source'],
  });

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
    const bs = t.querySelectorAll(BLOCK);
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
    if (S.hits.length < 200)
      S.hits.push({ t: performance.now(), key: t.dataset.turnKey, h: e.h, n });
  };
  const unrestore = (t) => {
    for (const el of [t, ...t.querySelectorAll(BLOCK)]) {
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
  globalThis.__butterLayoutCache = {
    ...persistence,
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
      // A press right after wheel scrolling: measure turns still waiting for the scroll to settle.
      measure();
      const stored = persistence.records(sc);
      scWidths.set(sc, sc.clientWidth);
      for (const [id, e] of Object.entries(stored)) if (!turns.has(id)) turns.set(id, e);
      const records = {};
      for (const id of ids) {
        const e = currentEntry(id, sc);
        if (e?.conv === conv()) records[id] = e;
      }
      return { records, storedTurns: Object.keys(stored).length };
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
