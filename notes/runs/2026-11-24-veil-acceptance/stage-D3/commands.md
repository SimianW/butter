# Commands: veil acceptance, stage D3 (#177), 2026-11-25

Run from the worktree of branch `veil/177-stage-d3`, based on `feat/implement-spec-170` at `01865e6`. The
harness is this checkout's `lab/harness`.

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/stage-D3`: raw logs, run JSON and traces, kept
  local.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC.

## Before the lock

```sh
git merge-base --is-ancestor feat/implement-spec-170 HEAD; echo anc=$?   # anc=0
git switch -c veil/177-stage-d3
```

- **Harness:** `lab/harness/stream-ux-probe.mjs` records `at` (the call's start in page time) on each u4
  `window.find` record, so a trace can be cut at it. `node --check` and `npx eslint` on the file were OK.
- **The trace window:** the harness starts and stops a `TRACE_AT` trace only from its tick loop, which by
  default ends 5 s after completion (`TAIL_MS`), while u4 starts at about completion + 16.5 s (stage D:
  completion 105.6–105.8 s after Enter, so u4 at about 122.2 s). So the runs set `TAIL_MS=30000` and
  `TRACE_AT=124600 TRACE_SPAN=14000` (117.6–131.6 s after Enter).
- **The check script:** stage D's `stored-layout-check.mjs` was reviewed, copied here and fixed (a–c in
  [summary.md](summary.md)) before its first run. (d–f) came after runs 3 and 4.
- **Builds:** reused from stage A, not rebuilt.

```sh
for n in head veil; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n ok"; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head ok
  "version_name": "0.1.0-alpha.22+veilaccept.veil",
veil ok
```

Lab 2's fixtures include both `ats12` and `math12` (`labs.json`), so one lock covered both parts.

## Lock, runs, restore and release

```sh
$B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-D3 --wait 3600 --perf   # 2, at 22:55:30Z, no wait
# part 1, /tmp/va177d3/run.sh <build> <name>, kept local:
env LAB_ID=2 LAB_OWNER=veil-accept-D3 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' TAIL_MS=30000 \
  TRACE_AT=124600 TRACE_SPAN=14000 \
  TRACE_CATS=disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# part 2 (3 loads; the third with TRIGGER=1):
env LAB_ID=2 LAB_OWNER=veil-accept-D3 EXT=$D/veil/butter FIXTURE=math12 [TRIGGER=1] OUT=$C/<name>.json \
  node notes/runs/2026-11-24-veil-acceptance/stage-D3/stored-layout-check.mjs > $C/<name>.raw.log 2>&1
$B/lab-restore --lab 2 --owner veil-accept-D3
$B/lab-lock release --lab 2 --owner veil-accept-D3
$B/lab-lock status
```
```text
head-ats12-u4-trace-1 exit=0 222 s at 2026-11-25T22:59:20Z
veil-ats12-u4-trace-1 exit=0 216 s at 2026-11-25T23:03:04Z
veil-stored-layout exit=1 92 s at 2026-11-25T23:04:43Z
veil-stored-layout-2 exit=1 143 s at 2026-11-25T23:08:16Z
veil-stored-layout-3 exit=1 145 s at 2026-11-25T23:11:05Z
restore exit=0 at 2026-11-25T23:11:23Z   (browser restarted without extensions, "ok":true)
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

- The part 1 runs printed 12 PASS (head) and 13 PASS (veil), with 0 FAIL.
- The part 2 exits of 1 are the script's own FAIL lines, explained in [summary.md](summary.md):
  - runs 1 and 2 fail `stored-layout-restored` (nothing was restored);
  - run 3 fails `stored-layout-cv-not-veiled` (the attribute was on a block at opacity 1).

5 harness runs, 15 min 53 s from lock to release.

## Cutting

```sh
python3 -I trace-find.py $C/head-ats12-u4-trace-1.json $C/veil-ats12-u4-trace-1.json > find-calls.jsonl
# stored-layout.jsonl: a short inline python3 -I over $C/veil-stored-layout{,-2,-3}.json
#   (max counts over samples, end stats, the samples with a veiled block, put-back)
npm run check   # exit 0; tests 967, pass 967, fail 0
```

The gaps between calls and the font invalidations were counted with a short inline script over the same
traces: events on the main thread between one call's end and the next call's start.

## Files

- **`*-ats12-u4-trace-1.log`, `veil-stored-layout*.log`:** each run's verdict and `REPORT` lines, with the
  run's exit and time.
- **`find-calls.jsonl`:** one line per `window.find` call (counts, ms, tag names, script names).
- **`stored-layout.jsonl`:** one line per part 2 run.
- **`acquire.log`, `restore.log`, `release.log`:** as printed.
- **`trace-find.py`, `stored-layout-check.mjs`:** the cutter and the check.

The ChatGPT project URL in `restore.log` is replaced by `<home-url>`. The committed files hold no chat text,
URL or turn key. The one `/home/` path is the check script's import of the lab library, as in stage D and
the repo's other harness scripts.
