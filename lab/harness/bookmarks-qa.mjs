// Bookmarks fixture QA (#52). The real MV3 extension in its own Chromium over a synthetic
// ChatGPT chat: every chatgpt.com request is answered locally (the page, /backend-api/me and the
// conversation's messages, which Butter's own fetch hook reads), and the run fails if anything
// else is requested. No ChatGPT requests.
// The fixture draws ChatGPT's own "Ask ChatGPT" below a selection in an answer, and a "More
// actions" button per turn, so that Butter's selection pill (#77) shows Ask in branch and Bookmark.
//
// Run: npm ci && xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/bookmarks-qa.mjs
// `--list` prints the scenarios with what each checks (bookmarks/scenarios.mjs holds them, in run
// order); ONLY=<name>[,<name>...] runs only those. Each scenario starts from its own declared
// start on a fresh page in the run's one browser, so a scenario alone runs as it does in a full run.
// The output is a FAIL line per failing check and one line per scenario; VERBOSE=1 prints every
// check. Every result goes to `<SHOTS>/<markup>/summary.json`.
//
// The run covers both answer markups, each in its own browser: MARKUP=old has the earlier wrapper,
// [data-message-author-role="assistant"][data-message-id]; MARKUP=live renders answers as live chats
// do (notes/runs/2026-11-08-bookmarks-live), with no role or message id on any message and the
// answer's ancestor carrying data-chatgpt-selection-message-id and -conversation-id. MARKUP=old or
// MARKUP=live runs only that one.
// SHOTS=<dir> sets the screenshot directory (default /tmp/butter-bookmarks-qa); each markup writes
// to its own subdirectory.
// The shortcut must be real keyboard input (chrome.commands ignores DevTools key events): with an X
// display the browser runs headed and xtest-keys.py presses the key, so run it under xvfb-run as
// above. Without a display the run asks the worker to relay the command instead and says so.
// Mockup comparisons, when given: BUTTER_BOOKMARKS_DOT_MOCKUP=<#69's 1-Mockup.html> (card, dot*,
// wash-mockup), BUTTER_BOOKMARKS_EARLIER_MOCKUP=<#51's 2-Earlier-history-mockup.html>
// (earlier-shots), and BUTTER_BOOKMARKS_MOCKUP=<#51's 1-Mockup.html> (stale); see bookmarks/mockup.mjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBookmarks } from './bookmarks/harness.mjs';
import { scenarios } from './bookmarks/scenarios.mjs';
import { runScenarios, select } from './runner/index.mjs';

const selected = select(scenarios);
const MARKUPS = ['old', 'live'];
const { MARKUP } = process.env;
if (!MARKUP) {
  const failed = [];
  for (const markup of MARKUPS) {
    console.log(`== markup: ${markup}`);
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
        stdio: 'inherit',
        env: { ...process.env, MARKUP: markup },
      });
    } catch {
      failed.push(markup);
    }
  }
  console.log(failed.length ? `FAIL markup: ${failed.join(', ')}` : `markups passed: ${MARKUPS.join(', ')}`);
  process.exit(failed.length ? 1 : 0);
}
if (!MARKUPS.includes(MARKUP)) {
  console.error(`MARKUP is one of ${MARKUPS.join(', ')}`);
  process.exit(2);
}
const shots = path.join(process.env.SHOTS || '/tmp/butter-bookmarks-qa', MARKUP);
await fs.mkdir(shots, { recursive: true });
const ok = await runScenarios({
  scenarios: selected,
  summary: path.join(shots, 'summary.json'),
  setup: (defer) => launchBookmarks({ markup: MARKUP, shots, defer }),
});
console.log(`screenshots and summary.json in ${shots}`);
process.exit(ok ? 0 : 1);
