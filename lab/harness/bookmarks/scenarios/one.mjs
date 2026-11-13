// A one-question chat: the rail shows one tick, lit, and hovering it shows the card "1 / 1". The
// Bookmark cell saves there: the dot shows beside that tick and the tick's card lists the bookmark
// with its ×, in light and dark; scrolling reads no bookmarks again, and saving again says "Already
// bookmarked". Once the chat has a second question the dot stays beside question 1. Shots, named
// by the panels of the one-question rail's mockup: after-plain, after-plain-hover, after-bookmark,
// after-bookmark-hover and after-bookmark-hover-dark.
export default {
  name: 'one',
  description: 'A one-question chat: one tick with its card; the Bookmark cell saves, its dot and card show there; a second question keeps the dot',
  scene: { turns: 1 },
  async run(qa) {
    const { open, serve, page, stored, check, requests, waitNote, noteCard, dotCount, rail, dotBeside, bookmark, hoverTick, tickCard, shots } = qa;
    // Away from the rail, so that it is at rest: only the question being read lit.
    const rest = async () => {
      await page.mouse.move(700, 300);
      await page.waitForTimeout(600);
    };
    const shoot = (name) => page.screenshot({ path: `${shots}/${name}.png` });
    await open();
    await rest();
    const plain = await rail();
    check('one question: the rail shows one tick, lit at 21 px, with no dot',
      plain.visible && plain.ticks.length === 1 && Math.abs(plain.ticks[0].w - 21) <= 0.5 && plain.dots.length === 0,
      { visible: plain.visible, ticks: plain.ticks.map((t) => t.w), dots: plain.dots.length });
    await shoot('after-plain');
    await hoverTick(0);
    const tip = await tickCard();
    check('one question: hovering the tick shows its card, "1 / 1" and the question',
      tip.shown && !tip.merged && tip.meta === '1 / 1' && !!tip.text && tip.rows.length === 0,
      { shown: tip.shown, meta: tip.meta, text: tip.text, rows: tip.rows.length });
    await shoot('after-plain-hover');

    const PARA = 3;
    const first = await bookmark(0, PARA);
    await first.click();
    await page.waitForTimeout(600);
    const made = await stored();
    await dotCount(1).catch(() => {});
    await rest();
    const marked = await rail();
    check('one question: the Bookmark cell saves a bookmark and its dot shows beside the tick',
      first.kept?.shown && made.length === 1 && made[0].turn === 0 && made[0].para === PARA && marked.dots.length === 1 && !!dotBeside(marked, 0),
      { button: first.kept, stored: made.length, dots: marked.dots.length });
    // The "Bookmark saved" notice leaves after 4 s (bookmarks/notice.js); the shots show the rail alone.
    await page.waitForTimeout(4500);
    await shoot('after-bookmark');
    await hoverTick(0);
    const card = await tickCard();
    check("one question: the tick's card lists the bookmark under \"1 / 1\", with its ×",
      card.shown && card.merged && card.meta === '1 / 1' && card.rows.length === 1 && !!card.rows[0].xLabel,
      { shown: card.shown, merged: card.merged, meta: card.meta, rows: card.rows.length, x: card.rows[0]?.xLabel });
    // The pointer onto the row, so that its × shows as the mockup draws it.
    await page.mouse.move(card.rows[0].x - 40, card.rows[0].y, { steps: 12 });
    await page.waitForTimeout(300);
    await shoot('after-bookmark-hover');

    // Every render syncs the bookmark session; scrolling must not read the stored list again.
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

    // Dark theme: the same card.
    await open('dark');
    await dotCount(1).catch(() => {});
    await hoverTick(0);
    const dark = await tickCard();
    check("one question, dark: the tick's card lists the bookmark",
      dark.shown && dark.merged && dark.meta === '1 / 1' && dark.rows.length === 1,
      { shown: dark.shown, meta: dark.meta, rows: dark.rows.length });
    await page.mouse.move(dark.rows[0].x - 40, dark.rows[0].y, { steps: 12 });
    await page.waitForTimeout(300);
    await shoot('after-bookmark-hover-dark');

    // A second question: the dot stays beside question 1.
    serve({ turns: 2 });
    await open();
    await dotCount(1).catch(() => {});
    const two = await rail();
    check('with a second question the dot stays beside question 1', (await stored()).length === 1 && two.dots.length === 1 && !!dotBeside(two, 0),
      { stored: (await stored()).length, dots: two.dots.length });
  },
};
