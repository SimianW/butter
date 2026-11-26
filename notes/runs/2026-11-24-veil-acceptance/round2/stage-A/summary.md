# Veil acceptance, round 2, stage A: `ats12` completion frame, blocking and pre-layout (#177), 2026-11-25

**Question.** On `ats12` with `PHASES=stream`, does the final veil build with pre-layout (`552b8db`, "veil2") meet
spec #170's acceptance rules for the completion frame and blocking over the window, against `main` before the
change (`547fa0a`, "head") in the same lock sequence? And what does pre-layout itself do after completion?

**Answer.** Yes, all four rules pass. Three head and three veil2 runs were interleaved under one `--perf` lock
on lab 2:

- veil2's median completion frame is 666.4 ms (head 1999.5 ms).
- No veil2 frame reaches 1 s.
- veil2's median blocking is 72.5% below head's.
- Every veil2 run passes all 13 verdicts.

No run printed a FAIL line.

Pre-layout, traced in one more veil2 run:

- It runs 174 idle callbacks, from 983.6 ms to 4512.0 ms after `in_progress` goes. They take 1669.9 ms in
  total, and the longest is 22.8 ms.
- It lays out all 567 held blocks: 570 `Layout`s, 55,893 objects, 688.2 ms of layout and 868.6 ms of style.
- It requests KaTeX's three math fonts itself, at +1.28 s, +1.39 s and +2.40 s.
- No callback is inside a long animation frame, and no callback's task is 50 ms or longer.
- scrollTop, scrollHeight and the answer's height do not change across the callbacks.

Over the standard window, pre-layout adds no blocking at the median. One veil2 run of three has 45.1 ms more
blocking than round 1's veil runs during the pre-layout period. That time is in two frames with no script
attributed, and its source is not established.

Exact commands, the timed-out first acquire and the first traced run are in [commands.md](commands.md). The
per-run lines are in the `*.log` files.

## Per run

The columns are measured as in round 1's [stage A](../../stage-A/summary.md):

- **Completion frame:** the frame in `REPORT completion frame`.
- **Blocking over the window:** LoAF blocking from Enter to 5 s after the stream completes.
- **After gone:** the part of that blocking in frames that start after `in_progress` goes.
- **rAF:** ChatGPT's completion `FrameRequestCallback` (`chatgpt:681678.*.js`) in the completion frame.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over the window, LoAF (ms) | of it after gone (ms) | Longtask blocking (ms) | LoAF frames | rAF callback: duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `head-ats12-stream-1` | 1846.8 | 1791.1 | 6330.8 | 0 | 6262 | 323 | 1226.4 / 1173.8 | 1846.8 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-stream-1` | 666.4 | 615.5 | 1819.3 | 100.9 | 1591 | 85 | 16.3 / 7.1 | 666.4 | 0 | 13 PASS, 0 FAIL |
| `head-ats12-stream-2` | 2088.3 | 2035.8 | 9466.2 | 16.6 | 9421 | 358 | 1346.6 / 1288.1 | 2088.3 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-stream-2` | 682.6 | 627.7 | 1814.4 | 12.1 | 1484 | 77 | 16.5 / 7.1 | 682.6 | 0 | 13 PASS, 0 FAIL |
| `head-ats12-stream-3` | 1999.5 | 1942.4 | 6607.7 | 5.7 | 6749 | 301 | 1340.1 / 1283.7 | 1999.5 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-stream-3` | 661.6 | 610.8 | 1516.6 | 0 | 1320 | 72 | 15.5 / 6.7 | 661.6 | 0 | 13 PASS, 0 FAIL |
| `veil2-ats12-trace-1` (traced, not judged) | 30800.5 | 30748.3 | 34344.8 | 49.2 | 34108 | 78 | 17.9 / 7.7 | 30800.5 | 1 | 13 PASS, 0 FAIL |
| `veil2-ats12-trace-2` (traced, not judged) | 641.6 | 586.8 | 1742.0 | 27.7 | 1478 | 89 | 15.0 / 6.4 | 641.6 | 0 | 13 PASS, 0 FAIL |

- **Longest frame.** In every untraced run, the longest frame is the completion frame.
- **Verdicts.** Every run printed these verdicts: `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
  `seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
  `veil-none-rendered`, `no-escape` and `server-unchanged`. The veil2 runs also printed `veil-effective`.
- **`veil-none-rendered`.** 0 leaking blocks in every sample and after the window, on both builds.
- **Options.** `OPTS put back: … same as before true` on every run.

The veil2 runs printed these `veil-effective` lines:

```text
veil2-ats12-stream-1: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 7.1 ms of style and layout (frame 666.4 ms at 105079.5 ms)
veil2-ats12-stream-2: REPORT veil-effective: 585 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 7.1 ms of style and layout (frame 682.6 ms at 105017.8 ms)
veil2-ats12-stream-3: REPORT veil-effective: 585 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.7 ms of style and layout (frame 661.6 ms at 105023.7 ms)
```

**The first traced run is an artefact of tracing and is left out of every judgement.** Its trace categories
were u2-trace's, with the V8 CPU profiler and invalidation tracking. Its `TRACE_AT=109000 TRACE_SPAN=11000`
asked for the trace to start at 103.5 s after Enter, which is about 2 s before completion on `ats12`. Starting
the trace there stalled the page:

- `Tracing.start` returned only at 106.4 s.
- A 2.5 s rAF frame came first.
- ChatGPT's completion `setTimeout` ran for 30.7 s, where it takes 0.6 s in the other veil2 runs.
- `in_progress` went at 137.3 s instead of about 105.6 s.

The harness's next tick stopped the trace at about 137.4 s, before pre-layout began, so this trace holds no
pre-layout. The same build ran untraced three times with completion frames of 662–683 ms. That is why the
30.8 s frame is put down to tracing; this is inferred, not established. The second traced run started its
trace after the completion frame and used the default categories only. It is the trace used below.

## Median per build

| Build | Completion frame (ms) | Blocking over the window, LoAF (ms) | of it after gone (ms) | Longtask blocking (ms) | rAF forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|---:|
| head | 1999.5 | 6607.7 | 5.7 | 6749 | 1283.7 | 1999.5 |
| veil2 | 666.4 | 1814.4 | 12.1 | 1484 | 7.1 | 666.4 |
| round 1 veil (`e5f480e`, for reference) | 624.4 | 1630.1 | 1.6 | 1450 | 6.6 | 624.4 |

## Against the spec

| Rule (#170 Acceptance runs, `ats12` part) | Measured | Result |
|---|---|---|
| veil2 median completion frame under 800 ms | 666.4 ms | PASS |
| No veil2 run has a frame of at least 1 s | 0 frames ≥ 1 s in each of the 3 judged veil2 runs (longest 682.6 ms); the traced `veil2-ats12-trace-1` is excluded, see above | PASS |
| veil2 median blocking at least 50% below head's | 1814.4 vs 6607.7 ms: 72.5% below (longtask measure: 78.0% below) | PASS |
| Every veil2 run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3 judged runs: 13 PASS, 0 FAIL, exit 0 (both traced runs too) | PASS |

No FAIL line in any of the 8 runs.

## Pre-layout timeline (`veil2-ats12-trace-2`)

The trace ran from 948 ms to 10,753 ms after `in_progress` went, with the default trace categories. Times
below are ms after `in_progress` went, as the harness marks it. The completion frame started at −545 ms.

The data comes from [prelayout-callbacks.jsonl](prelayout-callbacks.jsonl), cut with
[prelayout-trace.py](prelayout-trace.py). A pre-layout callback is a `FireIdleCallback` whose `FunctionCall`
is in `stream/offscreen.js`. Its layout is the `Layout` events inside it, with their `dirtyObjects`; its
style is `UpdateLayoutTree`, with its `elementCount`.

| What | Measured |
|---|---|
| First callback | +983.6 ms. The trace began 35 ms before it, and the marker's 1 s timer starts when it sees completion, so an earlier callback is unlikely. |
| Callbacks | 174, with no gap over 100 ms between them |
| Duration | 1669.9 ms in total; median 9.2 ms, 90th percentile 12.8 ms, longest 22.8 ms; 10 over 16 ms |
| Last one ends | +4512.0 ms |
| Layout inside them | 570 `Layout`s for 567 held blocks: 55,893 objects in 688.2 ms. Style: 27,850 elements in 868.6 ms. |
| Font requests | Each font was requested from inside a pre-layout callback: KaTeX_Size1 (woff2) at +1283.1 in callback 17, loaded at +1305.3; KaTeX_Size2 (woff2) at +1391.1 in callback 20, loaded at +1408.9; KaTeX_Size3 (inline data URL, no network request) at +2402.9 in callback 63, loaded at +2412.9. |
| Font pass after `loadingdone` | It does not show as a separate run of callbacks, because the queue never drains before the last font load: `loadingdone` re-adds the blocks already laid out to the end of the same `Set`. The last 14 callbacks (+4328 to +4512 ms) have 13 `Layout`s and 740 objects but 66.6 ms of style. This fits cheap re-reads of blocks laid out before the fonts arrived. The trace cannot tie these to single blocks. |
| Frames of 50 ms or more | None holds a pre-layout callback: no callback falls inside any LoAF, and the longest task that holds one is 22.9 ms. The only LoAF in the pass period is ChatGPT's `TimerHandler:setTimeout` at +1855 (51.8 ms, 1.5 ms blocking), which head and round 1's veil also have at about +1.8 s. |
| scrollTop / scrollHeight | 9754 / 95638 in every sample from 0 to +1855 ms (8 samples), at +4903 ms, and after the window. The last turn's height stays 85136 px from +476 ms to the end of the tail (+13.6 s, about one sample a second). All 567 blocks are still held (`data-butter-unrendered`) and veiled after the pass. `veil-none-rendered`: 0 of 132 samples. |
| Tail | `TAIL_MS=12000`: no LoAF from +5 s to +14 s |

The traced numbers include tracing's overhead. In the untraced runs the pass is not visible to LoAF, because
no callback reaches 50 ms. The pass's layout and style (1557 ms traced) is about the deferred layout that
stage D3 measured inside the veil's first `window.find` (Layout 1359.9 ms traced, 36,222 objects added). Here
it is spread over 174 callbacks instead of one call.

## Blocking that pre-layout adds over the standard window

Pre-layout runs from about +1.0 s to +4.5 s after completion, inside the standard window (Enter to 5 s after
completion). LoAF blocking in frames that start after `in_progress` went:

Every run has two frames from ChatGPT after completion:

- **ChatGPT's ~300 ms frame.** 296–347 ms long. It comes at +104 to +116 ms on both veil builds and at +1.3
  to +1.5 s on head, and it has no script attributed.
- **ChatGPT's `setTimeout` frame.** It comes at about +1.8 s on every build.

| Build | Runs | After gone (ms) | ChatGPT's ~300 ms frame (ms) | ChatGPT's `setTimeout` frame (ms) | Rest, in the pass period +1.0 to +4.5 s (ms) |
|---|---|---|---|---|---|
| veil2 | stream-1, 2, 3 | 100.9, 12.1, 0 | 0.2, 1.5, 0 | 55.6, 10.6, 0 | **45.1**, 0, 0 |
| veil2, traced | trace-2 | 27.7 | 26.2 | 1.5 | 0 |
| round 1 veil | 1, 2, 3 | 1.6, 3.0, 0 | 0, 0, 0 | 1.6, 3.0, no frame | 0, 0, 0 |
| head | stream-1, 2, 3 | 0, 16.6, 5.7 | 0, 0.2, 5.7 | no frame, 16.4, 0 | 0, 0, 0 |

`veil2-ats12-stream-2` also has a 52.0 ms frame at +1256 ms in the pass period, with 0 ms blocking and no
script listed.

The 45.1 ms in `veil2-ats12-stream-1` comes from two frames:

| Frame | Duration (ms) | Blocking (ms) | Script part (ms) |
|---|---:|---:|---:|
| +3219 ms | 89.1 | 36.8 | 84.0 |
| +3481 ms | 70.6 | 8.3 | 66.9 |

LoAF lists no script over 5 ms in either frame. No head run and no round 1 veil run has a frame between +2.0
and +4.5 s. They fall inside the pass period, but in the traced run no pre-layout task was longer than 22.9
ms. So pre-layout is a possible source, but this is not established: LoAF does not list scripts from the
isolated world here (`laf butter files: {}` in every run, on both builds). A trace of a run that shows such a
frame would settle it.

**Result:** over the standard window, pre-layout adds 0 ms of blocking at the median (veil2 0 / 0 / 45.1 ms
in the pass period, round 1 veil 0 / 0 / 0 ms).

veil2's whole-window median is 184 ms above round 1's veil (1814.4 vs 1630.1 ms). Almost all of that is
before completion (median 1718.4 vs 1630.1 ms), where pre-layout does not run. Head moved as much between
rounds: its median is 6607.7 ms now and was 7410.7 ms in round 1. The completion frame is 42 ms higher
(666.4 vs 624.4 ms). That frame is mostly ChatGPT's `setTimeout` script (626–640 ms in the judged veil2 runs, 570–619
ms in round 1's veil runs), which ends before pre-layout's 1 s timer starts.

## Notes for later stages

- **Tracing.** Don't start a trace with the CPU profiler or invalidation tracking during ChatGPT's completion
  work on `ats12`, between about 103.5 and 105.7 s after Enter. To see pre-layout, start after the completion
  frame. `TRACE_AT=111100 TRACE_SPAN=10000 TAIL_MS=12000` starts at about +106.1 s and caught the first
  callback by 35 ms.
- **Timing.** Pre-layout finishes about 4.5 s after completion on `ats12`. A find or jump in u4 (about +16.5 s)
  comes well after it. A u2 jump at +2 s lands in the middle of it.
- **Runs used.** 8 harness runs. The budget clock ran 1666 s from the lock at 01:23:01Z to the second
  release. The first acquire waited 3600 s and timed out without a run.
