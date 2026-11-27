# Commands: veil acceptance, stage D (#177), 2026-11-25

Run from the worktree of branch `veil/177-stage-d`, based on `feat/implement-spec-170` at `5481a9f`, with
the probe option `U4_FINDS` committed first (`1bea5f0`). The harness is this checkout's `lab/harness`.

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/stage-D`: raw logs and per-run JSON, kept local.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC.

## Probe check before the runs

- **Calls per run:** in `lab/harness/stream-ux-probe.mjs`, `U.u4` made one `window.find` call per run
  (part a), then `scrollIntoView` (c) and select-all (b). That gives 3 calls per build over 3 runs, short
  of the spec's 5.
  - `U4_FINDS=<n>` adds n-1 later calls between (a) and (c), each on a held block at least 10 blocks from
    those used, watched for 30 frames. (c) keeps 10 blocks from all of them.
  - One `REPORT ux u4 u4 (a) window.find, later call <k>` line per later call.
- **`UX=u4` alone:**
  - `onGone` schedules no act, so the view stays where streaming left it. There is no settle frame, so
    the probe prints no view-shift lines.
  - `drive` waits for the 16 s sampling to end, then 500 ms, then calls `U.u4`.
  - The harness counts `stream-no-jump` drops only in its streaming loop, which has ended by then, so
    u4's later scrolling cannot trip it.

```sh
node --check lab/harness/stream-ux-probe.mjs && npx eslint lab/harness/stream-ux-probe.mjs   # ok, lint-ok
npm test   # tests 967, pass 967, fail 0
```

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

## Lock, runs, judge, restore and release (one script, one lock)

The driver (`/tmp/va177d/seq.sh`, kept local) is stage C2's with these changes:

- `UX=u4 U4_FINDS=3`, owner `veil-accept-D` and run names `<build>-ats12-u4-<i>`;
- after the six runs, the judge (`u4-extract.mjs`, a copy is in this folder);
- part 2 only when the judge passes and less than 1,500 s of the budget clock has passed.

As before, it refused to start a run after 1,500 s, after 9 runs or after a `FAIL no-escape` or
`FAIL server-unchanged`, and it ran restore and release from an exit trap.

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-D --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil:
env LAB_ID=$LAB LAB_OWNER=veil-accept-D EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
node u4-extract.mjs $C/{head,veil}-ats12-u4-{1,2,3}.json > $C/u4.jsonl   # exit 3: rule not met
# part 2, only when the judge exits 0 (not run):
env LAB_ID=$LAB LAB_OWNER=veil-accept-D EXT=$D/veil/butter FIXTURE=math12 OUT=$C/veil-stored-layout.json \
  node notes/runs/2026-11-24-veil-acceptance/stage-D/stored-layout-check.mjs
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-D
$B/lab-lock release --lab $LAB --owner veil-accept-D
$B/lab-lock status
```
```text
acquire start 2026-11-25T22:01:40Z
lab=2 exit=0 at 2026-11-25T22:26:41Z
judge exit=3
STOP before part 2: veil median window.find outside both bounds
restore exit=0 (restarted the browser without extensions; "ok":true)   # 22:47:49Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T22:47:50Z since-lock=1269s
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-u4-1` | head | 0 | 209 s | 209 s |
| 2 | `veil-ats12-u4-1` | veil | 0 | 206 s | 415 s |
| 3 | `head-ats12-u4-2` | head | 0 | 209 s | 624 s |
| 4 | `veil-ats12-u4-2` | veil | 0 | 210 s | 834 s |
| 5 | `head-ats12-u4-3` | head | 0 | 204 s | 1,038 s |
| 6 | `veil-ats12-u4-3` | veil | 0 | 219 s | 1,257 s |

Six harness runs, 21 min 9 s from lock to release. The acquire waited 25 min behind `veil-accept-C3`.

## Files

- **`<name>.log`:** each run's full harness output plus the driver's exit and time line.
- **`restore.log`, `release.log`:** as printed.
- **`u4.jsonl`:** one line per run (blocks, string lengths, ms, flags, scrollTop, select-all lengths and
  times), then the medians and the rule. It holds no chat text.
- **`u4-extract.mjs`:** the judge.
- **`stored-layout-check.mjs`:** part 2's check, written and not run.

The ChatGPT project URL was replaced by `<home-url>` and the home folder by `~`. A scan of the committed logs
for `chatgpt.com`, `/home/` and email addresses found none. The one hit was the check script's import of the
lab library by absolute path, which the repo's other harness scripts use as well.
