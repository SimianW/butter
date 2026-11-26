// The real MAIN-world recorder (seek/layout-persistence-main.js, layout-lean-main.js,
// layout-cache-main.js) in a vm over one fake turn, its block and scroller, with the observers,
// frames and listeners the test drives (test/height-cache-dom.test.js).
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../../extension/seek/core-main.js');
function fixture({ mounted = false, setup = () => {} } = {}) {
  const frames = [],
    observed = new Set(),
    listeners = {},
    blocks = [];
  let mutation, resized;
  const nativeReads = [];
  const c = { complete: true, math: true, revealing: false };
  class Element {
    get clientWidth() {
      nativeReads.push(turn.style.contentVisibility || 'unrestored');
      return 768;
    }
  }
  const sc = Object.assign(new Element(), {
    clientHeight: 900,
    contains: () => true,
    getBoundingClientRect: () => ({ left: 0 }),
  });
  const item = Object.assign(new Element(), {
    nodeType: 1,
    isConnected: true,
    hasAttribute: () => false,
    tagName: 'P',
    className: 'p',
    classList: { contains: () => false },
    style: {},
    firstChild: { nodeType: 3, data: 'sample' },
    matches: () => false,
    getBoundingClientRect: () => ({ top: 120, left: 0, width: 768, height: 26 }),
  });
  const turn = Object.assign(new Element(), {
    nodeType: 1,
    isConnected: true,
    dataset: { turnKey: 'a' },
    style: {},
    clientHeight: 500,
    getBoundingClientRect: () => ({ top: 8, height: 480 }),
    parentElement: { getBoundingClientRect: () => ({ top: 0, width: 768, height: 500 }) },
    hasAttribute: (n) => n === 'data-turn-key',
    matches: () => false,
    closest: (s) => (s === '.thread-scroll-container' ? sc : turn),
    querySelector: (s) =>
      s.includes('AdaptiveStreaming')
        ? c.revealing
          ? {}
          : null
        : s.includes('in_progress')
          ? !c.complete
            ? {}
            : null
          : s.includes('complete')
            ? c.complete
              ? {}
              : null
            : s.includes('author-role')
              ? { getAttribute: () => 'm1' }
              : null,
    querySelectorAll: (s) =>
      s === '[data-math-source]'
        ? c.math
          ? []
          : [{ querySelector: () => null }]
        : s.includes(':not(')
          ? blocks
          : blocks,
  });
  item.closest = () => turn;
  sc.querySelectorAll = () => [turn];
  const doc = {
    scripts: [],
    addEventListener: (n, fn) => (listeners[n] = fn),
    querySelectorAll: (s) => (s === '[data-turn-key]' ? (mounted ? [turn] : []) : [sc]),
  };
  const context = {
    document: doc,
    location: { pathname: '/g/g-p-project/c/00000000-0000-0000-0000-000000000000' },
    innerWidth: 1600,
    Element,
    performance: { now: () => 1 },
    __butterPageReader: require('../../extension/page/reader-main.js'),
    __butterSeekCore: core,
    __butterLayoutCheck: require('../../extension/seek/layout-check-main.js'),
    ResizeObserver: class {
      constructor(fn) {
        resized = fn;
      }
      observe(e) {
        observed.add(e);
      }
      unobserve(e) {
        observed.delete(e);
      }
    },
    MutationObserver: class {
      constructor(fn) {
        mutation = fn;
      }
      observe() {}
    },
    requestAnimationFrame: (fn) => (frames.push(fn), frames.length),
    requestIdleCallback: (fn) => (frames.push(fn), frames.length),
    getComputedStyle: () => ({
      fontStyle: 'normal',
      fontWeight: '400',
      fontSize: '16px',
      lineHeight: '26px',
      fontFamily: 'system-ui',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
      borderRadius: '0px',
      backgroundColor: 'transparent',
      color: 'black',
      textAlign: 'left',
    }),
  };
  context.crypto = require('node:crypto').webcrypto;
  context.TextEncoder = TextEncoder;
  context.setTimeout = () => 1;
  context.clearTimeout = () => {};
  context.queueMicrotask = queueMicrotask;
  context.window = context;
  setup({ context, turn, item, blocks, sc, Element });
  vm.createContext(context);
  for (const file of ['layout-persistence-main.js', 'layout-lean-main.js', 'layout-cache-main.js'])
    vm.runInContext(
      fs.readFileSync(require.resolve('../../extension/seek/' + file), 'utf8'),
      context,
    );
  const flush = () => {
    const jobs = frames.splice(0);
    jobs.forEach((f) => f());
  };
  return {
    context,
    c,
    turn,
    item,
    blocks,
    nativeReads,
    Element,
    sc,
    observed,
    flush,
    mutation: (r) => mutation(r),
    resize: (rs) => resized(rs),
    frames,
    listeners,
  };
}
module.exports = { fixture };
