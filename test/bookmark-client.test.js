// The bookmark store's client (bookmarks/client.js), shared by the page and the first-use notice.
const test = require('node:test'),
  assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// The client in a vm whose chrome.runtime answers each request with the next of `answers` (an
// Error is thrown, as a closed port does).
function client(answers) {
  const sent = [];
  const ctx = {
    chrome: {
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
  return { send: ctx.ButterBookmarkStore.send, sent };
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
