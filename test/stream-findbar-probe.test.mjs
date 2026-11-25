// The u4 find-bar mode's analysis (lab/harness/stream-findbar-probe.mjs): the key presses' epoch
// stamps (xtest-type.py) against the page's frames and long-animation-frame entries. No browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findbarAnalyse } from '../lab/harness/stream-findbar-probe.mjs';

// The page's clock starts at epoch 1,000,000 ms; Ctrl+F is pressed at page time 10,000.
const ORIGIN = 1_000_000;
const stamps = (chars = [10_300, 10_400, 10_500], esc = 15_500) => [
  { step: 1, kind: 'chord', at: ORIGIN + 10_000 },
  ...chars.map((t) => ({ step: 3, kind: 'char', at: ORIGIN + t })),
  { step: 5, kind: 'chord', at: ORIGIN + esc },
];
// A frame: [page ms, scrollTop, target top in the view, in view, flags (1 veil, 2 opacity 0, 4 skipped, 8 held)]
const frames = [
  [9_990, 9_754, 59_000, false, 15],
  [10_100, 9_754, 59_000, false, 15],
  [10_600, 9_754, 59_000, false, 15],
  [11_200, 68_000, 400, true, 15],
  [11_300, 68_000, 400, true, 8],
  [11_400, 68_010, 390, true, 8],
  [15_600, 68_010, 390, true, 0],
];

test('findbarAnalyse: the match is the first frame with the target in view, timed from Ctrl+F and from the last key', () => {
  const a = findbarAnalyse({ timeOrigin: ORIGIN, stamps: stamps(), frames, loaf: [], keys: [] });
  assert.deepEqual(a.match, { rt: 1200, sinceLastKey: 700, y: 68_000, flags: 15 });
  assert.deepEqual(a.matchDrawn, { rt: 1300, sinceLastKey: 800, y: 68_000, flags: 8 });
});

test('findbarAnalyse: no match when the target never comes into view before Escape', () => {
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: frames.slice(0, 3),
    loaf: [],
    keys: [],
  });
  assert.equal(a.match, null);
  assert.equal(a.matchDrawn, null);
});

test('findbarAnalyse: blocking and the longest frame count the frames that start between Ctrl+F and Escape, and to the drawn match', () => {
  // [start, duration, blocking]
  const loaf = [
    [9_900, 300, 250], // before Ctrl+F
    [10_350, 120, 70],
    [10_800, 400, 350],
    [11_350, 90, 40], // after the drawn match (11,300), before Escape
    [15_600, 200, 150], // after Escape
  ];
  const a = findbarAnalyse({ timeOrigin: ORIGIN, stamps: stamps(), frames, loaf, keys: [] });
  assert.deepEqual(a.find, { frames: 3, blocking: 460, longest: 400, longestAt: 800 });
  assert.deepEqual(a.toMatch, { frames: 2, blocking: 420, longest: 400, longestAt: 800 });
  assert.deepEqual(a.afterEsc, { frames: 1, blocking: 150, longest: 200, longestAt: 5600 });
});

test('findbarAnalyse: key times, scroll moves and the clock check against the page keydown for Ctrl+F', () => {
  const keys = [
    [10_001.5, 'ControlLeft', true],
    [10_002, 'KeyF', true],
  ];
  const a = findbarAnalyse({ timeOrigin: ORIGIN, stamps: stamps(), frames, loaf: [], keys });
  assert.deepEqual(a.keys, { chars: 3, lastKey: 500, escape: 5500, gapMedian: 100, pageCtrlF: 2 });
  assert.deepEqual(a.scroll, { y0: 9_754, moves: 2, first: 1200, last: 1400, yEnd: 68_010 });
  // The sampled frames' own longest interval in the find window.
  assert.equal(a.frameMax, 4200);
});

test('findbarAnalyse: the settled match is where the block last comes into view and stays until Escape', () => {
  // A prefix's match brings the block into view at +700, the next key moves away, the full string brings it back at +1200.
  const fr = [
    [9_990, 9_754, 59_000, false, 15],
    [10_700, 67_000, 300, true, 15],
    [10_900, 20_000, 47_000, false, 15],
    [11_200, 68_000, 400, true, 15],
    [11_300, 68_000, 400, true, 8],
    [15_400, 68_000, 400, true, 8],
  ];
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: fr,
    loaf: [],
    keys: [],
  });
  assert.equal(a.match.rt, 700);
  assert.deepEqual(a.settled, { rt: 1200, sinceLastKey: 700, y: 68_000, flags: 15 });
  assert.deepEqual(a.settledDrawn, { rt: 1300, sinceLastKey: 800, y: 68_000, flags: 8 });
});
