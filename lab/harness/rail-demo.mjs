// Screen-record the history rail for the README GIF: hover wave, preview card, jumps, loading earlier
// questions. CDP mouse events don't move the X cursor, so a drawn cursor follows them instead.
// Usage: CHAT=<url> node rail-demo.mjs  -> ../../dist/demo/rail.mp4 (the lab browser must have the extension loaded)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const OUT = path.resolve(new URL('../../dist/demo', import.meta.url).pathname); fs.mkdirSync(OUT, { recursive: true });
const CROP = { x: 580, y: 88, w: 1020, h: 912 };   // chat column and rail: no URL bar, sidebar or account
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('https://chatgpt.com'));
await page.bringToFront();
await page.goto(CHAT); await page.locator('.ProseMirror').first().waitFor(); await sleep(9000);
await page.evaluate(() => {
  const c = document.createElement('div');
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.3 3.9 7.4-3 1.5-3.9-7.5L4 19.5z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px)';
  document.documentElement.append(c);
  addEventListener('pointermove', e => { c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`; }, true);
});
const geo = () => page.evaluate(() => {
  const r = document.querySelector('chatgpt-turbo-nav').shadowRoot, b = r.querySelector('.rail').getBoundingClientRect();
  const n = r.querySelectorAll('.tick').length, more = !r.querySelector('.more').hidden;
  return { x: b.x + b.width / 2, y0: b.y + 10 + (more ? 16 : 0), pitch: (b.height - 20 - (more ? 16 : 0)) / n, n, dotsY: b.y + 18 };
});
const tickY = (g, i) => g.y0 + (i + 0.5) * g.pitch;

const mp4 = path.join(OUT, 'rail.mp4');
const ff = spawn('ffmpeg', ['-hide_banner', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30',
  '-video_size', `${CROP.w}x${CROP.h}`, '-i', `${process.env.DISPLAY_LAB ?? ':99'}+${CROP.x},${CROP.y}`,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p', mp4], { stdio: ['pipe', 'ignore', 'ignore'] });
await sleep(800);

let g = await geo();
await page.mouse.move(1150, 520); await sleep(900);
await page.mouse.move(g.x - 10, tickY(g, 0) - 30, { steps: 25 }); await sleep(200);
await page.mouse.move(g.x, tickY(g, g.n - 1) + 6, { steps: 40 }); await sleep(300);    // wave down
await page.mouse.move(g.x, tickY(g, 1), { steps: 30 }); await sleep(1600);             // wave up, read the card
await page.mouse.click(g.x, tickY(g, 1)); await sleep(3200);                            // jump up
g = await geo();
await page.mouse.move(g.x, tickY(g, g.n - 2), { steps: 25 }); await sleep(1400);
await page.mouse.click(g.x, tickY(g, g.n - 2)); await sleep(3000);                      // jump down
g = await geo();
await page.mouse.move(g.x, g.dotsY, { steps: 25 }); await sleep(1600);                 // "earlier questions" dots
await page.mouse.click(g.x, g.dotsY); await sleep(4500);                                // ChatGPT loads more; rail grows
g = await geo();
await page.mouse.move(g.x, tickY(g, 0), { steps: 20 }); await sleep(1500);
await page.mouse.move(1150, 520, { steps: 20 }); await sleep(800);
ff.stdin.write('q'); await new Promise(r => ff.on('close', r));
console.log(mp4);
await browser.close();
