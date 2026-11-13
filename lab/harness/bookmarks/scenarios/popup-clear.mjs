// Clear from the popup (#108), in the real popup page beside an open chat: the Bookmarks row says
// what is saved; its Clear asks first naming the count without toggling the row's switch, with focus
// on the red Clear, and Cancel puts the row back with focus on Clear; the red Clear empties the store
// for every account, says "Cleared" for 2 s, and the open tab's dots go without a reload. Saved
// layouts are untouched.
import { row } from '../fixture.mjs';

const OTHER = 'b'.repeat(64);

export default {
  name: 'popup-clear',
  description: 'Clear in the popup: asks first with the count, Cancel, then clears every account, says Cleared, and the open tab’s dots go',
  store: [row(6, 3), row(2, 1), row(4, 2, { account: OTHER })],
  async run(qa) {
    const { open, check, page, popup, stored, dotCount, allDots, worker } = qa;
    await open('light');
    await dotCount(2);
    // A saved layout, which the bookmark Clear must leave.
    await worker.evaluate(async () => {
      const tx = (await database()).transaction('geometry', 'readwrite');
      tx.objectStore('geometry').put({ key: 'harness-layout', account: 'x', conv: 'y' });
      await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
    });
    const p = await popup();
    const line = () => p.locator('[data-store="bookmarks"]').first().evaluate((el) => el.closest('.row').querySelector('.d').textContent);
    await p.waitForFunction(() => /3 saved/.test(document.querySelector('label[for="sw-bookmarks"] .d')?.textContent));
    const saved = await line();
    check('the Bookmarks row says how many are saved, every account, then Clear', /^3 saved, about \d+ KBClear$/.test(saved), { saved });

    await p.locator('button.lk[data-store="bookmarks"]').click();
    const asked = await p.evaluate(() => {
      const q = document.querySelector('.row.ask');
      return {
        n: q?.querySelector('.n').textContent,
        d: q?.querySelector('.d').textContent,
        focus: document.activeElement?.dataset.clear,
      };
    });
    const switchOn = await p.evaluate(async () => (await chrome.storage.local.get('butter')).butter.opts?.bookmark !== false);
    check('Clear asks first, naming the count, with focus on the red Clear; the switch stays on',
      asked.n === 'Clear 3 bookmarks?' && asked.d === "This can't be undone." && asked.focus === 'confirm' && switchOn,
      { asked, switchOn });
    await p.locator('[data-store="bookmarks"][data-clear="cancel"]').click();
    const cancelled = await p.evaluate(() => ({ asking: !!document.querySelector('.row.ask'), focus: document.activeElement?.className }));
    check('Cancel puts the row back with focus on Clear, and deletes nothing',
      !cancelled.asking && cancelled.focus === 'lk' && (await stored()).length === 3, cancelled);

    await p.locator('button.lk[data-store="bookmarks"]').click();
    await p.locator('[data-store="bookmarks"][data-clear="confirm"]').click();
    await p.waitForFunction(() => document.querySelector('label[for="sw-bookmarks"] .d')?.textContent === 'Cleared');
    const at = Date.now();
    const left = await stored();
    const layouts = await worker.evaluate(
      async () =>
        new Promise((ok) => {
          database().then((db) => {
            const q = db.transaction('geometry').objectStore('geometry').count();
            q.onsuccess = () => ok(q.result);
          });
        }),
    );
    check('the red Clear empties the store for every account and leaves saved layouts', left.length === 0 && layouts === 1, { left: left.length, layouts });
    await p.waitForFunction(() => document.querySelector('label[for="sw-bookmarks"] .d')?.textContent === 'Select text, mark the spot to jump back', null, { timeout: 4000 });
    const shown = Date.now() - at;
    check('"Cleared" shows for about 2 s, then the description', shown >= 1700 && shown <= 3200, { shown });

    await page.bringToFront();
    let gone = true;
    await dotCount(0).catch(() => (gone = false));
    check('the open tab’s dots go without a reload', gone, { dots: await allDots() });
    await p.close();
  },
};
