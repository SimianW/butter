// A rail click that sends the chat the wrong way first (notes/runs/2026-11-14-rail-jump-detours).
// The turn tracker and the jump run over the fake virtualizer in test/helpers/rail-virtualizer.mjs,
// in the geometry of the user's 4-question chat.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTTOM, TOPS, setup } from './helpers/rail-virtualizer.mjs';

// Jump 9 in the user's bug files ended `lost`: q0 had mounted at the top, then the page went to
// the bottom (6527) and q0 was unmounted there. The test puts the page at the bottom the same way.
function afterLostJump() {
  const t = setup();
  assert.equal(t.turns.estimate(0), TOPS[0], 'control: q0 is first recorded where it is');
  t.scroller.scrollTop = BOTTOM; // q0 and q1 unmount at the bottom; q2 and q3 mount
  assert.ok(!t.els[0].isConnected && t.els[3].isConnected);
  return t;
}

test('a turn unmounted while the chat is at the bottom keeps its position record', () => {
  const t = afterLostJump();
  const record = t.turns.estimate(0);
  assert.equal(
    record,
    TOPS[0],
    `bug: q0 unmounted at scrollTop ${BOTTOM} is now recorded at ${record}: the position ` +
      'observer turned its empty rect into "wherever the chat is now" (rail/turns.js ioPos)',
  );
});

test('a click on question 0 from question 3 never scrolls the chat below where it started', async () => {
  const t = afterLostJump();
  t.scroller.scrollTop = TOPS[3] - 64; // jump 10 glided to question 3: scrollTop 5661
  const start = t.scroller.scrollTop;
  t.writes.length = 0;
  t.jump.go(0);
  await t.run(8000);
  assert.ok(t.els[0].isConnected, 'control: q0 mounted in the end');
  const detours = t.writes.filter((w) => w > start);
  assert.deepEqual(
    detours,
    [],
    `bug: the jump up to question 0 from scrollTop ${start} first wrote ${detours.join(', ')} ` +
      `(the bottom is ${BOTTOM}); all writes: ${t.writes.join(', ')}`,
  );
});
