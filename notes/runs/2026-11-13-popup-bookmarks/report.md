# Popup: Bookmarks switch, size and Clear (#108), real UI against the mockup

**Question:** does the built popup match the approved mockup (`mockups/popup-bookmarks.html`)
panel for panel, and does every state stay at or under Chrome's 600 px popup cap in English and
in Chinese?

**Build:** branch `t3/popup-bookmarks-toggle-storage` (0.1.0-alpha.21 manifest, unbumped), the
unpacked extension in Playwright's Chromium (Playwright 1.65.0, Node 24), headless.

**Run:** `MOCKUP=mockups/popup-bookmarks.html node lab/harness/popup-bookmarks-shots.mjs`. The
script opens `popup/popup.html` from the extension at 360 px, seeds each state through the
extension's own worker and settings, and fakes only the active-tab probe (so the master line says
"Working in this chat", as in the mockup). The stores hold synthetic fixture rows only: 12
bookmarks over two fixture accounts (fixture excerpts, no chat text) and 14 chats of synthetic
layout geometry. No ChatGPT page and no private data.

## Result

Every panel's boxes (header, master card, card, every row, second lines, Clear, pills, note,
footer; relative to the popup) match the mockup's at zoom 1 to within 1 px. Every state is at most
600 px in both languages; the tallest is 594 px in English, as the spec budgeted.

| Panel | State | Height, English | Height, Chinese | Boxes vs mockup |
|---|---|---|---|---|
| [`after`](after.png) | Everything on; 12 bookmarks and 14 chats of layouts saved | 524 px | 524 px | match |
| [`after-empty`](after-empty.png) | Everything on; nothing saved | 524 px | 524 px | match |
| [`after-confirm`](after-confirm.png) | Clear on Bookmarks clicked: the question | 524 px | 524 px | match |
| [`after-confirm-layouts`](after-confirm-layouts.png) | Clear on layouts clicked: the question | 524 px | 524 px | match |
| [`after-cleared`](after-cleared.png) | Bookmarks just cleared (held at "Cleared") | 524 px | 524 px | match |
| [`after-off`](after-off.png) | Bookmarks switched off, 12 still saved | 524 px | 524 px | match |
| [`after-dark`](after-dark.png) | As `after`, dark theme | 524 px | 524 px | match |
| [`after-tallest`](after-tallest.png) | Layout consent pending (its note shows), 12 bookmarks saved | 594 px | 577 px | match |
| [`extra-paused`](extra-paused.png) | Butter paused: the whole card greys, Clear and switches stay usable | 524 px | 524 px | not in mockup |
| [`extra-needs-rail`](extra-needs-rail.png) | Question rail off, Bookmarks on, nothing saved | 524 px | 524 px | not in mockup |

The mockup's own panels measure 523.2 px (593.5 px for `after-tallest`); the built popup rounds
up to whole pixels. `heights.json` holds every number and the box comparison.

## Differences from the mockup

- **Bookmark size.** The mockup says "12 saved, about 4 KB". Twelve real bookmark rows are at
  least about 6 KB, because each stored row is about 500 to 560 bytes as JSON (its key repeats
  the hashed account, conversation and message ids). The shots show the real size, "12 saved,
  about 7 KB". The text box is the same width, so the Clear button's place still matches.
- **The gap before Clear.** The spec says Clear sits "8 px after the size". The mockup renders a
  word space plus the 8 px margin (about 11 px), and the build matches the mockup.
- **The confirm row.** In the mockup it is a `<label>`; built, it is a `<div>`, because a label
  around the two pills would turn a click anywhere on the row into a click on the red Clear. It
  looks the same, with the default cursor.

## Not shown

"Unavailable" (usage can't be read or a clear failed) needs a failing worker, so it is covered by
the popup unit tests (`test/popup-storage.test.cjs`), not shot. The 2 s "Cleared" timing and Clear
removing the dots in an open tab are checked by `lab/harness/bookmarks-qa.mjs` (`popup-clear`).
