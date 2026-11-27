# Veil5 acceptance, stage A — ats12 completion and blocking (#177)

**PASS on all four rules.** With `PHASES=stream` and the default options,
the median completion frame was **675.6 ms** on veil5 (`ece7cb4`) and
**1934.8 ms** on main3 (`3b9c3d5`). Median long animation frame (LoAF)
blocking was **1683.2 ms** on veil5 and **6860.1 ms** on main3, a **75.5%
reduction**.

Lab 2 ran three interleaved pairs and one veil4 (`004851d`) anchor under
one performance lock on 2026-11-27 UTC. It acquired the lock on the first
attempt at 03:40:13 and released it at 04:03:19. The sequence used **7 runs
and 23 min 6 s** under lock. All seven replays, restore, and release exited 0.
[Commands and execution output](commands.md).

## Per run

Blocking is LoAF blocking from Enter to five seconds after the harness observes replay completion.
After gone counts blocking from frames starting after `in_progress` goes.
The rAF column gives ChatGPT's completion `FrameRequestCallback` duration and its forced style/layout.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | LoAF count | rAF duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `main3-ats12-stream-1` | 2115.2 | 2062.9 | 6860.1 | 26.3 | 7091 | 327 | 1400.0 / 1338.3 | 2115.2 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil5-ats12-stream-1` | 661.5 | 610.3 | 1683.2 | 0.0 | 1450 | 90 | 15.5 / 6.4 | 661.5 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-2` | 1934.8 | 1854.9 | 6939.3 | 0.0 | 7238 | 341 | 1267.6 / 1213.4 | 1934.8 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil5-ats12-stream-2` | 675.6 | 624.4 | 1759.9 | 0.3 | 1541 | 74 | 15.9 / 6.8 | 675.6 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `main3-ats12-stream-3` | 1911.0 | 1859.0 | 6497.5 | 0.8 | 6503 | 320 | 1251.9 / 1192.0 | 1911.0 | 1 | 12 PASS, 0 FAIL (PASS / unjudged) |
| `veil5-ats12-stream-3` | 678.7 | 627.3 | 1650.3 | 0.0 | 1430 | 81 | 15.4 / 6.9 | 678.7 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |
| `veil4-ats12-stream-anchor` | 867.9 | 802.4 | 2156.8 | 40.0 | 1955 | 115 | 21.3 / 9.0 | 867.9 | 0 | 13 PASS, 0 FAIL (PASS / PASS) |

Verdict pairs are `veil-none-rendered` / `veil-effective`. The veil4 anchor is excluded from the medians.

## Median per build

| Build | Completion frame (ms) | Its blocking (ms) | Blocking over window (ms) | After gone (ms) | Longtask blocking (ms) | rAF duration / forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| main3 | 1934.8 | 1859.0 | 6860.1 | 0.8 | 7091 | 1267.6 / 1213.4 | 1934.8 |
| veil5 | 675.6 | 624.4 | 1683.2 | 0.0 | 1450 | 15.5 / 6.8 | 675.6 |

## Against the spec

| Rule | Measured | Result |
|---|---|---|
| 1. veil5 median completion frame under 800 ms | 675.6 ms | PASS |
| 2. No veil5 frame of 1 s or more | 0 frames in 3 runs. Longest 678.7 ms. | PASS |
| 3. veil5 median blocking at least 50% below main3 | 1683.2 vs 6860.1 ms, 75.5% below | PASS |
| 4. Every veil5 verdict passes, including judged veil-effective | 3/3 veil5 runs passed all verdicts. 0 FAIL lines across all seven runs. | PASS |

## Options and post-completion geometry

The options column is the value in each `storage before the run` line. The next column records whether the applied options were exactly `{"rail":true,"bookmark":true}`.

| Run | Stored opts before | Default options applied | Storage restored | Sampled scrollTop / scrollHeight (px) | Last turn (px) |
|---|---|---|---|---|---:|
| `main3-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95570 | 85068 |
| `veil5-ats12-stream-1` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95476 | 84974 |
| `veil5-ats12-stream-2` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `main3-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95476 | 84974 |
| `veil5-ats12-stream-3` | `null` | Yes | Yes | 9754 / 95638 | 85136 |
| `veil4-ats12-stream-anchor` | `null` | Yes | Yes | 9754 / 95638 | 85136 |

## Frames of at least 50 ms after completion plus 1 s

Offsets are measured from the `in_progress gone` mark. The standard window ends five seconds after the harness observes replay completion.

| Run | Offset (ms) | Duration (ms) | Blocking (ms) | Script attribution |
|---|---:|---:|---:|---|
| `main3-ats12-stream-1` | +1496.6 | 332.2 | 1.5 | None listed |
| `main3-ats12-stream-1` | +1835.5 | 109.5 | 24.8 | `other TimerHandler:setTimeout` (65.1 ms, 0 ms forced) |
| `veil5-ats12-stream-1` | +1826.2 | 58.4 | 0.0 | `other TimerHandler:setTimeout` (42 ms, 0 ms forced) |
| `main3-ats12-stream-2` | +1363.1 | 307.3 | 0.0 | None listed |
| `veil5-ats12-stream-2` | | | | No qualifying frames in the standard window |
| `main3-ats12-stream-3` | +1345.9 | 316.8 | 0.8 | None listed |
| `main3-ats12-stream-3` | +1668.5 | 53.3 | 0.0 | `other TimerHandler:setTimeout` (10.8 ms, 0 ms forced) |
| `veil5-ats12-stream-3` | | | | No qualifying frames in the standard window |
| `veil4-ats12-stream-anchor` | | | | No qualifying frames in the standard window |

Within each run, the sampled scroll position, scroll height, and last-turn
height held steady after completion. There were 2–3 scroll samples per
main3 run, 8–9 per veil5 run, and 7 in the veil4 anchor. From completion
plus 1 s, main3 had five frames of at least 50 ms, veil5 had one (58.4 ms,
0.0 ms blocking), and the anchor had zero. Pre-layout's end time was not
established in this window.

## Comparison with veil4

Historical values use the three untraced runs from [veil4 stage A](../../final-veil4/stage-A/summary.md).
Each spread is the maximum minus the minimum for that build's three runs.

| Metric (ms) | veil5 median [min–max] | veil4 historical median [min–max] | veil4 anchor | veil5 minus veil4 medians | Spread veil5 / veil4 |
|---|---:|---:|---:|---:|---:|
| Completion frame | 675.6 [661.5–678.7] | 670.1 [625.3–683.4] | 867.9 | +5.5 | 17.2 / 58.1 |
| Blocking over window | 1683.2 [1650.3–1759.9] | 1651.5 [1576.9–2357.2] | 2156.8 | +31.7 | 109.6 / 780.3 |
| Completion rAF | 15.5 [15.4–15.9] | 15.4 [14.8–16.5] | 21.3 | +0.1 | 0.5 / 1.7 |
| Forced style/layout | 6.8 [6.4–6.9] | 6.8 [6.3–7.4] | 9.0 | +0.0 | 0.5 / 1.1 |

The veil5 medians for completion and blocking were 5.5 ms and 31.7 ms
above the historical veil4 medians. Both differences were smaller than the
observed spread on each build. The veil4 anchor was 192.3 ms above veil5's
completion median, exceeding both three-run spreads for that metric. It
was also 184.5 ms above the slowest historical veil4 completion. The
anchor's blocking was 473.6 ms above veil5's median. That exceeds veil5's
spread and falls within historical veil4's spread. A build effect beyond
run-to-run variation was not established by the one anchor.

| Run | Blocks veiled before completion | Butter script time in LoAFs (ms) | Butter sources |
|---|---:|---:|---|
| `veil5-ats12-stream-1` | 567 | 0.0 | `{}` |
| `veil5-ats12-stream-2` | 567 | 0.0 | `{}` |
| `veil5-ats12-stream-3` | 567 | 0.0 | `{}` |
| `veil4-ats12-stream-anchor` | 567 | 0.0 | `{}` |

## Opacity samples flagged by the harness

Every `hydration.rows` sample had zero `leaks`.

The historical veil4 counts were 567, 566, and 567. Every new veil run
held 567 blocks before completion. Chrome attributed 0.0 ms to Butter in
the recorded LoAF script entries for all four new veil runs.

## Verdict and log checks

Each main3 replay had 12 PASS lines with `veil-effective` unjudged. Each
veil5 replay and the veil4 anchor had 13 PASS lines, including judged
`veil-effective`. Both replay safety verdicts, `no-escape` and
`server-unchanged`, passed in all seven runs. The `FAIL` scan gave zero
matches in every replay and cleanup log.
