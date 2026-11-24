# Smoother streaming: what a user sees around the end of a streamed answer — veil (pv) and late hydration (pvh) against head — 2026-11-24 (stage 5)

Lab run only; no file under `extension/` changed. Lab 2, fixture `ats12`, one lock that included the perf lock (owner `stream-ux-1124`). The send guard was on in every connection and no message was sent: every replay printed `PASS no-escape` and `PASS server-unchanged`. Raw captures (per-run JSON, unsanitized logs) stay in `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-ux/`.

## Result

**Late hydration moves the view by itself when the reader is inside the answer.** 2 s after completion, a jump onto held blocks in the answer's middle (block 306 of 612):
- **pvh:** the block under the view's centre moved up 31 times, by 94–568 px each (median gap 226 ms), from 2.6 s to 9.8 s after completion. That is 15,747 px in total, and every jump is still there after the frame was drawn. The view ended on block 562 instead of 320.
- **head:** 0 px. The view stayed on block 322.

**Jump to the end (U1):** the view stays at the end with pv, pvh and head (last block in view, fromEnd 0).
- pvh: the samples taken at each frame's start show the centre block jumping about ±480–570 px and back in the next frame, 178 times while hydration ran (net 0.4 px).
- That run had no sample after the frame was drawn, so whether these jumps are visible is not established.
- On head, a 188.6 px jump seen at a frame's start did not appear after the frame was drawn (0.5 px max). Such a sample can show a state that is never drawn.

**Reading on with the wheel (U3, pvh):** 0 of 119 notches moved the page by itself, and no frame had a veiled or not-rendered block under a tested point.

**Blank frames right after a jump:** 2–3 frames in every build.
- U1: pvh 84 ms, pv 76 ms, head 117 ms.
- U2: pvh 201 ms, head 96 ms.
- The veil adds no frames over head's own not-rendered frames. In pvh's U2 the 3 frames lasted longer (201 against 96 ms).

**Find and selection (U4, pv against head):**
- `window.find` found the text and selected it in both builds, but scrolled neither.
- It took 971 ms with pv against 159 ms on head (one run each).
- `scrollIntoView` gave identical results in both builds.
- Select-all text lengths are equal between pv and head.

## Builds and runs

- **head** = `0.1.0-alpha.22+streamaudit.1` (`~/snap/chromium/common/stream-audit-1123/butter`).
- **pv** and **pvh** = the stage 4 prototypes (`~/snap/chromium/common/stream-proto-1124/{pv,pvh}/butter`; [pvh.patch](../2026-11-24-stream-veil/pvh.patch)).
- Every run: `stream-replay-live.mjs`, `FIXTURE=ats12`, `PHASES=stream` (no wheel phase).

| # | Run | Build | UX | Exit | Log |
|---|---|---|---|---:|---|
| 1 | pvh-u1 | pvh | u1 | 1 (`stream-no-jump`, see U1) | [log](pvh-u1.log) |
| 2 | head-u1u4 | head | u1,u4 | 0 | [log](head-u1u4.log) |
| 3 | pvh-u2 | pvh | u2 | 0 | [log](pvh-u2.log) |
| 4 | head-u2-nostart | head | u2 | 0, probe did not start (see Not established) | [log](head-u2-nostart.log) |
| 5 | head-u2 | head | u2, `U2_BLOCK=306` | 0 | [log](head-u2.log) |
| 6 | pvh-u3 | pvh | u3 | 0 | [log](pvh-u3.log) |
| 7 | pv-u1u4 | pv | u1,u4 | 0 | [log](pv-u1u4.log) |

**Completion frame** (the standard measure, for reference): pvh 631–677 ms, pv 615 ms, head 1881–2023 ms, as in stage 4.

**Method** (`stream-ux-probe.mjs`):
- "Completion" is the first animation frame without `[data-talvt-turn-state="in_progress"]`: 105.61–105.76 s after Enter.
- From 1 s before completion to 16 s after, every frame samples scrollTop, scrollHeight and the hydration counters.
- At 7 points down the view's centre column (the last answer's column centre) it records the answer block under the point: its index among the last turn's 612 blocks, its top, `data-butter-veil` / `-unrendered` / `-measure`, computed opacity 0, and whether its content is not rendered (`firstElementChild.checkVisibility({contentVisibilityAuto:true})`, or the state change event for blocks without an element child).
- **Settle rule:** the first frame at least 100 ms after the scrollTop write. The block under the centre at that frame is the anchor, and its top is then followed on every frame.
- **The two samples:** the probe reads at the start of each frame (before the page lays out and draws it). From run 2 on it also reads in a task posted from that point, after the frame was drawn (median 5–6 ms later).

## U1 — jump to the end during hydration

The write ran in the first task after the completion frame. That was 353–372 ms after it with pv/pvh and 1,648 ms with head: the page was busy until then (head's completion frame is 1.9–2.0 s). So the brief's 0.3 s was not met. A user's End press would wait the same way.

| | pvh (1) | pv (7) | head (2) |
|---|---|---|---|
| write after completion | 372 ms | 353 ms | 1648 ms |
| (i) largest move of the anchor (frame start) | 569.8 px, net 0.4 | 0.9 | 188.6 (one jump) |
| (i) jumps > 4 px (frame start) | 178, in ±pairs | 0 | 1 |
| (i) after the frame was drawn | not sampled | 0.7 px, 0 jumps | 0.5 px, 0 jumps |
| (ii) blank frames (veil or not rendered), longest run | 2, 84.3 ms | 2, 76.1 ms | 2 not rendered, 117.1 ms |
| (iii) centre block settle → end; last block in view; fromEnd | 606 → 606; yes; 0 | 606 → 606; yes; 0 | 608 → 606; yes; 0 |
| scrollHeight at +16 s | 47,401 | 92,626 | 92,626 |

- **pvh's start-of-frame jumps:** in a jump frame, scrollTop and scrollHeight still read their old values (91,714 / 92,626), while the anchor sits 570 px higher. One frame later scrollTop is 570 px lower (91,144 / 92,056) and the anchor is back. They follow hydration (pending 574 → 34) once every ~100–120 ms, until 12 s.
- **(iv)** pvh's scrollTop followed the shrinking end, from 90,603 (+1 s) to 46,489 (+12 s). pv and head stayed at 91,714.
- REPORT (pvh):
  `ux u1 (i) view shift after settling (settled at +477.9 ms, first frame >= 100 ms after the write; anchor block 606): 832 frames, largest move of the anchor 569.8 px, net 0.4 px, jumps > 4 px 178 (sum -0.2 px; first -570.4@777.3 570@797.8 -541.5@899.2 541@924.3 …), new anchors 0`
- **`FAIL stream-no-jump` in run 1 is caused by the jump itself.** The harness's streaming loop keeps sampling until the replay's stream closes, about 1.4 s after `in_progress` goes. In that time pvh's answer shrank while the view sat at the end, so scrollTop fell with scrollHeight (94,726 → 91,808 → 90,603 → 89,483, …). (iii) shows the view was still at the end (fromEnd 0). It is not a jump back; no other run failed it.

## U2 — jump into the middle during hydration

The write came 2.0–2.1 s after completion and placed block 306 of 612 (chosen in run 3 as the held block nearest the middle; the same index on head) 40 px above the view's centre. In pvh it had veil, opacity 0, not rendered and held (flags 15); on head, not rendered and held (12). 20 of the 21 blocks around it were held in both.

| | pvh (3) | head (5) |
|---|---|---|
| (i) largest move of the anchor | **15,747 px** | 0 |
| (i) jumps > 4 px, after the frame was drawn | **31** (94–568 px, all upward, every ~226 ms, 2.6–9.8 s) | 0 |
| (ii) blank frames after the jump, longest run | 3 (veiled + not rendered), 201.1 ms | 3 (not rendered), 96.1 ms |
| (iii) centre block settle → end | 320 → **562** | 322 → 322 |
| fromEnd at +16 s | 2,632 | 38,906 |
| scrollTop / scrollHeight over time | 43,857 constant / 81,344 → 47,401 | 50,863 constant / 90,681 |

**Why the view moves:**
- scrollTop never changes, while the blocks hydrated above the view shrink from their 120 px placeholders.
- With `overflow-anchor: none` (Butter's), nothing holds the view in place.

REPORT (pvh):
`ux u2 (i) the same after each frame's rendering update (a task posted from the frame's rAF, median 5.8 ms later): 646 frames, largest move 15747.1 px, jumps > 4 px 31 (first -486.1@2608.7 -546.6@2821.7 -550.3@3089.6 …)`

## U3 — reading on while it hydrates (pvh only)

In the first task after completion (+359 ms), the answer's start was moved to 60 px below the view's top. Then 120 wheel notches of 100 px, sent every 100 ms (max gap 102 ms, longest dispatch 96 ms), from +482 to +12,420 ms.

- **The page never moved by itself:** 0 of 119 notches moved the block under the centre in the document, beyond the scroll itself (largest 0 px).
- **(ii)** 0 frames with a veiled or not-rendered block under a tested point.
- **Steps that are not 100 px:** 57 steps moved scrollTop by 100 px, 31 by 0 and 31 by 200, in pairs. They add up to 11,900 px = 119 × 100. A notch's scroll sometimes lands before the probe's wheel listener runs, so it counts toward the step before. The "> 4 px beyond the notch" count (62 steps of ±100) is the same effect.
  - The 120th step, closed 150 ms after the last notch, read 0 px; the dry check shows the same.
- **(iv)** scrollTop went from 9,694 to 21,694 while scrollHeight fell from 95,638 to 63,509 (hydration continued below the view).

REPORT:
`ux u3 u3 wheel: 120 notches from +481.5 to +12419.7 ms …; scrollTop moved other than 100 px in 62 steps (sum of moves 11900 px; …); centre block moved > 4 px beyond the notch (visual) in 62 (max 100; …), in the document (doc) in 0 (max 0; -)`

## U4 — find and selection on held blocks (after U1's 16 s; pv run 7, head run 2)

The candidates were held blocks in the answer's last 30%: 145 of 612 in both builds, all veiled with pv (476 veiled in the turn).

| | pv | head |
|---|---|---|
| (a) `window.find` of a 19-character string found once in the page, in block 429 | returned true in **971 ms**; text selected in the block | returned true in **159 ms**; text selected in the block |
| (a) page scrolled to the block | no (scrollTop 91,714 → 91,620; block 22.7k px above the view after 90 frames) | no (same numbers) |
| (a) block unveiled, opacity 1 and rendered (not in view) | frame 2, 1,090 ms after the call | frame 1, 167 ms |
| (c) `scrollIntoView({block:'center'})`, block 440 | in view, unveiled and rendered at frame 1 (41.6 ms, top 393 px); after 90 frames scrollTop 65,293, block 1,665 px down, out of view | the same: frame 1 (39.2 ms), then the same move out of view |
| (b) select-all on the last turn: `toString().length` | 35,863 (240 ms) | 35,863 (114 ms) |
| (b) `innerText.length` (and two frames later) | 5,861 (5,861) | 5,861 (5,861) |

- **(a)** `window.find` matches inside held, veiled blocks and selects the text, but in neither build does it bring the match into view. pv's call took 6× head's (one run each).
- **(c)** Both builds lose the block after the jump the same way (scrollTop −4,596 px within 90 frames), so it is not the veil. What moves it is not established.
- **(b)** Select-all text is equal between pv and head. `innerText` leaves out about 30k characters of not-rendered content in both. pv's select-all took 2× head's.

## Head against prototype

| Check | pvh | pv | head |
|---|---|---|---|
| U1 view at the end after 16 s | yes | yes | yes |
| U1 jumps > 4 px, after the frame was drawn | not sampled (178 ±pairs at frame start) | 0 | 0 |
| U1 blank frames after the jump | 2 (84 ms) | 2 (76 ms) | 2 (117 ms) |
| U2 view shift | **15,747 px in 31 jumps** | — | 0 |
| U2 blank frames after the jump | 3 (201 ms) | — | 3 (96 ms) |
| U3 notches that moved the page by itself | 0/119 | — | not run |
| U4 find: found / scrolled / call time | yes / no / — | yes / no / 971 ms | yes / no / 159 ms |
| U4 select-all text equal | — | yes (35,863) | yes |

## Environment

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium (snap) on Xvfb 1600×1000, software rendering |
| Lock | owner `stream-ux-1124`, lab 2 and perf. Waited for another task's lock; taken 21:15:30 UTC, restored 21:42:34, then released: 27.1 min, 7 of 10 runs |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 chunks over 107 s |
| Harness | New `lab/harness/stream-ux-probe.mjs` (339 lines); `stream-replay-live.mjs` gained the import, one call before Enter and `ux.finish()` in the REPORT loop (still 500 lines); one sentence in `lab/README.md`. `npx eslint lab/harness/stream-*.mjs` exits 0. Not committed. |
| Probe changes between runs | The after-drawing sample was added after run 1. The sampler start moved from 2.5 s to 8 s before the last chunk after run 4. |
| Dry check | Headless snap Chromium, throwaway profile, synthetic page with a 200–300-block `in_progress` answer; every mode ran with pvh, pv and head, no page errors |

## Not established

- **Whether pvh's U1 jumps (±480–570 px for one frame) are visible:** run 1 had no after-drawing sample. On head, such a frame-start jump was not drawn.
- **Run 4:** the probe never saw `in_progress` (3,445 frames, `no in_progress seen`). It most likely started after completion: in runs 1–3 it started only 0.6–1.4 s before completion. Rerun as run 5 with an 8 s lead.
- **Spread:** one run per case. The 971 against 159 ms `window.find` difference is a single pair.
- **What moves the block 4,596 px after `scrollIntoView`,** in both builds.
- **Not run:** U3 on head; `math9`; the wheel phase (so `wheel-no-jump` was not run in any replay); a pv U2.
- **The probe's own cost:** per-frame layout reads from 8 s before completion (2.5 s in runs 1–4). The completion frames match stage 4's, so the effect looks small.

## Clean-up

- `lab-restore --lab 2 --owner stream-ux-1124` restarted the browser without extensions (`"ok":true`, exit 0).
- `lab-lock release` freed lab 2 and perf; `lab-lock status` prints `"held": false` for lab 1, lab 2 and perf ([restore.log](restore.log), [release.log](release.log)).
- No settings were written.
