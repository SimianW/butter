# Smoother streaming on today's page — 2026-11-23 recheck

Lab run only; no extension code changed. Lab 2, fixtures `ats12` and `math9`, one outer lock with
the perf lock. The send guard was on in every connection and no message was sent: the replay
hook answered the conversation POST in the page (`PASS no-escape` and `PASS server-unchanged` in
all four replays). Raw captures (per-run JSON, unsanitized logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-23-stream-recheck/`.

## Result

**Smoother streaming still does what its code expects on today's page.** All three mechanisms
engage with head (`0.1.0-alpha.22+streamaudit.1`), with the same counts as on 2026-11-18:

- **cv:** every block of the streaming answer computes `content-visibility: auto`.
- **container:** the thread's inline-size container still matches (1 element) and computes
  `normal` with Butter, `inline-size` natively.
- **throttle:** it still matches ChatGPT's smoother callback, and publishes come about 255–270 ms
  apart.

No selector went from matching to 0. All 38 verdict lines in the four replays PASS, and every
script exited 0.

**The owner's suspicion is half right.** ChatGPT did change the page since 11-19, but none of the
changes touches an element, attribute or class that Smoother streaming reads:

- The scroller lost `data-thread-reading`.
- The inline-size container gained a class, `scrollColumn-uPFH6M`.
- Some composer `data-*` names changed.

**It still pays off, by the new page-lag measure** (one run per arm and fixture on a
software-rendered lab). From Enter to the end of the stream, long animation frames blocked:

- `ats12`: 11.1 s with head against 40.9 s natively.
- `math9`: 13.1 s with head against 62.3 s natively.

Head's longest single frame is longer, though: 2.1 s on both fixtures, against 0.8 s (`ats12`)
and 1.6 s (`math9`) natively.

The known cost is unchanged. The finished streamed answer is 81.6k px tall with head against 36.5k
natively (the 120 px placeholders of the 565 never-rendered blocks). Wheeling back up, ChatGPT
corrects scrollTop on most steps (by up to 1.4k px), with no visible shift of a tracked block.

## Results table

**head** = `0.1.0-alpha.22+streamaudit.1`, a test build of `b2df865` (= `origin/main`), unpacked at
`~/snap/chromium/common/stream-audit-1123/butter`. **native** = no extension (`EXT=`).

| # | Check | Arm | Fixture | Result | Verdict / REPORT line | Exit | Log |
|---|---|---|---|---|---|---:|---|
| 1 | Selectors and container (survey) | native | `ats12`, `math9` | all of Butter's stream selectors match; container 1, `inline-size` | `REPORT … count …`, `REPORT … container chain {"chain":["div[[container-type:inline-size] min-h-full]:inline-size",…],"sizeContainerAboveTurn":true}` | 0 | [survey-native.log](survey-native.log) |
| 1 | Same | head | `ats12`, `math9` | match; container 1, computes `normal`; no size container above a turn | `REPORT … container chain {…"div[[container-type:inline-size] min-h-full]:normal"…,"sizeContainerAboveTurn":false}` | 0 | [survey-head.log](survey-head.log) |
| 2 | Replay works (hook, all 357 chunks, `in_progress`) | native | `ats12` | PASS | `PASS replay-hook`, `PASS replay-streams`, `PASS in-progress` | 0 | [replay-native-ats12.log](replay-native-ats12.log) |
| 2 | Same | native | `math9` | PASS | same three | 0 | [replay-native-math9.log](replay-native-math9.log) |
| 2 | Same | head | `ats12` | PASS | same three | 0 | [replay-head-ats12.log](replay-head-ats12.log) |
| 2 | Same | head | `math9` | PASS | same three | 0 | [replay-head-math9.log](replay-head-math9.log) |
| 3 | cv: streaming blocks compute `content-visibility: auto` | head | `ats12` / `math9` | PASS (281/281, 284/284 mid-stream) | `PASS cv-blocks` | 0 / 0 | head replay logs |
| 3 | cv: `data-butter-seen` / `data-butter-unrendered` marks | head | `ats12` / `math9` | PASS (after: 27 seen, 565 unrendered of 612, both) | `PASS seen-marks` | 0 / 0 | head replay logs |
| 4 | throttle: smoother callback matched | head | `ats12` / `math9` | PASS (`smootherFrames` 349, `published` 348, both) | `PASS throttle-matched`, `REPORT __butterStats {"smootherFrames":349,"published":348}` | 0 / 0 | head replay logs |
| 4 | Publish interval | both | both | head p10 255 ms; native every frame (see Q3) | `REPORT answer DOM updates while streaming: …` | — | all replay logs |
| 5 | No jump while streaming | native / head | both | PASS ×2 / PASS ×2 | `PASS stream-no-jump` | 0 | all replay logs |
| 5 | Wheel up through the answer and back down: no jump back | native / head | both | PASS ×2 / PASS ×2 | `PASS wheel-no-jump` | 0 | all replay logs |
| 5 | View shift per wheel step | native / head | both | native 0 over 4 px; head: block-tracked steps 0 over 4 px except one step where nothing scrolled (`ats12`), turn-tracked 9 of 11–12 (482–1203 px, not visible shifts, as on 11-18) | `REPORT view shift up (…)`, `REPORT view shift down (…)` | — | all replay logs |
| 5 | Rail adds a tick for the new question | head | both | PASS (5 → 6) | `PASS rail-new-tick` | 0 | head replay logs |
| 5 | The new tick is lit | head | `ats12` / `math9` | PASS (lit `[3,4,5]` / `[4,5]` of 6) | `PASS rail-new-tick-lit` | 0 | head replay logs |
| 6 | Long animation frames, Enter to stream complete | native / head | both | measured, see Q5 | `REPORT long animation frames, …` | — | all replay logs |
| 7 | Nothing escaped; server unchanged | native / head | both | PASS ×2 / PASS ×2 | `PASS no-escape`, `PASS server-unchanged` | 0 | all replay logs |

Every replay log ends in `SUMMARY <label>: 0 FAILs`.

## Environment and builds

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium **157.0.8103.50** (snap) on Xvfb `:98` (1600×1000), software rendering (llvmpipe), classic scrollbars, ChatGPT light theme. On 11-18 it was Chromium 156.0.8078.47. |
| Lock | owner `stream-audit-1123`, lab 2 **and perf**, taken 04:19:43 UTC on 2026-11-24 (23:19 local on 11-23) after queuing 24 min behind another task (`new-chat-probe`), released 04:38:01. 18 min of the 30 min budget, 6 of 10 harness runs. On 11-18 there was no perf lock. |
| head | `python3 scripts/package.py --test streamaudit` at `b2df865` → `dist/butter-0.1.0-alpha.22+streamaudit.1.zip`, unpacked at `~/snap/chromium/common/stream-audit-1123/butter`. Manifest `0.1.0.22` / `version_name` `0.1.0-alpha.22+streamaudit.1`. `diff -rq` against `extension/`: only `dev/` (absent) and `manifest.json` differ. No settings stored (defaults); layout memory unconsented, so `data-butter-off="layout"`. |
| native | no extension (`EXT=`) |
| Baseline | 2026-11-18 `0.1.0-alpha.21+fix.1` (`25f80c2`) against native, [live-features report](../2026-11-18-live-features/report.md) §1.1–1.4. The streaming code (`extension/stream/`, `shared/config-main.js`) is the same in substance. |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 SSE chunks over 107 s (as on 11-18) |
| Harness | This worktree's `lab/harness/`. Playwright was found through the lab's `harness` link (the main checkout has `node_modules` again), so `LAB_PLAYWRIGHT` was not needed. |

Harness changes made for this run (worktree only, not committed):

- **`lab/harness/stream-laf-probe.mjs` (new).** A `PerformanceObserver` for `long-animation-frame`
  and `longtask`, started just before Enter and stopped when the stream has completed. It feeds
  one `REPORT long animation frames, …` line.
- **`stream-replay-live.mjs`** imports the probe (486 lines).
- **`survey-page-structure.mjs`** gained one `REPORT <fixture> <position> container chain {…}`
  line: the computed `container-type` of every wrapper from the scroller to a turn.
- **`lab/README.md`** describes both.

`npx eslint` on the three files exits 0. The folder is linted for file length only. The probe was
checked once in a headless Chromium on a blank page (5 frames of 120 ms → LoAF 5, longest 129 ms).

## Q1. Do the selectors still match?

From the surveys (four positions: opened / top / middle / end). The 11-18 values come from the
[11-18 survey](../2026-11-18-live-survey/report.md) and the 11-18 replays.

| Selector (mechanism) | 2026-11-23 native | 2026-11-23 head | 2026-11-18 |
|---|---|---|---|
| `[data-turn-key]` (cv) | `ats12` 3/3/1/3, `math9` 3/1/1/1 | same | matches, mounted turns only |
| answer blocks `[data-markdown-text-style="assistant-message"] > :not([data-dil-source-message-id])…` (cv) | `ats12` 122/83/123/122, `math9` 2231/541/782/782 | `ats12` same, `math9` 2231/541/644/782 | matches |
| `[class*="DilResponseRoot"] > …` (cv, Dil renderer) | 0 (these chats use direct markdown) | 0 | 0 |
| `[data-talvt-turn-state="in_progress"]` (cv) | 1 on the streaming turn in 364/378 and 314/321 replay samples | 437/449 and 420/431 samples | 320–454 samples per run |
| `[class*="AdaptiveStreaming"]` (informational) | 1 mid-stream in both replays | 1 | 1 |
| `.thread-scroll-container > *` (cv's `overflow-anchor: none`) | children `auto, auto`; the scroller itself `none` | children `none, none` (Butter's rule); scroller `none` | 11-19: the same |
| `div.\[container-type\:inline-size\].min-h-full` (container) | **1** at every position; computes `inline-size` | **1**; computes **`normal`** | 1; `inline-size` natively, `normal` with Butter |
| Size container between the scroller and a turn | **yes**: that element only (the six wrappers below it and the scroller are `normal`; the row wrapper has `contain: size` but `container-type: normal`) | **none** (`sizeContainerAboveTurn: false` at all 8 positions) | not measured |
| Smoother callback `() => { this.frame = void 0, this.publish() }` (throttle) | still scheduled: 635 (`ats12`) and 346 (`math9`) exact matches | matched by Butter: 349 frames | 370 (`math9`), 835–849 (`ats12`) |

The container REPORT lines: native `{"scroller":"normal","chain":["div[[container-type:inline-size]
min-h-full]:inline-size","div:normal","div[min-h-full]:normal","div:normal",…],"sizeContainerAboveTurn":true}`
on both fixtures at all four positions, and head the same with `…:normal` and `false`
([survey-native.log](survey-native.log), [survey-head.log](survey-head.log), exit 0 each). These
lines needed no spare run: they were added to the survey.

## Q2. cv

| | head `ats12` | head `math9` | native `ats12` | native `math9` | 11-18 fix `ats12` / `math9` | 11-18 native |
|---|---|---|---|---|---|---|
| mid-stream: blocks / computed `auto` | 281 / 281 | 284 / 284 | 269 / 0 | 265 / 0 | 284 / 284, 282 / 282 | 269–275 / 0 |
| mid-stream: seen / unrendered | 23 / 244 | 23 / 251 | 0 / 0 | 0 / 0 | 23 / 249, 23 / 244 | 0 / 0 |
| streaming turn's own `content-visibility` | auto | auto | visible | visible | auto | visible |
| max during stream: seen / unrendered | 25 / 565 | 25 / 565 | — | — | — | — |
| after: blocks / cv auto / seen / unrendered | 612 / 592 / 27 / 565 | 612 / 592 / 27 / 565 | 612 / 0 / 0 / 0 | 612 / 0 / 0 / 0 | 612 / 592 / 27 / 565, 612 / 592 / 26 / 566 | 612 / 0 / 0 / 0 |
| finished streamed turn's height | **81566 px** | **81566 px** | 36503 px | 36503 px | 81.5–81.6k | 36.4k |
| scrollHeight after completion | 94948 | 227599 | 46841 | 183722 | 94772, 229920 | 46698, 181797 |

Verdicts: `PASS cv-blocks` and `PASS seen-marks` in both head replays (exit 0). Natively nothing
computes `content-visibility: auto`: not a turn (`turnsCvAuto` 0 at every native survey position),
not a block. ChatGPT does no content-visibility of its own on turns or blocks.

## Q3. throttle

`PASS throttle-matched` in both head replays (exit 0). `__butterStats`
`{"smootherFrames":349,"published":348}` on both fixtures; on 11-18, 358–361 / 357–361.

The publish interval is measured as the gaps between MutationObserver callbacks that touched the
streaming answer:

| Arm | Fixture | DOM updates | min | p10 | median | gaps under 240 ms | 11-18 (same arm and fixture): updates, min, p10, median, under 240 |
|---|---|---:|---:|---:|---:|---:|---|
| native | `ats12` | 519 | 29.7 ms | 61.3 ms | 144.9 ms | 374 | 671/667, 17, 50, 103, 552/544 |
| native | `math9` | 285 | 98.8 ms | 184.7 ms | 303.6 ms | 79 | 312, 80, 157, 283, 112 |
| head | `ats12` | 320 | 153.0 ms | 255.1 ms | 267.7 ms | 6 | 336/334, 150, 256, 267, 3/3 (fix) |
| head | `math9` | 326 | 148.1 ms | 255.5 ms | 270.1 ms | 6 | 329, 151, 257, 268, 5 (fix) |

- **Natively the smoother still publishes every frame.** The callback's source text still
  appears: the harness's own `requestAnimationFrame` wrapper saw 635 exact matches on `ats12`,
  with a median interval of 119.9 ms (11-18: 835–849, 77–80 ms). On `math9` it saw 346, with a
  median of 267.6 ms (11-18: 370, 242 ms). Today's native frames on `ats12` were slower than on
  11-18; the timing was taken under the perf lock, so no other lab run was competing.
- **No new callback mentions `publish` or `flush`.** The native REPORT says `other
  publish/flush-like callbacks: []` in both runs. With head, the harness wrapper sits under
  Butter's, so it sees only Butter's deferred runner (324 and 337 times), as on 11-18.

## Q4. No regressions

| | native `ats12` | native `math9` | head `ats12` | head `math9` | 11-18 |
|---|---|---|---|---|---|
| `stream-no-jump` | PASS | PASS | PASS | PASS | PASS ×6 |
| `wheel-no-jump` | PASS | PASS | PASS | PASS | PASS ×6 |
| `rail-new-tick` / `rail-new-tick-lit` | — | — | PASS / PASS (`[3,4,5]` of 6) | PASS / PASS (`[4,5]` of 6) | PASS ×3 (`[3,4,5]`, `[4,5]`) |
| view while streaming at the end | 0/364 | 0/314 | 0/437 | 0/420 | 0 in every run (ChatGPT keeps the new question at the top) |
| scrollTop while streaming, first = last | 9590 | 146471 | 9622 | 142273 | unchanged in every run |
| up, block-tracked steps: shift > 4 px (max) | 0/44 (0) | 0/45 (0) | **1/48** (the 700 px is a step where scrollTop did not move, see below) | 0/49 (1.1 px) | native 0/42–48 (0.4); fix 0/50–52 (1.2) |
| up, turn-tracked steps: shift > 4 px | 0/11 | 0/10 | 9/12 (482–1203 px) | 9/11 (578–1190 px) | native 0/7–13; fix 6/8, 8/10 (632–1084) |
| up, steps where scrollTop moved beyond the step (max extra) | 0 | 0 | 41 + 9 (1312 px) | 39 + 9 (1407 px) | native 0; fix 38–41 + 6–8 (1313) |
| down: shift > 4 px | 0/55 | 0/55 | 0/59 | 0/59 | 0 in every run |

- **The large turn-tracked values are not visible shifts.** As on 11-18, they come from steps where
  no block was under the pointer. The measure then fell back to the whole streamed turn, whose top
  is ~80k px above the view (`doc` = 0: the turn did not move in the content; scrollTop did). This
  is ChatGPT's scroll correction as the never-rendered blocks above the view take their real height.
- **The one block-tracked "shift" on head `ats12`** (step 51 of 60, `dTop 0, dY 0, user −700`) is a
  wheel step where neither scrollTop nor the tracked block moved. The wheel did nothing on that
  step; nothing jumped. Why the wheel was lost was not looked at.
- **The REPORT lines:** `view shift up (60 steps): 10/60 over 4px (842, 1106, 482, 882, 731, 978, 928, 950, 1203, -700 px)` (head `ats12`) and
  `9/60 over 4px (842, 931, 578, 880, 731, 951, 928, 1020, 1190 px)` (head `math9`). Natively:
  `0/55 over 4px` up and down on both fixtures.

## Q5. Does it still pay off? Long animation frames

New REPORT line (`stream-laf-probe.mjs`), from just before Enter until the replay is done and
`in_progress` is gone (about 107.5 s). **One run per arm and fixture, on a software-rendered lab
(llvmpipe, 12 threads shared with lab 1, which was idle), under the perf lock.** There is no
11-18 value: it was not measured then.

| Fixture | Arm | LoAF count | total duration | blocking duration | longest | phase | longtask (fallback): count, blocking, longest |
|---|---|---:|---:|---:|---:|---:|---|
| `ats12` | native | 627 | 77610 ms | 40865 ms | 783 ms | 107496 ms | 605, 38069 ms, 633 ms |
| `ats12` | head | 377 | 34272 ms | **11064 ms** | **2101 ms** | 107791 ms | 345, 11055 ms, 1460 ms |
| `math9` | native | 486 | 92635 ms | 62304 ms | 1614 ms | 107520 ms | 490, 62033 ms, 1522 ms |
| `math9` | head | 544 | 45934 ms | **13110 ms** | **2061 ms** | 107753 ms | 470, 13452 ms, 1382 ms |

- **Blocking time is down by about three quarters.** With head, total blocking during the stream
  was 73% lower on `ats12` and 79% lower on `math9`. Total long-frame time roughly halved.
- **The longest frame is longer with head:** 2.1 s on both fixtures, against 0.8 s and 1.6 s
  natively. When in the stream it fell was not recorded: the probe keeps only the summary.
  The 2026-11-16 note about a freeze at completion is a candidate, not established.
- These are single runs; the size of the gain, not its sign, is what one run cannot pin down.

## Q6. Page changes since 11-18/11-19 that touch Smoother streaming

I compared today's native survey JSON with the 11-19 native survey
(`captures/2026-11-19-live-recheck/structure-native.json`), field by field.

**Changed, none of it read by Butter:**

1. **The inline-size container gained a class.** It is now `scrollColumn-uPFH6M [container-type:inline-size] flex min-h-full …`;
   the `[container-type:inline-size]` and `min-h-full` classes Butter's selector needs are still
   there, and it still matches exactly 1 element.
2. **The scroller lost `data-thread-reading`.** On 11-19 it was `="measured"`, on 11-18 `="anchored"`.
   Its other attributes and its classes are unchanged, and it still computes `overflow-anchor: none`
   natively, as on 11-19. Nothing in `extension/` reads `data-thread-reading`.
3. **Composer `data-*` names.** Added: `data-composer-overflow`, `data-composer-trailing-picker`,
   `data-model-selection-label`, `data-placeholder-is-label`. Gone: `data-composer-padding-variant`,
   `data-composer-surface-overflow`, `data-composer-utility-bar-variant`. These are not in the
   stream code.

**Unchanged:**

- `<html>` attribute names, turn attributes (`class`, `data-turn-key`), row wrappers
  (`data-virtualized-turn`, inline `height; margin-top; contain: size; overflow-y: clip`), the
  wrapper chain to a turn, the answer column's attributes, the virtualizer's props and entry keys,
  and the conversation GET paths and JSON keys.
- **The conversation POST.** Path `POST /backend-api/f/conversation`, body keys the same 16 as on
  11-18 (`turn_attribution, conversation_id, action, model, parent_message_id, timezone,
  timezone_offset_min, is_do_not_remember, client_contextual_info, conversation_mode, gizmo_id,
  local_function_names, messages, supported_encodings, genui_state_snapshots, client_prepare_state`).
- **The preparation POSTs,** answered locally: `conversation/init` once (11-18: twice),
  `sentinel/chat-requirements/prepare` twice, `f/conversation/prepare` twice.
- **The stream format.** The 2026-10-30 `delta_encoding` v1 recording still renders: 612 blocks,
  248 characters of column text, `in_progress` while streaming.
- **No virtualization or content-visibility of ChatGPT's own on turns or blocks.** Natively no
  turn or block computes `content-visibility: auto`. ChatGPT's own row virtualization (mounting only
  the turns near the view) is as on 11-19.

## Not established

- **The size of the gain.** It rests on one run per arm and fixture, on a software-rendered lab.
- **When head's 2.1 s longest frame happened** (mid-stream or at completion), and what it was.
  The probe keeps no per-frame timestamps or script attribution.
- **Why one wheel step on head `ats12` did not scroll.**
- **Whether the container rule alone still saves time today.** The arms differ in all three
  mechanisms at once; no ablation was run.
- **Why native `ats12` frames were slower than on 11-18** (smoother median 120 ms against 77–80 ms).
  The 11-18 run had no perf lock, so the two days are not strictly comparable.
- **Real (non-replayed) streaming.** Nothing was sent.

## Clean-up

- `lab-restore --lab 2 --owner stream-audit-1123` restarted the browser without extensions and
  opened the home tab with an empty composer (`"ok":true`, exit 0).
- `lab-lock release` released lab 2 and perf (exit 0). `lab-lock status`: lab 1, lab 2 and perf
  `"held": false` ([restore.log](restore.log), [release.log](release.log)).
- The unpacked build stays at `~/snap/chromium/common/stream-audit-1123/` and the zip in `dist/`;
  both are local only.

## Files

- [commands.md](commands.md): every command, with its final output lines.
- [data.json](data.json): the numbers per arm and fixture, the verdicts and exit codes, and the
  2026-11-18 values (including that run's `view-shift-by-kind.json`).
- `survey-*.log`, `replay-*.log`, `restore.log`, `release.log`: sanitized logs (home → `~`,
  URLs → `<url>`, ids → `<id>`; no chat text).
