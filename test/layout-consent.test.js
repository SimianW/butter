const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const status = require('../extension/shared/status.js');
const { workerFixture } = require('./helpers/layout-fixture.cjs');
const codec = require('../extension/seek/layout-codec.js');
const read = (file) => fs.readFileSync(require.resolve('../extension/' + file), 'utf8');
const tick = () => new Promise(setImmediate);

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
    const choice = status.chooseLayout({ lang: 'zh', enabled: false }, granted);
    assert.equal(choice.layoutConsent, granted ? 'granted' : 'declined');
    assert.equal(choice.opts.layout, granted);
    assert.equal(choice.lang, 'zh');
    assert.equal(choice.enabled, false);
    assert.deepEqual(status.normalize(choice), choice);
  }
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
    f.changeSettings(status.chooseLayout(initialSettings, true));
    const { generation } = await load();
    await put(generation);
    assert.ok((await usage()).bytes > 0);
    f.changeSettings(status.chooseLayout(initialSettings, false));
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
  changed({ butter: { newValue: status.chooseLayout({}, true) } }, 'local');
  assert.equal(responses.at(-1).enabled, true);
  assert.deepEqual(migrations, ['butter-seek-cold-geometry-v1']);
  await send('load');
  assert.equal(requests.length, 1);
  changed({ butter: { newValue: status.chooseLayout({}, false) } }, 'local');
  assert.equal(responses.at(-1).enabled, false);
  await send('put');
  assert.equal(requests.length, 1);
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
function cardTab(shared) {
  const events = {},
    timers = [];
  let host, clicked;
  const card = { setAttribute() {} };
  const shadow = {
    append() {},
    querySelector: () => card,
    addEventListener: (type, fn) => (clicked = fn),
  };
  const ctx = {
    ButterStatus: status,
    FontFace: class {
      load() {
        return Promise.resolve();
      }
    },
    innerHeight: 900,
    chrome: { storage: shared.storage, runtime: { getURL: (p) => 'chrome-extension://test/' + p } },
    document: {
      readyState: 'complete',
      fonts: { add() {} },
      documentElement: { classList: { contains: () => false }, append() {} },
      querySelectorAll: () => [],
      createElement: (type) => {
        if (type === 'chatgpt-butter-consent')
          host = {
            hidden: true,
            attachShadow: () => shadow,
            toggleAttribute() {},
            removeAttribute() {},
            setAttribute() {},
            style: { setProperty() {} },
            getBoundingClientRect: () => ({ left: 1110, right: 1410 }),
          };
        return host && type === 'chatgpt-butter-consent'
          ? host
          : { append() {}, setAttribute() {} };
      },
    },
    getComputedStyle: () => ({ colorScheme: 'light' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class {
      observe() {}
    },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.fn = () => {};
    },
    requestAnimationFrame: (fn) => fn(),
    addEventListener: (type, fn) => (events[type] = fn),
  };
  vm.runInNewContext(read('consent/layout-consent.js'), ctx);
  return {
    host: () => host,
    card,
    elapse: (ms) =>
      timers
        .filter((t) => t.ms === ms)
        .splice(0)
        .forEach((t) => {
          const fn = t.fn;
          t.fn = () => {};
          fn();
        }),
    click: async (yes, trusted = true) => {
      clicked({
        isTrusted: trusted,
        target: { closest: () => ({ dataset: { choice: yes ? 'yes' : 'no' } }) },
      });
      await tick();
    },
  };
}

test('card waits for load delay, never steals focus, and choices hide live in every tab and on revisit', async () => {
  for (const yes of [true, false]) {
    const shared = sharedStorage({ lang: 'zh' });
    const a = cardTab(shared),
      b = cardTab(shared);
    await tick();
    assert.equal(a.host(), undefined);
    a.elapse(1000);
    b.elapse(1000);
    assert.equal(a.host().hidden, false);
    assert.equal(b.host().hidden, false);
    assert.match(a.card.innerHTML, /好的/);
    await a.click(yes, false);
    assert.equal(
      shared.value().layoutConsent,
      undefined,
      'Page-script clicks cannot grant consent',
    );
    await a.click(yes);
    assert.equal(shared.value().layoutConsent, yes ? 'granted' : 'declined');
    assert.equal(shared.value().opts.layout, yes);
    assert.equal(a.host().inert, true);
    assert.equal(b.host().inert, true);
    a.elapse(160);
    b.elapse(160);
    assert.equal(a.host().hidden, true);
    assert.equal(b.host().hidden, true);
    const revisit = cardTab(shared);
    await tick();
    revisit.elapse(1000);
    assert.equal(revisit.host(), undefined);
  }
});

test('master off hides the pending card and re-enabling restores it without deciding consent', async () => {
  const shared = sharedStorage({ enabled: false });
  const tab = cardTab(shared);
  await tick();
  tab.elapse(1000);
  assert.equal(tab.host(), undefined);
  await shared.storage.local.set({ butter: { enabled: true } });
  assert.equal(tab.host().hidden, false);
  await shared.storage.local.set({ butter: { enabled: false } });
  assert.equal(tab.host().hidden, true);
  assert.equal(status.normalize(shared.value()).layoutConsent, 'pending');
});

test('actual popup pending switch is off, displays the consent line, and grants consent on click', async () => {
  const shared = sharedStorage({ lang: 'en', opts: { layout: true } });
  let click, html;
  const root = {
    classList: { toggle() {} },
    addEventListener: (type, fn) => (click = fn),
    append() {},
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
  assert.match(html, /Not on yet · turning it on means you agree/);
  assert.match(html, /aria-checked="false"[^>]*data-switch="layout"/);
  click({ target: { closest: () => ({ dataset: { switch: 'layout' } }) } });
  await tick();
  assert.equal(shared.value().layoutConsent, 'granted');
  assert.equal(shared.value().opts.layout, true);
  assert.doesNotMatch(html, /Not on yet/);
});
