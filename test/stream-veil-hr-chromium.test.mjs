// The veil's leak regression (ticket #176 of spec #170) in headless Chromium (seam 1b), with
// Butter's real stream/containment.css and stream/offscreen.js over the synthetic chat of
// test/helpers/veil-page.mjs. The streamed answer carries <hr> separators styled as ChatGPT's
// (`height: 0`): the marker never queues them, so they are never held or marked seen, and they
// leave the `content-visibility: auto` rules with no state-change event, where they render
// (notes/runs/2026-11-24-veil-unmarked/report.md). The first veil prototype left 19 of them at
// opacity 0 after completion.
// Each moment #172 names gets a case, and each case runs four builds: with neither of its two
// covers (it must fail: a rendered <hr> computes opacity 0), with each cover alone (the <hr> stays
// at opacity 1 once rendered), and the real build (no violation at all). The covers are cut from
// the real sources by test/helpers/veil-variants.mjs. The sampler checks every block on every frame.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, stream, frames } from './helpers/veil-page.mjs';
import { variant, marker, stylesheet } from './helpers/veil-variants.mjs';

const extension = fileURLToPath(new URL('../extension/', import.meta.url));
const FRAMES_AFTER = 12;

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window -- runs in the page */

const veiledHr = '#answer hr[data-butter-veil]';

// Streams 120 blocks, every tenth an <hr>, below the fold of a chat built with `cuts` taken out of
// the real sources, then runs `body(steps)` and returns the sampler's violations.
async function run(cuts, body) {
  const page = await openChat(
    browser,
    extension,
    { turns: 1, blocks: 20, renderer: 'classic', transition: true },
    variant(extension, cuts),
  );
  try {
    const step = async (name, act, n = FRAMES_AFTER) => {
      await page.evaluate((s) => (window.veilStep = s), name);
      await act();
      await page.evaluate(frames, n);
    };
    const count = (selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector);
    const state = (value) =>
      page.evaluate(
        (v) =>
          (window.parked?.turn ?? document.getElementById('answer'))
            .querySelector('[data-talvt-turn-state]')
            .setAttribute('data-talvt-turn-state', v),
        value,
      );
    await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
    await step('stream blocks below the fold', () =>
      page.evaluate(stream, { n: 120, perFrame: 6, hrEvery: 10 }),
    );
    assert.ok((await count(veiledHr)) >= 8, 'the <hr> blocks below the fold are veiled');
    await body({ page, step, count, state });
    const r = await page.evaluate(() => ({
      samples: window.samples,
      violations: window.violations,
    }));
    assert.ok(r.samples > 40, `only ${r.samples} samples`);
    return r.violations;
  } finally {
    await page.close();
  }
}

const atZero = (violations) =>
  violations.filter((v) => v.tag === 'HR' && v.kind === 'rendered block at opacity 0');
const onto = (selector, index = 3) => ({ selector, index, offset: 100 });

const MOMENTS = [
  {
    name: 'completion',
    covers: [
      ['the completion sweep', marker.completionSweep],
      ['the stylesheet guard', stylesheet.ruleGuard],
    ],
    body: async ({ page, step, count, state }) => {
      await step('let the flush run', () => page.waitForTimeout(1300));
      assert.equal(await count('#answer hr[data-butter-unrendered]'), 0, 'no <hr> is held');
      assert.ok((await count('#answer p[data-butter-unrendered]')) > 10, 'paragraphs are held');
      // ChatGPT lays the answer out in the task that marks it complete.
      await step('complete the answer', async () => {
        await state('complete');
        await page.evaluate(() => document.body.offsetHeight);
      });
      await step('scrollTop onto the <hr> blocks', () =>
        page.evaluate(scrollTo, onto('#answer hr', 6)),
      );
    },
  },
  {
    name: 'Stop',
    covers: [
      ['the completion sweep', marker.completionSweep],
      ['the stylesheet guard', stylesheet.ruleGuard],
    ],
    // Right after the stream, before the flush: the paragraphs are queued, the <hr> never is.
    body: async ({ page, step, state }) => {
      await step('Stop', async () => {
        await state('stopped');
        await page.evaluate(() => document.body.offsetHeight);
      });
      await step('let the flush run', () => page.waitForTimeout(1300));
    },
  },
  {
    name: 'cv off',
    covers: [
      ['the cv-off sweep', marker.cvSweep],
      ["the stylesheet's cv guard", stylesheet.cvGuard],
    ],
    body: async ({ page, step }) => {
      const setting = (on) =>
        page.evaluate((cv) => {
          if (cv) document.documentElement.removeAttribute('data-butter-off');
          else document.documentElement.setAttribute('data-butter-off', 'cv');
          document.dispatchEvent(new Event('butter-settings'));
        }, on);
      await step('turn cv off while streaming', () => setting(false));
      await step('turn cv back on', () => setting(true));
      await step('stream more blocks', () =>
        page.evaluate(stream, { n: 30, perFrame: 6, hrEvery: 10 }),
      );
    },
  },
  {
    // A version switch or a hidden chat: the turn leaves the page while streaming, its answer
    // completes out of it (no observer sees that), and it comes back.
    name: 'leaving the streaming turn',
    covers: [
      ['the re-entry unveil', marker.reentry],
      ['the stylesheet guard', stylesheet.ruleGuard],
    ],
    body: async ({ page, step, state }) => {
      await step(
        'the turn leaves the page',
        () =>
          page.evaluate(() => {
            const turn = document.getElementById('answer');
            window.parked = { turn, parent: turn.parentNode };
            turn.remove();
          }),
        3,
      );
      await step('the answer completes out of the page', () => state('complete'), 3);
      await step('it comes back, the view on its <hr> blocks', async () => {
        await page.evaluate(() => {
          window.parked.parent.append(window.parked.turn);
          window.parked = null;
        });
        await page.evaluate(scrollTo, onto('#answer hr', 6));
      });
    },
  },
];

for (const { name, covers, body } of MOMENTS) {
  const all = covers.map(([, cut]) => cut);
  test(`${name}: without ${covers.map(([c]) => c).join(' or ')}, a rendered <hr> computes opacity 0`, async () => {
    const leaks = atZero(await run(all, body));
    assert.ok(leaks.length > 0, 'the check catches the leak');
  });
  for (const [kept, cut] of covers)
    test(`${name}: ${kept} alone keeps every rendered <hr> at opacity 1`, async () => {
      assert.deepEqual(
        atZero(
          await run(
            all.filter((c) => c !== cut),
            body,
          ),
        ),
        [],
      );
    });
  test(`${name}: the build veils no rendered block`, async () => {
    assert.deepEqual(await run([], body), []);
  });
}

// The first prototype's trap: no mark records that an <hr> rendered, so its "rendered once" test
// (shown or seen) failed and a rendered <hr> was veiled again when it scrolled away.
const renderedOnce = async ({ page, step, count, state }) => {
  await step('scrollTop onto a veiled <hr> while streaming', () =>
    page.evaluate(scrollTo, onto(veiledHr)),
  );
  await step('scrollTop back to the answer start', () =>
    page.evaluate(scrollTo, { selector: '#answer', index: 0 }),
  );
  await step('let the flush run', () => page.waitForTimeout(1300));
  await step('complete the answer', () => state('complete'));
  assert.equal(await count(veiledHr), 0);
  // React reuses the elements for a regenerated answer: the turn streams again.
  await step('the turn streams again into the same elements', () => state('in_progress'));
  await step('scrollTop onto the last <hr>', () =>
    page.evaluate(scrollTo, { selector: '#answer hr', index: -1 }),
  );
  await step('scrollTop back to the answer start again', () =>
    page.evaluate(scrollTo, { selector: '#answer', index: 0 }),
  );
};
const veiledAgain = (violations) => violations.filter((v) => v.kind.startsWith('veiled again'));

test('an <hr> that rendered once is never veiled again', async () => {
  assert.deepEqual(await run([], renderedOnce), []);
});

test("an <hr> that rendered once is veiled again with the first prototype's rendered-once test", async () => {
  assert.ok(veiledAgain(await run([marker.drawn], renderedOnce)).length > 0);
});
