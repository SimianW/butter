// The pill and the notification (#77) beyond the mockup's states: triple-click then Bookmark saves
// the whole paragraph, the keyboard (focus shows the label, Enter saves), Undo of a save, a new card
// replacing the current one at once, its motion (a 16 px slide and a fade over 200 ms; the fade only
// under reduced motion), and the rail switched off putting the card away.
export default {
  name: 'notice',
  description: 'Triple-click then Bookmark, the keyboard, Undo of a save, a card replacing another, its motion, the rail off putting it away',
  async run(qa) {
    const { open, scrollTo, page, bookmark, settings, waitNote, noteCard, check, pressNote, stored, block, button, PARAGRAPH, pill } = qa;
    const TURN = 6;
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
  },
};
