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

The MAIN-world scripts retain their dependency order. `shared/config-main.js` also sets
the layout-storage build option formerly loaded separately; all consumers still run after it.
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
