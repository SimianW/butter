# Butter

Butter is a Chrome extension that keeps long ChatGPT chats fast and adds a question rail, a seek
preview, bookmarks and Ask in branch. These are the words its docs, code and tests use. `_Where_`
paths are relative to `extension/` unless they begin with `docs/`; [docs/how-it-works.md](docs/how-it-works.md)
describes the behaviour behind each term.

## Conversation

**Conversation**:
One ChatGPT chat, identified by its `/c/<id>`; its messages, bookmarks and layout records are kept
per conversation.
_Avoid_: chat thread, session
_Where_: `rail/rail.js`, `branch/logic.js`

**Message**:
One user or assistant record with its own id. A question is one kind of message; a turn holds
several.
_Where_: `rail/rail.js`, `bookmarks/model.js`

**Question**:
A visible user message, the unit the rail counts: one question, one tick.
_Avoid_: prompt
_Where_: `rail/rail.js`, `history/conversation-main.js`

**Turn**:
ChatGPT's on-page block of one question and its answer, keyed by the question's id (the turn key).
_Avoid_: message, row
_Where_: `rail/rail.js`

**Mounted**:
A turn that exists in the page now; ChatGPT keeps only about five mounted and unmounts the rest.
_Avoid_: loaded (that means fetched; see Earlier)
_Where_: `rail/rail.js`

**Hidden chat**:
A conversation opened earlier in the same tab that ChatGPT keeps as an invisible copy and can show
again without remounting.
_Where_: `rail/rail.js`

**Earlier**:
History ChatGPT has not fetched yet, loaded page by page as you scroll up or click the three dots;
also the bookmark group (`EARLIER`) shown beside those dots.
_Avoid_: older history, unloaded messages
_Where_: `history/conversation-main.js`, `bookmarks/model.js`

**Answer root**:
The element whose children are an answer's blocks: the markdown root, or the nested Dil response
root in ChatGPT's Dil renderer; the wrappers around it are not blocks.
_Where_: `seek/core-main.js`, `bookmarks/content.js`

**Paused**:
Butter's main switch off: every feature stops, though the fetch wrapper stays installed.
_Avoid_: disabled
_Where_: `popup/popup.js`

## Streaming

**Seen block**:
A turn or answer block that has rendered once and so may be skipped off-screen without its height
jumping.
_Where_: `stream/offscreen.js`

**Never-rendered block**:
A streamed block still skipped at the flush, so never drawn; it stays skipped until it comes into
view.
_Avoid_: unseen
_Where_: `stream/offscreen.js`

## History rail

**Rail**:
The column of ticks at the chat's right edge, one per question, drawn in Butter's own shadow root.
_Avoid_: minimap, scrollbar
_Where_: `rail/rail.js`, `docs/history-rail.md`

**Tick**:
One question's line on the rail; it lengthens for the question being read and swells in a wave
under the pointer.
_Avoid_: bar, mark
_Where_: `rail/rail.js`

**Three dots**:
The rail's control above the first tick that stands for earlier history; clicking it loads earlier
pages.
_Avoid_: ellipsis, load-more
_Where_: `rail/rail.js`

**Card**:
The panel a tick or the three dots shows on hover or focus: the question's meta line and text, plus
a row per bookmark when it holds any.
_Avoid_: tooltip, popover
_Where_: `rail/rail.js`

**Lit band**:
The reading region between the header and the composer; the questions showing in it get lit
ticks, excluding small tails behind the header or composer.
_Avoid_: viewport, visible range
_Where_: `rail/rail.js`

**Jump**:
Moving the chat to a question or bookmark from the rail; it plays as a glide or a trip.
_Avoid_: navigation, scroll-to
_Where_: `rail/rail.js`

**Glide**:
A jump to a nearby mounted question: a plain smooth scroll.
_Where_: `rail/rail.js`

**Trip**:
How a far jump looks: the chat speeds off, placeholder lines stream past on the compositor while
ChatGPT renders the target, and the chat slides in and stops on it.
_Avoid_: animation, flight
_Where_: `rail/rail.js`

**Journey**:
A far jump's bookkeeping behind the trip: its deadline and readiness, carried over when a new click
takes the trip over.
_Where_: `rail/rail.js`

**Pinned**:
The clicked question staying current and aligned after a jump until you scroll yourself.
_Avoid_: locked, sticky
_Where_: `rail/rail.js`

## Bookmarks

**Bookmark**:
A saved passage of an answer, stored as its anchor plus a short excerpt.
_Avoid_: highlight, note, favourite
_Where_: `bookmarks/model.js`

**Paragraph**:
A bookmark's unit of position (`para`): a top-level block of the answer, with each item of a
top-level list counted as its own paragraph.
_Avoid_: block (the seek preview's unit)
_Where_: `bookmarks/content.js`

**Anchor**:
Where a bookmark points: its message, paragraph and UTF-16 start and end within that paragraph. The
same anchor is the same bookmark.
_Where_: `bookmarks/model.js`

**Excerpt**:
The bookmarked text as stored: its first three rendered lines, at most 240 characters. Its first
line's length (`line`) is kept for matching.
_Avoid_: snippet, quote (Ask in branch's word)
_Where_: `bookmarks/model.js`

**Stale**:
A bookmark whose answer changed, so its paragraph no longer holds its first line; an unmounted
answer is not stale. Its dot and row show hollow and "answer changed".
_Avoid_: broken, orphaned, missing
_Where_: `bookmarks/model.js`

**Dot**:
The mark beside a tick (or the three dots) that holds bookmarks: one per question however many it
holds, hollow when all are stale.
_Avoid_: badge, indicator
_Where_: `rail/rail.js`

**Mark**:
A question's bookmarks as the rail receives them: the group behind one dot, with its stale flag and
its land, wash and remove actions.
_Avoid_: bookmark (one saved passage)
_Where_: `bookmarks/content.js`

**Fresh**:
A bookmark just made in this tab, or just moved from the three dots to its question's tick; its dot
grows in.
_Where_: `bookmarks/content.js`

**Wash**:
The butter-coloured highlight that sweeps over a bookmark's text after a jump lands on it, or one box
over a whole code block or table; it holds, then fades.
_Avoid_: flash (the question bubble's ring), highlight
_Where_: `bookmarks/content.js`, `bookmarks/wash.js`

## Seek preview

**Seek preview**:
The light text preview drawn in place of the real turns while you drag the native scrollbar thumb.
_Avoid_: scrub, fast scroll
_Where_: `seek/preview-main.js`

**Candidate**:
A press on the scrollbar thumb that may become a seek; it activates only once it actually scrolls
with the selection unchanged.
_Where_: `seek/preview-main.js`, `seek/core-main.js`

**Release**:
Letting go of the thumb: the last movement is coalesced, ChatGPT gets one destination scroll (the
commit), and the real chat is revealed once the target is ready.
_Where_: `seek/preview-main.js`

**Layout record**:
A turn's measured geometry, taken only from a complete, typeset, fully rendered snapshot; a
skipped, partial or still-streaming snapshot never replaces it.
_Avoid_: estimate, cache entry
_Where_: `seek/layout-cache-main.js`

**Warm**:
A layout record measured in this tab, as opposed to a stored one loaded from the extension's
database.
_Where_: `seek/layout-cache-main.js`

**Fingerprint**:
The width, font, theme and other facts a stored layout record must match before it is reused.
_Where_: `seek/layout-check-main.js`

**Generation**:
A durable counter bumped by each clear, so delayed writes from other tabs cannot repopulate cleared
data.
_Where_: `storage/layout-worker.js`

**Write epoch**:
A per-conversation counter that keeps stale responses and hashes from reviving a record after the
conversation changed.
_Where_: `seek/layout-cache-main.js`

## Selection and Ask in branch

**Pill**:
Butter's toolbar beside ChatGPT's own "Ask ChatGPT" button when you select answer text.
_Avoid_: toolbar, popover
_Where_: `selection/pill.js`

**Cell**:
One feature's button in the pill: Ask in branch or Bookmark.
_Where_: `selection/pill.js`

**Hold**:
A feature keeping the selection while its own UI has focus (Ask in branch's question box), with the
pill hidden.
_Where_: `selection/pill.js`

**Quote**:
The selected text Ask in branch carries, each formula it touches written as its whole LaTeX source.
_Avoid_: excerpt (a bookmark's word)
_Where_: `branch/logic.js`

**Branch**:
The new conversation ChatGPT's "Branch in new chat" makes; Butter counts it only once the tab shows
a different, rendered conversation.
_Avoid_: fork, copy
_Where_: `branch/run.js`

**Job**:
The one-use, 60-second handoff of quote, question and source conversation from the original tab to
the new tab that makes the branch.
_Avoid_: request, task
_Where_: `branch/worker.js`, `branch/content.js`

**Run**:
The new tab's work from loading to ready: making the branch, verifying it, then sending the quote and
question.
_Where_: `branch/run.js`

## Lab harness

These `_Where_` paths are relative to `lab/harness/`.

**Scenario**:
One named part of a fixture QA run, with its declared start; `ONLY=<name>` runs it alone as it runs
in a full run.
_Avoid_: section, case
_Where_: `bookmarks/scenarios/`, `branch/scenarios/`

**Runner**:
The code shared by the fixture QAs that selects scenarios, runs them, prints their counts and writes
`summary.json`.
_Where_: `runner/index.mjs`

**Butter driver**:
The shared code that drives Butter's pill and its cells and selects text in an answer as a reader
does, for any page; each harness binds it to its own page and keeps its feature's helpers apart.
_Avoid_: page object
_Where_: `driver/butter.mjs`
