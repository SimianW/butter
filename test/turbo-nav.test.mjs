import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../extension/turbo-nav.js', import.meta.url), 'utf8');
const conversation = '12345678-1234-1234-1234-123456789abc';

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name); else classes.delete(name);
      },
    };
    this.isConnected = true;
    this.textContent = '';
  }
  addEventListener(type, callback, options) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, once: options?.once });
    this.listeners.set(type, listeners);
  }
  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (listener.once) this.listeners.set(type, this.listeners.get(type).filter(x => x !== listener));
      listener.callback({ target: this, ...event });
    }
  }
  append(child) { child.parentElement = this; this.children.push(child); }
  get firstChild() { return this.children[0]; }
  remove() { this.parentElement.children = this.parentElement.children.filter(x => x !== this); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, force) { if (force) this.setAttribute(name, ''); else this.removeAttribute(name); }
  contains(el) { return this === el || this.children.some(child => child.contains(el)); }
  closest(selector) {
    if (selector === '.thread-scroll-container' && this.className === 'thread-scroll-container') return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector === '[data-turn-key]' && child.getAttribute('data-turn-key') ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector() { return null; }
  attachShadow() {
    // Only the rail's static template needs lookup; dynamic buttons use append/firstChild.
    const elements = new Map();
    this.shadowRoot = { querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new FakeElement());
      return elements.get(selector);
    } };
    return this.shadowRoot;
  }
}

function setup({ count = 5, hasPrev = false, height = 900 } = {}) {
  let now = 10_000, nextId = 1;
  const frames = new Map(), timers = new Map(), resizeObservers = [];
  const document = new FakeElement();
  document.createElement = tag => new FakeElement(tag);
  document.body = new FakeElement('body');
  document.documentElement = new FakeElement('html');
  const window = new FakeElement();
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.observed = new Set(); resizeObservers.push(this); }
    observe(el) { this.observed.add(el); }
    unobserve(el) { this.observed.delete(el); }
    disconnect() { this.observed.clear(); }
  }
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const ctx = vm.createContext({
    document, navigator: { language: 'en' }, location: { pathname: `/c/${conversation}` },
    Element: FakeElement, ResizeObserver, IntersectionObserver,
    MutationObserver: class { observe() {} },
    getComputedStyle: () => ({ colorScheme: 'light' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1200, performance: { now: () => now },
    addEventListener: window.addEventListener.bind(window),
    requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout(callback, ms) { const id = nextId++; timers.set(id, { callback, at: now + ms }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval() {},
  });
  vm.runInContext(source, ctx, { filename: 'turbo-nav.js' });
  const frame = (timestamp = now + 16) => {
    // rAF's frame-start timestamp may lag the current performance.now() clock.
    now = Math.max(now, timestamp);
    const due = [...frames.values()]; frames.clear();
    for (const callback of due) callback(timestamp);
  };
  const flush = () => {
    for (let i = 0; frames.size && i < 150; i++) frame();
    assert.equal(frames.size, 0, 'animation should settle and stop scheduling frames');
  };
  const send = message => document.emit('turbo-nav', { detail: JSON.stringify(message) });
  const scroller = new FakeElement();
  Object.assign(scroller, {
    className: 'thread-scroll-container', scrollTop: 0, scrollHeight: 5000,
    clientHeight: height, clientWidth: 1000, offsetWidth: 1000,
    getBoundingClientRect: () => ({ top: 0, bottom: height, left: 0, right: 1000, width: 1000 }),
    scrollTo({ top }) { this.scrollTop = top; },
  });
  const turns = Array.from({ length: count }, (_, i) => {
    const turn = new FakeElement('article');
    turn.setAttribute('data-turn-key', `q${i}`);
    turn.top = 100 + 100 * i;
    turn.getBoundingClientRect = () => ({ top: turn.top - scroller.scrollTop, bottom: turn.top + 100 - scroller.scrollTop });
    scroller.append(turn);
    ctx.turboNavTurn(turn);
    return turn;
  });
  const resize = target => {
    for (const observer of [...resizeObservers]) if (observer.observed.has(target)) {
      observer.callback([{ target, contentRect: { width: 1000 } }]);
    }
  };
  resize(scroller);
  send({ type: 'page', conv: conversation, before: null, hasPrev,
    items: turns.map((_, i) => ({ id: `q${i}`, q: `Question ${i}` })) });
  flush();
  const host = document.body.children[0];
  const select = selector => host.shadowRoot.querySelector(selector);
  const ticks = () => select('.ticks').children;
  const pointer = index => {
    const y = parseFloat(host.style['--y']) + 10 + (select('.more').hidden ? 0 : 16);
    select('.rail').emit('pointermove', { clientY: y + (index + 0.5) * parseFloat(host.style['--pitch']) });
  };
  const geometry = () => ticks().map(tick => {
    const bar = tick.firstChild;
    const match = /^scale\(([^,]+), ([^)]+)\)$/.exec(bar.style.transform ?? 'scale(1, 1)');
    assert.ok(match, `invalid transform: ${bar.style.transform}`);
    const values = [Number(match[1]), Number(bar.style.opacity ?? 0.28), Number(match[2])];
    assert.ok(values.every(Number.isFinite), `non-finite geometry: ${values}`);
    return values;
  });
  return { frame, flush, send, select, ticks, pointer, geometry, host, scroller, turns, resize, window,
    pendingFrames: () => frames.size,
    advanceClock: ms => { now += ms; },
  };
}

function assertBetween(actual, start, target) {
  actual.forEach((values, i) => values.forEach((value, axis) => {
    // The production styles round to three decimals.
    const lo = Math.min(start[i][axis], target[i][axis]) - 0.001;
    const hi = Math.max(start[i][axis], target[i][axis]) + 0.001;
    assert.ok(value >= lo && value <= hi, `bar ${i}, axis ${axis}: ${value} outside [${lo}, ${hi}]`);
  }));
}

test('hover wave stays within its targets when the frame timestamp predates kick()', () => {
  const nav = setup();
  nav.pointer(2); nav.flush();
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

test('hover wave converges monotonically, stays finite across long frames, and stops at rest', () => {
  const nav = setup({ count: 60, hasPrev: true });
  nav.pointer(30);
  const target = nav.geometry().map((_, i) => {
    const distance = (i - 30) * parseFloat(nav.host.style['--pitch']) / 20;
    const gaussian = Math.exp(-distance * distance / 2);
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
  previous.forEach((values, i) => values.forEach((value, axis) => {
    assert.ok(Math.abs(value - target[i][axis]) <= 0.001);
  }));
  nav.select('.rail').emit('pointerleave'); nav.flush();
  assert.deepEqual(nav.geometry(), target.map(() => [1, 0.28, 1]));
});

test('overlapping older pages deduplicate questions, and an empty final page hides the earlier button', () => {
  const nav = setup({ count: 3, hasPrev: true });
  const page = { type: 'page', conv: conversation, before: 'q0', hasPrev: true,
    items: [{ id: 'older', q: 'Older question' }, { id: 'q0', q: 'Question 0' }] };
  nav.send(page); nav.flush();
  nav.send(page); nav.flush();
  assert.deepEqual(nav.ticks().map(tick => tick.getAttribute('aria-label')),
    ['Older question', 'Question 0', 'Question 1', 'Question 2']);
  assert.equal(nav.select('.more').hidden, false);
  nav.send({ ...page, items: [], hasPrev: false }); nav.flush();
  assert.equal(nav.select('.more').hidden, true);
  assert.equal(nav.ticks().length, 4);
});

for (const cancel of ['wheel', 'keyboard', 'new click']) {
  test(`${cancel} invalidates a pending jump before it can settle or pin its old target`, async () => {
    const nav = setup();
    const click = index => nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[index] });
    click(2); // close mounted turn: waits for scrollend, then settles and follows
    assert.equal(nav.scroller.scrollTop, nav.turns[2].top - 64);
    if (cancel === 'wheel') nav.scroller.emit('wheel');
    else if (cancel === 'keyboard') nav.window.emit('keydown', { key: 'PageDown', target: nav.scroller });
    else click(4);
    nav.turns[2].top = 800;
    nav.scroller.scrollTop = 700; // user's scroll, or the newer jump's position
    nav.scroller.emit('scrollend');
    // Drain the async glide/steady continuations without using wall-clock timers.
    for (let i = 0; i < 80; i++) { nav.frame(); await Promise.resolve(); }
    const expected = cancel === 'new click' ? nav.turns[4].top - 64 : 700;
    assert.equal(nav.scroller.scrollTop, expected);
    nav.turns[2].top += 200;
    nav.resize(nav.turns[2]); // a stale follow observer must not re-align the cancelled target
    assert.equal(nav.scroller.scrollTop, expected);
    if (cancel === 'new click') {
      nav.turns[4].top += 100;
      nav.resize(nav.turns[4]);
      assert.equal(nav.scroller.scrollTop, nav.turns[4].top - 64, 'only the newest jump stays pinned');
    }
  });
}
