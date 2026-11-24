# Commands — Smoother streaming long frames, 2026-11-23 (stage 1)

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-23-stream-longframe`;
`H` is `~/snap/chromium/common/stream-audit-1123/butter` (the 11-23 recheck's build, unchanged).
The eight replays ran through a wrapper outside the repo
(`/tmp/stream-frames-1123/seq.sh`). For each run it called
`env LAB_ID=2 LAB_OWNER=stream-frames-1123 EXT=<H or empty> LABEL=<name> FIXTURE=<f> PHASES=stream [OPTS=<json>] OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs`,
wrote the output to `$C/<name>.raw.log` and printed start, end (UTC) and exit. Before each run it
checked the 25 min mark and the run count, and it would stop on a `FAIL` of `no-escape` or
`server-unchanged`. Final lines are copied from the logs in this folder.

## Harness, lint and dry checks (before the lock)

```sh
npx eslint lab/harness/stream-replay-live.mjs lab/harness/stream-laf-probe.mjs lab/harness/stream-laf-report.mjs lab/harness/stream-run-opts.mjs; echo eslint-exit=$?
wc -l lab/harness/stream-replay-live.mjs
node /tmp/laf-check2/t.mjs      # one-off: the probe on a blank page in headless Chromium, 5 frames of 120–240 ms
node /tmp/laf-check2/o.mjs      # one-off: OPTS={"cv":false} applied to H in a throwaway headless profile and put back
```
```text
eslint-exit=0
500 lab/harness/stream-replay-live.mjs
long animation frames, Enter to 5 s after stream complete (1246.2 ms): LoAF 5, total 913.7 ms, blocking 653.1 ms, longest 240.5 ms; longtask 5, ...
REPORT laf top 1: start 674.3 ms (before in_progress gone), duration 240.5, blocking 190.3, script part 0.1, rAF part 240.3, render part 0.1, scripts 1; top script 240.3 ms other user-callback "FrameRequestCallback" ...
row0 {"s":0.2,"d":130.9,"b":71.1,"script":10.3,"render":0.1,"frameCb":120.5,"scripts":[{"invokerType":"user-callback","invoker":"FrameRequestCallback","fn":"","src":"other","s":10.6,"d":120.4,"forced":0.1,"pause":0}],"afterComplete":false}
storage before the run: sha256 42ba610a86d15094, local keys [], sync keys [], opts null; OPTS {"cv":false}
during {"cv":false}
OPTS put back: sha256 42ba610a86d15094, same as before true, opts null
```

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-frames-1123 --wait 1800 --perf
```
```text
2
exit=0          # taken 2026-11-24T05:03:13Z, no queue
```

## Runs

| # | Name | EXT | FIXTURE | OPTS | UTC | Exit |
|---|---|---|---|---|---|---:|
| 1 | `head-ats12-1` | H | `ats12` | — | 05:03:15–05:06:27 | 0 |
| 2 | `head-ats12-2` | H | `ats12` | — | 05:06:27–05:09:41 | 0 |
| 3 | `head-ats12-cvoff` | H | `ats12` | `{"cv":false}` | 05:09:41–05:13:04 | 1 |
| 4 | `head-ats12-throttleoff` | H | `ats12` | `{"throttle":false}` | 05:13:04–05:16:25 | 1 |
| 5 | `native-ats12` | (empty) | `ats12` | — | 05:16:25–05:19:39 | 0 |
| 6 | `head-math9` | H | `math9` | — | 05:19:39–05:22:57 | 0 |
| 7 | `native-math9` | (empty) | `math9` | — | 05:22:57–05:26:16 | 0 |
| 8 | `head-ats12-containeroff` | H | `ats12` | `{"container":false}` | 05:26:16–05:29:38 | 0 |

Run 9 (trace) was not started: 1383 s of the 1800 s budget had passed before run 8, and a run
takes about 200 s.

Key lines per run:

```text
# 1 head-ats12-1
REPORT data-butter-off layout
REPORT long animation frames, Enter to 5 s after stream complete (112620.3 ms): LoAF 355, total 28367.2 ms, blocking 7099.7 ms, longest 2051.4 ms; longtask 281, total 21404 ms, blocking 7354 ms, longest 1375 ms
REPORT laf top 1: start 105018.8 ms (before in_progress gone), duration 2051.4, blocking 1997.1, script part 686.2, rAF part 1354.4, render part 10.8, scripts 2; top script 1342.9 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 1283.2 pause 0; nearest mark inProgressGone -612.1 ms; nearest butter batch -1113 ms (+0s/+8u)
REPORT laf histogram: >=200 ms 7, >=500 ms 1, >=1000 ms 1 (...)
PASS no-escape
PASS server-unchanged
SUMMARY head-ats12-1: 0 FAILs

# 2 head-ats12-2
REPORT long animation frames, ... (112542.6 ms): LoAF 364, total 28929.6 ms, blocking 7124 ms, longest 1970.9 ms; ...
REPORT laf top 1: start 105022.8 ms (before in_progress gone), duration 1970.9, blocking 1917, script part 655.5, rAF part 1304.5, render part 10.9, scripts 2; top script 1292.3 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 1236.6 pause 0; nearest mark inProgressGone -588.2 ms; ...
SUMMARY head-ats12-2: 0 FAILs

# 3 head-ats12-cvoff
REPORT storage before the run: sha256 42ba610a86d15094, local keys [], sync keys [], opts null; OPTS {"cv":false}
REPORT data-butter-off cv layout
REPORT long animation frames, ... (112549 ms): LoAF 560, total 52726.8 ms, blocking 20221 ms, longest 6005.6 ms; ...
REPORT laf top 1: start 3289.7 ms (before in_progress gone), duration 6005.6, blocking 5920.5, script part 5059.2, rAF part 739.4, render part 207, scripts 2; top script 5009.8 ms other user-callback "TimerHandler:setTimeout" fn "" forced 20.8 pause 0; nearest mark inProgressOn +706.2 ms; nearest butter batch none
FAIL cv-blocks: no block of the streaming answer computed content-visibility auto (max blocks 612)
FAIL seen-marks: no data-butter-seen or data-butter-unrendered mark on the streamed answer's blocks
PASS no-escape
PASS server-unchanged
REPORT OPTS put back: sha256 42ba610a86d15094, same as before true, opts null
SUMMARY head-ats12-cvoff: 2 FAILs

# 4 head-ats12-throttleoff
REPORT data-butter-off throttle layout
REPORT long animation frames, ... (112683.5 ms): LoAF 517, total 45449.6 ms, blocking 15359 ms, longest 2014.6 ms; ...
REPORT laf top 1: start 105102.6 ms ..., duration 2014.6, ... top script 1327.6 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 1268.8 ...
FAIL throttle-matched: __butterStats {"smootherFrames":0,"published":0}: the smoother callback never matched
REPORT OPTS put back: sha256 42ba610a86d15094, same as before true, opts null
SUMMARY head-ats12-throttleoff: 1 FAIL

# 5 native-ats12
REPORT data-butter-off none
REPORT long animation frames, ... (112603.4 ms): LoAF 631, total 75177.6 ms, blocking 38672 ms, longest 792 ms; ...
REPORT laf top 1: start 105321.3 ms (before in_progress gone), duration 792, blocking 741.1, script part 646, rAF part 95.7, render part 50.3, scripts 3; top script 644.8 ms other user-callback "TimerHandler:setTimeout" fn "" forced 191.7 pause 0; nearest mark inProgressGone -581.7 ms; ...
SUMMARY native-ats12: 0 FAILs

# 6 head-math9
REPORT long animation frames, ... (112549 ms): LoAF 513, total 42171.9 ms, blocking 10896.5 ms, longest 1940 ms; ...
REPORT laf top 1: start 105049.3 ms ..., duration 1940, ... top script 1260.7 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 1206.2 ...; nearest mark inProgressGone -587.4 ms; ...
SUMMARY head-math9: 0 FAILs

# 7 native-math9
REPORT long animation frames, ... (112556.1 ms): LoAF 512, total 92838 ms, blocking 61357.9 ms, longest 1542.9 ms; ...
REPORT laf top 1: start 0.3 ms (before in_progress gone), duration 1542.9, ... top script 1468.4 ms chatgpt:257798.877281a3d4.js event-listener "DIV.onkeydown" fn "" forced 1196.7 pause 0; nearest mark enter +0.3 ms; ...
SUMMARY native-math9: 0 FAILs

# 8 head-ats12-containeroff
REPORT data-butter-off container layout
REPORT long animation frames, ... (118681.2 ms): LoAF 460, total 58385 ms, blocking 31279.6 ms, longest 8015.9 ms; ...
REPORT laf top 1: start 105019.8 ms ..., duration 8015.9, ... rAF part 7318.2 ... top script 7305.5 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 7232.7 ...
REPORT OPTS put back: sha256 42ba610a86d15094, same as before true, opts null
SUMMARY head-ats12-containeroff: 0 FAILs
```

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-frames-1123          # 05:29:42
$B/lab-lock release --lab 2 --owner stream-frames-1123
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":3289691,"extensions":[],"flags":[]},"at":"2026-11-24T05:29:53.533Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

Three short readers, kept outside the repo:

- `/tmp/stream-frames-1123/analyze.py` built `data.json` from `$C/*.json` (per run: marks, the 30
  longest frames with script rows, histogram, 10 s buckets, sums, totals, storage hashes). It also
  wrote the sanitized logs: home → `~`, URLs → `<url>`, extension and chat ids → `<id>`.
- A one-off Python reader grouped script time by invoker and listed the completion frame and the
  Butter mark batches near it per run.
- `python3 -c` on the recording listed the event types of chunks 349–356 and their schedule times
  (structure only, no text).

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-" notes/runs/2026-11-23-stream-longframe/*; echo $?   # 1: no match
```
