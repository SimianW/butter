const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRecorder,
  fileName,
  downloadPath,
  serialize,
} = require('../extension/dev/recorder.js');

const meta = (now, extra = {}) => ({
  now,
  date: new Date(2026, 10, 8, 21, 14, 3),
  bug: 1,
  round: 1,
  version: '0.1.0-alpha.15+dev.1',
  trigger: 'shortcut',
  sources: {},
  ...extra,
});

test('events older than the 30 s window are not in the snapshot', () => {
  const rec = createRecorder();
  rec.record('press', { kind: 'classic' }, 1_000);
  rec.record('seek', { top: 500 }, 20_000);
  rec.record('release', { reason: 'pointerup' }, 40_000);
  const snap = rec.snapshot(meta(50_000));
  assert.deepEqual(
    snap.events.map((e) => e.type),
    ['seek', 'release'],
  );
});

test('the count cap holds under a flood and keeps the newest events', () => {
  const rec = createRecorder({ maxEvents: 2_000 });
  for (let i = 0; i < 10_000; i++) rec.record('seek', { top: i }, 1_000 + i);
  const snap = rec.snapshot(meta(11_000));
  assert.equal(snap.events.length, 2_000);
  assert.equal(snap.events[0].top, 8_000);
  assert.equal(snap.events.at(-1).top, 9_999);
});

test('the byte cap holds under a flood and keeps the newest events', () => {
  const rec = createRecorder({ maxEvents: 100_000, maxBytes: 10_000 });
  for (let i = 0; i < 10_000; i++)
    rec.record('seek', { top: i, turn: 3, offset: 120, layout: true, items: 14 }, 1_000 + i);
  const snap = rec.snapshot(meta(11_000));
  assert.ok(JSON.stringify(snap.events).length <= 10_000);
  assert.ok(snap.events.length > 50, `kept ${snap.events.length}`);
  assert.equal(snap.events.at(-1).top, 9_999);
});

test('snapshot events come oldest first with t in ms relative to the save', () => {
  const rec = createRecorder();
  rec.record('press', { kind: 'overlay' }, 10_000.4);
  rec.record('seek', { top: 800, turn: 2 }, 10_250.6);
  rec.record('release', { reason: 'pointerup', commit: true }, 12_000);
  const snap = rec.snapshot(meta(13_500));
  assert.deepEqual(snap.events, [
    { type: 'press', t: -3500, kind: 'overlay' },
    { type: 'seek', t: -3249, top: 800, turn: 2 },
    { type: 'release', t: -1500, reason: 'pointerup', commit: true },
  ]);
});

test('the snapshot carries the #32 top-level fields', () => {
  const rec = createRecorder();
  const date = new Date(Date.UTC(2026, 10, 8, 13, 14, 3, 250));
  const snap = rec.snapshot(
    meta(5_000, {
      date,
      bug: 4,
      round: 2,
      sources: { pointerHeld: () => true, settings: () => ({ enabled: true }) },
    }),
  );
  assert.equal(snap.kind, 'butter-diag');
  assert.equal(snap.formatVersion, 1);
  assert.equal(snap.bug, 4);
  assert.equal(snap.round, 2);
  assert.equal(snap.savedAt, '2026-11-08T13:14:03.250Z');
  assert.equal(snap.version, '0.1.0-alpha.15+dev.1');
  assert.equal(snap.trigger, 'shortcut');
  assert.equal(snap.pointerHeld, true);
  assert.deepEqual(snap.settings, { enabled: true });
  assert.deepEqual(snap.events, []);
  assert.equal(snap.redacted, 0);
  assert.deepEqual(Object.keys(snap).slice(0, 8), [
    'kind',
    'formatVersion',
    'bug',
    'round',
    'savedAt',
    'version',
    'trigger',
    'pointerHeld',
  ]);
});

test('a source that throws becomes unavailable and the rest of the snapshot still saves', () => {
  const rec = createRecorder();
  rec.record('press', { kind: 'classic' }, 900);
  const snap = rec.snapshot(
    meta(1_000, {
      sources: {
        pointerHeld: () => false,
        settings: () => {
          throw new Error('storage gone: https://chatgpt.com/c/secret');
        },
        pressDecision: () => ({ schema: 1, sequence: 3 }),
        failures: () => {
          throw new TypeError('x');
        },
      },
    }),
  );
  assert.deepEqual(snap.settings, { unavailable: 'error' });
  assert.deepEqual(snap.failures, { unavailable: 'error' });
  assert.equal(snap.pointerHeld, false);
  assert.deepEqual(snap.pressDecision, { schema: 1, sequence: 3 });
  assert.equal(snap.events.length, 1);
  assert.doesNotMatch(JSON.stringify(snap), /secret|storage gone/);
});

test('the privacy filter drops text, ID-shaped strings and URLs and counts them in redacted', () => {
  const rec = createRecorder();
  const text = 'What is the integral of x squared?',
    id = '6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12',
    url = 'https://chatgpt.com/c/6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12';
  rec.record('press', { kind: 'classic', reason: text }, 900);
  rec.record('seek', { top: 10, turn: id }, 950);
  const snap = rec.snapshot(
    meta(1_000, {
      sources: {
        pointerHeld: () => true,
        settings: () => ({ enabled: true, lang: 'zh', note: 'hello' }),
        pressDecision: () => ({
          schema: 1,
          idsReason: 'ids-from-fallback',
          phase: url,
          turns: [
            { index: 0, layoutReason: 'no-record' },
            { index: 1, layoutReason: id },
          ],
        }),
      },
    }),
  );
  const json = JSON.stringify(snap);
  for (const planted of [text, id, url]) assert.ok(!json.includes(planted), planted);
  assert.deepEqual(snap.events, [
    { type: 'press', t: -100, kind: 'classic' },
    { type: 'seek', t: -50, top: 10 },
  ]);
  assert.deepEqual(snap.settings, { enabled: true, lang: 'zh' });
  assert.deepEqual(snap.pressDecision, {
    schema: 1,
    idsReason: 'ids-from-fallback',
    turns: [{ index: 0, layoutReason: 'no-record' }, { index: 1 }],
  });
  // reason text, turn id, settings.note (unknown key), phase url, turns[1] id.
  assert.equal(snap.redacted, 5);
});

test('the privacy filter keeps only allowed value types and drops unknown keys', () => {
  const rec = createRecorder();
  rec.record('seek', { top: 1, layout: false, offset: null, items: 'fourteen', secretKey: 1 }, 0);
  rec.record('mystery', { top: 1 }, 0);
  rec.record('press', { type: 'seek', t: 5, kind: 'overlay' }, 0);
  const snap = rec.snapshot(meta(0));
  assert.deepEqual(snap.events, [
    { t: 0, type: 'seek', top: 1, layout: false, offset: null },
    { t: 0, type: 'press', kind: 'overlay' },
  ]);
  // items is a string outside the reason codes, secretKey is unknown, the event type is unknown,
  // and a caller's own type and t fields are not fields.
  assert.equal(snap.redacted, 5);
});

test('file names carry the bug number and local time; the path carries the round', () => {
  // new Date(y, m, d, h, min, s) is local time, as the names are.
  const at = new Date(2026, 10, 8, 21, 14, 3);
  assert.equal(fileName(4, at), 'bug-04_21-14-03.json');
  assert.equal(fileName(1, new Date(2026, 0, 1, 7, 5, 9)), 'bug-01_07-05-09.json');
  assert.equal(fileName(12, new Date(2026, 0, 1, 0, 0, 0)), 'bug-12_00-00-00.json');
  assert.equal(fileName(100, at), 'bug-100_21-14-03.json');
  assert.equal(downloadPath(1, 2, at), 'butter-diag/round-1/bug-02_21-14-03.json');
  assert.equal(downloadPath(13, 4, at), 'butter-diag/round-13/bug-04_21-14-03.json');
});

test('a version or trigger outside the expected shapes is not copied into the snapshot', () => {
  const rec = createRecorder();
  const good = rec.snapshot(meta(0, { version: '0.1.0-alpha.15+dev.3', trigger: 'button' }));
  assert.equal(good.version, '0.1.0-alpha.15+dev.3');
  assert.equal(good.trigger, 'button');
  assert.equal(rec.snapshot(meta(0, { version: '0.1.0' })).version, '0.1.0');
  const bad = rec.snapshot(meta(0, { version: 'see https://x.test', trigger: 'typed text' }));
  assert.equal(bad.version, null);
  assert.equal(bad.trigger, null);
  assert.equal(bad.redacted, 2);
});

test('a serialized snapshot parses back to itself and puts each event on its own line', () => {
  const rec = createRecorder();
  rec.record('press', { kind: 'classic' }, 100);
  rec.record('seek', { top: 5, turn: 1 }, 200);
  const snap = rec.snapshot(meta(1_000, { sources: { pointerHeld: () => true } }));
  const text = serialize(snap);
  assert.deepEqual(JSON.parse(text), snap);
  const lines = text.split('\n');
  assert.ok(lines.includes('    {"t":-900,"type":"press","kind":"classic"},'), text);
  assert.ok(lines.includes('    {"t":-800,"type":"seek","top":5,"turn":1}'), text);
  assert.ok(lines.includes('  "kind": "butter-diag",'), text);
  assert.deepEqual(JSON.parse(serialize(rec.snapshot(meta(99_000)))).events, []);
});
