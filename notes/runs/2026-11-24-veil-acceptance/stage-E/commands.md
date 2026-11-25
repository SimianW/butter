# Commands: veil acceptance, stage E (#177), 2026-11-25

Run from the worktree of branch `veil/177-stage-e` (based on `feat/implement-spec-170` at `5481a9f`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-E` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

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

## Harness change before the lock (opened-chat probe)

`lab/harness/stream-loaded-probe.mjs` counted only Butter's attributes (`data-butter-veil` and the
others), not computed opacity. It now also counts the answer blocks (children of the assistant text
column or of a Dil response root) whose computed `opacity` is `"0"`: in every 4th sample (every 2 s at
the default `SAMPLE=500`) and the last, and once after the window, printed as
`REPORT answer blocks at opacity 0 (computed; …)`. Every 4th sample keeps the extra style reads few
while the load-time blocking is measured. Committed on this branch.

```sh
npx eslint lab/harness/stream-loaded-probe.mjs; echo eslint-exit=$?
node --check lab/harness/stream-loaded-probe.mjs && echo check-ok
```
```text
eslint-exit=0
check-ok
```

## Lock, runs, restore and release (one script, one lock)

The driver (`/tmp/va177e/seq.sh`, kept local) is stage C2's with owner `veil-accept-E`. It took the lock
with the fixture named, ran the two veil all-phases runs and then the opened-chat pair, refused to start a
replay after 1500 s of the budget clock (an opened-chat run after 1380 s), after 10 runs, or after a
`FAIL no-escape`/`FAIL server-unchanged` (an opened-chat run after a send attempt), and ran restore and
release from an exit trap:

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-E --wait 3600 --perf)
# for i in 1 2 (no PHASES: all phases):
env LAB_ID=$LAB LAB_OWNER=veil-accept-E EXT=$D/veil/butter LABEL=veil-ats12-all-<i> FIXTURE=ats12 OUT=$C/<name>.json \
  VEILPROBE=1 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# for BUILD in head veil (opened chat, as the study's L1 in notes/runs/2026-11-24-stream-ux-loaded/, no typing phase):
env LAB_ID=$LAB LAB_OWNER=veil-accept-E EXT=$D/<build>/butter LABEL=<build>-opened-math12 FIXTURE=math12 OUT=$C/<name>.json \
  MS=40000 TYPE_AT=0 node lab/harness/stream-loaded-probe.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-E
$B/lab-lock release --lab $LAB --owner veil-accept-E
$B/lab-lock status
```
```text
acquire start 2026-11-25T21:58:06Z
lab=2 exit=0 at 2026-11-25T22:17:01Z
```

The acquire waited 19 min for stage C3's lab-2 lock. The budget clock starts at 22:17:01Z.

| # | Name | Build | Script | Exit | Took | Budget clock at end |
|---:|---|---|---|---:|---:|---:|
| 1 | `veil-ats12-all-1` | veil | `stream-replay-live.mjs`, `ats12`, all phases, `VEILPROBE=1` | 0 | 240 s | 240 s |
| 2 | `veil-ats12-all-2` | veil | the same | 0 | 227 s | 467 s |
| 3 | `head-opened-math12` | head | `stream-loaded-probe.mjs`, `math12`, `MS=40000 TYPE_AT=0` | 0 | 51 s | 518 s |
| 4 | `veil-opened-math12` | veil | the same | 0 | 51 s | 569 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 22:26:41Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T22:26:41Z since-lock=580s
```

Four harness runs, 9 min 40 s from lock to release.

## Veil probe frames by step (from each run's JSON, `summary.veilProbe`)

```sh
python3 -I -c "import json; d=json.load(open('$C/<name>.json')); ..."   # wheel/mid: n, hit, leakStart, leakDrawn, frames (i, t, phase, veiled, op0)
```
```text
veil-ats12-all-1 wheel n 1255 hit 2 leakStart 0 leakDrawn 0 up 60 down 60 frames [(2, 149683, 'end', 4, 4), (3, 149701, 'end', 4, 4)]
veil-ats12-all-1 mid   n 30 hit 0 leakStart 0 leakDrawn 0 frames []
veil-ats12-all-2 wheel n 1253 hit 2 leakStart 0 leakDrawn 0 up 60 down 60 frames [(2, 143520, 'end', 4, 4), (3, 143542, 'end', 4, 4)]
veil-ats12-all-2 mid   n 30 hit 0 leakStart 0 leakDrawn 0 frames []
```

## Logs

`<name>.log` holds each run's `PASS`/`FAIL`/`REPORT`/`SUMMARY` lines plus the driver's exit/time line;
`restore.log` and `release.log` as printed (the home URL replaced by `<home-url>`, home paths by `~`).
The raw logs and per-run JSON stay in `C`.

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}|@[a-z0-9.-]+\.[a-z]{2,}" notes/runs/2026-11-24-veil-acceptance/stage-E/*
```
```text
(no output; exit 1)
```
