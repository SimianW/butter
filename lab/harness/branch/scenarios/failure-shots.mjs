// ---- State 5 screenshots: the failure card with the mockup's cause (no "Branch in new chat"),
// light and dark, 1280 and 800 px.
import { inShadow, settle } from '../driver.mjs';

export default {
  name: 'failure-shots',
  description: 'Screenshots of mockup state 5, the failure card, light and dark, 1280 and 800 px',
  async run({ open, ask, capture, pass }) {
    for (const theme of ['light', 'dark'])
      for (const width of [1280, 800]) {
        const page = await open(`theme=${theme}`, width);
        const dest = await ask(page, {
          question: 'What does RAG mean here? How is it different from fine-tuning?',
          fixture: 'fail=newchat',
          width,
        });
        await inShadow(dest, '.card.err').waitFor({ timeout: 40_000 });
        await dest.mouse.click(5, 5); // no focus ring in the shot (lands on the full-page cover)
        await settle(dest);
        await capture(dest, 'failure', width, theme);
        await dest.close();
        await page.close();
      }
    pass('failure screenshots 1280/800 light/dark');
  },
};
