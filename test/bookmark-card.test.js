const test = require('node:test'),
  assert = require('node:assert/strict');
const B = require('../extension/bookmarks/model.js');

const h = (c) => c.repeat(64);
const mark = (para, excerpt, o = {}) => ({
  account: h('a'),
  conv: h('c'),
  msg: h('1'),
  turn: 6,
  para,
  start: 0,
  end: 40,
  excerpt,
  time: 1000,
  ...o,
});

test('one bookmark: "Bookmark · question n of t" and its excerpt', () => {
  const only = mark(2, 'Postgres skips an index when it expects a large share of rows to match');
  const c = B.card([only], { n: 7, total: 12 });
  assert.equal(c.single, true);
  assert.equal(c.meta, 'Bookmark · question 7 of 12');
  assert.deepEqual(c.rows, [only]);
  assert.equal(
    c.label,
    'Bookmark: Postgres skips an index when it expects a large share of rows to match',
  );
});

// Six bookmarks under question 7, stored in creation order; the card lists them in answer order.
const six = [
  mark(4, 'If estimated rows are far from actual rows, run ANALYZE orders', { time: 1 }),
  mark(0, 'Most of the time it is not ignoring it', { time: 2 }),
  mark(2, 'Postgres skips an index when it expects a large share', { time: 3 }),
  mark(2, 'roughly more than 5-10% of the table', { time: 4, start: 60, end: 96 }),
  mark(1, 'A partial index on the rare statuses stays small', { msg: h('2'), time: 5 }),
  mark(3, 'Compare the planner estimate with reality', { time: 6 }),
];
const items = [
  { msg: h('9'), q: true },
  { msg: h('1'), q: false },
  { msg: h('2'), q: false },
];

test('several bookmarks: "Question n of t · k bookmarks", rows in answer order', () => {
  const [g] = B.group(six, items);
  const c = B.card(g.bookmarks, { n: 7, total: 12 });
  assert.equal(c.single, false);
  assert.equal(c.meta, 'Question 7 of 12 · 6 bookmarks');
  assert.deepEqual(
    c.rows.map((b) => b.excerpt),
    [
      'Most of the time it is not ignoring it',
      'Postgres skips an index when it expects a large share',
      'roughly more than 5-10% of the table',
      'Compare the planner estimate with reality',
      'If estimated rows are far from actual rows, run ANALYZE orders',
      'A partial index on the rare statuses stays small',
    ],
  );
  assert.equal(
    c.label,
    '6 bookmarks: Most of the time it is not ignoring it; Postgres skips an index when it expects a large share; ' +
      'roughly more than 5-10% of the table; Compare the planner estimate with reality; ' +
      'If estimated rows are far from actual rows, run ANALYZE orders; A partial index on the rare statuses stays small',
  );
});

test('the list shows five rows and scrolls for the rest; every row stays listed', () => {
  for (const [k, visible] of [
    [2, 2],
    [5, 5],
    [6, 5],
  ]) {
    const c = B.card(six.slice(0, k), { n: 1, total: 1 });
    assert.equal(c.rows.length, k);
    assert.equal(c.visible, visible);
  }
});

test('while earlier questions are not loaded, the meta line counts back from the latest', () => {
  assert.equal(B.card(six.slice(0, 1), { back: 1 }).meta, 'Bookmark · latest question');
  assert.equal(B.card(six.slice(0, 2), { back: 3 }).meta, '3 questions back · 2 bookmarks');
});

test('Chinese meta lines and names', () => {
  const one = B.card(six.slice(0, 1), { n: 3, total: 12 }, true);
  assert.equal(one.meta, '书签 · 第 3 / 12 个问题');
  assert.equal(one.label, '书签：If estimated rows are far from actual rows, run ANALYZE orders');
  const two = B.card(six.slice(0, 2), { n: 7, total: 12 }, true);
  assert.equal(two.meta, '第 7 / 12 个问题 · 2 个书签');
  assert.equal(B.card(six.slice(0, 2), { back: 2 }, true).meta, '最近第 2 个问题 · 2 个书签');
  assert.equal(B.card(six.slice(0, 1), { back: 2 }, true).meta, '书签 · 最近第 2 个问题');
});

// Earlier history (#51 addendum): bookmarks whose question isn't loaded yet, on the dots.
test('one earlier bookmark: "Bookmark · earlier question", its excerpt and a footer on what a click does', () => {
  const c = B.card(six.slice(0, 1), { earlier: true });
  assert.equal(c.single, true);
  assert.equal(c.meta, 'Bookmark · earlier question');
  assert.equal(c.warn, "This question isn't loaded yet. Clicking loads earlier messages first.");
  assert.equal(c.stale, false);
  assert.equal(c.wait, 'Loading earlier questions…');
  assert.equal(
    c.label,
    'Bookmark · earlier question: If estimated rows are far from actual rows, run ANALYZE orders',
  );
});

test('several earlier bookmarks: "Earlier questions · k bookmarks", no footer', () => {
  const c = B.card(six.slice(0, 4), { earlier: true });
  assert.equal(c.single, false);
  assert.equal(c.meta, 'Earlier questions · 4 bookmarks');
  assert.equal(c.warn, null);
  assert.equal(c.visible, 4);
  assert.ok(c.label.startsWith('Earlier questions · 4 bookmarks: If estimated rows'));
});

test('earlier bookmarks in Chinese', () => {
  const one = B.card(six.slice(0, 1), { earlier: true }, true);
  assert.equal(one.meta, '书签 · 更早的问题');
  assert.equal(one.warn, '这个问题还没加载。点击会先加载更早的消息。');
  assert.equal(one.wait, '正在加载更早的问题…');
  assert.equal(
    one.label,
    '书签 · 更早的问题：If estimated rows are far from actual rows, run ANALYZE orders',
  );
  const two = B.card(six.slice(0, 2), { earlier: true }, true);
  assert.equal(two.meta, '更早的问题 · 2 个书签');
  assert.ok(two.label.startsWith('更早的问题 · 2 个书签：'));
});

// The hover button's accessible name (#53) holds the start of what it would bookmark; its visible
// tooltip stays "Bookmark" / "Bookmark selection" (bookmarks/content.js).
test("the add button's name holds the start of the paragraph or the selection", () => {
  const para =
    'Postgres skips an index when it expects a large share of rows to match, because reading the table in order is cheaper.';
  assert.equal(
    B.addLabel(para),
    'Bookmark: Postgres skips an index when it expects a large share of rows to match, because…',
  );
  assert.equal(B.addLabel('  A short\n  paragraph. '), 'Bookmark: A short paragraph.');
  assert.equal(B.addLabel('the selected words', true), 'Bookmark selection: the selected words');
  assert.equal(B.addLabel('一段中文', false, true), '加书签：一段中文');
  assert.equal(B.addLabel('选中的字', true, true), '为选中内容加书签：选中的字');
  // Nothing readable: the action alone.
  assert.equal(B.addLabel(' '), 'Bookmark');
  // Characters are code points: an emoji at the cut is kept whole.
  assert.equal(B.addLabel('x'.repeat(79) + '🧈yz'), `Bookmark: ${'x'.repeat(79)}🧈…`);
});

// The tick's card when its question holds bookmarks (#70): the question card's text, then its
// bookmarks. The card is a group named by the meta line the segment's card shows; the tick keeps
// its own name and appends the bookmarks'.
const Q7 = 'Why does Postgres ignore my index on orders.status?';

test('a tick whose question holds several bookmarks: the question, then its rows in answer order', () => {
  const [g] = B.group(six, items);
  const c = B.questionCard(Q7, g.bookmarks, { n: 7, total: 12 });
  assert.equal(c.text, Q7);
  assert.equal(c.single, false);
  assert.deepEqual(
    c.rows.map((b) => b.excerpt),
    [
      'Most of the time it is not ignoring it',
      'Postgres skips an index when it expects a large share',
      'roughly more than 5-10% of the table',
      'Compare the planner estimate with reality',
      'If estimated rows are far from actual rows, run ANALYZE orders',
      'A partial index on the rare statuses stays small',
    ],
  );
  assert.equal(c.visible, 5);
  assert.equal(c.warn, null);
  assert.equal(c.group, 'Question 7 of 12 · 6 bookmarks');
});

test('one bookmark under the question: a single row, no footer, the card named "Bookmark · question n of t"', () => {
  const only = mark(2, 'Run VACUUM ANALYZE after a bulk load');
  const c = B.questionCard('How do I bulk-load 2M rows quickly?', [only], { n: 3, total: 12 });
  assert.equal(c.single, true);
  assert.deepEqual(c.rows, [only]);
  assert.equal(c.stale, false);
  assert.equal(c.warn, null);
  assert.equal(c.group, 'Bookmark · question 3 of 12');
});

test("one stale bookmark: the card ends with the footer about the paragraph that can't be found", () => {
  const gone = mark(2, 'Use a partial index when only a few statuses are queried often', {
    stale: true,
  });
  const c = B.questionCard('Should I add a partial index?', [gone], { n: 10, total: 12 });
  assert.equal(c.single, true);
  assert.equal(c.stale, true);
  assert.equal(
    c.warn,
    "This paragraph can't be found any more. Clicking opens question 10 instead.",
  );
  assert.equal(c.group, 'Bookmark · answer changed');
  // While earlier questions aren't loaded, the footer names no number.
  assert.equal(
    B.questionCard('Should I add a partial index?', [gone], { back: 3 }).warn,
    "This paragraph can't be found any more. Clicking opens its question instead.",
  );
});

test('several with a stale one: the stale row keeps its place and the card has no footer', () => {
  const rows = [mark(0, 'live one'), mark(3, 'changed one', { stale: true }), mark(5, 'live two')];
  const c = B.questionCard(Q7, rows, { n: 7, total: 12 });
  assert.deepEqual(
    c.rows.map((b) => [b.excerpt, !!b.stale]),
    [
      ['live one', false],
      ['changed one', true],
      ['live two', false],
    ],
  );
  assert.equal(c.tag, 'answer changed');
  assert.equal(c.warn, null);
  assert.equal(c.group, 'Question 7 of 12 · 3 bookmarks');
});

test("the question's text is cut at 400 characters, as the question card cuts it", () => {
  const long = 'x'.repeat(398) + 'yzw';
  assert.equal(
    B.questionCard(long, six.slice(0, 2), { n: 1, total: 2 }).text,
    'x'.repeat(398) + 'yz…',
  );
  assert.equal(
    B.questionCard('x'.repeat(400), six.slice(0, 2), { n: 1, total: 2 }).text,
    'x'.repeat(400),
  );
});

test("a tick's name: the question's first 120 characters, then its bookmarks' count and text", () => {
  assert.equal(B.tickLabel(Q7), Q7);
  assert.equal(B.tickLabel('q'.repeat(130), []), 'q'.repeat(120));
  assert.equal(
    B.tickLabel(Q7, [mark(0, 'live one'), mark(3, 'changed one', { stale: true })]),
    `${Q7} · 2 bookmarks: live one; changed one (answer changed)`,
  );
  assert.equal(B.tickLabel(Q7, [mark(0, 'live one')]), `${Q7} · Bookmark: live one`);
});

test('Chinese: the merged card and the tick name', () => {
  const rows = [mark(0, '第一段'), mark(3, '第二段', { stale: true })];
  const c = B.questionCard('为什么索引没用上？', rows, { n: 7, total: 12 }, true);
  assert.equal(c.group, '第 7 / 12 个问题 · 2 个书签');
  assert.equal(c.tag, '回答已变化');
  const one = B.questionCard('为什么索引没用上？', [rows[1]], { n: 10, total: 12 }, true);
  assert.equal(one.group, '书签 · 回答已变化');
  assert.equal(one.warn, '找不到这一段了。点击会跳到第 10 个问题的开头。');
  assert.equal(
    B.questionCard('为什么索引没用上？', [rows[0]], { back: 2 }, true).group,
    '书签 · 最近第 2 个问题',
  );
  assert.equal(
    B.tickLabel('为什么索引没用上？', rows, true),
    '为什么索引没用上？ · 2 个书签：第一段；第二段（回答已变化）',
  );
});
