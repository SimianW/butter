# Veil4 acceptance, stage C2 (#177)

Lab 2 ran three interleaved pairs on `ats12` using
`PHASES=stream UX=u2 U2_BLOCK=306`, the default 2 s delay and
`OPTS={"rail":true,"bookmark":true}`. The control main3 was `3b9c3d5`
and veil4 was `004851d`.

**Stage C2 passes all three rules.** Every run had three consecutive blank
frames and zero jumps over 4 px after drawing. Median blank duration was
265.2 ms on veil4 and 142.6 ms on main3, a gap of 122.6 ms.

## Per run

Measurements follow [veil3 stage C2](../../final/stage-C2/summary.md).
Blank duration starts at the first sample with a tested point on a veiled,
opacity-0 or skipped block and ends at the next sample without such a
point. Write → first text is the first sample with a rendered, unveiled
point and estimates when text first draws. The sample is taken at frame
start. Write → clear uses the first sample after the blank run with no
such blank points. Frame intervals follow the first three samples after
the write and the clear sample. Frame 2 render is the rendering portion of
the matching long animation frame (LoAF), with its total duration in
parentheses.

| Run | Completion frame (ms) | Write after completion (ms) | Flags on block 306 | Blank frames (duration in ms) | Write → first text (ms) | Write → clear (ms) | Frame intervals 1→2, 2→3, 3→clear (ms) | Frame 2 render (ms) | Settle after write (ms), anchor | Jumps >4 px after drawing [frame start] | Veiled before completion | Stored opts before | Verdicts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [main3-ats12-u2-1](main3-ats12-u2-1.log) | 1927.3 | 2021.6 | 12 | 3 (124.4) | 99.7 | 140.9 | 37.9, 45.3, 41.2 | No LoAF entry | 140.9, block 322 | 0 [0] | 0 | `null` | 12 PASS, 0 FAIL |
| [veil4-ats12-u2-1](veil4-ats12-u2-1.log) | 679.9 | 2046.1 | 15 | 3 (265.2) | 214.9 | 283.1 | 65.1, 131.9, 68.2 | 71.6 (118.1) | 214.9, block 320 | 0 [0] | 567 | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2-2](main3-ats12-u2-2.log) | 1914.1 | 2025.7 | 12 | 3 (142.6) | 120.0 | 160.0 | 60.0, 42.6, 40.0 | 18.0 (55.4) | 120.0, block 320 | 0 [0] | 0 | `null` | 12 PASS, 0 FAIL |
| [veil4-ats12-u2-2](veil4-ats12-u2-2.log) | 644.1 | 2046.9 | 15 | 3 (244.6) | 278.7 | 327.9 | 33.9, 161.5, 49.2 | 70.0 (87.6) | 117.2, block 306 | 0 [1] | 567 | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2-3](main3-ats12-u2-3.log) | 1923.7 | 2059.4 | 12 | 3 (204.2) | 184.8 | 224.8 | 111.6, 52.6, 40.0 | 19.9 (93.7) | 132.2, block 306 | 0 [1] | 0 | `null` | 12 PASS, 0 FAIL |
| [veil4-ats12-u2-3](veil4-ats12-u2-3.log) | 686.4 | 2041.0 | 15 | 3 (300.2) | 268.7 | 329.1 | 33.3, 206.5, 60.4 | 71.4 (87.3) | 268.7, block 320 | 0 [0] | 566 | `null` | 13 PASS, 0 FAIL |

Each write moved scrollTop from 9754 to 50863 px and targeted block 306
of 612, with 20 of 21 nearby blocks held. The target had flags `15`
(veiled, opacity 0, skipped, held) in every veil4 run and `12` (skipped,
held) in every main3 run. The third sample had text at three of six tested
answer points on every run. The fourth sample was clear. The view ended
with block 322 at the centre in every run.

Every `storage before the run` line reported `opts null` and requested
`OPTS={"rail":true,"bookmark":true}`. Each options restore reported
`same as before true` and `opts null`.

## Rules

| Rule | Verdict | Measured |
| --- | --- | --- |
| 1. Veil4 has no more blank frames than main3 | **PASS** | Three blank frames on each build in each of the three pairs. |
| 2. Zero veil4 jumps over 4 px after drawing | **PASS** | Veil4 0/0/0, main3 0/0/0. Largest after-drawing anchor move 0 px in each run. |
| 3. Every veil4 verdict passes, including both veil checks | **PASS** | All three veil4 runs had 13 PASS and 0 FAIL each, including `veil-none-rendered` and a judged `veil-effective`. All three main3 runs had 12 PASS and 0 FAIL each. `veil-none-rendered` passed on main3 and `veil-effective` was unjudged there. All six replays exited 0. |

At frame start the probe recorded one −724.3 px move on the block 306
anchor in [veil4 run 2](veil4-ats12-u2-2.log) at +2325.6 ms and in
[main3 run 3](main3-ats12-u2-3.log) at +2244.2 ms, both relative to
completion. Each run had zero after-drawing jumps. There were no
`hydration.rows` samples with leaks and no frames with a rendered
opacity-0 block under a tested point on either build.

The veil4 runs recorded 567, 567 and 566 blocks veiled before completion.
ChatGPT's completion-frame rAF forced 6.1, 6.5 and 6.6 ms of style and
layout in run order.

## Per build and comparison with veil3

Timing cells show median (min–max). The main3 frame 2 render median
uses the two runs with a matching LoAF entry.

| Build and round | Blank frames worst / median | Blank duration, ms | Write → first text, ms | Write → clear, ms | Frame 2→3, ms | Frame 2 render, ms | Completion frame, ms | LoAF blocking, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main3 (current) | 3 / 3 | 142.6 (124.4–204.2) | 120.0 (99.7–184.8) | 160.0 (140.9–224.8) | 45.3 (42.6–52.6) | 18.9 (18.0–19.9) | 1923.7 (1914.1–1927.3) | 6651.3 (6387.2–6970.4) |
| veil4 | 3 / 3 | 265.2 (244.6–300.2) | 268.7 (214.9–278.7) | 327.9 (283.1–329.1) | 161.5 (131.9–206.5) | 71.4 (70.0–71.6) | 679.9 (644.1–686.4) | 1759.8 (1693.6–1847.1) |
| main3 (prior) | 3 / 3 | 123.7 (121.9–124.9) | 100.6 (99.8–100.9) | 140.3 (139.1–141.4) | 46.5 (44.9–46.9) | No LoAF entry | 1912.9 (1855.6–1915.2) | 7240.3 (6871.1–7988.5) |
| veil3 | 3 / 3 | 253.5 (246.7–272.1) | 216.6 (208.7–216.7) | 269.1 (262.4–287.8) | 161.2 (153.0–169.9) | 66.7 (66.0–67.0) | 676.4 (667.3–718.5) | 1896.0 (1778.6–1902.0) |

The main3-to-veil gap in median blank duration was 122.6 ms in this round
and 129.8 ms in [veil3 C2](../../final/stage-C2/summary.md). The current gap
to first text was 148.7 ms (prior 116.0 ms) and the gap to clear was
167.9 ms (prior 128.8 ms). The first post-write sample in veil4 run 2 came
83.3 ms after the write. That time is included in write-to-clear and
precedes the measured blank duration.

Compared with veil3, veil4's median blank duration was 11.7 ms longer and
the frame 2→3 interval was 0.3 ms longer. Both changes are within the
larger of the two builds' min–max spans for the metric (55.6 ms and
74.6 ms respectively). Write-to-first-text increased 52.1 ms, within the
63.8 ms span on veil4. Write-to-clear increased 58.8 ms, larger than
either build's span (46.0 ms on veil4 and 25.4 ms on veil3). Those
write-to-clear ranges still overlap at 283.1–287.8 ms. The 4.7 ms
increase in frame 2 render exceeds both spans (1.6 and 1.0 ms), with
disjoint ranges.

Veil4's median completion frame increased 3.5 ms and its median total
LoAF blocking fell 136.2 ms. Both changes are within the larger observed
span for the metric (51.2 ms and 153.5 ms respectively). The timing data
come from three runs per build.

## Web fonts

| Run | KaTeX loadingdone after write (ms) | KaTeX file timings after write (ms) |
| --- | --- | --- |
| main3-ats12-u2-1 | None | None |
| veil4-ats12-u2-1 | Size3 + Size1 at +480.7, Size2 at +751.4 | Size1 +270.9→+295.4, Size2 +644.5→+662.3 |
| main3-ats12-u2-2 | None | None |
| veil4-ats12-u2-2 | Size1 + Size3 at +383.6, Size2 at +650.0 | Size1 +26.1→+45.8, Size2 +536.8→+554.2 |
| main3-ats12-u2-3 | None | None |
| veil4-ats12-u2-3 | Size1 + Size3 at +373.9, Size2 at +670.1 | Size1 +162.5→+187.1, Size2 +546.7→+565.0 |

The Size1 and Size3 families shared a `document.fonts` `loadingdone`
event. The file columns show fetch start to response end for the recorded
Size1 and Size2 resources. All four KaTeX families loaded during
streaming on main3. Veil4 loaded KaTeX_AMS during streaming and had no
`loadingdone` event between completion and the write.

## Pre-layout and geometry

ScrollTop stayed at 9754 px from completion through the last sample
before the write in all six runs. The first sample without
`in_progress` had scrollHeight 95686 px in each run. In run order,
veil4's scrollHeight dropped to 95476, 95570 and 95476 px at +344.8,
+342.4 and +345.9 ms. Main3's dropped to 95476, 95570 and 95638 px at
+1598.5, +1589.2 and +1581.3 ms. Those values held through the write.

The frozen build exposed no pre-layout counters. No post-completion
LoAF script attribution named Butter or an idle callback. The block 306
flags establish that it was held and skipped at the write. The
pre-layout pass end and the count pre-laid out by the write are
unavailable in these captures.

## Long animation frames from completion +1 s

| Run | Offset / duration / blocking (ms) |
| --- | --- |
| main3-ats12-u2-1 | +1368.0 / 323.3 / 11.3, +1697.1 / 121.8 / 31.8, +1931.9 / 54.8 / 0.0, +2308.2 / 57.0 / 0.0, +3508.6 / 51.1 / 0.0 |
| veil4-ats12-u2-1 | +1833.5 / 63.9 / 3.1, +2162.9 / 118.1 / 40.6, +2288.1 / 83.3 / 24.0, +2376.7 / 64.4 / 6.3, +2446.3 / 95.4 / 0.0, +2787.7 / 51.3 / 0.1 |
| main3-ats12-u2-2 | +1362.1 / 325.8 / 12.2, +1693.8 / 90.7 / 0.0, +1832.3 / 64.0 / 4.8, +2149.5 / 55.4 / 0.0 |
| veil4-ats12-u2-2 | +1492.0 / 53.9 / 0.0, +1872.7 / 68.3 / 11.1, +2116.9 / 105.9 / 5.0, +2227.5 / 87.6 / 35.5, +2321.6 / 110.7 / 19.7, +2587.6 / 53.6 / 0.0, +2681.5 / 52.1 / 0.9, +2818.5 / 53.2 / 0.0 |
| main3-ats12-u2-3 | +1353.6 / 321.0 / 11.3, +1680.4 / 67.4 / 0.0, +1748.2 / 69.5 / 7.6, +1898.5 / 166.7 / 3.7, +2065.6 / 51.4 / 0.0, +2117.4 / 75.2 / 10.8, +2198.3 / 93.7 / 0.0, +2481.9 / 64.3 / 0.0, +3418.3 / 50.1 / 0.0 |
| veil4-ats12-u2-3 | +1471.2 / 51.9 / 0.0, +1853.2 / 69.0 / 12.1, +2097.6 / 63.5 / 0.0, +2166.3 / 87.3 / 35.6, +2260.0 / 157.3 / 26.7, +2422.5 / 56.5 / 0.0, +2528.3 / 73.8 / 0.0, +2690.7 / 54.4 / 2.5 |

Offsets use the LoAF observer's `in_progress gone` mark. Its coverage
ended at +7137.5 to +7296.9 ms. The UX sampler continued to +16 s.

## Run budget

The six replays took 20 min 17 s. The lab lock was held for 20 min 28 s
including restore and release. The initial acquire waited 56 min 57 s
and succeeded. The restore reported `ok:true`, and the release reported
both the lab and performance locks released. See the [exact commands and
output](commands.md) and [extracted frame timings](u2.jsonl).
