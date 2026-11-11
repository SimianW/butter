// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.

// The default path (steps 1 to 10, legacy `main`, in main-save.mjs and main-cards.mjs):
// select a paragraph, the pill 4 px right of "Ask ChatGPT" (its look copied, Ask in branch
// then Bookmark, 32 px cells, names and aria-keyshortcuts, the label after 300 ms, 8 px below,
// switching at once), no hover button in the left margin, the Bookmark cell saves and clears the
// selection and the pill, the "Bookmark saved" card top right (12 px below the header, 8 px left of
// the rail, gone after 4 s), ⌥⇧M on it again says "Already bookmarked", a dot appears beside the
// right question's tick (#71) with its grow-in and halo, the pointer over the dot shows the tick's
// card and a click there opens the question, the card's row lands on the paragraph, a reload shows
// the dot again, the conversation's bookmarks are read once and not during scrolling, going to the
// home page and Back through history shows the dot again, and with the rail off or Butter paused
// neither the Bookmark cell nor a dot shows.
// The rail's hover card (#53), now the tick's card (#70): one and several bookmarks, moving onto the
// card, jumping from a row, deleting with × ("Bookmark removed", whose Undo brings back the same
// key and time), the dot fading out (at once under reduced motion), keyboard-only jump and delete
// with arrow stops on the ticks only, and light and dark screenshots of both cards.
// The first bookmark ever (#56, #77): the expanded card at top right (the consent card staying
// bottom right), Undo deletes the bookmark and its dot and the next save expands it again (light
// and dark, English and Chinese, with layout consent pending, declined, granted and switched off),
// Got it leaves only the small card on a third save and after a reload; the pointer holds a card.
// Selection and shortcut (#54): the Bookmark cell's label and the key Chrome reports, a selection
// saved with the cell and with the shortcut (also across paragraphs), the top paragraph with the
// shortcut and nothing selected, nothing for a selection outside the answers, each landing on its
// text, and no key hint once the command's key is cleared in chrome://extensions/shortcuts.
// List items (#51): each item of the fixture answer's list is a paragraph of its own for the
// cell, a selection, the shortcut's top paragraph, landing and staleness. The store keeps `ask` and
// `line` (#55).

// Steps 1 to 8: a save with the pill, its card and dot, jumps, reload, history,
// dark theme, selection and shortcut (#54), list items (#51), the rail off and Butter paused.
export async function mainSave(qa) {
  const { settings, rail, check, PARAGRAPH, page, question, button, bookmark, hoverCell, worker, pill, shots, noteCard, dotBeside, TURNS, stored, answer, PARAS, CONV, sha, selectBlock, shortcut, waitNote, toTop, tickCard, questionTop, jumpByRow, block, requests, dotCount, select, textTop, headed, context } = qa;
  await settings({});
  await open();
  const before = await rail();
  check('rail draws no dot before any bookmark', before.dots.length === 0);

  // 1. Select a paragraph, the pill's Bookmark cell (#77): a dot appears beside question 7's tick (#71).
  const TURN = 6,
    PARA = 3, // the narrow paragraph: blocks are p, h3, p, p, p, p, ul
    TEXT = PARAGRAPH(TURN, 2);
  // The user's own question gets no Bookmark cell.
  await scrollTo(TURN);
  await page.waitForTimeout(1200);
  await page.evaluate((id) => getSelection().selectAllChildren(document.querySelector(`[data-turn-key="${id}"] [data-user-message-bubble]`)), question(TURN));
  await page.waitForTimeout(400);
  check('a selection in the user question shows no Bookmark cell', !(await button()));
  await page.evaluate(() => getSelection().removeAllRanges());
  const hover = await bookmark(TURN, PARA);
  const p1 = hover.kept?.pill;
  check('no hover button in the left margin any more', p1 && !p1.hoverButton);
  check('the pill sits 4 px right of "Ask ChatGPT", top edges aligned, 30 px high, inside <body>',
    p1 && Math.round(p1.box.left - p1.native.right) === 4 && Math.round(p1.box.top) === Math.round(p1.native.top) && p1.box.height === 30 && p1.inBody,
    { pill: p1?.box, native: p1?.native });
  check('the pill copies "Ask ChatGPT"’s background, radius and shadow',
    p1 && JSON.stringify(p1.css) === JSON.stringify(p1.nativeCss), { pill: p1?.css, native: p1?.nativeCss });
  check('Ask in branch, then Bookmark: icon cells 32 px wide with a 1 px divider',
    p1 && p1.cells.map((c) => c.id).join() === 'branch,bookmark' && p1.cells.every((c) => c.width === 32 && c.height === 30 && !c.text) &&
      p1.cells[1].divider === '1px' && p1.box.width === 64,
    { cells: p1?.cells });
  check('the cells are named by their labels; the Bookmark cell carries its key in aria-keyshortcuts',
    p1 && p1.cells[0].name === 'Ask in branch' && p1.cells[1].name === 'Bookmark selection' && p1.cells[1].keys === 'Alt+Shift+M' && !p1.cells[0].keys,
    { cells: p1?.cells.map(({ name, keys }) => ({ name, keys })) });
  // The label: not at 100 ms, shown by 350 ms, 8 px below the pill, centred under its cell.
  const early = await hoverCell('bookmark', 100);
  const late = await hoverCell('bookmark', 250);
  const cellBox = late?.cells[1];
  // Chrome assigned the suggested key (it does not when the key is one of its own); the label
  // shows it as the mockup writes keys.
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  check('the label waits 300 ms, then shows "Bookmark selection" and the key 8 px below the pill, under its cell',
    !early?.tip && late?.tip?.text === 'Bookmark selection' && late.tip.kbd === 'Alt Shift M' && late.tip.kbdShown &&
      Math.round(late.tip.top - late.box.bottom) === 8 && Math.abs(late.tip.left + late.tip.width / 2 - (cellBox.left + cellBox.width / 2)) <= 1 &&
      commands.find((c) => c.name === 'bookmark')?.shortcut === 'Alt+Shift+M',
    { early: early?.tip, tip: late?.tip, commands });
  const toBranch = await hoverCell('branch', 0);
  check('moving to the other cell switches the label at once', toBranch?.tip?.text === 'Ask in branch', { tip: toBranch?.tip });
  await page.mouse.move(10, 10);
  await page.waitForTimeout(100);
  check('the label goes when the pointer leaves the pill', !(await pill()).tip);
  await page.screenshot({ path: `${shots}/button-light.png`, clip: { x: hover.b.x - 60, y: hover.b.y - 50, width: 820, height: 260 } });
  await hover.click();
  // The new dot's motion, read before it ends: its animations, their timing and the halo's widest.
  const motion = await page
    .waitForFunction(() => {
      const d = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot');
      if (!d) return null;
      const halo = d.getAnimations().find((a) => a.animationName === 'dot-halo');
      return {
        cls: d.className,
        easing: getComputedStyle(d).animationTimingFunction,
        anims: d.getAnimations().map((a) => ({ name: a.animationName, duration: a.effect.getTiming().duration, delay: a.effect.getTiming().delay, iterations: a.effect.getTiming().iterations })),
        grow: d.getAnimations().find((a) => a.animationName === 'dot-in')?.effect.getKeyframes().map((k) => k.scale),
        halo: halo?.effect.getKeyframes().find((k) => k.offset === 0.5)?.boxShadow,
      };
    })
    .then((h) => h.jsonValue());
  // After the dot's motion is read (its grow-in lasts 180 ms): the page and the card.
  check('clicking Bookmark clears the selection and the pill',
    (await page.evaluate(() => getSelection().isCollapsed)) && !(await pill()).shown);
  const savedCard = await noteCard(); // read now: it leaves 4 s after it shows
  await page.waitForTimeout(60);
  const made = await rail();
  const tick = made.ticks[TURN],
    pitch = made.ticks[1].y - made.ticks[0].y;
  check("one dot, beside question 7's tick: on its row, its right edge 4 px left of the tick", made.dots.length === 1 && !!dotBeside(made, TURN),
    { dot: made.dots[0], tick });
  check('the new dot grows in from 0 over 180 ms, cubic-bezier(.2, .8, .2, 1), then one 600 ms halo, 4 px, at 35 %',
    motion.cls.includes('new') && motion.easing.startsWith('cubic-bezier(0.2, 0.8, 0.2, 1)') &&
      JSON.stringify(motion.anims) === JSON.stringify([{ name: 'dot-in', duration: 180, delay: 0, iterations: 1 }, { name: 'dot-halo', duration: 600, delay: 180, iterations: 1 }]) &&
      motion.grow?.[0] === '0' && / 4px$/.test(motion.halo) && /\/ 0\.35\)/.test(motion.halo),
    motion);
  await page.waitForTimeout(900);
  const settled = (await rail()).dots[0];
  check('the dot is a 4 px circle in #d39e10; it takes no pointer events, is not focusable and is hidden from the accessibility tree',
    settled.w === 4 && settled.h === 4 && settled.radius === '50%' && settled.color === 'rgb(211, 158, 16)' && settled.opacity === 1 &&
      settled.pe === 'none' && settled.hidden === 'true' && settled.tag === 'I' && settled.tabIndex === -1,
    { settled });
  await page.screenshot({ path: `${shots}/rail-light.png`, clip: { x: 1400 - 120, y: made.ticks[0].y - 30, width: 120, height: pitch * TURNS + 60 } });
  const saved = await stored();
  const excerpt = saved[0]?.excerpt ?? '';
  // Which rendered line the excerpt's last character and the next word start on, measured here.
  // And the text of its first rendered line.
  const cut = await page.evaluate(
    ([id, k, n, PARAS]) => {
      const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
      const text = p.firstChild,
        r = document.createRange(),
        top = (i) => {
          r.setStart(text, i);
          r.setEnd(text, i + 1);
          return r.getClientRects()[0].top;
        };
      const line = (i) => Math.round((top(i) - top(0)) / 26) + 1;
      let i = 0;
      while (i < text.data.length && line(i) === 1) i++;
      return { last: line(n - 1), next: line(n + 1), first: text.data.slice(0, i).trim() };
    },
    [answer(TURN), PARA, excerpt.length, PARAS],
  );
  check('the store holds one bookmark with hashed ids and the first three lines as its excerpt',
    saved.length === 1 && [saved[0].account, saved[0].conv, saved[0].msg].every((h) => /^[a-f0-9]{64}$/.test(h)) &&
      saved[0].para === PARA && saved[0].turn === TURN && TEXT.startsWith(excerpt) &&
      cut.last === 3 && cut.next === 4,
    { excerpt, length: excerpt.length, cut, para: saved[0]?.para, turn: saved[0]?.turn });
  check('no raw ids reach the store', !JSON.stringify(saved).includes(CONV) && !JSON.stringify(saved).includes(answer(TURN)) &&
    !JSON.stringify(saved).includes(question(TURN)));
  check('the store keeps the hashed id of the question it was made under (#55)', saved[0]?.ask === sha(question(TURN)), { ask: saved[0]?.ask });
  check("the store keeps the length of the excerpt's first rendered line (#55)",
    cut.first.length > 0 && cut.first.length < 80 && saved[0]?.line === cut.first.length && excerpt.startsWith(cut.first),
    { line: saved[0]?.line, first: cut.first });

  // 2. The save's card (#77), top right; then ⌥⇧M on the same paragraph says it is already bookmarked.
  check('the save shows "Bookmark saved" top right: 300 px, 12 px below the header, 8 px left of the rail, with its first words and Undo',
    savedCard.title === 'Bookmark saved' && savedCard.width === 300 && Math.round(savedCard.top) === 64 &&
      Math.round(1400 - savedCard.right) === savedCard.railInset + 52 + 8 && savedCard.excerpt === excerpt.replace(/\s+/g, ' ') &&
      savedCard.oneLine && JSON.stringify(savedCard.buttons) === '["Undo"]' && savedCard.role === 'status' && !savedCard.focused,
    savedCard);
  await page.waitForTimeout(4300);
  check('the small card leaves by itself after 4 s', !(await noteCard()).shown);
  await scrollTo(TURN);
  await selectBlock(TURN, PARA);
  await shortcut();
  await waitNote('Already bookmarked');
  const already = await noteCard();
  check('⌥⇧M on a bookmarked paragraph: "Already bookmarked", its first words, no Undo; saved once',
    already.title === 'Already bookmarked' && already.buttons.length === 0 && (await stored()).length === 1 && (await rail()).dots.length === 1,
    { already, stored: (await stored()).length });
  await page.evaluate(() => getSelection().removeAllRanges());

  // 3. The dot is not a target: the pointer over it is over its tick's row, which shows the tick's card.
  await toTop();
  const r0 = await rail(),
    d0 = dotBeside(r0, TURN);
  await page.mouse.move(d0.x, d0.y, { steps: 4 });
  await page.waitForTimeout(350);
  const overDot = await tickCard();
  check("the pointer over the dot shows its tick's card", overDot.shown && overDot.merged && overDot.name === 'Bookmark · question 7 of 12',
    { name: overDot.name, merged: overDot.merged });

  // 4. A click on the dot's position opens the question; the card's row lands on the paragraph.
  await page.mouse.click(d0.x, d0.y);
  await page.waitForTimeout(3500);
  check("a click on the dot's position opens its question", Math.abs((await questionTop(TURN)) - 64) <= 3, { fromTop: await questionTop(TURN) });
  const viaRow = await jumpByRow(TURN);
  const landed = await block(TURN, PARA);
  check("clicking the bookmark's row in the tick's card lands on the bookmarked paragraph", viaRow && Math.abs(landed.fromTop - 64) <= 3, { fromTop: landed.fromTop });
  // A click on the tick itself still lands on the question.
  await toTop();
  const r1 = await rail();
  await page.mouse.click(r1.ticks[TURN].x, r1.ticks[TURN].y);
  await page.waitForTimeout(3500);
  const q = await questionTop(TURN);
  check('clicking the tick still lands on the question', Math.abs(q - 64) <= 3, { fromTop: q });

  // 5. Reload: the dot is back, without the grow-in, from one read.
  const read = (await requests())['butter-bookmark-list'] || 0;
  await open();
  await dotCount(1);
  const reloaded = await rail();
  check('after a reload the dot is beside question 7 again', reloaded.dots.length === 1 && !!dotBeside(reloaded, TURN) &&
    !reloaded.dots[0].cls.includes('new'));
  const afterLoad = (await requests())['butter-bookmark-list'] || 0;
  for (let k = 0; k < 20; k++) {
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  const afterScroll = await requests();
  check('bookmarks are read once per conversation and not while scrolling',
    afterLoad - read === 1 && (afterScroll['butter-bookmark-list'] || 0) === afterLoad, { read, afterLoad, afterScroll });

  // 5b. Away to ChatGPT's home and Back through history (no reload): the rail leaves the chat and
  // comes back to it, and its dot with it; hovering the rail is not needed.
  await page.mouse.move(700, 400);
  await page.evaluate(() => history.pushState({}, '', '/'));
  await page.waitForFunction(() => !document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
  await page.waitForTimeout(1000);
  const backAgain = await rail();
  check('away to the home page and Back: the dot is beside question 7 again', backAgain.dots.length === 1 && !!dotBeside(backAgain, TURN),
    { dots: backAgain.dots.length });

  // 6. Dark theme: the dot in dark butter, the pill in ChatGPT's dark button colours.
  await open('dark');
  await dotCount(1);
  const dark = await rail();
  check('dark theme dot is #e3c766', dark.dots[0].color === 'rgb(227, 199, 102)', { color: dark.dots[0].color });
  await page.screenshot({ path: `${shots}/rail-dark.png`, clip: { x: 1400 - 120, y: dark.ticks[0].y - 30, width: 120, height: pitch * TURNS + 60 } });
  const hoverDark = await bookmark(2, 0);
  const darkTip = await hoverCell('bookmark');
  await page.screenshot({ path: `${shots}/button-dark.png`, clip: { x: hoverDark.b.x - 60, y: hoverDark.b.y - 50, width: 820, height: 260 } });
  check('dark theme: the pill copies the dark "Ask ChatGPT"; the label turns white',
    darkTip?.shown && JSON.stringify(darkTip.css) === JSON.stringify(darkTip.nativeCss) && darkTip.css.bg === 'rgb(58, 58, 58)' &&
      (await page.evaluate(() => getComputedStyle(document.querySelector('chatgpt-butter-pill').shadowRoot.querySelector('.tip')).backgroundColor)) === 'rgb(255, 255, 255)',
    { css: darkTip?.css });
  await page.evaluate(() => getSelection().removeAllRanges());

  // 6b. Selection and shortcut (#54).
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

  // (f) Clear the command's key in Chrome's shortcut settings: the tooltip shows no hint.
  const settingsPage = await context.newPage();
  await settingsPage.goto('chrome://extensions/shortcuts');
  // The action's input has no key (its Clear is disabled); the bookmark command's is the other one.
  await settingsPage.locator('cr-shortcut-input #clear:not([disabled])').click();
  await settingsPage.waitForTimeout(300);
  await settingsPage.close();
  const cleared = await worker.evaluate(() => chrome.commands.getAll());
  await open('light');
  await bookmark(TURN, 2);
  await page.waitForTimeout(300); // the key is read again as the cell shows
  const noKey = await hoverCell('bookmark');
  const noKeyCell = noKey?.cells.find((c) => c.id === 'bookmark');
  check('with the key cleared, the label shows no shortcut hint and the cell no aria-keyshortcuts',
    cleared.find((c) => c.name === 'bookmark')?.shortcut === '' && noKey?.tip?.text === 'Bookmark selection' && noKey.tip.kbd === '' &&
      !noKey.tip.kbdShown && noKeyCell?.keys === null,
    { cleared, tip: noKey?.tip, keys: noKeyCell?.keys });
  await page.evaluate(() => getSelection().removeAllRanges());
  // Leave the store and the key as the later sections expect: only question 7's bookmark.
  await worker.evaluate(async () => {
    const db = await database(),
      tx = db.transaction('bookmarks', 'readwrite'),
      rows = tx.objectStore('bookmarks');
    const all = await new Promise((ok) => (rows.getAll().onsuccess = (e) => ok(e.target.result)));
    for (const b of all) if (b.turn !== 6) rows.delete(b.key);
    await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
  });

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
  return { TURN, PARA, saved };
}
