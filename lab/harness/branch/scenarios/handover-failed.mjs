// ---- Failed hand-over (the worker can't store the job): the new tab closes, the question stays
// in the box with the reason. The worker's session `set` is patched for the job rows and put back
// at the end; `start` puts it back too if this scenario throws first.
import assert from 'node:assert/strict';
import { inShadow } from '../driver.mjs';

export default {
  name: 'handover-failed',
  description: "The worker can't store the job: the empty new tab closes, the question stays in the box with the reason",
  async run({ open, ask, worker, pass }) {
    await worker.evaluate(() => {
      const area = chrome.storage.session,
        set = area.set;
      globalThis.__set = set;
      area.set = (items) =>
        Object.keys(items).some((k) => k.startsWith('butterBranch.'))
          ? Promise.reject(new Error('fixture: storage refused'))
          : set.call(area, items);
    });
    const page = await open();
    const dest = await ask(page);
    await dest.waitForEvent('close', { timeout: 5_000 }).catch(() => {});
    assert.equal(dest.isClosed(), true, 'the empty new tab is closed');
    await inShadow(page, '.foot .reason').waitFor();
    assert.equal(await inShadow(page, '.foot .reason').innerText(), 'Couldn’t hand your question to the new tab. Try again.');
    assert.equal(await inShadow(page, 'textarea').inputValue(), 'What does RAG mean here?');
    await worker.evaluate(() => (chrome.storage.session.set = globalThis.__set));
    await page.close();
    pass('failed hand-over: new tab closed, question kept in the box with the reason');
  },
};
