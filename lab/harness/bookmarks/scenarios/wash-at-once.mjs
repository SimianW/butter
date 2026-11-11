// Trips that have nowhere to go (review of #75): the same row clicked again after its wash has
// faded, a bookmark in the last answer with the chat at its bottom, where the page can't scroll to
// it, and a far trip to the last answer's last block in a chat with little room below it. The wash
// starts at once, not after the wait for a scroll's end.
import { TURNS } from '../fixture.mjs';
import { SEL, T, WASH, washDriver, wseed } from '../wash.mjs';

const LAST = wseed(TURNS - 1, 6, 0, null, 'Fixture list item one'); // its first list item

export default {
  name: 'wash-at-once',
  description: "The wash with nowhere to scroll (#75): the same row again, the last answer at the chat's bottom, a far trip to its end",
  store: [SEL, LAST],
  async run(qa) {
    const { page, check, serve, seedStore, TURNS } = qa;
    const { sc, openChat, rowJump, record, recorded, phases, waitWash } = washDriver(qa);
    let p;
    await openChat('light', 2);
    const startsAtOnce = async (turn, b) => {
      await record();
      await rowJump(turn, b);
      await waitWash();
      await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
      const R = await recorded();
      const tops = R.frames.map((x) => x.top);
      return { ...phases(R), still: Math.max(...tops) - Math.min(...tops) };
    };
    await rowJump(T, SEL);
    await waitWash();
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    await page.waitForTimeout(300);
    p = await startsAtOnce(T, SEL);
    check('wash: the same row clicked again after its wash has faded washes within about 300 ms',
      p.washed && p.still <= 1 && p.startedAfterClick <= 300, { startedAfterClick: p.startedAfterClick, still: p.still });
    // A wheel, as a reader scrolls: it ends the follow that holds the page on the last landing.
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 20000);
    await page.waitForTimeout(800);
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 1e6), sc);
    await page.waitForTimeout(300);
    p = await startsAtOnce(TURNS - 1, LAST);
    check('wash: a bookmark in the last answer, with the chat at its bottom, washes within about 300 ms',
      p.washed && p.still <= 1 && p.startedAfterClick <= 300, { startedAfterClick: p.startedAfterClick, still: p.still });
    // A far trip from the top to the last answer's last block, in a chat with little room below its
    // last answer: the page waits `lead` px short of the bottom and the bottom both, so the arrival
    // has nowhere to scroll. The wash starts after the target's 150 ms steady check and the 250 ms
    // reveal (about 430 ms after the page's last move), not after the 1.5 s wait for a scrollend.
    serve({ css: '.content { padding-bottom: 150px }' });
    const END = wseed(TURNS - 1, 7, 0, null, 'Fixture list item two');
    await seedStore([SEL, END], { clear: true });
    await openChat('light', 2);
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await page.waitForTimeout(300);
    await record();
    await rowJump(TURNS - 1, END);
    await waitWash();
    const bottom = await page.evaluate((sc) => {
      const s = document.querySelector(sc);
      return s.scrollHeight - s.clientHeight - s.scrollTop;
    }, sc);
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    {
      const R = await recorded();
      p = phases(R);
      const f = R.frames.filter((x) => x.t <= p.t0),
        last = f.findLast((x, i) => i && x.top !== f[i - 1].top);
      p.afterLastMove = last ? Math.round(p.t0 - last.t) : null;
    }
    check('wash: a far trip to the last answer\'s last block, with the chat at its bottom, washes within about 0.5 s of the page\'s last move',
      p.washed && Math.abs(bottom) <= 1 && p.afterLastMove !== null && p.afterLastMove <= 600,
      { afterLastMove: p.afterLastMove, startedAfterClick: p.startedAfterClick, bottom });
  },
};
