// Earlier history's card for several bookmarks (#72): oldest first, each row starting with the dot,
// 280 px; a row's click turns its × into a spinner and lands after two pages, the loaded bookmarks
// moving to their ticks while the rest stay on the three dots; × deletes one; Escape while loading
// puts the card away but the loading goes on and lands.
import { earlier, HINT, LATEST, LIST, scene } from '../earlier.mjs';

export default {
  name: 'earlier-list',
  description: "Earlier history's card for four bookmarks: a row's click, its spinner, ×, Escape while loading",
  scene,
  store: [...LIST, LATEST],
  async run(qa) {
    const { page, check, stored, pages } = qa;
    const { state, under, record, recorded, landed, openEarlier, hoverDots } = earlier(qa);
    let s, l, rec;
    // (c) The list, a row's click, and what is left on the three dots afterwards.
    s = await openEarlier('light', 2);
    s = await hoverDots();
    check('earlier: several: "Earlier questions · 4 bookmarks", oldest first, each row starting with the dot, 280 px',
      s.card.shown && s.card.meta === 'Earlier questions · 4 bookmarks' && s.card.flags === 0 && s.card.rows.every((r) => r.dot && r.lines === 1) &&
        Math.abs(s.card.w - 280) < 0.5 && JSON.stringify(s.card.rows.map((r) => r.text)) === JSON.stringify(LIST.map((b) => b.excerpt)) &&
        s.moreLabel === `${HINT} · Earlier questions · 4 bookmarks: ${LIST.map((b) => b.excerpt).join('; ')}`, { card: s.card, label: s.moreLabel });
    await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
    await page.mouse.move(s.card.rows[3].x, s.card.rows[3].y, { steps: 4 });
    await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
    await page.waitForTimeout(150);
    s = await state();
    check('earlier: the clicked row\'s × turns into a spinner, the others keep theirs',
      s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.rows[3]?.wait && s.card.rows[3].spin && !s.card.rows[3].del &&
        s.card.rows.slice(0, 3).every((r) => r.del && !r.spin) && s.busy, { rows: s.card.rows });
    l = await landed(4, 2);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(300);
    s = await state();
    check('earlier: a row\'s click lands on that bookmark after two pages', l.landed && pages() === 2, { ...l, pages: pages() });
    check('earlier: the loaded ones move to questions 4 and 5; question 2\'s two stay on the three dots',
      !!under(s, 3) && !!under(s, 4) && !!s.dotsDot && s.moreLabel.startsWith(`${HINT} · Earlier questions · 2 bookmarks: `), { label: s.moreLabel });
    // × deletes that bookmark; the card stays with the other.
    s = await hoverDots(0);
    const x0 = await page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bmc .it .x').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(x0.x, x0.y, { steps: 3 });
    await page.mouse.click(x0.x, x0.y);
    await page.waitForTimeout(400);
    s = await state();
    check('earlier: × deletes that bookmark; the card stays with the other, now the single card',
      !(await stored()).some((b) => b.turn === 1 && b.para === 0) && s.card.shown && s.card.meta === 'Bookmark · earlier question' && s.card.rows.length === 1 &&
        s.card.rows[0].text === LIST[1].excerpt && !!s.dotsDot, { card: s.card });

    // (d) Escape while loading puts the card away; the loading goes on and lands.
    await record();
    s = await hoverDots(0);
    await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const escaped = await state();
    l = await landed(1, 2);
    s = await state();
    rec = await recorded();
    // Question 2 lands at the chat's top, where the fixture loads the last page too.
    check('earlier: Escape closes the card but the loading goes on and lands', !escaped.card.shown && l.landed && pages() >= 3, { shown: escaped.card.shown, ...l, pages: pages() });
    check('earlier: none left on the three dots: the dot beside them goes', !s.dotsDot && !!under(s, 1), { rec });
  },
};
