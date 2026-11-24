// Ask in branch fixture QA. Real MV3 extension (content scripts + worker) in its own headless
// Chromium over the synthetic ChatGPT-like page in branch/fixture.mjs. No ChatGPT requests: every
// chatgpt.com request is fulfilled locally, and the run fails if anything else is requested.
// Covers: mockup states 1–5, cancel via ×, Cancel and Esc, each failure type and its card's
// buttons, status reporting, pop-up blocked and a failed hand-over, and the ready and unsure lines
// taking ChatGPT's disclaimer row (covering it until they go) and the ready line's hiding when the
// reply appears.
//
// Run: npm ci && node lab/harness/branch-qa.mjs
// The `shortcut` scenario presses the `branch` command's key (Alt+Shift+Q), which must be real
// keyboard input (chrome.commands ignores DevTools key events): run it under an X display, as
//   ONLY=shortcut xvfb-run -n 201 -s '-screen 0 1600x1000x24' node lab/harness/branch-qa.mjs
// (a fixed display away from the labs' :98 and :99: `-a` takes one of them while that lab is stopped)
// and the browser runs headed while xtest-keys.py presses the key. A run that also selects other
// scenarios, or has no display, stays headless as before, and the worker relays the command instead
// (the run says which).
// `--list` prints the scenarios with what each checks (branch/scenarios.mjs holds them, in run
// order); ONLY=<name>[,<name>...] runs only those. Each scenario starts from its own declared start
// on fresh pages in the run's one browser, so a scenario alone runs as it does in a full run.
// The output is a FAIL line per failing check and one line per scenario; VERBOSE=1 prints every
// check and the INFO measurements. Every result goes to `<SHOTS>/summary.json`.
// SHOTS=<dir> sets the screenshot directory (default /tmp/butter-branch-qa); set
// SHOTS=notes/runs/2026-11-07-ask-in-branch-29/screenshots to refresh that run's committed shots.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBranch } from './branch/harness.mjs';
import { scenarios } from './branch/scenarios.mjs';
import { headed } from './runner/chromium.mjs';
import { runScenarios, select } from './runner/index.mjs';

const selected = select(scenarios);
// Headed only for a run of key-pressing scenarios alone: every other scenario keeps the headless run
// it was written for.
const keys = headed && selected.length > 0 && selected.every((s) => s.keys);
if (selected.some((s) => s.keys))
  console.log(keys ? 'the branch key is pressed as X input (xtest-keys.py)' : 'no X display: the worker relays the branch command');
const shots = process.env.SHOTS || '/tmp/butter-branch-qa';
await fs.mkdir(shots, { recursive: true });
const ok = await runScenarios({
  scenarios: selected,
  summary: path.join(shots, 'summary.json'),
  setup: (defer) => launchBranch({ shots, defer, keys }),
});
console.log(`screenshots and summary.json in ${shots}`);
process.exit(ok ? 0 : 1);
