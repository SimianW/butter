# Veil acceptance, stage D: `window.find` and select-all on held blocks (u4) (#177), 2026-11-25

**Question.** On `ats12` with `PHASES=stream UX=u4`, is the veil's (`e5f480e`) median `window.find` time
on held blocks within twice that of `main` before the change (`547fa0a`, "head"), or within head's plus
150 ms, in the same lock sequence? Does select-all give the same text length on both builds? And
(part 2) after a stored layout is restored, do 0 answer blocks compute opacity 0?

**Answer.** No on `window.find`, and the veil is the cause, so the stage stopped after part 1, as the
brief requires. Part 2 was not run.

- **`window.find`: FAIL.** The median over all 9 calls per build is 244.6 ms on veil and 85.3 ms on head.
  The bounds are 170.6 ms (twice head's median) and 235.3 ms (head's plus 150 ms). The veil's median is
  over both.
- **Where the gap is:** in the first call (veil 930.6–948.4 ms, head 96.1–104.4 ms) and the second (veil
  241.0–250.9 ms, head 82.2–84.4 ms). By the third call the two builds are equal (veil 82.2–85.2 ms, head
  83.0–87.9 ms).
- **Select-all: PASS.** The text length is 35,863 characters in all 6 runs. On veil it took 212.4 ms in 2 of
  3 runs, against about 117 ms on head.
- **Each call found and selected its text inside the held block,** on both builds, 18 of 18 calls. No call
  scrolled the page. `scrollIntoView` behaved the same on both builds.
- **Verdicts:** every veil run passes all 13, `veil-none-rendered` and `veil-effective` included. Every head
  run passes 12 (`veil-effective` is not judged on head). No harness run printed a FAIL line.
- **This needs the user before merging.** The spec says that a veil-caused `window.find` gap goes to the
  user before merging, "because that trades one delay for another". It also says that `window.find` is a
  stand-in for the browser's find bar, which searches in idle time, and that a gap in the stand-in should
  be measured with the real find bar (key presses on the lab's display) before judging.

Exact commands are in [commands.md](commands.md). The per-run lines are in the `*.log` files, and the per-run
u4 cuts are in [u4.jsonl](u4.jsonl), made by [u4-extract.mjs](u4-extract.mjs).

## How u4 was run

- **u4 without u1–u3:** with `UX=u4` alone the probe makes no scroll write. The view stays where
  streaming left it (scrollTop 9,754, the answer's start, in every run). The frame sampler runs from
  completion to +16 s, and u4 starts 500 ms after that.
- **The candidates:** the probe takes held blocks (`data-butter-unrendered`) in the answer's last 30%, and
  only veiled ones when any block is veiled. There were 178 of the answer's 612 blocks in every run (all
  veiled on veil). The view was about 59,000 px above them.
- **More than one call per run:** one u4 run made one `window.find` call, which is too few for the spec's 5
  per build over 3 runs. So this stage added `U4_FINDS=<n>` to `lab/harness/stream-ux-probe.mjs`
  (commit `1bea5f0`; the default of 1 keeps the old behaviour).
  - After the first call, it makes n-1 later calls. Each one is on another held block at least 10 blocks
    from the ones already used, and each block's selection is cleared before the next call.
  - Each later call is watched for 30 frames. `scrollIntoView` keeps 10 blocks from every block used.
  - The runs used `U4_FINDS=3`: 3 calls per run, 9 per build (3 first calls, 6 later calls).
- **The same blocks and strings on both builds,** in every run, chosen by the same rule:
  - first call: block 429, 19 characters;
  - later call 1: block 440, 24 characters;
  - later call 2: block 450, 23 characters;
  - `scrollIntoView`: block 460.

  Before each call the block's flags were 15 on veil (veil, opacity 0, content skipped, held) and 12 on
  head (skipped, held).

## Per call: `window.find`

Columns:

- **ms:** the call's own duration (it is synchronous).
- **Found / selected:** the return value, and whether the selection's range is inside the block.
- **Unveiled and rendered:** the first frame after the call in which the block has none of veil, opacity 0
  or skipped, with ms from the call's start. The block was not in view in any of the frames watched.

First calls:

| Run | Block (chars) | Flags before | ms | Found / selected | Unveiled and rendered | scrollTop in the call |
|---|---|---:|---:|---|---|---|
| `head-ats12-u4-1` | 429 (19) | 12 | 104.4 | true / true | frame 1 (112.2 ms) | 9,754 → 9,754 |
| `head-ats12-u4-2` | 429 (19) | 12 | 97.8 | true / true | frame 1 (106.0 ms) | 9,754 → 9,754 |
| `head-ats12-u4-3` | 429 (19) | 12 | 96.1 | true / true | frame 1 (104.1 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-1` | 429 (19) | 15 | **948.4** | true / true | frame 2 (1,053.2 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-2` | 429 (19) | 15 | **930.6** | true / true | frame 2 (1,030.6 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-3` | 429 (19) | 15 | **933.3** | true / true | frame 2 (1,001.0 ms) | 9,754 → 9,754 |

Later calls:

| Run | Call | Block (chars) | Flags before | ms | Found / selected | Unveiled and rendered | scrollTop in the call |
|---|---|---|---:|---:|---|---|---|
| `head-ats12-u4-1` | 1 | 440 (24) | 12 | 82.2 | true / true | frame 1 (105.0 ms) | 9,754 → 9,754 |
| `head-ats12-u4-1` | 2 | 450 (23) | 12 | 85.3 | true / true | frame 1 (109.4 ms) | 9,754 → 9,754 |
| `head-ats12-u4-2` | 1 | 440 (24) | 12 | 84.1 | true / true | frame 1 (106.5 ms) | 9,754 → 9,754 |
| `head-ats12-u4-2` | 2 | 450 (23) | 12 | 83.0 | true / true | frame 1 (105.0 ms) | 9,754 → 9,754 |
| `head-ats12-u4-3` | 1 | 440 (24) | 12 | 84.4 | true / true | frame 1 (109.0 ms) | 9,754 → 9,754 |
| `head-ats12-u4-3` | 2 | 450 (23) | 12 | 87.9 | true / true | frame 1 (113.1 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-1` | 1 | 440 (24) | 15 | **244.6** | true / true | frame 1 (268.4 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-1` | 2 | 450 (23) | 15 | 82.2 | true / true | frame 1 (105.8 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-2` | 1 | 440 (24) | 15 | **241.0** | true / true | frame 1 (264.5 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-2` | 2 | 450 (23) | 15 | 83.2 | true / true | frame 1 (107.2 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-3` | 1 | 440 (24) | 15 | **250.9** | true / true | frame 1 (274.5 ms) | 9,754 → 9,754 |
| `veil-ats12-u4-3` | 2 | 450 (23) | 15 | 85.2 | true / true | frame 1 (108.7 ms) | 9,754 → 9,754 |

After the watch, block 429 and block 450 had flags 0 on both builds, and block 440 had 8 (still marked
held, but drawn). No block came into view: the page did not scroll in any call or in the frames after it.

## Medians per build

| Build | All calls (n) | Median, all calls | Median, first calls | Median, later calls | Later call 1 (range) | Later call 2 (range) |
|---|---:|---:|---:|---:|---|---|
| head | 9 | 85.3 ms | 97.8 ms | 84.3 ms | 82.2–84.4 ms | 83.0–87.9 ms |
| veil | 9 | **244.6 ms** | **933.3 ms** | 163.1 ms | **241.0–250.9 ms** | 82.2–85.2 ms |

## `scrollIntoView` and select-all

| Run | `scrollIntoView` block 460: scrollTop in the call; first frame in view (top); after 90 frames | Select-all: length (ms) | `innerText` length (ms) | Veiled blocks before / after | Completion frame (ms) |
|---|---|---|---|---|---:|
| `head-ats12-u4-1` | 9,754 → 72,532; frame 1, 57.7 ms (396.8 px), unveiled and rendered; top −679.3 px, out of view, flags 0 | 35,863 (119.6) | 6,319 (28.9) | 0 / 0 | 1,973.7 |
| `head-ats12-u4-2` | the same; frame 1, 57.7 ms | 35,863 (113.0) | 6,319 (28.5) | 0 / 0 | 1,929.0 |
| `head-ats12-u4-3` | the same; frame 1, 59.0 ms | 35,863 (117.6) | 6,319 (29.4) | 0 / 0 | 1,979.9 |
| `veil-ats12-u4-1` | the same; frame 1, 58.8 ms | 35,863 (113.7) | 6,319 (30.5) | 504 / 504 | 626.5 |
| `veil-ats12-u4-2` | the same; frame 1, 57.0 ms | 35,863 (**212.4**) | 6,319 (50.6) | 504 / 504 | 677.5 |
| `veil-ats12-u4-3` | the same; frame 1, 57.7 ms | 35,863 (**213.6**) | 6,319 (33.7) | 504 / 504 | 631.0 |

- **`scrollIntoView` is the same on both builds.** It brought the block into view, unveiled and rendered, in
  the first frame. Within 90 frames the block was 679.3 px above the view at a constant scrollTop, which
  means the content above it grew, on both builds. This differs from the study's u1+u4 run, where the
  scrollTop changed. It is the same on both builds, so it is not the veil.
- **Select-all:** `selectAllChildren(last turn).toString()` gives 35,863 characters in all 6 runs, the same
  as the study. Median duration: veil 212.4 ms, head 117.6 ms. `innerText` leaves out the content that is
  not drawn, on both builds. Select-all did not unveil any block (504 veiled before and after).

## Against the spec

| Rule (#170 Acceptance runs, `u4`) | Measured | Result |
|---|---|---|
| At least 5 `window.find` calls per build over at least 3 runs, first and later calls reported apart | 9 per build over 3 runs: 3 first calls, 6 later calls | Done |
| The veil's median `window.find` time is within twice head's median or within head's plus 150 ms | veil 244.6 ms; head 85.3 ms; bounds 170.6 ms and 235.3 ms (first calls alone: veil 933.3 ms, head 97.8 ms) | **FAIL**, by 9.3 ms over the looser bound on all calls, and 9.5× head on first calls |
| Select-all gives the same text length on both builds | 35,863 on all 6 runs | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |
| Part 2: 0 answer blocks at opacity 0 after a stored layout is restored | not run: the brief stops after part 1 when the veil causes the `window.find` gap | NOT RUN |

No harness run printed a FAIL line. The FAIL above is the `window.find` rule's, judged by
[u4-extract.mjs](u4-extract.mjs):

```text
{"rule":{"headMedian":85.3,"veilMedian":244.6,"twiceHead":170.6,"headPlus150":235.3,"within":false,"selectAllSameLength":true}}
judge exit=3
STOP before part 2: veil median window.find outside both bounds
```

## Why this is the veil

The two arms differ only in the build. Within the same lock sequence and in the same order, every call
had:

- the same block, the same string length and the same scrollTop (9,754, unchanged in the call);
- the same flags apart from the veil's two bits: 15 against 12. On veil, 504 blocks of the answer were
  veiled at the time.

On head, all 9 calls take 82–104 ms. On veil the extra time falls away from call to call:

- **First call:** about +835 ms (930.6–948.4 ms against 96.1–104.4 ms).
- **Second call:** about +160 ms (241.0–250.9 ms against 82.2–84.4 ms).
- **Third call:** none (82.2–85.2 ms against 83.0–87.9 ms).

The spread within each call is under 20 ms on both builds, so the pattern repeats from run to run. It does
not come from the probe's own work: each `window.find` call is timed alone, as one synchronous call. The
first call's block was unveiled and drawn in frame 2, 1,001–1,053 ms after the call, against frame 1,
104–112 ms, on head.

Which part of the browser's work costs the extra time is not established. The probe's long-animation-frame
record ends 5 s after completion, so it does not cover u4 at +16.5 s. The time is inside the
`window.find` call itself, a synchronous browser call, so Butter's scripts cannot run during it. It is
likely the browser's style or layout work for the veiled, opacity 0, skipped blocks during the search,
less of it on each later call. A `TRACE_AT` trace around u4, or `TRACE_SPAN` covering it, would split it.
The study had one pair (971 against 159 ms). This stage repeats it with first calls of 930.6–948.4 ms
against 96.1–104.4 ms.

## Not done

- **Part 2 (the stored-layout check):** not run, as the brief requires when the veil is the cause. Its
  script, [stored-layout-check.mjs](stored-layout-check.mjs), is written but has never run on the lab. It
  does the following:
  - turns on "Remember long-chat layouts" (`opts.layout`, `layoutConsent: granted`);
  - loads `math12` and scrolls through it so a layout record is stored, then reloads;
  - samples the answer blocks at opacity 0 and the inline `content-visibility` blocks that are veiled;
  - switches layouts off with consent granted, so the worker clears the store, then puts back
    `butter` and `butterLayoutCleared` as found and checks the store's row count.
- **The real find bar:** not measured. The spec asks for it when the stand-in shows a gap, before judging.

## Budget

6 harness runs, 21 min 9 s from lock to release, on lab 2 with the perf lock. The lock came after a
25 min wait behind stage C3.
