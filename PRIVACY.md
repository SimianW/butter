# Privacy policy

Butter for ChatGPT ("Butter") is a Chrome extension that makes long ChatGPT conversations faster to
stream, scroll and navigate. This page explains what Butter reads, what it saves on your computer,
and what it sends.

**In short:** Butter runs only on `chatgpt.com` and works entirely inside your browser. It never
saves the text of your chats, has no server, and sends nothing to anyone.

## What Butter reads

Butter reads the following while a ChatGPT tab is open. It keeps this only in that tab's memory, until
you close or reload the tab; some of it can stay there while you move between chats in the same tab.
The chat text and the raw ids are never written to disk; only the numbers and one-way hashes
described under "What Butter saves" are. Nothing is sent.

- **The conversation on screen.** Question and answer text, and message and conversation ids, from
  the page and from the responses ChatGPT already loads. Butter uses them to draw the question rail,
  show previews on hover, and show a preview while you drag the scrollbar.
- **Your ChatGPT user id,** from a response ChatGPT already loads. Butter uses it only to keep saved
  layouts of different ChatGPT accounts apart. It is turned into a one-way hash right away (see
  below), and the id itself is never saved.
- **How the chat is laid out on screen:** heights and positions of messages, fonts and widths.
- **Key presses, clicks and scrollbar holds on ChatGPT.** Butter reacts to Enter and the send button
  to adjust scrolling before a question is sent, and to scrollbar holds to delay loading earlier
  messages. To tell whether the scrollbar preview works, it keeps a short rolling list of recent
  scrollbar drags in the tab's memory: when you pressed and let go, where the pointer was, and how the
  drag ended. This list is never saved or sent, and it is gone when the tab closes.

Butter never reads passwords, sign-in tokens, cookies or payment details, and it does not run on any
other website.

## What Butter saves on your computer

**1. Your settings,** in Chrome's extension storage (`chrome.storage.local`): the on/off switches
and the language.

**2. Saved layouts,** only after you agree and only while "Remember long-chat layouts" is on. The
first time you open ChatGPT after installing or updating Butter, a small card asks whether Butter
may remember layouts. Nothing is saved until you agree, and Butter remembers your answer; you can
change it at any time with the switch in the popup. Saved layouts live in Butter's own database in
the extension (IndexedDB), not in ChatGPT's site storage. For each answer you have viewed, Butter
saves:

- the sizes and positions of its blocks, and its typography (font, size, spacing, colour);
- one-way SHA-256 hashes of your account id, the conversation id and the message ids;
- a SHA-256 hash of the question and answer text, used only to notice when an answer was edited or
  regenerated, so an out-of-date layout is never reused;
- a SHA-256 hash of the layout settings it was measured under (window and column width, screen
  scale, font, theme and ChatGPT's page version), so it is reused only when none of these changed;
- when it was saved and when it was last used.

No chat text and no raw id is saved. A hash cannot be turned back into the text or id it came from,
but it is not encryption: it stays the same for the same input, so it works as a label for that
account, conversation or message.

Each saved layout expires 30 days after it was saved. Butter stops using it at once and deletes it
from disk the next time it reads or writes saved layouts, so a browser that is not used for a while
can keep expired layouts until then. All saved layouts together are limited to 50 MB; when that is
reached, the ones used least recently are deleted first.

Butter also keeps a few small bookkeeping values that contain no chat or account information, such
as a counter and the ids of recent "clear" requests, so that a clear is never undone by a late write.

**3. Feature status,** in Chrome's session storage (`chrome.storage.session`): which of the four
feature groups recently failed to work, so the popup can warn you. It contains no chat or account
information, and is cleared when that feature works again or when you quit Chrome.

**4. Earlier test builds** kept saved layouts in ChatGPT's site storage. Butter deletes that old
database once, without reading it.

## How to delete saved data

- **Clear** next to the storage use in Butter's popup deletes all saved layouts, for all accounts.
- **Turning off "Remember long-chat layouts"** deletes all saved layouts and stops saving new ones.
- **Removing Butter** from Chrome deletes everything it saved.

Clearing chatgpt.com's site data in Chrome does not delete saved layouts, because they are stored in
the extension, not on the site.

## What Butter sends

Nothing. Butter makes no network requests of its own and has no analytics, tracking or ads. The only
request it touches is ChatGPT's own request for earlier messages: Butter asks for smaller pages and
waits while you hold the scrollbar. It never changes or sends your messages.

## Sharing

Butter does not sell, share or transfer any data, because no data leaves your computer. Butter's use
of the information it handles complies with the Chrome Web Store User Data Policy, including the
Limited Use requirements.

## Changes to this policy

When Butter's data practices change, this page and its date are updated, and Butter tells you inside
the extension before the new practice starts.

## Contact

Questions: open an issue at <https://github.com/SimianW/butter/issues>.

Last updated: 2026-11-03.
