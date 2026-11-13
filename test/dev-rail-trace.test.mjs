// dev/rail-trace.js over the whole rail (test/helpers/rail-boot.mjs): a rail click on a question
// ChatGPT's virtualizer has not mounted, as in test/rail-jump-returns.test.mjs. The trace records
// which step of the jump ended it, and the rail jumps the same with the hook, without it, and with
// a hook that throws.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setup } from './helpers/rail-boot.mjs';
import { FakeElement } from './helpers/rail-dom.mjs';

const require = createRequire(import.meta.url);
const { createRailTrace } = require('../extension/dev/rail-trace.js');
const { createRecorder } = require('../extension/dev/recorder.js');

// Three turns in a virtualizer that reserves each row's height and mounts only the rows within the
// viewport + 200 px (`mounts(i)` false: row i never mounts). `trace`: 'none', 'throws', or the
// dev trace, whose events come back with their times. The user's wheel comes `wheelAfterMs` after
// the click, or once `wheelWhen(events, steps)` holds (`steps`: the hook's steps so far), and then
// scrolls 600 px.
async function clickSecondQuestion({
  trace = 'dev',
  mounts = () => true,
  wheelAfterMs = null,
  wheelWhen = null,
}) {
  const events = [],
    steps = new Set();
  let nav;
  const tracer = createRailTrace({
    emit: (type, fields) => events.push({ type, t: nav.now(), ...fields }),
    now: () => nav.now(),
    win: { devicePixelRatio: 1.25, visualViewport: { scale: 0.9 } },
  });
  const hook = {
    none: undefined,
    throws: () => {
      throw new Error('a broken hook');
    },
    dev: (step, fields) => {
      steps.add(step);
      tracer.trace(step, fields);
    },
  }[trace];
  nav = setup({ count: 3, nested: true, trace: hook });
  const tops = [100, 11917, 26713];
  const heights = [11817, 14796, 2777];
  const box = nav.turns[0].parentElement;
  let top = 0;
  nav.scroller.scrollHeight = 29490;
  const rows = [];
  for (const [i, turn] of nav.turns.entries()) {
    const row = new FakeElement();
    row.style.height = `${heights[i]}px`;
    row.getBoundingClientRect = () => ({
      top: tops[i] - top,
      bottom: tops[i] + heights[i] - top,
      height: heights[i],
    });
    turn.remove();
    row.append(turn);
    box.append(row);
    rows.push(row);
    turn.getBoundingClientRect = () => ({ top: tops[i] - top, bottom: tops[i] + heights[i] - top });
    if (i > 0) {
      row.remove();
      row.isConnected = turn.isConnected = false;
    }
  }
  const writes = [];
  Object.defineProperty(nav.scroller, 'scrollTop', {
    get: () => top,
    set(value) {
      top = Math.max(0, Math.min(nav.scroller.scrollHeight - nav.scroller.clientHeight, value));
      writes.push(top);
      for (const [i, turn] of nav.turns.entries()) {
        const inWindow =
          mounts(i) &&
          tops[i] < top + nav.scroller.clientHeight + 200 &&
          tops[i] + heights[i] > top - 200;
        if (inWindow && !turn.isConnected) {
          rows[i].isConnected = turn.isConnected = true;
          box.append(rows[i]);
          nav.mount(turn);
        } else if (!inWindow && turn.isConnected) {
          rows[i].remove();
          rows[i].isConnected = turn.isConnected = false;
        }
      }
    },
  });
  nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[1] });
  for (let i = 0; i < 800; i++) {
    if (wheelAfterMs != null && i * 16 === wheelAfterMs) nav.scroller.emit('wheel');
    if (wheelWhen?.(events, steps)) {
      wheelWhen = null;
      nav.scroller.emit('wheel');
      nav.scroller.scrollTop += 600;
    }
    nav.runTimers();
    nav.frame();
    await new Promise((resolve) => setImmediate(resolve));
  }
  const target = nav.turns[1];
  return {
    nav,
    tracer,
    events,
    writes,
    targetTop: target.isConnected ? target.getBoundingClientRect().top : null,
  };
}

const CLOCK_READS = 162;
const ofType = (events, type) => events.filter((e) => e.type === type);
const meta = { bug: 1, round: 1, version: '0.1.0', trigger: 'shortcut' };

// Every event passes the bug file's privacy filter whole.
function assertAllowed(events) {
  const recorder = createRecorder();
  for (const { type, t, ...fields } of events) recorder.record(type, fields, t);
  const now = events.at(-1).t;
  const file = recorder.snapshot({ now, date: new Date(), ...meta });
  assert.equal(file.redacted, 0, 'every key and code is on the allowlist');
  assert.equal(file.events.length, events.length);
}

test('a jump that lands records its start, its tries, its readiness waits and "landed"', async () => {
  const { events, targetTop } = await clickSecondQuestion({});
  assert.ok(Math.abs(targetTop - 64) <= 2, `landed at ${targetTop}`);
  const [start] = ofType(events, 'rail-jump');
  assert.ok(
    events.every((e) => e.jump === start.jump),
    'one jump',
  );
  assert.deepEqual(
    { ...start, t: undefined },
    {
      type: 'rail-jump',
      t: undefined,
      jump: start.jump,
      target: 1,
      activeBefore: -1, // no question was active before the first click
      scrollTop: 0,
      scrollHeight: 29490,
      clientHeight: 900,
      mountedFrom: 0,
      mountedTo: 0,
      earlier: false,
      mounted: false,
      path: 'trip',
      direction: 'down',
    },
  );
  const tries = ofType(events, 'rail-try');
  assert.ok(tries.length >= 1);
  const last = tries.at(-1);
  assert.equal(last.mounted, true);
  assert.equal(last.written, last.estimate - 64);
  assert.equal(last.scrollTopRead, last.written, 'the write was taken as it was');
  assert.deepEqual(
    ofType(events, 'rail-wait').map((e) => [e.wait, e.live]),
    [
      ['math', true],
      ['quiet', true],
      ['steady', true],
      ['recheck', true],
    ],
  );
  for (const e of ofType(events, 'rail-wait')) assert.ok(e.durationMs >= 0);
  const [end] = ofType(events, 'rail-end');
  assert.equal(end.outcome, 'landed');
  assert.equal(end.tries, tries.length);
  assert.equal(end.targetTop, 64);
  assert.equal(end.expired, false);
  assert.equal(events.at(-1), end, 'the end comes last');
  assertAllowed(events);
});

test('a jump whose target never mounts records 8 tries and "never-mounted"', async () => {
  const { events, targetTop } = await clickSecondQuestion({ mounts: (i) => i !== 1 });
  assert.equal(targetTop, null);
  const tries = ofType(events, 'rail-try');
  assert.deepEqual(
    tries.map((e) => e.try),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  for (const e of tries) {
    assert.equal(e.mounted, false);
    assert.equal(e.frames, 30);
    assert.equal(e.live, true);
  }
  // The first try goes where the mounted turn's wrapper ends: 100 + 11817 - 64.
  assert.equal(tries[0].written, 11853);
  assert.equal(ofType(events, 'rail-wait').length, 0, 'no readiness wait without a target');
  const [end] = ofType(events, 'rail-end');
  assert.equal(end.outcome, 'never-mounted');
  assert.equal(end.tries, 8);
  assert.equal(end.targetTop, null);
  assertAllowed(events);
});

test('the user\'s wheel during a trip records the input and "cancelled"', async () => {
  const { events } = await clickSecondQuestion({ mounts: (i) => i !== 1, wheelAfterMs: 800 });
  const [start] = ofType(events, 'rail-jump');
  assert.deepEqual(
    ofType(events, 'rail-cancel').map((e) => [e.jump, e.cause]),
    [[start.jump, 'wheel']],
  );
  const [end] = ofType(events, 'rail-end');
  assert.equal(end.outcome, 'cancelled');
  assert.equal(end.cause, 'wheel');
  assertAllowed(events);
});

test('a wheel while the chat slides in on the target records "cancelled", not "landed"', async () => {
  // The readiness waits are over: the jump has marked itself landed and is arriving or settling.
  const { events } = await clickSecondQuestion({
    wheelWhen: (events) => events.some((e) => e.type === 'rail-wait' && e.wait === 'recheck'),
  });
  const [end] = ofType(events, 'rail-end');
  assert.equal(ofType(events, 'rail-cancel').length, 1);
  assert.equal(end.outcome, 'cancelled');
  assert.equal(end.cause, 'wheel');
  assert.notEqual(end.targetTop, 64, 'the user scrolled away from the target');
  assertAllowed(events);
});

test('a wheel once the chat has stopped on the target records "landed" with its cause', async () => {
  const { events } = await clickSecondQuestion({ wheelWhen: (_, steps) => steps.has('arrived') });
  const [end] = ofType(events, 'rail-end');
  assert.equal(ofType(events, 'rail-cancel').length, 1);
  assert.equal(end.outcome, 'landed');
  assert.equal(end.cause, 'wheel');
  assert.notEqual(end.targetTop, 64, 'the user scrolled away while it settled');
  assertAllowed(events);
});

test('with no hook the rail reads the clock no more often than before the trace', async () => {
  // A landing jump over this fixture, counted on the rail before it had a trace (91fc048). A wait's
  // start time is the dev trace's to take, from its own clock; a higher count means a call site
  // reads the clock for the trace in every build.
  const { nav } = await clickSecondQuestion({ trace: 'none' });
  assert.equal(nav.clockReads(), CLOCK_READS);
});

test('wheel scrolling with no jump in progress records nothing', async () => {
  const { nav, events } = await clickSecondQuestion({});
  const count = events.length;
  for (let i = 0; i < 20; i++) nav.scroller.emit('wheel');
  assert.equal(events.length, count);
});

test('the rail jumps the same without the hook and with a hook that throws', async () => {
  const runs = {};
  for (const trace of ['none', 'dev', 'throws'])
    for (const mounts of [() => true, (i) => i !== 1]) {
      const { writes, targetTop } = await clickSecondQuestion({ trace, mounts });
      (runs[trace] ??= []).push({ writes, targetTop });
    }
  assert.deepEqual(runs.dev, runs.none);
  assert.deepEqual(runs.throws, runs.none);
});

test("the snapshot's rail part: the model's state and each bar's style and box", async () => {
  const { nav, tracer } = await clickSecondQuestion({});
  nav.ticks().forEach((tick, i) => {
    tick.getBoundingClientRect = () => ({ top: 300.4 + 9.6 * i, height: 9.6 });
    tick.firstChild.getBoundingClientRect = () => ({
      top: 304.2 + 9.6 * i,
      height: 1.6,
      width: 12,
    });
  });
  const part = JSON.parse(JSON.stringify(tracer.snapshot())); // as it crosses to the recorder
  assert.deepEqual(part.ids, ['q0', 'q1', 'q2']);
  assert.deepEqual(part.state, {
    questions: 3,
    active: 1,
    lit: [1],
    busy: null,
    pinned: true,
    flying: false,
    hasPrev: false,
  });
  const { bars, ...ticks } = part.ticks;
  assert.equal(ticks.shown, true);
  assert.ok(ticks.pitch > 0);
  assert.equal(ticks.devicePixelRatio, 1.25);
  assert.equal(ticks.viewportScale, 0.9);
  assert.equal(bars.length, 3);
  assert.deepEqual(Object.keys(bars[1]), [
    ...['index', 'scaleX', 'scaleY', 'opacity', 'top', 'height', 'width', 'tickTop', 'tickHeight'],
  ]);
  assert.equal(bars[1].top, 304.2 + 9.6);
  assert.ok(bars.every((b) => Number.isFinite(b.scaleX) && Number.isFinite(b.opacity)));
  // What the recorder keeps (the ids stay in the page) passes the privacy filter whole.
  const file = createRecorder().snapshot({
    now: 0,
    date: new Date(),
    ...meta,
    sources: { rail: { state: part.state, ticks: part.ticks } },
  });
  assert.equal(file.redacted, 0);
  assert.deepEqual(file.rail.state, part.state);
});

test('without the rail the snapshot part is unavailable', () => {
  assert.deepEqual(createRailTrace({ emit() {} }).snapshot(), { unavailable: 'missing' });
});
