// While a jump owns the chat's position, the browser's scroll anchoring on the chat's content is
// off: `data-butter-pinned` on `<html>` (stream/containment.css reads it). With Smoother
// streaming's content-visibility on, Chromium's anchoring moved a landed chat back to its start
// (notes/runs/2026-11-16-rail-jump-live/cause.md). The attribute lives from the click until the pin
// ends: the user scrolls, the jump is cancelled, or it ends without landing.
// The turn tracker and the jump run over the fake virtualizer in test/helpers/rail-virtualizer.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTTOM, TOPS, setup } from './helpers/rail-virtualizer.mjs';

const ATTR = 'data-butter-pinned';

// Every change to the attribute, in order: `true` set, `false` removed.
function watch(html) {
  const log = [],
    set = html.setAttribute.bind(html),
    remove = html.removeAttribute.bind(html);
  html.setAttribute = (name, value) => {
    if (name === ATTR) log.push(true);
    set(name, value);
  };
  html.removeAttribute = (name) => {
    if (name === ATTR && html.hasAttribute(name)) log.push(false);
    remove(name);
  };
  return log;
}

// Steps frames until the jump has landed (not flying, the trip ended) or `ms` pass; `each()` runs
// after every frame. Returns the ms it took, or null.
async function untilLanded(t, ms, each = () => {}) {
  const start = t.now();
  while (t.now() - start < ms) {
    await t.run(16);
    each();
    if (!t.st.flying && t.trip.tok == null) return t.now() - start;
  }
  return null;
}

test('a far jump turns anchoring off from the click through landing and while pinned, until the user scrolls', async () => {
  const t = setup();
  const log = watch(t.html);
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute before a jump');
  void t.jump.go(3);
  assert.equal(t.html.hasAttribute(ATTR), true, 'bug: no attribute once the far jump starts');
  const off = [];
  const took = await untilLanded(t, 8000, () => {
    if (!t.html.hasAttribute(ATTR)) off.push(t.scroller.scrollTop);
  });
  assert.ok(took != null && t.els[3].isConnected, 'control: the jump landed on question 3');
  assert.deepEqual(off, [], 'the attribute stayed on through the trip');
  await t.run(3000); // past settle, still pinned
  assert.ok(t.st.pinned, 'control: still pinned');
  assert.equal(t.html.hasAttribute(ATTR), true, 'the attribute stays while pinned');
  t.scroller.emit('wheel'); // the user scrolls: the pin ends
  assert.equal(t.st.pinned, false, 'control: the wheel unpinned');
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute after the user scrolls');
  assert.deepEqual(log, [true, false], 'set once, removed once');
});

test('a jump cancelled mid-trip turns anchoring back on', async () => {
  const t = setup();
  void t.jump.go(3);
  await t.run(100);
  assert.equal(t.html.hasAttribute(ATTR), true, 'bug: no attribute during the trip');
  t.jump.cancel('send');
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute after cancel');
  await t.run(3000);
  assert.equal(t.html.hasAttribute(ATTR), false, 'and none later');
});

test('a takeover keeps anchoring off without a gap, and the second jump owns it', async () => {
  const t = setup();
  const log = watch(t.html);
  void t.jump.go(3);
  await t.run(100);
  assert.ok(t.trip.tok != null, 'control: the trip is in flight');
  void t.jump.go(2); // a new click mid-trip takes the trip over
  const took = await untilLanded(t, 8000);
  assert.ok(took != null && t.els[2].isConnected, 'control: the takeover landed on question 2');
  assert.ok(t.st.pinned, 'control: pinned');
  assert.equal(t.html.hasAttribute(ATTR), true, 'bug: no attribute after the takeover landed');
  assert.ok(!log.includes(false), `the attribute was removed during the takeover: ${log}`);
  t.jump.cancel('wheel');
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute after the pin ends');
});

test('a jump that ends without landing turns anchoring back on', async () => {
  const t = setup();
  t.scroller.scrollTop = TOPS[3] - 64;
  await t.run(500);
  // ChatGPT renders question 0 for 600 ms after every mount (a frame every 50 ms) and moves the
  // chat to the bottom 250 ms after it: the jump ends lost (as in test/rail-jump-lost.test.mjs).
  let mountedAt = -Infinity,
    snap = false;
  t.mounted((i) => {
    if (i !== 0) return;
    mountedAt = t.now();
    snap = true;
  });
  void t.jump.go(0);
  assert.equal(t.html.hasAttribute(ATTR), true, 'bug: no attribute once the far jump starts');
  let ended = null;
  for (const start = t.now(); t.now() - start < 15000; ) {
    t.frameMs = t.now() < mountedAt + 600 ? 50 : 16;
    await t.run(t.frameMs);
    if (snap && t.now() >= mountedAt + 250) {
      snap = false;
      t.page(BOTTOM);
    }
    if (!t.st.flying && t.trip.tok == null) {
      ended = t.now() - start;
      break;
    }
  }
  assert.ok(ended != null && !t.st.pinned, 'control: the jump ended, unpinned');
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute after a jump that did not land');
});

test('a glide turns anchoring off while pinned too', async () => {
  const t = setup();
  t.scroller.scrollTop = 1000;
  await t.run(500);
  void t.jump.go(1);
  assert.equal(t.trip.tok, null, 'control: a glide, no trip');
  assert.equal(t.html.hasAttribute(ATTR), true, 'bug: no attribute during the glide');
  await t.run(3000);
  assert.ok(t.st.pinned && t.els[1].isConnected, 'control: the glide landed, pinned');
  assert.equal(t.html.hasAttribute(ATTR), true, 'the attribute stays while pinned');
  t.scroller.emit('wheel');
  assert.equal(t.html.hasAttribute(ATTR), false, 'no attribute after the user scrolls');
});
