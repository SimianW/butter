// Dev build bug capture (#43) in a real Chromium, with no ChatGPT requests. Builds the dev zip
// (python3 scripts/package.py --dev) unless BUTTER_DEV_ZIP names one, loads it unpacked in its
// own profile, and serves a synthetic chat for every chatgpt.com request (anything else is
// aborted, except the local https://other.test/ page). Then: drag the scrollbar thumb and
// release, press the shortcut (bug-01), drag again and press it while holding (bug-02), and
// press it on another tab and on ChatGPT's home page (nothing saved). Checks the files Chrome
// wrote to a temporary Downloads folder.
//
// The shortcut must be real keyboard input: chrome.commands ignores keys sent through the
// DevTools protocol. So this runs headed on a virtual X display and presses Alt+Shift+B through
// XTest (xtest-keys.py). Chrome does not auto-assign Alt+Shift+B on Linux or Windows, where it
// is the browser's "focus bookmarks bar" key, so the profile is seeded with the binding that
// chrome://extensions/shortcuts would save.
//
// Run: npm ci --prefix lab/harness && xvfb-run -a node lab/harness/dev-capture-qa.mjs
// OUT=<dir> overrides where the saved files and summary go
// (default notes/runs/2026-11-08-dev-capture-43/).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)),
  repo = path.resolve(here, '../..');
const out = process.env.OUT || path.join(repo, 'notes/runs/2026-11-08-dev-capture-43');
if (!process.env.DISPLAY) throw new Error('needs an X display: xvfb-run -a node ' + process.argv[1]);

// ---- the dev build, unzipped ----
const zip =
  process.env.BUTTER_DEV_ZIP ||
  execFileSync('python3', [path.join(repo, 'scripts/package.py'), '--dev'], { encoding: 'utf8' })
    .split('\n')[0]
    .trim();
const unpacked = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-dev-unpacked-'));
execFileSync('python3', [
  '-I',
  '-c',
  'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
  zip,
  unpacked,
]);
const extension = path.join(unpacked, 'butter');
const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
assert.match(manifest.version_name, /\+dev\.\d+$/);
// Chrome's id for an unpacked extension: SHA-256 of its path, first 32 hex digits mapped to a–p.
const extensionId = [
  ...crypto.createHash('sha256').update(extension).digest('hex').slice(0, 32),
]
  .map((h) => String.fromCharCode(97 + parseInt(h, 16)))
  .join('');

// ---- a fresh profile: Downloads folder, no Save As, and the shortcut binding ----
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-dev-profile-'));
const downloads = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-dev-downloads-'));
await fs.mkdir(path.join(profile, 'Default'));
await fs.writeFile(
  path.join(profile, 'Default', 'Preferences'),
  JSON.stringify({
    download: { default_directory: downloads, prompt_for_download: false },
    extensions: {
      commands: {
        'linux:Alt+Shift+B': { command_name: 'save-bug', extension: extensionId, global: false },
      },
    },
  }),
);
const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    '--window-position=0,0',
  ],
  // Real scrollbars: the drag presses the native thumb.
  ignoreDefaultArgs: ['--hide-scrollbars'],
});

// ---- synthetic pages ----
const CONV = '0f3c6a2e-5b1d-4e7a-9c3b-2a6d8e1f4b70';
const QUESTION = 'Fixture question about the binomial theorem',
  ANSWER = 'Fixture answer paragraph with enough words to wrap across the column.';
const TURNS = 9;
const chatHtml = () => `<!doctype html><html><head><title>Fixture chat</title><style>
body { margin:0; font:16px/26px sans-serif; background:#fff; color:#111 }
.thread-scroll-container { height:100vh; overflow-y:scroll; overflow-anchor:none }
.content { padding:48px 160px 400px }
[data-turn-key] { display:block; height:1600px; box-sizing:border-box }
[data-user-message-bubble] { margin:14px 0 14px auto; width:fit-content; padding:8px 14px; background:#f4f4f4; border-radius:18px }
</style></head><body><div class="thread-scroll-container"><div class="content">${Array.from(
  { length: TURNS },
  (_, i) =>
    `<div><article data-turn-key="t${i + 1}"><div data-user-message-bubble>${QUESTION} ${i + 1}</div>` +
    `<div data-markdown-text-style="assistant-message">${`<p>${ANSWER}</p>`.repeat(20)}</div></article></div>`,
).join('')}</div></div><script>
// The conversation data the history hook would deliver: turn order for the seek model.
const messages = [];
for (let i = 1; i <= ${TURNS}; i++)
  messages.push(
    { id: 't' + i, author: { role: 'user' }, content: { parts: [${JSON.stringify(QUESTION)} + ' ' + i] } },
    { id: 'a' + i, author: { role: 'assistant' }, content: { parts: [${JSON.stringify(ANSWER)}] } },
  );
document.dispatchEvent(new CustomEvent('butter-seek-data', {
  detail: { conv: ${JSON.stringify(CONV)}, before: false, j: { messages } },
}));
</script></body></html>`;
const plainHtml = (title) =>
  `<!doctype html><title>${title}</title><body style="font:16px sans-serif">${title}</body>`;
const foreign = [],
  errors = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === 'chatgpt.com')
    return route.fulfill({
      contentType: 'text/html',
      body: url.pathname.startsWith('/c/') ? chatHtml() : plainHtml('ChatGPT home fixture'),
    });
  if (url.hostname === 'other.test')
    return route.fulfill({ contentType: 'text/html', body: plainHtml('Another site') });
  foreign.push(url.href);
  return route.abort();
});
const worker =
  context.serviceWorkers().find((w) => w.url().includes(extensionId)) ||
  (await context.waitForEvent('serviceworker'));
assert.equal(new URL(worker.url()).pathname, '/dev/worker.js');
await worker.evaluate(
  (butter) => chrome.storage.local.set({ butter }),
  { enabled: true, lang: 'en', layoutConsent: 'declined' },
);
const commands = await worker.evaluate(() => chrome.commands.getAll());
assert.equal(commands.find((c) => c.name === 'save-bug')?.shortcut, 'Alt+Shift+B');

// Harness-side witness (not product code): which tab each command reached, so "saved nothing"
// means the command fired there and the build declined, not that the key went nowhere.
await worker.evaluate(() =>
  chrome.commands.onCommand.addListener((command, tab) => {
    self.qaCommands = [...(self.qaCommands || []), { command, tab: tab?.id ?? null }];
  }),
);
const commandLog = () => worker.evaluate(() => self.qaCommands || []);
const activeTab = () =>
  worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
const pass = (msg) => console.log(`PASS ${msg}`);
const files = async () =>
  (await fs.readdir(downloads, { recursive: true })).filter((f) => f.endsWith('.json')).sort();
// Real keyboard input on the X display. The first call parks the X pointer inside the window,
// since X focus follows the pointer without a window manager; later calls must not move it, or
// Chrome would see a buttonless mousemove and end the held drag.
let parked = false;
const shortcut = async (page) => {
  const before = (await files()).length;
  execFileSync('python3', [
    path.join(here, 'xtest-keys.py'),
    'Alt+Shift+B',
    ...(parked ? [] : ['640', '400']),
  ]);
  parked = true;
  await page.waitForTimeout(1500);
  return (await files()).length - before;
};
const waitForFiles = async (n) => {
  for (let i = 0; i < 50 && (await files()).length < n; i++) await new Promise((r) => setTimeout(r, 100));
  return files();
};

// ---- a ChatGPT chat: drag, release, save; drag, save while holding ----
const page = await context.newPage();
// Playwright saves downloads under GUID names in its own folder; hand them back to Chrome, so
// chrome.downloads names and places the file as it would for a user.
await (await context.newCDPSession(page)).send('Browser.setDownloadBehavior', { behavior: 'default' });
await page.goto(`https://chatgpt.com/c/${CONV}`);
await page.locator('[data-turn-key="t9"]').waitFor({ state: 'attached' });
await page.bringToFront();
await page.waitForTimeout(500);
const bar = await page.evaluate(() => {
  const s = document.querySelector('.thread-scroll-container'),
    r = s.getBoundingClientRect();
  return { x: r.right - (s.offsetWidth - s.clientWidth) / 2, top: r.top, width: s.offsetWidth - s.clientWidth };
});
assert.ok(bar.width > 0, 'classic scrollbar present');
const drag = async (fromY, toY) => {
  await page.mouse.move(bar.x, fromY);
  await page.mouse.down();
  await page.mouse.move(bar.x, toY, { steps: 12 });
  await page.waitForTimeout(300);
};
const lastSession = () => page.evaluate(() => window.__seekDump().sessions.at(-1));
const thumbY = () =>
  page.evaluate(() => {
    const s = document.querySelector('.thread-scroll-container'),
      r = s.getBoundingClientRect(),
      track = s.clientHeight,
      thumb = Math.max(20, (track * track) / s.scrollHeight);
    return r.top + (s.scrollTop / (s.scrollHeight - track)) * (track - thumb) + thumb / 2;
  });

// Drag and release, then save: bug-01 has press, seek and release.
await drag(await thumbY(), (await thumbY()) + 220);
await page.mouse.up();
await page.waitForTimeout(400);
assert.equal(await shortcut(page), 1, 'first shortcut press saves one file');
let saved = await waitForFiles(1);
const y = await thumbY();
await drag(y, y + 160);
assert.equal(await page.evaluate(() => window.__seekDump.held), true, 'pointer held');
const sessions = await page.evaluate(() => window.__seekDump().sessions.length);
assert.equal(await shortcut(page), 1, 'second shortcut press (held) saves one file');
// The drag carries on after the shortcut: more seeking, then one session ended by the release.
await page.mouse.move(bar.x, y + 260, { steps: 6 });
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => window.__seekDump().sessions.length), sessions);
assert.equal((await lastSession()).reason, 'pointerup');
pass('the held drag continued through the shortcut and ended on pointerup');
saved = await waitForFiles(2);
assert.equal(saved.length, 2);
assert.match(saved[0], /^butter-diag\/round-1\/bug-01_\d\d-\d\d-\d\d\.json$/);
assert.match(saved[1], /^butter-diag\/round-1\/bug-02_\d\d-\d\d-\d\d\.json$/);
pass(`saved ${saved.join(', ')}`);

const snapshots = await Promise.all(
  saved.map(async (f) => ({ file: f, text: await fs.readFile(path.join(downloads, f), 'utf8') })),
);
for (const [i, { file, text }] of snapshots.entries()) {
  const s = JSON.parse(text);
  assert.equal(s.kind, 'butter-diag');
  assert.equal(s.formatVersion, 1);
  assert.equal(s.bug, i + 1);
  assert.equal(s.round, 1);
  assert.equal(s.version, manifest.version_name);
  assert.equal(s.trigger, 'shortcut');
  assert.equal(s.pointerHeld, i === 1, `${file} pointerHeld`);
  assert.equal(s.settings.enabled, true);
  assert.equal(s.pressDecision?.schema, 1);
  assert.equal(typeof s.redacted, 'number');
  // The file name's time is the snapshot's local save time.
  const at = new Date(s.savedAt),
    two = (n) => String(n).padStart(2, '0');
  assert.ok(file.endsWith(`_${two(at.getHours())}-${two(at.getMinutes())}-${two(at.getSeconds())}.json`));
  const types = new Set(s.events.map((e) => e.type));
  for (const type of ['press', 'seek', 'release']) assert.ok(types.has(type), `${file} has ${type}`);
  const ts = s.events.map((e) => e.t);
  assert.deepEqual(ts, [...ts].sort((a, b) => a - b), 'oldest first');
  assert.ok(ts.every((t) => t <= 0 && t >= -30_000), 'relative times within 30 s');
  for (const planted of [QUESTION, ANSWER, CONV, 'chatgpt.com', 't1', 'a1'])
    assert.ok(!text.includes(planted), `${file} leaks ${planted}`);
  pass(
    `${file}: ${s.events.length} events (${[...types].join(', ')}), pointerHeld ${s.pointerHeld}, redacted ${s.redacted}`,
  );
}
const held = JSON.parse(snapshots[1].text);
// While holding, the last event is a seek after the second press, with no release after it.
assert.equal(held.events.at(-1).type, 'seek');
pass('bug-02 was taken mid-drag: its last event is a seek');

// ---- another tab, and ChatGPT's home page: nothing saved ----
const chatTab = (await commandLog())[0].tab;
const other = await context.newPage();
await other.goto('https://other.test/');
await other.bringToFront();
const otherTab = await activeTab();
assert.notEqual(otherTab, chatTab);
for (const [url, label] of [
  ['https://other.test/', 'another site'],
  ['https://chatgpt.com/', 'the ChatGPT home page'],
]) {
  await other.goto(url);
  await other.bringToFront();
  const fired = (await commandLog()).length;
  assert.equal(await shortcut(other), 0, `a press on ${label} saves nothing`);
  const log = await commandLog();
  assert.equal(log.length, fired + 1, `the command fired on ${label}`);
  assert.equal(log.at(-1).tab, otherTab, `the command reached the ${label} tab`);
  pass(`shortcut on ${label}: the command fired in that tab and saved nothing`);
}
// The other tab really was the one the command saw: going back to the chat saves bug-03.
await page.bringToFront();
assert.equal(await shortcut(page), 1, 'back on the chat, the shortcut saves again');
saved = await files();
assert.match(saved[2], /^butter-diag\/round-1\/bug-03_/);
pass(`back on the chat: ${saved[2]}`);

const state = await worker.evaluate(() => chrome.storage.local.get('butterDev'));
assert.deepEqual(state.butterDev, { round: 1, bugs: 3 });
pass('round state: round 1, 3 bugs');
assert.deepEqual(foreign, [], 'no requests left the fixture');
assert.deepEqual(errors, []);
pass('no foreign requests, no page errors');

await fs.mkdir(out, { recursive: true });
for (const { file, text } of snapshots) await fs.writeFile(path.join(out, path.basename(file)), text);
await fs.writeFile(
  path.join(out, 'summary.json'),
  JSON.stringify(
    {
      build: manifest.version_name,
      chromium: context.browser()?.version() ?? null,
      files: saved,
      otherTabSaved: 0,
      chatgptHomeSaved: 0,
      roundState: state.butterDev,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Saved files and summary in ${out}`);
await context.close();
