// The popup's Experimental page (#158) in popup-qa.mjs: its states, the mockup panels they match,
// the store contents behind the saved lines, the fresh-install check and the page-swap checks.
import assert from 'node:assert/strict';

// Store states for the case loop: `page` is the page the popup shows; `fresh` stores only what a
// new install has (the rail and Bookmarks off, consent pending); `saved` seeds 12 bookmarks.
const both = (name, config) => [[`${name.replace('LANG', 'en')}`, { lang: 'en', ...config }], [`${name.replace('LANG', 'zh')}`.replace(/^(\d+)/, (n) => String(Number(n) + 20)), { lang: 'zh', ...config }]];
export const experimentalCases = [
  ...both('25-LANG-main-fresh', { fresh: true }),
  ...both('26-LANG-exp-fresh', { fresh: true, page: 'experimental' }),
  ...both('27-LANG-exp-on', { opts: { rail: true, bookmark: true }, saved: true, page: 'experimental' }),
  ...both('28-LANG-main-on', { consent: 'pending', opts: { rail: true, bookmark: true }, saved: true }),
  ...both('29-LANG-exp-needs-rail', { consent: 'pending', opts: { rail: false, bookmark: true }, page: 'experimental' }),
  ...both('30-LANG-exp-paused', { paused: true, opts: { rail: true, bookmark: true }, saved: true, page: 'experimental' }),
  // The Experimental page's tallest states: the privacy note with one fault (its long text) or
  // two (each on one line); pending consent keeps layouts off, so they cannot fault too.
  ...both('31-LANG-exp-fault-pending', { consent: 'pending', opts: { rail: true, bookmark: true }, broken: ['rail'], page: 'experimental' }),
  ...both('32-LANG-exp-faults-pending', { consent: 'pending', opts: { rail: true, bookmark: true }, broken: ['rail', 'bookmarks'], page: 'experimental' }),
  ...both('33-LANG-exp-clear-confirm', { opts: { rail: true, bookmark: true }, saved: true, clear: 'confirm', store: 'bookmarks', page: 'experimental' }),
  ...both('34-LANG-exp-faults-saved', { opts: { rail: true, bookmark: true }, saved: true, broken: ['rail', 'layout'], page: 'experimental' }),
];

// The approved mockup's in-scope panels (#158's experimental-page.html) -> built state.
export const experimentalPanels = {
  'after-main': '25-en-main-fresh-light',
  'after-exp-fresh': '26-en-exp-fresh-light',
  'after-exp-on': '27-en-exp-on-light',
  'after-main-on': '28-en-main-on-light',
  'after-main-dark': '28-en-main-on-dark',
  'after-exp-dark': '26-en-exp-fresh-dark',
  'after-exp-needs-rail': '29-en-exp-needs-rail-light',
};

// Synthetic store contents (test data, never a real record): `bookmarks` bookmarks over two fixture
// accounts, and 14 saved layouts (valid geometry rows) sized so the popup reads "about 3.4 MB", as
// popup-bookmarks-shots.mjs seeds them.
export const seedStores = (worker, bookmarks) =>
  worker.evaluate(async (bookmarks) => {
    const chats = 14, h = (c, i = 0) => (c + i.toString(16)).padEnd(64, c).slice(0, 64);
    const db = await database();
    const tx = db.transaction(['bookmarks', 'geometry'], 'readwrite');
    const marks = tx.objectStore('bookmarks'), geometry = tx.objectStore('geometry');
    marks.clear(); geometry.clear();
    for (let i = 0; i < bookmarks; i++) {
      const b = ButterBookmarks.clean({ account: h(i < 8 ? 'a' : 'b'), conv: h('c', i % 3), msg: h('d', i), turn: i, para: 1, start: 0, end: 48, excerpt: `Fixture paragraph ${i + 1}, a synthetic bookmark.`, time: Date.now() });
      marks.put({ ...b, key: ButterBookmarks.key(b) });
    }
    const now = Date.now(), perChat = 3_400_000 / chats;
    // Two turns per chat: a row holds at most 20,000 blocks of at most 10,000,000.
    for (let i = 0; i < chats; i++) for (const turn of [0, 1]) {
      const row = (n) => ({ schema: 4, account: h('e'), conv: h('f', i), turn: h('1', turn), msg: h('2', i * 2 + turn), digest: h('3'), layout: h('4'), time: now, metrics: [0, 0, 0, 0, 0, 0, 0], blocks: Array.from({ length: n }, (_, k) => 9_000_000 + k + 0.125), styles: [], items: [] });
      const base = ButterLayoutCodec.bytes(ButterLayoutCodec.clean(row(1)));
      const x = ButterLayoutCodec.clean(row(Math.round((perChat / 2 - base) / 12) + 1));
      geometry.put({ ...x, key: ButterLayoutCodec.key(x), used: now, bytes: 0 });
    }
    await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
  }, bookmarks);

// A fresh profile is a real install: the worker writes the settings marker, the rail and Bookmarks
// read off, and a ChatGPT page (a local fixture; every other request is refused) shows no rail and
// no Butter card. Returns what it saw.
export async function checkFreshInstall(browser, worker) {
  const stored = async () => (await worker.evaluate(() => chrome.storage.local.get('butter'))).butter;
  for (let i = 0; i < 50 && !(await stored())?.defaultsVersion; i++) await new Promise((r) => setTimeout(r, 100));
  const butter = await stored();
  assert.ok(butter?.defaultsVersion >= 1, `the install event wrote no marker: ${JSON.stringify(butter)}`);
  const opts = await worker.evaluate((b) => ButterStatus.normalize(b).opts, butter);
  assert.deepEqual([opts.rail, opts.bookmark, opts.layout], [false, false, false], 'a new install starts with the experimental features off');
  const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await tab.route('**/*', (route) => new URL(route.request().url()).hostname === 'chatgpt.com'
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><main><article data-turn-key="t1"><div data-user-message-bubble>[t1] question</div><p>Answer.</p></article></main>' })
    : route.abort());
  await tab.goto('https://chatgpt.com/c/00000000-0000-4000-8000-000000000158');
  // The removed consent card showed 1 s after load; wait past that.
  await tab.waitForTimeout(2500);
  const page = await tab.evaluate(() => ({
    off: document.documentElement.getAttribute('data-butter-off')?.split(' ') ?? [],
    hosts: [...document.querySelectorAll('*')].map((e) => e.localName).filter((t) => t.startsWith('chatgpt-butter-')),
    visible: [...document.querySelectorAll('*')].filter((e) => e.localName.startsWith('chatgpt-butter-') && !e.hidden && e.checkVisibility()).map((e) => e.localName),
  }));
  await tab.close();
  assert.ok(page.off.includes('rail') && page.off.includes('bookmark'), `the rail and Bookmarks are not off on the page: ${page.off}`);
  assert.ok(!page.hosts.some((t) => /consent/.test(t)), `a consent card host is on the page: ${page.hosts}`);
  assert.deepEqual(page.visible, [], 'no Butter card or rail shows on a fresh install');
  return { butter, page };
}

// The page swap, live: the row opens the page and the title goes back, by mouse and keyboard; focus
// lands on the back button and returns to the row; the incoming page slides 10 px and fades for
// 160 ms (none under reduced motion); the page survives polling and a language switch.
export async function checkPages(page) {
  const showing = () => page.evaluate(() => document.querySelector('.page').dataset.page);
  const focused = () => page.evaluate(() => document.activeElement?.className);
  const swap = () => page.evaluate(() => document.querySelector('.page').getAnimations().map((a) => ({ duration: a.effect.getTiming().duration, easing: a.effect.getTiming().easing, from: a.effect.getKeyframes()[0] })));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => go('main'));
  await page.locator('.exp-row').click();
  assert.equal(await showing(), 'experimental');
  assert.equal(await focused(), 'back', 'entering focuses the back button');
  const [entering] = await swap();
  assert.deepEqual([entering?.duration, entering?.easing, entering?.from.opacity, entering?.from.transform], [160, 'ease-out', '0', 'translateX(10px)']);
  assert.equal(await page.locator('.back').getAttribute('aria-label'), 'Back to all features');
  assert.equal(await page.locator('.back .chev').evaluate((e) => getComputedStyle(e).transitionDuration), '0.16s');
  // Polling (once a second) and a language switch keep the page and the focus.
  await page.waitForTimeout(1300);
  assert.equal(await showing(), 'experimental');
  assert.equal(await focused(), 'back', 'polling kept the focus');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  assert.equal(await showing(), 'experimental');
  assert.equal(await page.locator('.back').getAttribute('aria-label'), '返回全部功能');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  // Back by keyboard.
  await page.locator('.back').focus();
  await page.keyboard.press('Enter');
  assert.equal(await showing(), 'main');
  assert.equal(await focused(), 'exp-row', 'going back focuses the Experimental row');
  const [leaving] = await swap();
  assert.equal(leaving?.from.transform, 'translateX(-10px)');
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  // Re-renders play nothing.
  await page.evaluate(() => render());
  assert.deepEqual(await swap(), []);
  // Reduced motion: no swap, and the back chevron's nudge has no transition.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Enter');
  assert.equal(await showing(), 'experimental');
  assert.deepEqual(await swap(), [], 'reduced motion swaps without motion');
  assert.equal(await focused(), 'back');
  assert.equal(await page.locator('.back .chev').evaluate((e) => getComputedStyle(e).transitionDuration), '0s');
  await page.locator('.back').click();
  assert.deepEqual(await swap(), []);
  assert.equal(await focused(), 'exp-row');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
