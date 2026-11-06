const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../extension/seek/core-main.js');

// Drive the actual press-time model builder with one mounted, fully rendered row.
function prepareFixture(measuredHeight) {
  const rowHeight = 1937.5;
  const record = {
    rowH: rowHeight,
    sw: 766,
    items: [{ top: 112, h: 26, left: 63, w: 640, text: 'Synthetic answer', math: [] }],
  };
  const turn = {
    dataset: { turnKey: 'synthetic' },
    parentElement: {
      getBoundingClientRect: () => ({ top: 0, bottom: rowHeight, height: rowHeight }),
    },
    __reactFiber$fixture: {
      memoizedProps: { entries: [{ turnKey: 'synthetic' }], RowComponent() {} },
      memoizedState: { memoizedState: measuredHeight ? { synthetic: measuredHeight } : {} },
    },
  };
  const scroller = {
    clientWidth: 766,
    scrollTop: 0,
    scrollHeight: rowHeight,
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
    texts: () => ({ byId: { synthetic: { q: 'Question', answer: 'Answer' } } }),
    __butterLayoutCache: { prepare: () => ({ records: { synthetic: record }, storedTurns: 0 }) },
  };
  vm.createContext(context);
  vm.runInContext(
    source.slice(source.indexOf('  const measured ='), source.indexOf('  // ---- surface')),
    context,
  );
  return context.prepare(scroller);
}

test('a single turn with no virtualizer measurement keeps the unseen fallback', () => {
  assert.equal(prepareFixture(null).model[0].layout, false);
});

test('a single turn with a mismatching virtualizer measurement keeps the unseen fallback', () => {
  assert.equal(prepareFixture(1885.5).model[0].layout, false);
});

test('a single turn with matching geometry uses its recorded layout', () => {
  assert.equal(prepareFixture(1937.5).model[0].layout, true);
});
