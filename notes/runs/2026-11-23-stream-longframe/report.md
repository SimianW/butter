# Smoother streaming: when and what are the long frames — 2026-11-23 (stage 1)

Lab run only; no extension code changed. Lab 2, fixtures `ats12` and `math9`, one outer lock with
the perf lock (owner `stream-frames-1123`). The send guard was on in every connection and no message
was sent: every replay printed `PASS no-escape` and `PASS server-unchanged`. Raw captures (per-run
JSON with every frame, unsanitized logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-23-stream-longframe/`.

## Result

**Head's longest frame is the completion frame, in every head run.** It starts 105.02–105.05 s
after Enter, when the replay delivers its last two content-free chunks (`server_ste_metadata` and
`message_stream_complete`, 104.95–104.97 s after the replay POST, which comes about 50 ms after
Enter). `in_progress` goes away about 0.6 s into the frame. The frame has two parts:

1. **The stream task** (0.65–0.68 s, about 0.19 s of it forced style/layout). This is ChatGPT
   handling the final chunks inside the replay hook's timer task. It is the same size as natively
   (0.64–0.69 s).
2. **A ChatGPT `requestAnimationFrame` callback** (bundle `299268.*.js`, anonymous function) of
   1.26–1.34 s, of which 1.21–1.28 s is forced style/layout. Natively the same callback in the
   same frame takes 46 ms with no forced layout.

**On `ats12` it is the same event as native's longest frame** (0.79 s natively). So Butter makes
an existing freeze longer, by about 1.2 s, and all of that is forced layout in the rAF callback.
On `math9` native's longest frame is a different event: the Enter keydown, 1.54 s. Native's
completion frame there is 0.88 s, against 1.94 s with head.

**That extra forced layout needs `cv`.** With `cv` off it disappears: the rAF callback is 46 ms
with no forced layout. It does not need `throttle`: with `throttle` off the frame is the same
(2.01 s). `container` makes it shorter: with `container` off the same callback forces 7.2 s of
layout and the frame is 8.0 s.

**It is one outlier, not a class.** With head, the completion frame is the only frame of at least
1 s, and the only frame of at least 500 ms on `ats12` (on `math9` the Enter frame, 0.62 s, is the
second). Butter's other suspects do not show up:

- **Butter's own scripts:** no script that the long-frame entries name comes from a
  `chrome-extension://` URL, in any run.
- **The 1 s mark flush:** no batch of `data-butter-seen`/`-unrendered` fell inside any frame of
  at least 200 ms (0 of 7–32 per head run). No mark batch at all happened during the completion
  frame.

**Two runs agree closely:** the longest frame starts 4 ms apart (105018.8 and 105022.8 ms) and is
2051 and 1971 ms long. Blocking is 7100 and 7124 ms.

## Results table

**head** = `0.1.0-alpha.22+streamaudit.1`, a test build of `b2df865` (= `origin/main`), unpacked at
`~/snap/chromium/common/stream-audit-1123/butter`, no settings stored (defaults; layout memory not
consented, so `data-butter-off` includes `layout`). **native** = no extension. All runs used
`stream-replay-live.mjs` with `PHASES=stream`. The window is from Enter to 5 s after `in_progress`
is gone (about 112.6 s).

| # | Run | Fixture | OPTS | `data-butter-off` | LoAF | blocking | longest (start after Enter) | ≥200 / ≥500 / ≥1000 ms | Exit | Log |
|---|---|---|---|---|---:|---:|---|---|---:|---|
| 1 | head | `ats12` | — | `layout` | 355 | 7100 ms | **2051 ms** (105019, completion) | 7 / 1 / 1 | 0 | [log](head-ats12-1.log) |
| 2 | head | `ats12` | — | `layout` | 364 | 7124 ms | **1971 ms** (105023, completion) | 8 / 1 / 1 | 0 | [log](head-ats12-2.log) |
| 3 | head | `ats12` | `{"cv":false}` | `cv layout` | 560 | 20221 ms | 6006 ms (3290, early stream); completion 1538 ms | 14 / 2 / 2 | 1¹ | [log](head-ats12-cvoff.log) |
| 4 | head | `ats12` | `{"throttle":false}` | `throttle layout` | 517 | 15359 ms | 2015 ms (105103, completion) | 12 / 2 / 1 | 1¹ | [log](head-ats12-throttleoff.log) |
| 5 | native | `ats12` | — | none | 631 | 38672 ms | 792 ms (105321, completion) | 77 / 2 / 0 | 0 | [log](native-ats12.log) |
| 6 | head | `math9` | — | `layout` | 513 | 10897 ms | **1940 ms** (105049, completion) | 7 / 2 / 1 | 0 | [log](head-math9.log) |
| 7 | native | `math9` | — | none | 512 | 61358 ms | 1543 ms (0.3, Enter keydown); completion 878 ms | 165 / 5 / 1 | 0 | [log](native-math9.log) |
| 8 | head | `ats12` | `{"container":false}` | `container layout` | 460 | 31280 ms | 8016 ms (105020, completion) | 32 / 2 / 1 | 0 | [log](head-ats12-containeroff.log) |
| 9 | trace | — | — | — | — | — | not run (budget) | — | — | — |

¹ Exit 1 only from the switched-off mechanism's own checks: run 3 `FAIL cv-blocks` and
`FAIL seen-marks`, run 4 `FAIL throttle-matched`. Every other verdict passed, and every log ends
in `SUMMARY <label>: N FAILs`. `REPORT OPTS put back: sha256 42ba610a86d15094, same as before
true, opts null` in runs 3, 4 and 8.

### The completion frame in every run

The stream task is ChatGPT's work inside the replay hook's timer. Its source shows as `other`
because the hook is an init script without a URL. The rAF callback is ChatGPT's `299268.*.js`
`FrameRequestCallback`.

| Run | start | duration | stream task / forced | rAF callback / forced | other scripts |
|---|---:|---:|---|---|---|
| head `ats12` 1 | 105018.8 | 2051.4 | 681.7 / 184.0 | **1342.9 / 1283.2** | — |
| head `ats12` 2 | 105022.8 | 1970.9 | 651.4 / 184.2 | **1292.3 / 1236.6** | — |
| head `math9` | 105049.3 | 1940.0 | 648.3 / 198.0 | **1260.7 / 1206.2** | — |
| head `throttle` off | 105102.6 | 2014.6 | 661.0 / 188.4 | 1327.6 / 1268.8 | — |
| head `container` off | 105019.8 | 8015.9 | 665.2 / 214.7 | **7305.5 / 7232.7** | RO 18.3 / 15.9 |
| head `cv` off | 105133.5 | 1538.3 | **1440.1 / 960.8** | 46.5 / 0 | — |
| native `ats12` | 105321.3 | 792.0 | 644.8 / 191.7 | 45.7 / 0 | ChatGPT ResizeObserver 48.9 / 46.2 |
| native `math9` | 105363.7 | 878.0 | 694.5 / 247.3 | 45.7 / 0 | ChatGPT ResizeObserver 85.9 / 83.3 |

## Q1. When is head's longest frame?

In all three default head runs it is the completion frame: 105018.8 ms and 105022.8 ms after Enter
on `ats12`, and 105049.3 ms on `math9`.

- **Against the replay:** the replay POST came 47.7 / 50.8 / 72.8 ms after Enter. The schedule
  delivers chunk 352 (`server_ste_metadata`) at 104953 ms and chunk 353 (`message_stream_complete`)
  at 104974 ms after the POST, so these chunks arrive about 105.02 s after Enter, when the frame
  starts.
- **Against `in_progress`:** it was gone at 105630.9 / 105611.0 / 105636.7 ms, 0.59–0.61 s into
  the frame. The REPORT says `nearest mark inProgressGone -612.1 ms` (run 1), `-588.2 ms` (run 2)
  and `-587.4 ms` (`math9`). The MutationObserver saw the change inside the frame's stream task.
- **Against the last chunk:** the last replay chunk (107.41–107.43 s) arrives after the frame
  ends.
- **Same event everywhere:** it is the same event in both `ats12` runs and on `math9`, within
  4 ms and 31 ms of start.

REPORT lines (run 1):
- `laf top 1: start 105018.8 ms (before in_progress gone), duration 2051.4, blocking 1997.1, script part 686.2, rAF part 1354.4, render part 10.8, scripts 2; top script 1342.9 ms chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback" fn "" forced 1283.2 pause 0; nearest mark inProgressGone -612.1 ms; nearest butter batch -1113 ms (+0s/+8u)`

## Q2. What is it made of?

- **Mostly the rAF part:** script part (before rendering) 686 / 656 / 650 ms, rAF part 1354 /
  1305 / 1272 ms, render part (style/layout and later) only 11 / 11 / 17 ms. The freeze is not in
  the frame's own rendering step: it is layout *forced* from script.
- **Two scripts:**
  1. The replay timer task (`other`, `TimerHandler:setTimeout`), 648–682 ms with 184–198 ms
     forced. This is ChatGPT's stream handling of the final chunks, which runs as microtasks
     inside the hook's timer.
  2. ChatGPT's `FrameRequestCallback` from `299268.*.js` (anonymous), 1261–1343 ms with
     **1206–1283 ms forced style/layout**.
- **Not Butter's scripts:** no script in the frame comes from Butter. With `throttle` off
  (Butter's rAF wrapper bypassed) the callback is the same (1328 / 1269 ms), so it is not the
  throttle wrapper.
- **Which elements are laid out:** not measured. There is no trace (run 9 was not reached).
  `299268.*.js` is also the bundle whose rAF callbacks carry most of the streaming work
  (231 callbacks, 13.7 s in run 1), which fits the smoother's publish. This is not confirmed.

## Q3. One outlier or a class?

| Run | ≥200 ms | ≥500 ms (start, ms) | ≥1000 ms |
|---|---:|---|---:|
| head `ats12` 1 | 7 | 1 (105019) | 1 |
| head `ats12` 2 | 8 | 1 (105023) | 1 |
| head `math9` | 7 | 2 (0.2 Enter 616 ms; 105049) | 1 |
| native `ats12` | 77 | 2 (76271 572 ms; 105321 792 ms) | 0 |
| native `math9` | 165 | 5 (0.3 Enter 1543; 76693 819; 92905 523; 101023 503; 105364 878) | 1 |

With head it is one outlier. The next longest frames on `ats12` are 349–362 ms: a ChatGPT rAF
callback at 42.2 s with 289–295 ms forced, and a stream task at 76.2 s.

REPORT lines:
- `laf histogram: >=200 ms 7, >=500 ms 1, >=1000 ms 1` (run 1)
- `laf histogram: >=200 ms 8, >=500 ms 1, >=1000 ms 1` (run 2)

## Q4. Native's longest frame

- **`ats12`:** the completion frame, 792 ms, at 105321 ms, 582 ms before `in_progress` goes.
  Stream task 645 ms (192 forced), rAF callback 46 ms (0 forced), ChatGPT ResizeObserver 49 ms
  (46 forced). It is **the same event as head's**: Butter leaves the stream task unchanged and
  adds about 1.2 s of forced layout to the rAF callback.
- **`math9`:** the Enter keydown, 1543 ms at 0.3 ms: ChatGPT's `DIV.onkeydown` (`257798.*.js`),
  1468 ms with 1197 ms forced. With head that frame is 616 ms (327 forced). Native's completion
  frame on `math9` is 878 ms, against head's 1940 ms. So on `math9` head is better at Enter and
  worse at completion.

## Q5. Ablation on `ats12` (against runs 1–2)

| | longest | completion frame | ≥500 ms | blocking |
|---|---|---|---:|---:|
| runs 1–2 | 2051 / 1971 | the same | 1 / 1 | 7100 / 7124 |
| `cv` off | **6006** (3290 ms after Enter) | 1538 (forced moved into the stream task: 961 ms; rAF 46 ms, 0 forced) | 2 | 20221 |
| `throttle` off | 2015 | 2015 (rAF 1328 / 1269 forced) | 2 | 15359 |
| `container` off | **8016** | 8016 (rAF 7306 / 7233 forced) | 2 | 31280 |

- **The 1.2 s forced layout in the completion rAF callback needs `cv`.** It is gone with `cv`
  off. `throttle` has no effect on it. `container` limits it: without the size container it
  is 5.6× longer.
- **With `cv` off the completion frame is still 1.54 s**, twice native's 0.79 s. Most of it is
  now forced layout in the stream task (961 ms, against 184–192 ms natively and with head). What
  Butter changes there with `cv` off (containment CSS, the `container` mechanism, or the seek
  and layout-cache code) is not established.
- **The 6.0 s frame with `cv` off** comes 3.29 s after Enter, 0.7 s after `in_progress` appears.
  It is a 5010 ms script in the replay timer task with only 21 ms forced: script, not layout. It
  happened in one run and is not explained.
- **`throttle` is the main blocking gain:** off, blocking goes from 7.1 s to 15.4 s, and
  ChatGPT's rAF callbacks rise from 13.7 s to 29.2 s (forced 3.3 s to 10.1 s). It does not set
  the longest frame.

## Q6. Where head's remaining blocking goes (`ats12` runs 1 / 2)

- **Totals:** blocking 7100 / 7124 ms. The completion frame is 1997 / 1917 ms of it (28% / 27%).
  The rest grows with the answer.
- **Blocking per 10 s from Enter** (run 1): `0s:274 10s:9 20s:30 30s:61 40s:469 50s:159 60s:288
  70s:927 80s:761 90s:1334 100s:2789`. 4.5 s of the 7.1 s fall after 85 s.
- **Over all long frames** (total duration 28367 / 28930 ms):
  - by part: script 8119 / 8109, rAF 18740 / 19221, render 1509 / 1600 ms;
  - forced style/layout from script: 3860 / 3886 ms.
- **Script by source** (scripts of at least 5 ms that the long-frame entries name):

  | Source | run 1 | run 2 |
  |---|---:|---|
  | ChatGPT, total | 15230 ms | 15224 ms |
  | ChatGPT rAF callbacks | 13715 ms in 231 callbacks (3331 forced) | 13856 ms (3315 forced) |
  | ChatGPT timers | 1127 ms | 1014 ms |
  | ChatGPT keydown | 226 ms | 226 ms |
  | ChatGPT ResizeObserver | 118 ms | 116 ms |
  | `other` (the replay timer task, with ChatGPT's microtasks in it) | 1612 ms | 1756 ms |
  | Butter | **0** (`laf butter files: {}`) | **0** |

- **Against native** (`ats12`): render part 20759 ms, ResizeObserver 8736 ms, forced 21325 ms.
  Head removes almost all of native's render-step and ResizeObserver cost.
- **About Butter's 0:** Butter's isolated-world MutationObserver and ResizeObserver callbacks and
  its 1 s flush either took under 5 ms each, or ran as microtasks inside another script's entry
  and were counted there. Butter's MAIN-world throttle wrapper calls ChatGPT's callback, which is
  then named as ChatGPT's. These numbers cannot separate those cases.

## Q7. Run-to-run spread

| | run 1 | run 2 | difference |
|---|---:|---:|---|
| longest frame | 2051.4 ms | 1970.9 ms | 80 ms (4%) |
| its start after Enter | 105018.8 | 105022.8 | 4 ms |
| blocking | 7099.7 ms | 7124.0 ms | 24 ms (0.3%) |
| LoAF count | 355 | 364 | 9 |
| ≥200 / ≥500 ms | 7 / 1 | 8 / 1 | — |

- **Within one sequence**, one run places and sizes the completion frame reliably (±4%).
- **Across days, much less so.** Yesterday's head `ats12` run (same build, same fixture, similar
  window) blocked 11.1 s against today's 7.1 s; head `math9` 13.1 s against 10.9 s. Native moved
  less: 40.9 s against 38.7 s, and 62.3 s against 61.4 s. The longest frames agree across days
  (2.10 against 2.05 s, 2.06 against 1.94 s).
- Compare arms only within one sequence.
- One run cannot show:
  - a frame that happens in some runs and not others (the 6.0 s `cv` off frame);
  - differences in blocking smaller than about 10% across days.

## Environment

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium 157.0.8103.50 (snap) on Xvfb `:98` (1600×1000), software rendering (llvmpipe), ChatGPT light theme |
| Lock | owner `stream-frames-1123`, lab 2 **and perf**, taken 05:03:13 UTC on 2026-11-24 (no queue), restored 05:29:53, released right after. 27 min of the 30 min budget, 8 of 10 harness runs. |
| head | `~/snap/chromium/common/stream-audit-1123/butter` (built in the 11-23 recheck, unchanged). Storage before every head run: `sha256 42ba610a86d15094, local keys [], sync keys [], opts null` (nothing stored). |
| Recording | `~/Dev/butter/lab/harness/recordings/en-t09.json`, 357 chunks; schedule ends 107.36 s after the POST; `message_stream_complete` at 104.97 s |
| Window | `startLafProbe` just before Enter; stopped 5 s after the harness saw the replay done and `in_progress` gone (112.5–112.7 s; `container` off 118.7 s because the main thread held back the last chunk to 113.4 s) |

Harness changes made for this run (worktree only, not committed):

- **`stream-laf-probe.mjs`** keeps every `long-animation-frame` entry with its parts and script
  rows. Sources are reduced to `chatgpt:<file>`, `butter:<path>` or `other`. A MutationObserver
  on `data-talvt-turn-state`, `data-butter-seen` and `data-butter-unrendered` records the
  timeline marks. Enter is the keydown's `timeStamp`.
- **`stream-laf-report.mjs` (new)** builds the rows on the Enter clock, the 30 longest frames
  with their nearest mark, the histogram, the 10 s buckets, the sums, and the `REPORT laf …`
  lines. It adds a rAF part (`styleAndLayoutStart − renderStart`) next to the script and render
  parts the brief asked for.
- **`stream-run-opts.mjs` (new)** handles `OPTS`: it puts the options back in `finally` and
  compares a hash of local and sync storage before and after. It also holds the trace window for
  `TRACE_AT` (written but not exercised live).
- **`stream-replay-live.mjs`** (500 lines) records the first and last chunk time in the hook,
  observes 5 s past completion, adds `PHASES=stream`, `OPTS`, `TRACE_AT` and
  `REPORT data-butter-off`.
- **`lab/README.md`** describes all of this.

`npx eslint` on the four files exits 0. Dry checks before the lock:
- the probe on a blank page in headless Chromium gave per-frame rows with a `scripts` list;
- `OPTS={"cv":false}` was applied to the head build in a throwaway headless profile and put back
  (`same as before true`); the profile was deleted.

## Not established

- **Which elements** the completion rAF callback lays out or restyles, and how many. Run 9, the
  trace, was not reached within the budget.
- **Why `cv` makes that callback force about 1.2 s of layout.** It could be the
  `content-visibility: auto` blocks that become relevant at completion, or the 120 px
  placeholders of the 565 never-rendered blocks. Which ChatGPT function it is (anonymous, in
  `299268.*.js`) is also open.
- **Why the completion frame is still 1.54 s with `cv` off**, and what the 6.0 s frame
  3.3 s after Enter with `cv` off is (one run).
- **How much script time is Butter's own.** It appears as 0, but it may be under the 5 ms
  threshold or folded into microtasks; see Q6.
- **Spread** beyond two runs of one arm, and on `math9`.

## Clean-up

`lab-restore --lab 2 --owner stream-frames-1123` restarted the browser without extensions, put the
home URL back and cleared the composer (`"ok":true`, exit 0). `lab-lock release` freed lab 2 and
perf; `lab-lock status` prints `"held": false` for lab 1, lab 2 and perf
([restore.log](restore.log), [release.log](release.log)). Butter's stored settings are as found:
the same hash before every head run and after each `OPTS` run. The trace option made no files.
