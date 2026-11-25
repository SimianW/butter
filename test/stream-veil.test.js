// The veil over the fake DOM (seam 1a): which answer blocks stream/offscreen.js veils, and that the
// veil comes off at each moment of the unveil table in spec #170. The stylesheet side, and the rule
// that no rendered block is ever veiled, are checked in headless Chromium
// (stream-veil-chromium.test.mjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const { offscreenFixture: fixture } = require('./helpers/offscreen-fixture.cjs');

test('a streamed block skipped before it ever rendered is veiled', () => {
  const f = fixture();
  f.cv(f.block, true);
  assert.ok(f.veiled(f.block));
});

test('a block that rendered before it was first skipped is not veiled', () => {
  // It streamed in on screen, then scrolled away: its content was drawn.
  const f = fixture();
  f.cv(f.block, false);
  f.cv(f.block, true);
  assert.ok(!f.veiled(f.block));
});

test('a block that rendered once is never veiled again', () => {
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers(); // held as never-rendered, still veiled
  f.cv(f.block, false); // scrolled to
  f.cv(f.block, true); // scrolled past before the flush
  assert.ok(!f.veiled(f.block), 'skipped again before the flush');
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
  f.cv(f.block, false);
  f.cv(f.block, true);
  assert.ok(!f.veiled(f.block), 'skipped again as a seen block');
});

test('a turn is never veiled', () => {
  // A turn far from the view can be skipped while its answer streams; the walk must still enter it.
  const f = fixture();
  f.cv(f.turn, true);
  assert.ok(!f.veiled(f.turn));
});

test('a block that stops being skipped is unveiled before anything else its handler does', () => {
  // The browser renders the block's content in the next frame: the veil must already be off then,
  // whatever bookkeeping follows.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers(); // held
  f.calls.length = 0;
  f.cv(f.block, false);
  assert.ok(!f.veiled(f.block));
  const calls = f.calls.map(([what, , name]) => (name ? `${what} ${name}` : what));
  assert.equal(calls[0], 'remove data-butter-veil');
  assert.ok(calls.includes('observe'), 'then it is measured');
});

test('the flush that marks a block seen unveils it', () => {
  // A block that renders while it carries the veil without a state-change event, such as an
  // element ChatGPT reuses with its old marks: the flush measures it at its real size.
  const f = fixture();
  f.block.setAttribute('data-butter-veil', '');
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block));
  assert.ok(!f.veiled(f.block));
});

test('at completion, veiled blocks that are not held are unveiled; held blocks stay veiled', () => {
  // Completion takes the answer out of the streaming rule, so every block that is not held renders
  // in that task, without a state-change event.
  const f = fixture({ blocks: 3 });
  const [held, queued, unqueued] = f.blocks;
  f.cv(held, true);
  f.size(held, 120);
  f.timers(); // held as never-rendered
  f.cv(queued, true);
  f.size(queued, 120); // waits for the next flush
  f.cv(unqueued, true); // no size reported yet: never queued
  f.complete();
  assert.ok(f.veiled(held), 'held: still skipped after completion');
  assert.ok(!f.veiled(queued), 'queued for the flush');
  assert.ok(!f.veiled(unqueued), 'never queued');
});

// ChatGPT's <hr> separator (#172): `height: 0` survives size containment, so the marker's
// ResizeObserver only ever reports a 0 px content box for it. It is never queued, never held and
// never marked seen, and leaves the `auto` rules at completion with no state-change event.
const hr = (f) => {
  const [, el] = f.blocks;
  f.cv(el, true); // streamed in below the fold
  f.size(el, 0);
  return el;
};

test('a skipped <hr> is veiled, never held, and unveiled at completion', () => {
  const f = fixture({ blocks: 2 });
  const [held] = f.blocks;
  f.cv(held, true);
  f.size(held, 120);
  const el = hr(f);
  f.timers(); // the flush: holds the paragraph, never sees the <hr>
  assert.ok(f.veiled(el), 'veiled while streaming');
  assert.ok(!f.unrendered(el) && !f.seen(el), 'never held, never seen');
  f.complete();
  assert.ok(!f.veiled(el), 'it renders at completion');
  assert.ok(f.veiled(held), 'the held paragraph stays veiled');
  f.size(el, 0);
  f.timers();
  assert.ok(!f.veiled(el) && !f.unrendered(el), 'nothing veils or holds it after completion');
});

test('an <hr> that rendered once is never veiled again', () => {
  // The first prototype's trap: no mark ever records that the <hr> rendered.
  const f = fixture({ blocks: 2 });
  const el = hr(f);
  f.cv(el, false); // scrolled to
  f.timers();
  f.cv(el, true); // scrolled away
  assert.ok(!f.veiled(el), 'scrolled away after it rendered');
});

test('turning cv off unveils every block; back on, none is veiled from before', () => {
  const f = fixture({ blocks: 2 });
  const [held, streaming] = f.blocks;
  f.cv(held, true);
  f.size(held, 120);
  f.timers();
  f.cv(streaming, true);
  f.setting(false);
  assert.ok(!f.veiled(held) && !f.veiled(streaming));
  f.setting(true);
  // With cv off they rendered; skipped again once it is back on, they are not veiled.
  f.cv(held, true);
  f.cv(streaming, true);
  assert.ok(!f.veiled(held) && !f.veiled(streaming));
});

test("the dev build's capture keeps the veil's attribute name, as it does for the other marks", () => {
  const { DATA_ATTRIBUTES } = require('../extension/dev/allowlist.js');
  for (const mark of ['data-butter-seen', 'data-butter-unrendered', 'data-butter-veil'])
    assert.ok(DATA_ATTRIBUTES.includes(mark), mark);
});
