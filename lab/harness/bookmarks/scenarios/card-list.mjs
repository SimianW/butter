// The rail's hover card (#53), now the tick's card (#70), with one and with six bookmarks: moving
// onto the card, jumping from a row, deleting with × ("Bookmark removed", whose Undo brings back the
// same key and time), the dot fading out over 160 ms (at once under reduced motion), keyboard-only
// jump and delete with the arrows stopping on the ticks only, a reload keeping the deletions, and
// light and dark shots of both cards (`card-single-*`, `card-list-*`).
import { row } from '../fixture.mjs';

const TURN = 6;
// Question 3: one bookmark. Question 7: six (blocks are p, h3, p, p, p, p, li, li), two of them in
// paragraph 2, stored out of answer order; paragraph 3's is the one a save would have made.
const SEEDS = [row(2, 0), row(TURN, 5, { time: 1 }), row(TURN, 0, { time: 2 }), row(TURN, 2, { start: 20, end: 80, time: 3 }), row(TURN, 2, { time: 4 }), row(TURN, 4, { time: 5 })];
const STORE = [...SEEDS, row(TURN, 3, { time: 6 })];

export default {
  name: 'card-list',
  description: "The tick's card with one and six bookmarks (#53): moving onto it, a row's jump, × and Undo, the keyboard alone, the dot fading out",
  store: STORE,
  async run(qa) {
    const { open, stored, tickCard, rail, page, dotCount, toTop, hoverTick, ontoRow, check, jumpByRow, block, waitNote, noteCard, pressNote, worker, removeRow, QUESTION, focused, allDots, shootCard } = qa;
    const excerptOf = (turn, para, start = 0) =>
      STORE.find((b) => b.turn === turn && b.para === para && b.start === start).excerpt;
    const ORDER = [[0], [2], [2, 20], [3], [4], [5]].map(([para, start]) => excerptOf(TURN, para, start));
    const cardState = tickCard,
      shoot = shootCard;
    // The tick's card (#70) is the way to a question's bookmarks: hover the tick, then onto its rows.
    const cards = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(2);
      await toTop();
      await hoverTick(2);
      const single = await cardState();
      const singleOn = await ontoRow(0);
      await shoot(`card-single-${theme}`);
      await hoverTick(TURN);
      const list = await cardState();
      // Across the rail and the gap, onto the first row: the card stays and the row lights up.
      const onCard = await ontoRow(0);
      await shoot(`card-list-${theme}`);
      cards[theme] = { single, singleOn, list, onCard };
    }
    const { single, singleOn, list, onCard } = cards.light;
    check('one bookmark: the tick\'s card, named "Bookmark · question 3 of 12", shows its excerpt and, on the row, an ×',
      single.shown && single.merged && single.name === 'Bookmark · question 3 of 12' && single.rows.length === 1 &&
        single.rows[0].text === excerptOf(2, 0) && singleOn.rows[0].xShown && singleOn.rows[0].xLabel === `Delete bookmark: ${excerptOf(2, 0)}`,
      { single: single.name, rows: single.rows.map((r) => r.text) });
    check('the single row clamps its excerpt to three lines', single.rows[0].lines <= 3, { lines: single.rows[0].lines });
    check('several: "Question 7 of 12 · 6 bookmarks" and the rows in answer order',
      list.shown && list.name === 'Question 7 of 12 · 6 bookmarks' && JSON.stringify(list.rows.map((x) => x.text)) === JSON.stringify(ORDER),
      { name: list.name, rows: list.rows.map((x) => x.text) });
    check('five rows show and the sixth scrolls',
      list.box && Math.abs(list.box.client - 5 * list.rows[0].h) <= 1 && list.box.scroll > list.box.client + list.rows[0].h / 2, { box: list.box, row: list.rows[0].h });
    check('the card takes the pointer while it shows bookmarks', list.pe === 'auto');
    check('moving onto the card keeps it open; the hovered row has a background and an ×',
      onCard.shown && onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[0].xShown && !onCard.rows[1].xShown &&
        onCard.rows[0].xLabel === `Delete bookmark: ${ORDER[0]}`, { rows: onCard.rows.slice(0, 2).map((r) => [r.bg, r.xShown]) });
    check('dark theme: the same cards', cards.dark.single.name === single.name && cards.dark.onCard.shown &&
      cards.dark.onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)', { dark: cards.dark.onCard.rows[0].bg });

    // Jump from a row: the fifth row (paragraph 4) lands 64 px below the scroller's top, card put away.
    await open('light');
    await dotCount(2);
    check('jump from the fifth row', await jumpByRow(TURN, 4));
    check('clicking a row jumps to that bookmark', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    check('the card goes away after the jump', !(await cardState()).shown);

    // Delete the first row with its ×: the store and the card both lose it.
    await toTop();
    await hoverTick(TURN);
    let c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    let left = (await stored()).filter((b) => b.turn === TURN);
    check('× deletes that bookmark; the card now lists five', left.length === 5 && !left.some((b) => b.para === 0) &&
      c.shown && c.name === 'Question 7 of 12 · 5 bookmarks' && c.rows.length === 5, { left: left.length, name: c.name });
    // The remove's card (#77): "Bookmark removed", its first words struck through, and Undo, which
    // stores the same bookmark again (same key and time) and brings it back to the card.
    const gone = SEEDS.find((b) => b.turn === TURN && b.para === 0);
    await waitNote('Bookmark removed');
    const removedCard = await noteCard();
    check('× shows "Bookmark removed" top right, its first words struck through, with Undo',
      removedCard.shown && removedCard.title === 'Bookmark removed' && removedCard.excerpt === gone.excerpt && removedCard.struck &&
        JSON.stringify(removedCard.buttons) === '["Undo"]' && Math.round(removedCard.top) === 64 &&
        Math.round(1400 - removedCard.right) === removedCard.railInset + 60,
      removedCard);
    await page.mouse.move(700, 300);
    await pressNote('undo');
    await page.waitForTimeout(600);
    const back = (await stored()).find((b) => b.turn === TURN && b.para === 0);
    await toTop();
    await hoverTick(TURN);
    check('Undo brings the same bookmark back: its key, its original time, its row in the card',
      back && back.key === (await worker.evaluate((b) => ButterBookmarks.key(b), gone)) && back.time === gone.time && (await tickCard()).rows.length === 6 && !(await noteCard()).shown,
      { back, rows: (await tickCard()).rows.length });
    // × again on the first row, then on paragraph 2's two rows: three left.
    for (let k = 0; k < 3; k++) await removeRow(TURN, 0);
    left = (await stored()).filter((b) => b.turn === TURN);
    check('× on paragraph 2\'s rows removes both; three left', left.length === 3 && !left.some((b) => b.para === 2 || b.para === 0),
      { left: left.map((b) => b.para) });

    // Keyboard alone: Tab into the rail, arrows to the tick (no stop for its bookmarks), left into the
    // card, Enter to jump.
    await toTop();
    await page.mouse.move(700, 300);
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 8 && !(await focused())?.cls.startsWith('tick'); k++) await page.keyboard.press('Tab');
    let f;
    const stops = [];
    for (let k = 0; k < 30; k++) {
      f = await focused();
      stops.push(f?.cls);
      if (f?.cls.startsWith('tick') && f.label.includes(' · 3 bookmarks: ')) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(250); // the card fades in
    check('arrows walk the ticks only; the tick\'s name holds the bookmark text', f?.cls.startsWith('tick') && stops.every((x) => x?.startsWith('tick')) &&
      f.label === `${QUESTION(TURN)} · 3 bookmarks: ${ORDER[3]}; ${ORDER[4]}; ${ORDER[5]}` && (await cardState()).shown, { f, stops });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    f = await focused();
    check('ArrowLeft enters the card, ArrowDown moves to the next row', f?.cls === 'go' && f.text === ORDER[4], { f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);
    check('Enter on a row jumps to it', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    f = await focused();
    check('after the jump, focus is on the question\'s tick', f?.cls.startsWith('tick') && f.label.startsWith(QUESTION(TURN)), { f });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Tab');
    f = await focused();
    check('Tab moves from a row to its ×', f?.cls === 'x' && f.label === `Delete bookmark: ${ORDER[3]}`, { f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    left = (await stored()).filter((b) => b.turn === TURN);
    f = await focused();
    check('Enter on × deletes it; focus stays in the card', left.length === 2 && !left.some((b) => b.para === 3) &&
      f?.cls === 'go' && (await cardState()).rows.length === 2, { left: left.map((b) => b.para), f });
    await page.keyboard.press('Escape');
    await page.mouse.move(700, 300);

    // The single row's × under reduced motion: the dot goes at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toTop();
    await hoverTick(2);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(150);
    check('the single row\'s × deletes; under reduced motion the dot goes at once, with no fade',
      !(await stored()).some((b) => b.turn === 2) && (await allDots()) === 1 && !(await cardState()).shown, { dots: await allDots() });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Delete question 7's last two: the last deletion fades the dot out over 160 ms.
    await hoverTick(TURN);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    check('one left: the card shows the single row', c.shown && c.name === 'Bookmark · question 7 of 12' && c.rows.length === 1 && c.rows[0].text === ORDER[5], { c: c.name });
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    const fading = await page.waitForFunction(
      () => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].some((m) => m.classList.contains('gone') && +getComputedStyle(m).opacity < 1),
      null, { timeout: 1000 }).then(() => true, () => false);
    const fade = await page.evaluate(() => {
      const d = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.gone');
      return d && getComputedStyle(d).transition;
    });
    await page.waitForTimeout(400);
    let r = await rail();
    check('deleting the last bookmark fades the dot out over 160 ms, then removes it', fading && /opacity 0.16s/.test(fade ?? '') && r.dots.length === 0 &&
      (await allDots()) === 0 && !(await cardState()).shown, { fading, fade, dots: r.dots.length });

    // Reload: every deletion is still gone.
    await open('light');
    await page.waitForTimeout(500);
    check('after a reload the deletions are still gone', (await stored()).length === 0 && (await rail()).dots.length === 0);
  },
};
