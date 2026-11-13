// The turn tracker (extension/rail/turns.js) driven directly over the fake DOM in
// test/helpers/rail-dom.mjs: scrollers and turns reported through `butterNavTurn`, observers that
// record what they observe, a fake model (its questions, box and journey status) and the callbacks
// counted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ButterRailModel from '../extension/rail/model.js';
import { FakeElement, fakeObservers } from './helpers/rail-dom.mjs';

const source = fs.readFileSync(new URL('../extension/rail/turns.js', import.meta.url), 'utf8');

// A scroller 900 px tall whose turns sit `top` px down the chat, 100 px tall each.
const scroller = () => {
  const s = new FakeElement('main');
  Object.assign(s, {
    className: 'thread-scroll-container',
    scrollTop: 0,
    scrollHeight: 5000,
    clientHeight: 900,
    clientWidth: 985,
    offsetWidth: 1000,
    getBoundingClientRect: () => ({ top: 0, bottom: 900, left: 0, right: 1000, width: 1000 }),
  });
  return s;
};
const turn = (s, id, top) => {
  const t = new FakeElement('article');
  t.setAttribute('data-turn-key', id);
  t.top = top;
  t.getBoundingClientRect = () => ({ top: t.top - s.scrollTop, bottom: t.top + 100 - s.scrollTop });
  const bubble = new FakeElement();
  bubble.textContent = `  text of ${id} `;
  t.querySelector = (selector) => (selector === '[data-user-message-bubble]' ? bubble : null);
  s.append(t);
  return t;
};

function setup({ count = 10 } = {}) {
  const timers = [],
    calls = { changed: 0, kick: 0, sync: 0, scrolled: 0, mounted: [] };
  const window = new FakeElement();
  const host = new FakeElement('chatgpt-butter-nav');
  const observers = fakeObservers();
  const model = {
    qs: Array.from({ length: count }, (_, i) => ({ id: `q${i}` })),
    box: null,
    flying: false,
    boxes: [],
    reconciled: [],
    reconcileResult: false,
    index(id) {
      const i = this.qs.findIndex((q) => q.id === id);
      return i < 0 ? null : i;
    },
    measure(box) {
      this.boxes.push(box);
      this.box = box;
    },
    reconcile(keys, text) {
      this.reconciled.push([keys, keys.map(text)]);
      return this.reconcileResult;
    },
  };
  const ctx = vm.createContext({
    ButterRailModel,
    Element: FakeElement,
    ResizeObserver: observers.ResizeObserver,
    IntersectionObserver: observers.IntersectionObserver,
    addEventListener: window.addEventListener.bind(window),
    setTimeout(callback, ms) {
      timers.push({ callback, ms });
    },
  });
  vm.runInContext(source, ctx, { filename: 'rail/turns.js' });
  const turns = ctx.ButterRailTurns(model, {
    changed: () => calls.changed++,
    kick: () => calls.kick++,
    sync: () => calls.sync++,
    scrolled: () => calls.scrolled++,
    mounted: (el) => calls.mounted.push(el.getAttribute('data-turn-key')),
    ignore: (t) => t === host,
  });
  // The tracker's position and lit-band observers for the scroller it follows now.
  const io = () => observers.intersectionObservers.slice(-2);
  const runTimers = () => {
    for (const t of timers.splice(0)) t.callback();
  };
  return { turns, model, calls, window, host, ctx, observers, io, timers, runTimers };
}
// A visible scroller with turns q0…q(n-1) mounted 100 px apart from 100 px down, as the tracker
// follows it.
function visible(t, n = 3, s = scroller()) {
  const els = Array.from({ length: n }, (_, i) => turn(s, `q${i}`, 100 + 100 * i));
  for (const el of els) t.ctx.butterNavTurn(el);
  t.observers.resize(s);
  return { s, els };
}
// Values made in the script's realm, as this realm's (deepStrictEqual compares prototypes).
const own = (x) => structuredClone(x);
const ids = (set) => [...set].map((el) => el.getAttribute('data-turn-key'));

test('the tracker follows the visible scroller and measures its box', () => {
  const t = setup();
  const { s, els } = visible(t);
  assert.equal(t.turns.scroller, s);
  assert.equal(t.turns.el('q1'), els[1]);
  assert.equal(t.turns.el('q9'), null);
  assert.deepEqual(own(t.model.boxes), [
    null, // attach forgets the last scroller's box
    { top: 0, bottom: 900, left: 0, right: 985, gutter: 15, width: 1000 },
  ]);
  assert.equal(t.calls.changed, 1);
  assert.equal(t.calls.sync, 4, 'each reported turn and the attach check the conversation');
  assert.deepEqual(t.calls.mounted, [], 'no turn mounted in the followed scroller yet');
  const [pos, band] = t.io();
  assert.equal(pos.options.root, s);
  assert.equal(band.options.root, s);
  assert.equal(band.options.rootMargin, '-92px 0px -180px 0px'); // HEADER, COMPOSER and EDGE
  assert.deepEqual(ids(pos.observed), ['q0', 'q1', 'q2']);
  assert.deepEqual(ids(band.observed), ['q0', 'q1', 'q2']);
  // A turn mounted now is observed at once and reported.
  const q3 = turn(s, 'q3', 400);
  t.ctx.butterNavTurn(q3);
  assert.deepEqual(t.calls.mounted, ['q3']);
  assert.ok(pos.observed.has(q3) && band.observed.has(q3));
});

test("a hidden copy's scroller shown again takes over, and its mounted turns are observed afresh", () => {
  const t = setup();
  const { s: first, els } = visible(t);
  t.io()[1].callback([{ target: els[0], isIntersecting: true }]); // q0 lit
  assert.deepEqual(own(t.turns.onScreen()), ['q0']);
  // ChatGPT kept another chat as a hidden copy with its own scroller and turns.
  const kept = scroller();
  const k = [turn(kept, 'k0', 100), turn(kept, 'k1', 200)];
  for (const el of k) t.ctx.butterNavTurn(el);
  assert.deepEqual(t.calls.mounted, [], 'not mounted in the followed scroller');
  assert.equal(t.turns.el('k0'), null);
  t.observers.resize(kept, 0); // still hidden: no switch
  assert.equal(t.turns.scroller, first);
  const [oldPos, oldBand] = t.io();
  t.observers.resize(kept);
  assert.equal(t.turns.scroller, kept);
  assert.deepEqual(own(t.turns.onScreen()), [], "the other chat's lit turns are forgotten");
  assert.ok(oldPos.disconnected && oldBand.disconnected);
  const [pos, band] = t.io();
  assert.deepEqual(ids(pos.observed), ['k0', 'k1']);
  assert.deepEqual(ids(band.observed), ['k0', 'k1']);
  assert.equal(t.turns.el('k1'), k[1]);
  assert.equal(t.turns.el('q0'), null);
  // And back: the first chat's turns, still mounted, are observed again.
  t.observers.resize(first);
  assert.deepEqual(ids(t.io()[1].observed), ['q0', 'q1', 'q2']);
  // A scroller gone from the page is dropped.
  kept.isConnected = false;
  t.observers.resize(kept);
  assert.equal(t.turns.scroller, first);
  assert.equal(
    t.observers.resizeObservers[0].observed.has(kept),
    false,
    'a disconnected scroller is unobserved',
  );
});

test('the lit band: turns entering it are lit, kick waits while a jump travels, reband observes again', () => {
  const t = setup();
  const { els } = visible(t);
  const [, band] = t.io();
  band.callback([
    { target: els[0], isIntersecting: true },
    { target: els[1], isIntersecting: true },
  ]);
  assert.equal(t.calls.kick, 1);
  assert.deepEqual(own(t.turns.onScreen()), ['q0', 'q1']);
  els[0].isConnected = false; // unmounted: dropped from the set
  assert.deepEqual(own(t.turns.onScreen()), ['q1']);
  els[0].isConnected = true;
  assert.deepEqual(own(t.turns.onScreen()), ['q1']);
  t.model.flying = true;
  band.callback([{ target: els[1], isIntersecting: false }]);
  assert.equal(t.calls.kick, 1, 'no kick while a jump travels');
  assert.deepEqual(own(t.turns.onScreen()), []);
  band.callback([{ target: els[2], isIntersecting: true }]);
  band.log.length = 0;
  t.turns.reband();
  assert.deepEqual(own(t.turns.onScreen()), []);
  assert.deepEqual(
    band.log.map(([op, el]) => `${op} ${el.getAttribute('data-turn-key')}`),
    ['unobserve q0', 'observe q0', 'unobserve q1', 'observe q1', 'unobserve q2', 'observe q2'],
  );
  const each = [];
  els[2].isConnected = false;
  t.turns.each((el) => each.push(el.getAttribute('data-turn-key')));
  assert.deepEqual(each, ['q0', 'q1'], 'each: connected turns in the visible scroller');
});

test('estimate: last seen, or interpolated between the nearest records and the chat ends', () => {
  const t = setup();
  const { s } = visible(t, 1); // q0 mounted, not yet recorded
  const [pos] = t.io();
  const record = (id, top) => {
    const el = new FakeElement();
    el.setAttribute('data-turn-key', id);
    pos.callback([
      { target: el, boundingClientRect: { top: top - s.scrollTop }, rootBounds: { top: 0 } },
    ]);
  };
  assert.equal(t.turns.estimate(3), 1500, 'nothing seen: by index over the chat height');
  record('q5', 2000);
  assert.equal(t.turns.estimate(2), 800, 'from the top to the first record');
  t.turns.forget();
  s.scrollTop = 600; // records are in scroll coordinates
  record('q2', 1000);
  assert.equal(t.turns.estimate(2), 1000, 'seen');
  assert.equal(t.turns.estimate(6), 3000, 'from the last record to the end');
  record('q6', 3400);
  assert.equal(t.turns.estimate(4), 2200, 'between two records');
  t.turns.forget();
  assert.equal(t.turns.estimate(4), 2000);
});

test('measure records the mounted turns and where the next one starts', () => {
  const t = setup();
  const { s } = visible(t, 3);
  s.scrollTop = 50;
  const seen = new Set();
  assert.deepEqual(own(t.turns.measure(seen)), [0, 2]);
  assert.deepEqual([...seen], ['q0', 'q1', 'q2', 'q3']);
  assert.equal(t.turns.estimate(1), 200);
  assert.equal(t.turns.estimate(3), 400, "q3 starts where q2's turn ends");
  const none = setup();
  const other = scroller();
  none.ctx.butterNavTurn(turn(other, 'x', 100)); // a turn that isn't one of the questions
  none.observers.resize(other);
  assert.deepEqual(own(none.turns.measure(new Set())), [Infinity, -1]);
});

// Old records 1000 px down plus a quadratic term, and mounted turns at another quadratic, so that no
// record can be told from an interpolation.
const planted = (j) => 1000 + 100 * j + 10 * j * j;
const at = (j) => 50 * j * j;
// A tracker over q0…q9 with the turns `mounted` (indexes; 'x' a turn that isn't a question) mounted
// at `at`, 100 px tall, and an old record for every question.
function scene(mounted) {
  const t = setup();
  const s = scroller();
  for (const j of mounted) t.ctx.butterNavTurn(turn(s, j === 'x' ? 'x' : `q${j}`, at(j)));
  t.observers.resize(s);
  const [pos] = t.io();
  for (let j = 0; j < 10; j++) {
    const el = new FakeElement();
    el.setAttribute('data-turn-key', `q${j}`);
    pos.callback([{ target: el, boundingClientRect: { top: planted(j) }, rootBounds: { top: 0 } }]);
  }
  // The questions that still have a record: estimate gives exactly the planted one, or the one a
  // measure took (a mounted turn's top, or the bottom of the last one for the question after it).
  const last = Math.max(-1, ...mounted.filter(Number.isInteger));
  const exact = (j) => [
    planted(j),
    mounted.includes(j) ? at(j) : -1,
    j === last + 1 ? at(last) + 100 : -1,
  ];
  const records = () =>
    Array.from({ length: 10 }, (_, j) => j).filter((j) => exact(j).includes(t.turns.estimate(j)));
  return { t, records };
}

test('retarget drops only the unseen records between the mounted turns and the target', () => {
  // Target below the mounted turns: from after the one just below them (q6, measured) to the end.
  let { t, records } = scene([4, 5]);
  const seen = new Set(['q9']); // read earlier in this jump: kept
  assert.deepEqual(own(t.turns.retarget(8, seen)), [4, 5]);
  assert.deepEqual([...seen], ['q9', 'q4', 'q5', 'q6']);
  assert.deepEqual(records(), [0, 1, 2, 3, 4, 5, 6, 9]);
  // Target above: from the top to the mounted turns.
  ({ t, records } = scene([4, 5]));
  t.turns.retarget(2, new Set(['q1']));
  assert.deepEqual(records(), [1, 4, 5, 6, 7, 8, 9]);
  // Target in a gap between mounted turns: only its own record.
  ({ t, records } = scene([4, 6]));
  assert.deepEqual(own(t.turns.retarget(5, new Set())), [4, 6]);
  assert.deepEqual(records(), [0, 1, 2, 3, 4, 6, 7, 8, 9]);
  // No question mounted: only the target's own record.
  ({ t, records } = scene(['x']));
  assert.deepEqual(own(t.turns.retarget(3, new Set())), [Infinity, -1]);
  assert.deepEqual(records(), [0, 1, 2, 4, 5, 6, 7, 8, 9]);
  assert.equal(t.turns.estimate(3), (planted(2) + planted(4)) / 2);
});

test('user scrolling: wheel, touch and the scrollbar on the visible scroller; scroll keys aimed at the chat', () => {
  const t = setup();
  const { s, els } = visible(t);
  s.emit('wheel');
  s.emit('touchstart');
  assert.equal(t.calls.scrolled, 2);
  s.emit('pointerdown', { clientX: 990 }); // the scrollbar, right of the box
  assert.equal(t.calls.scrolled, 3);
  s.emit('pointerdown', { clientX: 500 });
  els[0].emit('pointerdown', { clientX: 990 });
  assert.equal(t.calls.scrolled, 3, 'the content, or a turn, is no scrollbar');
  const kept = scroller();
  t.ctx.butterNavTurn(turn(kept, 'k0', 100));
  kept.emit('pointerdown', { clientX: 990 });
  assert.equal(t.calls.scrolled, 3, "a hidden copy's scrollbar");
  kept.emit('wheel');
  assert.equal(t.calls.scrolled, 4);
  assert.equal(s.listeners.get('wheel').length, 1, 'listeners added once per scroller');
  // A middle press starts Chrome's autoscroll, wherever in the chat it lands.
  s.emit('pointerdown', { button: 1, clientX: 500, target: els[0] });
  assert.equal(t.calls.scrolled, 5, 'a middle press on answer content');
  s.emit('pointerdown', { button: 0, clientX: 500, target: els[0] });
  s.emit('pointerdown', { button: 2, clientX: 500, target: els[0] });
  assert.equal(t.calls.scrolled, 5, 'a left or right press on answer content is no scroll');
  kept.emit('pointerdown', { button: 1, clientX: 500 });
  assert.equal(t.calls.scrolled, 5, "a middle press in a hidden copy's content");

  const key = (k, target, more = {}) => {
    const before = t.calls.scrolled;
    t.window.emit('keydown', { key: k, target, ...more }, 'capture');
    return t.calls.scrolled - before;
  };
  for (const k of ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '])
    assert.equal(key(k, els[0]), 1, k);
  assert.equal(key('Enter', els[0]), 0);
  assert.equal(key('a', els[0]), 0);
  for (const mod of ['altKey', 'ctrlKey', 'metaKey'])
    assert.equal(key('PageDown', els[0], { [mod]: true }), 0, mod);
  assert.equal(key('PageDown', {}), 0, 'not an element');
  assert.equal(key('ArrowDown', t.host), 0, "the rail's own keys");
  const editable = new FakeElement();
  editable.isContentEditable = true;
  assert.equal(key('ArrowDown', editable), 0);
  for (const tag of ['input', 'textarea', 'select']) {
    const field = new FakeElement(tag),
      inner = new FakeElement('span');
    field.append(inner);
    assert.equal(key('PageDown', inner), 0, tag);
  }
  const button = new FakeElement('button'),
    link = new FakeElement('a'),
    role = new FakeElement();
  role.setAttribute('role', 'button');
  for (const el of [button, link, role]) {
    assert.equal(key(' ', el), 0, `Space on ${el.tagName}`);
    assert.equal(key('PageDown', el), 1, `PageDown on ${el.tagName}`);
  }
});

test('reconcile: once per 150 ms after turns mount or the scroller changes, with the visible turns', () => {
  const t = setup();
  const s = scroller();
  const els = [turn(s, 'q2', 300), turn(s, 'q0', 100)];
  for (const el of els) t.ctx.butterNavTurn(el);
  t.observers.resize(s);
  assert.deepEqual(
    t.timers.map((x) => x.ms),
    [150],
    'one reconcile queued',
  );
  t.model.reconcileResult = true;
  t.runTimers();
  assert.deepEqual(own(t.model.reconciled), [
    [
      ['q2', 'q0'],
      ['text of q2', 'text of q0'],
    ],
  ]);
  assert.equal(t.calls.changed, 2, "the box's change and the reconcile's");
  t.ctx.butterNavTurn(turn(s, 'q1', 200));
  t.ctx.butterNavTurn(turn(s, 'q3', 400));
  assert.equal(t.timers.length, 1);
  t.model.reconcileResult = false;
  t.runTimers();
  assert.equal(t.model.reconciled.length, 2);
  assert.equal(t.calls.changed, 2, 'nothing changed');
  // No box (a hidden copy, or before the first measure) or a scroller gone: nothing reconciled.
  t.model.box = { width: 0 };
  t.ctx.butterNavTurn(turn(s, 'q4', 500));
  t.runTimers();
  t.model.box = { width: 1000 };
  s.isConnected = false;
  t.ctx.butterNavTurn(turn(s, 'q5', 600));
  t.runTimers();
  assert.equal(t.model.reconciled.length, 2);
});

test('a scroller shown with no new turn reported queues one reconcile of its own', () => {
  const t = setup();
  visible(t);
  const kept = scroller();
  t.ctx.butterNavTurn(turn(kept, 'k0', 100)); // reported while hidden
  t.runTimers();
  assert.equal(t.timers.length, 0);
  t.observers.resize(kept); // shown again: no turn mounts
  assert.deepEqual(
    t.timers.map((x) => x.ms),
    [150],
  );
  t.runTimers();
  assert.deepEqual(own(t.model.reconciled.at(-1)[0]), ['k0']);
});
