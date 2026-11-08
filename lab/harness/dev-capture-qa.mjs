// Dev build bug capture (#43) in a real Chromium, with no ChatGPT requests. Builds the dev zip
// (python3 scripts/package.py --dev) unless BUTTER_DEV_ZIP names one, loads it unpacked in its
// own profile, and serves a synthetic chat for every chatgpt.com request (anything else is
// aborted, except the local https://other.test/ page). Then: drag the scrollbar thumb and
// release, press the shortcut (bug-01), drag again and press it while holding (bug-02), and
// press it on another tab and on ChatGPT's home page (nothing saved). Checks the files Chrome
// wrote to a temporary Downloads folder.
//
// The toast (#45): every save shows "Bug N saved / last 30 s · round R" on the chat for about
// 2 s, takes no pointer events and leaves focus alone, and the held drag carries on through it.
// Presses that save nothing show none. Then the toast is rendered on a light and a dark page as
// "Bug 4 saved, round 2" and cropped; with BUTTER_DEV_MOCKUP=<#32 mockup> (gh issue artifact
// download 32 1 -R SimianW/butter) each crop is compared with the mockup's toast-light and
// toast-dark panels: same size, under 0.1% of pixels differing by more than 24 in a channel.
//
// The shortcut must be real keyboard input: chrome.commands ignores keys sent through the
// DevTools protocol. So this runs headed on a virtual X display and presses Alt+Shift+B through
// XTest (xtest-keys.py). Chrome does not auto-assign Alt+Shift+B on Linux or Windows, where it
// is the browser's "focus bookmarks bar" key, so the profile is seeded with the binding that
// chrome://extensions/shortcuts would save.
//
// Run: npm ci --prefix lab/harness && xvfb-run -a node lab/harness/dev-capture-qa.mjs
// OUT=<dir> overrides where the saved files, toast screenshots and summary go
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
const mockup = process.env.BUTTER_DEV_MOCKUP;
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
    // The fixed toast draws grayscale text on its own layer; without this the mockup panel would
    // get LCD text, and every glyph edge would count as a difference (as in consent-qa.mjs).
    '--disable-lcd-text',
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
.dark body { background:#212121; color:#ececec }
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
// Harness-side witness (not product code): when each toast host joined and left the page, and
// what it read, so a check can see a toast that has already gone.
await context.addInitScript(() => {
  window.__qaToastText = () =>
    document
      .querySelector('chatgpt-butter-toast')
      ?.shadowRoot?.querySelector('.toast')
      ?.innerText.replace(/\s+/g, ' ')
      .trim() ?? null;
  window.__qaToasts = [];
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes)
        if (n.localName === 'chatgpt-butter-toast')
          window.__qaToasts.push({ host: n, added: performance.now(), removed: null });
      for (const n of r.removedNodes)
        for (const t of window.__qaToasts) if (t.host === n) t.removed = performance.now();
    }
  }).observe(document, { childList: true, subtree: true });
});
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  // The mockup, its panels and the extension's bundled font are local.
  if (['file:', 'data:', 'chrome-extension:'].includes(url.protocol)) return route.continue();
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
// The toast as the page sees it right now, or null.
const toastNow = (p) =>
  p.evaluate(() => {
    const host = document.querySelector('chatgpt-butter-toast'),
      el = host?.shadowRoot?.querySelector('.toast');
    if (!el) return null;
    const r = el.getBoundingClientRect(),
      hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      pointerEvents: getComputedStyle(host).pointerEvents,
      hitByPointer: hit === host,
      focusKept: document.activeElement === window.__qaFocus,
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
// Every toast this page has shown, with how long it stayed.
const toastLog = (p) =>
  p.evaluate(() =>
    window.__qaToasts.map((t) => ({ ms: t.removed === null ? null : Math.round(t.removed - t.added) })),
  );
let lastToast = null;
// Real keyboard input on the X display. The first call parks the X pointer inside the window,
// since X focus follows the pointer without a window manager; later calls must not move it, or
// Chrome would see a buttonless mousemove and end the held drag.
let parked = false;
const shortcut = async (page) => {
  const before = (await files()).length;
  // A toast still showing from an earlier save must be replaced by this save's.
  await page.evaluate(() => {
    window.__qaFocus = document.activeElement;
    window.__qaToastBefore = window.__qaToastText();
  });
  // Read the toast as soon as it shows, while the key press is still being handled.
  const toast = page
    .waitForFunction(
      () => {
        const text = window.__qaToastText();
        return text !== null && text !== window.__qaToastBefore && document.fonts.status === 'loaded';
      },
      null,
      { timeout: 1400, polling: 'raf' },
    )
    .then(() => toastNow(page))
    .catch(() => null);
  execFileSync('python3', [
    path.join(here, 'xtest-keys.py'),
    'Alt+Shift+B',
    ...(parked ? [] : ['640', '400']),
  ]);
  parked = true;
  await page.waitForTimeout(1500);
  lastToast = await toast;
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

// A toast from a save: the saved bug and round, no pointer events, focus where it was.
const assertToast = (toast, bug, round) => {
  assert.ok(toast, `bug ${bug} shows a toast`);
  assert.equal(toast.text, `Bug ${bug} saved last 30 s · round ${round}`);
  assert.equal(toast.pointerEvents, 'none');
  assert.equal(toast.hitByPointer, false, 'the pointer passes through the toast');
  assert.equal(toast.focusKept, true, 'the toast leaves document.activeElement alone');
};

// Drag and release, then save: bug-01 has press, seek and release.
await drag(await thumbY(), (await thumbY()) + 220);
await page.mouse.up();
await page.waitForTimeout(400);
assert.equal(await shortcut(page), 1, 'first shortcut press saves one file');
assertToast(lastToast, 1, 1);
pass(`toast after bug-01: "${lastToast.text}"`);
let saved = await waitForFiles(1);
const y = await thumbY();
await drag(y, y + 160);
assert.equal(await page.evaluate(() => window.__seekDump.held), true, 'pointer held');
const sessions = await page.evaluate(() => window.__seekDump().sessions.length);
assert.equal(await shortcut(page), 1, 'second shortcut press (held) saves one file');
assertToast(lastToast, 2, 1);
const replaced = await page.evaluate(() => window.__qaToastBefore);
if (replaced) {
  assert.equal(await page.evaluate(() => document.querySelectorAll('chatgpt-butter-toast').length), 1);
  pass(`bug-02's toast replaced "${replaced}" instead of stacking`);
}
assert.equal(await page.evaluate(() => window.__seekDump.held), true, 'still held under the toast');
pass(`toast while holding the thumb: "${lastToast.text}"`);
// The drag carries on after the shortcut: more seeking, then one session ended by the release.
await page.mouse.move(bar.x, y + 260, { steps: 6 });
await page.waitForTimeout(200);
await page.mouse.up();
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => window.__seekDump().sessions.length), sessions);
assert.equal((await lastSession()).reason, 'pointerup');
pass('the held drag continued through the shortcut and the toast, and ended on pointerup');
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
  assert.equal(lastToast, null, `no toast on ${label}`);
  const log = await commandLog();
  assert.equal(log.length, fired + 1, `the command fired on ${label}`);
  assert.equal(log.at(-1).tab, otherTab, `the command reached the ${label} tab`);
  pass(`shortcut on ${label}: the command fired in that tab and saved nothing`);
}
// The other tab really was the one the command saw: going back to the chat saves bug-03.
await page.bringToFront();
assert.equal(await shortcut(page), 1, 'back on the chat, the shortcut saves again');
assertToast(lastToast, 3, 1);
saved = await files();
assert.match(saved[2], /^butter-diag\/round-1\/bug-03_/);
pass(`back on the chat: ${saved[2]}`);

const state = await worker.evaluate(() => chrome.storage.local.get('butterDev'));
assert.deepEqual(state.butterDev, { round: 1, bugs: 3 });
pass('round state: round 1, 3 bugs');

// Every toast left the page. A save while one showed reused it (replaced, not stacked), so the
// chat had fewer toast hosts than saves. bug-03's came long after the others: about 2 s.
await page.waitForSelector('chatgpt-butter-toast', { state: 'detached', timeout: 3000 });
const shown = await toastLog(page);
assert.ok(shown.length >= 1 && shown.length <= 3, `toast hosts on the chat: ${shown.length}`);
assert.ok(shown.every((t) => t.ms !== null), 'every toast left the page');
assert.ok(shown.at(-1).ms >= 1900 && shown.at(-1).ms <= 2300, `bug-03 toast showed ${shown.at(-1).ms} ms`);
assert.deepEqual(await toastLog(other), [], 'no toast on the other tab');
pass(`toast hosts on the chat for 3 saves: ${shown.length}, showing ${shown.map((t) => t.ms).join(', ')} ms`);

// ---- the toast in light and dark, against the mockup's toast panels ----
const shots = path.join(out, 'screenshots');
await fs.mkdir(shots, { recursive: true });
const png = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
// Share of pixels that differ by more than 24 in any channel (as in consent-qa.mjs).
const compare = async (p, a, b) =>
  p.evaluate(
    async ([a, b]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height)
        return { size: [x.width, x.height, y.width, y.height] };
      const data = (img) => {
        const c = new OffscreenCanvas(img.width, img.height),
          g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const d = data(x),
        e = data(y);
      let n = 0;
      for (let k = 0; k < d.length; k += 4)
        if (Math.max(Math.abs(d[k] - e[k]), Math.abs(d[k + 1] - e[k + 1]), Math.abs(d[k + 2] - e[k + 2])) > 24)
          n++;
      return { ratio: n / (d.length / 4) };
    },
    [await png(a), await png(b)],
  );
// The panel's frame around a toast box: 16 px left and above, 8 px right (clear of the
// scrollbar), down to the bottom of the page, where the toast sits 18 px up.
const crop = (box, bottom) => {
  const x = Math.floor(box.x) - 16,
    y = Math.floor(box.y) - 16;
  return { x, y, width: Math.ceil(box.x + box.width) + 8 - x, height: bottom - y };
};
const mock = mockup ? await context.newPage() : null;
if (mock) await mock.goto(`file://${path.resolve(mockup)}`);
const toastShots = [];
for (const theme of ['light', 'dark']) {
  // Bug 4 in round 2, as in the panel. The page shows its blank bottom padding behind the toast.
  await worker.evaluate((butterDev) => chrome.storage.local.set({ butterDev }), { round: 2, bugs: 3 });
  await page.evaluate((dark) => {
    document.documentElement.classList.toggle('dark', dark);
    const s = document.querySelector('.thread-scroll-container');
    s.scrollTop = s.scrollHeight;
  }, theme === 'dark');
  await page.bringToFront();
  await page.waitForTimeout(300);
  assert.equal(await shortcut(page), 1, `${theme}: the shortcut saves`);
  // Shoot while it shows, from its own position.
  await page.waitForSelector('chatgpt-butter-toast', { state: 'attached', timeout: 1000 }).catch(() => {});
  const now = await toastNow(page);
  assertToast(now ?? lastToast, 4, 2);
  assert.ok(now, `${theme}: the toast is still showing for the screenshot`);
  const built = path.join(shots, `toast-${theme}-built.png`);
  await page.screenshot({ path: built, clip: crop(now.box, page.viewportSize().height) });
  const result = { theme, built, box: now.box };
  if (mock) {
    const panel = `toast-${theme}`;
    const srcdoc = await mock
      .locator(`iframe[data-panel="${panel}"]`)
      .evaluate((f) => new Promise((r) => (f.srcdoc ? r(f.srcdoc) : f.addEventListener('load', () => r(f.srcdoc)))));
    const doc = path.join(profile, `${panel}.html`);
    await fs.writeFile(doc, srcdoc);
    // The panel's own size: its toast is placed against the viewport.
    const ref = await context.newPage();
    await ref.setViewportSize({ width: 360, height: 250 });
    await ref.goto(`file://${doc}`);
    await ref.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    // The panel draws a sketch of a chat and a scrollbar behind the toast; the fixture's page is
    // blank there. Compare the toast and its shadow only, over the same page colour.
    await ref.evaluate(() => document.querySelectorAll('.chat, .track').forEach((e) => (e.style.visibility = 'hidden')));
    const refBox = await ref.evaluate(() => {
      const r = document.querySelector('.toast').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const reference = path.join(shots, `${panel}-mockup.png`);
    await ref.screenshot({ path: reference, clip: crop(refBox, 250) });
    await ref.close();
    Object.assign(result, { reference, mockupBox: refBox }, await compare(mock, built, reference));
  }
  toastShots.push(result);
  console.log(JSON.stringify(result));
  await page.waitForSelector('chatgpt-butter-toast', { state: 'detached', timeout: 3000 });
}
await page.evaluate(() => document.documentElement.classList.remove('dark'));
if (mock) {
  for (const r of toastShots) {
    assert.ok(Math.abs(r.box.width - r.mockupBox.width) < 0.5, `${r.theme} toast width: ${JSON.stringify(r)}`);
    assert.ok(Math.abs(r.box.height - r.mockupBox.height) < 0.5, `${r.theme} toast height: ${JSON.stringify(r)}`);
    assert.ok(r.ratio !== undefined && r.ratio < 0.001, `${r.theme} toast differs from the mockup: ${JSON.stringify(r)}`);
  }
  pass(`toast matches the mockup: ${toastShots.map((r) => `${r.theme} ${r.ratio}`).join(', ')}`);
} else console.log('BUTTER_DEV_MOCKUP not set: toast screenshots taken, mockup comparison skipped');
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
      toasts: toastShots.map(({ theme, ratio, box, mockupBox }) => ({
        theme,
        ratio: ratio ?? null,
        box,
        mockupBox: mockupBox ?? null,
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log(`Saved files and summary in ${out}`);
await context.close();
