// ---- Butter in Simplified Chinese (the mockup's language) and reduced motion: the cell's name,
// the box's foot, the working card and title (the spinner still under reduced motion), the ready
// line kept when ChatGPT saves the branch and gone on another route, the unsure line in the
// disclaimer's row, the waiting card and title, and the failure card in the mockup's own copy.
import assert from 'node:assert/strict';
import { assertCovers, chipOf, heading, inShadow, lineGeometry, select, settle } from '../driver.mjs';

export default {
  name: 'zh',
  description: 'Butter in Simplified Chinese with reduced motion: name, box, working and waiting cards and titles, ready line (kept on save, gone on another route), unsure line, failure card; shots',
  settings: { lang: 'zh' },
  async run({ open, context, ask, askCard, capture, settings, pass }) {
    const page = await open('slow=1500&hold=60000');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await select(page);
    await chipOf(page).waitFor();
    assert.equal(await chipOf(page).getAttribute('aria-label'), '在分支中问', 'Chinese accessible name');
    await chipOf(page).click();
    await inShadow(page, 'textarea').fill('这里的 RAG 具体指什么？和微调有什么区别？');
    assert.match(await inShadow(page, '.foot').innerText(), /在新标签页打开，这个对话不受影响[\s\S]*Esc[\s\S]*关闭/);
    await settle(page);
    await capture(page, 'question', 1280, 'light-zh');
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await dest.emulateMedia({ reducedMotion: 'reduce' });
    await inShadow(dest, '.card').waitFor();
    assert.match(await inShadow(dest, '.card h3').innerText(), /正在创建分支…/);
    assert.equal(await dest.title(), '正在创建分支…');
    assert.equal(
      await inShadow(dest, '.spinner').evaluate((el) => getComputedStyle(el).animationName),
      'none',
      'no spinning with reduced motion',
    );
    await settle(dest);
    await capture(dest, 'working', 1280, 'light-zh');
    await inShadow(dest, '.line').waitFor();
    assert.equal(await inShadow(dest, '.line .t').innerText(), '分支自《Explain Corpus Meaning》· 原对话不变');
    await capture(dest, 'ready', 1280, 'light-zh');
    // ChatGPT saves the branch after the first send (local id → saved id): the line stays.
    await dest.evaluate(() => history.pushState({}, '', '/c/0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f01'));
    await dest.waitForTimeout(500);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line kept when the branch is saved');
    // Going to another chat (or a new one) in this tab: the line goes.
    await dest.evaluate(() => history.pushState({}, '', '/'));
    await dest.waitForTimeout(500);
    assert.equal(await inShadow(dest, '.line').count(), 0, 'line gone on another route');
    await dest.close();
    await page.close();
    // The unsure line in Chinese, in the disclaimer's row.
    {
      const p2 = await open();
      const unsure = await ask(p2, { fixture: 'senddelay=60000' });
      await inShadow(unsure, '.line.unsure').waitFor({ timeout: 30_000 });
      await unsure.waitForTimeout(250);
      assert.equal(await inShadow(unsure, '.line .t').innerText(), '未发送：无法确认这是新的分支。');
      assertCovers(await lineGeometry(unsure), 'zh unsure');
      await capture(unsure, 'line-unsure', 1280, 'light-zh');
      await unsure.close();
      await p2.close();
    }
    const streaming = await open('lang=zh&stream=60000');
    const waiting = await askCard(streaming, '这里的 RAG 具体指什么？和微调有什么区别？');
    assert.equal(await heading(waiting), '正在等待回复完成…');
    assert.equal(await waiting.title(), '正在等待回复完成…');
    await settle(waiting);
    await capture(waiting, 'waiting', 1280, 'light-zh');
    await inShadow(waiting, '.card .btn').click();
    await waiting.close();
    await streaming.close();
    // State 5 in Chinese, the mockup's own copy.
    const zh = await open();
    const failed = await ask(zh, {
      question: '这里的 RAG 具体指什么？和微调有什么区别？',
      fixture: 'fail=newchat',
    });
    await inShadow(failed, '.card.err').waitFor({ timeout: 40_000 });
    const card = inShadow(failed, '.card.err');
    assert.equal(await card.locator('h3').innerText(), '没能创建分支');
    assert.equal(await card.locator('p').innerText(), '找不到 ChatGPT 的 “Branch in new chat” 菜单。没有发送任何内容。');
    assert.deepEqual(await card.locator('.btns .btn').allInnerTexts(), ['关闭标签页', '复制问题', '重试']);
    await failed.mouse.click(5, 5); // lands on the full-page cover
    await settle(failed);
    await capture(failed, 'failure', 1280, 'light-zh');
    await failed.close();
    await zh.close();
    await settings({});
    pass('Simplified Chinese strings and title (creating and waiting); spinner still under reduced motion; zh failure card');
  },
};
