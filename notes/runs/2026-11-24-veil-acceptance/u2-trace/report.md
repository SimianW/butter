# Veil u2 trace: what the veil's longer blank frames after a jump into held blocks are made of (#170, #177), 2026-11-25

**Question.** Stage C2 ([summary](../stage-C2/summary.md)) found that after a scrollTop write onto held blocks in
the middle of a just-completed `ats12` answer (`UX=u2 U2_BLOCK=306`), the veil (`e5f480e`) shows its 3 blank
frames for 227–237 ms, against 122–158 ms on `main` before the veil (`547fa0a`, "head"). The extra time is one
long second frame (65–68 ms render part) plus 45–58 ms before the next frame's rAF. The headless fix on
`veil/u2-reveal` (`isolation: isolate`) changed nothing live. What is that work, and what in the veil triggers
it?

**Answer.** The veil does not add work at the jump. It moves work there that head does at completion. On head,
ChatGPT's completion rAF reads styles and layout from inside the held blocks (see
[stream-hydrate](../../2026-11-24-stream-hydrate/report.md)), so their contents get style, layout objects and
layout during the completion frame. The veil makes that walk stop at each veiled block, which is how it cuts
the completion frame (here 659–663 ms on veil against 1849–1889 ms on head). The cost is that the blocks'
contents are first styled and laid out when they first come into view. In the two traced pairs:

1. **Frame 2: first style and layout of the math inside the newly visible blocks.** One `Layout` of
   **64.7–66.7 ms** (63 dirty roots of 6,901 objects) with **1,575 style resolutions** and **2,110 layout
   objects added** (KaTeX `<span>`s, MathML `mn`/`mo`/`mi`, text). On head the same frame lays out in 1.4–1.5 ms,
   resolves 51 styles and adds no layout objects. Head restyles only the block roots that Chromium unlocks
   ("DisplayLock", 98 on both builds), because their contents were styled and laid out before.
2. **Frame 3: a web font, first needed by that math, loads and forces it all to restyle and relayout.**
   While frame 2's layout runs, Chromium requests a woff2 font from ChatGPT's CDN (VeryHigh priority, not from
   cache) at +177/+184 ms after the write. It arrives at +237/+238 ms. Frame 3 then starts with a pass before
   its rAF callbacks: **1,411 "Fonts" style invalidations** (all MathML), 1,092 style resolutions (4.4–4.5 ms)
   and a **37.0–37.8 ms `Layout`** (80 dirty roots), then 1.7 ms of pre-paint. After rAF it adds **422 more
   layout objects** (327 style resolutions, 12.0–12.2 ms of style) for the blocks unlocked in this frame. Head's
   trace has no font request and no "Fonts" invalidation at all, and its frame 3 costs 0.9 ms of style and
   1.4–1.7 ms of layout.

Frames 2 and 3 together carry about **100–105 ms more main-thread work on veil**. That matches the extra ~90–100 ms
of stage C2 and of these runs (frame 2 → 3: 158.6–166.9 ms on veil, 71.1–81.8 ms on head).

**What triggers it in the veil:** not the unveil itself. Butter's state-change handler (`offscreen.js:93`,
`data-butter-veil` removed and `data-butter-unveiled` set on 22 blocks) runs only *after* frame 2's long layout,
in a separate task at +229–237 ms, for 6.4–6.5 ms of event dispatch. Its style cost is 44 self-invalidations
of the 22 block roots ("Related style rule"). The work comes from the blocks' contents never having been
styled or laid out, which is the veil's purpose (the paint-readiness walk returns at a block with computed
opacity 0). Chromium's own `content-visibility: auto` unlock then does it when the block comes into view.

Ruled out as the source of the gap, with numbers below: ChatGPT's scripts (same callbacks with the same
durations on both builds, and no different reaction to unveiled blocks); a ChatGPT `:has()` rule (25 ":has()"
invalidations on both builds); transitions or animations (none in either trace); raster (24–27 raster tasks,
3.7–4.3 ms, on both builds); Butter's own scripts (under 1 ms in total per frame).

This is diagnosis only. No fix was tried.

## Runs

Lab 2, fixture `ats12`, stage C2's settings (`PHASES=stream UX=u2 U2_BLOCK=306
OPTS={"rail":true,"bookmark":true}`), builds `~/snap/chromium/common/veil-accept/head/butter` (`547fa0a`) and
`.../veil/butter` (`e5f480e`) as in stage C2, one lock, run order head, veil, head, veil. Each run kept a 4 s
trace (`TRACE_AT=108000 TRACE_SPAN=4000`) with these categories added to the harness's default ones:
`disabled-by-default-devtools.timeline.invalidationTracking`, `disabled-by-default-devtools.timeline.frame`,
`disabled-by-default-v8.cpu_profiler`. Adding them needed two new harness settings, `TRACE_SPAN` and
`TRACE_CATS` (commit `df7dd89`, with a helper test).

| Run | Completion frame (ms) | u2 write (ms after completion) | Blank frames, longest run | Write → clear (ms) | Frame intervals (ms) | Points (frames 1, 2, 3, clear) | Verdicts |
|---|---:|---:|---|---:|---|---|---|
| `head-u2-trace-1` | 1849.3 | 4223.9 | 3 (188.9 ms) | 227.9 | 70.1, 71.1, 47.7 | `444444-` `444444-` `000444-` `000000-` | 12 PASS, 0 FAIL |
| `veil-u2-trace-1` | 663.0 | 3180.5 | 3 (298.9 ms) | 360.6 | 53.4, **166.9**, 78.6 | `777777-` `777777-` `000777-` `000000-` | 13 PASS, 0 FAIL |
| `head-u2-trace-2` | 1889.0 | 4389.7 | 3 (248.4 ms) | 309.7 | 72.1, 81.8, 94.5* | `444444-` `444444-` `000444-` `000000-` | 12 PASS, 0 FAIL |
| `veil-u2-trace-2` | 658.6 | 3224.6 | 3 (295.4 ms) | 359.8 | 59.3, **158.6**, 77.5 | `777777-` `777777-` `000777-` `000000-` | 13 PASS, 0 FAIL |

- **The symptom reproduces under tracing.** Same frame pattern as stage C2. The gap sits in the same interval,
  frame 2 → 3: veil 158.6–166.9 ms, head 71.1–81.8 ms. Tracing slows every frame on both builds by about
  20–30 ms.
- **The write came late.** The probe's 2 s timer fired only after the harness's trace-start call returned
  (the write landed 9–95 ms after the trace's start mark in every run), so it came 3.2–4.4 s after completion
  rather than 2.0 s. Starting a trace with these categories stalls the page for a moment. The block was still
  held (flags 15 on veil, 12 on head), and the frames match stage C2's pattern.
- **\*`head-u2-trace-2`'s trace ends at +260 ms**, before its clear frame (its write came latest, and the
  4 s window closed). Its last interval and its clear frame are outside the trace, and stopping the trace may
  have stretched them. Frames 1–3, which hold the comparison, are inside it.
- Every run exited 0. `OPTS put back`: "same as before true" on every run.

## Per frame, from the write to the clear frame

From [frames.jsonl](frames.jsonl) (cut with [trace-frames.py](trace-frames.py)). Times are ms after the
write. "Style" is `UpdateLayoutTree` (elements, ms); "layout" is `Layout` (dirty/total objects, ms). "Pre"
is the work before the frame's rAF callbacks, and the rest comes after them. "Resolve" counts
`StyleResolver::ResolveStyle` and "added" counts "Added to layout" invalidations in the task. Every frame
also runs the probe's own rAF sampler (`frame`, 8.8–28.4 ms, hit tests included) and a probe message task
(5–7 ms). Both are the same on the two builds and are left out below.

### Frame 1 (the scroll's frame): the same on both builds

| Run | Task | Scripts | Style | Layout | Paint / layerize / commit |
|---|---|---|---|---|---|
| head 1 | +18.2, 57.2 ms | ChatGPT `scrollend` handler `76629.*.js:1` 18.9 ms; rAF `464146.*.js:5` 0.8 | 76 el, 18.0 (in the probe's hit tests) | none ≥ 0.2 ms | 1.2 / 2.7 / 0.4 |
| veil 1 | +37.9, 54.5 ms | `scrollend` 22.5; `464146` 0.8 | 76 el, 13.6 | none | 1.1 / 2.7 / 0.4 |
| head 2 | +34.7, 70.4 ms | `scrollend` 24.8; `464146` 6.5 | 76 el, 18.3; 6 el, 4.1 | 59/9047, 1.5 | 1.2 / 2.8 / 0.4 |
| veil 2 | +38.6, 61.8 ms | `scrollend` 24.0; `464146` 0.8 | 76 el, 16.5 | none | 1.7 / 3.1 / 0.4 |

The `scrollend` handler's main self-time is `setAttribute` and `caretPositionFromPoint` (CPU profile). Neither
build has resolve or added counts beyond the 76 elements here.

### Frame 2: the veil's long layout

| Run | Task | Style | Layout | Pre-paint | Paint / layerize / commit | Resolve | Added | Other |
|---|---|---|---|---|---|---:|---:|---|
| head 1 | +108.9, 42.8 ms | 49 el 2.4; 2 el 1.8 | 89/8986 1.4; 29/8986 1.2 | 7.8 | 3.3 / 2.9 / 0.5 | 51 | 0 | IO callback `76629.*.js:17` 6.9 |
| head 2 | +133.0, 45.4 ms | 49 el 2.5; 2 el 1.7 | 89/8986 1.5; 29/8986 1.2 | 8.2 | 3.1 / 2.9 / 0.5 | 51 | 0 | IO callback 6.0 |
| veil 1 | +115.0, **101.8 ms** | 2 el 1.8 | **63/6901 66.7**; 29/8986 1.2 | 7.3 | 2.8 / 2.7 / 0.4 | **1575** | **2110** | IO callback 5.9; font request at +177.3 |
| veil 2 | +123.5, **99.2 ms** | 2 el 1.7 | **63/6901 64.7**; 29/8986 1.1 | 7.2 | 2.9 / 2.7 / 0.3 | **1575** | **2110** | IO callback 5.7; font request at +183.7 |

- **The 1,575 style resolutions run inside the 66.7 ms `Layout`**, not in a style pass. This is Chromium
  styling a `content-visibility: auto` subtree for the first time as it unlocks it. The layout objects
  added are KaTeX spans (`mord`, `mspace`, `vlist*`, `pstrut`, `strut`, `base`, `msupsub`), MathML (`mo`, `mn`,
  `mi`, `mrow`, `mtd`, `msub`, `mstyle`) and 504 text nodes. On head, the unlocked block roots restyle
  ("DisplayLock", 98 on both builds) and nothing inside them is new.
- **The object totals agree.** Veil's layout starts with 6,901 objects. The next one has 8,986, which is
  head's count before and after its frame 2.
- **ChatGPT's `IntersectionObserver` callback** (`76629.*.js:17`, mostly `getBoundingClientRect`) runs
  after layout on both builds, for 5.7–6.9 ms. It forces only a 1.1–1.2 ms layout (29 dirty), the same on
  both builds.

### Between frames 2 and 3 (veil): the unveil and the font

- **+229–237 ms:** 43 `contentvisibilityautostatechange` dispatches (6.4–6.5 ms in total). The veil's handler
  `offscreen.js:93` runs for 0.01–0.14 ms each. It removes `data-butter-veil` and sets `data-butter-unveiled`
  on 22 blocks (`P`/`SPAN` roots, 11 each). Style invalidation: 44 "invalidates self" plus 44 "Related style
  rule", on those roots only. Head's handler (`offscreen.js:65`) runs on the same events at +175–180 ms and
  sets no attribute on a block (head's attribute invalidations in the window: ChatGPT's
  `data-thread-reading*` and, in run 2, 6 `data-butter-seen`).
- **+236.4/237.9 ms:** the font's response (`font/woff2`, status 200, not from cache), `RemoteFontLoaded`
  0.4 ms later.

### Frame 3: the font relayout, and first style of the next blocks

| Run | Task | Pre: style / layout / pre-paint | Post: style | Post: layout | Pre-paint | Resolve (pre + post) | "Fonts" restyles | Added |
|---|---|---|---|---|---:|---|---:|---:|
| head 1 | +179.8, 36.1 ms | — | 17 el 0.9; 2 el 1.7 | 53/9042 1.4; 29/9042 1.1 | 6.8 | 19 | 0 | 0 |
| head 2 | +214.7, 39.2 ms | — | 15 el 0.9; 2 el 1.8 | 53/9042 1.7; 29/9042 1.3 | 7.2 | 17 | 0 | 0 |
| veil 1 | +237.7, **94.1 ms** | 2 el **4.4** / **80/8986 37.8** / 1.7 | **325 el 12.2**; 2 el 1.8 | 461/9042 3.2; 29/9042 1.2 | 6.5 | 1092 + 327 | **1411** | **422** |
| veil 2 | +238.6, **92.2 ms** | 2 el **4.5** / **80/8986 37.0** / 1.7 | **325 el 12.0**; 2 el 1.8 | 461/9042 3.2; 29/9042 1.1 | 6.4 | 1092 + 327 | **1411** | **422** |

- **Before rAF.** Every "Fonts" style invalidation falls in the pre-rAF pass (MathML `mn` 277, `mi` 257,
  `mrow` 219, `mo` 167, `semantics` 150, `msub` 119, ...). The pass's layout invalidations are 26
  "Style changed" (the 22 unveiled roots and others) and 8 "Fonts changed" (`delimsizing size3` spans and
  text). It starts 0.4–1.3 ms after the font arrived.
- **After rAF.** The 422 added objects and 30 "DisplayLock" unlocks are the blocks that came into view in this
  frame (`000777-` → clear). Like frame 2, it is their first style and layout.
- **The same task's scripts:** the probe's sampler and ChatGPT's IO callback (5.6–5.8 ms), as on head.

### Clear frame

| Run | Task | Post: layout | Resolve | Added | Butter |
|---|---|---|---:|---:|---|
| head 1 | +227.4, 37.5 ms | 47/9456 1.4 | 13 | 0 | — |
| veil 1 | +357.5, 54.0 ms | 47/9042 **17.2** | 386 | 423 | settle rAF `offscreen.js:53` 0.5 ms (`removeAttribute`) |
| veil 2 | +356.5, 59.7 ms | 47/9042 **19.1** | 386 | 423 | the same, 0.5 ms |

The veil keeps paying first-layout costs for each block as it enters, after the view is already clear (17–19 ms
here against 1.4 ms). They do not lengthen the blank run.

## What separates the veil's frames from head's

| Work | head (2 runs) | veil (2 runs) | Extra on veil |
|---|---|---|---:|
| Frame 2 layout | 1.4–1.5 ms, 51 resolves, 0 added | 64.7–66.7 ms, 1,575 resolves, 2,110 added | ~64 ms |
| Frame 3 pre-rAF style + layout + pre-paint | none | 4.4–4.5 + 37.0–37.8 + 1.7 ms (1,411 "Fonts") | ~43 ms |
| Frame 3 post-rAF style | 0.9 ms (15–17 el) | 12.0–12.2 ms (325 el) | ~11 ms |
| `contentvisibilityautostatechange` dispatch | 2.2–3.8 ms | 6.4–6.5 ms | ~3 ms |
| ChatGPT scripts per frame (`scrollend`, IO callback, rAF, IndexedDB `onsuccess`) | 18.9–24.8; 5.4–6.9; 0.8–6.5; 11.7–20.5 | 22.5–24.0; 5.6–6.7; 0.8; 11.8–20.6 | none |
| Raster tasks, write to clear + 60 ms | 24–26, 4.3 ms | 27, 3.7–4.0 ms | none |

The ~64 ms falls in the long second frame (stage C2: 65.5–67.8 ms render part). The ~43 ms falls in the
following frame before its rAF (stage C2: 45.0–58.3 ms script part, unattributed by long-animation-frame
entries because it is not script).

## The previous candidates, checked

- **`isolation: isolate` (headless fix):** it removed a layout pass that the opacity change forced. Live,
  the unveil's opacity change is 22 root invalidations in a pass dominated by 1,411 font invalidations. The
  frame 2 layout happens before the unveil runs at all. That is why the fix moved nothing live.
- **ChatGPT's stylesheet (`:has()`, transitions):** 25 ":has()" invalidations on both builds, no animation or
  transition events in either trace, and no invalidation-set storm (veil 159 invalidator events, head 56–62,
  the difference being the unveil's attribute changes).
- **ChatGPT's rAF telemetry reacting to unveiled blocks:** no new or longer callback on veil. The callbacks
  in the window are the `scrollend` handler, the `IntersectionObserver` callback (`getBoundingClientRect`), a
  0.8 ms rAF in `464146.*.js` and an IndexedDB `onsuccess` (`955979.*.js:52`, mostly garbage collection). They
  have the same durations on both builds.
- **GPU/raster:** raster tasks match. GPU-process tasks were not in the categories traced. With raster and
  the main thread accounting for the gap, they were not needed.

## What the traces do not separate

- **Font versus unveil in frame 3's 37 ms layout.** One `Layout` event covers both causes. The invalidation
  counts (8 font roots holding 1,411 MathML nodes, against 26 style roots that only change opacity) and the
  live null result of the `isolate` fix point to the font. A run with the font already loaded (for example a
  `document.fonts.load` of ChatGPT's math faces before the write, on the veil build) would separate them.
- **Which font.** The request's URL is a hashed CDN path, and the trace does not name the family. The
  invalidated nodes are MathML and KaTeX `delimsizing size3`, so it is a math face that the newly styled
  content was the first to need.
- **Head's completion frame is outside these traces.** That head styled and laid these blocks out earlier
  rests on three things. Head's trace has 0 "Added to layout", 0 "Fonts" invalidations and no font request
  over the same reveal. The stream-hydrate trace shows ChatGPT's completion rAF forcing 25,248 elements of style
  inside skipped blocks. And the veil's purpose is to stop that walk.

## Commands

`B` is `~/.local/share/chatgpt-lab/bin`, `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/u2-trace`
(raw logs, run JSON and traces, kept local), and `D` is `~/snap/chromium/common/veil-accept`. Times are UTC,
2026-11-25.

```sh
git merge-base --is-ancestor feat/implement-spec-170 HEAD; echo ancestor=$?   # ancestor=0
git switch -c veil/u2-trace
# harness: TRACE_SPAN, TRACE_CATS (df7dd89); npm run check -> exit 0
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-u2-trace --wait 3600 --perf)   # lab=2 at 05:05:20Z
# /tmp/u2trace/run.sh <build> <name>, kept local:
env LAB_ID=$LAB LAB_OWNER=veil-u2-trace EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' \
  TRACE_AT=108000 TRACE_SPAN=4000 \
  TRACE_CATS=disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
```
```text
head-u2-trace-1 exit=0 202 s at 2026-11-25T05:08:45Z
veil-u2-trace-1 exit=0 197 s at 2026-11-25T05:12:02Z
head-u2-trace-2 exit=0 199 s at 2026-11-25T05:17:25Z
veil-u2-trace-2 exit=0 202 s at 2026-11-25T05:20:47Z
```
```sh
$B/lab-restore --lab $LAB --owner veil-u2-trace     # exit 0, browser restarted without extensions (restore.log)
$B/lab-lock release --lab $LAB --owner veil-u2-trace
$B/lab-lock status                                  # release.log: all three free
node /tmp/u2trace/u2.mjs $C/{head,veil}-u2-trace-{1,2}.json > u2.jsonl   # stage C2's extractor, from veil/u2-reveal
python3 trace-frames.py $C/<name>.json                                 # frames.jsonl, one block per run
```

Four harness runs, 15 min 41 s from lock to release. The committed files hold ms, counts, block indexes, flags,
element tag/class names and script file names only. The ChatGPT URL in `restore.log` is replaced by
`<home-url>`, and the extension id in script names by `ext:`.
