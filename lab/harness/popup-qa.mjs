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
const errors = [], requests = [], files = [], comparisons = [], heights = {}, liveRects = {};
// BUTTER_REDESIGN_MOCKUP=<#35 Mockup.html> compares built states with the mockup's panels on the
// BUTTER_REDESIGN_SIDE (`before` or `after`, default `after`). Panel key -> built state.
const redesignMockup = process.env.BUTTER_REDESIGN_MOCKUP, redesignSide = process.env.BUTTER_REDESIGN_SIDE || 'after';
assert.ok(['before', 'after'].includes(redesignSide), `BUTTER_REDESIGN_SIDE must be before or after, not ${redesignSide}`);
const redesignStates = {
  default: '13-en-branch-on-light', paused: '10-en-paused-light', 'rail-fault': '19-en-rail-fault-light',
  'layouts-pending': '20-en-layouts-pending-light', 'clear-confirm': '21-en-clear-confirm-light',
  'branch-off': '14-en-branch-off-light', 'branch-fault': '15-en-branch-failed-light',
  dark: '13-en-branch-on-dark', zh: '16-zh-branch-on-light',
};
// Panels that cannot match, with the reason; they are still measured and reported.
// #39 and #40 delete their entries when they restyle those states.
const redesignExcluded = {
  'paused-after': 'paused look lands in #39',
  'rail-fault-after': 'in-row faults land in #39',
  'branch-fault-after': 'in-row faults land in #39',
};
// The header version label and the storage line show live data; both comparisons mask them.
const liveRegions = () => [...document.querySelectorAll('.ver, .use')].map(e => {
  const r = e.getBoundingClientRect();
  return [Math.floor(r.left), Math.floor(r.top), Math.ceil(r.right), Math.ceil(r.bottom)];
});
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
    // English states for the #35 redesign panels.
    ['19-en-rail-fault', { lang: 'en', broken: true }], ['20-en-layouts-pending', { lang: 'en', consent: 'pending' }],
    ['21-en-clear-confirm', { lang: 'en', clear: 'confirm' }],
    // The consent note in Chinese, for the 600 px cap (05 covers the Chinese clear confirmation).
    ['22-zh-layouts-pending', { lang: 'zh', consent: 'pending' }],
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
      const value = ButterStatus.normalize({ layoutConsent: config.consent || 'granted', enabled: !config.paused && !config.animation, lang: config.lang || 'zh', opts: { layout: config.memory !== false, branch: config.branch !== false } });
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
    const metrics = () => ['.hd', '.master', '.card', '.row', '.use', '.ft'].map(selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return { selector, top: r?.top, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
    });
    const builtMetrics = await page.evaluate(metrics);
    const file = `${shots}/${name}-${color}.png`;
    await page.locator('#popup').screenshot({ path: file }); files.push(file);
    // Also capture the native-height viewport and its scrollable bottom for tall states.
    const height = await page.locator('#popup').evaluate(e => e.offsetHeight);
    heights[`${name}-${color}`] = height;
    liveRects[`${name}-${color}`] = await page.evaluate(liveRegions);
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
        return ['.hd', '.master', '.card', '.row', '.use', '.ft'].map(selector => {
          const e = el.querySelector(selector), r = e?.getBoundingClientRect();
          return { selector, top: r ? r.top - base : undefined, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
        });
      });
      comparisons.push({ name, color, built: builtMetrics, reference: referenceMetrics });
    }
  }
  const redesignRefs = [];
  if (redesignMockup) {
    const mock = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(redesignMockup)}`);
    // The page script measures each panel on load and again up to 3 s later, once its fonts settle.
    await mock.waitForFunction(() => [...document.querySelectorAll('iframe[data-panel]')].every(f => f.dataset.h));
    await mock.waitForTimeout(3200);
    const panel = await browser.newPage({ viewport: { width: 360, height: 900 } });
    panel.on('pageerror', e => errors.push(`mockup panel: ${e.message}`));
    const png = async file => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
    for (const [key, state] of Object.entries(redesignStates)) {
      const name = `${key}-${redesignSide}`, frame = mock.locator(`iframe[data-panel="${name}"]`);
      const row = { panel: name, state, excluded: redesignExcluded[name] };
      if (!(await frame.count())) { redesignRefs.push({ ...row, skipped: 'no panel on this side' }); continue; }
      if (!heights[state]) { redesignRefs.push({ ...row, skipped: 'state not captured (BUTTER_CASES)' }); continue; }
      row.built = heights[state];
      row.reference = Number(await frame.getAttribute('data-h'));
      // Render the panel's own document (placeholders already substituted) at the page origin;
      // inside the grid its frame sits at a subpixel offset.
      const doc = path.join(profile, `${name}.html`);
      await fs.writeFile(doc, await frame.getAttribute('srcdoc'));
      await panel.emulateMedia({ colorScheme: state.endsWith('-dark') ? 'dark' : 'light', reducedMotion: 'no-preference' });
      await panel.goto(`file://${doc}`);
      await panel.evaluate(() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300))));
      // The numbered badges in default-after annotate the mockup; they are not UI.
      await panel.evaluate(() => {
        document.getAnimations().forEach(a => a.finish());
        document.querySelectorAll('.mk').forEach(e => { e.style.visibility = 'hidden'; });
      });
      const reference = `${shots}/reference-${name}.png`;
      await panel.screenshot({ path: reference, clip: { x: 0, y: 0, width: 360, height: row.reference } });
      // Mask the live regions where either document draws them; their markup differs per side.
      const mask = [...liveRects[state], ...(await panel.evaluate(liveRegions))];
      // Share of unmasked pixels that differ by more than 24 in any channel. Each image is cut to
      // its measured height (an element screenshot rounds a fractional bottom up a row); area
      // outside the shorter one counts as different, so a height mismatch still yields a ratio.
      row.ratio = await mock.evaluate(async ([a, b, ha, hb, mask]) => {
        const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const data = (img, h) => { const c = new OffscreenCanvas(360, h), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, 360, h).data; };
        const [x, y] = await Promise.all([load(a), load(b)]), p = data(x, ha), q = data(y, hb), h = Math.max(ha, hb);
        let n = 0;
        for (let j = 0; j < h; j++) for (let i = 0; i < 360; i++) {
          if (mask.some(([l, t, r, b]) => i >= l && i < r && j >= t && j < b)) continue;
          if (j >= ha || j >= hb) { n++; continue; }
          const k = (j * 360 + i) * 4;
          if (Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24) n++;
        }
        return n / (360 * h);
      }, [await png(`${shots}/${state}.png`), await png(reference), row.built, row.reference, mask]);
      row.ok = row.built === row.reference && row.ratio < 0.001;
      redesignRefs.push(row);
    }
    await mock.close(); await panel.close();
    console.log(`Redesign mockup, ${redesignSide} panels:`);
    for (const r of redesignRefs) console.log(`  ${r.panel.padEnd(24)} ${r.skipped ? `skipped: ${r.skipped}` : `${r.ok ? 'match' : 'DIFF '}  height ${r.built}/${r.reference} px  diff ${(r.ratio * 100).toFixed(3)}%`}${r.excluded ? `  (excluded: ${r.excluded})` : ''}`);
  }
  // The branch switch writes only its own key.
  await page.bringToFront();
  // The last case may leave the clear flow open; the live checks start from idle.
  await page.evaluate(async () => {
    clearTimeout(clearTimer); clearState = 'idle';
    await chrome.storage.local.set({ butter: ButterStatus.normalize({ layoutConsent: 'granted', lang: 'en' }) });
  });
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === false);
  assert.equal((await page.evaluate(() => chrome.storage.local.get('butter'))).butter.opts.rail, true);
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === true);
  // Each row is a label around its switch: a click on its description toggles exactly that group.
  const opts = async () => (await page.evaluate(() => chrome.storage.local.get('butter'))).butter.opts;
  const railRow = page.locator('.row', { has: page.locator('[data-switch="rail"]') });
  const beforeRow = await opts();
  await railRow.locator('.d').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.rail === false);
  assert.deepEqual(await opts(), { ...beforeRow, rail: false });
  assert.equal(await page.locator('[data-switch="rail"]').getAttribute('aria-checked'), 'false');
  await railRow.locator('.n').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.rail === true);
  assert.deepEqual(await opts(), beforeRow);
  // Every switch stays a named button with its checked state and stable hook.
  for (const e of await page.locator('[role="switch"]').evaluateAll(list => list.map(e => ({ tag: e.tagName, name: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), key: e.dataset.switch }))))
    assert.ok(e.tag === 'BUTTON' && e.name && /^(true|false)$/.test(e.checked) && e.key, JSON.stringify(e));
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
  await fs.writeFile(`${shots}/heights.json`, JSON.stringify({ heights, redesignRefs }, null, 2));
  await fs.writeFile(`${shots}/screenshots.json`, JSON.stringify({ popupUrl, files, errors, remoteRequests: [] }, null, 2));
  // Fail only after every panel has been compared and reported.
  const mismatched = redesignRefs.filter(r => r.ok === false && !r.excluded);
  assert.equal(mismatched.length, 0, `${mismatched.length} of ${redesignRefs.length} ${redesignSide} panels differ from the redesign mockup: ${mismatched.map(r => `${r.panel} (${r.built}/${r.reference} px, ${(r.ratio * 100).toFixed(3)}%)`).join('; ')}`);
  console.log(`PASS: ${files.length} full 360px state screenshots (${cases.length} states × light/dark), native-height scroll views, melt frames, branch switch, ${redesignRefs.filter(r => r.ok).length} redesign-mockup matches, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.`);
} finally {
  await browser.close(); await fs.rm(profile, { recursive: true, force: true });
}
