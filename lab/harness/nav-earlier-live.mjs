// Live-chat counterpart to nav-earlier.mjs. Reads/scrolls only; sends no messages.
// Usage: CHAT=<long chat> [BASELINE=1] node nav-earlier-live.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = browser.contexts()[0].pages().find(p => p.url().startsWith('https://chatgpt.com'));
const pages = [], errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('response', r => { const u = new URL(r.url()); if (/\/messages$/.test(u.pathname) && u.searchParams.has('before')) pages.push({ at: Date.now(), status: r.status(), turns: u.searchParams.get('num_turns') }); });
try {
  await p.goto(process.env.CHAT); await p.locator('.ProseMirror').first().waitFor();
  await p.locator('chatgpt-turbo-nav[data-on]').waitFor({ state: 'attached' }); await sleep(3000);
  await p.evaluate(() => { const sc = document.querySelector('.thread-scroll-container'); sc.scrollTop = sc.scrollHeight; });
  await sleep(1500);
  const initial = await p.evaluate(() => {
    const root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
    return { ticks: root.querySelectorAll('.tick').length, more: !root.querySelector('.more').hidden };
  });
  assert.ok(initial.more, 'start with unloaded history');
  await p.evaluate(() => {
    const sc = document.querySelector('.thread-scroll-container'), root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
    const st = window.__earlierCheck = { samples: [], insertions: [], started: performance.now(), done: false };
    const sample = () => {
      const warp = root.querySelector('.warp'), turn = sc.querySelector('[data-turn-key]');
      const content = turn?.parentElement?.parentElement?.parentElement;
      return { at: Math.round(performance.now() - st.started), warp: getComputedStyle(warp).visibility,
        opacity: +getComputedStyle(warp).opacity, content: content ? +getComputedStyle(content).opacity : null,
        top: Math.round(sc.scrollTop), height: sc.scrollHeight, turns: sc.querySelectorAll('[data-turn-key]').length };
    };
    const f = () => { if (!st.done) { st.samples.push(sample()); requestAnimationFrame(f); } }; requestAnimationFrame(f);
    const mo = new MutationObserver(rs => {
      if (rs.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches('[data-turn-key]') || n.querySelector('[data-turn-key]'))))) st.insertions.push(sample());
      if (st.done) mo.disconnect();
    });
    mo.observe(sc, { childList: true, subtree: true });
  });
  const start = Date.now(); await p.locator('chatgpt-turbo-nav .more').click(); await p.mouse.move(5, 500);
  const max = process.env.BASELINE ? 8000 : 65000;
  await sleep(500);
  while (Date.now() - start < max) {
    const done = await p.evaluate(() => {
      const root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
      return root.querySelector('.more').hidden && !root.querySelector('.busy') && getComputedStyle(root.querySelector('.warp')).visibility === 'hidden';
    });
    if (done) break;
    await sleep(250);
  }
  await sleep(2000);
  const result = await p.evaluate(() => {
    __earlierCheck.done = true;
    const root = document.querySelector('chatgpt-turbo-nav').shadowRoot, sc = document.querySelector('.thread-scroll-container');
    const first = root.querySelector('.tick').getAttribute('aria-label');
    const turn = [...sc.querySelectorAll('[data-turn-key]')].find(t => t.querySelector('[data-user-message-bubble]')?.textContent.trim().startsWith(first));
    return { first: first.slice(0, 6), top: turn ? Math.round(turn.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null,
      ticks: root.querySelectorAll('.tick').length, more: !root.querySelector('.more').hidden,
      warp: getComputedStyle(root.querySelector('.warp')).visibility, busy: root.querySelectorAll('.busy').length, ...__earlierCheck };
  });
  result.ms = Date.now() - start;
  result.pages = pages.map(x => ({ ...x, at: x.at - start })); result.errors = errors;
  result.uncoveredInsertions = result.insertions.filter(x => x.at > 300 && (x.warp !== 'visible' || x.opacity < .99 || x.content > .01)).length;
  const dir = new URL('./scratch/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL(`nav-earlier-live-${process.env.BASELINE ? 'before' : 'after'}.json`, dir), JSON.stringify(result, null, 2));
  const { samples, insertions, started, done, ...summary } = result;
  console.log(JSON.stringify({ initial, ...summary, sampledFrames: samples.length, insertions: insertions.length }));
  if (!process.env.BASELINE) { assert.equal(result.more, false); assert.ok(result.top !== null && Math.abs(result.top - 64) <= 3); assert.equal(result.uncoveredInsertions, 0); assert.ok(pages.every(x => x.turns === '2')); }
} finally { await browser.close(); }
