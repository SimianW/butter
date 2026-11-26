// A fake DOM for stream/offscreen.js (the off-screen marker): one turn whose answer holds `blocks`
// answer blocks, and drivers for what the browser and ChatGPT report to the marker: sizes
// (ResizeObserver), content-visibility state changes, timers (the flush), completion of the answer
// and the `cv` setting. `calls` logs the marker's effects in order (attribute writes, observe).
// For the state paths (Stop, Regenerate, Edit, version switch, hidden chat, remount): elements
// leave and come back (`detach`, `attach`, `leave`, `back`), the answer's blocks are replaced
// (`replace`), the turn goes back to in_progress (`restart`), and with `{ frames: false }` no frame
// runs until `frame()` (a hidden tab).
// For pre-layout: idle callbacks run only when `idle()` is called, on a fake clock that each layout
// read inside a block (a Range over its contents) advances by `readMs`; `laidOut` lists the blocks
// read, in order; `idleTimeouts` the timeout each idle callback was requested with, and
// `idle({ timedOut: true })` runs them as on a page that is never idle: on their timeout, with no idle
// time left; `hide()`/`show()` set the document's visibility and report the change, `fontsLoaded()`
// reports web fonts done loading, and `complete({ from })` names the state the turn left (an opened
// chat's turn was never in_progress). A query over the document finds only connected elements.
const vm = require('node:vm');
const fs = require('node:fs');

const VEIL = 'data-butter-veil';

function offscreenFixture({ blocks: count = 1, frames = true, readMs = 1 } = {}) {
  const listeners = {},
    timers = [],
    rafs = [],
    observed = new Set(),
    calls = [],
    idles = [],
    idleTimeouts = [],
    laidOut = [],
    fontListeners = [];
  let resized,
    mutated,
    clock = 0,
    visibility = 'visible';
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
  // The element that carries data-talvt-turn-state: it matches in_progress while the answer streams.
  const state = {
    ...el(),
    closest: () => turn,
    matches: (s) => s.includes('in_progress') && streaming,
  };
  const root = {
    ...el(),
    firstElementChild: turn,
    querySelectorAll: (s) =>
      select(
        [turn, ...blocks].filter((e) => e.isConnected),
        s,
      ),
    getAttribute: (n) => (n === 'data-butter-off' && off ? 'cv' : null),
  };
  const context = {
    document: {
      documentElement: root,
      addEventListener: (n, fn) => (listeners[n] = fn),
      querySelectorAll: (s) => root.querySelectorAll(s),
      get visibilityState() {
        return visibility;
      },
      fonts: { addEventListener: (n, fn) => n === 'loadingdone' && fontListeners.push(fn) },
      createRange: () => ({
        selectNodeContents(e) {
          this.node = e;
        },
        getBoundingClientRect() {
          laidOut.push(this.node);
          clock += readMs;
          return {};
        },
      }),
    },
    performance: { now: () => clock },
    requestIdleCallback: (fn, opts) => (idleTimeouts.push(opts?.timeout), idles.push(fn)),
    cancelIdleCallback: (id) => (idles[id - 1] = null),
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
    complete: ({ observed = true, from = 'in_progress' } = {}) => {
      streaming = false;
      if (observed)
        mutated([{ type: 'attributes', target: state, addedNodes: [], oldValue: from }]);
    },
    // The turn goes back to in_progress (a regenerated answer streams into it); `from` names the
    // state it left (in_progress when ChatGPT sets the state again while the answer streams).
    restart: ({ from = 'complete' } = {}) => {
      streaming = true;
      mutated([{ type: 'attributes', target: state, addedNodes: [], oldValue: from }]);
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
    laidOut,
    idleTimeouts,
    // Runs idle callbacks, including the ones they request, until none is left (or `max` ran), each
    // with up to 50 ms of idle time, or with `timedOut` on its timeout with none; returns how long
    // each one took on the fake clock.
    idle: ({ max = Infinity, timedOut = false } = {}) => {
      const took = [];
      while (took.length < max && idles.some(Boolean)) {
        const i = idles.findIndex(Boolean);
        const fn = idles[i];
        idles[i] = null;
        const start = clock;
        fn({
          didTimeout: timedOut,
          timeRemaining: () => (timedOut ? 0 : Math.max(0, start + 50 - clock)),
        });
        took.push(clock - start);
      }
      return took;
    },
    hide: () => ((visibility = 'hidden'), listeners.visibilitychange?.()),
    show: () => ((visibility = 'visible'), listeners.visibilitychange?.()),
    fontsLoaded: () => fontListeners.forEach((fn) => fn({})),
    // The `cv` setting (Smoother streaming's off-screen skipping), off also when Butter is paused.
    setting: (on) => {
      off = !on;
      listeners['butter-settings']();
    },
  };
}

module.exports = { offscreenFixture, VEIL };
