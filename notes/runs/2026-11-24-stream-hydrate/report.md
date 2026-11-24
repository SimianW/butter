# Smoother streaming: what forces the completion frame's layout, and idle hydration (P1) — 2026-11-24 (stage 2)

Lab run and a scratch prototype; no file under `extension/` changed. Lab 2, fixtures `ats12` and
`math9`, one outer lock with the perf lock (owner `stream-hydrate-1124`). The send guard was on in
every connection and no message was sent: every replay printed `PASS no-escape` and
`PASS server-unchanged`. Raw captures (per-run JSON with every frame, the trace, unsanitized logs)
stay in `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-hydrate/`.

## Result

**The forced layout is ChatGPT reading layout from inside skipped blocks, one read at a time.**
ChatGPT's completion `requestAnimationFrame` callback (`299268.*.js`, the anonymous function at
`1:51055`) walks the finished answer:

1. `B` (`1:51325`) → `u` (`1:50555`) reads **`scrollLeft` on `<span>`s inside the streamed answer**:
   352 calls, 821 ms in the rAF part (P1 run 7). Each read inside a block that
   `content-visibility: auto` skips makes Chromium update that block's style and layout on the
   spot. The trace shows 255 forced style recalcs (732 ms, 25,248 elements, up to 644 per recalc)
   and 55 forced layouts (94 ms) from this site.
2. A recursive `A` (`1:41839` → `1:42317` → `1:41468`) calls `getComputedStyle` (`1:41434`) and
   then forces a layout at `1:41468`, probably by reading a property of the computed style. Chromium
   has no accessors for those reads, so the probe cannot wrap them. The trace shows 309 forced
   layouts (351 ms, 12,743 dirty objects) and 309 style recalcs (64 ms) from this site.

The trace's forced work in the rAF part, 796 ms of style recalcs plus 445 ms of layout (1241 ms),
matches the LoAF entry's 1238 ms of forced style and layout in that callback.

**Laying the blocks out early does not change the completion frame.** P1 hydrated every held block
while the answer streamed. 5–14 were still `data-butter-unrendered` just before the completion frame,
and 0 five seconds after. The finished answer is 36,503 px tall, the same as native. But the
completion frame is 1.84–2.01 s against 1.91 s for the control, and its rAF callback forces
1174–1270 ms against 1222 ms. A block that has been laid out and is skipped again is forced again
when ChatGPT reads into it. What costs is being skipped at the moment of the read, not never having
rendered.

**On the hypothesis:**
- **Mechanism, the first sentence: right.** A layout-dependent API on elements inside the answer
  forces the skipped subtrees.
- **"All 565 at once": wrong.** It is about 930 small forced passes of 1–17 ms each.
- **"Earlier layout removes both costs": wrong for the completion frame, right for the height.**

## Results table

**head** = `0.1.0-alpha.22+streamaudit.1`, a test build of `b2df865` (= `origin/main`), at
`~/snap/chromium/common/stream-audit-1123/butter`. **P1** = the same build with
[p1.patch](p1.patch) (only `stream/offscreen.js` and `stream/containment.css` changed), at
`~/snap/chromium/common/stream-proto-1124/p1/butter`. Neither build had settings stored, and
`data-butter-off` was `layout` in every run. All runs used `stream-replay-live.mjs`. The window runs
from Enter to 5 s after `in_progress` is gone, about 112.6 s.

| # | Run | Fixture | Options | LoAF | blocking | long-frame total | longest (start) | ≥200 / ≥500 / ≥1000 ms | Exit | Log |
|---|---|---|---|---:|---:|---:|---|---|---:|---|
| 1 | head | `ats12` | `APIPROBE=1` | 328 | 7382¹ | 26840 | 1952 (105055, completion) | 8 / 2 / 1 | 0 | [log](head-ats12-apiprobe.log) |
| 2 | head (control) | `ats12` | — | 347 | **7369** | 28087 | **1911** (105134, completion) | 8 / 2 / 1 | 0 | [log](head-ats12.log) |
| 3 | P1 | `ats12` | — | 494 | **8445** | 37248 | **1956** (105023, completion) | 7 / 1 / 1 | 0 | [log](p1-ats12-1.log) |
| 4 | P1 | `ats12` | — | 464 | **8562** | 35838 | **1844** (105022, completion) | 6 / 1 / 1 | 0 | [log](p1-ats12-2.log) |
| 5 | P1 | `ats12` | all phases | 468 | 8613 | 36159 | 2015 (105049, completion) | 7 / 1 / 1 | 0 | [log](p1-ats12-all.log) |
| 6 | P1 | `math9` | — | 637 | 15142 | 52895 | 1909 (105135, completion) | 12 / 2 / 1 | 0 | [log](p1-math9.log) |
| 7 | P1 | `ats12` | `APIPROBE=1` | 501 | 9737¹ | 38882 | 2007 (105020, completion) | 7 / 1 / 1 | 0 | [log](p1-ats12-apiprobe.log) |
| 8 | P1 | `ats12` | `TRACE_AT=105500` | 460 | 8680 | 35736 | 1964 (105024, completion) | 8 / 1 / 1 | 0 | [log](p1-ats12-trace.log) |

Times are in ms after Enter. Every log ends in `SUMMARY <label>: 0 FAILs`.
¹ The armed probe adds work from 100 s on (the 100 s bucket: 3432 ms in run 7 against 2861–2918 ms
in runs 3–4). Do not compare probe runs on blocking.

### The completion frame

| Run | start | duration | stream task / forced | rAF callback / forced |
|---|---:|---:|---|---|
| head `ats12` (control, run 2) | 105134.0 | 1910.5 | 608.5 / 181.8 | **1275.1 / 1222.1** |
| head `ats12` probe (run 1) | 105055.4 | 1952.3 | 637.5 / 183.7 | 1286.2 / 1199.4 |
| P1 `ats12` run 3 | 105023.2 | 1956.4 | 677.9 / 183.0 | **1254.0 / 1201.1** |
| P1 `ats12` run 4 | 105021.7 | 1844.4 | 595.3 / 181.8 | **1226.1 / 1173.9** |
| P1 `ats12` all phases | 105049.3 | 2014.9 | 664.3 / 180.3 | 1327.3 / 1269.9 |
| P1 `ats12` probe | 105020.2 | 2006.8 | 695.7 / 182.1 | 1284.5 / 1195.9 |
| P1 `ats12` trace | 105023.8 | 1963.7 | 620.8 / 177.9 | 1319.8 / 1238.3 |
| P1 `math9` | 105134.5 | 1908.6 | 631.7 / 201.2 | 1250.0 / 1195.9 |
| stage 1 head `math9` (other sequence) | 105049.3 | 1940.0 | 648.3 / 198.0 | 1260.7 / 1206.2 |
| stage 1 native `ats12` (other sequence) | 105321.3 | 792.0 | 644.8 / 191.7 | 45.7 / 0 |

The stream task is ChatGPT's work inside the replay hook's timer task (`other`,
`TimerHandler:setTimeout`). The rAF callback is ChatGPT's `299268.*.js` `FrameRequestCallback`.

## Q1. Which API calls force the layout in the completion rAF callback?

**Probe, P1 run 7.** Every wrapped call starting inside the rAF part (105723–107017 ms), summed in
50 ms bins:
`{"scrollLeft":{"n":352,"ms":820.9},"Element.getBoundingClientRect":{"n":742,"ms":7.1},"Element.checkVisibility":{"n":1322,"ms":4.1},"offsetWidth":{"n":632,"ms":2.2},"Range.getBoundingClientRect":{"n":219,"ms":1.8},"offsetHeight":{"n":632,"ms":1.7},"scrollTop":{"n":361,"ms":1.5},"getComputedStyle":{"n":2088,"ms":1.5},...}`.

- `scrollLeft` is 821 of the 1196 ms forced (69%). Every other wrapped API together is about 20 ms.
- **Calls of at least 5 ms:** 38 from the page, 0 from the harness. 36 are `scrollLeft` (315 ms),
  all with the target `<span> [] in-answer in-last-turn` and the stack
  `u@299268.5b3cdf27e2.js:1:50555 < B@299268.5b3cdf27e2.js:1:51325 < @299268.5b3cdf27e2.js:1:51055`.
  The longest is 17.1 ms.
- **The rest (about 375 ms) is not a wrapped call.** The trace places it in `A`: 309 forced layouts
  plus 309 style recalcs, 415 ms. That stack's last frame is `1:41468`, 34 columns after the
  `getComputedStyle` call at `1:41434` that the probe saw (`getComputedStyle 6.7 ms at 104871.6`,
  stack `A@…:41434 < A@…:42317 < A@…:41839`). A read of a layout-dependent computed value is the
  likely trigger, but it cannot be wrapped and was not seen directly.

**Trace, P1 run 8, rAF part 105645–106975 ms:**

| Source (top frames) | Forced style recalcs | Forced layouts | Total |
|---|---|---|---:|
| `u@…:50555 < B@…:51325 < @…:51055` | 255, 732.2 ms, 25,248 elements | 55, 94.0 ms | 826 ms |
| `A@…:41468 < A@…:42317 < A@…:41839` | 309, 63.8 ms, 700 elements | 309, 350.8 ms, 12,743 dirty objects | 415 ms |
| total | 565, 796.1 ms | 364, 444.7 ms | **1241 ms** (LoAF forced 1238.3) |

**Head (run 1).** The same call site and target: 33 `scrollLeft` calls of at least 5 ms on
`<span> in-answer in-last-turn` from `u < B < (anonymous)`, 300 ms (P1: 36 calls, 315 ms). Over the
whole armed window `scrollLeft` totals 9,133 calls and 914 ms (P1: 11,575 calls and 936 ms). The
per-frame bins were added after run 1, so head's sum inside the frame is inferred, not measured.

**The stream task's forced part** (about 180 ms in every run) is one call:
`clientHeight 178.7–183.3 ms` on the scroller (`<div> [data-mcp-app-scroll-host data-app-action-timeline-scroll data-thread-reading]`).
Its stack is `$@176742.*.js:1:23828 < callback@76629.*.js:17:9870 < aP@176742.*.js:1:43221 < g2@226913.*.js…`.
The trace shows it as one 168.8 ms layout with 451 dirty objects. Natively it is the same size
(191.7 ms forced, stage 1).

**Does the sum explain the 1.2 s?** Yes. The trace accounts for 1241 of 1238 ms, and the probe names
the `scrollLeft` part (821 ms). **The hypothesis** is right on the mechanism but wrong on "all 565 at
once": it is about 930 forced passes of 1–17 ms, one per read into a skipped block.

REPORT lines:
- run 7: `api probe: armed 100566.7 to 112683.9 ms after Enter; last turn at arming {"blocks":599,"seen":562,"unrendered":11,"measuring":6}; calls >= 5 ms: 38 from the page, 0 from the harness`
- run 1: `api probe: armed 100419.1 to 112644 ms after Enter; last turn at arming {"blocks":599,"seen":25,"unrendered":554,"measuring":0}; calls >= 5 ms: 34 from the page, 0 from the harness`
- run 1: `api probe top 2: scrollLeft 18.5 ms at 106196.6 ms, target <span> [] in-answer in-last-turn; stack u@299268.5b3cdf27e2.js:1:50555 < B@299268.5b3cdf27e2.js:1:51325 < @299268.5b3cdf27e2.js:1:51055`

## Q2. P1 against the control (run 2), `ats12`

| | control | P1 run 3 | P1 run 4 |
|---|---:|---:|---:|
| completion frame | 1910.5 | 1956.4 | 1844.4 |
| stream task / forced | 608.5 / 181.8 | 677.9 / 183.0 | 595.3 / 181.8 |
| rAF callback / forced | 1275.1 / 1222.1 | 1254.0 / 1201.1 | 1226.1 / 1173.9 |
| longest frame (start) | completion (105134) | completion (105023) | completion (105022) |
| ≥200 / ≥500 / ≥1000 ms | 8 / 2 / 1 | 7 / 1 / 1 | 6 / 1 / 1 |
| blocking | 7369 | 8445 (+15%) | 8562 (+16%) |
| long-frame total | 28087 | 37248 (+33%) | 35838 (+28%) |
| LoAF count | 347 | 494 | 464 |

- **The completion frame is the same within the run-to-run spread.** The two P1 runs differ by
  112 ms (6%).
- **The control's second ≥500 ms frame** is 536 ms at 58.9 s, a ChatGPT rAF callback with 484 ms
  forced. Run 1 (head) had 918 ms at 87.9 s (841 forced). No P1 run had a mid-stream frame of at
  least 500 ms. Stage 1's head runs had none either, so this is not shown to be a P1 effect.
- **`math9` (P1 run 6 against stage 1's head `math9`, different sequences and days):**
  - completion frame 1908.6 against 1940.0 ms (rAF 1250.0/1195.9 against 1260.7/1206.2);
  - longest frame: the completion frame in both;
  - ≥200/500/1000: 12/2/1 against 7/2/1;
  - blocking 15,142 against 10,897 ms; long-frame total 52,895 against 42,172 ms.

  Stage 1 measured about ±20% blocking across days on `math9`, so the blocking difference here is
  not a reliable P1 cost.

## Q3. How hydration went

Hydrated blocks (P1's `data-butter-hydrated` counter), sampled once a second (run 3):

| s after Enter | 10 | 20 | 31 | 41 | 51 | 61 | 71 | 80 | 91 | 101 | 111 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hydrated | 0 | 81 | 139 | 172 | 244 | 308 | 367 | 417 | 488 | 547 | 567 |
| still unrendered | 13 | 4 | 0 | 5 | 5 | 8 | 5 | 18 | 7 | 7 | 0 |
| head control: unrendered | 12 | 84 | 139 | 177 | 249 | 314 | 374 | 434 | 499 | 550 | 567 |

Hydration kept pace with the stream: at most 26 blocks waited at any one-second sample in any P1 run
(`math9`, 81 s).

| P1 run | last sample before the completion frame | first sample after (about 2 s after `in_progress` gone) | 5 s after gone | most blocks measuring at once |
|---|---|---|---|---:|
| `ats12` 3 | 104.96 s: hydrated 561, unrendered 6, measuring 5 | 1 | 0 | 16 |
| `ats12` 4 | 104.13 s: 558, 7, 3 | 7 | 0 | 16 |
| `ats12` all | 104.21 s: 556, 8, 6 | 0 | 0 | 14 |
| `math9` | 104.41 s: 551, 14, 6 | 2 | 0 | 15 |
| `ats12` probe | 104.38 s: 555, 8, 6 | 4 | 0 | 15 |
| `ats12` trace | 104.32 s: 561, 5, 0 | 0 | 0 | 16 |

REPORT (run 3): `hydration at completion: first sample after in_progress gone (107504.9 ms) 566/1/1/1/591; 5 s later (110535.9 ms) 567/0/0/0/592; most blocks measuring at once 16`
(the fields are hydrated/pending/measuring/unrendered/seen).

## Q4. The finished answer's height, and the wheel phase

- **Answer height (the last turn, measured after the window, before any scroll):**
  - P1: **36,503 px** in all 6 P1 runs, the same as native's 36,503 px.
  - Head: 84,672 and 84,740 px. The earlier 81,566 px was measured in the wheel phase after
    scrolling to the end, which renders the last blocks.
- **scrollHeight:**
  - `ats12`: P1 46,873 px against head 95,042/95,110 px.
  - `math9`: P1 179,524 px.
- **Run 5 (P1, all phases).** Wheel phase: last turn 36,503 px high, 55 steps up, 55 steps down to
  the end.
  - **scrollTop beyond the wheel step:** 1 of 55 steps up (−732 px for a −700 px step), 0 of 55
    steps down.
  - **View shift:** up 0/55 over 4 px (in the streamed answer 0/53), median 0, max 0; down 0/55
    (in the answer 0/52), median 0, max 0.
  - **Verdicts:** `PASS wheel-no-jump`, `PASS stream-no-jump`.
  - **View while streaming:** never at the end (0/436 samples). scrollTop stayed at 9622, as with
    head.

## Q5. Do the existing verdicts still pass with P1?

Yes: all 6 P1 runs printed `PASS` for `cv-blocks`, `seen-marks`, `throttle-matched`,
`stream-no-jump`, `rail-new-tick` and `rail-new-tick-lit`, and run 5 also for `wheel-no-jump`. No
check assumes that blocks stay unrendered: `seen-marks` counts `data-butter-seen` and
`data-butter-unrendered` together. After completion: `seen 592, unrendered 0` (head:
`seen 25, unrendered 567`), and `cv auto 592` in both.

## Q6. What did P1 cost?

- **Blocking:** +1.08 / +1.19 s (+15 / +16%). Without the completion frame: 5512 ms for the control
  against 6540 / 6770 ms (+19 / +23%).
- **Blocking per 10 s from Enter** (control | P1 run 3 | P1 run 4):

  | s | 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | control | 297 | 11 | 30 | 189 | 397 | 667 | 204 | 695 | 658 | 1675 | 2545 |
  | P1 3 | 263 | 0 | 56 | 184 | 400 | 232 | 382 | 1050 | 1149 | 1811 | 2918 |
  | P1 4 | 259 | 22 | 34 | 71 | 392 | 249 | 477 | 987 | 1235 | 1975 | 2861 |

  The extra falls in the second half (70–110 s), where the answer and the hydrated blocks are many.
- **Where in the long frames:**
  - ChatGPT script 14,818 ms (control) against 22,673 / 22,004 ms;
  - rAF part 18,501 against 25,338 / 24,588 ms;
  - render part 1516 against 2185 / 2162 ms;
  - forced style/layout about the same: 4211 against 4291 / 4178 ms;
  - Butter's scripts still show 0 (`laf butter files: {}`).

  The probe window shows more layout-API calls in P1 at the same moments (`checkVisibility` 103,674
  against 77,326; `getBoundingClientRect` 23,707 against 17,915). Why ChatGPT's per-frame work grows
  is not established.
- **Publish interval** (answer DOM updates): p10 / median 257.5 / 267.4 ms for the control against
  254.1 / 270.3 and 251.5 / 268.6 ms. Unchanged.
- **No new frame of at least 200 ms near hydration.** P1's frames of at least 200 ms come at the same
  moments as the control's: Enter (0.0/0.3 s), 32.5 s, 42.2 s (a ChatGPT rAF callback, 236–245 ms
  forced, against 285 with head), 76.2 s (a stream task), the completion frame, and 107.0 s.
  Single extra ones did appear: 210 ms at 54.3 s (run 5, 1 ms forced), 223 ms at 71.1 s and 227 ms
  at 103.5 s (run 8). Head run 1 also had a 254 ms frame at 54.2 s.

## Q7. What is left in P1's completion frame, against the targets

- **What is left (median of the P1 `ats12` runs, about 1.96 s):**
  - ChatGPT's stream task, 595–696 ms, with the scroller's `clientHeight` forced layout
    (about 180 ms);
  - ChatGPT's completion rAF callback, 1226–1327 ms, with 1174–1270 ms forced by the reads in Q1.
- **What runs natively too:** the stream task (native 645 ms, 192 forced) and about 46 ms of the rAF
  callback. About 1.2 s of the rAF callback is extra, caused by the answer's blocks being skipped
  when ChatGPT reads into them, with or without P1.
- **Against the owner's targets:**
  - **Half of head's (about 1.0 s): not reached.** P1's longest is 1844–2015 ms on `ats12` and
    1909 ms on `math9`.
  - **Half of native's (0.39 s on `ats12`, 0.77 s on `math9`): not reached.** On `ats12` it is out
    of reach for any change to the rAF callback alone: the native-sized stream task in the same
    frame is already 0.60–0.70 s.

## Environment

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium 157 (snap) on Xvfb `:98` (1600×1000), software rendering, ChatGPT light theme |
| Lock | owner `stream-hydrate-1124`, lab 2 **and perf**, taken 05:44:56 UTC on 2026-11-24 (no queue), restored 06:12:51, released right after. 28 min of the 30 min budget, 8 of 10 harness runs. |
| head | `~/snap/chromium/common/stream-audit-1123/butter`, unchanged (its `stream/` matches `extension/stream/` byte for byte) |
| P1 | copy of head at `~/snap/chromium/common/stream-proto-1124/p1/butter`, [p1.patch](p1.patch) applied (`git apply --check` passes against `extension/stream/`). A new path gives a new extension id: no settings stored. |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 chunks |

**P1's design, as the lead wrote it, worked as written.**
- `hold()` adds the block to `pending` and schedules work.
- `requestIdleCallback` (timeout 1500 ms), re-armed by a 100 ms timer, takes at most 3 blocks per
  callback.
- It skips and drops blocks that are disconnected, seen or no longer waiting. It leaves the block
  with no next sibling until the turn is no longer `in_progress`.
- It sets `data-butter-measure`, moves the block from `skipped`/`waiting` to `shown`, and calls
  `ro.observe()`.
- The flush marks the block seen, removes `data-butter-measure` and updates `data-butter-hydrated`
  and `data-butter-hydrate-pending` on `<html>`.
- `off()` clears `pending` and the measure attributes.
- CSS: the measure rule has the same two selector shapes as the other block rules and the same
  specificity, placed after them, so it wins.

No deviation was needed.

Harness changes (worktree only, not committed):

- **`stream-api-probe.mjs` (new, 204 lines):**
  - The `APIPROBE=1` wrappers, armed `APIPROBE_AT` ms after Enter (default 100000) until the window
    ends.
  - Calls of at least 5 ms kept with a structural target and 8 stack frames.
  - Per-API sums, plus all calls in 50 ms bins. The bins were added after run 1.
  - Calls from the harness's own evaluated code are counted apart.
  - Once-a-second hydration counts; the `completion frame` and `answer height after the window`
    REPORT lines; the `TRACE_AT` window moved here.
  - Reads by property name on a computed style cannot be wrapped (Chromium has no accessors for
    them).
- **`stream-replay-live.mjs`:** still 500 lines. One helper replaces the trace window's two call
  sites.
- **`lab/README.md`** describes all of this.

`npx eslint` on the five stream harness files exits 0.

Dry checks before the lock (headless snap Chromium, throwaway profile, deleted afterwards):
- **P1 on a synthetic streaming answer** (150 blocks, `in_progress` then complete): 0 console
  errors. During the stream, hydrated/pending/measuring went 0/0/0 → 80/16/16. After completion:
  130 hydrated, 0 pending, 0 measuring, 0 unrendered, 151 seen. The answer's height was 16,520 px,
  exactly the real height.
- **The probe on a blank page:** recorded `Element.getBoundingClientRect` at 191.5 ms with its
  target and stack.

## Not established

- **What ChatGPT's `u` and `A` do** (minified, not read). `u` reads `scrollLeft` on spans inside the
  answer, perhaps an overflow check on formulas or code. Which computed property `A` reads is also
  unknown.
- **Head's per-frame API sums.** Run 1 had no bins. Head's attribution in Q1 rests on the same call
  site and target, and on totals over the window.
- **Why ChatGPT's script time in long frames grows by 7–8 s with P1**, while forced layout does not.
- **Whether un-skipping the answer's blocks around ChatGPT's completion callback**
  (`content-visibility: visible` for that frame, after P1 has laid them out once) would replace
  about 930 forced passes with one cheaper layout. Not tried.
- **Spread:** two plain P1 `ats12` runs, one head control. `math9` has one P1 run, compared against
  another day's head run. Native was not run in this sequence.
- **P1b** was not built. P1's completion frame did not change, and a different batch or gap only
  moves the hydration's own cost around.

## Clean-up

`lab-restore --lab 2 --owner stream-hydrate-1124` restarted the browser without extensions, put the
home URL back and cleared the composer (`"ok":true`, exit 0). `lab-lock release` freed lab 2 and
perf. `lab-lock status` prints `"held": false` for lab 1, lab 2 and perf
([restore.log](restore.log), [release.log](release.log)). No settings were written (no `OPTS`). The
trace (10 MB) stays in the captures folder.
