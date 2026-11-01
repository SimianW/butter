// History rail check: list, hover wave, jumps to mounted and unmounted turns (each must land 64px below
// the scroller's top). Restarts the lab browser with ../../extension. Screenshots go to scratch/.
// Usage: CHAT=<url of a long chat> node nav-jumps.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const CHAT = process.env.CHAT, OUT = 'scratch/nav'; fs.mkdirSync('scratch', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
execFileSync('../lab', ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: process.env.EXT ?? new URL('../../extension', import.meta.url).pathname }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
await sleep(3000);
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x => x.url().startsWith('https://chatgpt.com')) ?? b.contexts()[0].pages()[0];
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(CHAT); await p.locator('.ProseMirror').first().waitFor(); await sleep(8000);
const state = () => p.evaluate(() => {
  const h = document.querySelector('chatgpt-turbo-nav'); if (!h) return null;
  const r = h.shadowRoot, rail = r.querySelector('.rail').getBoundingClientRect();
  return { on: h.hasAttribute('data-on'), n: r.querySelectorAll('.tick').length, more: !r.querySelector('.more').hidden,
    labels: [...r.querySelectorAll('.tick')].map(t => t.getAttribute('aria-label').slice(0, 14)),
    rail: [rail.x, rail.y, rail.width, rail.height].map(Math.round),
    mounted: [...document.querySelectorAll('[data-turn-key]')].map(t => t.getAttribute('data-turn-key').slice(0, 6)) };
});
let s = await state(); console.log('initial', JSON.stringify(s));
await p.screenshot({ path: `${OUT}-0-rest.png` });
// hover wave
const [x, y, w, h] = s.rail; const cx = x + w / 2;
await p.mouse.move(cx, y + h * 0.35, { steps: 5 }); await sleep(500);
await p.screenshot({ path: `${OUT}-1-hover.png`, clip: { x: x - 380, y: y - 60, width: 380 + w + 20, height: h + 120 } });
await p.mouse.move(cx, y + h * 0.75, { steps: 8 }); await sleep(150);
await p.screenshot({ path: `${OUT}-2-wave-moving.png`, clip: { x: x - 380, y: y - 60, width: 380 + w + 20, height: h + 120 } });
// jump to each tick, oldest first; measure time and where the target lands
const where = id => p.evaluate(id => {
  const t = document.querySelector(`[data-turn-key="${id}"]`), sc = document.querySelector('.thread-scroll-container');
  return t ? Math.round(t.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null;
}, id);
const ids = await p.evaluate(() => [...document.querySelector('chatgpt-turbo-nav').shadowRoot.querySelectorAll('.tick')].length);
for (const i of [0, ids - 1, 1, Math.floor(ids / 2), ids - 2]) {
  const s1 = await state(); const [x1, y1, w1, h1] = s1.rail;
  const pitch = (h1 - 20 - (s1.more ? 16 : 0)) / s1.n, ty = y1 + 10 + (s1.more ? 16 : 0) + (i + 0.5) * pitch;
  await p.mouse.move(x1 + w1 / 2, ty);
  await sleep(200);
  const label = await p.evaluate(() => document.querySelector('chatgpt-turbo-nav').shadowRoot.querySelector('.card .text').textContent.slice(0, 20));
  const t0 = Date.now(); await p.mouse.click(x1 + w1 / 2, ty);
  // find target id by label match in DOM over time
  let top = null, key = null;
  for (let k = 0; k < 60; k++) {
    await sleep(100);
    const r = await p.evaluate(lbl => {
      for (const t of document.querySelectorAll('[data-turn-key]')) {
        const q = t.querySelector('[data-user-message-bubble]')?.textContent.trim() ?? '';
        if (q.startsWith(lbl.replace('…', ''))) { const sc = document.querySelector('.thread-scroll-container'); return [t.getAttribute('data-turn-key'), Math.round(t.getBoundingClientRect().top - sc.getBoundingClientRect().top)]; }
      }
      return null;
    }, label);
    if (r && Math.abs(r[1] - 64) <= 3) { key = r[0]; top = r[1]; break; }
    if (r) { key = r[0]; top = r[1]; }
  }
  console.log(`jump tick ${i} "${label}" -> top=${top} after ${Date.now() - t0}ms key=${key?.slice(0, 6)}`);
  await p.mouse.move(5, 500); await sleep(800);
  if (i === 0) await p.screenshot({ path: `${OUT}-3-after-jump.png` });
}
console.log('final', JSON.stringify(await state()));
console.log('errors', errs.filter(e => /turbo|nav/i.test(e)));
await b.close();
