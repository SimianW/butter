// Issue #152: ChatGPT keeps the chat pinned to its end unless its own scroll listener on the
// scroller sees a scroll between its scrollbar pointerdown and pointerup
// (notes/runs/2026-11-23-seek-pin-cause/report.md). The seek preview swallows the drag's scroll
// events, so its release must hand ChatGPT one scroll before ChatGPT's pointerup runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import pageReader from '../extension/page/reader-main.js';
import seekCore from '../extension/seek/core-main.js';
import layoutCheck from '../extension/seek/layout-check-main.js';

const read = (name) =>
  fs.readFileSync(new URL(`../extension/seek/${name}.js`, import.meta.url), 'utf8');

// Butter's window-capture listeners run first, then (unless stopped) the scroller's own
// target-phase listeners, which stand in for ChatGPT's.
function page({ seeking }) {
  const windowListeners = {},
    own = {};
  const sc = {
    clientHeight: 500,
    clientWidth: 700,
    scrollHeight: 30000,
    scrollTop: 29500,
    isConnected: true,
    matches: () => true,
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 500 }),
    addEventListener: (type, fn) => (own[type] ||= []).push(fn),
    dispatchEvent: (e) => dispatch(e),
  };
  function dispatch(e) {
    let stopped = false;
    Object.assign(e, {
      target: sc,
      timeStamp: e.timeStamp ?? 100,
      stopImmediatePropagation: () => (stopped = true),
    });
    for (const fn of windowListeners[e.type] || []) if (!stopped) fn(e);
    for (const fn of own[e.type] || []) if (!stopped) fn(e);
  }
  const conv = '00000000-0000-0000-0000-000000000000';
  const ctx = {
    __butterPageReader: pageReader,
    __butterSeekCore: seekCore,
    __butterLayoutCheck: layoutCheck,
    document: {
      documentElement: {
        hasAttribute: () => false,
        getAttribute: () => '',
        classList: { contains: () => false },
      },
      addEventListener() {},
      querySelectorAll: () => [sc],
      dispatchEvent() {},
    },
    addEventListener: (type, fn) => (windowListeners[type] ||= []).push(fn),
    window: {},
    location: { pathname: `/c/${conv}` },
    performance: { now: () => 100 },
    getSelection: () => null,
    getComputedStyle: () => ({ direction: 'ltr' }),
    matchMedia: () => ({ matches: true }),
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
    requestAnimationFrame: () => 1,
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    CustomEvent: class {},
    // An active seek drag on the scroller, as activate() leaves it.
    testActive: seeking
      ? {
          sc,
          conv,
          kind: 'thumb',
          start: 100,
          startTop: 29500,
          prep: { model: [], previewModel: [], flat: [], maxTop: 29500 },
          rendered: new Map(),
        }
      : null,
  };
  vm.createContext(ctx);
  for (const name of ['preview-texts-main', 'landing-main', 'seek-diagnostics-main'])
    vm.runInContext(read(name), ctx);
  vm.runInContext(read('preview-main').replace(/\}\)\(\);\s*$/, 'active=testActive;})();'), ctx);

  // ChatGPT's thread-scroll listeners, reduced to what the pin depends on.
  const chatgpt = { snapshot: null, scrolls: [], atPointerup: null };
  sc.addEventListener('pointerdown', () => {
    chatgpt.snapshot = { scrollHeight: sc.scrollHeight, scrollTop: sc.scrollTop };
  });
  sc.addEventListener('scroll', () =>
    chatgpt.scrolls.push({ scrollTop: sc.scrollTop, snapshot: chatgpt.snapshot }),
  );
  sc.addEventListener('pointerup', () => {
    chatgpt.atPointerup = chatgpt.scrolls.slice();
    chatgpt.snapshot = null;
  });
  const fire = (type, extra = {}) => dispatch({ type, ...extra });
  return { sc, fire, chatgpt };
}

const press = { isTrusted: true, button: 0, pointerType: 'mouse', clientX: 698, clientY: 480 };

test('a thumb release hands ChatGPT one scroll at the release position before its pointerup', () => {
  const { sc, fire, chatgpt } = page({ seeking: true });
  fire('pointerdown', press);
  for (const top of [29000, 26000, 21000]) {
    sc.scrollTop = top;
    fire('scroll');
  }
  assert.deepEqual(chatgpt.scrolls, [], 'the drag still swallows the native scroll events');
  fire('pointerup');
  assert.equal(chatgpt.atPointerup?.length, 1, 'ChatGPT saw one scroll before its pointerup');
  assert.equal(chatgpt.atPointerup[0].scrollTop, 21000);
  assert.ok(chatgpt.atPointerup[0].snapshot, 'while its scrollbar-press snapshot existed');
});

test('a plain click on the scroller gives ChatGPT no scroll event', () => {
  const { fire, chatgpt } = page({ seeking: false });
  fire('pointerdown', press);
  fire('pointerup');
  assert.deepEqual(chatgpt.atPointerup, []);
});
