// The card's DOM adapter (extension/rail/card.js) driven directly over the fake DOM, with the real
// rail presentation model behind it (test/helpers/rail-model.mjs) and a recording `view`: rows
// filled from the model's card, the refill keeping focus on the same row, the leave grace, the
// card's keys, the page's Escape for the three dots' card and the seek patch. What the card shows
// is tested through the model in test/rail-card.test.mjs; its wiring into the rail in
// test/rail.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { FakeElement } from './helpers/rail-dom.mjs';
import { EARLIER, RailModel, rail, top } from './helpers/rail-model.mjs';

const source = fs.readFileSync(new URL('../extension/rail/card.js', import.meta.url), 'utf8');

// Buttons click as the keyboard does (detail 0).
class El extends FakeElement {
  click() {
    this.emit('click', { detail: 0 });
  }
}

// A card over a rail of `count` questions holding `marks` ({ id: [stale, …] }), its card 41 px
// tall (an odd height, so a whole-pixel top moves the centre by half a pixel).
function setup({ count = 5, hasPrev = false, marks = {}, height = 41 } = {}) {
  const r = rail({ count, hasPrev });
  r.marks(marks);
  let now = 0,
    nextId = 1;
  const timers = new Map();
  const els = {
    host: new El(),
    rail: new El('nav'),
    cardPos: new El(),
    card: new El(),
    meta: new El(),
    text: new El(),
    bmc: new El(),
  };
  els.card.append(els.meta, els.text, els.bmc);
  els.card.offsetHeight = height;
  els.card.getBoundingClientRect = () => ({ top: 100, bottom: 100 + height });
  els.host.shadowRoot = {
    get activeElement() {
      return FakeElement.focused;
    },
  };
  // The rail's stops: the three dots (EARLIER) and a tick per question.
  const stops = new Map([[EARLIER, new El('button')]]);
  for (let i = 0; i < count; i++) stops.set(i, new El('button'));
  els.rail.append(...stops.values());
  const calls = [];
  const view = {
    seek: () => calls.push(['seek']),
    jumpTo: (id, b, keyboard) => calls.push(['jumpTo', id, b.key, keyboard]),
    remove: (id, b) => calls.push(['remove', id, b.key]),
    focusStop: (t) => {
      calls.push(['focusStop', t]);
      stops.get(t).focus();
    },
    cool: () => calls.push(['cool']),
  };
  const ctx = vm.createContext({
    document: { createElement: (tag) => new El(tag) },
    ButterRailModel: RailModel,
    getComputedStyle: (el) => ({ height: `${el.offsetHeight}px` }),
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { callback, at: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(source, ctx, { filename: 'rail/card.js' });
  FakeElement.focused = null;
  const card = ctx.ButterRailCard(r.m, els, view);
  const key = (k, target, el = els.card) => {
    let prevented = false;
    el.emit('keydown', { key: k, target, preventDefault: () => (prevented = true) });
    return prevented;
  };
  return {
    r,
    m: r.m,
    els,
    card,
    calls,
    stops,
    key,
    rows: () => els.bmc.querySelectorAll('.go'),
    its: () => els.bmc.querySelectorAll('.it'),
    shows: () => els.card.classList.contains('show'),
    cy: () => els.host.style['--cy'],
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.callback();
        }
    },
  };
}
// The centre `cy` with the card's top on a whole pixel, for a card `h` tall.
const whole = (cy, h = 41) => `${Math.round(cy - h / 2) + h / 2}px`;

test('a tick holding one bookmark: one solo row, the question text, a group named by the model', () => {
  const c = setup({ marks: { q1: [false] } });
  c.card.show(1);
  assert.ok(c.shows());
  assert.equal(c.els.card.inert, false, 'a bookmark card takes the pointer');
  assert.ok(c.els.card.classList.contains('qb'));
  assert.equal(c.els.text.textContent, 'Question 1');
  assert.equal(c.els.card.getAttribute('role'), 'group');
  assert.equal(c.els.card.getAttribute('aria-label'), 'Bookmark · question 2 of 5');
  assert.deepEqual(
    c.els.bmc.children.map((x) => x.className),
    ['it solo'],
  );
  assert.equal(c.cy(), whole(c.m.tickY(1)), 'its top on a whole pixel');
  const [row] = c.its();
  assert.equal(row.querySelector('.tx').textContent, 'B0');
  assert.equal(row.querySelector('.x').getAttribute('aria-label'), 'Delete bookmark: B0');
  assert.equal(row.querySelector('.x').innerHTML.startsWith('<svg'), true);
});

test('a list: a rows box of `visible` rows; a stale row is grey and says so; rows jump, × removes', () => {
  const c = setup({ marks: { q3: [false, true] } });
  c.card.show(3);
  const [box] = c.els.bmc.children;
  assert.equal(box.className, 'rows');
  assert.equal(box.style['--rows'], 2);
  const [fresh, stale] = c.its();
  assert.equal(fresh.classList.contains('stale'), false);
  assert.ok(stale.classList.contains('stale'));
  assert.deepEqual(
    c.els.bmc.querySelectorAll('.why').map((x) => x.textContent),
    ['answer changed'],
  );
  c.rows()[1].emit('click', { detail: 0 });
  c.rows()[0].emit('click', { detail: 1 });
  stale.querySelector('.x').emit('click');
  assert.deepEqual(c.calls, [
    ['jumpTo', 'q3', 'q3-1', true],
    ['jumpTo', 'q3', 'q3-0', false],
    ['remove', 'q3', 'q3-1'],
  ]);
  // One stale bookmark alone: no tag in its row (the card's meta says it), and a footer.
  const s = setup({ marks: { q2: [true] } });
  s.card.show(2);
  assert.equal(s.els.bmc.querySelectorAll('.why').length, 0);
  assert.equal(s.els.bmc.children.at(-1).className, 'warn');
});

test("a plain tooltip: inert, slides from the last card, the model's meta and text, on a raw centre", () => {
  const c = setup({ marks: { q3: [false] } });
  c.card.show(3);
  assert.equal(c.els.cardPos.classList.contains('instant'), true, 'appears in place');
  c.card.show(1);
  assert.equal(c.els.cardPos.classList.contains('instant'), false, 'slides between ticks');
  assert.equal(c.els.card.inert, true);
  assert.equal(c.els.card.classList.contains('qb'), false);
  assert.equal(c.els.card.getAttribute('role'), 'tooltip');
  assert.equal(c.els.card.getAttribute('aria-label'), null);
  assert.deepEqual([c.els.meta.textContent, c.els.meta.hidden], ['2 / 5', false]);
  assert.equal(c.els.text.textContent, 'Question 1');
  assert.equal(c.cy(), `${c.m.tickY(1)}px`);
  c.card.show(-2);
  assert.equal(c.shows(), false);
  assert.equal(c.els.card.inert, true);
});

test("the three dots' card: its meta line, kept below the scroller's top; a loading row spins", () => {
  const c = setup({ count: 3, hasPrev: true, marks: { '-1': [false, false] }, height: 1001 });
  c.els.meta.hidden = true; // as the three dots' hint leaves it
  c.card.show(EARLIER);
  assert.ok(c.els.card.classList.contains('bare'));
  assert.deepEqual(
    [c.els.meta.textContent, c.els.meta.hidden],
    ['Earlier questions · 2 bookmarks', false],
  );
  assert.equal(c.els.card.getAttribute('aria-label'), 'Earlier questions · 2 bookmarks');
  assert.ok(top(c.m) - 8 < 8 + 1001 / 2, 'the clamp applies');
  assert.equal(c.cy(), whole(8 + 1001 / 2, 1001), 'half the card below the scroller top + 8');
  assert.equal(c.els.bmc.querySelectorAll('.wspin').length, 0);
  c.m.journey({ wait: '-1-1' });
  c.card.refill();
  const [first, second] = c.its();
  assert.ok(first.querySelector('.x'));
  assert.equal(second.querySelector('.x'), null, 'no × while it loads');
  assert.ok(second.querySelector('.wspin'));
  assert.ok(second.classList.contains('wait'));
});

test('refill keeps focus on the same row, maps a focused × to its row, and goes back when empty', () => {
  const c = setup({ marks: { q2: [false, false, false] } });
  c.card.enter(2);
  assert.equal(FakeElement.focused, c.rows()[0], 'the keyboard enters on the first row');
  c.key('ArrowDown', c.rows()[0]);
  assert.equal(FakeElement.focused, c.rows()[1]);
  c.r.marks({ q2: [false, false] }); // one deleted
  c.card.refill();
  assert.equal(c.rows().length, 2);
  assert.equal(FakeElement.focused, c.rows()[1], 'the new row at the same place');
  c.its()[1].querySelector('.x').focus();
  c.r.marks({ q2: [false, true] });
  c.card.refill();
  assert.equal(FakeElement.focused, c.rows()[1], "a focused ×: its row's place");
  c.r.marks({});
  c.card.refill();
  assert.equal(c.shows(), false);
  assert.deepEqual(c.calls, [['focusStop', 2]], 'focus goes back to its tick');
  assert.equal(FakeElement.focused, c.stops.get(2));
  // Focus outside the card: the card goes, focus stays.
  const d = setup({ marks: { q1: [false] } });
  d.card.show(1);
  d.r.marks({});
  d.card.refill();
  assert.equal(d.shows(), false);
  assert.deepEqual(d.calls, []);
});

test('the leave grace: 200 ms, cancelled by the pointer on the card or back on the rail', () => {
  const c = setup({ marks: { q1: [false] } });
  c.card.show(1);
  c.card.leave();
  c.advance(199);
  assert.ok(c.shows());
  c.advance(1);
  assert.equal(c.shows(), false);
  assert.deepEqual(c.calls, [['cool']]);
  // The pointer reaches the card: kept.
  c.calls.length = 0;
  c.card.show(1);
  c.card.leave();
  c.els.card.emit('pointerenter');
  c.advance(500);
  assert.ok(c.shows());
  // It leaves the card (not to the rail): the grace starts again; back on the rail cancels it.
  c.els.card.emit('pointerleave');
  c.advance(100);
  c.card.stay();
  c.advance(500);
  assert.ok(c.shows());
  // Focus in the card keeps it.
  c.els.card.emit('pointerleave');
  c.rows()[0].focus();
  c.advance(200);
  assert.ok(c.shows());
  assert.deepEqual(c.calls, []);
  // Focus leaving the card for the page starts the grace; for the rail, not.
  FakeElement.focused = null;
  c.els.card.emit('focusout', { relatedTarget: c.stops.get(1) });
  c.advance(200);
  assert.ok(c.shows());
  c.els.card.emit('focusout', { relatedTarget: null });
  c.advance(200);
  assert.equal(c.shows(), false);
  // While the pointer is over the rail, leaving the card does not start it.
  c.card.show(1);
  c.m.move(5, c.m.tickY(1));
  c.els.card.emit('pointerleave');
  c.advance(200);
  assert.ok(c.shows());
});

test('card keys: arrows between rows, Delete and Backspace click ×, ArrowRight and Escape back', () => {
  const c = setup({ count: 5, hasPrev: true, marks: { '-1': [false], q3: [false, false] } });
  c.card.enter(3);
  assert.equal(c.key('ArrowUp', c.rows()[0]), true);
  assert.equal(FakeElement.focused, c.rows()[0], 'stays on the first row');
  c.key('ArrowDown', c.rows()[0]);
  assert.equal(FakeElement.focused, c.rows()[1]);
  c.key('ArrowDown', c.rows()[1]);
  assert.equal(FakeElement.focused, c.rows()[1], 'stays on the last row');
  c.key('ArrowUp', c.rows()[1]);
  assert.equal(FakeElement.focused, c.rows()[0]);
  c.key('Delete', c.rows()[1]);
  c.key('Backspace', c.rows()[0]);
  assert.equal(c.key('a', c.rows()[0]), false, 'other keys pass');
  c.key('ArrowRight', c.rows()[0]);
  assert.ok(c.shows(), 'ArrowRight leaves the card open');
  assert.deepEqual(c.calls, [
    ['remove', 'q3', 'q3-1'],
    ['remove', 'q3', 'q3-0'],
    ['focusStop', 3],
  ]);
  // Escape on the three dots' card while a page loads for it: back to the dots, the card away.
  c.calls.length = 0;
  c.card.enter(EARLIER);
  c.key('Escape', c.rows()[0]);
  assert.ok(c.shows(), 'nothing loads: the card stays');
  c.card.enter(EARLIER);
  c.m.journey({ wait: '-1-0' });
  c.key('Escape', c.rows()[0]);
  assert.equal(c.shows(), false);
  assert.deepEqual(c.calls, [
    ['focusStop', EARLIER],
    ['focusStop', EARLIER],
  ]);
  // A click in the card keeps focus where it was.
  let prevented = false;
  c.els.card.emit('mousedown', { preventDefault: () => (prevented = true) });
  assert.ok(prevented);
});

test("the page's Escape puts the three dots' card away and holds it, unless focus is in the card", () => {
  const c = setup({ count: 3, hasPrev: true, marks: { '-1': [false], q1: [false] } });
  c.card.show(EARLIER);
  c.rows()[0].focus();
  c.card.escape({ key: 'Escape' });
  assert.ok(c.shows(), "the card's own keys handle it");
  FakeElement.focused = null;
  c.card.escape({ key: 'Enter' });
  assert.ok(c.shows());
  c.card.escape({ key: 'Escape' });
  assert.equal(c.shows(), false);
  c.card.show(EARLIER);
  assert.equal(c.shows(), false, 'held until the pointer or keyboard comes back');
  c.m.hold(false);
  c.card.show(1);
  c.card.escape({ key: 'Escape' });
  assert.ok(c.shows(), "a tick's card stays");
});

test('seek: the model hands the card to the rail; the patch is an instant, inert tooltip', () => {
  const c = setup({ marks: { q3: [false] } });
  c.card.show(3);
  c.m.seek({ state: 'dragging', id: 'q1', n: 2, total: 5 });
  c.card.show(2);
  assert.deepEqual(c.calls, [['seek']]);
  c.card.seek({ meta: 'Loading question 2…', text: 'Question 1', cy: 123.5, loading: true });
  const { card, meta } = c.els;
  assert.deepEqual(
    ['qb', 'bare', 'show', 'seek-card'].map((x) => card.classList.contains(x)),
    [false, false, true, true],
  );
  assert.equal(card.getAttribute('role'), 'tooltip');
  assert.equal(card.getAttribute('aria-label'), null);
  assert.equal(card.inert, true);
  assert.ok(c.els.cardPos.classList.contains('instant'));
  assert.deepEqual(
    [meta.hidden, meta.textContent, meta.firstChild.className],
    [false, 'Loading question 2…', 'spin'],
  );
  assert.equal(c.els.text.textContent, 'Question 1');
  assert.equal(c.cy(), '123.5px', 'not moved to a whole pixel');
  c.card.unseek();
  assert.deepEqual(
    ['show', 'seek-card'].map((x) => card.classList.contains(x)),
    [true, false],
  );
  c.card.hide();
  assert.equal(c.shows(), false);
});

test('holds and spans: what the rail asks of the card', () => {
  const c = setup({ marks: { q1: [false] } });
  c.card.show(1);
  assert.ok(c.card.holds(c.rows()[0]));
  assert.equal(c.card.holds(c.stops.get(1)), false);
  assert.equal(c.card.holds(null), false);
  assert.deepEqual(
    [99, 100, 141, 142].map((y) => c.card.spans(y)),
    [false, true, true, false],
  );
});

test('focus leaving a card the pointer is over, for the page: the grace keeps it', () => {
  const c = setup({ marks: { q1: [false] } });
  c.card.show(1);
  c.els.card.emit('pointerenter');
  c.els.card.emit('focusout', { relatedTarget: null });
  c.advance(200);
  assert.ok(c.shows(), 'the pointer is over the card');
});

test("refill re-centres a tick's card on its new height, its top on a whole pixel", () => {
  const c = setup({ marks: { q2: [false, false] } });
  c.card.show(2);
  const cy = c.m.tickY(2);
  assert.equal(c.cy(), whole(cy));
  c.els.card.offsetHeight = 30.2; // a row gone: the card is shorter
  c.r.marks({ q2: [false] });
  c.card.refill();
  assert.notEqual(whole(cy, 30.2), whole(cy), 'the two heights round apart');
  assert.notEqual(whole(cy, 30.2), `${cy}px`, 'and away from the raw centre');
  assert.equal(c.cy(), whole(cy, 30.2));
});

test("the page's Escape leaves the three dots' hint (no bookmarks) shown", () => {
  const c = setup({ count: 3, hasPrev: true });
  c.card.show(EARLIER);
  assert.ok(c.shows());
  c.card.escape({ key: 'Escape' });
  assert.ok(c.shows());
});

test('seek from a hidden card: it shows, its meta line unhidden, with no spinner unless loading', () => {
  const c = setup();
  c.els.meta.hidden = true; // as the three dots' hint leaves it
  assert.equal(c.shows(), false);
  c.card.seek({ meta: 'Question 2 of 5', text: 'Question 1', cy: 100, loading: false });
  assert.ok(c.shows());
  assert.equal(c.els.meta.hidden, false);
  assert.equal(c.els.meta.children.length, 0, 'no spinner');
});
