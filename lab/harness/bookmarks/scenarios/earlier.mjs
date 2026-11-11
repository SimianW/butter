// Earlier history (#51 addendum, #72). After a reload a long chat lists only its latest questions; a
// bookmark whose question is earlier sits on the rail's three dots, with its dot beside them, until
// its answer is loaded. At rest: that dot (4 px, solid, on their row, its right edge 4 px left of the
// leftmost, no pointer events, not focusable, hidden from the accessibility tree), the loaded
// question's own dot, the three dots' name, no reads or page loads while scrolling. Then hovering the
// three dots shows the single card; a click on its row loads earlier pages only until the answer is
// known and lands on its text, its dot moving to its tick.
import { A, earlier, HINT, LATEST, scene } from '../earlier.mjs';

export default {
  name: 'earlier',
  description: "Earlier history (#51, #72): the dot beside the three dots, their single card, a row's click loading pages and landing",
  scene,
  store: [A, LATEST],
  async run(qa) {
    const { page, check, requests, pages } = qa;
    const { state, under, record, recorded, landed, openEarlier, hoverDots } = earlier(qa);
    const LIGHT_DOT = 'rgb(211, 158, 16)';
    // (a) At rest: the earlier bookmark's dot beside the three dots, the loaded one beside its tick.
    let s = await openEarlier('light', 2);
    check('earlier: the chat opens with its latest 5 questions and the earlier-history dots', s.ticks.length === 5 && s.more, { ticks: s.ticks.length });
    const d = s.dotsDot;
    check("earlier: a 4 px dot on the three dots' row, its right edge 4 px left of the leftmost, solid #d39e10",
      !!d && d.w === 4 && d.h === 4 && Math.abs(d.y - s.dotsY) <= 0.5 && Math.abs(d.right - (s.dotsLeft - 4)) <= 0.5 &&
        d.color === LIGHT_DOT && d.ring === 'none' && !d.cls.includes('stale'), { d, dotsY: s.dotsY, dotsLeft: s.dotsLeft });
    check('earlier: the dot takes no pointer events, is not focusable and is hidden from the accessibility tree',
      d?.pe === 'none' && d.hidden === 'true' && d.tag === 'I' && d.tabIndex === -1, { d });
    check('earlier: the loaded question\'s bookmark is a dot beside its tick (question 11), and no other', !!under(s, 10) && s.dots.length === 1 && !under(s, 9) && !under(s, 8),
      { dots: s.dots.map((m) => m.y), ticks: s.ticks });
    check("earlier: the three dots keep their name and append the earlier label with the bookmark's text",
      s.moreLabel === `${HINT} · Bookmark · earlier question: ${A.excerpt}`, { label: s.moreLabel });
    // Scrolling the loaded part reads nothing and loads no page.
    const before = await requests();
    await page.mouse.move(700, 500);
    for (let k = 0; k < 3; k++) {
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(400);
    check('earlier: scrolling reads no bookmarks and loads no page', JSON.stringify(await requests()) === JSON.stringify(before) && pages() === 0,
      { before, after: await requests(), pages: pages() });

    // (b) Hovering the three dots: the single card. Moving onto it keeps it; a click on its row loads
    // earlier pages until the answer mounts.
    s = await hoverDots();
    check('earlier: hovering the three dots shows "Bookmark · earlier question", a row starting with the dot, and the footer',
      s.card.shown && s.card.bm && !s.card.inert && s.card.pe === 'auto' && s.card.role === 'group' && s.card.label === 'Bookmark · earlier question' &&
        s.card.meta === 'Bookmark · earlier question' && s.card.text === null && s.card.flags === 0 && s.card.rows.length === 1 &&
        s.card.rows[0].text === A.excerpt && s.card.rows[0].dot && s.card.rows[0].lines <= 3 && s.card.rows[0].del === `Delete bookmark: ${A.excerpt}` &&
        s.card.warn === "This question isn't loaded yet. Clicking loads earlier messages first.", { card: s.card });
    await record();
    s = await hoverDots(0);
    check('earlier: moving onto the card keeps it open', s.card.shown && s.card.bm, { shown: s.card.shown });
    await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
    await page.waitForTimeout(150);
    s = await state();
    check('earlier: while loading, the card stays with "Loading earlier questions…", a spinner for its × and blinking dots',
      s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.rows[0]?.spin && !s.card.rows[0].del && s.busy, { card: s.card, busy: s.busy });
    let l = await landed(2, 2);
    s = await state();
    let rec = await recorded();
    check('earlier: the click loads earlier pages until the answer mounts and lands on the text', l.landed && pages() === 3, { ...l, pages: pages() });
    check("earlier: the bookmark moves to its real tick (question 3), its dot growing in; the dot beside the three dots fades out; the card goes on landing",
      !s.dotsDot && s.more && !!under(s, 2) && rec.grown >= 1 && rec.gone >= 1 && !s.card.shown && s.moreLabel === HINT, { rec, dots: s.dots.length, label: s.moreLabel });
  },
};
