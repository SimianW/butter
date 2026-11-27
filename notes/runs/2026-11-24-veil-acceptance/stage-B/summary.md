# Veil acceptance, stage B: `math9` completion frame and blocking (#177), 2026-11-24

**Question.** On `math9` with `PHASES=stream`, does the veil (`e5f480e`) meet spec #170's acceptance
rules for the completion frame and blocking over the window, against `main` before the change
(`547fa0a`, "head") in the same lock sequence? These are the first veil-only `math9` numbers; the
study's `math9` figures came from the veil plus late hydration prototype.

**Answer.** Yes. Three head and three veil runs, interleaved under one `--perf` lock on lab 2: the
veil's median completion frame is 695.2 ms (head 1965.1 ms), no veil frame reaches 1 s, its median
blocking is 69.6% below head's, and every veil run passes all 13 verdicts. Exact commands are in
[commands.md](commands.md); the per-run lines are in the `*.log` files.

## Per run

Columns as in stage A. Completion frame: the long animation frame the harness names as the completion
frame (`REPORT completion frame`). Blocking over the window: LoAF blocking from Enter to 5 s after the
stream completes (`REPORT long animation frames`); the longtask blocking for the same window is given
for reference. rAF callback: ChatGPT's completion `FrameRequestCallback` (`chatgpt:681678.*.js`) inside
the completion frame, its duration and the style and layout it forced.

| Run | Completion frame (ms) | Its blocking (ms) | Blocking over the window, LoAF (ms) | Longtask blocking (ms) | LoAF frames | rAF callback: duration / forced (ms) | Longest frame (ms) | Frames ≥ 1 s | Verdicts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `head-math9-1` | 1965.1 | 1906.2 | 11601.5 | 11794 | 504 | 1297.6 / 1241.4 | 1965.1 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-math9-1` | 740.3 | 676.2 | 3524.1 | 3259 | 250 | 15.2 / 6.5 | 740.3 | 0 | 13 PASS, 0 FAIL |
| `head-math9-2` | 1961.2 | 1886.0 | 12115.6 | 11915 | 501 | 1253.0 / 1198.6 | 1961.2 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-math9-2` | 695.2 | 622.3 | 3341.2 | 3058 | 250 | 15.8 / 7.0 | 695.2 | 0 | 13 PASS, 0 FAIL |
| `head-math9-3` | 1995.8 | 1916.4 | 9968.5 | 10352 | 479 | 1287.0 / 1231.5 | 1995.8 | 1 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-math9-3` | 640.2 | 589.2 | 3824.5 | 3623 | 243 | 15.7 / 6.7 | 640.2 | 0 | 13 PASS, 0 FAIL |

In every run the longest frame is the completion frame, and every run exits 0. Verdicts on every run:
`replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`, `seen-marks`, `throttle-matched`,
`stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`, `veil-none-rendered`, `no-escape`,
`server-unchanged`, plus `veil-effective` on the veil runs. Head prints `REPORT veil-effective: not
judged, no block was veiled just before the completion frame`, as #173 expects for a build without the
veil. The veil runs print:

```text
veil-math9-1: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.5 ms of style and layout (frame 740.3 ms at 105035.7 ms)
veil-math9-2: REPORT veil-effective: 585 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 7 ms of style and layout (frame 695.2 ms at 105059.5 ms)
veil-math9-3: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.7 ms of style and layout (frame 640.2 ms at 105048.3 ms)
```

`veil-none-rendered`: 0 leaking blocks in every sample (113–124 samples per run) and after the window,
on both builds; veiled blocks that are not `content-visibility: auto`: max 0 in samples, 0 after the
window. `OPTS put back: … same as before true` on every run.

## Median per build

| Build | Completion frame (ms) | Its blocking (ms) | Blocking over the window, LoAF (ms) | Longtask blocking (ms) | rAF duration / forced (ms) | Longest frame (ms) | LoAF frames |
|---|---:|---:|---:|---:|---:|---:|---:|
| head | 1965.1 | 1906.2 | 11601.5 | 11794 | 1287.0 / 1231.5 | 1965.1 | 501 |
| veil | 695.2 | 622.3 | 3524.1 | 3259 | 15.7 / 6.7 | 695.2 | 250 |

## Against the spec

| Rule (#170 Acceptance runs, `math9` part) | Measured | Result |
|---|---|---|
| Veil median completion frame under 800 ms | 695.2 ms | PASS |
| No veil run has a frame of at least 1 s | 0 frames ≥ 1 s in each of 3 veil runs (longest 740.3 ms) | PASS |
| Veil median blocking at least 50% below head's | 3524.1 vs 11601.5 ms: 69.6% below (longtask measure: 72.4% below) | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## Against the study's veil plus hydration figures

The study gave `math9` a 675 ms completion frame and blocking 67% below head, one run each, on the
veil plus late hydration prototype. The veil alone gives a median of 695.2 ms (range 640.2–740.3 ms) and
69.6% less blocking: within 20 ms of the study's frame and slightly better on blocking. Hydration
starts after completion, so it was not expected to change either number, and it does not appear to.

## Notes for later stages

- As on `ats12`, the veil's remaining completion frame is a `TimerHandler:setTimeout` script with source
  `other` (597–686 ms, 193–256 ms forced), present at about the same size on head (630–656 ms). The
  veil removes the rAF callback's ~1.2 s of forced layout (1199–1241 ms forced on head, 6.5–7.0 ms on
  veil).
- Each veil run's second frame of at least 500 ms is ChatGPT's Enter keydown (`DIV.onkeydown`,
  591–637 ms on veil, 585–659 ms on head), which the spec puts out of scope. `math9` has a larger
  Enter frame than `ats12` (about 250 ms there).
- `head-math9-2` also had an 808 ms mid-stream frame at 78.6 s (ChatGPT's rAF callback, 746 ms
  forced); no veil run has one.
- `--needs-fixture math9` with `--lab auto` took lab 2 directly, after a 7 min wait for another task's
  lock. A `math9` `PHASES=stream` run takes 195–201 s; six runs with restore took 20 minutes.
