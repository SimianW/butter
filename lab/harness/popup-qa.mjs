// Browser fixtures live here, never in the shipped extension.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const shots = '/tmp/butter-popup-shots'; await fs.mkdir(shots, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.developerPrivate.getExtensionsInfo({}, rows => r(rows.find(x => x.name === 'Butter for ChatGPT').id))));
await page.setViewportSize({ width: 320, height: 600 });
await page.goto(`chrome-extension://${id}/popup.html`);
await page.waitForSelector('.card');
const popupUrl = page.url();
// Optional: BUTTER_MOCKUP=<path to the design mockup HTML> also captures reference shots (the mockup isn't in the repo).
const mockup = process.env.BUTTER_MOCKUP;
const ref = mockup ? await context.newPage() : null;
if (ref) {
  await ref.setContent(await fs.readFile(mockup, 'utf8'));
  await ref.addStyleTag({ content: '.popup { box-shadow: none; max-height:600px; overflow-y:auto; scrollbar-width:thin; }' });
}
const defaults = { enabled: true, opts: { container: true, cv: true, throttle: true, older: true, rail: true }, lang: 'en' };
const fixtures = [
  ['home-ok', 'home', ['ok','ok','ok','ok','ok'], true, true],
  ['home-broken', 'home', ['ok','ok','wait','fail','off'], true, true],
  ['home-paused', 'home', ['ok','ok','ok','ok','off'], false, true],
  ['home-away', 'home', ['wait','wait','wait','wait','wait'], true, false],
  ['settings-mixed', 'settings', ['ok','ok','wait','fail','off'], true, true],
  ['settings-paused', 'settings', ['ok','ok','ok','ok','off'], false, true],
];
const files = [];
for (const lang of ['en','zh']) for (const theme of ['light','dark']) for (const [name, screen, values, enabled, present] of fixtures) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(async ({ defaults, lang, values, enabled, present, screen }) => {
    chrome.tabs.query = async () => [{ id: 1 }];
    chrome.tabs.sendMessage = async () => {
      if (!present) throw new Error('No receiver');
      return { states: Object.fromEntries(ButterStatus.keys.map((k, i) => [k, values[i]])) };
    };
    prefs = { ...defaults, lang, enabled, opts: Object.fromEntries(ButterStatus.keys.map((k, i) => [k, values[i] !== 'off'])) };
    page = screen; await chrome.storage.local.set({ butter: prefs }); await poll();
    document.activeElement?.blur(); document.getElementById('popup').scrollTop = 0;
  }, { defaults, lang, values, enabled, present, screen });
  await page.waitForTimeout(180);
  await page.bringToFront();
  const file = `${shots}/${lang}-${theme}-${name}.png`; await page.locator('#popup').screenshot({ path: file }); files.push(file);
  const height = await page.locator('#popup').evaluate(e => e.scrollHeight);
  if (height > 600) {
    await page.locator('#popup').evaluate(e => { e.scrollTop = e.scrollHeight; });
    const bottom = file.replace('.png','-bottom.png'); await page.locator('#popup').screenshot({ path: bottom }); files.push(bottom);
  }
  // Compare the 14 approved reference panels, including clipping at Chrome's height cap.
  const fixtureIndex = fixtures.findIndex(x => x[0] === name);
  const index = lang === 'en' ? (theme === 'light' ? 0 : 6) + fixtureIndex : theme === 'light' && name === 'home-ok' ? 12 : theme === 'light' && name === 'settings-mixed' ? 13 : -1;
  if (ref && index >= 0) { await ref.evaluate(lang => document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en', lang); await ref.bringToFront(); await ref.locator('.popup').nth(index).screenshot({ path: `${shots}/reference-${lang}-${theme}-${name}.png` }); }
}
// Dynamic card count, off items excluded, keyboard, scrolling, and live theme/language.
await page.evaluate(async () => {
  prefs = structuredClone(ButterStatus.normalize()); connected = true; page = 'home';
  states = { container: 'fail', cv: 'fail', throttle: 'wait', older: 'ok', rail: 'off' }; prefs.opts.rail = false; render();
});
assert.equal(await page.locator('.big').textContent(), '2 of 5 broken');
await page.locator('.card').click(); await page.getByRole('button', { name: '中文', exact: true }).click();
assert.equal(await page.locator('.title').textContent(), '检测与设置');
await page.locator('.back').click();
assert.equal(await page.locator('.big').textContent(), '2 项优化已失效');
await page.locator('.card').click();
assert.equal(await page.locator('#popup').evaluate(e => e.clientHeight), 600);
assert.equal(await page.locator('body').evaluate(e => e.scrollWidth), 320);
await page.keyboard.press('Tab');
await page.getByRole('switch').first().focus();
assert.equal(await page.getByRole('switch').first().evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
const before = await page.getByRole('switch').first().getAttribute('aria-checked');
await page.keyboard.press('Space');
assert.notEqual(await page.getByRole('switch').first().getAttribute('aria-checked'), before);
assert.equal(await page.getByRole('switch').first().evaluate(e => getComputedStyle(e).transitionDuration), '0.15s');
await page.evaluate(async () => { await chrome.storage.local.set({ butter: ButterStatus.normalize() }); });
assert.deepEqual(errors, []);
await fs.writeFile(`${shots}/screenshots.json`, JSON.stringify({ popupUrl, files, errors }, null, 2));
console.log(`PASS: ${files.length} screenshots; all approved states plus Chinese dark variants, capped scrolling, dynamic counts, keyboard switch, focus ring, 150ms transition; no popup errors.`);
await ref?.close(); await page.close(); await browser.close();
