# Wheel jump back to the top: cause investigation (bugfix step 2)

Diagnosis only: no fix is built and nothing under `extension/` changed. Every code experiment is a
scratch copy of the unpacked test build. Step 1 (the Control) is [report.md](report.md); this run's
method follows [the rail jump cause report](../2026-11-16-rail-jump-live/cause.md).

**Result.**

- **The mover.** Every jump back in the traced load is a Chromium scroll anchoring update
  (`kAnchoring`). It requests a small negative offset (−263 to −444 px), which is clamped to 0. It
  is not a script write, a clamp, or a user or compositor scroll.
- **When.** In 181 of the 182 jumps back that the page log covered, the jump comes in the same frame
  as Smoother streaming's mark flush (`stream/offscreen.js`). That flush first marks the mounted
  turns and their answer blocks `data-butter-seen`, which gives them `content-visibility: auto`.
- **The setting.** `cv` is the setting:
  - `cv` alone fails 3/3.
  - `cv` off, with every other switch on, passes 3/3. With the lead's earlier runs that is 5/5.
- **Either skipping level.** Turn-level and block-level skipping each reproduce it alone.
- **Anchoring off.** Turning anchoring off on the chat's content, or on its scroller, passes 3/3.
  Those copies also open at the chat's end like native, and show at most one 7.9 px view shift per
  load.
- **Anchoring off for the flush only.** A fifth copy, which turns anchoring off on the content only
  for the two frames in which a flush's marks take effect, also passes 3/3 and opens at the end
  ([the lead's runs](#the-leads-runs)).

## Environment

| | |
|---|---|
| Labs | Lab 2 (headed Linux Chromium on Xvfb `:98`, 1600×1000, software rendering), fixture `ats12`; lab 1, fixture `math12`, for one run |
| Browser | Chromium 156.0.8078.47 (snap), no extra flags, classic scrollbars |
| Page | ChatGPT light theme, scroller `.thread-scroll-container` clientHeight 860 |
| Test build | `~/snap/chromium/common/wheel-jump-head-test/butter`, `0.1.0-alpha.21+wheel.1` (branch head `5192b68`, see report.md); no stored settings unless `OPTS` set them; layout memory unconsented (`data-butter-off="layout"`) |
| Scratch copies | `~/snap/chromium/common/wheel-jump-{turn-cv-off,block-cv-off,content-anchor-off,scroller-anchor-off}/butter`, kept. Each is the test build with only `stream/containment.css` edited ([diffs](#scratch-copies)) |
| Guard | Send guard on in every run; `sendAttempts` 0 in every run |
| Lock and time | Lab 2 held by owner `wheel-jump-cause` 20:57–21:34, plus the done-check run (21:35–21:37, which took the lock itself). Lab 1 was taken by the harness itself for one run (21:26–21:28). About 45 minutes in all, within the 120-minute budget. |
| Loads | 26 judged (24 on lab 2, 2 on lab 1), 2 skipped. ChatGPT's "Could not load" page took the first navigation of 10 judged loads, each retried once by the harness, and both navigations of the 2 skipped loads |

## Harness changes

All four are new options in `lab/harness/wheel-jump-live.mjs`, off by default, so the red command
is unchanged ([done-check](#commands-and-their-final-output-lines)):

- **`GAP=<ms>`** waits before every load but the first. Every multi-load run used 20000.
- **`TRACE=1`** traces the wheel-down phase. It uses the page's CDP session and the categories
  `blink,blink.user_timing` (the plain `blink` trace).
  - **What it keeps:** the events whose names match scroll offset, scroll anchor, scroll type and
    gesture scroll. All event names are counted.
  - **Clock:** times are converted to the page's `performance.now()` clock through a
    `performance.mark` set right after `Tracing.start`.
- **`PAGELOG=1`** logs the page side without geometry reads.
  - **At page start:** an init script tracks which turns and answer blocks are skipped, from
    `contentvisibilityautostatechange` events.
  - **At each scroll event while wheeling down:**
    - the mounted turns, as ordinals in ChatGPT's turn list (read from React's `entries` prop, as
      `rail-jump-live-page.mjs` does);
    - the skipped turns and blocks;
    - the marked turns (`[data-turn-key][data-butter-seen]`) and the marked or unrendered blocks.
  - **A MutationObserver** on the scroller's subtree logs each turn inserted or removed, and the
    inline style of the turn wrappers' parent (ChatGPT's virtualizer puts its `margin-top` spacer
    there).
  - **Fixed after the first run:** the first version watched the first turn's direct parent. Each
    turn sits alone in its own wrapper, so that version saw no insertions or removals. The trace
    run used that first version.
- **`SHIFT=1`** measures the view shift (see [Q4](#q4-what-scroll-anchoring-buys-when-cv-is-on)).
  - **Before each wheel step**, it picks the answer block under the pointer's column. If there is
    none, it takes a user message, then the turn. The block is at 80% of the viewport's height for a
    step down and at 20% for a step up, so a 700 px step keeps it on screen.
  - **After the step**, it measures that block's on-screen move and scrollTop's move.

The "before the first jump back" cut stops at the first step whose scrollTop fell by more than a
viewport. This matters because the scroll event that shows a drop can arrive after the step's own
snapshot has already read the low scrollTop.

## Q1. Which kind of scroll moves the chat

One failing load was traced on lab 2 `ats12` (`TRACE=1 PAGELOG=1 STEPS=40`). It had 5 jumps back, and
the probe found no wrapped call for any of them.

- **Kept events:** 238 kept from the `blink` trace, with the clock aligned.
- **`PaintLayerScrollableArea::UpdateScrollOffset` types:**
  - 40 `kCompositor`;
  - 9 `kProgrammatic`;
  - 7 `kAnchoring`.
- **`ScrollAnchor::FindAnchor`:** 69 events. They carry no arguments, so the anchor node is not
  named.

Each update follows a `ScrollableArea::SetScrollOffset` that carries the requested offset. Times are
in ms on the page's clock (`performance.now()` since navigation). The full merged timeline is
[cause-trace-rows.txt](cause-trace-rows.txt).

| # | Last wheel step before it | Anchoring request | Update | Scroll type | Move | Adjustment requested |
|---|---|---|---|---|---|---|
| 1 | 19437.337 `kCompositor`, request `[0 11790]` → 11790 | 19528.670 `[0 -396]` | 19528.672 → 0 | `kAnchoring` | 11790 → 0 | −12186 |
| 2 | 21721.426 `kCompositor`, `[0 10750]` → 10750 | 21874.312 `[0 -444]` | 21874.314 → 0 | `kAnchoring` | 10750 → 0 | −11194 |
| 3 | 22954.540 `kCompositor`, `[0 5140]` → 5140 | 23059.109 `[0 -263]` | 23059.111 → 0 | `kAnchoring` | 5140 → 0 | −5403 |
| 4 | 24587.352 `kCompositor`, `[0 10954]` → 10954 | 24717.206 `[0 -394]` | 24717.210 → 0 | `kAnchoring` | 10954 → 0 | −11348 |
| 5 | 25957.416 `kCompositor`, `[0 12351]` → 12351 | 26620.442 `[0 -371]` | 26620.445 → 0 | `kAnchoring` | 12351 → 0 | −12722 |

**What the trace rows show:**

- **Order.** In every jump, a `ScrollAnchor::FindAnchor` runs 0.6–0.9 ms before the anchoring
  update.
- **The page's scroll event at 0** follows 5–14 ms later. The exception is jump 2, where the next
  wheel step (21887.753, `kCompositor` → 700) came first, so its scroll event shows 700.
- **scrollHeight** is unchanged across every drop: 14816, 17867, 18106, 24860 and 35810.
- **Two reference rows.**
  - **An ordinary wheel step:** 19437.330 `SetScrollOffset [0 11790]`, then 19437.337
    `UpdateScrollOffset` y=11790 `kCompositor`. The request equals the new offset.
  - **Ordinary anchoring in the same load:**
    - 23832.002: ChatGPT's own `kProgrammatic` write `[0 6806]` (+292). At 23854.598 a
      `kAnchoring` update `[0 6754]` follows (−52).
    - The same pair at 25869.643 / 25893.843 (11703, then 11651).
- **ChatGPT's writes after the drops.** The other `kProgrammatic` updates are ChatGPT's writes, made
  after a drop had already happened. Three of them start from 0 (23455.740 → 6514, 25296.391 → 10711,
  27089.772 → 3819), so the chat sometimes comes partway back by itself.

**What the requests mean.** The anchoring adjustment is the change in the anchor node's position. In
the 5 jumps it was 263–444 px more than the whole scrollTop, so the browser computed the anchor's new
position as a few hundred px above the chat's top, not near the viewport. Why it computed that
position is not established (see Q3).

## Q2. Is `cv` the setting, alone

| Arm | Lab, fixture | Loads judged | Skipped | Failed | Exit | Log |
|---|---|---:|---:|---:|---:|---|
| `cv` off, every other switch on | lab 2, `ats12` | 2 | 1 | 0 | 0 | [cause-cv-off.log](cause-cv-off.log) |
| `cv` off, every other switch on (third load) | lab 2, `ats12` | 1 | 0 | 0 | 0 | [cause-cv-off-2.log](cause-cv-off-2.log) |
| `cv` on, every other switch off | lab 2, `ats12` | 3 | 0 | 3 (6, 21, 6 jumps back) | 1 | [cause-cv-only.log](cause-cv-only.log) |
| plain test build (control for lab 1) | lab 1, `math12` | 2 | 0 | 0 | 0 | [cause-lab1-head.log](cause-lab1-head.log) |

**The `cv`-only arm** set `container`, `throttle`, `older`, `rail`, `seek`, `branch` and `bookmark`
to false, with `cv` true. Layout memory was unconsented, so it was off too.

**Verdict:**

- **`cv` off:** 3 of 3 judged loads passed. With the lead's 2 earlier loads, that is 5 of 5.
- **`cv` alone:** 3 of 3 failed.

So `cv` is the setting on lab 2 `ats12`. No other switch was tested alone, because this pattern
needs none.

**Lab 1.** The plain test build did not reproduce on lab 1 `math12` (0 of 2 failed, each reaching the
end in 22 steps). With no failing control there, no Q2 arm was run on lab 1: a pass would mean
nothing. The bug is therefore shown on one fixture and one account only.

## Q3. What the browser reacts to

### Scratch-copy arms

| Arm | What still has `content-visibility: auto` | Lab, fixture | Loads judged | Skipped | Failed | Exit | Scroller / children `overflow-anchor` | Log |
|---|---|---|---:|---:|---:|---:|---|---|
| `turn-cv-off` | answer blocks only | lab 2, `ats12` | 3 | 0 | 3 (14, 13, 11 jumps back) | 1 | `auto [T:auto,none]` | [cause-turn-cv-off.log](cause-turn-cv-off.log) |
| `block-cv-off` | turns only | lab 2, `ats12` | 3 | 0 | 3 (21, 21, 21) | 1 | `auto [T:auto,none]` | [cause-block-cv-off.log](cause-block-cv-off.log) |
| `content-anchor-off` | both (unchanged) | lab 2, `ats12` | 3 | 0 | 0 | 0 | `auto [T:none,none]` | [cause-content-anchor-off.log](cause-content-anchor-off.log) |
| `scroller-anchor-off` | both (unchanged) | lab 2, `ats12` | 3 | 0 | 0 | 0 | `none [T:auto,none]` | [cause-scroller-anchor-off.log](cause-scroller-anchor-off.log) |

`T:` marks the scroller's child that holds the turns. The other child is ChatGPT's 76 px footer
block.

**Verdict:**

- **Skipping:** both skipping levels reproduce the jump alone.
- **Anchoring:** turning anchoring off removes it, whether on the content (the children's subtrees
  leave anchor selection) or on the scroller (no anchoring at all). This is an intervention test of
  the anchoring hypothesis, not a proposed fix.

### Scratch copies

Each diff is against the test build's `stream/containment.css`, which is identical to this
checkout's `extension/stream/containment.css`.

```diff
=== turn-cv-off
@@ -29,7 +29,6 @@
   > :not([data-wide-block]):not([class*='TableFrame-']) {
   contain-intrinsic-size: auto 120px;
 }
-html:not([data-butter-off~="cv"]) [data-turn-key][data-butter-seen],
 html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] > [data-butter-seen]:not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]),
 html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"] > [data-butter-seen]:not([data-wide-block]):not([class*="TableFrame-"]),
 /* Blocks of the answer being streamed appear on screen and render before they can scroll away,

=== block-cv-off
@@ -29,17 +29,7 @@
   > :not([data-wide-block]):not([class*='TableFrame-']) {
   contain-intrinsic-size: auto 120px;
 }
-html:not([data-butter-off~="cv"]) [data-turn-key][data-butter-seen],
-html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] > [data-butter-seen]:not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]),
-html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"] > [data-butter-seen]:not([data-wide-block]):not([class*="TableFrame-"]),
-/* Blocks of the answer being streamed appear on screen and render before they can scroll away,
-   so they are safe to skip right away; waiting for their mark leaves them all rendering. */
-html:not([data-butter-off~="cv"]) [data-talvt-turn-state="in_progress"] [data-markdown-text-style="assistant-message"] > :not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]),
-html:not([data-butter-off~="cv"]) [data-talvt-turn-state="in_progress"] [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"] > :not([data-wide-block]):not([class*="TableFrame-"]),
-/* A streamed block skipped before it ever rendered stays skipped after the answer completes, until
-   it comes into view: rendering them all at completion froze the page (stream/offscreen.js). */
-html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] > [data-butter-unrendered]:not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]),
-html:not([data-butter-off~="cv"]) [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"] > [data-butter-unrendered]:not([data-wide-block]):not([class*="TableFrame-"]) {
+html:not([data-butter-off~="cv"]) [data-turn-key][data-butter-seen] {
   content-visibility: auto;
 }

=== content-anchor-off
@@ -78,3 +78,6 @@
     box-shadow: inset 0 0 0 2px rgb(127 127 127 / 0);
   }
 }
+
+/* Diagnostic copy (wheel-jump cause run): no anchoring on the chat's content, always. */
+.thread-scroll-container > * { overflow-anchor: none !important; }

=== scroller-anchor-off
@@ -78,3 +78,6 @@
     box-shadow: inset 0 0 0 2px rgb(127 127 127 / 0);
   }
 }
+
+/* Diagnostic copy (wheel-jump cause run): no anchoring on the chat scroller, always. */
+.thread-scroll-container { overflow-anchor: none !important; }
```

`stream/offscreen.js` is unchanged in every copy, so it still marks turns `data-butter-seen` in
`turn-cv-off`. Only the CSS rule that skips marked turns is gone.

### Page state at a jump back (`PAGELOG=1`)

The page-logged runs are the trace run, `cv`-only, `turn-cv-off`, `block-cv-off`, and the plain
test build with `SHIFT=1` (`cause-head-shift`). Excerpts are in
[cause-page-rows.txt](cause-page-rows.txt). Three jumps in detail:

1. **Trace run, jump 1 (11790 → 0).**
   - **Before:** at 19441 the scroll event shows y=11790 with 1 turn mounted (ordinal 3 of 6). 0
     turns and 0 blocks are marked; 0 turns and 1 block are skipped.
   - **The jump:** at 19528.67 the `kAnchoring` update moves it to 0. Two "turn skipped" events
     follow at 19532.
   - **After:** at 19540 the scroll event shows y=0 with 2 turns mounted (ordinals 3–4). Both are
     marked and skipped, and 117 blocks are marked.
   - **Recovery:** at 19724 one turn is mounted, ordinal 0, so the virtualizer has moved to the top.
2. **`cv`-only load 1, jump 1 (8400 → 0).**
   - **Before:** the wrappers' parent has `margin-top: 5215px` (the virtualizer's spacer). 1 turn is
     mounted (ordinal 3 of 12). At 45056 it shows y=8400 with 0 turns and 0 blocks marked.
   - **The jump:** "turn skipped" at 45138. At 45147 it shows y=0, with 1 turn marked and skipped
     and 215 blocks marked.
   - **Recovery:** at 45369 ordinal 3 is removed, ordinals 0–2 are inserted, and the spacer goes to
     `margin-top: 0px`.
3. **`block-cv-off` load 1, jump 1 (6300 → 0).**
   - **Before:** at 16494 it shows y=6300 with 2 turns mounted (ordinals 1–2 of 5), none marked.
   - **The jump:** two "turn skipped" events at 16544. At 16555 it shows y=0, with 2 turns marked and
     skipped and 150 blocks marked. In this copy the blocks are marked but never skipped.
   - **Recovery:** at 16661 ordinals 1 and 2 are removed, ordinal 0 is inserted, and the spacer goes
     to 0 px.

**Over all page-logged jumps back** ([cause-flush-count.txt](cause-flush-count.txt),
[cause-flush-nojump.txt](cause-flush-nojump.txt), [cause-mut-count.txt](cause-mut-count.txt)):

- **Coincides with the flush:** 181 of 182. The counts of marked turns and marked blocks both rose
  between the last scroll event at the high position and the drop's scroll event:

  | Run | Jumps back with the flush |
  |---|---|
  | trace | 5/5 |
  | `cv`-only | 33/33 |
  | `turn-cv-off` | 38/38 |
  | `block-cv-off` | 62/63 |
  | plain build | 43/43 |

  In the remaining one, ChatGPT had already swapped the mounted turns (removed ordinals 1–2,
  inserted 0) before the drop's scroll event fired, so the counts cannot show whether a flush came
  first.
- **A flush does not always cause one:** of the 197 scroll events where the marked counts rose
  while wheeling down, 181 came with a drop of more than a viewport and 16 did not.
  - 10 of those 16 are the same spot in `cv`-only loads 1 and 3 (y 4200 → 4900, 2 turns, 280 blocks
    marked).
- **Turn insertions or removals are not needed:** turns were inserted or removed between the high
  scroll event and the drop in 19/33 (`cv`-only), 2/38 (`turn-cv-off`), 54/63 (`block-cv-off`) and
  15/43 (plain build). The trace run's observer was the broken first version, so it has no count.
- **Turn skipping is not needed:** in `turn-cv-off`, where turns cannot be skipped, the skipped-turn
  count just after the drop was 0 in all 38 jumps. That arm still jumped, with only the answer
  blocks becoming `content-visibility: auto`.
- **The page around a jump:** 1–3 turns were mounted. Mostly the virtualizer's spacer was above
  them. `margin-top` was > 0 in 33/33 (`cv`-only), 21/38 (`turn-cv-off`), 62/63 (`block-cv-off`)
  and 42/43 (plain build) of the jumps. After nearly every jump, ChatGPT replaced
  the mounted turns with the chat's first turns.
- **Why it repeats:** each remount creates new turn elements without the mark. The flush marks them
  about 1 s later (`FLUSH_MS`, after the ResizeObserver has seen them), so the jump can come back
  every few steps. This is an inference from the timing, not separately tested.

**Why the browser's adjustment is as large as the whole scrollTop.** What the data shows:

- In the frame where an element that holds the viewport first gets `content-visibility: auto`,
  Chromium's anchoring computes the anchor's new position 263–444 px above the chat's top.
- scrollHeight does not change.
- In the logged examples, no turn above the viewport unmounted or rendered in that frame.
- The skip events for the turns come after the anchoring update. When they are dispatched,
  scrollTop is already 0, so those turns are off screen and their skipping looks like a
  consequence, not the trigger.

Which anchor node Chromium picked, and why its position comes out near the top, is **not
established**. One candidate, not tested: the newly `content-visibility: auto` element (or its
subtree) is still locked when the anchor's position is measured. A remembered size changing is
ruled out by the unchanged scrollHeight and by the identical before/after spacer.

## Q4. What scroll anchoring buys when `cv` is on

**Definition.** The **view shift** of a wheel step is the tracked element's on-screen move plus the
user's own step. The step is 700 px, cut to the scroll range that was left before it. That is how
far content moved under the user beyond their scroll.

**Why not the brief's formula.** The brief's formula (the element's move compared with scrollTop's
move) gives the element's move inside the chat's content instead. Anchoring changes scrollTop by
exactly that amount to cancel it, so the brief's formula reads the same with anchoring on or off. It
is reported as "content moves" in the logs.

**Which steps count.** Only steps whose element stayed connected, and whose step was not cut by the
scroll range, are counted ("tracked"). Element tracking worked:

- No step before a jump back lost its element or found none.
- After jumps, the plain build's steps lost the element 33 times (when ChatGPT unmounted it) and
  found none 9 times. Those steps are not used.

| Arm | Lab, fixture | Load | Phase | View shifts > 4 px | Tracked steps | Median (px) | Largest (px) |
|---|---|---|---|---:|---:|---:|---:|
| no extension | lab 2, `ats12` | native-shift #1 | up / down | 0 / 0 | 55 / 55 | 0 / 0 | 1 / 0.5 |
| no extension | lab 2, `ats12` | native-shift-2 #1 | up / down | 0 / 0 | 54 / 55 | 0 / 0 | 1 / 0.5 |
| test build, `cv` off | lab 2, `ats12` | cv-off #1 | up / down | 0 / 0 | 32 / 33 | 0 / 0 | 0.5 / 0.4 |
| test build, `cv` off | lab 2, `ats12` | cv-off #2 | up / down | 0 / 0 | 19 / 19 | 0 / 0 | 0.4 / 0.4 |
| test build, `cv` off | lab 2, `ats12` | cv-off-2 #1 | up / down | 0 / 0 | 18 / 19 | 0 / 0 | 0.4 / 0.4 |
| `content-anchor-off` | lab 2, `ats12` | #1 | up / down | **1** / 0 | 16 / 17 | 0 / 0 | **7.9** / 0.4 |
| `content-anchor-off` | lab 2, `ats12` | #2 | up / down | 0 / 0 | 32 / 33 | 0 / 0 | 0.5 / 0.4 |
| `content-anchor-off` | lab 2, `ats12` | #3 | up / down | 0 / 0 | 23 / 24 | 0 / 0 | 0.5 / 0.2 |
| `scroller-anchor-off` | lab 2, `ats12` | #1 | up / down | 0 / 0 | 19 / 19 | 0 / 0 | 0.4 / 0.4 |
| `scroller-anchor-off` | lab 2, `ats12` | #2 | up / down | **1** / 0 | 32 / 33 | 0 / 0 | **7.9** / 0.4 |
| `scroller-anchor-off` | lab 2, `ats12` | #3 | up / down | 0 / 0 | 23 / 24 | 0 / 0 | 0.5 / 0.2 |
| plain test build | lab 2, `ats12` | head-shift #1 | up / down before the first jump back (steps 1–8) | 0 / 0 | 0 / 8 | – / 0 | – / 0 |
| plain test build | lab 2, `ats12` | head-shift #2 | up / down before the first jump back (steps 1–6) | 0 / 0 | 2 / 6 | 0 / 0 | 0 / 0 |

The per-load numbers come from [cause-shift-table.txt](cause-shift-table.txt). The logs'
`view shift` lines give the same numbers, except `cause-head-shift.log`'s "before first jump back"
lines. Those were printed before the cut fix, so for load 2 they include the jump step itself.

**Summary of the measurements:**

- **Anchoring on** (no extension, or `cv` off): 359 tracked steps, 0 view shifts over 4 px, largest
  1 px.
- **Anchoring off with `cv` on** (both copies): 295 tracked steps, 2 view shifts over 4 px.
  - Both are 7.9 px, at wheel-up step 2, in one load of each copy. There the content above grew by
    7.9 px (content move 7.9) and nothing compensated.
  - In no arm with anchoring on did step 2 show a content move, so whether that 7.9 px growth also
    happens there, already compensated, is not shown.
- **Plain test build before its first jump back:** 16 tracked steps, 0 view shifts. Its wheel-up
  phase is almost all clamped steps, because it opened at scrollTop 0 or 1750.

**Large content moves outside anchoring.** ChatGPT's history loads moved the content by 97 px and
2455 px at wheel-up steps 7 and 12 in every arm, and by up to 10659 px in the native loads. None of
them showed a view shift, including in the two copies with anchoring off. So something other than
CSS anchoring kept the view still for them. It is consistent with ChatGPT's own scroll writes (the
`kProgrammatic` rows in Q1, and ChatGPT's `compensateScrollToDistanceFromBottomPx` from report.md),
but those writes were not traced in the anchoring-off copies.

**Clamped steps at the top.** At the very top, while history loaded with scrollTop at 0, the tracked
turn moved 52 px down. This happened in every arm, native included (for example native step 19,
`cv`-off step 20). These steps are cut by the scroll range and so are excluded above.

**What this measurement covers.** On this fixture the claim "anchoring keeps the view still when
skipped content above it renders" was exercised only by content whose remembered size was already
right. The case where it should matter most was not exercised: a never-rendered streamed block
(`data-butter-unrendered`, 120 px placeholder) rendering above the viewport. The fixture has no
streaming and no unrendered blocks. **Not established** for that case.

## Q5. The other symptom: where a load opens

Each load's `fromEnd=` is how far its scrollTop was from the chat's end after the 9 s settle.

| Arm | `fromEnd` per judged load | Opened like native (53–61 px)? |
|---|---|---|
| no extension | 53, 53 | yes |
| `cv` off | 56, 57, 57 | yes, 3/3 |
| `content-anchor-off` | 61, 53, 53 | yes, 3/3 |
| `scroller-anchor-off` | 54, 56, 57 | yes, 3/3 |
| `cv` only | 38144, 11997, 38144 | no (scrollTop 0) |
| `turn-cv-off` | 53, 9542, 9542 | 1/3 |
| `block-cv-off` | 11997 ×3 | no (scrollTop 0) |
| plain test build | 11997, 12211 (head-shift); 57 (trace); 11997 (check) | 1/4 |

**What the settle samples show** (one per second):

- The low openings take effect within the first 1–2 s: for example 2455 → 0, or 2695 → 1750.
- The arms that keep anchoring and have `cv` on open low in 11 of 13 loads.
- The arms with `cv` off or anchoring off open at the end in 9 of 9.

This matches the jump back during settling, but no trace was taken of the settle phase, so the
mover is **not established** for it.

## The lead's runs

Run by the lead after the campaign, on lab 2 `ats12`, each run taking and releasing the lock itself.
The trace's scroll types were also re-derived from the local `cause-trace.json`: 40 `kCompositor`,
9 `kProgrammatic`, 7 `kAnchoring`, the five negative requests as in Q1.

| Arm | Loads judged | Skipped | Failed | Exit | `fromEnd` | Log |
|---|---:|---:|---:|---:|---|---|
| no extension | 2 | 1 | 0 | 0 | 53, 53 | [lead-native.log](lead-native.log) |
| plain test build (the red command) | 3 | 0 | 3 (18, 24, 14 jumps back) | 1 | 12211, 11997, 57 | [lead-head-test.log](lead-head-test.log) |
| test build, `cv` off | 2 | 1 | 0 | 0 | 57, 56 | [lead-cv-off.log](lead-cv-off.log) |
| `content-anchor-off` (re-check) | 2 | 0 | 0 | 0 | 57, 53 | [lead-content-anchor-off.log](lead-content-anchor-off.log) |
| `flush-anchor-off` | 3 | 0 | 0 | 0 | 61, 53, 57 | [lead-flush-anchor-off.log](lead-flush-anchor-off.log) |

**`flush-anchor-off`** is a fifth scratch copy, `~/snap/chromium/common/wheel-jump-flush-anchor-off/butter`
(kept). It turns anchoring off on the chat's content only for the two frames in which a flush's marks
take effect; the computed `overflow-anchor` at rest stays `auto [T:auto,none]`. Its diff against the
test build:

```diff
--- stream/offscreen.js
+++ stream/offscreen.js
@@ -39,6 +39,13 @@
       queue.clear();
       return;
     }
+    // Diagnostic copy (wheel-jump cause run): anchoring off on the chat's content for the frames
+    // in which the marks take effect.
+    if (queue.size) {
+      const html = document.documentElement;
+      html.setAttribute('data-butter-marking', '');
+      requestAnimationFrame(() => requestAnimationFrame(() => html.removeAttribute('data-butter-marking')));
+    }
     for (const el of queue)
       if (!el.isConnected) continue;
       else if (skipped.has(el) && !shown.has(el)) hold(el);
--- stream/containment.css
+++ stream/containment.css
@@ -78,3 +78,6 @@
     box-shadow: inset 0 0 0 2px rgb(127 127 127 / 0);
   }
 }
+
+/* Diagnostic copy (wheel-jump cause run): no anchoring on the chat's content while marks take effect. */
+html[data-butter-marking] .thread-scroll-container > * { overflow-anchor: none !important; }
```

- **Verdict:** 3 of 3 loads reached the end with no jump back, and all three opened at the chat's end
  like native. So the flush's marks are the trigger, not only a coincidence: with anchoring off for
  those frames alone, the jump does not happen.
- **View shift (`SHIFT=1`):** 167 tracked steps, 1 over 4 px: 7.9 px at a wheel-up step in load 1, the
  same size as in the two always-off copies. The other steps' largest is 1 px.

```text
$ LAB_ID=2 EXT= LABEL=lead-native LOADS=3 node lab/harness/wheel-jump-live.mjs                      # 20:41
SUMMARY lead-native: 0/2 loads failed (1 skipped: chat did not load)
EXIT 0
$ LAB_ID=2 EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=lead-head-test LOADS=3 node lab/harness/wheel-jump-live.mjs
SUMMARY lead-head-test: 3/3 loads failed
EXIT 1
$ LAB_ID=2 EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=lead-cv-off LOADS=3 OPTS='{"cv":false}' node lab/harness/wheel-jump-live.mjs
SUMMARY lead-cv-off: 0/2 loads failed (1 skipped: chat did not load)
EXIT 0
$ LAB_ID=2 EXT=~/snap/chromium/common/wheel-jump-flush-anchor-off/butter LABEL=lead-flush-anchor-off LOADS=3 GAP=20000 SHIFT=1 node lab/harness/wheel-jump-live.mjs   # 21:43
SUMMARY lead-flush-anchor-off: 0/3 loads failed
EXIT 0
$ LAB_ID=2 EXT=~/snap/chromium/common/wheel-jump-content-anchor-off/butter LABEL=lead-content-anchor-off LOADS=2 GAP=20000 node lab/harness/wheel-jump-live.mjs
SUMMARY lead-content-anchor-off: 0/2 loads failed
EXIT 0
```

## Commands and their final output lines

The lab 2 lock was taken once for the campaign:

```text
$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 2 --owner wheel-jump-cause --wait 600
2
```

The runs with `LAB_OWNER=wheel-jump-cause` borrowed that lock. Each run's full output, including
every `REPORT load` line, is in its log beside this file; home paths are written `~`. Every
lab 2 run's JSON is in `~/.local/share/chatgpt-lab/captures/2026-11-16-wheel-jump-top/cause-<name>.json`,
local only.

```text
$ LAB_ID=2 LAB_OWNER=wheel-jump-cause EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=cause-trace LOADS=1 STEPS=40 TRACE=1 PAGELOG=1 node lab/harness/wheel-jump-live.mjs   # 20:58
FAIL load ats12 #1: 5 jumps back, first 11790 → 0 at step 14
REPORT load ats12 #1 trace: 238 scroll events kept, clock aligned
SUMMARY cause-trace: 1/1 loads failed
EXIT 1

$ … LABEL=cause-cv-off LOADS=3 GAP=20000 SHIFT=1 OPTS='{"cv":false}' …   # 20:59
PASS load ats12 #1: reached the end in 34 steps
PASS load ats12 #2: reached the end in 20 steps
REPORT load ats12 #3 skipped: ChatGPT did not load the chat twice (no turns mounted, scrollHeight 912)
SUMMARY cause-cv-off: 0/2 loads failed (1 skipped: chat did not load)
EXIT 0

$ … LABEL=cause-cv-only LOADS=3 GAP=20000 PAGELOG=1 OPTS='{"cv":true,"container":false,"throttle":false,"older":false,"rail":false,"seek":false,"branch":false,"bookmark":false}' …   # 21:03
FAIL load ats12 #1: 6 jumps back, first 8400 → 0 at step 12
FAIL load ats12 #2: 21 jumps back, first 6300 → 0 at step 9
FAIL load ats12 #3: 6 jumps back, first 8400 → 0 at step 12
SUMMARY cause-cv-only: 3/3 loads failed
EXIT 1

$ … EXT=~/snap/chromium/common/wheel-jump-turn-cv-off/butter LABEL=cause-turn-cv-off LOADS=3 GAP=20000 PAGELOG=1 …   # 21:07
FAIL load ats12 #1: 14 jumps back, first 17954 → 0 at step 17
FAIL load ats12 #2: 13 jumps back, first 7249 → 0 at step 6
FAIL load ats12 #3: 11 jumps back, first 20751 → 0 at step 14
SUMMARY cause-turn-cv-off: 3/3 loads failed
EXIT 1

$ … EXT=~/snap/chromium/common/wheel-jump-block-cv-off/butter LABEL=cause-block-cv-off LOADS=3 GAP=20000 PAGELOG=1 …   # 21:13
FAIL load ats12 #1: 21 jumps back, first 6300 → 0 at step 9
FAIL load ats12 #2: 21 jumps back, first 6300 → 0 at step 9
FAIL load ats12 #3: 21 jumps back, first 5600 → 700 at step 9
SUMMARY cause-block-cv-off: 3/3 loads failed
EXIT 1

$ … EXT=~/snap/chromium/common/wheel-jump-content-anchor-off/butter LABEL=cause-content-anchor-off LOADS=3 GAP=20000 SHIFT=1 …   # 21:16
PASS load ats12 #1: reached the end in 18 steps
PASS load ats12 #2: reached the end in 34 steps
PASS load ats12 #3: reached the end in 25 steps
REPORT overflow-anchor scroller [children]: auto [T:none,none]
SUMMARY cause-content-anchor-off: 0/3 loads failed
EXIT 0

$ … EXT=~/snap/chromium/common/wheel-jump-scroller-anchor-off/butter LABEL=cause-scroller-anchor-off LOADS=3 GAP=20000 SHIFT=1 …   # 21:20
PASS load ats12 #1: reached the end in 20 steps
PASS load ats12 #2: reached the end in 34 steps
PASS load ats12 #3: reached the end in 25 steps
REPORT overflow-anchor scroller [children]: none [T:auto,none]
SUMMARY cause-scroller-anchor-off: 0/3 loads failed
EXIT 0

$ … EXT= LABEL=cause-native-shift LOADS=2 GAP=20000 SHIFT=1 …   # 21:24
PASS load ats12 #1: reached the end in 56 steps
REPORT load ats12 #2 skipped: ChatGPT did not load the chat twice (no turns mounted, scrollHeight 912)
SUMMARY cause-native-shift: 0/1 loads failed (1 skipped: chat did not load)
HARNESS ERROR: half the loads or more did not load the chat
EXIT 2
   (half skipped: lab 2 rested 10 minutes, 21:25–21:29, while lab 1 ran)

$ FIXTURES=math12 LAB_ID=1 EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=cause-lab1-head LOADS=2 GAP=20000 node lab/harness/wheel-jump-live.mjs   # 21:26, takes, restores and releases lab 1 itself
PASS load math12 #1: reached the end in 22 steps
PASS load math12 #2: reached the end in 22 steps
SUMMARY cause-lab1-head: 0/2 loads failed
EXIT 0

$ … EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=cause-head-shift LOADS=2 GAP=20000 SHIFT=1 PAGELOG=1 …   # 21:29
FAIL load ats12 #1: 19 jumps back, first 6300 → 0 at step 9
FAIL load ats12 #2: 24 jumps back, first 4900 → 0 at step 8
SUMMARY cause-head-shift: 2/2 loads failed
EXIT 1

$ … EXT= LABEL=cause-native-shift-2 LOADS=1 SHIFT=1 …   # 21:31
PASS load ats12 #1: reached the end in 56 steps
SUMMARY cause-native-shift-2: 0/1 loads failed
EXIT 0

$ … EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=cause-cv-off-2 LOADS=1 SHIFT=1 OPTS='{"cv":false}' …   # 21:33
PASS load ats12 #1: reached the end in 20 steps
SUMMARY cause-cv-off-2: 0/1 loads failed
EXIT 0

$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 2 --owner wheel-jump-cause     # 21:34
restored {"lab":2,"restarted":true,…,"composer":"",…,"browser":{…,"extensions":[],"flags":[]},…,"ok":true}
$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 2 --owner wheel-jump-cause
{"lab": 2, "lab_released": true, "perf_released": false}

$ LAB_ID=2 EXT=~/snap/chromium/common/wheel-jump-head-test/butter LABEL=check LOADS=1 node lab/harness/wheel-jump-live.mjs   # done-check, takes the lock itself
FAIL load ats12 #1: 21 jumps back, first 5600 → 700 at step 9
SUMMARY check: 1/1 loads failed
EXIT 1      (shell exit 1)

$ ~/.local/share/chatgpt-lab/bin/lab-lock status
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

`…` stands for `LAB_ID=2 LAB_OWNER=wheel-jump-cause` before the arguments shown, and
`node lab/harness/wheel-jump-live.mjs` after them, as in the first command. The logs' first lines
hold the full commands. Every run printed `REPORT overflow-anchor scroller [children]`: it was
`auto [T:auto,none]` in every run except the two anchoring copies shown above.

**Analysis scripts.** These run offline on the local JSON, and their outputs are kept here:

```text
$ C=~/.local/share/chatgpt-lab/captures/2026-11-16-wheel-jump-top
$ node cause-trace-rows.mjs $C/cause-trace.json > cause-trace-rows.txt
UpdateScrollOffset types: {"kCompositor":40,"kAnchoring":7,"kProgrammatic":9}
$ node cause-flush-count.mjs $C/cause-{trace,cv-only,turn-cv-off,block-cv-off,head-shift}.json > cause-flush-count.txt
$ node cause-flush-nojump.mjs $C/cause-{trace,cv-only,turn-cv-off,block-cv-off,head-shift}.json > cause-flush-nojump.txt
$ node cause-mut-count.mjs $C/cause-{trace,cv-only,turn-cv-off,block-cv-off,head-shift}.json > cause-mut-count.txt
$ node cause-page-rows.mjs $C/cause-cv-only.json 2; node cause-page-rows.mjs $C/cause-head-shift.json 2   > cause-page-rows.txt
$ node cause-shift-table.mjs $C/cause-{native-shift,native-shift-2,cv-off,cv-off-2,content-anchor-off,scroller-anchor-off,head-shift}.json > cause-shift-table.txt
```

`cause-trace-rows.mjs` labels every jump's step `?`, because the step numbers are in the logs. Its
own jump detection uses the harness's rule.

**Static checks after the harness edits:**

- `npm run format:check`: "All matched files use Prettier code style!"
- `npm run lint`: no output (pass).
- `node --test`: tests 834, pass 834, fail 0.
- `git status --short`: no change under `extension/`.

## Files

- **Here:**
  - `cause-*.log`: one per run.
  - `cause-*.txt`: analysis outputs. They hold numbers and chat ordinals only: no turn keys, chat
    text or URLs.
  - `cause-*.mjs`: the analysis scripts.
- **Local only, in `~/.local/share/chatgpt-lab/captures/2026-11-16-wheel-jump-top/`:**
  - the per-run JSON, including the trace events in `cause-trace.json`;
  - `cause-lab1-head.json`.
  - The done-check's JSON is in `~/.local/share/chatgpt-lab/captures/wheel-jump-live/check.json`.
- **Scratch builds, kept:** `~/snap/chromium/common/wheel-jump-turn-cv-off`, `wheel-jump-block-cv-off`,
  `wheel-jump-content-anchor-off` and `wheel-jump-scroller-anchor-off`.

## Not established

- **The anchor node, and why its new position is computed near the chat's top.** The `blink` trace's
  `ScrollAnchor::FindAnchor` events carry no arguments, and no heavier trace category was used (the
  earlier campaign's heavy traces stalled the page).
- **Why some flushes cause no jump.** The lead's `flush-anchor-off` copy shows the flush's marks are
  the trigger (see The lead's runs), but 16 of 197 flushes on the plain build caused no jump, and what
  differs in those is not known.
- **Other ways an element gets `content-visibility: auto`.** The streamed answer's blocks get it from
  the `in_progress` rule and lose it when the answer completes, with no flush. This fixture has no
  streaming, so whether those changes make the same anchoring move is not shown.
- **Lab 1 and other fixtures.** The plain test build did not fail on lab 1 `math12` (2 loads), so
  the Q2 and Q3 arms ran on one fixture and one account. Why `math12` does not reproduce was not
  looked at.
- **The settle-phase mover** behind the low openings in Q5. No trace was taken of the settle phase.
- **The step-1 report's arm-mode jump at the end** (the chat dropping to 0 within 0.9 s of reaching
  the end) was not traced.
- **The value of anchoring for never-rendered streamed blocks.** Q4 covered only content with
  correct remembered sizes and no streaming.
- **Load counts.** 3 judged loads per arm are enough to separate 0/3 from 3/3 here, but they give no
  failure rate for the passing arms.
- **macOS Chrome.** This lab is Linux Chromium 156 with software rendering, classic scrollbars and
  CDP wheel events of 700 px each: no smooth scrolling, no momentum, no trackpad phases. On macOS:
  - wheel and trackpad input arrives as many small deltas with momentum;
  - scrollbars are overlay;
  - rendering is on the GPU.

  Smaller steps would cross the flush with a different scroll position and timing. Whether macOS
  Chrome's anchoring makes the same `kAnchoring` move, and how often, is not shown.

## Cleanup

- **Lab 2:** restored by `lab-restore` (exit 0: browser restarted with no extensions, one home tab,
  empty composer) and released. The done-check run then took, restored and released it by itself.
- **Lab 1:** taken, restored and released by its run's harness. It was not touched otherwise, and
  no message was sent on either lab.
- **Final state:** `lab-lock status` shows lab 1, lab 2 and perf not held.
