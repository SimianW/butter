// ---- 2 · Question box: under the buttons, left-aligned, flips above, keys and draft. While it is
// open Butter's button is hidden and the box stays where the buttons were; the quote shows on one
// line and stays highlighted; Shift+Enter adds a line, Esc closes and restores the selection, the
// draft is kept, a click outside closes. By keyboard (the cell focused, Enter) it opens at the same
// place. With no room below the selection it flips above it.
import assert from 'node:assert/strict';
import { butter, chipOf, HOST, inShadow, rects, select, settle } from '../driver.mjs';

export default {
  name: 'question-box',
  description: 'The question box: opened by pointer and by keyboard under the buttons, button hidden while open, one-line quote, Shift+Enter, Esc and draft, click outside, flips above',
  async run({ open, log, pass, QUOTE }) {
    const page = await open();
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    const { native: nativeBefore, chip: chipBefore } = await rects(page);
    await chipOf(page).click();
    const box = inShadow(page, '.qpop');
    await box.waitFor();
    const boxAtOpen = await box.evaluate((el) => el.getBoundingClientRect().toJSON());
    await settle(page);
    const geo = async () => ({
      ...(await page.evaluate((host) => {
        const root = document.querySelector(host).shadowRoot;
        const r = (el) => el.getBoundingClientRect().toJSON();
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('#quote'));
        return {
          box: r(root.querySelector('.qpop')),
          native: r(document.querySelector('.native > div')),
          sel: range.getBoundingClientRect().toJSON(),
          quoteLines: Math.round(
            root.querySelector('.q').getBoundingClientRect().height / parseFloat(getComputedStyle(root.querySelector('.q')).lineHeight),
          ),
          focused: root.activeElement?.tagName,
          pageSelection: getSelection().toString(),
          highlighted: CSS.highlights.has('butter-branch-quote'),
        };
      }, HOST)),
      chipShown: (await butter(page).pill()).shown,
    });
    let g = await geo();
    log(`INFO page selection while the box is open: ${JSON.stringify(g.pageSelection)}`);
    // While the box is open, Butter's button is hidden; the box stays where the buttons were.
    assert.equal(g.chipShown, false, 'button hidden while the box is open');
    assert.equal(Math.round(g.box.left), Math.round(nativeBefore.left), 'left-aligned with buttons');
    assert.equal(Math.round(g.box.top), Math.round(chipBefore.bottom + 8), 'directly under buttons');
    assert.deepEqual([g.box.left, g.box.top], [boxAtOpen.left, boxAtOpen.top], 'box does not move once the button is hidden');
    assert.ok(g.box.top >= g.sel.bottom, 'does not cover the selection');
    assert.equal(g.quoteLines, 1, 'quote on one line');
    assert.equal(g.focused, 'TEXTAREA', 'question field focused');
    assert.ok(g.highlighted, 'quote stays highlighted');
    const input = inShadow(page, 'textarea');
    await input.type('What is RAG?');
    await input.press('Shift+Enter');
    await input.type('Briefly.');
    assert.equal(await input.inputValue(), 'What is RAG?\nBriefly.', 'Shift+Enter adds a line');
    await input.press('Escape');
    assert.equal(await box.count(), 0, 'Esc closes');
    assert.equal(await page.evaluate(() => getSelection().toString()), QUOTE, 'Esc restores the selection');
    await chipOf(page).waitFor({ timeout: 3000 });
    await settle(page);
    assert.notEqual((await rects(page)).chip, null, 'button back after Esc, with the selection');
    await chipOf(page).click();
    assert.equal(await input.inputValue(), 'What is RAG?\nBriefly.', 'draft kept after Esc');
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'button hidden again with the box reopened');
    await page.mouse.click(1200, 400);
    assert.equal(await box.count(), 0, 'click outside closes');
    assert.equal(await page.evaluate(() => fixture.sent.length), 0, 'nothing sent here');
    // Keyboard: the cell takes focus and Enter opens the box at the same place, as a pointer does.
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).focus();
    await page.keyboard.press('Enter');
    await box.waitFor();
    await settle(page);
    const byKey = await geo();
    assert.equal(Math.round(byKey.box.left), Math.round(nativeBefore.left), 'keyboard: left-aligned with buttons');
    assert.equal(Math.round(byKey.box.top), Math.round(chipBefore.bottom + 8), 'keyboard: directly under buttons');
    assert.equal(byKey.focused, 'TEXTAREA', 'keyboard: question field focused');
    await inShadow(page, 'textarea').press('Escape');
    await page.close();
    // Not enough room below the selection: the box flips above it.
    const low = await open('pad=470');
    await select(low);
    await chipOf(low).waitFor();
    await settle(low);
    await chipOf(low).click();
    await inShadow(low, '.qpop').waitFor();
    await settle(low);
    const flip = await low.evaluate((host) => {
      const root = document.querySelector(host).shadowRoot;
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#quote'));
      return {
        box: root.querySelector('.qpop').getBoundingClientRect().toJSON(),
        sel: range.getBoundingClientRect().toJSON(),
      };
    }, HOST);
    assert.ok(flip.box.bottom <= flip.sel.top - 8 + 0.5, 'flipped above the selection');
    assert.ok(flip.box.top >= 16, 'inside the viewport');
    await low.close();
    pass('question box: opened by pointer and by keyboard, button hidden while open, aligned under the buttons, one-line quote, keys, draft kept, button back after Esc, flips above');
  },
};
