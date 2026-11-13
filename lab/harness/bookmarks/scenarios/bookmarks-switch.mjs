// The popup's Bookmarks switch (#108), clicked in the real popup page: off live, the pill drops its
// Bookmark cell, the dots go and the shortcut saves nothing, while the saved bookmark stays in the
// store and the rail and Ask in branch stay; on again, the dot returns without a reload and the
// Bookmark cell is back.
import { row } from '../fixture.mjs';

const TURN = 6,
  PARA = 3;

export default {
  name: 'bookmarks-switch',
  description: 'The popup’s Bookmarks switch: off hides the Bookmark cell and dots and mutes the shortcut, keeping the store; on brings them back live',
  store: [row(TURN, PARA)],
  async run(qa) {
    const { open, check, page, popup, bookmark, button, pill, shortcut, stored, dotCount, allDots, rail, dotBeside, scrollTo, selectBlock } = qa;
    await open('light');
    await dotCount(1);
    // Off, by a click on the row's name, as the reader would: the label toggles its switch.
    const p = await popup();
    await p.locator('label[for="sw-bookmarks"] .n').click();
    const off = await p.locator('#sw-bookmarks').getAttribute('aria-checked');
    const setting = await p.evaluate(async () => (await chrome.storage.local.get('butter')).butter.opts.bookmark);
    check('a click on the Bookmarks row switches Bookmarks off', off === 'false' && setting === false, { off, setting });
    await page.bringToFront();
    await page.waitForTimeout(400);
    let dotsOff = -1;
    await dotCount(0).then(() => (dotsOff = 0), async () => (dotsOff = await allDots()));
    const railShown = await page.evaluate(() => document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'));
    check('off: the dots go without a reload, the rail stays', dotsOff === 0 && railShown, { dotsOff, railShown });
    await scrollTo(2);
    await selectBlock(2, 1);
    await page.waitForTimeout(500);
    const cells = (await pill()).cells.map((c) => c.id).join();
    check('off: the pill shows Ask in branch and no Bookmark cell', cells === 'branch' && !(await button()), { cells });
    const before = (await stored()).length;
    await shortcut();
    await page.evaluate(() => getSelection().removeAllRanges());
    await shortcut(); // nothing selected: the paragraph at the top would be saved
    const after = await stored();
    check('off: the shortcut saves nothing, and the saved bookmark is kept', before === 1 && after.length === 1 && after[0].turn === TURN, {
      before,
      after: after.length,
    });

    // On again, from the popup: the dot is back in the open tab without a reload, and the cell.
    await p.bringToFront();
    await p.locator('#sw-bookmarks').click();
    await page.bringToFront();
    let back = true;
    await dotCount(1).catch(() => (back = false));
    check('on again: the dot returns without a reload', back && !!dotBeside(await rail(), TURN));
    const again = await bookmark(2, 1);
    check('on again: the Bookmark cell is back in the pill', !!again.kept?.shown);
    await page.evaluate(() => getSelection().removeAllRanges());
    await p.close();
  },
};
