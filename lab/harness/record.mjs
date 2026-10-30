// Record one real streamed answer (SSE chunks + timing) for deterministic replay.
// Usage: node record.mjs <chatUrl> <tag> <prompt> <out.json>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [chatUrl, tag, prompt, out] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? await ctx.newPage();
await page.bringToFront();

await page.addInitScript(() => {
  const rec = window.__rec = { reqs: [], streams: [], ws: [] };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const t0 = performance.now();
    const res = await of.apply(this, arguments);
    const ct = res.headers.get('content-type') || '';
    if (/backend-api|backend-anon|ces\/|sentinel/.test(url)) rec.reqs.push({ t: Math.round(t0), method, url: url.slice(0, 160), status: res.status, ct });
    if (ct.includes('event-stream') && res.body) {
      const [a, b] = res.body.tee();
      const s = { url, method, reqBody: typeof init?.body === 'string' ? init.body : null, t0, chunks: [] };
      rec.streams.push(s);
      (async () => {
        const reader = b.getReader(); const dec = new TextDecoder();
        for (;;) { const { done, value } = await reader.read(); if (done) break; s.chunks.push([+(performance.now() - t0).toFixed(1), dec.decode(value, { stream: true })]); }
        s.done = true;
      })();
      return new Response(a, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    return res;
  };
  const OW = window.WebSocket;
  window.WebSocket = function (url, p) { const ws = new OW(url, p); const e = { url: String(url).slice(0, 160), msgs: 0 }; rec.ws.push(e); ws.addEventListener('message', () => e.msgs++); return ws; };
  window.WebSocket.prototype = OW.prototype; Object.assign(window.WebSocket, OW);
});

await page.goto(chatUrl); await page.locator('.ProseMirror').first().waitFor(); await page.waitForTimeout(4000);
await page.locator('.ProseMirror').first().click();
await page.keyboard.insertText(`${tag} ${prompt}`);
await page.keyboard.press('Enter');
const t0 = Date.now();
while (Date.now() - t0 < 8 * 60_000) {
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ n: window.__rec.streams.length, done: window.__rec.streams.every(s => s.done), stop: !!document.querySelector('button[aria-label*="Stop" i]') }));
  if (st.n > 0 && st.done && !st.stop) break;
}
await page.waitForTimeout(3000);
const rec = await page.evaluate(() => window.__rec);
fs.writeFileSync(out, JSON.stringify(rec));
console.log('reqs:'); for (const r of rec.reqs) console.log(' ', r.method, r.status, r.ct.slice(0, 30), r.url);
console.log('ws:', rec.ws);
for (const s of rec.streams) console.log('stream', s.method, s.url, 'chunks', s.chunks.length, 'bytes', s.chunks.reduce((n, c) => n + c[1].length, 0), 'dur', s.chunks.at(-1)?.[0]);
await browser.close();
