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
