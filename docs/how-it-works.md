# How it works

ChatGPT gets slow in long chats because every streamed update makes Chrome restyle and re-lay out
the whole conversation. Butter cuts that work in six places:

| File | Change | Why |
|---|---|---|
| `stream/containment.css` | `container-type: normal` on the thread's inner wrapper. | As a size container around the whole conversation it makes Chrome redo style for everything inside on every streamed update. Most of the win. |
| `stream/containment.css` + `stream/offscreen.js` | `content-visibility: auto` on turns and answer blocks, but only after they have rendered once (`data-butter-seen`); blocks of the answer being streamed get it right away, and are marked only once they have rendered. A streamed block still skipped at the 1 s flush, so never rendered, gets `data-butter-unrendered` and stays skipped after the answer completes, until it comes into view. | Off-screen content skips style and layout. Waiting for the first render means the browser already knows each block's real height, so scrolling never jumps. ChatGPT lays out every block that is no longer skipped in the task that completes the answer, so letting never-rendered blocks render then froze the page for about 0.5 s on a long answer. |
| `rail/rail.js` | When you send a question while scrolled more than 1.5 screens above the end, jumps to one screen above the end, then lets ChatGPT scroll the new question into place. The jump comes right after ChatGPT's own Enter or click handler, in the same task: jumping before it made that handler lay out the end of the chat before it cleared the composer, so the page froze with the typed text still showing (lab: 3.1 s instead of 0.6 s). Enter and the send button do this; Shift+Enter (a newline) doesn't. | ChatGPT's own scroll to the new question passes every turn in between, and each one it passes is mounted and laid out. In the latest lab benchmark, sending from far up made the new question visible in 3.4 s instead of 13.1 s. |
| `stream/throttle-main.js` (page world) | Lets ChatGPT's stream smoother publish at most every 250 ms instead of every frame. Only the exact callback `()=>{this.frame=void 0,this.publish()}` is touched; anything else passes through. | Each publish re-renders the answer and restyles the page. Text still streams; it arrives in slightly bigger steps. |
| `history/conversation-main.js` + `shared/config-main.js` (page world) | ChatGPT's requests for earlier messages ask for 2 turns per page instead of 10 (`olderPageTurns`). While you hold the thread's scrollbar, those requests wait until you let go. Both follow the `older` switch. | ChatGPT inserts and lays out each page in one long task, during which you can't type. In the latest lab benchmark, the longest frame while earlier messages loaded was 2.3 s instead of 8.4 s. Waiting during a scrollbar drag keeps new pages from changing the thumb's position under your mouse. Wheel, keyboard and history-rail loads start normally. |
| `seek/preview-main.js` + `seek/layout-cache-main.js` (page world) | Holds virtualizer scroll notifications during a native thumb drag and draws cached text instead. | ChatGPT mounts the destination after release, so dragging past many turns does not mount each one. |

The [history rail](history-rail.md) lives in `rail/rail.js` and `history/conversation-main.js`.
`history/conversation-main.js` reads the questions out of the conversation responses ChatGPT fetches;
`rail/rail.js` draws the rail in a shadow root and animates only `transform` and `opacity`, so
hovering never restyles ChatGPT's page. It reads layout during a jump and when size changes move
the jumped-to question; scrolling yourself releases that alignment.

## Seek preview

While you hold and drag the thread's native scrollbar thumb, `seek/preview-main.js` stops its scroll
notifications before ChatGPT's virtualizer sees them. The real turns move off screen and a lightweight
text preview takes their place. `seek/layout-cache-main.js` records complete, typeset turns and their block
positions. Blocks belong to the markdown root in the original renderer, or the nested
`DilResponseRoot` in ChatGPT's Dil renderer; the wrappers around that root are not blocks.
Each display formula is measured at its own `.katex-display` element, including formulas inside
mixed prose blocks, and its height is refreshed even when its cached text stays the same.
Skipped, incomplete or zero-size snapshots never replace a good record. Neither does a
snapshot taken while ChatGPT still reveals a streamed answer (its markdown root carries
`AdaptiveStreaming`, even after the turn reads complete): it would hold only the answer's first
lines. Nor does one where a display formula (or a formula-only block) is taller than its TeX rows allow
(120 px plus 64 px per row): that box belongs to an answer that was only partly in the page. When a removed
turn mounts again at the same width with the same message and blocks, the cache restores its sizes
before ChatGPT's first layout read, as inline `content-visibility`, so only while the cv setting is on.
Nor does one with a block that the streaming rule skipped before it ever rendered: ChatGPT does not
scroll with the stream, so most of a long answer arrives below the fold, and such a block is only its
120 px placeholder (a display formula reads 152 px); such blocks stay so until the user scrolls to
them, and the turn is recorded once all have rendered. A widget wrapped in a `display: contents` block
(learning cards, card rows in long answers) has no box of its own; its children's boxes give its size.
Measuring a turn reads the layout of all its items, so it runs only in idle time, a slice of 24 items
between checks of the idle deadline: a turn first seen during a fast scroll is recorded while it is
still rendered, without taking a scroll frame (a seek press measures anything still waiting). A turn
that is skipped or changes part-way through is dropped or started again. A turn coming back into
view is measured again only if its record was dropped or replaced, or if the turn changed since
(a DOM, size or window-width change); a remounted copy of a recorded message with the recorded turn,
row and block sizes adopts the record without measuring. Nothing is measured while seek, cv and
layout are all off.
While an answer is being generated, from the send (ChatGPT inserts the question as a turn that
reads complete but has no answer yet) until the turn reads complete, the cache leaves that turn
alone: no observers, queries or measuring. It measures nothing else in idle time either: a measure
forces style and layout of a page that every chunk dirties, and the one that used to land just
after the send (the previous answer, about 0.4 s) left every later style recalc of the stream about
30% slower. On completion the turn is watched afresh and everything queued is measured; a send that
never starts streaming stops holding after 15 s. A seek press during a stream still measures.

Seen text uses those recorded positions at half opacity. Display math becomes a single line of TeX
in a placeholder of the recorded height, capped by the same TeX-row limit for rows stored by
earlier builds. Classic wide tables and Dil table frames remain preview items, but do not receive
intrinsic block sizes or block containment. Their cells become row text with spaces between cells;
grid and flex widget cells on the same visual row also stay on one text line. Recording and drawing
both clamp preview items to the answer column. Skipped widgets reuse measured rows only while
their containing box is unchanged; visible widgets refresh row grouping when measured again.
Stored geometry from a previous visit also counts as opened.
A question without measured or stored layout previews from its
beginning, with a bottom fade, and releasing lands at that question's start below the header.
The history rail applies its normal lit band to the preview geometry through a `butter-seek-state`
document event, excluding small tails behind the header or composer. Its existing card follows the
lit question that fills most of the band and shows the question number and then loading progress. Preview
continues to work with the rail switched off. It follows Butter's main switch and the popup's Smoother scrolling group (`opts.seek`),
independently of the question rail.

On release, the last native movement is coalesced and ChatGPT receives one destination scroll.
The real turns remain transparent while the destination loads, including behind the header and
around the composer. This preserves their layout and visibility checks. The preview waits for the
target turn, its math and three quiet frames. For known geometry it pins a fully visible text excerpt
and corrects its position after mounting, falling back to the question bubble if no excerpt matches.
Truly unknown questions retain question-start landing. A capped or missing preview block always gets
a source excerpt or a placeholder so the viewport cannot be empty. It then restores the real
turns and fades out over 120 ms in the same frame. Reduced motion removes the fade and spinner animation.
A trusted mouse press must hit the thumb (or the edge band for overlay scrollbars), then actually
scroll with unchanged selection before suppression starts. Wheel, keyboard, lost release, resize,
navigation and data changes keep the prototype's cancellation checks and time limits.
`window.__seekDump()` is an opt-in timing and geometry diagnostic; it contains no chat text.

## Ask in branch

Select text in a ChatGPT reply and an **Ask in branch** button appears 4 px to the right of
ChatGPT's own **Ask ChatGPT** button. It copies that button's height, radius, background, shadow
and font size from its computed style every frame while a selection is active, so it moves, shows
and hides with it. Those come from the toolbar box that draws ChatGPT's button, not from the
button: ChatGPT's button is transparent at rest and, while hovered, tints only itself, square and
without a shadow. So a hovered, pressed or focused button is skipped when looking for the box, and
Butter keeps the look it copied at rest until ChatGPT's button is back at rest. Its question box
opens under the buttons (above the selection when there is no room below). While the box has focus
the page selection moves into it, so ChatGPT hides its own button; Butter keeps its button where it
was and paints the quote with the CSS Custom Highlight API. Esc gives the selection back; the
unsent question is kept per tab, per quote.

The quote is the selected text. A selection may include formulas: ChatGPT renders them with KaTeX
and keeps each one's LaTeX source in `annotation[encoding="application/x-tex"]`, so the quote
writes each formula it touches, even partly, as its whole source: `$…$` inline, `$$…$$` on its own
line for display math, in document order with the text around it (`ButterBranch.quoteOf`; the
question box shows the same quote on one line). A formula without a source, images and other
non-text regions, editable controls, and selections spanning more than one reply get no button.

There is no button where ChatGPT can't make a branch (`ButterBranch.hiddenReason`, facts from
`branch/page.js`): in Temporary Chat (`?temporary-chat=true`, or its switch shown on), on an
unsaved new chat or unsaved branch (no saved `/c/<uuid>` id), in Work/Codex mode, and when no reply
on the page has a More actions button. Work mode is recognised first by the composer form, which
has `data-composer-placement` in both modes but `data-chatgpt-composer` only in Chat mode; then by
the composer's label ("Work with ChatGPT", "使用 ChatGPT Work") or an "Ask in side chat" button in
ChatGPT's selection toolbar. While the only reply is still streaming (no actions yet), the button
stays available.

Enter opens a new tab of the same conversation synchronously, inside the key press, so pop-up
blocking doesn't apply. The URL carries only a job id (`#butter-branch=<uuid>`). The quote, the
question, the original conversation id and title go to the extension worker, which keeps them in
`chrome.storage.session` (memory only) for at most 60 s and hands them out once, to a tab that
shows the same conversation and isn't the original tab.

The new tab is covered by an overlay (scrim and card, tab title "Creating branch…") while
`branch/run.js` drives ChatGPT's menu: More actions of the **latest** reply (not the selected one,
so the branch keeps the whole conversation), Branch conversation, Branch in new chat. ChatGPT then
routes the tab to an unsaved branch, `/c/local-chatgpt:<uuid>` (it calls
`POST /backend-api/conversation/new_branch` itself). Menus are matched by structure first (the
ellipsis icon of More actions, the branch icon of a submenu item), then by English or Simplified
Chinese labels; Branch in new chat (在新聊天中创建分支) has no icon, so only its exact label on a
leaf item counts, never its position next to Branch into Work mode.

If the latest reply is still being written (`data-talvt-turn-state="in_progress"` on its turn, or
ChatGPT's stop button), the card says "Waiting for the reply to finish…" (the tab title too) and
the run waits. It branches once no stream has shown for 1 s, checked again before every menu
attempt, so a stream the new tab picks up late, or one that pauses between thinking and writing,
still isn't branched half-written. Cancel works while waiting.

The run's states are loading, waiting-for-reply, branching, verifying, sending and ready, and the
end states unsure, failed and cancelled. Success is decided by identity, not by menu timeouts: the
tab must show a readable conversation id different from the original, and that conversation must
have rendered (composer, a reply, and message wrappers whose
`data-chatgpt-selection-conversation-id` matches). Before reporting a failure the run re-checks for
3 s whether the tab landed on a branch anyway; a slow step that still made a branch ends in ready.
"Branch in new chat" is pressed at most once per run. Only from a verified branch does it type
`> ` + each quoted line, a blank line and the question into the composer and click ChatGPT's send
button. When it can't be sure (unreadable identity, branch not rendered, no send button) it fills
the composer without sending and says so; when the tab still shows the original conversation it
types nothing. Nothing is ever typed into or sent in the original tab. The page adapter
(`branch/page.js`) is the only part that touches ChatGPT's DOM; the run takes it as a parameter, so
`test/branch-run.test.js` drives it with a fake page.

The grey "Branched from …" line fades out once ChatGPT's reply to the sent question starts to
show (at once with reduced motion): the last reply in the conversation is one that wasn't there
when Butter sent, keyed by its turn's `data-turn-key`, so older turns loading above don't count.
Until then it stays; your own next send, its × or leaving the conversation hide it at once. The
"Not sent" line shown when Butter can't be sure stays until one of those. Either line takes the row
of ChatGPT's own text right on the composer's top edge, the "ChatGPT can make mistakes"
disclaimer: it covers that text's box with the page's background behind it and copies its font
size and line height, so the disclaimer shows again once the line goes; ChatGPT's DOM is left
alone. That text is found by hit-testing a 30 px band above the composer
(`document.elementsFromPoint`), skipping the conversation's turns, so no selector of ChatGPT's is
needed. With no such text, the line sits in its own row 8 px above the composer.

## Privacy

Settings live in `chrome.storage.local`. Layouts live in the extension's IndexedDB
`butter-layouts-v1`, behind `storage/layout-worker.js`; the page never opens a layout database.
`storage/layout-bridge.js` passes allowlisted compact geometry and SHA-256 identities from the
ISOLATED world to the worker. The single `seek/layout-cache-main.js` owns measured warm entries,
prefetched geometry, source matching, adoption and restore validation. Preview text stays in page
memory. Disk records contain sizes, positions, typography dictionaries, source block indexes,
math offsets and hashed identities, never chat text or credentials. Bookmarks share the database in
their own `bookmarks` store, the only place chat text is persisted: each keeps at most three rendered
lines (240 characters) of what the user marked, under hashed identities, until the user deletes it
(see [layout-storage-data.md](layout-storage-data.md)).

`history/conversation-main.js` passively selects the user id from `/backend-api/me` or
`/api/auth/session` responses already fetched by ChatGPT, hashes it immediately, and forwards only
that hash. Records are partitioned by this account hash and a hashed conversation id. Unknown
accounts perform no persisted reads or writes. Account switches retire the prior account's warm
entries, source contexts, pending writes and prefetched records. Nothing reads cookies or accesses
auth token fields, and Butter makes no network requests of its own.

On chat open, once the account is known, the cache prefetches only that conversation's records via
the extension bridge, independently of a scrollbar press. Source hashing and layout-hash preparation
happen before a drag. The preview's `prepare` remains synchronous: it reads memory and the current
layout fingerprint, never awaits storage. Content digests, message ids, width, DPR, font, rendered
column width, theme, application assets and the 30-day expiry must all match. Width and font are read from an answer column whose turn is rendered: reading one inside a turn that content-visibility skips forces Chrome to style and lay out that whole turn first (0.6 s for a long math answer, after every wheel burst and window refocus). The seek preview takes its text colour and font from the same column. Adopted entries pass
the same `acceptStored` check at each use. Resize, theme and font events invalidate the cached
fingerprint without a layout read inside the native `clientWidth` hook. A long hold may retire an
unchanged fingerprint; release refreshes it before destination dispatch so stored heights still
restore before React reads layout. Queued writes capture their
measurement identity; conversation write epochs prevent stale responses/hashes from reviving it.
Warm previews still prepare without fetched source after writes.

The worker serializes operations, prunes expired records, and caps serialized record bytes at
50,000,000 across all accounts, evicting least recently used rows first. This is logical payload
size, including stored metadata; IndexedDB's physical/index overhead is browser-dependent.
`unlimitedStorage` removes Chrome's quota/eviction risk; Butter still enforces its own limit.
`ButterStatus.normalize` keeps `opts.layout` off until the user grants `layoutConsent`
through the in-page card or popup switch. Pending or declined consent prevents persisted
geometry reads/writes. Setting layout false deletes every account's saved layouts and stops
persisted reads/writes while keeping the in-session cache. Clear increments a durable generation
so delayed writes from other tabs cannot repopulate cleared data. The bridge retires disk-backed
memory on clear. New measurements can subsequently save again if saving remains enabled.

The bridge deletes the old site-origin trial database `butter-seek-cold-geometry-v1` once and marks
success in extension settings. A blocked/failed deletion is retried on a later visit. No old
records are read or imported. See [privacy and clearing instructions](../PRIVACY.md#what-butter-saves-on-your-computer),
the [runtime API](development.md#layout-storage-api), and the
[backend/permission rationale](layout-storage-design.md).

Ask in branch keeps the selected text, the question, the original conversation id and its title in
`chrome.storage.session` only between the click in the original tab and the new tab's claim (one
claim; expired after 60 s; pruned whenever the worker wakes). Content scripts can't read session
storage; only the worker touches it. No permission was added for it.

## Known trade-offs

- Earlier messages load after you let go of the scrollbar. Loading the whole chat takes several
  times as many requests with 2-turn pages. A missed release stops the wait after 30 seconds;
  requests already in flight can still land during a drag. Seek preview holds mounting during the
  drag; an unmeasured destination may still need alignment when released.
- Holding mounts during a drag moves ChatGPT's first render of the destination area to the
  release. ChatGPT then renders the target turn and its never-rendered neighbours in one task, so
  a separate [drag-release trace](../notes/runs/2026-11-04-drag-release/report.md) found that typing
  right after release could wait about 5 s in a long chat, against about 2 s without the preview
  at a real drag pace. In that trace, time until the destination was readable was about the same;
  the drag itself stayed smooth: held-frame p95 about 30 ms, against 120–1455 ms. These are separate
  measurements from the [latest benchmark](benchmarks.md), where release readiness was slower
  with Butter. Butter's
  own scripts take about 70 ms of that task. Every fix we found changes what you see: skipping the
  neighbours with estimated heights, revealing before they mount, or mounting during the drag.
- Wide tables and visualizations are sized against the app's main content area instead of the
  thread column: about 10 px wider at a 1600 px window.
- A block that streams in while you are scrolled far up is skipped before it's ever drawn; when
  you scroll down to it, content below the viewport may settle by a few pixels.
- Ask in branch depends on ChatGPT's message menu. The "Branch in new chat" item has no test id or
  icon, so it is matched by its exact English label; Chinese labels and the hidden-button rules
  come later. When the item isn't found, nothing is typed or sent and the new tab shows a failure.
- Selectors depend on ChatGPT's current DOM (`data-turn-key`, `data-markdown-text-style`,
  `data-talvt-turn-state`, `data-user-message-bubble`, `.thread-scroll-container`, one Tailwind
  class) and the history rail on the shape of ChatGPT's conversation API responses. If ChatGPT
  changes them the extension mostly stops helping. Because it also wraps fetch, layout and scroll
  events, a partial change could still misbehave. Pausing Butter from the popup disables request
  rewriting and drag deferral; the fetch wrapper stays installed and keeps observing responses.
