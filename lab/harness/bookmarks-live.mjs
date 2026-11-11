// Bookmarks on live ChatGPT (#57 / #51, seam 3; the wash: #69, #74), in the live lab. Existing live
// fixture only: never fill a composer or send a prompt. The live lab library owns locking,
// restoration and the send guard; the extension is copied byte-for-byte to a unique, visible
// unpacked install (snap cannot read hidden worktrees), then removed. See bookmarks-live/lab.mjs.
//
// Run: EXT=<this checkout>/extension node lab/harness/bookmarks-live.mjs
// Two suites (bookmarks-live/scenarios.mjs), each a list of scenarios on the shared runner:
// - the matrix (default): the perf lock, LAB_FIXTURE=math12, the Bookmark command bound to
//   Alt+Shift+M in the lab profile (restored after). Held native scrollbar drags with and without
//   bookmarks, a paragraph and a selection bookmarked, jumps after and during a drag and into
//   unloaded earlier history, live resolution after reload, delete, and a list item.
// - MODE=wash: the landing wash (#69, #74) in light and dark theme; no perf lock, no shortcut. Run
//   it with LAB_FIXTURE=demo-en12, whose answers hold long paragraphs and tables.
// `--list` prints both suites' scenarios with the mode each belongs to; ONLY=<name>[,<name>...]
// runs only those of the current mode. Live scenarios can't reset or seed: each runs on what the
// ones before it left, declares what it needs, and is skipped with the reason when that is missing
// (`ONLY` with a later scenario alone gives that skip). The output is a FAIL line per failing check,
// one line per scenario and the cleanup's line; VERBOSE=1 prints every check and the INFO
// measurements. OUT=<dir> (default notes/runs/<today>-bookmarks-live), LAB_FIXTURE, LAB_ROOT,
// REPS=3 and TESTED_HEAD (the commit of a copy run on the lab host without its .git) are optional.
//
// Output is an allowlist of numbers/booleans and public code labels in `<OUT>/summary.json`. No
// text, IDs, URLs, shots, raw CDP coverage, exception messages or account settings are saved in
// the report or printed; a throw's stack goes to /tmp/butter-bookmarks-live-error.txt (mode 0600).
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { liveLauncher, runLive } from './bookmarks-live/harness.mjs';
import { createRecord } from './bookmarks-live/record.mjs';
import { suites } from './bookmarks-live/scenarios.mjs';
import { select } from './runner/index.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODE = process.env.MODE === 'wash' ? 'wash' : 'matrix';
if (process.argv.includes('--list'))
  select(Object.entries(suites).flatMap(([mode, list]) => list.map((s) => ({ ...s, description: `${mode.padEnd(6)}  ${s.description}` }))));
const selected = select(suites[MODE]);

// The lab library, only once a run starts: --list and an unknown ONLY work without the lab.
const L = await import(pathToFileURL(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs')).href);
const record = createRecord({
  out: process.env.OUT || path.join(repo, `notes/runs/${new Date().toISOString().slice(0, 10)}-bookmarks-live`),
  mode: MODE,
  testedHead: process.env.TESTED_HEAD || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
});
const ok = await runLive({
  scenarios: selected,
  record,
  launch: liveLauncher({
    L,
    mode: MODE,
    source: path.resolve(process.env.EXT || path.join(repo, 'extension')),
    fixture: process.env.LAB_FIXTURE || 'math12',
    record,
  }),
});
process.exit(ok && !record.cleanupFailed ? 0 : 1);
