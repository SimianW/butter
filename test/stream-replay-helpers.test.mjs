// Node-side helpers of stream-replay-live.mjs (lab/harness/stream-*.mjs), with fake clocks, a fake
// CDP session and a fake page: no browser.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { tailWindow } from '../lab/harness/stream-laf-report.mjs';
import { traceWindow, TRACE_CATS } from '../lab/harness/stream-run-opts.mjs';
import { fontRows, isStreamDrop, u2DelayMs } from '../lab/harness/stream-ux-probe.mjs';
import { veilProbe } from '../lab/harness/stream-veil-probe.mjs';

// A clock that only moves when the code under test pauses (and 5 ms per tick, as a page call would).
function fakeClock() {
  let t = 0;
  const ticks = [];
  const snaps = [];
  return {
    ticks,
    snaps,
    now: () => t,
    pause: async (ms) => {
      t += ms;
    },
    tick: async (el, since) => {
      ticks.push([el, since]);
      t += 5;
    },
    snap: async () => {
      snaps.push(t);
      return { at: t };
    },
  };
}

test('tailWindow: the after snapshot is taken once, 3 s past completion, while the tail keeps ticking to 5 s', async () => {
  const c = fakeClock();
  const after = await tailWindow(c.tick, c.snap, -1000, 5000, c);
  assert.equal(c.snaps.length, 1);
  assert.ok(c.snaps[0] >= 3000 && c.snaps[0] < 3200, `snap at ${c.snaps[0]}`);
  assert.deepEqual(after, { at: c.snaps[0] });
  const later = c.ticks.filter(([, since]) => since > c.snaps[0]);
  assert.ok(later.length >= 5, `${later.length} ticks after the snapshot`);
  assert.ok(c.ticks.at(-1)[1] < 5000 && c.ticks.at(-1)[1] >= 4600);
  assert.equal(c.ticks[0][0] - c.ticks[0][1], 1000, 'el counts from t0');
});

test('tailWindow: after a 1 s tail the snapshot still waits for 3 s', async () => {
  const c = fakeClock();
  await tailWindow(c.tick, c.snap, 0, 1000, c);
  assert.deepEqual(c.snaps, [3000]);
  assert.ok(c.ticks.every(([, since]) => since < 1000));
});

test('isStreamDrop: a fall of more than a viewport counts until the UX probe writes scrollTop', () => {
  const s = { y: 1000, vh: 800 };
  assert.equal(isStreamDrop(9000, s), true);
  assert.equal(isStreamDrop(9000, s, 0), true);
  assert.equal(isStreamDrop(1500, s, 0), false);
  assert.equal(isStreamDrop(null, s, 0), false);
  assert.equal(isStreamDrop(9000, null, 0), false);
  assert.equal(isStreamDrop(9000, s, 1), false);
});

test('u2DelayMs: 2000 by default, U2_DELAY when it is a whole number of ms within the sampling window', () => {
  assert.equal(u2DelayMs({}), 2000);
  assert.equal(u2DelayMs({ U2_DELAY: '' }), 2000);
  assert.equal(u2DelayMs({ U2_DELAY: '6000' }), 6000);
  assert.equal(u2DelayMs({ U2_DELAY: '0' }), 0);
  for (const bad of ['abc', '-1', '1.5', '15000'])
    assert.throws(() => u2DelayMs({ U2_DELAY: bad }), /U2_DELAY/);
});

test('fontRows: font loads on the clock from completion, file names only, files in start order', () => {
  const r = fontRows(
    [[1500.04, ['KaTeX_Main']]],
    [
      {
        name: 'https://cdn.example/a/KaTeX_Size1.woff2?v=2',
        startTime: 1400,
        responseEnd: 1450.06,
      },
      { name: 'https://cdn.example/b/KaTeX_Main.woff2', startTime: 1200, responseEnd: 1300 },
    ],
    1000,
  );
  assert.deepEqual(r.done, [{ rt: 500, families: ['KaTeX_Main'] }]);
  assert.deepEqual(r.files, [
    { start: 200, end: 300, file: 'KaTeX_Main.woff2' },
    { start: 400, end: 450.1, file: 'KaTeX_Size1.woff2' },
  ]);
});

test('traceWindow: the closing tick creates the trace file in a directory that does not exist yet', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-'));
  const file = path.join(dir, 'new', 'run.trace.json');
  const cdp = new EventEmitter();
  cdp.send = async (method) => {
    if (method === 'Tracing.start')
      cdp.emit('Tracing.dataCollected', { value: [{ name: 'a' }, { name: 'b' }] });
    if (method === 'Tracing.end') setImmediate(() => cdp.emit('Tracing.tracingComplete'));
    if (method === 'Runtime.evaluate') return { result: { value: 123 } };
    return {};
  };
  const tw = traceWindow(cdp, 10000, 10000, file);
  await tw.tick(5000);
  await tw.tick(15000);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    traceEvents: [{ name: 'a' }, { name: 'b' }],
  });
  assert.deepEqual(await tw.finish(), { started: true, events: 2, pageStart: 123, file });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('traceWindow: extra categories are traced on top of the default ones', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-'));
  const cdp = new EventEmitter();
  let cats = null;
  cdp.send = async (method, params) => {
    if (method === 'Tracing.start') cats = params.traceConfig.includedCategories;
    if (method === 'Tracing.end') setImmediate(() => cdp.emit('Tracing.tracingComplete'));
    if (method === 'Runtime.evaluate') return { result: { value: 1 } };
    return {};
  };
  const tw = traceWindow(cdp, 10000, 2000, path.join(dir, 'run.trace.json'), ['x.extra']);
  await tw.tick(8999);
  assert.equal(cats, null);
  await tw.tick(9000);
  assert.deepEqual(cats, [...TRACE_CATS, 'x.extra']);
  await tw.finish();
  fs.rmSync(dir, { recursive: true, force: true });
});

// A page whose evaluate runs the probe's in-page code in a vm context with a controlled
// animation-frame queue. evaluate() runs frames until a returned promise settles (at most 1000).
// A MessageChannel whose message arrives on the next turn of the event loop (Node's own would
// keep the process alive once onmessage is set).
class FakeChannel {
  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.({ data: 0 })) };
  }
}

// leak: every tested point is on a block that window.__veilCheck finds rendered at opacity 0.
function fakePage({ column = true, leak = false } = {}) {
  let id = 0;
  let queue = [];
  const rect = { top: 0, bottom: 800, left: 0, right: 800, width: 800, height: 800 };
  const turn = { getBoundingClientRect: () => ({ ...rect, top: -4000, height: 9000 }) };
  const sc = {
    clientHeight: 800,
    scrollTop: 5000,
    getBoundingClientRect: () => rect,
    querySelectorAll: () => [turn],
  };
  const col = { getBoundingClientRect: () => rect };
  const document = {
    body: {},
    querySelectorAll: (q) => (q === '.thread-scroll-container' ? [sc] : column ? [col] : []),
    elementFromPoint: () => (leak ? block : null),
  };
  const block = {
    parentElement: { matches: () => true },
    matches: () => false,
    hasAttribute: () => false,
  };
  const ctx = vm.createContext({
    document,
    performance: { now: () => 0 },
    addEventListener: () => {},
    getComputedStyle: () => ({ opacity: '1' }),
    MessageChannel: FakeChannel,
    requestAnimationFrame: (cb) => {
      queue.push([++id, cb]);
      return id;
    },
    cancelAnimationFrame: (n) => {
      queue = queue.filter(([k]) => k !== n);
    },
  });
  ctx.window = ctx;
  ctx.__veilCheck = { leaking: (b) => b === block };
  const page = {
    frames: 0,
    frame() {
      const run = queue;
      queue = [];
      page.frames++;
      for (const [, cb] of run) cb();
    },
    async evaluate(x) {
      const r = vm.runInContext(typeof x === 'string' ? x : `(${x.toString()})()`, ctx);
      if (!(r instanceof Promise) && !(r && typeof r.then === 'function')) return r;
      let done = false;
      let value;
      r.then((v) => {
        done = true;
        value = v;
      });
      for (let n = 0; n < 1000 && !done; n++) {
        await new Promise((res) => setImmediate(res));
        if (!done) page.frame();
      }
      await new Promise((res) => setImmediate(res));
      assert.ok(done, 'the page call did not settle within 1000 frames');
      return value;
    },
  };
  return page;
}

test('veil probe: after the wheel phase stops, the jump to the middle samples once per frame', async () => {
  const page = fakePage();
  const summary = {};
  const vp = await veilProbe(page, { VEILPROBE: '1' }, summary);
  for (let i = 0; i < 5; i++) page.frame();
  page.frames = 0;
  await vp.finish();
  assert.equal(summary.veilProbe.wheel.n, 5);
  assert.equal(summary.veilProbe.mid.n, 30);
  assert.equal(page.frames, 30, `${page.frames} frames gave ${summary.veilProbe.mid.n} samples`);
});

test('veil probe: without an answer column the jump to the middle gives up after 300 frames', async () => {
  const page = fakePage({ column: false });
  const summary = {};
  const vp = await veilProbe(page, { VEILPROBE: '1' }, summary);
  page.frames = 0;
  await vp.finish();
  assert.equal(summary.veilProbe.mid.n, 0);
  assert.equal(page.frames, 300);
});

test("veil probe: a rendered block at opacity 0 under a point counts at the frame's start and after drawing", async () => {
  const page = fakePage({ leak: true });
  const summary = {};
  const vp = await veilProbe(page, { VEILPROBE: '1' }, summary);
  for (let i = 0; i < 4; i++) {
    page.frame();
    await new Promise((res) => setImmediate(res));
  }
  await vp.finish();
  const w = summary.veilProbe.wheel;
  assert.deepEqual([w.n, w.leakStart, w.leakDrawn], [4, 4, 4]);
  assert.equal(summary.veilProbe.mid.leakStart, summary.veilProbe.mid.n);
});
