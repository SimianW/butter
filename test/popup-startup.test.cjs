const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const status = require('../extension/shared/status.js');
const tick = () => new Promise(setImmediate);

// Loads the real popup with startup storage reads the test resolves by hand.
function popup() {
  let changed, resolveLocal, resolveSession;
  const context = vm.createContext({
    ButterStatus: status,
    ButterPopup: require('../extension/popup/model.js'),
    structuredClone,
    chrome: {
      storage: {
        local: { get: () => new Promise((resolve) => (resolveLocal = resolve)) },
        session: { get: () => new Promise((resolve) => (resolveSession = resolve)) },
        onChanged: { addListener: (fn) => (changed = fn) },
      },
      runtime: {
        getManifest: () => ({ version_name: '0.1.0-alpha.10' }),
        sendMessage: async () => ({ conversations: 0, bytes: 0 }),
      },
      tabs: { query: async () => [] },
    },
    document: {
      getElementById: () => ({ classList: { toggle() {} }, addEventListener() {}, append() {} }),
      documentElement: { classList: { toggle() {} } },
      createElement: () => ({ set innerHTML(value) {}, content: {} }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setInterval() {},
    clearInterval() {},
    clearTimeout() {},
    addEventListener() {},
  });
  const source = path.join(__dirname, '../extension/popup/popup.js');
  vm.runInContext(fs.readFileSync(source, 'utf8'), context);
  return {
    changed: (...args) => changed(...args),
    finish: (local, session) => {
      resolveLocal(local);
      resolveSession(session);
    },
    read: (expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
  };
}

test('a stale startup session read cannot bring back a warning that was already cleared', async () => {
  const f = popup();
  f.changed({ butterFailures: { newValue: {} } }, 'session');
  f.finish({ butter: { layoutConsent: 'granted' } }, { butterFailures: { rail: { rail: true } } });
  await tick();
  assert.deepEqual(f.read('failures'), {});
});
