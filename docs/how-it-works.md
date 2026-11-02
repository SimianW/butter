# How it works

ChatGPT gets slow in long chats because every streamed update makes Chrome restyle and re-lay out
the whole conversation. Butter cuts that work in four places:

| File | Change | Why |
|---|---|---|
| `butter.css` | `container-type: normal` on the thread's inner wrapper. | As a size container around the whole conversation it makes Chrome redo style for everything inside on every streamed update. Most of the win. |
| `butter.css` + `butter-cv.js` | `content-visibility: auto` on turns and answer blocks, but only after they have rendered once (`data-butter-seen`); blocks of the answer being streamed get it right away. | Off-screen content skips style and layout. Waiting for the first render means the browser already knows each block's real height, so scrolling never jumps. |
| `butter-main.js` (page world) | Lets ChatGPT's stream smoother publish at most every 250 ms instead of every frame. Only the exact callback `()=>{this.frame=void 0,this.publish()}` is touched; anything else passes through. | Each publish re-renders the answer and restyles the page. Text still streams; it arrives in slightly bigger steps. |
| `butter-nav-main.js` + `config.js` (page world) | ChatGPT's requests for earlier messages ask for 2 turns per page instead of 10 (`olderPageTurns`). | ChatGPT inserts and lays out each page in one long task, during which you can't type. A jump to an early question in the test chat blocked typing for at most 1.8 s instead of 3.7 s. Scrolling back through a whole long chat takes several times as many requests. |

The [history rail](history-rail.md) lives in `butter-nav.js` and `butter-nav-main.js`.
`butter-nav-main.js` reads the questions out of the conversation responses ChatGPT fetches;
`butter-nav.js` draws the rail in a shadow root and animates only `transform` and `opacity`, so
hovering never restyles ChatGPT's page. It reads layout during a jump and when size changes move
the jumped-to question; scrolling yourself releases that alignment.

## Privacy

The extension stores only your switch and language settings locally (`chrome.storage.local`). It
sends no requests of its own and doesn't change messages. The one
request it touches is ChatGPT's own request for earlier messages, where it lowers the page size.

## Known trade-offs

- Wide tables and visualizations are sized against the app's main content area instead of the
  thread column: about 10 px wider at a 1600 px window.
- A block that streams in while you are scrolled far up is skipped before it's ever drawn; when
  you scroll down to it, content below the viewport may settle by a few pixels.
- Selectors depend on ChatGPT's current DOM (`data-turn-key`, `data-markdown-text-style`,
  `data-talvt-turn-state`, `data-user-message-bubble`, `.thread-scroll-container`, one Tailwind
  class) and the history rail on the shape of ChatGPT's conversation API responses. If ChatGPT
  changes them the extension stops helping; it doesn't break the page.
