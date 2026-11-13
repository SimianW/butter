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

Lab validation and commands: [run report](../runs/2026-11-05-preview-record-capture/report.md).

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

## Readiness says layout true, but pressing still shows unseen

This needs a build with the press-decision hook (`__seekDump.pressDecision`). Use
[capture-press-decision.js](capture-press-decision.js). Open the affected chat, scroll through
the answer, **press and drag the scrollbar slightly, then release it once**. In DevTools
Console choose **top**, paste the entire file and press Enter. It prints and copies one JSON
object. Share only that JSON, ideally with the readiness capture taken just before pressing.
Do not reload or clear layouts between these captures.

This reads the read-only `__seekDump.pressDecision` property, which returns a detached copy
of the last qualifying press's summary. It does not invoke `__seekDump()`, measure the DOM,
read current cache records, flush, hydrate, access storage or send requests. The summary
survives release and harmless clicks (including opening DevTools), until another qualifying
scrollbar press or a page reload. A `render: null` means the candidate never rendered a preview;
drag slightly while holding the thumb to trigger it.

The summary includes only counts, booleans, numeric geometry and fixed reason codes:

- `fiberFound`, `idsFromFallback` and `idsReason` distinguish virtualizer turn order from
  the `ids-from-fallback` conversation-message order. No actual keys or IDs are included.
- `scroller.matchesThreadScroller` compares the pressed element with the first visible
  `.thread-scroll-container`, exactly the one readiness chooses. `threadScrollerCount`,
  `threadScrollerSw`, `swBefore` and `sw` distinguish multiple scrollers and width changes
  during prepare. These are full scroller widths; the narrower preview host is separate.
- `turns` follows the frozen model's zero-based turn order. `layoutReason` is null for a
  trusted layout, otherwise `no-record`, `no-items`, `sw-mismatch`, `no-measured`,
  `height-mismatch` or `conv-mismatch`. `recordSw`, the scroller's `sw`, `rowH` and
  `measuredHeight` show the inputs. `mounted` and `rowHeightAtPrepare` reuse the row rects the
  press already reads. `modelTop` and `modelHeight` show the frozen row geometry.
- Each turn's `cache.before` and `cache.after` are scalar summaries saved around the
  synchronous measurement flush and storage adoption. `recordChanged` flags replacement;
  `convMatches` detects conversation filtering without exposing its identity;
  `storedAvailable`, `fromStorage` and `retiredStored` distinguish stored-record adoption or
  retirement. A retired invalid stored record has `layoutReason: no-record`.
- `render` records the actual `previewQuestion` selection: `turnIndex`, `modelLength`,
  `layout`, `unseen`, scroll `top`, `insetTop` and `previewTop`. Its `prepareSequence` identifies
  the model being rendered. A separate `releasePrepare` appears only if release retargeting
  prepares another model; it does not replace the original press/render evidence.

No text, TeX, styles, selectors from chat content, IDs, URLs, account identifiers or React props
are stored in this summary. The capture is a past decision, so geometry can differ from the
live page after release. An unavailable-build or no-prepared-press error produces no JSON.

## Readiness says `math-pending`

Use [capture-math-pending.js](capture-math-pending.js) in DevTools Console (context **top**,
steps above). For each mounted turn it counts `[data-math-source]` formulas without a `.katex`
render, what they hold instead, and how many sit inside a content-visibility block. It prints
and copies counts only: no text, TeX, IDs or URLs.

Zero formulas without `.katex` means page-level math readiness is not the cause. This snippet
reads only the DOM and needs no Butter hook. Up to
`0.1.0-alpha.13+unseen-notice.8`, the recorder also reported `math-pending` for a long answer
whose skipped display-math blocks had no geometry measured while on screen; any DOM change in
the turn discarded what had been measured. From `+unseen-notice.9` such blocks keep their real
box and get a flagged formula estimate instead (cache items carry `approx: true`); see the
[run report](../runs/2026-11-06-math-pending-long-answer/report.md).

## Bug files from the dev build

The dev build saves everything the four snippets above report, plus the last 30 s of seek, press
and preview decisions and of rail jumps, as one JSON file per bug. A tester never needs to paste a snippet into a dev
build. The snippets stay for store builds.

### Build and install

1. `python3 scripts/package.py --dev` builds `dist/butter-<version_name>+dev.<N>.zip`. The source
   manifest is not changed; the store and `--test` zips never contain `extension/dev/`.
2. Unzip it. In `chrome://extensions`, turn on Developer mode, remove any other Butter install, and
   choose **Load unpacked** on the unzipped `butter/` folder.
3. On Windows and Linux, set the shortcut in `chrome://extensions/shortcuts`: Alt+Shift+B is
   Chrome's own "focus bookmarks bar" key there, so Chrome does not assign it. On a Mac,
   Option+Shift+B is suggested.
4. On a ChatGPT chat, press the shortcut, even while holding the scrollbar thumb. Each press
   saves `Downloads/butter-diag/round-<N>/bug-<NN>_<HH-MM-SS>.json` (local time), with no prompt.

### File format

The file is JSON with two-space indentation. Every list of objects (events, readiness rows,
structure nodes, cache items) has one object per line.

| Field           | What                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`          | Always `"butter-diag"`.                                                                                                                                                                  |
| `formatVersion` | `1`. It stands in for the snippets' `schema: 1`.                                                                                                                                         |
| `bug`, `round`  | The bug number in this round, and the round. They match the file path.                                                                                                                   |
| `savedAt`       | The save time, ISO 8601 in UTC. Event times are relative to it.                                                                                                                          |
| `version`       | The manifest's `version_name`, for example `0.1.0-alpha.15+dev.10`.                                                                                                                      |
| `trigger`       | `shortcut` or `button`.                                                                                                                                                                  |
| `pointerHeld`   | Whether the left button was down when the snapshot was taken (a drag in progress).                                                                                                       |
| `settings`      | Butter's normalized settings (`shared/status.js`).                                                                                                                                       |
| `events`        | The last 30 s of events, oldest first (see below).                                                                                                                                       |
| `eventsDropped` | Only present when the whole-file cap dropped the oldest events: how many.                                                                                                                |
| `pressDecision` | `__seekDump.pressDecision`: the last qualifying press's summary (capture-press-decision.js). `{ "unavailable": "conversation-changed" }` when that press was in an earlier conversation. |
| `turns`         | `order`, `active`, `readiness`, `math` (see below).                                                                                                                                      |
| `rail`          | `order`, `state`, `ticks`: the rail's questions against ChatGPT's turn order, what is lit and pinned, and every tick's style and box (see below).                                        |
| `failures`      | `chrome.storage.session.butterFailures`, the popup's session failures.                                                                                                                   |
| `usage`         | `saved`, `store`, `cache` (see below).                                                                                                                                                   |
| `redacted`      | How many values the privacy filter dropped.                                                                                                                                              |

A part that could not be read is `{ "unavailable": <reason> }`, and the rest of the file still
saves. The reasons are `missing` (no such source in this build; for `rail`, no rail trace
answered or the rail has not started), `error` (it threw), `redacted` (nothing allowed was left),
`no-scroller` (no visible conversation scroller), `too-large` (cut
by the whole-file cap) and `conversation-changed` (`pressDecision` only: the press was in an
earlier conversation, see below).

**Events.** Every event has `t`, in ms before the save (negative, rounded), and a `type`.
Numbers are CSS pixels or ms; `turn` is the zero-based turn index in the virtualizer's order.

| `type`              | Emitted when                                                                                                       | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `press`             | A pointer press lands on the conversation scroller.                                                                | `kind` (`classic`, `overlay`, or null when it doesn't qualify), `reason` (the `classifyPress` rejection), `sequence` and `modelLength` (the press decision's), `layoutTurns`, `prepMs`, `scrollTop`                                                                                                                                                                                                                                                                                                                                                      |
| `activation-reject` | A qualifying press doesn't become a drag.                                                                          | `reason`: `wheel`, `key`, `not-held`, `selection`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `seek`              | Every seek update during a drag and its release.                                                                   | `top`, `turn`, `offset`, `layout`, `known`, `items`, `textFallback`, `renderMs`, `jsMs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `preview`           | The previewed question or the way it is shown changes.                                                             | `turn`, `mode` (`layout`, `estimate`, `text-fallback`, `unseen`), `layout`, `unseen`, `items` (rendered preview items), `estimate` (estimate surface shown), `textFallback`                                                                                                                                                                                                                                                                                                                                                                              |
| `preview-miss`      | Along with a `preview` whose mode isn't `layout`.                                                                  | `turn` (the turn the estimate or excerpt stands in for), `reason` (the mode), `layoutReason` (the press decision's reason for that turn)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `release`           | The drag ends, or a press ends without one.                                                                        | `reason` (`pointerup`, `wheel`, `blur`, `chat-switch` and the other `finish()` reasons), `commit`, `top`, `durationMs`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `commit`            | The destination is handed to ChatGPT.                                                                              | `turn`, `top`, `layout`, `retarget` (moved after an application adjustment)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `retarget`          | Landing corrects the scroll position.                                                                              | `kind` (`drift`, `semantic`, `question`, `history-block`), `to`, `error`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `reveal`            | The real page is shown again.                                                                                      | `durationMs` (after the release), `error` (landing error in px), `timedOut`, `matched`, `fallback` (semantic anchor)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `record`            | The layout cache records a turn.                                                                                   | `turn`, `items`, `blocks`, `refresh` (replaces a record), `approx` (has estimated formula boxes)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `rejection`         | The layout cache rejects a turn's snapshot.                                                                        | `turn`, `reason` (`core.validateSnapshot` reasons such as `math-pending`, `placeholder`, `zero-block`, and `estimated`)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `restore`           | Remount restore gives a turn its recorded sizes.                                                                   | `turn`, `blocks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `conversation`      | The page is on a different conversation than before, without a page load (ChatGPT switches chats in place).        | `conversation`: the new conversation's ordinal on this page. The one the page loaded on is 0, and each switch adds 1, also back to an earlier chat or to a new-chat page.                                                                                                                                                                                                                                                                                                                                                                                |
| `rail-jump`         | A rail click (or a bookmark row) starts a jump and it picks its path.                                              | `jump` (the jump's number on this page; every `rail-*` event of one jump has it), `target` and `activeBefore` (rail question indexes; -1 for none), `scrollTop`, `scrollHeight`, `clientHeight`, `mountedFrom` and `mountedTo` (the mounted turns' range in the rail's questions, as `measure` finds it), `mounted` (the target was), `earlier` (an earlier-history trip), `path` (`glide`, `trip`, `takeover` of a trip in flight, or `repeat`: a click on the tick whose trip is under way, ignored), `direction` (`up` or `down`)                     |
| `rail-try`          | Each mount try (at most 8): the jump scrolled to where it expects the unmounted target and waited up to 30 frames. | `jump`, `try` (1–8), `estimate` (the target's expected top, scroll px), `written` (`estimate - 64`, at least 0), `scrollTopRead` (read back right after the write: a clamped or refused write differs from `written`), `scrollHeight` (then), `frames` and `waitMs` (the wait), `scrollTopAfter`, `mountedFrom`, `mountedTo`, `mounted` (the target mounted), `live` (the jump was still current), and for the last mounted turn `lastBottom`, `lastWrapperBottom` (scroll px) and `lastWrapperInline` (its wrapper has the virtualizer's inline height) |
| `rail-wait`         | A readiness wait after the target mounted ends.                                                                    | `jump`, `wait` (`page`: ChatGPT's earlier page near the top; `math`: formulas typesetting; `quiet`: three frames under 40 ms; `steady`: the target's top still for 150 ms; `recheck`: `steady` again after both), `durationMs`, `live` (false: the jump stopped being current during the wait), and for `math`, `pending` (formulas still untypeset: it timed out)                                                                                                                                                                                       |
| `rail-cancel`       | Something stops a jump that has not ended. Cancels with no jump in progress (every wheel tick) are not recorded.   | `jump`, `cause`: the user's input (`wheel`, `touch`, `scrollbar`, `middle` for a middle-button press, `key`), or the rail's reason (`send`, `pre-jump`, `seek`: a scrollbar drag began, `conversation`: another chat opened, `off`: the rail was switched off, `other`)                                                                                                                                                                                                                                                                                  |
| `rail-end`          | The jump ends.                                                                                                     | `jump`, `outcome` (below), `path`, `cause` (the `rail-cancel` before it, if any), `elapsedMs`, `tries` (mount tries used), `expired` (its deadline, 12 s, or 60 s for an earlier trip, had passed), `scrollTop`, `targetTop` (the target's top below the scroller's top, 64 when landed; null while unmounted)                                                                                                                                                                                                                                           |

**Rail jump outcomes.** `landed`: the chat stopped on the target (also at the deadline, if the
target was mounted and aligned then: `expired: true`); with a `cause`, something stopped
it while it settled there (see the `rail-cancel` before it); after the user's input, `targetTop` is
no longer 64; `never-mounted`: the target did not mount in 8 tries;
`expired`: the deadline passed first; `cancelled`: see the `rail-cancel` before it, also when it
came while the chat was sliding in on the target, before it stopped there; `superseded`: another click started a jump (a
`takeover` if this one was a trip), likewise; `lost`: the target mounted,
then was unmounted before it could land; `unpinned`: the jump was no longer pinned;
`no-question`: its question left the rail; `error`: an exception ended it.

**Conversation changes.** The recorder asks the seek code which conversation it is on
(`__seekDump.conv`, the same URL check that ends a drag with `chat-switch`) before each event,
every 250 ms and at the save. It keeps the answer only to compare it, and the file holds only the
ordinal. A `conversation` event comes before every event from the new conversation, so the events
after the last `conversation` event are from the conversation the file was saved in; with no
`conversation` event, all of them are. A `release` with `chat-switch` follows the
`conversation` event it was caused by. After a switch, `turns.active` drops the earlier
conversation's seek (it reads `selection: "none"` until the next seek), and `pressDecision` is
`{ "unavailable": "conversation-changed" }` until the next press. It is dropped rather than marked,
because its turn indexes and counts describe another chat's turns.

**`turns.order`**: `count` (turns in the order), `mounted`, `fiberFound`, `idsFromFallback` and
`idsReason`. Without ChatGPT's virtualizer, the order is the mounted turns in DOM order, with
`idsReason: "ids-from-dom"`.

**`turns.active`**: the turn the seek last showed in this conversation. It has `turnIndex` and
`selection` (`active-preview-update` during a drag, `last-seek-update` after one, `none` before any
seek in this conversation, with nothing else), plus `preview`, `memory` and `dom`.

**`turns.readiness`**: `rejectionDiagnosticsAvailable`, `currentSw` and `turns`, one row for every
turn in the order.

**`turns.math`**: one row per mounted turn.

**`rail`**: read from the rail in the isolated world (`dev/rail-trace.js`), after `turns`.

- `order`: `questions` (the rail's questions), `count` and `fiberFound` (ChatGPT's turn order, as
  `turns.order`), `missing` (the indexes of rail questions that order lacks). The questions' ids
  are compared inside the page and never stored.
- `state`: `questions`, `active` (the active tick's index, -1 for none), `lit` (the lit ticks'
  indexes), `busy` (the jump's busy tick, or null), `pinned`, `flying` (a jump travels) and
  `hasPrev` (earlier history is not loaded yet).
- `ticks`: `shown` (the rail is on screen), `pitch` (the tick pitch, px), `devicePixelRatio`,
  `viewportScale` (`visualViewport.scale`), and `bars`, one row per tick: `index`, the style the
  rail model set (`scaleX`, `scaleY`, `opacity`), the bar's measured box (`top`, `height`, `width`,
  unrounded) and its tick's (`tickTop`, `tickHeight`). A bar thinner than the others at a
  fractional `devicePixelRatio` shows as a different `height` with the same `scaleY`.

**`usage`**:

- `saved` is the popup's layout usage across accounts (`conversations`, `bytes`), from the worker's
  own `butter-layout-usage` handler.
- `store` is this tab's layout store counters (`__butterLayoutCache.dump()`): `ready`, `loads`,
  `hits`, `writes`, `bytes`, `errors`, `entries`, `pending` and `rejected`.
- `cache` is the height cache's counters (`__heightCacheDump().stats`): `observed`, `records`,
  `refreshes`, `restored`, `blocksRestored`, `recordMs`, `recordMax`, `hooks`, `parked`,
  `released`, `adopted`, `approx`, `rejected` and `restoreMisses`.
- Every reason map is a list of `{ reason, count }`, because a key must be a known name.

### Where the snippets' fields went

capture-preview-record.js:

| Snippet field                                                                    | In the bug file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`                                                                         | `formatVersion`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `turnIndex`                                                                      | `turns.active.turnIndex`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `selection`                                                                      | `turns.active.selection`. `explicit-index` has no counterpart: a shortcut can't take an index.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `preview.active`, `updateTurnIndex`, `offset`, `layout`, `known`, `textFallback` | `turns.active.preview`, from the last `seek` event (the same values as `__seekDump`'s last update)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `preview.estimateVisible`                                                        | `turns.active.preview.estimateVisible`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `preview.renderedItems[]`                                                        | `turns.active.preview.renderedItems[]`. Only the preview's own classes (`it`, `math`, `display`) are kept, and `height` is rounded to 0.01 px.                                                                                                                                                                                                                                                                                                                                                                      |
| `memory.*`                                                                       | `turns.active.memory.*`, same names. `recordedAt` is in ms before the save on the events' clock, or null for a stored record (the snippet gives the raw `performance.now()` time).                                                                                                                                                                                                                                                                                                                                  |
| `dom.mounted`, `dom.itemCount`                                                   | `turns.active.dom.mounted`, `turns.active.dom.itemCount`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `dom.turn[]`                                                                     | `turns.active.dom.turn[]`. `index`, `parent` and `contentVisibility` are the same. `tag` is `other` outside the HTML, SVG and MathML tags `dev/allowlist.js` lists. `classes` and `dataAttributeNames` keep only the names it lists, with `classCount` for the total (a hashed `AdaptiveStreaming-…` class reads `adaptive-streaming`). `height` and `top` are rounded to 0.01 px. A `.katex` element is one node with `collapsed` (its descendant count). The tree stops at 1,000 nodes, marked `truncated: true`. |
| `persisted`                                                                      | Left out. Reading saved variants is an asynchronous storage load through the page bridge, up to 10 s, and the load updates expiry and access times. A snapshot is taken synchronously while the thumb may be held. `memory.source: "restored"` and the readiness rows' `fromStorage` show whether stored geometry is in use. Paste the snippet when the saved variants themselves matter.                                                                                                                           |

capture-record-readiness.js:

| Snippet field                   | In the bug file                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `schema`                        | `formatVersion`                                                                                                |
| `rejectionDiagnosticsAvailable` | `turns.readiness.rejectionDiagnosticsAvailable`                                                                |
| `turns[].currentSw`             | `turns.readiness.currentSw`, once (it is the same on every row)                                                |
| `turns[]`, every other field    | `turns.readiness.turns[]`, same names and the same `layoutReason` codes. `rowHeightNow` is rounded to 0.01 px. |

The snippet refuses to run during a hold. The bug file reads readiness during a hold too, because
the memory is copied first and the rows are only measured.

capture-press-decision.js: the whole `__seekDump.pressDecision` is `pressDecision`, unchanged, unless the
press was in an earlier conversation (`conversation-changed`).

capture-math-pending.js:

| Snippet field                                                        | In the bug file                                                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`                                                             | `formatVersion`                                                                                                                                                          |
| `turns[].index`                                                      | `turns.math[].index`. It is the turn's index in the virtualizer's order, where the snippet counts mounted turns. It is null for a mounted turn outside the order.        |
| `formulas`, `withoutKatex`, `missingInsideCvBlock`, `displayMissing` | Same names in `turns.math[]`                                                                                                                                             |
| `kinds`                                                              | Separate counts: `katexError`, `mathmlOnly`, `partsNoRoot` (`katex-parts-no-root`), `rawText`, `empty`, and `other` (the snippet's `other:<tags>`, without the tag list) |

### Privacy rules

- Keys must be on the allowlist in `extension/dev/allowlist.js` (`KEYS`), which
  `extension/dev/recorder.js` filters with.
- Values must be numbers, booleans, null, or strings from its closed list (`CODES`). That list holds
  event types, reason codes and the known tag, class and data-attribute names.
- Anything else is dropped, a key with its value, and counted in `redacted`. The filter applies to
  every event and every part of the snapshot.
- The sources in `extension/dev/sources.js` copy lengths, counts and geometry, never text, TeX,
  attribute values or IDs.
- The layout cache names a turn by its key inside the page. The dev listener turns the key into the
  turn's index before recording, and the key is never stored.
- A file never holds question or answer text, TeX, conversation or message IDs, URLs or account
  identifiers. `test/dev-sources.test.js` and the fixture run check this.

### Diagnostics rules

Like the snippets, the dev build never calls `prepare()` or flushes measurements, and it never
hydrates or clears storage. Butter's memory (cache records, recorder status, press decision and
counters) is copied before any DOM rect or style read. The cache getter may refresh the layout
fingerprint (one column read), exactly as the readiness snippet does. `usage.saved` goes through
the same worker handler as the popup, which prunes expired rows as a popup open does. Store code
has only passive hooks, each one null check while no dev listener is set:

- `seek/preview-main.js`: `__seekDump.tap`, and the getter `__seekDump.conv` (the current
  conversation, read by the recorder only to notice a switch);
- `seek/layout-cache-main.js`: `__butterLayoutCache.tap`;
- `rail/rail.js`: the rail trace hook `__butterRailTrace`, which `dev/rail-trace.js` defines in the
  isolated world. Its fields are built only when the hook exists, and a hook that throws is ignored.
  Its events reach the MAIN-world recorder as `butter-dev-rail` document events; the snapshot asks
  for the `rail` part with `butter-dev-rail-snapshot-request` and gets it back, synchronously, as
  `butter-dev-rail-snapshot-response`. In the dev build the trace reads layout at a jump's steps
  (the scroller's numbers, the mounted turns' boxes), which the jump mostly reads there anyway.

### Caps and cost

These are measured with `xvfb-run -a node lab/harness/dev-capture-qa.mjs` (Chromium
156.0.8078.4, a 140-turn fixture chat, dev build `0.1.0-alpha.15+dev.10`). The results are in
[the run report](../runs/2026-11-08-full-snapshot-44/report.md) and its `summary.json`.

|                   | Measured                                                                                                                                                                                                                                 | Cap                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Event size        | 146 bytes mean, 185 at most (seek events are the largest)                                                                                                                                                                                |                            |
| Event rate        | 7.4 a second in a busy 29 s session (wheel reading and 11 drags). Of these, 3.4 a second were not seeks.                                                                                                                                 |                            |
| Seek rate         | 3.9–6.7 a second under Xvfb, where the thumb drag scrolls at that rate even with 228 mouse moves and 60 frames a second. Scroll events come at most once a frame, so the bound is 120 a second at 120 Hz.                                |                            |
| Events            | about 3,700 in 30 s at 120 Hz                                                                                                                                                                                                            | `MAX_EVENTS` 4,000         |
| Event bytes       | 3,700 × 185 ≈ 690 KB                                                                                                                                                                                                                     | `MAX_BYTES` 750,000        |
| `pressDecision`   | 74 KB for 140 turns (about 530 bytes a turn)                                                                                                                                                                                             |                            |
| `turns.readiness` | 48 KB for 140 turns (about 340 bytes a turn)                                                                                                                                                                                             |                            |
| `turns.math`      | 20 KB for 120 mounted turns (about 165 bytes a turn; ChatGPT mounts only the turns near the viewport)                                                                                                                                    |                            |
| `turns.active`    | 6 KB; structure rows average 170 bytes, at most 1,000 rows ≈ 170 KB                                                                                                                                                                      | 1,000 nodes                |
| Whole file        | 184 KB for the busy session                                                                                                                                                                                                              | `MAX_FILE_BYTES` 1,400,000 |
| Snapshot          | 5.4 ms median, 7.4 ms at most to build and serialize in the page                                                                                                                                                                         |                            |
| Recording         | 2.5 µs per `record()` call. A seek update's script time was 0.8 ms median and 1.0 ms p95, both with and without the listener. The same scroll positions previewed the same turns the same way, and every release landed with 0 px error. |                            |

Over `MAX_FILE_BYTES`, the snapshot drops whole parts first, largest first, as
`{ "unavailable": "too-large" }`, until the rest fits without events. Then it drops the oldest
events, counted in `eventsDropped`. The worker downloads the file as a base64 `data:` URL. 1.4 MB
keeps that URL under Chrome's 2 MiB URL constant (`url::kMaxURLChars`): the largest file that
fits is 1,572,840 bytes. Chromium 156's `chrome.downloads` saved `data:` URLs of up to 256 MB in
the run, but other Chrome versions may enforce the constant.

The per-call cost comes from `node -e` over `extension/dev/recorder.js`: 200,000 `record('seek',
…)` calls on a full buffer (the command is in the run report). A real Mac's seek rate is checked
in #47's live run, from a saved file's event count over its window.
