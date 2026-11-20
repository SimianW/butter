// A jump whose target ChatGPT unmounts again after it mounted (notes/runs/2026-11-14-rail-jump-detours,
// Finding 3). In the user's capture question 0 mounted at the top, stayed still for 150 ms, then
// ChatGPT unmounted it and moved the chat to the bottom; the jump waited out its 3 s readiness waits
// with no element, ended `lost` and showed the chat at the bottom about 4.5 s after the click.
// The turn tracker and the jump run over the fake virtualizer in test/helpers/rail-virtualizer.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { BOTTOM, TOPS, setup } from './helpers/rail-virtualizer.mjs';

const { createRailTrace } = createRequire(import.meta.url)('../extension/dev/rail-trace.js');

const BUSY = 600, // ChatGPT renders a turn it mounted for this long: a frame every 50 ms
  SNAP = 250; // ms after question 0 mounts that ChatGPT unmounts it and moves the chat to the bottom

// The chat at question 3 (5661), then a click on question 0. `snaps`: how many of question 0's
// mounts ChatGPT answers by moving the chat to the bottom. Steps until the jump ends or `ms` pass;
// returns when it ended (ms after the click, or null), and the dev build's rail trace `events`.
// `hasPrev`: the chat has earlier pages left, so the jump waits for one once question 0 mounts.
async function clickQuestion0({ snaps, ms = 15000, hasPrev = false }) {
  const events = [];
  let now = () => 0;
  const tracer = createRailTrace({
    emit: (type, fields) => events.push({ type, ...fields }),
    now: () => now(),
  });
  const t = setup({ trace: tracer.trace, hasPrev });
  now = t.now;
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
  return { t, ended, mounts, events };
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

test('a target unmounted once during the wait for an earlier page is mounted again, and the jump lands on it', async () => {
  const { t, ended, events } = await clickQuestion0({ snaps: 1, hasPrev: true });
  const q0 = t.els[0];
  assert.ok(
    q0.isConnected && q0.getBoundingClientRect().top === 64 && t.st.pinned,
    `bug: question 0 was unmounted during the page wait and the jump never looked for it again: ` +
      `it ended ${ended} ms after the click at scrollTop ${t.scroller.scrollTop} ` +
      `(question 0 ${q0.isConnected ? 'mounted' : 'unmounted'}, pinned ${t.st.pinned}); ` +
      `writes: ${t.writes.join(', ')}`,
  );
  assert.deepEqual(
    events.filter((e) => e.type === 'rail-wait' && e.lost).map((e) => e.wait),
    ['page'],
    'the loss stopped the page wait',
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

test("the bug file shows every round's mount tries and the wait each loss stopped", async () => {
  const of = (events, type) => events.filter((e) => e.type === type);
  const lost = (events) => of(events, 'rail-wait').filter((e) => e.lost).length;
  const once = (await clickQuestion0({ snaps: 1 })).events;
  assert.deepEqual(
    of(once, 'rail-try').map((e) => [e.try, e.written, e.mounted]),
    [
      [1, 20, true],
      [2, 20, true],
    ],
    'a try in each round, numbered across the jump',
  );
  assert.equal(lost(once), 1, 'one readiness wait stopped on the loss');
  assert.deepEqual(
    of(once, 'rail-end').map((e) => [e.outcome, e.tries]),
    [['landed', 2]],
  );

  const always = (await clickQuestion0({ snaps: Infinity })).events;
  assert.deepEqual(
    of(always, 'rail-try').map((e) => e.try),
    [1, 2, 3],
  );
  assert.equal(lost(always), 3, 'one wait per round stopped on the loss');
  assert.deepEqual(
    of(always, 'rail-end').map((e) => [e.outcome, e.tries, e.scrollTop]),
    [['lost', 3, BOTTOM]],
  );
});

// Review L1: the target unmounted during the math wait. Question 0 holds a formula ChatGPT has not
// typeset yet (raw TeX); 32 ms into the math wait ChatGPT unmounts it, and brings it back `backAfter`
// ms later (null: never by itself). The formula is typeset `TYPESET` ms after the click.
const TYPESET = 1500;
async function unmountDuringMath(backAfter) {
  const events = [],
    steps = [];
  let now = () => 0;
  const tracer = createRailTrace({
    emit: (type, fields) => events.push({ type, ...fields }),
    now: () => now(),
  });
  const t = setup({
    trace: (step, fields) => {
      steps.push({ step, t: now() });
      tracer.trace(step, fields);
    },
  });
  now = t.now;
  let typeset = false;
  const formula = { querySelector: (s) => (s === '.katex' && typeset ? {} : null) };
  const q0 = t.els[0];
  q0.querySelectorAll = (s) => (s === '[data-math-source]' ? [formula] : []);
  t.scroller.scrollTop = TOPS[3] - 64;
  await t.run(500);
  const clicked = t.now();
  void t.jump.go(0);
  let mathStart = null,
    unmountedAt = null,
    arrivedTypeset = null;
  while (t.now() - clicked < 15000 && !steps.some((s) => s.step === 'end')) {
    await t.run(16);
    const mount = steps.find((s) => s.step === 'mount');
    if (mathStart == null && mount && steps.some((s) => s.step === 'waiting' && s.t >= mount.t))
      mathStart = t.now();
    if (mathStart != null && unmountedAt == null && t.now() >= mathStart + 32) {
      q0.remove();
      q0.isConnected = false;
      unmountedAt = t.now();
    }
    if (backAfter != null && unmountedAt != null && t.now() >= unmountedAt + backAfter) {
      if (!q0.isConnected) {
        q0.isConnected = true;
        t.scroller.append(q0);
      }
    }
    if (t.now() - clicked >= TYPESET) typeset = true;
    if (arrivedTypeset == null && steps.some((s) => s.step === 'arrived')) arrivedTypeset = typeset;
  }
  return { unmountedAt, arrivedTypeset, waits: events.filter((e) => e.type === 'rail-wait') };
}

test('a target back within the lost window during the math wait is not shown before its formulas are typeset', async () => {
  const { unmountedAt, arrivedTypeset } = await unmountDuringMath(112);
  assert.ok(unmountedAt != null, 'control: question 0 was unmounted during the math wait');
  assert.equal(arrivedTypeset, true, 'the jump arrived with raw TeX still showing');
});

test('a target lost during the math wait is recorded as lost in that wait', async () => {
  const { unmountedAt, waits } = await unmountDuringMath(null);
  assert.ok(unmountedAt != null, 'control: question 0 was unmounted during the math wait');
  const math = waits.filter((w) => w.wait === 'math');
  assert.equal(math[0]?.lost, true, `the first math wait: ${JSON.stringify(math[0])}`);
});
