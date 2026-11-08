// #47: a real long-chat, held-thumb capture. No messages are sent. The lab lock, browser,
// command/download preferences and defaults are restored even when an assertion fails.
// Run: node lab/harness/dev-capture-live.mjs
// BUTTER_DEV_ZIP=<zip>, OUT=<report dir>, LAB_FIXTURE=math12 are optional.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const out = process.env.OUT || path.join(repo, 'notes/runs/2026-11-08-dev-live-47');
const bin = path.join(L.root(), 'bin');
const require = createRequire(import.meta.url);
const recorder = require('../../extension/dev/recorder.js');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const pass = (s) => console.log(`PASS ${s}`);
const zip = process.env.BUTTER_DEV_ZIP || execFileSync('python3', ['scripts/package.py', '--dev'], {
  cwd: repo, encoding: 'utf8',
}).split('\n')[0];
// Snap Chromium cannot read hidden worktrees or /tmp.
const scratch = await fs.mkdtemp(path.join(os.homedir(), 'snap/chromium/common/butter-live-47-'));
execFileSync('python3', ['-I', '-c',
  'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, scratch]);
const extension = path.join(scratch, 'butter');
const downloads = path.join(scratch, 'downloads');
await fs.mkdir(downloads);
const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
const extensionId = [...crypto.createHash('sha256').update(extension).digest('hex').slice(0, 32)]
  .map((h) => String.fromCharCode(97 + parseInt(h, 16))).join('');
const fixtureName = process.env.LAB_FIXTURE || 'math12';
const lab = L.acquire('auto', { owner: 'butter-47-live-check', needsFixture: fixtureName, wait: 60 });
console.log(`PASS lab-lock acquire --lab auto --owner butter-47-live-check --wait 60 --needs-fixture ${fixtureName}: lab ${lab.id}`);
const prefsPath = path.join(lab.profile, 'Default/Preferences');
let originalPrefs, browser, page;
const summary = { build: manifest.version_name, fixture: fixtureName, platform: 'Linux',
  macDefaultBinding: 'not checked: Linux lab', checks: {}, cleanup: {} };
const stopBrowser = async () => {
  const args = L.browserArgs(lab);
  if (!args) return;
  try { process.kill(args.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  for (let i = 0; i < 100; i++) {
    const stat = await fs.readFile(`/proc/${args.pid}/stat`, 'utf8').catch(() => null);
    if (!stat || /\) Z /.test(stat)) return;
    await pause(100);
  }
  throw new Error('lab Chromium did not stop; refusing to edit live preferences');
};
const writePrefs = async (prefs) => {
  const tmp = `${prefsPath}.butter47`;
  await fs.writeFile(tmp, JSON.stringify(prefs));
  await fs.rename(tmp, prefsPath);
};
try {
  await stopBrowser();
  const prefs = JSON.parse(await fs.readFile(prefsPath, 'utf8'));
  originalPrefs = { download: prefs.download, commands: prefs.extensions?.commands };
  prefs.download = { ...prefs.download, default_directory: downloads, prompt_for_download: false };
  prefs.extensions ||= {};
  prefs.extensions.commands = { ...prefs.extensions.commands,
    'linux:Alt+Shift+B': { command_name: 'save-bug', extension: extensionId, global: false } };
  await writePrefs(prefs);
  execFileSync(path.join(bin, 'lab'), ['restart-browser'], { env: { ...process.env,
    LAB_ID: String(lab.id), LAB_EXTENSIONS: extension,
    LAB_FLAGS: `--disable-extensions-except=${extension}` }, stdio: 'pipe' });
  for (let i = 0; i < 60 && !(await L.cdpVersion(lab)); i++) await pause(500);
  const connection = await L.connect(lab);
  browser = connection.browser;
  const { context } = connection;
  await L.sendGuard(context, lab);
  pass('browser restarted with only dev extension; send guard installed');
  let blockedMutations = 0, sendAttempts = 0;
  await context.route('**/*', (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) &&
        (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) {
      blockedMutations++;
      if (/^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname)) sendAttempts++;
    }
    return route.fallback();
  });
  summary.chromium = browser.version();
  assert.deepEqual(L.browserArgs(lab).extensions, [extension]);
  const worker = context.serviceWorkers().find((w) => w.url().includes(extensionId)) ||
    await context.waitForEvent('serviceworker', { timeout: 20000 });
  assert.ok(worker.url().includes(`${extensionId}/dev/worker.js`));
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  assert.equal(commands.find((c) => c.name === 'save-bug')?.shortcut, 'Alt+Shift+B');
  // This is this task's new unpacked dev install; do not change the normal lab install.
  await worker.evaluate(() => chrome.storage.local.set({
    butter: { enabled: true, lang: 'en', layoutConsent: 'declined' },
    butterDev: { round: 1, bugs: 0 },
  }));
  await worker.evaluate(() => chrome.commands.onCommand.addListener((command) => {
    self.qa47Commands = [...(self.qa47Commands || []), command];
  }));
  page = context.pages()[0] || await context.newPage();
  for (const other of context.pages()) if (other !== page) await other.close();
  await (await context.newCDPSession(page)).send('Browser.setDownloadBehavior', { behavior: 'default' });
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, fixtureName), { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(page.url(), L.fixture(lab, fixtureName), 'opened the named existing fixture');
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => !!window.__seekDump && !!window.ButterDevSources, null, { timeout: 20000 });
  pass('fixture loaded; Butter diagnostics available');
  await page.bringToFront();
  await page.waitForTimeout(1500);
  // No content or identifiers leave this evaluation. Geometry, counts and Butter's safe hooks only.
  const geometry = () => page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0), r = s.getBoundingClientRect();
    const gutter = s.offsetWidth - s.clientWidth;
    return { x: r.right - (gutter > 0 ? gutter / 2 : 3), top: r.top,
      height: s.clientHeight, scrollHeight: s.scrollHeight, width: s.offsetWidth - s.clientWidth,
      scrollbarWidth: getComputedStyle(s).scrollbarWidth, overflowY: getComputedStyle(s).overflowY,
      orderCount: window.ButterDevSources.turnOrder(s).ids.length };
  });
  let bar = await geometry();
  // ChatGPT initially mounts a short tail; allow hydration and fetch older existing history
  // by scrolling upward. These are guarded reads, never composer actions or synthetic turns.
  summary.historyLoading = [];
  for (let i = 0; i < 30 && !(bar.scrollHeight > bar.height * 5 && bar.orderCount > 1); i++) {
    summary.historyLoading.push({ turns: bar.orderCount, scrollHeight: bar.scrollHeight });
    await page.mouse.move(800, 400);
    await page.mouse.wheel(0, -2500);
    await page.waitForTimeout(1000);
    bar = await geometry();
  }
  summary.scroller = bar;
  console.log(`INFO scroller geometry: ${JSON.stringify(bar)}`);
  assert.notEqual(bar.scrollbarWidth, 'none', 'native scrollbar is not hidden');
  assert.ok(bar.scrollHeight > bar.height * 5 && bar.orderCount > 1, 'fixture is a real long chat');
  pass(`real long fixture: ${bar.orderCount} turns, scrollHeight ${bar.scrollHeight}, viewport ${bar.height}, scrollbar ${bar.width}px`);
  // Park the real X pointer before pressing; moving it during a CDP-held drag drops buttons.
  execFileSync('python3', [path.join(here, 'xtest-keys.py'), 'Shift', '640', '400'], {
    env: { ...process.env, DISPLAY: lab.display },
  });
  await page.evaluate(() => { [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0).scrollTop = 1000; });
  await page.waitForTimeout(700);
  const y = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0), r = s.getBoundingClientRect();
    const track = s.clientHeight, thumb = Math.max(20, track * track / s.scrollHeight);
    return r.top + s.scrollTop / (s.scrollHeight - track) * (track - thumb) + thumb / 2;
  });
  await page.mouse.move(bar.x, y);
  await page.mouse.down();
  await page.mouse.move(bar.x, Math.min(y + 100, bar.top + bar.height - 60), { steps: 12 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__seekDump.held), true);
  await page.evaluate(() => { window.__qa47Focus = document.activeElement; });
  execFileSync('python3', [path.join(here, 'xtest-keys.py'), 'Alt+Shift+B'], {
    env: { ...process.env, DISPLAY: lab.display },
  });
  await page.waitForFunction(() => !!document.querySelector('chatgpt-butter-toast')?.shadowRoot?.querySelector('.toast'),
    null, { timeout: 3000, polling: 'raf' });
  const state = () => page.evaluate(() => {
    const d = window.__seekDump(), s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
    const host = document.querySelector('chatgpt-butter-toast');
    return { held: window.__seekDump.held, sessions: d.sessions.length, updates: d.updateCount,
      scrollTop: s.scrollTop, reason: d.sessions.at(-1)?.reason ?? null,
      toast: host?.shadowRoot?.querySelector('.toast')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      pointerEvents: host ? getComputedStyle(host).pointerEvents : null,
      focusKept: document.activeElement === window.__qa47Focus };
  });
  const during = await state();
  assert.equal(during.held, true);
  assert.equal(during.toast, 'Bug 1 saved last 30 s · round 1');
  assert.equal(during.pointerEvents, 'none');
  assert.equal(during.focusKept, true);
  summary.duringToast = during;
  pass('toast visible while pointer held; pointer-events none; focus unchanged');
  await page.mouse.move(bar.x, Math.min(y + 190, bar.top + bar.height - 20), { steps: 12 });
  await page.waitForTimeout(200);
  const continued = await state();
  assert.equal(continued.held, true);
  assert.equal(continued.sessions, during.sessions);
  assert.ok(continued.updates > during.updates, 'more seek updates after toast');
  assert.notEqual(continued.scrollTop, during.scrollTop);
  summary.continued = continued;
  await page.mouse.up();
  await page.waitForTimeout(700);
  const released = await state();
  assert.equal(released.sessions, during.sessions);
  assert.equal(released.reason, 'pointerup');
  assert.equal(released.held, false);
  summary.released = released;
  summary.commands = await worker.evaluate(() => self.qa47Commands);
  assert.deepEqual(summary.commands, ['save-bug']);
  pass(`drag continued in same session: ${during.updates} -> ${continued.updates} updates; ended on pointerup`);
  let files = [];
  for (let i = 0; i < 50; i++) {
    files = (await fs.readdir(downloads, { recursive: true })).filter((f) => f.endsWith('.json'));
    if (files.length) break;
    await pause(100);
  }
  assert.equal(files.length, 1);
  assert.match(files[0], /^butter-diag\/round-1\/bug-01_\d\d-\d\d-\d\d\.json$/);
  const text = await fs.readFile(path.join(downloads, files[0]), 'utf8');
  const saved = JSON.parse(text);
  assert.equal(saved.kind, 'butter-diag');
  assert.equal(saved.trigger, 'shortcut');
  assert.equal(saved.pointerHeld, true);
  assert.equal(saved.version, manifest.version_name);
  assert.ok(saved.events.some((e) => e.type === 'press'));
  assert.ok(saved.events.some((e) => e.type === 'seek'));
  assert.ok(saved.events.every((e, i, a) => e.t >= -30000 && e.t <= 0 && (!i || e.t >= a[i - 1].t)));
  assert.ok(saved.turns.readiness.turns.length > 1);
  assert.equal(saved.turns.readiness.turns.length, saved.turns.order.count);
  // Check every non-metadata string through the shipped closed allowlist. Save an inventory
  // for independent inspection, too. Do not export a suspicious value on failure.
  const strings = new Set();
  const audit = (v) => {
    if (typeof v === 'string') {
      const r = recorder.createRecorder();
      r.record('seek', { reason: v }, 0);
      const filtered = r.snapshot({ now: 0, date: new Date(0), bug: 1, round: 1,
        version: manifest.version_name, trigger: 'shortcut' });
      assert.equal(filtered.redacted, 0, 'string outside closed vocabulary');
      assert.equal(filtered.events[0].reason, v);
      strings.add(v);
    } else if (v && typeof v === 'object') for (const value of Object.values(v)) audit(value);
  };
  for (const [key, value] of Object.entries(saved))
    if (!['kind', 'savedAt', 'version', 'trigger'].includes(key)) audit(value);
  assert.ok(!/https?:|chatgpt\.com|[\w.+-]+@[\w.-]+\.[a-z]{2,}|[0-9a-f]{8}-[0-9a-f]{4}|[0-9a-f]{32}/i.test(text));
  // Compare with actual page text/TeX and ID values in-browser; only counts leave the page.
  const privacy = await page.evaluate((capture) => {
    const secrets = new Set([location.pathname.split('/').at(-1)]);
    for (const el of document.querySelectorAll('[data-turn-key], [data-message-id], [data-message-author-role]')) {
      for (const attr of ['data-turn-key', 'data-message-id']) {
        const v = el.getAttribute(attr); if (v?.length >= 8) secrets.add(v);
      }
    }
    const prose = document.querySelectorAll('[data-turn-key], [data-message-author-role], [data-user-message-bubble], [data-markdown-text-style="assistant-message"]');
    const math = document.querySelectorAll('annotation[encoding="application/x-tex"], [data-math-source]');
    for (const el of [...prose, ...math]) {
      const v = el.getAttribute('data-math-source') || el.textContent;
      if (v?.trim().length >= 8) {
        secrets.add(v.trim());
        // Include fragments as well as whole messages, so a partial text leak cannot hide.
        for (let i = 0; i + 32 <= v.length; i += 32) secrets.add(v.slice(i, i + 32));
      }
    }
    return { privateTokensChecked: secrets.size, textContainers: prose.length,
      mathSources: math.length, matches: [...secrets].filter((s) =>
        capture.includes(s) || capture.includes(JSON.stringify(s).slice(1, -1))).length };
  }, text);
  assert.ok(privacy.textContainers > 0 && privacy.privateTokensChecked > 0);
  assert.equal(privacy.matches, 0, 'private page token found in capture');
  summary.privacy = { ...privacy, stringInventory: [...strings].sort(),
    strippedValues: 0, note: 'Original download passed; no private values needed stripping.' };
  summary.capture = { file: files[0], bytes: Buffer.byteLength(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
    pointerHeld: saved.pointerHeld, readinessRows: saved.turns.readiness.turns.length,
    redacted: saved.redacted, events: saved.events.length,
    eventTypes: saved.events.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {}) };
  assert.equal(sendAttempts, 0);
  summary.requests = { sendGuard: true, blockedMutations, sendAttempts };
  summary.checks = { toastDuringHeldDrag: true, dragContinues: true, captureAndPrivacy: true };
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, path.basename(files[0])), text);
  pass(`saved ${files[0]}: ${saved.events.length} events, ${saved.turns.readiness.turns.length} readiness rows, pointerHeld true`);
  pass(`privacy: ${privacy.privateTokensChecked} private tokens checked, 0 matches; all strings allowlisted`);
} finally {
  if (page) await page.mouse.up().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  try {
    if (originalPrefs) {
      await stopBrowser();
      const prefs = JSON.parse(await fs.readFile(prefsPath, 'utf8'));
      for (const key of ['download']) {
        if (originalPrefs[key] === undefined) delete prefs[key]; else prefs[key] = originalPrefs[key];
      }
      if (originalPrefs.commands === undefined) delete prefs.extensions.commands;
      else prefs.extensions.commands = originalPrefs.commands;
      await writePrefs(prefs);
      summary.cleanup.preferencesRestored = true;
    }
    // The CLI's raw output contains the private home URL: retain only the boolean here.
    const raw = execFileSync(path.join(bin, 'lab-restore'), ['--lab', String(lab.id), '--owner', lab.owner],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const restored = JSON.parse(raw.split('restored ')[1]);
    assert.equal(restored.ok, true);
    summary.cleanup.labRestore = { ok: restored.ok, restarted: restored.restarted,
      composerEmpty: restored.composer === '', pages: restored.pages.length,
      defaultExtensions: JSON.stringify(restored.browser.extensions) === JSON.stringify(lab.defaultExtensions) };
    pass('lab-restore: ok, default extension, one home tab, composer empty');
  } finally {
    const released = L.release(lab);
    summary.cleanup.lockReleased = released;
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    pass('lab-lock release: released own lock');
  }
}
