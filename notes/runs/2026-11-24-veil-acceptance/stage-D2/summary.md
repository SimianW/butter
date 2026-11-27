# Veil acceptance, stage D2: the real find bar on held blocks (u4) (#177), 2026-11-25

**Question.** Stage D found the veil's `window.find` on a held block much slower than head's (first
call 930.6–948.4 ms against 96.1–104.4 ms). The spec (#170, "Acceptance runs") says `window.find` is a
stand-in for the browser's find bar, and asks for the real find bar, with key presses on the lab's
display, before judging. On `ats12` with `PHASES=stream UX=u4`, how long does the real find bar take
to reach the same string in the same block on the veil (`e5f480e`) and on head (`547fa0a`)? How much
does it block, and what is the longest frame?

**Answer.** These are the numbers. This stage does not judge the spec's rule.

- **Time to the match (drawn): veil 2,872.2–3,078.5 ms, head 1,361.9–1,881.0 ms after Ctrl+F.**
  The medians are 3,069.5 ms and 1,678.0 ms, a gap of 1,391.5 ms. Typing ended at +2,102 ms in
  every run.
  - On head, a prefix of the string already brought the block into view, drawn, before the last key
    (222–740 ms before it).
  - On veil, the block came into view 20.8–89.6 ms before the last key. It was still veiled at
    opacity 0 then (flags 11), and it was drawn 769.5–975.9 ms after the last key.
- **Longest frame: veil 871.6–925.3 ms, head 111.1–125.2 ms.** Each veil run had one long animation
  frame that started at +601 ms, the fourth typed key. The page drew no frame in it: the longest
  sampled frame interval was 881.1–924.0 ms. On head the longest sampled interval was 115.8–141.1 ms.
- **Blocking (LoAF `blockingDuration`), Ctrl+F to Escape: veil 114.3–193.5 ms, head 7.1–21.7 ms.**
  The medians are 186.6 and 8.6 ms. Most of the veil's long frame is not counted as blocking: from
  Ctrl+F to the drawn match, blocking was 16.6–88.6 ms while that one frame lasted 871.6–925.3 ms.
  Which work fills the frame is not established.
- **The find bar worked the same on both builds.** It found the string in block 429 and scrolled the
  page to it (scrollTop 9,754 to about 58,500–61,100). After Escape, the 19 characters were selected
  inside the block, with flags 0, in all 6 runs.
- **Verdicts:** every veil run passes all 13, `veil-none-rendered` and `veil-effective` included.
  Every head run passes 12 (`veil-effective` is not judged on head). No run printed a FAIL line.

Against stage D's `window.find` stand-in:

| | `window.find`, stage D first call (synchronous) | Find bar, this stage: longest frame | Find bar: time to drawn match |
|---|---:|---:|---:|
| head, median | 97.8 ms | 111.7 ms | 1,678.0 ms |
| veil, median | 933.3 ms | 896.3 ms | 3,069.5 ms |
| veil minus head | +835.5 ms | +784.6 ms | +1,391.5 ms |

The single long frame is about the size of the stand-in's gap. The time to the drawn match grows by
more than that, because on veil the block is drawn only about 0.8–1 s after it comes into view.

Exact commands are in [commands.md](commands.md). Per-run lines are in the `*.log` files, and the
per-run cuts and medians are in [findbar.jsonl](findbar.jsonl), made by
[findbar-extract.mjs](findbar-extract.mjs).

## How the find bar was driven and measured

- **The probe:** `U4_FINDBAR=1` with `UX=u4` (commit `9acab44`, `lab/harness/stream-findbar-probe.mjs`
  and `lab/harness/xtest-type.py`). It is off by default. It replaces u4's `window.find`,
  `scrollIntoView` and select-all with the find bar. It starts when u4 would, 500 ms after the 16 s
  frame sampling that follows completion.
- **Block and string:** u4's own rule for its first call, so the same as stage D's: block 429, 19
  characters, in every run. Before the find, its flags were 15 on veil (veil, opacity 0, content
  skipped, held) and 12 on head (skipped, held). The string is typed and never logged or saved, only
  its length.
- **Keys, as real X input on the lab's display (`:98`) through XTest:** the pointer is on the tab
  strip, as in `branch-shortcut-live.mjs`. Then Ctrl+F, 300 ms, the 19 characters one every 100 ms
  (last key at +2,102 ms), 5,000 ms, Escape (+7,103 ms), and 1.5 s more of sampling.
  - The page saw the Ctrl+F keydown 0.5–2.0 ms before the helper's own time stamp, in every run.
    That checks the clocks: the helper's epoch times minus the page's `performance.timeOrigin`.
  - The page saw no keydown for the typed characters, so they went to the find bar.
  - Before the lab, the same path was proven on a local Xvfb Chromium. There, Ctrl+F and typing
    scrolled a `content-visibility: auto` page to the match, and Escape left it selected.
- **Every frame from just before Ctrl+F:** scrollTop, the block's top in the view, whether it is in
  view, and its flags. A separate `long-animation-frame` and `longtask` observer runs from just before
  Ctrl+F.
- **Times are from the Ctrl+F press:**
  - **Settled in view:** the first frame of the last run of in-view frames that lasts until Escape.
    This is where the full string's match landed. A prefix can get there earlier (first in view).
  - **Drawn:** in view with no veil, opacity 0 or skipped content.
  - **Blocking and longest:** over the LoAF entries that start in the window.

## Per run

Columns: ms from Ctrl+F. "In view (flags)": first frame of the settled in-view run, with the
block's flags then (8 held, 11 = veil + opacity 0 + held). "Drawn": first frame of that run with the
block drawn. "First scroll": the find bar's first scrollTop change. "Last scroll": its last before
Escape. LoAF columns cover Ctrl+F to Escape; "to match" covers Ctrl+F to the drawn match.

| Run | First in view | In view, settled (flags) | Drawn | vs last key | First scroll | Last scroll | LoAF frames | Blocking | Longest LoAF (at) | Blocking to match | Longest sampled frame | After Escape: blocking, longest |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `head-ats12-u4fb-1` | 1,301.8 | 1,678.0 (8) | 1,678.0 | −424.8 | 716.8 | 1,788.9 | 17 | 7.1 | 111.1 (+1,209.5) | 7.1 | 115.8 | 0, 215.5 |
| `head-ats12-u4fb-2` | 1,361.9 | 1,361.9 (8) | 1,361.9 | −740.4 | 793.6 | 1,916.3 | 16 | 21.7 | 125.2 (+1,259.7) | 21.7 | 141.1 | 0, none |
| `head-ats12-u4fb-3` | 1,311.8 | 1,881.0 (8) | 1,881.0 | −221.8 | 720.9 | 1,881.0 | 17 | 8.6 | 111.7 (+1,218.4) | 8.6 | 117.0 | 0, none |
| `veil-ats12-u4fb-1` | 2,081.5 | 2,081.5 (11) | **3,069.5** | +967.2 | 1,646.6 | 2,918.0 | 14 | **114.3** | **925.3** (+602.1) | 16.6 | **924.0** | 12.0, 60.8 |
| `veil-ats12-u4fb-2` | 2,062.3 | 2,062.3 (11) | **2,872.2** | +769.5 | 1,613.3 | 2,872.2 | 13 | **186.6** | **896.3** (+601.3) | 32.1 | **896.7** | 13.9, 62.5 |
| `veil-ats12-u4fb-3` | 2,013.0 | 2,013.0 (11) | **3,078.5** | +975.9 | 1,589.7 | 2,850.1 | 14 | **193.5** | **871.6** (+601.2) | 88.6 | **881.1** | 18.0, 62.9 |

"vs last key" is the drawn match's time minus the last key's (+2,102.3 to +2,102.8 ms). Longtask
entries from Ctrl+F to Escape were 0 on head. On veil there were 2–4 per run (blocking 115–211 ms,
longest 108–138 ms), and each run's longest started at +2,821.5 to +4,316.0 ms, after the long frame.

## Medians per build

| Build | n | First in view | Settled in view | Drawn match | Last scroll | Blocking, Ctrl+F to Escape | Blocking to match | Longest LoAF | Longest sampled frame |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| head | 3 | 1,311.8 | 1,678.0 | 1,678.0 | 1,881.0 | 8.6 | 8.6 | 111.7 | 117.0 |
| veil | 3 | 2,062.3 | 2,062.3 | **3,069.5** | 2,872.2 | **186.6** | 32.1 | **896.3** | **896.7** |

## What the runs show

- **One long frame on veil, early in the typing.** In all 3 veil runs a LoAF of 871.6–925.3 ms starts
  at +601 ms, when the fourth character is typed. Stage D's first `window.find` call cost about the
  same extra time (+835 ms). The page drew nothing in it: the frame sampler's longest interval matches
  it. On head, no frame in the find was longer than 125.2 ms.
- **Little of it counts as blocking.** Blocking from Ctrl+F to the drawn match was 16.6–88.6 ms on
  veil, so the long frame is not mostly long script tasks. The probe does not record a LoAF's parts.
  A `TRACE_AT` trace around u4 in find-bar mode would split it.
- **The find bar's scrolling starts later on veil:** first scroll at +1,590–1,647 ms against +717–794
  ms on head. On head a prefix's match brought block 429 into view at +1,302–1,362 ms, and the page
  settled on the full match at +1,362–1,881 ms. On veil the block came into view at +2,013–2,082 ms,
  near the last key, still veiled (flags 11). It was drawn 0.8–1.0 s later, at +2,872–3,079 ms.
- **After Escape** both builds left the 19 characters selected inside block 429, with the block's
  flags at 0. Veil had 2–3 LoAF of up to 62.9 ms after Escape; head had at most one of 215.5 ms
  (run 1).
- **The rest of each run matches the earlier stages:** completion frame veil 661.3–701.6 ms, head
  1,915.5–5,167.4 ms (head run 2 had a 5,167.4 ms completion frame, which is outside u4's window).
  The veil had 584–586 blocks veiled before completion.

## Budget

6 harness runs, all valid (the first, `head-ats12-u4fb-1`, was the dry run that proved the key input
and counts as head run 1). From lock to release took 21 min 33 s, on lab 2 with the perf lock. The
acquire waited 21 min behind `veil-accept-D3`.
