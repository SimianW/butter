// The service worker applies the experimental defaults once per install (#158): a new install keeps
// the rail and Bookmarks off; the first update keeps them as the old rule read them.
const test = require('node:test');
const assert = require('node:assert/strict');
const status = require('../extension/shared/status.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
// The worker runs in its own realm: compare plain copies.
const plain = (x) => JSON.parse(JSON.stringify(x));
// The settings writes only (the worker also writes its own tokens, such as a layouts clear).
const writes = (w) => plain(w.changes.filter((c) => 'butter' in c));
const settled = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};

test('the worker listens for the install event at its top level, once', () => {
  const w = workerFixture({ initialSettings: null });
  assert.equal(w.installListeners.length, 1);
  w.restart();
  assert.equal(w.installListeners.length, 1, 'a restarted worker registers it again, at start');
});

test('a new install writes the marker; the rail, Bookmarks and layouts read off', async () => {
  const w = workerFixture({ initialSettings: null });
  w.installed('install');
  await settled();
  assert.deepEqual(writes(w), [{ butter: status.migrate(undefined, 'install') }]);
  const s = status.normalize(w.settings.butter);
  assert.deepEqual([s.opts.rail, s.opts.bookmark, s.opts.layout], [false, false, false]);
  // A later update keeps the new defaults.
  w.installed('update', '0.1.0.23');
  await settled();
  assert.equal(writes(w).length, 1);
});

test('the first update writes what the migration returns, keeping every other field', async () => {
  for (const butter of [
    null,
    { lang: 'zh', enabled: false, opts: { rail: false, branch: false } },
    { layoutConsent: 'granted', opts: { layout: true, bookmark: false } },
    { layoutConsent: 'declined', bookmarkNotice: 'acknowledged' },
  ]) {
    const w = workerFixture({ initialSettings: butter });
    w.installed('update', '0.1.0.22');
    await settled();
    const expected = status.migrate(butter ?? undefined, 'update');
    assert.deepEqual(writes(w), [{ butter: expected }], JSON.stringify(butter));
    const s = status.normalize(w.settings.butter);
    assert.equal(s.opts.rail, butter?.opts?.rail !== false);
    assert.equal(s.opts.bookmark, butter?.opts?.bookmark !== false);
    w.installed('update', '0.1.0.23');
    await settled();
    assert.equal(writes(w).length, 1, 'once only');
  }
});

test('other reasons write nothing', async () => {
  for (const reason of ['chrome_update', 'shared_module_update']) {
    const w = workerFixture({ initialSettings: { opts: { rail: false } } });
    w.installed(reason);
    await settled();
    assert.deepEqual(writes(w), []);
  }
});
