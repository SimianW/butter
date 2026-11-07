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
  viewport: { width: 360, height: 900 },
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
});
const errors = [], requests = [], files = [], comparisons = [], heights = {};
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
  await page.evaluate(async () => {
    await chrome.storage.local.set({ butter: { layoutConsent: 'granted' } });
    await refreshUsage();
  });
  let cases = [
    ['01-normal', {}], ['02-problem', { broken: true }], ['03-away', { away: true }],
    ['04-paused', { paused: true }], ['05-confirm', { clear: 'confirm' }], ['06-cleared', { clear: 'done' }],
    ['07-normal', {}], ['08-problem', { broken: true }], ['09-en-memory-off', { lang: 'en', memory: false }],
    ['10-en-paused', { lang: 'en', paused: true }], ['11-melt', { animation: true }], ['12-melt', { animation: true }],
    // Ask in branch (#30): on, off and failed in both languages; refs are panels of the approved mockup.
    ['13-en-branch-on', { lang: 'en' }], ['14-en-branch-off', { lang: 'en', branch: false }],
    ['15-en-branch-failed', { lang: 'en', broken: 'branch' }], ['16-zh-branch-on', { lang: 'zh' }],
    ['17-zh-branch-off', { lang: 'zh', branch: false }], ['18-zh-branch-failed', { lang: 'zh', broken: 'branch' }],
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
      const value = ButterStatus.normalize({ layoutConsent: 'granted', enabled: !config.paused && !config.animation, lang: config.lang || 'zh', opts: { layout: config.memory !== false, branch: config.branch !== false } });
      const broken = config.broken === true ? 'rail' : config.broken;
      await chrome.storage.session.set({ butterFailures: broken ? { [broken]: { [broken]: true } } : {} });
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
    assert.equal(await page.locator('body').evaluate(e => e.scrollWidth), 360);
    assert.equal(await page.locator('[role="switch"]').count(), 6);
    assert.equal(await page.locator('[data-switch="branch"]').getAttribute('aria-checked'), String(config.branch !== false));
    assert.equal(await page.locator('.row.broken [data-switch="branch"]').count(), config.broken === 'branch' ? 1 : 0);
    assert.ok(!/待验证|Not yet checked/.test(await page.locator('body').innerText()));
    const metrics = () => ['.hd', '.master', '.label', '.list', '.row', '.use', '.hd-side'].map(selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return { selector, top: r?.top, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
    });
    const builtMetrics = await page.evaluate(metrics);
    const file = `${shots}/${name}-${color}.png`;
    await page.locator('#popup').screenshot({ path: file }); files.push(file);
    // Also capture the native-height viewport and its scrollable bottom for tall states.
    const height = await page.locator('#popup').evaluate(e => e.offsetHeight);
    heights[`${name}-${color}`] = height;
    // Chromium caps popups at 600px; only the warning banner may push a state past it.
    if (!config.broken) assert.ok(height <= 600, `${name}-${color} is ${height}px, over the 600px popup cap`);
    if (height > 600) {
      await page.setViewportSize({ width: 360, height: 600 });
      await page.screenshot({ path: `${shots}/${name}-${color}-viewport.png` });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.screenshot({ path: `${shots}/${name}-${color}-bottom.png` });
      await page.setViewportSize({ width: 360, height: 900 });
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
    if (ref && Number(name.slice(0, 2)) <= 12) {
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
        return ['.hd', '.master', '.label', '.list', '.row', '.use', '.hd-side'].map(selector => {
          const e = el.querySelector(selector), r = e?.getBoundingClientRect();
          return { selector, top: r ? r.top - base : undefined, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
        });
      });
      comparisons.push({ name, color, built: builtMetrics, reference: referenceMetrics });
    }
  }
  // BUTTER_BRANCH_MOCKUP=<popup-mockup-approved.html>: compare the branch states with the approved panels.
  const branchMockup = process.env.BUTTER_BRANCH_MOCKUP, branchRefs = [];
  if (branchMockup) {
    const mock = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(branchMockup)}`);
    await mock.waitForFunction(() => [...document.querySelectorAll('small[id^="h"]')].every(e => /\d+ px/.test(e.textContent)));
    const panels = { 1: '13-en-branch-on-light', 2: '14-en-branch-off-light', 3: '15-en-branch-failed-light', 5: '16-zh-branch-on-light', 6: '17-zh-branch-off-light', 7: '18-zh-branch-failed-light', 8: '13-en-branch-on-dark', 9: '15-en-branch-failed-dark', 10: '16-zh-branch-on-dark', 11: '18-zh-branch-failed-dark' };
    const panel = await browser.newPage({ viewport: { width: 360, height: 900 } });
    panel.on('pageerror', e => errors.push(`mockup panel: ${e.message}`));
    const png = async file => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
    for (const [i, state] of Object.entries(panels)) {
      const reference = `${shots}/reference-${state}.png`;
      // Render the panel's own document at the page origin; inside the grid its frame sits at a subpixel offset.
      const doc = path.join(profile, `panel-${i}.html`);
      await fs.writeFile(doc, await mock.locator(`#f${i}`).getAttribute('srcdoc'));
      await panel.goto(`file://${doc}`);
      await panel.evaluate(() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 500))));
      await panel.evaluate(() => document.getAnimations().forEach(a => a.finish()));
      await panel.locator('#popup').screenshot({ path: reference });
      // The usage line shows seeded storage, which the worker rejects since its row validation; compare the UI around it.
      const mask = await panel.locator('.use').evaluate(e => { const r = e.getBoundingClientRect(); return [Math.floor(r.top), Math.ceil(r.bottom)]; });
      const refHeight = Number((await mock.locator(`#h${i}`).innerText()).match(/(\d+) px/)[1]);
      // Share of pixels outside the usage line that differ by more than 24 in any channel.
      const diff = await mock.evaluate(async ([a, b, mask]) => {
        const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const [x, y] = await Promise.all([load(a), load(b)]);
        if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
        const data = img => { const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
        const p = data(x), q = data(y);
        let n = 0;
        for (let k = 0; k < p.length; k += 4) if ((Math.floor(k / 4 / x.width) < mask[0] || Math.floor(k / 4 / x.width) >= mask[1]) && Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24) n++;
        return { ratio: n / (p.length / 4) };
      }, [await png(`${shots}/${state}.png`), await png(reference), mask]);
      branchRefs.push({ state, built: heights[state], reference: refHeight, ...diff });
      assert.equal(heights[state], refHeight, `${state} is ${heights[state]}px; the approved mockup is ${refHeight}px`);
      assert.ok(diff.ratio !== undefined && diff.ratio < 0.001, `${state} differs from the approved mockup: ${JSON.stringify(diff)}`);
    }
    await mock.close(); await panel.close();
  }
  // The branch switch writes only its own key.
  await page.bringToFront();
  await page.evaluate(async () => { await chrome.storage.local.set({ butter: ButterStatus.normalize({ layoutConsent: 'granted', lang: 'en' }) }); });
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === false);
  assert.equal((await page.evaluate(() => chrome.storage.local.get('butter'))).butter.opts.rail, true);
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === true);
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
  await fs.writeFile(`${shots}/heights.json`, JSON.stringify({ heights, branchRefs }, null, 2));
  await fs.writeFile(`${shots}/screenshots.json`, JSON.stringify({ popupUrl, files, errors, remoteRequests: [] }, null, 2));
  console.log(`PASS: ${files.length} full 360px state screenshots (${cases.length} states × light/dark), native-height scroll views, melt frames, branch switch, ${branchRefs.length} approved-mockup matches, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.`);
} finally {
  await browser.close(); await fs.rm(profile, { recursive: true, force: true });
}
