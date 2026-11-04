// Exercises stream/offscreen.js: which elements get data-butter-seen, so containment.css may skip them.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const listeners = {},
    timers = [],
    observed = new Set();
  let resized, mutated;
  const el = (attrs = {}) => ({
    attrs: { ...attrs },
    isConnected: true,
    firstElementChild: null,
    hasAttribute(n) {
      return n in this.attrs;
    },
    setAttribute(n, v) {
      this.attrs[n] = v;
    },
    removeAttribute(n) {
      delete this.attrs[n];
    },
    matches: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const block = el();
  const turn = el({ 'data-turn-key': 'a' });
  let streaming = true;
  turn.matches = (s) => s.includes('in_progress') && streaming;
  turn.contains = (x) => x === block || x === turn;
  const state = { ...el(), closest: () => turn };
  const root = {
    ...el(),
    firstElementChild: turn,
    querySelectorAll: () => [turn, block],
    getAttribute: () => null,
  };
  const context = {
    document: {
      documentElement: root,
      addEventListener: (n, fn) => (listeners[n] = fn),
    },
    ResizeObserver: class {
      constructor(fn) {
        resized = fn;
      }
      observe(e) {
        observed.add(e);
      }
      unobserve(e) {
        observed.delete(e);
      }
      disconnect() {
        observed.clear();
      }
    },
    MutationObserver: class {
      constructor(fn) {
        mutated = fn;
      }
      observe() {}
    },
    setTimeout: (fn) => timers.push(fn),
    requestAnimationFrame: (fn) => fn(),
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve('../extension/stream/offscreen.js'), 'utf8'),
    context,
  );
  return {
    block,
    turn,
    observed,
    seen: (e) => e.hasAttribute('data-butter-seen'),
    unrendered: (e) => e.hasAttribute('data-butter-unrendered'),
    size: (target, height) => resized([{ target, contentRect: { height } }]),
    cv: (target, skipped) => listeners.contentvisibilityautostatechange({ target, skipped }),
    timers: () => timers.splice(0).forEach((fn) => fn()),
    complete: () => {
      streaming = false;
      mutated([{ type: 'attributes', target: state, addedNodes: [] }]);
    },
  };
}

test('a block that rendered is marked seen', () => {
  const f = fixture();
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
});

test('a streamed block skipped before it rendered is held back, not marked at its placeholder size', () => {
  // Below the fold, the streaming rule skips a block as it arrives; ResizeObserver then reports the
  // 120px placeholder. Marking it kept it skipped at 120px after the answer completed.
  for (const order of ['event first', 'size first']) {
    const f = fixture();
    if (order === 'event first') f.cv(f.block, true);
    f.size(f.block, 120);
    if (order === 'size first') f.cv(f.block, true);
    f.timers();
    assert.ok(!f.seen(f.block), order);
    assert.ok(!f.observed.has(f.block), order);
    assert.ok(f.unrendered(f.block), `${order}: held back at the flush, while the answer streams`);
  }
});

test('a held-back block stays skipped when the answer completes, until it comes into view', () => {
  // ChatGPT lays out every block that is no longer skipped in the task that completes the answer,
  // so the hold must outlast completion: rendering a long answer's blocks then froze the page.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers();
  f.complete();
  f.timers();
  assert.ok(f.unrendered(f.block), 'kept after completion');
  assert.ok(!f.observed.has(f.block), 'not measured at completion');
  assert.ok(!f.seen(f.block));
  // Scrolled to: it renders at its real size, is marked, and is no longer held back.
  f.cv(f.block, false);
  assert.ok(f.observed.has(f.block));
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
  assert.ok(!f.unrendered(f.block));
});

test('a skipped streamed block is marked once it comes into view and renders', () => {
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers();
  assert.ok(!f.seen(f.block));
  f.cv(f.block, false);
  assert.ok(f.observed.has(f.block));
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
  assert.ok(!f.unrendered(f.block));
});

test('a skipped streamed block still waiting for its flush is handled when the answer completes', () => {
  // The answer completed before the one-second flush: the block was still queued, not waiting, so
  // nothing re-observed it and the flush later parked it in waiting for good.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.complete();
  assert.ok(f.observed.has(f.block), 'observed again for its rendered size');
  f.timers();
  assert.ok(!f.seen(f.block), 'not marked at its placeholder size');
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
  assert.ok(!f.unrendered(f.block), 'rendered by the completion layout: measured, not held');
});
