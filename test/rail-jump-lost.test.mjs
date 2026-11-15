// A jump whose target ChatGPT unmounts again after it mounted (notes/runs/2026-11-14-rail-jump-detours,
// Finding 3). In the user's capture question 0 mounted at the top, stayed still for 150 ms, then
// ChatGPT unmounted it and moved the chat to the bottom; the jump waited out its 3 s readiness waits
// with no element, ended `lost` and showed the chat at the bottom about 4.5 s after the click.
// The turn tracker and the jump run over the fake virtualizer in test/helpers/rail-virtualizer.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTTOM, TOPS, setup } from './helpers/rail-virtualizer.mjs';

const BUSY = 600, // ChatGPT renders a turn it mounted for this long: a frame every 50 ms
  SNAP = 250; // ms after question 0 mounts that ChatGPT unmounts it and moves the chat to the bottom

// The chat at question 3 (5661), then a click on question 0. `snaps`: how many of question 0's
// mounts ChatGPT answers by moving the chat to the bottom. Steps until the jump ends or `ms` pass;
// returns when it ended (ms after the click, or null) and the scrollTop writes it made.
async function clickQuestion0({ snaps, ms = 15000 }) {
  const t = setup();
  t.scroller.scrollTop = TOPS[3] - 64;
  await t.run(500);
  t.writes.length = 0;
  let mounts = 0,
    mountedAt = -Infinity,
    snap = false;
  t.mounted((i) => {
    if (i !== 0) return;
    mountedAt = t.now();
    snap = mounts++ < snaps;
  });
  const clicked = t.now();
  void t.jump.go(0);
  let ended = null;
  while (t.now() - clicked < ms) {
    t.frameMs = t.now() < mountedAt + BUSY ? 50 : 16;
    await t.run(t.frameMs);
    if (snap && t.now() >= mountedAt + SNAP) {
      snap = false;
      t.page(BOTTOM);
    }
    if (ended == null && !t.st.flying && t.trip.tok == null) ended = t.now() - clicked;
    if (ended != null && t.now() - clicked > ended + 2500) break; // past settle
  }
  return { t, ended, mounts };
}

test('a target unmounted once after it mounted is mounted again, and the jump lands on it', async () => {
  const { t, ended, mounts } = await clickQuestion0({ snaps: 1 });
  assert.ok(mounts >= 1, 'control: question 0 mounted');
  const q0 = t.els[0];
  assert.ok(
    q0.isConnected && q0.getBoundingClientRect().top === 64 && t.st.pinned,
    `bug: question 0 was unmounted after it mounted and the jump never looked for it again: ` +
      `it ended ${ended} ms after the click at scrollTop ${t.scroller.scrollTop} ` +
      `(question 0 ${q0.isConnected ? 'mounted' : 'unmounted'}, pinned ${t.st.pinned}); ` +
      `writes: ${t.writes.join(', ')}`,
  );
  assert.ok(
    ended != null && ended < 2500,
    `the jump landed ${ended} ms after the click: not before the old 3 s wait would have ended`,
  );
});

test('a target unmounted every time it mounts ends the jump in bounded time, shown and unpinned', async () => {
  const { t, ended, mounts } = await clickQuestion0({ snaps: Infinity });
  assert.ok(mounts >= 1, 'control: question 0 mounted');
  assert.ok(
    ended != null && ended < 3000,
    `bug: the jump ended ${ended} ms after the click (bound 3000 ms); writes: ${t.writes.join(', ')}`,
  );
  assert.equal(t.trip.tok, null, 'the trip ended: the chat shows');
  assert.equal(t.st.pinned, false, 'the jump unpinned');
  assert.ok(t.writes.length <= 20, `${t.writes.length} scroll writes: ${t.writes.join(', ')}`);
});
