// With Smoother streaming's `cv` setting on, the browser's scroll anchoring is off on the chat's
// content (stream/containment.css): with content-visibility skipping, Chromium's anchoring moved a
// long chat back to its start while the user wheeled down, on load, and after a landed rail jump
// (notes/runs/2026-11-16-wheel-jump-top/cause.md, notes/runs/2026-11-16-rail-jump-live/cause.md).
// With `cv` off, the browser anchors as it does without Butter.
// Real containment.css in headless Chromium (Playwright), over a synthetic chat: a turn above the
// view grows, and the test reads whether the browser moved the chat to keep the view still.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(`${root}extension/stream/containment.css`, 'utf8');
const GROW = 300; // px the turn above the view grows by

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, requestAnimationFrame -- runs in the page */
function build(off) {
  if (off != null) document.documentElement.setAttribute('data-butter-off', off);
  const turn = (i) => `<article data-turn-key="q${i}" style="height:800px">Turn ${i}</article>`;
  document.body.innerHTML = `<style>
      body { margin: 0 }
      .thread-scroll-container { height: 700px; overflow: auto; overflow-anchor: auto }
    </style>
    <div class="thread-scroll-container"><div>${Array.from({ length: 10 }, (_, i) => turn(i)).join(
      '',
    )}</div></div>`;
}

// Runs in the page: scrolls into turn 5, grows turn 1 (above the view), and returns how far the
// browser moved scrollTop on its own over the next frames.
async function growAbove(grow) {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const sc = document.querySelector('.thread-scroll-container');
  sc.scrollTop = 4200;
  await frame();
  await frame();
  const before = sc.scrollTop;
  const t = document.querySelector('[data-turn-key="q1"]');
  t.style.height = `${800 + grow}px`;
  await frame();
  await frame();
  return sc.scrollTop - before;
}

// How far the browser's anchoring moved the chat when a turn above the view grew.
async function anchored(off) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.route('**/*', (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>chat</title>' })
        : route.abort(),
    );
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    await page.addStyleTag({ content: css });
    await page.evaluate(build, off);
    return await page.evaluate(growAbove, GROW);
  } finally {
    await page.close();
  }
}

test('with cv on, the browser does not anchor the chat when content above the view grows', async () => {
  assert.equal(await anchored(null), 0, 'the browser moved the chat with every setting on');
  assert.equal(await anchored('container'), 0, 'the browser moved the chat with only cv on');
});

test('with cv off, the browser anchors the chat as it does without Butter', async () => {
  assert.equal(await anchored('cv'), GROW, 'control: anchoring kept the view still');
});
