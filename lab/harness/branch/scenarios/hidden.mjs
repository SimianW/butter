// ---- No button where ChatGPT can't branch. ChatGPT's own button is shown in each case, so its
// absence is Butter's rule, not a missing anchor. Controls: the same fixture in Chat mode, Chinese
// UI, and while the latest reply streams, shows it.
import assert from 'node:assert/strict';
import { chipOf, rects, select } from '../driver.mjs';

export default {
  name: 'hidden',
  description: 'No Ask in branch cell in Temporary Chat, Work mode (also side chat only, and in Chinese), without a branch action, or in an unsaved branch or new chat; shown in the Chat-mode controls',
  async run({ open, pass, BRANCH }) {
    const cases = [
      ['Temporary Chat', 'temporary-chat=true'],
      ['Work mode', 'work=1'],
      ['Work mode (side chat in the toolbar only)', 'side=1'],
      ['no branch action', 'nobranch=1'],
      ['Work mode, Chinese UI', 'work=1&lang=zh'],
      ['unsaved branch', '', `/c/${encodeURIComponent(BRANCH)}`],
      ['unsaved new chat', '', '/'],
    ];
    for (const [name, query, route] of cases) {
      const page = await open(query, 1280, route);
      await select(page);
      await page.waitForFunction(() => !document.querySelector('.native').hidden);
      await page.waitForTimeout(400);
      assert.equal((await rects(page)).chip, null, `no button: ${name}`);
      await page.close();
    }
    // Control: the same fixture in Chat mode, Chinese UI, while the latest reply streams.
    for (const query of ['lang=zh', 'stream=60000']) {
      const page = await open(query);
      await select(page);
      await chipOf(page).waitFor({ timeout: 3000 });
      await page.close();
    }
    pass(`hidden: ${cases.map(([n]) => n).join(', ')}; shown in the Chat-mode controls`);
  },
};
