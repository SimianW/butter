# Commands: veil acceptance, stage C3 (#177), 2026-11-24

Run from the worktree of branch `veil/177-stage-c3` (based on `feat/implement-spec-170` at `5481a9f`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-C3` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

## Probe check before the runs

`lab/harness/stream-ux-probe.mjs` with `UX=u1` alone: `onGone` schedules only `act('end', toEnd)` with
`setTimeout(…, 0)`, the first task after the first frame without `in_progress` (no u2 write at +2 s).
`toEnd` sets `scrollTop = scrollHeight`. `act` sets `U.settleAt` to the write + 100 ms, and the frame
sampler picks the anchor at the first frame at or after that time as the block under the view's centre
(`pickAnchor(g, 'settle')`, a new one only if it disconnects). Sampling ends 16 s after completion
(`sampleMs: 16000`), so the view-shift window runs from the settle frame to +16 s, with no second write in
it (stage C's u1 window ended at the u2 write, +2 s).

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

The driver (`/tmp/va177c3/seq.sh`, kept local) is stage C2's with `UX=u1` in place of `UX=u2 U2_BLOCK=306`,
owner `veil-accept-C3` and run names `<build>-ats12-u1-<i>`. It took the lock with the fixture named, ran
head and veil in turn, refused to start a run after 1500 s of the budget clock, after 10 runs or after a
`FAIL no-escape`/`FAIL server-unchanged`, and ran restore and release from an exit trap:

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-C3 --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil:
env LAB_ID=$LAB LAB_OWNER=veil-accept-C3 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u1 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-C3
$B/lab-lock release --lab $LAB --owner veil-accept-C3
$B/lab-lock status
```
```text
acquire start 2026-11-25T21:56:40Z
lab=2 exit=0 at 2026-11-25T21:56:40Z
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-u1-1` | head | 0 | 199 s | 199 s |
| 2 | `veil-ats12-u1-1` | veil | 0 | 198 s | 397 s |
| 3 | `head-ats12-u1-2` | head | 0 | 205 s | 602 s |
| 4 | `veil-ats12-u1-2` | veil | 0 | 201 s | 803 s |
| 5 | `head-ats12-u1-3` | head | 0 | 201 s | 1004 s |
| 6 | `veil-ats12-u1-3` | veil | 0 | 206 s | 1210 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 22:17:01Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T22:17:01Z since-lock=1221s
```

Six harness runs, 20 min 21 s from lock to release. The lock on lab 2 was free at once.

## Per-run numbers (`u1.jsonl`)

`u1.jsonl` holds one line per run, cut from each run's `summary.ux` and `summary.lafDetail` by stage C2's
`u2.mjs` with the act it cuts at changed from `mid` to `end` (the u1 write); the field `u2` is named `u1`.
The fields are as in [stage C2's commands](../stage-C2/commands.md#per-run-numbers-u2jsonl):

- **blank:** the longest run of consecutive frames from the u1 write on with a tested point on a block with
  flag 1 (veil), 2 (opacity 0) or 4 (content skipped), ms from its first frame to the frame after it (the
  probe's own `afterAct.any` is alongside and agrees); `writeToClearMs`: from the write to the first frame
  with no such point after the first one with one.
- **around:** the frames from the one before the write: ms after completion, interval to the next frame,
  scrollTop, scrollHeight, centre block and the 7 points' blank bits (`-` no answer block).
- **lafAfterWrite:** long-animation-frame entries (≥ 50 ms) around the write.
- **drawn / start:** the probe's view-shift jumps after drawing (`shiftPost`) and at the frame's start
  (`shift`), from its settle frame to +16 s; `anchors`: the anchor picks.

```sh
sed -e "s/a.kind === 'mid'/a.kind === 'end'/; s/const mid = /const w1 = /; s/\bmid\./w1./g; s/u2: { at/u1: { at/" \
  /tmp/va177c2/u2.mjs > /tmp/va177c3/u1.mjs     # plus the two header comment lines
node /tmp/va177c3/u1.mjs $C/{head,veil}-ats12-u1-{1,2,3}.json > u1.jsonl
```

## Logs

`<name>.log` is each run's full harness output plus the driver's exit/time line; `restore.log` and
`release.log` as printed. The ChatGPT project URL was replaced by `<home-url>` and the home folder by `~`.
`u1.jsonl` holds block indexes, px, ms, flags and script source file names only. A scan of the committed
files for `chatgpt.com`, `/home/` and email addresses found none after those replacements.
