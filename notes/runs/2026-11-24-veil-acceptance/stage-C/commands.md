# Commands: veil acceptance, stage C (#177), 2026-11-24

Run from the worktree of branch `veil/177-stage-c` (based on `feat/implement-spec-170` at `cc31be6`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-C` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

## Builds (reused from stage A, not rebuilt)

```sh
for n in head veil; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n check ok"; done
grep -c veil $D/*/butter/stream/containment.css
diff -rq $D/head/butter $D/veil/butter
# against the two commits:
for p in head:547fa0a veil:e5f480e; do n=${p%%:*}; s=${p#*:}; mkdir $n; git archive $s extension | tar -x -C $n; diff -rq $n/extension $D/$n/butter; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head check ok
  "version_name": "0.1.0-alpha.22+veilaccept.veil",
veil check ok
.../veil/butter/stream/containment.css:16
.../head/butter/stream/containment.css:0
Files .../head/butter/dev/allowlist.js and .../veil/butter/dev/allowlist.js differ
Files .../head/butter/manifest.json and .../veil/butter/manifest.json differ
Files .../head/butter/stream/containment.css and .../veil/butter/stream/containment.css differ
Files .../head/butter/stream/offscreen.js and .../veil/butter/stream/offscreen.js differ
Files head/extension/manifest.json and .../head/butter/manifest.json differ
Files veil/extension/manifest.json and .../veil/butter/manifest.json differ
```

- Against `git archive` of `547fa0a` (head) and `e5f480e` (veil), the only difference is `manifest.json`'s
  `version_name` suffix (`0.1.0-alpha.22` → `0.1.0-alpha.22+veilaccept.<build>`).

## Lock, runs, restore and release (one script, one lock)

The driver script (`/tmp/va177c/seq.sh`, kept local) has stage B's shape: it took the lock with the fixture
named, ran head and veil in turn, refused to start a run after 1500 s of the budget clock, after 10 runs or
after a `FAIL no-escape`/`FAIL server-unchanged`, and ran restore and release from an exit trap. Every run
used the same `U2_BLOCK=306` (the study's block, the held block nearest the middle of `ats12`'s 612):

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-C --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil:
env LAB_ID=$LAB LAB_OWNER=veil-accept-C EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u1,u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-C
$B/lab-lock release --lab $LAB --owner veil-accept-C
$B/lab-lock status
```

The first try, with `--wait 1800`, timed out without a lock: lab 2 went from one of another task's owners to
the next (`rail-pin-171e`, then `rail-pin-171f`), and `lab-lock` has no queue. No lab was held, so there was
nothing to restore or release. The second try waited 2 min 33 s:

```text
acquire start 2026-11-25T03:01:04Z
lab-lock: no lab free within 1800.0s (lab 2: rail-pin-171f; perf: free)
lab= exit=75 at 2026-11-25T03:31:05Z
acquire start 2026-11-25T03:31:17Z
lab=2 exit=0 at 2026-11-25T03:33:50Z
```

The budget clock starts at 03:33:50Z, when the lock was taken.

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-ux-1` | head | 0 | 202 s | 202 s |
| 2 | `veil-ats12-ux-1` | veil | 0 | 203 s | 405 s |
| 3 | `head-ats12-ux-2` | head | 0 | 203 s | 608 s |
| 4 | `veil-ats12-ux-2` | veil | 0 | 202 s | 810 s |
| 5 | `head-ats12-ux-3` | head | 0 | 205 s | 1015 s |
| 6 | `veil-ats12-ux-3` | veil | 0 | 199 s | 1214 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 03:54:15Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T03:54:15Z since-lock=1225s
```

Six harness runs, 20 min 25 s from lock to release.

## Splitting u1 from u2 (`split.jsonl`)

With `UX=u1,u2` in one run, the probe writes scrollTop to the end at completion (u1) and onto block 306 at
+2 s (u2). It settles only once (`U.settle` is set at the first frame ≥ 100 ms after the u1 write), so its
anchor is u1's end block (606 or 610) for the whole window, and its `REPORT ux u1+u2 (i)` and `(ii)` lines
cover both jumps together. `split.jsonl` re-cuts each run's `summary.ux` (`compact`: one row per frame with
scrollTop, scrollHeight, the anchor's top at the frame's start, the centre block and the 7 points' flags;
`acts`; `shift`/`shiftPost` jump lists, all ≤ 20 jumps, so complete) at the u2 write:

- **u1 window:** frames from the u1 write up to the u2 write. Blank frames as the probe counts them (a
  tested point on a block with flag 1 veil, 2 opacity 0 or 4 content skipped; longest consecutive run, ms
  from its first frame to the frame after it). Jumps > 4 px of the anchor from the probe's own lists,
  minus the u2 write.
- **u2 window:** frames from the u2 write on, the same blank-frame count; the jumps the write itself makes
  (the drawn sample of the frame just before the write can land after it: a jump equal to the write's
  scrollTop change is the write); and, from the u2 settle frame (first ≥ 100 ms after the write), the
  anchor's jumps, scrollTop changes and the centre block's index.

```js
// /tmp/va177c/split.mjs <run.json>...: one JSON line per run (as committed in split.jsonl)
import fs from 'node:fs';
const r1 = v => Math.round(v * 10) / 10;
function runs(fr, mask) {
  let n = 0, best = { frames: 0, ms: 0, from: null }, cur = null;
  fr.forEach((f, j) => {
    const hit = f[7].some(p => p >= 0 && (p & mask));
    if (hit) { n++; cur = cur ? { ...cur, frames: cur.frames + 1 } : { frames: 1, from: f[0] }; const end = fr[j + 1]?.[0] ?? f[0]; const ms = r1(end - cur.from); if (cur.frames > best.frames || (cur.frames === best.frames && ms > best.ms)) best = { frames: cur.frames, ms, from: cur.from }; }
    else cur = null;
  });
  return { frames: n, ...best };
}
for (const file of process.argv.slice(2)) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8')), u = s.ux;
  const name = file.split('/').pop().replace('.json', '');
  const end = u.acts.find(a => a.kind === 'end'), mid = u.acts.find(a => a.kind === 'mid');
  const C = u.compact, w1 = C.filter(f => f[0] >= end.rt && f[0] < mid.rt), w2 = C.filter(f => f[0] >= mid.rt);
  const blank = w => ({ any: runs(w, 7), veil: runs(w, 3), skipped: runs(w, 4) });
  const b1 = blank(w1), b2 = blank(w2);
  const pj = u.shiftPost?.firstJumps ?? [], sj = u.shift?.firstJumps ?? [];
  const complete = (u.shiftPost?.jumps ?? 0) <= 20 && (u.shift?.jumps ?? 0) <= 20;
  const settle2 = C.find(f => f[0] >= mid.rt + 100)?.[0];
  const prevF = [...C].reverse().find(f => f[0] < mid.rt)?.[0];
  const isWrite = j => j.rt >= prevF && j.rt < settle2 && Math.abs(j.d - (mid.y0 - mid.y1)) < 5;
  const in1 = j => j.rt < mid.rt && !isWrite(j), inW = j => j.rt < settle2 && (j.rt >= mid.rt || isWrite(j)), in2 = j => j.rt >= settle2;
  const w2s = C.filter(f => f[0] >= settle2);
  const aj = [], yj = [], cs = new Set(), cc = [];
  w2s.forEach((f, j) => { cs.add(f[6]); if (!j || f[6] !== w2s[j - 1][6]) cc.push(`${f[6]}@${f[0]}`); if (!j) return; const p = w2s[j - 1]; if (f[5] != null && p[5] != null && Math.abs(f[5] - p[5]) > 4) aj.push(`${r1(f[5] - p[5])}@${f[0]}`); if (Math.abs(f[1] - p[1]) > 0.5) yj.push(`${r1(f[1] - p[1])}@${f[0]}`); });
  console.log(JSON.stringify({ name, gone: u.goneAfterEnter, u1: { at: end.rt, y: [end.y0, end.y1], settle: u.settle?.rt, anchorBlock: u.end?.centreAtSettle, frames: w1.length,
      blankLongest: { any: [b1.any.frames, b1.any.ms, b1.any.from], veil: [b1.veil.frames, b1.veil.ms], skipped: [b1.skipped.frames, b1.skipped.ms] }, blankTotal: b1.any.frames,
      jumpsDrawn: pj.filter(in1).map(j => `${j.d}@${j.rt}`), jumpsStart: sj.filter(in1).map(j => `${j.d}@${j.rt}`) },
    u2: { at: mid.rt, y: [mid.y0, mid.y1], info: mid.info, settle: settle2, frames: w2.length,
      blankLongest: { any: [b2.any.frames, b2.any.ms, b2.any.from], veil: [b2.veil.frames, b2.veil.ms], skipped: [b2.skipped.frames, b2.skipped.ms] }, blankTotal: b2.any.frames,
      writeJumpsDrawn: pj.filter(inW).map(j => `${j.d}@${j.rt}`), jumpsDrawnAfterSettle: pj.filter(in2).map(j => `${j.d}@${j.rt}`), jumpsStartAfterSettle: aj, scrollTopChangesAfterSettle: yj, centreBlocks: [...cs], centreChanges: cc, centreAtWrite: C.filter(f => f[0] >= mid.rt && f[0] < settle2).map(f => `${f[6]}@${f[0]}`) },
    totals: { drawnJumps: u.shiftPost?.jumps, startJumps: u.shift?.jumps, reanchors: u.shift?.reanchors, listComplete: complete, postLag: u.shiftPost?.lagMedian }, endState: u.endState, leaks: u.leaks }));
}
```
```sh
node /tmp/va177c/split.mjs $C/{head,veil}-ats12-ux-{1,2,3}.json > split.jsonl
```

The long animation frames after the u2 write (summary.md, "u2 blank frames last longer") come from each run's
`lafDetail.frames` in `$C/<name>.json`, filtered to starts from 60 ms before to 600 ms after the write.

## Logs

`<name>.log` is each run's full harness output plus the driver's exit/time line; `restore.log` and
`release.log` as printed (home URL replaced by `<home-url>`, the home folder by `~`). `split.jsonl` holds
block indexes, px, ms and flags only. The raw logs and per-run JSON stay in `C`. A scan of the committed
files for chat URLs, email addresses and home paths found none after those two replacements.
