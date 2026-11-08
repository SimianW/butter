# Dev build bug capture (#43): the shortcut saves a bug file to a round folder

Build: `t3/43-dev-capture` at `6c8ff96`, packaged with `python3 scripts/package.py --dev` as
`0.1.0-alpha.15+dev.6`. The run used Playwright's Chromium 156.0.8078.4 on Linux under Xvfb.

`xvfb-run -a node lab/harness/dev-capture-qa.mjs`

The harness loads the unzipped dev zip in its own profile. It serves a synthetic nine-turn chat for
every `chatgpt.com` request and aborts every other request except the local `https://other.test/`
page. No ChatGPT request is sent. The run recorded no foreign requests and no page errors.

## Steps and results

| Step | Result |
|---|---|
| Drag the native scrollbar thumb, release, press Alt+Shift+B | `butter-diag/round-1/bug-01_05-19-10.json`: 13 events (press, seek, release), `pointerHeld: false` |
| Drag again and press Alt+Shift+B while holding | `bug-02_05-19-12.json`: 26 events. The last one is a seek, because the drag was still going. `pointerHeld: true` |
| Keep dragging after that press, then release | Still the same seek session, ended by `pointerup`: the shortcut didn't interrupt the drag |
| Press Alt+Shift+B on `https://other.test/` | The command fired in that tab; nothing saved |
| Press Alt+Shift+B on `https://chatgpt.com/` (not a chat) | The command fired in that tab; nothing saved |
| Back on the chat, press Alt+Shift+B | `bug-03_05-19-18.json` |
| Round state (`chrome.storage.local.butterDev`) | `{ round: 1, bugs: 3 }` |

Each file was checked for: `kind`, `formatVersion` 1, its bug number, round 1, the dev
`version_name`, trigger `shortcut`, normalized settings, a press decision with `schema: 1`, events
oldest first with `t` between −30 000 and 0 ms, and a file-name time that matches `savedAt` in local
time. None of the files contain the fixture's question or answer text, its conversation ID, its turn
or message IDs, or `chatgpt.com`. Files: [bug-01](bug-01_05-19-10.json), [bug-02](bug-02_05-19-12.json),
[summary](summary.json). They come from a synthetic page and contain no private data.

## How the shortcut is pressed

`chrome.commands` ignores keys sent through the DevTools protocol, in both headless and headed mode.
That was checked first, and no command fired. So the harness runs Chromium headed on Xvfb and sends
real X11 key events through XTest (`lab/harness/xtest-keys.py`). The mouse drag still uses
Playwright. A harness-side `onCommand` listener records which tab each press reached. A "nothing
saved" result therefore means the command fired there and the build declined, not that the key went
nowhere.

Chrome does not auto-assign Alt+Shift+B on Linux or Windows, where it is the browser's own
"focus bookmarks bar" key. With no binding set, `chrome.commands.getAll()` reports
`save-bug` with an empty shortcut. The harness therefore seeds the profile with the binding that
`chrome://extensions/shortcuts` would save. On macOS, Option+Shift+B is not a Chrome shortcut, so
Chrome should assign it on install. #47's live check on the Mac confirms that.

## Not covered here

- A real ChatGPT page and a Mac keyboard. These belong to #47.
- The toast, the popup card, `turns`/`usage` and the other event types (#44–#46).
