// Dev build only (the store package leaves extension/dev/ out). Pure bug-capture recorder: a
// 30 s event buffer, snapshot assembly and the privacy filter. No DOM or chrome.* use, so it runs
// in the MAIN world, the service worker and node --test alike.
(() => {
  const WINDOW_MS = 30_000,
    // Suggested starting caps (#32); the full-snapshot ticket measures the real numbers.
    MAX_EVENTS = 2_000,
    MAX_BYTES = 1_000_000,
    FORMAT_VERSION = 1;

  // ---- privacy filter: an allowlist of keys and of string values ----
  // Keys from the event fields below, settings (shared/status.js), session failures, and the
  // press-decision summary in seek/preview-main.js (and its cache decisions).
  const KEYS = new Set([
    // event fields (the event's own type is not a field)
    'kind',
    'reason',
    'onScroller',
    'x',
    'w',
    'ow',
    'scrollTop',
    'sequence',
    'prepMs',
    'layoutTurns',
    'top',
    'turn',
    'offset',
    'known',
    'renderMs',
    'jsMs',
    'textFallback',
    'commit',
    'durationMs',
    // settings and failures
    'enabled',
    'opts',
    'container',
    'cv',
    'throttle',
    'older',
    'rail',
    'seek',
    'layout',
    'branch',
    'lang',
    'layoutConsent',
    'streaming',
    'scrolling',
    // press decision
    'schema',
    'phase',
    'fiberFound',
    'idsFromFallback',
    'idsReason',
    'modelLength',
    'scroller',
    'matchesThreadScroller',
    'threadScrollerCount',
    'threadScrollerSw',
    'swBefore',
    'sw',
    'clientHeight',
    'scrollHeight',
    'recordCount',
    'storedTurns',
    'mountedTurns',
    'turns',
    'index',
    'mounted',
    'rowHeightAtPrepare',
    'measuredHeight',
    'rowH',
    'recordSw',
    'items',
    'blocks',
    'fromStorage',
    'modelTop',
    'modelHeight',
    'layoutReason',
    'cache',
    'before',
    'after',
    'hasRecord',
    'convMatches',
    'recordChanged',
    'storedAvailable',
    'retiredStored',
    'render',
    'prepareSequence',
    'turnIndex',
    'unseen',
    'insetTop',
    'previewTop',
    'releasePrepare',
    // a source that could not be read
    'unavailable',
  ]);
  const EVENT_TYPES = new Set(['press', 'seek', 'release']);
  // The closed list of strings a value may hold. Everything else is dropped.
  const CODES = new Set([
    ...EVENT_TYPES,
    // press kinds and core.classifyPress rejections
    'classic',
    'overlay',
    'untrusted',
    'button',
    'pointer-type',
    'target',
    'not-scrollable',
    'classic-off-bar',
    'classic-track',
    'overlay-off-band',
    // release reasons (preview-main.js finish())
    'pointerup',
    'mouseup',
    'wheel',
    'lost-up',
    'pointercancel',
    'blur',
    'hidden',
    'resize',
    'timeout',
    'navigation',
    'chat-switch',
    'disabled',
    'activation-failure',
    'data-invalidation',
    'send-invalidation',
    'account-invalidation',
    'mutation-invalidation',
    // press decision phases ('press' is above)
    'release-retarget',
    'ids-from-fallback',
    'no-record',
    'no-items',
    'sw-mismatch',
    'no-measured',
    'height-mismatch',
    'conv-mismatch',
    // settings
    'en',
    'zh',
    'pending',
    'granted',
    'declined',
    // unavailable sources
    'missing',
    'error',
    'redacted',
  ]);

  // Returns [filtered value, number of dropped values]; `undefined` means drop this value.
  function clean(value) {
    if (value === null || typeof value === 'boolean') return [value, 0];
    if (typeof value === 'number') return [Number.isFinite(value) ? value : null, 0];
    if (typeof value === 'string') return CODES.has(value) ? [value, 0] : [undefined, 1];
    if (Array.isArray(value)) {
      let dropped = 0;
      const out = [];
      for (const item of value) {
        const [kept, n] = clean(item);
        dropped += n;
        if (kept !== undefined) out.push(kept);
      }
      return [out, dropped];
    }
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      let dropped = 0;
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        if (!KEYS.has(key)) {
          dropped++;
          continue;
        }
        const [kept, n] = clean(item);
        dropped += n;
        if (kept !== undefined) out[key] = kept;
      }
      return [out, dropped];
    }
    return [undefined, 1];
  }

  // The manifest's version_name, optionally with a +<tag>.<N> build tag.
  const VERSION = /^\d+\.\d+\.\d+(?:-alpha(?:\.\d+)?)?(?:\+[a-z0-9-]+\.\d+)?$/,
    TRIGGERS = new Set(['shortcut', 'button']);

  // Local time, as the user sees it in notes and screen recordings: bug-04_21-14-03.json.
  const two = (n) => String(n).padStart(2, '0');
  const fileName = (bug, date) =>
    `bug-${two(bug)}_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}.json`;
  // Relative to the Downloads folder.
  const downloadPath = (round, bug, date) => `butter-diag/round-${round}/${fileName(bug, date)}`;

  // Two-space JSON with one event per line, so an agent can read the file as it is.
  const serialize = (snapshot) => {
    const fields = Object.entries(snapshot).map(([key, value]) => {
      const name = `  ${JSON.stringify(key)}: `;
      if (key !== 'events' || !Array.isArray(value) || !value.length)
        return name + JSON.stringify(value);
      return `${name}[\n${value.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`;
    });
    return `{\n${fields.join(',\n')}\n}\n`;
  };

  // A snapshot's `t` is relative and rounded; this bounds its `"t":-30000.0,` in the byte count.
  const T_BYTES = 16;

  function createRecorder({
    windowMs = WINDOW_MS,
    maxEvents = MAX_EVENTS,
    maxBytes = MAX_BYTES,
  } = {}) {
    // Each entry: { t, event, bytes, redacted }, filtered when recorded. Oldest first.
    const entries = [];
    let bytes = 2, // "[]"
      lost = 0; // events of an unknown type, never stored
    const drop = () => (bytes -= entries.shift().bytes);
    const prune = (now) => {
      while (entries.length && now - entries[0].t > windowMs) drop();
    };
    return {
      record(type, fields, t) {
        if (!EVENT_TYPES.has(type)) {
          lost++;
          return;
        }
        const [kept, redacted] = clean(fields ?? {});
        const event = { type, ...kept };
        const size = JSON.stringify(event).length + T_BYTES;
        entries.push({ t, event, bytes: size, redacted });
        bytes += size;
        while (entries.length > maxEvents || (bytes > maxBytes && entries.length)) drop();
        prune(t);
      },
      snapshot({ now, date, bug, round, version, trigger, sources = {} }) {
        prune(now);
        let redacted = lost;
        for (const entry of entries) redacted += entry.redacted;
        // Each source is read and filtered on its own, so one failure loses only that source.
        const read = (name) => {
          const source = sources[name];
          if (source === undefined) return { unavailable: 'missing' };
          let value;
          try {
            value = typeof source === 'function' ? source() : source;
          } catch {
            return { unavailable: 'error' };
          }
          const [kept, dropped] = clean(value);
          redacted += dropped;
          return kept === undefined ? { unavailable: 'redacted' } : kept;
        };
        const out = {
          kind: 'butter-diag',
          formatVersion: FORMAT_VERSION,
          bug,
          round,
          savedAt: date.toISOString(),
          version: VERSION.test(version) ? version : (redacted++, null),
          trigger: TRIGGERS.has(trigger) ? trigger : (redacted++, null),
          pointerHeld: read('pointerHeld'),
          settings: read('settings'),
          events: entries.map(({ t, event }) => ({ t: Math.round(t - now), ...event })),
        };
        for (const name of Object.keys(sources)) if (!(name in out)) out[name] = read(name);
        out.redacted = redacted;
        return out;
      },
    };
  }

  globalThis.ButterDevRecorder = { createRecorder, fileName, downloadPath, serialize };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterDevRecorder;
})();
