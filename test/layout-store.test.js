const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  native = require('node:crypto').webcrypto;
const core = require('../extension/seek/layout-check-main.js');
function fixture() {
  const events = {},
    disk = new Map(),
    invalidated = [],
    control = { hold: false, release: null };
  const tx = () => {
    const t = {};
    t.objectStore = () => ({
      getAll() {
        const r = {};
        queueMicrotask(() => r.onsuccess?.());
        Object.defineProperty(r, 'result', { get: () => [...disk.values()] });
        return r;
      },
      put(x) {
        disk.set(x.key, x);
        queueMicrotask(() => t.oncomplete?.());
      },
      delete(k) {
        disk.delete(k);
        queueMicrotask(() => t.oncomplete?.());
      },
      clear() {
        disk.clear();
        queueMicrotask(() => t.oncomplete?.());
      },
    });
    return t;
  };
  const sc = { clientWidth: 1258, clientHeight: 900, querySelector: () => ({}) };
  const document = {
    scripts: [],
    documentElement: { className: 'light' },
    addEventListener: (name, fn) => (events[name] ||= []).push(fn),
    querySelectorAll: () => [sc],
  };
  const ctx = {
    MutationObserver: class {
      observe() {}
    },
    ResizeObserver: class {
      observe() {}
      unobserve() {}
    },
    document,
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    innerWidth: 1599,
    devicePixelRatio: 1,
    __butterLayoutOptions: { storage: true },
    __butterLayoutCheck: core,
    __butterHeightCache: { invalidate: (c) => invalidated.push(c) },
    __seek: { active: false },
    TextEncoder,
    Map,
    Set,
    Date,
    JSON,
    Number,
    Array,
    Object,
    Promise,
    queueMicrotask,
    getComputedStyle: () => ({ font: '16px system-ui' }),
    setTimeout: () => 1,
    clearTimeout() {},
    crypto: {
      subtle: {
        digest(...args) {
          if (control.hold) {
            control.hold = false;
            return new Promise(
              (resolve) => (control.release = () => native.subtle.digest(...args).then(resolve)),
            );
          }
          return native.subtle.digest(...args);
        },
      },
    },
    indexedDB: {
      open() {
        const r = { result: { transaction: tx } };
        queueMicrotask(() => r.onsuccess());
        return r;
      },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(
      require('node:path').join(__dirname, '../extension/seek/layout-store-main.js'),
      'utf8',
    ),
    ctx,
  );
  return {
    ctx,
    api: ctx.__butterLayoutStore,
    sc,
    disk,
    invalidated,
    control,
    event: (name, detail) => {
      for (const fn of events[name] || []) fn({ detail });
    },
  };
}
const conv = '00000000-0000-0000-0000-000000000000';
const texts = { t: { q: 'question', answer: 'answer', ids: ['m'], msg: 'm' } };
const record = {
  h: 500,
  rowH: 520,
  w: 768,
  vw: 1599,
  sw: 1258,
  msg: 'm',
  blocks: [26],
  items: [
    { top: 20, h: 26, left: 200, w: 768, user: false, css: 'font:16px system-ui', text: 'answer' },
  ],
};
test('real store serializes no chat text and rejects edited content, width and font changes', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  assert.equal(Object.keys(f.api.records(f.sc)).length, 1);
  const persisted = JSON.stringify([...f.disk.values()]);
  assert.equal(persisted.includes('question'), false);
  assert.equal(persisted.includes('answer'), false);
  f.sc.clientWidth = 900;
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  f.sc.clientWidth = 1258;
  f.ctx.getComputedStyle = () => ({ font: '18px system-ui' });
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  f.ctx.getComputedStyle = () => ({ font: '16px system-ui' });
  await f.api.setTexts(conv, { t: { ...texts.t, answer: 'edited' } });
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
});
test('mutation start invalidates stored and adopted geometry until fresh JSON arrives', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.event('butter-seek-write', { conv });
  assert.deepEqual(f.invalidated, [conv]);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  await f.api.setTexts(conv, texts);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  f.event('butter-seek-data', { conv, before: false, j: { messages: [] } });
  await f.api.setTexts(conv, texts);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 1);
});
test('a pre-mutation async hash cannot reinstall stale geometry after newer JSON arrives', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.control.hold = true;
  const old = f.api.setTexts(conv, texts);
  await new Promise(setImmediate);
  assert.ok(f.control.release);
  f.event('butter-seek-write', { conv });
  f.event('butter-seek-data', { conv, before: false, j: { messages: [] } });
  await f.api.setTexts(conv, {
    t: { ...texts.t, answer: 'new answer', msg: 'new-m', ids: ['new-m'] },
  });
  await f.control.release();
  await old;
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
});

// Golden bytes from the checkpoint's persistent layout identity.
test('layout store preserves the checkpoint fingerprint bytes', () => {
  const f = fixture();
  assert.equal(
    f.api.refreshLayout(f.sc),
    '{' +
      '"schema":1,"sw":1258,"vw":1599,"dpr":1,"font":"16px system-ui","column":null,"theme":"[\\"light\\",null,null]","build":""}',
  );
});
