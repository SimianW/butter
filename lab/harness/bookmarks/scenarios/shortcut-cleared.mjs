// The Bookmark command's key cleared in chrome://extensions/shortcuts, as a user may: the pill's
// label shows no key hint and the cell no aria-keyshortcuts. The key stays cleared in the profile
// until the harness's next `start` sets it back.
export default {
  name: 'shortcut-cleared',
  description: "The Bookmark command's key cleared in Chrome's shortcut settings: no key hint on the label, no aria-keyshortcuts",
  async run(qa) {
    const { open, check, page, bookmark, hoverCell, worker, context } = qa;
    const TURN = 6;
    // (f) Clear the command's key in Chrome's shortcut settings: the tooltip shows no hint.
    const settingsPage = await context.newPage();
    await settingsPage.goto('chrome://extensions/shortcuts');
    // The action's input has no key (its Clear is disabled); the bookmark command's is the other one.
    await settingsPage.locator('cr-shortcut-input #clear:not([disabled])').click();
    await settingsPage.waitForTimeout(300);
    await settingsPage.close();
    const cleared = await worker.evaluate(() => chrome.commands.getAll());
    await open('light');
    await bookmark(TURN, 2);
    await page.waitForTimeout(300); // the key is read again as the cell shows
    const noKey = await hoverCell('bookmark');
    const noKeyCell = noKey?.cells.find((c) => c.id === 'bookmark');
    check('with the key cleared, the label shows no shortcut hint and the cell no aria-keyshortcuts',
      cleared.find((c) => c.name === 'bookmark')?.shortcut === '' && noKey?.tip?.text === 'Bookmark selection' && noKey.tip.kbd === '' &&
        !noKey.tip.kbdShown && noKeyCell?.keys === null,
      { cleared, tip: noKey?.tip, keys: noKeyCell?.keys });
    await page.evaluate(() => getSelection().removeAllRanges());
  },
};
