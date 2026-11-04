// Real extension page + real storage/worker. Only the active-tab probe is forced for design states.
// Separate headless Chromium: this never touches the shared lab browser.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.BUTTER_SHOTS || '/tmp/butter-popup-build';
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-popup-qa-'));
const browser = await chromium.launchPersistentContext(profile, {
  headless: true, channel: 'chromium',
  viewport: { width: 320, height: 900 },
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
});
const errors = [], requests = [], files = [], comparisons = [];
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  const popupUrl = worker.url().replace('/storage/layout-worker.js', '/popup/popup.html');
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(popupUrl);
  await page.waitForSelector('.master');
  await page.evaluate(() => {
    chrome.tabs.query = async () => [{ id: 1 }];
    chrome.tabs.sendMessage = async () => {
      if (!globalThis.fixtureConnected) throw new Error('No receiver');
      return { states: {} };
    };
  });
  async function seed() {
    await worker.evaluate(async () => {
      // Synthetic numeric-free padding is test data, never a real conversation record.
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('butter-layouts-v1', 1);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
      const tx = db.transaction('geometry', 'readwrite'), rows = tx.objectStore('geometry');
      rows.clear();
      for (let i = 0; i < 12; i++) rows.put({ key: `fixture-${i}`, account: 'fixture', conv: String(i), time: Date.now(), used: Date.now(), padding: '0'.repeat(699800), bytes: 0 });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    });
    await page.evaluate(() => refreshUsage());
  }
  // Initialize the database through its public API before seeding.
  await page.evaluate(() => refreshUsage());
  let cases = [
    ['01-normal', {}], ['02-problem', { broken: true }], ['03-away', { away: true }],
    ['04-paused', { paused: true }], ['05-confirm', { clear: 'confirm' }], ['06-cleared', { clear: 'done' }],
    ['07-normal', {}], ['08-problem', { broken: true }], ['09-en-memory-off', { lang: 'en', memory: false }],
    ['10-en-paused', { lang: 'en', paused: true }], ['11-melt', { animation: true }], ['12-melt', { animation: true }],
  ];
  if (process.env.BUTTER_CASES) cases = cases.filter(([name]) => process.env.BUTTER_CASES.split(',').includes(name.slice(0, 2)));
  const mockup = process.env.BUTTER_MOCKUP;
  let ref;
  if (mockup) {
    ref = await browser.newPage();
    let source = await fs.readFile(mockup, 'utf8');
    source = source.replace(/<link[^>]*fonts.googleapis[^>]*>/, '');
    const font = async name => `data:font/woff2;base64,${(await fs.readFile(`${repo}/extension/popup/fonts/${name}.woff2`)).toString('base64')}`;
    source = source.replace('</style>', `@font-face{font-family:'Bagel Fat One';src:url('${await font('bagel-wordmark')}')}@font-face{font-family:'Nunito';src:url('${await font('nunito-latin')}');font-weight:500 900}.popup{box-shadow:none}</style>`);
    await ref.setContent(source); await ref.evaluate(() => document.fonts.ready);
  }
  for (const [name, config] of cases) for (const color of ['light', 'dark']) {
    await page.bringToFront();
    await page.emulateMedia({ colorScheme: color, reducedMotion: 'no-preference' });
    await seed();
    await page.evaluate(async config => {
      clearTimeout(clearTimer); clearState = 'idle';
      fixtureConnected = !config.away;
      const value = ButterStatus.normalize({ enabled: !config.paused && !config.animation, lang: config.lang || 'zh', opts: { layout: config.memory !== false } });
      await chrome.storage.session.set({ butterFailures: config.broken ? { rail: { rail: true } } : {} });
      await chrome.storage.local.set({ butter: value });
      await poll();
      await refreshUsage();
      document.activeElement?.blur();
    }, config);
    if (config.clear) {
      await page.locator('[data-clear="ask"]').click();
      if (config.clear === 'done') {
        await page.locator('[data-clear="confirm"]').click();
        await page.waitForFunction(() => clearState === 'done');
        // Hold the transient success state only for its design screenshot. The live smoke checks the real 2s timeout.
        await page.evaluate(() => clearTimeout(clearTimer));
        assert.equal((await page.evaluate(() => chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-usage' })) ).bytes, 0);
      }
    }
    await page.waitForTimeout(350);
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.evaluate(() => document.activeElement?.blur());
    assert.equal(await page.locator('body').evaluate(e => e.scrollWidth), 320);
    assert.equal(await page.locator('[role="switch"]').count(), 5);
    assert.ok(!/待验证|Not yet checked/.test(await page.locator('body').innerText()));
    const metrics = () => ['.hd', '.master', '.label', '.list', '.row', '.use', '.ft'].map(selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return { selector, top: r?.top, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
    });
    const builtMetrics = await page.evaluate(metrics);
    const file = `${shots}/${name}-${color}.png`;
    await page.locator('#popup').screenshot({ path: file }); files.push(file);
    // Also capture the native-height viewport and its scrollable bottom for tall states.
    const height = await page.locator('#popup').evaluate(e => e.offsetHeight);
    if (height > 600) {
      await page.setViewportSize({ width: 320, height: 600 });
      await page.screenshot({ path: `${shots}/${name}-${color}-viewport.png` });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.screenshot({ path: `${shots}/${name}-${color}-bottom.png` });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (config.animation) {
      await page.locator('[data-switch="master"]').click();
      const frame = await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        const a = document.querySelector('.drip').getAnimations()[0];
        if (a) { a.pause(); a.currentTime = 150; }
        return { duration: a?.effect.getTiming().duration, transform: getComputedStyle(document.querySelector('.drip')).transform };
      });
      assert.equal(frame.duration, 300);
      await page.locator('#popup').screenshot({ path: `${shots}/${name}-${color}-mid.png`, animations: 'allow' });
      await page.evaluate(() => document.querySelector('.drip').getAnimations().forEach(a => a.finish()));
      await page.waitForTimeout(320);
      await page.locator('#popup').screenshot({ path: `${shots}/${name}-${color}-on.png` });
    }
    if (ref) {
      const index = Number(name.slice(0, 2)) - 1;
      await ref.bringToFront();
      await ref.evaluate(({ index, color }) => {
        // Place the reference at the same pixel origin; figure captions otherwise introduce subpixel offsets.
        document.body.innerHTML = popup({ ...figs[index][2], dark: color === 'dark' });
        document.getAnimations().forEach(a => a.finish());
      }, { index, color });
      const reference = `${shots}/reference-${name}-${color}.png`;
      await ref.locator('.popup').first().screenshot({ path: reference });
      const referenceMetrics = await ref.locator('.popup').first().evaluate(el => {
        const base = el.getBoundingClientRect().top;
        return ['.hd', '.master', '.label', '.list', '.row', '.use', '.ft'].map(selector => {
          const e = el.querySelector(selector), r = e?.getBoundingClientRect();
          return { selector, top: r ? r.top - base : undefined, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
        });
      });
      comparisons.push({ name, color, built: builtMetrics, reference: referenceMetrics });
    }
  }
  // Cancel is non-destructive; language, focus, master motion and reduced motion work live.
  await page.bringToFront();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.keyboard.press('Tab');
  await page.locator('[data-switch="master"]').focus();
  assert.equal(await page.locator('[data-switch="master"]').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
  const before = await page.locator('[data-switch="master"]').getAttribute('aria-checked');
  await page.keyboard.press('Space');
  assert.notEqual(await page.locator('[data-switch="master"]').getAttribute('aria-checked'), before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.drip').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  assert.equal(await page.locator('.tg').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  await page.getByRole('button', { name: '中文', exact: true }).focus();
  assert.equal(await page.locator('.lang').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
  await page.evaluate(async () => {
    await chrome.storage.session.set({ butterFailures: { streaming: { cv: true }, rail: { rail: true } } });
    prefs.enabled = true; render();
  });
  await page.waitForFunction(() => document.querySelectorAll('.chip').length === 2);
  assert.equal(await page.locator('.chip').count(), 2);
  assert.match(await page.locator('.warn').innerText(), /Smoother streaming and Question rail/);
  await page.evaluate(async () => {
    const next = await chrome.runtime.sendMessage({ type: 'butter-status-record', states: { cv: 'ok', rail: 'ok' } });
    failures = next; render();
  });
  assert.equal(await page.locator('.warn').count(), 0);
  await page.locator('[data-clear="ask"]').click(); await page.locator('[data-clear="cancel"]').click();
  assert.equal(await page.locator('[data-clear="ask"]').count(), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(url => /^https?:/.test(url)), []);
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID() });
    await chrome.storage.local.clear(); await chrome.storage.session.clear();
  });
  await fs.writeFile(`${shots}/geometry.json`, JSON.stringify(comparisons, null, 2));
  await fs.writeFile(`${shots}/screenshots.json`, JSON.stringify({ popupUrl, files, errors, remoteRequests: [] }, null, 2));
  console.log(`PASS: ${files.length} full 320px state screenshots (${cases.length} states × light/dark), native-height scroll views, melt frames, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.`);
} finally {
  await browser.close(); await fs.rm(profile, { recursive: true, force: true });
}
