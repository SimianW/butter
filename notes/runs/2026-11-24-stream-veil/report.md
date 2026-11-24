# Smoother streaming: a veil on never-rendered blocks (pv) and late hydration (pvh) against the completion frame — 2026-11-24 (stage 4)

Lab run and scratch prototypes; no file under `extension/` changed. Lab 2, fixtures `ats12` and
`math9`, one outer lock with the perf lock (owner `stream-veil-1124`). The send guard was on in every
connection and no message was sent: every replay printed `PASS no-escape` and `PASS server-unchanged`.
Raw captures (per-run JSON with every frame, unsanitized logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-stream-veil/`.

## Result

**The veil removes the completion freeze's ChatGPT part, and late hydration gives the answer its real height without a long frame.**

- **Completion frame:** 641–680 ms with pv/pvh against the control's 1845 ms on `ats12`; pvh 675 ms
  against 1960 ms on `math9`.
- **ChatGPT's completion rAF callback:** 14.7–16.1 ms (6.4–7.0 forced) against 1233.7 / 1181.2 ms.
  That is less than natively (46 ms in stage 1): the telemetry's walk stops at every veiled block.
- **What is left is ChatGPT's own stream task,** 587–643 ms with 176–194 ms forced, the same as
  natively (stage 1: 645 / 192).
- **No frame of at least 1 s in any veil run.**
- **Blocking:** 1.57–1.69 s against 6.63 s on `ats12`, and 3.51 s against 10.71 s on `math9`.
  - Most of the gain is mid-stream: ChatGPT's rAF callbacks before completion total 129–236 ms
    against 11,436 ms.
  - The ~42 s frame is gone.

**Late hydration (pvh):**
- It hydrated the 567 held blocks between 106.0 and 116.1 s after Enter (in_progress gone at 105.6 s).
- The answer is 36,503 px from 116.1 s (`ats12`) and 117.0 s (`math9`).
- No tail frame of at least 100 ms; 0 view shift while wheeling.

**As written, pv left 19 blocks at opacity 0 after completion** (Q2, Q9). Fixed between runs 2 and
3; run 2 used the version as written (`pv0`).

**Veil under a tested point:**
- pv: 2 consecutive frames, both at the jump to the chat's end that starts the wheel phase; 0 on 120
  wheel steps.
- pvh: 0 of 1248 frames.

**Targets:**
- Half of head: reached on both fixtures.
- 0.77 s on `math9`: reached.
- 0.39 s on `ats12`: not reached; ChatGPT's stream task alone is about 0.6 s.

## Results table

**Builds:**
- **head** = `0.1.0-alpha.22+streamaudit.1`, a test build of `b2df865` (= `origin/main`), at
  `~/snap/chromium/common/stream-audit-1123/butter`.
- The prototypes are copies under `~/snap/chromium/common/stream-proto-1124/<name>/butter`:
  - **pv0** = head + veil as written ([pv0.patch](pv0.patch)), run 2 only;
  - **pv** = head + veil with the leak fix ([pv.patch](pv.patch));
  - **pvh** = pv + late hydration ([pvh.patch](pvh.patch)).
- **pe** ([pe.patch](pe.patch)) was built and dry-checked, not run (Q9).

No build had settings stored, and `data-butter-off` was `layout` in every run. All runs used
`stream-replay-live.mjs`. The standard window runs from Enter to 5 s after the stream completed, about
112.5–112.8 s.

| # | Run | Fixture | Options | LoAF | blocking | long-frame total | longest (start) | ≥200 / ≥500 / ≥1000 | forced sum | Exit | Log |
|---|---|---|---|---:|---:|---:|---|---|---:|---:|---|
| 1 | head (control) | `ats12` | stream | 340 | **6626** | 26634 | **1845** (105026, completion) | 8 / 1 / 1 | 3725 | 0 | [log](head-ats12.log) |
| 2 | pv0 | `ats12` | stream | 86 | **1687** | 7714 | **660** (105023, completion) | 5 / 1 / 0 | 418 | 0 | [log](pv-ats12.log) |
| 3 | pvh | `ats12` | stream, `TAIL_MS=20000` | 91 | **1575** | 7856 | **674** (105022, completion) | 5 / 1 / 0 | 432 | 0 | [log](pvh-ats12.log) |
| 4 | pvh | `math9` | stream, `TAIL_MS=20000` | 275 | **3513** | 21190 | **675** (105047, completion) | 8 / 2 / 0 | 1003 | 0 | [log](pvh-math9.log) |
| 5 | head (control) | `math9` | stream | 493 | **10713** | 40156 | **1960** (105040, completion) | 10 / 2 / 1 | 4447 | 0 | [log](head-math9.log) |
| 6 | pvh | `ats12` | all phases, `VEILPROBE=1` | 95 | 1631 | 8261 | 652 (105076, completion) | 5 / 1 / 0 | 438 | 0 | [log](pvh-ats12-all.log) |
| 7 | pv | `ats12` | all phases, `VEILPROBE=1` | 89 | 1668 | 7844 | 641 (105040, completion) | 5 / 1 / 0 | 454 | 0 | [log](pv-ats12-all.log) |
| 8 | pv | `ats12` | stream, `APIPROBE=1` | 93 | 1681 | 8085 | 680 (105022, completion) | 5 / 1 / 0 | 447 | 0 | [log](pv-ats12-apiprobe.log) |

Times are in ms after Enter. "forced sum" is forced style/layout summed over all long frames. Every
log ends in `SUMMARY <label>: 0 FAILs`.

### The completion frame

| Run | start | duration | stream task / forced | rAF callback / forced | rAF part | render part |
|---|---:|---:|---|---|---:|---:|
| head `ats12` (control) | 105025.6 | **1844.5** | 586.9 / 182.1 | **1233.7 / 1181.2** | 1244.5 | 10.7 |
| pv0 `ats12` | 105022.7 | **659.8** | 625.2 / 175.9 | 14.7 / 6.6 | 23.2 | 10.5 |
| pvh `ats12` | 105021.7 | **674.1** | 636.4 / 179.8 | 15.0 / 6.5 | 25.4 | 11.2 |
| pvh `ats12` all phases | 105075.6 | 651.9 | 611.2 / 177.8 | 15.2 / 6.4 | 27.5 | 11.8 |
| pv `ats12` all phases | 105040.1 | 641.2 | 606.5 / 175.6 | 14.9 / 6.4 | 23.3 | 10.3 |
| pv `ats12` API probe | 105022.3 | 679.7 | 643.4 / 188.7 | 16.1 / 6.6 | 24.7 | 10.6 |
| head `math9` (control) | 105039.6 | **1960.2** | 670.0 / 194.8 | **1257.2 / 1202.8** | 1267.8 | 17.3 |
| pvh `math9` | 105046.7 | **675.0** | 626.7 / 194.3 | 15.8 / 7.0 | 30.1 | 16.8 |
| stage 1 native `ats12` (other sequence) | 105321.3 | 792.0 | 644.8 / 191.7 | 45.7 / 0 | — | — |
| stage 1 native `math9` (other sequence) | 105363.7 | 878.0 | 694.5 / 247.3 | 45.7 / 0 | — | — |

The stream task is ChatGPT's work inside the replay hook's timer task (`other`,
`TimerHandler:setTimeout`). The rAF callback is ChatGPT's `299268.5b3cdf27e2.js` `FrameRequestCallback`.
Butter's scripts appear in no long frame (`laf butter files: {}` in every run).

REPORT (run 3):
`completion frame: start 105021.7 ms, duration 674.1, blocking 623.1, script part 637.5, rAF part 25.4, render part 11.2; scripts 636.4/179.8 forced other user-callback "TimerHandler:setTimeout"; 15/6.5 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"`

## Q1. Each arm against its control

**`ats12`** (control: run 1):

| | control | pv0 (2) | pvh (3) | pvh all (6) | pv all (7) | pv api (8) |
|---|---:|---:|---:|---:|---:|---:|
| completion frame | 1845 | 660 | 674 | 652 | 641 | 680 |
| stream task / forced | 587 / 182 | 625 / 176 | 636 / 180 | 611 / 178 | 607 / 176 | 643 / 189 |
| rAF callback / forced | 1234 / 1181 | 15 / 7 | 15 / 7 | 15 / 6 | 15 / 6 | 16 / 7 |
| render part | 10.7 | 10.5 | 11.2 | 11.8 | 10.3 | 10.6 |
| longest frame | completion | completion | completion | completion | completion | completion |
| ≥200 / ≥500 / ≥1000 | 8 / 1 / 1 | 5 / 1 / 0 | 5 / 1 / 0 | 5 / 1 / 0 | 5 / 1 / 0 | 5 / 1 / 0 |
| blocking | 6626 | 1687 (−75%) | 1575 (−76%) | 1631 (−75%) | 1668 (−75%) | 1681 (−75%) |
| blocking without the completion frame | 4834 | 1078 | 951 | 1031 | 1078 | 1052 |
| long-frame total | 26634 | 7714 | 7856 | 8261 | 7844 | 8085 |
| forced style/layout, all long frames | 3725 | 418 | 432 | 438 | 454 | 447 |
| ChatGPT rAF callbacks in long frames / forced | 12670 / 3189 | 144 / 21 | 236 / 20 | 223 / 17 | 225 / 17 | 252 / 15 |
| publish interval p10 / median | 257.8 / 267.1 | 250.0 / 265.9 | 250.0 / 265.4 | 250.4 / 266.3 | 249.9 / 265.7 | 250.1 / 265.6 |

**`math9`** (control: run 5):

| | head (5) | pvh (4) |
|---|---:|---:|
| completion frame | 1960 | 675 |
| stream task / forced | 670 / 195 | 627 / 194 |
| rAF callback / forced | 1257 / 1203 | 16 / 7 |
| longest frame | completion (Enter 601 ms) | completion (Enter 587 ms) |
| ≥200 / ≥500 / ≥1000 | 10 / 2 / 1 | 8 / 2 / 0 |
| blocking | 10713 | 3513 (−67%) |
| blocking without the completion frame | 8807 | 2889 |
| long-frame total | 40156 | 21190 |
| forced style/layout, all long frames | 4447 | 1003 |
| ChatGPT rAF callbacks in long frames / forced | 13374 / 3275 | 306 / 29 |
| publish interval p10 / median | 256.6 / 268.1 | 250.5 / 266.1 |

**Blocking per 10 s from Enter** (ms; the last bucket is 110 s to the window's end):

| s | 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| head `ats12` | 310 | 10 | 28 | 170 | 363 | 188 | 286 | 754 | 558 | 1162 | 2797 | 0 |
| pv0 | 264 | 0 | 18 | 45 | 79 | 0 | 13 | 369 | 0 | 173 | 726 | 0 |
| pvh | 258 | 0 | 13 | 43 | 46 | 0 | 0 | 323 | 32 | 87 | 765 | 8 |
| pvh all | 251 | 0 | 10 | 45 | 43 | 0 | 8 | 417 | 6 | 145 | 698 | 8 |
| pv all | 274 | 0 | 10 | 148 | 38 | 30 | 19 | 331 | 21 | 134 | 662 | 0 |
| pv api | 281 | 0 | 22 | 44 | 41 | 8 | 12 | 388 | 8 | 164 | 712 | 0 |
| head `math9` | 742 | 76 | 99 | 266 | 513 | 428 | 540 | 1747 | 1103 | 2127 | 3072 | 0 |
| pvh `math9` | 728 | 6 | 67 | 75 | 80 | 128 | 39 | 635 | 180 | 555 | 990 | 28 |

- **Frames of at least 200 ms in the veil runs on `ats12`:**
  - the Enter keydown (0 s, 217–246 ms) and the frame after it (208–221 ms, 0 blocking);
  - ChatGPT's stream task at 76.2 s (276–319 ms);
  - the completion frame;
  - a frame of 285–290 ms with 0 blocking about 0.1 s after the completion frame started (head has
    it too: 290 ms at 106.9 s).
- **Gone against head:** 32.5 s (212 ms), 42.2 s (315 ms; rAF 310 / 283 forced) and 103.6 s (240 ms).
- **pvh `math9`** adds three frames of 210–235 ms with 41–57 ms blocking (59.9, 71.0 and 100.2 s;
  ChatGPT `7078…js` timers or no script). Head `math9` had frames ≥200 ms at 32.5, 42.2, 54.4, 74.8,
  76.2 and 103.6 s.
- **One control per fixture.** Earlier stages measured ±10% blocking between days on `ats12` and ±20%
  on `math9`. A −67 to −76% change is far outside that.

## Q2. Veil

- **Blocks veiled in the last turn:**
  - mid-stream (sample at about 52.7–52.9 s): 270 in every veil run;
  - just before the completion frame: 585–586;
  - after the window: pv0 586, of which **19 not `content-visibility: auto`**; pv 567 with 0 not
    `auto` (runs 7–8); pvh 0 (runs 3–4); 177 in run 6, whose hydration was still running at the 5 s
    mark.
  - REPORT (run 2):
    `veil counts (last turn): mid-stream 270 at 52877 ms (max 585 at 104161.7); just before the completion frame 585 at 104161.7 ms; after the window 586; veiled but not content-visibility auto: max 19 in samples, 19 after the window`
- **The forced part of the completion rAF callback went away:** 6.4–7.0 ms against 1181–1203 ms.
- **The design as written leaked.** At completion, 19 veiled blocks that were never held (neither
  `data-butter-unrendered` nor `data-butter-seen`) leave the `auto` rules.
  - Head has the same blocks: 612 blocks, 592 `auto` after completion.
  - No `contentvisibilityautostatechange` event fires for them, so the veil stayed, and they render
    at opacity 0: invisible content below the view. What these blocks are was not established.
  - **The fix (pv, pvh):**
    - the opacity rule applies only where the `auto` rules do (inside an `in_progress` turn, or with
      `data-butter-unrendered`);
    - the completion branch removes the veil from the turn's veiled blocks that are not waiting.
  - **Evidence:** runs 7–8 show 0 veiled-but-not-`auto` blocks. 22 veils came off in the window
    against 3 in run 2: 19 more, at completion.
  - The synthetic dry page (with `<hr>` blocks) did not reproduce the leak.
- **The mid-stream frames that stages 1–3 saw in every run:**
  - **The 42 s ChatGPT rAF callback (head 314.5 ms, 310 / 283 forced) is gone.** The longest frame
    between 41 and 47.5 s is 142–172 ms with no script entry of at least 5 ms.
  - ChatGPT's rAF callbacks in long frames before completion: 129–236 ms (8–14 forced) against
    11,436 ms (2008 forced) on `ats12`; 290 (22) against 12,116 (2073) on `math9`.
  - **The 76 s stream task stays:** 276–319 ms (task 252–268 ms, 48.5–51 forced) against 340 ms
    (275 / 67) on `ats12`; 384 against 432 ms on `math9`. That is ChatGPT's stream work, not the
    telemetry.

## Q3. Late hydration (pvh)

- **When (run 3, `ats12`):**
  - `in_progress` gone at 105.60 s; first batch 106.03 s, last 115.90 s, last measure off 116.91 s;
  - 95 batches, 567 blocks;
  - most blocks rendering at once: 66 (batches of 6, flushed once a second).
  - Run 4 (`math9`): 105.82 to 116.08 s, last off 117.01 s, the same counts.
- **The last turn's height (run 3):** 80,910 px at 106.7 s, 74,008 at 108.1, 63,353 at 110.1, 54,463
  at 112.1, 46,333 at 114.1, 41,069 at 115.1, and **36,503 px from 116.09 s** (10.5 s after
  `in_progress` went). Run 4: 36,503 px from 116.97 s (11.4 s after).
  - REPORT (run 3):
    `tail over time (s after Enter: hydrated/pending/measuring/unrendered/veiled, last turn px): 106.7s:0/577/42/567/525,80910 107.1s:66/511/0/501/501,78781 108.1s:66/511/54/501/447,74008 … 115.1s:498/70/18/69/51,41069 116.1s:564/3/3/3/0,36503 117.1s:567/0/0/0/0,36503 …`
- **The tail (112.7–127.8 s):**
  - run 3: no long animation frame at all (LoAF 0);
  - run 4: 2 frames, 119 ms in total, 11.5 ms blocking, longest 61.8 ms at 112.54 s;
  - REPORT (run 3):
    `tail (112665.5-127775.6 ms after Enter): LoAF 0, total 0 ms, blocking 0 ms, longest -, >=100/200/500/1000 ms 0/0/0/0, forced 0 ms`
- **In the standard window after completion:**
  - run 3: 6 frames, 8.5 ms blocking; run 4: 13 frames, 46 ms blocking; pv0 (no hydration): 1 frame,
    0 blocking.
  - The only frame of at least 100 ms is the 284–290 ms frame with 0 blocking right after the
    completion frame, which every arm has (head at 106.9 s, pv0 at 105.7 s).
  - In run 4 it falls 41 ms after the first batch; in run 3 it comes 328 ms before it.
  - No other frame of at least 100 ms near a batch or a flush.
- **`pvh2`** was not built: no long frame from hydration, and the real height came within 11.4 s.

## Q4. Veil flicker

- **Run 7 (pv, the worst case: every held block still veiled when the wheel phase starts):**
  - 1275 frames sampled, 6543 point hits on answer blocks.
  - **2 frames with a tested point on a veiled block, consecutive, both at the jump to the end**
    (`toEnd`) that starts the wheel phase: 4 of 7 points each, 12 ms apart.
  - 0 frames during the 60 wheel steps up and 60 down.
  - The scrollTop write to the answer's middle: 0 of 30 frames. Every block had been in view while
    wheeling, so this jump met no veiled block and does not test the worst case.
  - REPORT:
    `veil probe, wheel phase (60 wheel events up, 60 down): frames sampled 1275 (point hits on an answer block 6543), frames with a tested point on a veiled or opacity-0 block 2, longest consecutive run 2, by step {"end":2}, veiled/op0 hits 8/8`
- **Run 6 (pvh):** 0 of 1248 frames and 0 of 30; hydration had finished before the wheel phase.
- **Dry check (synthetic page, headless, scrollTop write onto a veiled block):**
  - The block is veiled, and its content reads as skipped (`checkVisibility({contentVisibilityAuto})`
    on its first child), in rAF 1 and 2.
  - The `contentvisibilityautostatechange` event arrives between rAF 2 and 3, 20–35 ms after the
    write; the veil comes off in the same task.
  - From rAF 3 the block computes opacity 1 and its content renders. That is 3 frames to unveil.
  - Head's same block also reads skipped in rAF 1 and 2 and renders from rAF 3.
- **What a user could see:**
  - After a jump into never-rendered blocks (End, a scrollbar drag, a rail or seek jump): up to 2
    frames, about 12–35 ms here, where those blocks are blank. That applies with pv, and with pvh
    only during the ~10 s of hydration (not measured).
  - Head's skipped blocks are unrendered for those same frames in the dry check. Whether the veil
    adds a blank frame that head paints with text is **not established**: Element Timing reported no
    paint entries in the dry page.
  - Wheel scrolling: no veiled frame was seen.
  - With pvh once hydration has finished: none.

## Q5. All-phases runs

| | pvh (6) | pv (7) |
|---|---:|---:|
| last turn at the wheel phase | 36,503 px | 81,566 px |
| scrollHeight at the end of the wheel phase | 46,841 | 46,938 |
| answer after the window (turn / scrollHeight) | 51,772 / 62,142 (hydration running) | 84,740 / 95,110 |
| steps where scrollTop moved beyond the wheel step (up / down) | 1/55 (32 px) / 0/55 | 48/60 (47 by > 100 px) / 0/60 |
| view shift up, over 4 px | 0/55 (in the answer 0/53) | **9/60** (578–1047 px) |
| view shift down, over 4 px | 0/55 (0/52) | 0/60 (0/56) |
| tracked by block / turn / user | 92 / 17 / 1 | 100 / 19 / 1 |
| `wheel-no-jump`, `stream-no-jump` | PASS, PASS | PASS, PASS |

pv's up-shifts are head's placeholder behaviour, not the veil's: the 2026-11-23 recheck's head runs
on the same answer printed 9/60 and 10/60 over 4 px (482–1203 px). pvh removes them. While streaming,
the view never sat at the end (0/471–472 samples; scrollTop stayed at 9622), as with head.

## Q6. Existing verdicts

All 8 runs printed `PASS` for `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
`seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`, `no-escape`
and `server-unchanged`; runs 6 and 7 also printed `PASS wheel-no-jump`. Every exit was 0.

## Q7. The telemetry's calls with pv (run 8, `APIPROBE=1`, armed 100.6 s to the window's end)

- **All wrapped calls starting in the completion frame's rAF part,** in 50 ms bins: `scrollLeft` 75
  calls / 6.1 ms, `Range.getBoundingClientRect` 211 / 1.8, `getComputedStyle` 776 / 0.6,
  `Element.getBoundingClientRect` 98 / 0.6, `checkVisibility` 87 / 0.5, `scrollTop` 84 / 0.2,
  `clientHeight` 53 / 0.2, the rest under 0.2 ms. About 10 ms in total.
- **Stage 2's numbers for the same part** (P1 run 7, the call sites head shows):
  - `scrollLeft` 352 / 820.9 ms, `getComputedStyle` 2088 / 1.5 ms plus about 415 ms of forced layout
    in `A` that cannot be wrapped;
  - `Element.getBoundingClientRect` 742 / 7.1, `checkVisibility` 1322 / 4.1.
- **Calls of at least 5 ms from the page over the whole armed window:** 1. It is
  `clientHeight 189.7 ms at 105353.7 ms` on the scroller (`<div> [data-mcp-app-scroll-host data-app-action-timeline-scroll data-thread-reading] scroller`),
  stack `$@176742.d99552236e.js:1:23828 < callback@76629.6adf997716.js:17:9870 < aP@176742…:1:43221 < …`.
  - That read is inside the stream task: ChatGPT's own, as in stage 2's head run (183.3 ms).
  - None of the telemetry's calls reached 5 ms, so their targets were not kept.
- **Armed-window totals** (pv against stage 2 head):
  - `scrollLeft` 2280 / 36.4 ms against 9133 / 913.9;
  - `getComputedStyle` 63,376 / 30.2 against 108,458 / 49.7;
  - `checkVisibility` 7815 / 36.5 against 77,326 / 126.3.

## Q8. Against the targets

- **Half of this sequence's head control: reached on both fixtures.**
  - `ats12`: 922 ms is the bar; pv 641–680, pvh 652–674 ms.
  - `math9`: 980 ms is the bar; pvh 675 ms.
- **Half of native:**
  - 0.39 s on `ats12`: **not reached** (641–680 ms).
  - 0.77 s on `math9`: **reached** (675 ms), though the native figures come from stage 1, another
    sequence.
- **What is left in the completion frame:**
  - ChatGPT's stream task, 587–643 ms with 176–194 forced, as natively (645 / 192, 695 / 247). Its
    largest single part is ChatGPT's 190 ms `clientHeight` read on the scroller.
  - ChatGPT's telemetry rAF callback, 15–16 ms.
  - Render 10–17 ms.
  - None of it is Butter's (no Butter script in any long frame).
  - 0.39 s on `ats12` needs ChatGPT's stream task itself to shrink.
- **The longest frame of every run is still the completion frame.** The next longest:
  - `math9`: the Enter keydown (587 ms with pvh; 601 head; 1.54 s natively in stage 1);
  - `ats12`: the 76 s stream task (276–319 ms), or the 285–290 ms 0-blocking frame after completion.
- **The blocking gain grows instead of being lost:** −75% on `ats12` and −67% on `math9` against
  head, which already blocked about 6× less than native in stage 1.

## Q9. The selector `e`, and the veil's risks

**`e`** is built in `o(a,b,c,d)` of module `AORd`:
- `b` is the sampler's `q=f()`, `isMarkdown`.
- With `b` true: `button, input, select, textarea, [role="button"], [role="toolbar"], [role="menu"], [role="status"], [role="alert"], [role="progressbar"], [contenteditable="true"], [data-cot], script, style, template`.
- Otherwise: `script, style, template, defs, symbol, [role="status"], [role="alert"], [role="progressbar"], [data-cot], [data-d-component="loading-block"]`.
- Then always `, [hidden], [aria-hidden="true"], [aria-busy="true"], .sr-only`.
- Bundle `299268.5b3cdf27e2.js`, the same sha256 as stage 3 (`27506c49…`).

**`[data-cot]` qualifies:**
- It is a plain `data-*` attribute selector.
- ChatGPT's only linked stylesheet (`869218a823d4.css`, 2.2 MB, fetched with a plain curl; the home
  page links no other) has no `data-cot` rule.
- Butter could set it on a held block.
- `[hidden]`, `[aria-hidden]` and `[aria-busy]` are not safe: they change rendering or what assistive
  technology reads.

**`pe`** = pv with `data-cot` in place of the opacity rule:
- It keeps a `WeakSet`, so Butter removes `data-cot` only from blocks it set it on.
- It was built and dry-checked (loads with no errors; 130 held blocks carry `data-cot`; none with
  `cv` off) but **not run** (budget).
- **It is not safe enough to recommend.**
  - Other ChatGPT code may select `[data-cot]` (it most likely marks reasoning blocks). Copy-answer,
    search or the reasoning UI could then treat or skip held answer blocks as reasoning.
  - Only this one bundle and the root stylesheet were checked; lazily loaded CSS and other bundles
    were not.
  - It has no visual risk (no opacity) and would skip the walk's `getComputedStyle` on the block.

**Risks of the veil these runs did not measure:**
- **A jump into held blocks** paints them blank for up to about 2 frames, with pv (and with pvh during
  hydration). Whether head shows text in the second of those frames is not established (Q4).
- **Other code reading opacity.** The veil changes the computed opacity of off-screen held blocks:
  - ChatGPT's telemetry stops hashing them (the intent);
  - any other reader of `opacity` or `checkVisibility({opacityProperty: true})` treats them as
    invisible. One such reader is the telemetry's other walk at 1:47685, which uses `checkOpacity`.
  - Find-in-page and text selection were not tested: Chromium's find matches inside
    `content-visibility: auto` content, and opacity 0 does not stop a match, but the match is
    highlighted on an unveiled block only after the event. Not measured.
- **An element leaving the `auto` rules by another path keeps a stale veil** (a Dil remount, or
  ChatGPT moving a block). pv's CSS scoping makes such a block compute opacity 1, because the rule
  needs `in_progress` or `data-butter-unrendered`. A stale `data-butter-unrendered` still pairs with
  the veil, as it does with skipping today.
- **pvh, a zero-height held block:** the dry page's `<hr>` blocks stay `data-butter-measure` and
  `data-butter-unrendered`, with `content-visibility: visible`. Their rendered height is 0, so the
  ResizeObserver never queues them. It is harmless on screen, but such a block is never marked seen.
  It did not happen live (`data-butter-unrendered 0` after the tail).
- **Scrollbar thumb:** with pvh the answer shrinks over about 10 s (84.7k to 36.5k px), so the
  scrollbar thumb grows and moves. View shift was 0 while wheeling after it finished; a view shift
  while it runs, with the view inside the answer, was not measured.

## Environment

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium 157 (snap) on Xvfb `:98` (1600×1000), software rendering, ChatGPT light theme |
| Lock | owner `stream-veil-1124`, lab 2 **and perf**, taken 07:27:10 UTC on 2026-11-24 (no queue), restored 07:56:22, released right after: 29.2 min of the 30 min budget, 8 of 10 harness runs. The wrapper refused runs after 1560 s; run 8 started at 1547 s. Runs 9 (pvh spread, pe or pvh2) did not fit. |
| head | `~/snap/chromium/common/stream-audit-1123/butter`, unchanged; its `stream/` equals `extension/stream/` |
| Prototypes | `~/snap/chromium/common/stream-proto-1124/{pv0,pv,pvh,pe}/butter`, copies of head with `stream/offscreen.js` (and, except pe, `stream/containment.css`) changed. Each path gives a new extension id, so no settings were stored. The patches pass `git apply --check` against `extension/`. |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 chunks |

**The prototypes as built:**
- **pv:**
  - The `contentvisibilityautostatechange` handler removes `data-butter-veil` first when an element
    stops being skipped, then does what it did.
  - When a block without `data-turn-key`, not in `shown` and without `data-butter-seen` starts being
    skipped, it gets the veil.
  - The veil is also removed at the flush, in the completion branch (for queued blocks that render),
    and from every element when `cv` goes off.
  - CSS: `opacity: 0` with the two block selector shapes.
  - **Fix after run 2:** the rule needs `[data-talvt-turn-state="in_progress"]` above, or
    `[data-butter-unrendered]` on the block; the completion branch also unveils the turn's veiled
    blocks that are not waiting.
- **pvh:** pv + P1's `pending` / `hydrate` / `later` / `data-butter-measure`, its CSS rule and the
  `<html>` counters, with `BATCH` 6, `GAP_MS` 100 and `IDLE_TIMEOUT` 1500.
  - A block hydrates only when it is not inside an `in_progress` turn.
  - `hold()` schedules idle work only outside a streaming turn.
  - The completion branch calls `later()`.
  - `hydrate()` stops instead of polling when it found nothing to hydrate (P1 rescheduled itself).
  - Setting `data-butter-measure` removes the veil.
- **pe:** pv with `data-cot` in place of `data-butter-veil` and no CSS rule, tracked in a `WeakSet`.

**Harness changes** (worktree only, not committed; REPORT lines only):
- **New `stream-veil-probe.mjs` (152 lines):**
  - `splitTail` / `tailReport` for `TAIL_MS`: the standard window is cut when the loop has run 5 s
    past completion; the tail lines cover long frames, blocking, the longest frame, frames ≥ 100 ms
    with their distance to the nearest hydration batch and flush, hydration marks, block counts and
    the last turn's height over time, and when the height first equals its final value;
  - `veilReport`;
  - the `VEILPROBE=1` frame probe and the scrollTop write to the answer's middle.
- **`stream-laf-probe.mjs` / `stream-laf-report.mjs`:** `data-butter-measure` and `data-butter-veil`
  on/off counts per observer callback (`marks.hyd`), and the standard window's end.
- **`stream-api-probe.mjs`:**
  - veiled and veiled-but-not-`auto` counts in every sample and after the window;
  - `tick(el, sinceDone)` marks the standard end; `split()`;
  - with `TAIL_MS` longer than 5 s, the stage 3 line's "window end" is the tail's end.
- **`stream-replay-live.mjs`:** `TAIL_MS`, `tw.split`, the veil probe around the wheel phase; still
  500 lines.
- **`lab/README.md`:** one sentence on the additions.
- **After the runs:** the tail-less `hydration marks in the window` line read the missing tail's
  marks and printed 0 batches in runs 6–8. It now reads the standard window's marks (checked on run
  6's capture: 64 batches, 384 blocks, most measuring 66). `data.json` has the same figures from
  `lafDetail.marks.hyd`.

`npx eslint` on the six stream harness files exits 0.

**Dry checks before the lock** (headless snap Chromium, throwaway profile, deleted afterwards;
synthetic chatgpt.com page with a 150-block `in_progress` answer):
- **Every build** (pv, pvh, pe, head) loads with no console errors.
- **pv:** 130 off-screen blocks veiled, all computing `opacity: 0` and `content-visibility: auto`.
  - A block brought into view by a scrollTop write: veiled and skipped in rAF 1–2, the event between
    rAF 2 and 3, unveiled and opacity 1 from rAF 3 (head: the same block's content renders from
    rAF 3).
  - With `cv` off through stored options: all veils removed live, none on a new stream.
  - A reduced copy of ChatGPT's walk visits 556 elements mid-stream against head's 3302.
- **pvh:** nothing hydrates while `in_progress` (pending 130, hydrated 0, measuring 0).
  - After completion: 97 hydrated, 151 seen, 0 veiled, height 16,520 px (the real height) within
    4 s.
- **After the runs, the fixed pv and pvh** on a page with `<hr>` blocks: no veiled block that
  renders; the live leak did not reproduce there (it did not with pv0 either).

## Not established

- **What the 19 never-held blocks are** (head has 20 such blocks: neither seen nor unrendered after
  completion).
- **Whether the veil adds a blank painted frame** against head after a jump (Element Timing gave no
  entries in the dry page).
- **The veil during pvh's hydration** after a jump: a jump while blocks are still held was not
  probed.
- **The middle-jump probe met no veiled blocks** (they had all been in view while wheeling), so it
  did not test a never-rendered region.
- **Spread:** one control per fixture and day. pvh has two `ats12` runs (3, 6), pv two (7, 8) plus
  pv0. `math9` has one pvh run. The 76 s stream task and the Enter keydown were not looked into.
- **pe** was not run, and the other ChatGPT bundles and lazily loaded CSS were not searched for
  `data-cot`.
- **Find-in-page, selection, copy and screen readers** with veiled blocks.

## Clean-up

- `lab-restore --lab 2 --owner stream-veil-1124` restarted the browser without extensions, put the
  home URL back and cleared the composer (`"ok":true`, exit 0).
- `lab-lock release` freed lab 2 and perf. `lab-lock status` prints `"held": false` for lab 1, lab 2
  and perf ([restore.log](restore.log), [release.log](release.log)).
- No settings were written (no `OPTS`; the dry checks used a throwaway profile).
