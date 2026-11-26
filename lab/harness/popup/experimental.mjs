// The popup's Experimental page (#158) in popup-qa.mjs: its states, the mockup panels they match,
// the store contents behind the saved lines, the fresh-install check and the page-swap checks.
import assert from 'node:assert/strict';

// Store states for the case loop: `page` is the page the popup shows; `fresh` stores only what a
// new install has (the rail and Bookmarks on, Smoother scrolling off, consent pending); `saved`
// seeds 12 bookmarks. Other states have Smoother scrolling on unless their `opts` say otherwise.
const both = (name, config) => [[`${name.replace('LANG', 'en')}`, { lang: 'en', ...config }], [`${name.replace('LANG', 'zh')}`.replace(/^(\d+)/, (n) => String(Number(n) + 20)), { lang: 'zh', ...config }]];
// An updating user right after the update: layouts on and saved, Smoother scrolling switched off.
const updated = { opts: { older: false, seek: false }, saved: true };
export const experimentalCases = [
  ...both('25-LANG-main-fresh', { fresh: true }),
  ...both('26-LANG-exp-fresh', { fresh: true, page: 'experimental' }),
  ...both('27-LANG-exp-on', { saved: true, page: 'experimental' }),
  ...both('28-LANG-main-on', updated),
  ...both('29-LANG-main-needs-rail', { consent: 'pending', opts: { rail: false, older: false, seek: false } }),
  ...both('30-LANG-exp-paused', { paused: true, saved: true, page: 'experimental' }),
  // The Experimental page's tallest state: the privacy note with Smoother scrolling's fault (its
  // long text); pending consent keeps layouts off, so they cannot fault too.
  ...both('31-LANG-exp-fault-pending', { consent: 'pending', broken: ['scrolling'], page: 'experimental' }),
  // Layouts on with Smoother scrolling off: "Needs Smoother scrolling", no count and no Clear.
  ...both('32-LANG-exp-needs-scrolling', { ...updated, page: 'experimental' }),
  ...both('33-LANG-exp-clear-confirm', { saved: true, clear: 'confirm', page: 'experimental' }),
  ...both('34-LANG-exp-faults-saved', { saved: true, broken: ['scrolling', 'layout'], page: 'experimental' }),
  // The store build's tallest state: one fault on a main-page storage row (its two-line text).
  ...both('35-LANG-main-one-fault', { ...updated, broken: ['bookmarks'] }),
  // A remembered layouts fault with Smoother scrolling off: the row says what it needs, not the fault.
  ...both('36-LANG-exp-needs-fault', { ...updated, broken: ['layout'], page: 'experimental' }),
];

// The approved mockup's panels (popup-rail-bookmarks-main.html, each a section.panel[id] whose
// after figure is a screenshot) -> built state.
export const experimentalPanels = {
  'main-new-install': '25-en-main-fresh-light',
  'main-in-use': '28-en-main-on-light',
  'main-rail-off': '29-en-main-needs-rail-light',
  'experimental-off': '26-en-exp-fresh-light',
  'experimental-after-update': '32-en-exp-needs-scrolling-light',
  'experimental-after-update-zh': '52-zh-exp-needs-scrolling-light',
  'experimental-on': '27-en-exp-on-light',
  'main-in-use-dark': '28-en-main-on-dark',
};

// The popup's one height (#158), popup.css's --popup-height: the normal main page (463 px) plus the
// dev build's 46 px card. Every store state is exactly this tall and nothing in it overflows, so the
// footer never moves.
export const POPUP_HEIGHT = 509;
// Asserts the shown state's height and that its content fits; returns the height.
export async function checkFixedHeight(page, state) {
  const m = await page.evaluate(() => ({
    height: document.getElementById('popup').offsetHeight,
    footer: document.querySelector('.ft').getBoundingClientRect().bottom,
    // The body's scrollable overflow: the viewport is taller than the popup, so the root's
    // scrollHeight would read the viewport.
    scroll: document.body.scrollHeight,
  }));
  assert.equal(m.height, POPUP_HEIGHT, `${state} is ${m.height}px, not the fixed ${POPUP_HEIGHT}px`);
  assert.ok(m.footer <= POPUP_HEIGHT && m.scroll <= POPUP_HEIGHT, `${state} overflows ${POPUP_HEIGHT}px: footer bottom ${m.footer}, scrollHeight ${m.scroll}`);
  return m.height;
}

// The footer stays put: its top is at the same y on the main page, mid-swap each way, on the
// Experimental page with the privacy note, and after the layouts switch hides the note. Leaves the
// popup on the main page with layouts on. Returns the footer's top.
export async function checkFooterStill(page) {
  const top = () => page.evaluate(() => document.querySelector('.ft').getBoundingClientRect().top);
  const settle = () => page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  // Half-way through the swap the incoming page is moving and half faded; the footer is not.
  const midSwap = async (target) => {
    await page.locator(target).click();
    const mid = await page.evaluate(() => {
      const p = document.querySelector('.page'), [a] = p.getAnimations();
      a?.pause(); if (a) a.currentTime = 80;
      return { playing: !!a, transform: getComputedStyle(p).transform, opacity: Number(getComputedStyle(p).opacity), top: document.querySelector('.ft').getBoundingClientRect().top };
    });
    assert.ok(mid.playing && mid.transform !== 'none' && mid.opacity > 0 && mid.opacity < 1, `the swap is not mid-way: ${JSON.stringify(mid)}`);
    await settle();
    return mid.top;
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    await chrome.storage.local.set({ butter: ButterStatus.normalize({ layoutConsent: 'pending', lang: 'en', opts: { rail: true, bookmark: true, layout: false } }) });
    go('main');
  });
  await page.waitForFunction(() => prefs.layoutConsent === 'pending');
  await settle();
  const main = await top();
  const entering = await midSwap('.exp-row');
  assert.equal(await page.locator('.note').count(), 1, 'the privacy note shows');
  const withNote = await top();
  await page.locator('[data-switch="layout"]').click();
  await page.waitForFunction(() => !document.querySelector('.note'));
  const withoutNote = await top();
  const leaving = await midSwap('.back');
  const tops = { main, entering, withNote, withoutNote, leaving, back: await top() };
  assert.equal(new Set(Object.values(tops)).size, 1, `the footer moved: ${JSON.stringify(tops)}`);
  return main;
}

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

// A fresh profile is a real install: the worker writes the settings marker (defaults version 2),
// the rail and Bookmarks read on, Smoother scrolling and layouts off, and a ChatGPT page (a local
// fixture; every other request is refused) has them off and shows no consent card. Returns what it
// saw.
export async function checkFreshInstall(browser, worker) {
  const stored = async () => (await worker.evaluate(() => chrome.storage.local.get('butter'))).butter;
  for (let i = 0; i < 50 && !(await stored())?.defaultsVersion; i++) await new Promise((r) => setTimeout(r, 100));
  const butter = await stored();
  assert.equal(butter?.defaultsVersion, 2, `the install event wrote no version 2 marker: ${JSON.stringify(butter)}`);
  const opts = await worker.evaluate((b) => ButterStatus.normalize(b).opts, butter);
  assert.deepEqual([opts.rail, opts.bookmark, opts.older, opts.seek, opts.layout], [true, true, false, false, false], 'a new install: the rail and Bookmarks on, Smoother scrolling and layouts off');
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
  }));
  await tab.close();
  assert.deepEqual(['older', 'seek', 'layout'].filter((k) => !page.off.includes(k)), [], `Smoother scrolling and layouts are not off on the page: ${page.off}`);
  assert.deepEqual(['rail', 'bookmark'].filter((k) => page.off.includes(k)), [], `the rail or Bookmarks are off on the page: ${page.off}`);
  assert.ok(!page.hosts.some((t) => /consent/.test(t)), `a consent card host is on the page: ${page.hosts}`);
  return { butter, page };
}

// The Experimental page's card in a case state: layouts on with Smoother scrolling off say what
// they need, in place of the saved line, with no Clear (while it asks, the question replaces the row).
export async function checkExperimentalCard(page, config, state) {
  assert.equal(await page.locator('.card.exp').count(), 1);
  const needs = await page.evaluate(() => prefs.opts.layout && !prefs.opts.seek);
  const line = await page.locator('.row:has([data-switch="layout"]) .d').evaluateAll((list) => list.map((e) => ({ text: e.textContent, clear: !!e.querySelector('.lk'), status: e.querySelector('[role="status"]')?.textContent }))[0] ?? { text: '' });
  const hint = config.lang === 'en' ? 'Needs Smoother scrolling' : '需要先打开长对话滚动更顺';
  if (needs) assert.deepEqual(line, { text: hint, clear: false, status: hint }, state);
  if (needs) assert.equal(await page.locator('.row.bad:has([data-switch="layout"])').count(), 0, `${state}: a row that needs a switch is not broken`);
  else assert.ok(!/Needs Smoother|长对话滚动更顺/.test(line.text), `${state}: ${line.text}`);
}

// Live, from the main page with layouts on, Smoother scrolling off and 14 chats of layouts saved:
// the Experimental page's layouts row says what it needs; switching Smoother scrolling on brings
// back the saved line and Clear; Clear and Cancel work there, with focus moving as on the main page;
// switching Smoother scrolling off while Clear asks drops the question for the needs line, and it
// does not come back with the switch.
export async function checkLayoutsLive(page) {
  await page.locator('.exp-row').click();
  const line = () => page.locator('.row:has([data-switch="layout"]) .d').textContent();
  assert.equal(await line(), 'Needs Smoother scrolling');
  assert.equal(await page.locator('[data-store="layouts"]').count(), 0);
  await page.locator('[data-switch="scrolling"]').click();
  await page.waitForFunction(() => /14 chats, about 3\.4 MB/.test(document.querySelector('.row:has([data-switch="layout"]) .d').textContent));
  await page.locator('[data-store="layouts"][data-clear="ask"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.clear), 'confirm');
  await page.locator('[data-store="layouts"][data-clear="cancel"]').click();
  assert.equal(await page.locator('[data-store="layouts"][data-clear="ask"]').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.clear), 'ask');
  await page.locator('[data-store="layouts"][data-clear="ask"]').click();
  await page.locator('[data-switch="scrolling"]').click();
  await page.waitForFunction(() => document.querySelector('.row:has([data-switch="layout"]) .d')?.textContent === 'Needs Smoother scrolling');
  assert.equal(await page.locator('[data-store="layouts"]').count(), 0, 'the question is dropped');
  await page.locator('[data-switch="scrolling"]').click();
  await page.waitForFunction(() => /14 chats, about 3\.4 MB/.test(document.querySelector('.row:has([data-switch="layout"]) .d')?.textContent));
  assert.equal(await page.locator('[data-store="layouts"][data-clear="confirm"]').count(), 0, 'the question does not come back');
}

// A state taller than the popup scrolls inside it (the dev build with one fault: 541 px of content
// in 509): in a viewport the popup's height, the box stays the fixed height, the document scrolls,
// and scrolled to the end the footer shows whole. Returns the content's height.
export async function checkScrollsInside(page, state) {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width, height: POPUP_HEIGHT });
  try {
    const m = await page.evaluate(() => {
      const root = document.scrollingElement, box = document.getElementById('popup');
      root.scrollTop = root.scrollHeight;
      const footer = document.querySelector('.ft').getBoundingClientRect();
      const out = { box: box.offsetHeight, scroll: root.scrollHeight, client: root.clientHeight, scrolled: root.scrollTop, footerBottom: footer.bottom, footerTop: footer.top };
      root.scrollTop = 0;
      return out;
    });
    assert.equal(m.box, POPUP_HEIGHT, `${state}: the popup is ${m.box}px, not the fixed ${POPUP_HEIGHT}px`);
    assert.ok(m.scroll > m.client && m.scrolled > 0, `${state} does not scroll: ${JSON.stringify(m)}`);
    assert.ok(m.footerTop >= 0 && m.footerBottom <= m.client + 0.5, `${state}: scrolled to the end, the footer is not whole: ${JSON.stringify(m)}`);
    return m.scroll;
  } finally {
    await page.setViewportSize(viewport);
  }
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
  // Reduced motion: no swap, and the back chevron neither nudges on hover nor transitions.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Enter');
  assert.equal(await showing(), 'experimental');
  assert.deepEqual(await swap(), [], 'reduced motion swaps without motion');
  assert.equal(await focused(), 'back');
  assert.equal(await page.locator('.back .chev').evaluate((e) => getComputedStyle(e).transitionDuration), '0s');
  await page.locator('.back').hover();
  assert.equal(await page.locator('.back .chev').evaluate((e) => getComputedStyle(e).transform), 'none', 'reduced motion: the back chevron stays put on hover');
  await page.locator('.back').click();
  assert.deepEqual(await swap(), []);
  assert.equal(await focused(), 'exp-row');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
