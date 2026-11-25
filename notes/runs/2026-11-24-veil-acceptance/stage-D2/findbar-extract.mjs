// Stage D2: one JSON line per run of the u4 find-bar mode (summary.ux.u4.findbar in each run's OUT
// JSON), then the medians per build. Numbers only; no page text. Judges nothing.
// node findbar-extract.mjs <run>.json ...
import fs from 'node:fs';
import path from 'node:path';

const median = (a) => {
  const b = a.filter((v) => v != null).sort((x, y) => x - y), m = b.length >> 1;
  return !b.length ? null : b.length % 2 ? b[m] : Math.round(((b[m - 1] + b[m]) / 2) * 10) / 10;
};
const rows = process.argv.slice(2).map((f) => {
  const s = JSON.parse(fs.readFileSync(f, 'utf8')), fb = s.ux?.u4?.findbar ?? {};
  return {
    run: path.basename(f, '.json'), build: s.build, block: fb.block, len: fb.len, flagsBefore: fb.flagsBefore, y0: fb.y0,
    lastKey: fb.keys?.lastKey, escape: fb.keys?.escape, pageCtrlF: fb.keys?.pageCtrlF,
    firstInView: fb.match?.rt ?? null, settled: fb.settled?.rt ?? null, settledSinceLastKey: fb.settled?.sinceLastKey ?? null,
    settledDrawn: fb.settledDrawn?.rt ?? null, flagsAtSettled: fb.settled?.flags ?? null, scrollMoves: fb.scroll?.moves, lastScroll: fb.scroll?.last, yEnd: fb.scroll?.yEnd,
    findBlocking: fb.find?.blocking, findLongest: fb.find?.longest, findLongestAt: fb.find?.longestAt, findFrames: fb.find?.frames,
    toMatchBlocking: fb.toMatch?.blocking, toMatchLongest: fb.toMatch?.longest, frameMax: fb.frameMax,
    escBlocking: fb.afterEsc?.blocking, escLongest: fb.afterEsc?.longest, longtaskBlocking: fb.longtask?.blocking,
    selLen: fb.selLen, selInBlock: fb.selInBlock, flagsEnd: fb.flagsEnd, keyError: fb.keyError ?? null, driveError: s.ux?.driveError ?? null,
  };
});
for (const r of rows) console.log(JSON.stringify(r));
const keys = ['firstInView', 'settled', 'settledSinceLastKey', 'settledDrawn', 'lastScroll', 'findBlocking', 'findLongest', 'toMatchBlocking', 'toMatchLongest', 'frameMax', 'escBlocking', 'escLongest'];
for (const b of ['head', 'veil']) {
  const rs = rows.filter((r) => r.run.startsWith(b));
  console.log(JSON.stringify({ median: b, n: rs.length, ...Object.fromEntries(keys.map((k) => [k, median(rs.map((r) => r[k]))])) }));
}
