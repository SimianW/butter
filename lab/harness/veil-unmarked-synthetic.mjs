// A streamed answer block that the marker never marks (#172): a synthetic page with Butter's real
// stream/containment.css and stream/offscreen.js in headless Chromium, no ChatGPT and no lab lock.
//
// node lab/harness/veil-unmarked-synthetic.mjs [<extension dir> ...]
//   default: extension/ of this checkout. Pass a copy with the first veil prototype applied
//   (notes/runs/2026-11-24-stream-veil/pv0.patch) to see its leak.
//
// The recipe: an answer turn in `in_progress` whose markdown root receives, one per frame, enough
// paragraphs to pass the fold, then an <hr> styled as ChatGPT's (Tailwind's preflight:
// `height: 0`, a 1px top border), then more paragraphs; the turn then leaves `in_progress`.
// A plain <hr> (`height: auto`) is streamed the same way as the control: the study's synthetic
// page used one and did not reproduce the leak.
// Verdict lines per build: `tw-hr-unmarked` (the Tailwind <hr> ends with neither data-butter-seen nor
// data-butter-unrendered and leaves content-visibility auto at completion), `ua-hr-held` (the
// plain <hr> ends data-butter-unrendered). REPORT lines: each <hr>'s skipped events, the content
// box heights a ResizeObserver reported, its marks and computed style before and after completion.
// Exit 1 when the recipe does not behave as described.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(root, 'extension')];
let fails = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);

/* global document, requestAnimationFrame, ResizeObserver, getComputedStyle -- runs in the page */
function build() {
  document.body.innerHTML = `<style>
      body { margin: 0 } p { margin: 0 0 16px; line-height: 24px }
      .thread-scroll-container { height: 700px; overflow: auto; width: 768px }
      /* Tailwind's preflight, as on chatgpt.com */
      *, ::before, ::after { box-sizing: border-box; border: 0 solid }
      hr.tw { height: 0; color: inherit; border-top-width: 1px; margin: 48px 0 }
    </style>
    <div class="thread-scroll-container"><div>
      <article data-turn-key="q0"><div data-talvt-turn-state="in_progress">
        <div data-message-author-role="assistant" data-message-id="a0">
          <div class="MarkdownRoot-x" data-markdown-text-style="assistant-message"><p>First block.</p></div>
        </div>
      </div></article>
    </div></div>`;
  const log = (window.__hr = { events: [], ro: new Map() });
  document.addEventListener('contentvisibilityautostatechange', e => {
    if (e.target.tagName === 'HR') log.events.push([e.target.className, e.skipped, Math.round(performance.now())]);
  }, true);
  log.obs = new ResizeObserver(es => { for (const e of es) log.ro.get(e.target.className).push(e.contentRect.height); });
}

// One block per frame, in the order a stream writes them.
async function stream() {
  const md = document.querySelector('[data-markdown-text-style]');
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const add = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) { el.className = cls; window.__hr.ro.set(cls, []); window.__hr.obs.observe(el); } else el.textContent = 'Streamed paragraph.';
    md.append(el);
  };
  for (let i = 0; i < 60; i++) { add('p'); await frame(); }
  add('hr', 'tw'); await frame();
  for (let i = 0; i < 5; i++) { add('p'); await frame(); }
  add('hr', 'ua'); await frame();
  for (let i = 0; i < 5; i++) { add('p'); await frame(); }
}

function snap() {
  const one = cls => {
    const el = document.querySelector(`hr.${cls}`), cs = getComputedStyle(el);
    return { seen: el.hasAttribute('data-butter-seen'), unrendered: el.hasAttribute('data-butter-unrendered'), veil: el.hasAttribute('data-butter-veil'),
      cv: cs.contentVisibility, opacity: cs.opacity, height: cs.height, borderTop: cs.borderTopWidth, ro: window.__hr.ro.get(cls) };
  };
  return { tw: one('tw'), ua: one('ua'), events: window.__hr.events.slice() };
}

const fmt = s => `seen ${s.seen}, unrendered ${s.unrendered}, veil ${s.veil}, content-visibility ${s.cv}, opacity ${s.opacity}, height ${s.height}, border-top ${s.borderTop}, ResizeObserver heights [${s.ro.join(', ')}]`;

const browser = await chromium.launch();
try {
  for (const dir of dirs) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.route('**/*', r => (r.request().isNavigationRequest() ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>veil</title>' }) : r.abort()));
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    await page.addStyleTag({ content: readFileSync(path.join(dir, 'stream/containment.css'), 'utf8') });
    await page.addScriptTag({ content: readFileSync(path.join(dir, 'stream/offscreen.js'), 'utf8') });
    await page.evaluate(build);
    await page.evaluate(stream);
    await page.waitForTimeout(2500); // past the marker's 1 s flush
    const mid = await page.evaluate(snap);
    await page.evaluate(() => document.querySelector('[data-talvt-turn-state]').setAttribute('data-talvt-turn-state', 'finished_successfully'));
    await page.waitForTimeout(2500);
    const end = await page.evaluate(snap);
    const name = path.relative(root, dir) || dir;
    report(`${name}: streaming, after the flush: tw <hr> ${fmt(mid.tw)}; ua <hr> ${fmt(mid.ua)}`);
    report(`${name}: after completion: tw <hr> ${fmt(end.tw)}; ua <hr> ${fmt(end.ua)}`);
    report(`${name}: skipped events [class, skipped, ms]: ${JSON.stringify(end.events)}; after completion ${end.events.length - mid.events.length}`);
    const t = end.tw;
    verdict(mid.events.some(e => e[0] === 'tw' && e[1]) && !t.seen && !t.unrendered && t.cv !== 'auto' && t.ro.every(h => h === 0),
      `tw-hr-unmarked (${name})`, `skipped while streaming ${mid.events.some(e => e[0] === 'tw' && e[1])}; after completion ${fmt(t)}`);
    verdict(end.ua.unrendered && end.ua.cv === 'auto', `ua-hr-held (${name})`, fmt(end.ua));
    if (t.veil) report(`${name}: the Tailwind <hr> is still veiled after completion, opacity ${t.opacity}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(fails ? 1 : 0);
