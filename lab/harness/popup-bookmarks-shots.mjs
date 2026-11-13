// The popup's Bookmarks and layouts rows (#108), shot from the real extension: one PNG per panel of
// the approved mockup (mockups/popup-bookmarks.html, panels `after*`), at 360 px in the panel's
// theme, plus the popup's height in English and in Chinese for every panel (Chrome caps a popup at
// 600 px). Storage is seeded for each state through the extension's own worker: 12 bookmarks
// (synthetic fixture rows, no chat text) and 14 chats of saved layouts (synthetic geometry, about
// 3.4 MB); the popup asks the worker for usage and clears as it would for the reader. The active
// tab is faked as a ChatGPT chat, so the master line says "Working in this chat" as in the mockup.
//
// Run: npm ci && node lab/harness/popup-bookmarks-shots.mjs
// OUT=<dir> sets where the PNGs and heights.json go (default notes/runs/2026-11-13-popup-bookmarks).
// Two more states the mockup does not draw are shot too (`extra-*`).
// MOCKUP=<mockups/popup-bookmarks.html> also compares each English panel's boxes (header, master
// card, card, rows, second lines, Clear, pills, note, footer; relative to the popup) with the
// mockup's at zoom 1, and fails on a difference over 1 px.
// Fails when a state is over 600 px or a row's text overflows it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchButter, repo } from './runner/chromium.mjs';

const out = path.resolve(process.env.OUT || path.join(repo, 'notes/runs/2026-11-13-popup-bookmarks'));
await fs.mkdir(out, { recursive: true });
const cleanups = [];
// The boxes compared with the mockup, in document order, relative to `root`. The mockup's `new`
// class (its yellow label) and the built `ask` and `bad` classes are left out of the names.
const geometry = (root) => {
  const base = document.querySelector(root).getBoundingClientRect();
  return [...document.querySelector(root).querySelectorAll('.hd, .master, .card, .row, .row .d, .lk, .btn, .note, .ft')].map((e) => {
    const r = e.getBoundingClientRect();
    const name = [...e.classList].filter((c) => !['new', 'ask', 'bad', 'on'].includes(c)).join('.');
    return [name, ...[r.left - base.left, r.top - base.top, r.width, r.height].map((n) => Math.round(n * 100) / 100)];
  });
};
const defer = (fn) => cleanups.push(fn);

// Each panel: its state over the defaults (light, Butter on, every switch on, layout consent
// granted, both stores holding data), and a step taken in the popup before the shot.
const PANELS = [
  { id: 'after', state: 'Everything on; 12 bookmarks and 14 chats of layouts saved' },
  { id: 'after-empty', state: 'Everything on; nothing saved', bookmarks: 0, layouts: 0 },
  { id: 'after-confirm', state: 'Clear on Bookmarks clicked: the question', step: 'ask-bookmarks' },
  { id: 'after-confirm-layouts', state: 'Clear on layouts clicked: the question', step: 'ask-layouts' },
  { id: 'after-cleared', state: 'Bookmarks just cleared (held at "Cleared")', step: 'clear-bookmarks' },
  { id: 'after-off', state: 'Bookmarks switched off, 12 still saved', butter: { opts: { bookmark: false } } },
  { id: 'after-dark', state: 'As `after`, dark theme', dark: true },
  {
    id: 'after-tallest',
    state: 'Layout consent pending (its note shows), 12 bookmarks saved',
    butter: { layoutConsent: 'pending' },
    layouts: 0,
  },
  // States the mockup does not draw (no box comparison): the spec's paused card and the rail note.
  { id: 'extra-paused', state: 'Butter paused: the whole card greys, Clear and switches still usable', butter: { enabled: false }, extra: true },
  { id: 'extra-needs-rail', state: 'Question rail off, Bookmarks on, nothing saved', butter: { opts: { rail: false } }, bookmarks: 0, extra: true },
];

let failed = false;
const heights = [];
try {
  let mockup = null;
  const { context, worker, errors } = await launchButter({ defer, name: 'butter-popup-shots', viewport: { width: 360, height: 900 } });
  const page = await context.newPage();
  await page.goto(worker.url().replace('/storage/layout-worker.js', '/popup/popup.html'));
  await page.waitForSelector('#sw-bookmarks');
  await page.evaluate(() => document.fonts.ready);
  if (process.env.MOCKUP) {
    const m = await context.newPage();
    await m.setViewportSize({ width: 1600, height: 1000 });
    await m.goto(`file://${path.resolve(process.env.MOCKUP)}`);
    await m.evaluate(() => document.fonts.ready);
    await m.addStyleTag({ content: '.pop { zoom: 1 !important; }' });
    mockup = Object.fromEntries(
      await Promise.all(PANELS.filter((x) => !x.extra).map(async ({ id }) => [id, await m.evaluate(geometry, `#${id} .pop`)])),
    );
    await m.close();
  }
  // The popup's active tab is a ChatGPT chat that answers the status probe.
  await page.evaluate(() => {
    chrome.tabs.query = async () => [{ id: 1 }];
    chrome.tabs.sendMessage = async () => ({ states: {} });
  });

  // Synthetic store contents: 12 bookmarks over two fixture accounts, and `chats` saved layouts
  // (valid geometry rows) sized so the popup reads "about 3.4 MB" for 14.
  const seed = (bookmarks, chats) =>
    worker.evaluate(
      async ([bookmarks, chats]) => {
        const h = (c, i = 0) => (c + i.toString(16)).padEnd(64, c).slice(0, 64);
        const db = await database();
        const tx = db.transaction(['bookmarks', 'geometry'], 'readwrite');
        const marks = tx.objectStore('bookmarks'),
          geometry = tx.objectStore('geometry');
        marks.clear();
        geometry.clear();
        for (let i = 0; i < bookmarks; i++) {
          const b = ButterBookmarks.clean({
            account: h(i < 8 ? 'a' : 'b'),
            conv: h('c', i % 3),
            msg: h('d', i),
            turn: i,
            para: 1,
            start: 0,
            end: 48,
            excerpt: `Fixture paragraph ${i + 1}, a synthetic bookmark.`,
            time: Date.now(),
          });
          marks.put({ ...b, key: ButterBookmarks.key(b) });
        }
        const now = Date.now(),
          perChat = 3_400_000 / 14;
        // Two turns per chat: a row holds at most 20,000 blocks of at most 10,000,000.
        for (let i = 0; i < chats; i++)
          for (const turn of [0, 1]) {
            const row = (n) => ({
              schema: 4,
              account: h('e'),
              conv: h('f', i),
              turn: h('1', turn),
              msg: h('2', i * 2 + turn),
              digest: h('3'),
              layout: h('4'),
              time: now,
              metrics: [0, 0, 0, 0, 0, 0, 0],
              blocks: Array.from({ length: n }, (_, k) => 9_000_000 + k + 0.125),
              styles: [],
              items: [],
            });
            const base = ButterLayoutCodec.bytes(ButterLayoutCodec.clean(row(1)));
            const x = ButterLayoutCodec.clean(row(Math.round((perChat / 2 - base) / 12) + 1));
            geometry.put({ ...x, key: ButterLayoutCodec.key(x), used: now, bytes: 0 });
          }
        await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
      },
      [bookmarks, chats],
    );
  const measure = () =>
    page.evaluate(() => ({
      height: Math.ceil(document.body.getBoundingClientRect().height),
      overflow: [...document.querySelectorAll('.row .t')].filter((t) => t.scrollWidth > t.clientWidth).map((t) => t.textContent),
      bookmarks: document.querySelector('[data-switch="bookmarks"]')?.closest('.row')?.querySelector('.d')?.textContent ?? document.querySelector('.row.ask .n')?.textContent,
    }));

  for (const panel of PANELS) {
    const row = { id: panel.id, state: panel.state };
    for (const lang of ['en', 'zh']) {
      await page.emulateMedia({ colorScheme: panel.dark ? 'dark' : 'light', reducedMotion: 'reduce' });
      await seed(panel.bookmarks ?? 12, panel.layouts ?? 14);
      const butter = { enabled: true, lang, layoutConsent: 'granted', ...panel.butter, opts: { layout: true, ...panel.butter?.opts } };
      await page.evaluate(async (butter) => {
        for (const st of Object.values(stores)) {
          clearTimeout(st.timer);
          st.clear = 'idle';
        }
        await chrome.storage.local.set({ butter });
        await new Promise((r) => setTimeout(r, 100));
        await Promise.all(Object.keys(stores).map(refreshUsage));
        await poll();
      }, butter);
      if (panel.step === 'ask-bookmarks') await page.locator('button.lk[data-store="bookmarks"]').click();
      if (panel.step === 'ask-layouts') await page.locator('button.lk[data-store="layouts"]').click();
      if (panel.step === 'clear-bookmarks') {
        await page.locator('button.lk[data-store="bookmarks"]').click();
        await page.locator('[data-store="bookmarks"][data-clear="confirm"]').click();
        await page.waitForFunction(() => stores.bookmarks.clear === 'done');
        // Held at "Cleared" for the shot; the bookmarks-qa popup-clear scenario checks the 2 s.
        await page.evaluate(() => clearTimeout(stores.bookmarks.timer));
      }
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(250);
      const m = await measure();
      row[lang] = m.height;
      row[`${lang}Line`] = m.bookmarks;
      if (m.height > 600 || m.overflow.length) {
        failed = true;
        console.log(`FAIL ${panel.id} (${lang}): ${m.height} px${m.overflow.length ? `, overflowing: ${m.overflow.join(' | ')}` : ''}`);
      }
      if (lang === 'en') await page.locator('#popup').screenshot({ path: path.join(out, `${panel.id}.png`) });
      if (lang === 'en' && mockup?.[panel.id]) {
        const built = await page.evaluate(geometry, '#popup'),
          ref = mockup[panel.id];
        const off = built.length !== ref.length
          ? [`${built.length} boxes, the mockup has ${ref.length}`]
          : built.flatMap((b, i) =>
              b[0] !== ref[i][0] || b.slice(1).some((n, k) => Math.abs(n - ref[i][k + 1]) > 1) ? [`${JSON.stringify(b)} vs ${JSON.stringify(ref[i])}`] : [],
            );
        row.mockup = off.length ? off : 'match';
        if (off.length) {
          failed = true;
          console.log(`FAIL ${panel.id}: boxes differ from the mockup:\n  ${off.join('\n  ')}`);
        }
      }
    }
    heights.push(row);
    console.log(`${panel.id.padEnd(22)} en ${row.en} px, zh ${row.zh} px${row.mockup ? `, mockup boxes: ${row.mockup === 'match' ? 'match' : 'differ'}` : ''}`);
  }
  if (errors.length) {
    failed = true;
    console.log(`FAIL page errors: ${errors.join('; ')}`);
  }
  await fs.writeFile(path.join(out, 'heights.json'), JSON.stringify(heights, null, 2) + '\n');
  console.log(`${failed ? 'FAIL' : 'pass'}: ${PANELS.length} panels; PNGs and heights.json in ${out}`);
} catch (e) {
  failed = true;
  console.log(`FAIL threw: ${e.stack}`);
} finally {
  for (const fn of cleanups.reverse()) await fn();
}
process.exit(failed ? 1 : 0);
