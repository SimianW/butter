// ---- 1 · Button: aligned with ChatGPT's own, styled like it, following it. Per theme: 4 px right
// of ChatGPT's "Ask ChatGPT", top edges aligned, 30 px high, its look copied, icon only and named;
// ChatGPT's hover tint isn't copied, Butter's own hover changes only the cell; the label 8 px below
// after 300 ms; it follows a moved native button, hides and comes back with it; none on a user
// message or without a selection; the setting turns it off live and back on.
import assert from 'node:assert/strict';
import { butter, chipOf, rects, select, settle } from '../driver.mjs';

export default {
  name: 'button',
  description: "Ask in branch's pill cell, light and dark: placed and styled like ChatGPT's button, follows and hides with it, hover and label, no cell on a user message or with the setting off",
  async run({ open, settings, capture, pass }) {
    for (const theme of ['light', 'dark']) {
      const page = await open(`theme=${theme}`);
      await select(page);
      await chipOf(page).waitFor();
      await settle(page);
      let r = await rects(page);
      assert.equal(Math.round(r.chip.left - r.native.right), 4, 'chip sits 4 px right of native');
      assert.equal(Math.round(r.chip.top), Math.round(r.native.top), 'top edges aligned');
      assert.equal(r.chip.height, 30, 'the pill is 30 px high');
      assert.equal(r.cell.width, r.chip.width === 30 ? 30 : 32, 'an icon cell: 32 px, or 30 alone');
      assert.deepEqual(r.chipCss, r.nativeCss, 'same radius, background and shadow as ChatGPT’s');
      assert.equal(r.icon, true, 'icon only');
      assert.equal(r.name, 'Ask in branch', 'the label is its accessible name');
      // ChatGPT's button hovered: it tints itself, square; Butter's keeps the resting look.
      const resting = r.chipCss;
      await page.hover('.native button');
      await settle(page);
      const tinted = await page.$eval('.native button', (b) => getComputedStyle(b).backgroundColor);
      assert.equal(tinted, 'rgba(255, 255, 255, 0.1)', 'fixture: native button shows its hover tint');
      assert.deepEqual((await rects(page)).chipCss, resting, 'native hovered: chip keeps its resting look');
      if (theme === 'light') await capture(page, 'button-native-hover', 1280, theme);
      // Butter's own hover: a lighter background, same shape and shadow (mockup state 1).
      await chipOf(page).hover();
      await settle(page);
      const own = await rects(page);
      assert.notEqual(own.cellBg, r.cellBg, 'cell hover changes its background');
      assert.deepEqual(own.chipCss, resting, 'cell hover keeps the pill’s radius, background and shadow');
      // Its label shows 8 px below the pill after 300 ms of hover.
      await page.waitForTimeout(350);
      const p = await butter(page).pill();
      const label = p.tip && { text: p.tip.text + p.tip.kbd, top: p.tip.top, pill: p.box?.bottom };
      assert.equal(label?.text, 'Ask in branch', 'hover label');
      assert.equal(Math.round(label.top - label.pill), 8, 'label 8 px below the pill');
      await page.mouse.move(5, 790);
      await settle(page);
      // ChatGPT's button moves: Butter's follows.
      await page.evaluate(() => {
        fixture.nativeShift = 40;
        fixture.placeNative();
      });
      await settle(page);
      r = await rects(page);
      assert.equal(Math.round(r.chip.left - r.native.right), 4, 'chip follows a moved native');
      // ChatGPT's button hides: Butter's hides; it comes back with it.
      await page.evaluate(() => {
        fixture.nativeHidden = true;
        fixture.placeNative();
      });
      await settle(page);
      assert.equal((await rects(page)).chip, null, 'chip hidden with native');
      await page.evaluate(() => {
        fixture.nativeHidden = false;
        fixture.placeNative();
      });
      await settle(page);
      assert.notEqual((await rects(page)).chip, null, 'chip back with native');
      // Not in a user message, and gone when the selection collapses.
      await select(page, '[data-message-author-role="user"]');
      await settle(page);
      assert.equal((await rects(page)).chip, null, 'no chip on a user message');
      await butter(page).clearSelection();
      await settle(page);
      assert.equal((await rects(page)).chip, null, 'no chip without a selection');
      // Settings key off: a shown button leaves at once, with no reload; none appears; on again: back.
      await select(page);
      await chipOf(page).waitFor();
      await settings({ opts: { branch: false } });
      await settle(page);
      assert.equal((await rects(page)).chip, null, 'shown chip leaves live when the setting turns off');
      await butter(page).clearSelection();
      await select(page);
      await settle(page);
      assert.equal((await rects(page)).chip, null, 'no chip when the setting is off');
      await settings({});
      await butter(page).clearSelection();
      await select(page);
      await chipOf(page).waitFor();
      await page.close();
      pass(`button ${theme}: 4 px gap, top aligned, mirrored style, follows/hides, setting`);
    }
  },
};
