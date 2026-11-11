// The rail presentation model's card (extension/rail/model.js) through its interface: its kinds,
// contents and place, holding and leaving, the seek card, keys and the card following a deletion;
// and the earlier wait on the marks' items revision. Browser facts (focus, hit-testing, pixels)
// stay in lab/harness/bookmarks-qa.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { conv, EARLIER, groups, questions, rail, top } from './helpers/rail-model.mjs';

test('the card: a question tooltip, a question with bookmarks, the three dots with and without', () => {
  const r = rail({ count: 5 });
  r.marks({ q3: [false, true] });
  const tip = r.m.hover(1);
  assert.deepEqual(
    { ...tip, cy: undefined },
    {
      inert: true,
      instant: true,
      qb: false,
      bare: false,
      meta: '2 / 5',
      metaHidden: false,
      text: 'Question 1',
      question: null,
      cy: undefined,
      whole: false,
      clamp: null,
    },
  );
  assert.equal(tip.cy, r.m.tickY(1));
  assert.equal(r.m.hover(1), null, 'the same card: nothing to do');
  const bm = r.m.hover(3);
  assert.equal(bm.instant, false, 'it slides from tick to tick');
  assert.equal(bm.inert, false, 'a bookmark card takes the pointer');
  assert.equal(bm.whole, true);
  assert.equal(bm.question.id, 'q3');
  assert.equal(bm.question.group, 'Question 4 of 5 · 2 bookmarks');
  assert.deepEqual(
    bm.question.card.rows.map((b) => b.key),
    ['q3-0', 'q3-1'],
  );
  assert.deepEqual(r.m.hover(-2), { inert: true, hide: true });
  // While earlier history is unloaded, ticks count back from the latest.
  const e = rail({ count: 3, hasPrev: true });
  assert.equal(e.m.hover(2).meta, 'Latest question');
  assert.equal(e.m.hover(0).meta, '3 questions back');
  const hint = e.m.hover(-1);
  assert.equal(hint.text, 'Earlier questions are not loaded yet. Click to load them.');
  assert.equal(hint.metaHidden, true);
  assert.equal(hint.cy, top(e.m) - 8, "centred on the three dots' row");
  e.marks({ '-1': [false, false] });
  e.m.hover(-2);
  const dots = e.m.hover(-1);
  assert.equal(dots.bare, true);
  assert.equal(dots.earlier.meta, 'Earlier questions · 2 bookmarks');
  assert.equal(dots.earlier.group, dots.earlier.meta);
  assert.equal(dots.clamp, 8, 'kept below the scroller top');
  assert.equal(dots.whole, true);
  e.m.journey({ wait: 'x' });
  e.m.hover(-2);
  assert.equal(e.m.hover(-1).earlier.meta, 'Loading earlier questions…');
});

test('a click holds the card away until the pointer or keyboard comes back; a bookmark card stays on leave', () => {
  const r = rail({ count: 4 });
  r.marks({ q1: [false] });
  r.m.hover(2);
  r.m.hover(-2);
  r.m.hold(true);
  assert.equal(r.m.hover(2), null, 'held');
  r.m.hold(false);
  assert.equal(r.m.hover(2).text, 'Question 2');
  r.m.move(0, r.m.tickY(2));
  assert.equal(r.m.leave(), false, 'a plain card goes with the pointer');
  r.m.move(30, r.m.tickY(1));
  r.m.hover(1);
  assert.equal(r.m.move(10, r.m.tickY(1)), true, 'heading left towards a bookmark card');
  assert.equal(r.m.move(20, r.m.tickY(1)), false);
  assert.equal(r.m.pointing, true);
  assert.equal(r.m.leave(), true, 'a bookmark card stays while the pointer crosses the gap');
  assert.equal(r.m.pointing, false);
  r.m.seek({ state: 'dragging', id: 'q0', n: 1, total: 4 });
  assert.equal(r.m.leave(), false, 'never while seeking');
});

test('the seek card: meta, text and place, the busy tick while loading, and the card free again after', () => {
  const r = rail();
  assert.equal(r.m.seek({ state: 'idle' }), false, 'idle with no preview');
  r.m.move(0, r.m.tickY(4));
  r.m.hold(true);
  r.m.seek({ state: 'dragging', id: 'q1', n: 2, total: 5, unseen: true });
  assert.equal(r.m.pointing, false, 'seeking takes the wave from the pointer');
  assert.deepEqual(r.m.seekCard(), {
    meta: 'Question 2 of 5 · not opened yet',
    loading: false,
    text: 'Question 1',
    cy: r.m.tickY(1),
    busy: -1,
  });
  assert.deepEqual(r.m.hover(3), { seek: true });
  r.m.seek({ state: 'loading', id: 'q1', n: 2, total: 5 });
  assert.deepEqual([r.m.seekCard().meta, r.m.seekCard().busy], ['Loading question 2…', 1]);
  r.m.lang(true);
  r.m.seek({ state: 'dragging', id: 'q2', n: 3, total: 5 });
  assert.equal(r.m.seekCard().meta, '第 3 / 5 个问题');
  r.m.seek({ state: 'dragging', id: 'gone', n: 9, total: 9 });
  assert.equal(r.m.seekCard(), null, 'no tick for it');
  r.m.seek({ state: 'idle' });
  assert.equal(r.m.seeking, true, 'settled for a second');
  assert.equal(r.m.seekEnd(), null);
  assert.equal(r.m.seeking, false);
  assert.equal(r.m.hover(2).text, 'Question 2', 'not held any more');
});

test('keys: ArrowLeft into a card, arrows over the stops and the rows, ArrowRight and Escape back, Delete', () => {
  const r = rail({ count: 3, hasPrev: true });
  r.marks({ '-1': [false, false], q0: [false] });
  // Stops: the three dots, then the ticks; a question's bookmarks add none.
  assert.deepEqual(r.m.railKey('ArrowDown', EARLIER, 0, 4), { stop: 1 });
  assert.deepEqual(r.m.railKey('ArrowUp', 0, 1, 4), { stop: 0 });
  assert.deepEqual(r.m.railKey('ArrowDown', 2, 3, 4), { stop: 3 }, 'stays on the last');
  assert.equal(r.m.railKey('ArrowLeft', 1, 2, 4), null, 'q1 holds none');
  assert.equal(r.m.railKey('Enter', 1, 2, 4), null);
  r.m.hold(true);
  assert.deepEqual(r.m.railKey('ArrowLeft', EARLIER, 0, 4), { card: EARLIER });
  assert.equal(r.m.hover(EARLIER).earlier.meta, 'Earlier questions · 2 bookmarks', 'not held');
  assert.deepEqual(r.m.cardKey('ArrowDown', 0, 2), { row: 1 });
  assert.deepEqual(r.m.cardKey('ArrowDown', 1, 2), { row: 1 });
  assert.deepEqual(r.m.cardKey('ArrowUp', 1, 2), { row: 0 });
  assert.deepEqual(r.m.cardKey('Delete', 1, 2), { remove: 1 });
  assert.deepEqual(r.m.cardKey('Backspace', 0, 2), { remove: 0 });
  assert.equal(r.m.cardKey('Delete', -1, 2), null, 'not on a row');
  assert.deepEqual(r.m.cardKey('ArrowRight', 1, 2), { back: EARLIER, hide: false });
  assert.deepEqual(r.m.cardKey('Escape', 1, 2), { back: EARLIER, hide: false });
  r.m.journey({ wait: 'x' });
  assert.deepEqual(r.m.cardKey('Escape', 1, 2), { back: EARLIER, hide: true }, 'loading goes on');
  r.m.hover(-2);
  assert.equal(r.m.cardKey('ArrowDown', 0, 2), null, 'no bookmark card');
});

test('the card follows a deletion on the same row, and goes back to its tick when the last one goes', () => {
  const r = rail({ count: 4 });
  r.marks({ q1: [false, false, false] });
  r.m.hover(1);
  r.m.setMarks(r.m.rev, groups({ q1: [false, false] }));
  const f = r.m.refill(2);
  assert.equal(f.question.card.rows.length, 2);
  assert.equal(f.row, 1, 'the row index kept, within the rows left');
  assert.equal(f.cy, r.m.tickY(1));
  assert.equal(r.m.refill(-1).row, 0);
  r.m.setMarks(r.m.rev, groups({}));
  assert.deepEqual(r.m.refill(0), { back: 1 });
  r.m.hover(-2);
  assert.equal(r.m.refill(0), null, 'no card');
});

test('the earlier wait: marks of older items are not synced; a new items revision un-syncs them', () => {
  const r = rail({ count: 3, hasPrev: true });
  const rev = r.m.rev;
  r.m.setMarks(rev - 1, groups({}));
  assert.equal(r.m.synced(), false, 'an older revision');
  r.m.setMarks(rev, groups({}));
  assert.equal(r.m.synced(), true, "the items' revision");
  r.m.setMarks(rev + 3, groups({}));
  assert.equal(r.m.synced(), true, 'a later one');
  r.m.setMarks(rev, groups({}));
  r.m.page({ conv, before: 'q0', hasPrev: true, items: questions(1, -1) });
  assert.equal(r.m.synced(), false, 'a page prepended');
  r.m.setMarks(r.m.rev, groups({}));
  r.m.send({ conv, parent: 'q2', item: { id: 'q9', q: 'Sent' } });
  assert.equal(r.m.synced(), false, 'a send');
  r.m.setMarks(r.m.rev, groups({}));
  r.m.reconcile(['q2', 'q8', 'q9'], () => 'Mounted');
  assert.equal(r.m.synced(), false, 'a reconcile');
  r.m.setMarks(r.m.rev, groups({}));
  r.m.setMarks(null, groups({}));
  assert.equal(r.m.synced(), false, 'resolved against no items');
  r.m.setMarks(r.m.rev, groups({ q1: [false] }));
  const other = 'aaaaaaaa-0000-0000-0000-000000000001';
  r.m.open(other);
  assert.equal(r.m.synced(), false, 'another conversation');
  assert.equal(r.m.mark('q1'), undefined, 'its marks forgotten');
  // Back to a conversation kept in the tab, whose items are older than the other one's marks.
  r.m.page({ conv: other, before: null, hasPrev: false, items: questions(2) });
  r.m.setMarks(r.m.rev, groups({}));
  r.m.open(conv);
  assert.equal(r.m.synced(), false, "the other conversation's marks don't count");
});

test('placed: the question a bookmark is under now, never the three dots, never one not yet rendered', () => {
  const r = rail({ count: 2, hasPrev: true });
  r.m.setMarks(r.m.rev, groups({ '-1': [false] }));
  assert.equal(r.m.placed('-1-0'), null, 'on the three dots');
  r.m.page({ conv, before: 'q0', hasPrev: false, items: questions(1, -1) });
  r.m.setMarks(r.m.rev, groups({ 'q-1': [false] })); // loaded: it moved to its question
  assert.equal(r.m.placed('q-1-0'), null, 'the question has no tick until the next render');
  r.render();
  assert.equal(r.m.placed('q-1-0'), 'q-1');
  assert.equal(r.m.placed('nope'), null);
});

test('callers read a coherent snapshot but cannot change it', () => {
  const r = rail();
  assert.ok(Object.isFrozen(r.m.qs));
  assert.ok(Object.isFrozen(r.m.items));
  assert.throws(() => {
    r.m.shown = 3;
  }, TypeError);
  assert.equal(r.m.shown, -2);
});

test('long questions: the card cuts them at 400 characters with …, the seek card without', () => {
  const r = rail({ count: 2 });
  const long = 'x'.repeat(401);
  r.m.page({
    conv,
    before: null,
    hasPrev: false,
    items: [
      { id: 'a', q: long },
      { id: 'b', q: long.slice(1) },
    ],
  });
  r.render();
  assert.equal(r.m.hover(0).text, `${'x'.repeat(400)}…`);
  assert.equal(r.m.hover(1).text, 'x'.repeat(400), 'exactly 400: whole');
  r.m.seek({ state: 'dragging', id: 'a', n: 1, total: 2 });
  assert.equal(r.m.seekCard().text, 'x'.repeat(400));
  r.m.seekEnd();
  assert.equal(r.m.hover(0).instant, true, 'after the seek card, a card appears in place');
});

test('unshow forgets the card shown, so the next hover fills it afresh', () => {
  const r = rail();
  r.m.hover(1);
  assert.equal(r.m.hover(1), null);
  assert.equal(r.m.unshow(), 1);
  assert.equal(r.m.shown, -2);
  assert.equal(r.m.hover(1).text, 'Question 1');
});
