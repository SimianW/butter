# Changelog

## [Unreleased]

## [0.1.0-alpha.21] - 2026-11-12

### Fixed

- Fixed ChatGPT lagging while a long answer streams in, a slowdown since 0.1.0-alpha.14. In the
  lab, the time the page was blocked during a long streamed answer fell from 67 s to 13.6 s.

## [0.1.0-alpha.20] - 2026-11-10

### Added

- Added a Bookmark button next to ChatGPT's "Ask ChatGPT" when you select text in an answer; its
  label shows the bookmark shortcut.
- Added a notification at top right after every bookmark you save or remove, with its first words
  and Undo. It also tells you when a passage is already bookmarked.

### Changed

- Changed Ask in branch to an icon that shares one small pill with the Bookmark button; hover it to
  see its label.
- Moved the first-bookmark notice from bottom right to top right, as the expanded form of the new
  notification.

### Removed

- Removed the bookmark button that appeared in the left margin beside each paragraph under the
  pointer. To bookmark a whole paragraph, triple-click it and click Bookmark, or press the shortcut
  with nothing selected.

## [0.1.0-alpha.19] - 2026-11-10

### Added

- Added a butter highlight that sweeps through the bookmarked text when you jump to a bookmark,
  then fades, in place of the flash on the question.
- Added one highlight over the whole block when the bookmark is a code block or a table.

### Changed

- Replaced the segment under a bookmarked question's tick in the question rail with a small dot
  beside the tick, one per question however many bookmarks it holds, so the rail is one even column
  of ticks again. The dot is a deeper butter in light theme so it shows on white, and it is hollow
  when every bookmark under that question has changed.
- Moved a question's bookmarks into the card its tick already shows: hover the tick to see the
  question with its bookmarks listed under it, click a row to jump to that bookmark, or remove one
  with the × on its row. With the keyboard, press Left on the tick to reach the rows.
- Showed bookmarks in earlier history that isn't loaded yet as a dot beside the rail's
  earlier-history dots; hover those dots to see the bookmarks.

### Fixed

- Fixed the question rail's ticks sometimes no longer swelling under the pointer after you left a
  chat for the home page and came back, until the page was reloaded.

### Removed

- Removed jumping to a question's first bookmark by clicking its mark on the rail. Clicking a tick
  always opens its question; jump to a bookmark from the tick's card.

## [0.1.0-alpha.18] - 2026-11-09

### Added

- Added bookmarks. Hover a paragraph in a ChatGPT answer and click the "Bookmark" button at its
  left to bookmark it; with text selected, the button reads "Bookmark selection" and bookmarks just
  that text.
- Added the Alt+Shift+M shortcut, which bookmarks the selection or, with nothing selected, the
  paragraph at the top of the screen. You can change the key in `chrome://extensions/shortcuts`.
- Added a butter-coloured segment under a bookmarked question's tick in the question rail, one
  per question. Hover it to see the bookmark, or a list when the question has several, click one to
  jump to its paragraph, and remove one with the × on its card or the filled button on its
  paragraph.
- Kept bookmarks when an answer is edited or regenerated, marked "answer changed"; clicking one
  then opens the start of the question, and a question whose bookmarks have all changed gets a
  paler segment. Switching back to the original answer makes them work again.
- Showed bookmarks in earlier history that isn't loaded yet on the rail's earlier-history dots.
  Clicking one loads the earlier messages, then jumps to the bookmark.
- Added a short notice the first time you bookmark, explaining what is saved, with Undo.
- Saved bookmarks only on this computer, separately for each ChatGPT account, keeping at most the
  first three lines of what you marked. Nothing is uploaded, and clearing saved layouts doesn't
  touch them. They stay until you remove them or uninstall Butter. The [privacy policy](PRIVACY.md)
  is updated to match.

## [0.1.0-alpha.17] - 2026-11-09

### Changed

- Moved Ask in branch's status line onto the row of ChatGPT's "ChatGPT can make mistakes" note
  while it shows, instead of a row of its own above it. The note comes back when the line goes.

### Fixed

- Fixed Ask in branch not sending a quote of more than one paragraph. It filled in the question,
  then stopped with "Not sent".
- Fixed dictation on macOS (such as Typeless) typing nothing into Ask in branch's question box.

## [0.1.0-alpha.16] - 2026-11-08

### Changed

- Redesigned the popup: the features sit on one card, and a paused or broken feature says so in
  its own row. The GitHub link, privacy policy and language switch moved to the bottom, and the
  popup no longer grows taller than 600 px.
- Linked the privacy policy from the popup's layouts card until you choose whether to allow saving
  layouts.
- Gave the card that asks permission to save layouts on the ChatGPT page a lighter look.

### Fixed

- Fixed Ask in branch failing after you open a chat from ChatGPT's sidebar. It said "Couldn't
  hand your question to the new tab" until you reloaded the page.

## [0.1.0-alpha.15] - 2026-11-07

### Added

- Added Ask in branch. Select text in a ChatGPT answer, click Butter's "Ask in branch" button next
  to ChatGPT's own, and type a question. Butter opens the chat in a new tab, makes a ChatGPT
  branch from the latest reply, and sends the quoted text with your question there, so the
  original chat is left as it was.
- Made Ask in branch wait for a reply that is still being written, quote selected formulas as
  LaTeX, and allow cancelling at any point before the question is sent. Butter never sends in a
  conversation it can't confirm is the new branch.
- Added an "Ask in branch" switch to the popup. The button is not shown in Temporary Chat, Work
  mode or unsaved branches, and works with ChatGPT in English and Chinese.

### Fixed

- Fixed holding the scrollbar over a short answer you have already read: it shows that answer
  again, instead of saying only its start can be previewed.

## [0.1.0-alpha.14] - 2026-11-07

### Changed

- Changed the preview of an answer you haven't opened yet to say it can show only the start, in
  the rail's language.

### Fixed

- Fixed holding the scrollbar over an answer you have already read: it shows that answer again,
  instead of saying only its start can be previewed. This happened in long answers with formulas,
  in chats with a single question, and in answers ChatGPT draws with its newer renderer.
- Fixed formulas going missing from the scrollbar preview, and a formula stretching to the height
  of the whole answer.
- Fixed tables and widgets losing their rows in the preview; wide tables now stay inside the
  answer column.
- Fixed the history rail covering the scrollbar thumb on macOS.

## [0.1.0-alpha.13] - 2026-11-04

### Changed

- Enlarged the toolbar icon: it drops the floor shadow and stands taller, so Butter no longer looks
  smaller than Chrome's other toolbar icons. The store icon is unchanged.

## [0.1.0-alpha.12] - 2026-11-04

### Added

- Added Chinese for Butter's name and summary in Chrome and the Chrome Web Store when your browser
  is set to Chinese.
- Made the version number in the popup open the changelog.

### Changed

- Updated the store summary.

### Fixed

- Fixed the popup's language switch and GitHub link being cut off at the bottom: they moved to the
  top-right corner, and the popup fits without scrolling.

## [0.1.0-alpha.11] - 2026-11-04

### Added

- Added a light preview while you drag the scrollbar through a long chat: Butter shows the text at
  that spot, and the chat loads only where you let go.
- Added saved layouts, so the preview also works after a reload. Butter asks once before saving
  anything. Saved layouts are numbers and one-way hashes, never chat text; they stay on your
  computer for 30 days, 50 MB at most, and you can turn this off or clear it in the popup.
- Added a Chinese version of the privacy policy.

### Changed

- Redesigned the popup: four switches grouped by what they do, and a warning only when something
  isn't working on the current tab. New icon.
- Changed the jump on send to follow the "smoother scrolling" switch.
- Rewrote the privacy policy for saved layouts.

### Fixed

- Fixed scrolling freezing for a moment after switching back to Chrome in a long chat.
- Fixed the scrollbar hiding on macOS while you drag it.

### Performance

- Stopped ChatGPT loading every question you pass while you drag the scrollbar through a long
  chat.
- Cleared the composer and jumped sooner when you send a question far up in a long chat: Butter
  now jumps right after ChatGPT handles Enter, not before.

### Known issues

- Right after you let go of the scrollbar, typing can lag for a few seconds while the chat loads
  that spot. This will be fixed in the next build.

## [0.1.0-alpha.10] - 2026-11-02

### Fixed

- Fixed ChatGPT's pulsing "responding" dot having its left edge cut off while it waited for an
  answer.

## [0.1.0-alpha.9] - 2026-11-02

### Changed

- Made earlier messages wait until you let go of the scrollbar, so the thumb no longer jumps away
  from under your mouse near the top of a long chat. This follows the "Load history in small
  batches" switch.

### Performance

- Reduced the time to reach a new question sent from far up in a long chat: Butter first jumps
  close to the end, so ChatGPT's scroll no longer lays out every turn in between. From the top of
  a long test chat it took 2.6 s instead of 9.6 s.

## [0.1.0-alpha.8] - 2026-11-01

### Added

- Added a toolbar popup with live checks for the five optimizations on the current ChatGPT tab.
- Added a switch for each optimization and a master switch that pauses Butter. Changes apply
  immediately.
- Added a choice of English or 中文 in the popup; the question rail follows the same language,
  live.

### Changed

- Changed Butter to store these switch and language settings locally in Chrome; it stores nothing
  else.

## [0.1.0-alpha.7] - 2026-11-01

### Changed

- Lit the tick of every question that takes up part of the screen, so when two questions share the
  screen both ticks are long, including right after a jump lands. A strip of the previous answer
  above a question you jumped to doesn't count, and during a jump only the clicked tick is lit.
  Before, only the question crossing a line 30% down the screen was lit.

### Fixed

- Fixed several tick clicks during a far jump keeping the placeholder lines running indefinitely:
  the whole burst ends within about 12 seconds of the first click, and clicking the tick you are
  already travelling to no longer starts the wait over.
- Fixed the question preview card sometimes staying on screen through a jump. It goes away at once
  when you click a tick and comes back when you point at the rail again.
- Fixed a short last question at the very bottom of a chat never getting its tick lit.
- Fixed the ring around the question a jump lands on having its right (and sometimes top) edge
  cut off.
- Fixed opening a chat sometimes leaving no tick lit until you scrolled: the ticks of the questions
  on screen now light as soon as the chat appears.
- Fixed opening a chat briefly lighting every tick, or the ticks lit in the chat you came from.
  The latest question's tick is lit from the start, and once the chat stops moving the rail shows
  what is actually on screen. When earlier questions load in at the top meanwhile, the lit tick
  stays on the latest question instead of sliding over from the one above it.

### Performance

- Showed the question about half a second sooner after a far jump: the chat reveals it as soon as
  it has stopped moving, instead of waiting a fixed time behind the placeholder lines, and keeps it
  in place through and after the reveal.

## [0.1.0-alpha.6] - 2026-11-01

### Added

- Added still placeholder lines instead of a blank chat for a far jump when reduced motion is
  turned on.

### Changed

- Changed the three dots at the top of the rail (click or Enter) to take you to the first question
  in one trip, loading earlier messages behind the moving placeholder lines; the dots disappear
  once everything is loaded. One click loads up to 100 earlier turns or runs for up to 60 seconds;
  click again to continue. Before, the chat scrolled up for real, went blank for a second or two,
  stopped at a random spot, and needed several clicks.

### Fixed

- Fixed a far jump down stopping one question short while the answers above were still drawing
  (for example formulas being typeset). After landing, the question stays in place if something
  above it grows, until you scroll yourself.
- Fixed a rail tick swelling into a large black shape over the chat while the page was busy.

## [0.1.0-alpha.5] - 2026-11-01

### Changed

- Renamed the extension to Butter for ChatGPT and gave it its own icon.
- Renamed the versions to 0.1.0: 0.0.1-alpha is now 0.1.0-alpha, 0.0.2-alpha is 0.1.0-alpha.1, and
  0.0.2-alpha.N is 0.1.0-alpha.N.
- Changed a click on another rail tick during a far jump to take over that jump; a quick burst of
  clicks sends the chat only to the last one.

### Fixed

- Fixed a click during a far jump flashing in a blank or half-drawn part of the conversation and
  making the placeholder lines flicker.

## [0.1.0-alpha.4] - 2026-11-01

### Changed

- Kept the clicked rail tick lit through the whole jump and after it, until you scroll yourself
  (wheel, touch, scrollbar or keyboard).
- Made scrolling with the keyboard or dragging the scrollbar end a running jump, like the wheel
  does.

### Fixed

- Fixed other ticks lighting up during a jump, and landing on a short question leaving the next one
  lit.
- Fixed a far jump down after earlier messages had loaded (for example from the first question to
  the latest) stopping partway. Jumps now re-read where the turns are and correct course until the
  target appears.

## [0.1.0-alpha.3] - 2026-11-01

### Fixed

- Fixed clicking rail ticks in quick succession leaving the chat blank: a new click, a wheel scroll
  or switching chats ends the running jump at once and shows the chat again.

### Performance

- Reduced how long typing is blocked while earlier messages load: they load 2 turns per page
  instead of 10 (`olderPageTurns` in `config.js`), because ChatGPT lays each page out in one long
  task that blocks typing. In the test chat, typing during a jump to an
  early question was blocked for at most 1.8 s instead of 3.7 s, and the jump took 4.0 s instead
  of 6.0 s. Scrolling back through a whole long chat takes more requests.

## [0.1.0-alpha.2] - 2026-10-31

### Changed

- Made far jumps one continuous fast scroll: the chat speeds off, placeholder lines stream past on
  the compositor while ChatGPT renders the target, and the chat slides in on it.

### Fixed

- Fixed the history rail going missing after switching back to a chat, and questions from the
  previous chat mixing in, when ChatGPT keeps earlier chats as hidden copies in the tab.
- Fixed jumps stuttering right after a long chat opens.

## [0.1.0-alpha.1] - 2026-10-30

### Added

- Added the history rail at the right edge of the chat: one tick per question. Hovering swells the
  ticks around the pointer and previews the question; clicking jumps to it, also when ChatGPT has
  unloaded that part of the chat; three dots load earlier questions. Keyboard: Tab, ↑/↓, Enter.
  Questions are read from the conversation data ChatGPT fetches; the rail sends no requests.
- Added far jumps as one continuous fast scroll: the chat scrolls off toward the target,
  placeholder lines stream past while ChatGPT renders it (and loads earlier messages or its math
  module), and the chat scrolls in and stops on the question. Everything runs on the compositor
  (opacity, the browser's smooth scrolling, the placeholder's transform), so ChatGPT's pauses
  don't stall it.

### Fixed

- Fixed the rail disappearing, or mixing in the previous chat's questions, when you switch back to
  a chat ChatGPT kept as a hidden copy in the tab.

### Performance

- Re-measured on ChatGPT's new front end (it now keeps only about five turns on the page): the
  main thread was blocked during the replayed answer for 66.5 s without the extension, 3.7 s with
  0.1.0-alpha, and 3.8 s with 0.1.0-alpha.1; the rail costs nothing measurable.

## [0.1.0-alpha] - 2026-10-30

### Added

- Added the first release of the extension.

### Performance

- Removed the size container around the conversation.
- Skipped rendering of off-screen turns and answer blocks after their first layout.
- Limited ChatGPT's stream smoother to one update every 250 ms.
- Measured the effect in [docs/REPORT.md](docs/REPORT.md) (internal name there: v5).
