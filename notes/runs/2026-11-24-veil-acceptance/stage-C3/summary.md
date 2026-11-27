# Veil acceptance, stage C3: `ats12` blank frames and view shift after a jump to the end (u1 alone) (#177), 2026-11-24

**Question.** On `ats12` with `PHASES=stream UX=u1`, does the veil (`e5f480e`) meet spec #170's rules for
blank frames and view shift after a jump to the end (u1), against `main` before the change (`547fa0a`,
"head") in the same lock sequence, with u1's full 16 s window? Stage C measured u1's view shift only up to
its u2 write: 1.44–1.48 s on veil and 0.16–0.28 s on head.

**Answer.** Yes on all three rules.

- **Blank frames:** 2 frames on both builds in every run, so the rule (no longer run of frames than head's)
  passes. In ms the veil's are no longer either: 92.3–122.5 ms against head's 108.5–156.7 ms.
- **View shift:** 0 jumps over 4 px after drawing, on both builds in every run, from the settle frame to
  +16 s after completion (about 15.4–15.5 s on veil, 14.2–14.3 s on head). Largest move of the anchor after
  drawing: 0.9 px on veil, 0.5 px on head.
- **Verdicts:** every veil run passes all 13, `veil-none-rendered` and `veil-effective` included. No FAIL line
  in any run.

Exact commands are in [commands.md](commands.md); the per-run lines are in the `*.log` files, and the per-run
frame and long-animation-frame cuts are in [u1.jsonl](u1.jsonl).

## How u1 was run

With `UX=u1` alone, the probe writes `scrollTop = scrollHeight` once, in the first task after the first frame
without `in_progress` ("completion"). On head that task waits for ChatGPT's ~1.9 s completion frame, so the
write comes 1632–1674 ms after completion; on veil 387–422 ms after. scrollTop went from 9,754 to
94,564–94,726. The probe settles at the first frame at least 100 ms after the write and follows the block
under the view's centre in that frame to +16 s. No other write follows, so that is u1's whole window.

- **On veil** the settle frame is the first clear frame after the blank ones, and the anchor is block 606 in
  every run; the centre block at +16 s is still 606.
- **On head** the settle frame is the second blank frame, which comes 109.5–147.5 ms after the write (on
  veil 71.9–98.2 ms, just under the 100 ms settle rule), and the anchor is the end block 610 (609 in `head-ats12-u1-2`), still skipped then. In the next frame ChatGPT
  shrinks the page under the view at the end (scrollTop 94,726 → 93,545, scrollHeight 95,638 → 94,457), the
  centre block becomes 606, and the anchor moves 162.1 px (188.1 px) at that frame's start. After drawing it
  does not move. The study and stage C saw the same frame-start jump on head (188.6 and 162.1 px).

## Per run

Columns:

- **Blank frames:** the longest run of consecutive frames after the write with a tested point on a veiled
  (1), opacity 0 (2) or skipped (4) block, in frames and in ms from its first frame to the frame after it.
  On veil every such frame had all three flags (7), on 4–5 of the 7 points; on head only "skipped" (4), on
  4–5 points. It was the only such run: 2 such frames in the whole window on every run.
- **Write → clear:** ms from the write to the first frame with no such block.
- **Window:** from the settle frame to +16 s after completion, with the number of frames sampled after
  drawing in it.
- **Jumps > 4 px after drawing:** the probe's `(i) ... after each frame's rendering update` count on the
  anchor over that window, with its largest move. The frame-start count is in brackets.

| Run | Completion frame (ms) | u1 write (ms after completion) | Blank frames, longest run | Write → clear (ms) | Settle (ms after completion), anchor | Window (ms, frames) | Jumps > 4 px after drawing [frame start] | Centre block at +16 s | Verdicts |
|---|---:|---:|---|---:|---|---|---|---:|---|
| `head-ats12-u1-1` | 1897.1 | 1632.3 | 2 (156.7 ms) | 208.5 | 1741.8, block 610 | 14,258, 819 | 0, largest move 0.5 px [1: +162.1] | 606 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u1-1` | 692.1 | 414.4 | 2 (122.5 ms) | 159.8 | 574.2, block 606 | 15,426, 891 | 0, largest move 0.9 px [0] | 606 | 13 PASS, 0 FAIL |
| `head-ats12-u1-2` | 1946.2 | 1674.3 | 2 (108.5 ms) | 198.6 | 1821.8, block 609 | 14,178, 828 | 0, largest move 0.5 px [1: +188.1] | 606 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u1-2` | 674.1 | 422.1 | 2 (105.7 ms) | 144.1 | 566.2, block 606 | 15,434, 892 | 0, largest move 0.9 px [0] | 606 | 13 PASS, 0 FAIL |
| `head-ats12-u1-3` | 1965.6 | 1652.2 | 2 (134.7 ms) | 186.5 | 1789.5, block 610 | 14,211, 818 | 0, largest move 0.5 px [1: +162.1] | 606 | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u1-3` | 624.8 | 387.2 | 2 (92.3 ms) | 128.8 | 516.0, block 606 | 15,484, 894 | 0, largest move 0.9 px [0] | 606 | 13 PASS, 0 FAIL |

- **Every run exits 0.** Verdicts on every run: `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
  `seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
  `veil-none-rendered`, `no-escape` and `server-unchanged`, plus `veil-effective` on the veil runs.
- **`veil-effective` on veil:** 586 blocks veiled before completion in each run. ChatGPT's rAF callback in
  the completion frame forced 6.7, 8.1 and 6.4 ms of style and layout.
- **`veil-none-rendered` on both builds:** 0 in 115–126 once-a-second samples, 0 after the window, and 0 at
  the frame's start and 0 after drawing in every probed frame (904–907 per head run, 1028–1044 per veil run).
- **`OPTS put back`:** "same as before true" on every run.
- **View at +16 s:** fromEnd 0 and the answer's last block (611) in view on every run of both builds.

## Per build: worst case and median

| Build | Blank frames: worst / median | Blank run ms: worst / median (range) | Write → clear ms: worst / median | Jumps > 4 px after drawing: worst | Completion frame median (ms) |
|---|---|---|---|---:|---:|
| head | 2 / 2 | 156.7 / 134.7 (108.5–156.7) | 208.5 / 198.6 | 0 | 1946.2 |
| veil | 2 / 2 | 122.5 / 105.7 (92.3–122.5) | 159.8 / 144.1 | 0 | 674.1 |

## Against the spec

| Rule (#170 Acceptance runs, `u1` part) | Measured | Result |
|---|---|---|
| The veil's longest run of frames on a veiled or not-rendered block is no longer than head's (study: 2 frames at the end on both) | veil worst 2, head worst 2 (2 in every run) | PASS |
| 0 jumps over 4 px after drawing on veil, as on head | veil 0 in 3 of 3 (anchor 606, settle to +16 s, 891–894 frames), head 0 in 3 of 3 (anchor 609/610, 818–828 frames); largest move after drawing 0.9 px on veil, 0.5 px on head | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## Notes

- **Closes stage C's gap:** stage C's u1 view-shift PASS held only up to the u2 write. Here the window is the
  full 16 s, and the result is the same: 0 jumps after drawing on both builds.
- **Compared with stage C:** u1 blank frames there were 2 on both builds, veil 94.3–115.6 ms and head
  110.7–159.9 ms; here veil 92.3–122.5 ms and head 108.5–156.7 ms. Unlike u2 (stages C and C2), the veil's
  blank frames after u1 are not longer than head's.
- **Head's frame-start jump** (+162.1 / +188.1 px, 1 per run) is the anchor picked while the end blocks were
  still skipped, moving when ChatGPT shrinks the page in the next frame; it is not in the after-drawing
  sample, which the rule counts. The veil's second blank frame comes under 100 ms after the write, so it
  settles on the first clear frame and has none. The difference is when the settle frame falls, not a move
  the user sees.
- **Completion frames match stages A–C2:** veil 624.8–692.1 ms, head 1897.1–1965.6 ms.
- **Budget:** 6 harness runs, 20 min 21 s from lock to release. The lock on lab 2 was free at once; another
  stage (`veil-accept-E`) took it right after the release.
