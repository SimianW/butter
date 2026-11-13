// The bookmarks harness: one Chromium with Butter for a markup's run, and for each scenario a fresh
// start from what it declares. Every chatgpt.com request is answered from the fixture (the page,
// /backend-api/me and the conversation's messages, which Butter's own fetch hook reads); any other
// request is aborted and reported as foreign, which fails the run.
//
// A scenario declares its start (all optional):
// - `scene`: the fixture's scene over its defaults (see fixture.mjs), or a function of `{ live }`
//   that returns it;
// - `settings`: Butter's settings over the harness's defaults (on, English, layout consent
//   declined, the first-bookmark notice acknowledged; `bookmarkNotice: undefined` leaves it
//   unacknowledged);
// - `store`: the bookmark rows an earlier session would have left (both stores start empty).
// `start` opens a new page and closes every other one (the previous scenario's, and any it left
// open), then builds that start, with the Bookmark command's key back on Alt+Shift+M (a scenario
// may clear it in chrome://extensions/shortcuts) and the store's request counts at zero. It hands
// the scenario `t`: the page, context and worker, `check`, `open(theme)`, `popup()` (the popup
// page in its own tab), `serve(changes)` for a
// mid-scenario scene change, `pages()` (earlier-history pages served), the store and settings
// helpers, the fixture's ids and text, and the Butter driver (driver.mjs).
import fs from 'node:fs/promises';
import { freshPage, headed, launchButter, repo } from '../runner/chromium.mjs';
import { compare, png } from './compare.mjs';
import { driver, xkeys } from './driver.mjs';
import * as fixture from './fixture.mjs';

const { CONV, PAGE_TURNS, TURNS, sha } = fixture;

// `launch` is the Chromium launcher (launchButter); a test passes a fake one, with no browser.
export async function launchBookmarks({ markup, shots, defer, verbose = !!process.env.VERBOSE, launch = launchButter }) {
  const LIVE = markup === 'live';
  await fs.mkdir(shots, { recursive: true });
  const fx = fixture.createFixture({ live: LIVE });
  const { page$ } = fx;
  const { context, worker, errors } = await launch({
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
  // The Bookmark command's key, as Chrome assigns it at install from the manifest's suggestion. A
  // scenario that clears it leaves it cleared in the profile; `start` sets it back through the
  // shortcuts page's own API, so that no scenario runs without it because of another.
  const KEY = 'Alt+Shift+M';
  const bookmarkKey = () => worker.evaluate(() => chrome.commands.getAll()).then((cs) => cs.find((c) => c.name === 'bookmark')?.shortcut);
  async function restoreKey() {
    if ((await bookmarkKey()) === KEY) return;
    const shortcuts = await context.newPage();
    await shortcuts.goto('chrome://extensions/shortcuts');
    await shortcuts.evaluate(
      ([extensionId, keybinding]) => chrome.developerPrivate.updateExtensionCommand({ extensionId, commandName: 'bookmark', keybinding }),
      [new URL(worker.url()).host, KEY],
    );
    await shortcuts.close();
    const now = await bookmarkKey();
    if (now !== KEY) throw new Error(`the Bookmark command's key is "${now}", not ${KEY}, after restoring it`);
  }
  if (headed) xkeys('Shift');

  async function start(scenario, check) {
    // Every other page closed before anything is reset: the previous scenario's, mockups and tabs
    // it left open.
    const current = await freshPage(context);
    await restoreKey();
    fx.reset(typeof scenario.scene === 'function' ? scenario.scene({ live: LIVE }) : scenario.scene);
    await settings(scenario.settings ?? {});
    await clearLayouts();
    await seedStore(scenario.store ?? [], { clear: true });
    await worker.evaluate(() => (globalThis.bookmarkRequests = {}));
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
    // The real popup page (popup/popup.html) in a tab of its own, as the toolbar button opens it.
    async function popup() {
      const p = await context.newPage();
      await p.setViewportSize({ width: 360, height: 600 });
      await p.goto(`chrome-extension://${new URL(worker.url()).host}/popup/popup.html`);
      await p.waitForSelector('#sw-bookmarks');
      return p;
    }
    const { createFixture: _, ...ids } = fixture;
    // The scene is the fixture's: a scenario changes it only through `serve`.
    const { page$: _scene, reset: _reset, ...served } = fx;
    return {
      ...ids,
      ...served,
      pages: () => page$.pages,
      ...driver({ page: current, worker, shots }),
      page: current,
      context,
      worker,
      check,
      shots,
      repo,
      headed,
      LIVE,
      open,
      popup,
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
