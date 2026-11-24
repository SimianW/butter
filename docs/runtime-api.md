# Runtime API

The extension's internal contracts: runtime messages to the service worker, and the settings and storage they read.

## Layout storage API

From an extension context (including the popup), use:

```js
await chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-usage' });
// { conversations, bytes } across ALL accounts; expired records are pruned.
const clearRequest = { version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID() };
await chrome.runtime.sendMessage(clearRequest);
// { conversations: 0, bytes: 0 }; settings remain, delayed writes are fenced.
```

`conversations` counts distinct account/conversation pairs, not layouts or turns. `bytes` is the
UTF-8 serialized size of the stored rows including metadata, excluding IndexedDB/index overhead.
Failures return `{ error: 'layout-storage' }`; unsupported protocol versions return
`{ error: 'layout-protocol' }`. Retry a closed port/storage error up to three times with the same
request (including the same clear `requestId`), then show an unavailable state. These are
runtime messages, never page events. The service worker also handles version-1 internal `butter-layout-load`
(account + conversation SHA-256 hashes) and `butter-layout-put` (same hashes, compact records and the
load's generation). Unknown identities are rejected. An external extension cannot call the API.

Protocol v1:

| Request `type` | Additional fields | Successful response |
|---|---|---|
| `butter-layout-usage` | None | `{ conversations, bytes }` |
| `butter-layout-clear` | `requestId`: random UUID, reused on retry | `{ conversations: 0, bytes: 0 }` for that operation |
| `butter-layout-load` | `account`, `conv`: SHA-256 hashes | `{ generation, records }` for that partition |
| `butter-layout-put` | Same hashes, `generation` from load, compact `records` | `{ conversations, bytes }`; `{}` when an old generation is fenced |

All requests include `version: 1`. Unknown identities or layout-off produce no geometry reads or
writes. Clear ids are durably deduplicated for the latest 64 clear operations. Retrying clear gets
its original result; query usage again if subsequent measurements may already have saved data.

`layoutConsent` starts as `pending`, and `ButterStatus.normalize` keeps `opts.layout` false
unless consent is `granted` and the saved layout option is not false. Persisted reads/writes
require both. The in-page card asks first; the popup switch also records consent. While pending,
usage reports zero and no layout data is saved. Setting layout false deletes layouts for all
accounts and stops reads/writes; it is independent of the master optimization switch.
The popup shows usage on the second line of Remember long-chat layouts, with Clear, and asks before it clears.
Clear preserves settings, the migration marker and bounded non-content control metadata
(generation and the latest 64 clear-operation ids). Clear retires disk-backed memory in open tabs; newly measured geometry can
save again while the setting is on. Set the option false for a persistent opt-out.

## Bookmarks store API

Version-1 runtime messages from content scripts to the service worker (`bookmarks/worker.js`),
on the layout store's queue. Ids are SHA-256 hex, as layouts hash them; a bookmark is
`{ account, conv, msg, ask, turn, para, start, end, excerpt, line, time }` (`ask` and `line` are
missing from bookmarks saved before they were added; see
[layout-storage-data.md](layout-storage-data.md#object-store-bookmarks-database-version-2)), and
stored ones also carry their `key`.

| Request `type` | Fields | Response |
|---|---|---|
| `butter-bookmark-list` | `account`, `conv` | `{ bookmarks }` for that conversation |
| `butter-bookmark-create` | `bookmark` | `{ bookmark, created }`; the same paragraph and range returns the existing one with `created: false` |
| `butter-bookmark-delete` | `account`, `conv`, `key` | `{ deleted }` |
| `butter-bookmark-key` | None (version 1 like the others) | `{ shortcut }`: the key Chrome reports for the `bookmark` command, `''` when it has none |
| `butter-bookmark-usage` | None | `{ count, bytes }` over the whole store (every account and conversation); `bytes` sums each stored row's UTF-8 JSON length |
| `butter-bookmark-clear` | `requestId`: random UUID, reused on retry | `{ count: 0, bytes: 0 }`; a retried id clears nothing again and returns the current usage |

Unknown or raw account/conversation ids get `{ error: 'bookmark-identity' }`, a malformed bookmark or
another protocol version `{ error: 'bookmark-protocol' }`, a storage failure
`{ error: 'bookmark-storage' }` (retry the same request up to three times). None of these depend on
the layout setting, `layoutConsent` or layout Clear.

Usage and clear need no identity, so only extension pages may send them: a sender without a tab
(the popup) or one of Butter's own pages open in a tab; a content script gets
`{ error: 'bookmark-sender' }`. Clear runs on the same queue as the other writes, empties the
store once per `requestId`, and then writes `chrome.storage.local.butterBookmarksCleared` (a fresh
UUID) on every accepted request, a retry of an applied id included, so a retry after a failed
token write still tells the tabs: each tab's store client
(`ButterBookmarkStore.cleared`) hands it to its bookmark session, which drops its lists and
republishes, and the popup reads usage again. Bookmarks show on the page only while Butter, the
`rail` key and the `bookmark` key are on (`ButterStatus.bookmarksOn`; in a tab, neither `rail` nor
`bookmark` in `data-butter-off`); off hides the cell, the shortcut's effect, the dots and the wash
and keeps the store.

The `bookmark` command (manifest `commands`, suggested key Alt+Shift+M, Option+Shift+M on a Mac,
rebindable in `chrome://extensions/shortcuts`) makes the worker send `{ version: 1, type:
'butter-bookmark-shortcut' }` to the tab it was pressed in. The content script bookmarks the selection
inside one answer (anchored to its first paragraph), or with nothing selected the first answer
paragraph whose top is at or below ChatGPT's 52 px header; a selection outside the answers creates
nothing. Alt+Shift+M is in neither Chrome's accelerator table (Windows, Linux; on a Mac Chrome binds
no Option+Shift letter) nor ChatGPT's documented shortcuts, and is not the dev build's Alt+Shift+B,
which Chrome reserves on Windows and Linux for its bookmarks bar. `--dev` zips keep the `bookmark`
command beside `save-bug`.

On the page, the bookmark session (`bookmarks/session.js`) reads a conversation's bookmarks once
when the rail first shows it, and the rail calls `ButterBookmarkPage.sync(conv, items, complete,
revision)` whenever it renders (`complete`: no earlier page is left to load; `revision`: the items
revision, which every new `items` array of a conversation takes from one rail-wide counter). The
session answers with `ButterRail.setMarks(conv, { revision, groups })`, where `revision` is the
items revision the groups were resolved against (null with no conversation or account, or the rail
off), and `groups` is a `Map` from question id
(or `ButterBookmarks.EARLIER`, -1, for the bookmarks in earlier history that isn't loaded) to
`{ count, fresh, bookmarks, stale, land, wash, remove }`, where `fresh` grows the dot in, `bookmarks` are the question's bookmarks in answer order, each with its `stale` flag,
`stale` is set when all of them are stale (the dot is hollow), `land(turnElement, bookmark = bookmarks[0])` returns that
bookmark's offset below the turn's top for the rail's jump (or null to land on the question, as a
stale bookmark does), `wash(turnElement, bookmark)` washes that bookmark's text once a trip from a
card row has landed on it (false when it is stale; the rail then flashes the bubble instead), and
`remove(bookmark)` deletes it from the store and sends the marks again. The rail calls
`ButterBookmarkPage.unwash()` as any jump starts. An earlier trip waits, up to 1.5 s per page, for
marks whose revision has reached the items it now shows. A quiet re-check publishes when the groups
or the revision changed, or a bookmark is fresh.

Staleness (`ButterBookmarks.resolve`) is computed on the page and never stored. A bookmark is live
when its answer is rendered, its paragraph exists and that paragraph still contains the excerpt's
first rendered line (its first `line` characters; its first 40 for a bookmark saved without `line`).
It is stale when the paragraph or its text changed (an edited answer), when its question's turn is
mounted with another answer (regenerated, or another version shown), or when its message is no
longer in a fully loaded conversation or in its loaded question (`ask`), where it stays under that
question; only a bookmark whose question isn't loaded (or, without `ask`, whose message isn't
listed or rendered) waits on the earlier-history dots while earlier history is unloaded. A turn that isn't
mounted keeps the state last seen in the tab. The session resolves on every rail render, about
0.6 s and 2.5 s after a click on the page (regenerate, edit and the version arrows are clicks), and
when the pointer or focus reaches the rail; never while a scrollbar drag is seeking. The card shows a
stale row grey with "answer changed", and a single stale bookmark with "Bookmark · answer changed",
grey text and a footer saying a click opens its question instead.

Earlier history (#51 addendum). After a reload ChatGPT lists only a long chat's latest questions.
While earlier history isn't loaded, `ButterBookmarks.group` puts a bookmark whose message is neither
listed nor rendered in the `EARLIER` group: the rail draws one dot for it beside the three
"earlier" dots (#72), never stale, and the three dots show its card, "Bookmark · earlier question"
(one, with a footer) or "Earlier questions · k bookmarks" (oldest first). A click on the three dots
still loads earlier messages. A click on a row runs the rail's earlier trip with that bookmark's
key: pages load only until `setMarks` places
the key under a question, then the trip lands on its text as a bookmark jump does (at the
question's start when it turned stale: its message isn't in the now complete conversation). Meanwhile
the dots blink, the card's meta line reads "Loading earlier questions…" and that row's × is a spinner;
Escape or leaving puts the card away without stopping the trip; a keyboard trip ends with focus on
the question's tick. A bookmark leaving the three dots grows in as a dot beside its tick; the dot
beside the three dots fades out when none are left (at once under reduced motion, or when the three
dots go).

The rail draws a question's dot (#71) in its shadow root as an `aria-hidden` `<i class="bdot">`
with no pointer events: `ButterBookmarks.dotSize(pitch)` across, `dotLook(bookmarks, size)` for
solid, hollow (`.stale`, a 1 px inset ring) or faint (`.faint`, 45 %), and placed with `translate`
by `placeDots()`, which `step()` calls on every frame of the hover wave after setting the ticks'
scales, at `dotRight(scale)` (12 px times the tick's scale plus 4) left of the ticks' right end and
centred on the tick's row. Earlier history's dot is always 4 px and solid, centred on the three
dots' row at `dotBeside(17)` (the three dots span 17 px from the ticks' right end, plus 4) left of
the ticks' right end. `.bdot.new` runs `dot-in` (scale 0 to 1, 180 ms) and one `dot-halo`
(600 ms); `.bdot.gone` fades over 160 ms; reduced motion turns both off.

The rail draws the three dots' card from `ButterBookmarks.card(bookmarks, { earlier: true }, zh)`
(`{ single, meta, rows, visible, label, stale, warn, tag, wait }`): the meta line (`wait` while
earlier messages load for one of its rows), then the same rows as a tick's card, without the
question and its divider. The three dots' name is `ButterBookmarks.moreLabel(hint, bookmarks, zh)`.
A tick whose question holds bookmarks (#70) shows the question's own card with them under the
question, from `ButterBookmarks.questionCard(question, bookmarks, at, zh)` (`{ text, single, rows,
visible, stale, warn, tag, group }`): the question card's meta line and text (`text`, cut at 400
characters, clamped to two lines), then a row per bookmark with a 5 px dot (`--dot`), its stale tag in
a list, or one row of up to three lines with the stale footer (`warn`). The card is 280 px wide, a
`group` named `group`, and takes the pointer and focus. Both cards stay open while the pointer crosses
the gap onto them and while it heads left within the card's height across other ticks. Its top is put on a whole pixel. The tick's name
is `ButterBookmarks.tickLabel(question, bookmarks, zh)`. ArrowLeft on the tick enters the card;
ArrowRight or Escape and a keyboard jump return focus to the tick; when its last bookmark is deleted
the card closes and focus, if it was in the card, goes back to the tick.
Keyboard: the arrow keys walk the earlier-history dots and the ticks, one stop per question;
ArrowLeft on a tick or the three dots enters its card, arrows move between rows, Enter jumps, Tab
reaches a row's ×, Delete removes the row, and ArrowRight or Escape returns to the tick or the three
dots. A dot whose last bookmark is deleted fades out over 160 ms (at once under reduced motion). × on
a row is the only way to remove a bookmark.

Every save and every remove shows the notification (`bookmarks/notice.js`, #77), whatever the layout
switch and `layoutConsent` say: the bookmark session's `create` is the only save path (the
Bookmark cell and the shortcut) and its `remove` the rail's ×. "Bookmark saved" (create answered
`created: true`) and "Bookmark removed" carry Undo, which the session hands the notification and
which goes to the bookmark's own account and conversation even after the tab moved on: a save's Undo
sends `butter-bookmark-delete` and drops the bookmark from the session's list; a remove's Undo sends
the stored bookmark back to
`butter-bookmark-create`, whose key comes from its anchor fields, so the same bookmark returns with
its original time and dot. "Already bookmarked" (`created: false`) has none. While `bookmarkNotice`
isn't `'acknowledged'` a save shows the expanded card with the privacy text and Got it, which
writes `bookmarkNotice: 'acknowledged'` into the `butter` settings, once per browser profile; Undo
or a remove replacing it leaves it unacknowledged. The card shows only in the tab that acted, and
Butter paused or the rail off puts it away.

## Ask in branch handoff API

Runtime messages from content scripts to the service worker (`branch/worker.js`), serialized on one
queue. Rows live in `chrome.storage.session` under `butterBranch.<id>` as `{ at, tab, job }`.

| Request `type` | Fields | Response |
|---|---|---|
| `butter-branch-put` | `id` (UUID), `job: { original, title?, quote, question }` | `{ ok: true }`, or `{ error: 'invalid' }` when the sender's tab doesn't show `original` |
| `butter-branch-claim` | `id` | `{ job }` once; then `{ missing: true }`. `{ error: 'expired' }` after 60 s, `{ error: 'sender' }` from the original tab or another conversation (the row is deleted either way) |

The settings key is `opts.branch` (on unless `false`); there is no popup row or status group yet.

## Popup settings and status

The four switches map to `container + cv + throttle` (streaming), `older + seek` (scrolling),
`rail`, and `layout`. A switch is on only when all its keys are on; toggling writes every key
in that group. Normalization defaults the new `seek` key to true and preserves saved values
and unknown settings. All settings continue to apply live.

The master status says working when the active tab's content script answers, open a chat when
no receiver answers, and paused when disabled. Feature probes have neutral internal evidence
until exercised; neutral evidence has no popup badge. Exercised failures are merged by the
worker into `chrome.storage.session.butterFailures`, keyed by group and failed feature. Switching
chats or disabling a setting preserves them; successful engagement of the failed feature removes
its record. Browser shutdown clears session records. The worker serializes probe merges so
concurrent tabs cannot overwrite each other's failures.

The send pre-jump (`rail/pre-jump.js`) follows the smoother scrolling switch (`older` + `seek`), not
`rail`: `rail.js` installs it whatever the rail setting, and it continues with the rail off. Latest-question prediction belongs to the rail
presentation and is hidden with it. These behaviors are unchanged.

The popup uses the layout runtime API above, retries the same request three times, and retains
the same UUID when retrying clear. Clear confirms inline and shows completion for two seconds.
Usage uses decimal KB/MB and the 50,000,000-byte payload cap. Layout-off still deletes saved
layouts through the existing worker listener. See `design/icon/REGENERATING.md` for icon regeneration
and [`design/palette.md`](../design/palette.md) for the popup's and the bookmark notice's colours, type
and contrast ratios.

## Dev card

The dev card keeps the round in `chrome.storage.local.butterDev` (`round`, `bugs`, and after a save the
`file` name and its `download` id). Its save button and New round go to the dev worker as
`butter-dev-save` (with the active `tabId`) and `butter-dev-new-round` runtime messages, which only the
extension's own pages may send; the worker serializes them with the shortcut's saves. Open round folder
shows the round's last saved file through the downloads API; before the round's first save, when the
round folder does not exist yet, it opens the Downloads folder.
