// ---- Cancel: ×, Cancel and Esc stop at once while the menus open slowly; no further menu press,
// nothing sent, the tab left on the original chat with its title, and a cancel is not a failure.
import assert from 'node:assert/strict';
import { destState, inShadow, TIMING_STEP } from '../driver.mjs';

export default {
  name: 'cancel',
  description: 'While branching, ×, Cancel and Esc remove the card and cover at once; no further menu press, nothing sent, tab left on the original; not a failure',
  scene: 'slow=1500',
  async run({ open, ask, failures, pass, ORIGINAL }) {
    for (const how of ['×', 'Cancel', 'Esc']) {
      const page = await open();
      const dest = await ask(page);
      await inShadow(dest, '.card').waitFor();
      if (how === '×') await inShadow(dest, '.card .x').click();
      else if (how === 'Cancel') await inShadow(dest, '.card .btn').click();
      else await dest.keyboard.press('Escape');
      assert.equal(await inShadow(dest, '.card').count(), 0, `${how}: card gone at once`);
      assert.equal(await inShadow(dest, '.scrim').count(), 0, `${how}: cover gone at once`);
      const atCancel = await destState(dest);
      await dest.waitForTimeout(TIMING_STEP + 500);
      const later = await destState(dest);
      assert.equal(later.presses, atCancel.presses, `${how}: a menu press after cancel`);
      assert.deepEqual(
        { ...later, presses: 0 },
        { path: `/c/${ORIGINAL}`, sent: 0, branched: 0, presses: 0, composer: '', newChatItem: false },
        `${how}: tab left on the original, nothing sent`,
      );
      assert.equal(await dest.title(), 'Explain Corpus Meaning', `${how}: title restored`);
      assert.equal(await inShadow(dest, '.line').count(), 0);
      assert.equal(await page.evaluate(() => fixture.sent.length), 0);
      await dest.close();
      await page.close();
    }
    assert.deepEqual(await failures(), {}, 'a cancel is not a failure');
    pass('cancel via ×, Cancel and Esc: card gone at once, no further menu press, nothing sent');
  },
};
