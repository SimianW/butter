// The bookmarks harness: one Chromium with Butter for a markup's run, and for each scenario a fresh
// start from what it declares. Every chatgpt.com request is answered from the fixture (the page,
// /backend-api/me and the conversation's messages, which Butter's own fetch hook reads); any other
// request is aborted and reported as foreign, which fails the run.
//
// A scenario declares its start (all optional):
// - `scene`: the fixture's scene over its defaults (see fixture.mjs);
// - `settings`: Butter's settings over the harness's defaults (on, English, layout consent
//   declined, the first-bookmark notice acknowledged; `bookmarkNotice: undefined` leaves it
//   unacknowledged);
// - `store`: the bookmark rows an earlier session would have left (both stores start empty).
// `start` builds that on a new page (the previous scenario's is closed) and hands the scenario `t`:
// the page, context and worker, `check`, `open(theme)`, the store and settings helpers, the
// fixture's ids and text, and the Butter driver (driver.mjs).
import fs from 'node:fs/promises';
import { headed, launchButter, repo } from '../runner/chromium.mjs';
import { compare, png } from './compare.mjs';
import { driver, xkeys } from './driver.mjs';
import * as fixture from './fixture.mjs';

const { CONV, PAGE_TURNS, TURNS, sha } = fixture;

export async function launchBookmarks({ markup, shots, defer, verbose = !!process.env.VERBOSE }) {
  const LIVE = markup === 'live';
  await fs.mkdir(shots, { recursive: true });
  const fx = fixture.createFixture({ live: LIVE });
  const { page$ } = fx;
  const { context, worker, errors } = await launchButter({
    defer,
    name: 'butter-bookmarks-qa',
    // Grayscale text, as the notice's own compositing layer draws it, for the mockup comparison.
    args: ['--window-position=0,0', '--disable-lcd-text'],
  });
  const foreign = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['file:', 'data:', 'chrome-extension:'].includes(url.protocol)) return route.continue();
    if (url.hostname !== 'chatgpt.com') {
      foreign.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/backend-api/me')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'user-fixture' }) });
    if (url.pathname === `/backend-api/conversation/${CONV}`)
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ messages: fx.messages(page$.first, page$.turns), page_info: { has_previous_page: page$.first > 0 } }),
      });
    if (url.pathname === `/backend-api/conversation/${CONV}/messages`) {
      const before = +url.searchParams.get('before'),
        from = Math.max(0, before - PAGE_TURNS);
      page$.pages++;
      return new Promise((r) => setTimeout(r, page$.pageDelay)).then(() =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ messages: fx.messages(from, before), page_info: { has_previous_page: from > 0 } }),
        }),
      );
    }
    return route.fulfill({ contentType: 'text/html', body: fx.served() });
  });

  const settings = (butter) =>
    worker.evaluate((butter) => chrome.storage.local.set({ butter }), {
      enabled: true,
      lang: 'en',
      layoutConsent: 'declined',
      bookmarkNotice: 'acknowledged',
      ...butter,
    });
  // Count the store's requests by type, in the worker.
  await worker.evaluate(() => {
    globalThis.bookmarkRequests = {};
    chrome.runtime.onMessage.addListener((m) => {
      if (m?.type?.startsWith('butter-bookmark-'))
        bookmarkRequests[m.type] = (bookmarkRequests[m.type] || 0) + 1;
    });
  });
  const requests = () => worker.evaluate(() => ({ ...bookmarkRequests }));
  const stored = () =>
    worker.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const r = indexedDB.open('butter-layouts-v1');
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const q = r.result.transaction('bookmarks').objectStore('bookmarks').getAll();
            q.onsuccess = () => {
              r.result.close();
              resolve(q.result);
            };
          };
        }),
    );
  // Put `rows` straight into the worker's store, as an earlier session would have left them; `clear`
  // empties the store first.
  const seedStore = (rows, { clear = false } = {}) =>
    worker.evaluate(
      async ([rows, clear]) => {
        const db = await database(),
          tx = db.transaction('bookmarks', 'readwrite'),
          st = tx.objectStore('bookmarks');
        if (clear) st.clear();
        for (const r of rows) st.put({ ...r, key: ButterBookmarks.key(r) });
        await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
      },
      [rows, clear],
    );
  // Saved layouts go too, so that no scenario starts from another's.
  const clearLayouts = () =>
    worker.evaluate(async () => {
      const tx = (await database()).transaction('geometry', 'readwrite');
      tx.objectStore('geometry').clear();
      await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
    });
  if (headed) xkeys('Shift');

  let page = null;
  async function start(scenario, check) {
    fx.reset(scenario.scene);
    await settings(scenario.settings ?? {});
    await clearLayouts();
    await seedStore(scenario.store ?? [], { clear: true });
    await worker.evaluate(() => (globalThis.bookmarkRequests = {}));
    // The new page first: a context left with no page may close its window.
    const last = page;
    page = await context.newPage();
    await last?.close();
    const current = page;
    async function open(theme = 'light') {
      page$.theme = theme;
      await current.goto(`https://chatgpt.com/c/${CONV}`);
      await current.waitForSelector('chatgpt-butter-nav[data-on]', { state: 'attached', timeout: 10000 });
      await current.waitForFunction(
        (n) => document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelectorAll('.tick').length === n,
        page$.turns - page$.first,
      );
      await current.waitForTimeout(400);
    }
    const { createFixture: _, ...ids } = fixture;
    return {
      ...ids,
      ...fx,
      ...driver({ page: current, worker }),
      page: current,
      context,
      worker,
      check,
      shots,
      repo,
      headed,
      LIVE,
      open,
      settings,
      requests,
      stored,
      seedStore,
      sha,
      png,
      compare,
      TURNS,
      // Information worth a line only in a verbose run.
      log: (...a) => verbose && console.log(...a),
    };
  }
  return { start, report: () => ({ errors, foreign }) };
}
