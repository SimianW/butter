# Veil4 acceptance, stage A — ats12 completion and blocking (#177)

**PASS on all four rules.** For `ats12` with `PHASES=stream` and the default
options, the median completion frame was **670.1 ms** on veil4 (`004851d`) and
**1937.9 ms** on main3 (`3b9c3d5`). Median LoAF blocking was **1651.5 ms** on
veil4 and **7526.4 ms** on main3, a **78.1% reduction**.

Lab 2 ran three interleaved pairs and one veil3 (`aed9523`) anchor under one
performance lock. The lock was acquired on the first attempt at 22:10:02 UTC
and released at 22:32:57 UTC on 2026-11-26. The sequence used **7 runs and
22 min 55 s** under lock. All seven replays, restore and release exited 0.
[Commands and execution output](commands.md).

## Per run

Blocking is LoAF blocking from Enter to five seconds after the harness observes replay completion.
After gone counts blocking from frames starting after `in_progress` goes.
The rAF column gives ChatGPT's completion `FrameRequestCallback` duration and its forced style/layout.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | LoAF count | rAF duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `main3-ats12-stream-1` | 1835.3 | 1783.2 | 7526.4 | 0.0 | 7488 | 310 | 1205.7 / 1153.7 | 1835.3 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil4-ats12-stream-1` | 683.4 | 632.9 | 1651.5 | 1.5 | 1400 | 72 | 16.5 / 7.4 | 683.4 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-2` | 1937.9 | 1886.0 | 11037.1 | 1.8 | 10955 | 304 | 1267.8 / 1212.6 | 1937.9 | 2 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil4-ats12-stream-2` | 625.3 | 570.2 | 2357.2 | 4.2 | 1969 | 106 | 14.8 / 6.3 | 625.3 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-3` | 1959.5 | 1907.0 | 6111.0 | 6.0 | 6380 | 319 | 1296.5 / 1243.4 | 1959.5 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil4-ats12-stream-3` | 670.1 | 619.0 | 1576.9 | 1.9 | 1337 | 70 | 15.4 / 6.8 | 670.1 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `veil3-ats12-stream-anchor` | 695.5 | 644.4 | 1464.1 | 0.0 | 1291 | 76 | 15.7 / 6.4 | 695.5 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |

Verdict pairs are `veil-none-rendered` / `veil-effective`. The veil3 anchor is excluded from the medians.

## Median per build

| Build | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | rAF duration / forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| main3 | 1937.9 | 1886.0 | 7526.4 | 1.8 | 7488 | 1267.8 / 1212.6 | 1937.9 |
| veil4 | 670.1 | 619.0 | 1651.5 | 1.9 | 1400 | 15.4 / 6.8 | 670.1 |

## Against the spec

| Rule | Measured | Result |
|---|---|---|
| 1. veil4 median completion frame under 800 ms | 670.1 ms | PASS |
| 2. No veil4 frame of 1 s or more | 0 frames in 3 runs. Longest 683.4 ms. | PASS |
| 3. veil4 median blocking at least 50% below main3 | 1651.5 vs 7526.4 ms, 78.1% below | PASS |
| 4. Every veil4 verdict passes, including judged veil-effective | 3/3 veil4 runs passed all verdicts. 0 FAIL lines across all seven runs. | PASS |

## Options and post-completion geometry

The options column is the value in each `storage before the run` line. The next column records whether the applied options were exactly `{"rail":true,"bookmark":true}`.

| Run | Stored opts before | Default options applied | Storage restored | Sampled scrollTop / scrollHeight (px) | Last turn (px) |
|---|---|---|---|---|---:|
| `main3-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95476 | 84974 |
| `veil4-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95476 | 84974 |
| `veil4-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil4-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil3-ats12-stream-anchor` | `null` | Yes | Yes | 9754 / 95570 | 85068 |

## Frames of at least 50 ms after completion plus 1 s

Offsets are measured from the `in_progress gone` mark. The standard window ends five seconds after the harness observes replay completion.

| Run | Offset (ms) | Duration (ms) | Blocking (ms) | Script attribution |
|---|---:|---:|---:|---|
| `main3-ats12-stream-1` | +1295.5 | 299.1 | 0.0 | None listed |
| `main3-ats12-stream-1` | +1600.5 | 52.2 | 0.0 | `other TimerHandler:setTimeout` (11.1 ms, 0 ms forced) |
| `veil4-ats12-stream-1` | | | | No frames in the standard window |
| `main3-ats12-stream-2` | +1362.5 | 317.6 | 1.8 | None listed |
| `veil4-ats12-stream-2` | | | | No frames in the standard window |
| `main3-ats12-stream-3` | +1392.7 | 313.9 | 0.0 | None listed |
| `main3-ats12-stream-3` | +1712.8 | 80.2 | 6.0 | `other TimerHandler:setTimeout` (54.7 ms, 0 ms forced) |
| `veil4-ats12-stream-3` | | | | No frames in the standard window |
| `veil3-ats12-stream-anchor` | | | | No frames in the standard window |

Each run's sampled scroll position, scroll height and last-turn height held
steady after completion. The sequence used no trace and did not observe when
pre-layout ended. All five frames starting at least 1 s after completion were
on main3. The longest was 317.6 ms with 1.8 ms of blocking.

## Comparison with veil3

Historical values use the three untraced runs from [veil3 stage A](../../final/stage-A/summary.md).
Each spread is the maximum minus the minimum for that build's three runs.

| Metric (ms) | veil4 median [min–max] | veil3 historical median [min–max] | veil3 anchor | veil4 minus veil3 medians | Spread veil4 / veil3 |
|---|---:|---:|---:|---:|---:|
| Completion frame | 670.1 [625.3–683.4] | 664.4 [601.4–716.1] | 695.5 | +5.7 | 58.1 / 114.7 |
| Blocking over window | 1651.5 [1576.9–2357.2] | 1660.1 [1475.4–1780.0] | 1464.1 | -8.6 | 780.3 / 304.6 |
| Completion rAF | 15.4 [14.8–16.5] | 15.5 [15.0–16.9] | 15.7 | -0.1 | 1.7 / 1.9 |
| Forced style/layout | 6.8 [6.3–7.4] | 6.5 [6.3–7.6] | 6.4 | +0.3 | 1.1 / 1.3 |

Each veil4 median differs from the historical veil3 median by less than the
run-to-run spread on either build. The same holds for the differences from
the anchor. The anchor's 695.5 ms completion frame was 12.1 ms above the
slowest veil4 completion, and its 1464.1 ms blocking was 112.8 ms below the
lowest veil4 blocking. Veil4 run 2 recorded 2357.2 ms blocking, 577.2 ms
above the historical veil3 maximum.

| Run | Blocks veiled before completion | Butter script time in LoAFs (ms) | Butter sources |
|---|---:|---:|---|
| `veil4-ats12-stream-1` | 567 | 0.0 | `{}` |
| `veil4-ats12-stream-2` | 566 | 0.0 | `{}` |
| `veil4-ats12-stream-3` | 567 | 0.0 | `{}` |
| `veil3-ats12-stream-anchor` | 567 | 0.0 | `{}` |

## Opacity samples flagged by the harness

Every `hydration.rows` sample had zero `leaks`.

Veil4 held 566–567 blocks before completion, within the prior 565–567 range.
The `REPORT laf butter files` line was `{}` on every veil4 run and the veil3
anchor. Chrome attributed 0 ms to Butter in the recorded LoAF script entries.

## Verdict and log checks

All 12 judged verdicts passed on each main3 run. The three veil4 replays and
the veil3 anchor each had 13 PASS lines. `veil-effective` was judged and passed
on all four veil replays. `grep -c '^FAIL'` returned 0 for each of the seven
replay logs and both cleanup logs.
