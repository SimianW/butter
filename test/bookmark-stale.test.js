// Stale bookmarks (#55): resolution to live or stale, the all-stale segment and the stale card.
const test = require('node:test'),
  assert = require('node:assert/strict');
const B = require('../extension/bookmarks/model.js');

const h = (c) => c.repeat(64);
const Q1 = h('a'),
  A1 = h('1'),
  Q2 = h('b'),
  A2 = h('2'),
  A2NEW = h('3');
const PARA =
  'Postgres skips an index when it expects a large share of rows to match, because reading the table in order is cheaper.';
const OTHER = 'A partial index on the rare statuses stays small, and the planner trusts it.';
const mark = (o = {}) => ({
  account: h('e'),
  conv: h('c'),
  msg: A2,
  turn: 1,
  para: 1,
  start: 0,
  end: PARA.length,
  excerpt: PARA.slice(0, 90),
  time: 1,
  key: `k${o.para ?? 1}-${o.start ?? 0}-${o.msg ?? A2}`,
  ...o,
});
// The conversation as the backend listed it: two questions, each with its answer.
const items = [
  { msg: Q1, q: true },
  { msg: A1, q: false },
  { msg: Q2, q: true },
  { msg: A2, q: false },
];
// What the page shows: the paragraphs of each rendered answer (by hashed id), and which questions'
// turns are mounted.
const view = (answers, mounted = [0, 1], complete = true) => ({
  complete,
  paragraphs: (msg) => answers[msg],
  mounted: (question) => mounted.includes(question),
});
const flags = (groups) =>
  groups.map((g) => ({
    question: g.question,
    stale: g.stale,
    rows: g.bookmarks.map((b) => b.stale),
  }));

test("live: the message, the paragraph and the excerpt's first line all still match", () => {
  const [g] = B.resolve([mark()], items, view({ [A2]: ['Intro', PARA, OTHER] }));
  assert.deepEqual(flags([g]), [{ question: 1, stale: false, rows: [false] }]);
});

test('regenerated answer: its question is shown with another version, so the bookmark is stale', () => {
  // The backend list still holds the old answer; the page now renders a new message in its turn.
  const groups = B.resolve([mark()], items, view({ [A2NEW]: ['Intro', 'A different answer.'] }));
  assert.deepEqual(flags(groups), [{ question: 1, stale: true, rows: [true] }]);
});

test('regenerated answer after a reload: the old message left the conversation; stale under its question', () => {
  const now = [items[0], items[1], items[2], { msg: A2NEW, q: false }];
  const groups = B.resolve([mark()], now, view({ [A2NEW]: ['Intro', 'A different answer.'] }));
  assert.deepEqual(flags(groups), [{ question: 1, stale: true, rows: [true] }]);
});

test('edited answer: same message, but the paragraph text changed or the paragraph is gone', () => {
  const edited = B.resolve(
    [mark()],
    items,
    view({ [A2]: ['Intro', 'Postgres uses the index.', OTHER] }),
  );
  assert.deepEqual(flags(edited), [{ question: 1, stale: true, rows: [true] }]);
  const shorter = B.resolve([mark({ para: 4 })], items, view({ [A2]: ['Intro', PARA] }));
  assert.equal(shorter[0].bookmarks[0].stale, true);
  // Moved down by a new paragraph above it: the index no longer points at it.
  const moved = B.resolve([mark()], items, view({ [A2]: ['Intro', 'New first point.', PARA] }));
  assert.equal(moved[0].bookmarks[0].stale, true);
});

test('vanished message: stale, and kept under the question it was created under', () => {
  const gone = mark({ msg: h('9'), turn: 0 });
  const groups = B.resolve([gone, mark()], items, view({ [A2]: ['Intro', PARA] }));
  assert.deepEqual(flags(groups), [
    { question: 0, stale: true, rows: [true] },
    { question: 1, stale: false, rows: [false] },
  ]);
});

test('version switched back: a bookmark that resolves again is live again (nothing stored)', () => {
  const last = new Map();
  const b = mark();
  const regenerated = B.resolve([b], items, view({ [A2NEW]: ['Other'] }), last);
  assert.equal(regenerated[0].bookmarks[0].stale, true);
  assert.equal(last.get(b.key), true);
  const back = B.resolve([b], items, view({ [A2]: ['Intro', PARA] }), last);
  assert.equal(back[0].bookmarks[0].stale, false);
  assert.equal(last.get(b.key), false);
  assert.equal('stale' in b, false, 'the stored bookmark itself never carries the flag');
});

test('a question that is not mounted keeps what was last seen, live until then', () => {
  const b = mark(),
    off = view({}, [0]);
  assert.equal(B.resolve([b], items, off)[0].bookmarks[0].stale, false);
  const last = new Map([[b.key, true]]);
  assert.equal(B.resolve([b], items, off, last)[0].bookmarks[0].stale, true);
});

test('earlier messages not loaded yet: a bookmark whose message is not listed is not called stale', () => {
  const early = mark({ msg: h('8'), turn: 0 });
  const [g] = B.resolve([early], items, view({}, [], false));
  assert.equal(g.bookmarks[0].stale, false);
});

test('a selection inside the paragraph, and one that ran on into the next paragraph, stay live', () => {
  const inside = mark({ start: 32, end: 80, excerpt: PARA.slice(32, 80) });
  const across = mark({ start: 104, excerpt: `${PARA.slice(104)} ${OTHER}`.slice(0, 90) });
  const page = view({ [A2]: ['Intro', PARA, OTHER] });
  assert.deepEqual(
    B.resolve([inside, across], items, page)[0].bookmarks.map((b) => b.stale),
    [false, false],
  );
});

test('whitespace and CJK text: compared as rendered, whitespace collapsed', () => {
  const han = '书签只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。'.repeat(3);
  const b = mark({ excerpt: han.slice(0, 50), end: han.length });
  const page = view({ [A2]: ['Intro', `  ${han.slice(0, 20)}\n${han.slice(20)}`] });
  assert.equal(B.resolve([b], items, page)[0].bookmarks[0].stale, false);
});

test('the segment is pale only when every bookmark under the question is stale', () => {
  const live = mark(),
    gone = mark({ para: 2, excerpt: 'Paragraph that was removed', key: 'k-gone' });
  const some = B.resolve([live, gone], items, view({ [A2]: ['Intro', PARA, OTHER] }));
  assert.deepEqual(flags(some), [{ question: 1, stale: false, rows: [false, true] }]);
  assert.equal(B.pale(some[0].bookmarks), false);
  const all = B.resolve([live, gone], items, view({ [A2NEW]: ['x'] }));
  assert.deepEqual(flags(all), [{ question: 1, stale: true, rows: [true, true] }]);
  assert.equal(B.pale(all[0].bookmarks), true);
  assert.equal(B.pale([]), false);
});

test('one stale bookmark: grey card with "answer changed" and the fallback footer', () => {
  const b = { ...mark(), stale: true };
  const c = B.card([b], { n: 10, total: 12 });
  assert.equal(c.stale, true);
  assert.equal(c.meta, 'Bookmark · answer changed');
  assert.equal(
    c.warn,
    "This paragraph can't be found any more. Clicking opens question 10 instead.",
  );
  assert.equal(c.label, `Bookmark: ${b.excerpt} (answer changed)`);
  const zh = B.card([b], { n: 10, total: 12 }, true);
  assert.equal(zh.meta, '书签 · 回答已变化');
  assert.equal(zh.warn, '找不到这一段了。点击会跳到第 10 个问题的开头。');
  assert.equal(zh.label, `书签：${b.excerpt}（回答已变化）`);
  // Earlier questions not loaded: the position is relative, so the footer names "its question".
  assert.equal(
    B.card([b], { back: 2 }).warn,
    "This paragraph can't be found any more. Clicking opens its question instead.",
  );
  assert.equal(B.card([b], { back: 2 }, true).warn, '找不到这一段了。点击会跳到这个问题的开头。');
});

test('a live single card has no footer and keeps its meta line', () => {
  const c = B.card([{ ...mark(), stale: false }], { n: 7, total: 12 });
  assert.equal(c.stale, false);
  assert.equal(c.warn, null);
  assert.equal(c.meta, 'Bookmark · question 7 of 12');
});

test('several bookmarks: stale rows carry the "answer changed" tag, the meta line is unchanged', () => {
  const rows = [
    { ...mark(), stale: false },
    { ...mark({ para: 3, excerpt: 'If estimated rows are far from actual rows' }), stale: true },
  ];
  const c = B.card(rows, { n: 7, total: 12 });
  assert.equal(c.meta, 'Question 7 of 12 · 2 bookmarks');
  assert.equal(c.tag, 'answer changed');
  assert.equal(c.warn, null);
  assert.equal(c.stale, false);
  assert.equal(B.card(rows, { n: 7, total: 12 }, true).tag, '回答已变化');
  assert.equal(
    c.label,
    `2 bookmarks: ${rows[0].excerpt}; If estimated rows are far from actual rows (answer changed)`,
  );
});

// The question a bookmark was made under (`ask`, its hashed message id) places it when its answer
// is gone, even while earlier history isn't loaded (#55: "stays under the question it was created
// under").
test('regenerated answer while earlier history is unloaded: stale under the question it was made under', () => {
  // After a reload the list holds the latest questions only, and Q2's current answer is A2NEW.
  const now = [items[2], { msg: A2NEW, q: false }];
  const b = mark({ ask: Q2, turn: 7 });
  const rendered = view({ [A2NEW]: ['Intro', 'A different answer.'] }, [0], false);
  assert.deepEqual(flags(B.resolve([b], now, rendered)), [
    { question: 0, stale: true, rows: [true] },
  ]);
  // Its answer not rendered either (the turn is off screen): still under Q2, still stale.
  assert.deepEqual(flags(B.resolve([b], now, view({}, [], false))), [
    { question: 0, stale: true, rows: [true] },
  ]);
});

test('a bookmark whose question is not loaded yet sits on the earlier dots, live', () => {
  const now = [items[2], items[3]];
  const b = mark({ msg: A1, ask: Q1, turn: 0 });
  assert.deepEqual(flags(B.resolve([b], now, view({}, [], false))), [
    { question: B.EARLIER, stale: false, rows: [false] },
  ]);
});

test('a bookmark stored without its question keeps the turn-based placement', () => {
  const now = [items[2], { msg: A2NEW, q: false }];
  const [g] = B.resolve([mark({ turn: 1 })], now, view({}, [], false));
  assert.equal(g.question, B.EARLIER);
});

// The excerpt's first rendered line (#55), its length stored as `line` at creation.
test("staleness checks the excerpt's first rendered line, however long it is", () => {
  // Rendered as "Postgres skips an index" | "when it expects a large share…": a 23-character line.
  const short = mark({ line: 23 });
  const reworded = `${PARA.slice(0, 23)} once it estimates that most rows match.`;
  const page = (text) => view({ [A2]: ['Intro', text] });
  assert.equal(B.resolve([short], items, page(reworded))[0].bookmarks[0].stale, false);
  // A 70-character first line: a change at character 60 is a change to that line.
  const long = mark({ line: 70 });
  const changed = `${PARA.slice(0, 60)}XXXXXXXXXXXXXXXX${PARA.slice(76)}`;
  assert.equal(B.resolve([long], items, page(changed))[0].bookmarks[0].stale, true);
  assert.equal(B.resolve([long], items, page(PARA))[0].bookmarks[0].stale, false);
});

test('a record stored without its first line keeps the 40-character check', () => {
  const b = mark(),
    page = (text) => view({ [A2]: ['Intro', text] });
  assert.equal(
    B.resolve([b], items, page(`${PARA.slice(0, 40)} and then other words.`))[0].bookmarks[0].stale,
    false,
  );
  assert.equal(
    B.resolve([b], items, page(`${PARA.slice(0, 30)} and then other words.`))[0].bookmarks[0].stale,
    true,
  );
});
