// The page reader's contract, checked in real Chromium against every hand-written page in
// test/fixtures/page/, whose data-expect-* attributes say what each fact must be (README.md there).
// ADAPTERS lists each implementation of the contract, one per script world, and the facts it
// implements; each is injected into every fixture. Each fact's check is written once and runs for
// every adapter that has the fact. Shared: message identity. Isolated only: answer roots with
// their questions, paragraphs, replies and loose turns. MAIN only (seek): blocks, preview items
// and markdown columns. Both adapters' answer-root rule is pinned by the marks placed from it: the
// isolated reader's answer roots, the MAIN reader's blocks and preview items (an answer root's
// children).
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = `${root}test/fixtures/page/`;
const ADAPTERS = [
  {
    name: 'isolated',
    path: 'extension/page/reader.js',
    global: 'ButterPageReader',
    facts: ['identity', 'answers', 'paragraphs', 'replies', 'looseTurns'],
  },
  {
    name: 'MAIN',
    path: 'extension/page/reader-main.js',
    global: '__butterPageReader',
    facts: ['identity', 'blocks', 'previewItems', 'columns'],
  },
];
const fixtures = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.html'))
  .sort();

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(() => browser?.close());

/* global document, NodeFilter -- read() runs in the page */
// Runs in the page: for each of the adapter's facts, what the fixture's marks expect and what the
// adapter answers, as labels (`<tag #index "text…">`) so a failure names the elements.
function read({ name, facts }) {
  const R = globalThis[name],
    has = (fact) => facts.includes(fact);
  const all = [...document.querySelectorAll('*')];
  const tag = (el) => {
    if (el == null) return null;
    if (el.nodeType !== 1) return `#node ${el.nodeName}`;
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24);
    return `<${el.localName} #${all.indexOf(el)}${text ? ` "${text}"` : ''}>`;
  };
  const marked = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const tags = (list) => [...list].map(tag);
  const answers = marked('[data-expect-answer]');
  const turns = marked('[data-turn-key]');
  const idOf = (a) => a.getAttribute('data-expect-answer');
  const ownMarks = (a) =>
    marked('[data-expect-para]', a).filter((p) => p.closest('[data-expect-answer]') === a);
  const question = (a) => a?.getAttribute('data-expect-question') ?? null;
  // The adapter's list under `scope` against the marked elements under it, for the document and
  // for each turn.
  const listed = (mark, list) =>
    [document, ...turns].map((scope) => ({
      scope: scope === document ? 'document' : tag(scope),
      expected: tags(marked(mark, scope)),
      actual: tags(list(scope)),
    }));
  const out = { nodes: { checked: 0, wrong: [] } };
  // Identity: the isolated reader's identified answers in a turn carry the turn's marked ids; seek's
  // turn message id is the id of the turn's first marked answer, or null.
  if (has('identity'))
    out.identity = turns.map((turn) => {
      const ids = marked('[data-expect-answer]', turn).map(idOf);
      return R.turnMessageId
        ? { turn: tag(turn), expected: ids[0] ?? null, actual: R.turnMessageId(turn) ?? null }
        : { turn: tag(turn), expected: ids, actual: R.answersIn(turn).map((a) => a.id) };
    });
  if (has('answers')) {
    out.answersIn = {
      expected: answers.map((a) => ({ root: tag(a), id: idOf(a) })),
      actual: R.answersIn(document).map((a) => ({ root: tag(a.root), id: a.id })),
    };
    out.questions = answers.map((a) => ({
      answer: tag(a),
      expected: question(a),
      actual: R.turnKeyOf(a),
    }));
  }
  if (has('paragraphs')) {
    out.paragraphsOf = answers.map((a) => {
      const marks = ownMarks(a);
      return {
        answer: tag(a),
        ordinals: marks.map((p) => p.getAttribute('data-expect-para')),
        expected: marks.map(tag),
        actual: R.paragraphsOf(a).map(tag),
        within: R.paragraphsIn(a).map(tag),
      };
    });
    out.paragraphsIn = {
      expected: tags(marked('[data-expect-para]')),
      actual: tags(R.paragraphsIn(document)),
    };
  }
  if (has('replies'))
    out.replies = {
      expected: tags(marked('[data-expect-reply]')),
      actual: tags(R.replies(document)),
    };
  if (has('blocks')) out.blocksIn = listed('[data-expect-block]', R.blocksIn);
  if (has('previewItems'))
    out.previewItemsIn = listed('[data-expect-preview-item]', R.previewItemsIn);
  // Markdown columns: by rule, every [data-markdown-text-style="assistant-message"] element (no
  // mark of their own).
  if (has('columns')) {
    const COLUMN = '[data-markdown-text-style="assistant-message"]';
    out.columnsIn = listed(COLUMN, R.columnsIn);
    out.firstColumn = [document, ...turns].map((scope) => ({
      scope: tag(scope),
      expected: tag(marked(COLUMN, scope)[0]),
      actual: tag(R.firstColumn(scope)),
    }));
    out.hasAnswer = turns.map((turn) => ({
      turn: tag(turn),
      expected: marked(COLUMN, turn).length > 0,
      actual: R.hasAnswer(turn),
    }));
  }
  // Every text node: what each of the adapter's per-node facts gives follows from the marks
  // around it.
  if (!['answers', 'paragraphs', 'replies', 'looseTurns'].some(has)) return out;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement,
      a = el.closest('[data-expect-answer]');
    const expected = {},
      actual = {};
    if (has('paragraphs')) {
      expected.paragraph = tag(el.closest('[data-expect-para]'));
      actual.paragraph = tag(R.paragraphOf(n));
    }
    if (has('answers')) {
      const got = R.answerOf(n);
      expected.answer = a ? { root: tag(a), id: idOf(a) } : null;
      actual.answer = got ? { root: tag(got.root), id: got.id } : null;
      if (a) {
        expected.question = question(a);
        actual.question = R.turnKeyOf(n);
      }
    }
    if (has('replies')) {
      expected.reply = tag(el.closest('[data-expect-reply]'));
      actual.reply = tag(R.replyOf(n));
    }
    if (has('looseTurns')) {
      expected.looseTurn = tag(el.closest('[data-expect-loose-turn]'));
      actual.looseTurn = tag(R.looseTurnOf(n));
    }
    out.nodes.checked++;
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      out.nodes.wrong.push({ text: JSON.stringify(n.data.trim().slice(0, 30)), expected, actual });
  }
  return out;
}

const sameLists = (rows) => {
  for (const row of rows) assert.deepEqual(row.actual, row.expected, row.scope);
};
// Each fact's checks, written once: name -> (result of read) -> assertions.
const CHECKS = {
  identity: {
    "each turn's message identity is its marked answers' ids": (r) => {
      for (const t of r.identity) assert.deepEqual(t.actual, t.expected, t.turn);
    },
  },
  answers: {
    'answersIn: exactly the marked answer roots, in order, with their ids': (r) =>
      assert.deepEqual(r.answersIn.actual, r.answersIn.expected),
    "each answer's question is its turn's key": (r) => {
      for (const q of r.questions) assert.equal(q.actual, q.expected, q.answer);
    },
  },
  paragraphs: {
    "paragraphsOf: exactly each answer's marked paragraphs, 0..k": (r) => {
      for (const p of r.paragraphsOf) {
        assert.deepEqual(
          p.ordinals,
          p.ordinals.map((_, i) => String(i)),
          `${p.answer}: fixture marks must run 0..k in document order`,
        );
        assert.deepEqual(p.actual, p.expected, p.answer);
        assert.deepEqual(p.within, p.expected, `paragraphsIn ${p.answer}`);
      }
    },
    'paragraphsIn(document): every marked paragraph, in document order': (r) =>
      assert.deepEqual(r.paragraphsIn.actual, r.paragraphsIn.expected),
  },
  replies: {
    'replies: exactly the marked replies, in order': (r) =>
      assert.deepEqual(r.replies.actual, r.replies.expected),
  },
  blocks: {
    'blocksIn: exactly the marked blocks, in order, in the document and each turn': (r) =>
      sameLists(r.blocksIn),
  },
  previewItems: {
    'previewItemsIn: exactly the marked preview items, in order, in the document and each turn': (
      r,
    ) => sameLists(r.previewItemsIn),
  },
  columns: {
    'columnsIn, firstColumn and hasAnswer: the markdown roots, in the document and each turn': (
      r,
    ) => {
      sameLists(r.columnsIn);
      for (const c of r.firstColumn) assert.equal(c.actual, c.expected, c.scope);
      for (const t of r.hasAnswer) assert.equal(t.actual, t.expected, t.turn);
    },
  },
};
const PER_NODE = ['answers', 'paragraphs', 'replies', 'looseTurns'];

test('the page readers match no data-expect-* attribute', () => {
  for (const { path } of ADAPTERS)
    assert.doesNotMatch(readFileSync(root + path, 'utf8'), /data-expect/, path);
});

test('every adapter fact has a check', () => {
  for (const { name, facts } of ADAPTERS)
    for (const fact of facts) assert.ok(CHECKS[fact] || PER_NODE.includes(fact), `${name} ${fact}`);
});

for (const adapter of ADAPTERS)
  for (const fixture of fixtures)
    test(`${adapter.name} reader on ${fixture}`, async (t) => {
      const page = await browser.newPage();
      try {
        await page.setContent(readFileSync(FIXTURES + fixture, 'utf8'));
        await page.addScriptTag({ path: root + adapter.path });
        const r = await page.evaluate(read, { name: adapter.global, facts: adapter.facts });
        for (const fact of adapter.facts)
          for (const [name, check] of Object.entries(CHECKS[fact] ?? {}))
            await t.test(name, () => check(r));
        if (adapter.facts.some((f) => PER_NODE.includes(f)))
          await t.test(
            `every text node maps to its ${adapter.facts.filter((f) => PER_NODE.includes(f)).join(', ')}`,
            () => {
              assert.ok(r.nodes.checked > 0);
              assert.deepEqual(r.nodes.wrong.slice(0, 3), [], `${r.nodes.wrong.length} wrong`);
            },
          );
      } finally {
        await page.close();
      }
    });
