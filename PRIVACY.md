# Privacy policy

Butter for ChatGPT runs only on `chatgpt.com`, and everything it does happens in your browser.

## What it reads

- **Your questions in the open chat.** The history rail reads their text from the page and from
  the conversation responses ChatGPT already loads, so it can show one tick per question and a
  preview on hover. The text is kept in page memory only while the chat is open. It is never saved
  or sent anywhere.
- **Key presses, clicks and scrollbar holds on ChatGPT.** Butter watches for Enter and the send
  button to adjust scrolling before a question is sent, and for scrollbar holds to delay loading
  earlier messages. It does not record or log any of them.

## What it stores

Only your settings: the on/off switches for each optimization and your language choice. They are
saved in `chrome.storage.local` on your device.

## What it sends

Nothing. Butter makes no network requests of its own, has no analytics or tracking, and does not
sell, share or transfer any data. The only request it touches is ChatGPT's own request for earlier
messages: it asks for smaller pages and waits while you hold the scrollbar. It never changes
your messages.

## Contact

Questions: open an issue at <https://github.com/SimianW/butter/issues>.

Last updated: 2026-11-02.
