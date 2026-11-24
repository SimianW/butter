// Records the Butter popup for #158's PR evidence. Usage: node record.mjs <extensionDir> <before|after>
// Fresh profile per run (a fresh install), light theme, English (the default), 360 px wide.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const [ext, side] = process.argv.slice(2);
if (!ext || !['before', 'after'].includes(side)) throw new Error('usage: record.mjs <extensionDir> <before|after>');
const out = process.env.OUT || '/tmp/butter-rec-158';
const W = 360, H = 640;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), `rec-158-${side}-`));
const videoDir = path.join(out, `video-${side}`);
await fs.rm(videoDir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(profile, {
  headless: true, channel: 'chromium',
  viewport: { width: W, height: H }, colorScheme: 'light', reducedMotion: 'no-preference', locale: 'en-US',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  recordVideo: { dir: videoDir, size: { width: W, height: H } },
});
const errors = [];
try {
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  // The branch's worker writes an install marker; main has none, so wait up to 2 s and move on.
  for (let i = 0; i < 40; i++) {
    if ((await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter?.defaultsVersion))) break;
    await new Promise(r => setTimeout(r, 50));
  }
  const popupUrl = worker.url().replace(/\/[^/]+\/[^/]+$/, '/popup/popup.html');
  const page = ctx.pages()[0] || await ctx.newPage();
  for (const p of ctx.pages()) if (p !== page) await p.close();
  page.on('pageerror', e => errors.push(e.message));
  // A visible pointer: a dot that follows real mouse events.
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(220,60,40,.55);border:2px solid rgba(160,30,20,.9);pointer-events:none;z-index:2147483647;transform:translate(180px,560px);transition:width .12s,height .12s,margin .12s';
      document.documentElement.appendChild(d);
      addEventListener('mousemove', e => { d.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
      addEventListener('mousedown', () => { d.style.width = d.style.height = '12px'; d.style.margin = '-6px 0 0 -6px'; }, true);
      addEventListener('mouseup', () => { d.style.width = d.style.height = '18px'; d.style.margin = '-9px 0 0 -9px'; }, true);
    });
  });
  const t0 = Date.now();
  await page.goto(popupUrl);
  await page.waitForSelector('.master');
  // The popup asks the active tab for its status; no ChatGPT tab here, so it reads as "away".
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(180, 560);
  await page.waitForTimeout(400);
  const ready = (Date.now() - t0) / 1000;
  let mx = 180, my = 560;
  const moveTo = async (loc) => {
    const b = await loc.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 12 });
    mx = x; my = y;
  };
  const click = async (loc) => { await moveTo(loc); await page.waitForTimeout(250); await page.mouse.down(); await page.mouse.up(); };
  const rail = page.locator('[role="switch"][aria-label="Question rail"]');
  const state = async () => rail.getAttribute('aria-checked');
  const log = [];
  await page.waitForTimeout(700);
  if (side === 'before') {
    log.push(`rows=${await page.locator('[role="switch"]').count() - 1} rail=${await state()}`);
    await moveTo(rail); await page.waitForTimeout(700);
    await click(rail); await page.waitForTimeout(700);
    log.push(`rail after click 1=${await state()}`);
    await click(rail); await page.waitForTimeout(900);
    log.push(`rail after click 2=${await state()}`);
  } else {
    const exp = page.locator('.exp-row');
    log.push(`main switches=${await page.locator('.page[data-page="main"] [role="switch"]').count()} count="${await page.locator('.exp-row .cnt').textContent()}"`);
    await click(exp); await page.waitForTimeout(900);
    log.push(`page=${await page.locator('.page').getAttribute('data-page')} rail=${await state()}`);
    await click(rail); await page.waitForTimeout(700);
    log.push(`rail after click=${await state()}`);
    await click(page.locator('.back')); await page.waitForTimeout(1000);
    log.push(`page=${await page.locator('.page').getAttribute('data-page')} count="${await page.locator('.exp-row .cnt').textContent()}"`);
  }
  const end = (Date.now() - t0) / 1000;
  const video = page.video();
  await page.close();
  const file = await video.path();
  await fs.writeFile(path.join(out, `${side}.json`), JSON.stringify({ file, ready, end, log, errors }, null, 2));
  console.log(JSON.stringify({ file, ready, end, log, errors }));
} finally {
  await ctx.close();
  await fs.rm(profile, { recursive: true, force: true });
}
