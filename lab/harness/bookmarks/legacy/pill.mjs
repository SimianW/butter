// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.
import path from 'node:path';
import fs from 'node:fs/promises';

// The selection pill and the notification (#77; ONLY=pill runs this part alone): the cases the
// spec's testing decisions name that the main flow doesn't, and the approved mockup's states shot
// at desktop (1400 px) and narrow (700 px, under the card's 760 px breakpoint) widths into
// `${shots}/states/`: A′ (the pill, pointer on Bookmark, its label), C′ (saved), D′ (removed), F′
// (the first bookmark ever, expanded), E′ (dark, pointer on Ask in branch, a saved card), and,
// outside the mockup, "Already bookmarked", the pill with Ask in branch off, and Chinese.
export async function pillSection(qa) {
  const { open, scrollTo, shots, page, select, bookmark, seedStore, settings, waitNote, noteCard, check, pressNote, hoverCell, stored, removeRow, dotBeside, rail, block, button, PARAGRAPH, pill } = qa;
  const out = path.join(shots, 'states');
  await fs.mkdir(out, { recursive: true });
  const TURN = 6;
  const size = async (width) => {
    await page.setViewportSize({ width, height: 900 });
  };
  const shoot = async (name) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  const away = () => page.mouse.move(300, 860);
  // A passage inside paragraph 2 of question 7, in view, as the mockup selects one.
  const passage = async (k = 2) => {
    await scrollTo(TURN);
    await page.waitForTimeout(1300); // content above settles a second after a scroll (stream/offscreen.js)
    await select(TURN, k, 30, k, 160);
    return bookmark(TURN, k, false, { keep: true });
  };
  // The card's motion as it enters: its running transitions, read in the frame after it shows.
  const entering = () =>
    page
      .waitForFunction(() => {
        const host = document.querySelector('chatgpt-butter-bookmark-notice');
        const card = host?.hasAttribute('data-visible') && host.shadowRoot.querySelector('.card');
        if (!card) return null;
        return card.getAnimations().map((a) => `${a.transitionProperty} ${a.effect.getTiming().duration}`).sort();
      })
      .then((h) => h.jsonValue())
      .catch(() => null);

  await seedStore([], { clear: true });
  for (const [name, width] of [['desktop', 1400], ['narrow', 700]]) {
    const W = width;
    await size(W);
    // F′: the first bookmark ever, expanded, until Got it.
    await settings({ bookmarkNotice: undefined });
    await open('light');
    await (await bookmark(TURN, 3)).click();
    await waitNote('Bookmark saved');
    let n = await noteCard();
    check(`${name}: the first bookmark's expanded card at top right`, n.shown && n.kind.includes('first') && Math.round(n.top) === 64 &&
      (W < 760 ? Math.round(n.left) === 16 && Math.round(W - n.right) === 16 : n.width === 300 && Math.round(W - n.right) === n.railInset + 60),
      { left: n.left, right: W - n.right, top: n.top, width: n.width, railInset: n.railInset });
    await away();
    await shoot(`f-first-${name}`);
    await pressNote('ok');
    await page.waitForTimeout(400);
    // A′: a passage selected, the pointer on Bookmark, its label below the pill.
    await passage();
    const a = await hoverCell('bookmark');
    check(`${name}: the pill beside "Ask ChatGPT" with Bookmark's label`, a?.shown && a.tip?.text === 'Bookmark selection' &&
      Math.round(a.box.left - a.native.right) === 4, { box: a?.box, native: a?.native, tip: a?.tip });
    await shoot(`a-pill-bookmark-${name}`);
    // C′: saved, the dot on the rail at the same time.
    const ac = a.cells.find((c) => c.id === 'bookmark');
    await page.mouse.click(ac.left + ac.width / 2, ac.top + 15);
    await waitNote('Bookmark saved');
    await away();
    n = await noteCard();
    check(`${name}: "Bookmark saved", one line of its first words, Undo`, n.shown && !n.kind.includes('first') && n.oneLine &&
      JSON.stringify(n.buttons) === '["Undo"]' && Math.round(n.top) === 64 && (W >= 760 || (Math.round(n.left) === 16 && Math.round(W - n.right) === 16)), n);
    await shoot(`c-saved-${name}`);
    // Already bookmarked (not in the mockup): the same passage again, with the Bookmark cell (the
    // main flow clears the shortcut's key in Chrome's settings before this section; it checks ⌥⇧M).
    await (await passage()).click();
    await waitNote('Already bookmarked');
    await away();
    await page.evaluate(() => getSelection().removeAllRanges());
    n = await noteCard();
    check(`${name}: "Already bookmarked" without Undo`, n.shown && n.buttons.length === 0, n);
    await shoot(`already-${name}`);
    // D′: × on the rail card; Undo puts it back.
    const kept = (await stored()).filter((b) => b.turn === TURN);
    await removeRow(TURN, 0); // paragraph 2's: rows are in answer order
    await waitNote('Bookmark removed');
    await away();
    await page.waitForTimeout(500); // the tick's card closes once the pointer has left
    n = await noteCard();
    check(`${name}: "Bookmark removed", struck through, with Undo`, n.shown && n.struck && JSON.stringify(n.buttons) === '["Undo"]', n);
    await shoot(`d-removed-${name}`);
    await pressNote('undo');
    await page.waitForTimeout(600);
    const restored = (await stored()).filter((b) => b.turn === TURN);
    check(`${name}: Undo of a remove restores the same bookmarks, with their dot`,
      JSON.stringify(restored.map((b) => [b.key, b.time]).sort()) === JSON.stringify(kept.map((b) => [b.key, b.time]).sort()) && !!dotBeside(await rail(), TURN),
      { kept: kept.length, restored: restored.length });
    // E′: dark, a saved card, the pointer on Ask in branch.
    await open('dark');
    await (await bookmark(2, 0)).click();
    await waitNote('Bookmark saved');
    await passage();
    const e = await hoverCell('branch');
    n = await noteCard();
    check(`${name}: dark: the card in Butter's dark tokens beside the pill, Ask in branch's label`,
      n.shown && n.bg === 'rgb(38, 33, 27)' && n.color === 'rgb(236, 227, 207)' && e?.tip?.text === 'Ask in branch', { bg: n.bg, color: n.color, tip: e?.tip });
    await shoot(`e-dark-branch-${name}`);
    await page.evaluate(() => getSelection().removeAllRanges());
    // Ask in branch off: the Bookmark cell alone, 30 × 30.
    await settings({ opts: { branch: false } });
    await open('light');
    await passage();
    const alone = await hoverCell('bookmark');
    check(`${name}: Ask in branch off: the pill is the Bookmark cell alone, 30 × 30`,
      alone?.cells.map((c) => c.id).join() === 'bookmark' && alone.box.width === 30 && alone.box.height === 30 && alone.cells[0].width === 30,
      { cells: alone?.cells });
    await shoot(`pill-branch-off-${name}`);
    await page.evaluate(() => getSelection().removeAllRanges());
    // Chinese: the first bookmark, the pill, saved, already, removed.
    await seedStore([], { clear: true });
    await settings({ lang: 'zh', bookmarkNotice: undefined });
    await open('light');
    await (await bookmark(TURN, 3)).click();
    await waitNote('书签已保存');
    await away();
    await shoot(`zh-f-first-${name}`);
    await pressNote('ok');
    await page.waitForTimeout(400);
    await passage();
    const zh = await hoverCell('bookmark');
    await shoot(`zh-a-pill-bookmark-${name}`);
    const zc = zh.cells.find((c) => c.id === 'bookmark');
    await page.mouse.click(zc.left + zc.width / 2, zc.top + 15);
    await waitNote('书签已保存');
    await away();
    const zhSaved = await noteCard();
    await shoot(`zh-c-saved-${name}`);
    await (await passage()).click();
    await waitNote('已有此书签');
    await away();
    await page.evaluate(() => getSelection().removeAllRanges());
    const zhAlready = await noteCard();
    await shoot(`zh-already-${name}`);
    await removeRow(TURN, 0);
    await waitNote('已移除书签');
    await away();
    await page.waitForTimeout(500);
    const zhRemoved = await noteCard();
    await shoot(`zh-d-removed-${name}`);
    check(`${name}: Chinese: 为选中内容加书签, 书签已保存, 已有此书签, 已移除书签 and 撤销`,
      zh?.tip?.text === '为选中内容加书签' && zhSaved.title === '书签已保存' && JSON.stringify(zhSaved.buttons) === '["撤销"]' &&
        zhAlready.title === '已有此书签' && zhRemoved.title === '已移除书签',
      { tip: zh?.tip?.text, saved: zhSaved.title, already: zhAlready.title, removed: zhRemoved.title });
    await settings({});
    await seedStore([], { clear: true });
  }
  await size(1400);

  // Triple-click a paragraph, then Bookmark: the whole paragraph.
  await open('light');
  await scrollTo(TURN);
  await page.waitForTimeout(300);
  const para = await block(TURN, 4);
  await page.mouse.click(para.x + 40, para.y + 10, { clickCount: 3 });
  await page.waitForTimeout(300);
  const tri = await button();
  if (tri) await page.mouse.click(tri.x + tri.w / 2, tri.y + tri.h / 2);
  await page.waitForTimeout(600);
  const whole = (await stored()).find((b) => b.turn === TURN && b.para === 4);
  check('triple-click a paragraph, then Bookmark: the whole paragraph', !!tri && whole && whole.start === 0 && whole.end === PARAGRAPH(TURN, 3).length,
    { tri: !!tri, whole });
  // Keyboard: the Bookmark cell takes focus, and Enter saves.
  await bookmark(TURN, 5);
  await page.locator('chatgpt-butter-pill button[data-cell="bookmark"]').focus();
  const focusTip = await pill();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check('keyboard: focus shows the label; Enter on the Bookmark cell saves the selection',
    focusTip.tip?.text === 'Bookmark selection' && (await stored()).some((b) => b.turn === TURN && b.para === 5), { tip: focusTip.tip });
  // Undo of a save deletes it and its dot.
  await waitNote('Bookmark saved');
  await pressNote('undo');
  await page.waitForTimeout(600);
  check('Undo of a save deletes the bookmark', !(await stored()).some((b) => b.turn === TURN && b.para === 5) && !(await noteCard()).shown);
  // A new card replaces the current one at once.
  await (await bookmark(2, 0)).click();
  await waitNote('Bookmark saved');
  await (await bookmark(3, 0)).click();
  await page.waitForTimeout(150);
  const replaced = await page.evaluate(() => document.querySelectorAll('chatgpt-butter-bookmark-notice').length);
  const now = await noteCard();
  check('a new card replaces the current one at once', replaced === 1 && now.excerpt?.startsWith('Fixture answer 4 paragraph 1'), { replaced, excerpt: now.excerpt });
  // Motion: a 16 px slide and a fade over 200 ms; under reduced motion the fade only.
  await page.waitForTimeout(4500);
  const move = (await (await bookmark(4, 0)).click(), await entering());
  await page.waitForTimeout(4500);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const still = (await (await bookmark(5, 0)).click(), await entering());
  const stillRight = (await noteCard()).transform;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('the card slides 16 px and fades in over 200 ms; with reduced motion it only fades',
    JSON.stringify(move) === '["opacity 200","transform 200"]' && JSON.stringify(still) === '["opacity 200"]' && stillRight === 'none', { move, still, stillRight });
  // The rail switched off puts the card away.
  await (await bookmark(7, 0)).click();
  await waitNote('Bookmark saved');
  await settings({ opts: { rail: false } });
  await page.waitForTimeout(400);
  check('turning the rail off puts the card away', !(await noteCard()).shown);
  await settings({});
  await seedStore([], { clear: true });
}
