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
      storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } },
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
