// The first-use notice (#56), in the style of layout-consent.test.js: the real consent/card.js and
// bookmarks/notice.js in a vm with a fake page, the real worker store behind chrome.runtime.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const status = require('../extension/shared/status.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
const read = (file) => fs.readFileSync(require.resolve('../extension/' + file), 'utf8');
const tick = () => new Promise(setImmediate);
const settle = async () => {
  for (let i = 0; i < 20; i++) await tick();
};

const h = (c) => c.repeat(64);
const mark = (o = {}) => ({
  account: h('a'),
  conv: h('c'),
  msg: h('1'),
  turn: 0,
  para: 2,
  start: 0,
  end: 40,
  excerpt: 'Postgres skips an index when it expects',
  time: 1000,
  ...o,
});

function sharedStorage(initial) {
  let butter = initial;
  const listeners = [];
  return {
    storage: {
      local: {
        get: async () => ({ butter }),
        set: async (value) => {
          butter = value.butter;
          listeners.forEach((fn) => fn({ butter: { newValue: butter } }, 'local'));
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    value: () => butter,
  };
}

// One ChatGPT tab: the notice's host, its card and its click handler, over the shared settings
// and the worker store.
function noticeTab(shared, store) {
  const timers = [];
  let host, clicked;
  const card = { setAttribute() {} };
  const shadow = {
    append() {},
    querySelector: () => card,
    addEventListener: (type, fn) => (clicked = fn),
  };
  const ctx = {
    ButterStatus: status,
    FontFace: class {
      load() {
        return Promise.resolve();
      }
    },
    innerHeight: 900,
    chrome: {
      storage: shared.storage,
      runtime: {
        getURL: (p) => 'chrome-extension://test/' + p,
        sendMessage: (m) => store.message(m),
      },
    },
    document: {
      readyState: 'complete',
      fonts: { add() {} },
      documentElement: { classList: { contains: () => false }, append() {} },
      querySelectorAll: () => [],
      createElement: (type) => {
        if (type === 'chatgpt-butter-bookmark-notice')
          return (host = {
            hidden: true,
            attachShadow: () => shadow,
            toggleAttribute() {},
            removeAttribute() {},
            setAttribute() {},
            style: { setProperty() {} },
            getBoundingClientRect: () => ({ left: 1110, right: 1410, height: 160 }),
          });
        return { append() {}, setAttribute() {} };
      },
    },
    getComputedStyle: () => ({ colorScheme: 'light' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class {
      observe() {}
    },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.fn = () => {};
    },
    requestAnimationFrame: (fn) => fn(),
    addEventListener() {},
  };
  vm.createContext(ctx);
  vm.runInContext(read('consent/card.js'), ctx);
  vm.runInContext(read('bookmarks/client.js'), ctx);
  vm.runInContext(read('bookmarks/notice.js'), ctx);
  const undone = [];
  return {
    host: () => host,
    card,
    shown: () => !!host && host.hidden === false && host.inert === false,
    undone,
    // What bookmarks/content.js does after the store answers a create.
    save: async (bookmark) => {
      const r = await store.message({ type: 'butter-bookmark-create', bookmark });
      if (r.created) ctx.ButterBookmarkNotice.saved(r.bookmark, () => undone.push(r.bookmark.key));
      await settle();
      return r.bookmark;
    },
    elapse: (ms) =>
      timers
        .filter((t) => t.ms === ms)
        .splice(0)
        .forEach((t) => {
          const fn = t.fn;
          t.fn = () => {};
          fn();
        }),
    click: async (choice, trusted = true) => {
      clicked({
        isTrusted: trusted,
        target: { closest: () => ({ dataset: { notice: choice } }) },
      });
      await settle();
    },
  };
}
const stored = async (store) =>
  (await store.message({ type: 'butter-bookmark-list', account: h('a'), conv: h('c') })).bookmarks
    .length;

test('the first saved bookmark shows the notice, in English and in Chinese', async () => {
  for (const [lang, title, body, link, undo, ok, policy] of [
    [
      'en',
      'Bookmark saved',
      'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove a bookmark with the × on its card in the rail.',
      'Privacy policy',
      'Undo',
      'Got it',
      'PRIVACY.md',
    ],
    [
      'zh',
      '书签已保存',
      'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 即可删除。',
      '隐私政策',
      '撤销',
      '知道了',
      'PRIVACY.zh-CN.md',
    ],
  ]) {
    const shared = sharedStorage({ lang }),
      store = workerFixture();
    const tab = noticeTab(shared, store);
    await settle();
    assert.equal(tab.shown(), false, 'nothing before a save');
    await tab.save(mark());
    assert.equal(tab.shown(), true);
    for (const text of [title, body, link, undo, ok, policy])
      assert.ok(tab.card.innerHTML.includes(text), text);
    assert.match(
      tab.card.innerHTML,
      /data-notice="undo"[^>]*>[^<]+<\/button><button[^>]*class="yes"[^>]*data-notice="ok"/,
    );
  }
});

test('Undo deletes the bookmark just saved and the next save shows the notice again', async () => {
  const shared = sharedStorage({ lang: 'en' }),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  const first = await tab.save(mark());
  await tab.click('undo', false);
  assert.equal(await stored(store), 1, 'page-script clicks are ignored');
  await tab.click('undo');
  assert.equal(await stored(store), 0);
  assert.deepEqual(tab.undone, [first.key], 'the page is told, so the segment goes');
  assert.equal(tab.host().inert, true);
  tab.elapse(160);
  assert.equal(tab.host().hidden, true);
  assert.equal(shared.value().bookmarkNotice, undefined, 'still unacknowledged');
  await tab.save(mark({ para: 3 }));
  assert.equal(tab.shown(), true);
});

test('Undo after a second save deletes only the latest bookmark', async () => {
  const shared = sharedStorage({}),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  const second = await tab.save(mark({ para: 5 }));
  await tab.click('undo');
  const left = (
    await store.message({ type: 'butter-bookmark-list', account: h('a'), conv: h('c') })
  ).bookmarks;
  assert.deepEqual(
    left.map((b) => b.para),
    [2],
  );
  assert.deepEqual(tab.undone, [second.key]);
});

test('Got it is kept in settings: no notice again in this tab, another tab or after a reload', async () => {
  const shared = sharedStorage({ lang: 'en', opts: { rail: true } }),
    store = workerFixture();
  const a = noticeTab(shared, store),
    b = noticeTab(shared, store);
  await settle();
  await a.save(mark());
  await b.save(mark({ conv: h('d') }));
  assert.equal(b.shown(), true);
  await a.click('ok');
  assert.equal(shared.value().bookmarkNotice, 'acknowledged');
  assert.equal(shared.value().lang, 'en', 'other settings are kept');
  assert.equal(shared.value().opts.rail, true);
  assert.equal(await stored(store), 1, 'Got it keeps the bookmark');
  assert.equal(a.host().inert, true);
  assert.equal(b.host().inert, true, 'every open tab puts its notice away');
  await a.save(mark({ para: 4 }));
  assert.equal(a.shown(), false);
  const reload = noticeTab(shared, store);
  await settle();
  await reload.save(mark({ para: 6 }));
  assert.equal(reload.shown(), false);
});

test('a save that finds the same bookmark already stored shows no notice', async () => {
  const shared = sharedStorage({}),
    store = workerFixture();
  await store.message({ type: 'butter-bookmark-create', bookmark: mark() });
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  assert.equal(tab.shown(), false);
});

for (const [name, butter] of [
  ['consent pending', { layoutConsent: 'pending' }],
  ['consent declined', { layoutConsent: 'declined', opts: { layout: false } }],
  ['consent granted', { layoutConsent: 'granted', opts: { layout: true } }],
  ['layouts switched off', { layoutConsent: 'granted', opts: { layout: false } }],
])
  test(`the notice works with ${name}`, async () => {
    const shared = sharedStorage(butter),
      store = workerFixture({ initialSettings: butter });
    const tab = noticeTab(shared, store);
    await settle();
    await tab.save(mark());
    assert.equal(tab.shown(), true);
    await tab.click('undo');
    assert.equal(await stored(store), 0);
    await tab.save(mark());
    await tab.click('ok');
    assert.equal(shared.value().bookmarkNotice, 'acknowledged');
    assert.equal(shared.value().layoutConsent, butter.layoutConsent, 'consent is untouched');
    assert.deepEqual(
      status.normalize(shared.value()).opts.layout,
      status.normalize(butter).opts.layout,
    );
  });

test('pausing Butter puts a shown notice away without acknowledging it', async () => {
  const shared = sharedStorage({}),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  await shared.storage.local.set({ butter: { enabled: false } });
  assert.equal(tab.host().inert, true);
  assert.equal(shared.value().bookmarkNotice, undefined);
});
