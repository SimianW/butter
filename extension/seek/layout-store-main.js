// Persistent geometry in site-origin IndexedDB. Never serializes preview/source text.
(() => {
  if (!globalThis.__butterLayoutOptions?.storage) return;
  const unsupported = new Set(),
    invalidated = new Set(),
    epochs = new Map();
  document.addEventListener('butter-seek-write', (e) =>
    api.invalidate(e.detail.conv || location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1]),
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
  let db,
    job = 0;
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
  const opened = new Promise((resolve) => {
    const r = indexedDB.open('butter-seek-cold-geometry-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('geometry', { keyPath: 'key' });
    r.onerror = () => {
      S.errors++;
      resolve(null);
    };
    r.onsuccess = () => {
      db = r.result;
      const q = db.transaction('geometry').objectStore('geometry').getAll();
      q.onsuccess = () => {
        for (const x of q.result) {
          memory.set(x.key, x);
          S.bytes += JSON.stringify(x).length;
        }
        S.ready = true;
        resolve(db);
      };
      q.onerror = () => {
        S.errors++;
        resolve(db);
      };
    };
  });
  const api = (globalThis.__butterLayoutStore = {
    async setTexts(conv, texts) {
      const generation = epochs.get(conv) || 0;
      await opened;
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
        if ((epochs.get(conv) || 0) !== generation || invalidated.has(conv)) return;
        rows.set(turn, { ...t, parts: c.segments(t.answer) });
        contexts.set(turn, { conv, turn, msg: t.msg || '', digest: sig });
      }
      S.loads++;
    },
    records(s) {
      const out = {},
        l = layout(s);
      for (const [turn, ctx] of contexts) {
        const x = memory.get(key({ ...ctx, layout: l }));
        if (!x) continue;
        const why = c.acceptStored(x, { ...ctx, layout: l });
        if (why) {
          reject(why);
          continue;
        }
        out[turn] = c.hydrate(x, rows.get(turn).parts, rows.get(turn).q);
        S.hits++;
      }
      return out;
    },
    refreshLayout: layout,
    valid(turn, r, s) {
      const ctx = contexts.get(turn),
        l = cachedLayout(s);
      return !!(ctx && l && !c.acceptStored(r, { ...ctx, layout: l }));
    },
    record(turn, r, s, l) {
      const ctx = contexts.get(turn);
      s =
        s ||
        [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
      if (!ctx || !s) return;
      pending.set(turn, { r, ctx: { ...ctx, layout: l ?? layout(s) } });
      if (!job) job = setTimeout(() => api.flush(), 1500);
    },
    async flush() {
      clearTimeout(job);
      job = 0;
      await opened;
      if (!db || globalThis.__butterSeeking?.()) return;
      const s = [...document.querySelectorAll('.thread-scroll-container')].find(
        (s) => s.clientHeight > 0,
      );
      if (!s) return;
      const batch = [...pending];
      pending.clear();
      const l = layout(s);
      for (const [turn, { r, ctx }] of batch) {
        const current = contexts.get(turn),
          row = rows.get(turn);
        if (!current || key(ctx) !== key({ ...current, layout: l }) || ctx.msg !== r.msg || !row)
          continue;
        const x = c.geometryOnly(r, row.parts, ctx);
        x.key = key(x);
        // Avoid rewriting unchanged geometry for repeated ResizeObserver notifications.
        const old = memory.get(x.key);
        if (old && old.rowH === x.rowH && JSON.stringify(old.blocks) === JSON.stringify(x.blocks))
          continue;
        memory.set(x.key, x);
        const t = db.transaction('geometry', 'readwrite');
        t.objectStore('geometry').put(x);
        await new Promise((ok, no) => {
          t.oncomplete = ok;
          t.onerror = () => {
            S.errors++;
            ok();
          };
        });
        S.writes++;
      }
      // Bounded global cache (64 rows); prune stale identities and old layouts by recency.
      const all = [...memory.values()].sort((a, b) => b.time - a.time);
      for (const x of all.slice(64)) {
        memory.delete(x.key);
        db.transaction('geometry', 'readwrite').objectStore('geometry').delete(x.key);
      }
      S.bytes = [...memory.values()].reduce(
        (a, x) => a + new TextEncoder().encode(JSON.stringify(x)).length,
        0,
      );
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
      globalThis.__butterHeightCache?.invalidate?.(conv);
      reject('mutation-invalidated');
    },
    async clear() {
      clearTimeout(job);
      job = 0;
      pending.clear();
      await opened;
      memory.clear();
      if (db) {
        const t = db.transaction('geometry', 'readwrite');
        t.objectStore('geometry').clear();
        await new Promise((ok) => (t.oncomplete = ok));
      }
      S.bytes = 0;
    },
    dump: () => ({ ...S, entries: memory.size, pending: pending.size }),
  });
})();
