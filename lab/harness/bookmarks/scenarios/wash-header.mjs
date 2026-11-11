// A chat whose scroller starts below ChatGPT's header, as a project chat's does (seen live on
// 2026-11-10): the wash reaches the scroller's own top, not a header's height below it, and paints
// nothing above it.
import { PARA, SEL, STALE, T, WASH, washDriver } from '../wash.mjs';

export default {
  name: 'wash-header',
  description: "The wash under a header that the chat's scroller starts below: it reaches the scroller's top",
  scene: { css: '.thread-scroll-container { position:fixed; top:52px; left:0; right:0; bottom:0; height:auto }' },
  store: [PARA, SEL, STALE],
  async run(qa) {
    const { page, check } = qa;
    const { sc, openChat, rowJump, waitWash, coverage } = washDriver(qa);
    await openChat('light');
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await page.waitForTimeout(300);
    await rowJump(T, PARA);
    await waitWash();
    await page.waitForTimeout(500);
    const below = await coverage(PARA);
    check('wash: under a header that the scroller starts below, it reaches the scroller\'s top', below.ok && below.clipTop === 0, below);
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  },
};
