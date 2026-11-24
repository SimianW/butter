// New chat fixture QA (#163). The real MV3 extension in its own Chromium over the synthetic
// ChatGPT-shaped page in new-chat/fixture.mjs: a project page, chats in and out of a project, the
// home page and Temporary Chat, with a client-side router that leaves the old view hidden, as
// ChatGPT does. No ChatGPT requests: every chatgpt.com request is answered locally, and the run
// fails if anything else is requested.
// Covers the spec's fixture cases: a project chat → its project page; a normal chat, a custom
// GPT's chat → /; a Temporary Chat with turns → a new Temporary Chat; on a fresh project page, /
// and Temporary Chat with typed text, the URL and text stay and the composer gets focus; in Work
// mode and with Butter paused, nothing changes. Each case also checks that the page never saw the
// key (the fixture types it into the composer as ChatGPT's type-to-focus handler would).
//
// Run: npm ci && xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/new-chat-qa.mjs
// The key (Alt+Shift+O) must be real keyboard input (chrome.commands ignores DevTools key events):
// with an X display the browser runs headed and xtest-keys.py presses it. Without a display the
// worker relays the command instead, and the run says so.
// `--list` prints the scenarios (new-chat/scenarios.mjs); ONLY=<name>[,<name>...] runs only those.
// The output is a FAIL line per failing check and one line per scenario; VERBOSE=1 prints every
// check. Every result goes to `<SHOTS>/summary.json` (SHOTS defaults to /tmp/butter-new-chat-qa).
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchNewChat } from './new-chat/harness.mjs';
import { scenarios } from './new-chat/scenarios.mjs';
import { headed } from './runner/chromium.mjs';
import { runScenarios, select } from './runner/index.mjs';

const selected = select(scenarios);
console.log(headed ? 'the new-chat key is pressed as X input (xtest-keys.py)' : 'no X display: the worker relays the new-chat command');
const shots = process.env.SHOTS || '/tmp/butter-new-chat-qa';
await fs.mkdir(shots, { recursive: true });
const ok = await runScenarios({
  scenarios: selected,
  summary: path.join(shots, 'summary.json'),
  setup: (defer) => launchNewChat({ defer, keys: headed }),
});
process.exit(ok ? 0 : 1);
