// Dev build only (the store package leaves extension/dev/ out). Pure bug-capture recorder: a
// 30 s event buffer, snapshot assembly and the privacy filter. No DOM or chrome.* use, so it runs
// in the MAIN world, the service worker and node --test alike.
(() => {
  // Caps measured in #44 (notes/diagnostics/README.md, "Bug files"): at most one seek event per
  // frame (120 a second at 120 Hz) plus about 4 other events a second, 185 bytes at most each.
  // The whole file stays under 1,572,840 bytes, the largest whose base64 data: URL fits Chrome's
  // 2 MiB URL constant, with room to spare.
  const WINDOW_MS = 30_000,
    MAX_EVENTS = 4_000,
    MAX_BYTES = 750_000,
    MAX_FILE_BYTES = 1_400_000,
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
    // event fields added by #44 (preview, commit, retarget, reveal, layout-cache events)
    'mode',
    'estimate',
    'from',
    'to',
    'error',
    'timedOut',
    'matched',
    'fallback',
    'retarget',
    'refresh',
    'approx',
    // turns: order, readiness (capture-record-readiness.js)
    'order',
    'readiness',
    'active',
    'math',
    'count',
    'rejectionDiagnosticsAvailable',
    'currentSw',
    'recorder',
    'observed',
    'generating',
    'queued',
    'measuring',
    'attempted',
    'lastRejection',
    'recordValidation',
    'rowHeightNow',
    'rowHeightDelta',
    // turns.active (capture-preview-record.js)
    'selection',
    'preview',
    'updateTurnIndex',
    'estimateVisible',
    'renderedItems',
    'memory',
    'source',
    'ready',
    'removed',
    'height',
    'rowHeight',
    'turnOffset',
    'turnHeight',
    'width',
    'viewportWidth',
    'scrollerWidth',
    'recordedAt',
    'measurementCount',
    'blockHeights',
    'kindInferred',
    'left',
    'textLength',
    'sourceBlockIndex',
    'start',
    'end',
    'display',
    'flags',
    'tallerThan300',
    'zeroTextLength',
    'textLengthUnavailable',
    'dom',
    'itemCount',
    'nodeCount',
    'truncated',
    'parent',
    'tag',
    'classes',
    'classCount',
    'dataAttributeNames',
    'contentVisibility',
    'collapsed',
    // turns.math (capture-math-pending.js)
    'formulas',
    'withoutKatex',
    'katexError',
    'mathmlOnly',
    'partsNoRoot',
    'rawText',
    'empty',
    'other',
    'missingInsideCvBlock',
    'displayMissing',
    // usage: saved layouts, the layout store bridge and the height cache's counters
    'saved',
    'store',
    'conversations',
    'bytes',
    'loads',
    'hits',
    'writes',
    'errors',
    'entries',
    'pending',
    'rejected',
    'records',
    'refreshes',
    'restored',
    'blocksRestored',
    'restoreMisses',
    'recordMs',
    'recordMax',
    'hooks',
    'parked',
    'released',
    'adopted',
    // a whole-file cap that left part of the snapshot out
    'eventsDropped',
    // a source that could not be read
    'unavailable',
  ]);
  const EVENT_TYPES = new Set([
    'press',
    'seek',
    'release',
    'activation-reject',
    'preview',
    'preview-miss',
    'commit',
    'retarget',
    'reveal',
    'record',
    'rejection',
    'restore',
  ]);
  // HTML, SVG and MathML tag names a turn's structure may hold; any other tag is reported as
  // 'other' by dev/sources.js and dropped here if it gets through.
  const TAGS = [
    ...['div', 'span', 'p', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
    ...['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'br', 'blockquote', 'a'],
    ...['strong', 'em', 'b', 'i', 'u', 's', 'del', 'sup', 'sub', 'img', 'button', 'section'],
    ...['article', 'figure', 'figcaption', 'details', 'summary', 'label', 'input', 'svg', 'g'],
    ...['path', 'use', 'rect', 'circle', 'line', 'polyline', 'math', 'semantics', 'annotation'],
    ...['mrow', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mspace', 'mfrac', 'msqrt', 'mroot', 'msub'],
    ...['msup', 'msubsup', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd', 'mstyle'],
    ...['mpadded', 'mphantom'],
  ];
  // ChatGPT class and data-attribute names worth keeping in a structure (names only, no values).
  const CLASSES = [
    ...['markdown', 'prose', 'katex', 'katex-display', 'katex-error', 'katex-html'],
    ...['katex-mathml', 'adaptive-streaming', 'it', 'math', 'display'],
  ];
  const DATA_ATTRIBUTES = [
    ...['data-turn-key', 'data-turn', 'data-testid', 'data-message-author-role'],
    ...['data-message-id', 'data-message-model-slug', 'data-start', 'data-end'],
    ...['data-math-source', 'data-user-message-bubble', 'data-markdown-text-style'],
    ...['data-talvt-turn-state', 'data-butter-seen', 'data-butter-unrendered'],
    ...['data-chatgpt-selection-message-id', 'data-is-last-node', 'data-is-only-node'],
    ...['data-scroll-anchor', 'data-state'],
  ];
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
    // core.createActivation rejections ('wheel' and 'key' among them)
    'not-held',
    'key',
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
    // press decision phases ('press' is above) and layout reasons
    'release-retarget',
    'ids-from-fallback',
    'no-record',
    'no-items',
    'sw-mismatch',
    'no-measured',
    'height-mismatch',
    'conv-mismatch',
    // preview modes and misses
    'layout',
    'estimate',
    'unseen',
    'text-fallback',
    // retarget kinds
    'drift',
    'semantic',
    'question',
    'history-block',
    // core.validateSnapshot reasons, and the cache's 'estimated'
    'missing',
    'incomplete',
    'revealing',
    'math-pending',
    'skipped',
    'placeholder',
    'zero-turn',
    'no-blocks',
    'zero-block',
    'bad-item',
    'math-height',
    'estimated',
    // core.canRestore misses
    'no-entry',
    'not-removed',
    'conv',
    'width',
    'identity',
    'block-count',
    // layout store rejections (layout-check-main.js acceptStored, layout-cache-main.js)
    'schema',
    'turn',
    'msg',
    'digest',
    'expired',
    'geometry',
    'unsupported-media-or-citations',
    'mutation-invalidated',
    // readiness snippet layout reasons, and turn order without the virtualizer
    'width-mismatch',
    'unmeasured-row',
    'row-height-mismatch',
    'ids-from-dom',
    // turns.active selection and record sources
    'active-preview-update',
    'last-seek-update',
    'none',
    'measured',
    'restored',
    // inferred item kinds
    'user',
    'display-math',
    'heading',
    'paragraph',
    'list',
    'separator',
    'block',
    // structure: tags, computed content-visibility, known classes and data-attribute names
    ...TAGS,
    'other',
    'visible',
    'auto',
    ...CLASSES,
    ...DATA_ATTRIBUTES,
    // settings
    'en',
    'zh',
    'pending',
    'granted',
    'declined',
    // unavailable sources
    'error',
    'redacted',
    'no-scroller',
    'too-large',
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
  // Top-level fields whose parts are read, filtered and capped one by one.
  const GROUPS = new Set(['turns', 'usage']);

  const VERSION = /^\d+\.\d+\.\d+(?:-alpha(?:\.\d+)?)?(?:\+[a-z0-9-]+\.\d+)?$/,
    TRIGGERS = new Set(['shortcut', 'button']);

  // Local time, as the user sees it in notes and screen recordings: bug-04_21-14-03.json.
  const two = (n) => String(n).padStart(2, '0');
  const fileName = (bug, date) =>
    `bug-${two(bug)}_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}.json`;
  // Relative to the Downloads folder.
  const downloadPath = (round, bug, date) => `butter-diag/round-${round}/${fileName(bug, date)}`;

  // Two-space JSON in which a list of objects (events, readiness rows, structure nodes) has one
  // object per line, so an agent can read the file as it is.
  const plain = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const format = (value, indent) => {
    const inner = indent + '  ';
    if (Array.isArray(value) && value.length && value.every(plain))
      return `[\n${value.map((v) => inner + JSON.stringify(v)).join(',\n')}\n${indent}]`;
    if (plain(value) && Object.values(value).some((v) => v && typeof v === 'object')) {
      const fields = Object.entries(value).map(
        ([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`,
      );
      return `{\n${fields.join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(value);
  };
  const serialize = (snapshot) => {
    const fields = Object.entries(snapshot).map(
      ([key, value]) => `  ${JSON.stringify(key)}: ${format(value, '  ')}`,
    );
    return `{\n${fields.join(',\n')}\n}\n`;
  };

  // A snapshot's `t` is relative and rounded; this bounds its `"t":-30000.0,` in the byte count.
  const T_BYTES = 16;

  // Keeps the serialized file within maxFileBytes. A source part (or a whole top-level source)
  // larger than what is left without events becomes {unavailable: 'too-large'}, largest first;
  // then the oldest events are dropped, counted in eventsDropped.
  function fit(snapshot, maxFileBytes) {
    const size = (s) => serialize(s).length;
    if (size(snapshot) <= maxFileBytes) return snapshot;
    const { events, redacted, ...rest } = snapshot;
    const out = { ...rest, events: [], eventsDropped: events.length, redacted };
    const fixed = new Set(['kind', 'formatVersion', 'bug', 'round', 'savedAt', 'version']),
      parts = [];
    for (const [name, value] of Object.entries(rest)) {
      if (fixed.has(name)) continue;
      if (GROUPS.has(name) && value && typeof value === 'object' && !('unavailable' in value)) {
        out[name] = { ...value }; // copied, so the input snapshot is left as it was
        for (const part of Object.keys(value)) parts.push([out[name], part]);
      } else parts.push([out, name]);
    }
    parts.sort(([a, x], [b, y]) => JSON.stringify(b[y]).length - JSON.stringify(a[x]).length);
    for (const [owner, key] of parts) {
      if (size(out) <= maxFileBytes) break;
      owner[key] = { unavailable: 'too-large' };
    }
    // Keep the newest events that still fit: binary search on how many.
    let lo = 0,
      hi = events.length;
    const keep = (n) => {
      out.events = events.slice(events.length - n);
      out.eventsDropped = events.length - n;
    };
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      keep(mid);
      if (size(out) <= maxFileBytes) lo = mid;
      else hi = mid - 1;
    }
    keep(lo);
    return out;
  }

  function createRecorder({
    windowMs = WINDOW_MS,
    maxEvents = MAX_EVENTS,
    maxBytes = MAX_BYTES,
    maxFileBytes = MAX_FILE_BYTES,
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
        const read = (source) => {
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
        // A group (turns, usage) is a plain object of sources, each read on its own.
        const readNamed = (name) => {
          const source = sources[name];
          if (!GROUPS.has(name) || !source || typeof source !== 'object') return read(source);
          const out = {};
          for (const [part, value] of Object.entries(source)) {
            if (!KEYS.has(part)) {
              redacted++;
              continue;
            }
            out[part] = read(value);
          }
          return out;
        };
        const out = {
          kind: 'butter-diag',
          formatVersion: FORMAT_VERSION,
          bug,
          round,
          savedAt: date.toISOString(),
          version: VERSION.test(version) ? version : (redacted++, null),
          trigger: TRIGGERS.has(trigger) ? trigger : (redacted++, null),
          pointerHeld: readNamed('pointerHeld'),
          settings: readNamed('settings'),
          events: entries.map(({ t, event }) => ({ t: Math.round(t - now), ...event })),
        };
        for (const name of Object.keys(sources)) if (!(name in out)) out[name] = readNamed(name);
        out.redacted = redacted;
        return fit(out, maxFileBytes);
      },
    };
  }

  globalThis.ButterDevRecorder = {
    createRecorder,
    fileName,
    downloadPath,
    serialize,
    names: { TAGS, CLASSES, DATA_ATTRIBUTES },
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterDevRecorder;
})();
