// Earlier history's dot (#72), as the #69 mockup's `s-earlier-light` and `f-earlier-light` draw it:
// the chat opens with its latest 6 questions, the fifth being read and the third holding a bookmark;
// two bookmarks in the history not loaded yet (the panel's rows) put the dot beside the three dots.
// Then the pointer on the three dots and across onto the first row of their card. Compared with the
// panels when BUTTER_BOOKMARKS_DOT_MOCKUP is set.
import { row } from '../fixture.mjs';
import { panels } from '../mockup.mjs';

// A live bookmark on block `para` of question `turn`'s answer.
const live = (turn, time, para = 0) => row(turn, para, { time });

const early = (turn, time, excerpt) => ({ ...live(turn, time), excerpt });

export default {
  name: 'dot-earlier',
  description: "Earlier history's dot (#72) beside the three dots, and their card; #69's s-earlier-light and f-earlier-light",
  scene: { tail: 40, first: 6 },
  store: [
    early(1, 1, 'COPY is the fastest way in: one transaction, no per-row overhead.'),
    early(2, 2, 'Drop the indexes first and rebuild them after the load.'),
    live(8, 3),
  ],
  async run(qa) {
    const { open, page, dotCount, rail, dotBeside, check, readAt, lit } = qa;
    const mockup = panels(qa);
    await open('light');
    await dotCount(2);
    await readAt(4);
    const r = await rail();
    check('earlier history at rest: question 11 alone lit, a dot beside question 9 and one beside the three dots',
      JSON.stringify(lit(r)) === '[[4,21]]' && !!dotBeside(r, 2) && r.dots.length === 2, { lit: lit(r), dots: r.dots.map((d) => [d.y, d.right]) });
    // The three dots' top is on half a pixel, which Chrome snaps a device pixel lower at three times
    // the size: a pixel matches when one within a device pixel of it in the mockup does.
    await mockup.strip('s-earlier-light', [], true);
    const dotsRow = await page.evaluate(() => {
      const m = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more').getBoundingClientRect();
      return { x: m.left + m.width / 2 - 10, y: m.top + m.height / 2 };
    });
    await page.mouse.move(dotsRow.x, dotsRow.y, { steps: 4 });
    await page.waitForTimeout(350);
    const firstRow = await page.evaluate(() => {
      const it = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bmc .it').getBoundingClientRect();
      return { x: it.left + it.width / 2 - 40, y: it.top + it.height / 2 };
    });
    await page.mouse.move(firstRow.x, firstRow.y, { steps: 12 });
    await page.waitForTimeout(400);
    const earlierCard = await page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        c = root.querySelector('.card'),
        q = c.getBoundingClientRect();
      return { shown: c.classList.contains('show'), meta: root.querySelector('.card > .meta').textContent, rect: { x: q.left, y: q.top, w: q.width, h: q.height } };
    });
    check('hovering the three dots: their card, "Earlier questions · 2 bookmarks", stays on the way to its first row',
      earlierCard.shown && earlierCard.meta === 'Earlier questions · 2 bookmarks', earlierCard);
    // Through the DevTools protocol, as the strips are.
    await mockup.card('f-earlier-light', { cdp: true });
    await mockup.match();
  },
};
