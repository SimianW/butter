# Live features: streaming replay, composer buttons, history pages, rail card, dark theme, seek landing — 2026-11-18 (second pass)

Lab run only; no extension code changed. Lab 2, fixtures `math9`, `ats12` and `math12`. The send
guard was on in every connection, every WebSocket was closed, and the in-page replay hook answered or
refused every non-GET fetch to chatgpt.com. No message was sent: no replay POST reached the network
in any run, and every fixture had the same turn list after a reload. Raw captures (per-run JSON,
unsanitized logs, the dark-rail crop) stay in `~/.local/share/chatgpt-lab/captures/2026-11-18-live-features/`.

## Results

Each row is one check on one arm, judged by the verdict line(s) and exit code in the named log.
**fix** = `0.1.0-alpha.21+fix.1` (this branch, head `25f80c2`, `~/snap/chromium/common/fix-1118-fix/butter`);
**native** = no extension. Items 1 and 2 ran on `math9` and on `ats12`; the table gives both.

| # | Check | Arm | Result | Verdict line(s) behind it | Exit | Log |
|---|---|---|---|---|---:|---|
| 1 | Replay works on today's page (hook in the fetch chain, all chunks, `in_progress` seen) | native | **PASS** ×3 | `PASS replay-hook`, `PASS replay-streams`, `PASS in-progress` | 0 | [replay-native-1.log](replay-native-1.log), [replay-native-ats12.log](replay-native-ats12.log), [replay-native-ats12-probe.log](replay-native-ats12-probe.log) |
| 1 | Same | fix | **PASS** ×3 | same three lines | 0 | [replay-fix-1.log](replay-fix-1.log), [replay-fix-ats12.log](replay-fix-ats12.log), [replay-fix-ats12-probe.log](replay-fix-ats12-probe.log) |
| 1 | Streaming blocks compute `content-visibility: auto` | fix | **PASS** ×3 | `PASS cv-blocks` (282–286 of 282–286 blocks mid-stream) | 0 | fix logs |
| 1 | `data-butter-seen` / `data-butter-unrendered` marks | fix | **PASS** ×3 | `PASS seen-marks` (after: 25–27 seen, 565–567 unrendered of 612) | 0 | fix logs |
| 1 | Smoother callback still matched | fix | **PASS** ×3 | `PASS throttle-matched` (`__butterStats` smootherFrames 358–361, published 357–361) | 0 | fix logs |
| 1 | Publish interval about 250 ms (fix) against every frame (native) | both | measured (REPORT) | fix: answer DOM updates p10 256–257 ms, median 267 ms; native `ats12`: p10 50 ms, median 103 ms | — | all replay logs |
| 1 | No jump while streaming (scrollTop never falls by more than a viewport) | native / fix | **PASS** ×3 / **PASS** ×3 | `PASS stream-no-jump` | 0 | all replay logs |
| 1 | View stays at the chat's end while streaming | native / fix | not applicable: ChatGPT keeps the new question at the top and never follows the stream, in both arms | `REPORT view while streaming: at the end (within 4 px) in 0/…` | — | all replay logs |
| 1 | Wheel up through the streamed answer and back down: no jump back | native / fix | **PASS** ×3 / **PASS** ×3 | `PASS wheel-no-jump` | 0 | all replay logs |
| 1 | View shift per wheel step, steps tracking an answer block | native / fix | 0 over 4 px (max 0.4) / 0 over 4 px (max 1.2) | REPORT (see §1.4 and [view-shift-by-kind.json](view-shift-by-kind.json)) | — | all replay logs |
| 1 | View shift per wheel step, all steps as `SHIFT=1` counts them | native / fix | 0 over 4 px / **6–8 over 4 px, 632–1084 px**, all on steps that tracked the whole turn | `REPORT view shift up (60 steps): 8/60 over 4px (848, …, 853 px)` | — | fix logs |
| 1 | scrollTop moves exactly the wheel step on the way up | native / fix | yes / **no**: 38–41 of 50–52 block-tracked steps move further, by up to 1313 px (ChatGPT's own `scrollTo`) | REPORT; probe: `231 wrapped writes … MAIN scrollTo … page:/cdn/assets/…` (native 8) | — | probe logs |
| 1 | Rail adds a tick for the new question | fix | **PASS** ×3 | `PASS rail-new-tick` (5 → 6) | 0 | fix logs |
| 1 | The new tick is lit | fix | **PASS** ×3 | `PASS rail-new-tick-lit` (lit `[4,5]` / `[3,4,5]` of 6) | 0 | fix logs |
| 1 | Nothing escaped; server unchanged | native / fix | **PASS** ×3 / **PASS** ×3 | `PASS no-escape`, `PASS server-unchanged` | 0 | all replay logs |
| 2 | Send button found with text typed | native / fix | **matches** (`button[type="submit"][aria-label="Send"]`) | `REPORT buttons, typed …` | — | [replay-native-1.log](replay-native-1.log), [replay-fix-1.log](replay-fix-1.log) |
| 2 | Pre-jump would fire on Enter (its condition, read without sending) | native / fix | **yes** | `REPORT pre-jump condition with text typed: SEND_BUTTON in form true, would fire on Enter true` | — | all replay logs |
| 2 | Stop button found while streaming | native / fix | **stale**: `[data-testid="stop-button"]` matches 0; the button is `button[type="button"][aria-label="Stop"]` | `REPORT buttons mid-stream: …` | — | [replay-native-1.log](replay-native-1.log), [replay-fix-1.log](replay-fix-1.log) |
| 3 | Earlier-history pages rewritten to `num_turns=2` | fix | **PASS** | `PASS older-page-size` (7 earlier pages, all `num_turns=2`) | 0 | [history-fix.log](history-fix.log) |
| 3 | Same, control | native | `num_turns=10` (2 earlier pages) | `REPORT earlier-page GETs: 2, num_turns [10, 10]` | 0 | [history-native.log](history-native.log) |
| 4 | Why `ats12` tick 4's card differs from its bubble | fix | **explained** (§4) | REPORT lines only | 0 | [card-probe-3.log](card-probe-3.log), [card-probe-2.log](card-probe-2.log) |
| 5 | ChatGPT dark; rail host `data-dark`; ticks visible | fix | **PASS** | `PASS dark-page`, `PASS dark-host`, `PASS dark-ticks-visible` | 0 | [dark.log](dark.log) |
| 5 | Light theme put back, confirmed after reloads and browser restarts | fix | **PASS** | `PASS light-restored`, `PASS light-host`; after `lab-restore`: `{"cookie":"light","ls":"light","dataTheme":"light",…}` | 0 | [dark.log](dark.log), [theme-after-restore.log](theme-after-restore.log) |
| 6 | Seek release lands on what the preview showed | fix | **FAIL** 4 of 7 trials (2 runs) | `FAIL seek-landing #2: preview showed question 6 +0 …, landed on question 5 +31261`, `FAIL seek-landing #3: … question 7 +0 …, landed on question 6 +31378`; rerun of those two positions: the same two FAILs | 1, 1 | [seek-landing-2.log](seek-landing-2.log), [seek-landing-3.log](seek-landing-3.log) |
| 6 | Seek landing control | native | not applicable (no preview without Butter) | — | — | — |
| 6 | `bookmarks-live.mjs` | — | **not run** (takes `--lab auto` only; would have picked lab 1) | — | — | — |

[seek-landing.log](seek-landing.log) is the first seek run with a wrong verdict rule: it compared the
landing with the thumb's offset. The unseen preview draws the question from its start (§6). It is
kept for the record and not counted. [card-probe-partial-history.log](card-probe-partial-history.log)
is a first card probe whose history load stopped at 10 of 12 questions. It is not counted.

**In short.**

1. **Replay works.** The replay (bench.mjs's fetch hook, adapted) still works on today's ChatGPT:
   same request path `POST /backend-api/f/conversation`, same `delta_encoding` v1 stream.
   ChatGPT's preparation POSTs (`conversation/init`, `f/conversation/prepare`,
   `sentinel/chat-requirements/prepare`) were answered locally.
2. **Streaming works with the fix build.** Butter's streaming containment, marks, throttle and rail
   all engage. The answer's blocks skip, the smoother's callback text is unchanged and is throttled
   to about 250 ms, and the rail adds and lights the new tick.
3. **No visible view shift or jump back with anchoring off.** But the 565–567 streamed blocks that
   never rendered keep their 120 px placeholder. After completion the answer is 81.5k px tall,
   against 36.4k natively. Wheeling back up, ChatGPT's own script corrects scrollTop on most steps
   (by up to 1.3k px beyond the step) as those blocks take their real height. The visible text holds
   still; the scroll position and thumb jump.
4. **Composer buttons.** The send button with text typed is `button[type=submit][aria-label=Send]`,
   matched by both of Butter's lists. The stop button is `button[aria-label=Stop]`, which
   `[data-testid="stop-button"]` no longer matches.
5. **Earlier-history pages:** `num_turns=2` with the fix build, 10 natively.
6. **The wrong card is a long pasted question.** ChatGPT shows the pasted part as an attachment pill
   and only the typed tail in the bubble. The API has it all in one string, and the card shows that
   string's start.
7. **Dark theme works** (after a reload).
8. **Seek release misses twice in a row at two positions.** A release towards questions 6–7 of
   `math12`, with no layout memory, timed out after 10 s with the target unmounted, about 31k px into
   the previous question. 3 of the 5 positions landed on the previewed question.

## Environment and builds

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium 156 on Xvfb `:98` (1600×1000), software rendering, classic scrollbars, ChatGPT light theme (dark only in item 5); lock owner `features-1118`, held 02:44:45–03:24:32 UTC (40 min of the 120 min budget; queued from 02:37 while the lead's run held it) |
| fix | `~/snap/chromium/common/fix-1118-fix/butter`, `0.1.0-alpha.21+fix.1`, unpacked by the lead (not rebuilt); stored settings none (defaults), layout memory unconsented, so `data-butter-off="layout"` on every load |
| native | no extension (`EXT=`) |
| dev build | `fix-1118-dev` not used: no check here needed the bug-file recorder or the rail trace |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json` (local, not in the repo): 357 SSE chunks, replayed over 107 s (inter-chunk gaps capped at 1.5 s, as in bench.mjs) |

## 1. Streaming on today's page, without sending

### 1.1 Does the replay still work? Yes

`lab/harness/bench.mjs` itself was not run: it connects to `127.0.0.1:9222`, which is lab 1, and
installs no send guard. The new `lab/harness/stream-replay-live.mjs` keeps bench.mjs's recording
schedule and fetch hook and adds:

- the lab-2 lock check;
- the send guard, every WebSocket closed, and the service worker bypassed;
- local answers for ChatGPT's preparation POSTs, as the 2026-11-11 replay-blocking control gave
  them;
- a local denial of every other non-GET fetch;
- a self-test POST that must be answered by the hook before Enter is pressed.

Two small repairs to the replay itself:

- **Conversation id.** The recording's conversation id is remapped to the open chat's id. bench.mjs
  kept it, and that works only when the chat is the recording's own.
- **Request body.** The body is also read from a `Request` object. Today ChatGPT passes it as
  `init.body`, so this repair was not needed.

What today's page does when Enter is pressed, the same in all six runs:

- **Request path and format.** `POST /backend-api/f/conversation`, body keys `turn_attribution,
  conversation_id, action, model, parent_message_id, timezone, timezone_offset_min,
  is_do_not_remember, client_contextual_info, conversation_mode, gizmo_id, local_function_names,
  messages, supported_encodings, genui_state_snapshots, client_prepare_state`. That is the recording's
  set minus `thinking_effort`. The `delta_encoding` v1 stream from 2026-10-30 renders as before:
  612 answer blocks, `[data-talvt-turn-state="in_progress"]` on the streaming turn, and one
  `[class*="AdaptiveStreaming"]` element mid-stream.
- **Preparation POSTs.** Before the conversation POST, the page posts `/backend-api/conversation/init`
  (twice), `/backend-api/sentinel/chat-requirements/prepare` (twice) and
  `/backend-api/f/conversation/prepare` (twice). The hook answers them with `{}`, or for the sentinel
  `{token, proofofwork:{required:false}, turnstile:{required:false}, arkose:{required:false}}`.
- **Denied in the page.** 36–39 telemetry POSTs per run: `/v1/initialize`, `/ces/v1/rgstr`,
  `/ces/v1/telemetry/intake`, `/ces/statsc/flush`.
- **Aborted by the network guard.** 2–6 per run: `/backend-api/codex/notification/subscriptions`, a
  Cloudflare challenge `oneshot`, `/ces/v1/rgstr`, and once each `/backend-api/conversation/init` and
  `/backend-api/amphora/<id>`. Blocked requests never left the browser.
- **No escapes.** No `POST /backend-api/f/conversation` reached the network layer in any run
  (`PASS no-escape` ×6). After each run a fresh load 20 s later showed the same turn list (5 entries
  in the newest page, before and after; `PASS server-unchanged` ×6).

### 1.2 Butter's streaming selectors and marks (fix)

| | `math9` fix | `ats12` fix | `ats12` fix (probe run) | native (both fixtures) |
|---|---|---|---|---|
| samples with `in_progress` | 433/445 | 454/467 | 454/467 | 320/323, 400/418, 400/417 |
| mid-stream: blocks / computed `content-visibility: auto` | 282 / 282 | 284 / 284 | 286 / 286 | 269–275 / 0 |
| mid-stream: `data-butter-seen` / `data-butter-unrendered` | 23 / 244 | 23 / 249 | 23 / 251 | 0 / 0 |
| streaming turn's own `content-visibility` | auto | auto | auto | visible |
| after completion: blocks / cv auto / seen / unrendered | 612 / 592 / 26 / 566 | 612 / 592 / 27 / 565 | 612 / 592 / 25 / 567 | 612 / 0 / 0 / 0 |

- Every block of the streaming answer matched `containment.css`'s `in_progress` rule (all computed
  `auto` while streaming).
- `offscreen.js` marked the 23–25 blocks that rendered `data-butter-seen`. It marked the rest
  `data-butter-unrendered` as they arrived below the fold, so they stayed skipped after completion
  (592 of 612 still `auto`; the other 20 are wide blocks or rendered ones).

### 1.3 The smoother throttle

- **Callback text.** The callback text `throttle-main.js` matches,
  `() => { this.frame = void 0, this.publish() }`, still exists. Natively the harness's own
  `requestAnimationFrame` wrapper saw 370 exact matches on `math9` and 835–849 on `ats12`. No other
  callback whose source mentions `publish` or `flush` was seen.
- **Fix build.** `__butterStats` counted 358–361 smoother frames and 357–361 publishes, so the hook
  matched and ran each one. The harness wrapper sat under Butter's in the fix runs, so it saw Butter's
  deferred runner, 352–356 times.
- **Publish interval**, measured as the gaps between MutationObserver callbacks that touched the
  streaming answer:

| Arm | Fixture | DOM updates | min | p10 | median | gaps under 240 ms |
|---|---|---:|---:|---:|---:|---:|
| native | `ats12` | 671 / 667 | 17 ms | 50 ms | 103 ms | 552 / 544 |
| native | `math9` | 312 | 80 ms | 157 ms | 283 ms | 112 |
| fix | `ats12` | 336 / 334 | 150 ms | 256 ms | 267 ms | 3 / 3 |
| fix | `math9` | 329 | 151 ms | 257 ms | 268 ms | 5 |

Natively ChatGPT publishes every frame. Its smoother callbacks came a median 77–80 ms apart on
`ats12`, which is the frame rate of this software-rendered lab. On the much heavier `math9` they came
242 ms apart, because frames were that slow. With the fix build, publishes are held to about 250 ms
(p10 256 ms) on both. The few gaps under 240 ms are DOM updates outside a smoother publish. (No
timing claims beyond the interval; no perf lock was taken.)

### 1.4 The view while streaming, and wheeling through the answer afterwards

**While streaming.** On Enter, ChatGPT puts the new question near the view's top and leaves
scrollTop there for the whole stream: 144639 / 144594 on `math9`, 9592 on `ats12`, unchanged from the
first sample to the last, in every run of both arms. The answer grows below the view, so the view is
never at the chat's end while streaming (0 of 320–454 samples within 4 px of the end in every run).
"Does the view stay at the end" cannot arise on today's page. What can be judged did not happen:
scrollTop never fell by more than a viewport (`PASS stream-no-jump` ×6).

**After completion.** The harness scrolls to the end, wheels up in 700 px steps until it is two
steps past the streamed answer's top (55 steps natively, 60, the cap, with the fix build), then
wheels down to the end. It uses `wheel-jump-live.mjs`'s `SHIFT=1` measure (cause.md, Q4): the view
shift is the tracked element's on-screen move plus the user's step.

| Arm, fixture | up: block-tracked steps, shift > 4 px (max) | up: turn-tracked steps, shift > 4 px (sizes) | up: steps whose scrollTop moved beyond the step (max extra) | down: shift > 4 px | jump back |
|---|---|---|---|---|---|
| native `math9` | 0 / 42 (0 px) | 0 / 13 | 0 | 0 / 54 | none |
| native `ats12` (×2) | 0 / 48 (0.4 px) | 0 / 7 | 0 | 0 / 54–55 | none |
| fix `math9` | 0 / 50 (1.2 px) | **8 / 10** (848, 828, 632, 637, 839, 1018, 1025, 853) | **38 + 8** (1213 px) | 0 / 58 | none |
| fix `ats12` | 0 / 52 (1.1 px) | **6 / 8** (988, 997, 1076, 951, 834, 934) | **41 + 6** (1313 px) | 0 / 59 | none |
| fix `ats12` probe run | — | 6 / 60 counted together (988, 997, 1084, 951, 896, 747) | — | 0 / 60 | none |

How to read it:

- **No visible shift.** Where the measure tracked an answer block on screen, nothing moved more than
  1.2 px beyond the user's scroll, with or without Butter. Anchoring off does not show a visible view
  shift here.
- **The large values are not visible shifts.** All 6–8 large "view shifts" per fix run come from
  steps where no block was under the pointer and the measure fell back to the whole turn. The turn's
  top is ~80k px above the view, above all the blocks that changed size. Its "on-screen move" is the
  scroll correction below it, not something the user sees. (`doc` = 0 on those rows: the turn's top
  did not move in the content; scrollTop moved.)
- **What does differ: scrollTop.** With the fix build, 38–41 of the 50–52 block-tracked steps up and
  every turn-tracked one moved scrollTop further than 700 px, by up to 1313 px. The visible block
  stayed put. Natively scrollTop moved exactly 700 px on every step.
- **Who moves it.** The scroll probe (`PROBE=1`, `rail-jump-scroll-probe.mjs` in MAIN and in
  Butter's world) shows it is ChatGPT. The wheel-up phase had 231 wrapped `scrollTo` calls with the
  fix build and 8 natively. All came from MAIN, from one function in ChatGPT's bundle (`eo` in
  `/cdn/assets/76629.30a094a9b3.js`); none came from Butter's world. ChatGPT compensates scrollTop
  when content above the view changes height. Natively nothing above changed height, so its calls
  changed nothing.
- **Why content above changes height.** After completion the streamed answer is 81.5–81.6k px tall
  with the fix build, against 36.4k natively. The page's scrollHeight is 229920 against 181797 on
  `math9`, and 94772 against 46698 on `ats12`. The 565–567 blocks marked `data-butter-unrendered`
  keep `contain-intrinsic-size: auto 120px` until they first render, and these blocks are about
  60 px tall on average (36.4k px natively for 612 blocks). Wheeling up brings them into
  content-visibility's render range above the view, each shrinks to its real height, and ChatGPT's
  script scrolls by the difference. This is the 2026-11-16 open question ("never-rendered streamed
  blocks rendering above the view"). Answer: they do render while wheeling up, and the view holds
  only because ChatGPT corrects it in script. A one-frame flicker before the correction was not
  looked for.
- **Down after up.** Wheeling back down found everything rendered: 0 shifts, scrollTop exact, no
  jump back (`PASS wheel-no-jump` ×6).

### 1.5 The rail

The rail had 5 ticks before Enter. It had 6 from the first sample after Enter, and still 6 after
completion. Whether the new tick came from `history/conversation-main.js`'s send event or from the
rail reconciling the newly mounted turn was not told apart: the order of Butter's fetch wrapper and
the harness's hook was not recorded. With the pointer off the rail, the new tick was lit:
lit `[4,5]` on `math9`, `[3,4,5]` on `ats12`. All the lit turns are in the lit band, since the new
question sits near the top with the previous answer above it.

## 2. Send and stop buttons

With an empty composer the composer's form has four visible buttons: "Add files and more", "Select
ChatGPT model", "Dictate", and rightmost "Start Voice" (`data-composer-voice-start`). None matches a
send selector (as in the first pass). Twelve characters were typed with real keys, then Enter in the
replay runs; in every run the composer was empty again afterwards. Each button below is the rightmost
button of `form:has(.ProseMirror)`, same in native and fix, `math9` and `ats12`:

| State | Element | `id` | `type` | `aria-label` | `data-*` attributes | icon (`<use>`) | Butter selectors that match |
|---|---|---|---|---|---|---|---|
| text typed | `button` | none | `submit` | `Send` | none | none | `rail/pre-jump.js` `SEND_BUTTON` (via `button[type="submit"]`); `branch/page.js` `SEND` (via `button[aria-label="Send"]`); branch's structural `button[type="submit"]` |
| streaming | `button` | none | `button` | `Stop` | none | none | none: `[data-testid="stop-button"]` matches 0 |

- `[data-testid="send-button"]`, `#composer-submit-button` and `[data-testid="stop-button"]` match
  nothing in the whole document in any state.
- **Pre-jump.** With text typed, `pre-jump.js`'s keydown condition holds: the composer's form has a
  `SEND_BUTTON` that is not disabled (`would fire on Enter true` in every run). Whether it scrolls
  depends on the chat being more than 1.5 viewports from its end; in these runs the chat was at its
  end, so no pre-jump scroll was expected or looked for.

## 3. Earlier-history page size

`lab/harness/history-pages-live.mjs` opens `math12` and wheels to the top with real wheel input
(steps of −6000 px) until ChatGPT's turn list stays at 12 entries. It records every conversation GET
as the network layer sees it, which is after Butter's page-world rewrite.

| Arm | Newest page GETs (`num_turns`) | Earlier-page GETs `…/messages?before=` (`num_turns`) |
|---|---|---|
| native | 2 (10, 10) | 2 (10, 10) |
| fix | 2 (10, 10) | 7 (2, 2, 2, 2, 2, 2, 2) |

Query parameters: `num_turns`, `include_has_versions` (and `before` on earlier pages), unchanged
from the first pass. `history/conversation-main.js`'s rewrite still applies (`PASS older-page-size`).

## 4. The one wrong rail card (`ats12`, tick 4)

`lab/harness/rail-card-probe.mjs` loads all 12 questions, keeps ChatGPT's own conversation GET
responses in memory and builds the rail's question list from them as `history/conversation-main.js`
`item()` does. It hovers tick 4, clicks it, and compares the card, the API message and the turn
structurally. No text left the page or the script.

- **The card is the API's text.** The rail's 12 questions equal ChatGPT's 12 turns, and tick 4's id
  is the turn the click lands on. The card's text (389 characters, whitespace collapsed) is the API
  question's text cut at 400 with "…" (`rail/model.js` line 194). The API question is 915
  characters on 65 lines.
- **The API message is plain.** `content.content_type: "text"`, `content.parts`: one string; content
  keys `content_type, parts` only. The message keys are the same as every other question's, with no
  metadata key the others lack: no `attachments`, no hidden flag, no versions. Its neighbours are
  the usual `assistant/reasoning_recap` and `assistant/text`.
- **The page splits it.** The turn shows:
  - a `button[data-composer-attachment-pill][aria-haspopup="dialog"][aria-expanded][data-state][data-slot]`
    (label 11 characters; not "Pasted text" verbatim) before the bubble and outside it;
  - then `div[data-user-message-bubble][data-user-message-has-prompt]`, whose text is 37 characters
    (tree: five nested `div`s, the last `div[dir]`, the text in one leaf).

  The bubble's text is the API text's **tail**: it ends the API text and starts at character 878 of
  915 (normalized). The other 877 characters are not shown in the turn; the pill stands for them and
  opens a dialog. This is a long paste that ChatGPT stores inline in the message and shows as a
  pasted-text attachment.
- **Correction to the first pass.** It said neither text contains the other; with whitespace
  collapsed the bubble's text is contained in the API's.

So the card shows the pasted block, from its start, while the bubble shows the typed question.
Butter reads the question text from the API (`history/conversation-main.js` lines 103–115, `item()`),
and from the bubble only for turns the API lists lack (`rail/turns.js` lines 170–172). The API
carries no field that separates the pasted block from the typed part. The only marks are on the page:
the attachment pill and `data-user-message-has-prompt`. What rule ChatGPT uses to split the string
(a length threshold, a separator) was not established. Other chats with such questions were not
looked for.

## 5. Dark theme

`lab/harness/rail-dark-live.mjs` switches as the 2026-11-16 scrollbar-cover run did: the
`codex_appearance_theme` cookie and `localStorage.theme` set to `dark`, then a reload of `ats12` with
the fix build.

| | light (before) | dark | light (after restore) |
|---|---|---|---|
| `<html>` class / `data-theme` / `data-appearance-mode` | `chatgpt-theme` / `light` / `light` | `chatgpt-theme` / `dark` / `dark` | as before |
| computed `color-scheme`, body background | `light`, rgb(252,252,252) | `dark`, rgb(0,0,0) | as before |
| rail host `data-dark` | no | **yes** | no |
| tick bar colour / page behind | rgb(13,13,13) on rgb(252,252,252) | rgb(236,236,236) on rgb(0,0,0) | as before |
| contrast at rest (opacity 0.28) / lit (1) | 1.91 / 18.94 | 2.09 / 17.78 | 1.91 / 18.94 |

- **The rail works in dark after a reload.** There is no `dark` class on `<html>`, but the rail's
  second test, computed `color-scheme` (`rail/rail.js` lines 170–175), sees `dark`. The resting
  ticks contrast slightly more than in light.
- **The theme is back.** Cookie and `localStorage.theme` were put back to their exact earlier values
  (`light`, `light`). After later browser restarts and `lab-restore`, the home tab read cookie
  `light`, `localStorage.theme` `light`, `data-theme` `light`.
- **A live switch was not tested.** The rail re-checks on mutations of `<html>`'s `class` and
  `style` only (line 179), and on `prefers-color-scheme` changes for the "System" theme. ChatGPT's
  theme state is now in `data-theme` / `data-appearance-mode`. Whether a live switch from ChatGPT's
  settings also touches `class` or `style` was not established (see Not established).

## 6. `bookmarks-live.mjs` and the seek release landing

**`bookmarks-live.mjs`: not run.** `lab/harness/bookmarks-live/lab.mjs` takes its own lock with
`L.acquire('auto', { owner: 'butter-57-bookmarks-live-4' | 'butter-74-bookmarks-live-wash',
needsFixture, perf: !WASH })`. There is no option for a lab id or a borrowed lock. With lab 2 held by
this run it would have taken lab 1, which has `math12`. The brief said not to run it in that case.

**Seek release landing: 4 of 7 trials fail.** The trials are 5 positions in one run plus a rerun of
the two failing positions. `lab/harness/seek-landing-live.mjs` uses the fix build on `math12`, with
all 12 questions loaded and layout memory unconsented. Each trial:

1. puts the chat at a fraction of its range;
2. presses the classic scrollbar thumb (x = scroller right − 5, the thumb's centre computed with
   15 px arrows), drags it 160 px in four steps and holds;
3. reads what the preview draws and Butter's last seek update (`window.__seekDump(true)`: question
   index and offset at the view's top);
4. lets go and waits for the preview to hide and scrollTop to be still for 1.5 s (at most 10 s);
5. reads which question's turn covers the view's top below the header (inset 52 px) and the offset
   into it.

Every drag took: scrollTop followed the thumb by about 63k px.

**What the preview draws here.** With no stored layout the preview shows the "unseen" estimate: 0
layout items, `.est` shown at `top: 0`, the `unseen` fade and the notice. That is the mapped question
from its start (`seek/preview-main.js` `render()`, the `unseen` branch), so "what the preview showed"
is that question's top. The check passes when the chat lands on that question with its top within a
viewport of the view's top.

| Run, trial | Start → held scrollTop | Preview: question | Landed: question +offset | Session | Verdict |
|---|---|---|---|---|---|
| 2 #1 (0.2) | 69258 → 132267 | 3 | 3 +1 px | `landingErrorPx` 0, readable 3584 ms | PASS |
| 2 #2 (0.4) | 138495 → 201347 | 6 | **5 +31261 px** | `timedOut: true`, readable 10003 ms, destination question 6 | **FAIL** |
| 2 #3 (0.55) | 190431 → 253461 | 7 | **6 +31378 px** | `timedOut: true`, 10003 ms, destination question 7 | **FAIL** |
| 2 #4 (0.7, dragged up) | 242367 → 178855 | 5 | 5 +1 px | `landingErrorPx` 0, 3805 ms | PASS |
| 2 #5 (0.85, dragged up) | 294320 → 230977 | 7 | 7 +1 px | `landingErrorPx` 0, 3923 ms | PASS |
| 3 #1 (0.4) | 138515 → 201376 | 6 | **5 +31266 px** | `timedOut: true`, 10001 ms; target question 6 **not mounted**, mounted turns `[5]` | **FAIL** |
| 3 #2 (0.55) | 190458 → 253497 | 7 | **6 +31383 px** | `timedOut: true`, 10003 ms; target question 7 **not mounted**, mounted turns `[6]` | **FAIL** |

(The first, superseded run [seek-landing.log](seek-landing.log) shows the same pattern: 0.3 and 0.8
landed on the previewed question's top; 0.55 previewed question 7, timed out, and stopped in
question 6 at +31383 px.)

**The failing pattern.**

- Both failing positions are downward drags that end on questions 6 and 7.
- The release commits in 10–11 ms (`releaseToCommitMs`). The chat then stands at scrollTop 192.8k /
  226.9k: about 26.5k px above where the thumb was held, inside the previous question, about 31.3k px
  below that question's top.
- The target turn never mounts. Butter's readiness wait gives up after 10 s (`timedOut: true`,
  `seek/preview-main.js` line 1214) with no `landingErrorPx`, no retargets and `swap.items: 0`.
- Questions 5 and 6 are very long answers. Butter's destination for question 6 or 7 comes from an
  estimate (`known: false`, `stored: false`), and the scroll lands where only the previous turn is
  mounted. Whether ChatGPT's virtualizer would mount the target there given more time, or whether the
  estimate is short by the previous answer's unmeasured height, was not established.
- No native control applies: without Butter there is no preview and no landing.

## Stale selectors and failures: where the code depends on them

| What | Code | What the page has instead | Effect seen |
|---|---|---|---|
| Stop button `[data-testid="stop-button"]` | `extension/branch/page.js` line 119 (`streaming()`) | `<button type="button" aria-label="Stop">`: no `id`, no `data-*`, no `<use>` icon, the rightmost button of the composer's `form` (it takes the send button's place while streaming) | None visible: `streaming()`'s first test, `[data-talvt-turn-state="in_progress"]` in the scroller, matched in every streaming sample. The stop-button half is dead code; a fix would match `form:has(.ProseMirror) button[aria-label="Stop"]` (Chinese label not checked). |
| Send button `[data-testid="send-button"]`, `#composer-submit-button` | `extension/rail/pre-jump.js` line 15; `extension/branch/page.js` lines 14–19 | `<button type="submit" aria-label="Send">`: no `id`, no `data-*`, no icon; present only with text in the composer (empty: `button[aria-label="Start Voice"][data-composer-voice-start]`) | None: matched by `button[type="submit"]` (pre-jump) and `button[aria-label="Send"]` (branch). The first two alternatives are stale. |
| Question text for a long paste | `extension/history/conversation-main.js` lines 103–115 (`item()`), `extension/rail/model.js` line 194 (card cut at 400) | The API keeps one string (pasted block + typed question; here 877 + 37 characters). The page shows `button[data-composer-attachment-pill][aria-haspopup="dialog"]` for the block and the typed tail in `[data-user-message-bubble][data-user-message-has-prompt]`. | Card shows the pasted block's start, not the question the bubble shows (`ats12` tick 4). |
| Dark check observes `class`/`style` only | `extension/rail/rail.js` lines 170–182 | `<html class="chatgpt-theme" data-theme="dark" data-appearance-mode="dark">`, computed `color-scheme: dark` | Works on load; live switch not tested. |
| Never-rendered streamed blocks keep their placeholder | `extension/stream/containment.css` line 30 (`contain-intrinsic-size: auto 120px`), lines 41–42 (`[data-butter-unrendered]` stays skipped), `extension/stream/offscreen.js` lines 52–54 (`hold()`) | Blocks about 60 px tall on average; 565–567 of 612 held at 120 px after the stream | The finished answer is 81.5k px tall instead of 36.4k. Wheeling up, ChatGPT's own `scrollTo` corrects scrollTop on most steps (231 calls against 8 natively), by up to 1.3k px beyond the step. No visible shift > 1.2 px was measured. |
| Seek release to a far, unknown question | `extension/seek/preview-main.js` lines 1048 (`core.landing` destination), 1214 (10 s readiness give-up) | Target turn unmounted 10 s after the release; the previous long turn mounted | Chat left about 31k px into the previous question instead of at the previewed question's top (4 of 7 trials). |

## Not established

- **Visible flicker while wheeling up** through a streamed answer with the fix build. ChatGPT's
  correction might land a frame after the blocks shrink. Only post-step positions were measured, not
  every frame.
- **ChatGPT's `scrollTo` caller (`eo`).** Whether it is the reading-position logic seen in the first
  pass (`data-thread-reading="anchored"`) was not traced; only that it is ChatGPT's code, in MAIN.
- **The view shift on the earlier, non-streamed answers** today (11-16: at most 7.9 px) was not
  re-measured. Only the streamed answer was wheeled through.
- **Seek misses.** Why the two releases time out: an estimate error from the previous answer's
  unmeasured height, ChatGPT not mounting the target, or something else. Also whether stored layout
  (layout memory consented) avoids it, and whether it happens on other fixtures.
- **The send button's Chinese labels** and the stop button's label in other languages.
- **Pre-jump's scroll** when sending from far up: its condition was observed true, and no replay was
  sent from far up.
- **The live dark/light switch** from ChatGPT's settings (rail.js observes `class`/`style` only).
- **The paste-split rule** for long questions (the threshold at which ChatGPT shows a pill); other
  chats with such questions.
- **`bookmarks-live.mjs`** (not run, see §6). **Ask in branch** and macOS were out of scope.
- **Replay fidelity.** The replay uses an October recording. Today's server stream might differ in
  event types the page reacts to (for example the `resume_conversation_token` → WebSocket resume,
  which was closed here). The streamed answer rendered fully in all runs (612 blocks, same count in
  every run).

## Clean-up

- `lab-restore --lab 2 --owner features-1118`: exit 0, `"ok":true`. The browser was not restarted:
  the last run was native, which matches lab 2's defaults (no extensions, no flags). One home tab,
  empty composer.
- Theme read back afterwards: cookie `light`, `localStorage.theme` `light`, `data-theme` `light`.
- `lab-lock release --lab 2 --owner features-1118`: exit 0.
- `lab-lock status` at the end ([lock-status.log](lock-status.log)):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

Lab 1 was not used. The perf lock was never taken. Every fixture ended with the turns it started with.
No extension, test, doc or existing harness file was changed. `/tmp/features-1118-theme.mjs` is a
throwaway read-only reader used once at the end.

## Files

- `report.md` (this) and `commands.md` (each command and its final output lines).
- `*.log`: sanitized copies (home path → `~`, URLs → `<url>`, ids → `<id>`, the project id and the
  challenge path masked). They hold no chat text: lengths, counts, element and attribute names,
  ChatGPT UI labels (`Send`, `Stop`, …) and API field names only.
- `view-shift-by-kind.json`: per replay run, the view shift and the extra scroll by tracked element
  kind, the publish-interval summary, the streamed answer's size and marks after completion, and the
  probe's write count.
- New harnesses in `lab/harness/`, all needing a lab lock the caller holds (`LAB_OWNER`) and printing
  verdict lines:
  - `stream-replay-live.mjs` (items 1–2; `PROBE=1` adds the scroll probe);
  - `history-pages-live.mjs` (item 3);
  - `rail-card-probe.mjs` (item 4, REPORT only);
  - `rail-dark-live.mjs` (item 5);
  - `seek-landing-live.mjs` (item 6).
