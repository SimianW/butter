// Dev build only. The bug file's `turns` and `usage`: what the four DevTools snippets in
// notes/diagnostics/ report (preview record, record readiness, pending math; the press decision
// is read separately), from the page in the MAIN world. collect() copies Butter's memory state
// first (cache records, recorder status, counters) and returns the DOM reads as functions, so
// the recorder runs them afterwards, one by one: a failing part becomes {unavailable}. Like the
// snippets it never calls prepare(), flushes measurements, hydrates or clears storage.
// Page objects are passed in, so node --test runs it against planted state.
(() => {
  const names = globalThis.ButterDevAllowlist ?? require('./allowlist.js');
  const TAGS = new Set(names.TAGS),
    CLASSES = new Set(names.CLASSES),
    DATA_ATTRIBUTES = new Set(names.DATA_ATTRIBUTES);
  // A turn's structure stops here (about 170 bytes a node); KaTeX subtrees count as one node.
  const MAX_DOM_NODES = 1_000;
  const MD = '[data-markdown-text-style="assistant-message"]',
    ITEMS = `[data-user-message-bubble], ${MD} > *`;
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const px = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
  const flags = (height, textLength) => ({
    tallerThan300: height > 300,
    zeroTextLength: textLength === 0,
    textLengthUnavailable: textLength === null,
  });
  const counts = (map) =>
    Object.entries(map || {}).map(([reason, count]) => ({ reason, count: num(count) }));

  const scrollerOf = (document) =>
    [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
  // ChatGPT's virtualizer: turn order and measured row heights, the read-only lookup the seek code
  // and the snippets use. Without it, the mounted turns in DOM order.
  function turnOrder(sc) {
    const mounted = [...sc.querySelectorAll('[data-turn-key]')];
    const t = mounted[0];
    let fiber = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))];
    for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if (!Array.isArray(props?.entries) || !props.RowComponent) continue;
      const ids = props.entries.map((entry) => entry.turnKey);
      let heights = {};
      for (let hook = fiber.memoizedState, i = 0; hook && i < 80; hook = hook.next, i++) {
        const value = hook.memoizedState;
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          ids.some((id) => typeof value[id] === 'number')
        ) {
          heights = value;
          break;
        }
      }
      return { ids, heights, mounted, fiberFound: true };
    }
    return { ids: mounted.map((m) => m.dataset.turnKey), heights: {}, mounted, fiberFound: false };
  }

  // capture-preview-record.js's record(): numbers, booleans and lengths, never the text.
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
  function memoryRecord(entry, elements, now) {
    if (!entry) return null;
    const source = entry.fromStorage ? 'restored' : 'measured';
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
      // ms before the save, on the events' clock; stored records were never measured here.
      recordedAt: entry.recordedAt > 0 ? Math.round(entry.recordedAt - now) : null,
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
  // Names only, and only known ones: tags, classes, data-attribute names. Computed
  // content-visibility for every node first, then rects (a rect read can lay out skipped content).
  function structure(root, getComputedStyle) {
    if (!root) return { nodes: null, truncated: false };
    const nodes = [],
      collapsed = new Map();
    let truncated = false;
    const walk = (node) => {
      if (nodes.length >= MAX_DOM_NODES) {
        truncated = true;
        return;
      }
      nodes.push(node);
      if (node.classList.contains('katex')) {
        collapsed.set(node, node.querySelectorAll('*').length);
        return;
      }
      for (const child of node.children) walk(child);
    };
    walk(root);
    const indexes = new Map(nodes.map((node, i) => [node, i]));
    const rows = nodes.map((node, index) => {
      const classes = [...node.classList];
      const row = {
        index,
        parent: indexes.get(node.parentElement) ?? null,
        tag: TAGS.has(node.localName) ? node.localName : 'other',
        classes: [
          ...new Set(
            classes
              .map((c) => (/AdaptiveStreaming/.test(c) ? 'adaptive-streaming' : c))
              .filter((c) => CLASSES.has(c)),
          ),
        ],
        classCount: classes.length,
        dataAttributeNames: node.getAttributeNames().filter((n) => DATA_ATTRIBUTES.has(n)),
        contentVisibility: getComputedStyle(node).contentVisibility,
      };
      if (collapsed.has(node)) row.collapsed = collapsed.get(node);
      return row;
    });
    const origin = root.getBoundingClientRect().top;
    for (const [index, row] of rows.entries()) {
      const rect = nodes[index].getBoundingClientRect();
      row.height = px(rect.height);
      row.top = px(rect.top - origin);
    }
    return { nodes: rows, truncated };
  }

  // capture-math-pending.js, per mounted turn, with each kind as its own count.
  const MATH_KINDS = {
    'katex-error': 'katexError',
    'mathml-only': 'mathmlOnly',
    'katex-parts-no-root': 'partsNoRoot',
    'raw-text': 'rawText',
    empty: 'empty',
  };
  function pendingMath(t, getComputedStyle) {
    const all = [...t.querySelectorAll('[data-math-source]')];
    const missing = all.filter((e) => !e.querySelector('.katex'));
    const out = {
      formulas: all.length,
      withoutKatex: missing.length,
      katexError: 0,
      mathmlOnly: 0,
      partsNoRoot: 0,
      rawText: 0,
      empty: 0,
      other: 0,
      missingInsideCvBlock: 0,
      displayMissing: 0,
    };
    for (const e of missing) {
      const k = e.querySelector('.katex-error')
        ? 'katex-error'
        : e.querySelector('math')
          ? 'mathml-only'
          : e.querySelector('.katex-display, .katex-html')
            ? 'katex-parts-no-root'
            : e.childElementCount === 0
              ? e.textContent.trim()
                ? 'raw-text'
                : 'empty'
              : 'other';
      out[MATH_KINDS[k] || 'other']++;
      for (let p = e.parentElement; p && p !== t; p = p.parentElement)
        if (getComputedStyle(p).contentVisibility === 'auto' && p.style.contentVisibility) {
          out.missingInsideCvBlock++;
          break;
        }
      if (e.closest('.katex-display') || e.tagName === 'DIV') out.displayMissing++;
    }
    return out;
  }

  // Runs fn now; its failure is thrown again when the part that needs it is read.
  const attempt = (fn) => {
    try {
      return { value: fn() };
    } catch (error) {
      return { error };
    }
  };
  const take = (result) => {
    if (result.error) throw result.error;
    return result.value;
  };

  function collect(env) {
    const { document, getComputedStyle, now, cache, core } = env;
    // ---- memory, before any layout or style read ----
    const scroller = attempt(() => scrollerOf(document) || null);
    const sc = scroller.value;
    const order = attempt(() => sc && turnOrder(sc));
    // cache.get(id) is the readiness snippet's read: it may refresh the layout fingerprint.
    const records = attempt(() =>
      Object.fromEntries(take(order).ids.map((id) => [id, cache.get(id)])),
    );
    const states = attempt(
      () => new Map(take(order).mounted.map((t) => [t.dataset.turnKey, cache.diagnostics?.(t)])),
    );
    const seek = env.lastSeek,
      active = attempt(() => {
        const { ids, mounted } = take(order);
        const index = seek && Number.isInteger(seek.turn) ? seek.turn : null;
        const selection =
          index === null ? 'none' : env.seeking?.() ? 'active-preview-update' : 'last-seek-update';
        const key = index === null ? undefined : ids[index];
        const turn = key === undefined ? null : mounted.find((t) => t.dataset.turnKey === key);
        const elements = turn ? [...turn.querySelectorAll(ITEMS)] : [];
        const entry = key === undefined ? null : take(records)[key];
        return { index, selection, turn, elements, record: memoryRecord(entry, elements, now) };
      });
    const store = attempt(() => {
      const d = cache.dump();
      return {
        ready: !!d.ready,
        loads: num(d.loads),
        hits: num(d.hits),
        writes: num(d.writes),
        bytes: num(d.bytes),
        errors: num(d.errors),
        entries: num(d.entries),
        pending: num(d.pending),
        rejected: counts(d.rejected),
      };
    });
    const counters = attempt(() => {
      const S = env.heightCache().stats;
      return {
        observed: num(S.observed),
        records: num(S.records),
        refreshes: num(S.refreshes),
        restored: num(S.restored),
        blocksRestored: num(S.blocksRestored),
        recordMs: Math.round(S.recordMs * 10) / 10,
        recordMax: Math.round(S.recordMax * 10) / 10,
        hooks: num(S.hooks),
        parked: num(S.parked),
        released: num(S.released),
        adopted: num(S.adopted) ?? 0,
        approx: num(S.approx) ?? 0,
        rejected: counts(S.rejected),
        restoreMisses: counts(S.restoreMisses),
      };
    });
    // No visible conversation scroller: nothing to read (a failed lookup throws instead).
    const noScroller = () => (take(scroller) ? null : { unavailable: 'no-scroller' });

    // ---- DOM reads, run later by the recorder in this order ----
    return {
      turns: {
        order: () => {
          if (noScroller()) return noScroller();
          const { ids, mounted, fiberFound } = take(order);
          return {
            count: ids.length,
            mounted: mounted.length,
            fiberFound,
            idsFromFallback: !fiberFound,
            idsReason: fiberFound ? null : 'ids-from-dom',
          };
        },
        active: () => {
          if (noScroller()) return noScroller();
          const a = take(active);
          if (a.index === null) return { turnIndex: null, selection: 'none' };
          const shadow = env.previewRoot?.();
          const estimate = shadow?.querySelector('.est');
          const dom = structure(a.turn, getComputedStyle);
          return {
            turnIndex: a.index,
            selection: a.selection,
            preview: {
              active: !!env.seeking?.(),
              updateTurnIndex: num(seek.turn),
              offset: num(seek.offset),
              layout: typeof seek.layout === 'boolean' ? seek.layout : null,
              known: typeof seek.known === 'boolean' ? seek.known : null,
              textFallback: typeof seek.textFallback === 'boolean' ? seek.textFallback : null,
              estimateVisible: !!estimate && !estimate.hidden,
              // May include neighbouring turns; the preview's nodes carry no turn identity.
              renderedItems: [...(shadow?.querySelectorAll('.it') || [])].map((node) => {
                const textLength = node.textContent.length,
                  height = px(node.getBoundingClientRect().height);
                return {
                  classes: [...node.classList].filter((c) => CLASSES.has(c)),
                  height,
                  top: num(parseFloat(node.style.top)),
                  textLength,
                  flags: flags(height, textLength),
                };
              }),
            },
            memory: a.record,
            dom: {
              mounted: !!a.turn,
              itemCount: a.elements.length,
              ...(dom.truncated && { truncated: true }),
              turn: dom.nodes,
            },
          };
        },
        readiness: () => {
          if (noScroller()) return noScroller();
          const { ids, heights, mounted } = take(order),
            recordsById = take(records),
            status = take(states);
          const currentSw = sc.clientWidth;
          const model = core.buildModel({
            ids,
            measured: heights,
            records: recordsById,
            texts: {},
            scrollHeight: sc.scrollHeight,
            gap: 12,
            sw: currentSw,
          });
          return {
            rejectionDiagnosticsAvailable: typeof cache.diagnostics === 'function',
            currentSw,
            turns: ids.map((id, index) => {
              const r = recordsById[id],
                t = mounted.find((m) => m.dataset.turnKey === id),
                measured = heights[id] || 0;
              return {
                index,
                mounted: !!t,
                hasRecord: !!r,
                items: r?.items?.length ?? 0,
                blocks: r?.blocks?.length ?? 0,
                recorder: status.get(id) ?? null,
                recordValidation: r
                  ? core.validateSnapshot({ ...r, complete: true, mathReady: true })
                  : null,
                rowH: num(r?.rowH),
                measuredHeight: num(measured),
                rowHeightNow: t ? px(t.parentElement.getBoundingClientRect().height) : null,
                rowHeightDelta: r && measured ? num(r.rowH - measured) : null,
                sw: num(r?.sw),
                fromStorage: !!r?.fromStorage,
                layout: model[index].layout,
                layoutReason: !r
                  ? 'no-record'
                  : !r.items?.length
                    ? 'no-items'
                    : r.sw !== currentSw
                      ? 'width-mismatch'
                      : r.fromStorage
                        ? null
                        : !measured
                          ? 'unmeasured-row'
                          : Math.abs(r.rowH - measured) > 2
                            ? 'row-height-mismatch'
                            : null,
              };
            }),
          };
        },
        math: () => {
          if (noScroller()) return noScroller();
          const { ids, mounted } = take(order);
          return mounted.map((t) => {
            const index = ids.indexOf(t.dataset.turnKey);
            return { index: index < 0 ? null : index, ...pendingMath(t, getComputedStyle) };
          });
        },
      },
      usage: { store: () => take(store), cache: () => take(counters) },
    };
  }

  globalThis.ButterDevSources = { collect, turnOrder, scrollerOf };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterDevSources;
})();
