# Changelog

## 0.1.0-alpha.11 (2026-11-04)

- Dragging the scrollbar through a long chat no longer makes ChatGPT load every question you pass.
  While you hold it, Butter shows a light preview of the text at that spot, and the chat loads only
  where you let go.
- Butter can remember the layout of long chats, so the preview also works after a reload. It asks
  once before saving anything. Saved layouts are numbers and one-way hashes, never chat text; they
  stay on your computer for 30 days, 50 MB at most, and you can turn this off or clear it in the
  popup.
- A new popup: four switches grouped by what they do, and a warning only when something isn't
  working on the current tab. New icon.
- Sending a question while far up in a long chat clears the composer and jumps sooner: Butter now
  jumps right after ChatGPT handles Enter, not before.
- Switching back to Chrome no longer freezes scrolling for a moment in a long chat.
- On macOS, the scrollbar stays visible while you drag it.
- The jump on send now follows the "smoother scrolling" switch.
- The privacy policy is rewritten for saved layouts and now has a Chinese version.
- Known issue: right after you let go of the scrollbar, typing can lag for a few seconds while the
  chat loads that spot. This will be fixed in the next build.

## 0.1.0-alpha.10 (2026-11-02)

- ChatGPT's pulsing "responding" dot is shown whole again. Before, its left edge was cut off while
  it waited for an answer.

## 0.1.0-alpha.9 (2026-11-02)

- Sending a question while you're far up in a long chat brings you to the new question much
  sooner. Butter first jumps close to the end, so ChatGPT's scroll no longer passes, and lays out,
  every turn in between: from the top of a long test chat it took 2.6 s instead of 9.6 s.
- While you hold the scrollbar, earlier messages wait until you let go, so the thumb no longer
  jumps away from under your mouse near the top of a long chat. This follows the "Load history in
  small batches" switch.

## 0.1.0-alpha.8 (2026-11-01)

- A toolbar popup shows live checks for the five optimizations on the current ChatGPT tab.
- Turn each optimization on or off, or pause Butter with the master switch. Changes apply immediately.
- Choose English or 中文 in the popup; the question rail follows the same language, live.
- Butter now stores only these switch and language settings locally in Chrome.

## 0.1.0-alpha.7 (2026-11-01)

- Far jumps show the question about half a second sooner. The chat no longer waits a fixed time
  behind the placeholder lines before revealing it; it reveals as soon as the question has stopped
  moving and keeps it in place through and after the reveal.
- Clicking several ticks during a far jump no longer keeps the placeholder lines running
  indefinitely: the whole burst ends within about 12 seconds of the first click. Clicking the tick
  you are already travelling to no longer starts the wait over.
- After you click a tick, the question preview card next to the rail goes away at once instead of
  sometimes staying on screen through the jump. It comes back when you point at the rail again.
- Every question that takes up part of the screen now has its tick lit, so when two questions
  share the screen both ticks are long, including right after a jump lands. A strip of the
  previous answer left above a question you jumped to doesn't count. During a jump only the
  clicked tick is lit. Before, only the question crossing a line 30% down the screen was
  lit, and at the very bottom of a chat a short last question never got its tick lit.
- The ring around the question a jump lands on is drawn complete; before, its right (and sometimes
  top) edge was cut off.
- Opening a chat sometimes left no tick lit until you scrolled. The ticks of the questions on
  screen now light as soon as the chat appears.
- Opening a chat no longer briefly lights every tick, or the ticks lit in the chat you came from.
  The latest question's tick is lit from the start, and once the chat stops moving the rail shows
  what is actually on screen. When earlier questions load in at the top meanwhile, the lit tick
  stays on the latest question instead of sliding over from the one above it.

## 0.1.0-alpha.6 (2026-11-01)

- A far jump lands on the question you clicked even when the answers above it are still drawing
  (for example formulas being typeset). Before, a jump down could stop one question short. After
  landing, the question stays in place if something above it grows, until you scroll yourself.
- Clicking the three dots at the top of the rail (or pressing Enter on them) now takes you to the
  first question in the chat in one trip, loading earlier messages behind the moving placeholder
  lines, and the dots disappear once everything is loaded. Before, the chat scrolled up for real,
  went blank for a second or two, stopped at a random spot mid-chat, and needed several clicks.
  One click loads up to 100 earlier turns or runs for up to 60 seconds; click again to continue.
- With reduced motion turned on, a far jump shows still placeholder lines instead of a blank chat.
- A rail tick no longer swells into a large black shape over the chat for a moment while the page
  is busy (for example during a far jump or while earlier messages load).

## 0.1.0-alpha.5 (2026-11-01)

- Clicking another rail tick while a far jump is still running takes over that jump instead of
  ending it. Before, the chat flashed in for a moment, often showing a blank or half-drawn part of
  the conversation, and the placeholder lines flickered. A quick burst of clicks now sends the chat
  only to the last one.
- The extension is now called Butter for ChatGPT and has its own icon.
- Versions are renamed to 0.1.0: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and
  0.0.2-alpha.N is 0.1.0-alpha.N.

## 0.1.0-alpha.4 (2026-11-01)

- The clicked rail tick stays lit through the whole jump and after it, until you scroll yourself
  (wheel, touch, scrollbar or keyboard). Before, other ticks lit up on the way, and landing on a
  short question could leave the next one lit.
- A far jump down after earlier messages have loaded (for example from the first question to the
  latest) lands on its target instead of stopping partway. Jumps now re-read where the turns on
  the page are and correct course until the target appears.
- Scrolling with the keyboard or dragging the scrollbar ends a running jump, like the wheel does.

## 0.1.0-alpha.3 (2026-11-01)

- Clicking rail ticks in quick succession no longer leaves the chat blank: a new click, a wheel
  scroll or switching chats ends the running jump at once and shows the chat again.
- Earlier messages load 2 turns per page instead of 10 (`olderPageTurns` in `config.js`). ChatGPT
  lays each page out in one long task that blocks typing; in the test chat, typing during a jump to
  an early question was blocked for at most 1.8 s instead of 3.7 s, and the jump took 4.0 s instead
  of 6.0 s. Scrolling back through a whole long chat takes more requests.

## 0.1.0-alpha.2 (2026-10-31)

- History rail follows the chat on screen when ChatGPT keeps earlier chats as hidden copies in the
  tab: the rail no longer goes missing after switching back to a chat, and questions from the
  previous chat no longer mix in.
- Far jumps play as one continuous fast scroll: the chat speeds off, placeholder lines stream past
  on the compositor while ChatGPT renders the target, and the chat slides in on it. Jumping right
  after a long chat opens no longer stutters.

## 0.1.0-alpha.1 (2026-10-30)

- History rail at the right edge of the chat: one tick per question. Hovering swells the ticks
  around the pointer and previews the question; clicking jumps to it, also when ChatGPT has
  unloaded that part of the chat; three dots load earlier questions. Keyboard: Tab, ↑/↓, Enter.
  Questions are read from the conversation data ChatGPT fetches; the rail sends no requests.
- Far jumps play as one continuous fast scroll: the chat scrolls off toward the target, placeholder
  lines stream past while ChatGPT renders it (and loads earlier messages or its math module), and
  the chat scrolls in and stops on the question. Everything runs on the compositor (opacity, the
  browser's smooth scrolling, the placeholder's transform), so ChatGPT's pauses don't stall it.
- The rail follows ChatGPT's hidden copies of chats opened earlier in the tab; it no longer
  disappears, or mixes in the previous chat's questions, when you switch back to one.
- Re-measured on ChatGPT's new front end (it now keeps only about five turns on the page):
  main thread blocked during the replayed answer 66.5 s without the extension, 3.7 s with
  0.1.0-alpha, 3.8 s with 0.1.0-alpha.1; the rail costs nothing measurable.

## 0.1.0-alpha (2026-10-30)

First release. Removes the size container around the conversation, skips rendering of off-screen
turns and answer blocks after their first layout, and limits ChatGPT's stream smoother to one
update every 250 ms. Measured in [docs/REPORT.md](docs/REPORT.md) (internal name there: v5).
