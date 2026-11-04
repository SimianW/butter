import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import status from '../extension/shared/status.js';

test('seek follows the master and seek switches independently of the rail and other feature options', async () => {
  const attrs = new Map();
  let changed;
  const root = {
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, value),
    hasAttribute: (name) => attrs.has(name),
    removeAttribute: (name) => attrs.delete(name),
    toggleAttribute(name, on) {
      if (on) attrs.set(name, '');
      else attrs.delete(name);
    },
  };
  const ctx = vm.createContext({
    ButterStatus: status,
    document: { documentElement: root, dispatchEvent() {}, querySelectorAll: () => [] },
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {},
    chrome: {
      storage: {
        local: { get: async () => ({ butter: { opts: { rail: false } } }) },
        onChanged: {
          addListener: (fn) => {
            changed = fn;
          },
        },
      },
      runtime: { onMessage: { addListener() {} } },
    },
  });
  vm.runInContext(
    fs.readFileSync(new URL('../extension/shared/settings.js', import.meta.url), 'utf8'),
    ctx,
  );
  await Promise.resolve();
  assert.equal(attrs.get('data-butter-off'), 'rail');
  assert.equal(attrs.has('data-butter-disabled'), false);
  changed({ butter: { newValue: { enabled: false } } }, 'local');
  assert.equal(attrs.has('data-butter-disabled'), true);
  changed(
    {
      butter: {
        newValue: { enabled: true, opts: Object.fromEntries(status.keys.map((k) => [k, false])) },
      },
    },
    'local',
  );
  assert.equal(attrs.has('data-butter-disabled'), false);
  assert.equal(attrs.get('data-butter-off'), status.keys.join(' '));
});

test('seek off marker prevents a trusted thumb press from preparing preview', () => {
  const events = {},
    attrs = new Map([['data-butter-off', 'seek']]);
  let preparations = 0;
  class Element {}
  const sc = new Element();
  Object.assign(sc, {
    isConnected: true,
    scrollHeight: 3000,
    clientHeight: 500,
    scrollTop: 100,
    clientWidth: 700,
    offsetWidth: 715,
    getBoundingClientRect: () => ({ left: 0, right: 715, top: 0, bottom: 500 }),
    closest: () => sc,
  });
  const ctx = vm.createContext({
    __butterSeekCore: { createActivation: () => ({ cancel() {} }) },
    __butterLayoutCheck: {},
    document: {
      documentElement: { hasAttribute: () => false, getAttribute: (key) => attrs.get(key) },
      addEventListener: (key, fn) => (events[key] ||= []).push(fn),
      querySelectorAll: () => [sc],
    },
    addEventListener: (key, fn) => (events[key] ||= []).push(fn),
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    window: {},
    Element,
    performance: { now: () => 0 },
    MutationObserver: class {
      observe() {}
    },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: () => 1,
    setInterval: () => 1,
    clearTimeout() {},
    requestAnimationFrame: () => 1,
    getComputedStyle: () => ({ direction: 'ltr' }),
    __butterLayoutCache: {
      dump: () => ({}),
      prepare: () => {
        preparations++;
      },
    },
  });
  // Evaluate the actual bootstrap and deliver its registered press listeners.
  vm.runInContext(
    fs.readFileSync(new URL('../extension/seek/preview-main.js', import.meta.url), 'utf8'),
    ctx,
  );
  for (const fn of events.pointerdown || [])
    fn({
      isTrusted: true,
      button: 0,
      clientX: 710,
      clientY: 100,
      target: sc,
      composedPath: () => [sc],
    });
  assert.equal(preparations, 0);
  assert.equal(ctx.__butterSeeking(), false);
  assert.equal(ctx.window.__seekDump().presses.length, 0);
  attrs.delete('data-butter-off');
  for (const fn of events.pointerdown || [])
    fn({
      type: 'pointerdown',
      timeStamp: 100,
      isTrusted: true,
      button: 0,
      clientX: 710,
      clientY: 100,
      target: {},
    });
  assert.equal(ctx.window.__seekDump().presses.length, 1);
  attrs.set('data-butter-off', 'seek');
  for (const fn of events.pointerdown || [])
    fn({ type: 'pointerdown', timeStamp: 200, isTrusted: true, button: 0, target: {} });
  assert.equal(ctx.window.__seekDump().presses.length, 1);
});
