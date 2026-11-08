# Bug file: full event vocabulary and the four snippets' state (#44)

Build: `t3/44-full-snapshot` after merging the integration branch with #45 (toast) and #46 (popup
card), packaged with `python3 scripts/package.py --dev` as `0.1.0-alpha.15+dev.10`. The run used
Playwright's Chromium 156.0.8078.4 on Linux under Xvfb.

`BUTTER_DEV_MOCKUP=<#32 mockup> xvfb-run -a node lab/harness/dev-capture-qa.mjs`

The mockup is `gh issue artifact download 32 1 -R SimianW/butter`.

The harness loads the unzipped dev zip in its own profile. For every `chatgpt.com` request it
serves the long synthetic chat in `lab/harness/dev-capture-fixture.mjs`, and it aborts every
other request except the local `https://other.test/` page. No ChatGPT request is sent. The run
recorded no foreign requests and no page errors.

The fixture has 140 turns in a stand-in virtualizer fiber. The first 20 are unmounted history and
120 are mounted. The answers hold KaTeX inline and display formulas, headings, lists, code and
links. Every 17th turn has a formula that was never typeset. Before the first drag, the harness
reads through the chat with the wheel, so the layout cache records the turns it shows (64 of 140).

## Files

| Step | File | Result |
|---|---|---|
| Drag, release, press Alt+Shift+B | [bug-01](bug-01_05-55-43.json) | 270 events: record, rejection, press, preview, seek, preview-miss, release, commit, reveal. `pointerHeld: false`. 140 readiness rows, active turn 91 (`last-seek-update`). |
| Drag and press while holding | [bug-02](bug-02_05-55-45.json) | 304 events, the last a seek. `pointerHeld: true`, active turn 125 (`active-preview-update`). The drag continued and ended on `pointerup`. |
| Press on `https://other.test/` and on `https://chatgpt.com/` | none | The command fired in that tab; nothing saved. |
| Back on the chat | bug-03 | Saved (not kept here). |
| Busy session, then press | [bug-04](bug-04_05-56-20.json) | 212 events over 28.8 s, 184,000 bytes. |

The harness checked every file for:

- `turns.order` (140 turns, 120 mounted, fiber found);
- a readiness row for every turn, with recorder status on mounted rows only, and some turns
  recorded and some `math-pending`;
- the active turn matching the last seek, with its structure mounted;
- one `turns.math` row per mounted turn, with one formula missing KaTeX exactly in the planted
  turns;
- `usage.saved`, `usage.store` and `usage.cache` present.

No file holds the fixture's question or answer text, TeX (as written or JSON-escaped), conversation,
turn or message IDs, the planted link, `example.org` or `chatgpt.com`. None matches a UUID prefix,
a 32-hex-digit run or `http`. `redacted` is 0: the sources never pass anything outside the
allowlist. [summary.json](summary.json) holds every measured number below.

The same run passed #45's toast checks on this fixture:

- every save showed its toast, and a held drag continued through it;
- no toast appeared where nothing saved;
- the light and dark toasts differed from the mockup panels in 0 pixels.

Its screenshots are not kept here; see #45's run notes.

## Measurements

| | Result |
|---|---|
| Busy session | 28.9 s of wheel reading and 11 thumb drags of about 2 s each. 212 events: 113 seek, 34 record, 12 preview, 11 each of press, release, commit and reveal, 8 rejection, 1 retarget. That is 7.4 events a second, 3.4 of them not seeks. |
| Event size | 145.8 bytes mean, 185 at most, as serialized lines |
| Seek rate | 3.9 a second in the busy session. A 3 s drag with 228 unawaited protocol mouse moves a second and 60 frames a second still made 6.7 seek updates a second, because the thumb drag itself scrolls that slowly under Xvfb. The caps therefore rest on the bound of one scroll event per frame, 120 a second at 120 Hz, not on this rate. |
| File parts (busy) | `pressDecision` 74,177 bytes, `turns.readiness` 47,579, `turns.math` 19,841, `turns.active` 6,331 (21 structure nodes), `usage` 398 |
| Snapshot cost | 5.4 ms median and 7.4 ms at most to build and serialize in the page (7 runs, 182 KB each) |
| Recording on and off | 3 identical drags with the listeners set and 3 with them cleared, after one warm-up. 19 scroll positions occurred in both sets, and each previewed the same turn, layout and known flag. Every release ended on `pointerup` with a layout destination and 0 px landing error. Update script time was 0.8 ms median and 1.0 ms p95 in both sets. Where a drag ended varied by one or two turns in both sets alike: mouse input timing, not the recorder. |
| `record()` cost | 2.46 µs per seek event on a full buffer (command below) |
| `data:` URL downloads | `chrome.downloads` saved base64 `data:` URLs from 2,097,149 characters (a 1,572,840-byte file, just under the 2 MiB `url::kMaxURLChars`) up to 357,913,973 characters (a 256 MiB file). Chromium 156 enforces no 2 MiB limit on this path. |

```
node -e "
const { createRecorder } = require('./extension/dev/recorder.js');
const r = createRecorder();
const f = { top: 70512.5, turn: 132, offset: 343, layout: true, known: true, items: 14, textFallback: false, renderMs: 0.6000000238418579, jsMs: 0.7999999523162842 };
for (let i = 0; i < 20000; i++) r.record('seek', f, i * 8);
const n = 200000, t0 = performance.now();
for (let i = 0; i < n; i++) r.record('seek', f, 200000 + i * 8);
console.log('record() per seek event:', ((performance.now() - t0) * 1000 / n).toFixed(2), 'us');
"
record() per seek event: 2.46 us
```

## Caps set from these numbers

- `MAX_EVENTS` is 4,000: 120 seeks a second plus 3.4 others for 30 s is about 3,700 events.
- `MAX_BYTES` (events) is 750,000: 3,700 events at 185 bytes is about 690 KB.
- `MAX_FILE_BYTES` (the whole file) is 1,400,000.
  - That keeps the base64 URL under 2 MiB, the most #43 assumed, even though Chromium 156 took far
    more. The tester's Chrome may differ.
  - On a 140-turn chat, a file at the event caps would be about 0.75 MB of events, plus 74 KB
    `pressDecision`, 48 KB readiness and up to 170 KB of turn structure (1,000 nodes).
  - Over the cap, the largest parts become `too-large` first, then the oldest events go, counted in
    `eventsDropped`.

## Not covered here

- A real ChatGPT long chat and a Mac display's seek rate. This run is a fixture only, as the brief
  asked: no ChatGPT requests and no shared lab. #47's live check covers it: a saved file's event
  count over its window gives the real rate.
- The toast (#45) and the popup card (#46).
