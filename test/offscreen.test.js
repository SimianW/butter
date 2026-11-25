// Exercises stream/offscreen.js: which elements get data-butter-seen, so containment.css may skip them.
const test = require('node:test');
const assert = require('node:assert/strict');
const { offscreenFixture: fixture } = require('./helpers/offscreen-fixture.cjs');

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

test('a held-back block that rendered while scrolled past is marked, even if skipped by the flush', () => {
  // Dragging the scrollbar through a streamed answer: each held-back block came into view and
  // rendered for a few frames, then was skipped again before the one-second flush. It was held back
  // again, so the seek recorder kept rejecting the turn as a placeholder however often it was read.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers();
  f.complete();
  f.timers();
  f.cv(f.block, false);
  f.size(f.block, 33);
  f.cv(f.block, true); // scrolled past before the flush
  f.timers();
  assert.ok(f.seen(f.block), 'it rendered at its real size, which the browser remembers');
  assert.ok(!f.unrendered(f.block));
});
