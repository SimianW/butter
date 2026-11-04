> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Seek preview: viewport-sized display-math box

Worktree `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`. Nothing was committed, pushed or version-bumped.

## Root cause

The snapshot that drew the box covered only the **start** of the answer. Its last item was an early display formula, and that formula's box ran to the end of the turn. Capture accepted the snapshot because nothing in `validateSnapshot` checks that an item's height fits its content. The preview then drew that item faithfully: one `.it.math.display` box of `it.h`, with nothing after it.

Evidence:

- **Video frames** (`vid-frames.jpg`, `grid.jpg`):
  - The box starts right under the answer's first lines ("<prompt text>").
  - It ends just above the **next question's bubble** (top row, third frame).
  - The centred TeX moves from frame to frame and sits near the bottom of the viewport in some frames. So the box is taller than the viewport (roughly 1,400 px), and no items follow it in that turn.
- **The chat's markdown** (read-only GET, `conv-ats.json`): both formulas sit near the **start** of their answers.
  - Q3: `<prompt text>` is at character 235 of 1,465.
  - Q6: `<prompt text>` is at character 266 of 1,502.
  - Several paragraphs, headings, a table and more formulas follow each one.
  - A record whose last item is that formula is therefore a record of a partly rendered answer.
- **The real DOM can't produce a tall formula on a settled page.**
  - The item is `SPAN.Display-…[data-math-display][data-math-source]` with `padding-block: 16px; display: flow-root`. There is no min-height or flex rule (CSS dump in `css.mjs` / `css2.mjs` output).
  - The lab measured 434 settled formulas in the user's chat and 14,736 samples in the 12-question fixture. The highest height-to-limit ratio was 0.55 and 0.58.
- **Ruled out:**
  1. **Stale `leanCache`:** the MutationObserver clears it for every dirty turn, and the text in the video is correct.
  2. **CAP on `lean()`:** the formula is at the start.
  3. **Content-visibility placeholder:** that gives 120 px, and the lab's cached heights matched live heights for skipped blocks.
  4. **Stored-path `source` mapping:** this chat has image attachments, so Butter never persists it (the worker DB had 0 rows). The video's preview came from the in-session (warm) cache.
- **Not observed directly:** the exact moment ChatGPT exposes such a partial answer. My best explanation is right after an answer streams in. These two turns were asked live that day, and ChatGPT's markdown root reveals text gradually (`.MarkdownRoot.AdaptiveStreaming .FadeIn`). Reproducing it would mean sending a message, and the hard rules forbid that and the existing replay harness (it types into the composer and submits). In the lab, live capture never produced a tall formula item:
  - instrumented build, 3 rounds of load, 14 jumps, wheel scrolling and back-navigation;
  - live probes on both math chats.

## Fix (diff summary, +92 / −6)

- **`extension/seek/core-main.js`:**
  - New `displayMath(it)`: is the item only one display span?
  - New `displayMathLimit(it)`, $120 + 64 \cdot \text{rows}$ px, where each `\\` or `\cr` adds a row; `Infinity` for anything that isn't pure display math.
  - `validateSnapshot` returns `'math-height'` when an item exceeds it. As with other rejections, the previous good record is kept and the next RO-triggered snapshot can replace it.
  - Both helpers are exported.
- **`extension/seek/preview-main.js`:** the display-math branch uses `core.displayMath` and draws the box at `min(it.h, displayMathLimit(it))`.
  - **Why the render clamp is justified:** stored rows written by earlier builds (TRY.md test packages, kept up to 30 days) bypass `validateSnapshot`. The clamp keeps them from ever drawing a viewport-sized box.
- **`docs/how-it-works.md`:** documents the rule and the clamp.
- **Tests:**
  - `test/height-cache-dom.test.js` (real recorder in vm): a display item measured at 1,400 px is not recorded (`math-height`). At 65 px it is recorded. A later 1,400 px snapshot does not replace the settled 65 px record.
  - `test/seek-fallback.test.js`: the limit is 184 px for one row and 376 px for four rows. Mixed text and paragraphs get `Infinity`. 268 px (4-row cases) and 65 px pass; 1,400 px is rejected.

## Test output

Red, original core (`git show HEAD:extension/seek/core-main.js` swapped into a temporary copy of the test):

```
  + actual - expected
    actual: { conv: '00000000-…', h: 1500, … blocks: [ 1368 ], items: [ [Object] ], ready: true, … },
    expected: null,
  TypeError: core.displayMathLimit is not a function
```

Green:

```
node --test            → tests 167, pass 167, fail 0   (165 before + 2 new)
npm run format:check   → All matched files use Prettier code style!
python3 scripts/check-version.py → OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
git diff --check       → clean
```

## Lab

I took the lock twice, each time by atomic `mkdir` through `acquire-lock.py` after the benchmark released it:

- 22:26–22:40, then released;
- 22:43–22:58.

The first session:

- **Probes:** before build on the 12-question fixture and on the user's chat ("<prompt text>", <project> `<chat>`). Results in `before-fixture.json`, `before-ats*.json`.
- **Layout consent:** the `butter.layoutConsent` setting was granted for the probe builds, then removed.
- **Instrumented build** (`ex1.json`): 0 tall-formula captures.
- **Store check:** the worker DB was empty because the chat has attachments.

The second session:

- **Before/after drags** on the user's chat at thumb positions .95 → .05. Both builds give identical previews, with the tallest box 102 px. The transient state can't be produced without sending, so this pair shows no regression, not the fix itself.
- **After-build drag on the fixture:** 0 formulas over the limit, 0 `math-height` rejections, tallest preview box 185 px.
- **Screenshots** (private, contain account UI): `(not archived)` and `drag-after-fixture-hold-*.png`.

## Lab restored, lock released

- `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head`.
- Normal flags: no `--enable-features`.
- `restore.mjs` reports: `restored <chat> composer empty`.
- My lock was removed. The current `lock.d` belongs to another task (`butter-wheel-local-…`).
- Nothing was sent and there were no API writes; a route guard aborted any non-GET request.
- **Leftover:** the before-build extension's local storage in the lab profile (unpacked ID `aaldfmiglpbhcppbenliejmgjhfoaaph`, not loaded now) may still hold `butter.layoutConsent: granted`. The reset ran while that extension wasn't loaded and failed. It is inert while unloaded.
