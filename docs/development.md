# Development

| Path | What |
|---|---|
| `extension/` | The extension. |
| `docs/` | User docs, test report, media. |
| `results/` | Result tables from every benchmark run, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Risk review of the extension code. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/butter-<version>.zip`. |
| `CHANGELOG.md` | Versions. |

## Tests

- Unit tests: `node --test` (runs every `*.test.mjs`).
- Version consistency: `python3 scripts/check-version.py`.
- History rail in the lab browser: `lab/harness/nav-jumps.mjs`, `nav-stream.mjs`,
  `nav-switch.mjs`, `nav-video.mjs`; `nav-earlier.mjs` (fixture for far-jump landing and the "earlier" dots, no ChatGPT requests), `nav-earlier-live.mjs` and `nav-settle.mjs` (same checks in an open ChatGPT tab).
  Far-jump timing: `jump-latency.mjs` (phase timings on a long chat), `jump-latency-edge.mjs`,
  `jump-latency-summary.mjs`; takeover deadline fixture: `nav-takeovers.mjs`.

## Release

`python3 scripts/package.py` builds the zip. Version rules are in [AGENTS.md](../AGENTS.md).
