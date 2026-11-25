# Veil u2 reveal: why the blank frames after a jump into held blocks last longer (#170 user story 6), 2026-11-24

> **Decision (2026-11-25, lead with the user):** the `isolation: isolate` fix (`b64525b` on `veil/u2-reveal`) was not merged: it changed nothing live. The live cause is in [../u2-trace/report.md](../u2-trace/report.md): the veil defers the held blocks' first layout and a math web font load from completion to the first jump into them (~100 ms). That is accepted as a named limit of #170. `repro.mjs` here applies the fix itself, so it still runs without it.

**Question.** Stage C2 ([summary](../stage-C2/summary.md)) found that after a scrollTop write onto held,
veiled blocks in the middle of a just-completed `ats12` answer (`UX=u2 U2_BLOCK=306`), the veil's 3 blank
frames last 227–237 ms against 122–158 ms on `main` before the veil (`547fa0a`). The extra time is in one
frame interval: an 83–93 ms frame with 65–68 ms of render work, then a frame with 45–58 ms before its rAF
callbacks. Does the veil cause it, and can it be fixed?

**Answer: not established for the live gap.** One veil cost is found, measured and fixed, but it is not
the live gap:

- **Found (headless):** unveiling in the state-change handler makes Chromium run an extra layout and
  pre-paint pass before each reveal frame's rAF callbacks. Opacity is what triggers it: it makes the block
  a stacking context at the style level or stops it being one. `isolation: isolate` on every element under
  the `content-visibility: auto` rules removes the extra layout pass. Those elements are already stacking
  contexts through paint containment, so nothing changes on screen. This is on branch `veil/u2-reveal`
  with a test that fails without it.
- **Not the live gap:** the same fix on live ChatGPT leaves the blank run unchanged. Fix 238.0 / 228.3 ms
  against veil 235.5 / 225.8 ms in the same lock sequence, with the same long second frame (render part
  64.9–67.9 ms). Whatever adds ~90–100 ms live is something the synthetic page does not have. A live
  Chrome trace of the u2 write (`TRACE_AT`) is the next step; this task's live budget (4 runs) is used up.
- **Also left, headless:** with the fix, the veil build still does about 2 ms more pre-paint and 3.4 ms
  more paint over the reveal than the page without the veil. A paint-only veil (`color` instead of
  `opacity`) costs the same paint, so this is the cost of any style change on a block as it unveils. It
  was not chased further.

Whether to keep the fix commit, given that it does not move the live number, is the lead's call. It is one
commit, `b64525b`, and can be reverted on its own.

## Feedback loop: headless repro

[`repro.mjs`](repro.mjs) (run: `node notes/runs/2026-11-24-veil-acceptance/u2-reveal/repro.mjs --runs 5
--trace --variants ...`) builds a long answer in headless Chromium (Playwright's 158.0.8127.18):

- **The answer:** 612 blocks, each a paragraph with 12 KaTeX-like span trees; 74k nodes, under a
  generated 3,000-rule stylesheet.
- **The run:** it streams the blocks 6 per frame below the fold, lets the flush hold them, and completes
  the turn. It then writes scrollTop to put block 306 40 px above the view's centre, as stage C2 did.
  At each frame start it samples 6 points down the view. With `--trace` it sums the main-thread phases
  from the write to the first frame with no blank point.
- **The builds:** the real stylesheet and marker, against the same sources with the veil cut out (the
  marker never sets `data-butter-veil`). Before the write, 564–602 of the 612 blocks are held, all of
  them veiled on the veil build.

**The headless page shows no wall-clock gap.** The reveal takes 3–4 frames on both builds, all under
16.7 ms, and write → clear is 53–71 ms on both. The trace, though, shows extra work on the veil build
in every reveal frame.

## Headless before/after (5 runs each, same page, perf lock held)

Main-thread work from the u2 write to the clear frame ([headless.jsonl](headless.jsonl)). "Before" is the
veil as on `feat/implement-spec-170` (`d25d5fb`); "fixed" adds `isolation: isolate` (`b64525b`); "no veil"
is the before build with the attribute never set.

| Build | Layout passes | Layout ms | Style passes | Style ms | Pre-paint ms | Paint ms | Sum ms (range) | Write → clear ms (median) |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| no veil | 3 | 8.8–9.3 | 3 | 9.6–10.0 | 5.7–6.0 | 6.1–6.7 | 30.5–31.8 | 65.9 |
| veil, before | **6** | **12.8–15.1** | 6 | 10.2–11.3 | 8.2–9.0 | 9.3–10.3 | **40.7–45.6** | 69.8 |
| veil, fixed | 3 | 8.9–9.4 | 6 | 10.3–11.1 | 7.7–8.0 | 9.7–10.4 | **36.7–38.7** | 67.7 |

Frame by frame (one trace each, `DUMP=1`), the veil build before the fix runs this sequence between the
reveal frames:

```text
EventDispatch:contentvisibilityautostatechange   ScheduleStyleRecalculation  stack=unveil:57<:96
RunTask (BeginMainFrame)
  UpdateLayoutTree el=25          <- the 25 blocks just unveiled, before rAF
  InvalidateLayout
  Layout 1.6 ms  dirty 34/4549    <- extra pass, whole-tree, before rAF
  PrePaint 1.2 ms                 <- before rAF
  FireAnimationFrame
  UpdateLayoutTree el=2059        <- the frame's own pass, as without the veil
  Layout 2.9 ms  dirty 2697/6904
  PrePaint, Paint
```

Without the veil the handler writes nothing, so the frame starts with its rAF callbacks and runs one
style, layout, pre-paint and paint pass. The pass before rAF is Chromium bringing dirty style and layout up
to date at the start of the frame. It has no script stack.

## What triggers the extra layout pass

Variants of the veil build, 2–3 traced runs each, all with the same marker:

| Variant | What the unveil changes | Layout passes (no veil: 3) | Layout ms |
|---|---|---:|---:|
| real (before fix) | opacity 0 → 1, and the transition guard | 6 | 13.2–13.7 |
| `noguard`: no `data-butter-unveiled` | opacity 0 → 1 | 6 | 13.7–14.1 |
| `noopacity`: veil rule sets `opacity: 1` | only the transition guard | 3 | 8.9–9.6 |
| `veilhalf`: veil rule sets `opacity: 0.5` | opacity 0.5 → 1 | 6 | 13.3–13.4 |
| `veilcolor`: veil rule sets `color: red` | color red → inherited | 3 | 8.8–9.3 |
| `isolate`: real plus `isolation: isolate` on the auto rules | opacity 0 → 1 | 3 | 8.8–11.8 |

So the trigger is not the `data-butter-unveiled` transition guard, and not the descendant selectors. Any
change between opacity below 1 and opacity 1 triggers it, and a paint-only property change does not. Opacity
below 1 makes an element a stacking context at the style level, and Chromium lays out again when that
changes. Under `content-visibility: auto` the block is a stacking context anyway, through paint
containment, but that is decided outside style. With `isolation: isolate` the style-level answer is "yes"
both before and after the unveil, and the extra layout pass is gone. The pre-paint before rAF stays
(0.5–0.9 ms per frame), as the opacity effect still changes.

A plain micro page ([opacity-micro.mjs](opacity-micro.mjs)) did not isolate the trigger: a class change on
25 skipped blocks dirtied 29 layout objects whatever it changed, even nothing. That page changes classes
rather than attributes and forces layout itself, so it does not stand in for the marker's path.

Candidates from the brief, checked against the headless numbers:

- **`data-butter-unveiled` set/remove costing an extra style pass:** no. `noguard` costs the same as real,
  and the guard alone (`noopacity`) costs as little as no veil. The settle rAF's removal restyles about one
  element per unveiled block.
- **Many blocks unveiled at once invalidating style broadly through descendant selectors:** no. The style
  pass before rAF restyles only the unveiled blocks (`el=25`, `17`, `12`), and the next pass restyles the
  same 2059/1477 elements on both builds.
- **Opacity 0 → 1 changing paint or compositing work:** yes, in part. It forces the extra layout and
  pre-paint pass (fixed), and costs about 3.4 ms more paint, which any visual change costs (left).
- **First paint costing more because the blocks were at opacity 0:** not separable from the item above
  with these traces.

## The fix and its test

`extension/stream/containment.css`: `isolation: isolate` is added to the rule that sets
`content-visibility: auto`, so it applies exactly where `auto` does, under the same `cv` guard.

- **On screen:** nothing changes. Every element under `auto` is a stacking context through paint
  containment, and that already isolates blending.
- **Hard requirement:** the opacity rule, the transition guard and the marker are untouched, so the
  requirement and its checks are unaffected.

`test/stream-veil-reveal-cost.test.mjs` (seam 1b) builds the veil page with 300 streamed blocks below the
fold, flushes, completes, then jumps onto held blocks in the middle. It counts main-thread `Layout` trace
events with dirty objects over the next 10 frames, on the real build and on the same build without the
veil (`marker.veil` in `test/helpers/veil-variants.mjs`). It asserts the veil takes no more layout
passes. The count is of passes, not time, so it does not depend on the machine. To keep page-side reads
from forcing layout, `openChat` now takes `sampler: false`.

```text
before the fix (4 of 4 runs): layout passes: veil 2, no veil 1
  AssertionError: the veil took 2 layout passes, 1 without it
after the fix (3 of 3 runs):  layout passes: veil 1, no veil 1
```

The existing checks stay green in `npm run check`: the hard-requirement scenario, the transition guard,
the style-cost assertions, the `<hr>` and state-path cases (967 tests, exit 0).

## Live: the fix does not change the u2 gap

Lab 2, fixture `ats12`, stage C2's settings exactly (`PHASES=stream UX=u2 U2_BLOCK=306
OPTS={"rail":true,"bookmark":true}`), in one lock sequence: veil, fix, veil, fix.

- **veil:** `~/snap/chromium/common/veil-accept/veil/butter`, as in stage C2 (`e5f480e`, the same
  `extension/` as `d25d5fb`).
- **fix:** a copy of it with `stream/containment.css` from `b64525b` and the `version_name` suffix `+veilaccept.fix`.
  `diff -rq` against the branch's `extension/` showed only `manifest.json`.

The numbers are in [u2.jsonl](u2.jsonl), cut with [u2-extract.mjs](u2-extract.mjs) (stage C2's script).

| Run | Completion frame (ms) | Blank frames, longest run | Write → clear (ms) | Frame intervals (ms) | First two frames, render part (duration) | Second frame, script part | Jumps > 4 px after drawing | Verdicts |
|---|---:|---|---:|---|---|---:|---|---|
| `veil-ats12-u2-1` | 668.4 | 3 (235.5 ms) | 253.0 | 33.1, **134.3**, 68.1 | 67.8 (82.7), 27.3 (87.5) | 48.6 | 0, anchor 320 | 13 PASS |
| `fix-ats12-u2-1` | 687.0 | 3 (238.0 ms) | 256.2 | 49.8, **128.3**, 59.9 | 67.9 (96.1), 33.3 (89.1) | 44.5 | 0, anchor 320 | 13 PASS |
| `veil-ats12-u2-2` | 672.1 | 3 (225.8 ms) | 241.1 | 31.0, **142.9**, 51.9 | 65.3 (80.3), 25.2 (96.3) | 60.0 | 0, anchor 320 | 13 PASS |
| `fix-ats12-u2-2` | 620.5 | 3 (228.3 ms) | 243.7 | 35.2, **127.9**, 65.2 | 64.9 (81.2), 24.7 (79.9) | 44.2 | 0, anchor 320 | 13 PASS |

- **The block:** held and veiled on every run (flags 15, 20 of the 21 blocks around it held).
- **Same as stage C2:** the frame pattern (`777777-`, `777777-`, `000777-`, clear), and the veil runs'
  numbers (stage C2 veil: 226.9–236.9 ms, intervals 126.7–144.5 ms; head: 122.2–157.5 ms).
- **The fix's frames:** its long second frame (render part 64.9–67.9 ms) and the next frame's script part
  (44.2–44.5 ms) are within the veil runs' range.
- **Verdicts:** every run passed all 13 (`veil-none-rendered` and `veil-effective` included), and every
  run exited 0.

So the extra live time is not the stacking-context layout pass, or not mainly. What the synthetic page
lacks that the live page has is open. Untested candidates: ChatGPT's own stylesheet (for example a
`:has()` rule, or a transition or `will-change` on answer blocks), its rAF telemetry reacting to the
unveiled blocks, and GPU raster of newly visible opacity layers. A `TRACE_AT` trace pair, veil against
head, at the u2 write would tell them apart. It needs the lab again: 2 runs, about 7 minutes.

## Commands

```sh
# perf lock alone, for the headless timing (lab-lock has no perf-only form; the library's own lock call)
python3 /tmp/perf-lock.py acquire   # _try_lock(<perf.lock.d>, 'veil-u2-reveal', ...) -> acquired
node notes/runs/2026-11-24-veil-acceptance/u2-reveal/repro.mjs --runs 3 --trace --variants real,noveil,noguard,noopacity,veilcolor,veilhalf,isolate,isolatenoveil
ALT_JS=extension/stream/offscreen.js ALT_CSS=<d25d5fb containment.css> \
  node notes/runs/2026-11-24-veil-acceptance/u2-reveal/repro.mjs --runs 5 --trace --variants noveil,alt,real   # headless.jsonl
python3 /tmp/perf-lock.py release   # -> released

# live (driver /tmp/u2rev/seq.sh, kept local): one lock, restore and release from an exit trap
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-u2-reveal --wait 3600 --perf)   # lab=2 at 04:43:34Z
env LAB_ID=$LAB LAB_OWNER=veil-u2-reveal EXT=$D/<veil|fix>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs
# veil-ats12-u2-1 exit=0 199 s; fix-ats12-u2-1 exit=0 198 s; veil-ats12-u2-2 exit=0 199 s; fix-ats12-u2-2 exit=0 199 s
$B/lab-restore --lab $LAB --owner veil-u2-reveal    # exit 0
$B/lab-lock release --lab $LAB --owner veil-u2-reveal   # {"lab": 2, "lab_released": true, "perf_released": true}
# done 04:56:59Z, 805 s from lock to release; OPTS put back "same as before true" on every run
node notes/runs/2026-11-24-veil-acceptance/u2-reveal/u2-extract.mjs $C/{veil,fix}-ats12-u2-{1,2}.json > u2.jsonl
```

`B` is `~/.local/share/chatgpt-lab/bin`. `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/u2-reveal`,
which holds the raw logs and per-run JSON and stays local. `D` is `~/snap/chromium/common/veil-accept`. The
committed files hold block indexes, px, ms, flags and script file names only.
