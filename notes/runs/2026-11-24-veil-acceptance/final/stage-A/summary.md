# Final veil acceptance, stage A — ats12 completion and blocking (#177)

**PASS on all four rules.** On the `ats12` fixture with `PHASES=stream` and the default
options, `veil3` (`aed9523`) reduced the median completion frame to **664.4 ms** from
**1899.0 ms** on `main3` (`3b9c3d5`). Median LoAF blocking was **1660.1 ms** on veil3
and **6206.8 ms** on main3, a **73.3% reduction**.

Lab 2 ran three interleaved pairs and a seventh replay to trace pre-layout under one
performance lock. The six untraced runs supply the medians. The lock was acquired on
the first attempt at 18:13:28 UTC and released at 18:36:31 UTC on 2026-11-26.
The budget used was **7 runs and 23 min 3 s**. All seven replays and `lab-restore`
exited 0. [Commands and execution output](commands.md).

## Per run

Blocking is LoAF blocking from Enter to five seconds after the harness observes replay completion.
After gone counts blocking from frames starting after `in_progress` goes.
The rAF column gives ChatGPT's completion `FrameRequestCallback` duration and its forced style/layout.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | LoAF count | rAF duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `main3-ats12-stream-1` | 1899.0 | 1846.5 | 6206.8 | 0.0 | 6290 | 320 | 1246.5 / 1193.1 | 1899.0 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-1` | 601.4 | 550.3 | 1475.4 | 0.0 | 1309 | 79 | 15.0 / 6.3 | 601.4 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-2` | 1848.6 | 1796.6 | 6204.8 | 0.0 | 6456 | 311 | 1222.3 / 1169.7 | 1848.6 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-2` | 664.4 | 613.7 | 1660.1 | 0.0 | 1365 | 81 | 15.5 / 6.5 | 664.4 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-3` | 1909.3 | 1845.8 | 6821.6 | 0.0 | 6837 | 328 | 1246.2 / 1192.7 | 1909.3 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-3` | 716.1 | 664.8 | 1780.0 | 0.4 | 1484 | 91 | 16.9 / 7.6 | 716.1 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `veil3-ats12-trace-1` | 668.9 | 617.8 | 1632.2 | 0.8 | 1430 | 81 | 15.9 / 7.1 | 668.9 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |

Verdict pairs are `veil-none-rendered` / `veil-effective`.

## Median per build

| Build | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | rAF duration / forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| main3 | 1899.0 | 1845.8 | 6206.8 | 0.0 | 6456 | 1246.2 / 1192.7 | 1899.0 |
| veil3 | 664.4 | 613.7 | 1660.1 | 0.0 | 1365 | 15.5 / 6.5 | 664.4 |

## Against the spec

| Rule | Measured | Result |
|---|---|---|
| 1. veil3 median completion frame under 800 ms | 664.4 ms | PASS |
| 2. No veil3 frame of 1 s or more | 0 frames in 4 runs. Longest 716.1 ms. | PASS |
| 3. veil3 median blocking at least 50% below main3 | 1660.1 vs 6206.8 ms, 73.3% below | PASS |
| 4. Every verdict passes, including both veil verdicts on each veil3 run | 7/7 exits 0 with all expected verdicts passing, 0 FAIL lines | PASS |

## Options and post-completion geometry

The options column is the value in each `storage before the run` line. The next column records whether the applied options were exactly `{"rail":true,"bookmark":true}`.

| Run | Stored opts before | Default options applied | Storage restored | Sampled scrollTop / scrollHeight (px) | Last turn (px) |
|---|---|---|---|---|---:|
| `main3-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95570 | 85068 |
| `veil3-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95570 | 85068 |
| `veil3-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95570 | 85068 |
| `veil3-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil3-ats12-trace-1` | `null` | Yes | Yes | 9754 / 95638 | 85136 |

## Frames of at least 50 ms after completion plus 1 s

Offsets are measured from the `in_progress gone` mark. The standard window ends five seconds after the harness observes replay completion.

| Run | Offset (ms) | Duration (ms) | Blocking (ms) | Script attribution |
|---|---:|---:|---:|---|
| `main3-ats12-stream-1` | +1339.0 | 307.7 | 0.0 | None listed |
| `main3-ats12-stream-1` | +1652.7 | 57.2 | 0.0 | `other TimerHandler:setTimeout` (10.5 ms, 0 ms forced) |
| `veil3-ats12-stream-1` | +1924.4 | 57.8 | 0.0 | `other TimerHandler:setTimeout` (43.1 ms, 0.1 ms forced) |
| `main3-ats12-stream-2` | +1315.4 | 301.1 | 0.0 | None listed |
| `main3-ats12-stream-2` | +1623.2 | 61.9 | 0.0 | `other TimerHandler:setTimeout` (19.5 ms, 0 ms forced) |
| `veil3-ats12-stream-2` | | | | No frames in the standard window |
| `main3-ats12-stream-3` | +1337.4 | 310.4 | 0.0 | None listed |
| `veil3-ats12-stream-3` | +1744.7 | 50.6 | 0.0 | `other TimerHandler:setTimeout` (46 ms, 0 ms forced) |
| `veil3-ats12-trace-1` | | | | No frames in the standard window |

Every listed frame at or after +1 s had 0 ms blocking. Three main3 runs had a
301.1–310.4 ms frame at +1.32–1.34 s with no script attribution and 0 ms blocking.
The comparable unattributed frame fell within the first second after completion on
each veil3 run. The trace replay's extended tail recorded 0 long animation frames.

## Pre-layout trace

The trace began at 106537 ms after Enter, about +947.7 ms from the `in_progress gone`
mark and +841.8 ms from the end of the 668.9 ms completion frame. Offsets below are
relative to `in_progress gone`.

| Measurement | Trace result |
|---|---|
| Pre-layout span | First callback at +974.7 ms, last callback ended at +4869.4 ms. Trace coverage continued through +10895.3 ms. |
| Callback cost | 187 `FireIdleCallback` events attributed to Butter's offscreen script. 1761.2 ms total, 9.0 ms median, 23.7 ms longest. The longest enclosing task was 23.8 ms. |
| Layout and style | 570 `Layout` events and 55,893 dirty objects counted across them, 751.0 ms total layout. Style recalculation reported 27,850 elements across events and 888.9 ms total. |
| Fonts | Pre-layout initiated the two KaTeX Size1 and Size2 requests at +1335.2 and +1457.0 ms. They loaded at +1366.3 and +1495.0 ms. A third font load began in a callback at +2534.3 ms and finished at +2545.0 ms. |
| Scroll geometry | `scrollTop` 9754 px and `scrollHeight` 95638 px in every geometry sample from +485.7 ms through +5090.6 ms, spanning the pass. `scrollHeight` was 95638 px after the window. Last turn height stayed at 85136 px in samples from +455.9 to +13946.4 ms. |
| Held blocks | 567 held and veiled at the end of the window. |
| Long animation frames | No callback overlapped a LoAF. The only post-completion LoAF in the trace replay's observation window started at +114.3 ms, lasted 311.7 ms and blocked for 0.8 ms. The traced pass and extended tail had 0 ms LoAF blocking. |

The untraced runs establish the timing comparison. The trace measures the callback
span and cost on its replay. The scroll observations are samples across that span.

## Verdict and log checks

`veil-none-rendered` saw 0 affected samples and 0 affected blocks after the window
on all seven replays. `veil-effective` judged 567 veiled blocks before completion
on each untraced veil3 replay and 566 on the traced replay. The rAF forced time was
6.3, 6.5, 7.6 and 7.1 ms respectively, all below the harness's 100 ms threshold.
The control logs record `veil-effective: not judged`.

Each replay log has one literal `FAIL` match in its `SUMMARY … 0 FAILs` line.
`grep -c '^FAIL '` returned 0 for each replay log, `restore.log` and `release.log`.
