// #172 follow-up to veil-unmarked-synthetic.mjs: a skipped height-0 <hr> (ChatGPT's) in an
// in_progress answer is scrolled into view, then away again, with Butter's real containment.css and
// offscreen.js from <extension dir> in headless Chromium. Prints one REPORT line of JSON: the hr's
// content-visibility state events, its veil and opacity before, for 4 frames after the scroll in,
// and after the scroll away. REPORT-style output only; no verdict.
// node lab/harness/veil-unmarked-scroll.mjs <extension dir>
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const dir = process.argv[2] || 'extension';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1000, height: 800 } });
await page.route('**/*', r => r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>x</title>' }) : r.abort());
await page.goto('https://butter.invalid/c/0');
await page.addStyleTag({ content: readFileSync(dir + '/stream/containment.css', 'utf8') + '*{box-sizing:border-box;border:0 solid} hr{height:0;border-top-width:1px;margin:28px 0} p{margin:0 0 16px;line-height:24px} .s{height:700px;overflow:auto;width:768px}' });
await page.addScriptTag({ content: readFileSync(dir + '/stream/offscreen.js', 'utf8') });
const r = await page.evaluate(async () => {
  document.body.innerHTML = '<div class="s thread-scroll-container"><article data-turn-key="q"><div data-talvt-turn-state="in_progress"><div data-markdown-text-style="assistant-message"><p>a</p></div></div></article></div>';
  const md = document.querySelector('[data-markdown-text-style]'), f = () => new Promise(r => requestAnimationFrame(r)), ev = [];
  document.addEventListener('contentvisibilityautostatechange', e => { if (e.target.tagName === 'HR') ev.push(`${e.skipped ? 'skipped' : 'not-skipped'}@${Math.round(performance.now())}`); }, true);
  for (let i = 0; i < 60; i++) { const p = document.createElement('p'); p.textContent = 'x'; md.append(p); await f(); }
  const hr = document.createElement('hr'); md.append(hr); await f();
  for (let i = 0; i < 60; i++) { const p = document.createElement('p'); p.textContent = 'x'; md.append(p); await f(); }
  await new Promise(r => setTimeout(r, 1500));
  const before = { veil: hr.hasAttribute('data-butter-veil'), opacity: getComputedStyle(hr).opacity, marks: hr.getAttributeNames().join(' ') };
  const t = performance.now(); hr.scrollIntoView({ block: 'center' });
  const frames = [];
  for (let i = 0; i < 4; i++) { await f(); frames.push(`rAF${i + 1}: veil ${hr.hasAttribute('data-butter-veil')}, opacity ${getComputedStyle(hr).opacity}`); }
  await new Promise(r => setTimeout(r, 1500));
  document.querySelector('.s').scrollTop = 0; for (let i = 0; i < 4; i++) await f();
  const away = { veil: hr.hasAttribute('data-butter-veil'), opacity: getComputedStyle(hr).opacity };
  return { away, before, scrolledAt: Math.round(t), events: ev, frames, after: hr.getAttributeNames().join(' ') };
});
console.log(`REPORT ${JSON.stringify(r)}`);
await b.close();
