// ---- Cancel while sending: the branch is verified and filled, but ChatGPT's Send button enables
// only 2.5 s later. The card stays, and Esc in that window sends nothing.
import assert from 'node:assert/strict';
import { inShadow } from '../driver.mjs';

export default {
  name: 'cancel-sending',
  description: "Esc while the filled branch waits for ChatGPT's delayed Send button: card gone, nothing sent, no ready line; not a failure",
  async run({ open, ask, failures, pass }) {
    const page = await open();
    const dest = await ask(page, { fixture: 'senddelay=2500' });
    await dest.waitForFunction(() => document.querySelector('.ProseMirror').innerText.trim() && fixture.sent.length === 0);
    assert.equal(await inShadow(dest, '.card').count(), 1, 'card kept while waiting for Send');
    await dest.keyboard.press('Escape');
    assert.equal(await inShadow(dest, '.card').count(), 0, 'card gone at once');
    assert.equal(await inShadow(dest, '.scrim').count(), 0, 'cover gone at once');
    await dest.waitForTimeout(2500 + 1000);
    assert.equal(await dest.evaluate(() => fixture.sent.length), 0, 'sent after Esc');
    assert.equal(await inShadow(dest, '.line').count(), 0, 'no ready line after cancel');
    await dest.close();
    await page.close();
    assert.deepEqual(await failures(), {}, 'a cancel while sending is not a failure');
    pass('Esc while waiting for a delayed Send button: card gone, nothing sent');
  },
};
