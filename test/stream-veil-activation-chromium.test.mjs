// The veil against activation in headless Chromium (seam 1b), with Butter's real
// stream/containment.css and stream/offscreen.js over the synthetic chat of
// test/helpers/veil-page.mjs: a find (window.find), a selection or a focus in a held, veiled block
// below the fold makes the browser render the block on the spot, without the scroll near the view
// that the other veil checks use. The state-change event that unveils the block is a task the
// browser posts then; when the frame runs first (an act in a frame's requestAnimationFrame, or on a
// busy page, as with the browser's find bar in the lab), that frame lays the block out and paints
// it. A witness ResizeObserver, created after the marker's, records the block in the frame it
// renders, after layout and the marker's observers and before paint: it must not be veiled then.
// Blocks take their content's height here (not the fixture's fixed 40px), as on chatgpt.com.
// Each act runs again after the held block left the page and came back where it was, still skipped
// (a Dil remount, a turn that leaves and comes back): no state-change event comes for it then.
// What the frame looks like (blank text without the fix) was checked with screenshots of single
// frames: notes/runs/2026-11-24-veil-acceptance/final/find-frame/report.md.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, stream, frames } from './helpers/veil-page.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window, getComputedStyle, getSelection, requestAnimationFrame, performance,
   ResizeObserver -- runs in the page */

// A completed answer whose blocks below the fold are held and veiled, laid out by pre-layout; the
// block with the word `zq200zq` (and a link appended to it) is returned as window.target. With
// `remount`, that block then leaves the page and comes back where it was, some frames apart.
async function heldChat({ remount = false } = {}) {
  const page = await openChat(browser, `${root}extension/`, {
    turns: 2,
    blocks: 40,
    renderer: 'classic',
    sampler: false,
  });
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
  const target = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#answer p')].find((p) =>
      p.textContent.includes('zq200zq'),
    );
    b.insertAdjacentHTML('beforeend', ' <a href="#x">link</a>');
    window.target = b;
    return {
      held: b.hasAttribute('data-butter-unrendered'),
      veiled: getComputedStyle(b).opacity === '0',
      skipped: !b.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
    };
  });
  assert.deepEqual(target, { held: true, veiled: true, skipped: true }, 'a held, veiled block');
  if (remount) {
    await page.evaluate(() => {
      window.next = window.target.nextSibling;
      window.target.remove();
    });
    await page.evaluate(frames, 3);
    await page.evaluate(() => window.next.before(window.target));
    await page.evaluate(frames, 3);
    const back = await page.evaluate(() => ({
      held: window.target.hasAttribute('data-butter-unrendered'),
      veiled: getComputedStyle(window.target).opacity === '0',
      skipped: !window.target.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
    }));
    assert.deepEqual(back, { held: true, veiled: true, skipped: true }, 'back: held and veiled');
  }
  const g = await page.evaluate(gain);
  assert.ok(g.skipped > 100, `few held, skipped blocks (${g.skipped})`);
  assert.equal(g.notVeiled, 0, 'every held block that is still skipped is veiled');
  return page;
}

// In the page: the veil's gain. Of the held blocks still skipped (nobody looks at them), how many
// are not at opacity 0.
function gain() {
  const held = [...document.querySelectorAll('#answer [data-butter-unrendered]')];
  const skipped = held.filter(
    (b) => !b.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
  );
  return {
    skipped: skipped.length,
    notVeiled: skipped.filter((b) => getComputedStyle(b).opacity !== '0').length,
  };
}

// In the page: the witness. On each of its callbacks (the target's size changed: it rendered or
// was skipped), whether the target is rendered and whether it computes opacity 0.
function witness() {
  const b = window.target;
  window.seen = [];
  new ResizeObserver(() =>
    window.seen.push({
      rendered: b.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
      opacity: getComputedStyle(b).opacity,
    }),
  ).observe(b);
}

// In the page: runs the act `name` on window.target in the next frame's requestAnimationFrame
// (when `busy` is false), or in this task, which then stays busy for 150 ms, so that the frame
// comes before the state-change event the act queues. A task over 100 ms gets the frame ahead of
// that event in Chromium's scheduler; in the lab the find bar's frames took about 90 ms on ChatGPT.
function act({ name, busy }) {
  const b = window.target;
  const find = () => window.find('zq200zq', false, false, true, false, false, false);
  const select = () => {
    const r = document.createRange();
    r.selectNodeContents(b.firstChild);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  };
  const run = {
    find,
    'find, then scrollIntoView': () => (find(), b.scrollIntoView({ block: 'center' })),
    'a selection, then scrollIntoView': () => (select(), b.scrollIntoView({ block: 'center' })),
    'focus on a link': () => b.querySelector('a').focus(),
  }[name];
  if (!busy) return new Promise((resolve) => requestAnimationFrame(() => resolve(run())));
  run();
  const end = performance.now() + 150;
  while (performance.now() < end);
}
const ACTS = [
  'find',
  'find, then scrollIntoView',
  'a selection, then scrollIntoView',
  'focus on a link',
];

const CASES = [false, true].flatMap((remount) => [false, true].map((busy) => ({ remount, busy })));

for (const { remount, busy } of CASES)
  for (const name of ACTS)
    test(`${name} ${busy ? 'on a busy page' : 'in a frame'}${remount ? ', the block back in the page' : ''}: the frame that renders the held block draws it unveiled`, async () => {
      const page = await heldChat({ remount });
      try {
        await page.evaluate(witness);
        await page.evaluate(frames, 2);
        await page.evaluate(() => (window.seen = []));
        await page.evaluate(act, { name, busy });
        await page.evaluate(frames, 6);
        const seen = await page.evaluate(() => window.seen);
        assert.ok(
          seen.some((s) => s.rendered),
          `the act rendered the block: ${JSON.stringify(seen)}`,
        );
        assert.deepEqual(
          seen.filter((s) => s.rendered && s.opacity === '0'),
          [],
          'rendered at opacity 0 in a frame',
        );
        const g = await page.evaluate(gain);
        assert.ok(g.skipped > 100, `few held, skipped blocks after the act (${g.skipped})`);
        assert.equal(g.notVeiled, 0, 'held blocks that are still skipped stay veiled');
      } finally {
        await page.close();
      }
    });
