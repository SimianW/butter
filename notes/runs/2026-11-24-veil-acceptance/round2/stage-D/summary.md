# Veil acceptance round 2, stage D: `window.find` and select-all on held blocks with pre-layout (u4) (#177), 2026-11-26

**Question.** On `ats12` with `PHASES=stream UX=u4 U4_FINDS=3`, is the median `window.find` time on held
blocks for the veil with pre-layout (`552b8db`, "veil2") within twice that of `main` before the change
(`547fa0a`, "head"), or within head's plus 150 ms, in the same lock sequence? Does select-all give the same
text length on both builds? Does pre-layout leave the searched blocks held, veiled and skipped?

**Answer.** The spec's rule passes, but the first call on a held block is still about 8× slower on veil2.

- **`window.find`, spec rule (median over all 9 calls per build): PASS.** veil2 85.7 ms, head 84.7 ms.
  The bounds are 169.4 ms (twice head) and 234.7 ms (head + 150). Round 1's veil was 244.6 vs 85.3 ms (FAIL).
- **First calls are still slow: veil2 812.0–939.0 ms (median 841.9), head 98.5–103.1 ms (median 99.8).**
  Round 1's veil had 930.6–948.4 ms, so pre-layout took about 90 ms off the median. Judged alone, the first
  calls would fail both bounds (199.6 and 249.8 ms). The rule passes only because 6 of the 9 calls are later
  calls, and those are now equal to head. The pre-layout notes predicted first calls "about head's 96–104 ms".
  That did not happen.
- **Later call 1 matches head now:** veil2 82.2–84.6 ms, head 83.1–86.9 ms. Round 1's veil had 241.0–250.9 ms.
  **Later call 2 is equal,** as in round 1: veil2 85.5–87.1 ms, head 83.3–84.7 ms.
- **Select-all: PASS.** All 6 runs return 35,863 characters. The duration is equal now: veil2 median 113.8 ms,
  head 113.6 ms. Round 1's veil had 212.4 ms.
- **The searched blocks stayed held, veiled and skipped until their call.** On veil2 every call's block had
  flags 15 before the call (veil, opacity 0, skipped, held). On head it was 12 (skipped, held), as in round 1.
  From completion to the end of the window (about +6.3 to +6.7 s), the veiled and held counts and the last
  turn's height stay the same. Pre-layout did not unveil, render or move anything.
- **Verdicts:** each of the 3 veil2 runs prints 13 PASS, including `veil-none-rendered` and `veil-effective`.
  Each of the 3 head runs prints 12 PASS (`veil-effective` is not judged on head). No run printed a `FAIL`
  line. Every run exits 0.

Exact commands are in [commands.md](commands.md). The per-run harness output is in the `*.log` files. The per-run
u4 numbers are in [u4.jsonl](u4.jsonl) (from [u4-extract.mjs](u4-extract.mjs), round 1's judge with the build key
`veil2`). The post-completion data is in [prelayout.jsonl](prelayout.jsonl) (from
[prelayout-extract.mjs](prelayout-extract.mjs)).

## Builds

| Build | Path | `version_name` | Source | `prelayout` in `stream/offscreen.js` |
|---|---|---|---|---|
| head | `~/snap/chromium/common/veil-accept/head/butter` | `0.1.0-alpha.22+veilaccept.head` | `547fa0a` (only `manifest.json` differs) | 0 lines |
| veil2 | `~/snap/chromium/common/veil-accept/veil2/butter` | `0.1.0-alpha.22+veilaccept.veil2` | `552b8db` (only `manifest.json` differs) | 4 lines |

## How u4 ran

Same as round 1:

- **Order:** 3 head and 3 veil2 runs, interleaved under one lab-2 `--perf` lock.
- **View:** u4 alone makes no scroll write, so the view stays at scrollTop 9,754.
- **Timing:** the frame sampler runs from completion to +16 s. u4 starts 500 ms after that, about 15 s after
  pre-layout's 1 s start delay.
- **Calls:** each call's block and string are the same in all 6 runs: block 429 (19 chars) for the first
  call, block 440 (24) for later call 1, block 450 (23) for later call 2, and block 460 for `scrollIntoView`.
- **Candidates:** 176–178 held blocks of 612 in the answer's last 30%, all veiled on veil2.

## Per call: `window.find`

- **ms:** how long the call took. It is synchronous.
- **Unveiled and rendered:** the first frame after the call where the block has no veil, opacity 0 or skipped
  flag, with the ms from the call's start. The block was never in view, and scrollTop stayed at 9,754
  through every call.

First calls (block 429, 19 chars):

| Run | Flags before | ms | Found / selected in block | Unveiled and rendered | Round 1 same build slot |
|---|---:|---:|---|---|---:|
| `head-ats12-u4-1` | 12 | 103.1 | true / true | frame 1 (111.0 ms) | 104.4 |
| `head-ats12-u4-2` | 12 | 99.8 | true / true | frame 1 (108.7 ms) | 97.8 |
| `head-ats12-u4-3` | 12 | 98.5 | true / true | frame 1 (106.3 ms) | 96.1 |
| `veil2-ats12-u4-1` | 15 | **841.9** | true / true | frame 2 (904.1 ms) | veil 948.4 |
| `veil2-ats12-u4-2` | 15 | **939.0** | true / true | frame 2 (1,041.2 ms) | veil 930.6 |
| `veil2-ats12-u4-3` | 15 | **812.0** | true / true | frame 2 (872.0 ms) | veil 933.3 |

Later calls:

| Run | Call | Block (chars) | Flags before | ms | Found / selected in block | Unveiled and rendered | Flags after 30 frames |
|---|---|---|---:|---:|---|---|---:|
| `head-ats12-u4-1` | 1 | 440 (24) | 12 | 86.9 | true / true | frame 1 (109.6 ms) | 8 |
| `head-ats12-u4-1` | 2 | 450 (23) | 12 | 84.3 | true / true | frame 1 (107.4 ms) | 0 |
| `head-ats12-u4-2` | 1 | 440 (24) | 12 | 83.1 | true / true | frame 1 (107.0 ms) | 8 |
| `head-ats12-u4-2` | 2 | 450 (23) | 12 | 84.7 | true / true | frame 1 (106.9 ms) | 0 |
| `head-ats12-u4-3` | 1 | 440 (24) | 12 | 83.6 | true / true | frame 1 (105.6 ms) | 8 |
| `head-ats12-u4-3` | 2 | 450 (23) | 12 | 83.3 | true / true | frame 1 (105.5 ms) | 0 |
| `veil2-ats12-u4-1` | 1 | 440 (24) | 15 | 83.5 | true / true | frame 1 (107.6 ms) | 8 |
| `veil2-ats12-u4-1` | 2 | 450 (23) | 15 | 85.5 | true / true | frame 1 (110.0 ms) | 0 |
| `veil2-ats12-u4-2` | 1 | 440 (24) | 15 | 84.6 | true / true | frame 1 (108.2 ms) | 8 |
| `veil2-ats12-u4-2` | 2 | 450 (23) | 15 | 85.7 | true / true | frame 1 (109.4 ms) | 0 |
| `veil2-ats12-u4-3` | 1 | 440 (24) | 15 | 82.2 | true / true | frame 1 (105.2 ms) | 8 |
| `veil2-ats12-u4-3` | 2 | 450 (23) | 15 | 87.1 | true / true | frame 1 (111.3 ms) | 0 |

On both builds, block 429 ended with flags 0 after 90 frames.

## Medians per build, with round 1

| Build | n | Median, all calls | First calls (median; range) | Later calls (median) | Later call 1 (range) | Later call 2 (range) |
|---|---:|---:|---|---:|---|---|
| head (round 2) | 9 | 84.7 ms | 99.8; 98.5–103.1 ms | 83.9 ms | 83.1–86.9 ms | 83.3–84.7 ms |
| **veil2 (round 2)** | 9 | **85.7 ms** | **841.9; 812.0–939.0 ms** | 85.1 ms | 82.2–84.6 ms | 85.5–87.1 ms |
| head (round 1) | 9 | 85.3 ms | 97.8; 96.1–104.4 ms | 84.3 ms | 82.2–84.4 ms | 83.0–87.9 ms |
| veil (round 1, no pre-layout) | 9 | 244.6 ms | 933.3; 930.6–948.4 ms | 163.1 ms | 241.0–250.9 ms | 82.2–85.2 ms |

How much slower veil is than head, at the median:

| Call | Round 1 veil | Round 2 veil2 |
|---|---:|---:|
| First | +835.5 ms | +742.1 ms |
| Later call 1 | +about 160 ms | 0 |
| Later call 2 | 0 | 0 |

## `scrollIntoView` and select-all

| Run | `scrollIntoView` block 460 | Select-all length (ms) | `innerText` length (ms) | Veiled before / after | Completion frame (ms) | rAF forced (ms) |
|---|---|---|---|---|---:|---:|
| `head-ats12-u4-1` | 9,754 → 72,532; in view, unveiled and rendered in frame 1 (58.4 ms) | 35,863 (115.0) | 6,319 (28.8) | 0 / 0 | 2,022.1 | n/a |
| `head-ats12-u4-2` | the same; frame 1 (65.6 ms) | 35,863 (113.6) | 6,319 (28.6) | 0 / 0 | 1,965.8 | n/a |
| `head-ats12-u4-3` | the same; frame 1 (57.1 ms) | 35,863 (112.3) | 6,319 (29.4) | 0 / 0 | 1,946.3 | n/a |
| `veil2-ats12-u4-1` | the same; frame 1 (56.9 ms) | 35,863 (116.5) | 6,319 (31.3) | 504 / 504 | 681.8 | 7.0 |
| `veil2-ats12-u4-2` | the same; frame 1 (64.3 ms) | 35,863 (113.8) | 6,319 (29.8) | 504 / 504 | 679.0 | 6.6 |
| `veil2-ats12-u4-3` | the same; frame 1 (56.9 ms) | 35,863 (113.6) | 6,319 (29.2) | 502 / 502 | 754.2 | 6.2 |

- **`scrollIntoView`:** the same on both builds and the same as round 1. The block was in view in the first
  frame. After 90 frames it was 679.3 px above the view, at a constant scrollTop.
- **Select-all:** it unveiled no block. Its duration is now equal: veil2 median 113.8 ms, head 113.6 ms
  (round 1: 212.4 vs 117.6 ms).

## What pre-layout shows in these runs

These runs have no trace. The data comes from the long-animation-frame (LoAF) record and Butter's marks, which
both run from completion to about +7.1 s, and from the ux frame sampler, which runs from completion to +16 s.

- **Butter's scripts do not appear in the LoAF attribution.** "butter files" is `{}` in all 6 runs, as in every
  round 1 stage. So this data cannot show pre-layout's idle callbacks or count them, and their number, total
  and longest duration are **not established**.
- **No long frame after +1 s carries forced layout.** From +1 s to the end of the LoAF window, veil2 has these
  frames of 50 ms or more:

  | Run | Frame at (ms) | Duration (ms) | Blocking (ms) | Scripts (attributed `other`) | Forced layout |
  |---|---:|---:|---:|---|---:|
  | all 3 | +1,730 to +1,832 | 64.0–76.5 | 6.5–10.7 | a user callback of about 45 ms | 0 |
  | `veil2-ats12-u4-1` | +6,108 | 74.9 | 19.6 | 43.2 ms user callback, 25.4 ms event listener | 0 |
  | `veil2-ats12-u4-1` | +6,691 | 52.0 | 1.9 | 45.8 ms user callback | 0 |

  Head has the +1.7 s frame too: 70.0–122.3 ms, with a 54.8–60.6 ms user callback. Pre-layout's reads force
  layout, so a long frame that held one of its chunks would show forced layout above 0. None does.
- **Blocking after completion is no higher than head's.** From completion to the end of the LoAF window, veil2
  blocks 18.4–33.8 ms and head 29.1–43.7 ms. Over the whole run, veil2 blocks 1,750.9–1,833.4 ms and head
  6,619.5–9,892.9 ms.
- **Nothing on the page changed.** Butter's marks are sampled about every 250 ms from completion to about
  +6.5 s. On veil2:
  - veiled and held: 567, 567 and 565 blocks, the same in every sample (run 3 had 586 veiled just before
    completion);
  - seen: 25 blocks;
  - the last turn's height: constant;
  - leaks: 0.

  The ux sampler, from completion to +16 s, shows scrollTop 9,754 in every frame and scrollHeight constant
  from +0.9 s. `veil-none-rendered` drew no frame with a leak in 1,007–1,015 sampled frames per run.
- **The completion frame is unchanged by pre-layout.** It is 679.0–754.2 ms, with rAF forced 6.2–7.0 ms.
  Round 1's stage D veil had 626.5–677.5 ms.
- **Did pre-layout run?** These runs do not show it directly. They show two of its expected effects: later
  call 1 and select-all are now equal to head. They do not show the main expected effect, a first call near
  head's. Why the first call still costs about 740 ms more than head's is **not established**. A trace would
  split it, as stage D3's did:
  - `TRACE_AT` around u4 would show the `Layout` inside the first call and how many objects it lays out (D3:
    36,222 on veil against 2,067 on head);
  - a trace from completion to +6 s would show whether `FireIdleCallback` events from the content script ran,
    and when the math fonts were requested.

## Against the spec

| Rule | Measured | Result |
|---|---|---|
| At least 5 `window.find` calls per build over at least 3 runs, first and later calls reported apart | 9 per build over 3 runs: 3 first calls and 6 later calls | Done |
| veil2's median `window.find` is within twice head's median or within head's + 150 ms | veil2 85.7 ms; head 84.7 ms; bounds 169.4 and 234.7 ms | **PASS** |
| (not a rule, reported) The same bounds on first calls alone | veil2 841.9 ms; head 99.8 ms; bounds 199.6 and 249.8 ms | outside both, 8.4× head |
| Select-all gives the same text length on both builds | 35,863 in all 6 runs | PASS |
| Every veil2 run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |
| The searched blocks are still held, veiled and skipped before each call | flags 15 before all 9 veil2 calls | PASS |

The judge's line:

```text
{"rule":{"headMedian":84.7,"veilMedian":85.7,"twiceHead":169.4,"headPlus150":234.7,"within":true,"selectAllSameLength":true}}
judge exit=0
```

No harness run printed a FAIL line.

## Budget

- **Runs and time:** 6 harness runs, 20 min 41 s from lock to release (00:13:50Z to 00:34:31Z).
- **Lock:** lab 2 with the perf lock, taken at once with no wait.
- **Release:** `lab-restore` restarted the browser without extensions (`"ok":true`). After the release, all
  locks were free.
