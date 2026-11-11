// A code block and a table (#74): one box over the whole block, 3 px beyond it with its corners,
// fading in over about 160 ms with no sweep, then held and faded; no bubble flash. In each markup's
// own shape (fixture.mjs `washBlocks`): MARKUP=old has ChatGPT's <pre> round its rounded panel and a
// table in its scrolling wrapper; MARKUP=live has the code widget's [data-code-block] surface and
// the table's frame. Under reduced motion the block's box appears at once.
import { BLOCK_CSS, BLOCK_TURN, washBlocks } from '../fixture.mjs';
import { PARA, SEL, STALE, WASH, washDriver, wseed } from '../wash.mjs';

export default {
  name: 'wash-blocks',
  description: "The wash on a code block and a table (#74), in each markup's shape: one box, its fade-in, reduced motion",
  scene: ({ live }) => ({ said: { [BLOCK_TURN]: washBlocks(live) }, css: BLOCK_CSS }),
  store: [PARA, SEL, STALE],
  async run(qa) {
    const { page, shots, check, answer, PARAS, seedStore, LIVE } = qa;
    const { sc, openChat, rowJump, record, recorded, phases, waitWash, blockCoverage } = washDriver(qa);
    const BT = BLOCK_TURN;
    let p;
    await openChat('light', 2);
    const blockSeed = async (para) => {
      const text = await page.evaluate(([id, para, PARAS]) => {
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[para],
          w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let t = '';
        for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('button')) t += n.data;
        return t;
      }, [answer(BT), para, PARAS]);
      return wseed(BT, para, 0, text.length, text);
    };
    const CODE = await blockSeed(1),
      TABLE = await blockSeed(3);
    await seedStore([PARA, SEL, CODE, TABLE], { clear: true });
    await openChat('light', 2);
    for (const [name, b, sel] of [['code block', CODE, LIVE ? '[data-code-block]' : '.fx-panel'], ['table', TABLE, 'table']]) {
      await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
      await page.waitForTimeout(300);
      await record();
      await rowJump(BT, b);
      await waitWash();
      await page.waitForTimeout(700); // into the hold
      const cover = await blockCoverage(b, sel);
      await page.screenshot({ path: `${shots}/wash-${name.replace(' ', '-')}-light.png` });
      await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
      p = phases(await recorded());
      check(`wash: a bookmarked ${name} gets one box over the whole block, 3 px beyond it, with the block's corners`,
        p.washed && cover.ok && cover.color === 'rgba(251, 224, 122, 0.62)' && cover.blend === 'multiply', cover);
      check(`wash: the ${name}'s box fades in over about 160 ms, with no sweep, then holds 1.2 s and fades over 0.9 s`,
        p.washed && !p.swept && p.firstOpacity[0] < 0.5 && Math.abs(p.sweep - 160) <= 50 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60,
        { firstOpacity: p.firstOpacity, fadeIn: p.sweep, hold: p.hold, fade: p.fade, swept: p.swept });
      check(`wash: no bubble flash on the ${name}'s trip, and it starts once the page has stopped`, p.washed && !p.flash && p.moved <= 2, { flash: p.flash, moved: p.moved });
    }
    // Under reduced motion the block's box appears at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await record();
    await rowJump(BT, CODE);
    await waitWash();
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    p = phases(await recorded());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    check('wash: under reduced motion a code block\'s box appears at once, holds 1.2 s and fades over 0.9 s',
      p.washed && p.firstOpacity.every((v) => v > 0.999) && p.sweep === 0 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, p);
  },
};
