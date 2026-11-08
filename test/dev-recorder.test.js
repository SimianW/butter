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

test('turns and usage are groups: each part is read alone and fails alone', () => {
  const rec = createRecorder();
  const snap = rec.snapshot(
    meta(1_000, {
      sources: {
        turns: {
          order: () => ({ count: 2, fiberFound: true }),
          readiness: () => {
            throw new Error('cache gone');
          },
          active: () => ({ turnIndex: 1, selection: 'last-seek-update' }),
          math: () => [{ index: 0, formulas: 3, withoutKatex: 1 }],
        },
        usage: {
          saved: () => ({ conversations: 4, bytes: 1200 }),
          store: () => {
            throw new TypeError('x');
          },
          cache: () => ({ records: 7 }),
        },
      },
    }),
  );
  assert.deepEqual(snap.turns, {
    order: { count: 2, fiberFound: true },
    readiness: { unavailable: 'error' },
    active: { turnIndex: 1, selection: 'last-seek-update' },
    math: [{ index: 0, formulas: 3, withoutKatex: 1 }],
  });
  assert.deepEqual(snap.usage, {
    saved: { conversations: 4, bytes: 1200 },
    store: { unavailable: 'error' },
    cache: { records: 7 },
  });
  assert.equal(snap.redacted, 0);
});

test('text, IDs and URLs planted in turns and usage are dropped and counted', () => {
  const rec = createRecorder();
  const text = 'Prove that the sum of two odd numbers is even',
    tex = '\\int_0^1 x^2 \\, dx',
    id = '6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12',
    url = 'https://chatgpt.com/c/6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12';
  const snap = rec.snapshot(
    meta(1_000, {
      sources: {
        turns: {
          readiness: () => ({ turns: [{ index: 0, layoutReason: id, hasRecord: true }] }),
          active: () => ({
            selection: url,
            memory: { items: [{ index: 0, kind: 'paragraph', text, textLength: 45 }] },
            dom: { turn: [{ index: 0, tag: 'div', classes: ['markdown', tex] }] },
          }),
          math: () => [{ index: 0, formulas: 1, source: tex }],
        },
        usage: { saved: () => ({ bytes: 10, account: id }), cache: () => ({ records: url }) },
      },
    }),
  );
  const json = JSON.stringify(snap);
  for (const planted of [text, tex, id, url, 'chatgpt.com'])
    assert.ok(!json.includes(planted), planted);
  assert.deepEqual(snap.turns.readiness, { turns: [{ index: 0, hasRecord: true }] });
  assert.deepEqual(snap.turns.active.memory.items, [
    { index: 0, kind: 'paragraph', textLength: 45 },
  ]);
  assert.deepEqual(snap.turns.active.dom.turn, [{ index: 0, tag: 'div', classes: ['markdown'] }]);
  // layoutReason id, selection url, item text, class tex, math source, account, records url.
  assert.equal(snap.redacted, 7);
});

test('the whole file stays under its cap: oldest events go first, then the largest part', () => {
  const rows = (n) => Array.from({ length: n }, (_, index) => ({ index, height: 26, top: index }));
  const rec = createRecorder({ maxFileBytes: 20_000 });
  for (let i = 0; i < 400; i++) rec.record('seek', { top: i, turn: 3, offset: 120 }, 1_000 + i);
  // Small enough with fewer events: only old events are dropped.
  let snap = rec.snapshot(meta(2_000, { sources: { turns: { order: () => ({ count: 3 }) } } }));
  let text = serialize(snap);
  assert.ok(text.length <= 20_000, `${text.length} bytes`);
  assert.ok(snap.eventsDropped > 0 && snap.events.length > 0);
  assert.equal(snap.events.at(-1).top, 399);
  assert.equal(snap.events.length + snap.eventsDropped, 400);
  assert.deepEqual(snap.turns.order, { count: 3 });
  // A source part larger than the cap on its own: all events go, then that part.
  snap = rec.snapshot(
    meta(2_000, {
      sources: {
        turns: { order: () => ({ count: 3 }), active: () => ({ dom: { turn: rows(2_000) } }) },
      },
    }),
  );
  text = serialize(snap);
  assert.ok(text.length <= 20_000, `${text.length} bytes`);
  assert.deepEqual(snap.turns.active, { unavailable: 'too-large' });
  assert.deepEqual(snap.turns.order, { count: 3 });
  assert.ok(snap.events.length > 0, 'events come back once the large part is gone');
});

test('a snapshot under the file cap has no eventsDropped field', () => {
  const rec = createRecorder();
  rec.record('seek', { top: 1 }, 0);
  assert.equal('eventsDropped' in rec.snapshot(meta(0)), false);
});

test('serialized turns put each readiness row and structure node on its own line', () => {
  const rec = createRecorder();
  const snap = rec.snapshot(
    meta(0, {
      sources: {
        turns: {
          readiness: () => ({
            currentSw: 900,
            turns: [
              { index: 0, hasRecord: true, recorder: { observed: true } },
              { index: 1, hasRecord: false, recorder: null },
            ],
          }),
          active: () => ({ dom: { mounted: true, turn: [{ index: 0, tag: 'div', classes: [] }] } }),
        },
      },
    }),
  );
  const text = serialize(snap);
  assert.deepEqual(JSON.parse(text), snap);
  const lines = text.split('\n');
  assert.ok(
    lines.includes('        {"index":0,"hasRecord":true,"recorder":{"observed":true}},'),
    text,
  );
  assert.ok(lines.includes('        {"index":1,"hasRecord":false,"recorder":null}'), text);
  assert.ok(lines.includes('          {"index":0,"tag":"div","classes":[]}'), text);
  assert.ok(lines.includes('      "currentSw": 900,'), text);
});
