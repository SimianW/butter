# Missing preview blocks and rail/scrollbar hit testing

2026-11-05. Baseline: `527661845c40b62464b4a5e41a0c52afe032f7b6`.
Only the math-source lookup changes in the extension. No rail code, styling, version,
changelog, release, push, or PR changes. Browser evidence is synthetic, contains no account
data, and was collected through T3's browser tools in an owned tab, closed afterward.
The shared account labs were not used, so no lab locks or restoration were necessary.

## Problem 1: reproduced and fixed

The recorder's `lean()` walker stops at the first `.katex-display` or `.katex` node. It reads
an annotation or an ancestor's `data-math-source`, then returns without descending into
the KaTeX glyph tree (`extension/seek/layout-cache-main.js:581`). With HTML-only KaTeX
whose source is inside the display wrapper, neither lookup succeeds. The measured item
has positive geometry but empty text. An empty annotation also prevented ancestor fallback
because the old code used nullish coalescing.

Fix: use the first nonempty source, including a descendant `data-math-source`. Keep the
single outer math span and its measured height. Do not walk nested `.base` elements or
copy rendered HTML. This applies to inline and display math and is independent of the
TeX command: boxed sums, fractions and other expressions can all have this DOM shape.

The new real-recorder regression in `test/height-cache-dom.test.js:286` uses the reported
boxed expression, missing/empty annotations, a nested source, and a 150 px item. It checks
that exactly one display span survives, then follows source indexing, codec packing and
unpacking, and hydration. It fails on an archive of `5276618` and passes with this fix.

### Paths checked and limits

- Measured preview: `layout-cache-main.js:567` extracts text; `preview-main.js:340` creates
  typed text/math spans; `preview-main.js:441` draws formula-only items. The bug precedes
  drawing. An adjacent paragraph means the whole-viewport fallback does not repair an
  individually empty formula.
- Persistence: `layout-check-main.js:146` matches extracted text against source blocks;
  `layout-codec.js:101` stores geometry, source indexes and math offsets, and
  `layout-check-main.js:194` hydrates text. An empty extracted formula cannot match its
  source and rehydrates blank. The regression covers a new corrected record through this
  path. Old stored records with an unmatched source index still need remeasurement;
  there is no speculative repair or schema change.
- Unseen/estimated preview: `preview-main.js:357` parses source delimiters without KaTeX
  DOM. The exact expression produced one display strip containing all 146 source
  characters in the browser fixture; this source-lookup bug does not affect that path.
  Existing limits remain: only the beginning (6000 characters) of an unseen answer is used,
  blank-line paragraph splitting can split a display source containing blank lines, and
  long TeX is deliberately a single ellipsized strip.
- Snapshot rejection: `core-main.js:161` rejects skipped, incomplete, placeholder,
  zero-sized and implausibly tall snapshots. `displayMathLimit()` allows 184 px for a
  single TeX row and 64 px more for each explicit row break. The exact expression rendered
  at 133.8671875 px in the fixture, so its normal height is not the rejection cause.
  Deeply nested formulas or unusually large text can still exceed this heuristic; it was
  retained to avoid reviving the previously reproduced viewport-sized partial snapshot.
- Other missing-block shapes found during inspection: persistence uses exact text matching.
  Markdown soft-break whitespace and blockquotes whose source still includes `>` can fail
  that match and rehydrate as empty items even when warm extraction succeeded. This is a
  separate source-reconstruction limitation, not fixed by the DOM-source lookup. The global
  excerpt fallback prevents a completely empty viewport but does not recover each missing
  item. Media, buttons and SVG are intentionally absent from the text preview; lean text
  is capped at 4000 characters. No changes to those policies are included.

This demonstrates a concrete missing-formula bug, not proof that the user's original
ChatGPT DOM used this exact shape: the supplied image shows rendered ink, not DOM.

### Browser capture

An owned synthetic browser page loaded KaTeX 0.16.11, rendered the supplied formula with
`displayMode: true, output: 'html'`, and placed `data-math-source` on the nested `.katex`.
The baseline and fixed `lean()` functions were extracted from the respective source files;
the existing `content()` renderer and preview CSS were used unchanged.

- Baseline: extracted text `''`, no surviving math spans.
- Fixed: extracted 146 source characters, one display span at 133.8671875 px.
- Estimated source rendering: one display span, full source present.
- [Before](before.png) and [after](after.png) captures show the typeset fixture above the
  preview. These exercise extraction and span rendering, not a full trusted native-thumb
  drag, ChatGPT's virtualizer, or its production renderer.

## Problem 2: diagnosis only

### Position and hit target

`rail/rail.js:461` creates a fixed, zero-sized host at the viewport's upper-right corner,
with z-index 20. Its shadow `.rail` is 52 px wide (`rail.js:49`, `rail.js:467`). The
ResizeObserver follows the visible ChatGPT `.thread-scroll-container`, computing the right
content edge by subtracting `offsetWidth - clientWidth` (`rail.js:199`, `rail.js:217`).
The transform places the rail's right edge 4 px inside that content edge (`rail.js:849`).
It follows the scroller, including a sidebar or right panel, rather than the text column.
There is no math-column or wide-window test. The rail appears when the scroller's width is
at least 560 px and there are at least two question/earlier controls (`rail.js:800`).

With a classic right scrollbar, the measured gutter is already subtracted, leaving the
rail inside the content area with an additional 4 px gap. Adding the measured scrollbar
width again would double that offset. With an overlay scrollbar the difference is zero;
only 4 px separates the rail from the scroller's edge, so a wider native thumb overlaps it.
The overlap exists only across the rail's vertically centered height, above the composer
and below the header (`rail.js:840`). Narrowing the scroller below 560 px hides the rail;
at 560 px it can still overlap. RTL/left scrollbars and transformed/stale geometry need
separate platform checks; they were not reproduced here.

When on, the entire rail has `pointer-events: auto` (`rail.js:470`). Its invisible pill
still accepts hits: opacity zero does not disable hit testing (`rail.js:471`). Buttons
span the full inner rail width (`rail.js:475`). The capture target seen outside the shadow
root is `chatgpt-butter-nav`; inside it is `.pill`, `.tick`, `.bar`, or `.rail`, depending
on coordinates. Clicks bubble to the rail and invoke question navigation by vertical
position (`rail.js:590`). The tooltip and warp already have pointer events disabled
(`rail.js:487`, `rail.js:505`). There is no pointer capture to blame.

The seek preview cannot recover these presses: it requires the event target itself to be
the scroller (`seek/preview-main.js:546`, `seek/preview-main.js:553`). Its separate 16 px
overlay preview strip (`seek/core-main.js:7`, `seek/core-main.js:57`) protects the thumb
from the preview layer, not from the higher-z-index history rail.

### Browser evidence

The actual unmodified `rail.js` was evaluated with synthetic question events and one turn
in a real scroll container. At a 1280 px viewport:

| Scroller | offsetWidth | clientWidth | Rail left/right | Result |
| --- | ---: | ---: | --- | --- |
| Overlay | 1280 | 1280 | 1224 / 1276 | Hits 6 and 10 px from right reach `.pill`; 14 px reaches `.tick`. |
| Reserved gutter (`scrollbar-gutter: stable`) | 1280 | 1265 | 1209 / 1261 | Hits 6, 10, 14 and 18 px from right do not reach rail. |
| Narrow | 559 | 559 | Hidden | Edge hits do not reach rail. |
| Minimum visible width | 560 | 560 | 504 / 556 | Same overlay hit interception as at 1280 px. |

These are geometry and DOM hit tests. The stable-gutter case verifies existing subtraction;
it is not a headed classic-scrollbar drag test. Native overlay thumb appearance and width
vary by OS; a macOS drag was not tested.

### Options

1. **Reserve overlay space in rail positioning (recommended).** Keep the existing classic
   gutter handling; when the gutter is zero, reserve an overlay strip consistent with
   seek's 16 px strip. Align the card with the adjusted rail. This retains generous question
   hit targets and hover behavior. The rail shifts left on overlay systems, so this changes
   the look and needs an approved mockup before implementation. A measured-width-only fix
   is insufficient because overlay width is not exposed by `offsetWidth - clientWidth`.
2. **Pass through outside explicit question hit areas.** Disable pointer events on the rail
   background/pill and enable them only on bounded buttons, excluding the native edge
   strip. Ordinary pass-through alone is insufficient: existing full-width buttons still
   overlap some of that strip. Idle pixels could remain unchanged, but hover activation,
   clickable area and keyboard focus behavior need care; the interaction change also needs
   a mockup approval under the repo's rule.
3. **Move the rail beside the answer column or to the left.** Avoid the native right edge
   altogether. This is a larger visible change, can compete with sidebar/content space,
   and needs responsive/RTL handling and an approved mockup.

No option was implemented.

## Commands and actual results

Inspection used `pwd`, `git status --short`, `git rev-parse HEAD`, `cat`, `sed`, `rg`,
`nl -ba`, `git log -4 --oneline`, and `ls`. The initial worktree was clean at `5276618`.
There is no glossary/ADR file in this checkout. Local `lab/harness/node_modules` is absent;
the T3 browser was available, so no dependency installation or lab-browser restart was needed.

Regression baseline command (archived source, with only the new test copied in):

```sh
baseline_dir=$(mktemp -d /tmp/butter-preview-baseline.XXXXXX)
git archive 5276618 extension test | tar -x -C "$baseline_dir"
cp test/height-cache-dom.test.js "$baseline_dir/test/height-cache-dom.test.js"
node --test --test-name-pattern='HTML-only display math' "$baseline_dir/test/height-cache-dom.test.js"
```

Exit 1: 1 test, 0 pass, 1 fail, `the boxed formula must not disappear`, actual empty
string. Full actual output: [red.txt](red.txt).

```text
$ node --test --test-name-pattern='HTML-only display math' test/height-cache-dom.test.js
✔ HTML-only display math keeps nested TeX sources instead of recording an empty block
ℹ tests 1
ℹ pass 1
ℹ fail 0

$ npx prettier --write extension/seek/layout-cache-main.js test/height-cache-dom.test.js
extension/seek/layout-cache-main.js 176ms (unchanged)
test/height-cache-dom.test.js 110ms (unchanged)

$ node --test
ℹ tests 214
ℹ suites 0
ℹ pass 214
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 745.72614

$ npm run format:check
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

$ git diff --check
(no output; exit 0)
```

Full suite and formatter output: [test.txt](test.txt), [format.txt](format.txt).

Additional checks:

```text
$ python3 scripts/check-version.py
OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.

$ python3 -m unittest discover -s scripts -p 'test_*.py'
........
----------------------------------------------------------------------
Ran 8 tests in 0.724s

OK
```
