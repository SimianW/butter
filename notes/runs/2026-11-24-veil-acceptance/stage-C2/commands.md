# Commands: veil acceptance, stage C2 (#177), 2026-11-24

Run from the worktree of branch `veil/177-stage-c2` (based on `feat/implement-spec-170` at `801057d`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-C2` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

## Probe check before the runs

`lab/harness/stream-ux-probe.mjs` with `UX=u2` alone: `onGone` schedules only `act('mid', toMid)` at +2 s
(no u1 write), `act` sets `U.settleAt` to the write + 100 ms, and the frame sampler picks the anchor at the
first frame at or after that time as the block under the view's centre (`pickAnchor(g, 'settle')`). The
anchor is therefore a block in the view after the u2 write, not stage C's end block. `toMid` with
`U2_BLOCK=306` puts block 306 40 px above the view's centre.

## Builds (reused from stage A, not rebuilt)

```sh
for n in head veil; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n check ok"; done
for p in head:547fa0a veil:e5f480e; do n=${p%%:*}; s=${p#*:}; T=$(mktemp -d); git archive $s extension | tar -x -C $T; echo "== $n vs $s"; diff -rq $T/extension $D/$n/butter; rm -rf $T; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head check ok
  "version_name": "0.1.0-alpha.22+veilaccept.veil",
veil check ok
== head vs 547fa0a
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/head/butter/manifest.json differ
== veil vs e5f480e
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/veil/butter/manifest.json differ
```

The only difference from each commit is `manifest.json`'s `version_name` suffix.

## Lock, runs, restore and release (one script, one lock)

The driver (`/tmp/va177c2/seq.sh`, kept local) is stage C's with `UX=u2`, owner `veil-accept-C2` and run
names `<build>-ats12-u2-<i>`. It took the lock with the fixture named, ran head and veil in turn, refused to
start a run after 1500 s of the budget clock, after 10 runs or after a `FAIL no-escape`/`FAIL server-unchanged`,
and ran restore and release from an exit trap:

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-C2 --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil:
env LAB_ID=$LAB LAB_OWNER=veil-accept-C2 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-C2
$B/lab-lock release --lab $LAB --owner veil-accept-C2
$B/lab-lock status
```
```text
acquire start 2026-11-25T03:59:26Z
lab=2 exit=0 at 2026-11-25T03:59:26Z
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-u2-1` | head | 0 | 200 s | 200 s |
| 2 | `veil-ats12-u2-1` | veil | 0 | 199 s | 399 s |
| 3 | `head-ats12-u2-2` | head | 0 | 202 s | 601 s |
| 4 | `veil-ats12-u2-2` | veil | 0 | 203 s | 804 s |
| 5 | `head-ats12-u2-3` | head | 0 | 199 s | 1003 s |
| 6 | `veil-ats12-u2-3` | veil | 0 | 202 s | 1205 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 04:19:42Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T04:19:42Z since-lock=1216s
```

Six harness runs, 20 min 16 s from lock to release.

## Per-run numbers (`u2.jsonl`)

`u2.jsonl` holds one line per run, cut from each run's `summary.ux` and `summary.lafDetail`:

- **blank:** the longest run of consecutive frames from the u2 write on with a tested point on a block
  with flag 1 (veil), 2 (opacity 0) or 4 (content skipped), ms from its first frame to the frame after it
  (the probe's own `afterAct.any` is alongside and agrees); `writeToClearMs`: from the write to the first
  frame with no such point after the first one with one.
- **around:** the frames from the one before the write: ms after completion, interval to the next frame,
  scrollTop, scrollHeight, centre block and the 7 points' blank bits (`-` no answer block).
- **lafAfterWrite:** long-animation-frame entries (≥ 50 ms) that end after the write and start within
  600 ms of it, in ms after the write: duration, script part (start to renderStart), rAF part, render part
  (styleAndLayoutStart to end), blocking, forced style/layout and the scripts of at least 5 ms.
- **drawn / start:** the probe's view-shift jumps after drawing (`shiftPost`) and at the frame's start
  (`shift`), from its settle frame; `anchors`: the anchor picks.

```js
// /tmp/va177c2/u2.mjs <run.json>...
import fs from 'node:fs';
const r1 = v => Math.round(v * 10) / 10;
const BLANK = 7;
for (const file of process.argv.slice(2)) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8')), u = s.ux;
  const name = file.split('/').pop().replace('.json', '');
  const mid = u.acts.find(a => a.kind === 'mid');
  const C = u.compact; // [rt, y, H, pend, hyd, anchorTop, centre, flags[7]]
  const blank = f => f[7].some(p => p >= 0 && (p & BLANK));
  const w = C.filter(f => f[0] >= mid.rt);
  let best = { frames: 0, ms: 0, from: null, to: null }, cur = null, total = 0;
  w.forEach((f, j) => {
    if (blank(f)) { total++; cur = cur ? { ...cur, frames: cur.frames + 1 } : { frames: 1, from: f[0] }; const end = w[j + 1]?.[0] ?? f[0]; const ms = r1(end - cur.from); if (cur.frames > best.frames || (cur.frames === best.frames && ms > best.ms)) best = { frames: cur.frames, ms, from: cur.from, to: end }; }
    else cur = null;
  });
  const firstBlank = w.findIndex(blank);
  const clear = firstBlank >= 0 ? w.slice(firstBlank).find(f => !blank(f)) : null;
  const k0 = Math.max(0, C.findIndex(f => f[0] >= mid.rt) - 1);
  const around = C.slice(k0, k0 + 8).map((f, j, a) => ({ rt: f[0], dt: a[j + 1] ? r1(a[j + 1][0] - f[0]) : null, y: f[1], H: f[2], c: f[6], fl: f[7].map(p => (p < 0 ? '-' : p & BLANK)).join('') }));
  const wE = r1(mid.rt + u.goneAfterEnter);
  const laf = (s.lafDetail?.frames ?? []).filter(f => f.s + f.d >= wE - 5 && f.s <= wE + 600).map(f => ({ s: r1(f.s - wE), d: f.d, script: f.script, frameCb: f.frameCb, render: f.render, b: f.b,
    forced: r1(f.scripts.reduce((a, x) => a + x.forced, 0)), scripts: f.scripts.slice().sort((a, b) => b.d - a.d).slice(0, 4).map(x => `${x.d}/${x.forced}f ${x.invokerType}:${x.invoker} ${x.src}`) }));
  const after = laf.filter(f => f.s + f.d > 0).slice(0, 2);
  const sp = u.shiftPost ?? {}, sh = u.shift ?? {};
  console.log(JSON.stringify({ name, gone: u.goneAfterEnter, completionFrame: s.completion?.frame?.d ?? s.completion?.d ?? null,
    u2: { at: mid.rt, y: [mid.y0, mid.y1], H: mid.H, info: mid.info },
    blank: { longestFrames: best.frames, longestMs: best.ms, from: best.from, totalFrames: total, probe: u.blank?.afterAct?.any, writeToClearMs: clear ? r1(clear[0] - mid.rt) : null, clearAt: clear?.[0] ?? null },
    around, lafAfterWrite: laf, firstTwoRender: after.map(f => f.render), firstTwoDur: after.map(f => f.d),
    settle: u.settle?.rt, anchor: u.end?.centreAtSettle, anchors: u.anchors?.map(a => `${a.why}:${a.i}@${a.rt}`),
    drawn: { jumps: sp.jumps, maxMove: sp.maxMove, first: (sp.firstJumps ?? []).map(j => `${j.d}@${j.rt}`), frames: sp.frames, lag: sp.lagMedian },
    start: { jumps: sh.jumps, maxMove: sh.maxMove, net: sh.net, first: (sh.firstJumps ?? []).map(j => `${j.d}@${j.rt}`), reanchors: sh.reanchors },
    end: u.end, endState: u.endState, leaks: u.leaks, errors: u.errors }));
}
```
```sh
node /tmp/va177c2/u2.mjs $C/{head,veil}-ats12-u2-{1,2,3}.json > u2.jsonl
```

## Logs

`<name>.log` is each run's full harness output plus the driver's exit/time line; `restore.log` and
`release.log` as printed. The ChatGPT project URL was replaced by `<home-url>` and the home folder by `~`.
`u2.jsonl` holds block indexes, px, ms, flags and script source file names only. A scan of the committed
files for `chatgpt.com`, `/home/` and email addresses found none after those replacements.
