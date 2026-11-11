// The rail's DOM adapter (extension/rail/rail.js) over a fake DOM: the send pre-jump, jump
// cancellation, and wiring that needs elements (seek, the dots' fade-out, keyboard focus). What the
// rail shows is tested through its model: test/rail-model.test.mjs and test/rail-card.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import seekMeta from '../extension/seek/seek-meta.js';
import bookmarks from '../extension/bookmarks/model.js';

// The rail's scripts in manifest order: the model's conversations and wave, the model, the adapter.
const sources = ['conversations', 'wave', 'model', 'rail'].map((name) => [
  `rail/${name}.js`,
  fs.readFileSync(new URL(`../extension/rail/${name}.js`, import.meta.url), 'utf8'),
]);
const conversation = '12345678-1234-1234-1234-123456789abc';

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    };
    this.isConnected = true;
    this.textContent = '';
  }
  focus() {
    FakeElement.focused = this;
  }
  addEventListener(type, callback, options) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, once: options?.once, capture: !!options?.capture });
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((x) => x.callback !== callback),
    );
  }
  emit(type, event = {}, phase = null) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (phase && listener.capture !== (phase === 'capture')) continue;
      if (!(this.listeners.get(type) ?? []).includes(listener)) continue;
      if (listener.once) this.removeEventListener(type, listener.callback);
      listener.callback({ target: this, ...event });
    }
  }
  // An event dispatched to a page element, seen from window: capture listeners, then the page's
  // own handler on the target (ChatGPT's submit), then bubble listeners, each list read afresh.
  dispatch(type, event = {}, atTarget = () => {}) {
    this.emit(type, event, 'capture');
    atTarget();
    this.emit(type, event, 'bubble');
  }
  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
  }
  append(...children) {
    for (const child of children) {
      if (typeof child === 'string') continue; // text: no element to look up
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.append(child));
  }
  get firstChild() {
    return this.children[0];
  }
  remove() {
    this.parentElement.children = this.parentElement.children.filter((x) => x !== this);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  toggleAttribute(name, force) {
    if (force) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }
  contains(el) {
    return this === el || this.children.some((child) => child.contains(el));
  }
  closest(selector) {
    if (selector === '.thread-scroll-container' && this.className === 'thread-scroll-container')
      return this;
    if (selector === 'form' && this.tagName === 'form') return this;
    if (this.matchesClass(selector)) return this;
    if (selector === '.ProseMirror[contenteditable="true"]' && this.className === 'ProseMirror')
      return this;
    if (
      selector === '[data-testid="send-button"], #composer-submit-button, button[type="submit"]' &&
      (this.getAttribute('data-testid') === 'send-button' || this.getAttribute('type') === 'submit')
    )
      return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  // Class selectors, alone or in a list (".go, .x"), on the class name the rail sets.
  matchesClass(selector) {
    return (
      /^\.[\w-]+(, \.[\w-]+)*$/.test(selector) &&
      selector.split(', ').some((c) => `${this.className ?? ''}`.split(' ').includes(c.slice(1)))
    );
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...((selector === '[data-turn-key]' && child.getAttribute('data-turn-key')) ||
      child.matchesClass(selector)
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.closest(selector) === child) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  attachShadow() {
    // Only the rail's static template needs lookup; dynamic buttons use append/firstChild.
    const elements = new Map();
    this.shadowRoot = {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement());
        return elements.get(selector);
      },
    };
    return this.shadowRoot;
  }
}

function setup({ count = 5, hasPrev = false, height = 900, gutter = 0 } = {}) {
  let now = 10_000,
    nextId = 1;
  const frames = new Map(),
    timers = new Map(),
    intervals = [],
    resizeObservers = [];
  const document = new FakeElement();
  document.createElement = (tag) => new FakeElement(tag);
  document.body = new FakeElement('body');
  document.documentElement = new FakeElement('html');
  const window = new FakeElement();
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = new Set();
      resizeObservers.push(this);
    }
    observe(el) {
      this.observed.add(el);
    }
    unobserve(el) {
      this.observed.delete(el);
    }
    disconnect() {
      this.observed.clear();
    }
  }
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const ctx = vm.createContext({
    document,
    ButterSeekMeta: seekMeta,
    ButterBookmarks: bookmarks, // the manifest loads bookmarks/model.js before the rail
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
  const turns = Array.from({ length: count }, (_, i) => {
    const turn = new FakeElement('article');
    turn.setAttribute('data-turn-key', `q${i}`);
    turn.top = 100 + 100 * i;
    turn.getBoundingClientRect = () => ({
      top: turn.top - scroller.scrollTop,
      bottom: turn.top + 100 - scroller.scrollTop,
    });
    scroller.append(turn);
    ctx.butterNavTurn(turn);
    return turn;
  });
  const resize = (target) => {
    for (const observer of [...resizeObservers])
      if (observer.observed.has(target)) {
        observer.callback([{ target, contentRect: { width: 1000 } }]);
      }
  };
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
  // Bookmarks under questions, as the bookmark session publishes them: { id: [stale, …] }; id -1
  // is earlier history that isn't loaded yet (ButterBookmarks.EARLIER).
  const setMarks = (byId, revision = null) =>
    ctx.ButterRail.setMarks(conversation, {
      revision,
      groups: new Map(
        Object.entries(byId).map(([key, flags]) => {
          const id = key === '-1' ? -1 : key;
          const bookmarks = flags.map((stale, k) => ({
            key: `${id}-${k}`,
            excerpt: `Bookmark ${k}`,
            stale,
          }));
          return [
            id,
            {
              count: bookmarks.length,
              fresh: false,
              bookmarks,
              stale: flags.every(Boolean),
              land: () => 0,
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

for (const cancel of ['wheel', 'keyboard', 'send', 'new click']) {
  test(`${cancel} invalidates a pending jump before it can settle or pin its old target`, async () => {
    const nav = setup();
    const click = (index) =>
      nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[index] });
    click(2); // close mounted turn: waits for scrollend, then settles and follows
    assert.equal(nav.scroller.scrollTop, nav.turns[2].top - 64);
    if (cancel === 'wheel') nav.scroller.emit('wheel');
    else if (cancel === 'keyboard')
      nav.window.emit('keydown', { key: 'PageDown', target: nav.scroller });
    else if (cancel === 'send')
      nav.send({
        type: 'send',
        conv: conversation,
        parent: 'q4',
        item: { id: 'new', q: 'New question' },
      });
    else click(4);
    nav.turns[2].top = 800;
    nav.scroller.scrollTop = 700; // user's scroll, or the newer jump's position
    nav.scroller.emit('scrollend');
    // Drain the async glide/steady continuations without using wall-clock timers.
    for (let i = 0; i < 80; i++) {
      nav.frame();
      await Promise.resolve();
    }
    const expected = cancel === 'new click' ? nav.turns[4].top - 64 : 700;
    assert.equal(nav.scroller.scrollTop, expected);
    nav.turns[2].top += 200;
    nav.resize(nav.turns[2]); // a stale follow observer must not re-align the cancelled target
    assert.equal(nav.scroller.scrollTop, expected);
    if (cancel === 'new click') {
      nav.turns[4].top += 100;
      nav.resize(nav.turns[4]);
      assert.equal(
        nav.scroller.scrollTop,
        nav.turns[4].top - 64,
        'only the newest jump stays pinned',
      );
    }
  });
}

for (const trigger of ['Enter', 'click']) {
  test(`${trigger} pre-jumps a distant send but leaves the last viewport for ChatGPT`, () => {
    const nav = setup();
    if (trigger === 'Enter') nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    else {
      const icon = new FakeElement('svg');
      nav.sendButton.append(icon);
      nav.window.dispatch('click', { target: icon });
    }
    assert.equal(nav.scroller.scrollTop, 3200);
  });

  test(`${trigger}: ChatGPT's submit handler runs before the pre-jump, in the same event`, () => {
    // Jumping first made ChatGPT's handler mount and lay out the end of the chat before it cleared
    // the composer: the page froze for 2-3 s with the typed text still showing.
    const nav = setup();
    let seen = null;
    const submit = () => (seen = nav.scroller.scrollTop);
    if (trigger === 'Enter')
      nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer }, submit);
    else nav.window.dispatch('click', { target: nav.sendButton }, submit);
    assert.equal(seen, 0, 'the handler sees the thread where the user left it');
    assert.equal(nav.scroller.scrollTop, 3200, 'the jump lands before the task ends');
    nav.scroller.scrollTop = 0;
    nav.runTimers();
    assert.equal(nav.scroller.scrollTop, 0, 'one jump per send');
  });

  test(`${trigger}: a send whose event never bubbles still pre-jumps after the task`, () => {
    const nav = setup();
    if (trigger === 'Enter')
      nav.window.emit('keydown', { key: 'Enter', target: nav.composer }, 'capture');
    else nav.window.emit('click', { target: nav.sendButton }, 'capture');
    assert.equal(nav.scroller.scrollTop, 0);
    nav.runTimers();
    assert.equal(nav.scroller.scrollTop, 3200);
    nav.window.dispatch('keyup', { key: 'Enter', target: nav.composer });
    assert.equal(nav.window.listeners.get('keydown').filter((x) => !x.capture).length, 0);
  });
}

test('the scrolling group switch also turns off the send pre-jump', () => {
  for (const off of ['seek', 'older', 'older seek']) {
    const nav = setup();
    nav.document.documentElement.setAttribute('data-butter-off', off);
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    nav.window.dispatch('click', { target: nav.sendButton });
    assert.equal(nav.scroller.scrollTop, 0, `pre-jump must stay off when ${off} is off`);
  }
  const nav = setup();
  nav.document.documentElement.setAttribute('data-butter-off', 'rail');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200, 'the rail switch does not control the pre-jump');
});

test('near-bottom sends and non-send key events preserve the thread position', () => {
  const nav = setup();
  for (const event of [
    { shiftKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { key: 'x' },
    { target: nav.scroller },
  ]) {
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer, ...event });
    assert.equal(nav.scroller.scrollTop, 0);
  }
  for (const top of [2750, 3200, 4100]) {
    nav.scroller.scrollTop = top;
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    assert.equal(nav.scroller.scrollTop, top);
  }
});

test('empty composers and disabled send buttons do not pre-jump', () => {
  const nav = setup();
  for (const text of ['', '  \n ']) {
    nav.composer.textContent = text;
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    nav.window.dispatch('click', { target: nav.sendButton });
    assert.equal(nav.scroller.scrollTop, 0);
  }
  nav.composer.textContent = 'New question';
  nav.sendButton.disabled = true;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  nav.window.dispatch('click', { target: nav.sendButton });
  assert.equal(nav.scroller.scrollTop, 0);
  nav.sendButton.disabled = false;
  nav.sendButton.setAttribute('aria-disabled', 'true');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  nav.window.dispatch('click', { target: nav.sendButton });
  assert.equal(nav.scroller.scrollTop, 0);
});

test('the current composer submit button works without legacy IDs', () => {
  const nav = setup();
  nav.sendButton.removeAttribute('data-testid');
  nav.sendButton.setAttribute('type', 'submit');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200);
});

test('seek state lights only the previewed question and uses the existing instant card and busy tick', () => {
  const nav = setup();
  nav.seek({ state: 'dragging', id: 'q1', n: 2, total: 5, unseen: true });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, 'Question 2 of 5 · not opened yet');
  assert.equal(nav.select('.text').textContent, 'Question 1');
  assert.ok(nav.select('.rail').classList.contains('hot'));
  assert.ok(nav.select('.cardpos').classList.contains('instant'));
  assert.deepEqual(
    nav.geometry().map((x) => x[1]),
    [0.28, 1, 0.28, 0.28, 0.28],
  );
  nav.seek({ state: 'loading', id: 'q1', n: 2, total: 5 });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, 'Loading question 2…');
  assert.equal(nav.select('.meta').firstChild.className, 'spin');
  assert.ok(nav.ticks()[1].classList.contains('busy'));
  nav.seek({ state: 'idle' });
  nav.flush();
  assert.equal(nav.ticks()[1].classList.contains('busy'), false);
  nav.advanceClock(1000);
  nav.runTimers();
  nav.flush();
  assert.equal(nav.select('.card').classList.contains('show'), false);
  assert.equal(nav.select('.rail').classList.contains('hot'), false);
});

test('seek card follows live language changes and ignores state from a different conversation', () => {
  const nav = setup();
  nav.seek({ state: 'dragging', id: 'q2', n: 3, total: 5 });
  nav.flush();
  nav.document.documentElement.setAttribute('data-butter-lang', 'zh');
  nav.document.emit('butter-settings');
  nav.flush();
  assert.equal(nav.select('.meta').textContent, '第 3 / 5 个问题');
  nav.seek({ conv: 'other', state: 'loading', id: 'q0', n: 1, total: 5 });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, '第 3 / 5 个问题');
});

// Adapter wiring: the model's dots drawn, the fade-out's timer, the host hidden with the rail off.
test("a question's last bookmark deleted: its dot fades out over 160 ms; with the rail off, none", () => {
  const nav = setup({ count: 4 });
  nav.setMarks({ q1: [false] });
  nav.flush();
  assert.deepEqual(nav.dots(), [
    { q: 1, right: 16, center: 10 + 1.5 * 14, d: 4, hidden: 'true', stale: false, faint: false },
  ]);
  nav.setMarks({});
  const [gone] = nav.select('.marks').children;
  assert.ok(gone.classList.contains('gone'), 'fading');
  nav.advanceClock(160);
  nav.runTimers();
  assert.equal(nav.dots().length, 0);
  // The rail off (Butter paused turns it off too): the page script sends no bookmarks, and the
  // rail's host is hidden.
  nav.setMarks({ q2: [false] });
  nav.document.documentElement.setAttribute('data-butter-off', 'rail');
  nav.document.emit('butter-settings');
  nav.setMarks({});
  nav.advanceClock(160);
  nav.runTimers();
  nav.flush();
  assert.equal(nav.dots().length, 0);
  assert.equal(nav.host.style.display, 'none');
});

test('keyboard: ArrowLeft on the three dots enters their card; ArrowRight and Escape return; ArrowDown goes to the first tick', () => {
  const nav = setup({ count: 3, hasPrev: true });
  nav.setMarks({ '-1': [false, false], q0: [false] });
  const more = nav.select('.more'),
    ticks = nav.ticks(),
    key = (el, k, target) => el.emit('keydown', { key: k, target, preventDefault() {} });
  key(nav.select('.rail'), 'ArrowDown', more);
  assert.equal(FakeElement.focused, ticks[0], 'no stop between the three dots and the first tick');
  key(nav.select('.rail'), 'ArrowUp', ticks[0]);
  assert.equal(FakeElement.focused, more);
  key(nav.select('.rail'), 'ArrowLeft', more);
  const card = nav.select('.card');
  assert.ok(card.classList.contains('show'));
  assert.equal(card.getAttribute('aria-label'), 'Earlier questions · 2 bookmarks');
  const go = nav.select('.bmc').querySelectorAll('.go');
  assert.equal(FakeElement.focused, go[0], 'the first row');
  key(card, 'ArrowDown', go[0]);
  assert.equal(FakeElement.focused, go[1]);
  key(card, 'ArrowRight', go[1]);
  assert.equal(FakeElement.focused, more);
  key(nav.select('.rail'), 'ArrowLeft', more);
  key(card, 'Escape', nav.select('.bmc').querySelectorAll('.go')[0]);
  assert.equal(FakeElement.focused, more);
});
