# Development

| Path | What |
|---|---|
| `extension/` | The extension. |
| `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js` | Single-page 320 px popup, bundled fonts, inline SVGs and translations. |
| `extension/shared/status.js` | Pure settings migration, four-group mapping, probes and session-failure merging. |
| `extension/shared/settings.js` | Storage, live off markers and on-request page probes. |
| `docs/` | User docs, test report, media. |
| `results/` | Earlier published result tables, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Historical risk review of the early extension code. |
| `notes/runs/` | Curated lab reports and numeric results; private captures excluded. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/butter-<version>.zip`. |
| `CHANGELOG.md` | Versions. |

The MAIN-world scripts retain their dependency order. `seek/layout-codec.js` supplies the geometry wire format before the single
`seek/layout-cache-main.js`; all consumers still run after it.
`seek/anchor-main.js` supplies semantic landing anchors as well as swap diagnostics.

## Tests

- Unit tests: `node --test` (runs `*.test.js` and `*.test.mjs`; no npm install needed).
- Popup in the lab browser: `node lab/harness/popup-qa.mjs` uses an isolated headless Chromium to capture all 12 states in both themes at 320 px under `/tmp/butter-popup-build/` (set `BUTTER_MOCKUP` to also capture approved references);
  `popup-probes.mjs` checks status failures with a fixture, and `popup-live.mjs` checks live switches
  in an existing chat. The probe/live scripts need `extension/` loaded in the shared lab browser first (see `lab/README.md`); acquire its lock before using them. The QA script starts its own browser.
- Version consistency: `python3 scripts/check-version.py`; packaging tests: `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- History rail in the lab browser: `lab/harness/nav-jumps.mjs`, `nav-stream.mjs`,
  `nav-switch.mjs`, `nav-video.mjs`; `nav-earlier.mjs` (fixture for far-jump landing and the "earlier" dots, no ChatGPT requests), `nav-earlier-live.mjs` and `nav-settle.mjs` (same checks in an open ChatGPT tab).
  Far-jump timing: `jump-latency.mjs` (phase timings on a long chat), `jump-latency-edge.mjs`,
  `jump-latency-summary.mjs`; takeover deadline fixture: `nav-takeovers.mjs`.

## Formatting

Run `npm ci` to install the pinned development formatter, then `npm run format` to format
`extension/**/*.{js,css,html,json}` and `test/**`. Use `npm run format:check` to check them.
`node --test` uses only Node built-ins and still runs without installing npm dependencies.

## Release

`python3 scripts/package.py` builds the zip. Version rules are in [AGENTS.md](../AGENTS.md).
For testing, `python3 scripts/package.py --test <tag>` builds `dist/butter-<version_name>+<tag>.<N>.zip` without changing the source manifest or consuming an alpha number (tag: `[a-z0-9-]+`; numbering starts at 1 per base version and tag).
Test zips retain the base Chrome numeric version; remove the previous install before loading one unpacked.

## Layout storage API

From an extension context (including the popup), use:

```js
await chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-usage' });
// { conversations, bytes } across ALL accounts; expired records are pruned.
const clearRequest = { version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID() };
await chrome.runtime.sendMessage(clearRequest);
// { conversations: 0, bytes: 0 }; settings remain, delayed writes are fenced.
```

`conversations` counts distinct account/conversation pairs, not layouts or turns. `bytes` is the
UTF-8 serialized size of the stored rows including metadata, excluding IndexedDB/index overhead.
Failures return `{ error: 'layout-storage' }`; unsupported protocol versions return
`{ error: 'layout-protocol' }`. Retry a closed port/storage error up to three times with the same
request (including the same clear `requestId`), then show an unavailable state. These are
runtime messages, never page events. The service worker also handles version-1 internal `butter-layout-load`
(account + conversation SHA-256 hashes) and `butter-layout-put` (same hashes, compact records and the
load's generation). Unknown identities are rejected. An external extension cannot call the API.

Protocol v1:

| Request `type` | Additional fields | Successful response |
|---|---|---|
| `butter-layout-usage` | None | `{ conversations, bytes }` |
| `butter-layout-clear` | `requestId`: random UUID, reused on retry | `{ conversations: 0, bytes: 0 }` for that operation |
| `butter-layout-load` | `account`, `conv`: SHA-256 hashes | `{ generation, records }` for that partition |
| `butter-layout-put` | Same hashes, `generation` from load, compact `records` | `{ conversations, bytes }`; `{}` when an old generation is fenced |

All requests include `version: 1`. Unknown identities or layout-off produce no geometry reads or
writes. Clear ids are durably deduplicated for the latest 64 clear operations. Retrying clear gets
its original result; query usage again if subsequent measurements may already have saved data.

`layoutConsent` starts as `pending`, and `ButterStatus.normalize` keeps `opts.layout` false
unless consent is `granted` and the saved layout option is not false. Persisted reads/writes
require both. The in-page card asks first; the popup switch also records consent. While pending,
usage reports zero and no layout data is saved. Setting layout false deletes layouts for all
accounts and stops reads/writes; it is independent of the master optimization switch.
The popup shows usage below Remember long-chat layouts and confirms Clear inline.
Clear preserves settings, the migration marker and bounded non-content control metadata
(generation and the latest 64 clear-operation ids). Clear retires disk-backed memory in open tabs; newly measured geometry can
save again while the setting is on. Set the option false for a persistent opt-out.

## Popup settings and status

The four switches map to `container + cv + throttle` (streaming), `older + seek` (scrolling),
`rail`, and `layout`. A switch is on only when all its keys are on; toggling writes every key
in that group. Normalization defaults the new `seek` key to true and preserves saved values
and unknown settings. All settings continue to apply live.

The master status says working when the active tab's content script answers, open a chat when
no receiver answers, and paused when disabled. Feature probes have neutral internal evidence
until exercised; neutral evidence has no popup badge. Exercised failures are merged by the
worker into `chrome.storage.session.butterFailures`, keyed by group and failed feature. Switching
chats or disabling a setting preserves them; successful engagement of the failed feature removes
its record. Browser shutdown clears session records. The worker serializes probe merges so
concurrent tabs cannot overwrite each other's failures.

Send pre-jump is in `rail/rail.js` but its existing `beforeSend` handler does not test `railOff`;
it continues independently of the rail setting. Latest-question prediction belongs to the rail
presentation and is hidden with it. These behaviors are unchanged.

The popup uses the layout runtime API above, retries the same request three times, and retains
the same UUID when retrying clear. Clear confirms inline and shows completion for two seconds.
Usage uses decimal KB/MB and the 50,000,000-byte payload cap. Layout-off still deletes saved
layouts through the existing worker listener. See `design/icon/REGENERATING.md` for icon regeneration.
