# Commands — Smoother streaming stage 3 (stream settle), 2026-11-24

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-settle`;
`H` is `~/snap/chromium/common/stream-audit-1123/butter`; `P` is
`~/snap/chromium/common/stream-proto-1124`.

Each replay ran through a wrapper outside the repo (`/tmp/ss1124/run.sh NAME EXT FIXTURE [VAR=value…]`):
- It refused to start a run after 1560 s of the lock, after 10 runs, or after any
  `FAIL no-escape`/`FAIL server-unchanged` in an earlier log.
- It then ran
  `env LAB_ID=2 LAB_OWNER=stream-settle-1124 EXT=<dir> LABEL=<name> FIXTURE=<f> [PHASES=stream] OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log`.

## Before the lock

```sh
diff -r -x dev extension $H          # only manifest.json differs (version_name, formatting)
mkdir -p /tmp/ss1124/bundle && cd /tmp/ss1124/bundle && curl -sS -o 299268.5b3cdf27e2.js -w '%{http_code} %{size_download} %{content_type}\n' -A '<generic Chrome UA>' <public /cdn/assets/ URL of 299268.5b3cdf27e2.js>
python3 -I /tmp/ss1124/gen.py        # copies H (or P/p1) to P/{ps,p1s,pz,psz,p1sz}/butter, applies S / Z, writes patch trees
cd /tmp/ss1124/trees && for n in ps p1s pz psz p1sz; do diff -ruN a/extension b-$n/extension > $n.patch; done
for n in ps p1s pz psz p1sz; do node --check $P/$n/butter/stream/offscreen.js; done; node --check /tmp/ss1124/read-fast-main.js
git apply --check notes/runs/2026-11-24-stream-settle/{ps,p1s,pz,psz}.patch
npx eslint lab/harness/stream-replay-live.mjs lab/harness/stream-api-probe.mjs lab/harness/stream-run-opts.mjs lab/harness/stream-laf-probe.mjs lab/harness/stream-laf-report.mjs; echo eslint-exit=$?
wc -l lab/harness/stream-api-probe.mjs lab/harness/stream-laf-probe.mjs lab/harness/stream-laf-report.mjs lab/harness/stream-replay-live.mjs
node /tmp/ss1124/dry.mjs             # one-off: each build on a synthetic chatgpt.com page, headless snap Chromium, throwaway profile
```
```text
200 72022 application/javascript
ps syntax ok … p1sz syntax ok; z-ok
ps applies / p1s applies / pz applies / psz applies
eslint-exit=0
251 stream-api-probe.mjs, 106 stream-laf-probe.mjs, 73 stream-laf-report.mjs, 500 stream-replay-live.mjs
ps   {"beforeComplete":{"n":151,"seen":21,"unrendered":130,"cv":{"auto":151},"settle":0,"mdH":17740},"atComplete":{"seen":21,"unrendered":130,"cv":{"visible":151},"settle":1,"mdH":16520},"after1500":{"seen":151,"unrendered":0,"cv":{"visible":151},"settle":1},"after3300":{"seen":151,"unrendered":0,"cv":{"auto":151},"settle":0,"mdH":16520},"expectedMdH":16520,"cvOff":{"off":"cv layout","settleWithCvOff":0},"butterErrors":0}
p1s  {"beforeComplete":{"seen":150,"unrendered":1,…},"atComplete":{"cv":{"visible":151},"settle":1},"after3300":{"seen":151,"unrendered":0,"cv":{"auto":151},"settle":0,"mdH":16520},"cvOff":{"settleWithCvOff":0},"butterErrors":0}
pz   {"z":{"visible":{"a":50,"b":0},"skippedNow":"auto","offScreen":{"a":50,"b":0},"z0":{"fast":0,"native":2},"z1":{"fast":1,"native":3},"z2":{"fast":1,"native":4},"timing":{"left":{"ms":0,"fast":200},"leftTop":{"ms":96,"fast":200},"left2":{"ms":0,"fast":200},"leftTop2":{"ms":92,"fast":200}}},"butterErrors":0}
psz  (S as ps; Z as pz, leftTop 100 / 93 ms), butterErrors 0
p1sz (S as p1s; Z as pz, leftTop 96 / 96 ms), butterErrors 0
head {"z":{"offScreen":{"a":50,"b":0},"timing":{"left":{"ms":97},"leftTop":{"ms":93},"left2":{"ms":93},"leftTop2":{"ms":99}}},"butterErrors":0}
```

(`z1` counts include the read of the scrolled span `a`, which went native; `z2` is the read with
`data-butter-off=cv`, native. `left` = only `scrollLeft` on 200 never-rendered skipped spans,
`leftTop` = `scrollLeft` then `scrollTop`, as ChatGPT's `u` does.)

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-settle-1124 --wait 1800 --perf
```
```text
2
exit=0          # taken 2026-11-24T06:34:22Z, no queue
```

## Runs

| # | Name | EXT | FIXTURE | Options | UTC | Exit |
|---|---|---|---|---|---|---:|
| 1 | `head-ats12` | H | `ats12` | `PHASES=stream` | 06:34:24–06:37:38 | 0 |
| 2 | `ps-ats12` | P/ps | `ats12` | `PHASES=stream` | 06:37:42–06:40:56 | 0 |
| 3 | `p1s-ats12` | P/p1s | `ats12` | `PHASES=stream` | 06:41:32–06:44:46 | 0 |
| 4 | `pz-ats12` | P/pz | `ats12` | `PHASES=stream` | 06:44:51–06:48:02 | 0 |
| 5 | `psz-ats12-1` | P/psz | `ats12` | `PHASES=stream` | 06:48:05–06:51:19 | 0 |
| 6 | `psz-math9` | P/psz | `math9` | `PHASES=stream` | 06:51:22–06:54:42 | 0 |
| 7 | `psz-ats12-all` | P/psz | `ats12` | (all phases) | 06:54:45–06:58:25 | 0 |
| 8 | `psz-ats12-2` | P/psz | `ats12` | `PHASES=stream` | 06:58:27–07:01:42 | 0 |

PC choice after run 3: `ps` 1678.8 ms is within 10% of `p1s` 1641.4 ms → `psz`.

Key lines per run:

```text
# 1 head-ats12
REPORT long animation frames, Enter to 5 s after stream complete (112597.1 ms): LoAF 320, total 25482.5 ms, blocking 6650.3 ms, longest 1876.7 ms; …
REPORT completion frame: start 105030.2 ms, duration 1876.7, blocking 1824.6, script part 637, rAF part 1228.5, render part 11.2; scripts 1216.8/1164.9 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"; 635/196.7 forced other user-callback "TimerHandler:setTimeout"
REPORT blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 26, data-butter-unrendered 566, data-butter-settle left 0
REPORT last turn height: before the completion frame 84652 px at 103988.5 ms; 1 s after in_progress gone 84672 px at 107216.9 ms; window end 84672 px at 112191.9 ms; after the window 84672 px; …
SUMMARY head-ats12: 0 FAILs

# 2 ps-ats12
REPORT long animation frames, … (112739.2 ms): LoAF 330, total 25747.5 ms, blocking 6276.4 ms, longest 1678.8 ms; …
REPORT completion frame: start 105128.8 ms, duration 1678.8, blocking 1611.2, script part 1568, rAF part 102.1, render part 8.7; scripts 1550.4/1069.7 forced other user-callback "TimerHandler:setTimeout"; 45.8/0 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"
REPORT blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 592, data-butter-unrendered 0, data-butter-settle left 0
REPORT last turn height: before the completion frame 84788 px at 104355 ms; 1 s after in_progress gone 36503 px at 107573.5 ms; window end 36503 px at 112534.2 ms; …
REPORT settle marks: on@106632.5 off@108208.3; frames >= 50 ms within 300 ms of each off: [204.8@108207.5]
REPORT butter mark batches in the 6 s after in_progress gone: +567s/-567u@107806.4 frames>=50 []
SUMMARY ps-ats12: 0 FAILs

# 3 p1s-ats12
REPORT long animation frames, … (112602.4 ms): LoAF 451, total 34568.1 ms, blocking 8097.5 ms, longest 1641.4 ms; …
REPORT completion frame: start 105036.6 ms, duration 1641.4, …; scripts 1544.9/1079.9 forced other …; 45.7/0 forced chatgpt:299268.5b3cdf27e2.js …
REPORT settle marks: on@106521.7 off@108092.5; frames >= 50 ms within 300 ms of each off: [205.4@108091.8]
SUMMARY p1s-ats12: 0 FAILs

# 4 pz-ats12
REPORT long animation frames, … (112759.2 ms): LoAF 348, total 26979 ms, blocking 6446.4 ms, longest 1860.8 ms; …
REPORT completion frame: start 105024.1 ms, duration 1860.8, …; scripts 1215.9/1163.7 forced chatgpt:299268.5b3cdf27e2.js …; 618.4/186.9 forced other …
REPORT read fast path (Z): at the window's end fast 66163, native 29000; from the last sample before the completion frame (104656 ms: fast 65605, native 28850) to the end: fast +558, native +150
SUMMARY pz-ats12: 0 FAILs

# 5 psz-ats12-1
REPORT long animation frames, … (112792.8 ms): LoAF 320, total 24742 ms, blocking 5895.2 ms, longest 1621.1 ms; …
REPORT completion frame: start 105025.7 ms, duration 1621.1, …; scripts 1503.4/1049.8 forced other …; 43.6/0 forced chatgpt:299268.5b3cdf27e2.js …
REPORT settle marks: on@106469.5 off@108066.8; frames >= 50 ms within 300 ms of each off: [198.2@108065.9]
REPORT read fast path (Z): at the window's end fast 65288, native 28735; … fast +279, native +79
SUMMARY psz-ats12-1: 0 FAILs

# 6 psz-math9
REPORT long animation frames, … (112622.7 ms): LoAF 496, total 39732.6 ms, blocking 10333.4 ms, longest 1676.4 ms; …
REPORT completion frame: start 105040.4 ms, duration 1676.4, …; scripts 1546.1/1132.6 forced other …; 44.9/0 forced chatgpt:299268.5b3cdf27e2.js …
SUMMARY psz-math9: 0 FAILs

# 7 psz-ats12-all
REPORT completion frame: start 105025.8 ms, duration 1642.6, …; scripts 1524.8/1073.5 forced other …; 45.9/0 forced …
REPORT wheel phase: last turn 36503 px high, 55 steps up
REPORT view shift up (55 steps): 0/55 over 4px, median 0, max 0 (lost 0, none 0, clamped 0); in the streamed answer: 0/53 over 4px, …
REPORT view shift down (55 steps, ended fromEnd 0): 0/55 over 4px, median 0, max 0 (…); in the streamed answer: 0/52 over 4px, …
PASS wheel-no-jump
SUMMARY psz-ats12-all: 0 FAILs

# 8 psz-ats12-2
REPORT long animation frames, … (112709.8 ms): LoAF 330, total 26111 ms, blocking 6531.4 ms, longest 1598.3 ms; …
REPORT completion frame: start 105029.6 ms, duration 1598.3, …; scripts 1467.3/1059.4 forced other …; 46.3/0 forced …
SUMMARY psz-ats12-2: 0 FAILs
```

Every run printed `PASS no-escape` and `PASS server-unchanged`.

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-settle-1124          # 07:01:47
$B/lab-lock release --lab 2 --owner stream-settle-1124
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":3436208,"extensions":[],"flags":[]},"at":"2026-11-24T07:01:57.593Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

- **`/tmp/ss1124/build.py`** built `data.json` from `$C/*.json` and wrote the sanitized logs: home →
  `~`, URLs → `<url>`, extension and chat ids → `<id>`. The patches were copied with their
  timestamps stripped.
- **`chatgpt-reads.txt`** was cut from the fetched bundle with a short Python slice (200 characters
  on each side of each column), with the module bounds found by its webpack keys.

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-stream-settle/*; echo $?   # 1: no match
for f in notes/runs/2026-11-24-stream-settle/*-*.log; do tail -n 1 $f; done   # 8 × "SUMMARY <label>: 0 FAILs"
git status --short extension/    # (empty)
```
