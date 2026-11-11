// Earlier bookmarks whose message the loaded history doesn't hold. One whose message is gone from the
// whole conversation waits on the three dots, live, while history is unloaded, then turns stale
// under its question once it is all loaded, the click having opened that question. With question
// 10's answer regenerated (the new one the conversation's current version) while earlier history is
// unloaded, a bookmark stored with its question (`ask`) is stale under that loaded question (#55);
// one stored without it keeps going on the three dots, as before.
import { regen } from '../fixture.mjs';
import { earlier, scene, seed as eseed } from '../earlier.mjs';

export default {
  name: 'earlier-gone',
  description: "Earlier bookmarks whose message is gone: on the three dots until all is loaded, then stale; a regenerated answer's (#55)",
  scene,
  store: [eseed(2, 0, 1, regen(2))],
  async run(qa) {
    const { page, check, question, sha, serve, pages } = qa;
    const { state, under, openEarlier, hoverDots } = earlier(qa);
    let s;
    s = await openEarlier('light', 1);
    check('earlier: an unknown message waits on the three dots, live', !!s.dotsDot && !s.dotsDot.cls.includes('stale'));
    s = await hoverDots(0);
    await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
    let q = null;
    for (let k = 0; k < 120; k++) {
      await page.waitForTimeout(250);
      q = await page.evaluate((id) => {
        const el = document.querySelector(`[data-turn-key="${id}"]`);
        return el && el.getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
      }, question(2));
      if (pages() >= 4 && q != null && Math.abs(q - 64) <= 3) break;
    }
    await page.waitForTimeout(600);
    s = await state();
    check('earlier: once all is loaded and the message isn\'t there, it is stale under its question and the click opened that question',
      !s.more && pages() === 4 && under(s, 2)?.cls.includes('stale') && q != null && Math.abs(q - 64) <= 3, { q, pages: pages(), more: s.more });

    // (g2) Question 10's answer was regenerated (the new one is the conversation's current version)
    // while earlier history is unloaded. A bookmark stored with its question (`ask`) is stale under
    // that loaded question (#55); one stored without it keeps going on the three dots, as before.
    serve({ regen: [9] });
    s = await openEarlier('light', 2, [{ ...eseed(9, 0, 1), ask: sha(question(9)) }, eseed(9, 2, 2)]).catch(() => state());
    check('earlier: a regenerated answer\'s bookmark is stale under its loaded question; one stored without its question is on the three dots',
      !!under(s, 9)?.cls.includes('stale') && !!s.dotsDot && s.dots.length === 1, { dots: s.dots.map((m) => m.cls), beside: s.dotsDot?.cls });
  },
};
