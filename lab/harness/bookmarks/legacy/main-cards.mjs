// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.

// The default path's steps 9 and 10: the rail's hover card (#53) and the first bookmark ever (#56, #77).
export async function mainCards(qa, { TURN, saved, PARA }) {
  const { open, stored, PARAGRAPH, sha, answer, seedStore, tickCard, rail, page, shots, dotCount, toTop, hoverTick, ontoRow, check, jumpByRow, block, waitNote, noteCard, pressNote, worker, removeRow, QUESTION, settings, bookmark } = qa;
  // 9. The rail's hover card (#53). Seed bookmarks straight into the store, as an earlier session
  // would have left them, then reload so the page reads them once.
  const [{ account: ACCOUNT, conv: CONV_HASH }] = await stored();
  const seed = (turn, para, start = 0, end = null, time = Date.now()) => {
    const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
    const excerpt = text.slice(start, end ?? 120).trim();
    return { account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end: end ?? text.length, excerpt, time };
  };
  // Question 3: one bookmark. Question 7: six (blocks are p, h3, p, p, p, p, li, li), two of them
  // in paragraph 2, stored out of answer order.
  const SEEDS = [seed(2, 0), seed(TURN, 5, 0, null, 1), seed(TURN, 0, 0, null, 2), seed(TURN, 2, 20, 80, 3), seed(TURN, 2, 0, null, 4), seed(TURN, 4, 0, null, 5)];
  await seedStore(SEEDS);
  const excerptOf = (turn, para, start = 0) =>
    [...SEEDS, ...saved].find((b) => b.turn === turn && b.para === para && b.start === start).excerpt;
  const ORDER = [[0], [2], [2, 20], [3], [4], [5]].map(([para, start]) => excerptOf(TURN, para, start));
  const cardState = tickCard;
  const shoot = async (name) => {
    const c = await cardState(),
      r = await rail();
    const y = Math.max(0, Math.min(c.rect.y, r.ticks[0].y) - 30);
    await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: 1400 - 420, y, width: 420, height: Math.max(c.rect.y + c.rect.h, r.ticks.at(-1).y) - y + 30 } });
  };
  // The tick's card (#70) is the way to a question's bookmarks: hover the tick, then onto its rows.
  const cards = {};
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await dotCount(2);
    await toTop();
    await hoverTick(2);
    const single = await cardState();
    const singleOn = await ontoRow(0);
    await shoot(`card-single-${theme}`);
    await hoverTick(TURN);
    const list = await cardState();
    // Across the rail and the gap, onto the first row: the card stays and the row lights up.
    const onCard = await ontoRow(0);
    await shoot(`card-list-${theme}`);
    cards[theme] = { single, singleOn, list, onCard };
  }
  const { single, singleOn, list, onCard } = cards.light;
  check('one bookmark: the tick\'s card, named "Bookmark · question 3 of 12", shows its excerpt and, on the row, an ×',
    single.shown && single.merged && single.name === 'Bookmark · question 3 of 12' && single.rows.length === 1 &&
      single.rows[0].text === excerptOf(2, 0) && singleOn.rows[0].xShown && singleOn.rows[0].xLabel === `Delete bookmark: ${excerptOf(2, 0)}`,
    { single: single.name, rows: single.rows.map((r) => r.text) });
  check('the single row clamps its excerpt to three lines', single.rows[0].lines <= 3, { lines: single.rows[0].lines });
  check('several: "Question 7 of 12 · 6 bookmarks" and the rows in answer order',
    list.shown && list.name === 'Question 7 of 12 · 6 bookmarks' && JSON.stringify(list.rows.map((x) => x.text)) === JSON.stringify(ORDER),
    { name: list.name, rows: list.rows.map((x) => x.text) });
  check('five rows show and the sixth scrolls',
    list.box && Math.abs(list.box.client - 5 * list.rows[0].h) <= 1 && list.box.scroll > list.box.client + list.rows[0].h / 2, { box: list.box, row: list.rows[0].h });
  check('the card takes the pointer while it shows bookmarks', list.pe === 'auto');
  check('moving onto the card keeps it open; the hovered row has a background and an ×',
    onCard.shown && onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[0].xShown && !onCard.rows[1].xShown &&
      onCard.rows[0].xLabel === `Delete bookmark: ${ORDER[0]}`, { rows: onCard.rows.slice(0, 2).map((r) => [r.bg, r.xShown]) });
  check('dark theme: the same cards', cards.dark.single.name === single.name && cards.dark.onCard.shown &&
    cards.dark.onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)', { dark: cards.dark.onCard.rows[0].bg });

  // Jump from a row: the fifth row (paragraph 4) lands 64 px below the scroller's top, card put away.
  await open('light');
  await dotCount(2);
  check('jump from the fifth row', await jumpByRow(TURN, 4));
  check('clicking a row jumps to that bookmark', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
  check('the card goes away after the jump', !(await cardState()).shown);

  // Delete the first row with its ×: the store and the card both lose it.
  await toTop();
  await hoverTick(TURN);
  let c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  await page.waitForTimeout(400);
  c = await cardState();
  let left = (await stored()).filter((b) => b.turn === TURN);
  check('× deletes that bookmark; the card now lists five', left.length === 5 && !left.some((b) => b.para === 0) &&
    c.shown && c.name === 'Question 7 of 12 · 5 bookmarks' && c.rows.length === 5, { left: left.length, name: c.name });
  // The remove's card (#77): "Bookmark removed", its first words struck through, and Undo, which
  // stores the same bookmark again (same key and time) and brings it back to the card.
  const gone = SEEDS.find((b) => b.turn === TURN && b.para === 0);
  await waitNote('Bookmark removed');
  const removedCard = await noteCard();
  check('× shows "Bookmark removed" top right, its first words struck through, with Undo',
    removedCard.shown && removedCard.title === 'Bookmark removed' && removedCard.excerpt === gone.excerpt && removedCard.struck &&
      JSON.stringify(removedCard.buttons) === '["Undo"]' && Math.round(removedCard.top) === 64 &&
      Math.round(1400 - removedCard.right) === removedCard.railInset + 60,
    removedCard);
  await page.mouse.move(700, 300);
  await pressNote('undo');
  await page.waitForTimeout(600);
  const back = (await stored()).find((b) => b.turn === TURN && b.para === 0);
  await toTop();
  await hoverTick(TURN);
  check('Undo brings the same bookmark back: its key, its original time, its row in the card',
    back && back.key === (await worker.evaluate((b) => ButterBookmarks.key(b), gone)) && back.time === gone.time && (await tickCard()).rows.length === 6 && !(await noteCard()).shown,
    { back, rows: (await tickCard()).rows.length });
  // × again on the first row, then on paragraph 2's two rows: three left.
  for (let k = 0; k < 3; k++) await removeRow(TURN, 0);
  left = (await stored()).filter((b) => b.turn === TURN);
  check('× on paragraph 2\'s rows removes both; three left', left.length === 3 && !left.some((b) => b.para === 2 || b.para === 0),
    { left: left.map((b) => b.para) });

  // Keyboard alone: Tab into the rail, arrows to the tick (no stop for its bookmarks), left into the
  // card, Enter to jump.
  await toTop();
  await page.mouse.move(700, 300);
  const focused = () => page.evaluate(() => {
    const a = document.querySelector('chatgpt-butter-nav')?.shadowRoot.activeElement;
    return a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null;
  });
  await page.evaluate(() => document.activeElement?.blur());
  for (let k = 0; k < 8 && !(await focused())?.cls.startsWith('tick'); k++) await page.keyboard.press('Tab');
  let f;
  const stops = [];
  for (let k = 0; k < 30; k++) {
    f = await focused();
    stops.push(f?.cls);
    if (f?.cls.startsWith('tick') && f.label.includes(' · 3 bookmarks: ')) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.waitForTimeout(250); // the card fades in
  check('arrows walk the ticks only; the tick\'s name holds the bookmark text', f?.cls.startsWith('tick') && stops.every((x) => x?.startsWith('tick')) &&
    f.label === `${QUESTION(TURN)} · 3 bookmarks: ${ORDER[3]}; ${ORDER[4]}; ${ORDER[5]}` && (await cardState()).shown, { f, stops });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  f = await focused();
  check('ArrowLeft enters the card, ArrowDown moves to the next row', f?.cls === 'go' && f.text === ORDER[4], { f });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  check('Enter on a row jumps to it', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
  f = await focused();
  check('after the jump, focus is on the question\'s tick', f?.cls.startsWith('tick') && f.label.startsWith(QUESTION(TURN)), { f });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  f = await focused();
  check('Tab moves from a row to its ×', f?.cls === 'x' && f.label === `Delete bookmark: ${ORDER[3]}`, { f });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  left = (await stored()).filter((b) => b.turn === TURN);
  f = await focused();
  check('Enter on × deletes it; focus stays in the card', left.length === 2 && !left.some((b) => b.para === 3) &&
    f?.cls === 'go' && (await cardState()).rows.length === 2, { left: left.map((b) => b.para), f });
  await page.keyboard.press('Escape');
  await page.mouse.move(700, 300);

  // The single row's × under reduced motion: the dot goes at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toTop();
  await hoverTick(2);
  c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  await page.waitForTimeout(150);
  const allDots = () => page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
  check('the single row\'s × deletes; under reduced motion the dot goes at once, with no fade',
    !(await stored()).some((b) => b.turn === 2) && (await allDots()) === 1 && !(await cardState()).shown, { dots: await allDots() });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Delete question 7's last two: the last deletion fades the dot out over 160 ms.
  await hoverTick(TURN);
  c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  await page.waitForTimeout(400);
  c = await cardState();
  check('one left: the card shows the single row', c.shown && c.name === 'Bookmark · question 7 of 12' && c.rows.length === 1 && c.rows[0].text === ORDER[5], { c: c.name });
  c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  const fading = await page.waitForFunction(
    () => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].some((m) => m.classList.contains('gone') && +getComputedStyle(m).opacity < 1),
    null, { timeout: 1000 }).then(() => true, () => false);
  const fade = await page.evaluate(() => {
    const d = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.gone');
    return d && getComputedStyle(d).transition;
  });
  await page.waitForTimeout(400);
  let r = await rail();
  check('deleting the last bookmark fades the dot out over 160 ms, then removes it', fading && /opacity 0.16s/.test(fade ?? '') && r.dots.length === 0 &&
    (await allDots()) === 0 && !(await cardState()).shown, { fading, fade, dots: r.dots.length });

  // Reload: every deletion is still gone.
  await open('light');
  await page.waitForTimeout(500);
  check('after a reload the deletions are still gone', (await stored()).length === 0 && (await rail()).dots.length === 0);

  // 10. The first bookmark ever (#56, #77): the notification expanded with the privacy text, at top
  // right. Each run below starts unacknowledged. The first three save, check the card and press
  // Undo; the last presses Got it.
  const consentCard = () =>
    page.evaluate(() => {
      const host = document.querySelector('chatgpt-butter-consent');
      if (!host || host.hidden) return null;
      const r = host.shadowRoot.querySelector('.card').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, z: getComputedStyle(host).zIndex };
    });
  const acknowledged = () =>
    worker.evaluate(() => chrome.storage.local.get('butter').then(({ butter }) => butter.bookmarkNotice));
  await seedStore([], { clear: true });
  const COPY = {
    en: {
      title: 'Bookmark saved',
      body: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove a bookmark with the × on its card in the rail.Privacy policy',
      href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.md',
      buttons: ['Undo', 'Got it'],
    },
    zh: {
      title: '书签已保存',
      body: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 即可删除。隐私政策',
      href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.zh-CN.md',
      buttons: ['撤销', '知道了'],
    },
  };
  for (const [i, run] of [
    { theme: 'light', lang: 'en', butter: {}, consent: 'declined' },
    { theme: 'dark', lang: 'en', butter: { layoutConsent: 'pending' }, consent: 'pending' },
    { theme: 'light', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: true } }, consent: 'granted' },
    { theme: 'dark', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: false } }, consent: 'layouts off' },
  ].entries()) {
    const name = `${run.theme} ${run.lang}, consent ${run.consent}`;
    await settings({ ...run.butter, bookmarkNotice: undefined });
    await open(run.theme);
    const save = await bookmark(TURN, PARA);
    check(`first bookmark (${name}): nothing before the save`, !(await noteCard()).shown);
    await save.click();
    await waitNote(COPY[run.lang].title);
    const n = await noteCard();
    const c = COPY[run.lang];
    check(`first bookmark (${name}): the expanded card, with the approved copy`,
      n.shown && n.kind.includes('first') && n.title === c.title && n.body === c.body && n.href === c.href &&
        JSON.stringify(n.buttons) === JSON.stringify(c.buttons) && n.lang === (run.lang === 'zh' ? 'zh-CN' : 'en') &&
        n.excerpt.length > 0 && n.oneLine,
      n);
    check(`first bookmark (${name}): top right, 12 px below the header and 8 px left of the rail, 300 px, Butter's font`,
      n.width === 300 && Math.round(n.top) === 64 && Math.round(1400 - n.right) === n.railInset + 60 && n.z === '19' &&
        n.font.includes('ButterConsentNunito'),
      { top: n.top, right: 1400 - n.right, railInset: n.railInset, width: n.width, z: n.z });
    if (run.consent === 'pending') {
      await page.waitForSelector('chatgpt-butter-consent[data-visible]', { state: 'attached', timeout: 5000 });
      await page.waitForTimeout(400);
      const [m, k] = [await noteCard(), await consentCard()];
      check(`first bookmark (${name}): the consent card stays bottom right, apart from the notification`,
        k && m.shown && Math.round(1400 - k.right) === 30 && Math.round(900 - k.bottom) >= 82 && m.bottom < k.top,
        { notice: m, consent: k });
    }
    if (i === 0) {
      await page.waitForTimeout(4500);
      check('the expanded card does not leave by itself', (await noteCard()).shown);
    }
    const shot = await noteCard();
    await page.screenshot({
      path: `${shots}/notice-${run.theme}-${run.lang}.png`,
      clip: { x: Math.round(shot.left) - 8, y: Math.round(shot.top) - 8, width: 316 + 60, height: Math.round(shot.bottom - shot.top) + 16 },
    });
    check(`first bookmark (${name}): the save drew its dot`, (await rail()).dots.length === 1);
    if (i < 3) {
      await pressNote('undo');
      await page
        .waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === 0, null, { timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(300);
      const after = await noteCard();
      check(`first bookmark (${name}): Undo deletes the bookmark, its dot goes, the card goes unacknowledged`,
        (await stored()).length === 0 && (await rail()).dots.length === 0 && !after.shown &&
          (await acknowledged()) === undefined,
        { stored: (await stored()).length, dots: (await rail()).dots.length, after: after.shown });
    } else {
      await pressNote('ok');
      await page.waitForTimeout(400);
      check(`first bookmark (${name}): Got it keeps the bookmark and records the acknowledgement`,
        !(await noteCard()).shown && (await stored()).length === 1 && (await rail()).dots.length === 1 &&
          (await acknowledged()) === 'acknowledged');
    }
  }
  // A third save, and one after a reload: the small card only.
  await settings({ lang: 'en' });
  await open('light');
  const third = await bookmark(TURN, 0);
  await third.click();
  await waitNote('Bookmark saved');
  let small = await noteCard();
  check('after Got it, a save shows the small card', small.shown && !small.kind.includes('first') && JSON.stringify(small.buttons) === '["Undo"]' &&
    (await stored()).length === 2, small);
  await open('light');
  const fourth = await bookmark(2, 0);
  await fourth.click();
  await waitNote('Bookmark saved');
  small = await noteCard();
  check('after Got it and a reload, the small card again', small.shown && !small.kind.includes('first') && (await stored()).length === 3, small);
  // The pointer on the card holds it; it leaves 4 s after the pointer goes.
  await page.mouse.move((small.left + small.right) / 2 - 60, (small.top + small.bottom) / 2, { steps: 4 });
  await page.waitForTimeout(4500);
  const held = (await noteCard()).shown;
  await page.mouse.move(700, 600, { steps: 4 });
  await page.waitForTimeout(2000);
  const stillThere = (await noteCard()).shown;
  await page.waitForTimeout(2600);
  check('the pointer on the card holds it; it leaves 4 s after the pointer goes', held && stillThere && !(await noteCard()).shown,
    { held, stillThere });
}
