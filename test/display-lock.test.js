// Geometry and style reads inside a turn that content-visibility skips force Chrome to style and
// lay out that whole turn first (a DisplayLock update). For a long math answer that was 0.6 s, after
// every wheel burst (the layout fingerprint) and at the start of every scrollbar drag (the seek
// preview's text colour), right when the user goes back to typing.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture() {
  const listeners = {},
    reads = [];
  class Element {
    get clientWidth() {
      return 768;
    }
  }
  const column = (name, turn) =>
    Object.assign(new Element(), {
      name,
      closest: (s) => (s === '[data-turn-key]' ? turn : null),
      getBoundingClientRect: () => (reads.push(name), { width: 720 }),
    });
  const turnA = Object.assign(new Element(), { dataset: { turnKey: 'a' } }),
    turnB = Object.assign(new Element(), { dataset: { turnKey: 'b' } });
  const columns = [column('a', turnA), column('b', turnB)];
  const MD = '[data-markdown-text-style="assistant-message"]';
  const sc = Object.assign(new Element(), {
    clientHeight: 900,
    querySelector: (s) => (s === MD ? columns[0] : null),
    querySelectorAll: (s) => (s === MD ? columns : []),
  });
  const html = {
    className: 'light',
    getAttribute: () => null,
    hasAttribute: () => false,
  };
  const context = {
    document: {
      documentElement: html,
      scripts: [],
      addEventListener: (n, fn) => (listeners[n] = fn),
      querySelectorAll: (s) => (s === '[data-turn-key]' ? [] : [sc]),
      dispatchEvent() {},
    },
    location: { pathname: '/c/00000000-0000-0000-0000-000000000000' },
    innerWidth: 1600,
    devicePixelRatio: 1,
    Element,
    performance: { now: () => 1 },
    __butterSeekCore: require('../extension/seek/core-main.js'),
    __butterLayoutCheck: require('../extension/seek/layout-check-main.js'),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
    },
    MutationObserver: class {
      observe() {}
    },
    requestIdleCallback: () => 1,
    getComputedStyle: (el) => (reads.push('style:' + (el.name || 'scroller')), { font: '16px x' }),
    CustomEvent: class {},
    crypto: require('node:crypto').webcrypto,
    TextEncoder,
    setTimeout: () => 1,
    clearTimeout: () => {},
    queueMicrotask,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve('../extension/seek/layout-cache-main.js'), 'utf8'),
    context,
  );
  const cv = (target, skipped) =>
    listeners.contentvisibilityautostatechange({
      target: Object.assign(target, { closest: () => target }),
      skipped,
    });
  return { api: context.__butterLayoutCache, sc, turnA, turnB, reads, cv };
}

test('the layout fingerprint reads an answer column that is rendered, not one being skipped', () => {
  const f = fixture();
  f.cv(f.turnA, true);
  f.api.refreshLayout(f.sc);
  assert.deepEqual(f.reads, ['b', 'style:b']);
  assert.equal(f.api.column(f.sc).name, 'b', 'the seek preview takes its text style from it too');
});

test('a column comes back into use once its turn renders again', () => {
  const f = fixture();
  f.cv(f.turnA, true);
  f.cv(f.turnA, false);
  f.api.refreshLayout(f.sc);
  assert.deepEqual(f.reads, ['a', 'style:a']);
});

test('with every answer skipped, the first column is still read', () => {
  const f = fixture();
  f.cv(f.turnA, true);
  f.cv(f.turnB, true);
  f.api.refreshLayout(f.sc);
  assert.deepEqual(f.reads, ['a', 'style:a']);
});
