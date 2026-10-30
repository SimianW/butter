// Set Speed Booster Toolkit settings (chrome.storage.local csb_settings) in the running lab browser,
// then reload the test chat and report the num_turns ChatGPT requested and how many turns mounted.
// Usage: node sb-config.mjs '{"messageLimit":1}'
import { chromium } from 'playwright';
const ID = 'finipiejpmpccemiedioehhpgcafnndo';
const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const patch = JSON.parse(process.argv[2] ?? '{}');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const opt = await ctx.newPage();
await opt.goto(`chrome-extension://${ID}/src/preview/preview.html`);
const settings = await opt.evaluate(async p => {
  const cur = (await chrome.storage.local.get('csb_settings')).csb_settings ?? {};
  const next = { enabled: true, messageLimit: 10, alwaysLoadFull: false, manualPaging: false, manualLimit: 10,
    quietFullLoad: false, chatNavigator: true, searchHotkey: true, debug: false, disableNotifications: false, foldersEnabled: true, ...cur, ...p };
  await chrome.storage.local.set({ csb_settings: next });
  return next;
}, patch);
await opt.close();
for (const p of ctx.pages()) if (!p.url().startsWith('https://chatgpt.com')) await p.close().catch(() => {});
const page = ctx.pages()[0] ?? await ctx.newPage();
const seen = [];
page.on('request', r => { if (/\/backend-api\/conversations\/[^/?]+(\/messages)?\?/.test(r.url())) seen.push(new URL(r.url()).search); });
await page.goto(CHAT, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-turn-key]', { timeout: 60000 });
await page.waitForTimeout(8000);
// The first chat visit after install shows a full-screen welcome modal; close it like a user would.
let modal = 'none';
if (await page.locator('#csb-intro-modal').count()) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(1000);
  modal = (await page.locator('#csb-intro-modal').count()) ? 'still open' : 'closed with Escape';
}
const turns = await page.evaluate(() => document.querySelectorAll('[data-turn-key]').length);
const cfg = await page.evaluate(() => localStorage.getItem('csb_config'));
console.log(JSON.stringify({ settings, requests: seen, turns, modal, csb_config: cfg }, null, 1));
await browser.close();
