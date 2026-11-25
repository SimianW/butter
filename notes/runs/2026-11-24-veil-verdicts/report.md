# Veil verdicts: check runs (#173), 2026-11-24

**Question.** Do the live replay script's two new verdicts, `veil-none-rendered` and
`veil-effective` (spec #170, Seam 3), judge the three builds the way the stream veil study predicts:
`main` passes and is not judged for effectiveness, the first prototype (`pv0`) fails on the blocks it
leaves at opacity 0, the leak-fixed prototype (`pv`) passes both? And do the existing verdicts stay
as they were?

**Answer.** Yes. One run per build on `ats12` (lab 2, one lock with `--perf`, `VEILPROBE=1`, all
phases), plus one `pv` run with `UX=u1,u2` for the UX probe's new counts:

| Run | `veil-none-rendered` | `veil-effective` | Other verdicts | Exit |
|---|---|---|---|---:|
| `main-ats12` | PASS: 0 of 115 samples, 0 after the window, 0/0 of 1247 wheel frames, 0/0 of 30 mid frames | not judged: no block veiled before completion (rAF forced 1241.1 ms) | 12 PASS | 0 |
| `pv0-ats12` | **FAIL**: 29 of 126 samples (most 19), 19 after the window; 0 in probed frames | PASS: 586 veiled, 7.5 ms forced | 12 PASS | 1 |
| `pv-ats12` | PASS: 0 of 126 samples, 0 after, 0/0 of 1193 wheel frames, 0/0 of 30 mid frames | PASS: 586 veiled, 6.1 ms forced | 12 PASS | 0 |
| `pv-ats12-ux` | PASS: 0 of 125 samples, 0 after, UX 0/0 of 1018 frames | PASS: 586 veiled, 6.7 ms forced | 11 PASS (`PHASES=stream`: no wheel phase) | 0 |

"x/y of n frames": frames with a rendered block at opacity 0 under a tested point at the frame's
start / after drawing.

## What the verdicts measure

Both come from computed styles, never from the veil's attribute (`lab/harness/stream-veil-verdicts.mjs`).

- A block **leaks** when it computes opacity `"0"` while it is not `content-visibility: auto`, or
  while it is and its content is rendered. "Rendered" is the block's last
  `contentvisibilityautostatechange` (`skipped: false`), tracked by a listener installed before
  ChatGPT's scripts; before any event, its first child's `checkVisibility({ contentVisibilityAuto: true })`.
  The event comes first because Chromium marks a block relevant during one frame's layout and lays
  its content out in the next; a child-visibility read between the two says "rendered" for a block
  that was drawn skipped, while the event is where Butter unveils.
- `veil-none-rendered` counts leaks in the last turn at every stream-window sample (once a second,
  every tick for 6 s after completion), in the whole page after the window, and, with `VEILPROBE=1`
  or `UX`, under the 7 tested points of every probed frame, at its start (rAF) and after drawing (a
  task posted from that rAF). Any leak, or a part that sampled nothing, fails it.
- `veil-effective` is judged only when the last sample before the completion frame had veiled
  blocks, and fails when ChatGPT's `FrameRequestCallback` scripts in the completion frame force
  100 ms or more of style and layout. Without long-animation-frame data it fails; with data but no
  long frame at completion it passes (a frame under 50 ms cannot force 100 ms).

## Findings

- **The control still shows the freeze**: `main`'s completion frame is 1976 ms, ChatGPT's rAF
  callback 1295.4 ms with 1241.1 ms forced. ChatGPT's bundle has a new hash since the study
  (`299268.ee6ad9ecda.js`, was `299268.5b3cdf27e2.js`); the walk still stops at opacity `"0"`
  (7.5, 6.1 and 6.7 ms forced on the veiled builds, completion frames 738.8, 639.8 and 633 ms).
- **`pv0`'s 19 leaked blocks were never under a tested point** while the wheel phase went up
  through the whole answer and back (1251 frames, 6074 point hits on answer blocks), nor after the
  scrollTop write to the answer's middle. They count only in the samples and after the window. Their
  layout was not looked at here; finding out what they are belongs to the veil's ticket (#174). One
  untested guess: they are blocks with no height of their own, which no point can land on.
- **Skipped veiled blocks under a point do not count.** In every veiled run the wheel phase's first
  2 frames (`end`) had veiled blocks at opacity 0 under 4 points each (`veiled/op0 hits 8/8`), as in
  the study; all were skipped, so neither sample counted them. With `UX=u1,u2` the same held for 5
  frames after the jumps (flags `7`: veil, opacity 0, skipped), at the frame's start and after drawing.
- **Rail off on new installs.** Since the rail and Bookmarks became opt-in, a fresh `main` copy
  never shows `chatgpt-butter-nav[data-on]`, and the replay script stops with a setup error (run 1).
  The acceptance runs need `OPTS={"rail":true,"bookmark":true}`, as used here.

## Not covered

- One run per build: the runs check the verdicts' logic, not the veil's numbers (#177 repeats those).
- The leak count in a sample covers the last turn only; the veil applies only to the streamed
  answer, and the whole page is checked once after the window.

Commands, builds and timings: [commands.md](commands.md). Raw logs and per-run JSON stay local.
