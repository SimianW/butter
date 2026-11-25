// The veil's state paths that the lab cannot run, because it never sends (ticket #175 of spec #170):
// Stop, Regenerate, Edit, a version switch, a hidden chat, a Dil remount and a hidden tab, modelled
// over the fake DOM (seam 1a). What each case looks like to the marker, and which unveil path
// covers it, is in notes/runs/2026-11-24-veil-state-paths/read-through.md. The rule under test is
// the hard requirement: no block that renders is ever veiled. A veiled block may render only
// through a state-change event (which unveils it first) or by leaving the stylesheet's veil rules
// (where its attribute does nothing); so a block that renders outside those rules must not carry a
// veil back into them.
const test = require('node:test');
const assert = require('node:assert/strict');
const { offscreenFixture: fixture } = require('./helpers/offscreen-fixture.cjs');

// Streams three blocks below the fold: one held as never-rendered by the flush, one queued for the
// next flush, and one whose size has not been reported yet (never queued). All three are veiled.
function streamed(f) {
  const [held, queued, unqueued] = f.blocks;
  f.cv(held, true);
  f.size(held, 120);
  f.timers();
  f.cv(queued, true);
  f.size(queued, 120);
  f.cv(unqueued, true);
  assert.ok(f.unrendered(held) && f.blocks.every(f.veiled));
  return { held, queued, unqueued };
}

test('hidden chat: an answer that completes while its turn is out of the page comes back with only held blocks veiled', () => {
  // The user opens another chat mid-stream and ChatGPT keeps the turn's elements; the answer
  // completes while they are out of the document, so no observer sees its turn leave in_progress.
  // Back in the page, its blocks that are not held are outside the veil rules and render.
  const f = fixture({ blocks: 3 });
  const { held, queued, unqueued } = streamed(f);
  f.leave();
  f.timers(); // the flush runs while the turn is away
  f.complete({ observed: false });
  f.back();
  assert.ok(!f.veiled(queued) && !f.veiled(unqueued), 'rendered on return, so unveiled');
  assert.ok(f.veiled(held), 'held: still skipped');
  // The flush later holds the rendered blocks it still believes skipped, which brings them back
  // under the veil rules while they are on screen: no veil may come with them.
  f.size(queued, 33);
  f.size(unqueued, 33);
  f.timers();
  assert.ok(!f.veiled(queued) && !f.veiled(unqueued));
});

test('Stop: the answer leaves in_progress with blocks held, queued and not yet queued; none renders veiled', () => {
  // Stop takes the same path as completion: the turn's state leaves in_progress. The blocks that
  // are not held leave the streaming rule and render in that task, so they are unveiled at once;
  // the held block stays skipped and is unveiled first thing when it renders.
  const f = fixture({ blocks: 3 });
  const { held, queued, unqueued } = streamed(f);
  f.complete();
  assert.ok(!f.veiled(queued) && !f.veiled(unqueued));
  assert.ok(f.veiled(held) && f.unrendered(held), 'held: still skipped');
  f.calls.length = 0;
  f.cv(held, false); // scrolled to
  assert.deepEqual(f.calls[0].slice(2), ['data-butter-veil'], 'unveiled first');
  assert.ok(!f.veiled(held));
  // The flush that was pending at Stop, and the sizes that come after it, veil nothing.
  f.size(unqueued, 33);
  f.timers();
  assert.ok(f.blocks.every((b) => !f.veiled(b)));
});

test('Stop before the first flush: no block is held, and none stays veiled', () => {
  const f = fixture({ blocks: 2 });
  for (const b of f.blocks) (f.cv(b, true), f.size(b, 120));
  f.complete();
  f.timers();
  assert.ok(f.blocks.every((b) => !f.veiled(b) && !f.unrendered(b)));
});

test('Regenerate and Edit, blocks replaced: the new answer has no block veiled from before', () => {
  const f = fixture({ blocks: 3 });
  const old = Object.values(streamed(f));
  f.complete();
  const fresh = f.replace(2);
  f.restart();
  assert.ok(
    fresh.every((b) => !f.veiled(b)),
    'new elements carry no marks',
  );
  const [above, below] = fresh;
  f.cv(above, false); // streamed in on screen
  f.cv(below, true);
  f.complete();
  assert.ok(!f.veiled(above) && !f.veiled(below), 'not held: unveiled at completion');
  // The old answer's elements are gone; whatever marks they keep, nothing renders them.
  assert.ok(old.every((b) => !b.isConnected));
});

test('Regenerate and Edit, block elements reused with their old marks on: a reused block renders unveiled', () => {
  // React keeps the old answer's elements and rewrites their content; Butter's attributes stay.
  const f = fixture({ blocks: 3 });
  const { held, queued } = streamed(f);
  f.timers(); // the queued block is held too
  f.cv(queued, false); // rendered once in the old answer
  f.complete();
  f.restart(); // the new answer streams into the same elements
  // A reused held block keeps its veil only while it stays skipped (its unrendered mark keeps it
  // under the rules): when the new answer's content in it renders, it is unveiled first.
  assert.ok(f.veiled(held));
  f.calls.length = 0;
  f.cv(held, false);
  assert.deepEqual(f.calls[0].slice(2), ['data-butter-veil']);
  // A reused block that rendered once is never veiled again.
  f.cv(queued, true);
  assert.ok(!f.veiled(queued));
  f.complete();
  assert.ok(
    f.blocks.every((b) => !f.veiled(b) || f.unrendered(b)),
    'only held blocks veiled',
  );
});

test('Edit while the answer streams, elements reused: veiled blocks stay veiled only while skipped', () => {
  // The turn may stay in_progress throughout: no sweep runs, and the veil comes off by the
  // state-change event when the reused block renders, or at the new answer's completion.
  const f = fixture({ blocks: 2 });
  const [a, b] = f.blocks;
  f.cv(a, true);
  f.cv(b, true);
  f.restart();
  f.cv(a, false);
  assert.ok(!f.veiled(a) && f.veiled(b));
  f.complete();
  assert.ok(!f.veiled(b));
});

test('version switch and hidden chat: the turn leaves and comes back while streaming; its veiled blocks render unveiled', () => {
  // Switching versions or chats takes the turn out of the page. Back while still streaming, its
  // veiled blocks are under the streaming rule again and still skipped below the view.
  const f = fixture({ blocks: 2 });
  const [a, b] = f.blocks;
  f.cv(a, true);
  f.cv(b, true);
  f.leave();
  f.back();
  assert.ok(f.veiled(a) && f.veiled(b), 'still skipped: still veiled');
  f.cv(a, false);
  assert.ok(!f.veiled(a));
  f.complete();
  assert.ok(!f.veiled(b));
});

test('version switch: the turn comes back with new block elements; none is veiled from before', () => {
  const f = fixture({ blocks: 2 });
  for (const b of f.blocks) f.cv(b, true);
  f.leave();
  const fresh = f.replace(2);
  f.back();
  assert.ok(fresh.every((b) => !f.veiled(b)));
});

test('Dil remount: a block detached and re-attached with its marks on', () => {
  const f = fixture({ blocks: 3 });
  const { held, queued, unqueued } = streamed(f);
  // While streaming: still under the streaming rule, so a veil that comes back is still valid.
  f.detach(queued);
  f.attach(queued);
  assert.ok(f.veiled(queued));
  f.cv(queued, false);
  assert.ok(!f.veiled(queued), 'unveiled when it renders');
  // Out of the page when the answer completes, back after: outside the rules, it renders.
  f.detach(unqueued);
  f.complete();
  f.attach(unqueued);
  assert.ok(!f.veiled(unqueued));
  // A held block keeps its marks: it is still skipped wherever it comes back.
  f.detach(held);
  f.attach(held);
  assert.ok(f.veiled(held) && f.unrendered(held));
});

test('hidden tab: completion unveils without waiting for a frame', () => {
  // A hidden tab runs no frames (no rAF, no size or state-change reports) but still runs
  // observers: the completion sweep unveils, and the frame-bound bookkeeping waits until it shows.
  const f = fixture({ blocks: 2, frames: false });
  const [a, b] = f.blocks;
  f.cv(a, true);
  f.size(a, 120);
  f.cv(b, true);
  f.complete();
  assert.ok(!f.veiled(a) && !f.veiled(b));
  assert.ok(a.hasAttribute('data-butter-unveiled'), 'transitions stay off until a frame runs');
  f.frame();
  f.frame();
  assert.ok(!f.veiled(a) && !f.veiled(b));
  assert.ok(
    [a, b].every((e) => !e.hasAttribute('data-butter-unveiled')),
    'settled once it shows',
  );
});
