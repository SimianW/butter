// The trip (extension/rail/trip.js) driven directly, with a recorder for `animate()`: each call's
// element, keyframes and options, whether it was cancelled, and a `finish()` that settles its
// `finished` promise. The chat: a scroller 900 px tall holding content > wrapper > window > turn.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../extension/rail/trip.js', import.meta.url), 'utf8');

function setup({ reduce = false } = {}) {
  const animations = [],
    timers = [],
    scrolls = [];
  const element = (name, parent = null) => {
    const el = {
      name,
      parentElement: parent,
      isConnected: true,
      style: {},
      animate(keyframes, options) {
        let finish;
        const a = {
          el: name,
          keyframes,
          options,
          cancelled: false,
          finished: new Promise((r) => (finish = r)),
          cancel() {
            a.cancelled = true;
          },
        };
        a.finish = finish;
        animations.push(a);
        return a;
      },
    };
    return el;
  };
  const scroller = element('scroller');
  const listeners = [];
  Object.assign(scroller, {
    scrollTop: 2000,
    clientHeight: 900,
    contains: (el) => {
      for (let p = el; p; p = p.parentElement) if (p === scroller) return true;
      return false;
    },
    scrollTo(options) {
      scrolls.push(options);
    },
    addEventListener: (type, callback, options) => listeners.push({ type, callback, options }),
  });
  const content = element('content', scroller),
    wrapper = element('wrapper', content),
    win = element('window', wrapper),
    turn = element('turn', win);
  const ctx = vm.createContext({
    matchMedia: (query) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }),
    setTimeout(callback, ms) {
      timers.push({ callback, ms });
    },
  });
  vm.runInContext(source, ctx, { filename: 'rail/trip.js' });
  const warp = element('warp'),
    streak = element('streak');
  const trip = ctx.ButterRailTrip({ warp, streak, scroller: () => scroller });
  const of = (name) => animations.filter((a) => a.el === name);
  return {
    trip,
    warp,
    scroller,
    content,
    turn,
    element,
    animations,
    of,
    timers,
    scrolls,
    listeners,
  };
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const settle = () => new Promise((r) => setImmediate(r));

test('depart fades the content out, fades the placeholder in and streams it, speeding the chat off', () => {
  const t = setup();
  t.trip.depart(t.turn, -1, 1);
  assert.equal(t.trip.active, true);
  const [off] = t.of('content');
  assert.deepEqual(plain(off.keyframes), [{ opacity: 1 }, { opacity: 0 }]);
  assert.deepEqual(plain(off.options), { duration: 260, easing: 'ease-in', fill: 'forwards' });
  assert.equal(t.warp.style.visibility, 'visible');
  assert.deepEqual(plain(t.of('warp')[0].keyframes), [{ opacity: 0 }, { opacity: 1 }]);
  assert.deepEqual(plain(t.scrolls), [{ top: 2450, behavior: 'smooth' }]); // half a screen down
  const [loop] = t.of('streak');
  assert.deepEqual(plain(loop.keyframes), [
    { transform: 'none' },
    { transform: 'translateY(-420px)' },
  ]);
  assert.equal(loop.options.iterations, Infinity);
  assert.ok(Math.abs(loop.options.duration - 420 / 2.25) < 1e-9, 'SPEED: 2.5 screens a second');
  assert.deepEqual(
    t.timers.map((x) => x.ms),
    [260],
  );
});

test('a turn whose content box is not inside the scroller, or is the scroller, is not faded', () => {
  const t = setup();
  t.trip.depart(null, 1, 1);
  t.trip.end();
  const loose = setup();
  loose.content.parentElement = null; // the content box is outside the scroller
  loose.trip.depart(loose.turn, 1, 1);
  loose.trip.end();
  for (const x of [t, loose]) assert.equal(x.of('content').length, 0);
  // A turn two wrappers below the scroller: its third ancestor is the scroller itself.
  const shallow = setup();
  const turn = shallow.element(
    'turn',
    shallow.element('window', shallow.element('wrapper', shallow.scroller)),
  );
  shallow.trip.depart(turn, 1, 1);
  shallow.trip.end();
  assert.equal(shallow.of('scroller').length, 0, 'the scroller is never faded');
});

test('arrival restores the content and hides the placeholder only when no new trip started', async () => {
  const t = setup();
  t.trip.depart(t.turn, 1, 1);
  t.trip.end();
  assert.equal(t.trip.active, false);
  const [off, back] = t.of('content');
  assert.equal(off.cancelled, true);
  assert.deepEqual(plain(back.keyframes), [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(back.options.duration, 250);
  const [fadeIn, out] = t.of('warp');
  assert.equal(fadeIn.cancelled, true);
  assert.deepEqual(plain(out.keyframes), [{ opacity: 1 }, { opacity: 0 }]);
  assert.equal(t.warp.style.visibility, 'visible', 'until the placeholder has faded out');
  out.finish();
  await settle();
  assert.equal(t.warp.style.visibility, 'hidden');
  assert.equal(t.of('streak')[0].cancelled, true);
  assert.equal(out.cancelled, true);

  // A new trip departs while the last one's placeholder still fades out: it stays shown.
  const u = setup();
  u.trip.depart(u.turn, 1, 1);
  u.trip.end();
  u.trip.depart(u.turn, 1, 2);
  u.of('warp')[1].finish();
  await settle();
  assert.equal(u.warp.style.visibility, 'visible');
  assert.equal(u.of('streak')[0].cancelled, true, "the first trip's lines stop");
  assert.equal(u.of('streak')[1].cancelled, false, "the second trip's lines go on");
  assert.equal(u.trip.active, true);
});

test('departing again ends the trip in progress first', () => {
  const t = setup();
  t.trip.depart(t.turn, 1, 1);
  t.trip.depart(t.turn, 1, 2);
  assert.equal(t.of('content')[0].cancelled, true);
  assert.equal(t.of('warp')[0].cancelled, true);
  t.trip.end(1);
  assert.equal(t.trip.active, true, 'the new trip is jump 2');
});

test('arrive scrolls the last `lead` px with the content fading in, unless already there', async () => {
  const t = setup();
  t.trip.depart(t.turn, -1, 1);
  t.scrolls.length = 0;
  const done = t.trip.arrive(300, () => 3000);
  assert.equal(t.of('content')[1].options.duration, 320);
  assert.deepEqual(plain(t.scrolls), [{ top: 3000, behavior: 'smooth' }]);
  const end = t.listeners.find((x) => x.type === 'scrollend');
  assert.equal(end.options.once, true);
  end.callback();
  await done;
  assert.equal(t.timers.at(-1).ms, 1500, 'scrollend or 1.5 s');

  const there = setup();
  there.trip.depart(there.turn, -1, 1);
  there.scrolls.length = 0;
  there.trip.arrive(300, () => there.scroller.scrollTop + 0.5);
  assert.equal(there.scrolls.length, 0);
  assert.equal(there.timers.at(-1).ms, 250);
  assert.equal(await there.trip.arrive(300, () => 0), undefined, 'no trip: resolves at once');
});

test('redirect restarts the streak only on a direction change', () => {
  const t = setup();
  t.trip.depart(t.turn, -1, 1);
  t.trip.redirect(-1, 2);
  assert.equal(t.of('streak').length, 1);
  assert.equal(t.of('streak')[0].cancelled, false);
  t.trip.redirect(1, 3);
  const [first, second] = t.of('streak');
  assert.equal(first.cancelled, true);
  assert.equal(plain(second.keyframes)[1].transform, 'translateY(420px)');
  t.trip.redirect(1, 4);
  assert.equal(t.of('streak').length, 2);
  assert.deepEqual(
    t.timers.map((x) => x.ms),
    [260, 260, 260, 260],
  );
  assert.equal(t.of('content').length, 1, 'the chat stays hidden');
  t.trip.end(1);
  t.trip.end(3);
  assert.equal(t.trip.active, true, 'the trip is jump 4 now');
  t.trip.end(4);
  assert.equal(t.trip.active, false, 'jump 4 ends it');
});

test('end(tok) ignores other tokens; take(tok) hands the trip over', () => {
  const t = setup();
  assert.equal(t.trip.take(5), false, 'no trip to take');
  t.trip.end(); // nothing to end
  assert.equal(t.animations.length, 0);
  t.trip.depart(t.turn, 1, 1);
  t.trip.end(2);
  assert.equal(t.trip.active, true);
  assert.equal(t.of('content').length, 1, 'nothing restored');
  assert.equal(t.trip.take(2), true);
  t.trip.end(1);
  assert.equal(t.trip.active, true, 'jump 1 no longer owns it');
  t.trip.end(2);
  assert.equal(t.trip.active, false);
  t.trip.depart(t.turn, 1, 3);
  t.trip.end();
  assert.equal(t.trip.active, false, 'no token: any trip');
});

test('reduced motion skips the scroll and the streak', async () => {
  const t = setup({ reduce: true });
  t.trip.depart(t.turn, -1, 1);
  assert.equal(t.scrolls.length, 0);
  assert.equal(t.of('streak').length, 0);
  assert.equal(t.of('content').length, 1, 'the content still fades');
  assert.equal(t.warp.style.visibility, 'visible');
  t.trip.redirect(1, 2);
  assert.equal(t.of('streak').length, 0);
  t.trip.arrive(0, () => 3000); // reduced motion lands with no lead
  assert.equal(t.scrolls.length, 0);
  t.of('warp')[1].finish();
  await settle();
  assert.equal(t.warp.style.visibility, 'hidden');
});
