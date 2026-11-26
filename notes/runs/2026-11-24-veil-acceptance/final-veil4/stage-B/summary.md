# Veil4 acceptance stage B on `math9` (#177)

**FAIL overall.** Veil4 passed all three timing rules. One veil4 replay failed
`veil-none-rendered`. All three veil4 replays had `veil-effective` judged and passing.

Lab 2 ran three interleaved pairs of main3 (`3b9c3d5`) and veil4 (`004851d`) under
one perf lock with `PHASES=stream` and `OPTS={"rail":true,"bookmark":true}`.
Each replay used 357 recorded chunks over about 107 s. [Commands and output](commands.md)

## Per run

The completion frame is the frame in `REPORT completion frame`. Window blocking
is LoAF blocking from Enter to five seconds after the harness observes replay
completion. Long-task blocking covers the same window. The rAF column shows
the duration and forced style/layout of ChatGPT's completion `FrameRequestCallback`
(`chatgpt:681678.28a09074e0.js`). All timings are in ms.

| Run | Completion frame | Its blocking | LoAF blocking over window | Long-task blocking | LoAF frames | rAF duration / forced | Longest frame | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| [`main3-math9-default-1`](main3-math9-default-1.log) | 1985.8 | 1932.4 | 10109.3 | 10220 | 465 | 1252.4 / 1199 | 1985.8 | 1 | 12 PASS, 0 FAIL, exit unobserved |
| [`veil4-math9-default-1`](veil4-math9-default-1.log) | 691.8 | 640.9 | 3535.6 | 3148 | 241 | 15.5 / 6.5 | 691.8 | 0 | 13 PASS, 0 FAIL, exit 0 |
| [`main3-math9-default-2`](main3-math9-default-2.log) | 1863.5 | 1811.2 | 9280.3 | 9350 | 457 | 1216 / 1163.8 | 1863.5 | 1 | 12 PASS, 0 FAIL, exit 0 |
| [`veil4-math9-default-2`](veil4-math9-default-2.log) | 634.3 | 583.4 | 3442.6 | 3215 | 255 | 16 / 6.5 | 634.3 | 0 | 12 PASS, 1 FAIL, exit 1 |
| [`main3-math9-default-3`](main3-math9-default-3.log) | 1822.6 | 1770 | 9730.3 | 9870 | 455 | 1207.2 / 1155.3 | 1822.6 | 1 | 12 PASS, 0 FAIL, exit 0 |
| [`veil4-math9-default-3`](veil4-math9-default-3.log) | 637.4 | 586.6 | 3128.4 | 2865 | 226 | 15.3 / 6.3 | 637.4 | 0 | 13 PASS, 0 FAIL, exit 0 |

The completion frame was the longest frame in each run. Each run also had a
frame at Enter lasting 585.6–607.8 ms. All six runs produced complete harness
logs and JSON measurements, and both builds' medians use all three runs.

## Median per build

| Build | Completion frame | Its blocking | LoAF blocking over window | Long-task blocking | LoAF frames | rAF duration / forced | Longest frame | Frames ≥ 1 s |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `main3` | 1863.5 | 1811.2 | 9730.3 | 9870 | 457 | 1216 / 1163.8 | 1863.5 | 1 |
| `veil4` | 637.4 | 586.6 | 3442.6 | 3148 | 241 | 15.5 / 6.5 | 637.4 | 0 |

## Acceptance rules

| Rule | Measured | Result |
|---|---|---|
| 1. Veil4 median completion frame under 800 ms | 637.4 ms | PASS |
| 2. No veil4 frame of at least 1 s | 0 across all three runs. Maximum 691.8 ms. | PASS |
| 3. Veil4 median window blocking at least 50% below main3 | 3442.6 vs 9730.3 ms, 64.6% lower. Median long-task blocking was 68.1% lower. | PASS |
| 4. Every veil4 run passes all verdicts, including judged `veil-effective` | 3/3 passed judged `veil-effective`. 2/3 passed `veil-none-rendered` and all verdicts. | FAIL |

`veil4-math9-default-2` printed the only failing verdict across both builds.

```text
FAIL veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 1 of 123 samples (most 1); 0 after the window
```

| Run | Sample time after Enter (ms) | `veiled` | `veiledNotAuto` | `leaks` |
|---|---:|---:|---:|---:|
| `veil4-math9-default-2` | 4906 | 1 | 0 | 1 |

This sample is from `hydration.rows` during streaming. The timestamp and counters
match the pattern seen on the veil3 round's main3 control at 4909.2 ms. The probe
reports computed opacity, so the source of this sample's opacity is undetermined.
[Issue #187](https://github.com/SimianW/butter/issues/187)

## Veil verdicts and stored options

| Run | `veil-none-rendered` | `veil-effective` | Blocks veiled before completion | Stored opts before run |
|---|---|---|---:|---|
| `main3-math9-default-1` | PASS, 0 of 118 samples | Unjudged | 0 | `null` |
| `veil4-math9-default-1` | PASS, 0 of 123 samples | PASS, judged | 567 | `null` |
| `main3-math9-default-2` | PASS, 0 of 119 samples | Unjudged | 0 | `null` |
| `veil4-math9-default-2` | FAIL, 1 of 123 samples | PASS, judged | 567 | `null` |
| `main3-math9-default-3` | PASS, 0 of 119 samples | Unjudged | 0 | `null` |
| `veil4-math9-default-3` | PASS, 0 of 122 samples | PASS, judged | 567 | `null` |

Every `storage before the run` line shows local keys `[butter]`, sync keys
`[]`, opts `null`, and SHA-256 prefix `b141befa2bc99003`. The applied opts
were rail and bookmark only on all six runs. All six restored the prior fingerprint.

## Frames of at least 50 ms starting at completion + 1 s or later

Offsets are relative to the `in_progress gone` mark. All times are in ms.
A dash means Chromium listed no script for the frame.

| Run | Starts after completion | Duration | Blocking | Script attribution |
|---|---:|---:|---:|---|
| `main3-math9-default-1` | +1351.4 | 320.5 | 4.4 | — |
| `veil4-math9-default-1` | +1309.4 | 63.7 | 12.7 | — |
| `veil4-math9-default-1` | +1734 | 60.9 | 0.8 | Timer callback, source `other` |
| `main3-math9-default-2` | +1312.9 | 309.3 | 0.7 | — |
| `main3-math9-default-2` | +1627.4 | 55.7 | 0 | Timer callback, source `other` |
| `veil4-math9-default-2` | +1299.7 | 71.4 | 11.2 | — |
| `main3-math9-default-3` | +1305.7 | 303.3 | 0 | — |
| `veil4-math9-default-3` | +1272.2 | 71.5 | 10.9 | — |

Each veil4 run's longest such frame was 63.7–71.5 ms. Each current main3
run's longest such frame was 303.3–320.5 ms. In the veil3 round, the corresponding
ranges were 62.3–72.4 ms for veil3 and 312–345.5 ms for main3.
[Veil3 stage B](../../final/stage-B/summary.md)

Every run's sampled post-completion `scrollTop` held at 142801 px.
`scrollHeight` and last-turn height held at 228685 / 85136 px in pairs 1 and 3,
and 228523 / 84974 px in pair 2. The stage used six untraced replays, so the
pre-layout end time is unobserved. All three veil4 logs report an empty
`laf butter files` object.

## Comparison with veil3

Historical values come from the three untraced [veil3 stage B runs](../../final/stage-B/summary.md).
Spread is the maximum minus the minimum for each set of three runs.

| Metric (ms) | Veil4 median [min–max] | Veil3 median [min–max] | Veil4 minus veil3 median | Spread veil4 / veil3 |
|---|---:|---:|---:|---:|
| Completion frame | 637.4 [634.3–691.8] | 641.6 [638.3–698] | −4.2 | 57.5 / 59.7 |
| LoAF blocking over window | 3442.6 [3128.4–3535.6] | 3241.1 [2938.3–3648.8] | +201.5 | 407.2 / 710.5 |
| Completion rAF duration | 15.5 [15.3–16] | 15.5 [14.9–15.6] | 0 | 0.7 / 0.7 |
| Completion rAF forced style/layout | 6.5 [6.3–6.5] | 6.5 [6.3–6.5] | 0 | 0.2 / 0.2 |

Both timing differences are smaller than the run-to-run spread on either build.
The three veil4 counts were 567/567/567 veiled blocks before completion.
Veil3 recorded 566/567/567 in the historical acceptance runs.

## Run budget and cleanup

The sequence used **6 runs and 20 min 32 s under lock**, including a tool-session
recovery and 12 s of cleanup. Queue time was **22 min 18 s**. The original session
disconnected during main3 run 1, whose harness wrote the JSON and reported all
12 verdicts passing. Its exact wall time and process exit were unobserved.
The same lock covered the remaining five runs. Restore and release exited 0.
The anchored FAIL count is 1 in `veil4-math9-default-2.log` and 0 in all other
stripped logs. [Exact commands and execution output](commands.md)
