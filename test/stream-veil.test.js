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

test('a held block whose height leaves its placeholder is unveiled in that size report', () => {
  // A find, a selection or a focus renders a skipped block on the spot; the state-change event is a
  // task, and a frame can run first. The height the frame lays it out at is reported in the frame,
  // before paint.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120); // the placeholder: the watch's first report
  f.timers(); // held
  f.complete();
  f.size(f.block, 120); // laid out by pre-layout, or the width changed: still skipped
  assert.ok(f.veiled(f.block), 'veiled while its height is the placeholder');
  f.size(f.block, 33);
  assert.ok(!f.veiled(f.block), 'unveiled before the state-change event');
  assert.ok(!f.heightWatched(f.block), 'let go once unveiled');
  f.cv(f.block, false);
  f.size(f.block, 33);
  f.timers();
  assert.ok(f.seen(f.block), 'then measured and marked as before');
});

test('a veiled block that leaves the page is let go by the height watch', () => {
  // Another chat opens: its old blocks report 0 px and must not be kept alive.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  assert.ok(f.heightWatched(f.block));
  f.detach(f.block);
  assert.ok(!f.heightWatched(f.block));
});

test('a held, veiled block that left the page and came back is unveiled by a later height report', () => {
  // A Dil remount, or a turn that leaves and comes back: the watch let it go at 0 px, and a block
  // that comes back still skipped posts no state-change event that would veil (and watch) it again.
  const f = fixture();
  f.cv(f.block, true);
  f.size(f.block, 120);
  f.timers(); // held
  f.complete();
  f.detach(f.block);
  f.attach(f.block);
  assert.ok(f.veiled(f.block) && f.unrendered(f.block), 'still held and veiled');
  f.size(f.block, 120); // its placeholder, where it came back
  assert.ok(f.veiled(f.block), 'still skipped: stays veiled');
  f.size(f.block, 33); // a find renders it
  assert.ok(!f.veiled(f.block), 'unveiled in the size report');
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

test('a held block that comes back into the page while cv is off is not veiled once cv is on', () => {
  // Out of the page when cv went off, the cv-off sweep never saw it; with cv off it renders where it
  // comes back. Turning cv on puts it back under the rules, on screen.
  const f = fixture({ blocks: 2 });
  const [held] = f.blocks;
  f.cv(held, true);
  f.size(held, 120);
  f.timers();
  assert.ok(f.veiled(held) && f.unrendered(held));
  f.detach(held);
  f.setting(false);
  f.attach(held); // in view
  f.setting(true);
  assert.ok(!f.veiled(held), 'unveiled when cv comes on');
  f.cv(held, true); // skipped again
  assert.ok(!f.veiled(held), 'rendered with cv off: never veiled again');
});

test('cv turned on mid-stream: the blocks that rendered while it was off are never veiled', () => {
  // With cv off nothing is skipped, so no state-change event records that the blocks rendered.
  const f = fixture({ blocks: 3 });
  const [a, b, later] = f.blocks;
  f.detach(later); // streams in after cv comes on
  f.setting(false);
  f.setting(true);
  f.cv(a, true); // under the streaming rule now, below the fold
  f.cv(b, true);
  assert.ok(!f.veiled(a) && !f.veiled(b), 'rendered while cv was off');
  f.attach(later);
  f.cv(later, true);
  assert.ok(f.veiled(later), 'a block streamed after cv came on is veiled as before');
});

test('a settings change that leaves cv on unveils nothing', () => {
  const f = fixture();
  f.cv(f.block, true);
  f.setting(true); // another setting changed: the same event
  assert.ok(f.veiled(f.block));
});

test("the dev build's capture keeps the veil's attribute name, as it does for the other marks", () => {
  const { DATA_ATTRIBUTES } = require('../extension/dev/allowlist.js');
  for (const mark of ['data-butter-seen', 'data-butter-unrendered', 'data-butter-veil'])
    assert.ok(DATA_ATTRIBUTES.includes(mark), mark);
});
