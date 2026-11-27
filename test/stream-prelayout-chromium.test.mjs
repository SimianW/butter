// Pre-layout in headless Chromium (seam 1b), with Butter's real stream/containment.css and
// stream/offscreen.js over the synthetic chat of test/helpers/veil-page.mjs: a long answer of
// math-like blocks streams below the fold, the flush holds them, the answer completes, and the
// marker lays the held blocks out in idle time. Its page web font is still loading during the first
// pass and arrives after it, as KaTeX's fonts do live (notes/runs/2026-11-24-veil-acceptance/
// stage-D3/summary.md). The tests check that the held blocks stay skipped, held and veiled with the
// page's height and view unchanged, that no idle callback is long, and that a later scrollbar jump
// and window.find lay out far fewer objects than without pre-layout, or than with pre-layout but no
// pass after the font. They count layout objects (Layout trace events' dirty objects), not time,
// so they do not depend on the machine; only the idle callbacks' length is time.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openChat, scrollTo, stream, frames } from './helpers/veil-page.mjs';
import { variant, marker } from './helpers/veil-variants.mjs';

const extension = fileURLToPath(new URL('../extension/', import.meta.url));
const fontFile = readFileSync(
  new URL('../extension/popup/fonts/nunito-latin.woff2', import.meta.url),
);
const BLOCKS = 300;

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, window, performance, requestAnimationFrame, getComputedStyle -- in the page */

// In the page: counts idle callbacks requested and not yet run, and how long each one ran.
function idleProbe() {
  const probe = (window.idleProbe = { outstanding: 0, took: [] });
  const request = window.requestIdleCallback.bind(window);
  window.requestIdleCallback = (fn, opts) => {
    probe.outstanding++;
    return request((deadline) => {
      probe.outstanding--;
      const start = performance.now();
      try {
        fn(deadline);
      } finally {
        probe.took.push(performance.now() - start);
      }
    }, opts);
  };
  const cancel = window.cancelIdleCallback.bind(window);
  window.cancelIdleCallback = (id) => (probe.outstanding--, cancel(id));
}

// In the page: resolves once no idle callback has been outstanding for `ms` (polled every 50 ms).
async function quiet(ms) {
  const wait = (t) => new Promise((resolve) => setTimeout(resolve, t));
  let since = performance.now();
  while (performance.now() - since < ms) {
    await wait(50);
    if (window.idleProbe.outstanding) since = performance.now();
  }
}

// In the page: the held blocks and what the user and ChatGPT's walk can see of them.
function heldState() {
  const sc = document.querySelector('.thread-scroll-container');
  const held = [...document.querySelectorAll('#answer p[data-butter-unrendered]')];
  return {
    held: held.length,
    veiled: document.querySelectorAll('#answer [data-butter-veil]').length,
    seen: document.querySelectorAll('#answer p[data-butter-seen]').length,
    rendered: held.filter((p) =>
      p.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
    ).length,
    opacity0: held.filter((p) => getComputedStyle(p).opacity === '0').length,
    scrollHeight: sc.scrollHeight,
    scrollTop: sc.scrollTop,
  };
}

// A chat built from `sources` whose page font is held back: its answer streams BLOCKS math blocks
// below the fold, the flush holds them, the answer completes and the page goes idle (pre-layout's
// first pass, if any, is over). Returns the page, `before` (the held blocks at completion) and
// `font()`, which lets the font arrive and waits for what follows.
async function completed(sources, { sampler = false } = {}) {
  const page = await openChat(
    browser,
    extension,
    { turns: 1, blocks: 20, renderer: 'classic', sampler },
    sources,
  );
  const waiting = [];
  let released = false;
  await page.route('**/math.woff2', (route) =>
    released ? route.fulfill({ body: fontFile, contentType: 'font/woff2' }) : waiting.push(route),
  );
  await page.addStyleTag({
    content: `@font-face { font-family: PageMath; src: url(/math.woff2) format('woff2') }
      .katex { font-family: PageMath, serif }`,
  });
  await page.evaluate(idleProbe);
  await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
  await page.evaluate(stream, { n: BLOCKS, perFrame: 6, math: 6 });
  await page.waitForTimeout(1300); // the flush holds the blocks below the fold
  await page.evaluate(() =>
    document
      .querySelector('[data-talvt-turn-state="in_progress"]')
      .setAttribute('data-talvt-turn-state', 'complete'),
  );
  await page.evaluate(frames, 2);
  const before = await page.evaluate(heldState);
  assert.ok(before.held > 200, `few held blocks (${before.held})`);
  await page.evaluate(quiet, 1500); // the start delay, then the first pass
  const font = async () => {
    released = true;
    for (const r of waiting.splice(0))
      await r.fulfill({ body: fontFile, contentType: 'font/woff2' });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.evaluate(frames, 3);
    await page.evaluate(quiet, 500);
  };
  assert.equal(waiting.length, 1, 'the font is still loading');
  return { page, before, font };
}

// Layout objects laid out (dirty objects of Layout events on the page's main thread) while `act`
// runs in the page.
async function laidOut(page, act, arg) {
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  await page.evaluate(() => console.timeStamp('measure'));
  await page.evaluate(act, arg);
  const events = JSON.parse(await browser.stopTracing()).traceEvents;
  const mark = events.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'measure');
  return events
    .filter((e) => e.name === 'Layout' && e.ph === 'X' && e.tid === mark.tid && e.ts > mark.ts)
    .reduce((sum, e) => sum + (e.args?.beginData?.dirtyObjects ?? 0), 0);
}

// After the font: objects laid out by a scrollbar jump into the middle of the held blocks (over the
// next 10 frames), then by a window.find of a held block's word further down; and the idle
// callbacks that ran.
async function jumpAndFind(sources) {
  const { page, font } = await completed(sources);
  try {
    await font();
    const jump = await laidOut(page, async () => {
      const sc = document.querySelector('.thread-scroll-container');
      const p = document.querySelectorAll('#answer p')[150];
      sc.scrollTop += p.getBoundingClientRect().top - sc.getBoundingClientRect().top - 300;
      await new Promise((resolve) => {
        let i = 0;
        const tick = () => (++i >= 10 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      });
    });
    const find = await laidOut(page, (word) => window.find(word), `zq${BLOCKS - 10}zq`);
    const found = await page.evaluate(() => String(window.getSelection()));
    assert.equal(found, `zq${BLOCKS - 10}zq`, 'the find selected the word');
    const took = await page.evaluate(() => window.idleProbe.took);
    return { jump, find, took };
  } finally {
    await page.close();
  }
}

test('held blocks stay skipped, held and veiled through pre-layout and its font pass, and the page does not move', async () => {
  const { page, before, font } = await completed(variant(extension), { sampler: true });
  try {
    const firstPass = await page.evaluate(() => window.idleProbe.took.length);
    assert.ok(firstPass > 1, `the first pass ran in ${firstPass} idle callbacks`);
    await font();
    const fontPass = await page.evaluate(() => window.idleProbe.took.length);
    assert.ok(fontPass > firstPass, 'the font pass ran');
    await page.evaluate(frames, 12);
    assert.deepEqual(await page.evaluate(heldState), {
      ...before,
      rendered: 0,
      opacity0: before.held,
    });
    assert.deepEqual(await page.evaluate(() => window.violations), []);
  } finally {
    await page.close();
  }
});

test('after pre-layout, a jump into the held blocks and a find in them lay out far fewer objects', async () => {
  const none = await jumpAndFind(variant(extension, [marker.prelayout]));
  const noFontPass = await jumpAndFind(variant(extension, [marker.prelayoutFonts]));
  const real = await jumpAndFind(variant(extension));
  const longest = Math.max(...real.took);
  console.log(
    `objects laid out by the jump / the find: no pre-layout ${none.jump} / ${none.find}, ` +
      `no font pass ${noFontPass.jump} / ${noFontPass.find}, pre-layout ${real.jump} / ${real.find}; ` +
      `${real.took.length} idle callbacks, longest ${longest.toFixed(1)} ms`,
  );
  assert.equal(none.took.length, 0, 'the variant without pre-layout ran no idle callback');
  assert.ok(none.find > 10000, `the find laid out only ${none.find} objects without pre-layout`);
  assert.ok(real.find * 20 < none.find, `find: ${real.find} vs ${none.find} without pre-layout`);
  assert.ok(real.jump * 4 < none.jump, `jump: ${real.jump} vs ${none.jump} without pre-layout`);
  assert.ok(
    real.find * 20 < noFontPass.find,
    `find: ${real.find} vs ${noFontPass.find} without the font pass`,
  );
  assert.ok(real.took.length > 10, `pre-layout ran in ${real.took.length} idle callbacks`);
  assert.ok(longest < 50, `an idle callback took ${longest} ms`);
});

// In the page: from now until window.busy is false, every frame's main-thread work outlasts the
// frame (a requestAnimationFrame callback that busy-waits `ms`). Chromium then grants no idle
// period at all, as on the live lab after completion, where a frame sampler and slow (software)
// frames left pre-layout without one idle callback for 15 s
// (notes/runs/2026-11-24-veil-acceptance/round2/prelayout-live/report.md).
function busyFrames(ms) {
  window.busy = true;
  const frame = () => {
    if (!window.busy) return;
    const start = performance.now();
    while (performance.now() - start < ms);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// The answer completes on a page that draws a long frame every frame; 4 s later, still busy, a
// window.find of a held block's word near the end. Returns the objects that find laid out and how
// long each pre-layout callback took. The page font is served at once (no font pass needed).
async function busyFind(sources) {
  const page = await openChat(
    browser,
    extension,
    { turns: 1, blocks: 20, renderer: 'classic', sampler: false },
    sources,
  );
  try {
    await page.route('**/math.woff2', (route) =>
      route.fulfill({ body: fontFile, contentType: 'font/woff2' }),
    );
    await page.addStyleTag({
      content: `@font-face { font-family: PageMath; src: url(/math.woff2) format('woff2') }
        .katex { font-family: PageMath, serif }`,
    });
    await page.evaluate(idleProbe);
    await page.evaluate(scrollTo, { selector: '#answer', index: 0 });
    await page.evaluate(stream, { n: BLOCKS, perFrame: 6, math: 6 });
    await page.waitForTimeout(1300); // the flush holds the blocks below the fold
    const held = await page.evaluate(() => {
      document
        .querySelector('[data-talvt-turn-state="in_progress"]')
        .setAttribute('data-talvt-turn-state', 'complete');
      return document.querySelectorAll('#answer p[data-butter-unrendered]').length;
    });
    assert.ok(held > 200, `few held blocks (${held})`);
    await page.evaluate(busyFrames, 20);
    await page.waitForTimeout(4000);
    const word = `zq${BLOCKS - 10}zq`;
    const find = await laidOut(page, (w) => ((window.busy = false), window.find(w)), word);
    assert.equal(await page.evaluate(() => String(window.getSelection())), word);
    return { find, took: await page.evaluate(() => window.idleProbe.took) };
  } finally {
    await page.close();
  }
}

test('on a page that is never idle, pre-layout still lays the held blocks out in short tasks', async () => {
  const none = await busyFind(variant(extension, [marker.prelayout]));
  const real = await busyFind(variant(extension));
  const longest = Math.max(0, ...real.took);
  console.log(
    `busy page: objects laid out by the find: no pre-layout ${none.find}, pre-layout ${real.find}; ` +
      `${real.took.length} pre-layout callbacks, longest ${longest.toFixed(1)} ms`,
  );
  assert.ok(none.find > 10000, `the find laid out only ${none.find} objects without pre-layout`);
  assert.ok(real.find * 20 < none.find, `find: ${real.find} vs ${none.find} without pre-layout`);
  assert.ok(longest < 50, `a pre-layout callback took ${longest} ms`);
});
