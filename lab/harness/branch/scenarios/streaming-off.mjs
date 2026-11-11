// ---- Turning Ask in branch off while the run waits for a streaming reply stops it like a cancel,
// and is not a status failure.
import assert from 'node:assert/strict';
import { heading, inShadow } from '../driver.mjs';

export default {
  name: 'streaming-off',
  description: 'Turning Ask in branch off while the new tab waits for a streaming reply stops the run; nothing branched or sent; not a failure',
  scene: 'stream=3000',
  async run({ open, askCard, settings, failures, pass }) {
    const page = await open();
    const dest = await askCard(page);
    assert.equal(await heading(dest), 'Waiting for the reply to finish…');
    await settings({ opts: { branch: false } });
    await dest.waitForFunction(() => fixture.streamEnded === true);
    await dest.waitForTimeout(2500);
    assert.equal(await inShadow(dest, '.card').count(), 0, 'setting off: card gone');
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], 'setting off: never branched');
    assert.deepEqual(await dest.evaluate(() => fixture.sent), [], 'setting off: nothing sent');
    await settings({});
    await dest.close();
    await page.close();
    assert.deepEqual(await failures(), {}, 'turning the setting off is not a failure');
    pass('streaming: turning Ask in branch off while waiting stops the run; nothing branched or sent');
  },
};
