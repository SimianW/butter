import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import seekMeta from '../extension/seek/seek-meta.js';
import bookmarks from '../extension/bookmarks/model.js';

const source = fs.readFileSync(new URL('../extension/rail/rail.js', import.meta.url), 'utf8');
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
  vm.runInContext(source, ctx, { filename: 'rail/rail.js' });
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
  const pointer = (index) => {
    const y = parseFloat(host.style['--y']) + 10 + (select('.more').hidden ? 0 : 16);
    select('.rail').emit('pointermove', {
      clientY: y + (index + 0.5) * parseFloat(host.style['--pitch']),
    });
  };
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
    pointer,
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

function assertBetween(actual, start, target) {
  actual.forEach((values, i) =>
    values.forEach((value, axis) => {
      // The production styles round to three decimals.
      const lo = Math.min(start[i][axis], target[i][axis]) - 0.001;
      const hi = Math.max(start[i][axis], target[i][axis]) + 0.001;
      assert.ok(
        value >= lo && value <= hi,
        `bar ${i}, axis ${axis}: ${value} outside [${lo}, ${hi}]`,
      );
    }),
  );
}

test('overlay rail reserves the scrollbar strip; classic gutters keep their original position', () => {
  for (const gutter of [0, 15, 20]) {
    const nav = setup({ gutter });
    assert.ok(nav.host.attributes.has('data-on'));
    const right = 1200 - parseFloat(nav.host.style['--r']);
    assert.equal(1000 - right, gutter ? gutter + 4 : 12);
    nav.pointer(2);
    nav.flush();
    assert.equal(1200 - parseFloat(nav.host.style['--r']), right, 'hover keeps the rail position');
    nav.seek({ state: 'dragging', id: 'q1', n: 2, total: 5 });
    nav.flush();
    assert.equal(1200 - parseFloat(nav.host.style['--r']), right, 'seek keeps the rail position');
    // Switching scrollbar mode must replace the offset rather than accumulate it.
    nav.scroller.clientWidth = 985;
    nav.resize(nav.scroller);
    nav.flush();
    assert.equal(parseFloat(nav.host.style['--r']), 219);
    nav.scroller.clientWidth = 1000;
    nav.resize(nav.scroller);
    nav.flush();
    assert.equal(parseFloat(nav.host.style['--r']), 212);
  }
});

test('hover wave stays within its targets when the frame timestamp predates kick()', () => {
  const nav = setup();
  nav.pointer(2);
  nav.flush();
  const swollen = nav.geometry();
  assert.deepEqual(swollen[2], [2.6, 1, 1.6]);
  nav.advanceClock(1000); // page was busy after the frame started
  nav.select('.rail').emit('pointerleave'); // kick() stores the newer performance.now()
  const resting = swollen.map(() => [1, 0.28, 1]);
  nav.frame(10_000); // earlier than kick(), deliberately by much more than one frame
  assertBetween(nav.geometry(), swollen, resting);
  nav.frame(10_001); // still older: last must remain monotonic
  assertBetween(nav.geometry(), swollen, resting);
  nav.flush();
  assert.deepEqual(nav.geometry(), resting);
});

test('hover wave frame pending when the chat is left for the home page does not throw, and the rail draws on Back', () => {
  const nav = setup();
  nav.pointer(2);
  nav.flush();
  nav.select('.rail').emit('pointerleave'); // the wave eases back to rest
  nav.frame(); // still moving: the next frame is queued
  assert.ok(nav.pendingFrames() > 0);
  nav.navigate('/'); // the questions go before the bars do
  assert.doesNotThrow(() => {
    nav.frame();
    nav.flush();
  });
  assert.ok(!nav.host.attributes.has('data-on'));
  nav.navigate(`/c/${conversation}`);
  nav.flush();
  assert.ok(nav.host.attributes.has('data-on'));
  assert.equal(nav.ticks().length, 5);
  nav.pointer(2);
  nav.flush();
  assert.deepEqual(nav.geometry()[2], [2.6, 1, 1.6]);
});

test('hover wave converges monotonically, stays finite across long frames, and stops at rest', () => {
  const nav = setup({ count: 60, hasPrev: true });
  nav.pointer(30);
  const target = nav.geometry().map((_, i) => {
    const distance = ((i - 30) * parseFloat(nav.host.style['--pitch'])) / 20;
    const gaussian = Math.exp((-distance * distance) / 2);
    return [1 + 1.6 * gaussian, 0.28 + 0.72 * gaussian, 1 + 0.6 * gaussian];
  });
  let previous = nav.geometry();
  for (let i = 0; i < 100 && nav.pendingFrames(); i++) {
    nav.advanceClock(i === 0 ? 60_000 : 16);
    nav.frame();
    const current = nav.geometry();
    assertBetween(current, previous, target);
    previous = current;
  }
  assert.equal(nav.pendingFrames(), 0);
  previous.forEach((values, i) =>
    values.forEach((value, axis) => {
      assert.ok(Math.abs(value - target[i][axis]) <= 0.001);
    }),
  );
  nav.select('.rail').emit('pointerleave');
  nav.flush();
  assert.deepEqual(
    nav.geometry(),
    target.map(() => [1, 0.28, 1]),
  );
});

test('overlapping older pages deduplicate questions, and an empty final page hides the earlier button', () => {
  const nav = setup({ count: 3, hasPrev: true });
  const page = {
    type: 'page',
    conv: conversation,
    before: 'q0',
    hasPrev: true,
    items: [
      { id: 'older', q: 'Older question' },
      { id: 'q0', q: 'Question 0' },
    ],
  };
  nav.send(page);
  nav.flush();
  nav.send(page);
  nav.flush();
  assert.deepEqual(
    nav.ticks().map((tick) => tick.getAttribute('aria-label')),
    ['Older question', 'Question 0', 'Question 1', 'Question 2'],
  );
  assert.equal(nav.select('.more').hidden, false);
  nav.send({ ...page, items: [], hasPrev: false });
  nav.flush();
  assert.equal(nav.select('.more').hidden, true);
  assert.equal(nav.ticks().length, 4);
});

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

test('seek lights every turn intersecting the preview band', () => {
  const nav = setup();
  nav.seek({ state: 'dragging', id: 'q1', lit: ['q1', 'q2'], n: 2, total: 5 });
  nav.flush();
  assert.deepEqual(
    nav.geometry().map((x) => x[1]),
    [0.28, 1, 1, 0.28, 0.28],
  );
});

test('a bookmark dot keeps 4 px from its tick through the hover wave and stays inside the rail', () => {
  const nav = setup({ count: 8 });
  nav.setMarks({ q1: [false], q3: [false, false], q6: [true] });
  nav.flush();
  const pitch = parseFloat(nav.host.style['--pitch']);
  // The dot's right edge is 4 px left of the tick (12 px x its scale); the tick's right end is 6 px
  // in from the rail's right edge, which is 52 px wide.
  const assertBeside = () => {
    const bars = nav.geometry(),
      ds = nav.dots();
    assert.deepEqual(
      ds.map((d) => d.q),
      [1, 3, 6],
    );
    for (const d of ds) {
      // Both are drawn rounded: the bar's scale to 3 decimals, the dot to 0.01 px.
      assert.ok(
        Math.abs(d.right - (12 * bars[d.q][0] + 4)) <= 0.02,
        `q${d.q}: ${d.right} vs scale ${bars[d.q][0]}`,
      );
      assert.ok(
        Math.abs(d.center - (10 + (d.q + 0.5) * pitch)) <= 0.01,
        `q${d.q} on its tick's row`,
      );
      assert.ok(6 + d.right + d.d <= 52, `q${d.q} inside the rail`);
      assert.equal(d.d, 4);
      assert.equal(d.hidden, 'true');
    }
  };
  // At rest: 16 px from the ticks' end (12 + 4).
  assertBeside();
  assert.equal(nav.dots()[0].right, 16);
  nav.pointer(3);
  let widest = 0;
  for (let i = 0; i < 100 && nav.pendingFrames(); i++) {
    nav.frame();
    assertBeside();
    widest = Math.max(widest, ...nav.dots().map((d) => d.right));
  }
  assert.ok(
    Math.abs(widest - (12 * 2.6 + 4)) <= 0.01,
    `the dot under the pointer follows a 31 px tick: ${widest}`,
  );
  nav.select('.rail').emit('pointerleave');
  for (let i = 0; i < 100 && nav.pendingFrames(); i++) {
    nav.frame();
    assertBeside();
  }
  assert.equal(nav.pendingFrames(), 0, 'no frame runs at rest');
  // Only q6's bookmarks are all stale: its dot is hollow.
  assert.deepEqual(
    nav.dots().map((d) => d.stale),
    [false, false, true],
  );
});

test('close ticks shrink the dot; an all-stale dot too small for a ring is faint', () => {
  // 120 questions in 900 px: a pitch under 6 px.
  const nav = setup({ count: 120 });
  nav.setMarks({ q2: [false], q5: [true] });
  nav.flush();
  const pitch = parseFloat(nav.host.style['--pitch']);
  assert.ok(pitch < 6, `pitch ${pitch}`);
  const [live, stale] = nav.dots();
  assert.ok(Math.abs(live.d - Math.max(2, pitch - 2)) < 1e-9, `d ${live.d}`);
  assert.ok(!live.stale && !live.faint);
  assert.ok(stale.faint && !stale.stale, 'solid at 45 % instead of a ring');
});

test("the rail's arrow stops are the ticks: a question's bookmarks add no stop", () => {
  const nav = setup({ count: 4 });
  nav.setMarks({ q1: [false], q2: [false, true] });
  nav.flush();
  const ticks = nav.ticks(),
    down = (target) =>
      nav.select('.rail').emit('keydown', { key: 'ArrowDown', target, preventDefault() {} });
  down(ticks[0]);
  assert.equal(FakeElement.focused, ticks[1]);
  down(ticks[1]);
  assert.equal(FakeElement.focused, ticks[2], 'from a tick that holds bookmarks to the next tick');
  down(ticks[2]);
  assert.equal(FakeElement.focused, ticks[3]);
});

test("a question's last bookmark deleted: its dot fades out over 160 ms; with the rail off, none", () => {
  const nav = setup({ count: 4 });
  nav.setMarks({ q1: [false] });
  nav.flush();
  assert.equal(nav.dots().length, 1);
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

// Earlier history (#72): its bookmarks show as a dot beside the three dots, and the three dots
// show their card. The dot is no arrow stop of its own.
const EARLIER_HINT = 'Earlier questions are not loaded yet. Click to load them.';
test("earlier history's bookmarks: one 4 px dot on the three dots' row, 4 px left of the leftmost, always solid", () => {
  const nav = setup({ count: 4, hasPrev: true });
  nav.setMarks({ '-1': [true, false], q1: [false] });
  nav.flush();
  const [earlier, q1] = nav.dots();
  // The three dots end 8 px in from the rail's right edge (6 px padding, 2 px of their own) and
  // span 15 px: the dot's right edge is 21 px left of the ticks' right end. Their row is the
  // rail's first 16 px under its 10 px padding.
  assert.equal(earlier.q, -1);
  assert.equal(earlier.right, 21);
  assert.equal(earlier.center, 18);
  assert.equal(earlier.d, 4);
  assert.equal(earlier.hidden, 'true');
  assert.ok(!earlier.stale && !earlier.faint, 'solid: bookmarks in unloaded history count as live');
  assert.equal(q1.q, 1);
  // Only dots are drawn, nothing focusable.
  assert.deepEqual(
    nav.select('.marks').children.map((el) => [el.tagName, el.className]),
    [
      ['i', 'bdot'],
      ['i', 'bdot'],
    ],
  );
  // Under the pointer the three dots don't move: neither does their dot.
  nav.pointer(-1);
  for (let i = 0; i < 100 && nav.pendingFrames(); i++) nav.frame();
  assert.equal(nav.dots()[0].right, 21);
});

test("the three dots' name appends the earlier-history label; without bookmarks, their hint alone", () => {
  const nav = setup({ count: 3, hasPrev: true });
  const more = nav.select('.more');
  nav.setMarks({ '-1': [false, false] });
  assert.equal(
    more.getAttribute('aria-label'),
    `${EARLIER_HINT} · Earlier questions · 2 bookmarks: Bookmark 0; Bookmark 1`,
  );
  nav.setMarks({});
  assert.equal(more.getAttribute('aria-label'), EARLIER_HINT);
});

test("the three dots holding bookmarks show the earlier card; without, today's hint card", () => {
  const nav = setup({ count: 3, hasPrev: true });
  const card = nav.select('.card'),
    more = nav.select('.more');
  nav.select('.rail').emit('pointerenter');
  nav.pointer(-1);
  assert.ok(card.classList.contains('show'));
  assert.ok(card.inert, 'the hint card takes no pointer');
  assert.equal(card.getAttribute('role'), 'tooltip');
  nav.select('.rail').emit('pointerleave');
  nav.advanceClock(250);
  nav.runTimers();
  nav.setMarks({ '-1': [false, false] });
  nav.select('.rail').emit('pointerenter');
  nav.pointer(-1);
  assert.ok(card.classList.contains('show'));
  assert.ok(!card.inert, 'the bookmark card takes the pointer');
  assert.equal(card.getAttribute('role'), 'group');
  assert.equal(card.getAttribute('aria-label'), 'Earlier questions · 2 bookmarks');
  assert.equal(nav.select('.meta').textContent, 'Earlier questions · 2 bookmarks');
  // Each row starts with the rail's dot, not a flag.
  const rows = nav.select('.bmc').querySelectorAll('.it');
  assert.equal(rows.length, 2);
  for (const it of rows) assert.equal(it.children[0].children[0].className, 'dot');
  // Focus on the three dots shows it too.
  nav.select('.rail').emit('pointerleave');
  nav.advanceClock(250);
  nav.runTimers();
  assert.ok(!card.classList.contains('show'));
  nav.select('.rail').emit('focusin', { target: more });
  assert.ok(card.classList.contains('show'));
  assert.equal(card.getAttribute('aria-label'), 'Earlier questions · 2 bookmarks');
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
