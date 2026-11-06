const test = require('node:test'),
  assert = require('node:assert/strict');
const core = require(process.env.SEEK_CORE_SOURCE || '../extension/seek/core-main.js');

test('a recorded tall block retains a text fallback throughout its geometry', () => {
  // The recorder caps lean text at 4000 characters, while preserving the full block height.
  // At this offset the real paragraph exists but the lean text has already scrolled above the clip.
  const turns = [
    {
      id: 'q5',
      index: 0,
      top: 72522.953125,
      h: 23582,
      layout: true,
      q: 'question',
      answer: 'known source '.repeat(4500),
      items: [{ top: 138, h: 23400, text: 'x'.repeat(4000) }],
    },
  ];
  const flat = core.flatten(turns),
    rows = core.windowAt(flat, 77547, 848).map((i) => flat[i]);
  assert.ok(
    rows.some((f) => f.estimate && f.turn === 0),
    'A layout record is not proof of visible text: retain a row-height fallback',
  );
});

test('window lookup retains a long block overlapping later short blocks', () => {
  const turns = [
    {
      id: 'a',
      index: 0,
      top: 0,
      h: 10000,
      layout: true,
      items: [
        { top: 0, h: 10000, text: 'long' },
        ...Array.from({ length: 20 }, (_, i) => ({ top: 100 + i * 100, h: 20, text: 'short' })),
      ],
    },
  ];
  const flat = core.flatten(turns),
    visible = core.windowAt(flat, 8000, 500).map((i) => flat[i]);
  assert.ok(
    visible.some((f) => f.index === 0 && !f.estimate),
    'Binary search needs monotonic prefix bottoms when fallback spans overlap blocks',
  );
});

test('fallback uses current source text near the bottom instead of the clipped lean prefix', () => {
  const t = {
    h: 23582,
    q: 'question',
    answer: 'prefix '.repeat(1000) + 'known bottom text '.repeat(3000),
  };
  const result = core.previewExcerpt(t, 20000);
  assert.ok(result.from > 4000);
  assert.ok(result.text.includes('known bottom text'));
  assert.ok(result.text.trim());
});

test('missing, whitespace-only, question-only and shifted beyond-end source never gives empty text', () => {
  for (const t of [
    { h: 100, q: 'question', answer: '' },
    { h: 100, q: '', answer: '' },
    { h: 100, q: ' ', answer: '\n\t' },
    { h: 100, q: '', answer: 'answer' },
  ]) {
    for (const offset of [-100, 0, 99, 100, 10000])
      assert.ok(core.previewExcerpt(t, offset).text.trim());
  }
});

test('display formula height limit grows with TeX rows and ignores mixed text', () => {
  const item = (text, h) => ({ text, h, math: [{ start: 0, end: text.length, display: true }] });
  const one = item('y_{n+1}^{(4)}=1.2340', 0);
  const cases = item('\\begin{cases}a=0\\\\b=0\\\\c=0\\\\d=0\\end{cases}', 0);
  assert.equal(core.displayMathLimit(one), 184);
  assert.equal(core.displayMathLimit(cases), 376);
  assert.equal(core.displayMathLimit({ ...one, text: 'value ' + one.text }), Infinity);
  assert.equal(core.displayMathLimit({ text: 'paragraph', math: [] }), Infinity);
  // Settled sizes from the lab math chats pass; the formula box from the user video does not.
  assert.equal(core.validateSnapshot(snap([{ ...cases, h: 268 }])), null);
  assert.equal(core.validateSnapshot(snap([{ ...one, h: 65 }])), null);
  assert.equal(core.validateSnapshot(snap([{ ...one, h: 1400 }])), 'math-height');
  function snap(items) {
    return {
      complete: true,
      mathReady: true,
      h: 500,
      blocks: [500],
      items: items.map((it) => ({ top: 0, ...it })),
    };
  }
});

test('a snapshot taken while ChatGPT reveals the answer is never authoritative', () => {
  const settled = {
    conv: 'c',
    complete: true,
    mathReady: true,
    h: 1500,
    blocks: [52, 1250],
    items: [
      { top: 120, h: 52, text: 'The first lines of the answer.', math: [] },
      { top: 190, h: 1250, text: 'The rest of the answer.', math: [] },
    ],
  };
  const partial = { ...settled, revealing: true, blocks: [52], items: settled.items.slice(0, 1) };
  assert.equal(core.validateSnapshot(partial), 'revealing');
  assert.equal(core.mergeRecord(null, partial, 1).entry, null);
  // The settled snapshot of the same answer is accepted and replaces the rejected state.
  assert.equal(core.validateSnapshot({ ...settled, revealing: false }), null);
  const { entry, reason } = core.mergeRecord(core.mergeRecord(null, partial, 1).entry, settled, 2);
  assert.equal(reason, null);
  assert.equal(entry.items.length, 2);
  // A revealing snapshot never replaces a settled record.
  const kept = core.mergeRecord(entry, partial, 3);
  assert.equal(kept.reason, 'revealing');
  assert.equal(kept.entry, entry);
});

test('an inflated display span in a mixed prose block cannot bypass the math height guard', () => {
  const text = 'Paragraph before x=1 and after the formula';
  const math = { start: 17, end: 20, display: true, h: 2169.484375 };
  const snapshot = {
    complete: true,
    mathReady: true,
    h: 2663.484375,
    blocks: [2195.484375],
    items: [{ top: 424, h: 2195.484375, text, math: [math] }],
  };
  assert.equal(core.validateSnapshot(snapshot), 'math-height');
  math.h = 38.484375;
  assert.equal(core.validateSnapshot(snapshot), null, 'tall mixed prose with normal math is valid');
});

test('a snapshot holding a never-rendered placeholder block is not authoritative', () => {
  const ok = {
    conv: 'c',
    complete: true,
    mathReady: true,
    h: 500,
    blocks: [33],
    items: [{ top: 0, h: 65 }],
  };
  assert.equal(core.validateSnapshot({ ...ok, placeholder: true }), 'placeholder');
  assert.equal(core.validateSnapshot(ok), null);
  const settled = core.mergeRecord(null, ok, 1).entry;
  const r = core.mergeRecord(settled, { ...ok, placeholder: true, blocks: [120] }, 2);
  assert.equal(r.reason, 'placeholder');
  assert.equal(r.entry, settled);
});
