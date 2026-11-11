// Earlier history: a bookmark in unloaded history, opened from the earlier-history card, is washed
// once its pages have loaded and the page has landed.
import { WASH, washDriver, wseed } from '../wash.mjs';

const EARLY = wseed(2, 2);

export default {
  name: 'wash-earlier',
  description: 'The wash on a bookmark in unloaded history: after its pages load and the page lands',
  scene: { first: 7, pageDelay: 300 },
  store: [EARLY],
  async run(qa) {
    const { open, page, check, pages } = qa;
    const { earlierRowJump, record, recorded, phases, waitWash, coverage } = washDriver(qa);
    let p;
    await open('light');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === 1, null, { timeout: 5000 });
    await record();
    await earlierRowJump(EARLY);
    await waitWash().catch(() => {});
    await page.waitForTimeout(700);
    const earlyCover = await coverage(EARLY);
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 }).catch(() => {});
    p = phases(await recorded());
    check('wash: a bookmark in unloaded history is washed after its pages load and the page lands',
      p.washed && pages() >= 2 && p.moved <= 2 && !p.flash && earlyCover.ok && Math.abs(p.hold - 1200) <= 50,
      { washed: p.washed, pages: pages(), moved: p.moved, flash: p.flash, cover: earlyCover.ok, boxes: earlyCover.boxes, want: earlyCover.want, hold: p.hold });
  },
};
