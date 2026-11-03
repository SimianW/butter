import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import status from '../extension/butter-status.js';

test('seek follows the master switch independently of the rail and every existing option', async () => {
  const attrs = new Map(); let changed;
  const root = {
    getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, value),
    hasAttribute: name => attrs.has(name),
    removeAttribute: name => attrs.delete(name),
    toggleAttribute(name, on) { if (on) attrs.set(name, ''); else attrs.delete(name); },
  };
  const ctx = vm.createContext({
    ButterStatus: status, document: { documentElement: root, dispatchEvent() {}, querySelectorAll: () => [] },
    MutationObserver: class { observe() {} }, CustomEvent: class {},
    chrome: { storage: { local: { get: async () => ({ butter: { opts: { rail: false } } }) },
      onChanged: { addListener: fn => { changed = fn; } } }, runtime: { onMessage: { addListener() {} } } },
  });
  vm.runInContext(fs.readFileSync(new URL('../extension/butter-settings.js', import.meta.url), 'utf8'), ctx);
  await Promise.resolve();
  assert.equal(attrs.get('data-butter-off'), 'rail');
  assert.equal(attrs.has('data-butter-disabled'), false);
  changed({ butter: { newValue: { enabled: false } } }, 'local');
  assert.equal(attrs.has('data-butter-disabled'), true);
  changed({ butter: { newValue: { enabled: true, opts: Object.fromEntries(status.keys.map(k => [k, false])) } } }, 'local');
  assert.equal(attrs.has('data-butter-disabled'), false);
  assert.equal(attrs.get('data-butter-off'), status.keys.join(' '));
});
