// The branch harness: one Chromium with Butter for the run, and for each scenario a fresh start from
// what it declares. Every chatgpt.com request is answered with the fixture page (fixture.mjs); any
// other request is aborted and reported as foreign, which fails the run. Headless always, at
// 1280 x 800, with Chrome's pop-up blocker on, so the pop-up-blocked case is the real one.
//
// A scenario declares its start (both optional):
// - `scene`: fixture parameters (a query string, such as 'stream=3000') served to every page the
//   scenario opens, the new tab included; a page's own URL and `ask`'s `fixture` override them.
//   Parameters Butter itself reads from the URL (`temporary-chat`) go in `open`'s query instead.
// - `settings`: Butter's settings over the harness's defaults (on, English, layout consent declined).
// `start` opens a blank page and closes every other one (the previous scenario's tabs, and any it
// left open when it threw), then builds that start: settings, session storage (Ask in branch's jobs
// and the status failures) cleared, and a storage patch a scenario left in the worker undone. It
// hands the scenario `t`: context, worker, `check`, `pass(name)` (a passing check: the scenario
// asserts as it goes, and a failed assert throws), `log` (verbose only), `open`, `ask`, `askCard`,
// `capture`, `settings`, `failures`, the fixture's ids and text, and the Ask in branch driver
// (driver.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshPage, launchButter } from '../runner/chromium.mjs';
import { inShadow, chipOf, select, settle } from './driver.mjs';
import { fixtureHtml, ORIGINAL, BRANCH, QUOTE, LATEST, MATH } from './fixture.mjs';

// `launch` is the Chromium launcher (launchButter); a test may pass a fake one.
export async function launchBranch({ shots, defer, verbose = !!process.env.VERBOSE, launch = launchButter }) {
  await fs.mkdir(shots, { recursive: true });
  const { context, worker, errors } = await launch({
    defer,
    name: 'butter-branch-qa',
    viewport: { width: 1280, height: 800 },
    // Headless even under an X display, as before; keep Chrome's pop-up blocker on.
    options: { headless: true, ignoreDefaultArgs: ['--disable-popup-blocking'] },
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://chatgpt.com' });
  const foreign = [];
  // The scenario's fixture parameters, and the extra ones for pages loaded from now on (the new tab).
  let scene = '',
    extra = '';
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'chatgpt.com') {
      foreign.push(url.href);
      return route.abort();
    }
    for (const [k, v] of new URLSearchParams(scene)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    for (const [k, v] of new URLSearchParams(extra)) url.searchParams.set(k, v);
    return route.fulfill({ contentType: 'text/html', body: fixtureHtml(url) });
  });
  const settings = (value) =>
    worker.evaluate((butter) => chrome.storage.local.set({ butter }), {
      enabled: true,
      lang: 'en',
      layoutConsent: 'declined',
      ...value,
    });
  const failures = async () =>
    (await worker.evaluate(() => chrome.storage.session.get('butterFailures'))).butterFailures || {};
  const files = [];

  async function start(scenario, check) {
    // A blank page, kept open through the scenario as the launch page was before, and every other
    // page closed before anything is reset.
    await freshPage(context);
    scene = scenario.scene ?? '';
    extra = '';
    await worker.evaluate(async () => {
      // handover-failed patches the session area's set; a throw may have left it patched.
      if (globalThis.__set) chrome.storage.session.set = globalThis.__set;
      delete globalThis.__set;
      await chrome.storage.session.clear();
    });
    await settings(scenario.settings ?? {});
    // A new page on the fixture at `route` with `query`, `width` x 800, once the composer shows.
    const open = async (query = '', width = 1280, route = `/c/${ORIGINAL}`) => {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`https://chatgpt.com${route}?${query}`);
      await page.locator('.ProseMirror').waitFor();
      return page;
    };
    // Select the quote, open the box, type, press Enter; resolves with the new tab. `fixture` sets
    // the new tab's extra fixture parameters.
    const ask = async (page, { question = 'What does RAG mean here?', fixture = '', width } = {}) => {
      await select(page);
      await chipOf(page).waitFor();
      await settle(page);
      await chipOf(page).click();
      await inShadow(page, 'textarea').fill(question);
      extra = fixture;
      const next = context.waitForEvent('page');
      await inShadow(page, 'textarea').press('Enter');
      const dest = await next;
      extra = '';
      if (width) await dest.setViewportSize({ width, height: 800 });
      return dest;
    };
    // Ask from the original tab; returns the new tab with Butter's card up.
    const askCard = async (page, question) => {
      const dest = await ask(page, question ? { question } : {});
      await inShadow(dest, '.card').waitFor();
      return dest;
    };
    const capture = async (page, state, width, theme) => {
      const file = `${state}-${width}-${theme}.png`;
      await page.screenshot({ path: path.join(shots, file), animations: 'disabled' });
      files.push(file);
    };
    return {
      ORIGINAL,
      BRANCH,
      QUOTE,
      LATEST,
      MATH,
      context,
      worker,
      check,
      pass: (name) => check(name, true),
      // Information worth a line only in a verbose run.
      log: (...a) => verbose && console.log(...a),
      open,
      ask,
      askCard,
      capture,
      settings,
      failures,
    };
  }
  return { start, report: () => ({ errors, foreign, screenshots: files.length }) };
}
