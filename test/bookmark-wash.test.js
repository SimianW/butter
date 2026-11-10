const test = require('node:test'),
  assert = require('node:assert/strict');
const W = require('../extension/bookmarks/wash.js');

// Three rendered lines of a bookmarked paragraph: two full ones and a short last one.
const WIDTHS = [300, 300, 150];

test('the sweep fills the lines in reading order, one after another, in 360 ms', () => {
  const { sweep } = W.plan(WIDTHS);
  assert.equal(sweep.length, 3);
  // Each line starts when the one before it is full; the first at once, the last ends at 360 ms.
  assert.equal(sweep[0].at, 0);
  for (let i = 1; i < sweep.length; i++)
    assert.ok(Math.abs(sweep[i].at - (sweep[i - 1].at + sweep[i - 1].ms)) < 1e-9);
  assert.ok(sweep.every((s) => s.ms > 0));
  assert.ok(Math.abs(sweep.reduce((t, s) => t + s.ms, 0) - 360) < 1e-6);
});

test("each line takes a share of the sweep's progress in proportion to its width", () => {
  const { sweep } = W.plan(WIDTHS);
  // 300 + 300 + 150 px: 40 %, 40 % and 20 % of the range.
  assert.deepEqual(
    sweep.map((s) => [s.from, s.to]),
    [
      [0, 0.4],
      [0.4, 0.8],
      [0.8, 1],
    ],
  );
});

test('the easing runs over the whole range: the sweep starts fast and slows into its last line', () => {
  const { sweep, easing } = W.plan(WIDTHS);
  assert.equal(easing, 'cubic-bezier(.3, .7, .3, 1)');
  // cubic-bezier(.3, .7, .3, 1) is past 40 % of its progress well before 40 % of its time, and the
  // last 20 % of the range takes far more than 20 % of the time.
  assert.ok(sweep[0].ms < 0.4 * 360 * 0.6, `first line ${sweep[0].ms} ms`);
  assert.ok(sweep[2].ms > 0.2 * 360 * 2, `last line ${sweep[2].ms} ms`);
});

test('after the sweep the wash holds 1.2 s and fades over 0.9 s, ease-out, then it is gone', () => {
  const p = W.plan(WIDTHS);
  assert.deepEqual([p.in, p.hold, p.fade, p.fadeEasing], [360, 1200, 900, 'ease-out']);
  assert.equal(p.total, 360 + 1200 + 900);
});

test('under reduced motion there is no sweep: every line shows at once, then the same hold and fade', () => {
  const p = W.plan(WIDTHS, { reduced: true });
  assert.deepEqual(
    p.sweep.map((s) => [s.at, s.ms]),
    [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  );
  assert.deepEqual([p.in, p.hold, p.fade, p.total], [0, 1200, 900, 2100]);
});

// A range's client rectangles, as Chrome lists them: one per text run and line, plus one for an
// element the range holds whole (here a <b> on the first line).
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const RECTS = [
  rect(70, 63, 160, 79), // "A partial index on "
  rect(160, 63, 220, 79), // <b>the rare</b>
  rect(160, 63, 220, 79), // its text node
  rect(220, 63, 449, 79), // " statuses stays small, and the"
  rect(70, 86.2, 419, 102.2), // next line
  rect(70, 109.4, 275, 125.4), // last line
];

test('the wash has one box per rendered line, reaching 2 px above and below its text', () => {
  assert.deepEqual(W.boxes(RECTS), [
    { left: 70, top: 61, width: 379, height: 20 },
    { left: 70, top: 84.2, width: 349, height: 20 },
    { left: 70, top: 107.4, width: 205, height: 20 },
  ]);
});

test('empty rectangles (a collapsed run, a line break) are not lines', () => {
  assert.deepEqual(W.boxes([rect(70, 63, 70, 79), rect(70, 63, 120, 63), rect(70, 86, 120, 102)]), [
    { left: 70, top: 84, width: 50, height: 20 },
  ]);
});

// #74: a bookmarked code block or table gets one box over the whole block.
test('a code block or a table fades in over 160 ms instead of sweeping, then holds 1.2 s and fades over 0.9 s', () => {
  const p = W.plan([386], { block: true });
  assert.deepEqual(
    p.sweep.map((s) => [s.from, s.to]),
    [[0, 1]],
  );
  assert.equal(p.fadeIn, true);
  assert.deepEqual(
    [p.in, p.hold, p.fade, p.fadeEasing, p.total],
    [160, 1200, 900, 'ease-out', 2260],
  );
});

test('under reduced motion a block appears at once, then holds and fades the same way', () => {
  const p = W.plan([386], { block: true, reduced: true });
  assert.equal(p.fadeIn, false);
  assert.deepEqual([p.in, p.hold, p.fade, p.total], [0, 1200, 900, 2100]);
});

test('a text range sweeps: it does not fade in', () => {
  assert.equal(W.plan(WIDTHS).fadeIn, false);
});

test("a block's box reaches 3 px beyond the block, its corners following the block's own", () => {
  // The mockup's code block: 386 x 63 px at (70, 200), radius 10 px.
  assert.deepEqual(W.blockBox(rect(70, 200, 456, 263), 10), {
    left: 67,
    top: 197,
    width: 392,
    height: 69,
    radius: 13,
    gap: [0, 0, 0, 0],
  });
  // A table with square corners keeps them rounded only by the 3 px reach.
  assert.deepEqual(W.blockBox(rect(70.5, 10.25, 370.5, 110.25), 0), {
    left: 67.5,
    top: 7.25,
    width: 306,
    height: 106,
    radius: 3,
    gap: [0, 0, 0, 0],
  });
});

test("a block's own border stays clear of the wash, as its text does: the fill starts inside it", () => {
  // The mockup's code block has a 1 px border: the ring outside it and the fill inside it are
  // washed, the border line itself keeps its colour.
  assert.deepEqual(W.blockBox(rect(70, 200, 456, 263), 10, [1, 1, 1, 1]).gap, [1, 1, 1, 1]);
  assert.deepEqual(W.blockBox(rect(70, 200, 456, 263), 10).gap, [0, 0, 0, 0]);
});
