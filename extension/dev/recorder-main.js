// Dev build only. MAIN world, after seek/preview-main.js, dev/recorder.js and dev/sources.js:
// records the seek and layout-cache hooks' summaries for 30 s, and builds a snapshot when
// dev/content.js asks. Reads only Butter's own diagnostics and the page structure the
// diagnostics snippets read; no page text, no requests.
(() => {
  const dump = globalThis.__seekDump,
    cache = globalThis.__butterLayoutCache;
  const recorder = ButterDevRecorder.createRecorder();
  // The last seek update, for the active turn (capture-preview-record.js uses __seekDump's).
  let lastSeek = null;

  // Layout-cache hooks name a turn by its key; the file has its index in the turn order instead.
  // The order is looked up again when a key is missing from it, at most once a second.
  let order = new Map(),
    orderAt = -Infinity;
  const turnIndex = (key) => {
    if (typeof key !== 'string') return null;
    if (!order.has(key) && performance.now() - orderAt > 1000) {
      orderAt = performance.now();
      const sc = document
        .querySelector(`[data-turn-key="${CSS.escape(key)}"]`)
        ?.closest('.thread-scroll-container');
      if (sc) order = new Map(ButterDevSources.turnOrder(sc).ids.map((id, i) => [id, i]));
    }
    return order.get(key) ?? null;
  };

  const listen = (type, fields, key) => {
    if (type === 'seek') lastSeek = { ...fields };
    const t = performance.now();
    recorder.record(type, key === undefined ? fields : { ...fields, turn: turnIndex(key) }, t);
  };
  if (dump) dump.tap = listen;
  if (cache) cache.tap = listen;

  document.addEventListener('butter-dev-snapshot-request', (e) => {
    let request;
    try {
      request = JSON.parse(e.detail);
    } catch {
      return;
    }
    const now = performance.now(),
      date = new Date();
    // Butter's memory is copied here, before any of the DOM reads the snapshot runs below.
    let page;
    try {
      page = ButterDevSources.collect({
        document,
        getComputedStyle,
        now,
        cache,
        core: globalThis.__butterSeekCore,
        heightCache: globalThis.__heightCacheDump,
        seeking: globalThis.__butterSeeking,
        lastSeek,
        previewRoot: () => document.querySelector('butter-seek-preview')?.shadowRoot,
      });
    } catch {
      page = { turns: { unavailable: 'error' }, usage: {} };
    }
    const snapshot = recorder.snapshot({
      now,
      date,
      bug: request.bug,
      round: request.round,
      version: request.version,
      trigger: request.trigger,
      sources: {
        pointerHeld: () => dump.held,
        settings: () => request.settings,
        pressDecision: () => dump.pressDecision,
        turns: page.turns,
        failures: () => request.failures,
        usage: { saved: () => request.usage, ...page.usage },
      },
    });
    document.dispatchEvent(
      new CustomEvent('butter-dev-snapshot-response', {
        detail: ButterDevRecorder.serialize(snapshot),
      }),
    );
  });
})();
