// Saving a paragraph with the selection pill (#77) and what the save draws (#71): the pill beside
// "Ask ChatGPT" (its place and copied look, the cells' order, size, names and aria-keyshortcuts, the
// label after 300 ms, 8 px below, switching at once), no hover button in the left margin, the
// Bookmark cell saving and clearing the selection and the pill, the "Bookmark saved" card top right
// (12 px below the header, 8 px left of the rail, gone after 4 s), ⌥⇧M on it again saying "Already
// bookmarked", the dot beside the right question's tick with its grow-in and halo, the pointer over
// the dot showing the tick's card and a click there opening the question, the card's row landing on
// the paragraph, a reload showing the dot again, the conversation's bookmarks read once and not
// while scrolling, the home page and Back through history showing it again, and dark theme. The
// store keeps hashed ids, the excerpt's first three rendered lines, `ask` and `line` (#55).
export default {
  name: 'save',
  description: 'Save a paragraph with the pill (#77): its look and label, the saved card, the dot (#71), jumps, reload, Back, dark theme',
  async run(qa) {
    const { open, scrollTo, rail, check, PARAGRAPH, page, question, button, bookmark, hoverCell, worker, pill, shots, noteCard, dotBeside, TURNS, stored, answer, PARAS, CONV, sha, selectBlock, shortcut, waitNote, toTop, tickCard, questionTop, jumpByRow, block, requests, dotCount } = qa;
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
  },
};
