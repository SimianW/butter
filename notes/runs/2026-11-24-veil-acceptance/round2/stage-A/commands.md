# Commands: veil acceptance, round 2, stage A (#177), 2026-11-25

Run from the worktree of branch `veil/177-r2-stage-a`, which is based on `feat/implement-spec-170` at
`552b8db`; the harness is this checkout's `lab/harness`, unchanged. Short names:

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-A`. It holds the raw logs, the per-run
  JSON and the two traces (`*.trace.json`, 208 MB for the first), and stays local.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC, 2026-11-26.

## Branch and builds

The builds were made by the lead and not rebuilt.

```sh
git merge-base --is-ancestor feat/implement-spec-170 HEAD && echo ANCESTOR_OK   # HEAD = feat/implement-spec-170 = 552b8db
git switch -c veil/177-r2-stage-a
for n in head veil2; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n ok"; grep -c prelayout $D/$n/butter/stream/offscreen.js; done
git show 552b8db:extension/stream/offscreen.js | diff -q - $D/veil2/butter/stream/offscreen.js && echo veil2-offscreen-matches-552b8db
for f in $(git ls-tree -r --name-only 552b8db extension | grep -v manifest.json); do git show 552b8db:$f | cmp -s - $D/veil2/butter/${f#extension/} || echo DIFF $f; done; echo cmp-done
```
```text
ANCESTOR_OK
Switched to a new branch 'veil/177-r2-stage-a'
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head ok
0
  "version_name": "0.1.0-alpha.22+veilaccept.veil2",
veil2 ok
4
veil2-offscreen-matches-552b8db
cmp-done
```

Apart from `manifest.json`, every file in veil2 matches `552b8db`'s `extension/`.

## Sequence

[seq.sh](seq.sh) runs the whole sequence:

1. It takes the lock.
2. It runs head and veil2 three times each, interleaved, then one traced veil2 run.
3. It runs `lab-restore`, releases the lock and prints `lab-lock status`.

Each run is guarded. A run does not start once 1550 s have passed since the lock, after 10 runs, or after a
`FAIL no-escape` or `FAIL server-unchanged`. Each run is:

```sh
env LAB_ID=$LAB LAB_OWNER=veil-accept-r2-A EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream 'OPTS={"rail":true,"bookmark":true}' [trace settings] node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
```

### First attempt: the acquire timed out

`acquire-attempt1.log`:

```text
acquire start 2026-11-26T00:14:25Z
lab-lock: no lab free within 3600.0s (lab 2: veil-prelayout-live; perf: veil-prelayout-live)
acquire lab= exit=75 at 2026-11-26T01:14:25Z
```

Lab 2 went from `veil-accept-r2-D` to `veil-accept-r2-C2` to `veil-prelayout-live` during the wait. Nothing
ran and the lab was not touched. The same script was started again with the same acquire settings
(`--lab auto --needs-fixture ats12 --perf --wait 3600`).

### Second attempt

```text
acquire start 2026-11-26T01:14:33Z
acquire lab=2 exit=0 at 2026-11-26T01:23:01Z          # budget clock starts
```

| # | Name | Build | Extra settings | Exit | Took | Budget clock at end |
|---:|---|---|---|---:|---:|---:|
| 1 | `head-ats12-stream-1` | head | | 0 | 202 s | 202 s |
| 2 | `veil2-ats12-stream-1` | veil2 | | 0 | 189 s | 391 s |
| 3 | `head-ats12-stream-2` | head | | 0 | 191 s | 582 s |
| 4 | `veil2-ats12-stream-2` | veil2 | | 0 | 191 s | 773 s |
| 5 | `head-ats12-stream-3` | head | | 0 | 196 s | 969 s |
| 6 | `veil2-ats12-stream-3` | veil2 | | 0 | 195 s | 1164 s |
| 7 | `veil2-ats12-trace-1` | veil2 | `TRACE_AT=109000 TRACE_SPAN=11000 TAIL_MS=12000 TRACE_CATS=<u2-trace's three>` | 0 | 228 s | 1392 s |

`<u2-trace's three>` stands for
`disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler`.

```text
restore exit=0 at 2026-11-26T01:46:23Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
SEQ DONE 2026-11-26T01:46:23Z since-lock=1402s
```

### Why `veil2-ats12-trace-1` was not used

The trace was set to start at 103.5 s after Enter. On `ats12`, completion comes at about 105.6 s. Starting a
trace with these categories just before completion stalled ChatGPT's completion work:

- `Tracing.start` returned at 106.4 s (`REPORT trace: … started at page time … (106446 ms after Enter)`).
- The completion `setTimeout` ran for 30.7 s.
- `in_progress` went at 137.3 s.
- The trace stopped at the next harness tick, before pre-layout.

[summary.md](summary.md) has the details.

## One corrected traced run, inside the same budget

The clock was at 1436 s of 1800 and 7 of 10 runs were used, so one more traced run fit. It was started at once
with [retrace.sh](retrace.sh), which uses the same guard and the same budget clock from 01:23:01Z. The trace
starts after the completion frame, at about gone + 0.5 s, and uses the default categories only (no
`TRACE_CATS`). The lock was taken again with `--lab 2 --needs-fixture ats12 --perf --wait 30`.

```sh
env LAB_ID=$LAB LAB_OWNER=veil-accept-r2-A EXT=$D/veil2/butter LABEL=veil2-ats12-trace-2 FIXTURE=ats12 OUT=$C/veil2-ats12-trace-2.json \
  PHASES=stream 'OPTS={"rail":true,"bookmark":true}' TRACE_AT=111100 TRACE_SPAN=10000 TAIL_MS=12000 \
  node lab/harness/stream-replay-live.mjs > $C/veil2-ats12-trace-2.raw.log 2>&1
```
```text
acquire lab=2 exit=0 at 2026-11-26T01:47:13Z since-lock=1452s
veil2-ats12-trace-2 exit=0 took=203s since-lock=1655s at 2026-11-26T01:50:36Z
restore exit=0 at 2026-11-26T01:50:47Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
RETRACE DONE since-lock=1666s
```

The trace started 106515 ms after Enter, 951 ms after `in_progress` went (105563.7 ms).

There were 8 harness runs in all. The budget clock ran 1666 s from the first lock to the last release.

## Extraction

```sh
python3 -I runs.py $C/{head,veil2}-ats12-stream-{1,2,3}.json $C/veil2-ats12-trace-{1,2}.json > runs.jsonl   # per-run rows
python3 -I scroll2.py $C/veil2-ats12-stream-{1,2,3}.json $C/veil2-ats12-trace-2.json            # scrollTop/scrollHeight after completion
python3 -I prelayout-trace.py $C/veil2-ats12-trace-2.json > prelayout-callbacks.jsonl          # line 1 summary, then one line per callback
```

`prelayout-trace.py` selects the renderer main thread as the one with the most `UpdateLayoutTree` events. It
maps trace time to page time with the `lab-trace-start` mark and the harness's `REPORT trace` line, and gives
every time as ms after `in_progress` went.

## Logs

- `<name>.log` holds each run's `PASS`, `FAIL`, `REPORT` and `SUMMARY` lines, plus the driver's exit and time
  line.
- `restore.log`, `restore-2.log`, `release.log` and `release-2.log` are as printed, with the home URL
  replaced by `<home-url>` and the home directory by `~`.
- A scan of the committed files for chat URLs, email addresses, home paths and extension IDs found none.
- The raw logs, the run JSON and the traces stay in `C`.
