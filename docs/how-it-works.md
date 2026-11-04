# How it works

ChatGPT gets slow in long chats because every streamed update makes Chrome restyle and re-lay out
the whole conversation. Butter cuts that work in six places:

| File | Change | Why |
|---|---|---|
| `stream/containment.css` | `container-type: normal` on the thread's inner wrapper. | As a size container around the whole conversation it makes Chrome redo style for everything inside on every streamed update. Most of the win. |
| `stream/containment.css` + `stream/offscreen.js` | `content-visibility: auto` on turns and answer blocks, but only after they have rendered once (`data-butter-seen`); blocks of the answer being streamed get it right away. | Off-screen content skips style and layout. Waiting for the first render means the browser already knows each block's real height, so scrolling never jumps. |
| `rail/rail.js` | When you send a question while scrolled more than 1.5 screens above the end, jumps to one screen above the end first, then lets ChatGPT scroll the new question into place. Enter and the send button do this; Shift+Enter (a newline) doesn't. | ChatGPT's own scroll to the new question passes every turn in between, and each one it passes is mounted and laid out. Sending from the top of the long test chat took 2.6 s instead of 9.6 s. |
| `stream/throttle-main.js` (page world) | Lets ChatGPT's stream smoother publish at most every 250 ms instead of every frame. Only the exact callback `()=>{this.frame=void 0,this.publish()}` is touched; anything else passes through. | Each publish re-renders the answer and restyles the page. Text still streams; it arrives in slightly bigger steps. |
| `history/conversation-main.js` + `shared/config-main.js` (page world) | ChatGPT's requests for earlier messages ask for 2 turns per page instead of 10 (`olderPageTurns`). While you hold the thread's scrollbar, those requests wait until you let go. Both follow the `older` switch. | ChatGPT inserts and lays out each page in one long task, during which you can't type. A jump to an early question in the test chat blocked typing for at most 1.8 s instead of 3.7 s. Waiting during a scrollbar drag keeps new pages from changing the thumb's position under your mouse. Wheel, keyboard and history-rail loads start normally. |
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
positions; skipped, incomplete or zero-size snapshots never replace a good record. When a removed
turn mounts again at the same width with the same message and blocks, the cache restores its sizes
before ChatGPT's first layout read.

Seen text uses those recorded positions at half opacity. Display math becomes a single line of TeX
in a placeholder of the recorded height. Stored geometry from a previous visit also counts as opened.
A question without measured or stored layout previews from its
beginning, with a bottom fade, and releasing lands at that question's start below the header.
The history rail applies its normal lit band to the preview geometry through a `butter-seek-state`
document event, excluding small tails behind the header or composer. Its existing card follows the
lit question that fills most of the band and shows the question number and then loading progress. Preview
continues to work with the rail switched off. It follows Butter's main switch and has no separate
popup setting.

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

## Privacy

Settings live in `chrome.storage.local`. Layouts live in the extension's IndexedDB
`butter-layouts-v1`, behind `storage/layout-worker.js`; the page never opens a layout database.
`storage/layout-bridge.js` passes allowlisted compact geometry and SHA-256 identities from the
ISOLATED world to the worker. The single `seek/layout-cache-main.js` owns measured warm entries,
prefetched geometry, source matching, adoption and restore validation. Preview text stays in page
memory. Disk records contain sizes, positions, typography dictionaries, source block indexes,
math offsets and hashed identities, never chat text or credentials.

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
column width, theme, application assets and the 30-day expiry must all match. Adopted entries pass
the same `acceptStored` check at each use. Resize, theme and font events invalidate the cached
fingerprint without a layout read inside the native `clientWidth` hook. Queued writes capture their
measurement identity; conversation write epochs prevent stale responses/hashes from reviving it.
Warm previews still prepare without fetched source after writes.

The worker serializes operations, prunes expired records, and caps serialized record bytes at
50,000,000 across all accounts, evicting least recently used rows first. This is logical payload
size, including stored metadata; IndexedDB's physical/index overhead is browser-dependent.
`unlimitedStorage` removes Chrome's quota/eviction risk; Butter still enforces its own limit.
`butter.opts.layout` defaults to true; false deletes every account's saved layouts and stops
persisted reads/writes while keeping the in-session cache. Clear increments a durable generation
so delayed writes from other tabs cannot repopulate cleared data. The bridge retires disk-backed
memory on clear. New measurements can subsequently save again if saving remains enabled.

The bridge deletes the old site-origin trial database `butter-seek-cold-geometry-v1` once and marks
success in extension settings. A blocked/failed deletion is retried on a later visit. No old
records are read or imported. See [privacy and clearing instructions](../PRIVACY.md#what-it-stores),
the [runtime API](development.md#layout-storage-api), and the
[backend/permission rationale](layout-storage-design.md).

## Known trade-offs

- Earlier messages load after you let go of the scrollbar. Loading the whole chat takes several
  times as many requests with 2-turn pages. A missed release stops the wait after 30 seconds;
  requests already in flight can still land during a drag. Seek preview holds mounting during the
  drag; an unmeasured destination may still need alignment when released.
- Wide tables and visualizations are sized against the app's main content area instead of the
  thread column: about 10 px wider at a 1600 px window.
- A block that streams in while you are scrolled far up is skipped before it's ever drawn; when
  you scroll down to it, content below the viewport may settle by a few pixels.
- Selectors depend on ChatGPT's current DOM (`data-turn-key`, `data-markdown-text-style`,
  `data-talvt-turn-state`, `data-user-message-bubble`, `.thread-scroll-container`, one Tailwind
  class) and the history rail on the shape of ChatGPT's conversation API responses. If ChatGPT
  changes them the extension stops helping; it doesn't break the page.
