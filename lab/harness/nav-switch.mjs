// History rail across chat switches: open chats from the sidebar in a fixed order with revisits
// (ChatGPT keeps chats opened earlier as hidden copies) and check that the rail shows and lists the
// visible chat's questions, nothing from the previous one.
// Usage: TITLES='["sidebar title 1","title 2",...]' [ORDER='[0,1,0,...]'] node nav-switch.mjs
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x => x.url().startsWith('https://chatgpt.com'));
await p.goto('https://chatgpt.com/'); await p.locator('.ProseMirror').first().waitFor(); await sleep(2000);
const titles = JSON.parse(process.env.TITLES ?? (() => { throw new Error('set TITLES to a JSON list of 3-4 sidebar chat titles'); })());
const order = process.env.ORDER ? JSON.parse(process.env.ORDER) : [0, 1, 0, 2, 1, 3, 0, 3, 2, 0, 1, 2, 3, 1, 0, 2].map(k => k % titles.length);
let bad = 0;
for (const k of order) {
  await p.locator('nav a', { hasText: titles[k] }).first().click(); await sleep(2500 + Math.random() * 1500);
  const check = () => p.evaluate(() => {
    const sc = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.getBoundingClientRect().width > 0);
    const visible = [...sc.querySelectorAll('[data-user-message-bubble]')].map(b => b.textContent.trim().slice(0, 30));
    const h = document.querySelector('chatgpt-butter-nav'), labels = [...h.shadowRoot.querySelectorAll('.tick')].map(t => t.getAttribute('aria-label').slice(0, 30));
    return { on: h.hasAttribute('data-on'), ticks: labels.length, visible: visible.length, missing: visible.filter(v => !labels.includes(v)).length, extra: labels.filter(l => !visible.includes(l)).length,
      lastFrameAgo: Math.round(performance.now() - (window.__lf ?? 0)) };
  });
  await p.evaluate(() => { const f = t => { window.__lf = t; requestAnimationFrame(f); }; if (!window.__lfOn) { window.__lfOn = 1; requestAnimationFrame(f); } });
  let r = await check();
  const okf = r => (r.on || r.visible + r.extra < 2) && r.missing === 0 && (r.extra === 0 || r.ticks > r.visible && r.visible >= 5);
  if (!okf(r)) { console.log('   first check', JSON.stringify(r)); await sleep(3000); r = await check(); }
  const ok = okf(r);
  if (!ok) bad++;
  console.log(`chat ${k}`, JSON.stringify(r), ok ? 'ok' : 'BAD');
}
console.log('bad', bad);
await b.close();
