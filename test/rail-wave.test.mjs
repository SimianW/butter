// The hover wave's progress (extension/rail/wave.js) through its interface: bars keyed by their
// question, the frame interval's clamp, convergence to rest and whether a frame is still due.
// test/rail-model.test.mjs drives it with the model's targets.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const Wave = createRequire(import.meta.url)('../extension/rail/wave.js');
const rest = (j, kept) => kept ?? [1, 0.28, 1];

test('bars follow their questions when the questions move, and new ones start where start() says', () => {
  const w = Wave();
  assert.deepEqual(w.carry(['a', 'b'], rest), [
    ['scale(1.000, 1.000)', '0.280'],
    ['scale(1.000, 1.000)', '0.280'],
  ]);
  w.start(0);
  w.frame(16, (j) => (j === 1 ? [2, 1, 1.5] : [1, 0.28, 1]));
  const b = w.scale(1);
  assert.ok(b > 1);
  const kept = [];
  w.carry(['new', 'a', 'b'], (j, k) => (kept.push(k), rest(j, k)));
  assert.equal(kept[0], undefined, 'a new question has no state of its own');
  assert.equal(w.scale(2), b, "b's bar moved two slots down with it");
  assert.equal(w.scale(3), undefined);
});

test('one frame moves each bar part of the way: the interval is clamped to 0–64 ms and time never runs back', () => {
  const w = Wave();
  w.carry(['a'], rest);
  const to = () => [3, 1, 1];
  assert.equal(w.start(1000), true);
  assert.equal(w.start(1000), false, 'a frame is already due');
  // A frame that began before start() was called (the page was busy): no move, nothing thrown far.
  let f = w.frame(500, to);
  assert.equal(w.scale(0), 1);
  assert.equal(f.moving, true);
  f = w.frame(900, to); // still before the stored time: the interval stays non-negative
  assert.equal(w.scale(0), 1);
  // A long frame moves as far as a 64 ms one.
  const long = Wave(),
    short = Wave();
  for (const x of [long, short]) {
    x.carry(['a'], rest);
    x.start(0);
  }
  long.frame(60_000, to);
  short.frame(64, to);
  assert.equal(long.scale(0), short.scale(0));
  assert.ok(long.scale(0) < 3);
});

test('a bar within 0.003 of its target snaps to it once; then frames change nothing and none is due', () => {
  const w = Wave();
  w.carry(['a', 'b'], rest);
  w.start(0);
  const to = (j) => (j === 0 ? [1.002, 0.281, 1.001] : [1, 0.28, 1]);
  let f = w.frame(16, to);
  assert.deepEqual(f.bars, [[0, 'scale(1.002, 1.001)', '0.281']], 'only the changed bar');
  assert.equal(f.moving, false);
  assert.equal(w.moving, false);
  f = w.frame(32, to);
  assert.deepEqual(f.bars, []);
  w.start(40);
  w.stop();
  assert.equal(w.moving, false);
});
