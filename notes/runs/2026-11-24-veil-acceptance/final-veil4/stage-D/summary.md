# Final veil4 acceptance, stage D (#177)

**PASS on all three rules.** The median of nine `window.find` calls was 84.8 ms on veil4 and
87.2 ms on main3. Select-all returned 35,863 characters on all six runs. All judged verdicts
passed. The before-paint probe counted zero frames drawn with the block rendered at opacity 0
after `scrollIntoView` on both builds.

Lab 2 replayed `ats12` on main3 (`3b9c3d5`) and veil4 (`004851d`), alternating builds under
one perf lock. All runs used `PHASES=stream UX=u4 U4_FINDS=3` and
`OPTS={"rail":true,"bookmark":true}` with Smoother scrolling off. The default 16 s sampler and
500 ms pause put the first find 16,544.8–16,571.3 ms after the UX probe's first frame without
`in_progress`. See [commands.md](commands.md) and [seq.log](seq.log).

## Acceptance verdicts

| Rule | Measurement | Result |
|---|---|---|
| 1. Veil4's median of nine `window.find` calls is within either bound | 84.8 ms against main3's 87.2 ms. Bounds 174.4 and 237.2 ms. | **PASS** |
| 2. Select-all returns the same length in every run of both builds | 35,863 characters in every run. | **PASS** |
| 3. Every veil4 verdict passes, including judged PASS for both veil checks | All three veil4 runs reported 13 PASS, zero FAIL and exit 0. `veil-none-rendered` and `veil-effective` were judged and PASS on each. | **PASS** |

All three control runs reported 12 PASS, zero FAIL and exit 0, including
`PASS veil-none-rendered`. Their `REPORT veil-effective: not judged` lines recorded zero blocks
veiled just before completion. Every one of the nine stripped logs has zero lines beginning
`FAIL`. The six JSON captures had zero `hydration.rows` with `leaks > 0` (#187).

## Per-run measurements

Times are in ms. The flags column gives the value before each find in order. The veiled block
counts come from the samples before the completion frame.

| Run | First find | Later 1 | Later 2 | Flags before | Select-all chars / ms | Completion frame | ChatGPT rAF forced style/layout | Veiled before completion | Stored opts before | PASS / FAIL | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [main3-ats12-u4-1](main3-ats12-u4-1.log) | 97.3 | 84.2 | 83.9 | 12 / 12 / 12 | 35,863 / 120.3 | 1922.3 | 1223.6 | 0 | `null` | 12 / 0 | 0 |
| [veil4-ats12-u4-1](veil4-ats12-u4-1.log) | 90.1 | 81.5 | 84.8 | 15 / 15 / 15 | 35,863 / 113 | 624.7 | 7.7 | 567 | `null` | 13 / 0 | 0 |
| [main3-ats12-u4-2](main3-ats12-u4-2.log) | 96.4 | 87.2 | 92.7 | 12 / 12 / 12 | 35,863 / 112.1 | 1925.6 | 1206.3 | 0 | `null` | 12 / 0 | 0 |
| [veil4-ats12-u4-2](veil4-ats12-u4-2.log) | 90.7 | 85 | 84.1 | 15 / 15 / 15 | 35,863 / 114.9 | 668.5 | 7.3 | 565 | `null` | 13 / 0 | 0 |
| [main3-ats12-u4-3](main3-ats12-u4-3.log) | 97.7 | 82.3 | 82.7 | 12 / 12 / 12 | 35,863 / 111 | 1944.3 | 1217 | 0 | `null` | 12 / 0 | 0 |
| [veil4-ats12-u4-3](veil4-ats12-u4-3.log) | 93.7 | 82 | 82.1 | 15 / 15 / 15 | 35,863 / 115.2 | 639.1 | 6.8 | 565 | `null` | 13 / 0 | 0 |

Flags 12 means skipped and held. Flags 15 adds the veil and opacity-0 bits. All runs found and
selected within blocks 429, 440 and 450 using strings of 19, 24 and 23 characters. ScrollTop
stayed at 9,754 px during the finds. In each run the `storage before the run` line recorded
`opts null` and the supplied rail/bookmark JSON. All six `OPTS put back` lines reported
`same as before true, opts null`.

Select-all median was 112.1 ms (111–120.3) on main3 and 114.9 ms (113–115.2) on veil4. Before
select-all, `scrollIntoView` moved scrollTop from 9,754 to 72,532 px on block 460. Select-all
left the number of veiled blocks at 0 on each main3 run and at 503, 503 and 504 on the veil4 runs.

## First call and later calls

The existing `unveiled at opacity 1 and rendered` field gives the first qualifying frame at
frame start, including off-screen blocks.

| Run | First call (ms) | First frame with block unveiled and rendered (ms since call start) |
| --- | --- | --- |
| main3-1 | 97.3 | 1 (105.8 ms) |
| veil4-1 | 90.1 | 2 (117.7 ms) |
| main3-2 | 96.4 | 1 (104.1 ms) |
| veil4-2 | 90.7 | 2 (116.9 ms) |
| main3-3 | 97.7 | 1 (105.6 ms) |
| veil4-3 | 93.7 | 2 (119.9 ms) |

Both later calls reached the unveiled and rendered state in frame 1 in every run.

| Calls | main3 median (range), ms | veil4 median (range), ms | Twice main3 median, ms | main3 median + 150 ms | veil4 median within each bound | Every veil4 call within each bound |
| --- | --- | --- | --- | --- | --- | --- |
| All nine per build | 87.2 (82.3–97.7) | 84.8 (81.5–93.7) | 174.4 | 237.2 | Yes / Yes | Yes / Yes |
| First | 97.3 (96.4–97.7) | 90.7 (90.1–93.7) | 194.6 | 247.3 | Yes / Yes | Yes / Yes |
| Later 1 | 84.2 (82.3–87.2) | 82 (81.5–85) | 168.4 | 234.2 | Yes / Yes | Yes / Yes |
| Later 2 | 83.9 (82.7–92.7) | 84.1 (82.1–84.8) | 167.8 | 233.9 | Yes / Yes | Yes / Yes |

## Before-paint lines

Each cell gives the first frame rendered in view, then frame-start flags → before-paint flags,
then the count of frames drawn at opacity 0 out of the before-paint samples. The first find ran
with a 90-frame watch. Each later find used 30 frames plus its own frame. `scrollIntoView` used
90 frames plus its own frame.

| Run | First find | Later find 1 | Later find 2 | scrollIntoView |
| --- | --- | --- | --- | --- |
| main3-1 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |
| veil4-1 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |
| main3-2 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |
| veil4-2 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |
| main3-3 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |
| veil4-3 | never in 90 / — / 0 of 1 | never in 30 / — / 0 of 1 | never in 30 / — / 0 of 1 | 0 (the act's own frame) / - → 8 / 0 of 1 |

On both builds, `window.find` left the matched block outside the view in all three watches. Those
lines gave no flags for an in-view frame. On both builds, `scrollIntoView` produced an in-view
rendered block before paint in frame 0, the act's own frame. The log gives `-` for its unsampled
frame start and 8 before paint, meaning the held marker was still set and the veil, opacity-0 and
skipped bits were clear. All 24 before-paint lines matched their JSON records. This probe reports
size-change samples from ResizeObserver.

## Comparison with final stage D on veil3

| Measurement | veil3 median (range) | veil4 median (range) |
|---|---:|---:|
| All nine find calls (ms) | 86.7 (81.7–158.7) | 84.8 (81.5–93.7) |
| First find call (ms) | 92.8 (91.6–158.7) | 90.7 (90.1–93.7) |
| First frame at opacity 1 and rendered, first call | 2 on all three runs | 2 on all three runs |
| Select-all (ms) | 112.7 (111.4–114.6) | 114.9 (113–115.2) |
| Completion frame (ms) | 642.1 (625.1–664.1) | 639.1 (624.7–668.5) |
| LoAF blocking, Enter through 5 s after stream complete (ms) | 1,749.9 (1,708.8–1,768.0) | 1,970.1 (1,776.9–2,064.8) |
| Veiled blocks before completion, runs 1–3 | 565 / 567 / 567 | 567 / 565 / 565 |

The 3.0 ms change in median completion-frame duration was smaller than both builds' observed
spreads (39.0 ms on veil3 and 43.8 ms on veil4). The 220.2 ms increase in median LoAF blocking
exceeded the veil3 spread of 59.2 ms and was within the veil4 spread of 287.9 ms. The lowest
veil4 blocking sample was 8.9 ms above the highest veil3 sample. Main3's current median was
1,925.6 ms for the completion frame and 7,060.9 ms for LoAF blocking. The prior control's
all-call and first-call medians were 86.2 and 98.2 ms.
[Final veil3 stage D](../../final/stage-D/summary.md)

## Geometry and long frames

ScrollTop was 9,754 px throughout the 16 s sampler. Each run recorded one scrollHeight change
from 95,686 px, followed by the same value through the last frame. Both builds returned null
pre-layout counters on the reads before and after the first find, so the probe recorded the
geometry below and gave no direct end time for the idle pass.

| Run | Final scrollHeight (px) | First frame at that height (ms after UX completion) | Last turn height before → after completion (px) |
|---|---:|---:|---:|
| main3-1 | 95,476 | 1,609.4 | 85,184 → 84,974 |
| veil4-1 | 95,570 | 335.8 | 85,184 → 85,068 |
| main3-2 | 95,638 | 1,591.3 | 85,184 → 85,136 |
| veil4-2 | 95,570 | 351.3 | 84,912 → 85,068 |
| main3-3 | 95,638 | 1,600.9 | 85,184 → 85,136 |
| veil4-3 | 95,638 | 344.6 | 85,184 → 85,136 |

The long-animation-frame observer ended 7.16–7.42 s after `in_progress` went. All observed frames
of at least 50 ms starting from +1 s are listed below as start offset → duration, in ms.

| Run | Frames (ms) |
|---|---|
| main3-1 | 1382.5 → 319.6, 1708.1 → 74.9, 1819.0 → 71.8 |
| veil4-1 | 1861.3 → 86.3, 2130.8 → 88.7, 2247.5 → 52.4, 2438.2 → 53.3, 2493.2 → 53.2, 2731.5 → 52.5, 2977.6 → 65.2, 3230.4 → 56.1, 3729.0 → 53.5, 3782.9 → 66.5, 3963.7 → 60.8, 5617.6 → 53.8 |
| main3-2 | 1362.2 → 321.5, 1689.4 → 67.6, 1783.0 → 63.2, 5564.0 → 111.1, 5792.8 → 57.6, 6160.8 → 53.6 |
| veil4-2 | 1878.5 → 93.4, 2020.9 → 52.3, 2252.5 → 110.1, 2624.8 → 58.2, 2775.4 → 55.2, 3021.5 → 58.3, 5708.9 → 52.6 |
| main3-3 | 1389.9 → 319.5, 1715.4 → 66.9, 1782.6 → 74.9, 1938.5 → 53.7 |
| veil4-3 | 1254.1 → 61.6, 1322.7 → 54.3, 1673.9 → 55.0, 1882.0 → 66.7, 1949.0 → 60.1, 2412.6 → 50.8, 2658.8 → 51.1, 5597.6 → 53.4 |

## Budget and lab release

Six harness runs used 20 min 31 s. With restore and release, the lock budget was 20 min 42 s
(23:18:20–23:39:02 UTC). The first acquire was interrupted while stage B held the perf lock.
The second acquire waited 16 min 47 s and succeeded. All six replays ran under that one lock
sequence. `lab-restore` and `lab-lock release` both exited 0. The lab returned to its home tab
with an empty composer and its default extension set. Release cleared both lab 2 and perf.
