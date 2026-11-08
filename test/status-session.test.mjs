import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const extension = new URL('../extension/', import.meta.url).pathname;
function worker(session) {
  const listeners = [],
    changed = [];
  const ctx = vm.createContext({
    console,
    TextEncoder,
    crypto: globalThis.crypto,
    chrome: {
      runtime: { id: 'test', onMessage: { addListener: (fn) => listeners.push(fn) } },
      commands: { onCommand: { addListener() {} } },
      storage: {
        local: { get: async () => ({}) },
        session: {
          get: async () => structuredClone(session),
          set: async (x) => Object.assign(session, structuredClone(x)),
        },
        onChanged: { addListener: (fn) => changed.push(fn) },
      },
    },
    importScripts: (...files) =>
      files.forEach((file) =>
        vm.runInContext(fs.readFileSync(path.resolve(extension, 'storage', file), 'utf8'), ctx),
      ),
  });
  vm.runInContext(fs.readFileSync(path.join(extension, 'storage/layout-worker.js'), 'utf8'), ctx);
  return (states, id = 'test') =>
    new Promise((resolve) => {
      let handled = false;
      for (const fn of listeners)
        handled = fn({ type: 'butter-status-record', states }, { id }, resolve) || handled;
      if (!handled) resolve(undefined);
    });
}
test('session failures survive new workers and serialize concurrent chat probes', async () => {
  const session = {},
    first = worker(session);
  await Promise.all([first({ rail: 'fail' }), first({ older: 'fail' })]);
  assert.deepEqual(session.butterFailures, { rail: { rail: true }, scrolling: { older: true } });
  const restarted = worker(session);
  await restarted({ rail: 'idle', older: 'off' });
  assert.deepEqual(session.butterFailures, { rail: { rail: true }, scrolling: { older: true } });
  await restarted({ rail: 'ok' });
  assert.deepEqual(session.butterFailures, { scrolling: { older: true } });
  await restarted({ older: 'ok' });
  assert.deepEqual(session.butterFailures, {});
  assert.equal(await restarted({ rail: 'fail' }, 'external'), undefined);
  assert.deepEqual(session.butterFailures, {});
});

test('settings probes merge seek and layout failures into their groups and clear them on success', async () => {
  const session = {},
    record = worker(session),
    listeners = new Map();
  const status = (await import('../extension/shared/status.js')).default;
  let facts = {},
    receive;
  const root = {
    toggleAttribute() {},
    getAttribute: () => null,
    hasAttribute: () => false,
    removeAttribute() {},
    setAttribute() {},
  };
  const ctx = {
    ButterStatus: status,
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    performance: { now: () => 10000 },
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(type, o = {}) {
        this.type = type;
        this.detail = o.detail;
      }
    },
    document: {
      documentElement: root,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      dispatchEvent: (e) => {
        if (e.type === 'butter-status-request')
          listeners.get('butter-status-response')?.({ detail: JSON.stringify(facts) });
      },
    },
    chrome: {
      storage: {
        local: { get: async () => ({ butter: { layoutConsent: 'granted' } }) },
        onChanged: { addListener() {} },
      },
      runtime: {
        onMessage: { addListener: (fn) => (receive = fn) },
        sendMessage: (m) => record(m.states),
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(extension, 'shared/settings.js'), 'utf8'), ctx);
  const probe = () => new Promise((resolve) => receive({ type: 'butter-status' }, {}, resolve));
  await probe();
  assert.deepEqual(session.butterFailures, {});
  facts = { seek: { exercised: true, failed: true }, layout: { exercised: true, failed: true } };
  const bad = await probe();
  assert.equal(bad.states.seek, 'fail');
  assert.equal(bad.states.layout, 'fail');
  assert.deepEqual(session.butterFailures, { scrolling: { seek: true }, layout: { layout: true } });
  facts = {};
  await probe();
  assert.deepEqual(session.butterFailures, { scrolling: { seek: true }, layout: { layout: true } });
  facts = { seek: { exercised: true, engaged: true }, layout: { exercised: true, engaged: true } };
  await probe();
  assert.deepEqual(session.butterFailures, {});
});
test('the worker records a branch failure as its own group and clears it on a branch success', async () => {
  const session = {},
    record = worker(session);
  assert.deepEqual(structuredClone(await record({ branch: 'fail', rail: 'ok' })), {
    branch: { branch: true },
  });
  assert.deepEqual(session.butterFailures, { branch: { branch: true } });
  await record({ branch: 'off' });
  assert.deepEqual(session.butterFailures, { branch: { branch: true } });
  await record({ branch: 'ok' });
  assert.deepEqual(session.butterFailures, {});
});

test('Ask in branch reports a confirmed failure at once, and a later successful branch clears it', async () => {
  const session = {},
    record = worker(session),
    sent = [];
  const status = (await import('../extension/shared/status.js')).default;
  const noop = () => {};
  let receive;
  const ctx = {
    ButterStatus: status,
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    performance: { now: () => 10000 },
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    document: {
      documentElement: {
        toggleAttribute: noop,
        getAttribute: () => null,
        hasAttribute: () => false,
        removeAttribute: noop,
        setAttribute: noop,
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop,
    },
    chrome: {
      storage: { local: { get: async () => ({}) }, onChanged: { addListener: noop } },
      runtime: {
        onMessage: { addListener: (fn) => (receive = fn) },
        sendMessage: (m) => (sent.push(m.states), record(m.states)),
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(extension, 'shared/settings.js'), 'utf8'), ctx);
  // The branch tab may be closed before the popup ever asks, so the report is recorded at once.
  await ctx.ButterSettings.report('branch', { exercised: true, failed: true });
  assert.deepEqual(session.butterFailures, { branch: { branch: true } });
  assert.equal(sent.at(-1).branch, 'fail');
  // Only the branch moved; other features stay idle, so their evidence is untouched.
  assert.ok(
    Object.entries(sent.at(-1)).every(([k, v]) => k === 'branch' || v === 'idle' || v === 'off'),
  );
  // The popup's probe of this tab still sees it, from the worker's record.
  const probed = await new Promise((resolve) => receive({ type: 'butter-status' }, {}, resolve));
  assert.deepEqual({ ...probed.failures.branch }, { branch: true });
  await ctx.ButterSettings.report('branch', { exercised: true, engaged: true });
  assert.deepEqual(session.butterFailures, {});
});

// One ChatGPT tab running extension/shared/settings.js, recording to the shared worker.
async function chatTab(record) {
  const status = (await import('../extension/shared/status.js')).default;
  const noop = () => {};
  let receive;
  const ctx = {
    ButterStatus: status,
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    performance: { now: () => 10000 },
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    document: {
      documentElement: {
        toggleAttribute: noop,
        getAttribute: () => null,
        hasAttribute: () => false,
        removeAttribute: noop,
        setAttribute: noop,
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop,
    },
    chrome: {
      storage: { local: { get: async () => ({}) }, onChanged: { addListener: noop } },
      runtime: {
        onMessage: { addListener: (fn) => (receive = fn) },
        sendMessage: (m) => record(m.states),
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(extension, 'shared/settings.js'), 'utf8'), ctx);
  return {
    report: (key, fact) => ctx.ButterSettings.report(key, fact),
    probe: () => new Promise((resolve) => receive({ type: 'butter-status' }, {}, resolve)),
  };
}

test('a later probe of a tab never replays its old branch outcome over a newer one', async () => {
  const session = {},
    record = worker(session);
  const a = await chatTab(record),
    b = await chatTab(record);
  // Tab A fails, tab B then makes a branch and clears the warning.
  await a.report('branch', { exercised: true, failed: true });
  await b.report('branch', { exercised: true, engaged: true });
  assert.deepEqual(session.butterFailures, {});
  // The popup probing tab A must not bring the failure back.
  await a.probe();
  assert.deepEqual(session.butterFailures, {});
  // And the other way round: probing B (older success) must not erase A's newer failure.
  await a.report('branch', { exercised: true, failed: true });
  await b.probe();
  assert.deepEqual(session.butterFailures, { branch: { branch: true } });
});
