# Commands and actual output

Working directory: each pinned build worktree unless noted. Private CHAT URLs are resolved from the named lab fixture and are never printed here. External task adapters leave all tracked extension and harness files unchanged. Logs below are actual output with private identifiers/endpoints redacted. Branch output is restricted to measured result fields; full raw output stays private.

## Preparation

```sh
git fetch origin
git worktree add --detach /home/simon/snap/chromium/common/rail-split-main 4e6c259
git worktree add --detach /home/simon/snap/chromium/common/rail-split-pr a2ed2ce139ec26f76186b6fb9d2ed220d6658fb8
```

```text
From https://github.com/SimianW/butter
   a2b452f..4e6c259  main -> origin/main
   fb01cc8..34fcd0c  t3/replay-blocking -> origin/t3/replay-blocking
 * [new branch] t3/split-rail-a -> origin/t3/split-rail-a
Preparing worktree (detached HEAD 4e6c259)
HEAD is now at 4e6c259 Merge pull request #94 from SimianW/t3/replay-blocking
Preparing worktree (detached HEAD a2ed2ce)
HEAD is now at a2ed2ce rail: split the turn tracker, the trip and the send pre-jump out of rail.js
```

Initial `cat` of the prior reports in the stale shared checkout exited 1 (files absent). Reads from fetched origin/main succeeded. An initial task runner launch exited 1 before lock acquisition: a path replacement produced a nonexistent task directory. Corrected the external runner path, then acquired normally. Neither preparation error changed the browser or tested source.

## bench-acquire

Started 2026-11-12T05:27:58.376995+00:00; finished 2026-11-12T05:27:58.441024+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-a-live --wait 1800 --perf --needs-fixture math12
```

```text
1
```

## bench-restart-main-1

Started 2026-11-12T05:27:58.441334+00:00; finished 2026-11-12T05:28:00.514445+00:00; exit 0; 2.073 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3541081)
```

## bench-main-1

Started 2026-11-12T05:28:00.514586+00:00; finished 2026-11-12T05:30:29.763423+00:00; exit 0; 149.249 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-1 1
```

```text
05:28:05 [bench-main-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
05:30:29 [bench-main-1] rep 1: fps=48.6 p95=49.9 jank=3.5% busy=50.6% style=14.5% blocked=8.0s maxFreeze=760 keyP95=220.6 keyMax=234.2 wheelP95=82 LoAF[renderSL=17.6s forcedSL=1.7s script=2.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1176 seenMarks=438 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3619,"visibleScrollers":1,"off":""}
```

## bench-restart-pr-1

Started 2026-11-12T05:30:29.763999+00:00; finished 2026-11-12T05:30:31.836343+00:00; exit 0; 2.072 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3544501)
```

## bench-pr-1

Started 2026-11-12T05:30:31.836527+00:00; finished 2026-11-12T05:33:00.674113+00:00; exit 0; 148.838 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-1 1
```

```text
05:30:36 [bench-pr-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
05:33:00 [bench-pr-1] rep 1: fps=48.7 p95=33.5 jank=3.5% busy=51.2% style=14.5% blocked=8.2s maxFreeze=808 keyP95=223.1 keyMax=229.4 wheelP95=94 LoAF[renderSL=17.1s forcedSL=1.9s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1178 seenMarks=444 butter={"smootherFrames":390,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
```

## bench-restart-main-2

Started 2026-11-12T05:33:00.675178+00:00; finished 2026-11-12T05:33:02.746418+00:00; exit 0; 2.071 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3548442)
```

## bench-main-2

Started 2026-11-12T05:33:02.746554+00:00; finished 2026-11-12T05:35:40.654296+00:00; exit 0; 157.908 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-2 1
```

```text
05:33:07 [bench-main-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:35:40 [bench-main-2] rep 1: fps=46.3 p95=50.1 jank=5% busy=54.3% style=18.1% blocked=12.2s maxFreeze=808 keyP95=248 keyMax=254.5 wheelP95=107 LoAF[renderSL=22.5s forcedSL=2.3s script=2.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=442 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4062,"visibleScrollers":1,"off":""}
```

## bench-restart-pr-2

Started 2026-11-12T05:35:40.655632+00:00; finished 2026-11-12T05:35:42.728062+00:00; exit 0; 2.072 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3552045)
```

## bench-pr-2

Started 2026-11-12T05:35:42.728202+00:00; finished 2026-11-12T05:38:20.905388+00:00; exit 0; 158.177 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-2 1
```

```text
05:35:47 [bench-pr-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:38:20 [bench-pr-2] rep 1: fps=46.4 p95=50.1 jank=5.1% busy=55% style=18.2% blocked=12.4s maxFreeze=767 keyP95=252.6 keyMax=258.9 wheelP95=107 LoAF[renderSL=22.5s forcedSL=2.3s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1160 seenMarks=440 butter={"smootherFrames":389,"published":388} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restart-main-3

Started 2026-11-12T05:38:20.906449+00:00; finished 2026-11-12T05:38:22.978070+00:00; exit 0; 2.072 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3556520)
```

## bench-main-3

Started 2026-11-12T05:38:22.978218+00:00; finished 2026-11-12T05:40:58.160494+00:00; exit 0; 155.182 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-3 1
```

```text
05:38:27 [bench-main-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:40:57 [bench-main-3] rep 1: fps=46.5 p95=50.1 jank=5.1% busy=54.7% style=18.1% blocked=12.1s maxFreeze=764 keyP95=258.9 keyMax=265.2 wheelP95=101 LoAF[renderSL=22.5s forcedSL=2.1s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1173 seenMarks=440 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restart-pr-3

Started 2026-11-12T05:40:58.161800+00:00; finished 2026-11-12T05:41:00.234937+00:00; exit 0; 2.073 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3560665)
```

## bench-pr-3

Started 2026-11-12T05:41:00.235081+00:00; finished 2026-11-12T05:43:38.325580+00:00; exit 0; 158.091 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-3 1
```

```text
05:41:04 [bench-pr-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:43:38 [bench-pr-3] rep 1: fps=46 p95=50.1 jank=5% busy=54.5% style=18.7% blocked=12.9s maxFreeze=806 keyP95=251.9 keyMax=265 wheelP95=111 LoAF[renderSL=23.1s forcedSL=2.2s script=2.5s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1178 seenMarks=440 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restart-main-4

Started 2026-11-12T05:43:38.327004+00:00; finished 2026-11-12T05:43:40.399557+00:00; exit 0; 2.073 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3564729)
```

## bench-main-4

Started 2026-11-12T05:43:40.399705+00:00; finished 2026-11-12T05:46:18.495648+00:00; exit 0; 158.096 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-4 1
```

```text
05:43:44 [bench-main-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:46:18 [bench-main-4] rep 1: fps=46.9 p95=50 jank=4.8% busy=53% style=17.6% blocked=11.3s maxFreeze=766 keyP95=228.5 keyMax=235 wheelP95=96 LoAF[renderSL=21.7s forcedSL=2.2s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=440 butter={"smootherFrames":389,"published":388} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restart-pr-4

Started 2026-11-12T05:46:18.497190+00:00; finished 2026-11-12T05:46:20.569848+00:00; exit 0; 2.073 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3568295)
```

## bench-pr-4

Started 2026-11-12T05:46:20.570037+00:00; finished 2026-11-12T05:48:58.163007+00:00; exit 0; 157.593 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-4 1
```

```text
05:46:24 [bench-pr-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:48:57 [bench-pr-4] rep 1: fps=46.4 p95=50.1 jank=5% busy=54.4% style=18.2% blocked=12.3s maxFreeze=798 keyP95=251.8 keyMax=258.3 wheelP95=107 LoAF[renderSL=22.6s forcedSL=2.2s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1171 seenMarks=444 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4064,"visibleScrollers":1,"off":""}
```

## bench-restart-main-5

Started 2026-11-12T05:48:58.164553+00:00; finished 2026-11-12T05:49:00.236969+00:00; exit 0; 2.072 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3572480)
```

## bench-main-5

Started 2026-11-12T05:49:00.237122+00:00; finished 2026-11-12T05:51:38.287288+00:00; exit 0; 158.05 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-5 1
```

```text
05:49:04 [bench-main-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:51:38 [bench-main-5] rep 1: fps=46.3 p95=50 jank=4.9% busy=54% style=18.4% blocked=12.5s maxFreeze=782 keyP95=263.3 keyMax=278.8 wheelP95=102 LoAF[renderSL=22.6s forcedSL=2.3s script=2.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1168 seenMarks=440 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restart-pr-5

Started 2026-11-12T05:51:38.289045+00:00; finished 2026-11-12T05:51:40.359869+00:00; exit 0; 2.071 s.

```sh
LAB_ID=1 LAB_EXTENSIONS=<this-build>/extension LAB_FLAGS=--disable-extensions-except=<this-build>/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3576033)
```

## bench-pr-5

Started 2026-11-12T05:51:40.360038+00:00; finished 2026-11-12T05:54:17.957043+00:00; exit 0; 157.597 s.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-a-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-5 1
```

```text
05:51:44 [bench-pr-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
05:54:17 [bench-pr-5] rep 1: fps=46.1 p95=66.6 jank=5.2% busy=55.3% style=18.2% blocked=12.7s maxFreeze=775 keyP95=247.4 keyMax=262.7 wheelP95=90 LoAF[renderSL=22.5s forcedSL=2.1s script=2.4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1185 seenMarks=440 butter={"smootherFrames":388,"published":387} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-restore

Started 2026-11-12T05:54:17.959116+00:00; finished 2026-11-12T05:54:27.696403+00:00; exit 0; 9.737 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-a-live
```

```text
restore lab 1: restarting browser (now {"pid":3576033,"extensions":["/home/simon/snap/chromium/common/rail-split-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3580260)
restored {"lab":1,"restarted":true,"url":"<private-chat-url><id>","composer":"","pages":["<private-chat-url><id>"],"browser":{"pid":3580260,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T05:54:27.576Z","ok":true}
```

## bench-release

Started 2026-11-12T05:54:27.696535+00:00; finished 2026-11-12T05:54:27.760435+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-a-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

## matrix-main

Started 2026-11-12T05:54:34.470498+00:00; finished 2026-11-12T05:59:38.658467+00:00; exit 0; 304.188 s.

```sh
EXT=/home/simon/snap/chromium/common/rail-split-main/extension OUT=/tmp/rail-split-a-live-work/matrix-main TESTED_HEAD=4e6c259 LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 node --no-warnings --experimental-loader /tmp/rail-split-a-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (40 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":89,"p95FrameMs":16.8,"maxFrameMs":33.3,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.7,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.8,16.8,16.8],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":44,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":17,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":17},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (26 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":20,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":20},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (26 s)
ok   reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
pass resolve: 1/1 checks passed (3 s)
ok   card delete removes selection bookmark {"remaining":1}
ok   earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
ok   card delete removes both test bookmarks {"remaining":0,"marks":0}
pass delete: 4/4 checks passed (11 s)
ok   real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
ok   list item: the Bookmark cell is named Bookmark selection
ok   list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
ok   list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
ok   list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
ok   card delete removes list item test bookmark {"remaining":0,"marks":0}
pass list-item: 6/6 checks passed (102 s)

chromium: started (pid 3588038)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-a-live-work/matrix-main
35 checks passed
```

## wash-main

Started 2026-11-12T05:59:38.658806+00:00; finished 2026-11-12T06:01:44.441744+00:00; exit 0; 125.783 s.

```sh
EXT=/home/simon/snap/chromium/common/rail-split-main/extension OUT=/tmp/rail-split-a-live-work/wash-main TESTED_HEAD=4e6c259 LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 node --no-warnings --experimental-loader /tmp/rail-split-a-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (29 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
ok   wash: the Bookmark cell bookmarks the paragraph {"stored":1}
ok   wash: the Bookmark cell bookmarks the selection {"stored":2}
ok   wash: the Bookmark cell bookmarks the table {"stored":3}
pass wash-bookmark: 3/3 checks passed (11 s)
ok   wash light: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a paragraph: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a paragraph: gone after the hold and fade
pass wash-light-paragraph: 6/6 checks passed (7 s)
ok   wash light: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a selection: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a selection: gone after the hold and fade
pass wash-light-selection: 6/6 checks passed (7 s)
ok   wash light: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a table: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash light: a table: gone after the hold and fade
pass wash-light-table: 5/5 checks passed (7 s)
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (21 s)
ok   wash dark: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a paragraph: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a paragraph: gone after the hold and fade
pass wash-dark-paragraph: 6/6 checks passed (8 s)
ok   wash dark: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a selection: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a selection: gone after the hold and fade
pass wash-dark-selection: 6/6 checks passed (7 s)
ok   wash dark: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a table: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash dark: a table: gone after the hold and fade
pass wash-dark-table: 5/5 checks passed (7 s)

chromium: stopped
chromium: started (pid 3591410)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-a-live-work/wash-main
42 checks passed
```

## matrix-pr

Started 2026-11-12T06:01:44.442113+00:00; finished 2026-11-12T06:06:31.166091+00:00; exit 0; 286.724 s.

```sh
EXT=/home/simon/snap/chromium/common/rail-split-pr/extension OUT=/tmp/rail-split-a-live-work/matrix-pr TESTED_HEAD=a2ed2ce139ec26f76186b6fb9d2ed220d6658fb8 LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 node --no-warnings --experimental-loader /tmp/rail-split-a-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (42 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":34,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":136,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.8,16.7],"bookmarkedP95FrameMs":[16.8,16.7,16.8]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":44,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":19,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":19},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (26 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":21,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":21},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (26 s)
ok   reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
pass resolve: 1/1 checks passed (3 s)
ok   card delete removes selection bookmark {"remaining":1}
ok   earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
ok   card delete removes both test bookmarks {"remaining":0,"marks":0}
pass delete: 4/4 checks passed (11 s)
ok   real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
ok   list item: the Bookmark cell is named Bookmark selection
ok   list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
ok   list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
ok   list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
ok   card delete removes list item test bookmark {"remaining":0,"marks":0}
pass list-item: 6/6 checks passed (83 s)

chromium: started (pid 3598736)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-a-live-work/matrix-pr
35 checks passed
```

## wash-pr

Started 2026-11-12T06:06:31.166365+00:00; finished 2026-11-12T06:08:41.868926+00:00; exit 0; 130.703 s.

```sh
EXT=/home/simon/snap/chromium/common/rail-split-pr/extension OUT=/tmp/rail-split-a-live-work/wash-pr TESTED_HEAD=a2ed2ce139ec26f76186b6fb9d2ed220d6658fb8 LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 node --no-warnings --experimental-loader /tmp/rail-split-a-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (31 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
ok   wash: the Bookmark cell bookmarks the paragraph {"stored":1}
ok   wash: the Bookmark cell bookmarks the selection {"stored":2}
ok   wash: the Bookmark cell bookmarks the table {"stored":3}
pass wash-bookmark: 3/3 checks passed (11 s)
ok   wash light: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a paragraph: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a paragraph: gone after the hold and fade
pass wash-light-paragraph: 6/6 checks passed (7 s)
ok   wash light: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a selection: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a selection: gone after the hold and fade
pass wash-light-selection: 6/6 checks passed (7 s)
ok   wash light: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a table: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash light: a table: gone after the hold and fade
pass wash-light-table: 5/5 checks passed (7 s)
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (25 s)
ok   wash dark: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a paragraph: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a paragraph: gone after the hold and fade
pass wash-dark-paragraph: 6/6 checks passed (8 s)
ok   wash dark: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a selection: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a selection: gone after the hold and fade
pass wash-dark-selection: 6/6 checks passed (7 s)
ok   wash dark: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a table: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash dark: a table: gone after the hold and fade
pass wash-dark-table: 5/5 checks passed (7 s)

chromium: stopped
chromium: started (pid 3602784)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-a-live-work/wash-pr
42 checks passed
```

## live-acquire

Started 2026-11-12T06:08:41.869168+00:00; finished 2026-11-12T06:08:41.933131+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 1 --owner rail-split-a-live --wait 1800 --perf --needs-fixture math12
```

```text
1
```

## convcheck-after

Started 2026-11-12T06:08:41.933467+00:00; finished 2026-11-12T06:08:43.350835+00:00; exit 0; 1.417 s.

```sh
node /tmp/rail-split-a-live-work/convcheck.mjs after
```

```text
{"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restart-main

Started 2026-11-12T06:08:43.351149+00:00; finished 2026-11-12T06:08:45.421669+00:00; exit 0; 2.071 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-main/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3617536)
```

## auth-main

Started 2026-11-12T06:08:45.421896+00:00; finished 2026-11-12T06:08:46.988958+00:00; exit 0; 1.567 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension node /tmp/rail-split-a-live-work/auth.mjs
```

```text
authenticated: true
```

## live-acquire

Started 2026-11-12T06:15:29.931130+00:00; finished 2026-11-12T06:15:29.995282+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-a-live --wait 1800 --perf --needs-fixture math12
```

```text
1
```

## convcheck-resume-before

Started 2026-11-12T06:15:29.995617+00:00; finished 2026-11-12T06:15:31.213318+00:00; exit 0; 1.218 s.

```sh
node /tmp/rail-split-a-live-work/convcheck.mjs after
```

```text
{"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restart-main

Started 2026-11-12T06:15:31.213527+00:00; finished 2026-11-12T06:15:33.286565+00:00; exit 0; 2.073 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-main/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3617536)
```

## auth-main

Started 2026-11-12T06:15:33.286795+00:00; finished 2026-11-12T06:15:34.403065+00:00; exit 0; 1.116 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension node /tmp/rail-split-a-live-work/auth.mjs
```

```text
authenticated: true
```

## jump-typing-main

Started 2026-11-12T06:15:34.403306+00:00; finished 2026-11-12T06:16:08.161569+00:00; exit 1; 33.758 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension TRACE=0 CHECK=1 node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/jump-typing.mjs current 3
```

```text
file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-typing.mjs:102
 await editor.focus();await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await sleep(250);if((await editor.innerText()).trim())throw Error('Failed to clear composer');ownsDraft=false;
                                                                                                                                                          ^

Error: Failed to clear composer
    at file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-typing.mjs:102:155

Node.js v24.17.0
```

## jump-latency-main

Started 2026-11-12T06:16:08.161792+00:00; finished 2026-11-12T06:16:08.526369+00:00; exit 1; 0.365 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension VERSION=new EXT=/home/simon/snap/chromium/common/rail-split-latency-main OUT=/tmp/rail-split-a-live-work/jump-latency-main node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/jump-latency.mjs
```

```text
file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-latency.mjs:25
  const replace = (a,b) => { if (!source.includes(a)) throw Error('Instrumentation anchor missing: '+a); source=source.replace(a,b); };
                                                            ^

Error: Instrumentation anchor missing:   const ZH =
    at replace (file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-latency.mjs:25:61)
    at instrument (file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-latency.mjs:26:3)
    at file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/jump-latency.mjs:123:56
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:633:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.17.0
```

## nav-earlier-live-main

Started 2026-11-12T06:16:08.526576+00:00; finished 2026-11-12T06:16:56.288428+00:00; exit 1; 47.762 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/nav-earlier-live.mjs
```

```text
{"initial":{"ticks":5,"more":true},"first":"<private-label>","top":null,"ticks":16,"more":false,"warp":"hidden","busy":0,"ms":37195,"pages":[{"at":716,"status":200,"turns":"2"},{"at":1520,"status":200,"turns":"2"},{"at":2391,"status":200,"turns":"2"},{"at":6185,"status":200,"turns":"2"},{"at":8463,"status":200,"turns":"2"},{"at":11498,"status":200,"turns":"2"},{"at":13348,"status":200,"turns":"2"},{"at":16777,"status":200,"turns":"2"},{"at":25719,"status":200,"turns":"2"},{"at":28319,"status":200,"turns":"2"},{"at":32095,"status":200,"turns":"2"}],"errors":[],"uncoveredInsertions":0,"sampledFrames":908,"insertions":0}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(result.top !== null && Math.abs(result.top - 64) <= 3)

    at file:///home/simon/snap/chromium/common/rail-split-main/lab/harness/nav-earlier-live.mjs:67:73 {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.17.0
```

## nav-settle-main

Started 2026-11-12T06:16:56.288643+00:00; finished 2026-11-12T06:20:36.294194+00:00; exit 124; 220.006 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/nav-settle.mjs
```

```text
{"run":1,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":2,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":3,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":4,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
```

## branch-live-main

Started 2026-11-12T06:20:36.294472+00:00; finished 2026-11-12T06:21:21.759446+00:00; exit 0; 45.465 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-main/extension BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-a-live-work/branch-main node lab/harness/branch-live-task.mjs
```

```text
[Raw stdout excluded: contains account/chat metadata. Measured fields are exported in report.md and data/branch-live-*.json.]
```

## live-restart-pr

Started 2026-11-12T06:21:21.759802+00:00; finished 2026-11-12T06:21:23.831486+00:00; exit 0; 2.072 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3625916)
```

## auth-pr

Started 2026-11-12T06:21:23.831688+00:00; finished 2026-11-12T06:21:25.248975+00:00; exit 0; 1.417 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension node /tmp/rail-split-a-live-work/auth.mjs
```

```text
authenticated: true
```

## jump-typing-pr

Started 2026-11-12T06:21:25.249185+00:00; finished 2026-11-12T06:21:58.764718+00:00; exit 1; 33.516 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension TRACE=0 CHECK=1 node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/jump-typing.mjs current 3
```

```text
file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-typing.mjs:102
 await editor.focus();await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await sleep(250);if((await editor.innerText()).trim())throw Error('Failed to clear composer');ownsDraft=false;
                                                                                                                                                          ^

Error: Failed to clear composer
    at file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-typing.mjs:102:155

Node.js v24.17.0
```

## jump-latency-pr

Started 2026-11-12T06:21:58.765008+00:00; finished 2026-11-12T06:21:59.130019+00:00; exit 1; 0.365 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension VERSION=new EXT=/home/simon/snap/chromium/common/rail-split-latency-pr OUT=/tmp/rail-split-a-live-work/jump-latency-pr node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/jump-latency.mjs
```

```text
file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-latency.mjs:25
  const replace = (a,b) => { if (!source.includes(a)) throw Error('Instrumentation anchor missing: '+a); source=source.replace(a,b); };
                                                            ^

Error: Instrumentation anchor missing:   const ZH =
    at replace (file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-latency.mjs:25:61)
    at instrument (file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-latency.mjs:26:3)
    at file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/jump-latency.mjs:132:45
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:633:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.17.0
```

## nav-earlier-live-pr

Started 2026-11-12T06:21:59.130225+00:00; finished 2026-11-12T06:22:45.554608+00:00; exit 1; 46.424 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/nav-earlier-live.mjs
```

```text
{"initial":{"ticks":5,"more":true},"first":"<private-label>","top":null,"ticks":16,"more":false,"warp":"hidden","busy":0,"ms":35269,"pages":[{"at":709,"status":200,"turns":"2"},{"at":2464,"status":200,"turns":"2"},{"at":4830,"status":200,"turns":"2"},{"at":7582,"status":200,"turns":"2"},{"at":11165,"status":200,"turns":"2"},{"at":13360,"status":200,"turns":"2"},{"at":16301,"status":200,"turns":"2"},{"at":20135,"status":200,"turns":"2"},{"at":22648,"status":200,"turns":"2"},{"at":26199,"status":200,"turns":"2"},{"at":28823,"status":200,"turns":"2"}],"errors":[],"uncoveredInsertions":0,"sampledFrames":633,"insertions":0}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(result.top !== null && Math.abs(result.top - 64) <= 3)

    at file:///home/simon/snap/chromium/common/rail-split-pr/lab/harness/nav-earlier-live.mjs:67:73 {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.17.0
```

## nav-settle-pr

Started 2026-11-12T06:22:45.554822+00:00; finished 2026-11-12T06:26:25.561284+00:00; exit 124; 220.006 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension node --import /tmp/rail-split-a-live-work/guard.mjs lab/harness/nav-settle.mjs
```

```text
{"run":1,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":2,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":3,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
{"run":4,"arrivedMs":null,"top":null,"busy":0,"warp":"hidden"}
```

## branch-live-pr

Started 2026-11-12T06:26:25.561554+00:00; finished 2026-11-12T06:27:06.969200+00:00; exit 0; 41.408 s.

```sh
LAB_ID=1 LAB_OWNER=rail-split-a-live CHAT='<math12-from-lab-config>' LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-a-live-work/branch-pr node lab/harness/branch-live-task.mjs
```

```text
[Raw stdout excluded: contains account/chat metadata. Measured fields are exported in report.md and data/branch-live-*.json.]
```

## live-restore

Started 2026-11-12T06:27:06.969423+00:00; finished 2026-11-12T06:27:17.110293+00:00; exit 0; 10.141 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-a-live
```

```text
restore lab 1: restarting browser (now {"pid":3625916,"extensions":["/home/simon/snap/chromium/common/rail-split-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3634026)
restored {"lab":1,"restarted":true,"url":"<private-chat-url><id>","composer":"","pages":["<private-chat-url><id>"],"browser":{"pid":3634026,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T06:27:16.472Z","ok":true}
```

## live-release

Started 2026-11-12T06:27:17.110536+00:00; finished 2026-11-12T06:27:17.175455+00:00; exit 0; 0.065 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-a-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

## postcheck-acquire

Started 2026-11-12T06:27:39.406619+00:00; finished 2026-11-12T06:27:39.470494+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-a-live --wait 1800 --needs-fixture math12
```

```text
1
```

## convcheck-resume-after

Started 2026-11-12T06:27:39.470764+00:00; finished 2026-11-12T06:27:40.788340+00:00; exit 0; 1.318 s.

```sh
node /tmp/rail-split-a-live-work/convcheck.mjs resume-after
```

```text
{"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## postcheck-restore

Started 2026-11-12T06:27:40.788532+00:00; finished 2026-11-12T06:27:45.010043+00:00; exit 0; 4.222 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-a-live
```

```text
restored {"lab":1,"restarted":false,"url":"<private-chat-url><id>","composer":"","pages":["<private-chat-url><id>"],"browser":{"pid":3634026,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T06:27:44.372Z","ok":true}
```

## postcheck-release

Started 2026-11-12T06:27:45.010206+00:00; finished 2026-11-12T06:27:45.074241+00:00; exit 0; 0.064 s.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-a-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": false}
```

## convcheck before

```sh
node /tmp/rail-split-a-live-work/convcheck.mjs before
```

Actual result (server-side user-turn count and fingerprint, no text/IDs):

```json
{
  "status": 200,
  "users": 16,
  "userTurnsSha256": "fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"
}
```

## convcheck after

```sh
node /tmp/rail-split-a-live-work/convcheck.mjs after
```

Actual result (server-side user-turn count and fingerprint, no text/IDs):

```json
{
  "status": 200,
  "users": 16,
  "userTurnsSha256": "fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"
}
```

## Restart recovery and saved-result inspection

Before any browser action, `ps -eo pid,ppid,lstart,etime,args | rg 'rail-split-a-live|bookmarks-live|jump-typing|jump-latency|nav-earlier-live|nav-settle|branch-live|lab-lock|lab-restore'` showed only its own shell and rg. A second Node/runner process search found no test process; `ps -p 3580853 -o pid,ppid,args` printed only the header (the lock owner's PID was absent).

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
{"lab": 1, "held": true, "owner": "rail-split-a-live"}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": true, "owner": "rail-split-a-live"}
```

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-a-live
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-a-live
```

Restore stdout (private URLs and source paths redacted):

```text
restore lab 1: restarting browser (tested main extension/flags differ from defaults)
chromium: stopped
chromium: started (pid 3615767)
restored {"lab":1,"restarted":true,"url":"<private-home-url>","composer":"","pages":["<private-home-url>"],"browser":{"pid":3615767,"extensions":["<default-extension>"],"flags":[]},"at":"2026-11-12T06:15:00.521Z","ok":true}
{"lab": 1, "lab_released": true, "perf_released": true}
```

The original restore line contains detailed extension paths; the first line above summarizes it. All other lines retain the actual fields, with URLs and default-extension paths replaced. Both commands exited 0.

The saved-result comparison read the four summary.json files, counted passing checks, compared ordered (name, pass) pairs, then compared cleanup objects. Actual output:

```text
matrix main 35 35 pr 35 35 ordered identical True cleanup identical True cleanup {'remainingBeforeFallback': 0, 'remainingAfterFallback': 0, 'shortcutsRestored': True, 'restored': True, 'composerEmpty': True, 'oneHomeTab': True, 'defaultExtensions': True, 'labLockReleased': True, 'perfLockReleased': True}
wash main 42 42 pr 42 42 ordered identical True cleanup identical True cleanup {'remainingBeforeFallback': 3, 'remainingAfterFallback': 0, 'restored': True, 'composerEmpty': True, 'oneHomeTab': True, 'defaultExtensions': True, 'labLockReleased': True, 'perfLockReleased': True}
```

Read the original task's messages through the thread reader and reused its `/tmp/rail-split-a-live-work` setup. Preserved the interrupted typing log and partial JSON separately. The resume runner skips the completed replay/bookmark stages and executes only the outstanding live commands. Its stage commands and outputs are listed above.

```sh
python3 /tmp/rail-split-a-live-work/run-resume.py
```

Each stage prints `<name> exit <code> seconds <elapsed>`; the exact stage exits and durations appear in report.md and their timestamps above.

## Separate publication worktree

```sh
git fetch origin
git ls-remote origin refs/heads/t3/split-rail-a
git diff a2ed2ce origin/t3/split-rail-a -- extension
git worktree add -b t3/split-rail-a /tmp/rail-split-a-live-report origin/t3/split-rail-a
```

```text
From https://github.com/SimianW/butter
   a2ed2ce..038b65d  t3/split-rail-a -> origin/t3/split-rail-a
038b65dcf20ae64b6f308d752e757667573b36d4 refs/heads/t3/split-rail-a
Preparing worktree (new branch 't3/split-rail-a')
branch 't3/split-rail-a' set up to track 'origin/t3/split-rail-a'.
HEAD is now at 038b65d review: pin the trip's token, attach's onScreen clear and reconcile, scroller-as-content, host keys and wheel mid-trip; point stale comments at rail/turns.js
```

The extension diff changed one comment in seek/core-main.js from rail/rail.js to rail/turns.js, and one comment in stream/offscreen.js to name the turn tracker. No executable extension code changed between measured a2ed2ce and publication base 038b65d.

The final byte check iterated `git ls-tree -r --name-only HEAD extension` and compared each file with `git show HEAD:<path>`. Actual output:

```json
{
  "main": {
    "pinnedHead": "4e6c25928ee3eb1b31a91533ce6490ce7ea0358e",
    "extensionFiles": 62,
    "mismatches": 0
  },
  "pr": {
    "pinnedHead": "a2ed2ce139ec26f76186b6fb9d2ed220d6658fb8",
    "extensionFiles": 65,
    "mismatches": 0
  }
}
```

`git diff --name-only` and `git status --short --untracked-files=no` printed no tracked changes in either tested build.

## Server check resume-before

```json
{
  "status": 200,
  "users": 16,
  "userTurnsSha256": "fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"
}

```

## Server check resume-after

```json
{
  "status": 200,
  "users": 16,
  "userTurnsSha256": "fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"
}
```

## Report verification

```sh
python3 /tmp/rail-split-a-live-work/finish-export.py
python3 /tmp/rail-split-a-live-work/verify-report.py
```

Actual verifier output:

```text
PASS: 10 interleaved replays, 7 metric verdicts, equal answer hashes, 189 chunks/run, zero completed writes.
PASS: matrix 35/35 and wash 42/42 per build; ordered names/results and cleanup identical.
PASS: branch ready at both widths per build; identical pill measurements; guarded sends; original tabs unchanged.
PASS: all four server checks identical (HTTP 200, 16 user turns and unchanged fingerprint).
PASS: public JSON parses; privacy scan zero matches for 1436 private tokens/fragments and four identifier/endpoint patterns.
```

The first report whitespace check found one extra blank line at EOF; it was trimmed before staging the final report.

```sh
git diff --cached --check
python3 scripts/review-tier.py 038b65dcf20ae64b6f308d752e757667573b36d4
```

The final whitespace check exits 0 with no output. Actual report-only tier output:

```text
Review tier: 0
notes/runs/2026-11-12-rail-split-a-live/commands.md (Markdown)
notes/runs/2026-11-12-rail-split-a-live/comparison.svg (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/bench-runs.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/bench-summary.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/branch-live-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/branch-live-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/live-checks-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/live-checks-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/matrix-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/matrix-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/wash-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/data/wash-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-a-live/report.md (Markdown)
```

Final lab-lock status:

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```
