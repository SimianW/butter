# Veil4 acceptance stage C3 · jump to the end of `ats12` (#177)

**Stage result PASS.**

The fixture was `ats12`, with `PHASES=stream UX=u1` and
`OPTS={"rail":true,"bookmark":true}`. The control was `main3` at `3b9c3d5`
and the candidate was `veil4` at `004851d`. The six runs were interleaved under
one lab and perf lock. [Commands and output](commands.md)

## Per run

The probe writes `scrollTop = scrollHeight` once in the first task after the first
frame without `in_progress`. The write, settle and jump timestamps are relative to
that first frame. The completion duration comes from the harness's long animation
frame (LoAF) measurement. The settle frame is the first frame at least 100 ms
after the write. Its centre block is the view-shift anchor. The window spans
settle through the final sample near +16 s, with the after-drawing sample count.

Blank time runs from the first frame of the longest consecutive run with a
tested point on a veiled, opacity-zero or skipped block to the frame after that
run. Write → clear runs from the write to the first clear frame after the first
blank. The blank column gives the longest consecutive run. The acceptance
table also gives the total blank frames after the write.

| Run | Completion frame (ms) | Write (+ms) | Blank frames (ms) | Write → clear (ms) | Settle (+ms), anchor | Window (ms, frames) | After-drawing jumps over 4 px (largest move) | Frame-start jumps over 4 px | Centre at +16 s | Stored opts | Harness verdicts |
|---|---:|---:|---|---:|---|---|---|---|---:|---|---|
| [main3-ats12-u1-1](main3-ats12-u1-1.log) | 1958.8 | 1689.0 | 2 (141.5) | 237.2 | 1864.2, 609 | 14,136.6, 818 | 0 (0.5 px) | 1, +188.1 at +1926.2 ms | 606 | `null` | 12 PASS, 0 FAIL, exit 0 |
| [veil4-ats12-u1-1](veil4-ats12-u1-1.log) | 666.9 | 397.4 | 2 (91.2) | 127.9 | 525.3, 606 | 15,475.5, 880 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL, exit 0 |
| [main3-ats12-u1-2](main3-ats12-u1-2.log) | 1892.5 | 1632.0 | 2 (145.7) | 199.5 | 1741.3, 610 | 14,256.4, 816 | 0 (0.5 px) | 1, +162.1 at +1831.5 ms | 606 | `null` | 12 PASS, 0 FAIL, exit 0 |
| [veil4-ats12-u1-2](veil4-ats12-u1-2.log) | 689.3 | 444.6 | 2 (113.2) | 149.5 | 594.1, 606 | 15,414.8, 863 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL, exit 0 |
| [main3-ats12-u1-3](main3-ats12-u1-3.log) | 1944.8 | 1669.7 | 2 (103.0) | 196.8 | 1817.5, 608 | 14,178.5, 810 | 0 (0.5 px) | 1, +188.1 at +1866.5 ms | 606 | `null` | 12 PASS, 0 FAIL, exit 0 |
| [veil4-ats12-u1-3](veil4-ats12-u1-3.log) | 682.3 | 397.4 | 2 (100.4) | 136.7 | 534.1, 606 | 15,475.3, 862 | 0 (0.9 px) | 0 | 606 | `null` | 13 PASS, 0 FAIL, exit 0 |

| Run | Last UX sample (+ms) | ScrollTop / scrollHeight (px) | From end (px) | Last answer block in view | Options put back |
|---|---:|---|---:|---|---|
| main3-ats12-u1-1 | 16000.8 | 91714/92626 | 0 | 611, true | same as before true |
| veil4-ats12-u1-1 | 16000.8 | 91714/92626 | 0 | 611, true | same as before true |
| main3-ats12-u1-2 | 15997.7 | 91714/92626 | 0 | 611, true | same as before true |
| veil4-ats12-u1-2 | 16008.9 | 91714/92626 | 0 | 611, true | same as before true |
| main3-ats12-u1-3 | 15996.0 | 91714/92626 | 0 | 611, true | same as before true |
| veil4-ats12-u1-3 | 16009.4 | 91714/92626 | 0 | 611, true | same as before true |

## Per build

| Build | Blank frames, worst / median | Blank ms, worst / median (range) | Write → clear ms, worst / median | After-drawing jumps, worst | Completion frame median (ms) | LoAF blocking median (ms) |
|---|---|---|---|---:|---:|---:|
| main3 | 2 / 2 | 145.7 / 141.5 (103.0–145.7) | 237.2 / 199.5 | 0 | 1944.8 | 7050.5 |
| veil4 | 2 / 2 | 113.2 / 100.4 (91.2–113.2) | 149.5 / 136.7 | 0 | 682.3 | 1842.5 |

## Acceptance rules

| Rule | Observed | Verdict |
|---|---|---|
| 1. Veil4 has no more blank frames after the jump than main3, run by run | Total frames veil4 2/2/2, main3 2/2/2. Longest consecutive counts veil4 2/2/2, main3 2/2/2. | **PASS** |
| 2. Veil4 has zero after-drawing jumps over 4 px from settle through +16 s | Veil4 0/0/0, main3 0/0/0. Jump sizes and frame-start measurements are in the per-run table. | **PASS** |
| 3. Every veil4 verdict passes, including judged `veil-effective` and `veil-none-rendered` | Veil4 PASS counts 13/13/13, FAIL counts 0/0/0, exits 0/0/0, veil-effective PASS/PASS/PASS. | **PASS** |

| Run | Blocks veiled before completion | Forced style/layout in ChatGPT completion rAF (ms) | `veil-none-rendered` | `veil-effective` |
|---|---:|---:|---|---|
| main3-ats12-u1-1 | 0 | — | PASS | not judged |
| veil4-ats12-u1-1 | 567 | 6.6 | PASS | PASS |
| main3-ats12-u1-2 | 0 | — | PASS | not judged |
| veil4-ats12-u1-2 | 567 | 6.6 | PASS | PASS |
| main3-ats12-u1-3 | 0 | — | PASS | not judged |
| veil4-ats12-u1-3 | 567 | 6.2 | PASS | PASS |

| Run | Flagged hydration samples | Rendered opacity-zero blocks after the standard window | UX leak frames at frame start / after drawing (sampled) |
|---|---:|---:|---|
| main3-ats12-u1-1 | 0/113 | 0 | 0/0 (912) |
| veil4-ats12-u1-1 | 0/123 | 0 | 0/0 (1030) |
| main3-ats12-u1-2 | 0/114 | 0 | 0/0 (903) |
| veil4-ats12-u1-2 | 0/123 | 0 | 0/0 (1017) |
| main3-ats12-u1-3 | 0/120 | 0 | 0/0 (907) |
| veil4-ats12-u1-3 | 0/123 | 0 | 0/0 (1015) |

`grep -c '^FAIL'` counted zero matches in every stripped log.

## Comparison with the veil3 round

The prior round used the extended tail and traced the third pair. The current
round uses the same UX sample length and the standard LoAF blocking window.
[Veil3 round summary](../../final/stage-C3/summary.md)

| Build and round | Blank median (ms) | Write → clear median (ms) | Completion frame median (range), ms | LoAF blocking median (range), ms |
|---|---:|---:|---|---|
| main3 in veil3 round | 106.5 | 207.5 | 2047.5 (1878.3–2057.2) | 7061.4 (6527.7–7354.0) |
| veil3 | 108.0 | 145.4 | 671.1 (668.0–688.8) | 1778.3 (1728.4–1913.6) |
| main3 in veil4 round | 141.5 | 199.5 | 1944.8 (1892.5–1958.8) | 7050.5 (6837.7–7465.6) |
| veil4 | 100.4 | 136.7 | 682.3 (666.9–689.3) | 1842.5 (1814.3–1856.7) |

The veil3 round recorded main3 after-drawing jump counts of 1/0/1, each +162.1 px,
and veil3 counts of 0/0/0. Before completion it counted 567/565/567 veiled
blocks on veil3. This round counted 567/567/567 on veil4.

- Veil4 completion frame median changed by +11.2 ms, within both run spreads (veil3 20.8 ms, veil4 22.4 ms).
- Veil4 LoAF blocking median changed by +64.2 ms, within veil3’s run spread (veil3 185.2 ms, veil4 42.4 ms).

## Later frames and scroll geometry

UX intervals are between frame starts, using the first frame without `in_progress`
as zero. LoAF entries use the separate mutation probe's completion mark and are
limited to the standard window. The last geometry change is the last observed
change in scrollTop or scrollHeight from clear to the end of the UX sampler.
Without a trace the pre-layout callback count and end time are unmeasured.

| Run | UX intervals of at least 50 ms from +1 s (start → duration, ms) | Standard LoAF from +1 s (start → duration, ms) | First clear → last geometry change (+ms) |
|---|---|---|---|
| main3-ats12-u1-1 | 1622.9 → 161.8, 1784.7 → 79.5, 1864.2 → 62.0, 1926.2 → 79.5, 2178.6 → 54.5, 7105.0 → 109.4 | 1397.5 → 320.4, 1723.7 → 171.8, 1900.7 → 63.0, 1969.3 → 71.6, 2047.0 → 50.9 | 1926.2 → 2233.1 |
| veil4-ats12-u1-1 | 1741.1 → 52.5, 1902.8 → 66.4, 7152.0 → 116.2 | 1820.2 → 53.9, 1988.0 → 61.8 | 525.3 → 813.8 |
| main3-ats12-u1-2 | 1569.4 → 116.4, 1685.8 → 55.5, 1741.3 → 90.2, 1831.5 → 56.8, 1921.1 → 58.1, 2070.0 → 53.8, 7234.5 → 111.1, 10341.3 → 54.6, 10582.6 → 237.6 | 1347.4 → 318.2, 1671.4 → 113.0, 1842.4 → 104.0, 2021.2 → 52.4 | 1831.5 → 2153.6 |
| veil4-ats12-u1-2 | 1716.7 → 78.3, 2086.1 → 66.3, 3665.7 → 67.7, 3733.4 → 53.9, 4870.8 → 51.7, 7042.1 → 117.1 | 1799.8 → 77.8, 2174.9 → 60.3, 4953.2 → 52.2 | 594.1 → 926.3 |
| main3-ats12-u1-3 | 1615.5 → 148.0, 1763.5 → 54.0, 1866.5 → 77.5, 1944.0 → 61.5, 2040.0 → 57.7, 7176.3 → 106.9, 10389.0 → 56.2, 10712.2 → 228.7 | 1384.7 → 324.6, 1715.1 → 155.9, 1916.3 → 62.8, 1984.7 → 51.8, 2042.0 → 55.6 | 1866.5 → 2195.6 |
| veil4-ats12-u1-3 | 1749.9 → 54.1, 2078.1 → 103.4, 2181.5 → 111.8, 2493.1 → 68.4, 4810.7 → 53.1, 7133.6 → 120.0 | 1835.5 → 53.9, 2178.7 → 119.2, 2309.2 → 71.1, 2580.7 → 67.1, 4900.3 → 52.0 | 534.1 → 823.7 |

## Lab use

Lab 2 was acquired at 2026-11-26T23:39:02Z and released by 2026-11-26T23:59:24Z. Six runs used
20 min 11 s. Time under lock including cleanup was 20 min 22 s.
The queue took 16 min 18 s across 1 acquire invocation(s).
Cleanup reported `restore exit=0` and `release exit=0`.
[Restore output](restore.log) · [Release output](release.log)
