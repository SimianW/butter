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
    hits: [],
  };
  const turns = new Map(); // turnKey -> entry (see core.mergeRecord)
  const live = new Set(),
    meta = new WeakMap(),
    skipped = new WeakSet(),
    contentH = new WeakMap(),
    leanCache = new WeakMap();
  const BLOCK = '[data-markdown-text-style="assistant-message"] > :not([data-wide-block]):not(hr)';
  const ITEMS = '[data-user-message-bubble], [data-markdown-text-style="assistant-message"] > *';
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] || null;
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
      for (const e of es) layouts.delete(owners.get(e.target) || e.target);
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
        column = s.querySelector('[data-markdown-text-style="assistant-message"]');
      const width = column?.getBoundingClientRect?.().width;
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
      layouts.set(s, { value, stamp: stamp() });
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
  const mathReady = (t) =>
    [...t.querySelectorAll('[data-math-source]')].every((e) => e.querySelector('.katex'));
  const identity = (t) =>
    t.querySelector('[data-message-author-role="assistant"]')?.getAttribute('data-message-id') ||
    t
      .querySelector('[data-chatgpt-selection-message-id]')
      ?.getAttribute('data-chatgpt-selection-message-id');
  document.addEventListener(
    'contentvisibilityautostatechange',
    (e) => {
      if (e.skipped) skipped.add(e.target);
      else {
        skipped.delete(e.target);
        const t = e.target.closest?.('[data-turn-key]');
        if (t && meta.has(t)) queue(t);
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
  const pending = new Set();
  let idle = 0;
  const queue = (t) => {
    pending.add(t);
    if (!idle) idle = requestAnimationFrame(flush);
  };
  function flush() {
    idle = 0;
    if (globalThis.__butterSeeking?.()) {
      idle = requestAnimationFrame(flush);
      return;
    }
    const sc = scroller();
    const batch = [...pending];
    pending.clear();
    const layout = batch.length && document.documentElement ? persistence.refreshLayout(sc) : null;
    for (const t of batch) record(t, sc, layout);
  }
  function record(t, sc, layout) {
    if (
      document.documentElement?.hasAttribute('data-butter-disabled') ||
      !t.isConnected ||
      !sc ||
      !sc.contains(t)
    )
      return;
    const key = t.dataset.turnKey,
      c = conv();
    const t0 = performance.now();
    const isComplete = complete(t),
      ready = isComplete && mathReady(t),
      isSkipped = skipped.has(t);
    let snap = { conv: c, complete: isComplete, mathReady: ready, skipped: isSkipped };
    if (isComplete && ready && !isSkipped) {
      const row = t.parentElement,
        rr = row.getBoundingClientRect(),
        tr = t.getBoundingClientRect(),
        sr = sc.getBoundingClientRect();
      // Register blocks that appeared after the turn was first seen; a
      // block without an observed size makes this snapshot non-authoritative (RO re-queues the turn).
      const els = [...t.querySelectorAll(BLOCK)];
      for (const b of els) register(b, t);
      const blocks = els.map((b) => contentH.get(b) ?? 0);
      const items = [...t.querySelectorAll(ITEMS)].map((el) => {
        const r = el.getBoundingClientRect();
        let text = leanCache.get(el);
        if (text == null) {
          text = lean(el, r.height);
          leanCache.set(el, text);
        }
        return {
          top: r.top - rr.top,
          h: r.height,
          left: r.left - sr.left - sc.clientLeft,
          w: r.width,
          user: el.matches('[data-user-message-bubble]'),
          css: styleKey(el),
          text: text.text,
          math: text.math,
        };
      });
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
        blocks,
        items,
      };
    }
    if (snap.sw != null) scWidths.set(sc, snap.sw);
    const prev = turns.get(key);
    const { entry, changed, reason } = core.mergeRecord(
      prev?.conv === c ? prev : null,
      snap,
      performance.now(),
    );
    if (reason) {
      S.rejected[reason] = (S.rejected[reason] || 0) + 1;
      if (reason === 'zero-block')
        S.lastZero = [...t.querySelectorAll(BLOCK)]
          .filter((b) => !(contentH.get(b) > 0))
          .slice(0, 8)
          .map((b) => ({ tag: b.tagName, observed: contentH.get(b) ?? null }));
    } else {
      if (prev?.ready) S.refreshes++;
      S.records++;
      turns.delete(key);
      turns.set(key, entry);
      persistence.record(key, entry, sc, layout);
    }
    while (turns.size > 64) turns.delete(turns.keys().next().value);
    const ms = performance.now() - t0;
    S.recordMs += ms;
    S.recordMax = Math.max(S.recordMax, ms);
    void changed;
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
  const watch = (t) => {
    if (meta.has(t) || !t.dataset.turnKey) return;
    live.add(t);
    meta.set(t, { turn: t, blocks: new Set() });
    ro.observe(t);
    for (const b of t.querySelectorAll(BLOCK)) register(b, t);
    S.observed++;
    queue(t);
  };
  new MutationObserver((rs) => {
    let removed = false;
    const dirty = new Set();
    for (const r of rs) {
      if (r.removedNodes?.length) removed = true;
      const parent = (r.target.nodeType === 1 ? r.target : r.target.parentElement)?.closest?.(
        '[data-turn-key]',
      );
      if (parent) dirty.add(parent);
      for (const n of r.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (n.hasAttribute('data-turn-key')) watch(n);
        else if (n.firstElementChild) n.querySelectorAll('[data-turn-key]').forEach(watch);
      }
    }
    for (const t of dirty) {
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
  const restore = (t) => {
    if (document.documentElement?.hasAttribute('data-butter-disabled')) return;
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
  const applied = new WeakSet();
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
              if (!applied.has(t)) {
                restore(t);
              }
        }
        return Reflect.apply(d.get, this, []);
      },
    });

  // Read API for seek/preview-main.js (same world). Records carry chat text: never dump them.
  globalThis.__butterLayoutCache = {
    ...persistence,
    flush: () => persistence.flush(),
    flushMeasurements: flush,
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
