// The bookmark notification (#77), in the style of layout-consent.test.js: the real consent/card.js,
// bookmark session (it saves, removes and hands over each Undo) and notice.js in a vm, the real store
// client and worker store behind chrome.runtime (test/helpers/notice-fixture.cjs). One card on every
// save and remove, with the bookmark's first words and Undo; the first save ever expands it with the
// privacy text and Got it.
const test = require('node:test');
const assert = require('node:assert/strict');
const status = require('../extension/shared/status.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
const {
  settle,
  CONV,
  EXCERPT,
  sharedStorage,
  noticeTab,
  stored,
  list,
  acknowledged,
} = require('./helpers/notice-fixture.cjs');

// A passage of the answer on the page, as bookmarks/content.js hands it to the session.
const at = { id: 'a1', ask: 'q1', conv: CONV, para: 2, start: 0, end: 40, excerpt: EXCERPT };
const mark = (o = {}) => ({ ...at, ...o });
const PRIVACY = {
  en: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove one with the × on its card in the rail, or clear them all in the Butter popup.',
  zh: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 可删除一个，也可以在 Butter 弹窗里全部清除。',
};

test('the first saved bookmark shows the expanded card, in English and in Chinese', async () => {
  for (const [lang, title, link, undo, ok, policy] of [
    ['en', 'Bookmark saved', 'Privacy policy', 'Undo', 'Got it', 'PRIVACY.md'],
    ['zh', '书签已保存', '隐私政策', '撤销', '知道了', 'PRIVACY.zh-CN.md'],
  ]) {
    const shared = sharedStorage({ lang }),
      store = workerFixture();
    const tab = noticeTab(shared, store);
    await settle();
    assert.equal(tab.shown(), false, 'nothing before a save');
    await tab.save(mark());
    assert.equal(tab.shown(), true);
    const v = tab.view();
    for (const text of [title, PRIVACY[lang], link, undo, ok, policy])
      assert.ok(v.html.includes(text), text);
    assert.equal(v.excerpt, 'Postgres skips an index when it expects');
    assert.match(v.kind, /\bsaved\b/);
    assert.match(v.kind, /\bfirst\b/);
    assert.equal(v.role, 'status', 'announced politely');
    assert.match(
      v.html,
      /data-notice="undo"[^>]*>[^<]+<\/button><button[^>]*class="yes"[^>]*data-notice="ok"/,
    );
  }
});

test('after Got it, a save shows the small "Bookmark saved" card with its first words and Undo', async () => {
  for (const [lang, title, undo] of [
    ['en', 'Bookmark saved', 'Undo'],
    ['zh', '书签已保存', '撤销'],
  ]) {
    const shared = acknowledged({ lang }),
      store = workerFixture();
    const tab = noticeTab(shared, store);
    await settle();
    await tab.save(mark({ excerpt: 'Postgres skips\n  an index   when it expects' }));
    assert.equal(tab.shown(), true);
    const v = tab.view();
    assert.ok(v.html.includes(title), title);
    assert.ok(v.html.includes(`>${undo}</button>`), undo);
    assert.equal(v.excerpt, 'Postgres skips an index when it expects', 'one line');
    assert.equal(v.undo, true);
    assert.equal(v.ok, false, 'no Got it');
    assert.ok(!v.html.includes(PRIVACY[lang]), 'no privacy text');
    assert.doesNotMatch(v.kind, /\bfirst\b/);
  }
});

test('a save that finds the bookmark already stored says so, without Undo', async () => {
  for (const [lang, title] of [
    ['en', 'Already bookmarked'],
    ['zh', '已有此书签'],
  ]) {
    const shared = acknowledged({ lang }),
      store = workerFixture();
    await noticeTab(acknowledged(), store).save(mark()); // saved in another tab
    const tab = noticeTab(shared, store);
    await settle();
    await tab.save(mark());
    assert.equal(tab.shown(), true);
    const v = tab.view();
    assert.ok(v.html.includes(title), title);
    assert.equal(v.excerpt, 'Postgres skips an index when it expects');
    assert.equal(v.undo, false, 'nothing to take back');
    assert.match(v.kind, /\balready\b/);
  }
});

test('an unacknowledged save that finds the bookmark already stored shows the small card', async () => {
  const shared = sharedStorage({}),
    store = workerFixture();
  await noticeTab(acknowledged(), store).save(mark()); // saved in another tab
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  assert.ok(tab.view().html.includes('Already bookmarked'));
  assert.equal(tab.view().ok, false);
});

test('a remove shows "Bookmark removed", and its Undo brings back the same bookmark', async () => {
  for (const [lang, title] of [
    ['en', 'Bookmark removed'],
    ['zh', '已移除书签'],
  ]) {
    const shared = acknowledged({ lang }),
      store = workerFixture();
    const tab = noticeTab(shared, store);
    await settle();
    const b = await tab.save(mark());
    await tab.remove(b);
    assert.equal(await stored(store), 0);
    const v = tab.view();
    assert.ok(v.html.includes(title), title);
    assert.match(v.kind, /\bremoved\b/, 'its first words are struck through');
    assert.equal(v.excerpt, 'Postgres skips an index when it expects');
    assert.equal(v.undo, true);
    await tab.click('undo');
    const back = await list(store);
    assert.equal(back.length, 1);
    assert.equal(back[0].key, b.key, 'the same key');
    assert.equal(back[0].time, b.time, 'its original time');
    assert.deepEqual(tab.rail(), [[b.key, true]], 'its dot comes back and grows in');
    assert.equal(tab.host().inert, true, 'the card goes');
  }
});

test('Undo of a save deletes the bookmark just saved, and the next save expands again', async () => {
  const shared = sharedStorage({ lang: 'en' }),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  await tab.click('undo', { trusted: false });
  assert.equal(await stored(store), 1, 'page-script clicks are ignored');
  await tab.click('undo');
  assert.equal(await stored(store), 0);
  assert.equal(tab.deletes(), 1, 'one store write, by the session');
  assert.deepEqual(tab.rail(), [], 'the dot goes');
  assert.equal(tab.host().inert, true);
  tab.elapse(160);
  assert.equal(tab.host().hidden, true);
  assert.equal(shared.value().bookmarkNotice, undefined, 'still unacknowledged');
  await tab.save(mark({ para: 3 }));
  assert.equal(tab.shown(), true);
  assert.match(tab.view().kind, /\bfirst\b/);
});

test('Undo after a second save deletes only the latest bookmark', async () => {
  const shared = acknowledged(),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  const first = await tab.save(mark());
  await tab.save(mark({ para: 5 }));
  await tab.click('undo');
  assert.deepEqual(
    (await list(store)).map((b) => b.para),
    [2],
  );
  assert.deepEqual(tab.rail(), [[first.key, false]]);
});

test('a new card replaces the current one, and the replaced card’s Undo does nothing', async () => {
  const shared = acknowledged(),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  const stale = tab.cardId();
  const second = await tab.save(mark({ para: 5, excerpt: 'The second bookmark' }));
  assert.equal(tab.view().excerpt, 'The second bookmark', 'replaced at once');
  assert.notEqual(tab.cardId(), stale);
  await tab.click('undo', { card: stale });
  assert.equal(await stored(store), 2, 'a stale Undo deletes nothing');
  assert.equal(tab.shown(), true);
  await tab.remove(second);
  assert.ok(tab.view().html.includes('Bookmark removed'));
  await tab.click('undo', { card: stale });
  assert.equal(await stored(store), 1, 'nor does it bring anything back');
});

test('Got it is kept in settings: other tabs put the expanded card away, later saves show the small card', async () => {
  const shared = sharedStorage({ lang: 'en', opts: { rail: true } }),
    store = workerFixture();
  const a = noticeTab(shared, store),
    b = noticeTab(shared, store);
  await settle();
  await a.save(mark());
  await b.save(mark({ conv: 'another-chat' }));
  assert.equal(b.shown(), true);
  await a.click('ok');
  assert.equal(shared.value().bookmarkNotice, 'acknowledged');
  assert.equal(shared.value().lang, 'en', 'other settings are kept');
  assert.equal(shared.value().opts.rail, true);
  assert.equal(await stored(store), 1, 'Got it keeps the bookmark');
  assert.equal(a.host().inert, true);
  assert.equal(b.host().inert, true, 'every open tab puts its expanded card away');
  await a.save(mark({ para: 4 }));
  assert.equal(a.shown(), true);
  assert.doesNotMatch(a.view().kind, /\bfirst\b/);
  const reload = noticeTab(shared, store);
  await settle();
  await reload.save(mark({ para: 6 }));
  assert.doesNotMatch(reload.view().kind, /\bfirst\b/);
  assert.equal(reload.view().ok, false);
});

test('the small card leaves 4 s after it shows; the expanded card stays until Got it', async () => {
  const shared = sharedStorage({ lang: 'en' }),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  assert.equal(tab.waiting(4000), false, 'the expanded card has no timer');
  tab.elapse(4000);
  assert.equal(tab.shown(), true);
  await tab.click('ok');
  tab.elapse(160);
  await tab.save(mark({ para: 3 }));
  assert.equal(tab.shown(), true);
  tab.elapse(4000);
  assert.equal(tab.host().inert, true, 'fading out');
  tab.elapse(160);
  assert.equal(tab.host().hidden, true);
});

test('the pointer on the card or focus inside it holds the card; it leaves 4 s after both are gone', async () => {
  const shared = acknowledged(),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  const host = tab.host();
  host.fire('pointerenter');
  tab.elapse(4000);
  assert.equal(tab.shown(), true, 'held while the pointer is on it');
  host.fire('focusin');
  host.fire('pointerleave');
  tab.elapse(4000);
  assert.equal(tab.shown(), true, 'held while focus is inside');
  host.fire('focusout', { relatedTarget: host });
  tab.elapse(4000);
  assert.equal(tab.shown(), true, 'focus moved within the card');
  host.fire('focusout', { relatedTarget: null });
  assert.equal(tab.waiting(4000), true, 'a fresh 4 s');
  tab.elapse(4000);
  assert.equal(tab.host().inert, true);
  assert.equal(host.focusCalls, 0, 'the card never takes focus');
});

test('a new card while the pointer is on the card keeps it held', async () => {
  const shared = acknowledged(),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  await tab.save(mark());
  tab.host().fire('pointerenter');
  await tab.save(mark({ para: 4 }));
  tab.elapse(4000);
  assert.equal(tab.shown(), true);
  tab.host().fire('pointerleave');
  tab.elapse(4000);
  assert.equal(tab.host().inert, true);
});

test('a remove that replaces the unacknowledged expanded card does not acknowledge it', async () => {
  const shared = sharedStorage({ lang: 'en' }),
    store = workerFixture();
  const tab = noticeTab(shared, store);
  await settle();
  const b = await tab.save(mark());
  await tab.remove(b);
  assert.ok(tab.view().html.includes('Bookmark removed'));
  assert.doesNotMatch(tab.view().kind, /\bfirst\b/);
  assert.equal(shared.value().bookmarkNotice, undefined);
  await tab.save(mark({ para: 7 }));
  assert.match(tab.view().kind, /\bfirst\b/, 'the next save expands again');
});

test('pausing Butter, or turning the rail or Bookmarks off, puts the card away unacknowledged', async () => {
  for (const off of [
    { enabled: false },
    { opts: { rail: false } },
    { opts: { bookmark: false } },
  ]) {
    const shared = sharedStorage({}),
      store = workerFixture();
    const tab = noticeTab(shared, store);
    await settle();
    await tab.save(mark());
    await shared.storage.local.set({ butter: off });
    assert.equal(tab.host().inert, true);
    assert.equal(shared.value().bookmarkNotice, undefined);
    await tab.save(mark({ para: 9 }));
    assert.equal(tab.host().inert, true, 'and none shows while off');
  }
});

test('the card sits top right, 8 px left of the rail, outside the consent card’s stack', async () => {
  const shared = acknowledged(),
    store = workerFixture();
  const tab = noticeTab(shared, store, { rail: { inset: () => 19 } });
  await settle();
  await tab.save(mark());
  assert.equal(tab.host().hasAttribute('data-top'), true);
  assert.equal(tab.host().style.props['--note-right'], `${19 + 52 + 8}px`);
  assert.equal(tab.host().style.props['--consent-bottom'], undefined, 'not stacked');
});

for (const [name, butter] of [
  ['consent pending', { layoutConsent: 'pending' }],
  ['consent declined', { layoutConsent: 'declined', opts: { layout: false } }],
  ['consent granted', { layoutConsent: 'granted', opts: { layout: true } }],
  ['layouts switched off', { layoutConsent: 'granted', opts: { layout: false } }],
])
  test(`the notification works with ${name}`, async () => {
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
