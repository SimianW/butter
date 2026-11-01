// Deterministic rail regressions in the headed lab Chromium. No ChatGPT requests or messages.
// Real extension code + a small virtualizer fixture: late answer growth, two-turn older pages.
// Usage: [NAV_SOURCE=/path/to/turbo-nav.js] [BASELINE=1] node nav-earlier.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(process.env.NAV_SOURCE ?? new URL('../../extension/turbo-nav.js', import.meta.url), 'utf8');
const cv = fs.readFileSync(new URL('../../extension/turbo-cv.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../extension/turbo.css', import.meta.url), 'utf8');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await context.newPage(), errors = [], results = [];
p.on('pageerror', e => errors.push(e.message));
await context.route('http://butter.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><style>
body { margin:0; background:white; color:#111; font:16px sans-serif }
.thread-scroll-container { height:100vh; overflow:auto; overflow-anchor:none }
.content { padding:64px 180px 1000px }
[data-turn-key] { height:1800px; box-sizing:border-box }
[data-user-message-bubble] { padding:12px; background:#eee }
p { max-width:700px; line-height:2 }
</style><div class="thread-scroll-container"><div class="content"><div class="window"></div></div></div>` }));
async function setup(earlier, slow = false) {
  await p.goto('http://butter.test/c/00000000-0000-0000-0000-000000000001');
  await p.addStyleTag({ content: css });
  await p.evaluate(({ earlier, slow }) => {
    const sc = document.querySelector('.thread-scroll-container'), win = document.querySelector('.window');
    const st = window.fixture = { first: earlier ? 6 : 0, pages: [], growth: false };
    const items = (a, b) => Array.from({ length: b - a }, (_, k) => ({ id: `t${a + k + 1}`, q: `[t${a + k + 1}] question` }));
    const turn = i => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div><article data-turn-key="t${i + 1}"><div data-user-message-bubble>[t${i + 1}] question</div>` +
        Array.from({ length: 18 }, () => '<p>Answer text and a mathematical derivation, rendered progressively.</p>').join('') + '</article></div>';
      return wrap;
    };
    for (let i = st.first; i < 9; i++) win.append(turn(i));
    const page = before => document.dispatchEvent(new CustomEvent('turbo-nav', { detail: JSON.stringify({ type: 'page', conv: '00000000-0000-0000-0000-000000000001', before, hasPrev: st.first > 0, items: items(st.first, before ? st.first + 2 : 9) }) }));
    st.emit = () => page(false);
    let loading = false, armed = true;
    sc.addEventListener('scroll', () => {
      if (sc.scrollTop > 250) armed = true;
      if (!earlier || !armed || loading || !st.first || sc.scrollTop > 230) return;
      loading = true; armed = false;
      setTimeout(() => {
        const oldHeight = sc.scrollHeight;
        st.first = Math.max(0, st.first - 2); page(true);
        // The response hook sees the page before React commits its turns.
        setTimeout(() => {
          const root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
          st.pages.push({ first: st.first, warp: getComputedStyle(root.querySelector('.warp')).visibility,
            opacity: +getComputedStyle(root.querySelector('.warp')).opacity, content: +getComputedStyle(document.querySelector('.window')).opacity });
          win.prepend(turn(st.first), turn(st.first + 1));
          sc.scrollTop += sc.scrollHeight - oldHeight;
          loading = false;
        }, 100);
      }, slow && st.first === 2 ? 5500 : 180);
    });
    sc.scrollTop = earlier ? sc.scrollHeight : 1800 + 600;
    st.startGrowth = (delay = 900) => {
      let armed = false;
      const watch = () => {
        if (!armed && sc.scrollTop > 14000) {
          armed = true;
          // A neighbour can be quiet for eight frames, then finish its deferred typesetting.
          setTimeout(() => { document.querySelector('[data-turn-key="t8"]').style.height = '3300px'; st.growth = true; }, delay);
        }
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    };
  }, { earlier, slow });
  await p.addScriptTag({ content: source }); await p.addScriptTag({ content: cv });
  await p.evaluate(() => fixture.emit());
  await p.locator('chatgpt-turbo-nav[data-on]').waitFor({ state: 'attached' });
  await p.waitForTimeout(200);
}
const state = () => p.evaluate(() => {
  const sc = document.querySelector('.thread-scroll-container'), root = document.querySelector('chatgpt-turbo-nav').shadowRoot;
  const id = `t${fixture.first + 1}`, top = id => Math.round(sc.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - sc.getBoundingClientRect().top);
  return { first: fixture.first, firstTop: top(id), latestTop: top('t9'), growth: fixture.growth, pages: fixture.pages,
    more: !root.querySelector('.more').hidden, busy: root.querySelectorAll('.busy').length,
    warp: getComputedStyle(root.querySelector('.warp')).visibility, content: getComputedStyle(document.querySelector('.window')).opacity };
});
try {
  for (let run = 1; run <= 5; run++) {
    await setup(false); await p.evaluate(() => fixture.startGrowth());
    const start = Date.now(); await p.locator('chatgpt-turbo-nav .tick').last().click();
    await p.waitForTimeout(3200);
    const r = { kind: 'growth', run, ms: Date.now() - start, ...await state() };
    r.pass = r.growth && Math.abs(r.latestTop - 64) <= 3 && r.warp === 'hidden' && !r.busy;
    results.push(r); console.log(JSON.stringify(r));
  }
  // Growth well after the arrival window must also follow the pinned question.
  await setup(false); await p.evaluate(() => fixture.startGrowth(3500));
  await p.locator('chatgpt-turbo-nav .tick').last().click(); await p.waitForTimeout(4800);
  const delayed = { kind: 'late-growth', ...await state() };
  delayed.pass = delayed.growth && Math.abs(delayed.latestTop - 64) <= 3;
  results.push(delayed); console.log(JSON.stringify(delayed));
  // Wheel input releases that anchor; late layout must not undo the user's next scroll.
  await p.mouse.move(800, 500); await p.mouse.wheel(0, -500); await p.waitForTimeout(200);
  const before = await state();
  await p.evaluate(() => { document.querySelector('[data-turn-key="t8"]').style.height = '3800px'; });
  await p.waitForTimeout(200);
  const released = { kind: 'anchor-released', ...await state() };
  released.pass = released.latestTop >= before.latestTop + 490;
  results.push(released); console.log(JSON.stringify(released));
  for (const keyboard of [false, true]) {
    await setup(true); const start = Date.now();
    const more = p.locator('chatgpt-turbo-nav .more');
    if (keyboard) { await more.focus(); await p.keyboard.press('Enter'); } else await more.click();
    await p.waitForTimeout(5000);
    const r = { kind: keyboard ? 'earlier-keyboard' : 'earlier-click', ms: Date.now() - start, ...await state() };
    r.uncoveredPages = r.pages.filter(x => x.warp !== 'visible' || x.opacity < .99 || x.content > .01).length;
    r.pass = r.first === 0 && Math.abs(r.firstTop - 64) <= 3 && !r.more && r.pages.length === 3 && !r.uncoveredPages && r.warp === 'hidden' && r.content === '1';
    results.push(r); console.log(JSON.stringify(r));
  }
  await setup(true, true); await p.locator('chatgpt-turbo-nav .more').click();
  await p.waitForTimeout(9500);
  const slow = { kind: 'slow-final-page', ...await state() };
  slow.pass = slow.first === 0 && !slow.more && Math.abs(slow.firstTop - 64) <= 3 && slow.warp === 'hidden' && slow.pages.every(x => x.opacity === 1 && x.content === 0);
  results.push(slow); console.log(JSON.stringify(slow));
  // Reduced motion still shows static placeholders while the chat is hidden.
  await p.emulateMedia({ reducedMotion: 'reduce' }); await setup(true);
  await p.locator('chatgpt-turbo-nav .more').click(); await p.waitForTimeout(5000);
  const reduced = { kind: 'reduced-motion', ...await state() };
  reduced.pass = reduced.first === 0 && !reduced.more && Math.abs(reduced.firstTop - 64) <= 3 && reduced.warp === 'hidden' && reduced.pages.every(x => x.opacity === 1 && x.content === 0);
  results.push(reduced); console.log(JSON.stringify(reduced));
  await setup(true);
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('turbo-nav', { detail: JSON.stringify({ type: 'page', conv: '00000000-0000-0000-0000-000000000001', before: true, hasPrev: false, items: [] }) })));
  await p.waitForTimeout(100);
  const empty = { kind: 'empty-final-page', ...await state() }; empty.pass = !empty.more;
  results.push(empty); console.log(JSON.stringify(empty));
  await setup(true); await p.locator('chatgpt-turbo-nav .more').click(); await p.waitForTimeout(100);
  await p.locator('chatgpt-turbo-nav .tick').last().click(); await p.waitForTimeout(4000);
  const takeover = { kind: 'earlier-takeover', ...await state() };
  takeover.pass = Math.abs(takeover.latestTop - 64) <= 3 && takeover.warp === 'hidden' && !takeover.busy && takeover.content === '1';
  results.push(takeover); console.log(JSON.stringify(takeover));
  await setup(true); await p.locator('chatgpt-turbo-nav .more').click(); await p.waitForTimeout(400);
  await p.mouse.move(800, 500); await p.mouse.wheel(0, 400); await p.waitForTimeout(1500);
  const cancelled = { kind: 'earlier-cancelled', ...await state() };
  cancelled.pass = cancelled.pages.length <= 1 && cancelled.more && cancelled.warp === 'hidden' && !cancelled.busy && cancelled.content === '1';
  results.push(cancelled); console.log(JSON.stringify(cancelled));
  console.log('errors', JSON.stringify(errors));
  const dir = new URL('./scratch/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL(`nav-earlier-${process.env.BASELINE ? 'before' : 'after'}.json`, dir), JSON.stringify({ results, errors }, null, 2));
  if (!process.env.BASELINE) { assert.equal(errors.length, 0); assert.ok(results.every(r => r.pass), 'rail regressions'); }
} finally { await context.close(); await browser.close(); }
