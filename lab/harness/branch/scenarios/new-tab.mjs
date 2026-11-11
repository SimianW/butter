// ---- 3, 4 · New tab: overlay while branching, then verified branch, sent, line above composer.
// The original tab is left as it was (URL, draft, scroll, title); the job is claimed once and gone;
// the line stays after Butter's send and goes after the user's own next send.
import assert from 'node:assert/strict';
import { assertCovers, boxClosed, chipOf, inShadow, lineGeometry, rects, select, settle } from '../driver.mjs';

export default {
  name: 'new-tab',
  description: 'Mockup states 3 and 4: the new tab shows the working card and title, branches the latest reply, verifies it, sends once and shows the ready line; the original tab is unchanged',
  scene: 'slow=600&land=600',
  async run({ open, context, worker, pass, BRANCH, QUOTE }) {
    const page = await open();
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).click();
    await inShadow(page, 'textarea').fill('What does RAG mean here?');
    const before = await page.evaluate(() => ({
      url: location.href,
      draft: document.querySelector('.ProseMirror').innerText,
      scroll: document.querySelector('.thread-scroll-container').scrollTop,
      title: document.title,
    }));
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.card').waitFor();
    assert.match(await inShadow(dest, '.card').innerText(), /Creating branch…[\s\S]*What does RAG mean here\?/);
    assert.equal(await dest.title(), 'Creating branch…', 'tab title while working');
    assert.ok(!dest.url().includes('butter-branch'), 'job id dropped from the URL');
    await inShadow(dest, '.line').waitFor();
    assert.equal(await inShadow(dest, '.card').count(), 0, 'overlay gone');
    assert.equal(await inShadow(dest, '.line .t').innerText(), 'Branched from “Explain Corpus Meaning” · original unchanged');
    const sent = await dest.evaluate(() => fixture.sent);
    assert.deepEqual(
      sent.map((m) => ({ ...m, text: m.text.replace(/\n{3,}/g, '\n\n').trim() })),
      [{ conv: BRANCH, text: `> ${QUOTE}\n\nWhat does RAG mean here?` }],
      'quote and question sent once, in the verified branch',
    );
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest'], 'latest reply');
    assert.equal(await dest.evaluate(() => fixture.workClicks), 0, 'never Work mode');
    assert.equal(await dest.title(), 'Branch · Explain Corpus Meaning', 'title restored');
    // Line placement: on ChatGPT's disclaimer, checked in full in `lines`. The line appears as the
    // sent composer shrinks; let one 200 ms placement tick follow it.
    await dest.waitForTimeout(250);
    assertCovers(await lineGeometry(dest), 'new tab');
    // The original tab's box closes once the new tab has claimed the job.
    await boxClosed(page);
    // Original tab unchanged.
    const after = await page.evaluate(() => ({
      url: location.href,
      draft: document.querySelector('.ProseMirror').innerText,
      scroll: document.querySelector('.thread-scroll-container').scrollTop,
      title: document.title,
    }));
    assert.deepEqual(after, before, 'original tab unchanged');
    assert.equal(await page.evaluate(() => fixture.sent.length), 0, 'nothing sent in the original');
    // The job was claimed once and is gone; reopening the link does nothing.
    assert.equal((await rects(page)).chip, null, 'button stays hidden while the box stays open');
    const rows = await worker.evaluate(() => chrome.storage.session.get(null));
    assert.deepEqual(Object.keys(rows).filter((k) => k.startsWith('butterBranch.')), []);
    // The line stays after Butter's send and disappears after the user's own next send.
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line still shown');
    await dest.locator('.ProseMirror').click();
    await dest.keyboard.type('And fine-tuning?');
    await dest.locator('.send:not(.stop)').click();
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 0, 'line gone after the next send');
    await dest.close();
    await page.close();
    pass('new tab: overlay + title, latest reply branched, identity verified, sent once, line, original unchanged, job gone');
  },
};
