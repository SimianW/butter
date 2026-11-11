// List items (#51): each item of a top-level list is a paragraph of its own for the Bookmark cell,
// a selection, the shortcut's top paragraph, landing, and staleness after a reload.
export default {
  name: 'list-items',
  description: 'List items (#51): each item is its own paragraph for the cell, a selection, the shortcut, landing and a reload',
  async run(qa) {
    const { open, rail, check, page, bookmark, dotBeside, stored, answer, PARAS, shortcut, jumpByRow, block, select } = qa;
    await open('light');
    // (d2) List items (#51): each item of a top-level list is a paragraph of its own. Question 4's
    // answer ends in a two-item list: blocks 6 and 7.
    const LI = 7,
      LI_TEXT = 'Fixture list item two';
    await page.mouse.move(10, 10);
    const liHover = await bookmark(3, LI, true);
    check('a list item selected whole shows the Bookmark cell', !!liHover.kept?.shown, { button: liHover.kept });
    await liHover.click();
    await page.waitForTimeout(600);
    const liMark = (await stored()).find((b) => b.turn === 3);
    check('the Bookmark cell bookmarks that item alone', liMark && liMark.para === LI && liMark.start === 0 && liMark.end === LI_TEXT.length && liMark.excerpt === LI_TEXT,
      { liMark });
    check('clicking its row lands on that item, not on the start of the list',
      (await jumpByRow(3)) && Math.abs((await block(3, LI)).fromTop - 64) <= 3,
      { fromTop: (await block(3, LI)).fromTop, list: (await block(3, LI - 1)).fromTop });
    // A selection inside the first item, saved with the Bookmark cell.
    await select(3, LI - 1, 8, LI - 1, 12);
    const liSel = await bookmark(3, LI - 1, false, { keep: true });
    await liSel.click();
    await page.waitForTimeout(600);
    await page.evaluate(() => getSelection().removeAllRanges());
    const liSelMark = (await stored()).find((b) => b.turn === 3 && b.para === LI - 1);
    check('a selection in a list item is anchored to that item', liSelMark && liSelMark.start === 8 && liSelMark.end === 12 && liSelMark.excerpt === 'list',
      { liSelMark });
    // The shortcut with nothing selected: the first item sits under the header, so the second is the top paragraph.
    for (let k = 0; k < 8; k++) {
      const off = await page.evaluate(([id, PARAS]) => {
        const sc = document.querySelector('.thread-scroll-container');
        const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[6];
        const d = p.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
        sc.scrollTop += d;
        return d;
      }, [answer(5), PARAS]);
      await page.waitForTimeout(150);
      if (Math.abs(off) < 1) break;
    }
    await page.waitForTimeout(300);
    await shortcut();
    const liTop = (await stored()).find((b) => b.turn === 5);
    check('with nothing selected the shortcut takes the list item at the top', liTop && liTop.para === LI && liTop.excerpt === LI_TEXT, { liTop });
    // After a reload both list items' bookmarks resolve: live, not "answer changed".
    await open('light');
    await page.waitForTimeout(400);
    // Questions 4 and 6: the only ticks whose names hold the second item's text; their dots solid.
    const liRail = await rail(),
      liTicks = liRail.ticks.map((t, i) => [i, t.label]).filter(([, l]) => l.includes(LI_TEXT));
    check('after a reload the list items\' bookmarks are live', liTicks.length === 2 &&
      liTicks.every(([i, l]) => !l.includes('(answer changed)') && dotBeside(liRail, i) && !dotBeside(liRail, i).cls.includes('stale')), { liTicks });
  },
};
