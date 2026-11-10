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

test("clean keeps the question's hashed id and the first line's length when present", () => {
  const full = mark({ ask: h('9'), line: 12 });
  assert.deepEqual(B.clean({ ...full, html: '<p>' }), full);
  for (const bad of [
    { ask: 'raw-question-id' },
    { ask: null },
    { line: 0 },
    { line: 241 },
    { line: 2.5 },
    { line: '12' },
  ])
    assert.equal(B.clean(mark(bad)), null, JSON.stringify(bad));
  // Records from before these fields keep working without them.
  assert.deepEqual(Object.keys(B.clean(mark())).includes('ask'), false);
  assert.deepEqual(Object.keys(B.clean(mark())).includes('line'), false);
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

test("the rail's dot is 4 px while ticks are 6 px apart or more, else the pitch minus 2, never under 2", () => {
  assert.equal(B.dotSize(14), 4);
  assert.equal(B.dotSize(6), 4);
  assert.equal(B.dotSize(5), 3);
  assert.equal(B.dotSize(4.5), 2.5);
  assert.equal(B.dotSize(4), 2);
  assert.equal(B.dotSize(3), 2);
  // Dots on neighbouring rows never touch while there is room for the 2 px floor.
  for (let pitch = 4; pitch <= 14; pitch += 0.5)
    assert.ok(B.dotSize(pitch) < pitch, `pitch ${pitch}`);
});

test("the dot's right edge stays 4 px left of its tick at 12, 21 and 31 px", () => {
  // `dotRight(scale)`: px from the tick's right end to the dot's right edge. A tick is 12 px at
  // scale 1 (rest), 21 px at 1.75 (the question being read), 31.2 px at 2.6 (under the pointer).
  for (const [scale, tick] of [
    [1, 12],
    [1.75, 21],
    [2.6, 31.2],
  ])
    assert.ok(Math.abs(B.dotRight(scale) - (tick + 4)) < 1e-9, `scale ${scale}`);
});

test('excerpt collapses runs of whitespace as the page renders them', () => {
  const text = '  first item\n\n  second\titem  ';
  assert.equal(B.excerpt(text, [text.length]), 'first item second item');
});

// Earlier history (#51 addendum): after a reload a long chat lists only its latest questions.
test('while earlier history is not loaded, a bookmark whose message is not listed sits on the earlier dots', () => {
  // The latest two of five questions are loaded: listed question 0 is the chat's fourth.
  const items = [
    { msg: h('6'), q: true },
    { msg: h('7'), q: false },
    { msg: h('8'), q: true },
    { msg: h('9'), q: false },
  ];
  // Made on the first and second questions when all five were loaded, stored out of order.
  const second = mark({ msg: h('2'), turn: 1, excerpt: 'second question' });
  const firstLater = mark({ msg: h('1'), turn: 0, para: 3, excerpt: 'first question, para 3' });
  const firstEarly = mark({ msg: h('1'), turn: 0, para: 1, excerpt: 'first question, para 1' });
  const loaded = mark({ msg: h('9'), turn: 4, excerpt: 'latest question' });
  const groups = B.group([second, loaded, firstLater, firstEarly], items, { complete: false });
  assert.deepEqual(
    groups.map((g) => [g.question, g.bookmarks.map((b) => b.excerpt)]),
    [
      // Not under listed question 0 or 1 (where the stored turn would clamp them): on the dots,
      // index -1, oldest first.
      [-1, ['first question, para 1', 'first question, para 3', 'second question']],
      [1, ['latest question']],
    ],
  );
});

test('a bookmark on an answer rendered now stays under a question, even while history is incomplete', () => {
  const items = [
    { msg: h('6'), q: true },
    { msg: h('7'), q: false },
  ];
  // Another version of the listed answer is on screen (the version arrows): not earlier history.
  const shown = mark({ msg: h('5'), turn: 3, excerpt: 'shown version' });
  assert.deepEqual(
    B.group([shown], items, { complete: false, shown: (msg) => msg === h('5') }).map(
      (g) => g.question,
    ),
    [0],
  );
});

test('once the conversation is complete, an unlisted bookmark is back under its stored question', () => {
  const items = [
    { msg: h('0'), q: true },
    { msg: h('1'), q: false },
    { msg: h('2'), q: true },
  ];
  const gone = mark({ msg: h('9'), turn: 1, excerpt: 'regenerated away' });
  assert.deepEqual(
    B.group([gone], items, { complete: true }).map((g) => g.question),
    [1],
  );
});

test('an earlier bookmark is never stale while its history is unloaded', () => {
  const items = [
    { msg: h('6'), q: true },
    { msg: h('7'), q: false },
  ];
  const earlier = mark({
    msg: h('1'),
    turn: 0,
    excerpt: 'Postgres skips an index when it expects',
  });
  earlier.key = B.key(earlier);
  // Seen stale earlier in this tab (its message had left a complete list): unloaded now, it is live.
  const last = new Map([[earlier.key, true]]);
  const view = { complete: false, paragraphs: () => undefined, mounted: () => true };
  const [g] = B.resolve([earlier], items, view, last);
  assert.equal(g.question, -1);
  assert.equal(g.bookmarks[0].stale, false);
  assert.equal(g.stale, false);
});

test("firstLine is the length of the excerpt's first rendered line, in characters", () => {
  const text = 'line one, line two, line three and line four';
  // The excerpt is "line one, line two, line three": its first line, "line one,", ends at offset 10.
  assert.equal(B.firstLine(text, [10, 20, 31, text.length]), 9);
  // One line (or nothing measured): the whole excerpt.
  assert.equal(B.firstLine('  first item  ', []), 'first item'.length);
  // Never longer than the excerpt, which stops at 240 characters.
  const long = 'a'.repeat(300);
  assert.equal(B.firstLine(long, [long.length]), 240);
  // Code points: an emoji counts once, and whitespace runs collapse as in the excerpt.
  assert.equal(B.firstLine('🧈 is  butter\nnext line', [13]), '🧈 is butter'.length - 1);
});
