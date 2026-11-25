# Veil acceptance, stage A: `ats12` completion frame and blocking (#177), 2026-11-24

**Question.** On `ats12` with `PHASES=stream`, does the veil (`e5f480e`) meet spec #170's acceptance
rules for the completion frame and blocking over the window, against `main` before the change
(`547fa0a`, "head") in the same lock sequence?

**Answer.** Yes. Three head and three veil runs, interleaved under one `--perf` lock on lab 2: the
veil's median completion frame is 624.4 ms (head 1866.3 ms), no veil frame reaches 1 s, its median
blocking is 78.0% below head's, and every veil run passes all 13 verdicts. Exact commands and the
lab-1 false start are in [commands.md](commands.md); the per-run lines are in the `*.log` files.

## Per run

Completion frame: the long animation frame the harness names as the completion frame (`REPORT
completion frame`). Blocking over the window: LoAF blocking from Enter to 5 s after the stream
completes (`REPORT long animation frames`); the longtask blocking for the same window is given for
reference. rAF forced: style and layout forced by ChatGPT's completion `FrameRequestCallback`
(`chatgpt:681678.*.js`) inside the completion frame.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over the window, LoAF (ms) | Longtask blocking (ms) | LoAF frames | rAF callback: duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `head-ats12-1` | 2094.7 | 2042.4 | 7410.7 | 7501 | 350 | 1392.3 / 1331.7 | 2094.7 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-1` | 670.3 | 603.9 | 1772.9 | 1530 | 106 | 15.9 / 6.6 | 670.3 | 0 | 13 PASS, 0 FAIL |
| `head-ats12-2` | 1866.3 | 1814.2 | 8324.6 | 8686 | 370 | 1226.2 / 1173.6 | 1866.3 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-2` | 624.4 | 573.2 | 1565.4 | 1368 | 77 | 15.6 / 6.4 | 624.4 | 0 | 13 PASS, 0 FAIL |
| `head-ats12-3` | 1865.5 | 1803.6 | 6635.5 | 6728 | 325 | 1247.1 / 1193.7 | 1865.5 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-3` | 606.7 | 555.8 | 1630.1 | 1450 | 90 | 15.8 / 6.9 | 606.7 | 0 | 13 PASS, 0 FAIL |

In every run the longest frame is the completion frame. Verdicts on every run: `replay-hook`,
`replay-streams`, `in-progress`, `cv-blocks`, `seen-marks`, `throttle-matched`, `stream-no-jump`,
`rail-new-tick`, `rail-new-tick-lit`, `veil-none-rendered`, `no-escape`, `server-unchanged`, plus
`veil-effective` on the veil runs. Head prints `REPORT veil-effective: not judged, no block was veiled
just before the completion frame`, as #173 expects for a build without the veil. The veil runs print:

```text
veil-ats12-1: REPORT veil-effective: 584 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.6 ms of style and layout (frame 670.3 ms at 105014.2 ms)
veil-ats12-2: REPORT veil-effective: 584 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.4 ms of style and layout (frame 624.4 ms at 105050.1 ms)
veil-ats12-3: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.9 ms of style and layout (frame 606.7 ms at 105021.4 ms)
```

`veil-none-rendered`: 0 leaking blocks in every sample and after the window, on both builds. `OPTS put
back: … same as before true` on every run.

## Median per build

| Build | Completion frame (ms) | Blocking over the window, LoAF (ms) | Longtask blocking (ms) | rAF forced (ms) | Longest frame (ms) |
|---|---:|---:|---:|---:|---:|
| head | 1866.3 | 7410.7 | 7501 | 1193.7 | 1866.3 |
| veil | 624.4 | 1630.1 | 1450 | 6.6 | 624.4 |

## Against the spec

| Rule (#170 Acceptance runs, `ats12` part) | Measured | Result |
|---|---|---|
| Veil median completion frame under 800 ms | 624.4 ms | PASS |
| No veil run has a frame of at least 1 s | 0 frames ≥ 1 s in each of 3 veil runs (longest 670.3 ms) | PASS |
| Veil median blocking at least 50% below head's | 1630.1 vs 7410.7 ms: 78.0% below (longtask measure: 80.7% below) | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## Notes for later stages

- The veil's remaining ~600 ms completion frame is a `TimerHandler:setTimeout` script with
  source `other` (570–620 ms, about 175 ms forced), present at the same size on head (585–676 ms); the
  veil removes the rAF callback's ~1.2 s of forced layout, not this script.
- `--lab auto` needs `--needs-fixture ats12` (or `--lab 2`): lab 1 has no `ats12`, and its browser
  may be stopped.
- A `PHASES=stream` run takes 190–199 s; with the lock and restore, six runs fit in about 21 minutes.
