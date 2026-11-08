const test = require('node:test'),
  assert = require('node:assert/strict');
const B = require('../extension/bookmarks/model.js');

test('excerpt keeps the first three rendered lines', () => {
  // A paragraph the browser wrapped into four lines; each line keeps its trailing space.
  const text = 'line one, line two, line three and line four';
  assert.equal(B.excerpt(text, [10, 20, 31, text.length]), 'line one, line two, line three');
});

test('excerpt stops at 240 characters when three lines are longer', () => {
  const long = 'a'.repeat(200) + ' ' + 'b'.repeat(200);
  assert.equal(B.excerpt(long, [long.length]), 'a'.repeat(200) + ' ' + 'b'.repeat(39));
});

test('excerpt counts CJK characters and emoji as one character each', () => {
  const han = '书签'.repeat(150); // 300 Han characters on one line
  assert.equal(B.excerpt(han, [han.length]), '书签'.repeat(120));
  // 239 characters then an emoji (two UTF-16 units) that is the 240th character: kept whole.
  const emoji = 'x'.repeat(239) + '🧈' + 'y';
  assert.equal(B.excerpt(emoji, [emoji.length]), 'x'.repeat(239) + '🧈');
});

const h = (c) => c.repeat(64);
const mark = (o = {}) => ({
  account: h('a'),
  conv: h('c'),
  msg: h('1'),
  turn: 0,
  para: 0,
  start: 0,
  end: 40,
  excerpt: 'Postgres skips an index when it expects',
  time: 1000,
  ...o,
});

test('a bookmark on the same paragraph and range is the same bookmark', () => {
  assert.equal(B.key(mark()), B.key(mark({ time: 2000, excerpt: 'other text' })));
  assert.notEqual(B.key(mark()), B.key(mark({ para: 1 })));
  assert.notEqual(B.key(mark()), B.key(mark({ start: 5 })));
  assert.notEqual(B.key(mark()), B.key(mark({ end: 41 })));
  assert.notEqual(B.key(mark()), B.key(mark({ msg: h('2') })));
  assert.notEqual(B.key(mark()), B.key(mark({ account: h('b') })));
});

test('clean keeps only the stored fields and refuses anything else', () => {
  assert.deepEqual(B.clean({ ...mark(), url: 'https://chatgpt.com/c/x', html: '<p>' }), mark());
  for (const bad of [
    { account: 'not-a-hash' },
    { conv: 'A'.repeat(64) },
    { msg: undefined },
    { para: 1.5 },
    { para: -1 },
    { turn: -1 },
    { start: 10, end: 5 },
    { excerpt: '' },
    { excerpt: 'x'.repeat(241) },
    { excerpt: 42 },
    { time: Number.NaN },
  ])
    assert.equal(B.clean(mark(bad)), null, JSON.stringify(bad));
  // 240 Han characters are within the cap, though they are 720 UTF-8 bytes.
  assert.ok(B.clean(mark({ excerpt: '书'.repeat(240) })));
});

test('group puts each bookmark under its question, in answer order', () => {
  // Conversation order, oldest first: questions and the answers that follow them.
  const items = [
    { msg: h('0'), q: true },
    { msg: h('1'), q: false },
    { msg: h('2'), q: true },
    { msg: h('3'), q: false }, // first message of the second answer
    { msg: h('4'), q: false }, // a second message in the same answer
    { msg: h('5'), q: true },
    { msg: h('6'), q: false },
  ];
  const later = mark({ msg: h('4'), para: 0, excerpt: 'later message' });
  const p3 = mark({ msg: h('3'), para: 3, excerpt: 'para three' });
  const p1b = mark({ msg: h('3'), para: 1, start: 10, end: 20, excerpt: 'para one, later range' });
  const p1a = mark({ msg: h('3'), para: 1, start: 0, end: 9, excerpt: 'para one' });
  const third = mark({ msg: h('6'), para: 0, excerpt: 'third answer' });
  const groups = B.group([later, third, p3, p1b, p1a], items);
  assert.deepEqual(
    groups.map((g) => [g.question, g.bookmarks.map((b) => b.excerpt)]),
    [
      [1, ['para one', 'para one, later range', 'para three', 'later message']],
      [2, ['third answer']],
    ],
  );
});

test('a bookmark whose message is not in the conversation stays under the question it was made on', () => {
  const items = [
    { msg: h('0'), q: true },
    { msg: h('1'), q: false },
    { msg: h('2'), q: true },
    { msg: h('3'), q: false },
  ];
  const gone = mark({ msg: h('9'), turn: 1, excerpt: 'regenerated away' });
  const here = mark({ msg: h('3'), para: 2, excerpt: 'still here' });
  const past = mark({ msg: h('8'), turn: 7, excerpt: 'question index past the end' });
  assert.deepEqual(
    B.group([gone, here, past], items).map((g) => [g.question, g.bookmarks.map((b) => b.excerpt)]),
    [[1, ['still here', 'regenerated away', 'question index past the end']]],
  );
});

test('a segment sits 5 px below its tick, or 40 % of a pitch under 12 px', () => {
  assert.equal(B.segmentOffset(14), 5);
  assert.equal(B.segmentOffset(12), 5);
  assert.equal(B.segmentOffset(10), 4);
  assert.equal(B.segmentOffset(5), 2);
  // The segment (2 px tall) never reaches the next tick (2 px tall, one pitch below). Below a
  // 3.4 px pitch two 2 px marks can't fit in one pitch at all.
  for (let pitch = 3.5; pitch <= 14; pitch += 0.5)
    assert.ok(B.segmentOffset(pitch) + 1 < pitch - 1, `pitch ${pitch}`);
});

test('excerpt collapses runs of whitespace as the page renders them', () => {
  const text = '  first item\n\n  second\titem  ';
  assert.equal(B.excerpt(text, [text.length]), 'first item second item');
});
