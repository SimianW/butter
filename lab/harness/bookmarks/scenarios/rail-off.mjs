// The rail off and Butter paused (#54, #71): switched off live, the pill drops its Bookmark cell
// and the dots hide while Ask in branch stays; from a fresh load neither the cell nor a dot shows
// and the page reads no bookmarks; back on, question 7's dot returns.
import { row } from '../fixture.mjs';

const TURN = 6,
  PARA = 3;

export default {
  name: 'rail-off',
  description: 'The rail off and Butter paused: no Bookmark cell, no dot, no bookmark read; back on, the dot returns',
  store: [row(TURN, PARA)],
  async run(qa) {
    const { open, scrollTo, settings, rail, check, page, button, bookmark, pill, dotBeside, selectBlock, requests, dotCount } = qa;
    // 7. Turning the rail off live drops the Bookmark cell and hides the dots at once; Ask in branch stays.
    await open('light');
    const live = await bookmark(TURN, PARA);
    await settings({ opts: { rail: false } });
    await page.waitForTimeout(300);
    const liveOff = await page.evaluate(() => getComputedStyle(document.querySelector('chatgpt-butter-nav')).display);
    const branchOnly = await pill();
    check('rail switched off live: the Bookmark cell and the dots hide; the pill keeps Ask in branch',
      live.kept?.shown && !(await button()) && liveOff === 'none' && branchOnly.cells.map((c) => c.id).join() === 'branch',
      { liveOff, cells: branchOnly.cells.map((c) => c.id) });
    await settings({});
    await page.evaluate(() => getSelection().removeAllRanges());

    // 8. Rail off, then Butter paused, from a fresh load: neither the Bookmark cell nor a dot.
    for (const [name, butter] of [
      ['rail off', { opts: { rail: false } }],
      ['Butter paused', { enabled: false }],
    ]) {
      // Leave the open page first: turning settings back on below would let it read, racing the count.
      await page.goto('about:blank');
      await settings(butter);
      const reads = (await requests())['butter-bookmark-list'] || 0;
      await open('light').catch(() => {});
      await page.waitForTimeout(600);
      const off = await page.evaluate(() => {
        const nav = document.querySelector('chatgpt-butter-nav');
        return {
          marks: nav ? [...nav.shadowRoot.querySelectorAll('.bdot')].filter((m) => m.getBoundingClientRect().width && getComputedStyle(nav).display !== 'none' && nav.hasAttribute('data-on')).length : 0,
        };
      });
      await scrollTo(TURN);
      await selectBlock(TURN, PARA);
      await page.waitForTimeout(400);
      const btn = await button();
      check(`${name}: no dot and no Bookmark cell`, off.marks === 0 && !btn, { off, btn });
      await page.evaluate(() => getSelection().removeAllRanges());
      const after = (await requests())['butter-bookmark-list'] || 0;
      check(`${name}: the page reads no bookmarks`, after === reads, { reads, after });
      await settings({});
    }
    // And back on, the dot returns: question 7's.
    await open('light');
    await dotCount(1);
    check('rail back on: the dot returns', !!dotBeside(await rail(), TURN));
  },
};
