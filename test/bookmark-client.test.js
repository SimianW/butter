// The bookmark store's client (bookmarks/client.js), shared by the page and the first-use notice.
const test = require('node:test'),
  assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// The client in a vm whose chrome.runtime answers each request with the next of `answers` (an
// Error is thrown, as a closed port does).
function client(answers) {
  const sent = [],
    changes = [];
  const ctx = {
    chrome: {
      storage: { onChanged: { addListener: (fn) => changes.push(fn) } },
      runtime: {
        sendMessage: async (m) => {
          sent.push(m);
          const a = answers.shift();
          if (a instanceof Error) throw a;
          return a;
        },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(require.resolve('../extension/bookmarks/client.js'), 'utf8'),
    ctx,
  );
  const store = ctx.ButterBookmarkStore;
  // chrome.storage reports a change in `area`.
  const change = (area, value) => changes.forEach((fn) => fn(value, area));
  return { send: store.send, store, sent, change };
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('a request goes out as a version-1 message and returns the answer', async () => {
  const c = client([{ deleted: true }]);
  const r = await c.send('butter-bookmark-delete', { account: 'a', conv: 'c', key: 'k' });
  assert.deepEqual(plain(r), { deleted: true });
  assert.deepEqual(plain(c.sent), [
    { version: 1, type: 'butter-bookmark-delete', account: 'a', conv: 'c', key: 'k' },
  ]);
});

test('a storage failure or a closed port is retried with the same request', async () => {
  const c = client([new Error('port closed'), { error: 'bookmark-storage' }, { bookmarks: [] }]);
  assert.deepEqual(plain(await c.send('butter-bookmark-list', { account: 'a', conv: 'c' })), {
    bookmarks: [],
  });
  assert.equal(c.sent.length, 3);
  assert.ok(c.sent.every((m) => m.type === 'butter-bookmark-list' && m.version === 1));
});

test('after three failed tries the client reports the storage error', async () => {
  const c = client([undefined, new Error('x'), { error: 'bookmark-storage' }, { bookmarks: [] }]);
  assert.deepEqual(plain(await c.send('butter-bookmark-list', {})), { error: 'bookmark-storage' });
  assert.equal(c.sent.length, 3);
});

test('other errors are answers, not retried', async () => {
  const c = client([{ error: 'bookmark-identity' }]);
  assert.deepEqual(plain(await c.send('butter-bookmark-list', {})), {
    error: 'bookmark-identity',
  });
  assert.equal(c.sent.length, 1);
});

test('the popup’s Clear token in local storage reaches the cleared listener, nothing else does', () => {
  const c = client([]);
  let calls = 0;
  c.store.cleared(() => calls++);
  c.change('local', { butterBookmarksCleared: { newValue: 'token' } });
  c.change('local', { butterLayoutCleared: { newValue: 'token' } });
  c.change('session', { butterBookmarksCleared: { newValue: 'token' } });
  assert.equal(calls, 1);
});

test('the Bookmark key is read from the worker, and a change is reported once', async () => {
  const c = client([{ shortcut: 'Alt+Shift+M' }, { shortcut: 'Alt+Shift+M' }, new Error('x')]);
  let changed = 0;
  assert.equal(c.store.key, null, 'not read yet');
  await c.store.readKey(() => changed++);
  assert.equal(c.store.key, 'Alt+Shift+M');
  await c.store.readKey(() => changed++);
  assert.equal(changed, 1, 'the same key again changes nothing');
  await c.store.readKey(() => changed++);
  assert.equal(c.store.key, '', 'no answer reads as no key');
  assert.equal(changed, 2);
  assert.deepEqual(plain(c.sent[0]), { version: 1, type: 'butter-bookmark-key' });
});
