// Functional/visual QA on the long chat with whatever extensions the lab browser has loaded.
// Usage: EXT=<dirs or empty> node qa.mjs <variant>
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2] ?? 'baseline';
const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const OUT = path.resolve('results/qa', variant); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (process.env.EXT !== undefined) {
  execFileSync(process.env.LAB_BIN ?? new URL('../lab', import.meta.url).pathname, ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: process.env.EXT }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
  await sleep(3000);
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? ctx.pages()[0];
await page.bringToFront();
await page.goto(CHAT); await page.locator('.ProseMirror').first().waitFor(); await sleep(8000);
const res = { variant };

// 1) Screenshots at the same anchors: each h2/h3 heading of the last answer scrolled to the top.
const anchors = await page.evaluate(() => [...[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1).querySelectorAll('h1,h2,h3')].map(h => h.textContent.trim().slice(0, 40)));
res.anchors = anchors.length;
for (const [i, idx] of [0, Math.floor(anchors.length / 3), Math.floor(2 * anchors.length / 3), anchors.length - 1].entries()) {
  await page.evaluate(n => { const h = [...[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1).querySelectorAll('h1,h2,h3')][n]; h.scrollIntoView({ block: 'start' }); }, idx);
  await sleep(1500);
  await page.evaluate(n => { const h = [...[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1).querySelectorAll('h1,h2,h3')][n]; h.scrollIntoView({ block: 'start' }); }, idx);
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, `anchor-${i}.png`) });
}

// 1b) Geometry of wide blocks (they size with container units against the thread container).
res.wide = await page.evaluate(() => [...document.querySelectorAll('[data-wide-block], [class*="InlineCodePane-"]')].map(e => {
  const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.height)]; }));

// 2) Find-in-page (window.find) for text near the start of the last answer, from the bottom.
await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); s.scrollTop = s.scrollHeight; getSelection().removeAllRanges(); });
await sleep(1500);
const needle = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1); return [...r.querySelectorAll('p')].map(p => p.textContent.trim()).find(t => t.length > 25)?.slice(4, 22); });
res.find = await page.evaluate(n => { const ok = window.find(n, false, true, true); const sel = getSelection(); const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  return { needle: n, found: ok, inViewport: !!rect && rect.top >= 0 && rect.bottom <= innerHeight }; }, needle);
await sleep(800);
await page.screenshot({ path: path.join(OUT, 'find.png') });

// 3) Select the whole last answer; the selection text must cover the DOM text.
res.selection = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1);
  const range = document.createRange(); range.selectNodeContents(r); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
  const out = { selectionChars: s.toString().length, textContentChars: r.textContent.length, innerTextChars: r.innerText.length }; s.removeAllRanges(); return out; });

// 4) Scroll jumps: after a fresh load, wheel up through the answer and check that the element at the
//    viewport centre moves by the wheel delta (placeholders resolving would shift it).
await page.reload(); await page.locator('.ProseMirror').first().waitFor(); await sleep(8000);
const box = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); s.scrollTop = s.scrollHeight; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await sleep(1500); await page.mouse.move(box.x, box.y);
const jumps = [];
for (let i = 0; i < 40; i++) {
  const before = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); window.__probe = e; const s = document.querySelector('.thread-scroll-container'); return { top: e?.getBoundingClientRect().top ?? null, st: s.scrollTop }; }, box);
  await page.mouse.wheel(0, -300); await sleep(450);
  const after = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); return { top: window.__probe?.isConnected ? window.__probe.getBoundingClientRect().top : null, st: s.scrollTop }; });
  if (before.top != null && after.top != null) jumps.push(Math.round(after.top - before.top - (before.st - after.st)));
  if (after.st <= 0) break;
}
res.scrollJumps = { steps: jumps.length, over20px: jumps.filter(j => Math.abs(j) > 20).length, worst: Math.max(0, ...jumps.map(Math.abs)), all: jumps };
fs.writeFileSync(path.join(OUT, 'qa.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...res, scrollJumps: { ...res.scrollJumps, all: undefined } }));
await browser.close();
