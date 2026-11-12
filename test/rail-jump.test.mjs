// The jump (extension/rail/jump.js) driven directly: a fake model that records the journey
// status it is told, a fake turn tracker over planted turns, a recording trip and a manual clock for
// frames and timers. The chat: a scroller 900 px tall; question i's turn starts at 100 + gap * i
// and mounts while it is within 2000 px of the scroll position, as ChatGPT's window of turns does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { FakeElement, fakeObservers } from './helpers/rail-dom.mjs';

const source = fs.readFileSync(new URL('../extension/rail/jump.js', import.meta.url), 'utf8');

function setup({ count = 5, gap = 100, hasPrev = false } = {}) {
  let now = 10_000,
    nextId = 1;
  const frames = new Map(),
    timers = new Map();
  const { ResizeObserver, resize } = fakeObservers();
  const setTimeout = (callback, ms) => {
    const id = nextId++;
    timers.set(id, { callback, at: now + ms });
    return id;
  };
  const ctx = vm.createContext({
    ResizeObserver,
    matchMedia: () => ({ matches: false }),
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    setTimeout,
  });
  vm.runInContext(source, ctx, { filename: 'rail/jump.js' });

  // The scroller and its turns.
  const scroller = new FakeElement();
  Object.assign(scroller, {
    scrollTop: 0,
    scrollHeight: 100 + gap * count + 2000,
    clientHeight: 900,
    getBoundingClientRect: () => ({ top: 0 }),
    scrollTo({ top }) {
      this.scrollTop = top;
    },
  });
  const turn = (id, top) => {
    const el = new FakeElement('article');
    el.setAttribute('data-turn-key', id);
    el.top = top;
    el.getBoundingClientRect = () => ({ top: el.top - scroller.scrollTop });
    scroller.append(el);
    return el;
  };
  const els = new Map();
  for (let i = 0; i < count; i++) els.set(`q${i}`, turn(`q${i}`, 100 + gap * i));
  const blocked = new Set(); // ids that never mount
  const mountedEl = (id) => {
    const el = els.get(id);
    return el && !blocked.has(id) && Math.abs(el.top - scroller.scrollTop) < 2000 ? el : null;
  };

  // The model: the questions, earlier history and the bookmark marks; the journey status it is
  // told, in order, in `log`.
  const log = [];
  const st = { flying: false, pinned: false, busy: null, wait: null, active: null };
  const model = {
    items: [...els.keys()].map((id) => ({ id, q: id })),
    hasPrev,
    shown: -2,
    marksSynced: true,
    placedAt: null, // the question the earlier bookmark is under, once the marks are synced
    get qs() {
      return this.items.filter((x) => x.q != null);
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
    journey(s) {
      log.push(JSON.stringify(s));
      Object.assign(st, s);
    },
    setActive(id) {
      log.push(`active ${id}`);
      const moved = st.active !== id;
      st.active = id;
      return moved;
    },
    synced() {
      return this.marksSynced;
    },
    placed() {
      return this.marksSynced ? this.placedAt : null;
    },
    marks: new Map(),
    mark(id) {
      return this.marks.get(id);
    },
  };

  const turns = {
    get scroller() {
      return scroller;
    },
    el: mountedEl,
    each(fn) {
      for (const id of els.keys()) if (mountedEl(id)) fn(els.get(id));
    },
    measure(seen) {
      let a = Infinity,
        b = -1;
      model.qs.forEach((x, j) => {
        if (!mountedEl(x.id)) return;
        seen.add(x.id);
        a = Math.min(a, j);
        b = Math.max(b, j);
      });
      return [a, b];
    },
    estimate: (i) => els.get(model.qs[i].id)?.top ?? 0,
    retarget: () => {},
  };

  // The trip, recording each call and the time it came; it departs and redirects in 260 ms.
  const trips = [];
  const trip = {
    tok: null,
    get active() {
      return this.tok != null;
    },
    take(tok) {
      trips.push(['take', tok, now]);
      if (this.tok == null) return false;
      this.tok = tok;
      return true;
    },
    depart(turn, m, tok) {
      trips.push(['depart', tok, now, m]);
      this.tok = tok;
      return new Promise((r) => setTimeout(r, 260));
    },
    redirect(m, tok) {
      trips.push(['redirect', tok, now, m]);
      this.tok = tok;
      return new Promise((r) => setTimeout(r, 260));
    },
    arrive(lead) {
      trips.push(['arrive', this.tok, now, lead]);
      this.tok = null;
      return Promise.resolve();
    },
    end(tok) {
      trips.push(['end', tok, now]);
      if (tok === undefined || tok === this.tok) this.tok = null;
    },
  };
  let built = true; // the trip once the rail is built
  const views = [];
  const view = {
    kick: () => views.push('kick'),
    busy: () => views.push('busy'),
    wait: (on) => views.push(`wait ${on}`),
    found: (i, keyboard) => views.push(`found ${i} ${keyboard}`),
  };
  const jump = ctx.ButterRailJump(model, turns, () => (built ? trip : null), view);

  // One frame `ms` after the last: due timers, then frames, then every promise continuation.
  const step = async (ms = 16) => {
    now += ms;
    for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at))
      if (t.at <= now) {
        timers.delete(id);
        t.callback();
      }
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(now);
    await new Promise((r) => setImmediate(r));
  };
  // Steps until `done()` or `ms` have passed.
  const run = async (ms, done = () => false, frame = 16) => {
    for (const end = now + ms; now < end && !done(); ) await step(frame);
  };
  return {
    jump,
    model,
    st,
    log,
    views,
    trip,
    trips,
    of: (kind) => trips.filter((t) => t[0] === kind),
    scroller,
    els,
    turn,
    blocked,
    resize,
    step,
    run,
    // An earlier trip leaves the paging band and comes back to the top for the next page.
    async paging() {
      await run(2000, () => scroller.scrollTop === 240 + 32);
      await run(2000, () => scroller.scrollTop === 0);
    },
    unbuilt: () => (built = false),
    now: () => now,
    pending: () => frames.size + timers.size,
  };
}

test('glide or trip: a near mounted question glides, a far or unmounted one or a takeover trips', async () => {
  const near = setup();
  near.jump.go(2);
  assert.equal(near.scroller.scrollTop, 300 - 64, 'a plain smooth scroll to it');
  await near.run(3000);
  assert.deepEqual(near.trips, [['take', 1, 10_000]], 'no trip departed');

  const far = setup({ count: 10, gap: 700 });
  far.jump.go(2); // mounted, but 1436 px away: more than 1.5 screens
  assert.deepEqual(far.of('depart'), [['depart', 1, 10_000, -1]], 'content moves up: going down');
  await far.run(8000, () => far.of('arrive').length > 0);
  assert.equal(far.scroller.scrollTop, 1500 - 64);

  const unmounted = setup({ count: 10, gap: 700 });
  unmounted.blocked.add('q1'); // 736 px away, but not mounted
  unmounted.jump.go(1);
  assert.equal(unmounted.of('depart').length, 1);

  // Near, but within the paging band of a chat with earlier history: a trip, as ChatGPT may load
  // earlier messages on arrival.
  const top = setup({ hasPrev: true });
  top.jump.go(1);
  assert.equal(top.of('depart').length, 1);
});

test('pin, follow, unpin: the jump publishes its status in order and keeps its question aligned', async () => {
  const nav = setup();
  nav.jump.go(2);
  assert.deepEqual(nav.log, [
    '{"wait":null}',
    '{"busy":null}',
    '{"flying":true}',
    'active q2',
    '{"pinned":true}',
  ]);
  nav.scroller.emit('scrollend');
  await nav.run(3000);
  assert.equal(nav.log.at(-1), '{"flying":false}', 'landed: the ticks show what is on screen');
  assert.equal(nav.st.pinned, true);
  assert.equal(nav.pending(), 0, 'pinned and idle: no frames or timers');
  // Its question grows above: the pin realigns it, also as a newly mounted element.
  nav.els.get('q2').top = 500;
  nav.resize(nav.els.get('q2'));
  assert.equal(nav.scroller.scrollTop, 500 - 64);
  const remount = nav.turn('q2', 700);
  nav.els.set('q2', remount);
  nav.jump.observe(remount);
  nav.resize(remount);
  assert.equal(nav.scroller.scrollTop, 700 - 64, 'a remounted turn is followed');
  // The user scrolls: unpinned, and back to lighting what is on screen.
  nav.log.length = nav.views.length = 0;
  nav.jump.cancel();
  assert.deepEqual(nav.log, ['{"flying":false}', '{"pinned":false}']);
  assert.deepEqual(nav.views, ['kick']);
  remount.top = 900;
  nav.resize(remount);
  assert.equal(nav.scroller.scrollTop, 700 - 64, 'no longer followed');
});

test('cancel invalidates a pending jump mid-wait: no landing, no pin, the trip and the wait end', async () => {
  const nav = setup({ count: 10, gap: 1000, hasPrev: true });
  nav.model.marksSynced = false;
  nav.jump.earlier({ key: 'k' }, false);
  assert.deepEqual(nav.views.slice(0, 1), ['wait true'], 'the dots blink');
  assert.equal(nav.st.wait, 'k');
  // A page of earlier messages arrives; the jump waits for the marks of the items as they are now.
  await nav.paging();
  nav.model.items = [{ id: 'p0', q: 'p0' }, ...nav.model.items];
  nav.model.hasPrev = false;
  nav.els.set('p0', nav.turn('p0', 0));
  await nav.run(300);
  nav.views.length = 0;
  nav.jump.cancel();
  assert.deepEqual(nav.views, ['kick', 'busy', 'wait false']); // unpinned, the busy tick and the wait cleared
  assert.deepEqual([nav.st.wait, nav.st.pinned, nav.st.flying], [null, false, false]);
  assert.deepEqual(nav.trips.at(-1).slice(0, 2), ['end', undefined]);
  nav.model.marksSynced = true;
  nav.model.placedAt = 'q1';
  const at = nav.scroller.scrollTop;
  await nav.run(5000);
  assert.equal(nav.scroller.scrollTop, at, 'the cancelled jump moves the chat no more');
  assert.deepEqual(nav.views, ['kick', 'busy', 'wait false'], 'nor finds the bookmark');
  assert.equal(nav.of('arrive').length, 0);
});

test('a takeover inherits the first click deadline and takes the trip over; the same destination again is ignored', async () => {
  const nav = setup({ count: 10, gap: 1000 });
  nav.blocked.add('q8').add('q4'); // ChatGPT is busy: neither renders
  const start = nav.now();
  nav.jump.go(8);
  await nav.run(1000, () => false, 100); // the page paints every 100 ms
  // A repeated click on the busy destination keeps its in-progress work.
  assert.equal(nav.st.busy, 'q8');
  const before = nav.trips.length;
  nav.jump.go(8);
  assert.equal(nav.trips.length, before, 'ignored: no takeover');
  nav.jump.go(4);
  assert.deepEqual(nav.trips.slice(before, before + 2), [
    ['take', 2, start + 1000],
    ['redirect', 2, start + 1000, 1],
  ]);
  assert.equal(nav.st.busy, 'q4');
  await nav.run(14_000, () => !nav.trip.active, 100);
  const [[, tok, at]] = nav.of('end').filter((t) => t[1] === 2);
  assert.equal(tok, 2);
  assert.ok(at >= start + 12_000 && at < start + 12_200, `ended at +${at - start} ms`);
  assert.equal(nav.of('depart').length, 1, 'one trip all along');
  assert.deepEqual([nav.st.busy, nav.st.flying, nav.st.pinned], [null, false, false]);
});

test('an earlier trip waits for the marks of the items as they are now, then lands on the bookmark', async () => {
  const nav = setup({ count: 5, gap: 1000, hasPrev: true });
  nav.model.marksSynced = false;
  nav.model.placedAt = 'p1';
  nav.model.marks.set('p1', {
    bookmarks: [{ key: 'k' }],
    land: (turn, b) => (b.key === 'k' ? 30 : 0), // the bookmarked text, 30 px into the turn
  });
  nav.jump.earlier({ key: 'k' }, true);
  await nav.paging();
  // Two earlier questions arrive above; the marks lag a moment behind.
  nav.model.items = [{ id: 'p0', q: 'p0' }, { id: 'p1', q: 'p1' }, ...nav.model.items];
  nav.model.hasPrev = false;
  for (const el of nav.els.values()) el.top += 2000;
  nav.els.set('p0', nav.turn('p0', 100));
  nav.els.set('p1', nav.turn('p1', 1100));
  await nav.run(1000);
  assert.equal(nav.st.wait, 'k', 'still loading');
  assert.ok(!nav.views.some((v) => v.startsWith('found')));
  nav.model.marksSynced = true;
  await nav.run(10_000, () => nav.of('end').length > 0);
  assert.ok(nav.views.includes('found 1 true'), 'focus follows the keyboard trip to its tick');
  assert.equal(nav.st.wait, null);
  assert.equal(nav.st.active, 'p1');
  assert.equal(nav.scroller.scrollTop, 1100 - 64 + 30, 'on the bookmarked text');
  assert.equal(nav.st.pinned, true);
});

test('cancel before the rail is built: no trip to end', () => {
  const nav = setup();
  nav.unbuilt();
  nav.jump.cancel();
  assert.deepEqual(nav.log, ['{"flying":false}']);
});
