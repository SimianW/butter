const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const codec = require('../extension/seek/layout-codec.js');
const check = require('../extension/seek/layout-check-main.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
const id = (c) => c.repeat(64);
const geometry = (overrides = {}) =>
  codec.pack({
    account: id('a'),
    conv: id('c'),
    turn: id('d'),
    msg: id('e'),
    digest: id('f'),
    layout: id('b'),
    time: Date.now(),
    h: 500,
    rowH: 520,
    turnOffset: 8,
    turnH: 480,
    w: 768,
    vw: 1440,
    sw: 1258,
    blocks: [26],
    items: [
      {
        top: 20,
        h: 26,
        left: 200,
        w: 768,
        user: false,
        css: 'font:16px system-ui',
        source: 0,
        math: [],
      },
    ],
    ...overrides,
  });
async function load(f, account = id('a'), conv = id('c')) {
  return f.message({ type: 'butter-layout-load', account, conv });
}
async function put(f, records, account = id('a'), conv = id('c'), generation = 0) {
  return f.message({ type: 'butter-layout-put', account, conv, generation, records });
}
const usage = (f) => f.message({ type: 'butter-layout-usage' });
const clear = (f) => f.message({ type: 'butter-layout-clear' });

test('worker partitions by account and conversation; usage counts conversations across accounts', async () => {
  const f = workerFixture();
  await put(f, [geometry(), geometry({ turn: id('1') })]);
  await put(f, [geometry({ account: id('2') })], id('2'));
  assert.equal((await load(f)).records.length, 2);
  assert.equal((await load(f, id('2'))).records.length, 1);
  assert.equal((await load(f, id('3'))).records.length, 0);
  assert.equal((await load(f, id('a'), id('4'))).records.length, 0);
  const result = await usage(f);
  assert.equal(result.conversations, 2);
  assert.equal(
    result.bytes,
    [...f.disk.values()].reduce((n, x) => n + codec.bytes(x), 0),
  );
  assert.ok(result.bytes > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(await clear(f))), { conversations: 0, bytes: 0 });
  assert.equal((await usage(f)).bytes, 0);
  assert.equal((await load(f)).records.length, 0);
});
test('unknown account and raw identities cannot read or write saved geometry', async () => {
  const f = workerFixture();
  await put(f, [geometry()], null);
  await put(f, [geometry({ account: 'raw-user-id' })], 'raw-user-id');
  assert.equal((await usage(f)).bytes, 0);
  assert.equal((await load(f, null)).records.length, 0);
  assert.equal((await load(f, 'raw-user-id')).records.length, 0);
});
test('TTL prunes disk records on reads and usage, regardless of LRU access', async () => {
  const now = Date.now(),
    f = workerFixture({ now });
  await put(f, [geometry({ time: now })]);
  f.advance(check.TTL - 1);
  assert.equal((await load(f)).records.length, 1);
  f.advance(2);
  assert.equal((await load(f)).records.length, 0);
  assert.equal(f.disk.size, 0);
  await put(f, [geometry({ time: now }), geometry({ time: now + check.TTL + 60002 })]);
  assert.equal((await usage(f)).bytes, 0);
});
test('byte cap evicts least recently used records, even if recently written records are older', async () => {
  const now = Date.now(),
    one = geometry({ time: now }),
    probe = workerFixture({ now });
  await put(probe, [one]);
  const bytes = (await usage(probe)).bytes,
    f = workerFixture({ cap: bytes * 2 + 20, now });
  await put(f, [one]);
  f.advance(1);
  await put(f, [geometry({ conv: id('2'), time: now - 1000 })], id('a'), id('2'));
  f.advance(1);
  await load(f);
  f.advance(1);
  await put(f, [geometry({ conv: id('3') })], id('a'), id('3'));
  assert.equal((await load(f, id('a'), id('2'))).records.length, 0);
  assert.equal((await load(f)).records.length, 1);
  assert.equal((await load(f, id('a'), id('3'))).records.length, 1);
  assert.ok((await usage(f)).bytes <= bytes * 2 + 20);
});
test('layout off deletes every account and stops persisted reads and writes', async () => {
  const f = workerFixture();
  await put(f, [geometry()]);
  await put(f, [geometry({ account: id('2') })], id('2'));
  f.setting(false);
  await usage(f);
  assert.equal(f.disk.size, 0);
  const counts = { ...f.counters };
  await put(f, [geometry()]);
  assert.equal((await load(f)).records.length, 0);
  assert.equal(f.counters.reads, counts.reads);
  assert.equal(f.counters.writes, counts.writes);
  f.setting(true);
  const next = await load(f);
  await put(f, [geometry()], id('a'), id('c'), next.generation);
  assert.equal((await usage(f)).conversations, 1);
});
test('clear fences delayed writes from all tabs and survives worker restart state', async () => {
  const f = workerFixture();
  const before = await load(f);
  await put(f, [geometry()]);
  await clear(f);
  await put(f, [geometry()], id('a'), id('c'), before.generation);
  assert.equal((await usage(f)).bytes, 0);
  const after = await load(f);
  assert.ok(after.generation > before.generation);
  await put(f, [geometry()], id('a'), id('c'), after.generation);
  assert.ok((await usage(f)).bytes > 0);
  assert.equal(f.state.get('generation'), after.generation);
});
test('wire canonicalization drops text, raw ids, tokens, cookies and unrecognized properties', async () => {
  const f = workerFixture();
  const x = {
    ...geometry(),
    text: 'secret question',
    accessToken: 'secret-token',
    cookie: 'secret-cookie',
    userId: 'raw-user',
    items: geometry().items,
  };
  await put(f, [x]);
  const disk = JSON.stringify([...f.disk.values()]);
  for (const secret of [
    'secret question',
    'secret-token',
    'secret-cookie',
    'raw-user',
    'accessToken',
  ])
    assert.equal(disk.includes(secret), false);
  const bad = geometry();
  bad.styles = ['background:url(secret-token)'];
  await clear(f);
  await put(f, [bad], id('a'), id('c'), 1);
  assert.equal((await usage(f)).bytes, 0);
  assert.equal(
    await f.message({ type: 'butter-layout-clear' }, { id: 'other-extension' }),
    undefined,
  );
});
test('compact encoding round-trips the same numeric fixture and dictionary-encodes typography', () => {
  const source = {
    ...codec.unpack(geometry()),
    items: Array.from({ length: 100 }, (_, i) => ({
      top: i * 26,
      h: 26,
      left: 200,
      w: 768,
      user: false,
      css: 'font:normal 400 16px/26px system-ui;padding:0px 0px 0px 0px;border-radius:0px;background:rgba(0, 0, 0, 0);color:rgb(0, 0, 0);text-align:start',
      source: i,
      math: [],
    })),
  };
  const packed = codec.pack(source);
  assert.equal(packed.styles.length, 1);
  assert.deepEqual(codec.unpack(packed), source);
  assert.ok(codec.bytes(packed) < codec.bytes(source) / 2);
});
test('trial site database is deleted once without reading it, and a blocked delete is retried', async () => {
  const saved = {},
    events = {},
    deletes = [];
  const chrome = {
    storage: {
      local: { get: async () => saved, set: async (x) => Object.assign(saved, x) },
      onChanged: { addListener() {} },
    },
    runtime: { sendMessage: async () => ({}) },
  };
  const source = fs.readFileSync(require.resolve('../extension/storage/layout-bridge.js'), 'utf8');
  const run = () =>
    vm.runInNewContext(source, {
      chrome,
      CustomEvent: class {},
      document: { addEventListener: (n, fn) => (events[n] = fn), dispatchEvent() {} },
      indexedDB: {
        deleteDatabase(name) {
          const r = {};
          deletes.push({ name, r });
          return r;
        },
      },
    });
  run();
  await new Promise(setImmediate);
  assert.equal(deletes.length, 1);
  assert.equal(saved.butterLayoutMigrated, undefined);
  run();
  await new Promise(setImmediate);
  assert.equal(deletes.length, 2);
  deletes[1].r.onsuccess();
  run();
  await new Promise(setImmediate);
  assert.equal(deletes.length, 2);
  assert.equal(deletes[0].name, 'butter-seek-cold-geometry-v1');
});
test('passive account observer hashes only user id, never accesses credentials or makes requests', async () => {
  const events = [],
    listeners = {},
    calls = [];
  let body = { user: { id: 'test-account' } };
  for (const key of ['accessToken', 'token', 'cookies'])
    Object.defineProperty(body, key, {
      get() {
        throw Error('credential field accessed');
      },
    });
  const win = {
    addEventListener() {},
    fetch(input) {
      calls.push(input);
      return Promise.resolve({ ok: true, clone: () => ({ json: async () => body }) });
    },
  };
  const context = {
    window: win,
    URL,
    Request,
    Symbol,
    crypto: crypto.webcrypto,
    TextEncoder,
    location: {
      href: 'https://chatgpt.com/c/123',
      origin: 'https://chatgpt.com',
      pathname: '/c/123',
    },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    document: {
      documentElement: { getAttribute: () => '' },
      addEventListener: (name, fn) => (listeners[name] = fn),
      dispatchEvent: (e) => events.push(e),
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../extension/history/conversation-main.js'), 'utf8'),
    context,
  );
  const accountEvents = () => events.filter((e) => e.type === 'butter-account');
  const waitForAccount = async (count) => {
    const deadline = Date.now() + 2000;
    while (accountEvents().length < count) {
      assert.ok(Date.now() < deadline, 'Passive account hash must finish');
      await new Promise(setImmediate);
    }
  };
  assert.equal(calls.length, 0);
  await win.fetch('/api/auth/session');
  await waitForAccount(1);
  const expected = crypto.createHash('sha256').update('test-account').digest('hex');
  assert.equal(events.find((e) => e.type === 'butter-account').detail, expected);
  assert.equal(JSON.stringify(events).includes('test-account'), false);
  assert.deepEqual(calls, ['/api/auth/session']);
  await win.fetch('https://other.example/api/auth/session');
  await new Promise(setImmediate);
  assert.equal(events.filter((e) => e.type === 'butter-account').length, 1);
  body = { id: 'session-id-is-not-a-user-id' };
  await win.fetch('/api/auth/session');
  await waitForAccount(2);
  assert.equal(events.filter((e) => e.type === 'butter-account').at(-1).detail, null);
  body = { id: 'test-account' };
  await win.fetch('/backend-api/me');
  await waitForAccount(3);
  assert.equal(events.filter((e) => e.type === 'butter-account').at(-1).detail, expected);
});

test('layout-off at worker startup or during its settings read cannot re-enable storage', async () => {
  for (const startup of [true, false]) {
    const f = workerFixture(startup ? { initialLayout: false } : {});
    if (!startup) f.setting(false);
    await usage(f);
    const before = { ...f.counters };
    await put(f, [geometry()]);
    await load(f);
    assert.equal((await usage(f)).bytes, 0);
    assert.equal(f.counters.reads, before.reads);
    assert.equal(f.counters.writes, before.writes);
  }
});

test('versioned protocol rejects unsupported clients', async () => {
  const f = workerFixture();
  assert.equal(
    (await f.message({ type: 'butter-layout-usage', version: 2 })).error,
    'layout-protocol',
  );
  assert.equal(
    (await f.message({ type: 'butter-layout-clear', requestId: 'not-an-operation-id' })).error,
    'layout-protocol',
  );
  assert.equal(f.counters.opens, 0);
});
test('restart rebuilds accounting from serialized rows and preserves clear generation/deduplication', async () => {
  const f = workerFixture();
  await put(f, [geometry()]);
  const expected = (await usage(f)).bytes;
  for (const x of f.disk.values()) delete x.bytes;
  f.restart();
  assert.equal((await usage(f)).bytes, expected);
  const requestId = crypto.randomUUID();
  await f.message({ type: 'butter-layout-clear', requestId });
  const fresh = await load(f);
  await put(f, [geometry()], id('a'), id('c'), fresh.generation);
  f.restart();
  await f.message({ type: 'butter-layout-clear', requestId });
  assert.equal(
    (await usage(f)).bytes,
    expected,
    'A retried completed clear does not delete later writes',
  );
  assert.equal((await load(f)).generation, fresh.generation);
  await put(f, [geometry()], id('a'), id('c'), 0);
  assert.equal(
    (await usage(f)).bytes,
    expected,
    'The pre-clear generation remains fenced after restart',
  );
});
test('a retried old put cannot replace a newer measured record', async () => {
  const f = workerFixture(),
    time = Date.now();
  await put(f, [geometry({ time })]);
  await put(f, [geometry({ time: time + 1, h: 700 })]);
  f.restart();
  await put(f, [geometry({ time, h: 500 })]);
  assert.equal(codec.unpack((await load(f)).records[0]).h, 700);
});
test('bridge retries the same put after worker termination before or after commit', async () => {
  for (const committed of [false, true]) {
    const f = workerFixture(),
      events = {},
      responses = [],
      requests = [];
    let calls = 0;
    const chrome = {
      storage: {
        local: { get: async () => ({ butterLayoutMigrated: true }) },
        onChanged: { addListener() {} },
      },
      runtime: {
        sendMessage: async (message) => {
          requests.push(message);
          calls++;
          if (calls === 1) {
            if (committed) await f.message(message);
            f.restart();
            throw Error('The message port closed before a response was received.');
          }
          return f.message(message);
        },
      },
    };
    vm.runInNewContext(
      fs.readFileSync(require.resolve('../extension/storage/layout-bridge.js'), 'utf8'),
      {
        chrome,
        CustomEvent: class {
          constructor(type, options) {
            this.type = type;
            this.detail = options.detail;
          }
        },
        document: {
          addEventListener: (name, fn) => (events[name] = fn),
          dispatchEvent: (e) => responses.push(JSON.parse(e.detail)),
        },
      },
    );
    await new Promise(setImmediate);
    await events['butter-layout-request']({
      detail: JSON.stringify({
        id: 1,
        op: 'put',
        account: id('a'),
        conv: id('c'),
        generation: 0,
        records: [geometry()],
      }),
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].version, 1);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(responses.at(-1).id, 1);
    assert.equal((await usage(f)).conversations, 1);
    assert.equal(f.disk.size, 1);
  }
});
