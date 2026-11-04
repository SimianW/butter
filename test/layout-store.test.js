const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  native = require('node:crypto').webcrypto;
const core = require('../extension/seek/layout-check-main.js');
function fixture({ known = true, columns } = {}) {
  const events = {},
    control = { hold: false, release: null };

  const sc = {
    clientWidth: 1258,
    clientHeight: 900,
    querySelector: () => (columns ? columns[0] : {}),
    querySelectorAll: () => columns || [],
  };
  const resize = [];
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
      constructor(fn) {
        resize.push(fn);
      }
      observe() {}
      unobserve() {}
    },
    document,
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    innerWidth: 1599,
    devicePixelRatio: 1,
    __butterSeekCore: require('../extension/seek/core-main.js'),
    Element: class {},
    requestAnimationFrame: () => 1,
    performance: { now: () => 1 },
    __butterLayoutCheck: core,
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
  };
  const storage = require('./helpers/layout-fixture.cjs').attachStorage(ctx, events);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(
      require('node:path').join(__dirname, '../extension/seek/layout-cache-main.js'),
      'utf8',
    ),
    ctx,
  );
  if (known) storage.account();
  return {
    ctx,
    storage,
    api: ctx.__butterLayoutCache,
    sc,
    disk: storage.worker.disk,
    control,
    resize,
    events,
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
  assert.equal(f.api.dump().rejected['mutation-invalidated'], 1);
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

// shownColumn can move the fingerprint to another column when a turn is skipped. ResizeObserver
// reports a newly observed column at once; at the sampled width that must not drop stored geometry.
test('switching to an equal-width answer column keeps the fingerprint and stored geometry', async () => {
  const column = (turn) => ({
    closest: () => turn,
    getBoundingClientRect: () => ({ width: 720 }),
    offsetWidth: 720,
  });
  const turnA = {},
    turnB = {},
    columns = [column(turnA), column(turnB)];
  const f = fixture({ columns });
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.api.adopt(f.api.records(f.sc), f.sc);
  for (const fn of f.events.contentvisibilityautostatechange) fn({ target: turnA, skipped: true });
  f.api.refreshLayout(f.sc); // now fingerprinted from columns[1], same width and font
  const notify = (w) =>
    f.resize[0]([
      { target: columns[1], borderBoxSize: [{ inlineSize: w }], contentRect: { width: w } },
    ]);
  notify(720); // the initial notification observe() delivers
  assert.ok(f.api.get('t', f.sc), 'stored entry survives the column switch');
  notify(700); // a genuine resize
  assert.equal(f.api.get('t', f.sc), null, 'a real width change still invalidates');
});

// getBoundingClientRect includes ancestor transforms; ResizeObserver's border box does not. Under
// scale(0.9) an 800 px column samples as 720, so a resize to 720 px must not look like the sample.
test('a scaled-ancestor resize to the old transformed width still invalidates', async () => {
  const column = (turn) => ({
    closest: () => turn,
    getBoundingClientRect: () => ({ width: 720 }), // 0.9 x 800
    offsetWidth: 800,
  });
  const turnA = {},
    turnB = {},
    columns = [column(turnA), column(turnB)];
  const f = fixture({ columns });
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.api.adopt(f.api.records(f.sc), f.sc);
  for (const fn of f.events.contentvisibilityautostatechange) fn({ target: turnA, skipped: true });
  f.api.refreshLayout(f.sc);
  const notify = (w) =>
    f.resize[0]([
      { target: columns[1], borderBoxSize: [{ inlineSize: w }], contentRect: { width: w } },
    ]);
  assert.ok(f.api.get('t', f.sc), 'stored entry survives the column switch');
  notify(720); // a genuine resize to the old transformed sample
  assert.equal(f.api.get('t', f.sc), null, 'the resize invalidates');
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

test('MAIN cache performs no disk access until a passive account identity is known', async () => {
  const f = fixture({ known: false });
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  assert.equal(f.storage.worker.counters.opens, 0);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  f.storage.account();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  assert.ok(f.disk.size > 0);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 1);
});
test('account switches retire adopted entries and pending writes without crossing partitions', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.api.adopt(f.api.records(f.sc), f.sc);
  assert.ok(f.api.get('t'));
  f.api.record('t', record);
  f.event('butter-account', 'b'.repeat(64));
  assert.equal(f.api.get('t'), null);
  await f.api.flush();
  assert.equal(f.disk.size, 1);
  await f.api.setTexts(conv, texts);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  f.api.record('t', record);
  await f.api.flush();
  assert.equal(f.disk.size, 2);
  f.event('butter-account', 'a'.repeat(64));
  await f.api.setTexts(conv, texts);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 1);
  assert.equal(new Set([...f.disk.values()].map((x) => x.account)).size, 2);
});
test('layout-off retires disk-backed entries but preserves the in-session warm cache', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  f.api.adopt(f.api.records(f.sc), f.sc);
  f.api.adopt({ warm: { ...record, conv, ready: true } }, f.sc);
  f.event('butter-layout-response', JSON.stringify({ state: true, enabled: false }));
  const counts = { ...f.storage.worker.counters };
  assert.equal(f.api.get('t'), null);
  assert.ok(f.api.get('warm'));
  f.api.record('t', record);
  await f.api.flush();
  assert.equal(Object.keys(f.api.records(f.sc)).length, 0);
  assert.deepEqual(f.storage.worker.counters, counts);
});

test('merged prepare synchronously uses prefetched memory with no disk reads at drag time', async () => {
  const f = fixture();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  const reads = f.storage.worker.counters.reads,
    result = f.api.prepare(f.sc, ['t']);
  assert.equal(typeof result.then, 'undefined');
  assert.equal(result.storedTurns, 1);
  assert.equal(result.records.t.items[0].text, 'answer');
  assert.equal(f.storage.worker.counters.reads, reads);
  f.ctx.getComputedStyle = () => ({ font: '20px serif' });
  assert.equal(Object.keys(f.api.prepare(f.sc, ['t']).records).length, 0);
});

test('failed loads retain bounded measurements and recover on the next source update', async () => {
  const f = fixture({ known: false });
  const message = f.storage.worker.message;
  let available = false;
  f.storage.worker.message = (m) =>
    !available && m.type === 'butter-layout-load'
      ? Promise.resolve({ error: 'layout-storage' })
      : message(m);
  await new Promise(setImmediate);
  f.storage.account();
  await f.api.setTexts(conv, texts);
  f.api.record('t', record);
  await f.api.flush();
  assert.equal(f.api.dump().pending, 1, 'failed load must not consume a measurement');
  const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => ['t' + i, texts.t]));
  await f.api.setTexts(conv, many);
  for (const turn of Object.keys(many)) f.api.record(turn, record);
  assert.ok(f.api.dump().pending <= 256, 'unavailable storage has a bounded queue');
  f.api.record('t', record);
  available = true;
  await f.api.setTexts(conv, texts);
  await f.api.flush();
  assert.equal(f.api.dump().pending, 0);
  assert.equal(Object.keys(f.api.records(f.sc)).length, 256);
  assert.equal(f.disk.size, 256);
});

test('layout evidence stays neutral until exercised, fails on unavailable storage, and clears on recovery', async () => {
  const f = fixture({ known: false });
  const status = require('../extension/shared/status.js');
  let facts;
  const dispatch = f.ctx.document.dispatchEvent;
  f.ctx.document.dispatchEvent = (e) => {
    if (e.type === 'butter-status-response') Object.assign(facts, JSON.parse(e.detail));
    dispatch(e);
  };
  const probe = () => {
    facts = {};
    f.event('butter-status-request');
    return status.classify(facts, { layoutConsent: 'granted' }).layout;
  };
  assert.equal(probe(), 'idle');
  await new Promise(setImmediate);
  const message = f.storage.worker.message;
  let available = false;
  f.storage.worker.message = (m) =>
    !available ? Promise.resolve({ error: 'layout-storage' }) : message(m);
  await f.api.setTexts(conv, texts);
  assert.equal(probe(), 'idle', 'unknown account never fails');
  f.storage.account();
  await f.api.setTexts(conv, texts);
  assert.equal(probe(), 'fail');
  let failures = status.updateFailures({}, status.classify(facts, { layoutConsent: 'granted' }));
  assert.deepEqual(failures, { layout: { layout: true } });
  available = true;
  await f.api.setTexts(conv, texts);
  assert.equal(probe(), 'ok');
  failures = status.updateFailures(failures, status.classify(facts, { layoutConsent: 'granted' }));
  assert.deepEqual(failures, {});
  f.api.record('t', record);
  available = false;
  await f.api.flush();
  assert.equal(probe(), 'fail', 'a failed write supersedes an earlier successful load');
  available = true;
  await f.api.flush();
  assert.equal(probe(), 'ok');
});
