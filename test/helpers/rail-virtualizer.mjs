// The turn tracker (extension/rail/turns.js) and the jump (extension/rail/jump.js) run together
// over the fake DOM in test/helpers/rail-dom.mjs, with a fake virtualizer in the geometry of the
// user's 4-question chat (notes/runs/2026-11-14-rail-jump-detours): turns at 84, 1883, 3418 and
// 5725 px, scrollHeight 7619, clientHeight 1092, so the bottom is scrollTop 6527. A turn is mounted
// while it is within 1500 px of the viewport. As Chrome does for a target that leaves the DOM, the
// position observer reports an unmounted turn with an empty boundingClientRect; a mounted one with
// its real box. As in Chrome (measured in headless Chromium for #171): every change of scrollTop is
// followed on the next frame by the browser's own scroll event on the scroller; a smooth scrollTo
// moves the chat over SMOOTH_MS and ends with a scrollend; an instant move ends with a scrollend on
// the next frame, even when a smooth scroll started in the same task. A write stops a smooth scroll. test/rail-jump-detours.test.mjs, test/rail-jump-lost.test.mjs and
// test/rail-jump-end-pin.test.mjs use it.
import fs from 'node:fs';
import vm from 'node:vm';
import ButterRailModel from '../../extension/rail/model.js';
import { chatgptEndPin } from './chatgpt-end-pin.mjs';
import { FakeElement, fakeEvents, fakeObservers } from './rail-dom.mjs';

const read = (f) => fs.readFileSync(new URL(`../../extension/${f}`, import.meta.url), 'utf8');
export const TOPS = [84, 1883, 3418, 5725],
  HEIGHTS = [1787, 1523, 2294, 1736],
  SCROLL_HEIGHT = 7619,
  CLIENT = 1092,
  BOTTOM = SCROLL_HEIGHT - CLIENT,
  MARGIN = 1500;
// The rail scripts a jump needs, in the manifest's order.
const SCRIPTS = ['shared/leave-gesture.js', 'rail/turns.js', 'rail/readiness.js', 'rail/jump.js'];
// With `endPin`, questions 0-2 grow this long after each mount, as on the real page (a turn's
// measured height replaces its estimate: the transcript shrinks and grows back within 0.3 s to 3 s
// of the mount, its total height unchanged).
export const GROWS = [0, 1, 2],
  GROW_MS = [300, 1200, 2500],
  SMOOTH_MS = 300;

// The chat opens at its top. Returns the tracker and the jump, the scroller, `writes` (every
// scrollTop write the rail made, clamped as the browser does), the turn elements `els`, the journey
// status `st`, the trip, and:
// - `page(top)`: ChatGPT moves the chat to `top` (not logged in `writes`);
// - `mounted(fn)`: `fn(i)` runs each time turn `i` mounts;
// - `frameMs`: the time between frames (16; more while the page is busy);
// - `run(ms)`: runs timers and frames for `ms`; `now()`: the page's clock.
// A wheel on the scroller cancels the jump, as rail/rail.js wires the tracker's `scrolled`.
// `trace(step, fields)`: the dev build's trace hook (dev/rail-trace.js), given the rail as rail.js
// lends it. `hasPrev`: the chat has earlier pages left (they never load here). `reduced`: the reader
// prefers reduced motion. `scrollHeight`: the chat's height (the last turn ends 158 px above it).
// `endPin`: ChatGPT's end pin (test/helpers/chatgpt-end-pin.mjs) runs on the scroller, as `pin`:
// the chat opens at its end with the pin set, and each of GROWS grows GROW_MS after it mounts.
// `wheel(deltaY, to)`: the reader's wheel moves the chat to `to`; `grow(px)`: an answer streams
// `px` more at the chat's end.
export function setup({
  trace,
  hasPrev = false,
  reduced = false,
  scrollHeight = SCROLL_HEIGHT,
  endPin = false,
} = {}) {
  let now = 10_000,
    nextId = 1,
    top = 0,
    height = scrollHeight,
    scrolled = false, // scrollTop changed since the last frame: the browser's scroll event is due
    ended = false, // an instant move: its scrollend is due on the next frame
    smooth = null; // the smooth scroll under way: { from, to, at }
  const heights = [...HEIGHTS.slice(0, -1), scrollHeight - TOPS.at(-1) - 158];
  const frames = new Map(),
    timers = new Map();
  const observers = fakeObservers();
  const window = new FakeElement();
  const ctx = vm.createContext({
    ButterRailModel,
    ...fakeEvents(),
    Element: FakeElement,
    ResizeObserver: observers.ResizeObserver,
    IntersectionObserver: observers.IntersectionObserver,
    addEventListener: window.addEventListener.bind(window),
    matchMedia: () => ({ matches: reduced }),
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
  for (const f of SCRIPTS) vm.runInContext(read(f), ctx, { filename: f });

  // The rail presentation model, as far as the tracker and the jump use it.
  const st = { flying: false, pinned: false, busy: null, active: null };
  const model = {
    items: TOPS.map((_, i) => ({ id: `q${i}`, q: `Question ${i}` })),
    hasPrev,
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
    clientHeight: CLIENT,
    clientWidth: 985,
    offsetWidth: 1000,
    getBoundingClientRect: () => ({ top: 0, bottom: CLIENT, left: 0, right: 1000, width: 1000 }),
    scrollTo({ top: to, behavior }) {
      if (behavior !== 'smooth') this.scrollTop = to;
      else smooth = { from: top, to: clamp(to), at: now };
    },
  });
  Object.defineProperty(scroller, 'scrollHeight', { get: () => height });
  const els = TOPS.map((t, i) => {
    const el = new FakeElement('article');
    el.setAttribute('data-turn-key', `q${i}`);
    el.isConnected = false;
    el.getBoundingClientRect = () => ({
      top: t - top,
      bottom: t + heights[i] - top,
      height: heights[i],
    });
    el.querySelector = () => null;
    return el;
  });
  const positions = () => observers.intersectionObservers.at(-2); // the tracker's ioPos
  const layout = () => {
    const changed = [];
    els.forEach((el, i) => {
      const inWindow = TOPS[i] < top + CLIENT + MARGIN && TOPS[i] + heights[i] > top - MARGIN;
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
  const clamp = (value) => Math.max(0, Math.min(height - CLIENT, Math.round(value)));
  const moveTo = (value, animating = false) => {
    const to = clamp(value);
    if (!animating) smooth = null;
    if (to !== top) {
      scrolled = true;
      ended ||= !animating;
    }
    top = to;
    layout();
  };
  Object.defineProperty(scroller, 'scrollTop', {
    get: () => top,
    set(value) {
      moveTo(value);
      writes.push(top);
    },
  });

  let jump = null;
  const turns = ctx.ButterRailTurns(model, {
    changed() {},
    kick() {},
    sync() {},
    scrolled: (cause) => jump?.cancel(cause),
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
  trace?.('rail', { model, turns, host: () => null, bars: () => [] });
  jump = ctx.ButterRailJump(model, turns, () => trip, {
    kick() {},
    busy() {},
    wait() {},
    found() {},
    trace: trace && ((step, fields) => trace(step, fields())),
  });

  // The chat opens at its top (with `endPin`, at its end): the turns there mount and are recorded
  // where they are; the tracker follows the scroller once it has a size.
  scroller.scrollTop = endPin ? height - CLIENT : 0;
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
  scrolled = ended = false;
  const pin = endPin && chatgptEndPin(scroller, { now: () => now, pinned: true, move: moveTo });
  if (pin)
    onMount.push((i) => {
      if (GROWS.includes(i)) for (const ms of GROW_MS) ctx.setTimeout(() => pin.grew(), ms);
    });

  const t = {
    turns,
    jump,
    scroller,
    writes,
    els,
    st,
    trip,
    pin,
    frameMs: 16,
    now: () => now,
    page: moveTo,
    wheel(deltaY, to) {
      scroller.emit('wheel', { deltaY });
      moveTo(to);
    },
    grow(px) {
      height += px;
      pin?.grew();
    },
    mounted(fn) {
      onMount.push(fn);
    },
    async run(ms) {
      for (const end = now + ms; now < end; ) {
        now += t.frameMs;
        // The events of the moves since the last frame first, then a smooth scroll's next step
        // (its events come on the next frame).
        if (scrolled) {
          scrolled = false;
          scroller.emit('scroll', { isTrusted: true }); // the browser's own scroll event
        }
        if (ended) {
          ended = false;
          scroller.emit('scrollend', { isTrusted: true });
        }
        if (smooth) {
          const f = Math.min(1, (now - smooth.at) / SMOOTH_MS),
            { to } = smooth;
          moveTo(smooth.from + (to - smooth.from) * f, true);
          if (f === 1) [smooth, ended] = [null, true];
        }
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
