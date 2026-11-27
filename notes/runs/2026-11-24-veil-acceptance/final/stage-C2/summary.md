# Final veil acceptance, stage C2 (#177)

**Stage C2 passes all three rules.** Each run had three consecutive blank frames
and zero view shifts over 4 px after drawing. The median blank run lasted
253.5 ms on veil3 and 123.7 ms on main3, a gap of 129.8 ms.

Lab 2 ran three interleaved pairs on `ats12`, using `PHASES=stream UX=u2 U2_BLOCK=306`,
the default 2 s delay and `OPTS={"rail":true,"bookmark":true}`. main3 is `3b9c3d5`
and veil3 is `aed9523`. Every write moved scrollTop from 9754 to 50863 px and
used block 306 of 612, with 20 of 21 nearby blocks held. Block 306 itself had
flags `15` (veiled, opacity 0, skipped, held) on all three veil3 runs and `12`
(skipped, held) on all three main3 runs.

## Per run

Blank duration uses the [round 2 definition](../../round2/stage-C2/summary.md).
It runs from the first sample with a tested point on a veiled, opacity-0 or skipped
block through the timestamp of the next clear sample. Write → first text is the
time to the first sample with a rendered, unveiled point. It estimates the first
draw with text because the probe records those flags at frame start and has no
exact paint timestamp. Write → clear uses the first sample after the blank run
with no such blank points. Frame intervals follow the first three samples
after the write and the clear sample. Frame 2 render is the style, layout and
paint portion of the matching long-animation-frame entry, with the whole entry
duration in parentheses.

| Run | Completion frame (ms) | Write after completion (ms) | Blank frames (duration in ms) | Write → first text (ms) | Write → clear (ms) | Frame intervals 1→2, 2→3, 3→clear (ms) | Frame 2 render (ms) | Settle after write (ms), anchor | Jumps >4 px after drawing [frame start] | Stored opts before | Verdicts |
|---|---:|---:|---|---:|---:|---|---|---|---|---|---|
| [main3-ats12-u2-1](main3-ats12-u2-1.log) | 1915.2 | 2024.3 | 3 (121.9) | 99.8 | 139.1 | 37.7, 44.9, 39.3 | No LoAF entry | 139.1, block 322 | 0 [0] | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u2-1](veil3-ats12-u2-1.log) | 676.4 | 2046.9 | 3 (253.5) | 216.7 | 269.1 | 31.2, 169.9, 52.4 | 67.0 (81.1) | 216.7, block 320 | 0 [0] | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2-2](main3-ats12-u2-2.log) | 1912.9 | 2022.2 | 3 (124.9) | 100.9 | 141.4 | 37.5, 46.9, 40.5 | No LoAF entry | 100.9, block 320 | 0 [0] | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u2-2](veil3-ats12-u2-2.log) | 718.5 | 2026.7 | 3 (272.1) | 216.6 | 287.8 | 47.9, 153.0, 71.2 | 66.7 (96.7) | 216.6, block 320 | 0 [0] | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2-3](main3-ats12-u2-3.log) | 1855.6 | 2022.6 | 3 (123.7) | 100.6 | 140.3 | 37.5, 46.5, 39.7 | No LoAF entry | 100.6, block 320 | 0 [0] | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u2-3](veil3-ats12-u2-3.log) | 667.3 | 2039.3 | 3 (246.7) | 208.7 | 262.4 | 31.8, 161.2, 53.7 | 66.0 (81.9) | 208.7, block 320 | 0 [0] | `null` | 13 PASS, 0 FAIL |

The third sample had text at three of six tested answer points on every run.
The fourth sample was clear. Every anchor stayed within 0 px of its settle
position, and the centre point ended on block 322 in all six runs. Each
`storage before the run` line reported `opts null` and the two-key `OPTS`
shown above. All six options restores reported `same as before true` and
`opts null`.

## Per build

| Build | Blank frames worst / median | Blank duration median (range), ms | Write → first text median (range), ms | Write → clear median (range), ms | Frame 2→3 median (range), ms | Frame 2 render median (range), ms | Jumps >4 px worst | Completion frame median, ms |
|---|---|---|---|---|---|---|---:|---:|
| main3 | 3 / 3 | 123.7 (121.9–124.9) | 100.6 (99.8–100.9) | 140.3 (139.1–141.4) | 46.5 (44.9–46.9) | No LoAF entry | 0 | 1912.9 |
| veil3 | 3 / 3 | 253.5 (246.7–272.1) | 216.6 (208.7–216.7) | 269.1 (262.4–287.8) | 161.2 (153.0–169.9) | 66.7 (66.0–67.0) | 0 | 676.4 |

The median gaps were 116.0 ms to the first text sample and 128.8 ms to
clear. The gap in blank duration was 95.5 ms in the earlier round 2
comparison (228.3 vs 132.8 ms).

## Rules

| Rule | Result | Measured |
|---|---|---|
| 1. Veil3 has no more blank frames than main3 | **PASS** | 3 in every run on both builds. |
| 2. Zero jumps over 4 px after drawing | **PASS** | 0 in each of the six runs, with a largest anchor move of 0 px. |
| 3. Every verdict line passes and veil3 has both veil checks judged and passing | **PASS** | All six runs exited 0. Main3 had 12 PASS per run, veil3 had 13 PASS per run, and every log had 0 FAIL lines. `veil-none-rendered` passed all six runs. `veil-effective` was judged and passed on 3/3 veil3 runs and was unjudged on the three controls. |

Each veil3 run reported 567 veiled blocks before completion. ChatGPT's
completion-frame rAF callback forced 7.4, 6.7 and 8.7 ms of style and layout
in run order. The number of sampled UX frames in which a tested point was
on a block rendered at opacity 0 was zero at frame start and after drawing
in every run.

## Web fonts and pre-layout

All font times below are in ms after the write. File timings run from fetch
start to response end, and the combined Size1/Size3 times are a single
`document.fonts` `loadingdone` event. The probe recorded file timing for Size1
and Size2.

| Run | KaTeX `loadingdone` after write | KaTeX file timings after write |
|---|---|---|
| main3-ats12-u2-1 | None | None |
| veil3-ats12-u2-1 | Size1 + Size3 at +321.6, Size2 at +624.2 | Size1 +142.4→+162.6, Size2 +513.0→+530.6 |
| main3-ats12-u2-2 | None | None |
| veil3-ats12-u2-2 | Size1 + Size3 at +487.0, Size2 at +745.2 | Size1 +272.7→+291.8, Size2 +613.6→+631.1 |
| main3-ats12-u2-3 | None | None |
| veil3-ats12-u2-3 | Size1 + Size3 at +520.1, Size2 at +776.6 | Size1 +320.2→+339.9, Size2 +651.1→+669.7 |

All four recorded KaTeX families loaded during streaming on main3. On
veil3, KaTeX_AMS loaded during streaming and there were no font loads
between completion and the write. The captures carry no pre-layout block
counter or callback trace, so the number of blocks pre-laid out by the
write, the pass end, and whether the pass reached block 306 are unknown.
The held flags and font timings are the observations available for that
window. No post-completion LoAF script attribution named Butter or an
idle callback.

Before the write, sampled scrollTop stayed at 9754 px throughout all six
runs. The first sample without `in_progress` had scrollHeight 95686 px in
all six. On veil3, scrollHeight fell to 95638, 95476 and 95570 px at
+346.0, +350.9 and +346.7 ms respectively, then stayed at those values
through the write. On main3 it fell to 95638 px at +1607.4, +1597.0 and
+1547.8 ms, then stayed there through the write.

## Long animation frames from completion +1 s

Entries below give offset from the LoAF observer's `in_progress gone` mark,
duration and blocking, all in ms. Observer coverage ended between +7038.7
and +7233.7 ms. The UX sampler continued to +16 s.

| Run | Offset / duration / blocking |
|---|---|
| main3-ats12-u2-1 | +1373.9 / 330.5 / 12.9, +1710.9 / 115.0 / 16.4, +2311.4 / 55.6 / 0.0 |
| veil3-ats12-u2-1 | +1833.9 / 84.6 / 4.4, +2165.0 / 81.1 / 30.9, +2252.3 / 122.3 / 19.7, +2533.1 / 63.7 / 0.0, +2660.3 / 52.3 / 1.0, +4393.5 / 58.2 / 0.0, +4452.2 / 87.4 / 19.0, +4655.7 / 60.6 / 0.0 |
| main3-ats12-u2-2 | +1374.3 / 319.7 / 9.9, +1699.7 / 72.0 / 0.0, +1818.1 / 61.6 / 3.6, +2313.3 / 54.0 / 0.0 |
| veil3-ats12-u2-2 | +1486.1 / 52.5 / 0.0, +1817.8 / 86.0 / 6.6, +2146.3 / 96.7 / 37.2, +2249.4 / 107.7 / 24.6, +2363.8 / 66.0 / 5.6, +2435.6 / 74.0 / 19.4, +2515.8 / 70.6 / 0.0, +2742.9 / 51.8 / 0.4, +2795.3 / 50.5 / 0.0 |
| main3-ats12-u2-3 | +1333.0 / 315.3 / 10.4, +1654.4 / 72.4 / 0.0, +1812.2 / 62.7 / 4.9, +1996.0 / 61.6 / 0.0, +2273.3 / 53.9 / 0.0 |
| veil3-ats12-u2-3 | +1223.3 / 50.9 / 0.0, +1816.6 / 83.6 / 3.9, +2092.0 / 59.8 / 0.0, +2156.4 / 81.9 / 30.9, +2244.6 / 115.2 / 21.7, +2366.4 / 50.0 / 0.0, +2422.2 / 57.7 / 0.0, +2486.2 / 97.7 / 20.1, +2758.4 / 85.7 / 0.0 |

## Run budget

Six replays took 20 min 22 s from lock to release, including lab restore.
The first acquire timed out after 3600 s with Stage C3 holding the lab.
The retry acquired lab 2 after 2 min 9 s. The queue time was outside the
run budget. See [commands and execution output](commands.md) and
[extracted timings](u2.jsonl).
