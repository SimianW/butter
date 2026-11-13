const test = require('node:test'),
  assert = require('node:assert/strict');
const { workerFixture } = require('./helpers/layout-fixture.cjs');

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
// Responses come from the worker's own realm: compare them as plain data.
const send = async (f, message, sender) => {
  const result = await f.message(message, sender);
  return result === undefined ? result : JSON.parse(JSON.stringify(result));
};
const create = (f, bookmark) => send(f, { type: 'butter-bookmark-create', bookmark });
const list = (f, account = h('a'), conv = h('c')) =>
  send(f, { type: 'butter-bookmark-list', account, conv });
const remove = (f, bookmark) =>
  send(f, {
    type: 'butter-bookmark-delete',
    account: bookmark.account,
    conv: bookmark.conv,
    key: bookmark.key,
  });
const excerpts = async (...args) => (await list(...args)).bookmarks.map((b) => b.excerpt);

test('a created bookmark is read back for its conversation', async () => {
  const f = workerFixture();
  const made = await create(f, mark());
  assert.equal(made.created, true);
  assert.equal(made.bookmark.excerpt, mark().excerpt);
  assert.deepEqual(await excerpts(f), [mark().excerpt]);
  assert.deepEqual(await excerpts(f, h('a'), h('d')), []);
});

test('the same paragraph and range is saved once, keeping the first bookmark', async () => {
  const f = workerFixture();
  const first = await create(f, mark());
  const again = await create(f, mark({ time: 5000, excerpt: 'Postgres skips an index' }));
  assert.equal(again.created, false);
  assert.deepEqual(again.bookmark, first.bookmark);
  await create(f, mark({ start: 5, end: 12, excerpt: 'skips' }));
  assert.deepEqual(await excerpts(f), [mark().excerpt, 'skips']);
});

test('delete removes one bookmark and only within its own account and conversation', async () => {
  const f = workerFixture();
  const { bookmark } = await create(f, mark());
  await create(f, mark({ para: 3, excerpt: 'another paragraph' }));
  assert.deepEqual(await remove(f, { ...bookmark, account: h('b') }), { deleted: false });
  assert.deepEqual(await remove(f, { ...bookmark, conv: h('d') }), { deleted: false });
  assert.deepEqual(await remove(f, bookmark), { deleted: true });
  assert.deepEqual(await remove(f, bookmark), { deleted: false });
  assert.deepEqual(await excerpts(f), ['another paragraph']);
});

test('bookmarks are partitioned by account', async () => {
  const f = workerFixture();
  await create(f, mark({ excerpt: 'first account' }));
  await create(f, mark({ account: h('b'), excerpt: 'second account' }));
  assert.deepEqual(await excerpts(f, h('a')), ['first account']);
  assert.deepEqual(await excerpts(f, h('b')), ['second account']);
});

test('unknown accounts, raw ids and malformed bookmarks are rejected', async () => {
  const f = workerFixture();
  for (const account of [null, '', 'raw-user-id', 'A'.repeat(64)]) {
    assert.deepEqual(await create(f, mark({ account })), { error: 'bookmark-identity' });
    assert.deepEqual(await list(f, account), { error: 'bookmark-identity' });
    assert.deepEqual(await remove(f, { ...mark({ account }), key: 'k' }), {
      error: 'bookmark-identity',
    });
  }
  assert.deepEqual(await list(f, h('a'), 'raw-conversation-id'), { error: 'bookmark-identity' });
  assert.deepEqual(await create(f, mark({ msg: 'raw-message-id' })), {
    error: 'bookmark-protocol',
  });
  assert.deepEqual(await create(f, mark({ excerpt: 'x'.repeat(241) })), {
    error: 'bookmark-protocol',
  });
  assert.deepEqual(await send(f, { type: 'butter-bookmark-list', version: 2 }), {
    error: 'bookmark-protocol',
  });
  assert.equal(
    await send(f, { type: 'butter-bookmark-create', bookmark: mark() }, { id: 'other' }),
    undefined,
  );
  assert.equal(f.marks.size, 0);
});

test('only the allowlisted fields and the hashed ids reach the store', async () => {
  const f = workerFixture();
  await create(f, { ...mark(), url: 'https://chatgpt.com/c/raw', text: 'the whole answer' });
  const [stored] = f.marks.values();
  assert.deepEqual(Object.keys(stored).sort(), [
    'account',
    'conv',
    'end',
    'excerpt',
    'key',
    'msg',
    'para',
    'start',
    'time',
    'turn',
  ]);
});

for (const [name, initialSettings] of [
  ['consent pending', { layoutConsent: 'pending' }],
  ['consent declined', { layoutConsent: 'declined', opts: { layout: false } }],
  ['layouts switched off', { layoutConsent: 'granted', opts: { layout: false } }],
  ['Butter paused', { enabled: false, layoutConsent: 'granted' }],
])
  test(`bookmarks are saved and read with ${name}`, async () => {
    const f = workerFixture({ initialSettings });
    await create(f, mark());
    assert.deepEqual(await excerpts(f), [mark().excerpt]);
  });

test('layout Clear, switching layouts off and declining consent keep bookmarks', async () => {
  const f = workerFixture();
  await create(f, mark());
  assert.deepEqual(await send(f, { type: 'butter-layout-clear', requestId: crypto.randomUUID() }), {
    conversations: 0,
    bytes: 0,
  });
  f.setting(false);
  f.changeSettings({ layoutConsent: 'declined', opts: { layout: false } });
  await f.message({ type: 'butter-layout-usage' });
  assert.deepEqual(await excerpts(f), [mark().excerpt]);
});

test('bookmarks never expire and are not evicted by the layout byte cap', async () => {
  const f = workerFixture({ cap: 10 });
  await create(f, mark({ time: f.advance(0) }));
  f.advance(400 * 24 * 60 * 60 * 1000);
  await f.message({
    type: 'butter-layout-put',
    account: h('a'),
    conv: h('c'),
    generation: 0,
    records: [],
  });
  await f.message({ type: 'butter-layout-usage' });
  assert.deepEqual(await excerpts(f), [mark().excerpt]);
});

test('bookmarks survive a worker restart', async () => {
  const f = workerFixture();
  await create(f, mark());
  f.restart();
  assert.deepEqual(await excerpts(f), [mark().excerpt]);
});

test('the bookmark command asks the tab it was pressed in to bookmark; other commands do not', async () => {
  const f = workerFixture();
  f.command('bookmark', { id: 7, url: 'https://chatgpt.com/c/x' });
  f.command('save-bug', { id: 7 });
  f.command('bookmark', undefined); // no tab (a browser page): nothing to ask
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(f.tabMessages)), [
    { tabId: 7, message: { version: 1, type: 'butter-bookmark-shortcut' } },
  ]);
});

test('the page reads the key Chrome reports for the command, and none once it is cleared', async () => {
  const f = workerFixture();
  assert.deepEqual(await send(f, { type: 'butter-bookmark-key' }), { shortcut: 'Alt+Shift+M' });
  f.setShortcut('');
  assert.deepEqual(await send(f, { type: 'butter-bookmark-key' }), { shortcut: '' });
  // Another extension cannot ask.
  assert.equal(await send(f, { type: 'butter-bookmark-key' }, { id: 'other' }), undefined);
});

test('a key request in another protocol version is refused, as the store requests are', async () => {
  const f = workerFixture();
  for (const version of [2, 0, undefined])
    assert.deepEqual(await send(f, { type: 'butter-bookmark-key', version }), {
      error: 'bookmark-protocol',
    });
});

// The popup's bookmark usage and Clear: whole-store requests from an extension page (no tab).
const usage = (f, sender) => send(f, { type: 'butter-bookmark-usage' }, sender);
const clearAll = (f, requestId = crypto.randomUUID(), sender) =>
  send(f, { type: 'butter-bookmark-clear', requestId }, sender);
const utf8 = (s) => new TextEncoder().encode(s).length;

test('usage counts every bookmark of every account and conversation, and sums their bytes', async () => {
  const f = workerFixture();
  assert.deepEqual(await usage(f), { count: 0, bytes: 0 });
  await create(f, mark());
  await create(f, mark({ conv: h('d'), excerpt: 'another conversation' }));
  await create(f, mark({ account: h('b'), excerpt: 'Ünïcödé in another account' }));
  const rows = [...f.marks.values()];
  assert.deepEqual(await usage(f), {
    count: 3,
    bytes: rows.reduce((sum, r) => sum + utf8(JSON.stringify(r)), 0),
  });
});

test('clear empties the store for every account, returns zero usage and writes the cleared token', async () => {
  const f = workerFixture();
  await create(f, mark());
  await create(f, mark({ account: h('b') }));
  assert.deepEqual(await clearAll(f), { count: 0, bytes: 0 });
  assert.equal(f.marks.size, 0);
  assert.deepEqual(await usage(f), { count: 0, bytes: 0 });
  const tokens = f.changes.filter((c) => 'butterBookmarksCleared' in c);
  assert.equal(tokens.length, 1);
  assert.match(tokens[0].butterBookmarksCleared, /^[a-f0-9-]{36}$/);
  assert.equal(
    f.changes.some((c) => 'butterLayoutCleared' in c),
    false,
  );
});

test('bookmark clear leaves saved layouts; layout clear leaves bookmarks', async () => {
  const f = workerFixture();
  f.disk.set('layout-row', { key: 'layout-row' });
  await create(f, mark());
  await clearAll(f);
  assert.equal(f.disk.has('layout-row'), true);
  await create(f, mark());
  await send(f, { type: 'butter-layout-clear', requestId: crypto.randomUUID() });
  assert.equal(f.disk.size, 0);
  assert.deepEqual(await excerpts(f), [mark().excerpt]);
});

test('a retried clear with the same request id deletes nothing saved since', async () => {
  const f = workerFixture();
  await create(f, mark());
  const id = crypto.randomUUID();
  await clearAll(f, id);
  await create(f, mark({ excerpt: 'saved after the clear' }));
  assert.deepEqual(await clearAll(f, id), { count: 1, bytes: (await usage(f)).bytes });
  assert.deepEqual(await excerpts(f), ['saved after the clear']);
});

test('a retried clear whose first token write failed still tells the tabs', async () => {
  const f = workerFixture();
  await create(f, mark());
  const id = crypto.randomUUID();
  f.failStorageWrites(1);
  assert.deepEqual(await clearAll(f, id), { error: 'bookmark-storage' });
  assert.equal(f.marks.size, 0);
  assert.deepEqual(await clearAll(f, id), { count: 0, bytes: 0 });
  assert.equal(f.changes.filter((c) => 'butterBookmarksCleared' in c).length, 1);
});

test('a retry after a failed token write keeps a bookmark saved in between', async () => {
  const f = workerFixture();
  await create(f, mark());
  const id = crypto.randomUUID();
  f.failStorageWrites(1);
  await clearAll(f, id);
  await create(f, mark({ excerpt: 'saved between the tries' }));
  assert.equal((await clearAll(f, id)).count, 1);
  assert.deepEqual(await excerpts(f), ['saved between the tries']);
  assert.equal(f.changes.filter((c) => 'butterBookmarksCleared' in c).length, 1);
});

test('usage and clear are refused from a tab, from another extension and without a valid request', async () => {
  const f = workerFixture();
  await create(f, mark());
  const tab = { id: 'butter-test', tab: { id: 7 }, url: 'https://chatgpt.com/c/x' };
  assert.deepEqual(await usage(f, tab), { error: 'bookmark-sender' });
  assert.deepEqual(await clearAll(f, undefined, tab), { error: 'bookmark-sender' });
  assert.equal(await usage(f, { id: 'other' }), undefined);
  assert.equal(await clearAll(f, undefined, { id: 'other' }), undefined);
  assert.deepEqual(await clearAll(f, 'not-an-id'), { error: 'bookmark-protocol' });
  // The popup page open in a tab of its own is still an extension page.
  const popupTab = {
    id: 'butter-test',
    tab: { id: 8 },
    url: 'chrome-extension://butter-test/popup/popup.html',
  };
  assert.equal((await usage(f, popupTab)).count, 1);
  assert.deepEqual(await send(f, { type: 'butter-bookmark-usage', version: 2 }), {
    error: 'bookmark-protocol',
  });
  assert.equal(f.marks.size, 1);
});
