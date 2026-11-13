// Dev build only. MAIN world, after seek/preview-main.js, dev/recorder.js and dev/sources.js:
// records the seek and layout-cache hooks' summaries and the rail trace's events
// (dev/rail-trace.js) for 30 s, and builds a snapshot when dev/content.js asks. Reads only Butter's own diagnostics and the page structure the
// diagnostics snippets read; no page text, no requests.
(() => {
  const dump = globalThis.__seekDump,
    cache = globalThis.__butterLayoutCache;
  const recorder = ButterDevRecorder.createRecorder();

  // Which conversation the page is on, as a per-page ordinal (0 for the one it loaded on). The
  // seek code's own detector (__seekDump.conv) says which; its ID is compared here and never
  // stored. A switch is recorded as a `conversation` event, before any event from the new one.
  let convId = null,
    conversation = 0;
  const readConv = () => {
    try {
      return dump?.conv ?? null;
    } catch {
      return null;
    }
  };
  convId = readConv();
  const currentConversation = () => {
    const id = readConv();
    if (id !== convId) {
      convId = id;
      conversation++;
      recorder.record('conversation', { conversation }, performance.now());
    }
    return conversation;
  };
  // ChatGPT switches chats without a page load; the seek code polls for that as well.
  setInterval(currentConversation, 250);

  // The last seek update, for the active turn (capture-preview-record.js uses __seekDump's), and
  // the conversation of the last qualifying press. Neither is used once the conversation changes.
  let lastSeek = null,
    lastPress = null;

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
    const c = currentConversation();
    if (type === 'seek') lastSeek = { fields: { ...fields }, conversation: c };
    if (type === 'press' && Number.isInteger(fields?.sequence))
      lastPress = { sequence: fields.sequence, conversation: c };
    const t = performance.now();
    recorder.record(type, key === undefined ? fields : { ...fields, turn: turnIndex(key) }, t);
  };
  if (dump) dump.tap = listen;
  if (cache) cache.tap = listen;
  // The rail trace's events, from the isolated world (dev/rail-trace.js).
  document.addEventListener('butter-dev-rail', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (typeof m?.type === 'string') listen(m.type, m.fields);
  });

  // The snapshot's `rail` part: the rail trace answers inside this dispatch, once per snapshot
  // (read on its first part). The questions' ids are compared with ChatGPT's turn order here and
  // never stored: `order.missing` lists the rail questions the order lacks, by rail index.
  const railPart = () => {
    let reply = null;
    const ask = () => {
      if (reply) return reply;
      let detail = null;
      const receive = (e) => {
        if (typeof e.detail === 'string') detail = e.detail;
      };
      document.addEventListener('butter-dev-rail-snapshot-response', receive);
      document.dispatchEvent(new CustomEvent('butter-dev-rail-snapshot-request'));
      document.removeEventListener('butter-dev-rail-snapshot-response', receive);
      try {
        reply = detail === null ? { unavailable: 'missing' } : JSON.parse(detail);
      } catch {
        reply = { unavailable: 'error' };
      }
      return reply;
    };
    const part = (fn) => () => {
      const r = ask();
      return r.unavailable ? { unavailable: r.unavailable } : fn(r);
    };
    return {
      order: part(({ ids }) => {
        const sc = ButterDevSources.scrollerOf(document);
        if (!sc) return { unavailable: 'no-scroller' };
        const order = ButterDevSources.turnOrder(sc),
          known = new Set(order.ids);
        return {
          questions: ids.length,
          count: order.ids.length,
          fiberFound: order.fiberFound,
          missing: ids.flatMap((id, i) => (known.has(id) ? [] : [i])),
        };
      }),
      state: part((r) => r.state),
      ticks: part((r) => r.ticks),
    };
  };

  document.addEventListener('butter-dev-snapshot-request', (e) => {
    let request;
    try {
      request = JSON.parse(e.detail);
    } catch {
      return;
    }
    const current = currentConversation();
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
        lastSeek: lastSeek?.conversation === current ? lastSeek.fields : null,
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
        pressDecision: () => {
          const decision = dump.pressDecision;
          return decision &&
            decision.sequence === lastPress?.sequence &&
            lastPress.conversation !== current
            ? { unavailable: 'conversation-changed' }
            : decision;
        },
        turns: page.turns,
        rail: railPart(),
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
