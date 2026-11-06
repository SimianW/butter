# Dil table and widget preview repair

Baseline: `4780e17`, branch `t3/fix-scrollbar-preview-stuck`. The sanitized supplied
[capture](user-capture.json) was copied byte-for-byte. No account identifiers, chat text or
screenshots were added. The separate synthetic browser makes no ChatGPT requests. No delegation,
version bump, push or PR; the existing port 8781 server was left alone.

## Findings and evidence limits

Memory item 16 is the table: left 0, width 766, height 110.5, text length 128. Ordinary answer
blocks use left 63 and width 640. DOM node 235 is a `div.TableFrame-YxtDrz` with
`data-d-column-sizing` and `data-d-component`, directly under response root 43. It lacks
`data-wide-block`. Its subtree is viewport 236, table 237, tbody 238, tr rows, th/td cells,
and **paragraphs inside the cells**. Edge decoration 257 is a sibling of the viewport.
The sanitized capture contains three rows and two cells per row; the screenshot shows four
rows and three columns. The fixture uses the captured nesting with invented four-row,
three-column content to cover the requested screenshot shape too.

At baseline, `extension/seek/layout-cache-main.js:847` measures the selected outer element;
`:876` and `:877` copy its left relative to the scroller and its full width. This faithfully
copies the wide frame's scroller-sized box, with no answer-column clamp. The capture does not
include CSS declarations, so it cannot identify the particular site CSS rule that widens it.
`core-main.js:14` excludes only `data-wide-block` and hr from intrinsic blocks, while `:15`
includes **all** direct answer children in preview items. Thus classic wide tables are still
previewed as text, despite being excluded from intrinsic block sizes; Dil frames miss that
exclusion entirely. Classic tables were not skipped by the preview.

At baseline, `layout-cache-main.js:567`, `:599` and `:604` treat every paragraph/div as a new
line. The two-space cell separator at `:603` cannot undo the line breaks introduced by each
cell's paragraph. `preview-main.js:436` copies the geometry unchanged and `:270` draws it with
`white-space: pre-wrap`, a fixed recorded height, and `overflow: hidden`. Cells become many
lines and later cells are clipped; nothing has to be missing from the cached text for the
preview to show only the first few labels. The same div/paragraph rule stacks grid cell values.

All five captured widget roots (45, 105, 153, 195, 259) are 186 px tall, but their DOM is
`data-client-defined-widget > CodeBlock-zu1QM3 > Root-iW7ipz CodeSurface-UAMd1A Surface-BCuIs1`.
They contain a flex action bar, a **single-child overlay grid**, `col-start-1 row-start-1`,
`InlineCodePane-EYx4bd`, and CodeMirror `cm-content > cm-line > span` tokens. Those spans
already remain on one line; the captured grid is not a four-number card. The screenshot's
card DOM is absent. Accordingly, tests preserve this captured code-widget shape and separately
use explicitly synthetic grid/flex cards to reproduce the reported number-stacking behavior.
Real Mac confirmation of that particular card remains for the supplied test package.

## Change

- `extension/seek/core-main.js:14` excludes Dil `TableFrame-` blocks from intrinsic sizing,
  matching classic wide tables. Preview item selection at `:16` stays inclusive. The isolated
  offscreen selector, containment CSS and settings probe carry the same exclusion. Wide tables
  remain visible outside block containment, including during streaming.
- `extension/seek/layout-cache-main.js:631`–`:638` walks table cells inline and keeps the
  existing two-space cell separators and row newlines. Resulting text matches classic tables
  and the source table parser, so persisted source matching/hydration works too.
- `layout-cache-main.js:600`–`:629` recognizes widget grid/flex rows from computed display and
  child vertical overlap, flattens each row's cells inline, and separates rows with newlines.
  Vertical card wrappers recurse normally; single-child code-editor grids retain code lines.
  No card UI, borders or grid styling is introduced into the preview.
- `layout-cache-main.js:879`, `:885`, `:889` and `:915` refresh visual row text when a visible
  widget is measured and clamp recorded horizontal geometry against the markdown column.
  Skipped widgets never read descendant layout: they can reuse measured rows only when the
  outer box agrees. Otherwise the snapshot is rejected without replacing the good record.
- `extension/seek/core-main.js:20` shares the column clamp between recording and
  `extension/seek/preview-main.js:436`, including a defensive clamp for incoming preview items.
  A narrow item's inset is retained when it fits, including right-aligned question bubbles.
- `extension/seek/layout-codec.js:104` and `:129` advance the wire schema to 4. Schema 3 can
  persist bad bounds and the wrong intrinsic block list, so it is rejected rather than repaired.
  Existing worker validation rejects old-tab writes and prunes old rows on load. All obsolete
  schema records, including otherwise good classic entries, are remeasured. Protocol 1,
  IndexedDB version, numeric array fields and the internal hydrated schema are unchanged.

The regression harness is [dil-tables-widgets.mjs](../../../lab/harness/dil-tables-widgets.mjs).
It drives the real recorder and actual preview render function with real preview item CSS.
It covers classic/Dil parity, every table cell, clipped-height visibility, source hydration,
captured code widgets, horizontal grid/flex rows, nested column wrappers, row refresh on resize,
safe skipped-widget reuse/rejection, drawing clamps and wide-table containment. New unit checks
cover column clamping and schema-3 rejection/pruning. Two existing DOM doubles gained the DOM
methods the recorder now uses; no assertions were weakened.

## Commands and actual outputs

Read-only inspection used `cat`, `sed`, `rg`, `git status --short`, `git log -3 --oneline`,
`git diff`, and Python JSON traversal of the capture. Initial status was clean; HEAD was
`4780e17 fix: record real Dil response blocks and display math geometry`.

Before production edits, on exactly `4780e17`:

```text
$ node lab/harness/dil-tables-widgets.mjs
exit 1
FAIL Dil: wide table excluded from intrinsic block sizes: ... 6 !== 5
FAIL Dil: every item stays in the answer column: left 0
FAIL Dil: all table cells survive as four text rows
FAIL Dil: grid cells keep two horizontal rows
  actual: Input values\n3\n0\n9\n0\n6\n0\n12\n0\nEnd of card
FAIL Dil: flex cells keep one horizontal row
FAIL Dil: preview clamps a wide incoming record: left 0
PASS classic: all table cells survive as four text rows
FAIL classic: every item stays in the answer column: left 0
FAIL Dil and classic tables have identical preview text and geometry

$ node --test --test-name-pattern='old full-scroller' test/layout-storage.test.js
tests 1
pass 0
fail 1
AssertionError: true !== false
```

Full actual failure logs: [browser](red-fixture.txt), [storage](red-storage.txt). Production
code was still baseline for both; these were not forced failures. The harness was subsequently
extended with resize, clipping, stored hydration and skipped-grid checks.
Trailing spaces on two blank lines of the Node assertion output were stripped for the staged
diff check; an initial `git diff --cached --check` caught those spaces before the commit ran.

An intermediate `node --test` found 217 passes and 2 failures, both missing DOM-double methods
(`hasAttribute`, `getBoundingClientRect`); those doubles were corrected. Development harness
runs also caught a separator before an empty action-bar cell, and test setup that falsely
marked a non-contained widget skipped; those were corrected before final validation.

Formatting commands:

```text
$ npx prettier --write <changed extension and test files>
exit 0; changed files formatted or reported unchanged
$ npx prettier --write --ignore-path /dev/null lab/harness/dil-tables-widgets.mjs
lab/harness/dil-tables-widgets.mjs 78ms
```

Final checks (all exit 0; full logs linked):

```text
$ node --test
tests 220
suites 0
pass 220
fail 0
cancelled 0
skipped 0
todo 0

$ npm run format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

$ node lab/harness/dil-renderer.mjs
Dil: 20 block sizes, 23 items, math heights 38, 38, 38
anchors: 23 matching block indexes, zero geometry error
resize: display height refreshed to 62
preview: legacy mixed-prose display height clamped to 184px
containment: real blocks marked and skipped, wrapper left visible
streaming containment: real blocks skipped before marking, wide block left visible
direct: 20 block sizes, 23 items, math heights 38, 38, 38
anchors: 23 matching block indexes, zero geometry error
resize: display height refreshed to 62
preview: legacy mixed-prose display height clamped to 184px
containment: real blocks marked and skipped, wrapper left visible
streaming containment: real blocks skipped before marking, wide block left visible

$ node lab/harness/dil-tables-widgets.mjs
32 PASS lines; no FAIL lines or browser errors

$ python3 scripts/check-version.py
OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.

$ git diff --check
(no output)
$ cmp <supplied sanitized attachment> notes/runs/2026-11-05-dil-tables-widgets/user-capture.json
(no output; identical)
$ rg -n '\[DEBUG-' extension/seek/layout-cache-main.js
(no matches)
```

Logs: [unit suite](node-test.txt), [Prettier](format.txt), [existing renderer](dil-renderer.txt),
[new fixture](fixture.txt).

```text
$ python3 scripts/package.py --test unseen-notice
/home/simon/.t3/worktrees/butter/t3-8302ad9c/dist/butter-0.1.0-alpha.13+unseen-notice.6.zip
Note: Chrome version remains 0.1.0.13; remove the previous install before loading this test build.
```

[Package command output](package.txt). A Python `zipfile` check also verified the archive exists,
its manifest has `0.1.0-alpha.13+unseen-notice.6` / `0.1.0.13`, and all 33 non-manifest files
match the working extension byte-for-byte. The zip contains 34 files and is 149358 bytes.
Source manifest fields remain unchanged.
