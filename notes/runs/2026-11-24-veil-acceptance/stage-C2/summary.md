# Veil acceptance, stage C2: `ats12` blank frames and view shift after a jump into held blocks (u2 alone) (#177), 2026-11-24

**Question.** On `ats12` with `PHASES=stream UX=u2 U2_BLOCK=306`, does the veil (`e5f480e`) meet spec #170's
rules for blank frames and view shift after a jump into held blocks in the middle (u2), against `main` before
the change (`547fa0a`, "head") in the same lock sequence? And are stage C's longer veil blank frames after u2
confirmed with u2 alone?

**Answer.** Yes on all three rules; stage C's finding is confirmed.

- **Blank frames:** 3 frames on both builds in every run, so the rule (no longer run of frames than head's)
  passes.
- **View shift:** 0 jumps over 4 px after drawing on a block in the view (block 320 or 322), on both builds
  in every run. Largest move of that block: 0 px.
- **Verdicts:** every veil run passes all 13, `veil-none-rendered` and `veil-effective` included. No FAIL line
  in any run.
- **Confirmed, not a rule:** the veil's 3 blank frames last longer: 226.9–236.9 ms, against head's
  122.2–157.5 ms. From the write to the first frame with no blank block takes 246.8–254.4 ms on veil and
  138.7–182.6 ms on head. The extra ~90–100 ms sits in one frame interval, the second of the three (see
  "Where the time goes").

Exact commands are in [commands.md](commands.md); the per-run lines are in the `*.log` files, and the per-run
frame and long-animation-frame cuts are in [u2.jsonl](u2.jsonl).

## How u2 was run

With `UX=u2` alone, the probe writes scrollTop once, 2 s after completion. The write puts block 306 of 612
40 px above the view's centre (`U2_BLOCK=306`, the study's block). On every run the block was held: flags 15
(veil, opacity 0, skipped, held) on veil and 12 (skipped, held) on head, with 20 of the 21 blocks around it
held. scrollTop went from 9,754 to 50,863 in every run. The probe settles at the first frame at least 100 ms
after the write and follows the block under the view's centre in that frame. Unlike stage C, that block is in
the view after the u2 write: block 320 in 5 runs and 322 in `head-ats12-u2-1`.

## Per run

Columns:

- **Blank frames:** the longest run of consecutive frames after the write with a tested point on a veiled
  (1), opacity 0 (2) or skipped (4) block, in frames and in ms from its first frame to the frame after it.
  On veil every such frame had all three flags (7); on head only "skipped" (4). It was also the only such
  run: 3 such frames in the whole window on every run.
- **Write → clear:** ms from the write to the first frame with no such block.
- **Frame intervals:** ms between the frames of the blank run and the clear frame (frame 1 → 2, 2 → 3,
  3 → clear).
- **First two frames, render part:** the render part (style, layout, paint) of the first two
  long-animation-frame entries (≥ 50 ms) that end after the write. "<50" means the frame was not a
  long-animation-frame entry, so its whole duration was under 50 ms.
- **Jumps > 4 px after drawing:** the probe's `(i) ... after each frame's rendering update` count on the
  anchor, from the settle frame to +16 s. The frame-start count is in brackets.

| Run | Completion frame (ms) | u2 write (ms after completion) | Blank frames, longest run | Write → clear (ms) | Frame intervals (ms) | First two frames, render part (ms) | Settle (ms after write), anchor | Jumps > 4 px after drawing [frame start] | Verdicts |
|---|---:|---:|---|---:|---|---|---|---|---|
| `head-ats12-u2-1` | 1873.5 | 2030.6 | 3 (122.2 ms) | 138.7 | 37.2, 43.7, 41.3 | 1.7 (the write's own frame, 57.0 ms), then <50 | 138.7, block 322 | 0 [0], largest move 0 px | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u2-1` | 725.7 | 2017.0 | 3 (230.2 ms) | 246.8 | 32.2, **144.5**, 53.5 | **67.6** (83.5 ms), 25.4 (94.6 ms) | 193.3, block 320 | 0 [0], largest move 0 px | 13 PASS, 0 FAIL |
| `head-ats12-u2-2` | 2357.6 | 2039.8 | 3 (157.5 ms) | 182.6 | 45.1, 51.6, 60.8 | 1.7 (the write's own frame, 68.7 ms), then <50 until 16.4 (54.3 ms, at +154 ms) | 121.8, block 320 | 0 [0], largest move 0 px | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u2-2` | 638.2 | 2050.5 | 3 (226.9 ms) | 249.3 | 48.2, **126.7**, 52.0 | **65.5** (93.3 ms), 25.0 (81.7 ms) | 197.3, block 320 | 0 [0], largest move 0 px | 13 PASS, 0 FAIL |
| `head-ats12-u2-3` | 1997.1 | 2036.7 | 3 (134.3 ms) | 166.3 | 40.7, 46.6, 47.0 | 2.0 (the write's own frame, 62.1 ms), then <50 | 119.3, block 320 | 0 [0], largest move 0 px | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-u2-3` | 637.1 | 2044.8 | 3 (236.9 ms) | 254.4 | 36.9, **133.0**, 67.0 | **67.8** (85.6 ms), 25.9 (82.3 ms) | 187.4, block 320 | 0 [0], largest move 0 px | 13 PASS, 0 FAIL |

- **Every run exits 0.** Verdicts on every run: `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
  `seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
  `veil-none-rendered`, `no-escape` and `server-unchanged`, plus `veil-effective` on the veil runs.
- **`veil-effective` on veil:** 586, 584 and 586 blocks veiled before completion. ChatGPT's rAF callback in
  the completion frame forced 10, 6.7 and 6.3 ms of style and layout.
- **`veil-none-rendered`:** in the probe's own count, no tested point was on a block rendered at opacity 0,
  at the frame's start or after drawing, in any sampled frame (815–1015 per run).
- **`OPTS put back`:** "same as before true" on every run.
- **Head's frame of the write:** on head, the write's own task sits in a 57–69 ms frame (script part
  29–39 ms; a rAF callback with no script URL, labelled `other` as the probe's injected code is, forced
  14–17 ms of layout). On veil the write's frame was under 50 ms.

## Per build: worst case and median

| Build | Blank frames: worst / median | Blank run ms: worst / median (range) | Write → clear ms: worst / median | Jumps > 4 px after drawing: worst | Completion frame median (ms) |
|---|---|---|---|---:|---:|
| head | 3 / 3 | 157.5 / 134.3 (122.2–157.5) | 182.6 / 166.3 | 0 | 1997.1 |
| veil | 3 / 3 | 236.9 / 230.2 (226.9–236.9) | 254.4 / 249.3 | 0 | 638.2 |

## Against the spec

| Rule (#170 Acceptance runs, `u2` part) | Measured | Result |
|---|---|---|
| The veil's longest run of frames on a veiled or not-rendered block is no longer than head's (study: 3 on head in the middle) | veil worst 3, head worst 3 (3 in every run) | PASS (by frames; the veil's 3 frames last 226.9–236.9 ms against head's 122.2–157.5 ms) |
| 0 jumps over 4 px after drawing on veil, as on head | veil 0 in 3 of 3, head 0 in 3 of 3, on the block in the view's centre at the settle frame (320, or 322 in one head run), from +119–197 ms to +16 s after the write; largest move 0 px | PASS |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## Where the time goes: the veil's longer blank frames

Stage C's finding holds with u2 alone. Both builds show 3 blank frames with the same pattern of points (6
points blank, then 6, then 3: `777777-`, `777777-`, `000777-` on veil; the same with 4 on head). The frame
after them is clear. The difference is in the timing of those frames:

- **Frame 1 is the same on both builds.** It comes 16.5–32 ms after the write, and frame 1 → 2 takes
  32–48 ms on veil and 37–45 ms on head.
- **Frame 2 → 3 is the gap.** It takes 126.7–144.5 ms on veil against 43.7–51.6 ms on head. Frame 3 → clear
  is about the same again: 52–67 ms on veil, 41–61 ms on head.
- **Frame 2's rendering update is long on veil.** Frame 2's rAF sample falls in a long-animation frame that
  starts 43–50 ms after the write and lasts 83.5–93.3 ms. Its render part (style, layout, paint, after the
  rAF callbacks) is 65.5–67.8 ms. Its script part is 5.6–20.1 ms, it forces no layout, its only script of
  at least 5 ms is a rAF callback labelled `other` (7.5–11.5 ms), most likely the probe's own sampler, and it blocks for 27.7–34.8 ms. On head the matching
  frame is under 50 ms in total.
- **The next frame adds 45–58 ms before its rAF.** On veil, frame 3's rAF sample comes in a second long
  frame (82–95 ms) right after that frame's script part (45.0–58.3 ms). The scripts the entry names come to
  about 9–14 ms, all labelled `other`: a rAF callback and a message task, most likely the probe's own. The rest of that script part is not attributed: either
  scripts under 5 ms each, which the long-animation-frame API does not list, or work outside scripts. These
  captures do not separate the two. That frame's render part is 25.0–25.9 ms.
- **The page shrinks at the same pace on both builds.** scrollHeight drops by 2,040 px between frames 2
  and 3 and by 1,251 px into the clear frame, at a constant scrollTop of 50,863, on both builds. The centre
  block goes 306 → 320 → 322 in the same frames.

So the extra ~90–100 ms is one rendering update of about 66 ms on the second frame after the write, plus
about 45–58 ms of unattributed main-thread work before the next frame's callbacks. Both happen while the
newly visible blocks stop being skipped. That the veil's extra cost is painting and unveiling the veiled
blocks (opacity 0 → 1, `data-butter-veil` removed) is likely but not established: the long-animation-frame
entries give only the phase split, not which elements or style rules cost the time. A Chrome trace of one
veil u2 run (`TRACE=1`) would show the style, layout and paint breakdown and any small callbacks in that
window.

## Notes

- **Compared with the study:** the study's head u2 run had 3 blank frames over 96.1 ms and 0 jumps, settling
  on 322. The pvh prototype had 3 frames over 201.1 ms. Here head's 3 frames lasted 122.2–157.5 ms and the
  veil's 226.9–236.9 ms, with 0 jumps on both builds.
- **Centre block at +16 s:** 322 on every run. The anchor was block 320 in 5 runs and did not move (0 px).
  The centre point moving from 320 to 322 in the frame after settling is the page shrinking around them, not
  a move of the anchor. fromEnd at +16 s: 38,906–39,068 on both builds.
- **Completion frames match stages A–C:** veil 637.1–725.7 ms, head 1873.5–2357.6 ms.
- **Budget:** 6 harness runs, 20 min 16 s from lock to release. The lock on lab 2 was free at once.
