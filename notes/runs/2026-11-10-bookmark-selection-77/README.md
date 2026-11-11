# Bookmark selection pill and top-right notification (#77): fixture screenshots

The approved #77 mockup's states, built from the real extension in the bookmarks fixture
(`lab/harness/bookmarks-qa.mjs`, a synthetic chat; no ChatGPT requests), for comparison with the
mockup's panels. Every state at desktop width (1400 × 900) and narrow width (700 × 900, under the
card's 760 px breakpoint).

Command: `xvfb-run -a -s '-screen 0 1600x1000x24' env MARKUP=live ONLY=pill SHOTS=/tmp/bq-shots node lab/harness/bookmarks-qa.mjs`
(25 checks passed), then `states/*.png` copied here. Build: `t3/bookmark-selection-77`, 0.1.0-alpha.20.

| File | Mockup state |
|---|---|
| `a-pill-bookmark-{desktop,narrow}.png` | A′: a passage selected, the pointer on the Bookmark cell, its label 8 px below the pill |
| `c-saved-{desktop,narrow}.png` | C′: "Bookmark saved" top right, the new dot on the rail |
| `d-removed-{desktop,narrow}.png` | D′: "Bookmark removed" after × on the rail card, its first words struck through |
| `f-first-{desktop,narrow}.png` | F′: the first bookmark ever, the expanded card with the privacy text and Got it |
| `e-dark-branch-{desktop,narrow}.png` | E′: dark theme, the pointer on Ask in branch, a saved card |
| `already-{desktop,narrow}.png` | Not in the mockup: "Already bookmarked", no Undo |
| `pill-branch-off-{desktop,narrow}.png` | Not in the mockup: Ask in branch off, the Bookmark cell alone (30 × 30) |
| `zh-a-pill-bookmark-*`, `zh-c-saved-*`, `zh-already-*`, `zh-d-removed-*`, `zh-f-first-*` | Chinese: 为选中内容加书签, 书签已保存, 已有此书签, 已移除书签, the expanded card |

Notes:

- The label shows "Alt Shift M": Chrome on Linux reports the command's key as `Alt+Shift+M`. The
  mockup draws macOS's "⌥⇧M", which Chrome reports on a Mac.
- "Ask ChatGPT" is the fixture's stand-in for ChatGPT's own button, shaped as the live one.
- Privacy: fixture text only; no chat, account or machine data.
