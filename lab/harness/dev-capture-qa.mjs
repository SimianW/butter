// Dev build bug capture (#43, #44) in a real Chromium, with no ChatGPT requests. Builds the dev
// zip (python3 scripts/package.py --dev) unless BUTTER_DEV_ZIP names one, loads it unpacked in
// its own profile, and serves the long synthetic chat in dev-capture-fixture.mjs for every
// chatgpt.com request (anything else is aborted, except the local https://other.test/ page).
// Then: drag the scrollbar thumb and release, press the shortcut (bug-01), drag again and press
// it while holding (bug-02), and press it on another tab and on ChatGPT's home page (nothing
// saved). Checks each file's events, turns and usage, and that it holds none of the chat's
// text, TeX, IDs or URLs. Then measures what #44's caps rest on: a busy 30 s session (bug-04:
// event rate and size, file size), the snapshot's own cost, seek behaviour with and without the
// recorder listening, and the largest data: URL chrome.downloads accepts.
//
// The shortcut must be real keyboard input: chrome.commands ignores keys sent through the
// DevTools protocol. So this runs headed on a virtual X display and presses Alt+Shift+B through
// XTest (xtest-keys.py). Chrome does not auto-assign Alt+Shift+B on Linux or Windows, where it
// is the browser's "focus bookmarks bar" key, so the profile is seeded with the binding that
// chrome://extensions/shortcuts would save.
//
// Run: npm ci --prefix lab/harness && xvfb-run -a node lab/harness/dev-capture-qa.mjs
// OUT=<dir> overrides where the saved files and summary go
// (default notes/runs/2026-11-08-full-snapshot-44/).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fixture from './dev-capture-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)),
  repo = path.resolve(here, '../..');
const out = process.env.OUT || path.join(repo, 'notes/runs/2026-11-08-full-snapshot-44');
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
const { CONV, QUESTION, ANSWER, TEX, LINK, TURNS, UNMOUNTED } = fixture;
const chatHtml = fixture.chatHtml;
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
await page.locator(`[data-turn-key="${fixture.turnKey(TURNS - 1)}"]`).waitFor({ state: 'attached' });
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

// Read through the chat with the wheel first, as a tester would: the layout cache records the
// turns it shows, so the drags preview recorded and unrecorded turns alike.
const scroller = (fn, arg) => page.evaluate(fn, arg);
const scrollTo = (top) =>
  scroller((top) => (document.querySelector('.thread-scroll-container').scrollTop = top), top);
await page.mouse.move(640, 400);
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(1500);
await scrollTo(30_000);
await page.waitForTimeout(800);

// Drag and release, then save: bug-01 has press, seek, preview and release.
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
// Everything the fixture plants that a file must not hold: question and answer text, TeX (as
// written and as JSON escapes it), the conversation, turn and message IDs, links and hosts.
const planted = [
  QUESTION,
  ANSWER,
  ...Object.values(TEX).flatMap((tex) => [tex, JSON.stringify(tex).slice(1, -1)]),
  'binom',
  'tfrac',
  CONV,
  fixture.turnKey(0).slice(0, 8),
  fixture.messageId(0).slice(0, 8),
  LINK,
  'example.org',
  'chatgpt.com',
];
const leaks = (text) => [
  ...planted.filter((p) => text.includes(p)),
  ...(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-|[0-9a-f]{32,}|https?:|www\./gi) || []),
];
function checkFile(file, text, { bug, trigger = 'shortcut' }) {
  const s = JSON.parse(text);
  assert.equal(s.kind, 'butter-diag');
  assert.equal(s.formatVersion, 1);
  assert.equal(s.bug, bug);
  assert.equal(s.round, 1);
  assert.equal(s.version, manifest.version_name);
  assert.equal(s.trigger, trigger);
  assert.equal(s.settings.enabled, true);
  assert.equal(s.pressDecision?.schema, 1);
  assert.equal(typeof s.redacted, 'number');
  // The file name's time is the snapshot's local save time.
  const at = new Date(s.savedAt),
    two = (n) => String(n).padStart(2, '0');
  assert.ok(file.endsWith(`_${two(at.getHours())}-${two(at.getMinutes())}-${two(at.getSeconds())}.json`));
  const types = new Set(s.events.map((e) => e.type));
  for (const type of ['press', 'seek', 'preview', 'release'])
    assert.ok(types.has(type), `${file} has ${type}`);
  const ts = s.events.map((e) => e.t);
  assert.deepEqual(ts, [...ts].sort((a, b) => a - b), 'oldest first');
  assert.ok(ts.every((t) => t <= 0 && t >= -30_000), 'relative times within 30 s');
  // turns: the virtualizer's order, readiness for every turn, the active turn, pending math.
  const { order, readiness, active, math } = s.turns;
  assert.deepEqual(order, { count: TURNS, mounted: TURNS - UNMOUNTED, fiberFound: true, idsFromFallback: false, idsReason: null });
  assert.equal(readiness.turns.length, TURNS, `${file}: a readiness entry for every turn`);
  readiness.turns.forEach((row, i) => {
    assert.equal(row.index, i);
    assert.equal(row.mounted, i >= UNMOUNTED);
    assert.equal(row.recorder === null, i < UNMOUNTED, `${file}: recorder status for mounted turn ${i}`);
    assert.equal(typeof row.layout, 'boolean');
  });
  const recorded = readiness.turns.filter((row) => row.hasRecord).length;
  assert.ok(recorded > 0, `${file}: some turns recorded`);
  const mathPending = readiness.turns.filter((row) => row.recorder?.lastRejection === 'math-pending');
  assert.ok(mathPending.length > 0, `${file}: a math-pending turn`);
  assert.ok(['active-preview-update', 'last-seek-update'].includes(active.selection));
  assert.equal(active.preview.updateTurnIndex, active.turnIndex);
  assert.equal(active.dom.mounted, active.turnIndex >= UNMOUNTED);
  assert.equal(math.length, TURNS - UNMOUNTED);
  for (const row of math)
    assert.equal(row.withoutKatex, row.index % 17 === 5 ? 1 : 0, `${file}: pending math in turn ${row.index}`);
  for (const part of ['saved', 'store', 'cache'])
    assert.equal(s.usage[part].unavailable, undefined, `${file}: usage.${part}`);
  assert.deepEqual(leaks(text), [], `${file} leaks`);
  pass(
    `${file}: ${s.events.length} events (${[...types].join(', ')}), ${readiness.turns.length} readiness rows (${recorded} recorded), active turn ${active.turnIndex} (${active.selection}), pointerHeld ${s.pointerHeld}, redacted ${s.redacted}, ${text.length} bytes`,
  );
  return s;
}
for (const [i, { file, text }] of snapshots.entries()) {
  const s = checkFile(file, text, { bug: i + 1 });
  assert.equal(s.pointerHeld, i === 1, `${file} pointerHeld`);
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

// ---- #44 measurements ----
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const quantile = (xs, q) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// A busy session, as a tester hunting a seek bug works: 30 s of wheel scrolling and repeated
// thumb drags across the long chat, then one save (bug-04). Its events give the event rate and
// size the caps rest on; its file the size of turns and usage on a 140-turn chat.
const busyStart = Date.now();
await page.mouse.move(640, 400);
for (let i = 0; i < 40; i++) {
  await page.mouse.wheel(0, i % 20 < 10 ? -1200 : 1200);
  await page.waitForTimeout(50);
}
let drags = 0;
while (Date.now() - busyStart < 28_000) {
  const from = await thumbY();
  const to = from + (drags % 2 ? -1 : 1) * (150 + (drags % 5) * 40);
  await page.mouse.move(bar.x, from);
  await page.mouse.down();
  // About 2 s of continuous motion per drag: one small step at a time, as a hand moves.
  for (let step = 1; step <= 60; step++) {
    await page.mouse.move(bar.x, from + ((to - from) * step) / 60);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
  drags++;
}
const busyMs = Date.now() - busyStart;
assert.equal(await shortcut(page), 1, 'the busy session saves bug-04');
saved = await waitForFiles(4);
const busyFile = saved[3];
const busyText = await fs.readFile(path.join(downloads, busyFile), 'utf8');
const busy = checkFile(busyFile, busyText, { bug: 4 });
const spanS = -busy.events[0].t / 1000;
const byType = {};
for (const e of busy.events) byType[e.type] = (byType[e.type] || 0) + 1;
const eventBytes = busy.events.map((e) => JSON.stringify(e).length + 6); // indent, comma, newline
const part = (v) => JSON.stringify(v).length;
const busyStats = {
  sessionMs: busyMs,
  drags,
  events: busy.events.length,
  eventsDropped: busy.eventsDropped ?? 0,
  windowS: round(spanS),
  eventsPerS: round(busy.events.length / spanS),
  seekPerS: round((byType.seek || 0) / spanS),
  byType,
  bytesPerEvent: { mean: round(eventBytes.reduce((a, b) => a + b, 0) / eventBytes.length), p95: quantile(eventBytes, 0.95), max: Math.max(...eventBytes) },
  eventBytes: eventBytes.reduce((a, b) => a + b, 0),
  fileBytes: busyText.length,
  partBytes: {
    pressDecision: part(busy.pressDecision),
    'turns.readiness': part(busy.turns.readiness),
    'turns.active': part(busy.turns.active),
    'turns.math': part(busy.turns.math),
    usage: part(busy.usage),
  },
  activeDomNodes: busy.turns.active.dom?.turn?.length ?? null,
  redacted: busy.redacted,
};
pass(`busy session: ${JSON.stringify(busyStats)}`);

// The fastest seek rate: one drag with mouse moves sent back to back for 3 s, against the
// page's frame rate in the same interval. Chromium delivers at most one scroll event per frame,
// so a display's refresh rate bounds the seek events per second.
await page.evaluate(() => {
  window.qaFrames = 0;
  const tick = () => {
    window.qaFrames++;
    if (window.qaFrames < 100_000) window.qaFrame = requestAnimationFrame(tick);
  };
  tick();
});
const fastFrom = await thumbY(),
  fastBefore = await page.evaluate(() => [window.__seekDump().updateCount, window.qaFrames]);
await page.mouse.move(bar.x, fastFrom);
await page.mouse.down();
// Playwright waits for each move's acknowledgement; send moves over the DevTools protocol without
// waiting instead, one every 4 ms (250 a second, faster than any display refreshes).
const input = await context.newCDPSession(page);
const fastStart = Date.now();
let moves = 0;
while (Date.now() - fastStart < 3_000) {
  const y = fastFrom + 120 * Math.sin(moves / 30);
  input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bar.x, y, button: 'left', buttons: 1 }).catch(() => {});
  moves++;
  await new Promise((r) => setTimeout(r, 4));
}
const fastMs = Date.now() - fastStart;
const fastAfter = await page.evaluate(() => [window.__seekDump().updateCount, window.qaFrames]);
await page.mouse.up();
await page.evaluate(() => cancelAnimationFrame(window.qaFrame));
await page.waitForTimeout(1500);
const fastDrag = {
  ms: fastMs,
  movesPerS: round((moves * 1000) / fastMs),
  seekPerS: round(((fastAfter[0] - fastBefore[0]) * 1000) / fastMs),
  framesPerS: round(((fastAfter[1] - fastBefore[1]) * 1000) / fastMs),
};
pass(`fast drag: ${JSON.stringify(fastDrag)}`);

// The snapshot's own cost: the MAIN-world build and serialization, timed in the page.
const snapshotMs = await page.evaluate(() => {
  const times = [];
  let bytes = 0;
  const receive = (e) => (bytes = e.detail.length);
  document.addEventListener('butter-dev-snapshot-response', receive);
  for (let i = 0; i < 7; i++) {
    const t0 = performance.now();
    document.dispatchEvent(
      new CustomEvent('butter-dev-snapshot-request', {
        detail: JSON.stringify({ bug: 99, round: 1, trigger: 'shortcut', version: '0.0.0' }),
      }),
    );
    times.push(performance.now() - t0);
  }
  document.removeEventListener('butter-dev-snapshot-response', receive);
  return { times, bytes };
});
const snapshotCost = {
  medianMs: round(median(snapshotMs.times)),
  maxMs: round(Math.max(...snapshotMs.times)),
  bytes: snapshotMs.bytes,
};
pass(`snapshot build + serialize: ${JSON.stringify(snapshotCost)}`);

// Seek behaviour with and without the recorder listening: the same drag from the same scroll
// position, three times with the listeners set and three times with them cleared. The preview
// must follow the same turns and land the same way; jsMs is the seek update's own script time.
const sameDrag = async () => {
  await scrollTo(60_000);
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__seekDump().updateCount);
  const from = await thumbY();
  await page.mouse.move(bar.x, from);
  await page.mouse.down();
  for (let step = 1; step <= 40; step++) {
    await page.mouse.move(bar.x, from + (180 * step) / 40);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
  return page.evaluate((before) => {
    const dump = window.__seekDump(true),
      session = dump.sessions.at(-1);
    return {
      updates: dump.updates.slice(before).map(({ top, turn, layout, known, jsMs }) => ({ top, turn, layout, known, jsMs })),
      reason: session.reason,
      destination: session.destination,
      realTop: session.realTop,
      landingErrorPx: session.landingErrorPx,
    };
  }, before);
};
const runs = { on: [], off: [] };
await sameDrag(); // warm-up
for (let i = 0; i < 3; i++) runs.on.push(await sameDrag());
await page.evaluate(() => {
  window.__seekDump.tap = null;
  window.__butterLayoutCache.tap = null;
});
for (let i = 0; i < 3; i++) runs.off.push(await sameDrag());
// Where a drag ends varies by a step or two of mouse input from run to run, in either mode. What
// the recorder could change is the decision itself: the same scroll position must preview the
// same turn the same way in every run, and every release must land the same way.
const decisions = new Map(),
  conflicts = [];
for (const [mode, list] of Object.entries(runs))
  for (const r of list)
    for (const u of r.updates) {
      const value = `${u.turn}:${u.layout}:${u.known}`;
      if (decisions.has(u.top) && decisions.get(u.top).value !== value)
        conflicts.push({ top: u.top, [decisions.get(u.top).mode]: decisions.get(u.top).value, [mode]: value });
      else decisions.set(u.top, { value, mode });
    }
assert.deepEqual(conflicts, [], 'the same scroll position previews the same turn the same way');
const landing = (r) => ({ reason: r.reason, layout: r.destination?.layout, landingErrorPx: r.landingErrorPx });
for (const r of [...runs.on, ...runs.off]) assert.deepEqual(landing(r), landing(runs.on[0]), 'same landing');
const shared = (a, b) => [...new Set(a.flatMap((r) => r.updates.map((u) => u.top)))].filter((top) => b.some((r) => r.updates.some((u) => u.top === top))).length;
const jsMs = (list) => list.flatMap((r) => r.updates.map((u) => u.jsMs));
const recordingCost = {
  dragsEach: 3,
  updatesOn: jsMs(runs.on).length,
  updatesOff: jsMs(runs.off).length,
  jsMsMedianOn: round(median(jsMs(runs.on)), 2),
  jsMsMedianOff: round(median(jsMs(runs.off)), 2),
  jsMsP95On: round(quantile(jsMs(runs.on), 0.95), 2),
  jsMsP95Off: round(quantile(jsMs(runs.off), 0.95), 2),
  topsSeenInBoth: shared(runs.on, runs.off),
  ends: Object.fromEntries(Object.entries(runs).map(([k, list]) => [k, list.map((r) => ({ turn: r.destination?.turn, realTop: r.realTop, landingErrorPx: r.landingErrorPx }))])),
  landing: landing(runs.on[0]),
};
pass(`recording on and off: same preview decision at every shared scroll position, same landing; ${JSON.stringify(recordingCost)}`);

// The largest data: URL chrome.downloads takes: the worker saves through one (base64), so the
// file's ceiling is what fits under it. Chrome's URL constant is 2 MiB (url::kMaxURLChars);
// probe a file whose URL is just under it, then double until a download fails.
const urlLimit = await worker.evaluate(async () => {
  const PREFIX = 'data:application/json;base64,';
  const tryBytes = async (n) => {
    const url = PREFIX + btoa('{'.padEnd(n - 1, ' ') + '}');
    const result = { fileBytes: n, urlLength: url.length };
    let id;
    try {
      id = await chrome.downloads.download({ url, filename: `butter-diag-limit/${n}.json`, saveAs: false });
    } catch (error) {
      return { ...result, saved: false, error: String(error.message || error) };
    }
    for (let i = 0; i < 300; i++) {
      const [item] = await chrome.downloads.search({ id });
      if (item?.state === 'complete') return { ...result, saved: item.fileSize === n };
      if (item?.state === 'interrupted') return { ...result, saved: false, error: item.error };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { ...result, saved: false, error: 'timeout' };
  };
  const tries = [await tryBytes(Math.floor((2 * 1024 * 1024 - PREFIX.length) / 4) * 3)];
  for (let mb = 4; mb <= 256 && tries.at(-1).saved; mb *= 2) tries.push(await tryBytes(mb * 1024 * 1024));
  return tries;
});
assert.equal(urlLimit[0].saved, true, JSON.stringify(urlLimit));
pass(`data: URL downloads: ${JSON.stringify(urlLimit)}`);
await fs.rm(path.join(downloads, 'butter-diag-limit'), { recursive: true, force: true });

const state = await worker.evaluate(() => chrome.storage.local.get('butterDev'));
assert.deepEqual(state.butterDev, { round: 1, bugs: 4 });
pass('round state: round 1, 4 bugs');
assert.deepEqual(foreign, [], 'no requests left the fixture');
assert.deepEqual(errors, []);
pass('no foreign requests, no page errors');

await fs.mkdir(out, { recursive: true });
for (const { file, text } of [...snapshots, { file: busyFile, text: busyText }])
  await fs.writeFile(path.join(out, path.basename(file)), text);
await fs.writeFile(
  path.join(out, 'summary.json'),
  JSON.stringify(
    {
      build: manifest.version_name,
      chromium: context.browser()?.version() ?? null,
      fixture: { turns: TURNS, unmounted: UNMOUNTED },
      files: saved,
      otherTabSaved: 0,
      chatgptHomeSaved: 0,
      roundState: state.butterDev,
      busy: busyStats,
      fastDrag,
      snapshotCost,
      recordingCost,
      urlLimit,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Saved files and summary in ${out}`);
await context.close();
