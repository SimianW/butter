// ---- A branch that lands during the re-check (1 s after the verification window) is not a
// failure: no failure card is ever shown, and the question is sent once in the branch.
import assert from 'node:assert/strict';
import { inShadow, TIMING_VERIFY } from '../driver.mjs';

export default {
  name: 'late-landing',
  description: 'A branch that lands during the re-check: the ready line, no failure card on the way, sent once in the branch',
  async run({ open, ask, pass, BRANCH }) {
    const page = await open();
    const dest = await ask(page, { fixture: `land=${TIMING_VERIFY + 1_000}` });
    let sawFailure = false;
    while (!(await inShadow(dest, '.line').count())) {
      sawFailure ||= (await inShadow(dest, '.card.err').count()) > 0;
      await dest.waitForTimeout(150);
    }
    assert.equal(sawFailure, false, 'failure card shown although the branch landed');
    assert.deepEqual((await dest.evaluate(() => fixture.sent)).map((m) => m.conv), [BRANCH]);
    await dest.close();
    await page.close();
    pass('branch landing during the re-check: ready, no failure card');
  },
};
