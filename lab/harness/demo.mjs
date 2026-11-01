// Screen-record one replayed answer for the side-by-side demo video (see lab/make-demo.py).
// Same replay as bench.mjs, but inputs follow a fixed human-like script: type a sentence, scroll up
// through the answer and back, type again. Inputs are dispatched on schedule without waiting for
// the page, so a frozen page shows them late, as it would for a person.
// Usage: CHAT=<url> [REC=recordings/x.json] EXT=<dirs or empty> node demo.mjs <lang>/<stock|butter>
//   -> ../../dist/demo/<lang>/<stock|butter>.{mp4,json}
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2] ?? 'stock';
const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const REC_FILE = process.env.REC ?? 'recordings/t09.json';
const OUT = path.resolve(new URL('../../dist/demo', import.meta.url).pathname); fs.mkdirSync(OUT, { recursive: true });
const CROP = { x: 460, y: 88, w: 1020, h: 912 };   // the answer column only: no URL bar, sidebar or account
const GAP_CAP = 1500;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `[${variant}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Seconds after Enter. Typed text is a follow-up question a person drafts while the answer streams.
// Real key events (keyDown/keyUp), as from a keyboard or an IME's raw keystrokes: ChatGPT's composer
// does layout work on keydown, which Input.insertText would skip.
const SCRIPT = [
  { at: 14, type: 'what is a degenerate pivot' },
  { at: 38, scroll: [{ ticks: 24, dy: -150 }, { pause: 2500 }, { ticks: 40, dy: 150 }] },
  { at: 78, type: ' and how do you avoid cycling' },
  { at: 96, scroll: [{ ticks: 24, dy: -150 }, { pause: 2500 }, { ticks: 40, dy: 150 }] },
];
const CHAR_MS = 200, TICK_MS = 100;

const rec = JSON.parse(fs.readFileSync(REC_FILE));
const s = rec.streams.find(x => /\/f\/conversation/.test(x.url));
const reqBody = JSON.parse(s.reqBody);
const question = reqBody.messages[0].content.parts[0].replace(/^\[t\d+\]\s*/, '');
const schedule = []; let t = 300, prev = s.chunks[0][0];
for (const [ct, txt] of s.chunks) { t += Math.min(GAP_CAP, ct - prev); prev = ct; schedule.push([Math.round(t), txt]); }
const REPLAY = { inputId: reqBody.messages[0].id, convId: reqBody.conversation_id, schedule };

if (process.env.EXT !== undefined) {
  execFileSync(process.env.LAB_BIN ?? new URL('../lab', import.meta.url).pathname, ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: process.env.EXT }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
  await sleep(3000);
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? ctx.pages()[0] ?? await ctx.newPage();
await page.bringToFront();
const cdp = await ctx.newCDPSession(page);

await page.addInitScript(R => {   // same replay hook as bench.mjs
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const st = window.__replay = { done: false, started: 0 };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'POST' && /\/backend-api\/f\/conversation(\?|$)/.test(url) && !st.started) {
      const body = JSON.parse(init.body);
      const map = new Map([[R.inputId, body.messages[0].id]]);
      // Also drop the "[tNN] " test tag the recorded question carried, so the bubble shows the plain question.
      const remap = txt => txt.replace(/\[t\d+\] /g, '').replace(UUID, u => u === R.convId ? u : (map.has(u) ? map.get(u) : (map.set(u, crypto.randomUUID()), map.get(u))));
      st.started = performance.now();
      const enc = new TextEncoder();
      const stream = new ReadableStream({ async start(c) {
        const t0 = performance.now();
        for (const [at, txt] of R.schedule) {
          const wait = at - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
          c.enqueue(enc.encode(remap(txt)));
        }
        c.close(); st.done = true;
      } });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    }
    return of.apply(this, arguments);
  };
}, REPLAY);

await page.goto(CHAT); await page.locator('.ProseMirror').first().waitFor({ timeout: 60_000 }); await sleep(8000);
const geo = await page.evaluate(() => {
  const sc = document.querySelector('.thread-scroll-container'); sc.scrollTop = sc.scrollHeight;
  const r = sc.getBoundingClientRect(), c = document.querySelector('.ProseMirror').getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, cx: c.x + 20, cy: c.y + c.height / 2 };
});
await sleep(1500);

// Page-side recorder. Times are epoch ms (performance.timeOrigin + now) so they line up with the video.
await page.evaluate(() => {
  const E = () => performance.timeOrigin + performance.now();
  const L = window.__demo = { loaf: [], frames: [], chars: [] };
  let last = performance.now();
  const loop = t => { L.frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  new PerformanceObserver(l => { for (const e of l.getEntries()) L.loaf.push([performance.timeOrigin + e.startTime, e.duration, e.blockingDuration]); })
    .observe({ type: 'long-animation-frame' });
  // When each typed character is on screen: the frame after the composer's input event.
  document.addEventListener('input', e => {
    if (!e.target.closest?.('.ProseMirror')) return;
    const len = e.target.textContent.length;
    requestAnimationFrame(() => setTimeout(() => L.chars.push([E(), len])));
  }, true);
});

// Screen recording.
const mp4 = path.join(OUT, `${variant}.mp4`); fs.mkdirSync(path.dirname(mp4), { recursive: true });
const ff = spawn('ffmpeg', ['-hide_banner', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30',
  '-video_size', `${CROP.w}x${CROP.h}`, '-i', `${process.env.DISPLAY_LAB ?? ':99'}+${CROP.x},${CROP.y}`,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p', mp4], { stdio: ['pipe', 'ignore', 'pipe'] });
let ffStart = null, ffErr = '';
ff.stderr.on('data', d => { ffErr += d; const m = /start: (\d+\.\d+)/.exec(ffErr); if (m && !ffStart) ffStart = +m[1] * 1000; });
while (!ffStart) await sleep(50);
await sleep(1000);

// Put the question in the composer, show it for a moment, send.
// ChatGPT keeps unsent composer text as a per-chat draft; clear whatever the last run left there.
await page.mouse.click(geo.cx, geo.cy);
const clearComposer = async () => { await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); };
await clearComposer();
await page.keyboard.insertText(question);
await sleep(2000);
const enter = Date.now();
await page.keyboard.press('Enter');
log('sent');

// Inputs on a fixed timeline; nothing waits for the page.
const intents = [];
const pressKey = ch => {
  const code = ch === ' ' ? 'Space' : `Key${ch.toUpperCase()}`, vk = ch === ' ' ? 32 : ch.toUpperCase().charCodeAt(0);
  const base = { key: ch, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: ch, unmodifiedText: ch }).catch(() => {});
  return cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};
const fire = (at, fn, what) => setTimeout(() => { intents.push([Date.now(), what]); fn().catch(() => {}); }, enter + at - Date.now());
for (const step of SCRIPT) {
  let at = step.at * 1000;
  if (step.type) for (const ch of step.type) { fire(at, () => pressKey(ch), 'key'); at += CHAR_MS; }
  if (step.scroll) for (const part of step.scroll) {
    if (part.pause) { at += part.pause; continue; }
    for (let i = 0; i < part.ticks; i++) {
      fire(at, () => cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: geo.x, y: geo.y, deltaX: 0, deltaY: part.dy }), 'wheel');
      at += TICK_MS;
    }
  }
}
const total = REPLAY.schedule.at(-1)[0];
for (;;) {
  await sleep(500);
  const done = await page.evaluate(() => window.__replay.done).catch(() => false);
  if (done && Date.now() - enter > Math.max(total, 112_000) + 3000) break;
  if (Date.now() - enter > total + 90_000) { log('replay did not finish'); break; }
}
await sleep(4000);
const end = Date.now();
ff.stdin.write('q'); await new Promise(r => ff.on('close', r));

const D = await page.evaluate(() => window.__demo);
await page.locator('.ProseMirror').first().click(); await clearComposer();   // don't leave a draft for the next run
const answer = await page.evaluate(async () => {
  const txt = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1)?.textContent ?? '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return { chars: txt.length, sha: [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('') };
});
const rel = ms => +((ms - enter) / 1000).toFixed(3);
const out = {
  variant, question, enterVideoS: +((enter - ffStart) / 1000).toFixed(3), endS: rel(end), answer, script: SCRIPT,
  loaf: D.loaf.filter(([t0]) => t0 >= enter - 3000).map(([t0, dur, block]) => [rel(t0), Math.round(dur), Math.round(block)]),
  chars: D.chars.filter(([t0]) => t0 >= enter).map(([t0, len]) => [rel(t0), len]),
  intents: intents.map(([t0, what]) => [rel(t0), what]),
  butter: await page.evaluate(() => window.__butterStats ?? null),
};
const after = out.loaf.filter(([t0]) => t0 >= 0);
out.blockedS = +(after.reduce((a, l) => a + l[2], 0) / 1000).toFixed(1);
out.longestFreezeMs = Math.max(0, ...after.map(l => l[1]));
fs.writeFileSync(path.join(OUT, `${variant}.json`), JSON.stringify(out, null, 1));
log(`blocked=${out.blockedS}s longest=${out.longestFreezeMs}ms answer=${answer.chars}c/${answer.sha} enterAt=${out.enterVideoS}s video=${mp4}`);
await browser.close();
