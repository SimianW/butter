const test = require('node:test'),
  assert = require('node:assert/strict');
const B = require('../extension/bookmarks/model.js');

// An answer's paragraphs as rendered text, in order.
const PARAS = [
  'Postgres skips an index when it expects a large share of rows to match.',
  'A sequential scan reads pages in order, which is cheaper than jumping around the heap.',
  'Run ANALYZE after a bulk load.',
];

// `last` is where the selection ends, for measuring its rendered lines.
test('a selection inside one paragraph is anchored to its range, and its text is the selection', () => {
  // "large share of rows" in the first paragraph.
  assert.deepEqual(B.anchor(PARAS, { para: 0, offset: 42 }, { para: 0, offset: 61 }), {
    para: 0,
    start: 42,
    end: 61,
    text: 'large share of rows',
    last: { para: 0, offset: 61 },
  });
});

test('a selection across paragraphs is anchored to its first paragraph, from the start to its end', () => {
  // From "large share" in the first paragraph to "A sequential scan" in the second.
  assert.deepEqual(B.anchor(PARAS, { para: 0, offset: 42 }, { para: 1, offset: 17 }), {
    para: 0,
    start: 42,
    end: 71,
    text: 'large share of rows to match.\nA sequential scan',
    last: { para: 1, offset: 17 },
  });
});

test('whitespace around a selection is left out, so the same words are the same bookmark', () => {
  // A double-click selection of "large " and a drag over " large share" both start at "large".
  assert.deepEqual(B.anchor(PARAS, { para: 0, offset: 41 }, { para: 0, offset: 48 }), {
    para: 0,
    start: 42,
    end: 47,
    text: 'large',
    last: { para: 0, offset: 47 },
  });
  // Starting on the end of the first paragraph, the anchor moves to the next one's text.
  assert.deepEqual(B.anchor(PARAS, { para: 0, offset: 71 }, { para: 1, offset: 12 }), {
    para: 1,
    start: 0,
    end: 12,
    text: 'A sequential',
    last: { para: 1, offset: 12 },
  });
});

test('a selection of only whitespace anchors nothing', () => {
  assert.equal(B.anchor(PARAS, { para: 0, offset: 8 }, { para: 0, offset: 9 }), null);
  assert.equal(B.anchor(PARAS, { para: 0, offset: 20 }, { para: 0, offset: 20 }), null);
});

test('CJK: offsets count UTF-16 units, and a boundary inside an emoji takes the whole emoji', () => {
  const zh = ['数据库在预计匹配大量行时🧈会跳过索引。', '顺序扫描按顺序读取页面。'];
  // "大量行时" sits at 8..12.
  assert.deepEqual(B.anchor(zh, { para: 0, offset: 8 }, { para: 0, offset: 12 }), {
    para: 0,
    start: 8,
    end: 12,
    text: '大量行时',
    last: { para: 0, offset: 12 },
  });
  // 🧈 is two UTF-16 units at 12..14: a start or an end between them keeps it whole.
  assert.deepEqual(B.anchor(zh, { para: 0, offset: 13 }, { para: 0, offset: 17 }), {
    para: 0,
    start: 12,
    end: 17,
    text: '🧈会跳过',
    last: { para: 0, offset: 17 },
  });
  assert.deepEqual(B.anchor(zh, { para: 0, offset: 10 }, { para: 0, offset: 13 }), {
    para: 0,
    start: 10,
    end: 14,
    text: '行时🧈',
    last: { para: 0, offset: 14 },
  });
});

test('CJK: a selection across paragraphs gives an excerpt by the three-line rule', () => {
  const zh = ['第一段的最后一句。', '第二段全文。', '第三段全文。', '第四段不该出现。'];
  const a = B.anchor(zh, { para: 0, offset: 4 }, { para: 3, offset: 3 });
  assert.deepEqual([a.para, a.start, a.end], [0, 4, 9]);
  // Each paragraph renders on its own line here: the lines end where the next paragraph starts.
  const ends = [...a.text.matchAll(/\n/g)].map((m) => m.index + 1);
  assert.equal(B.excerpt(a.text, ends), '最后一句。 第二段全文。 第三段全文。');
});

test('with nothing selected: the first answer paragraph whose top is at or below the header', () => {
  // Tops of the answers' paragraphs in document order, in viewport px; the header ends at 52.
  const tops = [-400, -120, 30, 52, 90, 700];
  assert.equal(B.topParagraph(tops, 52), 3); // 30 is under the header; 52 is exactly at its edge
  assert.equal(B.topParagraph([-400, 51.5, 60], 52), 2);
  // A paragraph cut by the header doesn't count, even when it is the only one partly in view.
  assert.equal(B.topParagraph([-900, -10], 52), -1);
  assert.equal(B.topParagraph([], 52), -1);
});

test('the tooltip shows the key Chrome reports for the command, and nothing when it has none', () => {
  assert.equal(B.keyHint('Alt+Shift+M'), 'Alt Shift M'); // Windows and Linux, as the mockup writes keys
  assert.equal(B.keyHint('⌥⇧M'), '⌥⇧M'); // macOS reports symbols
  assert.equal(B.keyHint('Ctrl+Shift+Comma'), 'Ctrl Shift Comma');
  assert.equal(B.keyHint(''), '');
  assert.equal(B.keyHint(undefined), '');
});
