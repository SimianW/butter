// ---- Streaming: the button works while the latest reply is written; the new tab waits, with the
// working card's waiting variant per the mockup, then branches from the finished latest reply and
// sends there.
import assert from 'node:assert/strict';
import { cardGeometry, heading, inShadow } from '../driver.mjs';

export default {
  name: 'streaming',
  description: 'While the latest reply streams the button is offered; the new tab waits (card per the mockup, title), then branches the finished latest reply and sends there',
  scene: 'stream=5000&slow=300',
  async run({ open, askCard, pass, BRANCH, LATEST }) {
    const page = await open();
    // The latest reply is streaming in the original tab too: the button is still offered.
    assert.equal(await page.evaluate(() => fixture.streamEnded), undefined);
    const dest = await askCard(page);
    assert.equal(await heading(dest), 'Waiting for the reply to finish…');
    assert.equal(await dest.title(), 'Waiting for the reply to finish…', 'tab title while waiting');
    const g = await cardGeometry(dest);
    assert.equal(Math.round(g.card.width), 400);
    assert.equal(Math.round(g.card.top), 250);
    assert.equal(Math.round(g.card.left + g.card.width / 2), g.width / 2, 'centred');
    assert.equal(Math.round(g.scrim.top), 0, 'scrim covers the header too');
    assert.equal(Math.round(g.scrim.height), 800, 'scrim covers the full height');
    assert.equal(await dest.evaluate(() => fixture.branchedFrom.length), 0, 'no branch while streaming');
    // Then branches from the finished latest reply and sends there.
    await inShadow(dest, '.line').waitFor({ timeout: 20000 });
    assert.equal(await dest.evaluate(() => fixture.streamEnded), true);
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest']);
    assert.deepEqual(await dest.evaluate(() => fixture.branchedText), [LATEST], 'finished reply');
    const sent = await dest.evaluate(() => fixture.sent);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].conv, BRANCH);
    await dest.close();
    await page.close();
    pass('streaming: button offered, new tab waits (card per mockup, title), then branches the finished latest reply');
  },
};
