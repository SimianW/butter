// The rail booted whole over the fake DOM (test/helpers/rail-dom.mjs): every script under rail/ in
// manifest order with a scroller of planted turns, a conversation's first page, a manual clock for
// frames and timers, and helpers to drive it. test/rail.test.mjs uses it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import seekMeta from '../../extension/seek/seek-meta.js';
import bookmarks from '../../extension/bookmarks/model.js';
import { RAIL_SCRIPTS } from '../../lab/harness/rail-scripts.mjs';
import { FakeElement, fakeObservers } from './rail-dom.mjs';

// The rail's scripts under rail/ in manifest order, the adapter last (its other dependencies, seek's
// card text and the bookmark rules, are given as globals).
const sources = RAIL_SCRIPTS.filter((f) => f.startsWith('rail/')).map((f) => [
  f,
  fs.readFileSync(new URL(`../../extension/${f}`, import.meta.url), 'utf8'),
]);
export const conversation = '12345678-1234-1234-1234-123456789abc';

// `nested`: turns sit in the virtualizer's content box > wrapper > window, as on ChatGPT, rather
// than straight in the scroller.
export function setup({
  count = 5,
  hasPrev = false,
  height = 900,
  gutter = 0,
  nested = false,
} = {}) {
  let now = 10_000,
    nextId = 1,
    rendered = null; // the items revision of the last render
  const frames = new Map(),
    timers = new Map(),
    intervals = [];
  const document = new FakeElement();
  document.createElement = (tag) => new FakeElement(tag);
  document.body = new FakeElement('body');
  document.documentElement = new FakeElement('html');
  const window = new FakeElement();
  const { ResizeObserver, IntersectionObserver, resize } = fakeObservers();
  const ctx = vm.createContext({
    document,
    ButterSeekMeta: seekMeta,
    ButterBookmarks: bookmarks, // the manifest loads bookmarks/model.js before the rail
    // The bookmark page's side of the rail: the items revision the rail last rendered.
    ButterBookmarkPage: { sync: (conv, items, all, rev) => (rendered = rev), unwash() {} },
    navigator: { language: 'en' },
    location: { pathname: `/c/${conversation}` },
    Element: FakeElement,
    ResizeObserver,
    IntersectionObserver,
    MutationObserver: class {
      observe() {}
    },
    getComputedStyle: () => ({ colorScheme: 'light' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1200,
    performance: { now: () => now },
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    requestAnimationFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { callback, at: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback) => intervals.push(callback),
  });
  for (const [filename, source] of sources) vm.runInContext(source, ctx, { filename });
  const frame = (timestamp = now + 16) => {
    // rAF's frame-start timestamp may lag the current performance.now() clock.
    now = Math.max(now, timestamp);
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(timestamp);
  };
  const flush = () => {
    for (let i = 0; frames.size && i < 150; i++) frame();
    assert.equal(frames.size, 0, 'animation should settle and stop scheduling frames');
  };
  const send = (message) => document.emit('butter-nav', { detail: JSON.stringify(message) });
  const scroller = new FakeElement();
  Object.assign(scroller, {
    className: 'thread-scroll-container',
    scrollTop: 0,
    scrollHeight: 5000,
    clientHeight: height,
    clientWidth: 1000 - gutter,
    offsetWidth: 1000,
    getBoundingClientRect: () => ({ top: 0, bottom: height, left: 0, right: 1000, width: 1000 }),
    scrollTo({ top }) {
      this.scrollTop = top;
    },
  });
  let box = scroller;
  if (nested)
    for (const name of ['content', 'wrapper', 'window']) {
      const el = new FakeElement();
      el.name = name;
      box.append(el);
      box = el;
    }
  const turns = Array.from({ length: count }, (_, i) => {
    const turn = new FakeElement('article');
    turn.setAttribute('data-turn-key', `q${i}`);
    turn.top = 100 + 100 * i;
    turn.getBoundingClientRect = () => ({
      top: turn.top - scroller.scrollTop,
      bottom: turn.top + 100 - scroller.scrollTop,
    });
    box.append(turn);
    ctx.butterNavTurn(turn);
    return turn;
  });
  resize(scroller);
  send({
    type: 'page',
    conv: conversation,
    before: null,
    hasPrev,
    items: turns.map((_, i) => ({ id: `q${i}`, q: `Question ${i}` })),
  });
  flush();
  const host = document.body.children[0];
  const select = (selector) => host.shadowRoot.querySelector(selector);
  const ticks = () => select('.ticks').children;
  const geometry = () =>
    ticks().map((tick) => {
      const bar = tick.firstChild;
      const match = /^scale\(([^,]+), ([^)]+)\)$/.exec(bar.style.transform ?? 'scale(1, 1)');
      assert.ok(match, `invalid transform: ${bar.style.transform}`);
      const values = [Number(match[1]), Number(bar.style.opacity ?? 0.28), Number(match[2])];
      assert.ok(values.every(Number.isFinite), `non-finite geometry: ${values}`);
      return values;
    });
  const form = new FakeElement('form'),
    composer = new FakeElement(),
    sendButton = new FakeElement('button');
  composer.className = 'ProseMirror';
  composer.textContent = 'New question';
  sendButton.setAttribute('data-testid', 'send-button');
  form.append(composer);
  form.append(sendButton);
  // Bookmarks under questions, as the bookmark session publishes them: { id: [stale, …] }, or
  // { stale, key } to give one its key (else `${id}-${k}`); id -1 is earlier history that isn't
  // loaded yet (ButterBookmarks.EARLIER). A jump lands 30 px into its bookmark's turn.
  const setMarks = (byId, revision = null) =>
    ctx.ButterRail.setMarks(conversation, {
      revision,
      groups: new Map(
        Object.entries(byId).map(([key, flags]) => {
          const id = key === '-1' ? -1 : key;
          const bookmarks = flags.map((f, k) => ({
            key: f?.key ?? `${id}-${k}`,
            excerpt: `Bookmark ${k}`,
            stale: f?.stale ?? f,
          }));
          return [
            id,
            {
              count: bookmarks.length,
              fresh: false,
              bookmarks,
              stale: bookmarks.every((b) => b.stale),
              land: () => 30,
              remove() {},
            },
          ];
        }),
      ),
    });
  // The rail's bookmark dots: per question index, where its right edge sits left of the ticks'
  // right end, its centre below the rail's top, its diameter, and its look.
  const dots = () =>
    select('.marks')
      .children.filter((el) => el.className.startsWith('bdot'))
      .map((el) => {
        const [x, y] = el.style.translate.split(' ').map(parseFloat),
          d = parseFloat(el.style.width);
        return {
          q: Number(el.getAttribute('data-q')),
          right: -x,
          center: y + d / 2,
          d,
          hidden: el.getAttribute('aria-hidden'),
          stale: el.classList.contains('stale'),
          faint: el.classList.contains('faint'),
        };
      });
  return {
    document,
    setMarks,
    dots,
    seek: (message) =>
      document.emit('butter-seek-state', {
        detail: JSON.stringify({ conv: conversation, ...message }),
      }),
    runTimers: () => {
      for (const [id, timer] of [...timers])
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
    },
    frame,
    flush,
    send,
    select,
    ticks,
    geometry,
    host,
    scroller,
    turns,
    resize,
    window,
    composer,
    sendButton,
    pendingFrames: () => frames.size,
    mount: (el) => ctx.butterNavTurn(el), // stream/offscreen.js reports a mounted turn
    rev: () => rendered,
    // A new URL, as the rail's 700 ms poll sees it.
    navigate: (pathname) => {
      ctx.location.pathname = pathname;
      for (const callback of intervals) callback();
    },
    advanceClock: (ms) => {
      now += ms;
    },
  };
}
