// The dot's close-ups in the #69 mockup's section 2, shot at three times their size (`s-*`, compared
// with their panels when BUTTER_BOOKMARKS_DOT_MOCKUP is set): a 7-question chat with question 4
// being read and questions 2, 4 and 6 holding bookmarks (6's stale), at rest in both themes
// (`s-rest-*`), under the pointer (`s-wave-light`), and a new bookmark at its halo's widest
// (`s-new-light`, its animations paused as they start); then a new and a deleted dot under reduced
// motion: no grow-in, halo or fade.
import { goneRow, row } from '../fixture.mjs';
import { panels } from '../mockup.mjs';

// A live bookmark on block `para` of question `turn`'s answer, and a stale one (its paragraph no
// longer holds its text).
const live = (turn, time, para = 0) => row(turn, para, { time }),
  gone = (turn, time) => goneRow(turn, { time });

export default {
  name: 'dot-closeups',
  description: "The dot's #69 close-ups at 3x: a 7-question chat at rest, under the pointer, a new dot's halo; reduced motion",
  scene: { tail: 40, turns: 7 },
  store: [live(1, 1), live(3, 2), gone(5, 3)],
  async run(qa) {
    const { open, page, seedStore, dotCount, rail, dotBeside, check, bookmark, toTop, removeRow, readAt, lit, railBox } = qa;
    const mockup = panels(qa);
    let r;
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(3);
      await readAt(3);
      r = await rail();
      check(`close-up (${theme}): question 4 alone is lit, dots beside 2, 4 and 6`, JSON.stringify(lit(r)) === '[[3,21]]' &&
        !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5), { lit: lit(r) });
      await mockup.strip(`s-rest-${theme}`);
    }
    // Under the pointer, on question 3's row. The mockup draws the wave without the rail's hover look,
    // which #71 doesn't change: the ticks thickening up to 1.6 times under the pointer, and the pill
    // behind the rail, whose bottom edge and shadow fall in the strip. Each tick's own box and the
    // pill's bottom edge are left out of the comparison; the dots and the rest are compared. The
    // dots sit on fractions of a pixel here: the rail moves them as it scales the ticks, drawn
    // between pixels, where the mockup's are placed and snapped to whole ones, so a pixel matches
    // when one within a device pixel of it in the mockup does.
    await open('light');
    await dotCount(3);
    await readAt(3);
    r = await rail();
    await page.mouse.move(r.ticks[2].x, r.ticks[2].y - 20, { steps: 3 });
    await page.mouse.move(r.ticks[2].x, r.ticks[2].y, { steps: 6 });
    await page.waitForTimeout(1500);
    r = await rail();
    check('under the pointer: each dot 4 px from its lengthened tick', !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5) && r.ticks[2].w > 31,
      { widths: r.ticks.map((t) => t.w) });
    const box7 = await railBox();
    await mockup.strip('s-wave-light', [...mockup.ticksOut(r, 15), { x: 0, y: (box7.h - 2 - 14) * 3, w: 154, h: 394 }], true);
    // A new bookmark under question 2: its motion is paused as it starts, the page goes back to
    // question 4, and the dot is shot at the halo's widest (300 ms into the halo).
    await page.mouse.move(700, 300);
    await seedStore([live(3, 2), gone(5, 3)], { clear: true });
    await open('light');
    await dotCount(2);
    const made = await bookmark(1, 0);
    await made.click();
    const paused = await page
      .waitForFunction(() => {
        const d = [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot.new')][0];
        if (!d || d.getAnimations().length < 2) return null;
        d.getAnimations().forEach((a) => a.pause());
        return d.getAnimations().map((a) => a.animationName);
      })
      .then((h) => h.jsonValue());
    await readAt(3);
    await page.evaluate(() => {
      for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new').getAnimations()) a.currentTime = 480;
    });
    await page.waitForTimeout(100);
    r = await rail();
    check('a new bookmark\'s dot: grow-in, then the halo; at its widest, 4 px around the dot', JSON.stringify(paused) === '["dot-in","dot-halo"]' &&
      /4px$/.test(dotBeside(r, 1)?.ring ?? '') && JSON.stringify(lit(r)) === '[[3,21]]', { paused, ring: dotBeside(r, 1)?.ring });
    await mockup.strip('s-new-light');
    await page.evaluate(() => {
      for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new')?.getAnimations() ?? []) a.finish();
    });
    // Reduced motion: no grow-in, no halo, no fade.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toTop(); // a wheel turn ends the pin the jump left on question 4
    const still = await bookmark(4, 0);
    await still.click();
    await dotCount(4);
    const quiet = await page.evaluate(() =>
      [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].map((d) => d.getAnimations().length),
    );
    check('reduced motion: a new dot appears with no grow-in and no halo', quiet.every((n) => n === 0), { quiet });
    await removeRow(4, 0); // × on the tick's card, the only remove (#77)
    await page.waitForTimeout(100);
    const left = await page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
    check('reduced motion: a deleted question\'s dot goes at once, with no fade', left === 3, { left });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await mockup.match();
  },
};
