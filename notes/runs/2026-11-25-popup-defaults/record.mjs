// Records the Butter popup for #171's popup-defaults PR evidence (adapted from
// 2026-11-24-experimental-page/record.mjs). Usage: [H=<px>] node record.mjs <extensionDir> <before|after>
// Fresh profile per run (a fresh install), light theme, English (the default), 360 px wide.
// The frame is the popup's real size: a Chrome popup sizes itself to its document, so H must be the
// tallest document height the steps reach. Without H the run is a probe: no video, an 800 px tall
// viewport, and it prints every height the document took (`heights`, `max`) so you can pick H.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const [ext, side] = process.argv.slice(2);
if (!ext || !['before', 'after'].includes(side)) throw new Error('usage: record.mjs <extensionDir> <before|after>');
const out = process.env.OUT || '/tmp/butter-rec-defaults';
const W = 360, probe = !process.env.H, H = probe ? 800 : Number(process.env.H);
const profile = await fs.mkdtemp(path.join(os.tmpdir(), `rec-defaults-${side}-`));
const videoDir = path.join(out, `video-${side}`);
if (!probe) await fs.rm(videoDir, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
const PX = 180, PY = Math.round(H * 0.85); // where the pointer dot starts
const ctx = await chromium.launchPersistentContext(profile, {
  headless: true, channel: 'chromium',
  viewport: { width: W, height: H }, colorScheme: 'light', reducedMotion: 'no-preference', locale: 'en-US',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  ...(probe ? {} : { recordVideo: { dir: videoDir, size: { width: W, height: H } } }),
});
const errors = [];
try {
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  // This build's worker writes an install marker; the last release has none, so wait up to 2 s and move on.
  for (let i = 0; i < 40; i++) {
    if ((await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter?.defaultsVersion))) break;
    await new Promise(r => setTimeout(r, 50));
  }
  const popupUrl = worker.url().replace(/\/[^/]+\/[^/]+$/, '/popup/popup.html');
  const page = ctx.pages()[0] || await ctx.newPage();
  for (const p of ctx.pages()) if (p !== page) await p.close();
  page.on('pageerror', e => errors.push(e.message));
  // A visible pointer: a dot that follows real mouse events.
  await page.addInitScript(([px, py]) => {
    // Every height the document takes, sampled on each resize (the popup's size follows it).
    window.__heights = [];
    addEventListener('DOMContentLoaded', () => {
      const note = () => {
        const h = document.documentElement.getBoundingClientRect().height;
        const b = document.body.getBoundingClientRect().height;
        const last = window.__heights[window.__heights.length - 1];
        if (!last || last.html !== h || last.body !== b) window.__heights.push({ t: Math.round(performance.now()), html: h, body: b });
      };
      new ResizeObserver(note).observe(document.body);
      new ResizeObserver(note).observe(document.documentElement);
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(220,60,40,.55);border:2px solid rgba(160,30,20,.9);pointer-events:none;z-index:2147483647;transform:translate(' + px + 'px,' + py + 'px);transition:width .12s,height .12s,margin .12s';
      document.documentElement.appendChild(d);
      addEventListener('mousemove', e => { d.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
      addEventListener('mousedown', () => { d.style.width = d.style.height = '12px'; d.style.margin = '-6px 0 0 -6px'; }, true);
      addEventListener('mouseup', () => { d.style.width = d.style.height = '18px'; d.style.margin = '-9px 0 0 -9px'; }, true);
    });
  }, [PX, PY]);
  const t0 = Date.now();
  await page.goto(popupUrl);
  await page.waitForSelector('.master');
  // The popup asks the active tab for its status; no ChatGPT tab here, so it reads as "away".
  // Before the web font loads, the fallback font lays out taller for a few ms; heights count from here.
  const fontsAt = await page.evaluate(async () => { await document.fonts.ready; return Math.round(performance.now()); });
  await page.mouse.move(PX, PY);
  await page.waitForTimeout(400);
  const ready = (Date.now() - t0) / 1000;
  let mx = PX, my = PY;
  const moveTo = async (loc) => {
    const b = await loc.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y, { steps: 12 });
    mx = x; my = y;
  };
  const click = async (loc) => { await moveTo(loc); await page.waitForTimeout(250); await page.mouse.down(); await page.mouse.up(); };
  const scrolling = page.locator('[role="switch"][aria-label="Smoother scrolling"]');
  const layouts = page.locator('[role="switch"][aria-label="Remember long-chat layouts"]');
  const on = async (loc) => loc.getAttribute('aria-checked');
  const rows = async () => (await page.locator('.row .n').allTextContents()).join(' | ');
  const layoutLine = async () => (await page.locator('.row:has([data-switch="layout"]) .d').textContent()).trim();
  const log = [];
  await page.waitForTimeout(700);
  if (side === 'before') {
    // The last release has one page: the same steps without the page swap. Smoother scrolling is
    // already on there, so it is pointed at, not clicked.
    log.push(`rows: ${await rows()}; scrolling=${await on(scrolling)} layouts=${await on(layouts)}`);
    await moveTo(scrolling); await page.waitForTimeout(1200);
    await click(layouts); await page.waitForTimeout(1200);
    log.push(`layouts after click=${await on(layouts)}; layouts line "${await layoutLine()}"`);
  } else {
    const exp = page.locator('.exp-row');
    log.push(`main rows: ${await rows()}; count="${await page.locator('.exp-row .cnt').textContent()}"`);
    await page.waitForTimeout(500);
    await click(exp); await page.waitForTimeout(900);
    log.push(`page=${await page.locator('.page').getAttribute('data-page')} rows: ${await rows()}; scrolling=${await on(scrolling)} layouts=${await on(layouts)}`);
    await click(scrolling); await page.waitForTimeout(800);
    log.push(`scrolling after click=${await on(scrolling)}`);
    await click(layouts); await page.waitForTimeout(1000);
    log.push(`layouts after click=${await on(layouts)}; layouts line "${await layoutLine()}"`);
    await click(page.locator('.back')); await page.waitForTimeout(1000);
    log.push(`page=${await page.locator('.page').getAttribute('data-page')} count="${await page.locator('.exp-row .cnt').textContent()}"`);
  }
  const end = (Date.now() - t0) / 1000;
  const heights = await page.evaluate(() => window.__heights);
  // The height in effect when the fonts were ready, and every one after.
  const live = heights.filter((h, i) => h.t >= fontsAt || !(heights[i + 1] && heights[i + 1].t <= fontsAt));
  const max = Math.max(...live.map(h => Math.max(h.html, h.body)));
  if (!probe && max > H) errors.push(`document grew to ${max} px, taller than the ${H} px frame`);
  const video = page.video();
  await page.close();
  const file = video ? await video.path() : null;
  const res = { file, H, probe, ready, end, log, fontsAt, heights, max, errors };
  await fs.writeFile(path.join(out, `${side}${probe ? '-probe' : ''}.json`), JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res));
} finally {
  await ctx.close();
  await fs.rm(profile, { recursive: true, force: true });
}
