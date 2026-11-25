# Veil: state paths the lab cannot run (read-through, #175)

Ticket #175 of spec #170. The lab replays a recorded stream and never sends, so Stop, Regenerate,
Edit and switching answer versions during a stream cannot be run there. Neither can a chat that
becomes hidden mid-stream, nor a block ChatGPT moves or re-attaches (a Dil remount), nor a hidden
tab. For each of these, this read-through gives what the off-screen marker
(`extension/stream/offscreen.js`) sees, which unveil path covers it, and the tests that model it.
Every case is modelled over the fake DOM (seam 1a, `test/stream-veil-paths.test.js`), and every
case except the hidden tab also runs in headless Chromium with the real stylesheet and marker
(seam 1b, `test/stream-veil-paths-chromium.test.mjs`).

**Result:** one path was uncovered: a veiled block that comes back into the page outside the veil's
rules. It now has a guard (path 5 below). With the guard, every case passes. Without it, two
Chromium cases draw veiled rendered blocks, and so does the fake-DOM hidden-chat model.

## The rule and the unveil paths

The hard requirement: no rendered block is ever veiled. The veil is `data-butter-veil` on an
answer block; `stream/containment.css` turns it into `opacity: 0` only under one of the two
`content-visibility: auto` rules for unmarked blocks: inside a turn whose `data-talvt-turn-state`
is `in_progress`, or on a block held as never-rendered (`data-butter-unrendered`). That is the
**stylesheet guard (G)**: a veil left on a block outside those rules computes opacity 1.

So a veiled block can only start rendering in one of two ways:

- **Under the rules:** it stops being skipped. Chromium then fires
  `contentvisibilityautostatechange` with `skipped: false`.
- **By leaving the rules:** the stylesheet guard then makes the veil inert.

The marker takes the veil off at these moments:

| # | Path | Where |
|---|---|---|
| 1 | The block stops being skipped: unveiled first, before any other bookkeeping | state-change handler |
| 2 | The flush marks it seen | `flush()` |
| 3 | Its turn leaves `in_progress`: every veiled block in the turn that is not held | MutationObserver, `data-talvt-turn-state` |
| 4 | `cv` goes off: every veiled block in the page, and none is veiled again | `butter-settings` handler |
| 5 | **New (#175):** it comes into the page veiled, not held and outside a streaming turn | `watch()`, from the MutationObserver's added nodes |

### What path 5 guards

A veil is inert outside the rules, but it does not stay harmless: the block can come back under
them.

- **How it comes back:** the flush holds any queued block that the marker still believes skipped,
  and a held block is under the unrendered rule. A block that leaves the rules by rendering
  fires no event, so the marker's `skipped` set still has it.
- **What Chromium draws then:** a block that is already laid out and enters an `auto` rule on
  screen gets its `skipped: false` event only after a frame. If it carries a veil, that frame
  draws it at opacity 0.
  - Measured on a completed turn whose blocks were given a veil and then switched to
    `in_progress`: with no marker, 110 rendered-veiled samples; with the marker, 1 frame-start
    sample before the event unveiled the block.

Before #175, a stale veil outside the rules was left wherever a veiled block left `in_progress`
without path 3 seeing it:

- its turn completed while out of the document (a MutationObserver does not see mutations in a
  detached subtree);
- it was out of its turn when the turn completed;
- it was moved.

Each of these brings the block back as an inserted node. Path 5 removes the stale veil at that
point, before the flush can hold the block.

Measured in headless Chromium with #174's marker, before the guard:

- **Hidden chat:** a turn detached right after streaming 240 blocks, completed while detached and
  re-attached, then the flush. 45 rendered-veiled "after drawing" samples in the exploratory run.
  37 in `version switch and hidden chat: the answer completes while its turn is out of the page`.
- **Dil remount:** 1 in `Dil remount: veiled blocks detached and re-attached with their marks on`
  (the block that comes back after completion).

With the guard: 0 in both. `stream-veil-paths.test.js` › `hidden chat: an answer that completes
while its turn is out of the page comes back with only held blocks veiled` fails without the guard
too.

## The cases

### 1. Stop

**What the marker sees:**

- The answer's turn changes `data-talvt-turn-state` away from `in_progress`, an observed attribute
  mutation, as at completion.
- No element leaves or comes back.
- The blocks are in four states: held (veil and unrendered), queued for the next flush (veil,
  size reported), not yet queued (veil, inserted in the last frame with no size reported), and
  not veiled (rendered first).

**Unveil path:**

- **Queued and not-yet-queued blocks:** path 3 unveils them in the task that observes the state
  change. Queued blocks are taken out of the queue as rendered. They have just rendered, because
  leaving the streaming rule renders them, and the stylesheet guard keeps them at opacity 1 from
  ChatGPT's own layout in that task until the sweep.
- **Held blocks:** they stay veiled and skipped, and path 1 unveils them when they come into view.
- **A flush pending at Stop:** it runs on a queue without the swept blocks. A late size for a
  not-yet-queued block can still hold it, but it carries no veil.
- **A state other than `complete`:** if Stop leaves the turn in another state value, or removes the
  attribute, the sweep still runs, because it tests "not `in_progress`". If ChatGPT replaced the
  turn's elements instead, that is case 2a or 5.

**Tests:**

- `stream-veil-paths.test.js` › `Stop: the answer leaves in_progress with blocks held, queued and
  not yet queued; none renders veiled`
- `stream-veil-paths.test.js` › `Stop before the first flush: no block is held, and none stays
  veiled`
- `stream-veil-paths-chromium.test.mjs` › `Stop: the answer leaves in_progress with blocks held,
  queued and not yet queued`. The last blocks are inserted in the task that stops the answer.
  Then scrollTop onto the held blocks and onto the last blocks, and the flush runs.

### 2. Regenerate

**What the marker sees:**

- The answer's turn goes back to `in_progress`, an observed mutation. Path 3 does not run, because
  the turn is busy.
- Either of the following happens:
  - **(a) The answer's blocks are replaced.** The old elements leave and new ones are inserted;
    the new ones carry no marks and are scanned and observed like any streamed block.
  - **(b) The block elements are reused.** React keeps the elements and rewrites their content.
    Butter's attributes stay on them: veil, unrendered and seen.

**Unveil path:**

- **(a):** the new answer goes through paths 1–3 like any answer. The old elements are out of the
  page, and nothing renders them.
- **(b):** after the old answer's completion (path 3), the only veils left are on held blocks.
  - A held block is under the unrendered rule throughout, so its veil tracks its skip state. When
    the new content in it renders, path 1 unveils it first.
  - A reused block that rendered in the old answer is in `drawn` and is never veiled again. That
    loses effectiveness, not safety.
  - A reused seen block keeps `data-butter-seen` and its remembered size. That is the marker's
    behaviour without the veil.
  - If the old answer completed unobserved (cases 4 and 5), path 5 removed its stale veils when the
    elements came back.
  - So in the new answer, a veil from before survives only on a block that is still skipped and
    has never rendered. That is the veil's own definition. No block that renders keeps a veil
    from before.

**Tests:**

- `stream-veil-paths.test.js` › `Regenerate and Edit, blocks replaced: the new answer has no block
  veiled from before`
- `stream-veil-paths.test.js` › `Regenerate and Edit, block elements reused with their old marks
  on: a reused block renders unveiled`
- `stream-veil-paths-chromium.test.mjs` › `Regenerate and Edit: the answer is replaced by new
  blocks`
- `stream-veil-paths-chromium.test.mjs` › `Regenerate and Edit: block elements are reused with
  their old marks on`. The text of every block is rewritten in place, the turn goes back to
  `in_progress`, and the view is put on reused veiled blocks while the new answer streams and
  after it completes.

### 3. Edit

**What the marker sees:** editing a question starts a new branch.

- Usually the edited question's turn and its answer are replaced by new turns, so the elements
  leave and new ones come. That is case 2a.
- If ChatGPT reuses the answer's elements while the turn stays `in_progress` throughout (an edit
  during the stream), no state change is seen at all.

**Unveil path:**

- **Replaced:** as 2a.
- **Reused while streaming:** the veils on reused blocks are still valid. They are under the
  streaming rule and still skipped. They come off by path 1 when the block renders, or by path 3
  at the new answer's completion.

**Tests:**

- The two Regenerate and Edit tests above, in both seams.
- `stream-veil-paths.test.js` › `Edit while the answer streams, elements reused: veiled blocks stay
  veiled only while skipped`

### 4. Switching answer versions during a stream

**What the marker sees:**

- The turn's message content is swapped. The streaming version's blocks leave the page, and the
  other version's blocks come in with their own marks (seen, from when they rendered).
- Switching back brings the streaming version's blocks back:
  - **new elements** if React mounts them again, with no marks;
  - **the same elements**, if ChatGPT keeps them, with their marks on. The answer may have
    completed meanwhile.
- If it completed while its blocks were out of the page, path 3 missed them:
  - **The state element was in the page:** the sweep's query did not find the blocks.
  - **It was out of the page:** the mutation was not observed.

**Unveil path:**

- **New elements:** they carry no marks.
- **Same elements, still streaming:** the veils are valid. The blocks are under the streaming rule
  again and still skipped. The state-change event comes before such a re-inserted block renders
  (#174's finding, and the Chromium case below); then path 1.
- **Same elements, completed while away:** **path 5** unveils every veiled block that is not held,
  as it comes back. Held blocks keep their veil, because they are still under the unrendered rule
  and skipped.

**Tests:**

- `stream-veil-paths.test.js` › `version switch and hidden chat: the turn leaves and comes back
  while streaming; its veiled blocks render unveiled`
- `stream-veil-paths.test.js` › `version switch: the turn comes back with new block elements; none
  is veiled from before`
- `stream-veil-paths.test.js` › `hidden chat: an answer that completes while its turn is out of
  the page comes back with only held blocks veiled` (fails without path 5)
- `stream-veil-paths-chromium.test.mjs` › `version switch and hidden chat: the turn leaves the page
  and comes back while streaming`
- `stream-veil-paths-chromium.test.mjs` › `version switch and hidden chat: the answer completes
  while its turn is out of the page` (37 violations without path 5)

### 5. A chat that becomes hidden mid-stream

**What the marker sees:** the user opens another chat. ChatGPT's single-page navigation takes the
chat's turns out of the page, or hides their container. On return there are three possibilities:

- **A rebuilt chat:** ChatGPT renders the chat again from new elements. If the answer is still
  streaming it streams into them; if it completed, the chat is an opened chat, where nothing is
  held and nothing is veiled.
- **The same elements re-attached:** as case 4.
- **The container shown again:** with `display: none`, the blocks never leave the page and the turn
  state change is observed (path 3).

**Unveil path:**

- **Rebuilt:** nothing from before is left.
- **Re-attached:** as case 4, path 5 when it completed while away.
- **Hidden container:** #174 found that the state-change event arrives before content renders when
  the container is shown again (path 1).

**Tests:**

- The case 4 tests, which park the whole turn out of the page.
- `stream-veil-chromium.test.mjs` › step `hide the chat and show it again` (#174).

### 6. A Dil remount (a block moved or re-attached)

**What the marker sees:** a block element leaves the page and comes back as an inserted node, with
all its marks on: veil, unrendered, seen. It is scanned again.

**Unveil path:**

- **Back while streaming:** the veil is valid, and path 1 unveils it before it renders.
- **Held:** the veil is valid wherever the block comes back, and path 1 applies.
- **Back after its answer completed, not held** (it was out of the turn at completion, or moved
  into a completed turn): **path 5** unveils it as it comes back. Without path 5, the flush later
  held it on screen and Chromium drew it veiled (1 violation).

**Tests:**

- `stream-veil-paths.test.js` › `Dil remount: a block detached and re-attached with its marks on`
- `stream-veil-paths-chromium.test.mjs` › `Dil remount: veiled blocks detached and re-attached with
  their marks on`, in the Dil renderer. Two veiled blocks leave while streaming; one comes back in
  view while streaming, and the other after completion. Then a held block leaves and comes back in
  view.
- `stream-veil-chromium.test.mjs` › step `detach a held block and re-attach it in view` (#174).

### Hidden tab

**What the marker sees:** a hidden tab runs no frames, but MutationObservers and timers still run,
throttled.

- No frames means no `requestAnimationFrame`, no ResizeObserver deliveries and no state-change
  events. So nothing is reported skipped, and nothing new is veiled while the tab is hidden.
- If the answer completes while the tab is hidden, the turn state change is observed and path 3
  unveils at once.
- `data-butter-unveiled`, which keeps transitions off, is cleared only after frames run.
- The flush is deferred to a frame, so it waits until the tab shows.
- When the tab shows, the normal paths apply. This is the spec's expectation: "while the tab is
  hidden the browser reports no skipping, so nothing is veiled until the tab shows, and completion
  in a hidden tab takes the completion path".

**Unveil path:** path 3 for completion while hidden, and paths 1 and 2 once it shows.

**Tests:**

- `stream-veil-paths.test.js` › `hidden tab: completion unveils without waiting for a frame`. No
  frame runs until the tab shows; the veil is off at completion, and the transition guard is
  cleared once frames run.
- **Headless Chromium cannot hide a page.** After `bringToFront()` of another page, after
  minimizing the window through `Browser.setWindowBounds`, and after setting
  `Page.setWebLifecycleState` to `frozen` and back, `document.visibilityState` stayed `visible` and
  rAF kept running. `Emulation.setPageVisibility` does not exist. A frozen page runs no script at
  all, which a hidden tab does, so it does not model one either. The hidden tab has no seam 1b test.

## Paths found uncovered

One, covered now: **a veiled block that comes back into the page outside the veil's rules** (cases
4, 5 and 6).

- **Guard:** path 5 in `watch()` (`extension/stream/offscreen.js`).
- **Tests that fail without it:**
  - `stream-veil-paths.test.js` › `hidden chat: an answer that completes while its turn is out of
    the page comes back with only held blocks veiled`
  - `stream-veil-paths-chromium.test.mjs` › `version switch and hidden chat: the answer completes
    while its turn is out of the page`
  - `stream-veil-paths-chromium.test.mjs` › `Dil remount: veiled blocks detached and re-attached
    with their marks on`
- **Check:** all three were run against #174's marker (`git show HEAD:extension/stream/offscreen.js`
  swapped in) and failed, then passed with the guard.

No other path was found. Two kinds of stale veil remain, and both are inert:

- **A block that turns into a wide block or table frame after it was veiled.** It leaves the
  rules, and the stylesheet guard keeps it at opacity 1. It would need to stop being wide to come
  back under them.
- **A block with a restored layout's inline `content-visibility: auto`.** Its veil tracks its own
  skip state, as #174 found.

## Assumed about ChatGPT's page, not verified live

These limit what this PR shows. The modelled tests cover each alternative listed; the first real
send on a build with the veil is the user's own check (spec #170, "Named limits").

- **Stop** changes the answer turn's `data-talvt-turn-state` away from `in_progress` on an element
  inside the `[data-turn-key]` turn, as completion does. Lab runs (2026-11-23 stream-recheck,
  2026-11-24 stream-veil) verified this for completion only, never for Stop.
- **Regenerate** streams the new answer either into new block elements or into the old ones with
  Butter's attributes left on them. Which one ChatGPT does, and whether the turn keeps its
  `data-turn-key`, was not looked at.
- **Edit** replaces the edited question's turn and its answer with new turns, or reuses the
  answer's elements while it streams. Not looked at.
- **Version switching** during a stream mounts the other version's blocks and remounts the
  streaming one, with new or kept elements. Whether the stream keeps running in the background,
  and whether its completion is observed while it is not shown, was not looked at.
- **A hidden chat** (another chat opened mid-stream) takes the turns out of the page or hides their
  container. On return the chat is rebuilt from new elements, or the old elements are re-attached.
  Not looked at.
- **A Dil remount** moves a block as a removal and an insertion (both seen by a `childList`
  MutationObserver on the document), never by re-parenting outside the document's tree. Assumed
  from the DOM, not from ChatGPT's code.
- **A hidden tab** in Chromium runs no rendering (no rAF, ResizeObserver or
  `contentvisibilityautostatechange`) but delivers MutationObserver records. This is Chromium's
  documented behaviour and was not measured here; headless Chromium cannot hide a page.
- **Chromium's event timing:**
  - An element inserted under an `auto` rule gets its state-change event before its content
    renders (#174, headless).
  - An element already laid out that enters an `auto` rule on screen is drawn one frame before its
    `skipped: false` event (measured here, headless).
  - Neither was measured on the lab's Chrome build.

## Commands

The exploratory runs: `/tmp/veil175/exp*.mjs` (not kept). The tests:

```sh
node --test test/stream-veil-paths.test.js test/stream-veil-paths-chromium.test.mjs
```
