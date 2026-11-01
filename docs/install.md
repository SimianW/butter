# Install and settings

## Install (Windows, macOS, Linux)

1. Download `chatgpt-turbo-<version>.zip` from the
   [releases page](https://github.com/SimianW/chatgpt-turbo/releases) and unzip it. You get a
   `chatgpt-turbo` folder; keep it somewhere permanent, Chrome loads it from there.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `chatgpt-turbo` folder.
4. Reload any open chatgpt.com tabs.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers (version 95 or later). Not in Safari
or Firefox.

## Settings

Settings live in `config.js` inside the extension folder. After editing it, click the reload icon
on the extension card and reload the chatgpt.com tab.

| Setting | Default | What it does |
|---|---|---|
| `smoothMs` | `250` | How often ChatGPT may re-render the answer while it streams, in milliseconds. `0` turns the stream throttle off. |
| `olderPageTurns` | `2` | How many turns ChatGPT loads per request for earlier messages. `0` leaves ChatGPT's own page size. |

## Turning it off

Toggle the extension off on `chrome://extensions` and reload the tab.
