// Paste in DevTools Console, context: top, while NOT holding the scrollbar.
// Emits geometry, counts and fixed reason codes only. No text, IDs, URLs or CSS.
((copy) => {
  const cache = globalThis.__butterLayoutCache,
    core = globalThis.__butterSeekCore;
  if (!cache || !core) throw new Error('Use the ChatGPT page Console, JavaScript context: top.');
  if (globalThis.__butterSeeking?.())
    throw new Error('Release the scrollbar before running this capture.');
  const sc = [...document.querySelectorAll('.thread-scroll-container')].find(
    (s) => s.clientHeight > 0,
  );
  if (!sc) throw new Error('No visible conversation scroller.');
  const mounted = [...sc.querySelectorAll('[data-turn-key]')];
  let fiber = mounted[0]?.[Object.keys(mounted[0]).find((k) => k.startsWith('__reactFiber$'))];
  let ids = null,
    heights = {};
  for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
    if (!Array.isArray(fiber.memoizedProps?.entries) || !fiber.memoizedProps.RowComponent) continue;
    ids = fiber.memoizedProps.entries.map((e) => e.turnKey);
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
    break;
  }
  if (!ids) throw new Error('Virtualizer shape unavailable; capture stopped without guessing.');
  // Read cache state before any DOM rect read could force skipped content to render.
  const records = Object.fromEntries(ids.map((id) => [id, cache.get(id)]));
  const states = new Map(mounted.map((t) => [t.dataset.turnKey, cache.diagnostics?.(t)]));
  const currentSw = sc.clientWidth;
  const model = core.buildModel({
    ids,
    measured: heights,
    records,
    texts: {},
    scrollHeight: sc.scrollHeight,
    gap: 12,
    sw: currentSw,
  });
  const number = (v) => (Number.isFinite(v) ? v : null);
  const result = {
    schema: 1,
    rejectionDiagnosticsAvailable: typeof cache.diagnostics === 'function',
    turns: ids.map((id, index) => {
      const r = records[id],
        t = mounted.find((t) => t.dataset.turnKey === id),
        measured = heights[id] || 0;
      return {
        index,
        mounted: !!t,
        hasRecord: !!r,
        items: r?.items?.length ?? 0,
        blocks: r?.blocks?.length ?? 0,
        recorder: states.get(id) ?? null,
        recordValidation: r
          ? core.validateSnapshot({ ...r, complete: true, mathReady: true })
          : null,
        rowH: number(r?.rowH),
        measuredHeight: number(measured),
        rowHeightNow: t ? number(t.parentElement.getBoundingClientRect().height) : null,
        rowHeightDelta: r && measured ? number(r.rowH - measured) : null,
        sw: number(r?.sw),
        currentSw,
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
  console.table(result.turns);
  const json = JSON.stringify(result, null, 2);
  if (typeof copy === 'function') {
    copy(json);
    console.info('Butter readiness JSON copied. Share only that JSON.');
  } else console.info(json);
  return result;
})(typeof copy === 'function' ? copy : null);
