# Commands — Smoother streaming stage 2 (stream hydrate), 2026-11-24

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-hydrate`;
`H` is `~/snap/chromium/common/stream-audit-1123/butter`; `P1` is
`~/snap/chromium/common/stream-proto-1124/p1/butter`. Each replay ran through a wrapper outside the
repo (`/tmp/sh1124/run.sh NAME EXT FIXTURE [VAR=value…]`). The wrapper refused to start a run after
1560 s of the lock, after 10 runs, or after any `FAIL no-escape`/`FAIL server-unchanged` in an earlier
log. It then ran
`env LAB_ID=2 LAB_OWNER=stream-hydrate-1124 EXT=<dir> LABEL=<name> FIXTURE=<f> [PHASES=stream] [APIPROBE=1] [TRACE_AT=…] OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log`.

## Before the lock

```sh
diff extension/stream ~/snap/chromium/common/stream-audit-1123/butter/stream && echo same-stream
mkdir -p ~/snap/chromium/common/stream-proto-1124/p1 && cp -a $H $P1
# edit $P1/stream/offscreen.js and $P1/stream/containment.css (python replace script), then:
node --check $P1/stream/offscreen.js && echo syntax-ok
(cd /tmp/sh1124 && diff -ruN a/extension/stream b/extension/stream) > notes/runs/2026-11-24-stream-hydrate/p1.patch
git apply --check notes/runs/2026-11-24-stream-hydrate/p1.patch && echo applies
npx eslint lab/harness/stream-replay-live.mjs lab/harness/stream-api-probe.mjs lab/harness/stream-run-opts.mjs lab/harness/stream-laf-probe.mjs lab/harness/stream-laf-report.mjs; echo eslint-exit=$?
wc -l lab/harness/stream-replay-live.mjs
node /tmp/sh1124/dry.mjs    # one-off: P1 on a synthetic chatgpt.com page + the probe on a blank page, headless snap Chromium, throwaway profile
node /tmp/sh1124/fin.mjs    # one-off: the probe module's REPORT lines on fake data
```
```text
same-stream
syntax-ok
applies
eslint-exit=0
500 lab/harness/stream-replay-live.mjs
stream samples (hydrated/pending/measuring/unrendered/seen): 0/0/0/0/1 0/0/0/0/18 14/16/3/16/35 30/17/17/17/51 63/17/6/17/84 80/16/16/16/101
after completion {"h":"130","p":"0","m":0,"u":0,"s":151,"n":151,"cv":["auto"],"mdHeight":16520,"scrollHeight":16538,"lastAttrs":"data-butter-seen"} expected md height 16520
offscreen.js errors: 0 ; all errors: []
probe kept: [{"api":"Element.getBoundingClientRect","d":191.5,"target":{"kind":"element","tag":"div","data":[],"where":"elsewhere","inLast":false,"blocksInside":null},...}]
profile removed true
```

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-hydrate-1124 --wait 1800 --perf
```
```text
2
exit=0          # taken 2026-11-24T05:44:56Z, no queue
```

## Runs

| # | Name | EXT | FIXTURE | Options | UTC | Exit |
|---|---|---|---|---|---|---:|
| 1 | `head-ats12-apiprobe` | H | `ats12` | `PHASES=stream APIPROBE=1` | 05:44:58–05:48:17 | 0 |
| 2 | `head-ats12` | H | `ats12` | `PHASES=stream` | 05:48:54–05:52:12 | 0 |
| 3 | `p1-ats12-1` | P1 | `ats12` | `PHASES=stream` | 05:52:16–05:55:26 | 0 |
| 4 | `p1-ats12-2` | P1 | `ats12` | `PHASES=stream` | 05:55:39–05:58:54 | 0 |
| 5 | `p1-ats12-all` | P1 | `ats12` | (all phases) | 05:58:57–06:02:34 | 0 |
| 6 | `p1-math9` | P1 | `math9` | `PHASES=stream` | 06:02:37–06:05:57 | 0 |
| 7 | `p1-ats12-apiprobe` | P1 | `ats12` | `PHASES=stream APIPROBE=1` | 06:06:00–06:09:12 | 0 |
| 8 | `p1-ats12-trace` | P1 | `ats12` | `PHASES=stream TRACE_AT=105500` | 06:09:21–06:12:35 | 0 |

Between runs 1 and 2 the probe gained per-API 50 ms bins (`stream-api-probe.mjs`; eslint exit 0
again). Only the `APIPROBE` runs use them. P1b was not built; run 8 is the trace.

Key lines per run:

```text
# 1 head-ats12-apiprobe
REPORT long animation frames, Enter to 5 s after stream complete (112578.3 ms): LoAF 328, total 26839.5 ms, blocking 7381.8 ms, longest 1952.3 ms; ...
REPORT completion frame: start 105055.4 ms, duration 1952.3, blocking 1899, script part 641, rAF part 1299.7, render part 11.6; scripts 1286.2/1199.4 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"; 637.5/183.7 forced other user-callback "TimerHandler:setTimeout"
REPORT api probe: armed 100419.1 to 112644 ms after Enter; last turn at arming {"blocks":599,"seen":25,"unrendered":554,"measuring":0}; calls >= 5 ms: 34 from the page, 0 from the harness
REPORT api probe sums of kept calls per API: {"clientHeight":{"n":1,"ms":183.3},"scrollLeft":{"n":33,"ms":300.1}}; all armed calls per API (top 12 by time): {"scrollLeft":{"n":9133,"ms":913.9},"clientHeight":{"n":8053,"ms":245.1},"Element.getBoundingClientRect":{"n":17915,"ms":133.3},...}
REPORT api probe top 2: scrollLeft 18.5 ms at 106196.6 ms, target <span> [] in-answer in-last-turn; stack u@299268.5b3cdf27e2.js:1:50555 < B@299268.5b3cdf27e2.js:1:51325 < @299268.5b3cdf27e2.js:1:51055
REPORT answer height after the window: last turn 84672 px, answer root 0 px, scrollHeight 95042 px
SUMMARY head-ats12-apiprobe: 0 FAILs

# 2 head-ats12
REPORT long animation frames, ... (112639.6 ms): LoAF 347, total 28086.7 ms, blocking 7368.7 ms, longest 1910.5 ms; ...
REPORT completion frame: start 105134 ms, duration 1910.5, ... scripts 1275.1/1222.1 forced chatgpt:299268.5b3cdf27e2.js ...; 608.5/181.8 forced other ...
REPORT laf histogram: >=200 ms 8, >=500 ms 2, >=1000 ms 1 (...)
REPORT after completion: turn 5/6, in_progress 0, 612 blocks, cv auto 592, seen 25, unrendered 567, ...
SUMMARY head-ats12: 0 FAILs

# 3 p1-ats12-1
REPORT long animation frames, ... (112546.6 ms): LoAF 494, total 37248.2 ms, blocking 8445.4 ms, longest 1956.4 ms; ...
REPORT completion frame: start 105023.2 ms, duration 1956.4, ... scripts 1254/1201.1 forced chatgpt:299268.5b3cdf27e2.js ...; 677.9/183 forced other ...
REPORT hydration over time (s after Enter: hydrated/pending/measuring/unrendered/seen in the last turn): 0s:0/0/0/0/0 11s:0/13/13/13/23 20s:81/4/4/4/104 31s:139/0/0/0/162 41s:172/5/4/5/195 51s:244/5/5/5/267 61s:308/8/8/8/331 71s:367/5/5/5/390 80s:417/18/3/18/442 91s:488/7/7/7/513 101s:547/7/3/7/572 111s:567/0/0/0/592
REPORT hydration at completion: first sample after in_progress gone (107504.9 ms) 566/1/1/1/591; 5 s later (110535.9 ms) 567/0/0/0/592; most blocks measuring at once 16
REPORT answer height after the window: last turn 36503 px, answer root 0 px, scrollHeight 46873 px
REPORT answer DOM updates while streaming: 325, interval p10 254.1, median 270.3, p90 334.6 ms
SUMMARY p1-ats12-1: 0 FAILs

# 4 p1-ats12-2
REPORT long animation frames, ... (112499.4 ms): LoAF 464, total 35837.5 ms, blocking 8561.5 ms, longest 1844.4 ms; ...
REPORT completion frame: start 105021.7 ms, duration 1844.4, ... scripts 1226.1/1173.9 forced ...; 595.3/181.8 forced ...
SUMMARY p1-ats12-2: 0 FAILs

# 5 p1-ats12-all
REPORT completion frame: start 105049.3 ms, duration 2014.9, ... scripts 1327.3/1269.9 forced ...; 664.3/180.3 forced ...
REPORT wheel phase: last turn 36503 px high, 55 steps up
REPORT view shift up (55 steps): 0/55 over 4px, median 0, max 0 (lost 0, none 0, clamped 0); in the streamed answer: 0/53 over 4px, ...
REPORT view shift down (55 steps, ended fromEnd 0): 0/55 over 4px, median 0, max 0 (...); in the streamed answer: 0/52 over 4px, ...
PASS wheel-no-jump
SUMMARY p1-ats12-all: 0 FAILs

# 6 p1-math9
REPORT long animation frames, ... (112693.1 ms): LoAF 637, total 52895 ms, blocking 15142.1 ms, longest 1908.6 ms; ...
REPORT completion frame: start 105134.5 ms, duration 1908.6, ... scripts 1250/1195.9 forced ...; 631.7/201.2 forced ...
SUMMARY p1-math9: 0 FAILs

# 7 p1-ats12-apiprobe
REPORT api probe: armed 100566.7 to 112683.9 ms after Enter; last turn at arming {"blocks":599,"seen":562,"unrendered":11,"measuring":6}; calls >= 5 ms: 38 from the page, 0 from the harness
REPORT api probe, all calls starting in the completion frame (105020.2-107027 ms, 50 ms bins): {"scrollLeft":{"n":354,"ms":827.6},"clientHeight":{"n":387,"ms":180.4},...}; in its rAF part (105723-107016.6 ms): {"scrollLeft":{"n":352,"ms":820.9},"Element.getBoundingClientRect":{"n":742,"ms":7.1},...}
REPORT api probe top 1: clientHeight 178.7 ms at 105418.4 ms, target <div> [data-mcp-app-scroll-host data-app-action-timeline-scroll data-thread-reading] scroller; stack $@176742.d99552236e.js:1:23828 < callback@76629.6adf997716.js:17:9870 < ...
SUMMARY p1-ats12-apiprobe: 0 FAILs

# 8 p1-ats12-trace
REPORT trace: 24419 events, started at page time 130373.89999997616 (101018 ms after Enter)
REPORT completion frame: start 105023.8 ms, duration 1963.7, ... scripts 1319.8/1238.3 forced ...; 620.8/177.9 forced ...
SUMMARY p1-ats12-trace: 0 FAILs
```

Every run printed `PASS no-escape` and `PASS server-unchanged`.

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-hydrate-1124          # 06:12:40
$B/lab-lock release --lab 2 --owner stream-hydrate-1124
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":3360134,"extensions":[],"flags":[]},"at":"2026-11-24T06:12:51.280Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

Two short readers, kept outside the repo:

- **`/tmp/sh1124/an/trace.py`** reads the trace. It aligns it to Enter through the `lab-trace-start`
  mark (page time 130373.9 minus 101018 ms). Over the main thread it lists the `Layout` and
  `UpdateLayoutTree` events in a window, grouped by their top three stack frames, with dirty or
  total objects and element counts.

  ```sh
  python3 -I /tmp/sh1124/an/trace.py $C/p1-ats12-trace.trace.json 29355.9 105645 106975   # rAF part
  python3 -I /tmp/sh1124/an/trace.py $C/p1-ats12-trace.trace.json 29355.9 105023 105645   # stream task
  ```
  ```text
  raf Layout 364 444.7 ULT 565 796.1
     Layout ['A@299268.5b3cdf27e2.js:1:41468 < A@299268.5b3cdf27e2.js:1:42317 < A@299268.5b3cdf27e2.js:1:41839', 309, 350.8, 12743, 9000]
     Layout ['u@299268.5b3cdf27e2.js:1:50555 < B@299268.5b3cdf27e2.js:1:51325 < @299268.5b3cdf27e2.js:1:51055', 55, 94.0, 2434, 9250]
     UpdateLayoutTree ['u@299268.5b3cdf27e2.js:1:50555 < B@... < @...:51055', 255, 732.2, 25248, 0]
     UpdateLayoutTree ['A@...:41468 < A@...:42317 < A@...:41839', 309, 63.8, 700, 0]
  task Layout 3 171.5 ULT 3 7.0
     Layout ['$@176742.d99552236e.js:1:23828 < callback@76629.6adf997716.js:17:9870 < aP@176742.d99552236e.js:1:43221', 3, 171.5, 507, 8984]
  ```
- **`/tmp/sh1124/an/build.py`** built `data.json` from `$C/*.json` and the trace summaries. It wrote
  the sanitized logs: home → `~`, URLs → `<url>`, extension and chat ids → `<id>`.

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-stream-hydrate/*; echo $?   # 1: no match
git status --short extension/    # (empty)
```
