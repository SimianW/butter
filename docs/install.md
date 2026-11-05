# Install and settings

## From the Chrome Web Store

[Add to Chrome](https://chromewebstore.google.com/detail/butter-for-chatgpt/fedpfgnghhahjkkcdeepohabigdjfhif),
then reload any open chatgpt.com tabs. Store installs receive updates automatically.

Works on Windows, macOS and Linux in Chrome, Edge, Brave, Arc and other Chromium browsers
(version 95 or later). Not in Safari or Firefox.

## Or install manually

1. Download `butter-<version>.zip` from the
   [releases page](https://github.com/SimianW/butter/releases) and unzip it. You get a
   `butter` folder; keep it somewhere permanent, Chrome loads it from there.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `butter` folder.
4. Reload any open chatgpt.com tabs.

For manual updates, download and unzip the new release, replace the installed folder, click the
reload icon on its extension card, then reload ChatGPT. Keep the folder at the same location.

## Settings

Click Butter's toolbar icon to open the popup. **Enable Butter** pauses or resumes the extension.
Four switches control **Smoother streaming**, **Smoother scrolling** (including drag preview),
**Question rail**, and **Remember long-chat layouts**. Changes apply to all open ChatGPT tabs
immediately. Status shows whether Butter is working in this chat, paused, or waiting for a chat.
A feature warning appears only after a failure is observed; an unused feature has no warning.

Choose **English** or **中文** at the top; the question rail uses the same language. Switch and
language settings stay in your browser.

Saved layouts are optional: Butter asks for permission in ChatGPT before saving any. After consent,
you can change this in the popup. Layout data contains numbers, formatting and one-way hashes,
never chat text; it expires after 30 days and is capped at 50 MB. The popup shows storage use and
an inline-confirmed **Clear** action. Clear deletes saved layouts for all accounts; new ones can
save again while the option is on. Turning the option off deletes saved layouts and stops saving.
See the [privacy policy](../PRIVACY.md).

Numeric settings live in `shared/config-main.js` inside the extension folder. After editing it, click the reload icon
on the extension card and reload the chatgpt.com tab.

| Setting | Default | What it does |
|---|---|---|
| `smoothMs` | `250` | How often ChatGPT may re-render the answer while it streams, in milliseconds. `0` turns the stream throttle off. |
| `olderPageTurns` | `2` | How many turns ChatGPT loads per request for earlier messages. `0` leaves ChatGPT's own page size. |

## Turning it off

Turn off **Enable Butter** in the popup to pause every optimization immediately. Turn it back
on to resume with your individual switch settings. You can also disable the extension on
`chrome://extensions` and reload the tab.
