# Veil acceptance, stage C: `ats12` blank frames and view shift after a jump (#177), 2026-11-24

**Question.** On `ats12` with `PHASES=stream UX=u1,u2`, does the veil (`e5f480e`) meet spec #170's rules
for blank frames and view shift after a jump to the end (u1) and after a jump into held blocks in the middle
(u2), against `main` before the change (`547fa0a`, "head") in the same lock sequence?

**Answer.** In part.

- **Blank frames:** no change. The veil's longest run of frames with a veiled or not-rendered block under a
  tested point equals head's in every run: 2 frames after u1 and 3 after u2.
- **u1 view shift:** 0 jumps over 4 px after drawing on either build.
- **Verdicts:** every veil run passes all 13, `veil-none-rendered` and `veil-effective` included.
- **u2 view shift: not established.** These runs could not measure it the way the study did. In a combined
  `UX=u1,u2` run the probe follows u1's end block, not a block in the middle. The proxies available are the
  same on both builds.
- **Not a rule, but measured:** the veil's 3 blank frames after u2 last longer: 226.8–302.1 ms, against
  head's 140.5–170.1 ms.

Exact commands are in [commands.md](commands.md); the per-run lines are in the `*.log` files and the split
per jump is in [split.jsonl](split.jsonl).

## How u1 and u2 were split

Each run made both jumps:

- **u1:** scrollTop to the end in the first task after completion.
- **u2:** 2 s after completion, scrollTop onto block 306 of 612. `U2_BLOCK=306` was set on every run. The
  block was held on both builds: flags 15 (veil, opacity 0, skipped, held) on veil and 12 (skipped, held)
  on head, with 20 of the 21 blocks around it held.

The probe settles once, at the first frame at least 100 ms after the u1 write, and follows that frame's
centre block (606 on veil, 610 on head) to the end of the window. Its `REPORT ux u1+u2` lines therefore mix
both jumps. They count u2's own 40,851–41,607 px scrollTop write as a jump, and after u2 they follow a block
about 36,000 px below the view. [commands.md](commands.md) shows how each run's `summary.ux` was cut at the
u2 write:

- **Blank frames:** valid for both jumps. They do not depend on the anchor.
- **u1 view shift:** valid, from u1's settle frame up to the u2 write. That window is 1.44–1.48 s on veil but
  only 0.16–0.28 s on head, because head's u1 write waits for its ~1.9 s completion frame. The study
  followed u1 for 16 s.
- **u2 view shift:** not the study's measure. What these runs can show is listed under "u2 view shift".

## Per run

Columns:

- **Completion frame:** for reference.
- **u1 write:** ms after completion (the first frame without `in_progress`).
- **Blank frames:** the longest run of consecutive frames with a tested point on a veiled (1), opacity 0 (2)
  or skipped (4) block, with its length in ms. On veil every such frame had all three flags; on head only
  "skipped".
- **u1 jumps:** jumps over 4 px of the u1 anchor after drawing, with the frame-start count in brackets.

| Run | Completion frame (ms) | u1 write (ms) | u1 blank frames, longest run | u1 jumps > 4 px after drawing [frame start] | u1 window after settle (ms) | u2 write (ms) | u2 blank frames, longest run | Verdicts |
|---|---:|---:|---|---|---:|---:|---|---|
| `head-ats12-ux-1` | 1927.9 | 1641.2 | 2 (159.9 ms) | 0 [1: +162.1] | 276 | 2046.3 | 3 (166.0 ms) | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-ux-1` | 681.8 | 403.1 | 2 (107.3 ms) | 0 [0] | 1465 | 2012.8 | 3 (229.4 ms) | 13 PASS, 0 FAIL |
| `head-ats12-ux-2` | 1949.1 | 1714.0 | 2 (136.6 ms) | 0 [1: +162.1] | 162 | 2041.4 | 3 (170.1 ms) | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-ux-2` | 624.9 | 394.6 | 2 (94.3 ms) | 0 [0] | 1482 | 2012.2 | 3 (226.8 ms) | 13 PASS, 0 FAIL |
| `head-ats12-ux-3` | 1971.2 | 1647.7 | 2 (110.7 ms) | 0 [1: +162.1] | 243 | 2041.9 | 3 (140.5 ms) | 12 PASS, 0 FAIL; `veil-effective` not judged |
| `veil-ats12-ux-3` | 697.6 | 413.3 | 2 (115.6 ms) | 0 [0] | 1442 | 2010.3 | 3 (302.1 ms) | 13 PASS, 0 FAIL |

- **Blank-frame totals:** in every run the frames on a blank block are these runs and no others: 2 frames in
  the u1 window and 3 in the u2 window, 5 over the whole window (the probe's own "either 5").
- **Head's frame-start jump:** +162.1 px in the first frames after u1 settles, while ChatGPT shrank the page
  under the view at the end. It is not in the after-drawing sample. The study saw the same on head (188.6 px
  at frame start, not drawn).
- **View at the end of u1:** on the end block on both builds, until the u2 write.
- **Every run exits 0.** Verdicts on every run: `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
  `seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
  `veil-none-rendered`, `no-escape` and `server-unchanged`, plus `veil-effective` on the veil runs.
- **`veil-effective` on veil:** 584, 586 and 584 blocks veiled before completion. ChatGPT's rAF callback in
  the completion frame forced 6.5, 6.8 and 9.6 ms of style and layout.
- **`veil-none-rendered` on both builds:** 0 in 114–125 once-a-second samples, 0 after the window, and 0 at
  the frame's start and 0 after drawing in every probed frame (875–1028 per run).
- **`OPTS put back`:** "same as before true" on every run.

## Per build: worst case and median

| Build | u1 blank frames: worst / median (ms median) | u2 blank frames: worst / median (ms median, range) | u1 jumps > 4 px after drawing, worst | Completion frame median (ms) |
|---|---|---|---:|---:|
| head | 2 / 2 (136.6 ms) | 3 / 3 (166.0 ms, 140.5–170.1) | 0 | 1949.1 |
| veil | 2 / 2 (107.3 ms) | 3 / 3 (229.4 ms, 226.8–302.1) | 0 | 681.8 |

## u2 view shift: what these runs show

After the u2 write, the following was the same on every run of both builds:

- **scrollTop:** constant at 50,863 from the settle frame to +16 s.
- **Block 306 at the view's centre:** for the first 1–2 frames after the write.
- **The centre block then changed:** 306 → 320 → 322, reaching 322 0.19–0.21 s after the write on head and
  0.25–0.33 s on veil, and stayed on 322 until +16 s. scrollHeight fell over the same frames: by 4,795 px
  on veil (92,626 → 87,831) and by 4,889–5,081 px on head (92,906–93,382 → 88,017–88,301).
- **The followed end block moved up** in the same jumps on both builds: −2040.2, −1250.5, −756.5, −404.6,
  −249.4 and −94 px. These jumps are in the after-drawing sample.
  - On veil the −2040.2 jump falls before the settle frame, so 5 jumps remain after settling, in 3 of 3
    runs.
  - On head it falls after the settle frame in 2 runs, giving 6 there and 5 in `head-ats12-ux-1`.

Read against the rule:

- **The proxies match.** The veil's u2 behaviour matches head's: the same jump sizes (within 0.2 px), the
  same centre-block path and about the same scrollHeight drop. At the write, head's page was 280–756 px
  taller than the veil's (92,906–93,382 against 92,626).
- **But the rule is not shown.** The spec's u2 rule is "0 jumps over 4 px after drawing on veil, as on head",
  measured on a block in the middle. These runs do not measure that, so the rule is not shown to pass. The
  probe's own after-settle count on the block it follows is 5 jumps on every veil run and 5–6 on head.
- **The page may move on head too.** The centre block changing from 306 to 322 at a constant scrollTop
  suggests the content under the view moves after the write on both builds. That would make head's own
  count non-zero at this settle time. The study's head u2 run settled on block 322 and reported 0 px. Which
  of the two the user sees is not established here.

## Against the spec

| Rule (#170 Acceptance runs, `u1`/`u2` part) | Measured | Result |
|---|---|---|
| u1: the veil's longest run of frames on a veiled or not-rendered block is no longer than head's (study: 2 at the end on both) | veil worst 2, head worst 2 (2 in every run) | PASS |
| u2: the same, in the middle (study: 3 on head) | veil worst 3, head worst 3 (3 in every run) | PASS (by frames; the veil's 3 frames last 226.8–302.1 ms against head's 140.5–170.1 ms) |
| u1: 0 jumps over 4 px after drawing on veil, as on head | veil 0 in 3 of 3, head 0 in 3 of 3, from the u1 settle frame to the u2 write (veil 1.44–1.48 s, head 0.16–0.28 s) | PASS, for that window only |
| u2: 0 jumps over 4 px after drawing on veil, as on head | not measured on a middle block. On the end block the probe follows: veil 5 in 3 of 3, head 5–6 in 3 of 3, the same sizes within 0.2 px | NOT ESTABLISHED |
| Every veil run passes `veil-none-rendered`, `veil-effective` and all existing verdicts | 3 of 3: 13 PASS, 0 FAIL, exit 0 | PASS |

No FAIL line in any run.

## u2 blank frames last longer on veil

The rule counts frames, and both builds have 3. In ms the veil's run is longer in every run: 226.8, 229.4
and 302.1 ms, against head's 140.5, 166.0 and 170.1 ms. In the long-animation-frame entries right after the
write, the veil's first frame has a render part of 65.8–86.2 ms and its second 24.2–42.3 ms; head's are
11.5–15.3 ms. Script time in those frames is small on both builds.

The extra rendering is likely the newly relevant veiled blocks being painted and unveiled, but that is not
established. The study saw the same direction with the veil plus hydration prototype: 201 against 96 ms.

## Notes for later stages

- **Run u2 alone for its view shift:** `UX=u2 U2_BLOCK=306`, 3 head + 3 veil. That takes about 20 minutes
  under one lock (a run takes 199–205 s). Then the probe's anchor is the middle block, and the spec's u2
  rule can be judged as the study judged it.
- **u1 alone gives the full 16 s window** (here it ends at +2 s) and costs the same.
- **Lab 2 was busy.** Another task (`rail-pin-171*`) took it in turn under new owner names. The first
  `--wait 1800` acquire timed out after 30 min, and the second took it after 2.5 min. `lab-lock` has no
  queue, so give `--wait` some slack.
- **Completion frames match stages A and B:** veil 624.9–697.6 ms, head 1927.9–1971.2 ms. The UX probe's
  per-frame sampling did not visibly change them.
