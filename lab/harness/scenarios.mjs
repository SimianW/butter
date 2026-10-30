// Non-streaming scenarios on the long chat: reload, full scroll, idle typing.
// Usage: EXT=<dirs or empty> node scenarios.mjs <variant> [reps=2]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2] ?? 'baseline';
const reps = +(process.argv[3] ?? 2);
const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const OUT = path.resolve('results/scenarios', variant); fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `[${variant}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null; };

if (process.env.EXT !== undefined) {
  execFileSync(process.env.LAB_BIN ?? new URL('../lab', import.meta.url).pathname, ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: process.env.EXT }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
  await sleep(3000);
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? ctx.pages()[0];
await page.bringToFront();

const REC = () => {
  window.__s = { frames: [], loaf: [], keys: [], run: true };
  let last = performance.now();
  const loop = t => { if (!__s.run) return; __s.frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  __s.po = new PerformanceObserver(l => { for (const e of l.getEntries()) __s.loaf.push(e.duration); }); __s.po.observe({ type: 'long-animation-frame' });
  __s.onKey = e => { const t0 = e.timeStamp; requestAnimationFrame(() => setTimeout(() => __s.keys.push(performance.now() - t0))); };
  addEventListener('keydown', __s.onKey, true);
};
const STOP = () => { __s.run = false; __s.po.disconnect(); removeEventListener('keydown', __s.onKey, true); return { frames: __s.frames.slice(1), loaf: __s.loaf, keys: __s.keys }; };
const summ = (r, wall) => ({ fps: +(r.frames.length / (wall / 1000)).toFixed(1), p95: q(r.frames, 0.95), maxFrame: Math.round(Math.max(0, ...r.frames)),
  blockedMs: Math.round(r.loaf.reduce((a, d) => a + Math.max(0, d - 50), 0)), keyP50: q(r.keys, 0.5), keyP95: q(r.keys, 0.95), keyMax: r.keys.length ? Math.round(Math.max(...r.keys)) : null });

async function once(rep) {
  // 1) Reload: navigation start -> last answer's math visible and main thread quiet.
  const t0 = Date.now();
  await page.goto(CHAT, { waitUntil: 'domcontentloaded' });
  let tReady = null;
  while (Date.now() - t0 < 60_000) {
    const ok = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1); return !!r && r.querySelectorAll('.katex').length > 20 && !!document.querySelector('.ProseMirror'); }).catch(() => false);
    if (ok) { tReady = Date.now() - t0; break; }
    await sleep(100);
  }
  await sleep(4000);
  const load = await page.evaluate(() => { const l = performance.getEntriesByType('long-animation-frame'); const n = performance.getEntriesByType('navigation')[0];
    return { dcl: Math.round(n.domContentLoadedEventEnd), blockedMs: Math.round(l.reduce((a, e) => a + e.blockingDuration, 0)), maxFrame: Math.round(Math.max(0, ...l.map(e => e.duration))), nodes: document.getElementsByTagName('*').length }; });
  const reload = { readyMs: tReady, ...load };

  // 2) Scroll the whole thread to the top and back with the wheel.
  const box = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); s.scrollTop = s.scrollHeight; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await sleep(1500); await page.mouse.move(box.x, box.y);
  await page.evaluate(REC); let w0 = Date.now();
  for (const dir of [-1, 1]) for (let i = 0; i < 400; i++) {
    await page.mouse.wheel(0, dir * 400); await sleep(16);
    const [top, max] = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); return [s.scrollTop, s.scrollHeight - s.clientHeight]; });
    if ((dir < 0 && top <= 0) || (dir > 0 && top >= max - 2)) break;
  }
  const scroll = { wallMs: Date.now() - w0, ...summ(await page.evaluate(STOP), Date.now() - w0) };

  // 3) Idle typing in the composer.
  await page.locator('.ProseMirror').first().click(); await sleep(500);
  await page.evaluate(REC); w0 = Date.now();
  await page.keyboard.type('the quick brown fox jumps over the lazy dog 0123456789', { delay: 80 });
  const typing = summ(await page.evaluate(STOP), Date.now() - w0);
  await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');

  const res = { variant, rep, reload, scroll, typing };
  fs.writeFileSync(path.join(OUT, `rep-${rep}.json`), JSON.stringify(res, null, 1));
  log(`rep ${rep}: reload ready=${reload.readyMs}ms blocked=${reload.blockedMs}ms maxFrame=${reload.maxFrame} | scroll fps=${scroll.fps} p95=${scroll.p95?.toFixed(1)} max=${scroll.maxFrame} blocked=${scroll.blockedMs}ms (${scroll.wallMs}ms) | typing keyP95=${typing.keyP95?.toFixed(0)} keyMax=${typing.keyMax}`);
}
for (let i = 1; i <= reps; i++) await once(i);
await browser.close();
