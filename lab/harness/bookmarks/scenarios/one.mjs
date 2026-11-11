// A one-question chat: the rail stays hidden, as before, but the Bookmark cell still saves there,
// scrolling reads no bookmarks, and saving again says "Already bookmarked"; once the chat has a
// second question the rail shows its dot beside question 1.
export default {
  name: 'one',
  description: 'A one-question chat: no rail, but the Bookmark cell saves; a second question shows the dot',
  scene: { turns: 1 },
  async run(qa) {
    const { open, serve, page, CONV, answer, bookmark, stored, check, requests, waitNote, noteCard, dotCount, rail, dotBeside } = qa;
    // Not `open`: with one question the rail never turns on.
    await page.goto(`https://chatgpt.com/c/${CONV}`);
    await page.waitForSelector(`[data-fx-answer="${answer(0)}"]`);
    await page.waitForTimeout(1500);
    const railOn = () => page.evaluate(() => !!document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'));
    const PARA = 3;
    const first = await bookmark(0, PARA);
    await first.click();
    await page.waitForTimeout(600);
    const made = await stored();
    check('one question: the Bookmark cell saves a bookmark and the rail stays hidden',
      first.kept?.shown && made.length === 1 && made[0].turn === 0 && made[0].para === PARA && !(await railOn()),
      { button: first.kept, stored: made.length });
    const read = (await requests())['butter-bookmark-list'] || 0;
    for (let k = 0; k < 10; k++) {
      await page.mouse.move(700, 400);
      await page.mouse.wheel(0, k % 2 ? -400 : 400);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    check('one question: scrolling reads no bookmarks', ((await requests())['butter-bookmark-list'] || 0) === read,
      { read, now: (await requests())['butter-bookmark-list'] });
    const again = await bookmark(0, PARA);
    await again.click();
    await waitNote('Already bookmarked');
    const n = await noteCard();
    check('one question: saving the bookmarked paragraph again says "Already bookmarked", with no Undo',
      n.shown && n.title === 'Already bookmarked' && n.buttons.length === 0 && (await stored()).length === 1, { n, stored: (await stored()).length });
    // A second question: the rail shows, with the dot beside question 1.
    serve({ turns: 2 });
    await open();
    await dotCount(1).catch(() => {});
    const two = await rail();
    check('with a second question the rail shows the dot beside question 1', (await stored()).length === 1 && two.dots.length === 1 && !!dotBeside(two, 0),
      { stored: (await stored()).length, dots: two.dots.length });
  },
};
