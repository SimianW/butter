# Final veil4 acceptance, stage E (#177)

**Both rules passed in both settings.** In four `ats12` veil4 replays with all phases
and `VEILPROBE=1`, the probe found zero wheel-step frames with a tested point on a
veiled or opacity-zero block at frame start. It found zero rendered opacity-zero
hits at frame start or after drawing. Every replay still had two consecutive
frame-start hits at the jump to the end, before the first wheel event.

Lab 2 ran frozen veil4 (`004851d`) in default, scroll, default, scroll order and
then frozen veil3 (`aed9523`) with default options as the anchor. The acquire
waited 37 min behind stages C3 and C2. The five replays took 19 min 1 s and
the lock was held for 19 min 11 s, 00:19:52–00:39:03 UTC on 2026-11-27.
All five replays, restore and release exited 0.
[Commands and execution output](commands.md)

## Wheel phase per run

At frame start, the frozen probe hit-tests seven points down the answer column
for `data-butter-veil` or computed opacity zero. The after-drawing sample
checks the narrower predicate of a rendered block at opacity zero. The rendered
opacity-zero counts include the initial jump.

| Run | Wheel-phase frames (point hits) | Veiled or opacity-zero frames on wheel steps at frame start | Pre-wheel end jump | Longest consecutive run | Rendered opacity-zero frames, start / after drawing | Mid-write frames, hits, rendered opacity-zero start / drawn | Verdicts |
|---|---:|---|---|---:|---:|---|---|
| [veil4-ats12-all-default-1](veil4-ats12-all-default-1.log) | 1297 (6285) | **0** across 120 steps | 2 (frames 2–3, 18 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil4-ats12-all-scroll-1](veil4-ats12-all-scroll-1.log) | 1295 (6272) | **0** across 120 steps | 2 (frames 2–3, 17 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil4-ats12-all-default-2](veil4-ats12-all-default-2.log) | 1301 (6292) | **0** across 120 steps | 2 (frames 2–3, 16 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil4-ats12-all-scroll-2](veil4-ats12-all-scroll-2.log) | 1307 (6337) | **0** across 120 steps | 2 (frames 2–3, 17 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil3-ats12-all-default-anchor](veil3-ats12-all-default-anchor.log) | 1285 (6214) | **0** across 120 steps | 2 (frames 2–3, 17 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |

Every run had 60 up and 60 down wheel events. Each reported `"end":2`, with
four of seven points both veiled and at opacity zero in each of those two frames.
The post-wheel mid write moved scrollTop from 46457 to 28306 px on each run.

## Timing and view shift per run

The LoAF columns use `REPORT long animation frames, Enter to 5 s after stream complete`.
Before completion, the veiled block count uses computed opacity zero. After
the window, it uses the veil attribute.

| Run | Completion frame (ms) | ChatGPT completion rAF forced (ms) | LoAF count | LoAF total (ms) | LoAF blocking (ms) | LoAF longest (ms) | Blocks before completion / after window | Wheel-up shift > 4 px (signed range) | Wheel-down shift > 4 px (max) |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| Veil4 default-1 | 635.4 | 7.1 | 69 | 6944.3 | 1637.6 | 635.4 | 566 / 567 | 12/60 (−510 to +1041 px) | 0/59 (0 px) |
| Veil4 scroll-1 | 660.3 | 6.5 | 67 | 6701.5 | 1539.4 | 660.3 | 567 / 567 | 12/60 (−510 to +1226 px) | 0/59 (0 px) |
| Veil4 default-2 | 629.7 | 6.4 | 69 | 6885.8 | 1595.8 | 629.7 | 566 / 567 | 12/60 (−510 to +1041 px) | 0/59 (0 px) |
| Veil4 scroll-2 | 636.6 | 6.6 | 70 | 7241.9 | 1822.6 | 636.6 | 567 / 567 | 12/60 (−510 to +1191 px) | 0/59 (0 px) |
| Veil3 default anchor | 692.3 | 6.7 | 82 | 7730.1 | 1808.8 | 692.3 | 565 / 567 | 11/60 (−510 to +1041 px) | 0/59 (0 px) |

Each run included one clamped down step, leaving 59 tracked steps out of 60.
Within the streamed answer, veil4 recorded 11/56 up shifts above 4 px in
every run, and the anchor recorded 10/56. Historical veil3 recorded 12/60 up
on all four runs and maxima of +1041 px default and +1191 px scroll. The
historical main3 controls recorded 15/60 and 12/60 up, with maxima of +1121
and +1041 px. [Veil3 stage E](../../final/stage-E/summary.md) · [Main3 wheel controls](../../final/stage-D2/summary.md)

## Against the spec

| Rule | Default (Smoother scrolling off) | Scroll (Smoother scrolling on) |
|---|---|---|
| 1. Zero wheel-step frames with a veil or opacity-zero hit at frame start and zero rendered opacity-zero hits after drawing | **PASS.** 0 across 240 wheel steps in 2598 wheel-phase frames. Rendered opacity-zero hits 0 at frame start and 0 after drawing. | **PASS.** 0 across 240 wheel steps in 2602 wheel-phase frames. Rendered opacity-zero hits 0 at frame start and 0 after drawing. |
| 2. Every verdict passes, with `veil-effective` judged on every run | **PASS.** 28 PASS, 0 FAIL. 2/2 passed `wheel-no-jump`, `veil-none-rendered` and judged `veil-effective`. | **PASS.** 28 PASS, 0 FAIL. 2/2 passed `wheel-no-jump`, `veil-none-rendered` and judged `veil-effective`. |

In sequence order, `veil-none-rendered` flagged 0 of 124, 125, 122, 124 and
122 observation-window samples, respectively, and 0 blocks after the window
on each run. The anchor also passed all 14 verdicts, including judged
`veil-effective`. The stripped logs contain 0 lines starting with `FAIL`.

## Veil3 comparison

Historical results are the four replays from [veil3 stage E](../../final/stage-E/summary.md).
The anchor ran in the current sequence.

| Setting and run | Veil3 completion (ms) | Veil4 completion (ms) | Veil3 blocking (ms) | Veil4 blocking (ms) |
|---|---:|---:|---:|---:|
| Default 1 | 656.2 | 635.4 | 1607.8 | 1637.6 |
| Scroll 1 | 654.3 | 660.3 | 1473.9 | 1539.4 |
| Default 2 | 688.4 | 629.7 | 1567.0 | 1595.8 |
| Scroll 2 | 602.5 | 636.6 | 1588.6 | 1822.6 |
| Default anchor | 692.3 | — | 1808.8 | — |

Spread is the maximum minus the minimum. The median and spread columns use the
four historical runs and four veil4 runs, excluding the anchor.

| Metric and setting (ms) | Veil3 median [min–max] | Veil4 median [min–max] | Median change | Spread veil3 / veil4 |
|---|---:|---:|---:|---:|
| Completion, both | 655.25 [602.5–688.4] | 636.0 [629.7–660.3] | −19.25 | 85.9 / 30.6 |
| Completion, default | 672.3 [656.2–688.4] | 632.55 [629.7–635.4] | −39.75 | 32.2 / 5.7 |
| Completion, scroll | 628.4 [602.5–654.3] | 648.45 [636.6–660.3] | +20.05 | 51.8 / 23.7 |
| Blocking, both | 1577.8 [1473.9–1607.8] | 1616.7 [1539.4–1822.6] | +38.9 | 133.9 / 283.2 |
| Blocking, default | 1587.4 [1567.0–1607.8] | 1616.7 [1595.8–1637.6] | +29.3 | 40.8 / 41.8 |
| Blocking, scroll | 1531.25 [1473.9–1588.6] | 1681.0 [1539.4–1822.6] | +149.75 | 114.7 / 283.2 |

The median blocking difference was within both builds' spreads overall and
with default settings. With scroll on, the increase exceeded the historical
veil3 spread and was within the veil4 spread. The second veil4 scroll run
was 234.0 ms above the historical scroll maximum. The veil3 anchor's
1808.8 ms was 201.0 ms above the historical maximum and 192.1 ms above
the veil4 default median. Default completion was 39.75 ms faster on veil4
by median, exceeding both default completion spreads. The pooled and scroll
completion median differences were within both spreads.

In veil4 minus veil3 median blocking, E adds a pooled +38.9 ms to the earlier
stage results of −8.6 ms in A (1651.5 vs 1660.1), +201.5 ms in B (3442.6 vs
3241.1), and +220.2 ms in D (1970.1 vs 1749.9). The E scroll pair spans
1539.4–1822.6 ms and the same-sequence veil3 anchor also had higher blocking
than its historical runs. These samples show variation in both builds.

## Options and post-completion observation

Every run started with stored `opts null` and ended with `OPTS put back`
reporting `same as before true, opts null` and the matching fingerprint.
The four veil4 snapshots had local keys `[butter]` and hash
`b141befa2bc99003`. The veil3 anchor's snapshot also included
`butterLayoutMigrated` and had hash `19a23caa74d13330` before and after.
Both scroll runs applied `older` and `seek` and restored the stored options.

Pre-layout callback timing is unobserved in these untraced runs. Every
post-`in_progress` scroll sample was 9754 / 95638 px (8–9 samples per run).
The post-completion sampled last-turn height was 85136 px on all five runs.
The wheel phase measured 82124 px on all five. Each run had one LoAF of at
least 500 ms and zero of at least 1000 ms. None had a LoAF of at least
50 ms starting at or after one second from `in_progress gone` in the
standard LoAF window, which ended 6998.5–7277.7 ms after that mark.
