# Final veil acceptance, stage D (#177)

**PASS on all three rules.** Across nine `window.find` calls per build, the median was 86.7 ms on
veil3 and 86.2 ms on main3. The median first call was 92.8 ms on veil3 and 98.2 ms on main3. The
158.7 ms first call on veil3 run 2 was the slowest find and was within both first-call bounds.

Lab 2 replayed `ats12` with `PHASES=stream UX=u4 U4_FINDS=3` on `main3` (`3b9c3d5`) and
`veil3` (`aed9523`). The builds alternated under one perf lock. Each run applied
`OPTS={"rail":true,"bookmark":true}` with Smoother scrolling off. The default 16 s frame sampler and
500 ms delay put the first find 16,545.3–16,574.2 ms after the UX probe's first frame without
`in_progress`. Exact commands and output are in [commands.md](commands.md) and [seq.log](seq.log).

## Per-run measurements

All times are in ms. The flags column gives the value before each of the three find calls, in order.

| Run | First find | Later 1 | Later 2 | Flags before | Select-all chars / ms | Completion frame | ChatGPT rAF forced style/layout | Stored opts before | Verdict lines PASS / FAIL | Exit |
|---|---:|---:|---:|---|---:|---:|---:|---|---:|---:|
| [main3-ats12-u4-1](main3-ats12-u4-1.log) | 99.3 | 83.3 | 86.5 | 12 / 12 / 12 | 35,863 / 112.2 | 1,960.8 | 1,240.7 | `null` | 12 / 0 | 0 |
| [veil3-ats12-u4-1](veil3-ats12-u4-1.log) | 92.8 | 81.7 | 82.9 | 15 / 15 / 15 | 35,863 / 114.6 | 642.1 | 6.5 | `null` | 13 / 0 | 0 |
| [main3-ats12-u4-2](main3-ats12-u4-2.log) | 98.2 | 82.9 | 85.7 | 12 / 12 / 12 | 35,863 / 112.2 | 2,058.3 | 1,324.5 | `null` | 12 / 0 | 0 |
| [veil3-ats12-u4-2](veil3-ats12-u4-2.log) | 158.7 | 81.7 | 86.7 | 15 / 15 / 15 | 35,863 / 112.7 | 625.1 | 6.7 | `null` | 13 / 0 | 0 |
| [main3-ats12-u4-3](main3-ats12-u4-3.log) | 94.7 | 83.2 | 86.2 | 12 / 12 / 12 | 35,863 / 111.6 | 1,964.2 | 1,205.5 | `null` | 12 / 0 | 0 |
| [veil3-ats12-u4-3](veil3-ats12-u4-3.log) | 91.6 | 83.2 | 95.5 | 15 / 15 / 15 | 35,863 / 111.4 | 664.1 | 7.0 | `null` | 13 / 0 | 0 |

Flags 12 means skipped and held, with the veil and opacity-0 bits clear. Flags 15 means veiled,
opacity 0, skipped and held. The calls used blocks 429, 440 and 450 with strings of 19, 24 and 23
characters, respectively. Every call found its text, selected within the searched block and kept
scrollTop at 9,754 px. The searched blocks stayed off-screen during the find watches. Each run's
`storage before the run` line shows `opts null` and the supplied rail/bookmark JSON. Each
`OPTS put back` line shows `same as before true, opts null`.

## First call and later calls

| Run | First call (ms) | First frame with the block unveiled and rendered (ms since call start) |
|---|---:|---|
| main3-1 | 99.3 | Frame 1 (107.2) |
| veil3-1 | 92.8 | Frame 2 (119.3) |
| main3-2 | 98.2 | Frame 1 (106.5) |
| veil3-2 | 158.7 | Frame 2 (183.6) |
| main3-3 | 94.7 | Frame 1 (102.6) |
| veil3-3 | 91.6 | Frame 2 (116.7) |

All later calls reached the unveiled and rendered state in frame 1.

| Calls | main3 median (range), ms | veil3 median (range), ms | Twice main3 median, ms | main3 median + 150 ms | veil3 median within each bound |
|---|---:|---:|---:|---:|---|
| All nine per build | 86.2 (82.9–99.3) | 86.7 (81.7–158.7) | 172.4 | 236.2 | Yes / Yes |
| First | 98.2 (94.7–99.3) | 92.8 (91.6–158.7) | 196.4 | 248.2 | Yes / Yes |
| Later 1 | 83.2 (82.9–83.3) | 81.7 (81.7–83.2) | 166.4 | 233.2 | Yes / Yes |
| Later 2 | 86.2 (85.7–86.5) | 86.7 (82.9–95.5) | 172.4 | 236.2 | Yes / Yes |

Every individual veil3 call also fell within both bounds for its position. The first and later
position checks are reported separately from the all-call rule.

Select-all median and range were 112.2 ms (111.6–112.2) on main3 and 112.7 ms (111.4–114.6) on
veil3. Each selection was 35,863 characters and left the count of veiled blocks unchanged
(502, 502 and 504 on veil3, 0 on main3). The probe scrolled block 460 into view before select-all.
That step moved scrollTop from 9,754 to 72,532 px and drew the block unveiled in frame 1 in all six runs.

## Geometry, pre-layout and completion frames

ScrollTop stayed at 9,754 px in every frame from completion to the end of the 16 s sampler. The
sampler recorded one scrollHeight change per run, then the final value below through its last
frame (15,989.7–15,996.5 ms). The turn height sampler covered a shorter window. It recorded the
same height throughout each listed span and on the direct geometry read after the standard window.
There is no direct turn height sample at +16 s.

| Run | scrollHeight at +0 → final (px) | First frame with final scrollHeight (ms after UX completion) | Last turn height before → after completion (px) | Post-completion height samples (ms after `in_progress` went) | Held blocks in those samples |
|---|---|---:|---|---|---:|
| main3-1 | 95,686 → 95,638 | 1,627.0 | 85,184 → 85,136 | 1,969.6–6,965.7 | 567 |
| veil3-1 | 95,686 → 95,476 | 345.5 | 84,912 → 84,974 | 472.9–6,578.9 | 565 |
| main3-2 | 95,686 → 95,476 | 1,732.7 | 84,912 → 84,974 | 1,865.7–6,364.6 | 565 |
| veil3-2 | 95,686 → 95,476 | 150.3 | 85,184 → 84,974 | 591.7–6,398.1 | 565 |
| main3-3 | 95,686 → 95,382 | 1,599.7 | 84,776 → 84,880 | 1,960.2–6,921.1 | 564 |
| veil3-3 | 95,686 → 95,638 | 361.9 | 85,184 → 85,136 | 726.2–6,510.9 | 567 |

The frozen build exposed no pre-layout counters in these runs (`dbgBefore` and `dbgAfterFirst`
were `null`). The logs record held blocks and stable geometry after the changes shown above.
They provide no count of blocks laid out by the first find or time at which the idle pass finished.
The completion-frame medians were 1,964.2 ms on main3 and 642.1 ms on veil3.

The long-animation-frame observer covered roughly +7.1 to +7.4 s after `in_progress` went.
These are all measured frames of at least 50 ms starting after +1 s. Each pair gives
`start offset → duration` in ms.

| Run | Observer end (ms) | Frames (ms) |
|---|---:|---|
| main3-1 | 7181.7 | 1403.6 → 320.1, 1729.4 → 74.8, 1804.5 → 77.9, 1990.7 → 50.5 |
| veil3-1 | 7402.3 | 1910.3 → 67.9, 2304.1 → 51.3, 2561.4 → 53.4, 3954.7 → 51.1, 5687.3 → 52.2 |
| main3-2 | 7173.0 | 1504.5 → 328.1, 1838.4 → 136.8, 1980.6 → 55.5 |
| veil3-2 | 7221.4 | 1902.6 → 69.9, 1972.8 → 52.4, 2082.6 → 53.5, 2288.5 → 51.0, 2340.0 → 53.7, 2566.7 → 74.1, 3794.3 → 55.4, 3855.3 → 70.4, 3926.0 → 54.5, 4101.5 → 53.1, 4352.1 → 56.7, 5697.1 → 51.6 |
| main3-3 | 7128.5 | 1365.1 → 329.6, 1700.7 → 114.6 |
| veil3-3 | 7130.7 | 1509.1 → 52.0, 1843.6 → 92.9, 2381.5 → 51.4, 2638.4 → 51.9, 3948.2 → 51.3, 5679.1 → 53.0, 5996.7 → 52.2 |

No Butter script was attributed in the long-animation-frame data. The veil3 runs recorded three
frames each with attributed forced style/layout after +1 s, 31.0–32.7 ms per frame. The longest
veil3 frame in this span was 92.9 ms.

## Acceptance verdicts

| Rule | Measurements | Result |
|---|---|---|
| 1. Median of nine `window.find` calls within twice main3's median or within main3's median + 150 ms | veil3 86.7 ms, main3 86.2 ms. Bounds 172.4 and 236.2 ms. | **PASS** |
| 2. Same select-all length in every run | 35,863 characters across all six runs. | **PASS** |
| 3. Every verdict line PASS, with both veil checks judged and PASS on every veil3 run | All six exits 0. Three main3 runs with 12 PASS each. Three veil3 runs with 13 PASS each. Zero verdict lines beginning `FAIL`. | **PASS** |

| veil3 run | `veil-none-rendered` | `veil-effective` | Blocks at opacity 0 before completion | ChatGPT rAF forced style/layout (ms) |
|---|---|---|---:|---:|
| 1 | PASS | Judged, PASS | 565 | 6.5 |
| 2 | PASS | Judged, PASS | 567 | 6.7 |
| 3 | PASS | Judged, PASS | 567 | 7.0 |

The control printed `PASS veil-none-rendered` on all three runs and recorded
`veil-effective: not judged` with zero blocks veiled before completion. The six run logs each
contain one match for `grep -c FAIL` in their `SUMMARY … 0 FAILs` line. The sequence, restore and
release logs each contain zero such matches. `grep -c '^FAIL '` finds zero on every log.

## Budget and lab release

Six runs took 20 min 59 s on the lock budget clock (19:00:21–19:21:20 UTC). The initial acquire
waited 46 min 24 s behind stages A and B and succeeded on the first attempt. All six runs exited 0.
`lab-restore` exited 0 and put the lab back on its home tab with an empty composer. Release exited
0 and cleared both lab 2 and perf locks.
