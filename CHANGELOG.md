# Changelog

## 0.0.2-alpha (2026-10-30)

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
  0.0.1-alpha, 3.8 s with 0.0.2-alpha; the rail costs nothing measurable.

## 0.0.1-alpha (2026-10-30)

First release. Removes the size container around the conversation, skips rendering of off-screen
turns and answer blocks after their first layout, and limits ChatGPT's stream smoother to one
update every 250 ms. Measured in [docs/REPORT.md](docs/REPORT.md) (internal name there: v5).
