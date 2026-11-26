// Issue #152: ChatGPT keeps its end pin unless its own scroll listener on the scroller sees a scroll
// between its scrollbar pointerdown and pointerup (notes/runs/2026-11-23-seek-pin-cause/report.md).
// The seek preview swallows the drag's scroll events, so its release must hand ChatGPT one scroll
// before ChatGPT's pointerup runs. Issue #171: the rail's jump shows ChatGPT the same gesture
// (shared/leave-gesture.js), which the seek preview must not take for the reader's press. The
// release's part, in the MAIN world, is shared/leave-gesture-main.js.
// ChatGPT is the fake of its end pin in test/helpers/chatgpt-end-pin.mjs, as for the rail's jump.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { chatgptEndPin } from './helpers/chatgpt-end-pin.mjs';
import { fakeEvents } from './helpers/rail-dom.mjs';
import pageReader from '../extension/page/reader-main.js';
import seekCore from '../extension/seek/core-main.js';
import layoutCheck from '../extension/seek/layout-check-main.js';

const read = (name) => fs.readFileSync(new URL(`../extension/${name}.js`, import.meta.url), 'utf8');

// The chat at its end, ChatGPT's end pin set. Butter's window-capture listeners run first, then
// (unless stopped) the scroller's own target-phase listeners: ChatGPT's. `seeking`: a seek drag is
// under way.
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
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 700, width: 700, height: 500 }),
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
    ...fakeEvents(),
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
    vm.runInContext(read(`seek/${name}`), ctx);
  vm.runInContext(read('shared/leave-gesture-main'), ctx);
  vm.runInContext(
    read('seek/preview-main').replace(/\}\)\(\);\s*$/, 'active=testActive;})();'),
    ctx,
  );
  const pin = chatgptEndPin(sc, { now: () => 100, pinned: true });
  const fire = (type, extra = {}) => dispatch({ type, ...extra });
  return { sc, fire, pin };
}

const press = { isTrusted: true, button: 0, pointerType: 'mouse', clientX: 698, clientY: 480 };

test("a thumb release clears ChatGPT's end pin, and the chat stays where it was let go", () => {
  const { sc, fire, pin } = page({ seeking: true });
  fire('pointerdown', press);
  for (const top of [29000, 26000, 21000]) {
    sc.scrollTop = top;
    fire('scroll');
  }
  assert.equal(pin.pinned, true, 'the drag still swallows the native scroll events');
  fire('pointerup');
  assert.equal(pin.pinned, false);
  pin.grew();
  assert.equal(sc.scrollTop, 21000, 'no end pull');
});

test('a plain click on the scroller shows ChatGPT nothing: the end pin stays set', () => {
  const { sc, fire, pin } = page({ seeking: false });
  fire('pointerdown', press);
  fire('pointerup');
  assert.equal(pin.pinned, true);
  sc.scrollTop = 21000; // a script's write
  pin.grew();
  assert.equal(sc.scrollTop, 29500, 'ChatGPT still pulls the chat to its end');
});

test("the rail's leave gesture starts no seek and clears ChatGPT's end pin", () => {
  const { sc, fire, pin } = page({ seeking: false });
  // The rail runs in the isolated world: its own globals, the same scroller.
  const isolated = vm.createContext({ ...fakeEvents() });
  vm.runInContext(read('shared/leave-gesture'), isolated);
  assert.equal(isolated.ButterLeaveGesture.leave(sc, 3000), true, 'shown');
  assert.equal(pin.pinned, false, "ChatGPT saw the gesture's scroll: no seek swallowed it");
  sc.scrollTop = 3000;
  fire('scroll', { isTrusted: true }); // the browser's scroll event for the jump's write
  assert.equal(sc.scrollTop, 3000);
  pin.grew();
  assert.equal(sc.scrollTop, 3000, 'no end pull');
});
