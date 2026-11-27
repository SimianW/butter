# Final veil acceptance stage B on `math9` (#177)

**FAIL overall.** All three timing rules passed, and all three `veil3` acceptance runs passed every
harness verdict. One `main3` control failed `veil-none-rendered`. Rule 4 applies to both builds.

The six acceptance runs interleaved `main3` (`3b9c3d5`) and `veil3` (`aed9523`) on lab 2 under
one perf lock, with `PHASES=stream` and `OPTS={"rail":true,"bookmark":true}`. The replay sent 357
recorded chunks over about 107 s. See [the exact commands and run times](commands.md).

## Per run

The completion frame is the frame in `REPORT completion frame`. Blocking over the window is the
LoAF blocking in `REPORT long animation frames`, from Enter to 5 s after the harness sees the
replay complete. Long-task blocking is shown for the same window. The rAF numbers are the duration
and forced style/layout of ChatGPT's `FrameRequestCallback` in the completion frame
(`chatgpt:681678.6351943e5d.js`). All timings below are in ms.

| Run | Completion frame | Its blocking | LoAF blocking over window | Long-task blocking | LoAF frames | rAF duration / forced | Longest frame | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| [`main3-math9-default-1`](main3-math9-default-1.log) | 2105.9 | 2053 | 11580.2 | 11546 | 496 | 1391.5 / 1329.9 | 2105.9 | 1 | 12 PASS, 0 FAIL, exit 0 |
| [`veil3-math9-default-1`](veil3-math9-default-1.log) | 698 | 646.4 | 3648.8 | 3371 | 243 | 15.5 / 6.5 | 698 | 0 | 13 PASS, 0 FAIL, exit 0 |
| [`main3-math9-default-2`](main3-math9-default-2.log) | 1925.9 | 1867.7 | 10301.6 | 10371 | 493 | 1255.4 / 1200.8 | 1925.9 | 1 | 11 PASS, 1 FAIL, exit 1 |
| [`veil3-math9-default-2`](veil3-math9-default-2.log) | 641.6 | 590.8 | 3241.1 | 2869 | 218 | 14.9 / 6.3 | 641.6 | 0 | 13 PASS, 0 FAIL, exit 0 |
| [`main3-math9-default-3`](main3-math9-default-3.log) | 1919.6 | 1867.3 | 10157.6 | 10009 | 468 | 1258.3 / 1203.6 | 1919.6 | 1 | 12 PASS, 0 FAIL, exit 0 |
| [`veil3-math9-default-3`](veil3-math9-default-3.log) | 638.3 | 587.4 | 2938.3 | 2677 | 225 | 15.6 / 6.5 | 638.3 | 0 | 13 PASS, 0 FAIL, exit 0 |

The longest frame in every run was the completion frame. Each run had one more frame above
500 ms at Enter, between 581.1 and 627.4 ms across both builds. The `main3` run that exited 1
completed the replay and recorded its timings. Its measurements are included in the three-run
control medians.

## Median per build

| Build | Completion frame | Its blocking | LoAF blocking over window | Long-task blocking | LoAF frames | rAF duration / forced | Longest frame | Frames ≥ 1 s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `main3` | 1925.9 | 1867.7 | 10301.6 | 10371 | 493 | 1258.3 / 1203.6 | 1925.9 | 1 |
| `veil3` | 641.6 | 590.8 | 3241.1 | 2869 | 225 | 15.5 / 6.5 | 641.6 | 0 |

## Acceptance rules

| Rule | Measured | Result |
|---|---|---|
| 1. `veil3` median completion frame under 800 ms | 641.6 ms | PASS |
| 2. No `veil3` frame of at least 1 s | 0 in each run. Maximum 698 ms. | PASS |
| 3. `veil3` median LoAF blocking at least 50% below `main3` | 3241.1 vs 10301.6 ms, 68.5% lower. Median long-task blocking was 72.3% lower. | PASS |
| 4. Every verdict passes on both builds, with both veil checks judged and passing on every `veil3` run | 5 of 6 runs exit 0. All 3 `veil3` runs pass both checks. One `main3` run fails `veil-none-rendered`. | FAIL |

`main3-math9-default-2` printed this verdict:

```text
FAIL veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 1 of 119 samples (most 1); 0 after the window
```

Its one flagged sample was at 4909.2 ms after Enter while the answer was streaming. The raw
sample records `inProgress: true`, `leaks: 1`, and `veiledNotAuto: 0`. There were zero blocks
at opacity 0 just before completion and zero flagged blocks after the window. The probe reports
computed opacity. The cause of that sample was undetermined.

| Run | `veil-none-rendered` | `veil-effective` | Stored opts before run |
|---|---|---|---|
| `main3-math9-default-1` | PASS, 0 of 118 samples | Reported as not judged | `null` |
| `veil3-math9-default-1` | PASS, 0 of 119 samples | PASS, 566 blocks at opacity 0 before completion, 6.5 ms forced | `null` |
| `main3-math9-default-2` | FAIL, 1 of 119 samples | Reported as not judged | `null` |
| `veil3-math9-default-2` | PASS, 0 of 122 samples | PASS, 567 blocks at opacity 0 before completion, 6.3 ms forced | `null` |
| `main3-math9-default-3` | PASS, 0 of 119 samples | Reported as not judged | `null` |
| `veil3-math9-default-3` | PASS, 0 of 122 samples | PASS, 567 blocks at opacity 0 before completion, 6.5 ms forced | `null` |

Every acceptance log's `storage before the run` line shows local keys `[butter]`, sync keys
`[]`, opts `null`, and SHA-256 prefix `b141befa2bc99003`. The raw JSON confirms the options
used were rail and bookmark only. All six restored the prior fingerprint.

## Frames of at least 50 ms from completion + 1 s

Completion here means the `in_progress gone` marker. The standard run JSON lists the frames
below by start time, duration and blocking, all in ms. A dash in script attribution indicates
that Chromium provided no script for the frame.

| Run | Starts after completion | Duration | Blocking | Script attribution |
|---|---:|---:|---:|---|
| `main3-math9-default-1` | +1497.2 | 345.5 | 7.5 | — |
| `main3-math9-default-1` | +1848.3 | 115.3 | 24.8 | Timer callback, source `other` |
| `veil3-math9-default-1` | +1341.9 | 72.4 | 11.8 | — |
| `veil3-math9-default-1` | +1779.0 | 62.4 | 0 | Timer callback, source `other` |
| `main3-math9-default-2` | +1353.4 | 312 | 0.7 | — |
| `main3-math9-default-2` | +1670.6 | 53.8 | 0 | Timer callback, source `other` |
| `veil3-math9-default-2` | +1282.4 | 62.3 | 11.3 | — |
| `main3-math9-default-3` | +1356.7 | 312.2 | 0.1 | — |
| `main3-math9-default-3` | +1674.0 | 57.9 | 0 | Timer callback, source `other` |
| `veil3-math9-default-3` | +1257.2 | 71.3 | 11.1 | — |

Each `veil3` acceptance run had at least one such frame. Each `veil3` run had `scrollTop`
142801 px and `scrollHeight` 228685 px at every post-completion scroll sample. The final
`scrollHeight` sample agreed, and the last turn was 85136 px at every post-completion height sample.

## Pre-layout diagnostic

A seventh run used the same `veil3` build and settings, with a post-completion trace and
a read-only CDP scroll sample about every 500 ms. Its times are relative to `in_progress gone`.

- The last pre-layout callback ended at **+4928.5 ms**. The trace began at +1148.9 ms and
  captured 167 callbacks starting at +1165.8 ms through the end of the pass. It may have missed
  the earliest callbacks. The traced callbacks took 1597.3 ms total and at most 23.7 ms each.
  The longest task containing one was 23.9 ms. They recorded 512 layouts.
- The trace shows one math-font request, `KaTeX_Size1-Regular`, at +1283.8 ms inside a
  pre-layout callback. It loaded at +1307.4 ms.
- One 74.7 ms frame began at +1297.4 ms and recorded 14.4 ms blocking. An observed
  9.1 ms pre-layout callback and the font load occurred within that frame. The frame's
  LoAF entry carries no script attribution. No further frame of at least 50 ms was
  recorded through +18102.8 ms, the end of the extended observation.
- `scrollTop` was **142801 px** and `scrollHeight` **228685 px** in all 30 samples, from
  +423 to +15230 ms. The final `scrollHeight` sample agreed, and the last turn stayed 85136 px
  in the harness's post-completion height samples. [Geometry samples](geometry.log)
- The diagnostic exited 0 with 13 PASS lines. `veil-effective` was judged and passed with
  567 blocks at opacity 0 before completion and 6.7 ms forced layout. `veil-none-rendered`
  passed with zero flagged blocks in 132 samples and after the window. The prior opts were
  `null`, and the prior storage fingerprint was restored. [Diagnostic log](veil3-math9-default-prelayout.log)

## Run budget and cleanup

Six acceptance runs took 20 min 2 s. The pre-layout diagnostic took 3 min 37 s. The full
lock sequence, including restore, took 23 min 50 s. The active acquire waited 21 min 50 s.
An earlier acquire was cancelled while queued to add the diagnostic to the same lock sequence.
Lab restore and release both exited 0. [Exact commands and output](commands.md)

The seven harness logs each contain one `SUMMARY` line with the word `FAIL` or `FAILs`.
`grep -c FAIL` reports 2 on `main3-math9-default-2.log`, 1 on each of the other six,
and 0 on the other logs. There is exactly one verdict line starting with `FAIL ` across all
stripped logs.
