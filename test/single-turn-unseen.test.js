const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../extension/seek/core-main.js');

// Drive the actual press-time model builder with one fully rendered turn. When it is not mounted, a
// mounted neighbour row carries the virtualizer fiber, as in a longer chat scrolled elsewhere.
function prepareFixture(
  measuredHeight,
  { rowHeight = 1937.5, recordHeight = rowHeight, mounted = true } = {},
) {
  const record = {
    rowH: recordHeight,
    sw: 766,
    items: [{ top: 112, h: 26, left: 63, w: 640, text: 'Synthetic answer', math: [] }],
  };
  const ids = mounted ? ['synthetic'] : ['synthetic', 'neighbour'];
  const heights = measuredHeight ? { synthetic: measuredHeight } : {};
  if (!mounted) heights.neighbour = 400;
  const turn = {
    dataset: { turnKey: mounted ? 'synthetic' : 'neighbour' },
    parentElement: {
      getBoundingClientRect: () => {
        const height = mounted ? rowHeight : 400;
        return { top: 0, bottom: height, height };
      },
    },
    __reactFiber$fixture: {
      memoizedProps: { entries: ids.map((turnKey) => ({ turnKey })), RowComponent() {} },
      memoizedState: { memoizedState: heights },
    },
  };
  const scroller = {
    clientWidth: 766,
    scrollTop: 0,
    scrollHeight: rowHeight,
    clientHeight: rowHeight,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelector: () => turn,
    querySelectorAll: () => [turn],
  };
  const source = fs.readFileSync(require.resolve('../extension/seek/preview-main.js'), 'utf8');
  const context = {
    core,
    document: { querySelectorAll: () => [scroller] },
    prepareSequence: 0,
    pressDecision: null,
    performance: { now: () => 0 },
    texts: () => ({
      byId: {
        synthetic: { q: 'Question', answer: 'Answer' },
        neighbour: { q: 'Question', answer: 'Answer' },
      },
    }),
    __butterLayoutCache: { prepare: () => ({ records: { synthetic: record }, storedTurns: 0 }) },
  };
  vm.createContext(context);
  vm.runInContext(
    source.slice(source.indexOf('  const measured ='), source.indexOf('  // ---- surface')),
    context,
  );
  return context.prepare(scroller);
}

test('a mounted turn with no virtualizer measurement uses its matching live row', () => {
  const prep = prepareFixture(null);
  assert.equal(prep.model[0].layout, true);
  assert.equal(prep.decision.turns[0].layoutReason, null);
  assert.equal(prep.decision.turns[0].measuredHeight, 0);
});

test('an unmounted turn with no virtualizer measurement keeps the unseen fallback', () => {
  const prep = prepareFixture(null, { mounted: false });
  assert.equal(prep.model[0].layout, false);
  assert.equal(prep.decision.turns[0].layoutReason, 'no-measured');
});

// macOS alpha.14 capture: record and live mounted row agree at 1896, but ChatGPT's virtualizer
// height map still held a stale 266 at press time.
test('a mounted turn whose live row matches the record ignores a stale virtualizer height', () => {
  const prep = prepareFixture(266, { rowHeight: 1896 });
  assert.equal(prep.model[0].layout, true);
  assert.equal(prep.model[0].h, 1896);
  assert.equal(prep.decision.turns[0].layoutReason, null);
  assert.equal(prep.decision.turns[0].measuredHeight, 266);
  assert.equal(prep.decision.turns[0].modelHeight, 1896);
});

test('a mounted turn whose live row disagrees with the record keeps the unseen fallback', () => {
  const prep = prepareFixture(1896, { rowHeight: 1937.5, recordHeight: 1896 });
  assert.equal(prep.model[0].layout, false);
  assert.equal(prep.decision.turns[0].layoutReason, 'height-mismatch');
});

test('an unmounted turn with a mismatching virtualizer measurement keeps the unseen fallback', () => {
  const prep = prepareFixture(266, { rowHeight: 1896, mounted: false });
  assert.equal(prep.model[0].layout, false);
  assert.equal(prep.decision.turns[0].mounted, false);
  assert.equal(prep.decision.turns[0].layoutReason, 'height-mismatch');
});

test('a single turn with matching geometry uses its recorded layout', () => {
  const prep = prepareFixture(1937.5);
  assert.equal(prep.model[0].layout, true);
  assert.equal(prep.decision.turns[0].layoutReason, null);
  assert.equal(prep.decision.turns[0].mounted, true);
  assert.equal(prep.decision.scroller.matchesThreadScroller, true);
  assert.equal(prep.decision.fiberFound, true);
});
