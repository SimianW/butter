// The turn tracker (extension/rail/turns.js) and the jump (extension/rail/jump.js) run together
// over the fake DOM in test/helpers/rail-dom.mjs, with a fake virtualizer in the geometry of the
// user's 4-question chat (notes/runs/2026-11-14-rail-jump-detours): turns at 84, 1883, 3418 and
// 5725 px, scrollHeight 7619, clientHeight 1092, so the bottom is scrollTop 6527. A turn is mounted
// while it is within 1500 px of the viewport. As Chrome does for a target that leaves the DOM, the
// position observer reports an unmounted turn with an empty boundingClientRect; a mounted one with
// its real box. test/rail-jump-detours.test.mjs and test/rail-jump-lost.test.mjs use it.
import fs from 'node:fs';
import vm from 'node:vm';
import ButterRailModel from '../../extension/rail/model.js';
import { FakeElement, fakeObservers } from './rail-dom.mjs';

const read = (f) => fs.readFileSync(new URL(`../../extension/rail/${f}`, import.meta.url), 'utf8');
export const TOPS = [84, 1883, 3418, 5725],
  HEIGHTS = [1787, 1523, 2294, 1736],
  SCROLL_HEIGHT = 7619,
  CLIENT = 1092,
  BOTTOM = SCROLL_HEIGHT - CLIENT,
  MARGIN = 1500;
// The rail scripts a jump needs, in the manifest's order.
const SCRIPTS = ['turns.js', 'jump.js'];

// The chat opens at its top. Returns the tracker and the jump, the scroller, `writes` (every
// scrollTop write the rail made, clamped as the browser does), the turn elements `els`, the journey
// status `st`, the trip, and:
// - `page(top)`: ChatGPT moves the chat to `top` (not logged in `writes`);
// - `mounted(fn)`: `fn(i)` runs each time turn `i` mounts;
// - `frameMs`: the time between frames (16; more while the page is busy);
// - `run(ms)`: runs timers and frames for `ms`; `now()`: the page's clock.
export function setup() {
  let now = 10_000,
    nextId = 1,
    top = 0;
  const frames = new Map(),
    timers = new Map();
  const observers = fakeObservers();
  const window = new FakeElement();
  const ctx = vm.createContext({
    ButterRailModel,
    Element: FakeElement,
    ResizeObserver: observers.ResizeObserver,
    IntersectionObserver: observers.IntersectionObserver,
    addEventListener: window.addEventListener.bind(window),
    matchMedia: () => ({ matches: false }),
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { callback, at: now + ms });
      return id;
    },
  });
  for (const f of SCRIPTS) vm.runInContext(read(f), ctx, { filename: `rail/${f}` });

  // The rail presentation model, as far as the tracker and the jump use it.
  const st = { flying: false, pinned: false, busy: null, active: null };
  const model = {
    items: TOPS.map((_, i) => ({ id: `q${i}`, q: `Question ${i}` })),
    hasPrev: false,
    box: null,
    get qs() {
      return this.items;
    },
    get flying() {
      return st.flying;
    },
    get pinned() {
      return st.pinned;
    },
    get busy() {
      return st.busy;
    },
    index(id) {
      const i = this.qs.findIndex((x) => x.id === id);
      return i < 0 ? null : i;
    },
    measure(box) {
      this.box = box;
    },
    reconcile: () => false,
    journey: (s) => Object.assign(st, s),
    setActive(id) {
      const moved = st.active !== id;
      st.active = id;
      return moved;
    },
    synced: () => true,
    placed: () => null,
    mark: () => null,
  };

  // The scroller and the virtualizer: the window of mounted turns follows every scroll.
  const scroller = new FakeElement('main');
  const writes = [],
    onMount = [];
  Object.assign(scroller, {
    className: 'thread-scroll-container',
    scrollHeight: SCROLL_HEIGHT,
    clientHeight: CLIENT,
    clientWidth: 985,
    offsetWidth: 1000,
    getBoundingClientRect: () => ({ top: 0, bottom: CLIENT, left: 0, right: 1000, width: 1000 }),
    scrollTo({ top: to }) {
      this.scrollTop = to;
    },
  });
  const els = TOPS.map((t, i) => {
    const el = new FakeElement('article');
    el.setAttribute('data-turn-key', `q${i}`);
    el.isConnected = false;
    el.getBoundingClientRect = () => ({
      top: t - top,
      bottom: t + HEIGHTS[i] - top,
      height: HEIGHTS[i],
    });
    el.querySelector = () => null;
    return el;
  });
  const positions = () => observers.intersectionObservers.at(-2); // the tracker's ioPos
  const layout = () => {
    const changed = [];
    els.forEach((el, i) => {
      const inWindow = TOPS[i] < top + CLIENT + MARGIN && TOPS[i] + HEIGHTS[i] > top - MARGIN;
      if (inWindow && !el.isConnected) {
        el.isConnected = true;
        scroller.append(el);
        ctx.butterNavTurn(el); // stream/offscreen.js reports the mount
        changed.push(el);
        for (const fn of onMount) fn(i);
      } else if (!inWindow && el.isConnected) {
        el.remove();
        el.isConnected = false;
        changed.push(el);
      }
    });
    // The position observer's entries for the turns that came or went: a removed target's rect is
    // empty. rootBounds is the scroller's box (its top is 0 here, as the user's numbers imply).
    const io = positions();
    if (!io) return;
    const entries = changed.map((el) => ({
      target: el,
      boundingClientRect: el.isConnected
        ? el.getBoundingClientRect()
        : { top: 0, bottom: 0, height: 0 },
      rootBounds: { top: 0 },
      isIntersecting: false,
    }));
    if (entries.length) io.callback(entries);
  };
  const clamp = (value) => Math.max(0, Math.min(BOTTOM, Math.round(value)));
  Object.defineProperty(scroller, 'scrollTop', {
    get: () => top,
    set(value) {
      top = clamp(value);
      writes.push(top);
      layout();
    },
  });

  let jump = null;
  const turns = ctx.ButterRailTurns(model, {
    changed() {},
    kick() {},
    sync() {},
    scrolled() {},
    mounted: (el) => jump?.observe(el),
    ignore: () => false,
  });
  // The trip's look is not under test: departing and arriving take their usual time but do not
  // scroll (the real depart scrolls half a viewport toward the target). `tok`: the trip in flight
  // (null once it ended and the chat shows).
  const trip = {
    tok: null,
    get active() {
      return this.tok != null;
    },
    take(tok) {
      if (this.tok == null) return false;
      this.tok = tok;
      return true;
    },
    depart(turn, m, tok) {
      this.tok = tok;
      return new Promise((r) => ctx.setTimeout(r, 260));
    },
    redirect(m, tok) {
      this.tok = tok;
      return new Promise((r) => ctx.setTimeout(r, 260));
    },
    arrive() {
      this.tok = null;
      return new Promise((r) => ctx.setTimeout(r, 250));
    },
    end(tok) {
      if (tok === undefined || tok === this.tok) this.tok = null;
    },
  };
  jump = ctx.ButterRailJump(model, turns, () => trip, {
    kick() {},
    busy() {},
    wait() {},
    found() {},
  });

  // The chat opens at its top: q0 and q1 mount and are recorded where they are; the tracker
  // follows the scroller once it has a size.
  scroller.scrollTop = 0;
  observers.resize(scroller);
  layout();
  positions().callback(
    els
      .filter((el) => el.isConnected)
      .map((el) => ({
        target: el,
        boundingClientRect: el.getBoundingClientRect(),
        rootBounds: { top: 0 },
      })),
  );
  writes.length = 0;

  const t = {
    turns,
    jump,
    scroller,
    writes,
    els,
    st,
    trip,
    frameMs: 16,
    now: () => now,
    page(to) {
      top = clamp(to);
      layout();
    },
    mounted(fn) {
      onMount.push(fn);
    },
    async run(ms) {
      for (const end = now + ms; now < end; ) {
        now += t.frameMs;
        for (const [id, x] of [...timers].sort((a, b) => a[1].at - b[1].at))
          if (x.at <= now) {
            timers.delete(id);
            x.callback();
          }
        const due = [...frames.values()];
        frames.clear();
        for (const callback of due) callback(now);
        await new Promise((r) => setImmediate(r));
      }
    },
  };
  return t;
}
