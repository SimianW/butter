# Final veil acceptance stage C3 · jump to the end of `ats12` (#177)

**Stage result: FAIL.** All six runs had two blank frames. Two `main3` runs recorded an
after-drawing jump of 162.1 px each. All three `veil3` runs had zero after-drawing jumps
and passed every harness verdict, including a judged `veil-effective`.

The fixture was `ats12`, with `PHASES=stream UX=u1` and
`OPTS={"rail":true,"bookmark":true}`. The control was `main3` at `3b9c3d5`, and
the final build was `veil3` at `aed9523`. Runs were interleaved under one lab and perf
lock. The third pair also recorded a CDP trace for pre-layout. [Commands and output](commands.md)

## Per run

The probe writes `scrollTop = scrollHeight` once in the first task after the first frame
without `in_progress`. Times for the write, settle and jumps below use that first frame as
completion. The completion frame duration is the harness's long animation frame (LoAF)
measurement. The settle frame is the first frame at least 100 ms after the write, and its
centre block is the view-shift anchor. The window column gives the measured span from
settle to the final frame near +16 s and the number of after-drawing samples.

Blank time is measured from the first frame of the longest consecutive run of tested points
on veiled, opacity-zero or skipped blocks to the frame after that run. In all six replays
the longest run was also the only run of blank frames. Each control blank frame had flag
4 (skipped) at four of seven points. Each veil blank frame had flag 7 (veiled, opacity zero
and skipped) at four or five points. Write → clear is the time from the write to the first
clear frame after the blank run.

| Run | Completion frame (ms) | Write (+ms) | Blank frames (ms) | Write → clear (ms) | Settle (+ms), anchor | Window (ms, frames) | After-drawing jumps over 4 px (largest move) | Frame-start jumps over 4 px | Centre at +16 s | Stored opts | Harness verdicts |
|---|---:|---:|---|---:|---|---|---|---|---:|---|---|
| [main3-ats12-u1-1](main3-ats12-u1-1.log) | 2057.2 | 1709.5 | 2 (106.5) | 207.5 | 1810.5, 610 | 14,199.4, 814 | 1, +162.1 at +1867.0 ms (162.6 px) | 1, +162.1 at +1917.0 ms | 606 | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u1-1](veil3-ats12-u1-1.log) | 668.0 | 402.0 | 2 (108.0) | 148.1 | 550.1, 606 | 15,456.4, 877 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u1-2](main3-ats12-u1-2.log) | 1878.3 | 1636.3 | 2 (88.7) | 139.9 | 1776.2, 606 | 14,242.9, 817 | 0 (0.9 px) | 0 | 606 | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u1-2](veil3-ats12-u1-2.log) | 671.1 | 412.3 | 2 (108.4) | 145.4 | 557.7, 606 | 15,438.1, 889 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u1-3](main3-ats12-u1-3.log) | 2047.5 | 1732.8 | 2 (108.9) | 210.8 | 1834.7, 610 | 14,171.3, 809 | 1, +162.1 at +1890.2 ms (162.6 px) | 1, +162.1 at +1943.6 ms | 606 | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u1-3](veil3-ats12-u1-3.log) | 688.8 | 410.4 | 2 (97.8) | 137.3 | 547.7, 606 | 15,446.4, 866 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL |

All six runs finished with the last answer block (611) in view, centre block 606,
`fromEnd 0` and scrollTop/scrollHeight of 91,714/92,626 px. The last sampled frame was
at +15,995.8 ms and +15,994.1 ms in veil3 runs 2 and 3. The other four were at
+16,006.0 to +16,019.1 ms. Every storage restore logged `same as before true` and
`opts null`.

In main3 runs 1 and 3, settle picked block 610 during the blank run, and the first clear
frame had block 606 at the centre and scrollTop/scrollHeight of 93,545/94,457 px. The
frame-start probe logged a 162.1 px move at that clear frame. The after-drawing probe
also logged a 162.1 px move, with the timestamps shown above. Round 1 C3 reported its
162.1–188.1 px moves only at frame start. In main3 run 2 and all veil3 runs the first
clear frame was the settle frame, with block 606 at the centre. [Round 1 C3](../../stage-C3/summary.md)

## Per build

| Build | Blank frames, worst / median | Blank ms, worst / median (range) | Write → clear ms, worst / median | After-drawing jumps, worst | Completion frame median (ms) |
|---|---|---|---|---:|---:|
| main3 | 2 / 2 | 108.9 / 106.5 (88.7–108.9) | 210.8 / 207.5 | 1 | 2047.5 |
| veil3 | 2 / 2 | 108.4 / 108.0 (97.8–108.4) | 148.1 / 145.4 | 0 | 671.1 |

## Acceptance rules

| Rule | Observed | Verdict |
|---|---|---|
| 1. Veil blank frames after the jump are no more than control | Both builds had a longest run of 2 frames in each of 3 runs | **PASS** |
| 2. Zero after-drawing jumps over 4 px on both builds from settle to +16 s | Veil counts 0/0/0. Control counts 1/0/1, with +162.1 px in runs 1 and 3 | **FAIL** |
| 3. Every veil run passes every harness verdict, with `veil-none-rendered` and `veil-effective` judged and passing | All 3 veil runs logged 13 PASS lines and exited 0 | **PASS** |

`veil-none-rendered` passed in all six runs. Main3 samples in run order were 0 of
132, 132 and 131 with a rendered opacity-zero block, and veil3 samples were 0 of
135, 130 and 133. All six had zero after the window and zero under the tested
points both at frame start and after drawing. There were no failing hydration
samples. `grep -c '^FAIL'` returned 0 for every stripped log. Rule 2 uses the
measured after-drawing counts printed as `REPORT ux u1` lines.

| Veil run | Blocks veiled before completion | Forced style/layout in ChatGPT completion rAF (ms) | `veil-none-rendered` | `veil-effective` |
|---|---:|---:|---|---|
| veil3-ats12-u1-1 | 567 | 7.0 | PASS | PASS |
| veil3-ats12-u1-2 | 565 | 6.8 | PASS | PASS |
| veil3-ats12-u1-3 | 567 | 10.2 | PASS | PASS |

`veil-effective` was reported as `not judged` in all three control runs.

## Pre-layout and late frames

The trace for `veil3-ats12-u1-3` contained 240 Butter idle callbacks from +1057.4 ms
to +11123.4 ms after the mutation probe recorded `in_progress` gone. The longest
callback was 24.2 ms and total callback time was 1680.5 ms. Neither the callbacks
nor their enclosing tasks reached 50 ms. On the UX clock, the callback interval
was approximately +979.1 to +11045.1 ms. ScrollTop / scrollHeight had already
settled at 91,714 / 92,626 px by +857.3 ms on that clock and held through the rest
of the sampled window. In the other two veil runs that same geometry held from
+847.2 and +849.2 ms through the last sample. The trace for `main3-ats12-u1-3`
contained zero Butter idle callbacks.

Below are all intervals of at least 50 ms between successive `u1` frame samples
whose first timestamp is at least +1 s after the first frame without `in_progress`.
The LoAF columns use the separate mutation probe's completion mark. The standard
LoAF log retains individual frames. The extended tail retains a count and longest
entry for all entries of at least 50 ms.

| Run | UX frame intervals (start +ms → duration ms) | Standard LoAF at +1 s or later (start +ms → duration ms) | Tail LoAF (count, longest duration at +ms) |
|---|---|---|---|
| main3-ats12-u1-1 | 1654.0 → 156.5, 1810.5 → 56.5, 1867.0 → 50.0, 1917.0 → 79.4, 2090.3 → 60.7, 10710.4 → 223.0, 10933.4 → 60.5 | 1485.2 → 332.5, 1823.5 → 154.2, 2035.1 → 64.9, 2105.7 → 52.1, 2258.1 → 53.1 | 3, 223.1 at +10860.6 |
| veil3-ats12-u1-1 | 1760.7 → 58.2, 1929.5 → 67.0, 14708.8 → 50.2, 14832.0 → 61.1 | 1844.1 → 53.1, 2014.4 → 62.5, 2353.4 → 51.6 | 2, 57.4 at +14915.5 |
| main3-ats12-u1-2 | 1582.2 → 105.3, 1776.2 → 98.1, 1874.3 → 55.9, 2007.9 → 56.1, 10565.7 → 245.6 | 1354.9 → 320.2, 1681.2 → 102.3, 1827.2 → 61.2, 1894.2 → 70.3, 1969.8 → 50.1 | 1, 247.0 at +10645.3 |
| veil3-ats12-u1-2 | 1750.4 → 87.2, 4196.1 → 73.9 | 1828.1 → 90.0, 4273.2 → 75.7 | 0 |
| main3-ats12-u1-3 | 1685.2 → 149.5, 1834.7 → 55.5, 1890.2 → 53.4, 1943.6 → 81.5, 2120.2 → 56.2, 2602.8 → 54.9, 10938.5 → 74.5, 11126.4 → 239.2 | 1457.2 → 322.7, 1786.3 → 150.0, 1992.4 → 65.3, 2064.0 → 54.4, 2217.0 → 50.3, 2684.1 → 53.4 | 2, 241.8 at +11205.6 |
| veil3-ats12-u1-3 | 1746.3 → 60.3, 14525.4 → 51.6 | 1836.5 → 55.5 | 1, 51.5 at +14564.7 |

## Lab use

Six runs used 20 min 33 s. Total time under lock including restore was 20 min
43 s. The first acquire succeeded after 16 min 26 s in the queue. The driver
exited 0, lab restore reported `"ok":true`, and the release cleared both locks.
[Restore output](restore.log) · [Release output](release.log)
