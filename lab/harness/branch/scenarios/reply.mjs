// ---- Ready line and ChatGPT's reply: the line stays while no reply has appeared, and goes once
// the reply to Butter's question starts to show: a fade, or at once under reduced motion. With no
// reply the line stays, and × hides it at once. Then shots before and after the reply, light and
// dark, 1280 and 800 px.
import assert from 'node:assert/strict';
import { HOST, inShadow } from '../driver.mjs';

// lineFrames: from the reply's start, the line's opacity each frame, then null once it is gone.
const watchLine = (page) =>
  page.evaluate((host) => {
    window.lineFrames = [];
    const tick = () => {
      if (fixture.replied) {
        const line = document.querySelector(host)?.shadowRoot?.querySelector('.line');
        lineFrames.push(line ? Number(getComputedStyle(line).opacity) : null);
        if (!line) return (window.lineGoneAfter = performance.now() - fixture.replied);
      }
      requestAnimationFrame(tick);
    };
    tick();
  }, HOST);

export default {
  name: 'reply',
  description: "The ready line stays until ChatGPT's reply shows, then fades (at once under reduced motion, and after an empty placeholder reply); with no reply it stays and × hides it; shots before and after",
  async run({ open, ask, capture, log, pass }) {
    // placeholder: the send click mounts an empty reply at once (ChatGPT's "thinking" state), which
    // the reply's text fills later; the line still waits for that text.
    for (const [motion, held] of [
      ['no-preference', false],
      ['reduce', false],
      ['no-preference', true],
    ]) {
      const label = held ? `${motion} placeholder` : motion;
      const page = await open();
      const dest = await ask(page, { fixture: 'reply=2500' + (held ? '&placeholder' : '') });
      await dest.emulateMedia({ reducedMotion: motion });
      await inShadow(dest, '.line').waitFor();
      await watchLine(dest);
      await dest.waitForTimeout(1500);
      assert.equal(await dest.evaluate(() => fixture.replied), undefined, `${label}: no reply yet`);
      assert.equal(await inShadow(dest, '.line').count(), 1, `${label}: line stays while no reply`);
      if (held)
        assert.ok(
          await dest.evaluate(() => !!document.querySelector('[data-turn-key^="t-sent-"] .a')),
          'placeholder: the empty reply is mounted',
        );
      await dest.waitForFunction(() => fixture.replied);
      await dest
        .waitForFunction(() => window.lineGoneAfter !== undefined, null, { timeout: 2_000 })
        .catch(() => assert.fail(`${label}: line still shown 2 s after the reply showed`));
      const { frames, after } = await dest.evaluate(() => ({ frames: lineFrames, after: lineGoneAfter }));
      const faded = frames.some((o) => o !== null && o > 0 && o < 1);
      assert.ok(after < 700, `${label}: line gone ${Math.round(after)} ms after the reply showed`);
      assert.equal(faded, motion === 'no-preference', `${label}: fade ${JSON.stringify(frames)}`);
      log(`INFO ${label}: line gone ${Math.round(after)} ms after the reply showed`);
      await dest.close();
      await page.close();
    }
    {
      // No reply: the line stays; × hides it at once.
      const page = await open();
      const dest = await ask(page);
      await inShadow(dest, '.line').waitFor();
      await dest.waitForTimeout(3_000);
      assert.equal(await inShadow(dest, '.line').count(), 1, 'line stays while no reply');
      await inShadow(dest, '.line .xs').click();
      assert.equal(await inShadow(dest, '.line').count(), 0, '× hides the line at once');
      await dest.close();
      await page.close();
    }
    // Before and after the reply, light and dark, 1280 and 800 px.
    for (const theme of ['light', 'dark'])
      for (const width of [1280, 800]) {
        const page = await open(`theme=${theme}`, width);
        const dest = await ask(page, { fixture: 'reply=1500', width });
        await inShadow(dest, '.line').waitFor();
        await dest.waitForTimeout(250);
        await capture(dest, 'reply-before', width, theme);
        await dest.waitForFunction(() => fixture.replied);
        await inShadow(dest, '.line').waitFor({ state: 'detached' });
        await capture(dest, 'reply-after', width, theme);
        await dest.close();
        await page.close();
      }
    pass('ready line stays while no reply, goes as the reply shows (fade; at once under reduced motion); × at once');
  },
};
