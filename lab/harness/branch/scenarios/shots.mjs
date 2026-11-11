// ---- Screenshots of mockup states 1–4 (button, question, working, ready) and the working card's
// waiting variant (latest reply still streaming), light and dark, 1280 and 800 px.
import assert from 'node:assert/strict';
import { chipOf, heading, inShadow, select, settle } from '../driver.mjs';

export default {
  name: 'shots',
  description: 'Screenshots of mockup states 1–4 and the waiting card, light and dark, 1280 and 800 px',
  async run({ open, context, askCard, capture, pass }) {
    for (const theme of ['light', 'dark'])
      for (const width of [1280, 800]) {
        const page = await open(`theme=${theme}&slow=1500&hold=60000`, width);
        await select(page);
        await chipOf(page).waitFor();
        await page.locator('#quote').hover();
        await settle(page);
        await capture(page, 'button', width, theme);
        await chipOf(page).click();
        await inShadow(page, 'textarea').fill('What does RAG mean here? How is it different from fine-tuning?');
        await settle(page);
        await capture(page, 'question', width, theme);
        const next = context.waitForEvent('page');
        await inShadow(page, 'textarea').press('Enter');
        const dest = await next;
        await dest.setViewportSize({ width, height: 800 });
        await inShadow(dest, '.card').waitFor();
        await settle(dest);
        await capture(dest, 'working', width, theme);
        await inShadow(dest, '.line').waitFor();
        await settle(dest);
        await capture(dest, 'ready', width, theme);
        await dest.close();
        await page.close();
        // The working card's waiting variant (latest reply still streaming).
        const streaming = await open(`theme=${theme}&stream=60000`, width);
        const waiting = await askCard(streaming, 'What does RAG mean here? How is it different from fine-tuning?');
        await waiting.setViewportSize({ width, height: 800 });
        await settle(waiting);
        assert.equal(await heading(waiting), 'Waiting for the reply to finish…');
        await capture(waiting, 'waiting', width, theme);
        await inShadow(waiting, '.card .btn').click();
        await waiting.close();
        await streaming.close();
        pass(`screenshots ${width}px ${theme}`);
      }
  },
};
