# Seek release pull to the chat's end: native control — 2026-11-22

Stage 2 of [seek-narrow-live](../2026-11-22-seek-narrow-live/report.md). Lab 2, fixture `math12`,
**no extension** loaded (`EXT=` empty) in every run. The send guard was on in every connection and
no message was sent. The only inputs were scrollbar drags and scrollTop writes from the harness. Raw
captures stay in `~/.local/share/chatgpt-lab/captures/2026-11-22-seek-pull-control/`.

## Result

**The pull to the end is ChatGPT's own. Butter is not needed for it.** With no extension, after
all history was loaded, **6 of 6** scrollTop writes (3 to 0, 3 to 229284) were back at the chat's
end 1.8–2.6 s later. They stayed there to the end of the 6 s window. Each time, the in-page probe
logged one `scrollTo` to the end, called by ChatGPT's code from a `ResizeObserver` callback, 1.0–1.8
s after the write. At 229284, question 7 was mounted at the view's top before the pull, the same
state Butter's 3 lost releases were in. On 11-19, a scrollTop 0 write after loading history held,
so this is a page change since then. **But no native thumb release was pulled: 0 of 20** (2 runs ×
10 releases, scrollTop flat for 8 s after each). In both runs the first `put(0.1)` after the
history loop was pulled to the end, and every `put` after the first thumb drag held. So ChatGPT's
pull only works while the chat is in an "at the end" state. Writes from script keep the chat in
that state, and a native thumb drag clears it. Natively, 0 of 18 `put`s that came after a drag
were pulled. In stage 1 with Butter, 6 of 18 were (run 1 #2, #8, #9; run 6 #2, #8, #10: start
scrollTop 346301–347474). So with Butter loaded, a thumb drag and release does not reliably clear
that state, and Butter's releases are exposed to a pull that native releases are not. **Answer: the pull is a page change, not our regression. Butter's release path is still
exposed to it, and native drags are not.** Step 3 (a pre-#148 build against current main) was
skipped, as the brief says to do once steps 1–2 show the pull natively.

## Builds

None. Every run had `EXT=` empty, and `BROWSER {"extensions":[],"flags":[]}` was confirmed in
[hold-1.log](hold-1.log). No build was made and no version was changed. Every command ran from a
worktree at `10008f2` (`origin/main` was `4c472c9`; the harness and the lab scripts it uses are the
same in both) with `LAB_ID=2 LAB_OWNER=seek-pull-1122 LAB_PLAYWRIGHT=<worktree>/node_modules/playwright`,
after `npm ci`. The lab's main checkout was not touched (`lab-lock` warned that it is 15 commits
behind `origin/main`).

## Runs

The lock was taken with `lab-lock acquire --lab 2 --owner seek-pull-1122 --wait 1800 --needs-fixture math12`.

| # | Command | Exit | Result | Log |
|---:|---|---:|---|---|
| 1 | `EXT= FIXTURE=math12 TRACE=8000 AT=0.1,0.2,0.3,0.4,0.5,0.55,0.65,0.7,0.8,0.85 node lab/harness/seek-landing-live.mjs` | 0 | 0 of 10 releases pulled; trial 1's start `put(0.1)` was at the end (314192 = scrollHeight 315104 − 912) | [native-1.log](native-1.log) |
| 2 | the same | 0 | 0 of 10 releases pulled; trial 1's start `put(0.1)` was at the end (347330 = 348242 − 912) | [native-2.log](native-2.log) |
| 3 | `EXT= node adhoc/hold.mjs` (defaults `TOPS=0,229284 REPS=3 MS=6000`) | 0 | 6 of 6 writes pulled to the end, by a ChatGPT `scrollTo` from a `ResizeObserver` callback | [hold-1.log](hold-1.log) |

`TRACE=8000` (the harness default is 2000) is the only change from the brief's command. Stage 1's
pulls came 1–4 s after release, so each release was sampled every 100 ms for 8 s (80 samples per
release, all taken).

**`adhoc/hold.mjs`** ([copy](adhoc/hold.mjs)) restarts the lab browser with `EXT`, opens the
fixture and loads all earlier history with the same loop as `seek-landing-live.mjs`
(scrollTop 280, then 0, until the entry count holds). Then, for each rep and each target, it writes
scrollTop once and samples scrollTop, scrollHeight and the question at the view's top in the page
every 100 ms for 6 s. An init script wraps the `scrollTop` setter, `scrollTo`, `scroll`, `scrollBy`
and `scrollIntoView`. It logs every write within 3 viewports of the chat's end, with the calling
function names only. The page was busy after each write, so the 100 ms timer produced 37–45 samples
in 6 s and none for about 1 s around the pull.

## Step 1: native thumb releases

"At release" is the question covering the view's top in the first sample after mouse-up. "Final"
is the same at the end of the 8 s trace and the settle. scrollTop did not change by even 1 px
between them in any trial, so in no trial did the pull happen.

| Run | Trial (f) | Start scrollTop (after `put(f)` + 3.5 s) | Released at scrollTop | At release | Final | Pull to the end |
|---:|---|---:|---:|---|---|---|
| 1 | 1 (0.1) | **314192 (end)** | 313394 | 10 +16784 | 10 | no (started at the end) |
| 1 | 2 (0.2) | 62838 | 120021 | 3 | 3 | no |
| 1 | 3 (0.3) | 94261 | 151549 | 4 | 4 | no |
| 1 | 4 (0.4) | 125682 | 182718 | 5 | 5 | no |
| 1 | 5 (0.5) | 157102 | 216240 | 6 | 6 | no |
| 1 | 6 (0.55) | 191032 | 253969 | 7 +24686 | 7 | no |
| 1 | 7 (0.65, up) | 225858 | 162445 | 5 | 5 | no |
| 1 | 8 (0.7, up) | 243232 | 179482 | 5 | 5 | no |
| 1 | 9 (0.8, up) | 277979 | 214348 | 6 | 6 | no |
| 1 | 10 (0.85, up) | 295353 | 232177 | 7 +2894 | 7 | no |
| 2 | 1 (0.1) | **347330 (end)** | 346532 | 10 +16784 | 10 | no (started at the end) |
| 2 | 2 (0.2) | 69466 | 132675 | 4 | 4 | no |
| 2 | 3 (0.3) | 104199 | 167526 | 5 | 5 | no |
| 2 | 4 (0.4) | 138932 | 201982 | 6 | 6 | no |
| 2 | 5 (0.5) | 173665 | 236834 | 7 +7551 | 7 | no |
| 2 | 6 (0.55) | 191111 | 254365 | 7 +25082 | 7 | no |
| 2 | 7 (0.65, up) | 225858 | 162446 | 5 | 5 | no |
| 2 | 8 (0.7, up) | 243232 | 179482 | 5 | 5 | no |
| 2 | 9 (0.8, up) | 277979 | 214348 | 6 | 6 | no |
| 2 | 10 (0.85, up) | 295353 | 232178 | 7 +2895 | 7 | no |

- Natively, the turn under the released thumb covered the view's top 3–39 ms after release, and
  the chat stayed there. Question 7 was the question at release 5 times (run 1 #6, #10; run 2 #5,
  #6, #10), with no pull. Butter lost all 3 of its stage-1 misses on question 7.
- Trial 1's start in both runs: the harness wrote `(scrollHeight − clientHeight) × 0.1` right after
  the history loop, and 3.5 s later the chat was exactly at its end. After trial 1's drag, every
  `put(f)` held (start scrollTop = f × range, e.g. 0.2 × 314190 = 62838).
- scrollHeight grew from 315104–315116 to 348242–348386 in run 1 as turns 6–7 mounted for the first
  time (measured heights replacing estimates). Run 2 started at 348242.

## Step 2: native scrollTop hold

After the history loop the chat was at its end (`HISTORY 12 entries {"y":314068,"h":314980,"vh":912}`),
and it was still there 3 s later. Its last write in the loop was scrollTop 0, so this is the same
pull. "Held until" is the last sample still at the written value, and "pulled by" is the first
sample at the end. "ChatGPT `scrollTo`" is the time the probe logged the write to the end, which
falls between those two samples.

| Rep | Write | Question before the pull | Held until | ChatGPT `scrollTo` to the end | Pulled by | Final (6 s) |
|---:|---:|---|---:|---:|---:|---|
| 1 | 0 | none at the view's top | 981 ms | 1043 ms → 314068 | 1957 ms | 314068 (end), question 10 |
| 1 | 229284 | 7 | 1519 ms | 1610 ms → 314016 | 2414 ms | 314016 (end), question 10 |
| 2 | 0 | none | 933 ms | 1031 ms → 314016 | 1896 ms | end, question 10 |
| 2 | 229284 | 7 | 1529 ms | 1640 ms → 314016 | 2547 ms | end, question 10 |
| 3 | 0 | none | 948 ms | 1018 ms → 314016 | 1833 ms | end, question 10 |
| 3 | 229284 | 7 | 1660 ms | 1758 ms → 314016 | 2615 ms | end, question 10 |

Each write had exactly one logged write to the end. Its caller chain, as minified names:
`ah < callback < aj < callback < ResizeObserver.<anonymous>`. No `scrollIntoView` was logged. Each
write produced 2 scroll events: the write itself and the pull.

## What this says about stage 1

- The pull in stage 1 matches this one: at the chat's end (346445–347474 in that session's
  scrollHeight), 1–4 s after a write, with question 7 mounted at the top. That makes stage 1's 3
  lost estimated releases (run 1 #5, #6, #10), its stored-layout release (run 6 #9) and its
  measuring step (scrollTop 0 back at the end within 3 s) the same ChatGPT behaviour.
- Natively, one thumb drag ends the state in which ChatGPT pulls (all 18 later `put`s held). In
  stage 1 with Butter, 6 of the 18 `put`s that followed an earlier drag were pulled to the end
  (`seek-est-1.log` trials 2, 8, 9; `seek-aim-1.log` trials 2, 8, 10; the other 12 held). Trial 1
  of each run started at the end, as natively. So a Butter drag and release does not reliably
  register with ChatGPT as the user scrolling away from the end. Butter's finds then write scrollTop
  while ChatGPT may still treat the chat as pinned to its end, and the next resize brings it back.
  Which releases leave the pin set was not worked out: run 1 #6 ended at the end and #7's `put`
  held, while #7 landed on its question and #8's `put` was pulled.

## Not established

- **Why a Butter release does not clear ChatGPT's pin to the end.** This is inferred from stage 1's
  start positions and was not tested directly. Candidates are the preview capturing the drag's
  pointer or scroll events, or Butter's release writes. A test would be a no-find release with
  Butter loaded, followed by a `put` and a hold check.
- **Whether the pre-#148 build behaves the same.** Step 3 was skipped, as the brief says to do. Since
  the pull is ChatGPT's own, both builds are probably exposed to it. Whether either one's drag clears
  the pin was not compared.
- **Which ChatGPT state the pull depends on, exactly.** The probe gives minified names only (`ah`,
  `aj`). That it is an "at the end" flag cleared by user scrolling is inferred from the native
  pattern (pulled before the first drag, held after it), not read from the code. A wheel scroll
  was not tried as the clearing input.
- **When the page changed.** It came after 11-19's run, where a scrollTop 0 write held, and before
  or on 11-22. It was seen in 1 browser on lab 2 only.

## Lab time and clean-up

- Lock `seek-pull-1122` on lab 2 from 04:31:10 to 04:42:14 UTC (2026-11-23; the evening of 11-22
  local), about 11 min, 3 runs. Lab 1 was not used.
- No extension was loaded, so no extension storage was read or changed, and "Remember long-chat
  layouts" was not touched.
- `lab-restore --lab 2 --owner seek-pull-1122`: exit 0, browser already at lab 2's defaults (no
  extension, `restarted: false`), home tab, empty composer ([restore.log](restore.log)).
  `lab-lock release`: exit 0. [lock-status.log](lock-status.log):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Files

- `report.md` (this).
- `*.log`: one per run or step, copied from the raw logs with URLs replaced by `<url>` and the home
  path by `~`. They hold question indices, pixel numbers, ms, minified function names and verdict
  lines. They hold no chat text, chat URLs, ids or account names.
- `adhoc/hold.mjs`: the step 2 script, with the home path made generic.
