# Final veil acceptance, stage A2 — ats12 completion and blocking with Smoother scrolling (#177)

**PASS on all four rules.** On `ats12` with `PHASES=stream` and Smoother scrolling on,
`veil3` (`aed9523`) had a median completion frame of **651.5 ms** against
**1908.4 ms** on `main3` (`3b9c3d5`). Median LoAF blocking was **1480.7 ms**
on veil3 and **6392.5 ms** on main3, a **76.8% reduction**.

Lab 2 ran three interleaved pairs under one performance lock.
The lock was acquired at 20:17:51 UTC and released at 20:37:00 UTC on 2026-11-26.
The first acquire attempt waited 32 min.
The budget used was **6 runs and 19 min 9 s** under lock.
All six replays exited 0.
`lab-restore` exited 0. The lab and performance locks were released.
[Commands and execution output](commands.md).

## Per run

Blocking is LoAF blocking from Enter to five seconds after the harness observes replay completion.
After gone counts blocking from frames starting after `in_progress` goes.
The rAF column gives ChatGPT's completion `FrameRequestCallback` duration and its forced style/layout.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | LoAF count | rAF duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `main3-ats12-stream-scroll-1` | 1890.0 | 1837.7 | 6624.6 | 0.0 | 6684 | 320 | 1249.0 / 1195.3 | 1890.0 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-scroll-1` | 640.8 | 589.9 | 1772.4 | 0.0 | 1498 | 86 | 15.3 / 6.5 | 640.8 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-scroll-2` | 1911.4 | 1858.6 | 6392.5 | 5.1 | 6497 | 330 | 1306.5 / 1254.6 | 1911.4 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-scroll-2` | 685.6 | 627.6 | 1461.5 | 0.1 | 1302 | 68 | 15.2 / 6.6 | 685.6 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-scroll-3` | 1908.4 | 1857.5 | 6091.6 | 0.0 | 6130 | 303 | 1251.1 / 1198.5 | 1908.4 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil3-ats12-stream-scroll-3` | 651.5 | 600.7 | 1480.7 | 6.8 | 1276 | 75 | 15.2 / 6.6 | 651.5 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |

Verdict pairs are `veil-none-rendered` / `veil-effective`.

## Median per build

| Build | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | rAF duration / forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| main3 | 1908.4 | 1857.5 | 6392.5 | 0.0 | 6497 | 1251.1 / 1198.5 | 1908.4 |
| veil3 | 651.5 | 600.7 | 1480.7 | 0.1 | 1302 | 15.2 / 6.6 | 651.5 |

## Stage A and A2 medians

| Median (ms) | main3 off, [A](../stage-A/summary.md) | main3 on, A2 | veil3 off, [A](../stage-A/summary.md) | veil3 on, A2 |
|---|---:|---:|---:|---:|
| Completion frame | 1899.0 | 1908.4 | 664.4 | 651.5 |
| Completion frame blocking | 1845.8 | 1857.5 | 613.7 | 600.7 |
| Blocking over window | 6206.8 | 6392.5 | 1660.1 | 1480.7 |
| Blocking after `in_progress` gone | 0.0 | 0.0 | 0.0 | 0.1 |
| Longtask blocking | 6456 | 6497 | 1365 | 1302 |
| rAF duration / forced | 1246.2 / 1192.7 | 1251.1 / 1198.5 | 15.5 / 6.5 | 15.2 / 6.6 |
| Longest frame | 1899.0 | 1908.4 | 664.4 | 651.5 |

## Against the spec

| Rule | Measured | Result |
|---|---|---|
| 1. veil3 median completion frame under 800 ms | 651.5 ms | PASS |
| 2. No veil3 frame of 1 s or more | 0 frames in 3 runs. Longest 685.6 ms. | PASS |
| 3. veil3 median blocking at least 50% below main3 | 1480.7 vs 6392.5 ms, 76.8% below | PASS |
| 4. Every veil3 verdict passes, including judged veil-effective | 3/3 veil3 exits 0 with all expected verdicts passing, 0 FAIL lines across both builds | PASS |

## Options and post-completion geometry

The page’s `data-butter-off` lists disabled features. Every `REPORT opened` line lists
only `layout`, confirming both `older` and `seek` were on. The after-stream page
sample agrees. Every `OPTS put back` line says `same as before true, opts null`.

| Run | Stored opts before | Page off list, opened / after stream | Smoother scrolling on | Storage restored | Sampled scrollTop / scrollHeight (px) | Last turn (px) |
|---|---|---|---|---|---|---:|
| `main3-ats12-stream-scroll-1` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95570 | 85068 |
| `veil3-ats12-stream-scroll-1` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-scroll-2` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil3-ats12-stream-scroll-2` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95570 | 85068 |
| `main3-ats12-stream-scroll-3` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil3-ats12-stream-scroll-3` | `null` | `layout` / `layout` | Yes | Yes | 9754 / 95638 | 85136 |

After completion, each replay held one sampled scroll position and height. Both builds
showed both post-completion heights across runs, 95570 and 95638 px, a 68 px difference.

## Frames of at least 50 ms after completion plus 1 s

Offsets are measured from the `in_progress gone` mark. The standard window ends five seconds after the harness observes replay completion.

| Run | Offset (ms) | Duration (ms) | Blocking (ms) | Script attribution |
|---|---:|---:|---:|---|
| `main3-ats12-stream-scroll-1` | +1344.8 | 306.8 | 0.0 | None listed |
| `veil3-ats12-stream-scroll-1` | +1838.3 | 61.9 | 0.0 | `other TimerHandler:setTimeout` (44.9 ms, 0 ms forced) |
| `main3-ats12-stream-scroll-2` | +1401.5 | 300.5 | 0.0 | None listed |
| `main3-ats12-stream-scroll-2` | +1818.5 | 55.2 | 5.1 | `other TimerHandler:setTimeout` (53.9 ms, 0.1 ms forced) |
| `veil3-ats12-stream-scroll-2` | | | | None at or after +1 s |
| `main3-ats12-stream-scroll-3` | +1347.5 | 303.4 | 0.0 | None listed |
| `veil3-ats12-stream-scroll-3` | | | | None at or after +1 s |

The 55.2 ms frame in `main3-ats12-stream-scroll-2` contributed the only blocking
at or after +1 s, 5.1 ms.

## Pre-layout and log checks

The geometry table reports samples after `in_progress` went away.
Callback start and end times are unavailable in these untraced captures.

- `veil3-ats12-stream-scroll-1` reported `veil-none-rendered` PASS and `veil-effective` PASS (565 veiled blocks before completion, 6.5 ms forced).
- `veil3-ats12-stream-scroll-2` reported `veil-none-rendered` PASS and `veil-effective` PASS (567 veiled blocks before completion, 6.6 ms forced).
- `veil3-ats12-stream-scroll-3` reported `veil-none-rendered` PASS and `veil-effective` PASS (566 veiled blocks before completion, 6.6 ms forced).

`grep -c '^FAIL'` found 0 lines across the stripped logs.
