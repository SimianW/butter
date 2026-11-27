// The report of lab/harness/stream-unmarked-probe.mjs (#172): answer blocks of a streamed answer
// that are neither data-butter-seen nor data-butter-unrendered after completion. Pure, no browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import { unmarkedReport } from '../lab/harness/stream-unmarked-probe.mjs';

const hr = (idx, extra = {}) => ({
  idx,
  tag: 'hr',
  renderer: 'classic',
  cssHeight: '0px',
  borderTop: '1px',
  textLen: 0,
  watched: true,
  ro: [0],
  skipped: 1,
  rendered: 0,
  cvNow: 'visible',
  ...extra,
});
const line = (lines, start) => lines.find((l) => l.startsWith(start));
const base = {
  n: 10,
  seen: 2,
  unrendered: 5,
  samples: [],
  removed: [],
  insertedAfterGone: 0,
  gone: 100000,
};

test('unmarkedReport: counts the unmarked blocks by element and renderer, adding up to the total', () => {
  const lines = unmarkedReport({
    ...base,
    rows: [hr(3), hr(7), hr(9, { tag: 'p', renderer: 'dil' })],
  });
  assert.equal(
    lines[0],
    'unmarked blocks after the window: 3 of 10 (seen 2, unrendered 5); by kind: hr classic 2, p dil 1; positions (block index of 10): hr classic [3 7], p dil [9]',
  );
});

test('unmarkedReport: says per kind whether the marker watched the blocks and what sizes its ResizeObserver could report', () => {
  const rows = [
    hr(3, { ro: [0, 0] }),
    hr(7),
    hr(8, { watched: false, ro: [] }),
    hr(9, { tag: 'p', cssHeight: '24px', borderTop: '0px', textLen: 40, ro: [0, 24] }),
  ];
  const lines = unmarkedReport({ ...base, rows });
  assert.equal(
    lines[1],
    'why never queued: never watched 1; watched, content box never above 0: 2; watched, content box above 0 at some report: 1',
  );
  assert.equal(
    lines[2],
    'kind hr classic: computed height 0px, border-top 1px, text length 0, ResizeObserver content heights seen [0], skipped events 3, rendered events 0, content-visibility after the window visible',
  );
  assert.equal(
    lines[3],
    'kind p classic: computed height 24px, border-top 0px, text length 40, ResizeObserver content heights seen [0 24], skipped events 1, rendered events 0, content-visibility after the window visible',
  );
});

test('unmarkedReport: says when the unmarked blocks were outside the content-visibility auto rules, and what ChatGPT replaced at completion', () => {
  const samples = [
    { t: 50000, inProgress: true, cand: 4, candAuto: 4 },
    { t: 60000, inProgress: true, cand: 6, candAuto: 5 },
    { t: 99000, inProgress: true, cand: 9, candAuto: 9 },
    { t: 100200, inProgress: false, cand: 9, candAuto: 0 },
  ];
  const lines = unmarkedReport({
    ...base,
    rows: [hr(3)],
    samples,
    removed: [40000, 100100, 101500, 103000],
    insertedAfterGone: 2,
  });
  assert.equal(
    line(lines, 'under the auto'),
    'under the auto rules: 3 samples while in_progress, never-queued blocks 4-9, some not content-visibility auto in 1 (first at 60000 ms: 5 of 6 auto); first sample after in_progress gone at 100200 ms: 0 of 9 auto',
  );
  assert.equal(
    line(lines, 'replaced:'),
    'replaced: watched answer blocks removed 4 (2 within 2 s after in_progress gone at 100000 ms); blocks inserted after in_progress gone 2',
  );
});

test("unmarkedReport: lists every unmarked block with its neighbours, display and data-* names, and counts all the answer's blocks of the same elements", () => {
  const rows = [
    hr(3, { prev: 'p', next: 'h1', display: 'block', rectH: 1, data: [] }),
    hr(7, { prev: 'ol', next: 'h2', display: 'block', rectH: 1, data: ['data-start'] }),
  ];
  const lines = unmarkedReport({
    ...base,
    rows,
    sameTag: { hr: { all: 2, marked: 0 } },
    markedNeverAbove0: 0,
  });
  assert.equal(
    line(lines, 'unmarked block detail'),
    'unmarked block detail (index tag renderer display rect-height prev>next [data-*]): 3 hr classic block 1 p>h1 [], 7 hr classic block 1 ol>h2 [data-start]',
  );
  assert.equal(
    line(lines, 'same elements'),
    'same elements across the answer: hr 2 (marked 0); marked blocks whose ResizeObserver content box was never above 0: 0',
  );
});
