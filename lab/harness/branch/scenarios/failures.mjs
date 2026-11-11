// ---- Failure types: the card per mockup state 5, shown only after the re-check (about 3 s), with
// its cause, the question and its three buttons; nothing typed or sent; reported to status. Each
// case also exercises one of the card's controls: Esc and × close card and cover and keep the tab,
// Close tab closes it, Copy question copies the formatted message, and Try again does nothing while
// Ask in branch is off, then makes the branch and clears the status failure.
import assert from 'node:assert/strict';
import { CAUSES, destState, inShadow } from '../driver.mjs';

export default {
  name: 'failures',
  description: "Each failure type (no More actions, no Branch conversation, no load, same route, no Branch in new chat): card after the re-check with its cause, nothing sent, reported; Esc, ×, Close tab, Copy question and Try again",
  async run({ open, ask, settings, failures, pass, ORIGINAL, BRANCH, QUOTE }) {
    for (const [fail, control] of [
      ['more', 'Esc'],
      ['branch', 'Close tab'],
      ['load', '×'],
      ['identity', 'Copy question'],
      ['newchat', 'Try again'],
    ]) {
      const page = await open();
      const dest = await ask(page, { fixture: `fail=${fail}` });
      await inShadow(dest, '.card').waitFor();
      const shownAt = Date.now();
      await inShadow(dest, '.card.err').waitFor({ timeout: 40_000 });
      assert.ok(Date.now() - shownAt >= 2_900, `${fail}: failure shown before the re-check`);
      const card = inShadow(dest, '.card.err');
      assert.equal(await card.locator('h3').innerText(), 'Couldn’t create branch');
      assert.equal(await card.locator('p').innerText(), CAUSES[fail], `${fail}: cause sentence`);
      assert.equal(await card.locator('.quoted').innerText(), 'What does RAG mean here?');
      assert.deepEqual(await card.locator('.btns .btn').allInnerTexts(), ['Close tab', 'Copy question', 'Try again']);
      assert.equal(await inShadow(dest, '.scrim').count(), 1, 'failure card has the cover');
      const state = await destState(dest);
      assert.equal(state.sent, 0, `${fail}: nothing sent`);
      assert.equal(state.composer, '', `${fail}: nothing typed`);
      assert.equal(state.path, `/c/${ORIGINAL}`);
      assert.equal(await page.evaluate(() => fixture.sent.length), 0);
      assert.deepEqual(await failures(), { branch: { branch: true } }, `${fail}: reported`);
      if (control === 'Esc' || control === '×') {
        if (control === 'Esc') await dest.keyboard.press('Escape');
        else await card.locator('.x').click();
        assert.equal(await inShadow(dest, '.card').count(), 0, `${control} closes the card`);
        assert.equal(await inShadow(dest, '.scrim').count(), 0, `${control} closes the cover`);
        assert.equal(dest.isClosed(), false, `${control} keeps the tab`);
        await dest.close();
      } else if (control === 'Close tab') {
        const closed = dest.waitForEvent('close');
        await card.getByText('Close tab').click();
        await closed;
      } else if (control === 'Copy question') {
        await card.getByText('Copy question').click();
        await card.getByText('Copied').waitFor();
        assert.equal(await dest.evaluate(() => navigator.clipboard.readText()), `> ${QUOTE}\n\nWhat does RAG mean here?`, 'copies the formatted message');
        await dest.close();
      } else {
        // ChatGPT's menu is back, but Ask in branch is off: Try again does nothing.
        await dest.evaluate(() => (fixture.noNewChat = false));
        await settings({ opts: { branch: false } });
        await card.getByText('Try again').click();
        await dest.waitForTimeout(3000);
        assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], 'retry while off: never branched');
        assert.equal(await dest.evaluate(() => fixture.sent.length), 0, 'retry while off: nothing sent');
        await settings({});
        // Back on: Try again makes the branch, and the status failure clears.
        await card.getByText('Try again').click();
        await inShadow(dest, '.card:not(.err)').waitFor();
        await inShadow(dest, '.line').waitFor({ timeout: 20_000 });
        assert.deepEqual((await dest.evaluate(() => fixture.sent)).map((m) => m.conv), [BRANCH], 'sent once, in the branch');
        assert.deepEqual(await failures(), {}, 'a later successful branch clears the failure');
        await dest.close();
      }
      await page.close();
      pass(`failure ${fail}: card after the re-check, cause shown, nothing sent, reported; ${control}`);
    }
  },
};
