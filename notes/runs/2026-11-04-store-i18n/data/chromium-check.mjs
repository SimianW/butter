// Run from the repo root: node notes/runs/2026-11-04-store-i18n/data/chromium-check.mjs
// Uses only disposable /tmp profiles and the built zip; never opens ChatGPT.
import { chromium } from '../../../../lab/harness/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const output = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(output, '../../../..');
const unpacked = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-i18n-package-'));
execFileSync('unzip', ['-q', path.join(root, 'dist/butter-0.1.0-alpha.12.zip'), '-d', unpacked]);
const extension = path.join(unpacked, 'butter');
const results = [];
try {
  for (const lang of ['en-US', 'zh-CN']) {
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-i18n-profile-'));
    const browser = await chromium.launchPersistentContext(profile, {
      headless: true,
      channel: 'chromium',
      viewport: { width: 1100, height: 850 },
      locale: lang,
      env: { ...process.env, LANG: lang.replace('-', '_') + '.UTF-8', LANGUAGE: lang.replace('-', '_') },
      args: [`--lang=${lang}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    try {
      const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
      const id = new URL(worker.url()).host;
      const page = await browser.newPage();
      await page.goto(`chrome://extensions/?id=${id}`);
      await page.waitForSelector('extensions-detail-view', { state: 'visible' });
      const management = await page.evaluate(async (id) => {
        const extensions = await chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true });
        const info = extensions.find((extension) => extension.id === id);
        return { name: info.name, description: info.description, version: info.version, state: info.state };
      }, id);
      const expected = JSON.parse(await fs.readFile(path.join(extension, `_locales/${lang === 'en-US' ? 'en' : 'zh_CN'}/messages.json`), 'utf8'));
      assert.equal(management.name, expected.appName.message);
      assert.equal(management.description, expected.appDesc.message);
      await page.screenshot({ path: path.join(output, `extensions-${lang}.png`) });
      await page.setViewportSize({ width: 320, height: 650 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`chrome-extension://${id}/popup/popup.html`);
      await page.waitForSelector('.master');
      await page.evaluate(() => document.fonts.ready);
      const popup = await page.evaluate(() => ({
        version: document.querySelector('.ver').textContent,
        switches: [...document.querySelectorAll('[role="switch"]')].map((element) => ({ key: element.dataset.switch, label: element.getAttribute('aria-label'), checked: element.getAttribute('aria-checked') })),
        languageButtons: [...document.querySelectorAll('[data-lang]')].map((button) => ({ text: button.textContent, selected: button.getAttribute('aria-pressed') })),
        text: document.body.innerText,
        uiLanguage: chrome.i18n.getUILanguage(),
        manifest: { name: chrome.runtime.getManifest().name, description: chrome.runtime.getManifest().description },
      }));
      assert.equal(popup.version, 'v0.1.0 · alpha 12');
      assert.equal(popup.switches.filter((item) => item.key !== 'master').length, 4);
      assert.equal(popup.switches.length, 5);
      assert.equal(errors.length, 0);
      await page.screenshot({ path: path.join(output, `popup-${lang}.png`) });
      await page.getByRole('button', { name: '中文', exact: true }).click();
      await page.waitForSelector('[data-lang="zh"][aria-pressed="true"]');
      const chineseLabels = await page.locator('[role="switch"]').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
      assert.ok(chineseLabels.every((label) => /[\u4e00-\u9fff]/.test(label)));
      await page.reload();
      await page.waitForSelector('[data-lang="zh"][aria-pressed="true"]');
      await page.screenshot({ path: path.join(output, `popup-${lang}-chinese.png`) });
      await page.getByRole('button', { name: 'EN', exact: true }).click();
      await page.waitForSelector('[data-lang="en"][aria-pressed="true"]');
      const englishLabels = await page.locator('[role="switch"]').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
      assert.deepEqual(englishLabels, popup.switches.map((item) => item.label));
      assert.equal(errors.length, 0);
      results.push({ lang, chromium: browser.browser().version(), management, popup, languageSwitch: { chineseLabels, persistedAfterReload: true, restoredEnglishLabels: englishLabels }, errors });
      console.log(JSON.stringify(results.at(-1), null, 2));
    } finally {
      await browser.close();
      await fs.rm(profile, { recursive: true, force: true });
    }
  }
  await fs.writeFile(path.join(output, 'chromium-results.json'), JSON.stringify(results, null, 2) + '\n');
} finally {
  await fs.rm(unpacked, { recursive: true, force: true });
}
