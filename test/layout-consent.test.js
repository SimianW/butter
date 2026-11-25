const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const status = require('../extension/shared/status.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
const codec = require('../extension/seek/layout-codec.js');
const read = (file) => fs.readFileSync(require.resolve('../extension/' + file), 'utf8');
const tick = () => new Promise(setImmediate);
// A recorded layouts choice: what the popup's switch stores (granted), or a decline stored before
// the consent card was removed (#158).
const choose = (value, granted) => ({
  ...value,
  layoutConsent: granted ? 'granted' : 'declined',
  opts: { ...value?.opts, layout: granted },
});

test('consent migration starts new and existing users pending without trusting the old layout option', () => {
  for (const value of [
    undefined,
    {},
    { opts: { layout: true } },
    { opts: { layout: false } },
    { layoutConsent: 'invalid' },
  ]) {
    const next = status.normalize(value);
    assert.equal(next.layoutConsent, 'pending');
    assert.equal(next.opts.layout, false);
    assert.equal(status.groupOn(next, 'layout'), false);
  }
  for (const granted of [true, false]) {
    const choice = choose({ lang: 'zh', enabled: false }, granted);
    assert.equal(status.normalize(choice).layoutConsent, granted ? 'granted' : 'declined');
    assert.equal(status.normalize(choice).opts.layout, granted);
    assert.deepEqual(status.normalize(choice), status.normalize(status.normalize(choice)));
  }
  assert.equal(status.chooseLayout, undefined, 'only the removed card recorded a choice');
});

test('no consent card: the manifest loads no layout consent script, and the file is gone', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const scripts = manifest.content_scripts.flatMap((c) => c.js);
  assert.ok(!scripts.some((f) => /layout-consent/.test(f)), scripts.join(', '));
  assert.ok(scripts.includes('consent/card.js'), 'the bookmark notice still uses the card shell');
  assert.ok(
    !fs.existsSync(
      require
        .resolve('../extension/manifest.json')
        .replace('manifest.json', 'consent/layout-consent.js'),
    ),
  );
});

test('pending worker performs no persisted I/O; grant enables it and decline deletes and disables', async () => {
  for (const initialSettings of [{}, { opts: { layout: true } }]) {
    const f = workerFixture({ initialSettings });
    const identity = { account: 'a'.repeat(64), conv: 'b'.repeat(64) };
    const row = codec.pack({
      ...identity,
      turn: 'c'.repeat(64),
      msg: 'd'.repeat(64),
      digest: 'e'.repeat(64),
      layout: 'f'.repeat(64),
      time: Date.now(),
      h: 100,
      rowH: 100,
      turnOffset: 0,
      turnH: 100,
      w: 100,
      vw: 100,
      sw: 100,
      blocks: [20],
      items: [],
    });
    const usage = () => f.message({ type: 'butter-layout-usage' });
    const load = () => f.message({ type: 'butter-layout-load', ...identity });
    const put = (generation = 0) =>
      f.message({ type: 'butter-layout-put', ...identity, generation, records: [row] });
    await put();
    await load();
    await usage();
    await f.message({ type: 'butter-layout-clear' });
    assert.deepEqual(f.counters, { opens: 0, reads: 0, writes: 0 });
    // A legacy row must not be read, maintained or returned while pending, even after restart.
    f.disk.set('legacy', { secret: 'old fixture' });
    f.restart();
    assert.equal((await usage()).bytes, 0);
    assert.deepEqual(f.counters, { opens: 0, reads: 0, writes: 0 });
    f.changeSettings(choose(initialSettings, true));
    const { generation } = await load();
    await put(generation);
    assert.ok((await usage()).bytes > 0);
    f.changeSettings(choose(initialSettings, false));
    await usage();
    assert.equal(f.disk.size, 0);
    const counts = { ...f.counters };
    await put(generation);
    await load();
    await usage();
    assert.deepEqual(f.counters, counts);
  }
});

test('pending ISOLATED bridge blocks page load/put requests and announces grant and decline live', async () => {
  let changed;
  const requests = [],
    responses = [],
    migrations = [],
    events = {};
  vm.runInNewContext(read('storage/layout-bridge.js'), {
    ButterStatus: status,
    indexedDB: {
      deleteDatabase: (name) => {
        migrations.push(name);
        return {};
      },
    },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document: {
      addEventListener: (type, fn) => (events[type] = fn),
      dispatchEvent: (e) => responses.push(JSON.parse(e.detail)),
    },
    chrome: {
      storage: {
        local: {
          get: async () => ({ butter: { opts: { layout: true } } }),
        },
        onChanged: { addListener: (fn) => (changed = fn) },
      },
      runtime: {
        sendMessage: async (m) => {
          requests.push(m);
          return { records: [] };
        },
      },
    },
  });
  await tick();
  const send = (op) => events['butter-layout-request']({ detail: JSON.stringify({ id: 1, op }) });
  await send('load');
  await send('put');
  assert.equal(requests.length, 0);
  assert.equal(responses[0].enabled, false);
  assert.equal(migrations.length, 0);
  // Granted with Smoother scrolling on, which the layouts need.
  changed({ butter: { newValue: choose({ opts: { seek: true } }, true) } }, 'local');
  assert.equal(responses.at(-1).enabled, true);
  assert.deepEqual(migrations, ['butter-seek-cold-geometry-v1']);
  await send('load');
  assert.equal(requests.length, 1);
  changed({ butter: { newValue: choose({ opts: { seek: true } }, false) } }, 'local');
  assert.equal(responses.at(-1).enabled, false);
  await send('put');
  assert.equal(requests.length, 1);
});

// Saved layouts serve only the scrollbar preview (Smoother scrolling). While it is off the bridge
// keeps them closed to the page, as with layouts off, but the worker keeps them on disk.
test('while Smoother scrolling is off the bridge loads and writes no layouts, keeps them, and opens them live', async () => {
  const granted = (seek) => ({
    layoutConsent: 'granted',
    opts: { layout: true, older: seek, seek },
  });
  const w = workerFixture({ initialSettings: granted(true) });
  const identity = { account: 'a'.repeat(64), conv: 'b'.repeat(64) };
  const row = codec.pack({
    ...identity,
    turn: 'c'.repeat(64),
    msg: 'd'.repeat(64),
    digest: 'e'.repeat(64),
    layout: 'f'.repeat(64),
    time: Date.now(),
    h: 100,
    rowH: 100,
    turnOffset: 0,
    turnH: 100,
    w: 100,
    vw: 100,
    sw: 100,
    blocks: [20],
    items: [],
  });
  const { generation } = await w.message({ type: 'butter-layout-load', ...identity });
  await w.message({ type: 'butter-layout-put', ...identity, generation, records: [row] });
  assert.equal(w.disk.size, 1);
  // The update switches Smoother scrolling off: the worker keeps what is saved.
  w.changeSettings(granted(false));
  await w.message({ type: 'butter-layout-usage' });
  assert.equal(w.disk.size, 1, 'saved layouts are kept');
  let changed;
  const requests = [],
    responses = [],
    events = {};
  vm.runInNewContext(read('storage/layout-bridge.js'), {
    ButterStatus: status,
    indexedDB: { deleteDatabase: () => ({}) },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document: {
      addEventListener: (type, fn) => (events[type] = fn),
      dispatchEvent: (e) => responses.push(JSON.parse(e.detail)),
    },
    chrome: {
      storage: {
        local: { get: async () => ({ butter: granted(false) }) },
        onChanged: { addListener: (fn) => (changed = fn) },
      },
      runtime: {
        sendMessage: (m) => {
          requests.push(m.type);
          return w.message(m);
        },
      },
    },
  });
  await tick();
  const send = async (op) => {
    await events['butter-layout-request']({ detail: JSON.stringify({ id: 1, op, ...identity }) });
    return responses.at(-1);
  };
  assert.equal(responses[0].enabled, false, 'layouts on, Smoother scrolling off: closed');
  assert.deepEqual((await send('load')).records, []);
  await send('put');
  assert.deepEqual(requests, [], 'nothing reaches the worker');
  // Switching Smoother scrolling on opens them live, with what was saved.
  w.changeSettings(granted(true));
  changed({ butter: { newValue: granted(true) } }, 'local');
  assert.equal(responses.at(-1).enabled, true);
  assert.equal((await send('load')).records.length, 1);
  // And off again closes them, live.
  changed({ butter: { newValue: granted(false) } }, 'local');
  assert.equal(responses.at(-1).enabled, false);
});

test('trial site database is deleted once without reading it, and a blocked delete is retried', async () => {
  const saved = { butter: { layoutConsent: 'granted' } },
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
      ButterStatus: require('../extension/shared/status.js'),
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
test('actual popup pending switch is off, displays the consent note, and grants consent on click', async () => {
  const shared = sharedStorage({ lang: 'en', opts: { layout: true } });
  let click, html;
  const root = {
    classList: { toggle() {} },
    addEventListener: (type, fn) => (click = fn),
    append() {},
    querySelector: () => null,
  };
  const ctx = {
    ButterStatus: status,
    ButterPopup: require('../extension/popup/model.js'),
    structuredClone,
    chrome: {
      storage: { ...shared.storage, session: { get: async () => ({}) } },
      runtime: { getManifest: () => ({ version_name: '0.1.0-alpha.10' }) },
      tabs: { query: async () => [] },
    },
    document: {
      getElementById: () => root,
      documentElement: { classList: { toggle() {} } },
      createElement: () => ({
        set innerHTML(value) {
          html = value;
        },
        content: {},
      }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setInterval() {},
    clearInterval() {},
    clearTimeout() {},
    addEventListener() {},
  };
  vm.runInNewContext(read('popup/popup.js'), ctx);
  await tick();
  assert.doesNotMatch(html, /class="note"/, 'the main page has no layouts row');
  click({ target: { closest: () => ({ dataset: { go: 'experimental' } }) } });
  assert.match(html, /<div class="note">Off until you turn it on\./);
  assert.match(html, /aria-checked="false"[^>]*data-switch="layout"/);
  click({ target: { closest: () => ({ dataset: { switch: 'layout' } }) } });
  await tick();
  assert.equal(shared.value().layoutConsent, 'granted');
  assert.equal(shared.value().opts.layout, true);
  assert.doesNotMatch(html, /class="note"/);
});

test('a delayed popup startup read cannot undo a newer consent choice', async () => {
  const pending = { lang: 'en', opts: { layout: true } };
  const shared = sharedStorage(pending);
  let resolveInitialGet, click;
  const root = {
    classList: { toggle() {} },
    addEventListener: (type, fn) => (click = fn),
    append() {},
  };
  const popupStorage = {
    ...shared.storage,
    local: {
      ...shared.storage.local,
      get: () => new Promise((resolve) => (resolveInitialGet = resolve)),
    },
    session: { get: async () => ({}) },
  };
  vm.runInNewContext(read('popup/popup.js'), {
    ButterStatus: status,
    ButterPopup: require('../extension/popup/model.js'),
    structuredClone,
    chrome: {
      storage: popupStorage,
      runtime: {
        getManifest: () => ({ version_name: '0.1.0-alpha.10' }),
        sendMessage: async () => ({ conversations: 0, bytes: 0 }),
      },
      tabs: { query: async () => [] },
    },
    document: {
      getElementById: () => root,
      documentElement: { classList: { toggle() {} } },
      createElement: () => ({ set innerHTML(value) {}, content: {} }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setInterval() {},
    clearInterval() {},
    clearTimeout() {},
    addEventListener() {},
  });
  // Another popup grants consent while this one's startup read is still out.
  await shared.storage.local.set({ butter: status.toggleGroup(pending, 'layout') });
  assert.equal(shared.value().layoutConsent, 'granted');
  resolveInitialGet({ butter: pending });
  await tick();
  click({ target: { closest: () => ({ dataset: { lang: 'zh' } }) } });
  await tick();
  assert.equal(
    shared.value().layoutConsent,
    'granted',
    'the stale startup snapshot must not be saved back',
  );
});
