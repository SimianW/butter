// The page reader's contract (extension/page/reader.js): answer roots, message ids, questions,
// paragraphs and replies, checked in real Chromium against every hand-written page in
// test/fixtures/page/, whose data-expect-* attributes say what each must be (README.md there).
// ADAPTERS lists each implementation of the contract; each is injected into every fixture.
// Needs Playwright's Chromium: `npx playwright install chromium` (see docs/development.md).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = `${root}test/fixtures/page/`;
const ADAPTERS = [
  { name: 'isolated', path: 'extension/page/reader.js', global: 'ButterPageReader' },
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
// Runs in the page: what the fixture's marks expect, and what the adapter answers, as labels
// (`<tag #index "text…">`) so a failure names the elements.
function read(name) {
  const R = globalThis[name];
  const all = [...document.querySelectorAll('*')];
  const tag = (el) => {
    if (el == null) return null;
    if (el.nodeType !== 1) return `#node ${el.nodeName}`;
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24);
    return `<${el.localName} #${all.indexOf(el)}${text ? ` "${text}"` : ''}>`;
  };
  const marked = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const answers = marked('[data-expect-answer]');
  const ownMarks = (a) =>
    marked('[data-expect-para]', a).filter((p) => p.closest('[data-expect-answer]') === a);
  const question = (a) => a?.getAttribute('data-expect-question') ?? null;
  const out = {
    answersIn: {
      expected: answers.map((a) => ({ root: tag(a), id: a.getAttribute('data-expect-answer') })),
      actual: R.answersIn(document).map((a) => ({ root: tag(a.root), id: a.id })),
    },
    questions: answers.map((a) => ({
      answer: tag(a),
      expected: question(a),
      actual: R.turnKeyOf(a),
    })),
    paragraphsOf: answers.map((a) => {
      const marks = ownMarks(a);
      return {
        answer: tag(a),
        ordinals: marks.map((p) => p.getAttribute('data-expect-para')),
        expected: marks.map(tag),
        actual: R.paragraphsOf(a).map(tag),
        within: R.paragraphsIn(a).map(tag),
      };
    }),
    paragraphsIn: {
      expected: marked('[data-expect-para]').map(tag),
      actual: R.paragraphsIn(document).map(tag),
    },
    replies: {
      expected: marked('[data-expect-reply]').map(tag),
      actual: R.replies(document).map(tag),
    },
    nodes: { checked: 0, wrong: [] },
  };
  // Every text node: its paragraph, answer, question and reply follow from the marks around it.
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement,
      a = el.closest('[data-expect-answer]');
    const expected = {
      paragraph: tag(el.closest('[data-expect-para]')),
      answer: a ? { root: tag(a), id: a.getAttribute('data-expect-answer') } : null,
      reply: tag(el.closest('[data-expect-reply]')),
    };
    const got = R.answerOf(n);
    const actual = {
      paragraph: tag(R.paragraphOf(n)),
      answer: got ? { root: tag(got.root), id: got.id } : null,
      reply: tag(R.replyOf(n)),
    };
    if (a) {
      expected.question = question(a);
      actual.question = R.turnKeyOf(n);
    }
    out.nodes.checked++;
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      out.nodes.wrong.push({ text: JSON.stringify(n.data.trim().slice(0, 30)), expected, actual });
  }
  return out;
}

test('the page reader matches no data-expect-* attribute', () => {
  for (const { path } of ADAPTERS)
    assert.doesNotMatch(readFileSync(root + path, 'utf8'), /data-expect/, path);
});

for (const adapter of ADAPTERS)
  for (const fixture of fixtures)
    test(`${adapter.name} reader on ${fixture}`, async (t) => {
      const page = await browser.newPage();
      try {
        await page.setContent(readFileSync(FIXTURES + fixture, 'utf8'));
        await page.addScriptTag({ path: root + adapter.path });
        const r = await page.evaluate(read, adapter.global);
        await t.test('answersIn: exactly the marked answer roots, in order, with their ids', () =>
          assert.deepEqual(r.answersIn.actual, r.answersIn.expected),
        );
        await t.test("each answer's question is its turn's key", () => {
          for (const q of r.questions) assert.equal(q.actual, q.expected, q.answer);
        });
        await t.test("paragraphsOf: exactly each answer's marked paragraphs, 0..k", () => {
          for (const p of r.paragraphsOf) {
            assert.deepEqual(
              p.ordinals,
              p.ordinals.map((_, i) => String(i)),
              `${p.answer}: fixture marks must run 0..k in document order`,
            );
            assert.deepEqual(p.actual, p.expected, p.answer);
            assert.deepEqual(p.within, p.expected, `paragraphsIn ${p.answer}`);
          }
        });
        await t.test('paragraphsIn(document): every marked paragraph, in document order', () =>
          assert.deepEqual(r.paragraphsIn.actual, r.paragraphsIn.expected),
        );
        await t.test('replies: exactly the marked replies, in order', () =>
          assert.deepEqual(r.replies.actual, r.replies.expected),
        );
        await t.test('every text node maps to its paragraph, answer, question and reply', () => {
          assert.ok(r.nodes.checked > 0);
          assert.deepEqual(r.nodes.wrong.slice(0, 3), [], `${r.nodes.wrong.length} wrong`);
        });
      } finally {
        await page.close();
      }
    });
