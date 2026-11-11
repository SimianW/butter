// The tick's card (#70). Hovering or focusing a tick whose question holds bookmarks shows the
// question's card with its bookmarks under the question: the meta line, the question, rows in answer
// order (the stale one grey with "answer changed"), one bookmark, one stale bookmark with its footer,
// a tick without bookmarks, dark theme and the tick's name; then clicks, ×, the keyboard alone and a
// reload. Questions 3, 5, 7 and 10 take the text of the #69 mockup's section 3 and their bookmarks
// its rows, so the card can be compared with the mockup's panels (BUTTER_BOOKMARKS_DOT_MOCKUP).
import path from 'node:path';
import { ACCOUNT, answer, CONV_HASH, sha } from '../fixture.mjs';


const Q7 = 'Why does Postgres ignore my index on orders.status?',
  TARGET =
    'Postgres skips an index when it expects a large share of rows to match, roughly more than 5–10% of the table. ' +
    'A sequential scan reads pages in order, which is cheaper than jumping around the heap for every matching row.',
  VACUUM = 'Run VACUUM ANALYZE after a bulk load, so the planner sees the new row counts before the next query plans against them.';
const p = (t) => `<p>${t}</p>`;
// The questions' text, as the mockup's.
const asked = new Map([
  [2, 'How do I bulk-load 2M rows quickly?'],
  [4, 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?'],
  [6, Q7],
  [9, 'Should I add a partial index?'],
]);
// Question 7's blocks: p, h3, p, p, p, p, p. Paragraph 5 no longer says what its bookmark kept.
const said = new Map([
  [2, [p(VACUUM), p('Then check the plan again with EXPLAIN ANALYZE.')]],
  [6, [p("Most of the time it isn't ignoring it. The planner decided a sequential scan is cheaper."), '<h3>When a sequential scan wins</h3>',
    p(TARGET), p("Compare the planner's estimate with reality:"), p("EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';"),
    p('Run ANALYZE orders after a bulk load.'), p('A partial index on the rare statuses stays small, and the planner trusts it.')]],
]);
const row = (turn, para, start, excerpt, time) =>
  ({ account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end: start + excerpt.length, excerpt, time });
const ROWS = [
  row(6, 2, TARGET.indexOf('roughly'), 'roughly more than 5–10% of the table. A sequential scan reads pages in order.', 1),
  row(6, 6, 0, 'A partial index on the rare statuses stays small, and the planner trusts it.', 2),
  row(6, 5, 0, 'If estimated rows are far from actual rows, run ANALYZE orders to refresh the statistics.', 3),
  row(6, 2, 0, TARGET, 4),
  row(2, 0, 0, VACUUM, 5),
  row(9, 2, 0, "Use a partial index when only a few statuses are queried often, for example WHERE status IN ('pending', 'failed').", 6),
];
// Question 7's rows in answer order: paragraph 2 (twice), 5 (stale), 6.
const ORDER = [ROWS[3], ROWS[0], ROWS[2], ROWS[1]].map((b) => b.excerpt);

// The rail's card shot as `b.file` (its own box at `b.at`, a viewport rect) against the card in
// the #69 mockup's panel `b.panel`, open in `mock`: under 0.1% of pixels differing by more than 24.
export async function cardMatches({ shots, compare, check }, mock, b) {
  const card = mock.locator(`[data-panel="${b.panel}"] .card`);
  await card.scrollIntoViewIfNeeded();
  // The mockup centres its card with translateY(-50%), which puts a card of odd height on half a
  // pixel and moves some lines' text by a pixel. Lift it by a whole number of pixels instead and
  // put it on the built card's fraction of a pixel, so both draw on the same grid.
  const frac = (v) => v - Math.floor(v);
  await card.evaluate((el) => (el.style.transform = `translateY(${-Math.round(el.offsetHeight / 2)}px)`));
  const box = await card.boundingBox();
  await card.evaluate((el, [dx, dy]) => {
    const s = getComputedStyle(el);
    el.style.right = `${parseFloat(s.right) - dx}px`;
    el.style.top = `${parseFloat(s.top) + dy}px`;
  }, [frac(b.at.x) - frac(box.x), frac(b.at.y) - frac(box.y)]);
  const moved = await card.boundingBox(),
    reference = `${shots}/mockup-${b.panel}.png`;
  await mock.screenshot({ path: reference, clip: { x: Math.floor(moved.x), y: Math.floor(moved.y), width: Math.round(b.at.w), height: Math.round(b.at.h) } });
  const diff = await compare(mock, b.file, reference, { radius: 12 });
  check(`the card matches the mockup's ${b.panel}`, diff.ratio !== undefined && diff.ratio < 0.001,
    { ...diff, built: [b.at.w, b.at.h], mockup: [moved.width, moved.height] });
}

export default {
  name: 'card',
  description: "The tick's card (#70): rows, stale row, single and plain cards, clicks, ×, keyboard, reload; the #69 mockup's section 3 when given",
  scene: { asked, said },
  store: ROWS,
  async run(qa) {
    const { page, context, shots, check, open, stored, block, dotCount, tickCard, toTop, hoverTick, ontoRow, questionTop } = qa;
    const marked = () => dotCount(3);
    const tickName = (turn) =>
      page.evaluate((turn) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')[turn].getAttribute('aria-label'), turn);
    // The card's own box, on whole pixels; `at` keeps its fractional position for the mockup.
    const built = [];
    const shoot = async (panel) => {
      const { rect } = await tickCard(),
        file = `${shots}/${panel}.png`;
      await page.screenshot({ path: file, clip: { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) } });
      built.push({ panel, file, at: rect });
    };
    const LIGHT_DOT = 'rgb(211, 158, 16)',
      DARK_DOT = 'rgb(227, 199, 102)';
    const seen = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await marked();
      await toTop();
      await hoverTick(6);
      const many = await tickCard();
      const onCard = await ontoRow(1);
      await shoot(`f-many-${theme}`);
      await hoverTick(2);
      const one = await ontoRow(0);
      if (theme === 'light') await shoot('f-one-light');
      await hoverTick(9);
      const stale = await ontoRow(0);
      if (theme === 'dark') await shoot('f-stale-dark');
      await hoverTick(4);
      const plain = await tickCard();
      if (theme === 'dark') await shoot('f-plain-dark');
      seen[theme] = { many, onCard, one, stale, plain };
    }
    const { many, onCard, one, stale, plain } = seen.light;
    check('a tick that holds bookmarks: its card shows the meta line, the question and the rows in answer order',
      many.shown && many.merged && many.meta === '7 / 12' && many.text === Q7 && JSON.stringify(many.rows.map((r) => r.text)) === JSON.stringify(ORDER),
      { meta: many.meta, text: many.text, rows: many.rows.map((r) => r.text) });
    check('the card is 280 px wide, a group named "Question 7 of 12 · 4 bookmarks", and takes the pointer',
      Math.abs(many.rect.w - 280) < 0.5 && many.role === 'group' && many.name === 'Question 7 of 12 · 4 bookmarks' && !many.inert && many.pe === 'auto',
      { w: many.rect.w, role: many.role, name: many.name, inert: many.inert, pe: many.pe });
    check('the question is clamped to two lines; the rows are one line each', many.textLines <= 2 && many.rows.every((r) => r.lines === 1),
      { textLines: many.textLines, lines: many.rows.map((r) => r.lines) });
    check('each row starts with a 5 px dot, #d39e10 in light theme, hollow for the stale row; no flag',
      many.flags === 0 && many.rows.every((r) => r.dot?.w === 5) &&
        many.rows.filter((r) => !r.stale).every((r) => r.dot.bg === LIGHT_DOT) &&
        many.rows[2].dot.bg === 'rgba(0, 0, 0, 0)' && many.rows[2].dot.ring.includes(LIGHT_DOT) && many.rows[2].dot.ring.includes('inset'),
      { dots: many.rows.map((r) => r.dot), flags: many.flags });
    check('the stale row is grey and ends with "answer changed"; the others have no tag',
      many.rows[2].stale && many.rows[2].tag === 'answer changed' && many.rows[2].color === 'rgb(143, 143, 143)' &&
        many.rows.filter((r) => !r.stale).every((r) => r.tag === null && r.color !== 'rgb(143, 143, 143)'),
      { rows: many.rows.map((r) => [r.tag, r.color]) });
    check('moving onto the card keeps it open; the hovered row has the hover background and an ×, the others no ×',
      onCard.shown && onCard.merged && onCard.rows[1].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[1].xShown &&
        onCard.rows[1].xLabel === `Delete bookmark: ${ORDER[1]}` && !onCard.rows[0].xShown && !onCard.rows[3].xShown,
      { rows: onCard.rows.map((r) => [r.bg, r.xShown]) });
    check('one bookmark: a single row whose text runs to three lines, no tag, no footer',
      one.shown && one.merged && one.meta === '3 / 12' && one.name === 'Bookmark · question 3 of 12' && one.rows.length === 1 &&
        one.rows[0].text === VACUUM && one.rows[0].lines >= 2 && one.rows[0].lines <= 3 && one.rows[0].tag === null && one.warn === null,
      { meta: one.meta, name: one.name, rows: one.rows.map((r) => [r.text, r.lines]), warn: one.warn });
    check("one stale bookmark: grey text, a hollow dot, no tag, and the footer about the paragraph that can't be found",
      stale.shown && stale.merged && stale.meta === '10 / 12' && stale.rows.length === 1 && stale.rows[0].stale && stale.rows[0].tag === null &&
        stale.rows[0].color === 'rgb(143, 143, 143)' && stale.rows[0].dot.bg === 'rgba(0, 0, 0, 0)' &&
        stale.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.",
      { rows: stale.rows.map((r) => [r.tag, r.color, r.dot]), warn: stale.warn });
    check("a tick without bookmarks: today's card, unchanged and inert",
      plain.shown && !plain.merged && plain.role === 'tooltip' && plain.inert && plain.pe === 'none' && plain.meta === '5 / 12' &&
        plain.text === 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?' && plain.rows.length === 0,
      { plain: { ...plain, rows: plain.rows.length } });
    check('dark theme: the same card, its dots #e3c766',
      seen.dark.many.merged && seen.dark.many.rows.filter((r) => !r.stale).every((r) => r.dot.bg === DARK_DOT) &&
        seen.dark.many.rows[2].dot.ring.includes(DARK_DOT) && seen.dark.onCard.shown && seen.dark.stale.warn === stale.warn && !seen.dark.plain.merged,
      { dots: seen.dark.many.rows.map((r) => r.dot) });
    check("the tick's name appends the bookmarks' count and text, the stale one marked",
      (await tickName(6)) === `${Q7} · 4 bookmarks: ${ORDER[0]}; ${ORDER[1]}; ${ORDER[2]} (answer changed); ${ORDER[3]}` &&
        (await tickName(4)) === 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?',
      { seven: await tickName(6), five: await tickName(4) });

    // Clicks. The tick still opens its question.
    await open('light');
    await marked();
    await toTop();
    let t = await hoverTick(6);
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(3500);
    check('clicking a tick that holds bookmarks lands on its question', Math.abs((await questionTop(6)) - 64) <= 3, { fromTop: await questionTop(6) });
    // A row jumps to its bookmark (the last row: paragraph 6) and the card closes.
    await toTop();
    await hoverTick(6);
    let c = await ontoRow(3);
    await page.mouse.click(c.rows[3].x - 40, c.rows[3].y);
    await page.waitForTimeout(3500);
    check('clicking a row lands on its bookmark', Math.abs((await block(6, 6)).fromTop - 64) <= 3, { fromTop: (await block(6, 6)).fromTop });
    check('the card closes after a row is clicked', !(await tickCard()).shown);
    // × deletes that bookmark: the first row.
    await toTop();
    await hoverTick(6);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await tickCard();
    let left = (await stored()).filter((b) => b.turn === 6);
    check('× deletes that bookmark; the card stays open with the rest', left.length === 3 && !left.some((b) => b.para === 2 && b.start === 0) &&
      c.shown && c.merged && c.name === 'Question 7 of 12 · 3 bookmarks' && c.rows.length === 3, { left: left.length, name: c.name });
    // The last one: question 3's only bookmark. Its card closes.
    await hoverTick(2);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    check("× on a question's last bookmark deletes it and closes the card", !(await stored()).some((b) => b.turn === 2) && !(await tickCard()).shown);

    // Keyboard alone: Tab into the rail, arrows to tick 7, ArrowLeft into its card.
    await toTop();
    await page.mouse.move(700, 300);
    const focused = () => page.evaluate(() => {
      const a = document.querySelector('chatgpt-butter-nav')?.shadowRoot.activeElement;
      return a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null;
    });
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 8 && !(await focused())?.cls.startsWith('tick'); k++) await page.keyboard.press('Tab');
    let f;
    for (let k = 0; k < 30; k++) {
      f = await focused();
      if (f?.cls.startsWith('tick') && f.label.startsWith(Q7)) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(250);
    c = await tickCard();
    check('focusing a tick that holds bookmarks shows its card', f?.label.startsWith(`${Q7} · 3 bookmarks: `) && c.shown && c.merged, { f, merged: c.merged });
    await page.keyboard.press('ArrowLeft');
    f = await focused();
    const first = f;
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    f = await focused();
    check('ArrowLeft focuses the first row; ArrowDown moves between rows',
      first?.cls === 'go' && first.text.startsWith(ORDER[1]) && f?.cls === 'go' && f.text === ORDER[3], { first, f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);
    f = await focused();
    check('Enter on a row jumps to it; focus ends on the tick', Math.abs((await block(6, 6)).fromTop - 64) <= 3 && f?.cls.startsWith('tick') && f.label.startsWith(Q7),
      { fromTop: (await block(6, 6)).fromTop, f });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
    left = (await stored()).filter((b) => b.turn === 6);
    f = await focused();
    check('Delete removes the focused row; focus stays in the card', left.length === 2 && !left.some((b) => b.para === 2) &&
      f?.cls === 'go' && (await tickCard()).rows.length === 2, { left: left.map((b) => b.para), f });
    await page.keyboard.press('ArrowRight');
    f = await focused();
    const back = f;
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    f = await focused();
    check('ArrowRight and Escape return to the tick', back?.cls.startsWith('tick') && back.label.startsWith(Q7) && f?.cls.startsWith('tick') && f.label.startsWith(Q7), { back, f });

    // Reload: both deletions are still gone.
    await page.evaluate(() => document.activeElement?.blur());
    await open('light');
    await page.waitForTimeout(500);
    const after = await stored();
    check('after a reload the deleted bookmarks are still gone', after.length === 3 && !after.some((b) => b.turn === 2) &&
      after.filter((b) => b.turn === 6).length === 2 && (await tickName(2)) === 'How do I bulk-load 2M rows quickly?', { stored: after.map((b) => [b.turn, b.para]) });

    // Against the #69 mockup's section 3, when given: the card's own box in each panel.
    if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) {
      const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
      await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
      await mock.addStyleTag({ content: 'html { scrollbar-width: none } .ann, .ring { display: none }' });
      await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
      for (const b of built) await cardMatches(qa, mock, b);
      await mock.close();
    }
  },
};
