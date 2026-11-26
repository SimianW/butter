// The find-bar probe's before-paint sample (lab/harness/stream-findbar-probe.mjs with
// stream-ux-probe.mjs's U.beforePaint) in headless Chromium (seam 1b), over the synthetic chat of
// test/helpers/veil-page.mjs with Butter's real stream/containment.css and stream/offscreen.js, the
// marker in an isolated script world from before the chat is built and the probe's page code in
// the main world after it, as on chatgpt.com. A find, then scrollIntoView, renders a held, veiled
// block (the find-frame report's reproduction:
// notes/runs/2026-11-24-veil-acceptance/final/find-frame/report.md), on a busy page or in a frame's
// requestAnimationFrame. The probe must read the frame as drawn: flags 8 (held only) before paint
// with the current marker, whose `sized` observer unveils the block in that frame, and 11 (veil,
// opacity 0, held) with the marker from before the fix (9cdba5f), where the frame wins the race
// with the state-change event. A witness ResizeObserver made after the probe's shows the event had
// not run at the sample, so the 8 comes from `sized` running before the probe's observer.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, stream, frames } from './helpers/veil-page.mjs';
import { installUx } from '../lab/harness/stream-ux-probe.mjs';
import { installFindbar, findbarAnalyse } from '../lab/harness/stream-findbar-probe.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BUILDS = {
  'the current marker': undefined,
  'the marker before the fix (9cdba5f)': execFileSync(
    'git',
    ['show', '9cdba5f:extension/stream/offscreen.js'],
    { cwd: root },
  ).toString(),
};

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window, getSelection, requestAnimationFrame, performance, ResizeObserver
   -- runs in the page */

// A completed answer whose blocks below the fold are held and veiled, laid out by pre-layout, with
// a phrase the probe can pick (letters only, found once) in the held block `zq200zq`.
async function heldChat(js) {
  const page = await openChat(
    browser,
    `${root}extension/`,
    { turns: 2, blocks: 40, renderer: 'classic', sampler: false, isolated: true },
    { js },
  );
  await page.addStyleTag({ content: '#answer p { height: auto }' });
  await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
  await page.evaluate(stream, { n: 240, perFrame: 6, math: 1 });
  await page.waitForTimeout(1300); // the flush holds the blocks below the fold
  await page.evaluate(() =>
    document
      .querySelector('#answer [data-talvt-turn-state]')
      .setAttribute('data-talvt-turn-state', 'complete'),
  );
  await page.waitForTimeout(2500); // pre-layout runs FLUSH_MS after completion
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#answer p')].find((p) =>
      p.textContent.includes('zq200zq'),
    );
    b.insertAdjacentHTML('beforeend', ' quietly folded marmalade lanterns');
    window.target = b;
  });
  return page;
}

// In the page: the witness, made after the probe's observer. On each of its callbacks, whether the
// target's state-change event (not skipped) had run by then.
function witness() {
  const b = window.target;
  window.evRan = false;
  window.seen = [];
  b.addEventListener('contentvisibilityautostatechange', (e) => {
    if (!e.skipped) window.evRan = true;
  });
  new ResizeObserver(() => window.seen.push({ t: performance.now(), evRan: window.evRan })).observe(
    b,
  );
}

// In the page: window.find of `str`, then scrollIntoView on the block holding the selection, in the
// next frame's requestAnimationFrame or in this task, which then stays busy for 150 ms (see
// test/stream-veil-activation-chromium.test.mjs). Returns the page time just before.
function act({ str, busy }) {
  const t0 = performance.now();
  const run = () => {
    window.find(str, false, false, true, false, false, false);
    getSelection().getRangeAt(0).startContainer.parentElement.closest('p').scrollIntoView({
      block: 'center',
    });
  };
  if (!busy) return new Promise((resolve) => requestAnimationFrame(() => (run(), resolve(t0))));
  run();
  const end = performance.now() + 150;
  while (performance.now() < end);
  return t0;
}

for (const [build, js] of Object.entries(BUILDS))
  for (const busy of [true, false])
    test(`find, then scrollIntoView ${busy ? 'on a busy page' : 'in a frame'}, ${build}: the probe reads the frame the block renders in as drawn`, async () => {
      const page = await heldChat(js);
      try {
        await page.evaluate(installUx, { mode: ['u4'], schedEnd: 1e9, sampleMs: 0 });
        const prep = await page.evaluate(installFindbar);
        assert.ok(!prep.none, `the probe picked a held block: ${JSON.stringify(prep)}`);
        assert.equal(prep.flagsBefore, 15, 'veiled, opacity 0, skipped, held');
        assert.ok(
          await page.evaluate(() => window.target.textContent.includes('marmalade lanterns')),
        );
        await page.evaluate(witness);
        await page.evaluate(frames, 3);
        const t0 = await page.evaluate(act, { str: prep.str, busy });
        await page.evaluate(frames, 6);
        const t1 = await page.evaluate(() => performance.now());
        const raw = await page.evaluate(() => window.__fb.stop());
        const seen = await page.evaluate(() => window.seen);
        const at = (t) => raw.timeOrigin + t;
        const a = findbarAnalyse({
          ...raw,
          stamps: [
            { kind: 'chord', at: at(t0) },
            { kind: 'chord', at: at(t1) },
          ],
        });
        const fixed = js === undefined;
        const log = JSON.stringify({ rendered: a.rendered, drawn: a.drawnAtOpacity0, seen });
        assert.ok(a.rendered, `the block rendered in view: ${log}`);
        // At the frame's start the block reads veiled whatever the build: rendered (11) after an
        // act in a task, still skipped (15) when the act runs in a later rAF of the same frame.
        assert.equal(a.rendered.flags, busy ? 11 : 15, log);
        assert.equal(a.rendered.beforePaint, fixed ? 8 : 11, log);
        assert.equal(a.drawnAtOpacity0.frames, fixed ? 0 : 1, log);
        // The witness's first report after the act is in the frame the block rendered in: the
        // state-change event had not run yet, so the probe's 8 came from the marker's `sized`.
        const first = seen.find((s) => s.t >= t0);
        assert.equal(first?.evRan, false, log);
      } finally {
        await page.close();
      }
    });
