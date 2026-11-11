// Ask in branch fixture QA. Real MV3 extension (content scripts + worker) in its own headless
// Chromium over the synthetic ChatGPT-like page in branch/fixture.mjs. No ChatGPT requests: every
// chatgpt.com request is fulfilled locally, and the run fails if anything else is requested.
// Covers: mockup states 1–5, cancel via ×, Cancel and Esc, each failure type and its card's
// buttons, status reporting, pop-up blocked and a failed hand-over, and the ready and unsure lines
// taking ChatGPT's disclaimer row (covering it until they go) and the ready line's hiding when the
// reply appears.
//
// Run: npm ci && node lab/harness/branch-qa.mjs
// `--list` prints the scenarios with what each checks (branch/scenarios.mjs holds them, in run
// order); ONLY=<name>[,<name>...] runs only those. Each scenario starts from its own declared start
// on fresh pages in the run's one browser, so a scenario alone runs as it does in a full run.
// The output is a FAIL line per failing check and one line per scenario; VERBOSE=1 prints every
// check and the INFO measurements. Every result goes to `<SHOTS>/summary.json`.
// SHOTS=<dir> sets the screenshot directory (default
// notes/runs/2026-11-07-ask-in-branch-29/screenshots; set it to keep that run's committed shots).
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBranch } from './branch/harness.mjs';
import { scenarios } from './branch/scenarios.mjs';
import { runScenarios, select } from './runner/index.mjs';
import { repo } from './runner/chromium.mjs';

const selected = select(scenarios);
const shots = process.env.SHOTS || path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-29/screenshots');
await fs.mkdir(shots, { recursive: true });
const ok = await runScenarios({
  scenarios: selected,
  summary: path.join(shots, 'summary.json'),
  setup: (defer) => launchBranch({ shots, defer }),
});
console.log(`screenshots and summary.json in ${shots}`);
process.exit(ok ? 0 : 1);
