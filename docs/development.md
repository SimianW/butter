# Development

| Path | What |
|---|---|
| `extension/` | The extension. |
| `extension/popup/popup.html`, `popup/popup.css`, `popup/popup.js` | Toolbar popup, bundled Lucide SVGs and translations. |
| `extension/shared/status.js` | Pure settings defaults and status classification, shared with the popup. |
| `extension/shared/settings.js` | Storage, live off markers and on-request page probes. |
| `docs/` | User docs, test report, media. |
| `results/` | Result tables from every benchmark run, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Risk review of the extension code. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/butter-<version>.zip`. |
| `CHANGELOG.md` | Versions. |

The MAIN-world scripts retain their dependency order. `seek/layout-codec.js` supplies the geometry wire format before the single
`seek/layout-cache-main.js`; all consumers still run after it.
`seek/anchor-main.js` supplies semantic landing anchors as well as swap diagnostics.

## Tests

- Unit tests: `node --test` (runs `*.test.js` and `*.test.mjs`; no npm install needed).
- Popup in the lab browser: `node lab/harness/popup-qa.mjs` captures every mockup state;
  `popup-probes.mjs` checks status failures with a fixture, and `popup-live.mjs` checks live switches
  in an existing chat. Load `extension/` in the lab browser first (see `lab/README.md`).
- Version consistency: `python3 scripts/check-version.py`.
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

## Layout storage API

From an extension context (including the upcoming popup), use:

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

`butter.opts.layout` defaults to true in `ButterStatus.normalize`. Setting it false deletes layouts
for all accounts and stops reads/writes; it is independent of the master optimization switch.
The popup UI is unchanged in this step. Until its controls arrive, service worker DevTools can use
`await handle({type: 'butter-layout-usage'})` and `await handle({type: 'butter-layout-clear'})`.
Clear preserves settings, the migration marker and bounded non-content control metadata
(generation and the latest 64 clear-operation ids). Clear retires disk-backed memory in open tabs; newly measured geometry can
save again while the setting is on. Set the option false for a persistent opt-out.
