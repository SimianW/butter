// The u4 find-bar mode's analysis (lab/harness/stream-findbar-probe.mjs): the key presses' epoch
// stamps (xtest-type.py) against the page's frames and long-animation-frame entries, and the
// before-paint sample's REPORT lines (also u4's window.find watch in stream-ux-probe.mjs). No browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findbarAnalyse, findbarDrive, fmtFindbar } from '../lab/harness/stream-findbar-probe.mjs';
import { fmtPaint } from '../lab/harness/stream-ux-probe.mjs';

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

// The before-paint sample: a frame's sixth field, [in view, flags] read in a ResizeObserver on the
// block created after the marker's (after layout and the marker's `sized`, before paint), or
// absent when the block's size did not change in that frame.
const rendering = (paint) => [
  [9_990, 9_754, 59_000, false, 15],
  [10_600, 9_754, 59_000, false, 15],
  // The find has rendered the block before this frame: at its start, veiled and at opacity 0.
  [11_200, 68_000, 400, true, 11, [true, paint]],
  [11_300, 68_000, 400, true, 8],
  [15_600, 68_000, 400, true, 0],
];

test('findbarAnalyse: the fixed build draws the matched block unveiled in the frame it renders (flags 11 at the start, 8 before paint)', () => {
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: rendering(8),
    loaf: [],
    keys: [],
  });
  assert.deepEqual(a.rendered, {
    rt: 1200,
    sinceLastKey: 700,
    y: 68_000,
    flags: 11,
    beforePaint: 8,
  });
  assert.deepEqual(a.drawnAtOpacity0, { frames: 0, samples: 1 });
});

test('findbarAnalyse: the old build draws the matched block at opacity 0 in the frame it renders (flags 11 before paint)', () => {
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: rendering(11),
    loaf: [],
    keys: [],
  });
  assert.deepEqual(a.rendered, {
    rt: 1200,
    sinceLastKey: 700,
    y: 68_000,
    flags: 11,
    beforePaint: 11,
  });
  assert.deepEqual(a.drawnAtOpacity0, { frames: 1, samples: 1 });
});

test('findbarAnalyse: the rendered frame counts the before-paint sample when the frame starts with the block skipped', () => {
  // The find bar's activation lands in the frame, after its start: flags 15 at the start, 8 before paint.
  const fr = [
    [10_600, 9_754, 59_000, false, 15],
    [11_200, 68_000, 400, true, 15, [true, 8]],
    [11_300, 68_000, 400, true, 8],
  ];
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: fr,
    loaf: [],
    keys: [],
  });
  assert.deepEqual(a.rendered, {
    rt: 1200,
    sinceLastKey: 700,
    y: 68_000,
    flags: 15,
    beforePaint: 8,
  });
});

test('findbarAnalyse: only before-paint samples between Ctrl+F and Escape, in view, rendered and at opacity 0 count as frames drawn at opacity 0', () => {
  const fr = [
    [9_990, 9_754, 400, true, 11, [true, 11]], // before Ctrl+F
    [10_600, 9_754, 59_000, false, 15, [false, 11]], // out of view
    [10_700, 9_754, 59_000, false, 15, [true, 15]], // skipped: nothing drawn
    [11_200, 68_000, 400, true, 11, [true, 11]], // counts
    [11_300, 68_000, 400, true, 11, [true, 9]], // veil attribute, but not at opacity 0
    [11_400, 68_000, 400, true, 8, [true, 8]],
    [15_600, 68_000, 400, true, 11, [true, 11]], // after Escape
  ];
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: fr,
    loaf: [],
    keys: [],
  });
  assert.deepEqual(a.drawnAtOpacity0, { frames: 1, samples: 5 });
});

test('findbarAnalyse: no rendered frame when the block never renders in view before Escape', () => {
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: frames.slice(0, 3),
    loaf: [],
    keys: [],
  });
  assert.equal(a.rendered, null);
  assert.deepEqual(a.drawnAtOpacity0, { frames: 0, samples: 0 });
});

test('fmtFindbar: the before-paint line follows the existing lines, which stay as they were', () => {
  const a = findbarAnalyse({
    timeOrigin: ORIGIN,
    stamps: stamps(),
    frames: rendering(8),
    loaf: [],
    keys: [],
  });
  const f = {
    ...a,
    len: 18,
    block: 198,
    held: { candidates: 40, blocks: 242, veiledAny: true },
    flagsBefore: 15,
    y0: 9754,
    gapMs: 100,
    keyError: null,
    selLen: 18,
    selInBlock: true,
    flagsEnd: 0,
    longtask: { frames: 0, blocking: 0, longest: 0, longestAt: null },
  };
  const lines = fmtFindbar('ux u4', f);
  assert.equal(lines.length, 4);
  assert.match(lines[2], /^ux u4 u4 find bar frames \(LoAF/);
  assert.equal(
    lines[3],
    "ux u4 u4 find bar before paint (a ResizeObserver on the block after the marker's; frames where its size changed): first rendered in view (not skipped) +1200 ms (700 ms after the last key; scrollTop 68000), flags at the frame's start 11, before paint 8; frames drawn with the matched block rendered at opacity 0, Ctrl+F to Escape: 0 (of 1 before-paint samples)",
  );
});

test("fmtPaint: u4's window.find watch reports the first rendered frame and the frames drawn at opacity 0 from its rows", () => {
  // Rows as u4's watch records them: the frame's start, and `paint` before paint (null: no report).
  const row = (n, inView, f, paint) => ({ n, t: n * 16.7, inView, f, paint });
  const w = {
    rows: [row(1, false, 15, [false, 15]), row(2, true, 11, [true, 11]), row(3, true, 8, null)],
  };
  assert.equal(
    fmtPaint(w),
    'first frame rendered in view (not skipped) 2 (33.4 ms), flags at its start 11, before paint 11; frames drawn with the block rendered at opacity 0 1 (of 2 before-paint samples in 90 frames)',
  );
  assert.equal(
    fmtPaint({ rows: [row(1, false, 15, [false, 15])] }, 30),
    'first frame rendered in view (not skipped) never in 30; frames drawn with the block rendered at opacity 0 0 (of 1 before-paint samples in 30 frames)',
  );
  assert.equal(fmtPaint({ none: true }), 'no candidate block');
});

test("fmtPaint: a report before the watch's first frame is the act's own frame, when the act ran in a frame's rAF", () => {
  const row = (n, inView, f, paint) => ({ n, t: n * 16.7, inView, f, paint });
  const rows = [row(1, true, 8, null), row(2, false, 8, null)];
  assert.equal(
    fmtPaint({ rows, paint0: [true, 11] }),
    "first frame rendered in view (not skipped) 0 (the act's own frame), flags at its start -, before paint 11; frames drawn with the block rendered at opacity 0 1 (of 1 before-paint samples in 90 frames and the act's own)",
  );
  assert.equal(
    fmtPaint({ rows, paint0: [true, 8] }),
    "first frame rendered in view (not skipped) 0 (the act's own frame), flags at its start -, before paint 8; frames drawn with the block rendered at opacity 0 0 (of 1 before-paint samples in 90 frames and the act's own)",
  );
});

test("findbarDrive: the X input helper's error is returned, with the probe stopped, when it throws", async () => {
  // A fake page: the first evaluate installs the probe, the next one stops it and returns its samples.
  let stopped = false;
  const raw = { timeOrigin: ORIGIN, frames, loaf: [], lt: [], keys: [], selLen: 0 };
  const page = {
    evaluate: async () => {
      if (page.installed) return ((stopped = true), raw);
      page.installed = true;
      return { at: { x: 1, y: 2 }, str: 'zq200zq' };
    },
  };
  const run = () => {
    throw new Error('xtest-type.py: cannot open display :99');
  };
  const r = await findbarDrive(page, {}, ':99', run);
  assert.equal(r.keyError, 'xtest-type.py: cannot open display :99');
  assert.ok(stopped, 'the probe stopped');
  assert.equal(r.str, undefined, 'the search string is not reported');
});
