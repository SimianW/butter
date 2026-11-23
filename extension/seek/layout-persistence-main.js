// MAIN world: stored layout records, the layout store side of seek/layout-cache-main.js. It loads
// the conversation's stored records through the butter-layout-request/-response bridge
// (storage/layout-bridge.js to storage/layout-worker.js), matches them to their source by hashed
// identity and the fingerprint, queues and writes new records, and drops them on a page write
// (butter-seek-write), on unsupported media (butter-seek-data), on an account change or a clear.
// Classic script, loaded after seek/layout-codec.js and before seek/layout-cache-main.js, which
// calls the factory once; its listeners and observers register at that call.
globalThis.__butterLayoutPersistence = ({ turns, conv, scroller, shownColumn }) => {
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
    if (!previous && next) document.dispatchEvent?.(new CustomEvent('butter-layout-account-ready'));
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
        [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
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
      if (token !== scope || owner !== account || !diskEnabled || generation === undefined) return;
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
            for (const [turn, queued] of batch) if (!pending.has(turn)) queuePending(turn, queued);
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
};
