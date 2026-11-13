# Privacy policy

Butter for ChatGPT ("Butter") is a Chrome extension that makes long ChatGPT conversations faster to
stream, scroll and navigate. This page explains what Butter reads, what it saves on your computer,
and what it sends.

**In short:** Butter runs only on `chatgpt.com` and works entirely inside your browser. It has no
server and sends nothing to anyone. The only chat text it saves to disk is the first three lines of
each **bookmark** you make, kept on this computer until you delete it. When you use
**Ask in branch**, it hands your selected text and question to the new tab through memory for at
most a minute, and ChatGPT sends your question in the new branch as if you had pressed send.

## What Butter reads

Butter reads the following while a ChatGPT tab is open. It keeps this only in that tab's memory, until
you close or reload the tab; some of it can stay there while you move between chats in the same tab.
The raw ids are never written to disk, and neither is chat text, except the up to three lines of
each bookmark you make; what is written is listed under "What Butter saves". Nothing is sent.

- **The conversation on screen.** Question and answer text, and message and conversation ids, from
  the page and from the responses ChatGPT already loads. Butter uses them to draw the question rail,
  show previews on hover, and show a preview while you drag the scrollbar.
- **Your ChatGPT user id,** from a response ChatGPT already loads. Butter uses it only to keep saved
  layouts of different ChatGPT accounts apart. It is turned into a one-way hash right away (see
  below), and the id itself is never saved.
- **How the chat is laid out on screen:** heights and positions of messages, fonts and widths.
- **Text you select in a ChatGPT reply, and the question you type into Ask in branch.** Butter
  uses them only to ask that question in a new branch of the chat (see "Ask in branch" below).
- **The paragraph or text you bookmark.** When you bookmark, Butter reads where the bookmark is
  (the answer, the paragraph and the selected range) and its first three lines (see "Bookmarks"
  below).
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
first time you open ChatGPT with this version of Butter, a small card asks whether Butter may
remember layouts. It shows while you have not answered and Butter is turned on. Nothing is saved
until you agree. Butter remembers your answer, also across later updates, and you can change it at
any time with the switch in the popup. Saved layouts live in Butter's own database in
the extension (IndexedDB), not in ChatGPT's site storage. For each answer you have viewed, Butter
saves:

- the sizes and positions of its blocks, and its typography (font, size, spacing, colour);
- one-way SHA-256 hashes of your account id, the conversation id and the message ids;
- a SHA-256 hash of the question and answer text, used only to notice when an answer was edited or
  regenerated, so an out-of-date layout is never reused;
- a SHA-256 hash of the layout settings it was measured under (window and column width, screen
  scale, font, theme and ChatGPT's page version), so it is reused only when none of these changed;
- when it was saved and when it was last used.

A saved layout contains no chat text and no raw id. A hash cannot be turned back into the text or id it came from,
but it is not encryption: it stays the same for the same input, so it works as a label for that
account, conversation or message.

Each saved layout expires 30 days after it was saved. Butter stops using it at once and deletes it
from disk the next time it reads or writes saved layouts, so a browser that is not used for a while
can keep expired layouts until then. All saved layouts together are limited to 50 MB; when that is
reached, the ones used least recently are deleted first.

Butter also keeps a few small bookkeeping values that contain no chat or account information, such
as a counter and the ids of recent "clear" requests (for layouts and for bookmarks), so that a clear
is never undone by a late write or done twice by a retry.

**3. Feature status,** in Chrome's session storage (`chrome.storage.session`): which of the four
feature groups recently failed to work, so the popup can warn you. It contains no chat or account
information, and is cleared when that feature works again or when you quit Chrome.

**4. Ask in branch handoff,** in Chrome's session storage (`chrome.storage.session`), which is kept
in memory and never written to disk. When you ask in a branch, Butter opens a new tab and passes it,
through the extension, the text you selected, your question, the original chat's title and its
conversation id. The new tab takes this once and it is deleted at that moment. If the new tab
doesn't take it, it expires after one minute and is deleted the next time the extension runs; it is
also gone when you quit Chrome. Nothing else about the branch is stored.

**5. Bookmarks,** only when you make one, in the same extension database (IndexedDB) but kept
apart from saved layouts. For each bookmark, Butter saves:

- up to the first three lines, and at most 240 characters, of the text you chose: the paragraph you
  bookmarked or the text you selected. This is the only chat text Butter ever saves to disk;
- one-way SHA-256 hashes of your account id, the conversation id, and the message ids of the
  question and the answer, so each account sees only its own bookmarks and the raw ids are never
  saved;
- where it points: the question's number in the chat, the paragraph's number in the answer, the
  character range you selected and the length of its first line;
- when you made it.

Bookmarks stay until you delete them (the × on a bookmark in the rail's card, or **Clear** on the
Bookmarks row in Butter's popup) or remove Butter. They do not expire, are not counted in the 50 MB
layout limit, and are not deleted by the layouts row's **Clear** or by turning off "Remember
long-chat layouts", which only concern layouts. They are never uploaded.

The **Bookmarks** switch in the popup turns bookmarks off: the Bookmark button, the shortcut and the
bookmarks in the question rail go, and nothing new is saved, but the bookmarks you already made are
kept and come back when you switch it on again. The Bookmarks row shows how many bookmarks Butter
holds and about how much space they take, for every ChatGPT account in this browser, whether the
switch is on or off; its **Clear** deletes all of them, for every account in this browser.
Butter also remembers in its settings that you dismissed the first-bookmark notice.

**6. Earlier test builds** kept saved layouts in ChatGPT's site storage. Butter deletes that old
database once, without reading it.

## Ask in branch

When you select text in a ChatGPT reply and choose **Ask in branch**, Butter opens a new tab of the
same chat and, in that tab only, uses ChatGPT's own "Branch in new chat" menu to make a copy of the
conversation. Once it has checked that the tab really shows a different conversation, it types a
quote of your selection and your question into ChatGPT's composer there and presses ChatGPT's send
button. If it can't be sure the tab is a new branch, it fills the text in without sending. Butter
never types into or sends in your original chat. ChatGPT handles the branch and the message as if
you had done these steps yourself.

Turning Butter off in its popup also turns Ask in branch off; then the button doesn't appear.

## How to delete saved data

- **Clear** on the "Remember long-chat layouts" row in Butter's popup deletes all saved layouts, for
  all accounts.
- **Clear** on the Bookmarks row in Butter's popup deletes all bookmarks, for every account in this
  browser. Switching Bookmarks off does not delete them.
- **Turning off "Remember long-chat layouts"** deletes all saved layouts and stops saving new ones.
- **The × on a bookmark** in the question rail's card deletes that bookmark.
- **Removing Butter** from Chrome deletes everything it saved, including bookmarks.

Clearing chatgpt.com's site data in Chrome does not delete saved layouts or bookmarks, because they are stored in
the extension, not on the site.

## What Butter sends

Nothing. Butter makes no network requests of its own and has no analytics, tracking or ads. The only
request it touches is ChatGPT's own request for earlier messages: Butter asks for smaller pages and
waits while you hold the scrollbar. It never changes your messages. It sends a message only when you
use Ask in branch, and then through ChatGPT's own menu and send button in the new branch, never in
your original chat.

## Sharing

Butter does not sell, share or transfer any data, because no data leaves your computer. Butter's use
of the information it handles complies with the Chrome Web Store User Data Policy, including the
Limited Use requirements.

## Changes to this policy

When Butter's data practices change, this page and its date are updated, and Butter tells you inside
the extension before the new practice starts.

## Contact

Questions: open an issue at <https://github.com/SimianW/butter/issues>.

Last updated: 2026-11-13.
