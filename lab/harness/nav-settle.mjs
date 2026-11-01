// Five real-chat far jumps after nav-earlier-live.mjs has loaded the history. Read-only.
// Usage: node nav-settle.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = browser.contexts()[0].pages().find(p => p.url().startsWith('https://chatgpt.com'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const where = label => p.evaluate(label => {
  const sc = document.querySelector('.thread-scroll-container');
  const t = [...sc.querySelectorAll('[data-turn-key]')].find(t => t.querySelector('[data-user-message-bubble]')?.textContent.trim().startsWith(label));
  const root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
  return { top: t ? Math.round(t.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null,
    busy: root.querySelectorAll('.busy').length, warp: getComputedStyle(root.querySelector('.warp')).visibility };
}, label);
try {
  const results = [];
  for (let run = 1; run <= 5; run++) {
    await p.getByRole('button', { name: /^\[t02\]/ }).click();
    for (let n = 0; n < 70; n++) { await sleep(200); const s = await where('[t02]'); if (s.top === 64 && !s.busy && s.warp === 'hidden') break; }
    // Start in the middle of the early answer as in the user's video.
    await p.mouse.move(900, 400); await p.mouse.wheel(0, 700); await sleep(250);
    const start = Date.now(); await p.getByRole('button', { name: /^\[t09\]/ }).click(); await p.mouse.move(5, 500);
    let arrived = null;
    for (let n = 0; n < 80; n++) { await sleep(200); const s = await where('[t09]'); if (s.top !== null && Math.abs(s.top - 64) <= 3 && !s.busy && s.warp === 'hidden') { arrived = Date.now() - start; break; } }
    await sleep(2000);
    const r = { run, arrivedMs: arrived, ...await where('[t09]') }; results.push(r); console.log(JSON.stringify(r));
  }
  fs.writeFileSync(new URL('./scratch/nav-settle.json', import.meta.url), JSON.stringify(results, null, 2));
  assert.ok(results.every(r => r.arrivedMs && Math.abs(r.top - 64) <= 3 && r.warp === 'hidden' && !r.busy));
} finally { await browser.close(); }
