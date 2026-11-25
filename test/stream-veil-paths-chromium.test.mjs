// The veil's state paths (ticket #175 of spec #170) in headless Chromium (seam 1b), with Butter's
// real stream/containment.css and stream/offscreen.js over the synthetic chat of
// test/helpers/veil-page.mjs: Stop, Regenerate and Edit (blocks replaced, or reused with their marks
// on), a version switch and a hidden chat (the turn leaves the page and comes back), and a Dil
// remount (a block detached and re-attached). The sampler checks every block on every frame, at its
// start and after it is drawn: no rendered block is ever veiled. Each case first checks that blocks
// were veiled when it began, so that it cannot pass without testing anything. The fake-DOM models
// of the same cases are in stream-veil-paths.test.js; the read-through is
// notes/runs/2026-11-24-veil-state-paths/read-through.md.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, stream, frames } from './helpers/veil-page.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const FRAMES_AFTER = 12;

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window -- runs in the page */

// Runs `body(steps)` on a fresh chat whose answer has streamed `n` blocks below the fold, and
// returns the sampler's violations.
async function scenario({ renderer = 'classic', n = 240 } = {}, body) {
  const page = await openChat(browser, `${root}extension/`, {
    turns: 2,
    blocks: 40,
    renderer,
    transition: true,
  });
  try {
    const step = async (name, act, after = FRAMES_AFTER) => {
      await page.evaluate((s) => (window.veilStep = s), name);
      await act();
      await page.evaluate(frames, after);
    };
    const count = (selector) => page.evaluate((s) => document.querySelectorAll(s).length, selector);
    const state = (value, el = '#answer') =>
      page.evaluate(
        ([v, sel]) =>
          (window.parked?.turn ?? document.querySelector(sel))
            .querySelector('[data-talvt-turn-state]')
            .setAttribute('data-talvt-turn-state', v),
        [value, el],
      );
    await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
    await step('stream blocks below the fold', () => page.evaluate(stream, { n, perFrame: 6 }));
    await body({ page, step, count, state });
    const r = await page.evaluate(() => ({
      samples: window.samples,
      violations: window.violations,
    }));
    assert.ok(r.samples > 60, `only ${r.samples} samples`);
    return r.violations;
  } finally {
    await page.close();
  }
}

const veiled = '#answer [data-butter-veil]';
const veiledNotHeld = '#answer [data-butter-veil]:not([data-butter-unrendered])';
const onto = (selector, index = 10) => ({ selector, index, offset: 100 });

test('Stop: the answer leaves in_progress with blocks held, queued and not yet queued', async () => {
  const violations = await scenario({ n: 120 }, async ({ page, step, count, state }) => {
    await step('the flush holds the first blocks', () => page.waitForTimeout(1300));
    await step('more blocks stream, queued for the next flush', () =>
      page.evaluate(stream, { n: 60, perFrame: 6 }),
    );
    // The last blocks arrive in the task that stops the answer: no size reported yet.
    await step('Stop, in the task that inserts the last blocks', async () => {
      await page.evaluate(() => {
        const column = document.querySelector('#answer [data-markdown-text-style]');
        for (let i = 0; i < 6; i++) {
          const p = document.createElement('p');
          p.textContent = `Last ${i}`;
          column.append(p);
        }
      });
      assert.ok((await count('#answer [data-butter-unrendered]')) > 10, 'held blocks');
      assert.ok((await count(veiledNotHeld)) > 10, 'queued blocks, veiled');
      await state('complete');
      await page.evaluate(() => document.body.offsetHeight);
    });
    assert.equal(await count(veiledNotHeld), 0, 'only held blocks stay veiled');
    await step('scrollTop onto the held blocks', () =>
      page.evaluate(scrollTo, onto('#answer [data-butter-unrendered]')),
    );
    await step('scrollTop onto the last blocks', () =>
      page.evaluate(scrollTo, { selector: '#answer p', index: -1 }),
    );
    await step('let the flush run', () => page.waitForTimeout(1300));
  });
  assert.deepEqual(violations, []);
});

test('Regenerate and Edit: the answer is replaced by new blocks', async () => {
  const violations = await scenario({}, async ({ page, step, count, state }) => {
    await step('the flush holds the blocks', () => page.waitForTimeout(1300));
    await step('the answer completes', () => state('complete'));
    assert.ok((await count(veiled)) > 10, 'held blocks are veiled');
    await step('the answer is replaced and streams again', async () => {
      await page.evaluate(() => {
        const column = document.querySelector('#answer [data-markdown-text-style]');
        column.replaceChildren(...[...column.children].slice(0, 2)); // the wide block and table
      });
      await state('in_progress');
      await page.evaluate(stream, { n: 200, perFrame: 6 });
    });
    assert.ok((await count(veiled)) > 10, 'the new answer is veiled below the fold');
    await step('scrollTop onto the new answer while it streams', () =>
      page.evaluate(scrollTo, onto(veiled)),
    );
    await step('the new answer completes', () => state('complete'));
    await step('let the flush run', () => page.waitForTimeout(1300));
    await step('scrollTop through the new answer', () =>
      page.evaluate(scrollTo, onto('#answer p', 150)),
    );
  });
  assert.deepEqual(violations, []);
});

test('Regenerate and Edit: block elements are reused with their old marks on', async () => {
  const violations = await scenario({}, async ({ page, step, count, state }) => {
    await step('the flush holds the blocks', () => page.waitForTimeout(1300));
    await step('the answer completes', () => state('complete'));
    assert.ok((await count(veiled)) > 10, 'held blocks are veiled');
    // React keeps the elements and rewrites their text; Butter's attributes stay on them.
    await step('the turn streams again into the same elements', async () => {
      await page.evaluate(() => {
        for (const p of document.querySelectorAll('#answer p')) p.firstChild.textContent = 'New ';
      });
      await state('in_progress');
    });
    await step('scrollTop onto reused veiled blocks while streaming', () =>
      page.evaluate(scrollTo, onto(veiled, 30)),
    );
    await step('more blocks stream', () => page.evaluate(stream, { n: 60, perFrame: 6 }));
    await step('the new answer completes', () => state('complete'));
    await step('scrollTop onto reused veiled blocks after completion', () =>
      page.evaluate(scrollTo, onto(veiled, 5)),
    );
    await step('let the flush run', () => page.waitForTimeout(1300));
  });
  assert.deepEqual(violations, []);
});

// Out of the page: the turn and the place it goes back to.
const park = () => {
  const turn = document.getElementById('answer');
  window.parked = { turn, parent: turn.parentNode };
  turn.remove();
};
const unpark = () => {
  window.parked.parent.append(window.parked.turn);
  window.parked = null;
};

test('version switch and hidden chat: the turn leaves the page and comes back while streaming', async () => {
  const violations = await scenario({}, async ({ page, step, count }) => {
    await step('the turn leaves the page', () => page.evaluate(park), 3);
    await step('it comes back, the view on its veiled blocks', async () => {
      await page.evaluate(unpark);
      await page.evaluate(scrollTo, onto(veiled, 30));
    });
    assert.ok((await count(veiled)) > 10, 'still veiled below the view');
    await step('let the flush run', () => page.waitForTimeout(1300));
  });
  assert.deepEqual(violations, []);
});

test('version switch and hidden chat: the answer completes while its turn is out of the page', async () => {
  const violations = await scenario({}, async ({ page, step, count, state }) => {
    // Right after the stream: most blocks are still queued for the flush, so not held.
    assert.ok((await count(veiledNotHeld)) > 100, 'veiled blocks that are not held');
    await step('the turn leaves the page', () => page.evaluate(park), 3);
    await step('the answer completes out of the page', () => state('complete'));
    await step('let the flush run while it is away', () => page.waitForTimeout(1300));
    await step('it comes back, the view on its formerly veiled blocks', async () => {
      await page.evaluate(unpark);
      await page.evaluate(scrollTo, onto('#answer p', 100));
    });
    // The flush holds the blocks it still believes skipped, bringing them back under the rules.
    await step('let the flush run', () => page.waitForTimeout(1300));
  });
  assert.deepEqual(violations, []);
});

test('Dil remount: veiled blocks detached and re-attached with their marks on', async () => {
  const violations = await scenario({ renderer: 'dil' }, async ({ page, step, count, state }) => {
    const detach = (selector) =>
      page.evaluate((s) => {
        const el = [...document.querySelectorAll(s)].at(-1);
        (window.remounted ??= []).push(el);
        el.remove();
      }, selector);
    const reattach = () =>
      page.evaluate(() => {
        const sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
        const inView = [...document.querySelectorAll('#answer p')].find(
          (p) => p.getBoundingClientRect().top > sc.top + 100,
        );
        inView.before(window.remounted.shift());
      });
    // Right after the stream most blocks are queued for the flush, veiled and not held.
    assert.ok((await count(veiledNotHeld)) > 10);
    await step(
      'two veiled blocks leave while streaming',
      async () => {
        await detach(veiledNotHeld);
        await detach(veiledNotHeld);
      },
      3,
    );
    await step('one comes back in view while streaming', reattach);
    await step('the answer completes while the other is out', () => state('complete'), 3);
    await step('the other comes back in view after completion', reattach);
    await step('let the flush run', () => page.waitForTimeout(1300));
    assert.ok((await count(veiled)) > 10, 'held blocks are veiled');
    await step('a held block leaves after completion', () => detach(veiled), 3);
    await step('it comes back in view', reattach);
  });
  assert.deepEqual(violations, []);
});
