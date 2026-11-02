# How it works

ChatGPT gets slow in long chats because every streamed update makes Chrome restyle and re-lay out
the whole conversation. Butter cuts that work in five places:

| File | Change | Why |
|---|---|---|
| `butter.css` | `container-type: normal` on the thread's inner wrapper. | As a size container around the whole conversation it makes Chrome redo style for everything inside on every streamed update. Most of the win. |
| `butter.css` + `butter-cv.js` | `content-visibility: auto` on turns and answer blocks, but only after they have rendered once (`data-butter-seen`); blocks of the answer being streamed get it right away. | Off-screen content skips style and layout. Waiting for the first render means the browser already knows each block's real height, so scrolling never jumps. |
| `butter-nav.js` | When you send a question while scrolled more than 1.5 screens above the end, jumps to one screen above the end first, then lets ChatGPT scroll the new question into place. Enter and the send button do this; Shift+Enter (a newline) doesn't. | ChatGPT's own scroll to the new question passes every turn in between, and each one it passes is mounted and laid out. Sending from the top of the long test chat took 2.6 s instead of 9.6 s. |
| `butter-main.js` (page world) | Lets ChatGPT's stream smoother publish at most every 250 ms instead of every frame. Only the exact callback `()=>{this.frame=void 0,this.publish()}` is touched; anything else passes through. | Each publish re-renders the answer and restyles the page. Text still streams; it arrives in slightly bigger steps. |
| `butter-nav-main.js` + `config.js` (page world) | ChatGPT's requests for earlier messages ask for 2 turns per page instead of 10 (`olderPageTurns`). While you hold the thread's scrollbar, those requests wait until you let go. Both follow the `older` switch. | ChatGPT inserts and lays out each page in one long task, during which you can't type. A jump to an early question in the test chat blocked typing for at most 1.8 s instead of 3.7 s. Waiting during a scrollbar drag keeps new pages from changing the thumb's position under your mouse. Wheel, keyboard and history-rail loads start normally. |

The [history rail](history-rail.md) lives in `butter-nav.js` and `butter-nav-main.js`.
`butter-nav-main.js` reads the questions out of the conversation responses ChatGPT fetches;
`butter-nav.js` draws the rail in a shadow root and animates only `transform` and `opacity`, so
hovering never restyles ChatGPT's page. It reads layout during a jump and when size changes move
the jumped-to question; scrolling yourself releases that alignment.

## Privacy

The extension stores only your switch and language settings locally (`chrome.storage.local`). It
sends no requests of its own and doesn't change messages. The one
request it touches is ChatGPT's own request for earlier messages, where it lowers the page size
and waits for a scrollbar hold to end.

## Known trade-offs

- Earlier messages load after you let go of the scrollbar. Loading the whole chat takes several
  times as many requests with 2-turn pages. A missed release stops the wait after 30 seconds;
  requests already in flight can still land during a drag. ChatGPT's own virtualizer can still
  move the view as it remounts turns.
- Wide tables and visualizations are sized against the app's main content area instead of the
  thread column: about 10 px wider at a 1600 px window.
- A block that streams in while you are scrolled far up is skipped before it's ever drawn; when
  you scroll down to it, content below the viewport may settle by a few pixels.
- Selectors depend on ChatGPT's current DOM (`data-turn-key`, `data-markdown-text-style`,
  `data-talvt-turn-state`, `data-user-message-bubble`, `.thread-scroll-container`, one Tailwind
  class) and the history rail on the shape of ChatGPT's conversation API responses. If ChatGPT
  changes them the extension stops helping; it doesn't break the page.
