// The veil in headless Chromium (seam 1b), with Butter's real stream/containment.css and
// stream/offscreen.js over a synthetic chat (test/helpers/veil-page.mjs). This is the automated
// check of spec #170's hard requirement: no rendered block is ever veiled, in any frame that is
// drawn. A sampler checks every block on every frame, at its start and after it is drawn, through
// each step below and the frames after it. The veil must also work: every skipped, never-rendered
// block under the `content-visibility: auto` rules computes opacity "0", and a reduced copy of
// ChatGPT's paint-readiness walk enters no veiled block.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, effectiveness, stream, frames } from './helpers/veil-page.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const FRAMES_AFTER = 12; // frames sampled after each step, at least

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window, getComputedStyle -- runs in the page */

async function scenario({ renderer, transition }) {
  const page = await openChat(browser, `${root}extension/`, {
    turns: 2,
    blocks: 40,
    renderer,
    transition,
  });
  try {
    const step = async (name, act, n = FRAMES_AFTER) => {
      await page.evaluate((s) => (window.veilStep = s), name);
      await act();
      await page.evaluate(frames, n);
    };
    const veiled = '#answer [data-butter-veil]';
    const check = async (when) => {
      const e = await page.evaluate(effectiveness);
      assert.ok(
        e.skippedNeverRendered > 10,
        `${when}: few skipped never-rendered blocks (${e.skippedNeverRendered})`,
      );
      assert.equal(e.notZero, 0, `${when}: skipped never-rendered blocks not at opacity "0"`);
      assert.equal(e.enteredVeiled, 0, `${when}: the walk entered a veiled block`);
      return e;
    };

    // The view on the answer's start: everything streamed after the first screen is below the fold.
    await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
    await step('stream blocks below the fold', () =>
      page.evaluate(stream, { n: 240, perFrame: 6 }),
    );
    await check('while streaming');
    await step('scrollTop onto veiled blocks while streaming', () =>
      page.evaluate(scrollTo, { selector: veiled, index: 20, offset: 100 }),
    );
    await step('scrollTop back to the answer start while streaming', () =>
      page.evaluate(scrollTo, { selector: '#answer', index: 0 }),
    );
    await step('stream more blocks', () => page.evaluate(stream, { n: 60, perFrame: 6 }), 2);
    // ChatGPT lays the answer out in the task that marks it complete, before observers run.
    await step('complete the answer', () =>
      page.evaluate(() => {
        document
          .querySelector('[data-talvt-turn-state="in_progress"]')
          .setAttribute('data-talvt-turn-state', 'complete');
        return document.body.offsetHeight;
      }),
    );
    await check('after completion');
    await step('scrollTop onto veiled blocks after completion', () =>
      page.evaluate(scrollTo, { selector: veiled, index: 10, offset: 100 }),
    );
    await step('let the flush run', () => page.waitForTimeout(1300));
    await step('hide the chat and show it again', async () => {
      await page.evaluate(() => (document.getElementById('chat').style.display = 'none'));
      await page.evaluate(frames, 3);
      await page.evaluate(() => (document.getElementById('chat').style.display = ''));
    });
    await step('detach a held block and re-attach it in view', async () => {
      await page.evaluate(() => {
        const held = [...document.querySelectorAll('#answer [data-butter-veil]')].at(-1);
        window.detachedBlock = held;
        held.remove();
      });
      await page.evaluate(frames, 3);
      await page.evaluate(() => {
        const sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
        const inView = [...document.querySelectorAll('#answer p')].find(
          (p) => p.getBoundingClientRect().top > sc.top + 100,
        );
        inView.before(window.detachedBlock);
      });
    });
    await step(
      'inline content-visibility: auto on unmarked blocks outside a streaming turn',
      async () => {
        await page.evaluate(() => {
          const turn = document.querySelector('#t0').cloneNode(true);
          turn.id = 't-restored';
          turn.setAttribute('data-turn-key', 'restored');
          turn.removeAttribute('data-butter-seen');
          for (const p of turn.querySelectorAll('p')) {
            p.removeAttribute('data-butter-seen');
            p.style.contentVisibility = 'auto';
          }
          document.querySelector('.thread-scroll-container > div').append(turn);
        });
        await page.evaluate(frames, 3);
        const stale = await page.evaluate(() =>
          [...document.querySelectorAll('#t-restored p[data-butter-veil]')].map(
            (p) => getComputedStyle(p).opacity,
          ),
        );
        assert.ok(stale.length > 0, 'the marker veils a skipped block it never saw render');
        assert.deepEqual(
          [...new Set(stale)],
          ['1'],
          'outside the rules, the attribute does nothing',
        );
        await page.evaluate(scrollTo, { selector: '#t-restored p', index: 20 });
      },
    );
    await step('emulate print media', async () => {
      await page.emulateMedia({ media: 'print' });
      const atZero = await page.evaluate(() => ({
        veiled: document.querySelectorAll('[data-butter-veil]').length,
        zero: [...document.querySelectorAll('[data-markdown-text-style] *')].filter(
          (el) => getComputedStyle(el).opacity === '0',
        ).length,
      }));
      assert.ok(atZero.veiled > 0, 'blocks are veiled while printing');
      assert.equal(atZero.zero, 0, 'no element computes opacity 0 in print');
      await page.emulateMedia({ media: 'screen' });
    });
    await step('turn cv off', () =>
      page.evaluate(() => {
        document.documentElement.setAttribute('data-butter-off', 'cv');
        document.dispatchEvent(new Event('butter-settings'));
      }),
    );
    await step('turn cv back on', () =>
      page.evaluate(() => {
        document.documentElement.removeAttribute('data-butter-off');
        document.dispatchEvent(new Event('butter-settings'));
      }),
    );
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('[data-butter-veil]').length),
      0,
    );
    const result = await page.evaluate(() => ({
      samples: window.samples,
      violations: window.violations,
      transitions: window.opacityTransitions,
    }));
    assert.ok(result.samples > 100, `only ${result.samples} samples`);
    return result;
  } finally {
    await page.close();
  }
}

test('no rendered block is ever veiled, and the veil holds off the walk (classic renderer)', async () => {
  const r = await scenario({ renderer: 'classic', transition: true });
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.transitions, [], 'the veil started an opacity transition');
});

test('no rendered block is ever veiled, and the veil holds off the walk (Dil renderer)', async () => {
  const r = await scenario({ renderer: 'dil', transition: false });
  assert.deepEqual(r.violations, []);
});
