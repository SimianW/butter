# Commands — Smoother streaming recheck, 2026-11-23

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-23-stream-recheck`;
`H` is `~/snap/chromium/common/stream-audit-1123/butter`. Each harness ran through a small wrapper
(outside the repo) that ran `env LAB_ID=2 LAB_OWNER=stream-audit-1123 <vars> node lab/harness/<script>`,
wrote the output to `$C/<name>.raw.log` and printed start, end (UTC) and exit. Final output lines
are copied from the logs in this folder.

## Build

```sh
python3 scripts/package.py --test streamaudit
mkdir -p ~/snap/chromium/common/stream-audit-1123
unzip -q dist/butter-0.1.0-alpha.22+streamaudit.1.zip -d ~/snap/chromium/common/stream-audit-1123
python3 -c "import json;m=json.load(open('$H/manifest.json'));print(m['version'],m['version_name'])"
diff -rq $H extension
```
```text
<worktree>/dist/butter-0.1.0-alpha.22+streamaudit.1.zip
Note: Chrome version remains 0.1.0.22; remove the previous install before loading this test build.
0.1.0.22 0.1.0-alpha.22+streamaudit.1
Only in extension: dev
Files <H>/manifest.json and extension/manifest.json differ
```

## Harness addition, lint

```sh
npx eslint lab/harness/stream-replay-live.mjs lab/harness/stream-laf-probe.mjs lab/harness/survey-page-structure.mjs; echo eslint-exit=$?
node /tmp/laf-check/t.mjs      # one-off: the probe on a blank page in headless Chromium, 5 frames of 120 ms
```
```text
eslint-exit=0
{ types: [ 'long-animation-frame', 'longtask' ] }
long animation frames, Enter to stream complete (915.7 ms): LoAF 5, total 611.1 ms, blocking 354.9 ms, longest 129.3 ms; longtask 5, total 604 ms, blocking 354 ms, longest 124 ms
```

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-audit-1123 --wait 1800 --perf     # queued 03:55:29Z behind new-chat-probe
```
```text
2
exit=0          # taken 2026-11-24T04:19:43Z
```

## 1. native survey

```sh
EXT= FIXTURES=ats12,math9 LABEL=native OUT=$C/structure-native.json   survey-page-structure.mjs    # 04:19:47–04:21:08
```
```text
REPORT ats12 opened container chain {"scroller":"normal","chain":["div[[container-type:inline-size] min-h-full]:inline-size","div:normal","div[min-h-full]:normal","div:normal","div:normal","div:normal","div:normal"],"sizeContainerAboveTurn":true}
REPORT ats12 count inline-size container div.[container-type:inline-size].min-h-full = 1/1/1/1
REPORT math9 count cv blocks (COLUMN > :not(dil) KEEP) = 2231/541/782/782
REPORT math9 count inline-size container div.[container-type:inline-size].min-h-full = 1/1/1/1
exit=0
```

## 2. native replay, `ats12`

```sh
EXT= LABEL=native-ats12 FIXTURE=ats12 OUT=$C/replay-native-ats12.json   stream-replay-live.mjs     # 04:21:11–04:24:48
```
```text
REPORT long animation frames, Enter to stream complete (107496.4 ms): LoAF 627, total 77609.5 ms, blocking 40865.4 ms, longest 783.2 ms; longtask 605, total 68319 ms, blocking 38069 ms, longest 633 ms
REPORT answer DOM updates while streaming: 519, interval p10 61.3, median 144.9, p90 382 ms
REPORT native smoother rAF callbacks seen by the harness hook: 635 (hook outermost true), interval median 119.85 ms; other publish/flush-like callbacks: []
PASS wheel-no-jump
PASS no-escape
PASS server-unchanged
SUMMARY native-ats12: 0 FAILs
exit=0
```

## 3. native replay, `math9`

```sh
EXT= LABEL=native-math9 FIXTURE=math9 OUT=$C/replay-native-math9.json   stream-replay-live.mjs     # 04:24:50–04:28:40
```
```text
REPORT long animation frames, Enter to stream complete (107519.8 ms): LoAF 486, total 92634.6 ms, blocking 62304.3 ms, longest 1613.7 ms; longtask 490, total 86533 ms, blocking 62033 ms, longest 1522 ms
REPORT native smoother rAF callbacks seen by the harness hook: 346 (hook outermost true), interval median 267.6 ms; other publish/flush-like callbacks: []
PASS no-escape
PASS server-unchanged
SUMMARY native-math9: 0 FAILs
exit=0
```

## 4. head survey

```sh
EXT=$H FIXTURES=ats12,math9 LABEL=head OUT=$C/structure-head.json   survey-page-structure.mjs        # 04:28:43–04:30:10
```
```text
REPORT ats12 opened container chain {"scroller":"normal","chain":["div[[container-type:inline-size] min-h-full]:normal","div:normal","div[min-h-full]:normal","div:normal","div:normal","div:normal","div:normal"],"sizeContainerAboveTurn":false}
REPORT math9 count inline-size container div.[container-type:inline-size].min-h-full = 1/1/1/1
REPORT math9 doc [data-butter-unrendered] = 0/0/0/0
exit=0
```

## 5. head replay, `ats12`

```sh
EXT=$H LABEL=head-ats12 FIXTURE=ats12 OUT=$C/replay-head-ats12.json   stream-replay-live.mjs         # 04:30:13–04:33:54
```
```text
REPORT long animation frames, Enter to stream complete (107790.6 ms): LoAF 377, total 34271.6 ms, blocking 11063.5 ms, longest 2101.4 ms; longtask 345, total 28305 ms, blocking 11055 ms, longest 1460 ms
PASS cv-blocks
PASS seen-marks
PASS throttle-matched
REPORT __butterStats {"smootherFrames":349,"published":348}
REPORT answer DOM updates while streaming: 320, interval p10 255.1, median 267.7, p90 392.5 ms
PASS rail-new-tick
PASS rail-new-tick-lit
REPORT view shift up (60 steps): 10/60 over 4px (842, 1106, 482, 882, 731, 978, 928, 950, 1203, -700 px), median 0.25, max 1203 (lost 0, none 0, clamped 0); ...
PASS wheel-no-jump
PASS no-escape
PASS server-unchanged
SUMMARY head-ats12: 0 FAILs
exit=0
```

## 6. head replay, `math9`

```sh
EXT=$H LABEL=head-math9 FIXTURE=math9 OUT=$C/replay-head-math9.json   stream-replay-live.mjs         # 04:33:58–04:37:46
```
```text
REPORT long animation frames, Enter to stream complete (107752.5 ms): LoAF 544, total 45933.8 ms, blocking 13110 ms, longest 2061 ms; longtask 470, total 36952 ms, blocking 13452 ms, longest 1382 ms
PASS cv-blocks
PASS seen-marks
PASS throttle-matched
REPORT __butterStats {"smootherFrames":349,"published":348}
REPORT answer DOM updates while streaming: 326, interval p10 255.5, median 270.1, p90 364.5 ms
PASS no-escape
PASS server-unchanged
SUMMARY head-math9: 0 FAILs
exit=0
```

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-audit-1123          # 04:37:51
$B/lab-lock release --lab 2 --owner stream-audit-1123
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":3162804,"extensions":[],"flags":[]},"at":"2026-11-24T04:38:01.665Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

Three short Python readers (kept outside the repo) turned `$C/*.json` into the numbers here:

- one built `data.json`: per-run counts, publish intervals, view shift by tracked kind, and long
  animation frames;
- one compared today's native survey with `captures/2026-11-19-live-recheck/structure-native.json`;
- one sanitized the logs (home → `~`, URLs → `<url>`, ids → `<id>`).

```sh
grep -rn 'thread-reading\|scrollColumn\|data-virtualized-turn\|data-measured-turn' extension/    # no match: Butter reads none of the changed attributes
```
