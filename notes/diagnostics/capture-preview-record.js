// Paste this whole file in the affected ChatGPT tab's DevTools Console, context: top.
// Optional: replace null below with the ZERO-BASED question/turn index (rail number minus 1).
// If no preview is active, this arms a capture: drag to the bug and hold still for 1 second.
// Retain the DevTools helper across timers/awaits; its temporary global binding disappears.
((copy) => {
  const TURN_INDEX = null;
  const cache = globalThis.__butterLayoutCache;
  if (!cache || typeof __seekDump !== 'function' || typeof copy !== 'function')
    throw new Error('Use DevTools Console in the ChatGPT page, JavaScript context: top.');

  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const flags = (height, textLength) => ({
    tallerThan300: height > 300,
    zeroTextLength: textLength === 0,
    textLengthUnavailable: textLength === null,
  });
  const md = '[data-markdown-text-style="assistant-message"]';
  const itemSelector = `[data-user-message-bubble], ${md} > *`;
  // Match preview-main.js's read-only virtualizer lookup. Never serialize React props.
  function turnKeys(scroller) {
    const turn = scroller.querySelector('[data-turn-key]');
    let fiber = turn?.[Object.keys(turn).find((k) => k.startsWith('__reactFiber$'))];
    for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (Array.isArray(props?.entries) && props.RowComponent)
        return props.entries.map((entry) => entry.turnKey);
    }
    return null;
  }
  const kind = (item, element) => {
    if (item.user) return 'user';
    if (item.math?.length === 1 && item.math[0].display) return 'display-math';
    const tag = element?.localName;
    if (/^h[1-6]$/.test(tag)) return 'heading';
    return (
      { p: 'paragraph', pre: 'code', table: 'table', ul: 'list', ol: 'list', hr: 'separator' }[
        tag
      ] || 'block'
    );
  };
  function record(entry, source, elements = []) {
    if (!entry) return null;
    return {
      source,
      ready: !!entry.ready,
      fromStorage: !!entry.fromStorage,
      removed: !!entry.removed,
      height: num(entry.h),
      rowHeight: num(entry.rowH),
      turnOffset: num(entry.turnOffset),
      turnHeight: num(entry.turnH),
      width: num(entry.w),
      viewportWidth: num(entry.vw),
      scrollerWidth: num(entry.sw),
      recordedAt: num(entry.recordedAt),
      measurementCount: num(entry.records),
      blockHeights: (entry.blocks || []).map(num),
      items: (entry.items || []).map((item, index) => {
        const textLength = typeof item.text === 'string' ? item.text.length : null;
        return {
          index,
          kind: kind(item, elements[index]),
          kindInferred: true,
          source,
          height: num(item.h),
          top: num(item.top),
          left: num(item.left),
          width: num(item.w),
          textLength,
          sourceBlockIndex: num(item.source),
          fallback: false,
          estimate: false,
          math: (item.math || []).map((m) => ({
            start: num(m.start),
            end: num(m.end),
            display: !!m.display,
            height: num(m.h),
          })),
          flags: flags(item.h, textLength),
        };
      }),
    };
  }
  // A strict field allowlist: no textContent, HTML, attribute values, CSS strings or IDs.
  // Read all content-visibility states BEFORE rect reads can force skipped content to lay out.
  function structure(root) {
    if (!root) return null;
    const nodes = [root, ...root.querySelectorAll('*')];
    const indexes = new Map(nodes.map((node, i) => [node, i]));
    const rows = nodes.map((node, index) => ({
      index,
      parent: indexes.get(node.parentElement) ?? null,
      tag: node.localName,
      classes: [...node.classList],
      dataAttributeNames: node.getAttributeNames().filter((name) => name.startsWith('data-')),
      contentVisibility: getComputedStyle(node).contentVisibility,
    }));
    const origin = root.getBoundingClientRect().top;
    return rows.map((row, index) => {
      const rect = nodes[index].getBoundingClientRect();
      return { ...row, height: rect.height, top: rect.top - origin };
    });
  }
  function request(op, data = {}) {
    return new Promise((resolve) => {
      // Negative IDs cannot collide with Butter's positive request sequence.
      const id = -Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) - 1;
      const finish = (result) => {
        clearTimeout(timer);
        document.removeEventListener('butter-layout-response', listener);
        resolve(result);
      };
      const listener = (event) => {
        let result;
        try {
          result = JSON.parse(event.detail);
        } catch {
          return;
        }
        if (op === 'state' ? result.state : result.id === id) finish(result);
      };
      const timer = setTimeout(() => finish({ timeout: true }), 10000);
      document.addEventListener('butter-layout-response', listener);
      document.dispatchEvent(
        new CustomEvent('butter-layout-request', {
          detail: JSON.stringify({ id, op, ...data }),
        }),
      );
    });
  }
  const hash = async (value) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
  async function persisted(key) {
    let account = null;
    const listener = (event) => {
      if (/^[a-f0-9]{64}$/.test(event.detail)) account = event.detail;
    };
    document.addEventListener('butter-account', listener);
    document.dispatchEvent(new CustomEvent('butter-account-request'));
    document.removeEventListener('butter-account', listener);
    const state = await request('state');
    if (state.timeout) return { status: 'bridge-timeout', records: [] };
    if (!state.enabled) return { status: 'disabled', records: [] };
    if (!account) return { status: 'account-unavailable', records: [] };
    const conversation = location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1];
    if (!conversation) return { status: 'conversation-unavailable', records: [] };
    const turnHash = await hash(key);
    const result = await request('load', { account, conv: await hash(conversation) });
    if (result.timeout || result.error) return { status: 'load-failed', records: [] };
    const matches = (result.records || []).filter((entry) => entry.turn === turnHash);
    return {
      status: matches.length ? 'found' : 'not-found',
      records: matches.map((entry) => ({
        schema: num(entry.schema),
        // Do not validate away a malformed record: it may be the evidence we need.
        codecValid: globalThis.ButterLayoutCodec?.valid(entry) ?? null,
        ...record(
          {
            h: entry.metrics?.[0],
            rowH: entry.metrics?.[1],
            turnOffset: entry.metrics?.[2],
            turnH: entry.metrics?.[3],
            w: entry.metrics?.[4],
            vw: entry.metrics?.[5],
            sw: entry.metrics?.[6],
            blocks: entry.blocks,
            items: (entry.items || []).map((item) => ({
              top: item[0],
              h: item[1],
              left: item[2],
              w: item[3],
              user: !!item[4],
              source: item[6],
              math: (item[7] || []).map(([start, end, display, h]) => ({
                start,
                end,
                display: !!display,
                h,
              })),
            })),
          },
          'persisted',
        ),
      })),
    };
  }
  async function capture() {
    const dump = __seekDump(true);
    const update = dump.updates?.at(-1);
    const index = TURN_INDEX ?? (dump.active ? update?.turn : null);
    if (!Number.isInteger(index) || index < 0)
      throw new Error('No active preview turn. Set TURN_INDEX or arm and drag again.');
    const scroller = [...document.querySelectorAll('.thread-scroll-container')].find(
      (node) => node.clientHeight > 0,
    );
    const keys = scroller && turnKeys(scroller);
    const key = keys?.[index];
    if (!key)
      throw new Error('Turn order unavailable or index out of range; no partial capture copied.');
    const turn = [...scroller.querySelectorAll('[data-turn-key]')].find(
      (node) => node.dataset.turnKey === key,
    );
    const elements = turn ? [...turn.querySelectorAll(itemSelector)] : [];
    // Snapshot the warm record FIRST. Never prepare(), flush(), adopt() or remeasure it.
    const entry = cache.get(key, scroller);
    const memory = record(entry, entry?.fromStorage ? 'restored' : 'measured', elements);
    const shadow = document.querySelector('butter-seek-preview')?.shadowRoot;
    const estimate = shadow?.querySelector('.est');
    const output = {
      schema: 1,
      turnIndex: index,
      selection: TURN_INDEX === null ? 'active-preview-update' : 'explicit-index',
      preview: {
        active: !!dump.active,
        updateTurnIndex: num(update?.turn),
        offset: num(update?.offset),
        layout: typeof update?.layout === 'boolean' ? update.layout : null,
        known: typeof update?.known === 'boolean' ? update.known : null,
        textFallback: typeof update?.textFallback === 'boolean' ? update.textFallback : null,
        estimateVisible: !!estimate && !estimate.hidden,
        // May include neighboring turns; .it nodes expose no item/turn identity.
        renderedItems: [...(shadow?.querySelectorAll('.it') || [])].map((node) => {
          const textLength = node.textContent.length;
          const height = node.getBoundingClientRect().height;
          return {
            classes: [...node.classList],
            height,
            top: num(parseFloat(node.style.top)),
            textLength,
            flags: flags(height, textLength),
          };
        }),
      },
      memory,
      dom: {
        mounted: !!turn,
        itemCount: elements.length,
        turn: structure(turn),
      },
    };
    // These reads happen after the warm snapshot and DOM snapshot, and never hydrate the cache.
    output.persisted = await persisted(key);
    copy(JSON.stringify(output, null, 2));
    console.info('Butter diagnostic JSON copied. Only share the clipboard JSON.');
  }
  if (TURN_INDEX !== null || __butterSeeking()) {
    void capture();
  } else {
    // Pause on the failing preview while still holding the thumb. Debouncing captures the
    // current update, rather than the first frame of the drag or the post-release remount.
    let timer;
    const expiry = setTimeout(cleanup, 120000);
    function cleanup() {
      clearTimeout(timer);
      clearTimeout(expiry);
      document.removeEventListener('butter-seek-state', listener);
    }
    function listener(event) {
      let state;
      try {
        state = JSON.parse(event.detail).state;
      } catch {
        return;
      }
      clearTimeout(timer);
      if (state === 'dragging')
        timer = setTimeout(() => {
          if (!__butterSeeking()) return;
          cleanup();
          void capture();
        }, 1000);
    }
    document.addEventListener('butter-seek-state', listener);
    console.info(
      'Butter capture armed for 2 minutes. Drag to the bug and hold still for 1 second.',
    );
  }
})(typeof copy === 'function' ? copy : null);
