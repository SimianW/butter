// Style work per streamed update in a long chat, with Butter's real stream/containment.css and
// stream/offscreen.js, in headless Chromium (Playwright). The page is synthetic: nine completed
// history turns of classic answers (300 blocks each), whose blocks offscreen.js marks seen, and one
// in-progress answer that has already streamed 300 blocks. The test then streams blocks into it,
// one update per frame, and counts the elements Chromium restyles (the elementCount of every
// UpdateLayoutTree trace event): a count, not a time, so it does not depend on the machine.
// A streamed update adds one small block, so it should restyle a handful of elements. A
// containment selector whose :has() made Chromium restyle every block of the streaming answer on
// each insertion (about 490 elements per update here, whatever the history) made a long stream's
// style work grow with the square of its length (notes/runs/2026-11-11-replay-blocking).
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(`${root}extension/${file}`, 'utf8');
const HISTORY_TURNS = 9;
const BLOCKS = 300; // per history answer, and already streamed into the in-progress one
const UPDATES = 30; // kept well under offscreen.js's 1 s flush

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, requestAnimationFrame -- runs in the page */
function build({ turns, blocks }) {
  const block = (i) =>
    `<p>Block ${i}: <span class="katex"><span>x</span><sub>${i}</sub></span> and some prose.</p>`;
  const answer = (n) => Array.from({ length: n }, (_, i) => block(i)).join('');
  const turn = (i, state, n) => `<article data-turn-key="q${i}">
      <div data-talvt-turn-state="${state}">
        <div data-message-author-role="user" data-message-id="q${i}"><div data-user-message-bubble>Question ${i}</div></div>
        <div data-message-author-role="assistant" data-message-id="a${i}">
          <div class="MarkdownRoot-rZKhxa" data-markdown-text-style="assistant-message">${answer(n)}</div>
        </div>
      </div>
    </article>`;
  document.body.innerHTML = `<style>
      body { margin: 0 } p { margin: 0 0 16px; line-height: 24px }
      .thread-scroll-container { height: 700px; overflow: auto; width: 768px }
    </style>
    <div class="thread-scroll-container"><div>${Array.from({ length: turns }, (_, i) =>
      turn(i, 'complete', blocks),
    ).join('')}${turn(turns, 'in_progress', blocks)}</div></div>`;
}

// Runs in the page: append `n` blocks to the in-progress answer, one per frame.
async function stream(n) {
  const md = document.querySelector(
    '[data-talvt-turn-state="in_progress"] [data-markdown-text-style]',
  );
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  await frame();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('p');
    p.innerHTML = `Streamed ${i}: <span class="katex"><span>y</span><sub>${i}</sub></span> more.`;
    md.append(p);
    await frame();
  }
  await frame();
}

// Elements restyled per streamed update in a fresh page with the given stylesheet.
async function styledPerUpdate(css) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.route('**/*', (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stream</title>' })
        : route.abort(),
    );
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: read('stream/offscreen.js') });
    await page.evaluate(build, { turns: HISTORY_TURNS, blocks: BLOCKS });
    // History blocks render once, then offscreen.js marks them seen at its flush and the ones off
    // screen skip, as they do live.
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll('[data-talvt-turn-state="complete"] p[data-butter-seen]')
          .length === n,
      HISTORY_TURNS * BLOCKS,
    );
    await page.evaluate(() => {
      const sc = document.querySelector('.thread-scroll-container');
      sc.scrollTop = sc.scrollHeight;
    });
    // Let the in-progress answer's flush pass, so none lands inside the measured window.
    await page.waitForTimeout(1500);
    await browser.startTracing(page, { categories: ['devtools.timeline'] });
    await page.evaluate(stream, UPDATES);
    const trace = JSON.parse(await browser.stopTracing());
    const elements = trace.traceEvents
      .filter((e) => e.name === 'UpdateLayoutTree')
      .reduce((sum, e) => sum + (e.args?.elementCount ?? e.args?.data?.elementCount ?? 0), 0);
    return elements / UPDATES;
  } finally {
    await page.close();
  }
}

test('a streamed update restyles about its own block, not the whole answer', async () => {
  const perUpdate = await styledPerUpdate(read('stream/containment.css'));
  console.log(`elements restyled per streamed update: ${perUpdate}`);
  assert.ok(perUpdate >= 1, 'no UpdateLayoutTree element counts in the trace');
  assert.ok(perUpdate < 50, `${perUpdate} elements restyled per update (limit 50)`);
});
