# Smoother streaming: settle (S) and a read fast path (Z) against the completion frame — 2026-11-24 (stage 3)

Lab run and scratch prototypes; no file under `extension/` changed. Lab 2, fixtures `ats12` and
`math9`, one outer lock with the perf lock (owner `stream-settle-1124`). The send guard was on in
every connection and no message was sent: every replay printed `PASS no-escape` and
`PASS server-unchanged`. Raw captures (per-run JSON with every frame, unsanitized logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-stream-settle/`.

## Result

**Settle removes the forced reads but not the cost: the one pass lands in ChatGPT's stream task.**
With S, ChatGPT's completion `requestAnimationFrame` callback takes 44–46 ms with 0 forced (control
1217 ms, 1165 forced; native 46 ms, 0 forced). But the style and layout pass that renders the
612 blocks runs inside ChatGPT's stream task of the same frame: the task grows from 635 ms
(197 forced) to 1467–1550 ms (1050–1133 forced). The completion frame is 1598–1679 ms against the
control's 1877 ms (−10 to −15%). The one pass costs about 0.85–0.94 s, against about 1.16 s for the
~930 small forced passes it replaces.

**Laying the blocks out early (P1) adds nothing under S.** `p1s` 1641 ms against `ps` 1679 ms;
`p1s` costs +22% blocking again.

**Z works as built and changes nothing.** 558 fast reads in the completion frame and 66,163 over the
window. The rAF callback is 1216 ms with 1164 forced, the same as the control. ChatGPT reads
`scrollTop` on the same element right after `scrollLeft`
(`d.left!==c.scrollLeft||d.top!==c.scrollTop`), and that read now forces the layout. The dry check
predicted this before the lock: reading only `scrollLeft` across 200 skipped spans took 0 ms with
Z (97 ms with head), but reading `scrollLeft` and then `scrollTop` took 92–100 ms.

**The reads are ChatGPT's paint-readiness telemetry,** not the stream smoother: the completion rAF
callback is the sampler `()=>B()` of module `AORd`, which hashes what is visible in the answer.

**Targets:** no arm reaches 1.0 s. The best is `psz` at 1598–1643 ms on `ats12` (1676 ms on
`math9`). The floor is ChatGPT's own stream task, about 0.62 s with 0.19 s forced, as natively.

## Results table

**head** = `0.1.0-alpha.22+streamaudit.1`, a test build of `b2df865` (= `origin/main`), at
`~/snap/chromium/common/stream-audit-1123/butter`. The prototypes are copies under
`~/snap/chromium/common/stream-proto-1124/<name>/butter`:
- **ps** = head + S ([ps.patch](ps.patch));
- **p1s** = stage 2's P1 + S ([p1s.patch](p1s.patch), including P1);
- **pz** = head + Z ([pz.patch](pz.patch));
- **psz** = head + S + Z ([psz.patch](psz.patch)).

`psz` is the combined build (PC): `ps`'s completion frame (1678.8 ms) was within 10% of `p1s`'s
(1641.4 ms). No build had settings stored, and `data-butter-off` was `layout` in every run. All runs
used `stream-replay-live.mjs`. The window runs from Enter to 5 s after `in_progress` is gone, about
112.6 s.

| # | Run | Fixture | Options | LoAF | blocking | long-frame total | longest (start) | ≥200 / ≥500 / ≥1000 | forced sum | Exit | Log |
|---|---|---|---|---:|---:|---:|---|---|---:|---:|---|
| 1 | head (control) | `ats12` | stream | 320 | **6650** | 25483 | **1877** (105030, completion) | 7 / 1 / 1 | 3964 | 0 | [log](head-ats12.log) |
| 2 | ps | `ats12` | stream | 330 | **6276** | 25748 | **1679** (105129, completion) | 8 / 1 / 1 | 3332 | 0 | [log](ps-ats12.log) |
| 3 | p1s | `ats12` | stream | 451 | **8098** | 34568 | **1641** (105037, completion) | 7 / 1 / 1 | 3742 | 0 | [log](p1s-ats12.log) |
| 4 | pz | `ats12` | stream | 348 | **6446** | 26979 | **1861** (105024, completion) | 7 / 1 / 1 | 3580 | 0 | [log](pz-ats12.log) |
| 5 | psz | `ats12` | stream | 320 | **5895** | 24742 | **1621** (105026, completion) | 6 / 1 / 1 | 3196 | 0 | [log](psz-ats12-1.log) |
| 6 | psz | `math9` | stream | 496 | 10333 | 39733 | 1676 (105040, completion) | 9 / 2 / 1 | 4213 | 0 | [log](psz-math9.log) |
| 7 | psz | `ats12` | all phases | 345 | 6073 | 26470 | 1643 (105026, completion) | 8 / 1 / 1 | 3346 | 0 | [log](psz-ats12-all.log) |
| 8 | psz | `ats12` | stream | 330 | 6531 | 26111 | 1598 (105030, completion) | 7 / 1 / 1 | 3329 | 0 | [log](psz-ats12-2.log) |

Times are in ms after Enter. "forced sum" is forced style/layout summed over all long frames. Every
log ends in `SUMMARY <label>: 0 FAILs`.

### The completion frame

| Run | start | duration | stream task / forced | rAF callback / forced | rAF part | render part |
|---|---:|---:|---|---|---:|---:|
| head `ats12` (control) | 105030.2 | **1876.7** | 635.0 / 196.7 | **1216.8 / 1164.9** | 1228.5 | 11.2 |
| ps `ats12` | 105128.8 | **1678.8** | **1550.4 / 1069.7** | 45.8 / 0 | 102.1 | 8.7 |
| p1s `ats12` | 105036.6 | **1641.4** | **1544.9 / 1079.9** | 45.7 / 0 | 88.1 | 7.2 |
| pz `ats12` | 105024.1 | **1860.8** | 618.4 / 186.9 | **1215.9 / 1163.7** | 1229.1 | 10.5 |
| psz `ats12` run 5 | 105025.7 | **1621.1** | 1503.4 / 1049.8 | 43.6 / 0 | 106.4 | 8.6 |
| psz `ats12` run 8 | 105029.6 | **1598.3** | 1467.3 / 1059.4 | 46.3 / 0 | 119.2 | 9.6 |
| psz `ats12` all phases | 105025.8 | 1642.6 | 1524.8 / 1073.5 | 45.9 / 0 | 105.9 | 9.5 |
| psz `math9` | 105040.4 | 1676.4 | 1546.1 / 1132.6 | 44.9 / 0 | 110.6 | 14.2 |
| stage 1 head `math9` (other sequence) | 105049.3 | 1940.0 | 648.3 / 198.0 | 1260.7 / 1206.2 | — | — |
| stage 1 native `ats12` (other sequence) | 105321.3 | 792.0 | 644.8 / 191.7 | 45.7 / 0 | — | — |
| stage 1 native `math9` (other sequence) | 105363.7 | 878.0 | 694.5 / 247.3 | 45.7 / 0 | — | — |

The stream task is ChatGPT's work inside the replay hook's timer task (`other`,
`TimerHandler:setTimeout`). The rAF callback is ChatGPT's `299268.5b3cdf27e2.js`
`FrameRequestCallback`.

REPORT (run 2):
`completion frame: start 105128.8 ms, duration 1678.8, blocking 1611.2, script part 1568, rAF part 102.1, render part 8.7; scripts 1550.4/1069.7 forced other user-callback "TimerHandler:setTimeout"; 45.8/0 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"`

## Q1. Each arm against the control, `ats12`

| | control | ps | p1s | pz | psz 5 | psz 8 | psz 7 (all) |
|---|---:|---:|---:|---:|---:|---:|---:|
| completion frame | 1877 | 1679 | 1641 | 1861 | 1621 | 1598 | 1643 |
| stream task / forced | 635 / 197 | 1550 / 1070 | 1545 / 1080 | 618 / 187 | 1503 / 1050 | 1467 / 1059 | 1525 / 1074 |
| rAF callback / forced | 1217 / 1165 | 46 / 0 | 46 / 0 | 1216 / 1164 | 44 / 0 | 46 / 0 | 46 / 0 |
| render part | 11.2 | 8.7 | 7.2 | 10.5 | 8.6 | 9.6 | 9.5 |
| longest frame (start) | completion (105.0 s) | completion (105.1 s) | completion | completion | completion | completion | completion |
| ≥200 / ≥500 / ≥1000 | 7 / 1 / 1 | 8 / 1 / 1 | 7 / 1 / 1 | 7 / 1 / 1 | 6 / 1 / 1 | 7 / 1 / 1 | 8 / 1 / 1 |
| blocking | 6650 | 6276 (−6%) | 8098 (+22%) | 6446 (−3%) | 5895 (−11%) | 6531 (−2%) | 6073 (−9%) |
| blocking without the completion frame | 4826 | 4665 | 6507 | 4638 | 4327 | 4985 | 4483 |
| long-frame total | 25483 | 25748 | 34568 | 26979 | 24742 | 26111 | 26470 |
| forced style/layout, all long frames | 3964 | 3332 | 3742 | 3580 | 3196 | 3329 | 3346 |
| publish interval p10 / median | 256.9 / 267.1 | 257.8 / 267.1 | 251.3 / 267.8 | 255.4 / 267.0 | 257.7 / 267.2 | 256.3 / 267.0 | 255.8 / 267.3 |

**Blocking per 10 s from Enter** (ms):

| s | 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| control | 393 | 5 | 26 | 61 | 763 | 172 | 240 | 642 | 718 | 1192 | 2438 |
| ps | 256 | 0 | 23 | 192 | 372 | 190 | 209 | 833 | 575 | 1017 | 2610 |
| p1s | 248 | 0 | 34 | 80 | 383 | 257 | 375 | 1084 | 1123 | 1820 | 2694 |
| pz | 294 | 1 | 31 | 67 | 514 | 185 | 300 | 679 | 520 | 1269 | 2584 |
| psz 5 | 259 | 0 | 32 | 59 | 417 | 83 | 154 | 690 | 503 | 1355 | 2343 |
| psz 8 | 294 | 6 | 44 | 66 | 367 | 168 | 331 | 769 | 581 | 1327 | 2578 |
| psz 7 | 262 | 0 | 19 | 62 | 369 | 206 | 187 | 885 | 529 | 1100 | 2454 |

- **One control.** Stage 2's control blocked 7369 ms and stage 1's 7100–7120 ms, so differences of
  ±10% between arms are within the day-to-day spread. Only `p1s`'s +22% stands out, as P1's
  +15–16% did in stage 2.
- **Frames of at least 200 ms,** in every run:
  - the Enter keydown (0 s) and the frame after it;
  - a ChatGPT rAF callback at 42.1–42.4 s (280–334 ms, 245–283 forced; also 46.8 s in the control);
  - a stream task at 76.2 s (330–359 ms);
  - the completion frame;
  - a frame of 274–294 ms with 0 blocking just after it (the control has it too: 294 ms at 106.9 s).
- **New with S:** a frame of 198–213 ms when `data-butter-settle` is removed (Q2).

## Q2. Settle

- **The reads stopped forcing.** The rAF callback's forced part went from 1165 ms to 0 in all six
  S runs, and the callback itself from 1217 ms to 44–46 ms, as natively (45.7 ms, 0 forced, in
  stage 1).
- **The cost and where it landed: in ChatGPT's stream task.**
  - Its forced part grew from 197 to 1050–1080 ms on `ats12`, and to 1133 ms on `math9` (stage 1
    head `math9`: 198 ms).
  - That makes the one pass about 853–883 ms on `ats12` and 935 ms on `math9`.
  - The rAF part (88–119 ms) and the render part (7–14 ms) stay small.
- **Why it lands in the stream task** (inferred from the timing, not traced):
  - `off − SETTLE_MS` puts the `settle()` call 0.49–0.58 s into the completion frame. That is when
    the turn leaves `in_progress`: the control's `in_progress gone` mark is 0.56 s in.
  - Something in the same task then reads layout while the whole answer renders. The harness's own
    MutationObserver ran only after that read: its `in_progress gone` mark moved to 1.40–1.50 s
    into the frame in S runs, against 0.56 s in the control and `pz`.
  - Who makes the read is not established.
- **No new long frame at the flush.** The marks flush in one batch (+567 seen, −565 to −567
  unrendered) 0.3–1.3 s after the completion frame. `ps` and `psz` 5/8 have no frame of at least
  50 ms within 100 ms of that batch; runs 6–7 have a frame of 59–62 ms.
- **A new frame of about 200 ms when `data-butter-settle` is removed,** in every S run: 204.8 /
  205.4 / 198.2 / 197.8 / 208.1 / 212.7 ms. It is almost all render part (about 200 ms; blocking
  154–162 ms), when the 592 blocks are skipped again. It comes 1.53–1.60 s after the settle-on mark,
  that is 2.5 s after `settle()`.
  - REPORT (run 2): `settle marks: on@106632.5 off@108208.3; frames >= 50 ms within 300 ms of each off: [204.8@108207.5]`
  - REPORT (run 2): `butter mark batches in the 6 s after in_progress gone: +567s/-567u@107806.4 frames>=50 []`
- **When `ps`'s answer has its real height.** The last turn was 84,788 px at 104.36 s and 36,503 px
  at the first sample after the completion frame (107.34 s; the frame ended at 106.81 s). The pass
  inside the completion frame lays every block out, so the height is real from that frame on.
  - REPORT (run 2): `last turn height: before the completion frame 84788 px at 104355 ms; 1 s after in_progress gone 36503 px at 107573.5 ms; window end 36503 px at 112534.2 ms; after the window 36503 px; at its final height from 107335 ms (702.5 ms after in_progress gone)`
  - The "ms after in_progress gone" in that line counts from the harness's delayed mark, so use the
    absolute times.
- **After the window, every S run:** `blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 592, data-butter-unrendered 0, data-butter-settle left 0`.
  The control: `… auto 592, data-butter-seen 26, data-butter-unrendered 566, …`.

**The last turn's height at the three moments:**

| Run | before completion | 1 s after `in_progress` gone | window end |
|---|---:|---:|---:|
| control | 84,652 | 84,672 | 84,672 |
| ps | 84,788 | 36,503 | 36,503 |
| p1s | 37,085 | 36,503 | 36,503 |
| pz | 84,788 | 84,578 | 84,578 |
| psz 5 / 8 / 7 | 84,788 / 84,516 / 84,788 | 36,503 | 36,503 |
| psz `math9` | 84,788 | 36,503 | 36,503 |

## Q3. Z

- **Fast path against native reads:**
  - `pz`, at the window's end: fast 66,163, native 29,000;
  - from the last sample before the completion frame to the end: fast +558, native +150;
  - `psz`: fast 64,998–65,445, native 28,600–28,735 on `ats12`; 61,617 / 27,631 on `math9`.
  - REPORT (run 4): `read fast path (Z): at the window's end fast 66163, native 29000; from the last sample before the completion frame (104656 ms: fast 65605, native 28850) to the end: fast +558, native +150`
- **The `scrollLeft` share of the completion frame:** not measured directly (no API probe in this
  stage). The rAF callback is 1215.9 / 1163.7 ms forced against the control's 1216.8 / 1164.9, so
  the forced cost did not shrink. The cause is in ChatGPT's code (chatgpt-reads.txt, `u`): after
  `scrollLeft` comes a `scrollTop` read on the same element, which Z does not wrap and which now
  forces. The dry check measured the same.
- **Forced style/layout over the whole stream:**
  - 3580 ms against 3964 for the control (2229 against 2603 without the completion frame);
  - the mid-stream ChatGPT rAF frame at 42.4 s is unchanged (310 / 283 forced against 310 / 282);
  - the difference is within the spread between runs (`ps`, without Z, 2263 ms).
- **Total blocking:** 6446 against 6650 ms (−3%), within the spread.

## Q4. The combined build (`psz`)

- **`ats12`, runs 5 and 8:**
  - completion frame 1621 / 1598 ms (run 7, all phases, 1643);
  - stream task 1503 / 1467 ms (forced 1050 / 1059); rAF callback 44 / 46 ms, 0 forced;
  - longest frame: the completion frame in both;
  - ≥200/500/1000: 6/1/1 and 7/1/1;
  - blocking 5895 / 6531 ms; long-frame total 24,742 / 26,111 ms;
  - publish interval median 267.2 / 267.0 ms.
  - The other figures are in the Q1 tables. The three `ats12` runs agree within 45 ms (2.8%) on
    the completion frame.
- **`math9` (run 6) against stage 1, which is another sequence and day:**

  | | psz `math9` | stage 1 head `math9` | stage 1 native `math9` |
  |---|---:|---:|---:|
  | completion frame | 1676 | 1940 | 878 |
  | stream task / forced | 1546 / 1133 | 648 / 198 | 695 / 247 |
  | rAF callback / forced | 45 / 0 | 1261 / 1206 | 46 / 0 |
  | longest frame | completion (Enter 592 ms) | completion | Enter keydown, 1543 ms |
  | ≥200 / ≥500 / ≥1000 | 9 / 2 / 1 | 7 / 2 / 1 | 165 / 5 / 1 |
  | blocking | 10,333 | 10,897 | 61,358 |
  | long-frame total | 39,733 | 42,172 | 92,838 |

  Stage 1 measured about ±20% blocking across days on `math9`.

## Q5. Run 7 (`psz`, `ats12`, all phases)

- **Answer:** last turn 36,503 px high; scrollHeight 46,873 px after the window (46,841 at the end of
  the wheel phase). Head's control: 84,672 / 95,042 px.
- **Steps where scrollTop moved beyond the wheel step:** 0 of 55 up, 0 of 55 down.
- **View shift:** up 0/55 over 4 px (in the streamed answer 0/53), median 0, max 0; down 0/55 (in
  the answer 0/52), median 0, max 0. Of 110 steps, 92 tracked a block, 17 a turn and 1 a user
  bubble.
- **Verdicts:** `PASS wheel-no-jump`, `PASS stream-no-jump`.
- **View while streaming:** never at the end (0/443 samples); scrollTop stayed at 9622, as with head.

REPORT: `view shift up (55 steps): 0/55 over 4px, median 0, max 0 (lost 0, none 0, clamped 0); in the streamed answer: 0/53 over 4px, median 0, max 0 (lost 0, none 0, clamped 0)`

## Q6. Existing verdicts

All 7 prototype runs printed `PASS` for `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`,
`seen-marks`, `throttle-matched`, `stream-no-jump`, `rail-new-tick`, `rail-new-tick-lit`,
`no-escape` and `server-unchanged`; run 7 also printed `PASS wheel-no-jump`. Every exit was 0.

## Q7. Against the targets

- **Half of head's (about 1.0 s): no arm reaches it.**
  - `psz` 1598–1643 ms (−12 to −15%), `p1s` 1641, `ps` 1679, `pz` 1861 on `ats12`;
  - `psz` 1676 ms on `math9`.
- **Half of native's (0.39 s on `ats12`, 0.77 s on `math9`): not reached.**
- **The floor:** ChatGPT's own stream task in the completion frame. This sequence: 618–635 ms
  (187–197 forced) without S. Stage 1 natively: 645 / 192 ms on `ats12` and 695 / 247 ms on
  `math9`. With the rAF callback at its native 46 ms and a render part of about 10 ms, a completion
  frame to which Butter adds nothing is about 0.68 s on `ats12` and 0.75 s on `math9`.
  - 0.39 s on `ats12` is below that floor and needs ChatGPT's stream task itself to shrink.
  - 0.77 s on `math9` would leave Butter about 20 ms.
- **What would have to change** (none of it tried):
  - The ~0.9 s pass that renders the answer must leave the completion frame, or ChatGPT's reads into
    skipped blocks must stop forcing without a pass.
  - Z extended to `scrollTop` would address the `u` part (stage 2: about 820 ms in the rAF part).
    `A`'s forced style/layout from reading a computed style (stage 2: about 415 ms) cannot be
    wrapped, so the estimate is about 0.62 + 0.42 + 0.05 ≈ 1.1 s.
  - S cannot move its pass to another frame: the telemetry's rAF callback runs in the same frame
    as the stream task.

## Q8. What ChatGPT's reads are for, and the risk

Source excerpts: [chatgpt-reads.txt](chatgpt-reads.txt). The bundle's hash has not changed since
stage 2 (`299268.5b3cdf27e2.js`). A plain `curl` of its public asset URL (no cookies) returned it.
All six columns are in one webpack module, `AORd`: ChatGPT's paint-readiness telemetry for a
streamed turn. It calls `recordLastVisible("markdown"|"frame", …)`,
`recordDILFirstVisibleToken`, `skipTalvt`, `skipFirstPaint`, `talvtReadiness` and
`observePaintReadiness`.

- **`A` (1:41434 / 41468 / 41839 / 42317)** is the recursive walk of `read()`. For each element it
  does the following:
  - `getComputedStyle`, then returns early if `display` is `none` or `opacity` is `"0"` (41468, where
    the trace put the forced layouts).
  - It clips by the element when its overflow is not `visible`, with `getBoundingClientRect`,
    `offsetWidth`/`Height` and `clientLeft`/`Top`/`Width`/`Height`, and registers that element for
    the scroll check.
  - It caches per block (`p, h1…, div, …`) by rect, clip and origin (41839 is the recursion on a
    cache miss).
  - It recurses into children (42317) and hashes visible text through `Range` rects (FNV-1a), along
    with positions, colours, fonts, image and SVG attributes, backgrounds and borders.
  - The result is a fingerprint of what is visible in the answer.
- **`u` (1:50555)** answers "did anything scroll or resize": it compares the window size and the
  `scrollLeft`/`scrollTop` of every registered element (the turn's ancestors and each
  overflow-clipping element the walk met, such as KaTeX and code spans) with the last values.
- **`B` (1:51325)** is the sampler, run in a rAF that `A()` (a different function named `A`)
  schedules on each mutation, transition or animation start in the turn.
  - It returns if the page is hidden or the turn closed, and stops observing (`skipTalvt`) if
    something scrolled after content was seen.
  - Otherwise it recomputes the hash when invalidated and reports it via
    `onSample → recordLastVisible`.
  - When the turn state is `complete`, it samples one last time and disposes itself.
- **The completion callback is that sampler's `()=>B()` (1:51055),** not the stream smoother's
  publish callback (`() => { this.frame = void 0, this.publish() }`). Butter's throttle does not
  touch it.

What a user could see differently:

- **Z (`scrollLeft` reads 0 under a skipped ancestor):**
  - For this module, nothing on screen. A wrong 0 could only make the telemetry decide a container
    scrolled and stop observing that answer.
  - For any other reader of `scrollLeft` inside a skipped block, the value is wrong only for an
    element that scrolled sideways with no scroll event yet (events arrive a frame later) and without
    the setter or `scrollTo`/`scrollBy`/`scroll`, for example via `scrollIntoView` or focus. Such an
    element is off screen, and it reads natively again once it renders.
  - Low risk, and no benefit as built.
- **S (blocks render for 2.5 s after completion):**
  - **The freeze stays, in a new place.** The completion freeze is still about 1.6 s and now falls
    in ChatGPT's stream task, when the answer is marked complete.
  - **A hitch at removal.** The removal 2.5 s later brings a ~200 ms frame, which a user typing the
    next prompt could feel.
  - **The scrollbar changes at completion.** The answer shrinks from the placeholder's 84.7k px to
    its real 36.5k px, so the scrollbar thumb changes size and position.
  - **A possible view shift (not measured).** If the view is inside the answer below blocks that
    never rendered (only after a jump: scrollbar drag, rail, seek, End), those blocks grow or shrink
    above the view with anchoring off and the view shifts. Run 7's view sat above the answer's
    unrendered part, and `stream-no-jump` only catches falls of more than a viewport.
  - **The cost of rendering the whole answer.** For 2.5 s, any scrolling or typing pays for it; no
    long frame other than the removal one was seen in that window.

## Environment

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium 157 (snap) on Xvfb `:98` (1600×1000), software rendering, ChatGPT light theme |
| Lock | owner `stream-settle-1124`, lab 2 **and perf**, taken 06:34:22 UTC on 2026-11-24 (no queue), restored 07:01:57, released right after. 27.6 min of the 30 min budget, 8 of 10 harness runs (the wrapper refused new runs after 1560 s; run 8 ended at 1640 s). |
| head | `~/snap/chromium/common/stream-audit-1123/butter`, unchanged |
| Prototypes | copies of head (or of stage 2's P1) at `~/snap/chromium/common/stream-proto-1124/{ps,p1s,pz,psz,p1sz}/butter`. Each new path gives a new extension id, so no settings were stored. `p1sz` was built and dry-checked but not run (PC = `psz`). The patches pass `git apply --check` against `extension/`. |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 chunks |

**S worked as written:**
- It observes `data-talvt-turn-state` with `attributeOldValue`.
- On a record whose old value is `in_progress`, if the turn no longer is or holds an `in_progress`
  element, it sets `data-butter-settle` on the turn (independent of `waiting.size || queue.size`).
  ChatGPT's new value is `complete`.
- Held blocks of that turn leave `skipped`/`waiting` (and P1's `pending`), join `shown` and are
  `ro.observe`d.
- `setTimeout(2500)` then a `requestAnimationFrame` removes the attribute.
- The CSS rule has the two selector shapes and the same specificity as the block rules, comes later
  in the file and sets `content-visibility: visible`.
- With `cv` off nothing is set.

**Z worked as written:**
- New MAIN-world file `stream/read-fast-main.js`, listed after `stream/throttle-main.js`.
- It keeps the two `WeakSet`s, wraps the `scrollLeft` getter and setter with the descriptor's flags,
  and wraps `Element.prototype.scrollTo`/`scrollBy`/`scroll`.
- Counters on `window[Symbol.for('chatgpt-butter.read-fast')]`; native reads when `cv` is off.
- It did not shorten the frame, because of the `scrollTop` read that follows (Q3).

Harness changes (worktree only, not committed; REPORT lines only):
- **`stream-api-probe.mjs` (251 lines):**
  - each sample adds the last turn's height, the settle count and Z's counters, every tick for 6 s
    after `in_progress` goes;
  - new REPORT lines: `blocks after the window`, `last turn height`, `settle marks`,
    `butter mark batches in the 6 s after in_progress gone`, `read fast path (Z)`.
- **`stream-laf-probe.mjs` / `stream-laf-report.mjs`:** record `data-butter-settle` on/off marks on
  the frame clock.
- **`stream-replay-live.mjs`:** unchanged (500 lines).
- **`lab/README.md`:** one sentence on the additions.

`npx eslint` on the five stream harness files exits 0.

Dry checks before the lock (headless snap Chromium, throwaway profile, deleted afterwards):
- **Every build loads** on a synthetic chatgpt.com page with no console errors.
- **S** (`ps`, `p1s`, `psz`, `p1sz`), on a synthetic answer of 150 blocks:
  - before completion: 130 unrendered (`ps`), all `auto`;
  - at completion: `data-butter-settle` on, all 151 `visible`;
  - 1.5 s later: 151 seen, 0 unrendered;
  - 3.3 s later: the attribute gone, all `auto`; height 16,520 px, exactly the real height;
  - with `cv` off through stored options: no settle attribute.
- **Z** (`pz`, `psz`, `p1sz`): in a skipped block, an unscrolled span read 0 through the fast path
  (fast +1); a span scrolled to 50 before it was skipped still read 50; with `data-butter-off=cv`,
  native.

## Not established

- **Who reads layout in the stream task after `settle()`,** which makes the pass land there. No API
  probe or trace was run in this stage.
- **Why the pass costs about 0.9 s even when P1 has laid every block out before** (`p1s`).
- **Z with `scrollTop`** (Z') was not built.
- **Spread:** one control. `ps`, `p1s` and `pz` have one run each, `psz` three on `ats12`.
  `math9` was compared against stage 1's runs from another day. Native was not run in this sequence.
- **`SETTLE_MS`** was not tuned. Whether a shorter settle shrinks the ~200 ms removal frame is
  unknown.
- **A view shift at completion** with the view inside an answer that has unrendered blocks above it
  (Q8) was not measured.

## Clean-up

- `lab-restore --lab 2 --owner stream-settle-1124` restarted the browser without extensions, put
  the home URL back and cleared the composer (`"ok":true`, exit 0).
- `lab-lock release` freed lab 2 and perf. `lab-lock status` prints `"held": false` for lab 1,
  lab 2 and perf ([restore.log](restore.log), [release.log](release.log)).
- No settings were written (no `OPTS`; the dry checks used a throwaway profile).
