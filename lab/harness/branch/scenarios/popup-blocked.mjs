// ---- Pop-up blocked: no new tab; the box keeps the question and says why, the job is dropped,
// and a later Enter works once pop-ups are allowed.
// Chrome's pop-up blocker doesn't stop window.open from an extension's content script, even without
// a user gesture (checked with this harness). So the blocked case is simulated where Butter calls
// it: window.open returns null in Butter's isolated world, as when blocked.
import assert from 'node:assert/strict';
import { boxClosed, chipOf, inShadow, rects, select, settle } from '../driver.mjs';

export default {
  name: 'popup-blocked',
  description: "A blocked pop-up: no new tab, the question kept in the box with the whole reason, the job dropped; Enter works once pop-ups are allowed",
  async run({ open, context, worker, capture, pass }) {
    const page = await open();
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).click();
    await inShadow(page, 'textarea').fill('What does RAG mean here?');
    const pages = context.pages().length;
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', ({ context: c }) => worlds.push(c));
    await cdp.send('Runtime.enable');
    const butterWorld = worlds.find((c) => c.auxData?.type === 'isolated' && c.origin.startsWith('chrome-extension://'));
    assert.ok(butterWorld, "Butter's isolated world");
    const block = (on) =>
      cdp.send('Runtime.evaluate', {
        contextId: butterWorld.id,
        expression: on ? 'window.__open = window.open; window.open = () => null;' : 'window.open = window.__open;',
      });
    await block(true);
    await inShadow(page, 'textarea').press('Enter');
    await page.waitForTimeout(1_000);
    assert.equal(context.pages().length, pages, 'no new tab opened');
    assert.equal(await inShadow(page, 'textarea').inputValue(), 'What does RAG mean here?');
    assert.equal(
      await inShadow(page, '.foot span').first().innerText(),
      'Chrome blocked the new tab. Allow pop-ups for chatgpt.com, then try again.',
    );
    assert.equal(
      await inShadow(page, '.foot .reason').evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      'the whole reason shows, not cut off',
    );
    assert.equal((await rects(page)).chip, null, 'button stays hidden while the box stays open');
    const rows = await worker.evaluate(() => chrome.storage.session.get(null));
    assert.deepEqual(Object.keys(rows).filter((k) => k.startsWith('butterBranch.')), [], 'job dropped');
    await settle(page);
    await capture(page, 'blocked', 1280, 'light');
    // The question box still works once pop-ups are allowed.
    await block(false);
    await cdp.detach();
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.line').waitFor({ timeout: 20_000 });
    await boxClosed(page);
    await dest.close();
    await page.close();
    pass('pop-up blocked: no tab, question kept with the reason; a later Enter works');
  },
};
