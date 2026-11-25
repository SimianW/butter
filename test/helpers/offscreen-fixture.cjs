// A fake DOM for stream/offscreen.js (the off-screen marker): one turn whose answer holds `blocks`
// answer blocks, and drivers for what the browser and ChatGPT report to the marker: sizes
// (ResizeObserver), content-visibility state changes, timers (the flush), completion of the answer
// and the `cv` setting. `calls` logs the marker's effects in order (attribute writes, observe).
// For the state paths (Stop, Regenerate, Edit, version switch, hidden chat, remount): elements
// leave and come back (`detach`, `attach`, `leave`, `back`), the answer's blocks are replaced
// (`replace`), the turn goes back to in_progress (`restart`), and with `{ frames: false }` no frame
// runs until `frame()` (a hidden tab).
const vm = require('node:vm');
const fs = require('node:fs');

const VEIL = 'data-butter-veil';

function offscreenFixture({ blocks: count = 1, frames = true } = {}) {
  const listeners = {},
    timers = [],
    rafs = [],
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
    nodeType: 1,
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
  // An answer block matches the marker's block selectors, which name the answer column; its
  // closest streaming turn is the turn while the answer is in_progress and the block is in it.
  const block = () => ({
    ...el(),
    matches: (s) => s.includes('assistant-message'),
    closest(s) {
      return this.isConnected && (s.includes('in_progress') ? streaming : s.includes('turn-key'))
        ? turn
        : null;
    },
  });
  const blocks = Array.from({ length: count }, block);
  const turn = el({ 'data-turn-key': 'a' });
  turn.matches = (s) => (s.includes('in_progress') ? streaming : s.includes('turn-key'));
  turn.contains = (x) => x === turn || blocks.includes(x);
  turn.querySelectorAll = (s) => select(blocks, s);
  Object.defineProperty(turn, 'firstElementChild', { get: () => blocks[0] ?? null });
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
    requestAnimationFrame: (fn) => (frames ? fn() : rafs.push(fn)),
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve('../../extension/stream/offscreen.js'), 'utf8'),
    context,
  );
  const added = (nodes) => mutated([{ type: 'childList', target: root, addedNodes: nodes }]);
  const attach = (...els) => {
    for (const e of els) e.isConnected = true;
    added(els);
  };
  const detach = (...els) => els.forEach((e) => (e.isConnected = false));
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
    // The turn leaves in_progress. Not observed: the turn was out of the document then.
    complete: ({ observed = true } = {}) => {
      streaming = false;
      if (observed) mutated([{ type: 'attributes', target: state, addedNodes: [] }]);
    },
    // The turn goes back to in_progress (a regenerated answer streams into it).
    restart: () => {
      streaming = true;
      mutated([{ type: 'attributes', target: state, addedNodes: [] }]);
    },
    detach,
    attach,
    // The whole turn leaves the document, and comes back as one inserted node.
    leave: () => detach(turn, ...blocks),
    back: () => {
      for (const e of [turn, ...blocks]) e.isConnected = true;
      added([turn]);
    },
    // ChatGPT removes the answer's blocks and inserts `n` new ones; returns them.
    replace: (n) => {
      detach(...blocks);
      blocks.splice(0, blocks.length, ...Array.from({ length: n }, block));
      added([...blocks]);
      return [...blocks];
    },
    frame: () => rafs.splice(0).forEach((fn) => fn()),
    // The `cv` setting (Smoother streaming's off-screen skipping), off also when Butter is paused.
    setting: (on) => {
      off = !on;
      listeners['butter-settings']();
    },
  };
}

module.exports = { offscreenFixture, VEIL };
