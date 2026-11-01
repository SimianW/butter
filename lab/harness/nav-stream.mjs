// History rail while an answer streams (replayed as in bench.mjs, nothing is sent): the new question
// appears on the rail, a jump up stays put while text keeps arriving; then light/dark theme switch.
// Usage: CHAT=<url> [RESTART=1 to reload the lab browser with ../../extension] node nav-stream.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rec = JSON.parse(fs.readFileSync('recordings/t09.json'));
const s = rec.streams.find(x => /\/f\/conversation/.test(x.url)), reqBody = JSON.parse(s.reqBody);
const question = reqBody.messages[0].content.parts[0].replace(/^\[t\d+\]\s*/, '');
const schedule = []; let t = 300, prev = s.chunks[0][0];
for (const [ct, txt] of s.chunks) { t += Math.min(1500, ct - prev); prev = ct; schedule.push([Math.round(t), txt]); }
const R = { inputId: reqBody.messages[0].id, convId: reqBody.conversation_id, schedule };
if (process.env.RESTART) {
  execFileSync('../lab', ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: new URL('../../extension', import.meta.url).pathname }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
  await sleep(3000);
}
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x => x.url().startsWith('https://chatgpt.com')) ?? b.contexts()[0].pages()[0];
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(R => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const st = window.__replay = { done: false, started: 0 }; const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'POST' && /\/backend-api\/f\/conversation(\?|$)/.test(url) && !st.started) {
      const body = JSON.parse(init.body); const map = new Map([[R.inputId, body.messages[0].id]]);
      const remap = txt => txt.replace(/\[t\d+\] /g, '').replace(UUID, u => u === R.convId ? u : (map.has(u) ? map.get(u) : (map.set(u, crypto.randomUUID()), map.get(u))));
      st.started = performance.now(); const enc = new TextEncoder();
      return new Response(new ReadableStream({ async start(c) { const t0 = performance.now();
        for (const [at, txt] of R.schedule) { const w = at - (performance.now() - t0); if (w > 0) await new Promise(r => setTimeout(r, w)); c.enqueue(enc.encode(remap(txt))); }
        c.close(); st.done = true; } }), { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    }
    return of.apply(this, arguments);
  };
}, R);
await p.goto(process.env.CHAT); await p.locator('.ProseMirror').first().waitFor(); await sleep(8000);
const rail = () => p.evaluate(() => { const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
  const b = r.querySelector('.rail').getBoundingClientRect(); return { n: r.querySelectorAll('.tick').length, more: !r.querySelector('.more').hidden, rect: [b.x, b.y, b.width, b.height], last: r.querySelector('.tick:last-child').getAttribute('aria-label').slice(0, 20) }; });
console.log('before send', JSON.stringify(await rail()));
await p.locator('.ProseMirror').first().click(); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace');
await p.keyboard.insertText(question); await p.keyboard.press('Enter');
await sleep(12000);
const r1 = await rail(); console.log('streaming', JSON.stringify(r1));
// click the question two back
const [x, y, w, h] = r1.rect, pitch = (h - 20 - (r1.more ? 16 : 0)) / r1.n, i = r1.n - 3;
const ty = y + 10 + (r1.more ? 16 : 0) + (i + 0.5) * pitch;
await p.mouse.move(x + w / 2, ty); await sleep(300);
const label = await p.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.card .text').textContent.slice(0, 15));
await p.mouse.click(x + w / 2, ty); await p.mouse.move(700, 500);
const top = () => p.evaluate(lbl => { const sc = document.querySelector('.thread-scroll-container');
  for (const t of document.querySelectorAll('[data-turn-key]')) if ((t.querySelector('[data-user-message-bubble]')?.textContent.trim() ?? '').startsWith(lbl)) return Math.round(t.getBoundingClientRect().top - sc.getBoundingClientRect().top);
  return 'not mounted'; }, label);
let waited = 0;
for (const ms of [1500, 4000, 10000, 20000]) { await sleep(ms - waited); waited = ms; console.log(`+${ms}ms "${label}" top=${await top()} streaming=${!(await p.evaluate(() => window.__replay.done))}`); }
await p.screenshot({ path: 'scratch/nav-stream.png' });
// dark mode
await p.emulateMedia({ colorScheme: 'dark' }); await sleep(1000);
await p.mouse.move(x + w / 2, ty - pitch * 2, { steps: 4 }); await sleep(500);
await p.screenshot({ path: 'scratch/nav-dark.png', clip: { x: x - 400, y: y - 80, width: 400 + w + 30, height: h + 160 } });
console.log('dark attr', await p.evaluate(() => document.querySelector('chatgpt-butter-nav').hasAttribute('data-dark')), await p.evaluate(() => getComputedStyle(document.documentElement).colorScheme + ' ' + document.documentElement.className));
await p.emulateMedia({ colorScheme: null }); await p.mouse.move(700, 500);
// wait for stream end, then clear the composer draft
while (!(await p.evaluate(() => window.__replay.done))) await sleep(2000);
console.log('done', JSON.stringify(await rail()), 'errors', errs);
await b.close();
