// The rail presentation model (extension/rail/model.js) driven the way rail/rail.js drives it,
// with no DOM: events, measured boxes and frame times in; bar styles, dot places, the card and its
// intents out. Shared by test/rail-model.test.mjs and test/rail-card.test.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const RailModel = require('../../extension/rail/model.js');
export const conv = '12345678-1234-1234-1234-123456789abc';
export const EARLIER = -1;
export const REST = [1, 0.28, 1];
export const box = (height = 900, gutter = 0) => ({
  top: 0,
  bottom: height,
  left: 0,
  right: 1000 - gutter,
  gutter,
  width: 1000,
});

// A rail over `count` questions q0…, rendered and settled, as rail.js would leave it.
export function rail({ count = 5, hasPrev = false, height = 900, gutter = 0 } = {}) {
  const m = RailModel();
  let now = 10_000,
    due = false,
    styles = [],
    lit = [];
  const dots = new Map();
  const place = (list) => list.forEach(([id, t]) => dots.set(id, t));
  const r = {
    m,
    dots,
    advance: (ms) => (now += ms),
    kick(ids = lit) {
      lit = ids;
      if (m.kick(ids, now)) due = true;
    },
    frame(t = now + 16) {
      now = Math.max(now, t);
      if (!due) return null;
      due = false;
      const f = m.frame(t);
      if (!f) return null;
      for (const [j, transform, opacity] of f.bars) styles[j] = [transform, opacity];
      place(f.dots);
      due = f.moving;
      return f;
    },
    due: () => due,
    settle() {
      for (let i = 0; due && i < 200; i++) r.frame();
      assert.equal(due, false, 'the wave settles and stops asking for frames');
    },
    decorate() {
      const d = m.decorate();
      for (const [id] of d.drop) dots.delete(id);
      place(d.place);
      return d;
    },
    render(off = false) {
      m.questions();
      if (!m.shows(off)) return void m.hide();
      const l = m.layout(1200);
      styles = l.bars.map((x) => [...x]);
      r.decorate();
      r.kick();
      return l;
    },
    // Each bar's [scaleX, opacity, scaleY] as drawn.
    bars: () =>
      styles.map(([t, o]) => {
        const [, s, y] = /^scale\(([^,]+), ([^)]+)\)$/.exec(t);
        return [Number(s), Number(o), Number(y)];
      }),
    lit: () => r.bars().flatMap(([, o], j) => (o === 1 ? [j] : [])),
    // The pointer over tick `i` (EARLIER: the three dots).
    point(i, x = 0) {
      const y = i === EARLIER ? top(m) - 8 : m.tickY(i); // the three dots' row is 16 px tall
      m.move(x, y);
      r.kick();
    },
    marks(byId, revision = m.rev) {
      m.setMarks(revision, groups(byId));
      return r.decorate();
    },
  };
  m.open(conv);
  m.page({ conv, before: null, hasPrev, items: questions(count) });
  m.measure(box(height, gutter));
  r.render();
  r.settle();
  return r;
}
// The first tick's top: half a pitch above its centre.
export const top = (m) => m.tickY(0) - (m.tickY(1) - m.tickY(0)) / 2;
export const questions = (count, from = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: `q${i + from}`, q: `Question ${i + from}` }));
// Bookmarks per question id, as the bookmark session publishes them: { id: [stale, …] }.
export const groups = (byId) =>
  new Map(
    Object.entries(byId).map(([key, flags]) => {
      const id = key === '-1' ? EARLIER : key;
      const bookmarks = flags.map((stale, k) => ({ key: `${id}-${k}`, excerpt: `B${k}`, stale }));
      return [id, { count: flags.length, fresh: false, bookmarks, stale: flags.every(Boolean) }];
    }),
  );
// Dots as drawn: per id, its right edge left of the ticks' right end and its centre below the
// rail's top, for diameter `d`.
export const dotAt = (translate, d) => {
  const [x, y] = translate.split(' ').map(parseFloat);
  return { right: -x, center: y + d / 2 };
};
