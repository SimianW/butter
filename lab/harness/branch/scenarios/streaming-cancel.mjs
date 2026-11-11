// ---- Cancel while waiting for the latest reply, via #28's controls (×, Cancel, Esc): the cover
// goes at once, nothing is branched or sent, even after the stream ends, and a cancel is not a
// status failure.
import assert from 'node:assert/strict';
import { heading, inShadow } from '../driver.mjs';

export default {
  name: 'streaming-cancel',
  description: 'While the new tab waits for a streaming reply, ×, Cancel and Esc stop at once; nothing branched, typed or sent; not a failure',
  scene: 'stream=3000',
  async run({ open, askCard, failures, pass }) {
    for (const how of ['×', 'Cancel', 'Esc']) {
      const page = await open();
      const dest = await askCard(page);
      assert.equal(await heading(dest), 'Waiting for the reply to finish…');
      if (how === '×') await inShadow(dest, '.card .x').click();
      else if (how === 'Cancel') await inShadow(dest, '.card .btn').click();
      else await dest.keyboard.press('Escape');
      assert.equal(await inShadow(dest, '.card').count(), 0, `${how}: card gone at once`);
      assert.equal(await inShadow(dest, '.scrim').count(), 0, `${how}: cover gone at once`);
      assert.equal(await dest.title(), 'Explain Corpus Meaning', `${how}: title restored`);
      await dest.waitForFunction(() => fixture.streamEnded === true);
      await dest.waitForTimeout(2500);
      assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], `${how}: never branched`);
      assert.equal(await dest.evaluate(() => fixture.morePresses), 0, `${how}: no menu press`);
      assert.deepEqual(await dest.evaluate(() => fixture.sent), [], `${how}: nothing sent`);
      assert.equal(await dest.evaluate(() => document.querySelector('.ProseMirror').innerText.trim()), '');
      await dest.close();
      await page.close();
    }
    assert.deepEqual(await failures(), {}, 'a cancel while waiting is not a failure');
    pass('streaming: ×, Cancel and Esc while waiting stop at once; nothing branched, typed or sent');
  },
};
