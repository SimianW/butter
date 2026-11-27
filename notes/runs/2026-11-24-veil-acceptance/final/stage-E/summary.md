# Final veil acceptance, stage E (#177)

**Both rules passed in both settings.** The four `ats12` replays used frozen
`veil3` (`aed9523`), all phases and `VEILPROBE=1`. The probe found zero wheel-step
frames on a veiled or opacity-zero block at frame start and zero rendered
opacity-zero hits at frame start or after drawing. The two consecutive frame-start
hits at the jump to the end still occurred in every run, before the first wheel
event, as in [round 1](../../stage-E/summary.md).

Lab 2 ran the four replays in default, scroll, default, scroll order. The first
acquire waited 37 min 26 s behind stages C3 and C2. The performance lock was
held 15 min 25 s, from 20:02:26 to 20:17:51 UTC on 2026-11-26. All four replays,
restore and release exited 0. [Commands and execution output](commands.md).

## Wheel phase per run

The frozen probe hit-tests seven points down the answer column on each sampled
frame. At frame start it counts points on blocks bearing `data-butter-veil` or
computing opacity zero. Its after-drawing sample checks the narrower rendered
opacity-zero predicate used by `veil-none-rendered`. The rendered opacity-zero
counts below span the full wheel phase, including its initial jump.

| Run | Wheel-phase frames (point hits) | Veiled or opacity-zero frames on wheel steps at frame start | Pre-wheel end jump | Longest consecutive run | Rendered opacity-zero frames, start / after drawing | Mid-write frames, hits, rendered opacity-zero start / drawn | Verdicts |
|---|---:|---|---|---:|---:|---|---|
| [veil3-ats12-all-default-1](veil3-ats12-all-default-1.log) | 1298 (6290) | **0** across 120 steps | 2 (frames 2–3, 19 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil3-ats12-all-scroll-1](veil3-ats12-all-scroll-1.log) | 1299 (6302) | **0** across 120 steps | 2 (frames 2–3, 17 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil3-ats12-all-default-2](veil3-ats12-all-default-2.log) | 1297 (6282) | **0** across 120 steps | 2 (frames 2–3, 19 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |
| [veil3-ats12-all-scroll-2](veil3-ats12-all-scroll-2.log) | 1290 (6251) | **0** across 120 steps | 2 (frames 2–3, 17 ms apart) | 2 | 0 / 0 | 30, 0, 0 / 0 | 14 PASS, 0 FAIL |

Every run had 60 up and 60 down wheel events. Each reported `"end":2`, with four
of seven points both veiled and at opacity zero in each of those two frames.
The post-wheel mid write moved scrollTop from 46457 to 28306 px on every run.
It sampled a region the wheel phase had already brought into view.

## Timing and view shift per run

| Run | Completion frame (ms) | ChatGPT completion rAF forced (ms) | LoAF blocking over window (ms) | Frames ≥ 500 / ≥ 1000 ms | Blocks before completion / after window | Wheel-up shift > 4 px (signed range) | Wheel-down shift > 4 px |
|---|---:|---:|---:|---:|---:|---|---:|
| `default-1` | 656.2 | 7.3 | 1607.8 | 1 / 0 | 567 / 567 | 12/60 (−510 to +1041 px) | 0/59 |
| `scroll-1` | 654.3 | 6.6 | 1473.9 | 1 / 0 | 567 / 567 | 12/60 (−510 to +1191 px) | 0/59 |
| `default-2` | 688.4 | 6.5 | 1567.0 | 1 / 0 | 567 / 567 | 12/60 (−510 to +1041 px) | 0/59 |
| `scroll-2` | 602.5 | 6.3 | 1588.6 | 1 / 0 | 567 / 567 | 12/60 (−510 to +1191 px) | 0/59 |

Before completion, the block count is computed opacity zero. After the window
it counts the veil attribute. Wheel-up shifts over 4 px fell from 13/60 in
round 1 to 12/60 on every final replay, including 11/56 within the streamed
answer. This is the placeholder behaviour tracked in #131. The largest
positive shift was 150 px higher with Smoother scrolling on in these runs.
One clamped step per run was excluded from the wheel-down shift denominator.

## Against the spec

| Rule | Default (Smoother scrolling off) | Scroll (Smoother scrolling on) |
|---|---|---|
| 1. Zero wheel-step frames on a veiled or opacity-zero block | **PASS.** 0 across 240 wheel steps in 2595 wheel-phase frames at frame start. 0 rendered opacity-zero frames at frame start and 0 after drawing. | **PASS.** 0 across 240 wheel steps in 2589 wheel-phase frames at frame start. 0 rendered opacity-zero frames at frame start and 0 after drawing. |
| 2. Every verdict passes, with `veil-effective` judged on every run | **PASS.** 28 PASS, 0 FAIL. Both runs passed `wheel-no-jump`, `veil-none-rendered` and judged `veil-effective`. | **PASS.** 28 PASS, 0 FAIL. Both runs passed `wheel-no-jump`, `veil-none-rendered` and judged `veil-effective`. |

`veil-none-rendered` flagged 0 of 122 observation-window samples on
`default-1` and 0 of 124 on each other run. It also flagged 0 blocks after
the window on all four runs. `veil-effective` judged 567 blocks before
completion on every run, with 6.3–7.3 ms forced style and layout in
ChatGPT's completion rAF. There were zero lines beginning with `FAIL`.

## Options and post-completion observation

Both settings used `rail` and `bookmark`. Applied options in the two scroll
captures also show `older` and `seek` set to true. Every `storage before the run`
line printed stored `opts null`. Every `OPTS put back` line printed
`same as before true, opts null`, with the same fingerprint before and after,
including the scroll run immediately before the second default run.

The frozen harness did not trace pre-layout callbacks, so their end time
is unavailable. From the first stream sample after `in_progress` went through
the after-completion snapshot, all sampled scrollTop / scrollHeight pairs
were 9754 / 95638 px (9 samples on `default-1`, 8 on each other run).
Post-completion hydration samples showed a last-turn height of 85136 px
on every run. The later wheel phase started with a measured last-turn
height of 82124 px on every run.

| Run | LoAF with start at least 1 s after `in_progress` went | Duration (ms) | Blocking (ms) | Script attribution |
|---|---:|---:|---:|---|
| `default-1` | None | | | |
| `scroll-1` | +2287.7 ms | 58.1 | 0 | None listed |
| `default-2` | None | | | |
| `scroll-2` | +1890.0 ms | 68.3 | 0 | `other TimerHandler:setTimeout` (43.7 ms, 0 ms forced) |

The table lists all frames of at least 50 ms starting at or after that
one-second cutoff in the standard LoAF observation window. That window ended
7.0–7.2 s after `in_progress` went, before the wheel phase.
