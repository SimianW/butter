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
