// Pre-layout over the fake DOM (seam 1a): after a streamed answer completes, stream/offscreen.js
// lays out its held (never-rendered, still skipped) blocks in idle time, a few per idle callback,
// so that a later find or jump finds them laid out. It reads layout inside each block and writes
// nothing. What the browser does with that read (the blocks stay skipped, veiled and held; a later
// window.find lays out far fewer objects) is checked in headless Chromium
// (stream-prelayout-chromium.test.mjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const v8 = require('node:v8');
const vm = require('node:vm');
const { offscreenFixture } = require('./helpers/offscreen-fixture.cjs');

// A fixture whose answer streamed `n` blocks below the fold, all held by the flush.
function held(n, opts) {
  const f = offscreenFixture({ blocks: n, ...opts });
  for (const el of f.blocks) (f.cv(el, true), f.size(el, 120));
  f.timers();
  assert.ok(f.blocks.every(f.unrendered) && f.blocks.every(f.veiled));
  return f;
}

test('after the answer completes, its held blocks are laid out in idle time, after the completion work', () => {
  const f = held(3);
  f.complete();
  f.idle();
  assert.deepEqual(f.laidOut, [], 'not in the idle time right after the completion task');
  f.timers(); // ChatGPT's completion work is over
  assert.deepEqual(f.laidOut, [], 'nothing until the page is idle');
  f.idle();
  assert.deepEqual(f.laidOut, f.blocks, 'each held block once, in document order');
});

// Completes the answer and lets the start delay pass: pre-layout is now waiting for idle time.
const completed = (f) => (f.complete(), f.timers(), f);

test('each idle callback lays out a few blocks and stays well under a long frame', () => {
  // Live, one block's forced update took 1-17 ms.
  const f = completed(held(40, { readMs: 4 }));
  const took = f.idle();
  assert.equal(f.laidOut.length, 40);
  assert.ok(took.length >= 10, `${took.length} idle callbacks`);
  assert.ok(Math.max(...took) <= 20, `longest idle callback ${Math.max(...took)} ms`);
  const slow = completed(held(3, { readMs: 17 }));
  assert.deepEqual(
    slow.idle(),
    [17, 17, 17],
    'one block per callback at least, never more when slow',
  );
});

test('on a page that is never idle, each callback runs on a short timeout and still lays out a few blocks', () => {
  // Live, a page drawing a long frame every frame got no idle period for 15 s after completion,
  // and a find then paid for the blocks never laid out (round2/prelayout-live/report.md).
  const f = completed(held(40, { readMs: 4 }));
  const took = f.idle({ timedOut: true });
  assert.equal(f.laidOut.length, 40);
  assert.ok(
    f.idleTimeouts.length && f.idleTimeouts.every((ms) => ms > 0 && ms <= 100),
    `requested with timeouts ${f.idleTimeouts}`,
  );
  assert.ok(took.length <= 20, `${took.length} callbacks for 40 blocks: one block each`);
  assert.ok(Math.max(...took) <= 20, `longest callback ${Math.max(...took)} ms`);
});

test('it writes nothing: no block is marked, held, unveiled or observed by it', () => {
  const f = completed(held(5));
  f.calls.length = 0;
  f.idle();
  assert.equal(f.laidOut.length, 5);
  assert.deepEqual(f.calls, []);
  assert.ok(f.blocks.every(f.unrendered) && f.blocks.every(f.veiled));
  assert.ok(!f.blocks.some(f.seen));
});

test('it stops when cv goes off (which includes Paused), and does not start again with it', () => {
  const f = completed(held(10));
  f.idle({ max: 1 });
  const before = f.laidOut.length;
  assert.ok(before > 0 && before < 10, `${before} laid out in the first callback`);
  f.setting(false);
  f.setting(true);
  f.idle();
  assert.equal(f.laidOut.length, before);
});

test('it never starts when cv is off at the start', () => {
  const f = held(3);
  f.complete();
  f.setting(false);
  f.timers();
  f.idle();
  assert.deepEqual(f.laidOut, []);
});

test('it pauses while the document is hidden and resumes where it stopped when it shows', () => {
  const f = completed(held(10));
  f.idle({ max: 1 });
  const before = f.laidOut.length;
  assert.ok(before > 0 && before < 10, `${before} laid out in the first callback`);
  f.hide();
  f.idle();
  assert.equal(f.laidOut.length, before, 'paused while hidden');
  f.show();
  f.idle();
  assert.deepEqual(f.laidOut, f.blocks, 'the rest once it shows, each block once');
});

test('a start in a hidden document waits until it shows', () => {
  const f = held(3);
  f.complete();
  f.hide();
  f.timers();
  f.idle();
  assert.deepEqual(f.laidOut, [], 'nothing while hidden');
  f.show();
  f.idle();
  assert.deepEqual(f.laidOut, f.blocks);
});

test('a document that shows after cv went off lays nothing out', () => {
  const f = completed(held(10));
  f.idle({ max: 1 });
  const before = f.laidOut.length;
  f.hide();
  f.setting(false);
  f.setting(true);
  f.show();
  f.idle();
  assert.equal(f.laidOut.length, before);
});

test('it stops when the turn goes back to in_progress', () => {
  const f = completed(held(10));
  f.idle({ max: 1 });
  const before = f.laidOut.length;
  f.restart();
  f.idle();
  assert.equal(f.laidOut.length, before);
});

test('it skips a block that has rendered or left the page', () => {
  const f = held(4);
  const [, shown, gone] = f.blocks;
  completed(f);
  f.cv(shown, false); // scrolled to
  f.detach(gone);
  f.idle();
  assert.deepEqual(f.laidOut, [f.blocks[0], f.blocks[3]]);
});

test('it does nothing in an opened chat, whose turns were never in_progress', () => {
  // Held blocks are possible there only through a restored layout's inline skipping.
  const f = offscreenFixture({ blocks: 3 });
  f.complete({ from: 'complete' }); // ChatGPT sets the state of a turn that loaded complete
  for (const el of f.blocks) (f.cv(el, true), f.size(el, 120));
  f.timers();
  assert.ok(f.blocks.every(f.unrendered));
  f.complete({ from: 'complete' });
  f.timers();
  f.idle();
  assert.deepEqual(f.laidOut, []);
});

test('when web fonts finish loading after the pass, the laid-out blocks still held are laid out again', () => {
  // The pass requests KaTeX's fonts; they arrive after it and invalidate what it laid out.
  const f = completed(held(3));
  f.idle();
  f.cv(f.blocks[1], false); // rendered since
  f.laidOut.length = 0;
  f.fontsLoaded();
  f.idle();
  assert.deepEqual(f.laidOut, [f.blocks[0], f.blocks[2]]);
  f.laidOut.length = 0;
  f.setting(false);
  f.setting(true);
  f.fontsLoaded();
  f.idle();
  assert.deepEqual(f.laidOut, [], 'nothing after cv went off');
});

test('a font load before any pass lays nothing out', () => {
  const f = held(3);
  f.fontsLoaded();
  f.idle();
  assert.deepEqual(f.laidOut, []);
});

// A full garbage collection (the flag is set at run time, so `node --test` needs no option).
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');

test('a block pre-layout laid out is not kept once it has left the page', async () => {
  // The user opens another chat: the answer's elements leave the page for good, and the new
  // chat's turns load complete. Nothing may keep the old blocks alive.
  const f = completed(held(5));
  f.idle();
  assert.equal(f.laidOut.length, 5);
  // The first block stays referenced by the fixture and the last by the marker's Range.
  const gone = f.blocks.slice(1, 4).map((b) => new WeakRef(b));
  f.replace(0);
  f.complete({ from: 'complete' });
  f.calls.length = 0;
  f.laidOut.length = 0;
  await new Promise((resolve) => setImmediate(resolve));
  gc();
  assert.deepEqual(
    gone.map((r) => r.deref() === undefined),
    [true, true, true],
    'collected',
  );
});
