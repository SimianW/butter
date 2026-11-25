# Veil acceptance, stage E: wheel through the answer with `VEILPROBE=1`, and an opened chat (#177), 2026-11-25

**Question.** On `ats12` with all phases and `VEILPROBE=1`, does the veil (`e5f480e`) put a veiled block
under a tested point in any wheel frame, and does every run pass all verdicts? And, not gating: on an
opened (not streamed) long chat, how much does the page block in its first 10 s with the veil against
`main` before the change (`547fa0a`, "head"), and is any block at opacity 0?

**Answer.** Yes on the gate: two veil runs under one `--perf` lock on lab 2. 0 frames during the 120
wheel steps had a veiled or opacity-0 block under a tested point. Each run passes all 14 verdicts,
including `wheel-no-jump`, `veil-none-rendered` and `veil-effective`. The probe's only hits are 2
consecutive frames per run at the scroll to the chat's end that starts the wheel phase, before the
first wheel event. The study saw the same 2 frames there (Q4, run 7), and the named limit "blank
frames after a jump" covers them. On the opened chat, 0 blocks were at opacity 0 and 0 were veiled
on both builds. In the first 10 s the veil build blocked 1499.7 ms, against 1717.8 ms on head (one
run each). Exact commands are in [commands.md](commands.md); the per-run lines are in the `*.log`
files.

## Wheel phase, per run

The probe (`lab/harness/stream-veil-probe.mjs`) hit-tests 7 points down the text column on every
animation frame, from the scroll to the end that starts the wheel phase until the phase ends. Then it
writes scrollTop to the streamed answer's middle and probes 30 more frames. Two different counts come
out of it:

- **Veiled or opacity-0 block under a point:** a block with `data-butter-veil`, or one that computes
  opacity 0. This count is sampled **at the frame's start** (in the rAF) only.
- **Rendered block at opacity 0 under a point:** the `veil-none-rendered` leak, meaning a block whose
  content renders while it is at opacity 0. This count is sampled at the frame's start and again
  **after drawing** (in a task posted from that rAF).

The probe has no after-drawing sample of veiled blocks as such.

| Run | Frames sampled (wheel phase) | Veiled / op-0 frames, at frame start: **on wheel steps** | the same, at the jump to the end (`end`) | Longest consecutive run | Rendered op-0 frames: start / after drawing | Mid-write probe: frames sampled, veiled / op-0 frames, rendered op-0 start / drawn | Verdicts |
|---|---:|---:|---:|---:|---|---|---|
| `veil-ats12-all-1` | 1255 (6098 point hits on answer blocks) | **0** of 120 steps (60 up, 60 down) | 2 (frames 2–3, 18 ms apart; 4 of 7 points veiled and op-0 each) | 2 | 0 / 0 | 30, 0, 0 / 0 (46457 → 28306) | 14 PASS, 0 FAIL |
| `veil-ats12-all-2` | 1253 (6072) | **0** of 120 steps | 2 (frames 2–3, 22 ms apart; 4 of 7 each) | 2 | 0 / 0 | 30, 0, 0 / 0 (46457 → 28306) | 14 PASS, 0 FAIL |

The mid write met no veiled block. Every block had been in view while wheeling, so this jump does not
test a never-rendered region, as in the study.

Other numbers from the same runs (not gated in this stage):

| Run | Completion frame (ms) | rAF callback forced (ms) | Blocking over the window, LoAF (ms) | Frames ≥ 500 / ≥ 1000 ms | Blocks veiled just before completion | Blocks veiled after the window | View shift over 4 px, wheel up / down |
|---|---:|---:|---:|---|---:|---:|---|
| `veil-ats12-all-1` | 666.4 | 7.0 | 1727.8 | 1 / 0 | 586 | 567 | 13/60 (−510 to 1261 px) / 0/59 |
| `veil-ats12-all-2` | 652.8 | 6.8 | 1977.5 | 1 / 0 | 586 | 567 | 13/60 (−510 to 1261 px) / 0/59 |

The up-shifts while wheeling up through never-rendered blocks are the placeholder behaviour (#131) that
head also shows. The study measured 9/60 on pv and 9–10/60 on head's 11-23 runs. This stage has no head
all-phases run, so it gives no same-day head count. `wheel-no-jump` (scrollTop falling by more than a
viewport while wheeling down) passes in both runs.

Verdicts on both runs: `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`, `seen-marks`,
`throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`, `wheel-no-jump`,
`veil-none-rendered`, `veil-effective`, `no-escape`, `server-unchanged`: all PASS. The two veil lines:

```text
veil-ats12-all-1: REPORT veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 0 of 126 samples (most 0); 0 after the window; veil probe wheel: 0 at the frame's start, 0 after drawing (of 1255 frames); veil probe mid: 0 at the frame's start, 0 after drawing (of 30 frames)
veil-ats12-all-1: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 7 ms of style and layout (frame 666.4 ms at 105012.9 ms)
veil-ats12-all-2: REPORT veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 0 of 126 samples (most 0); 0 after the window; veil probe wheel: 0 at the frame's start, 0 after drawing (of 1253 frames); veil probe mid: 0 at the frame's start, 0 after drawing (of 30 frames)
veil-ats12-all-2: REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.8 ms of style and layout (frame 652.8 ms at 105049.6 ms)
```

`OPTS put back: … same as before true` on both runs.

## Against the spec

| Rule (#170 Acceptance runs; #177 stage E) | Measured | Result |
|---|---|---|
| Wheel through the answer with `VEILPROBE=1`, all phases, at least 2 veil runs: 0 wheel frames on a veiled block | 2 veil runs, 2508 wheel-phase frames sampled; 0 frames during the 240 wheel steps had a veiled or opacity-0 block under a tested point. The 2 frames per run at the jump to the end come before the first wheel event (as in the study; named limit "blank frames after a jump"). 0 rendered blocks at opacity 0 at the frame's start or after drawing | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 2 of 2: 14 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## Opened chat (one pair, does not gate)

This pair repeats the study's L1 run (`notes/runs/2026-11-24-stream-ux-loaded/`, `stream-loaded-probe.mjs`,
lab 2, perf lock) as it ran there: open `math12` fresh at its end with no input, and measure for 40 s
from the first turn. The typing phase was skipped (`TYPE_AT=0`). The study's figure (2101 ms against
1137 ms in the first 10 s) came from that run, not from `stream-hydrate`. Both builds are new installs
with no stored layout record and the rail off (the study's builds had the rail on).

| | head (`547fa0a`) | veil (`e5f480e`) | study: head / pvh |
|---|---:|---:|---|
| First turn after navigation (ms) | 4256.7 | 4340.2 | 4682.2 / – |
| Navigation to first turn: LoAF, blocking (ms), longest (ms) | 14, 2165.6, 910.4 | 15, 2310.3, 913.1 | 13, 2591.4, 963 / 16, 2308.8, 1024.3 |
| **First 10 s after the first turn: LoAF, blocking (ms), longest (ms)** | 12, **1717.8**, 1050.4 (at +609 ms) | 12, **1499.7**, 637.2 (at +1177 ms) | 8, 1137.1, 665.4 / 11, 2100.7, 1080.5 |
| 10 s to 40 s: LoAF | 0 | 0 | 0 / 0 |
| Script time in the 40 s by source (ms, forced) | chatgpt 1302.7 (853.8), other 369.8 (314.7); none from Butter | chatgpt 935.8 (502.7), other 594.7 (552.2); none from Butter | – |
| **Answer blocks at opacity 0** (computed; 21 samples and after the window) | **0** max, 0 after | **0** max, 0 after | not measured |
| `data-butter-veil` / `-unrendered` / `-measure` (max) | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| `data-butter-seen` (max / last) | 445 / 445 | 445 / 401 | 445 / 401 (head) |
| Page growth with no input | +3015 px once | +2012, +34 px | +2012, +34 (head) / +3065 |
| View stays at the end | yes (0 → 0 px from the end) | yes | yes / yes |

**As measured:** no block is held in an opened chat, so none is veiled or at opacity 0 on either build.
In the first 10 s the veil build blocked 218 ms less than head in this pair, where the study's pvh had
blocked 964 ms more. With one run per build, both differences sit inside the run-to-run spread. This
head run alone is 581 ms above the study's head run, with no Butter script time in either.

## Notes for the final write-up

- The probe's "veiled or op-0" frame count is taken at the frame's start only. Its after-drawing
  sample checks only for a *rendered* block at opacity 0, the `veil-none-rendered` leak, which was 0.
  The brief's "start-of-frame and after-drawing samples" are reported in those terms.
- `stream-loaded-probe.mjs` gained the computed opacity-0 count used above (see commands.md); it reads
  computed style every 2 s, which the study's L1 did not.
- 4 harness runs, 9 min 40 s under the lock; the acquire waited 19 min for stage C3.
