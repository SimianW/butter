// ---- ChatGPT in Simplified Chinese (Butter in English): its menus are matched and the flow
// completes, sending once through the Chinese "发送" button.
import assert from 'node:assert/strict';
import { inShadow } from '../driver.mjs';

export default {
  name: 'chinese-menus',
  description: 'ChatGPT in Simplified Chinese, Butter in English: 更多操作 → 创建对话分支 → 在新聊天中创建分支, sent once in the branch',
  scene: 'lang=zh&slow=200',
  async run({ open, askCard, pass, BRANCH, QUOTE }) {
    const page = await open();
    const dest = await askCard(page);
    await inShadow(dest, '.line').waitFor();
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest']);
    assert.equal(await dest.evaluate(() => fixture.workClicks), 0, 'never Work mode');
    const sent = await dest.evaluate(() => fixture.sent);
    assert.deepEqual(
      sent.map((m) => ({ ...m, text: m.text.replace(/\n{3,}/g, '\n\n').trim() })),
      [{ conv: BRANCH, text: `> ${QUOTE}\n\nWhat does RAG mean here?` }],
      'sent once via the Chinese "发送" button, in the verified branch',
    );
    await dest.close();
    await page.close();
    pass('Chinese ChatGPT menus: 更多操作 → 创建对话分支 → 在新聊天中创建分支; sent once in the branch');
  },
};
