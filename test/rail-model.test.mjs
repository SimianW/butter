// The rail presentation model (extension/rail/model.js) through its interface: geometry, the
// hover wave and what lights a tick, and the bookmark dots and names. The card, its keys, seek and
// the earlier wait are in test/rail-card.test.mjs. Browser facts (focus, hit-testing, pixels) stay
// in lab/harness/bookmarks-qa.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  box,
  conv,
  dotAt,
  EARLIER,
  questions,
  rail,
  RailModel,
  REST,
  top,
} from './helpers/rail-model.mjs';

test('the rail inset keeps overlay scrollbars clear and follows a gutter that comes and goes', () => {
  for (const gutter of [0, 15, 20]) {
    const r = rail({ gutter });
    const inset = () => r.m.layout(1200).css.find(([k]) => k === '--r')[1];
    assert.equal(inset(), `${gutter ? 200 + gutter + 4 : 212}px`);
    assert.equal(r.m.inset(1200), parseFloat(inset()));
    r.point(2);
    r.m.seek({ state: 'dragging', id: 'q1', n: 2, total: 5 });
    assert.equal(inset(), `${gutter ? 200 + gutter + 4 : 212}px`, 'hover and seek keep it');
    r.m.measure(box(900, 15));
    assert.equal(inset(), '219px');
    r.m.measure(box(900, 0));
    assert.equal(inset(), '212px', 'replaced, not accumulated');
  }
  assert.equal(RailModel().inset(1200), 0, 'before a box');
});

test('the rail shows for two or more stops in a wide enough chat; the three dots show for unloaded history', () => {
  const r = rail({ count: 1 });
  assert.equal(r.m.shows(false), false, 'one question: no rail');
  const e = rail({ count: 1, hasPrev: true });
  assert.equal(e.m.shows(false), true, 'one question and the three dots');
  assert.equal(e.m.layout(1200).moreHidden, false);
  assert.equal(e.m.shows(true), false, 'the rail switched off');
  e.m.measure({ ...box(), width: 559 });
  assert.equal(e.m.shows(false), false, 'narrower than 560 px');
});

test('history prepended during a wave keeps each tick with its question; new ones start at rest', () => {
  const r = rail();
  r.point(2);
  r.frame();
  r.frame();
  const before = new Map(r.bars().map((b, j) => [`q${j}`, b]));
  assert.ok(before.get('q2')[0] > 1 && before.get('q2')[0] < 2.6, 'mid-wave');
  r.m.page({ conv, before: 'q0', hasPrev: true, items: questions(2, -2) });
  r.render();
  const after = r.bars();
  assert.deepEqual(after.slice(0, 2), [REST, REST]);
  for (let j = 0; j < 5; j++) assert.deepEqual(after[j + 2], before.get(`q${j}`), `q${j}`);
  assert.equal(r.m.qs[4].id, 'q2');
  assert.equal(r.m.index('q2'), 4);
});

test('what lights a tick: seek over opening over a flying jump over the lit band and the pinned question', () => {
  const r = rail();
  const show = (ids) => (r.kick(ids), r.settle(), r.lit());
  assert.deepEqual(show(['q1']), [1], 'the band');
  r.m.setActive('q3');
  r.m.journey({ pinned: true });
  assert.deepEqual(show(['q1']), [1, 3], 'the band and the pinned question');
  r.m.journey({ flying: true });
  assert.deepEqual(show(['q1']), [3], 'flying: its target alone');
  r.m.opening(true);
  assert.deepEqual(show(['q1']), [4], 'opening: the latest question');
  r.m.seek({ state: 'dragging', id: 'q2', n: 3, total: 5 });
  assert.deepEqual(show(['q1']), [2], 'seek: the previewed question');
  r.m.seek({ state: 'dragging', id: 'q2', lit: ['q0', 'q2'], n: 3, total: 5 });
  assert.deepEqual(show(['q1']), [0, 2], 'seek: every turn in the preview band');
  r.m.seek({ state: 'idle' });
  assert.deepEqual(show(['q1']), [0, 2], 'settled: still the preview');
  assert.equal(r.m.seekEnd(), null);
  r.m.opening(false);
  r.m.journey({ flying: false, pinned: false });
  assert.deepEqual(show(['q1']), [1]);
  assert.equal(r.m.setActive('q3'), false, 'the active tick did not move');
  assert.equal(r.m.setActive('q0'), true);
});

test('a chat opening shows its prediction at once: the latest tick lit without easing', () => {
  const r = rail();
  r.m.opening(true);
  r.m.page({ conv, before: null, hasPrev: false, items: questions(6) });
  const l = r.render();
  assert.deepEqual(l.bars.at(-1), ['scale(1.750, 1.000)', '1.000']);
  assert.deepEqual(l.bars[0], ['scale(1.000, 1.000)', '0.280']);
});

test('the rail turned off between frames: the pending frame stops the wave, and it starts again on Back', () => {
  const r = rail();
  r.point(2);
  r.frame();
  r.m.leave();
  r.kick();
  assert.equal(r.due(), true);
  r.m.open(null); // the home page: the questions go before the bars do
  r.render();
  assert.equal(r.frame(), null);
  assert.equal(r.m.moving, false);
  r.kick();
  assert.equal(r.due(), false, 'no frame while the rail is off');
  r.m.open(conv);
  r.render();
  assert.equal(r.m.qs.length, 5, 'the conversation was kept');
  r.point(2);
  r.settle();
  assert.deepEqual(r.bars()[2], [2.6, 1, 1.6]);
});

test("a frame whose timestamp predates the kick keeps every tick's line between its start and its target", () => {
  const r = rail();
  r.point(2);
  r.settle();
  const swollen = r.bars();
  assert.deepEqual(swollen[2], [2.6, 1, 1.6]);
  r.advance(1000); // the page was busy after the frame started
  r.m.leave();
  r.kick(); // stores the newer time
  const between = () =>
    r.bars().forEach((b, i) =>
      b.forEach((v, k) => {
        const lo = Math.min(swollen[i][k], REST[k]) - 0.001,
          hi = Math.max(swollen[i][k], REST[k]) + 0.001;
        assert.ok(v >= lo && v <= hi, `bar ${i}, axis ${k}: ${v}`);
      }),
    );
  r.frame(10_000); // earlier than the kick by much more than one frame
  between();
  r.frame(10_001);
  between();
  r.settle();
  assert.deepEqual(
    r.bars(),
    swollen.map(() => REST),
  );
});

test('the wave converges without overshoot, stays finite over long frames, and goes quiet at rest', () => {
  const r = rail({ count: 60, hasPrev: true });
  const pitch = r.m.tickY(1) - r.m.tickY(0);
  r.point(30);
  const target = r.bars().map((_, i) => {
    const d = ((i - 30) * pitch) / 20,
      g = Math.exp((-d * d) / 2);
    return [1 + 1.6 * g, 0.28 + 0.72 * g, 1 + 0.6 * g];
  });
  let previous = r.bars();
  for (let i = 0; i < 100 && r.due(); i++) {
    r.advance(i === 0 ? 60_000 : 16);
    r.frame();
    const now = r.bars();
    now.forEach((b, j) =>
      b.forEach((v, k) => {
        assert.ok(Number.isFinite(v));
        const lo = Math.min(previous[j][k], target[j][k]) - 0.001,
          hi = Math.max(previous[j][k], target[j][k]) + 0.001;
        assert.ok(v >= lo && v <= hi, `bar ${j}, axis ${k}: ${v}`);
      }),
    );
    previous = now;
  }
  assert.equal(r.due(), false);
  previous.forEach((b, j) => b.forEach((v, k) => assert.ok(Math.abs(v - target[j][k]) <= 0.001)));
  // At rest: a kick runs one frame that changes nothing and asks for no other.
  r.kick();
  const f = r.frame();
  assert.deepEqual(f.bars, []);
  assert.equal(f.moving, false);
  assert.equal(r.m.moving, false);
});

test('a bookmark dot keeps 4 px from its tick through every wave frame and stays inside the rail', () => {
  const r = rail({ count: 8 });
  const d = r.marks({ q1: [false], q3: [false, false], q6: [true] });
  assert.deepEqual(
    d.dots.map((x) => [x.id, x.create, x.q, x.size, x.look]),
    [
      ['q1', true, 1, 4, 'solid'],
      ['q3', true, 3, 4, 'solid'],
      ['q6', true, 6, 4, 'hollow'],
    ],
  );
  const pitch = r.m.tickY(1) - r.m.tickY(0);
  const beside = () => {
    const bars = r.bars();
    for (const [id, t] of r.dots) {
      const q = Number(id.slice(1)),
        x = dotAt(t, 4);
      assert.ok(Math.abs(x.right - (12 * bars[q][0] + 4)) <= 0.02, `${id}: ${x.right}`);
      assert.ok(Math.abs(x.center - (10 + (q + 0.5) * pitch)) <= 0.01, `${id} on its row`);
      assert.ok(6 + x.right + 4 <= 52, `${id} inside the rail`);
    }
  };
  beside();
  assert.equal(dotAt(r.dots.get('q1'), 4).right, 16, 'at rest: 12 + 4');
  r.point(3);
  let widest = 0;
  while (r.due()) {
    r.frame();
    beside();
    widest = Math.max(widest, ...[...r.dots.values()].map((t) => dotAt(t, 4).right));
  }
  assert.ok(Math.abs(widest - (12 * 2.6 + 4)) <= 0.01, `follows a 31 px tick: ${widest}`);
  r.m.leave();
  r.kick();
  while (r.due()) {
    r.frame();
    beside();
  }
  assert.equal(
    r.marks({ q1: [false], q3: [false] }).dots.every((x) => !x.create),
    true,
  );
});

test('close ticks shrink the dot; an all-stale dot too small for a ring is faint', () => {
  const r = rail({ count: 120 });
  const pitch = r.m.tickY(1) - r.m.tickY(0);
  assert.ok(pitch < 6, `pitch ${pitch}`);
  const [live, stale] = r.marks({ q2: [false], q5: [true] }).dots;
  assert.ok(Math.abs(live.size - Math.max(2, pitch - 2)) < 1e-9);
  assert.equal(live.look, 'solid');
  assert.equal(stale.look, 'faint', 'solid at 45 % instead of a ring');
});

test("earlier history's dot: 4 px, solid, 4 px left of the three dots on their row; still under the pointer", () => {
  const r = rail({ count: 4, hasPrev: true });
  const d = r.marks({ '-1': [true, false], q1: [false] });
  assert.deepEqual(d.dots[0], {
    id: EARLIER,
    create: true,
    fresh: false,
    q: EARLIER,
    size: 4,
    look: null,
  });
  assert.deepEqual(dotAt(r.dots.get(EARLIER), 4), { right: 21, center: 18 });
  r.point(EARLIER);
  r.settle();
  assert.deepEqual(dotAt(r.dots.get(EARLIER), 4), { right: 21, center: 18 });
  // All of earlier history loaded: the three dots go, and their dot with them, at once.
  r.m.page({ conv, before: 'q0', hasPrev: false, items: [] });
  r.render();
  assert.equal(r.dots.has(EARLIER), false);
});

test('names: a tick says what its question holds; the three dots append the earlier label', () => {
  const r = rail({ count: 3, hasPrev: true });
  const hint = 'Earlier questions are not loaded yet. Click to load them.';
  let d = r.marks({ '-1': [false, false], q1: [false] });
  assert.equal(d.more, `${hint} · Earlier questions · 2 bookmarks: B0; B1`);
  assert.deepEqual(d.labels, ['Question 0', 'Question 1 · Bookmark: B0', 'Question 2']);
  d = r.marks({});
  assert.equal(d.more, hint);
  r.m.lang(true);
  assert.equal(r.decorate().more, '更早的问题还没加载，点击加载');
});

test("a question's last bookmark deleted: its dot fades out; with the rail off it goes at once", () => {
  const r = rail({ count: 4 });
  r.marks({ q1: [false] });
  assert.deepEqual(r.marks({}).drop, [['q1', true]]);
  r.marks({ q2: [false] });
  r.render(true); // the rail off
  assert.deepEqual(r.marks({}).drop, [['q2', false]]);
});

test('the tick under a y: the three dots above the first tick while history is unloaded; clamped at both ends', () => {
  const e = rail({ count: 3, hasPrev: true });
  const t = top(e.m);
  assert.deepEqual(
    [t - 16, t - 0.5, t, t + 1000, t - 16.5].map((y) => e.m.indexAt(y)),
    [EARLIER, EARLIER, 0, 2, 0],
  );
  assert.equal(e.point(EARLIER).meta, '', 'the pointer on the three dots shows their card');
  const r = rail({ count: 3 });
  assert.deepEqual(
    [top(r.m) - 8, top(r.m) + 1000].map((y) => r.m.indexAt(y)),
    [0, 2],
  );
  assert.equal(r.point(1).text, 'Question 1');
  r.m.hide();
  assert.equal(r.m.indexAt(400), -2, 'off: no tick');
});

test('the busy tick follows the jump; the rail turns on at a 560 px chat', () => {
  const r = rail();
  r.m.journey({ busy: 'q2' });
  assert.deepEqual(r.m.layout(1200).busy, [false, false, true, false, false]);
  assert.deepEqual([r.m.busyAt(2), r.m.busyAt(1)], [true, false]);
  r.m.measure({ ...box(), width: 560 });
  assert.equal(r.m.shows(false), true);
});

test('geometry: the ticks take 85% of the free height when they are dense; the rail top is a whole pixel', () => {
  const r = rail({ count: 60 });
  const css = Object.fromEntries(r.m.layout(1200).css);
  const pitch = ((900 - 140 - 52 - 20) * 0.85) / 60;
  assert.equal(css['--pitch'], `${pitch}px`);
  assert.equal(css['--y'], `${Math.round(406 - (20 + 60 * pitch) / 2)}px`);
  assert.notEqual(406 - (20 + 60 * pitch) / 2, Math.round(406 - (20 + 60 * pitch) / 2));
});

test('opening another chat forgets the seek preview and the active question', () => {
  const r = rail();
  r.m.journey({ pinned: true });
  r.m.setActive('q2');
  r.m.seek({ state: 'dragging', id: 'q1', n: 2, total: 5 });
  r.m.open('other');
  assert.equal(r.m.seeking, false);
  assert.equal(r.m.setActive('q2'), true, 'no active tick any more');
  const s = rail();
  s.m.journey({ pinned: true });
  s.m.setActive('q2');
  s.m.open('other');
  s.m.page({ conv: 'other', before: null, hasPrev: false, items: questions(5) });
  s.render();
  s.settle();
  assert.deepEqual(s.lit(), [], 'nothing pinned in the new chat');
});
