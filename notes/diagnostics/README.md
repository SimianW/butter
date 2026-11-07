# Capture a failing seek preview

Use [capture-preview-record.js](capture-preview-record.js) on the affected ChatGPT tab
**before reloading, clearing saved layouts, or changing Butter settings**. It copies one
JSON object with lengths, geometry and structure, without question/answer text, TeX,
conversation/message IDs, URLs or account identifiers. Share only that clipboard JSON,
not a full console export or screenshot.

1. Open Chrome DevTools on that tab (macOS: Command–Option–J). Select **Console**.
   In the JavaScript context dropdown near the top of Console, choose **top**, the
   ChatGPT page. This is the default. If it currently says Butter or another extension,
   click it and select **top** under the ChatGPT tab. Do not select the extension's
   isolated context: `__butterLayoutCache` and `__seekDump` live in the page's MAIN world.
2. Paste the entire JavaScript file and press Enter. When no preview is active it says
   “Butter capture armed”. Within two minutes, drag the scrollbar thumb until the bad
   box appears, then **keep holding the thumb still for at least one second**. Capture
   happens while the preview is active, before release can remount/re-record the answer.
   If the bad preview is already active, the snippet captures immediately.
3. Wait for “Butter diagnostic JSON copied” (storage can take up to ten seconds),
   then paste the clipboard into a local file or your reply. This uses Chrome Console's
   `copy(...)`, not the webpage clipboard API. No network request or ChatGPT send occurs.
   A capture arms once; paste the snippet again for another attempt.

To choose an answer explicitly, change `const TURN_INDEX = null;` near the top to its
zero-based question index: for example, `const TURN_INDEX = 2;` selects rail question 3.
That captures immediately, even without an active preview. This index follows the whole
virtualizer's turn order, not just the answers currently mounted in the DOM. Automatic
selection uses the latest active seek update's turn; if a viewport straddles two answers,
use an explicit index for the answer with the bad box. If ChatGPT changes its private
virtualizer shape, the snippet reports an error rather than guessing the turn.

The JSON includes:

- `memory`: Butter's current public cache record, copied before DOM measurement or
  asynchronous storage reads. Item kinds are inferred because Butter stores no kind
  field. It includes numeric math offsets/heights, source-block indexes, item positions,
  heights and text lengths. `flags` marks heights over 300 CSS pixels and zero lengths.
- `source`: `measured` for warm measurements, `restored` for `fromStorage` entries,
  and `persisted` for saved wire records. “Restored” means hydrated from storage; the
  recorder does not expose whether its private remount-restoration WeakSet contains a
  particular element. The DOM's `contentVisibility` records the live computed state.
- `persisted`: all saved layout variants for this turn returned by Butter's extension
  bridge. No hashes or serialized styles are included. Stored geometry has **no text**,
  so its `textLength` is `null`, with `textLengthUnavailable: true`, rather than zero.
  `disabled`, `not-found`, timeout and unavailable-account statuses distinguish missing
  evidence from an empty record. Storage must already be enabled; do not enable it just
  for this capture. The normal load API performs expiry/validation maintenance and
  updates storage access times; this is not an unfiltered forensic disk export.
- `dom`: the mounted turn's complete element tree, with parent indexes, tags, class
  names, data-attribute **names only**, rect heights/relative tops and computed
  `content-visibility`. It includes user-bubble structure to align recorder item indexes;
  no user-bubble text is read. An unmounted answer reports `mounted: false`.
- `preview`: the latest seek geometry and rendered preview item lengths/heights. These
  rendered nodes may include neighboring answers and expose no turn/item identity.
  `estimateVisible` identifies the estimate/excerpt surface. Cache items themselves have
  `estimate: false` and `fallback: false`; a turn fallback is a separate preview model
  entry, not a cache item. Unexposed flags are `null`, never guessed.

The snippet does not call `prepare()`, flush measurements, clear storage or hydrate saved
layouts. The cache getter still applies Butter's normal validity checks and may return
`null` for an invalid restored record. DOM rect reads can force layout of skipped blocks,
so the snippet saves memory and computed visibility first; these DOM sizes are a fresh
observation, not proof of what the recorder saw earlier. The frozen private seek model
is not exposed; `memory` is the current cache entry, accompanied by rendered geometry.

## A viewed answer still says unseen

Use [capture-record-readiness.js](capture-record-readiness.js) **while not seeking**, before
reloading or changing settings. In DevTools Console choose **top** (steps above), paste the
whole file and press Enter. It prints a table for every virtualizer turn and copies a
privacy-safe JSON object with counts, geometry and fixed reason codes. Share only that JSON.
It never reads question/answer text into the output, sends requests, flushes measurements or
calls `prepare()`. Rect reads can force fresh layout, so record/recorder state is saved first.

Each row includes `hasRecord`, item/block counts, `rowH`, ChatGPT's `measuredHeight`, the mounted
row's current height, recorded/current `sw`, `fromStorage`, and the exact `buildModel` `layout`
boolean. `layoutReason` distinguishes absent records, missing items, width mismatches, missing
virtualizer measurements and height mismatches. The model uses empty texts because text cannot
affect this boolean. `recordValidation` reruns `validateSnapshot` on the accepted record's
geometry, with completion/math readiness assumed; it cannot reconstruct a rejected snapshot.

Builds with the recorder diagnostics hook (`__butterLayoutCache.diagnostics`) add
per-mounted-turn recorder status: `observed`, `generating`, `queued`, `measuring`, `attempted`
and `lastRejection`. The last field is the reason returned by the latest failed
`validateSnapshot` attempt (for example `placeholder`, `math-pending`, `zero-block` or
`math-height`), cleared after a successful record. If the turn has never had a completed attempt,
`attempted` is false and `lastRejection` is null. An attempt interrupted by a mutation or skip
does not replace the previous outcome. Unmounted turns have no recorder status. Builds without
the hook report `rejectionDiagnosticsAvailable: false` and `recorder: null`; they can still
report geometry and the resulting layout decision.

On the affected Mac, let scrolling stop briefly, run once, scroll through the whole answer,
wait about a second, and run again. Then hold the scrollbar to check the notice. If it persists,
use the original drag capture too: the readiness report describes the current cache, while the
seek model is frozen when the scrollbar is pressed.

## Readiness says `math-pending`

Use [capture-math-pending.js](capture-math-pending.js) in DevTools Console (context **top**,
steps above). For each mounted turn it counts `[data-math-source]` formulas without a `.katex`
render, what they hold instead, and how many sit inside a content-visibility block. It prints
and copies counts only: no text, TeX, IDs or URLs.

Zero formulas without `.katex` means page-level math readiness is not the cause. This snippet
reads only the DOM and needs no Butter hook.
