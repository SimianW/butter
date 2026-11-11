// The three dots themselves with earlier history: without bookmarks in it, no dot beside them and
// today's hint card; with bookmarks, a click on them still loads earlier messages.
import { A, earlier, HINT, LATEST, scene } from '../earlier.mjs';

export default {
  name: 'earlier-dots',
  description: 'The three dots: the hint card without earlier bookmarks; a click still loads earlier messages',
  scene,
  store: [LATEST],
  async run(qa) {
    const { page, check, pages } = qa;
    const { state, openEarlier, hoverDots } = earlier(qa);
    let s;
    s = await openEarlier('light', 1);
    s = await hoverDots();
    check("earlier: no bookmarks in earlier history: no dot beside the three dots, which show today's hint card",
      !s.dotsDot && s.card.shown && !s.card.bm && s.card.inert && s.card.role === 'tooltip' && s.card.text === HINT && s.moreLabel === HINT, { card: s.card });
    s = await openEarlier('light', 2, [A, LATEST]);
    s = await hoverDots();
    const ticks0 = s.ticks.length;
    await page.mouse.click(s.moreRect.x - 10, s.dotsY);
    for (let k = 0; k < 40 && (await state()).ticks.length === ticks0; k++) await page.waitForTimeout(250);
    s = await state();
    check('earlier: clicking the three dots loads earlier messages (also when they hold bookmarks)', pages() >= 1 && s.ticks.length > ticks0,
      { pages: pages(), ticks: [ticks0, s.ticks.length] });
  },
};
