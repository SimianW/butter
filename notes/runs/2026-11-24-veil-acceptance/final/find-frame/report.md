# Find frame: a frame drawn veiled after a find (#170)

**Yes, the veil leaked a frame.** In headless Chromium, a find, a selection, a focus or a
`scrollIntoView` in a held, veiled block renders the block on the spot, but the
`contentvisibilityautostatechange` event that unveils it is a task posted then. When the frame
runs before that task, it lays out the block's content and paints it at opacity 0. That happened
when the act ran in a frame's `requestAnimationFrame`, and when it ran in a task still busy when
the frame was due (as on ChatGPT, where the find bar's frames took about 90 ms). The evidence is
screenshots of that single frame, taken under BeginFrame control: blank before the fix, with the
matched text in the no-veil control and with the fix (below). This is the frame with flags 11 in
stage D2. Fixed in `extension/stream/offscreen.js`: a ResizeObserver watches each veiled block's
height and unveils the block in the frame its height leaves the placeholder, after layout and
before paint.

## What ran

- `beginframe.mjs` (here): Playwright's chrome-headless-shell over raw CDP with
  `--enable-begin-frame-control`. No frame runs until `HeadlessExperimental.beginFrame`, whose
  screenshot is that frame as drawn. The chat is the synthetic page of `test/helpers/veil-page.mjs`
  with blocks at their content's height: 240 blocks streamed below the fold, held by the flush,
  the answer completed, and pre-layout run. The target is the held, veiled block 200
  (`zq200zq`). Flags are as in the lab (1 veil, 2 opacity 0, 4 skipped, 8 held).
  `MARKER=<file>` loads the marker from before the fix (`git show 9cdba5f:extension/stream/offscreen.js`
  on this branch), and `NOVEIL=1` drops the opacity rule (the control).
- `test/stream-veil-activation-chromium.test.mjs` (new, in `npm test`), and two fake-DOM cases in
  `test/stream-veil.test.js`.

## Frame by frame, find then `scrollIntoView`

Busy: the act runs in a task that stays busy for 60 ms, and frame b is begun during it. Dark
pixels in the text column of the view:

| Build | Log (frame b and after) | Frame b |
| --- | --- | --- |
| Before the fix | task: act, task: end, event (flags then **11**), rAF 0: flags 8 | **0** (blank) |
| With the fix | task: act, task: end, event (flags then 8), rAF 0: flags 8 | 1,919 (the block) |
| No veil rule | task: act, task: end, event (flags then 8), rAF 0: flags 8 | 1,919 |

In a frame: the act runs in frame 0's rAF.

| Build | Log | Frame 0 |
| --- | --- | --- |
| Before the fix | rAF 0: flags 15, act; event (flags then **11**); after frame 0: flags 8 | **0** (blank) |
| With the fix | rAF 0: flags 15, act; event (flags then 8); after frame 0: flags 8 | 1,919 |
| No veil rule | rAF 0: flags 13, act; event (flags then 8); after frame 0: flags 8 | 1,919 |

With the fix, the event finds the block already unveiled (flags 8): the observer ran in the
frame, before the posted task. A sample in a task posted from the frame's rAF ("after frame 0")
reads flags 8 on every build, because the event task was posted first and runs before it. So the
existing sampler's "after drawing" sample cannot see this frame.

Screenshots (frame b of the busy run, and frame 0 of the rAF run):
[before the fix](findScroll-busy-frame-b-before-fix.png),
[with the fix](findScroll-busy-frame-b-with-fix.png),
[no veil](findScroll-busy-frame-b-no-veil.png);
[before the fix](findScroll-raf-frame-0-before-fix.png),
[with the fix](findScroll-raf-frame-0-with-fix.png),
[no veil](findScroll-raf-frame-0-no-veil.png).
In later frames every build shows the same: the neighbouring held blocks render, shrinking from
their 120 px placeholders, and the view moves (scroll anchoring is off). The control does this too.

Same result, frame 0 (rAF) or frame b (busy), before the fix vs with it: selection then
`scrollIntoView` 0 vs 3,034 px; focus on a link in the block 0 vs 1,285 px (busy too); a plain
`scrollIntoView` on the block 0 vs 1,108 px. `window.find` without a scroll: the block is
off-screen, so nothing visible changes, but before the fix the event still finds it veiled (11)
after a frame was drawn; with the fix, unveiled (8).

## The cases, and the real find bar

The test has each act in a frame and on a busy page (150 ms: a task over 100 ms gets the frame
ahead of a posted task in Chromium's scheduler; at 60 ms the event won in normal headless mode):
`window.find`; `window.find` then `scrollIntoView`; a selection range then `scrollIntoView`; and
`focus()` on a link inside the block. A witness ResizeObserver, created after the marker's, records
the block in the frame it renders, after layout and the marker's observers and before paint. It
must find the block rendered and not at opacity 0. Every held block still skipped must stay
veiled, before and after the act.

Headless Chromium cannot drive the browser's find bar. These cases cover what follows once a find
has activated a match in a skipped block (Chromium renders it and posts the event) and the frame
wins the race. They do not cover the find bar's own path: its activation and scroll come over IPC,
not from script. The lab's flags 11 at the first frame start in view (veil runs 2 and 3 of D2) is
the state these cases reproduce, but the fix has not run against the real find bar.

## The fix, its cost and its limit

About 20 lines in `offscreen.js`. Veiling a block also observes it (`sized`). The first report is
its placeholder height. A later report with another height means the block rendered, and unveils
it; a report of 0 px (it left the page) or for an unveiled block lets it go. Nothing else changes:
the state-change event still unveils first thing, and every other unveil stays.

- **Gain kept:** pre-layout, a width change or a completed turn leave a held block's height at its
  placeholder, so it stays veiled. The test checks every held, skipped block is still at opacity 0
  after pre-layout and after each act. A mutant that unveils at the first report fails that check.
- **Limit:** a block whose rendered content-box height equals its placeholder (exactly 120 px, or a
  fixed CSS height, like the fixture's 40 px blocks or an `<hr>`) gets no report. It falls back to
  the event, as before: one blank frame after a find, on a busy page.
- **Cost, not measured live:** one ResizeObserver observation per veiled block (hundreds in a long
  answer), checked by the browser on each frame, and one callback entry when a block is veiled.
- **Fake DOM:** `test/helpers/offscreen-fixture.cjs` now keeps one target set per ResizeObserver
  and reports 0 px to a detached element's observers, as Chromium does at its next frame (checked:
  120, then 0 after `remove()`). Pre-layout's garbage-collection test caught the first version,
  which kept removed veiled blocks alive.

Options not taken: unveiling in a `scroll` listener (it fires at the frame's start) covers only an
act that scrolls from a task, and must test each veiled block's render state on every scrolled
frame. `:focus-within` in the CSS covers focus only. A placeholder that no real block can match
(`contain-intrinsic-size` off by 1/64 px on veiled blocks) would close the limit above, but it
moves layout by a fraction of a pixel when a skipped block is unveiled.

## The one-frame delay

With the fix, the match is drawn in the same frame as in the no-veil control (frame b above), so
the extra frame on the find bar (87 to 95 ms in D2) and after `window.find` (stage D) should go,
for every block whose height changes. The lab's probes cannot show it: they read flags at the
frame's start (`requestAnimationFrame`), before layout and before the observer, so they will still
see flags 11 for that frame and report "drawn" one frame late. A sample in a task posted from the
rAF does not help either, since the posted event runs first. To measure the drawn frame, sample
in a ResizeObserver on the matched block created after the marker's, or capture frames.

Unveiling before the frame's start would need to know about the activation before the frame, and
the browser gives no event for that. The frame-start state is not drawn, so the fix does not try.

## Still unknown

- The real find bar with the fix: stages A2, C2b and D2 need to be run again, and D2's probe needs
  an after-layout sample to see the drawn frame.
- How often a ChatGPT block renders at exactly its placeholder height.
- The observer's per-frame cost on a long live answer.
