# Commands — live features, 2026-11-18 (second pass)

Run from the worktree root (`t3/fix-scrolling-and-tick-selection`, head `25f80c2`). `C` is
`~/.local/share/chatgpt-lab/captures/2026-11-18-live-features` (raw JSON, unsanitized logs, the dark-rail
crop); `B` is `~/.local/share/chatgpt-lab/bin`; `FIX` is `~/snap/chromium/common/fix-1118-fix/butter`
(`0.1.0-alpha.21+fix.1`). Every script below took no lock of its own: each one checks that the lab-2
lock is held by `LAB_OWNER` and exits 2 otherwise. Times are UTC. The final output lines are copied
from the sanitized logs in this folder.

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner features-1118 --wait 3600     # queued 02:37, the lead's run held it
```
```text
2
exit=0          # taken 02:44:45
```

## Item 1 and 2: replay (new `lab/harness/stream-replay-live.mjs`)

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT= LABEL=native-1 FIXTURE=math9 node lab/harness/stream-replay-live.mjs        # 02:45
```
```text
PASS replay-hook / replay-streams / in-progress / stream-no-jump / wheel-no-jump / no-escape / server-unchanged
SUMMARY native-1: 0 FAILs
exit=0
```

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX LABEL=fix-1 FIXTURE=math9 node lab/harness/stream-replay-live.mjs        # 02:48
```
```text
REPORT view shift up (60 steps): 8/60 over 4px (848, 828, 632, 637, 839, 1018, 1025, 853 px), median 0.3, max 1025 ...
PASS wheel-no-jump
PASS no-escape
PASS server-unchanged
SUMMARY fix-1: 0 FAILs
exit=0
```

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX LABEL=fix-ats12 FIXTURE=ats12 node lab/harness/stream-replay-live.mjs | grep -v '^REPORT buttons'   # 02:52
LAB_ID=2 LAB_OWNER=features-1118 EXT= LABEL=native-ats12 FIXTURE=ats12 node lab/harness/stream-replay-live.mjs | grep -v '^REPORT buttons'  # 02:56
```
```text
SUMMARY fix-ats12: 0 FAILs      exit=0
SUMMARY native-ats12: 0 FAILs   exit=0
```

With the scroll probe (the harness gained `PROBE=1` after the four runs above):

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX LABEL=fix-ats12-probe FIXTURE=ats12 PROBE=1 node lab/harness/stream-replay-live.mjs | grep -v '^REPORT buttons'   # 03:17
```
```text
REPORT scroll probe, wheel-up phase: 231 wrapped writes, 566 scroll events; by world/kind/top frames: [["MAIN scrollTo:before proto.<computed> [as scrollTo] (<anonymous>:31:168) < eo (page:/cdn/assets/76629.30a094a9b3.js:326:362004)",231]]
SUMMARY fix-ats12-probe: 0 FAILs
exit=0
```

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT= LABEL=native-ats12-probe FIXTURE=ats12 PROBE=1 node lab/harness/stream-replay-live.mjs | grep -v '^REPORT buttons'   # 03:20
```
```text
REPORT scroll probe, wheel-up phase: 8 wrapped writes, 65 scroll events; by world/kind/top frames: [["MAIN scrollTo:before ... < eo (page:/cdn/assets/76629.30a094a9b3.js:326:362004)",8]]
SUMMARY native-ats12-probe: 0 FAILs
exit=0
```

Numeric summary of the six replays (view shift by tracked element kind, publish intervals, the
answer's size after completion): `view-shift-by-kind.json`, made with a short Python reader over
`$C/replay-*.json`.

## Item 3: earlier-history page size (new `lab/harness/history-pages-live.mjs`)

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT= LABEL=history-native node lab/harness/history-pages-live.mjs     # 02:59
sleep 20
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX LABEL=history-fix node lab/harness/history-pages-live.mjs
```
```text
REPORT earlier-page GETs: 2, num_turns [10, 10], before param on 2, params ["before","num_turns","include_has_versions"]
SUMMARY history-native: 0 FAILs   exit=0
REPORT earlier-page GETs: 7, num_turns [2, 2, 2, 2, 2, 2, 2], before param on 7, params ["before","num_turns","include_has_versions"]
PASS older-page-size
SUMMARY history-fix: 0 FAILs      exit=0
```

## Item 4: the `ats12` tick-4 card (new `lab/harness/rail-card-probe.mjs`)

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX node lab/harness/rail-card-probe.mjs      # 03:03 → card-probe-partial-history.log
```
```text
REPORT API: 7 conversation pages, 35 messages, 10 visible questions; user messages 10
exit=0          # history load stopped at 10 of 12 questions: not the first pass's tick 4; loader fixed
```
```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX node lab/harness/rail-card-probe.mjs      # 03:04 → card-probe-2.log
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX node lab/harness/rail-card-probe.mjs      # 03:05, two fields added → card-probe-3.log
```
```text
REPORT history loaded: ChatGPT's turn list 12 entries
REPORT card 4: 389 chars; equals API q false; is API q cut at 400 true
REPORT turn of question 4: {"mounted":true,"bubbleLen":37,"bubbleInQ":true,"qInBubble":false,"qStartsWithBubble":false,"qEndsWithBubble":true,"bubbleAt":878,"restLen":877,"pill":[{"label":"(11 chars)","aria":null,"haspopup":"dialog","beforeBubble":true,"insideBubble":false}],...}
exit=0
```

## Item 5: dark theme (new `lab/harness/rail-dark-live.mjs`)

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX SHOT=$C/dark-rail.png node lab/harness/rail-dark-live.mjs    # 03:06
```
```text
PASS dark-page
PASS dark-host
PASS dark-ticks-visible
PASS light-restored
PASS light-host
SUMMARY dark: 0 FAILs
exit=0
```

## Item 6: seek release landing (new `lab/harness/seek-landing-live.mjs`)

```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX node lab/harness/seek-landing-live.mjs                        # 03:09, first verdict rule → seek-landing.log (superseded)
```
```text
FAIL seek-landing #1 / #2 / #3     SUMMARY seek-landing: 3 FAILs   exit=1
# the rule compared with the thumb's offset; the unseen preview draws the question from its start — rule fixed
```
```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX AT=0.2,0.4,0.55,0.7,0.85 node lab/harness/seek-landing-live.mjs    # 03:11 → seek-landing-2.log
```
```text
PASS seek-landing #1
FAIL seek-landing #2: preview showed question 6 +0 (unseen estimate, from its start), landed on question 5 +31261 (viewport 912)
FAIL seek-landing #3: preview showed question 7 +0 (unseen estimate, from its start), landed on question 6 +31378 (viewport 912)
PASS seek-landing #4
PASS seek-landing #5
SUMMARY seek-landing: 2 FAILs
exit=1
```
```sh
LAB_ID=2 LAB_OWNER=features-1118 EXT=$FIX AT=0.4,0.55 node lab/harness/seek-landing-live.mjs           # 03:14, target turn and session detail added → seek-landing-3.log
```
```text
REPORT trial 1 target question 6 after settle: {"mounted":false,"top":null,"h":null,"mountedTurns":[5]}; ...
FAIL seek-landing #1: preview showed question 6 +0 (unseen estimate, from its start), landed on question 5 +31266 (viewport 912)
REPORT trial 2 target question 7 after settle: {"mounted":false,"top":null,"h":null,"mountedTurns":[6]}; ...
FAIL seek-landing #2: preview showed question 7 +0 (unseen estimate, from its start), landed on question 6 +31383 (viewport 912)
SUMMARY seek-landing: 2 FAILs
exit=1
```

## Clean-up

```sh
$B/lab-restore --lab 2 --owner features-1118                                    # 03:24
node /tmp/features-1118-theme.mjs     # read-only: theme cookie, localStorage.theme, data-theme on the home tab
$B/lab-lock release --lab 2 --owner features-1118
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":false,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":687671,"extensions":[],"flags":[]},...,"ok":true}
restore exit=0
{"cookie":"light","ls":"light","dataTheme":"light","cs":"light","pages":1,"onHome":true}
{"lab": 2, "lab_released": true, "perf_released": false}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

Not run: `lab/harness/bookmarks-live.mjs` (it takes its own lock with `--lab auto`; see the report).
