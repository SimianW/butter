# Final veil acceptance, stage C2b (#177)

At +14 s, the veil build was close to the control on this fixture, with
three blank frames on every jump and median blank time of 125.0 vs 120.45 ms.
The three veil3 and two main3 runs show a much smaller gap than at +2 s,
with limited precision for the remaining few milliseconds.

## Per run

Lab 2 ran the `ats12` fixture with
`PHASES=stream UX=u2 U2_BLOCK=306 U2_DELAY=14000` and
`OPTS={"rail":true,"bookmark":true}`. The builds were main3 (`3b9c3d5`) and
veil3 (`aed9523`). The sampler recorded 1964.9–1979.7 ms after the actual
write in every run. The LoAF observer stopped 7083.9–7295.9 ms after its
completion mark, so frame 2's render part at the late jump is unavailable.

Blank duration runs from the first sample with a tested point on a veiled,
opacity-0 or skipped block to the next clear sample. Write → first text is
the first sample with a rendered, unveiled test point, a proxy for the
first draw with text. The view shift counts start when the probe settles
on an anchor, at least 100 ms after the write.

| Run | Completion frame (ms) | Write after completion (ms) | Blank frames (duration in ms) | Write → first text (ms) | Write → clear (ms) | Frame intervals 1→2, 2→3, 3→clear (ms) | Frame 2 render (ms) | Settle after write (ms), anchor | Jumps >4 px after drawing [frame start] | Stored opts before | Verdicts |
|---|---:|---:|---|---:|---:|---|---|---|---|---|---|
| [veil3-ats12-u2late-1](veil3-ats12-u2late-1.log) | 693.5 | 14031.3 | 3 (125.0) | 99.6 | 141.0 | 36.2, 47.4, 41.4 | Outside LoAF window | 141.0, block 322 | 0 [0] | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2late-1](main3-ats12-u2late-1.log) | 1890.0 | 14015.8 | 3 (118.8) | 97.3 | 135.7 | 36.1, 44.3, 38.4 | Outside LoAF window | 135.7, block 322 | 0 [0] | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u2late-2](veil3-ats12-u2late-2.log) | 615.1 | 14029.2 | 3 (127.2) | 100.7 | 143.0 | 37.0, 47.9, 42.3 | Outside LoAF window | 100.7, block 320 | 0 [0] | `null` | 13 PASS, 0 FAIL |
| [main3-ats12-u2late-2](main3-ats12-u2late-2.log) | 2080.4 | 14029.6 | 3 (122.1) | 98.9 | 138.4 | 38.0, 44.6, 39.5 | Outside LoAF window | 138.4, block 322 | 0 [0] | `null` | 12 PASS, 0 FAIL |
| [veil3-ats12-u2late-3](veil3-ats12-u2late-3.log) | 766.1 | 14023.2 | 3 (124.1) | 99.5 | 140.2 | 36.0, 47.4, 40.7 | Outside LoAF window | 140.2, block 322 | 0 [0] | `null` | 13 PASS, 0 FAIL |

Every write took scrollTop from 9754 to 50863 px and targeted block 306 of
612, with 20 of 21 nearby blocks held. Block 306 had flags `15` (veiled,
opacity 0, skipped, held) on all three veil3 runs and `12` (skipped, held)
on both main3 runs. The largest post-drawing anchor move was 0 px in every
run. The centre point ended on block 322 each time. Each
`storage before the run` line reported `opts null` and the two-key
`OPTS` above. Every restore reported `same as before true, opts null`.

## Per build

| Build | Blank frames worst / median | Blank duration median (range), ms | Write → first text median (range), ms | Write → clear median (range), ms | Frame 2→3 median (range), ms | Frame 2 render | Jumps >4 px worst | Completion frame median, ms |
|---|---|---|---|---|---|---|---:|---:|
| main3 | 3 / 3 | 120.45 (118.8–122.1) | 98.1 (97.3–98.9) | 137.05 (135.7–138.4) | 44.45 (44.3–44.6) | Outside LoAF window | 0 | 1985.2 |
| veil3 | 3 / 3 | 125.0 (124.1–127.2) | 99.6 (99.5–100.7) | 141.0 (140.2–143.0) | 47.4 (47.4–47.9) | Outside LoAF window | 0 | 693.5 |

| Stage | Jump after completion | Main3 median blank (ms) | Veil3 median blank (ms) | Veil3 minus main3 (ms) |
|---|---:|---:|---:|---:|
| [Final C2](../stage-C2/summary.md) | +2 s | 123.7 | 253.5 | +129.8 |
| Final C2b | +14 s | 120.45 | 125.0 | +4.55 |

## KaTeX fonts and pre-layout

Times are relative to the jump. The size-font columns give
`document.fonts` `loadingdone` events. Negative values are before the write.

| Veil3 run | AMS (ms) | Size1 (ms) | Size2 (ms) | Size3 (ms) |
|---|---:|---:|---:|---:|
| veil3-ats12-u2late-1 | −111919.8 | −11712.8 | −11460.9 | −8477.2 |
| veil3-ats12-u2late-2 | −111856.7 | −11920.4 | −11622.6 | −8727.0 |
| veil3-ats12-u2late-3 | −111972.2 | −11763.1 | −11526.4 | −8564.1 |

KaTeX AMS loaded during streaming. On veil3, Size1 and Size2 finished
loading +2.109–2.570 s after completion and Size3 at +5.302–5.554 s.
In final C2, Size1 and Size3 loaded +321.6–520.1 ms after the write,
and Size2 loaded +624.2–776.6 ms after it. At +14 s there were no KaTeX
loads after the write on either build. Main3 loaded all four KaTeX
families during streaming in both C2b runs. File timings for AMS,
Size1 and Size2 are in the logs. Size3 has a `loadingdone` event.

Final C3's traced veil3 run recorded the last pre-layout callback ending
at +11.123 s on its mutation probe's clock. C2b's font loads show the math
fonts were ready at the jump. The C2b captures have no callback trace or
block counter to confirm the pass end or its work on block 306.
[Final C3 trace](../stage-C3/summary.md).

ScrollTop held at 9754 px in every sample from completion to the write.
ScrollHeight started at 95686 px in every run and changed once before the
write, as follows.

| Run | ScrollHeight after change (px) | Change after completion (ms) |
|---|---:|---:|
| veil3-ats12-u2late-1 | 95570 | 120.6 |
| main3-ats12-u2late-1 | 95638 | 1563.2 |
| veil3-ats12-u2late-2 | 95638 | 331.9 |
| main3-ats12-u2late-2 | 95570 | 1704.9 |
| veil3-ats12-u2late-3 | 95476 | 344.9 |

## Verdicts

| Veil3 run | `veil-none-rendered` | `veil-effective` |
|---|---|---|
| veil3-ats12-u2late-1 | PASS, 0 of 121 samples | PASS, 567 blocks veiled before completion, 8.2 ms forced style/layout in ChatGPT's completion rAF |
| veil3-ats12-u2late-2 | PASS, 0 of 122 samples | PASS, 567 blocks veiled before completion, 6.3 ms forced style/layout in ChatGPT's completion rAF |
| veil3-ats12-u2late-3 | PASS, 0 of 122 samples | PASS, 567 blocks veiled before completion, 7.5 ms forced style/layout in ChatGPT's completion rAF |

Both controls passed `veil-none-rendered` and reported `veil-effective` as
unjudged. The JSON had zero hydration samples flagged in every run.
All five replays exited 0 and every stripped log has zero `FAIL` lines.

## Long animation frames from completion +1 s

Each entry is start offset / duration / blocking, in ms, on the LoAF
observer's completion clock. The observer attributed no long frame after
completion to a Butter script or to an idle callback. The longer UX
sampler recorded these counts of gaps of at least 50 ms between samples
after the write, in run order, with maxima in parentheses
1 (57.7 ms), 3 (105.0 ms), 3 (76.3 ms), 3 (103.1 ms), and 0.

| Run | Offset / duration / blocking |
|---|---|
| veil3-ats12-u2late-1 | +1435.8 / 55.5 / 0, +1826.2 / 61.6 / 4.7, +2144.3 / 54.9 / 0, +2304 / 51.7 / 0.8, +2556.4 / 52.8 / 1.7, +5536.2 / 54.6 / 3.6 |
| main3-ats12-u2late-1 | +1343.4 / 319.5 / 11.7, +1668.7 / 78.5 / 0, +1788.2 / 73.9 / 14.8 |
| veil3-ats12-u2late-2 | +1497.4 / 53.2 / 0, +1891.8 / 58.6 / 1.4, +2045.7 / 87 / 0, +2170.2 / 51.2 / 0, +2362.2 / 51.2 / 0.3, +2414 / 56.7 / 0, +2662.9 / 51.9 / 0, +2902.9 / 53.6 / 0, +3145.7 / 51.8 / 0, +3644.2 / 51 / 0, +3888.6 / 50.2 / 0, +4131.8 / 53.5 / 0, +4376.8 / 50.9 / 0, +4619.6 / 56.9 / 0, +4872.1 / 58.4 / 0, +5224.1 / 55.2 / 0, +5284.1 / 51.6 / 0.8 |
| main3-ats12-u2late-2 | +1474.2 / 329.5 / 17.7, +1809.4 / 122.9 / 31, +2045.9 / 54.4 / 0 |
| veil3-ats12-u2late-3 | +1742.6 / 97.7 / 10.6, +2239.8 / 53.2 / 2.3, +2483.8 / 51.2 / 0.4, +3826.1 / 58.2 / 0, +4079.7 / 51 / 0, +4933.8 / 53.8 / 0, +5420.2 / 75.1 / 0, +5942.9 / 52.2 / 0 |

## Run budget

Five replays took 16 min 42 s. The full lab lock sequence including restore
took 16 min 52 s. The lock queue took 30 min 57 s and was outside the run
budget. Lab restore exited 0 and both locks were released.
[Exact commands and execution output](commands.md).
