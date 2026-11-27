# Veil acceptance round 2, stage C2: `ats12` blank frames and view shift after a jump into held blocks, veil with pre-layout (#177), 2026-11-26

**Question.** The setup is `ats12` with `PHASES=stream UX=u2 U2_BLOCK=306`. It compares the veil with
pre-layout (veil2, `552b8db`) against `main` before the veil (`547fa0a`, "head") in the same lock sequence.
Does veil2 meet spec #170's rules for blank frames and view shift after a jump into held blocks in the middle
(u2)? Pre-layout was built to remove the reveal gap of round 1 ([stage C2](../../stage-C2/summary.md)): veil
227–237 ms against head 122–158 ms. Does it?

**Answer.** All three rules pass. The ms gap to head is not closed at all, either at the standard write (+2 s)
or at a write 12 s after completion.

- **Blank frames:** 3 frames on both builds in every run, so the rule passes by frames.
  - **Duration:** veil2's 3 frames last 227.2–232.2 ms (median 228.3) against head's 124.9–135.3 ms
    (median 132.8). Round 1's veil had 226.9–236.9 ms (median 230.2).
  - **Write to clear:** veil2 244.9–262.2 ms, head 142.8–151.5 ms.
  - **What did not change:** the extra ~96 ms is in the same frame interval and has the same parts as in
    round 1.
- **The blocks the jump landed on were not laid out by pre-layout.**
  - **Unchanged:** frame 2's render part (66.6–68.3 ms) and the frame 2 → 3 interval (128.6–131.8 ms) match
    round 1's veil.
  - **Fonts:** KaTeX's Size3 math font finished loading 287–306 ms after the write in every veil2 run, as in
    the u2 trace's cause.
  - **Write at +12 s** (2 extra veil2 runs, `U2_DELAY=12000`, reported apart): still 211.0 / 220.0 ms, with
    frame 2 → 3 at 127.6 / 131.0 ms and Size3 again loaded right after the write. So pre-layout was not
    merely still running at +2 s.
- **View shift:** 0 jumps over 4 px after drawing, on both builds in every run, including the late runs.
- **Verdicts:** every veil2 run passes all 13 checks, `veil-none-rendered` and `veil-effective` included.
  There is no FAIL line in any of the 8 runs.

Exact commands are in [commands.md](commands.md). The per-run lines are in the `*.log` files, and the per-run
frame, long-animation-frame, font and pre-layout cuts are in [u2.jsonl](u2.jsonl).

## How u2 was run

The setup is round 1's: one scrollTop write, by default 2 s after completion, puts block 306 of 612 40 px above
the view's centre. scrollTop goes from 9,754 to 50,863 in every run.

- **The block was held in every run:** flags 15 (veil, opacity 0, skipped, held) on veil2 and 12 (skipped,
  held) on head, with 20 of the 21 blocks around it held.
- **Anchor:** the probe settles at the first frame at least 100 ms after the write and follows the block
  under the view's centre. That was block 320 on all veil2 runs and on `head-ats12-u2-1`, and 322 on the
  other two head runs.

**New in this round** (harness commit `27dbd96`):

- **`U2_DELAY=<ms>`:** the time from completion to the write. It defaults to 2000.
- **Font record:** the probe records `document.fonts` `loadingdone` events and font files' resource timing, on
  the same clock.

## Per run

The columns are as in round 1:

- **Blank frames:** the longest run of consecutive frames after the write with a tested point on a veiled
  (1), opacity 0 (2) or skipped (4) block, in frames and in ms from its first frame to the frame after it.
  It was the only such run in every run.
- **Frame intervals:** frame 1 → 2, 2 → 3, and 3 → the clear frame.
- **First two long frames, render part:** the render part (style, layout and paint after the rAF callbacks)
  of the first two long-animation-frame entries (≥ 50 ms) that end after the write, with each frame's
  duration in brackets. "<50" means no frame from the write to the clear frame was a long-animation-frame
  entry.
- **Jumps > 4 px after drawing:** from the settle frame to +16 s after completion. The frame-start count is
  in square brackets.
- **Size3 font loaded:** the `loadingdone` of `KaTeX_Size3`, in ms after the write.

| Run | Completion frame (ms) | u2 write (ms after completion) | Blank frames, longest run | Write → clear (ms) | Frame intervals (ms) | First two long frames, render part (ms) | Settle (ms after write), anchor | Jumps > 4 px after drawing [frame start] | Size3 font loaded | Verdicts |
|---|---:|---:|---|---:|---|---|---|---|---|---|
| `head-ats12-u2-1` | 1972.7 | 2033.1 | 3 (124.9 ms) | 142.8 | 39.1, 45.0, 40.8 | <50 until the frame after the clear one (15.1, 50.5 ms, at +175 ms) | 102.0, block 320 | 0 [0], largest move 0 px | 58.4 s before completion | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-u2-1` | 662.7 | 2023.6 | 3 (227.2 ms) | 256.5 | 31.9, **128.6**, 66.7 | 1.5 (the write's own frame, 51.4 ms), **66.6** (82.4 ms) | 189.8, block 320 | 0 [0], largest move 0 px | +298.8 | 13 PASS, 0 FAIL |
| `head-ats12-u2-2` | 1856.1 | 2034.0 | 3 (132.8 ms) | 150.1 | 36.5, 44.4, 51.9 | <50 | 150.1, block 322 | 0 [0], largest move 0 px | 58.4 s before completion | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-u2-2` | 657.7 | 2042.7 | 3 (228.3 ms) | 244.9 | 31.0, **130.7**, 66.6 | **68.3** (82.2 ms), 25.8 (82.1 ms) | 178.3, block 320 | 0 [0], largest move 0 px | +287.3 | 13 PASS, 0 FAIL |
| `head-ats12-u2-3` | 1931.4 | 2026.0 | 3 (135.3 ms) | 151.5 | 37.0, 45.5, 52.8 | <50 | 151.5, block 322 | 0 [0], largest move 0 px | 58.5 s before completion | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil2-ats12-u2-3` | 686.4 | 2026.5 | 3 (232.2 ms) | 262.2 | 31.7, **131.8**, 68.7 | 1.6 (the write's own frame, 52.3 ms), **67.9** (84.4 ms) | 193.5, block 320 | 0 [0], largest move 0 px | +305.9 | 13 PASS, 0 FAIL |

- **Every run exits 0.** The verdicts on every run are `replay-hook`, `replay-streams`, `in-progress`,
  `cv-blocks`, `seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
  `veil-none-rendered`, `no-escape` and `server-unchanged`. The veil2 runs also have `veil-effective`.
- **`veil-effective` on veil2:** 584–586 blocks were veiled before completion. ChatGPT's rAF callback in
  the completion frame forced 6.6–7.9 ms of style and layout.
- **`veil-none-rendered`:** in the probe's own count, no tested point was on a block rendered at opacity 0, at
  the frame's start or after drawing. That holds in all 972–1025 sampled frames per veil2 run (head
  876–894).
- **`OPTS put back`:** "same as before true" on every run.
- **The frames after the write:** on veil2, the last long frame in the cut (61.5–64.0 ms, starting 220–236 ms
  after the write) holds the clear frame's rAF.

### veil2 with the write 12 s after completion (reported apart)

| Run | Completion frame (ms) | u2 write (ms after completion) | Blank frames, longest run | Write → clear (ms) | Frame intervals (ms) | Points (frames 1, 2, 3, clear) | Settle (ms after write), anchor | Jumps > 4 px after drawing [frame start] | Size3 font loaded | Verdicts |
|---|---:|---:|---|---:|---|---|---|---|---|---|
| `veil2-ats12-u2late-1` | 699.9 | 12025.0 | 3 (211.0 ms) | 226.3 | 31.4, **127.6**, 52.0 | `777777-` `777777-` `000777-` `000000-` | 174.3, block 320 | 0 [0], largest move 0 px (205 frames to +16 s) | +270.2 | 13 PASS, 0 FAIL |
| `veil2-ats12-u2late-2` | 697.1 | 12030.2 | 3 (220.0 ms) | 236.1 | 32.5, **131.0**, 56.5 | same | 179.6, block 320 | 0 [0], largest move 0 px (206 frames to +16 s) | +281.9 | 13 PASS, 0 FAIL |

- **No long-animation-frame data around these writes.** The harness observes long frames only until about
  7.0–7.2 s after completion, so these runs have no render-part split. Their frame intervals and points are
  the +2 s runs' pattern.
- **Shorter tracking window.** View shift is followed only from the settle frame to +16 s, about 3.8 s, not
  the ~13.8 s of the +2 s runs.
- **Why 12 s.** The late runs were planned at +8 s. Run 4 (`veil2-ats12-u2-2`) loaded KaTeX_Size2 at +8.24 s,
  so the delay was raised before the late runs started; see [commands.md](commands.md).

## Per build: worst case and median

| Build | Blank frames: worst / median | Blank run ms: worst / median (range) | Write → clear ms: worst / median | Frame 2 → 3 ms: range | Jumps > 4 px after drawing: worst | Completion frame median (ms) |
|---|---|---|---|---|---:|---:|
| head | 3 / 3 | 135.3 / 132.8 (124.9–135.3) | 151.5 / 150.1 | 44.4–45.5 | 0 | 1931.4 |
| veil2 (write at +2 s) | 3 / 3 | 232.2 / 228.3 (227.2–232.2) | 262.2 / 256.5 | 128.6–131.8 | 0 | 662.7 |
| veil2 (write at +12 s, 2 runs) | 3 / 3 | 220.0 / 215.5 (211.0–220.0) | 236.1 / 231.2 | 127.6–131.0 | 0 | 698.5 |
| *Round 1 veil (`e5f480e`), for reference* | 3 / 3 | 236.9 / 230.2 (226.9–236.9) | 254.4 / 249.3 | 126.7–144.5 | 0 | 638.2 |
| *Round 1 head* | 3 / 3 | 157.5 / 134.3 (122.2–157.5) | 182.6 / 166.3 | 43.7–51.6 | 0 | 1997.1 |

The gap to head's median is +95.5 ms in this round, against round 1's +95.9 ms (230.2 vs 134.3). Pre-layout
closed none of it. veil2's median blank run is 1.9 ms shorter than round 1's veil, which is noise. The late
runs are about 10 ms shorter still, which is within the spread of two runs.

## Against the spec

| Rule (#170 Acceptance runs, `u2` part) | Measured | Result |
|---|---|---|
| veil2's longest run of frames on a veiled or not-rendered block is no longer than head's | veil2 worst 3, head worst 3 (3 in every run, both builds; also 3 in both late runs) | **PASS** by frames. In ms, veil2's 3 frames last 227.2–232.2 against head's 124.9–135.3. The ~96 ms gap of round 1 is unchanged. |
| 0 jumps over 4 px after drawing on veil2, as on head | veil2 0 in 3 of 3, plus 0 in both late runs; head 0 in 3 of 3. Anchor block 320 (head: 320 or 322); largest move 0 px | **PASS** |
| Every veil2 run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 5 of 5 veil2 runs (3 standard, 2 late): 13 PASS, 0 FAIL, exit 0 | **PASS** |

No FAIL line in any run.

## Did the jump land on laid-out blocks? No

The brief asked whether the blocks the u2 write landed on had already been laid out by pre-layout. On every
signal these runs carry, they had not, at +2 s or at +12 s.

- **Frame 2's rendering update is as long as without pre-layout.** On veil2 the long frame that holds frame
  2's rAF has a render part of 66.6–68.3 ms (round 1 veil: 65.5–67.8). The traced round 1 runs
  ([u2-trace](../../u2-trace/report.md)) showed that this part is one `Layout` of 64.7–66.7 ms. That layout
  adds 2,110 layout objects and runs 1,575 style resolutions: the first layout of the math inside the newly
  visible blocks. On head the frame is under 50 ms in total. Had pre-layout laid those blocks out, this
  layout would be small. The next long frame keeps round 1's shape too: a script part of 44.3–44.9 ms before
  its rAF, then a render part of 25.6–25.8 ms.
- **The math font is first needed after the jump.** On veil2, `KaTeX_Size3` finished loading at
  +2322.4–2332.4 ms after completion in the three +2 s runs. That is 287–306 ms after the write and just
  after frame 2's long layout, the u2 trace's font. In the late runs it loaded at +12295.2 and +12312.1 ms,
  270–282 ms after the write.
  - **On head**, all four KaTeX fonts (AMS, Size1, Size2, Size3) finished loading 58–98 s before completion,
    while the answer streamed, and none loaded after.
  - **What pre-layout should have done.** The marker's handoff says pre-layout's layout of the math would
    have requested these fonts within a few seconds of completion, followed by a font pass. Neither happened
    before the write: no font loaded between completion and the write in any veil2 run.
- **At +12 s, nothing had changed.** The two late runs show the same 3 frames, frame 2 → 3 at 127.6 /
  131.0 ms, the same point pattern, and Size3 loaded right after the write. Pre-layout should start at +1 s,
  so these blocks were not laid out 11 s later either.
- **Size1 and Size2.** In the +2 s runs, `KaTeX_Size1` and `KaTeX_Size2` were fetched at +6.42–7.63 s and
  +7.47–8.24 s, 4.4–6.2 s after the write. In the late runs neither loaded before the probe's window ended
  at +16 s. So whatever requested them in the +2 s runs came after the jump, not from a pass that started at
  +1 s. What requested them is not established.
- **Nothing else moved before the write.** From +900 ms to the write, scrollTop stayed 9,754 and
  scrollHeight stayed at 95,476 or 95,638 in every veil2 run: one value per run over 49–54 frames, and over 591–609
  frames in the late runs. No long frame in that window holds a Butter script or an idle callback. On veil2
  its long frames are one or two per run of 50.8–68.1 ms, between +1.38 and +1.79 s, each led by a
  `setTimeout` callback of 17.2–50.4 ms and a rAF callback of 10.4–11.7 ms, all labelled `other`. In two
  runs there is also the write's own frame (51.4 and 52.3 ms). No Butter script is attributed in any long frame after
  completion, on any run.
  - **The document was visible throughout.** The probe's rAF sampler ran on every frame through the
    window, and pre-layout stops in a hidden document.

**Why pre-layout did not lay these blocks out is not established here.** It may not have started, it may
have run over other blocks, or its layout may have been discarded before the jump. Pre-layout's idle
callbacks are expected to stay under 50 ms, and the long-animation-frame data shows only frames of 50 ms or
more, so these runs cannot see whether those callbacks ran.

Round 2 stage D points the same way: the first `window.find` call is still 812–939 ms on veil2 against
98.5–103.1 ms on head, about what it was without pre-layout.

Two checks would separate the causes:

- **A trace.** A trace from completion + 0.5 s to + 4 s (`TRACE_AT` at the completion time + 500 and
  `TRACE_SPAN=4000`) would show whether `FireIdleCallback` events from the content script run, and what they
  lay out.
- **A start-gate probe.** Pre-layout starts only on a `data-talvt-turn-state` attribute record whose
  `oldValue` is `in_progress`. A page-side record of those records at completion would show whether that
  path fires on this page. The harness's own in-progress mark does not say whether the attribute changed or
  the node was replaced.

## Notes

- **Completion frames.** veil2 657.7–699.9 ms; head 1856.1–1972.7 ms. As in round 1 and round 2 stages A and D.
- **Centre block at +16 s.** 322 on every run. The anchor (320 or 322) did not move: 0 px.
- **No resource entry for the Size3 file.** On either build the font record has no resource-timing entry for
  `KaTeX_Size3`, only its `loadingdone`. The file may come from the memory cache. Its time is taken from
  `loadingdone`.
- **Budget.** 8 harness runs, 26 min 57 s from lock to release. The acquire waited 17 min behind
  `veil-accept-r2-D`.
