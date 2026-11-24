// A fake DOM for stream/offscreen.js (the off-screen marker): one turn whose answer holds `blocks`
// answer blocks, and drivers for what the browser and ChatGPT report to the marker: sizes
// (ResizeObserver), content-visibility state changes, timers (the flush), completion of the answer
// and the `cv` setting. `calls` logs the marker's effects in order (attribute writes, observe).
const vm = require('node:vm');
const fs = require('node:fs');

const VEIL = 'data-butter-veil';

function offscreenFixture({ blocks: count = 1 } = {}) {
  const listeners = {},
    timers = [],
    observed = new Set(),
    calls = [];
  let resized, mutated;
  let streaming = true,
    off = false;
  const select = (list, s) => {
    const name = /^\[([\w-]+)\]$/.exec(s)?.[1];
    return name ? list.filter((e) => e.hasAttribute(name)) : list;
  };
  const el = (attrs = {}) => ({
    attrs: { ...attrs },
    isConnected: true,
    firstElementChild: null,
    hasAttribute(n) {
      return n in this.attrs;
    },
    getAttribute(n) {
      return this.attrs[n] ?? null;
    },
    setAttribute(n, v) {
      calls.push(['set', this, n]);
      this.attrs[n] = v;
    },
    removeAttribute(n) {
      if (n in this.attrs) calls.push(['remove', this, n]);
      delete this.attrs[n];
    },
    matches: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  // An answer block matches the marker's block selectors, which name the answer column.
  const blocks = Array.from({ length: count }, () => ({
    ...el(),
    matches: (s) => s.includes('assistant-message'),
  }));
  const turn = el({ 'data-turn-key': 'a' });
  turn.matches = (s) => s.includes('in_progress') && streaming;
  turn.contains = (x) => x === turn || blocks.includes(x);
  turn.querySelectorAll = (s) => select(blocks, s);
  const state = { ...el(), closest: () => turn };
  const root = {
    ...el(),
    firstElementChild: turn,
    querySelectorAll: (s) => select([turn, ...blocks], s),
    getAttribute: (n) => (n === 'data-butter-off' && off ? 'cv' : null),
  };
  const context = {
    document: {
      documentElement: root,
      addEventListener: (n, fn) => (listeners[n] = fn),
      querySelectorAll: (s) => root.querySelectorAll(s),
    },
    ResizeObserver: class {
      constructor(fn) {
        resized = fn;
      }
      observe(e) {
        calls.push(['observe', e]);
        observed.add(e);
      }
      unobserve(e) {
        observed.delete(e);
      }
      disconnect() {
        observed.clear();
      }
    },
    MutationObserver: class {
      constructor(fn) {
        mutated = fn;
      }
      observe() {}
    },
    setTimeout: (fn) => timers.push(fn),
    requestAnimationFrame: (fn) => fn(),
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve('../../extension/stream/offscreen.js'), 'utf8'),
    context,
  );
  return {
    block: blocks[0],
    blocks,
    turn,
    observed,
    calls,
    seen: (e) => e.hasAttribute('data-butter-seen'),
    unrendered: (e) => e.hasAttribute('data-butter-unrendered'),
    veiled: (e) => e.hasAttribute(VEIL),
    size: (target, height) => resized([{ target, contentRect: { height } }]),
    cv: (target, skipped) => listeners.contentvisibilityautostatechange({ target, skipped }),
    timers: () => timers.splice(0).forEach((fn) => fn()),
    complete: () => {
      streaming = false;
      mutated([{ type: 'attributes', target: state, addedNodes: [] }]);
    },
    // The `cv` setting (Smoother streaming's off-screen skipping), off also when Butter is paused.
    setting: (on) => {
      off = !on;
      listeners['butter-settings']();
    },
  };
}

module.exports = { offscreenFixture, VEIL };
