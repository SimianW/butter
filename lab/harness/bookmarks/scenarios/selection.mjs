// Selection and shortcut (#54): the Bookmark cell's label with the key Chrome reports, a selection
// saved with the cell and with the shortcut (also across paragraphs), the top paragraph with the
// shortcut and nothing selected, nothing for a selection outside the answers, each landing on its
// text; then dark theme and Chinese. The shortcut is real keyboard input under an X display
// (xtest-keys.py), since chrome.commands ignores DevTools key events; without one the worker relays
// the command instead, which skips Chrome's key handling.
export default {
  name: 'selection',
  description: 'Bookmark a selection with the cell and with the shortcut (#54): across paragraphs, the top paragraph, not in a question; dark, Chinese',
  async run(qa) {
    const { open, scrollTo, settings, rail, check, PARAGRAPH, page, question, bookmark, hoverCell, pill, shots, dotBeside, stored, answer, shortcut, jumpByRow, block, select, textTop, headed } = qa;
    await open('light');
    // (a) A selection inside one paragraph, saved with the Bookmark cell: question 3, paragraph 2.
    const SEL = 'reads the table statistics gathered by ANALYZE',
      selText = PARAGRAPH(2, 1),
      selStart = selText.indexOf(SEL);
    await scrollTo(2);
    await select(2, 2, selStart, 2, selStart + SEL.length);
    const selHover = await bookmark(2, 2, false, { keep: true });
    const selTip = await hoverCell('bookmark');
    check('with a selection, the Bookmark cell is named "Bookmark selection" and its label shows the key',
      selHover.kept?.name === 'Bookmark selection' && selTip?.tip?.text === 'Bookmark selection' && selTip.tip.kbd === 'Alt Shift M',
      { name: selHover.kept?.name, tip: selTip?.tip });
    await page.screenshot({ path: `${shots}/button-selection-light.png`, clip: { x: selHover.b.x - 60, y: selHover.b.y - 50, width: 820, height: 260 } });
    await selHover.click();
    await page.waitForTimeout(600);
    let all = await stored();
    const bySel = all.find((b) => b.turn === 2);
    check('the Bookmark cell saves only the selection: its offsets and its text',
      bySel && bySel.para === 2 && bySel.start === selStart && bySel.end === selStart + SEL.length && bySel.excerpt === SEL,
      { bySel });
    check('the click clears the selection and the pill', (await page.evaluate(() => getSelection().isCollapsed)) && !(await pill()).shown);
    check('the selection bookmark has its dot beside question 3', !!dotBeside(await rail(), 2));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking its row lands on the selected text, not the paragraph',
      (await jumpByRow(2)) && Math.abs((await textTop(2, 2, selStart)) - 64) <= 3,
      { fromTop: await textTop(2, 2, selStart), paragraph: (await block(2, 2)).fromTop });

    // (b) A selection across paragraphs, saved with the shortcut: question 5, paragraphs 2 to 3.
    const crossStart = PARAGRAPH(4, 1).indexOf('weighs the share');
    await scrollTo(4);
    await page.mouse.move(10, 10);
    await select(4, 2, crossStart, 3, 'Fixture answer 5 paragraph 3'.length);
    await shortcut();
    all = await stored();
    const cross = all.find((b) => b.turn === 4);
    check('the shortcut saves a selection across paragraphs, anchored to its first paragraph',
      cross && cross.para === 2 && cross.start === crossStart && cross.end === PARAGRAPH(4, 1).length &&
        cross.excerpt.startsWith('weighs the share') && [...cross.excerpt].length <= 240,
      { cross, via: headed ? 'Alt+Shift+M through XTest' : 'the worker relaying the command' });
    check('its dot is beside question 5', !!dotBeside(await rail(), 4));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking its row lands on the selection\'s start',
      (await jumpByRow(4)) && Math.abs((await textTop(4, 2, crossStart)) - 64) <= 3, { fromTop: await textTop(4, 2, crossStart) });

    // (c) Nothing selected: the shortcut bookmarks the first answer paragraph at or below the header.
    // Question 9's paragraph 2 sits 40 px down, under the 52 px header: paragraph 3 is the one.
    // Off-screen turns skip layout, so their boxes are estimates until they come into view: scroll,
    // let layout catch up, and measure again until the paragraph sits there.
    for (let k = 0; k < 8; k++) {
      const off = await page.evaluate((id) => {
        const sc = document.querySelector('.thread-scroll-container');
        const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).children[2];
        const d = p.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
        sc.scrollTop += d;
        return d;
      }, answer(8));
      await page.waitForTimeout(150);
      if (Math.abs(off) < 1) break;
    }
    await page.waitForTimeout(300);
    await shortcut();
    all = await stored();
    const top = all.find((b) => b.turn === 8);
    check('with nothing selected the shortcut bookmarks the top paragraph below the header',
      top && top.para === 3 && top.start === 0 && top.end === PARAGRAPH(8, 2).length && PARAGRAPH(8, 2).startsWith(top.excerpt),
      { top });
    check('its dot is beside question 9', !!dotBeside(await rail(), 8));
    check('clicking its row lands on that paragraph', (await jumpByRow(8)) && Math.abs((await block(8, 3)).fromTop - 64) <= 3,
      { fromTop: (await block(8, 3)).fromTop });

    // (d) A selection outside the answers (the user's question) creates nothing.
    const count = (await stored()).length;
    await scrollTo(10);
    await page.evaluate((id) => {
      const q = document.querySelector(`[data-turn-key="${id}"] [data-user-message-bubble]`);
      getSelection().selectAllChildren(q);
    }, question(10));
    await shortcut();
    check('a selection in a question creates nothing', (await stored()).length === count && !dotBeside(await rail(), 10));
    await page.evaluate(() => getSelection().removeAllRanges());

    // (e) Dark theme, the selection's label; then Chinese.
    await open('dark');
    await scrollTo(2);
    await select(2, 2, selStart, 2, selStart + SEL.length);
    const selDark = await bookmark(2, 2, false, { keep: true });
    const selDarkTip = await hoverCell('bookmark');
    await page.screenshot({ path: `${shots}/button-selection-dark.png`, clip: { x: selDark.b.x - 60, y: selDark.b.y - 50, width: 820, height: 260 } });
    check('dark theme: the selection label shows', selDarkTip?.tip?.text === 'Bookmark selection');
    await settings({ lang: 'zh' });
    await page.waitForTimeout(400);
    await page.mouse.move(10, 10);
    const zhTip = await hoverCell('bookmark');
    check('in Chinese the Bookmark cell and its label read 为选中内容加书签, Ask in branch 在分支中问',
      zhTip?.tip?.text === '为选中内容加书签' && zhTip.cells.find((c) => c.id === 'bookmark')?.name === '为选中内容加书签' &&
        zhTip.cells.find((c) => c.id === 'branch')?.name === '在分支中问',
      { tip: zhTip?.tip, cells: zhTip?.cells.map((c) => c.name) });
    await settings({});
    await page.evaluate(() => getSelection().removeAllRanges());
  },
};
