# Install and settings

## Install (Windows, macOS, Linux)

1. Download `butter-<version>.zip` from the
   [releases page](https://github.com/SimianW/butter/releases) and unzip it. You get a
   `butter` folder; keep it somewhere permanent, Chrome loads it from there.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `butter` folder.
4. Reload any open chatgpt.com tabs.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers (version 95 or later). Not in Safari
or Firefox.

## Settings

Click Butter's toolbar icon to open the popup. **Status & settings** checks the five optimizations
live on the current ChatGPT tab. Each has its own switch; changes apply to all ChatGPT tabs
immediately. **Not yet checked** means the page has not exercised that optimization yet.
Choose **English** or **中文** at the bottom; the question rail uses the same language. Butter
stores these switch and language settings locally in Chrome.

Numeric settings live in `shared/config-main.js` inside the extension folder. After editing it, click the reload icon
on the extension card and reload the chatgpt.com tab.

| Setting | Default | What it does |
|---|---|---|
| `smoothMs` | `250` | How often ChatGPT may re-render the answer while it streams, in milliseconds. `0` turns the stream throttle off. |
| `olderPageTurns` | `2` | How many turns ChatGPT loads per request for earlier messages. `0` leaves ChatGPT's own page size. |

## Turning it off

Turn off **Enable on ChatGPT** in the popup to pause every optimization immediately. Turn it back
on to resume with your individual switch settings. You can also disable the extension on
`chrome://extensions` and reload the tab.
