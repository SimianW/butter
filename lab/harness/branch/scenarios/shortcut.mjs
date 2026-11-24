// ---- The Ask in branch shortcut (#126): the `branch` command's key (Alt+Shift+Q) opens the
// question box for the selection in one reply, focused, with the selection as its quote, as a click
// on the cell does; also with ChatGPT's "Ask ChatGPT" absent (no pill), when the box opens under the
// quote. A press that has nothing to act on does nothing, silently: no selection, a selection across
// two replies, Temporary Chat, an unsaved chat or branch, Ask in branch off, Butter paused; the page
// selection and focus stay as they were. With the box open, the key puts focus back in its input; a
// draft left with Esc comes back when the key reopens the box. The cell's label reads "Ask in
// branch" + "Alt Shift Q" with the key set (aria-keyshortcuts too), and "Ask in branch" alone with
// the key removed in the profile.
// The key is real X input when the run is headed (an X display: run it under xvfb-run, see
// branch-qa.mjs); without a display the worker relays the command, which checks the page side only.
// Screenshots for the mockup's panels (issue #126's Mockup artifact): shortcut-label-1280-light.png
// is `after-light`, shortcut-label-1280-dark.png `after-dark`, and shortcut-label-1280-nokey.png the
// no-key half of `after-mac` (the ⌥⇧Q half can't render on Linux; the formatter's unit test covers
// it).
import assert from 'node:assert/strict';
import { butter, chipOf, HOST, inShadow, select, settle } from '../driver.mjs';

const KEY = 'Alt+Shift+Q';
// The question box, focus and the page selection, as the reader sees them.
const state = (page) =>
  page.evaluate((host) => {
    const el = document.querySelector(host),
      root = el?.shadowRoot,
      box = root?.querySelector('.qpop');
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#quote'));
    return {
      open: !!box,
      focused: !!box && document.activeElement === el && root.activeElement?.tagName === 'TEXTAREA',
      quote: box?.querySelector('.q span')?.textContent ?? null,
      draft: box?.querySelector('textarea')?.value ?? null,
      box: box?.getBoundingClientRect().toJSON() ?? null,
      quoteBox: range.getBoundingClientRect().toJSON(),
      selection: getSelection().toString(),
      active: document.activeElement?.tagName ?? null,
    };
  }, HOST);

export default {
  name: 'shortcut',
  description:
    'The Ask in branch key (Alt+Shift+Q): opens the focused box for a reply selection, with or without the pill; silent where the cell would not show, off or paused; refocuses an open box; keeps the draft; the label’s key hint, and none with the key removed',
  keys: true, // presses the `branch` command's key: headed under an X display
  async run({ open, settings, shortcut, commandKey, setCommandKey, capture, keys, log, pass, QUOTE, BRANCH }) {
    log(`INFO the key is ${keys ? 'pressed as X input' : 'relayed by the worker (no X display)'}`);
    try {
      if ((await commandKey()) !== KEY) await setCommandKey(KEY);
      assert.equal(await commandKey(), KEY, 'Chrome assigns the suggested key');

      // The label's key hint, light and dark (the mockup's after-light and after-dark).
      for (const theme of ['light', 'dark']) {
        const page = await open(theme === 'dark' ? 'theme=dark' : '');
        await select(page);
        await chipOf(page).waitFor();
        await settle(page);
        const p = await butter(page).hoverCell('branch');
        const cell = p?.cells.find((c) => c.id === 'branch');
        assert.equal(p?.tip?.text, 'Ask in branch', `${theme}: label`);
        assert.equal(p?.tip?.kbd, 'Alt Shift Q', `${theme}: key hint`);
        assert.ok(p?.tip?.kbdShown, `${theme}: key hint shown`);
        assert.equal(cell?.keys, KEY, `${theme}: aria-keyshortcuts`);
        await capture(page, 'shortcut-label', 1280, theme);
        await page.close();
      }
      pass('shortcut: the cell’s label shows "Ask in branch" + "Alt Shift Q", and aria-keyshortcuts carries it');

      // A selection in one reply, the key pressed at once (before the pill shows): the box opens,
      // focused, with the selection as its quote.
      let page = await open();
      await select(page);
      await shortcut(page);
      let s = await state(page);
      assert.ok(s.open, 'the key opens the box');
      assert.ok(s.focused, 'its input is focused');
      assert.equal(s.quote, QUOTE, 'its quote is the selection');
      pass('shortcut: with text selected in a reply the key opens the question box, focused, quoting it');

      // Box open, focus moved to the page (the composer): the key puts focus back in the box.
      await page.evaluate(() => document.querySelector('.ProseMirror').focus());
      assert.equal((await state(page)).focused, false, 'focus moved to the page');
      await shortcut(page);
      s = await state(page);
      assert.ok(s.open && s.focused, 'the key puts focus back in the box’s input');
      pass('shortcut: with the box open the key puts focus back in its input');

      // A draft, Esc, the key: the box reopens with the draft.
      await inShadow(page, 'textarea').fill('Why retrieval?');
      await inShadow(page, 'textarea').press('Escape');
      s = await state(page);
      assert.ok(!s.open && s.selection === QUOTE, 'Esc closes and gives the selection back');
      await shortcut(page);
      s = await state(page);
      assert.ok(s.open && s.focused, 'the key reopens the box');
      assert.equal(s.draft, 'Why retrieval?', 'with the draft');
      await inShadow(page, 'textarea').press('Escape');
      pass('shortcut: a draft left with Esc comes back when the key reopens the box');
      await page.close();

      // ChatGPT's button absent, so no pill: the box opens under the quote.
      page = await open();
      await page.evaluate(() => (fixture.nativeHidden = true));
      await select(page);
      await page.waitForTimeout(400);
      assert.equal((await butter(page).pill()).shown, false, 'no pill without ChatGPT’s button');
      await shortcut(page);
      s = await state(page);
      assert.ok(s.open && s.focused && s.quote === QUOTE, 'the key opens the box without the pill');
      assert.ok(Math.abs(s.box.top - (s.quoteBox.bottom + 8)) <= 1, `under the quote: ${JSON.stringify(s)}`);
      assert.ok(Math.abs(s.box.left - s.quoteBox.left) <= 1, `left-aligned with the quote: ${JSON.stringify(s)}`);
      pass('shortcut: with no pill (ChatGPT’s button absent) the key opens the box under the quote');
      await page.close();

      // Nothing to act on: no box, the selection and focus as they were.
      const quiet = async (name, page, prepare) => {
        await prepare(page);
        await page.waitForTimeout(300);
        const before = await state(page);
        await shortcut(page);
        const after = await state(page);
        assert.equal(after.open, false, `${name}: no box`);
        assert.equal(after.selection, before.selection, `${name}: selection unchanged`);
        assert.equal(after.active, before.active, `${name}: focus unchanged`);
        await page.close();
      };
      const cases = [
        ['no selection', () => open(), (p) => p.evaluate(() => getSelection().removeAllRanges())],
        ['a selection across two replies', () => open(), (p) => butter(p).selectText({ css: '#quote' }, 0, { css: '#latest' }, 9)],
        ['Temporary Chat', () => open('temporary-chat=true'), select],
        ['an unsaved branch', () => open('', 1280, `/c/${encodeURIComponent(BRANCH)}`), select],
        ['an unsaved new chat', () => open('', 1280, '/'), select],
      ];
      for (const [name, opening, prepare] of cases) await quiet(name, await opening(), prepare);
      for (const [name, value] of [
        ['Ask in branch off', { opts: { branch: false } }],
        ['Butter paused', { enabled: false }],
      ]) {
        await settings(value);
        await quiet(name, await open(), select);
        await settings({});
      }
      pass(`shortcut: nothing, silently: ${[...cases.map(([n]) => n), 'Ask in branch off', 'Butter paused'].join(', ')}`);

      // The key removed in Chrome's shortcut settings: the label shows the name alone (the no-key
      // half of the mockup's after-mac).
      await setCommandKey('');
      assert.equal(await commandKey(), '', 'the key is removed');
      page = await open();
      await select(page);
      await chipOf(page).waitFor();
      await page.waitForTimeout(300); // the key is read again as the cell shows
      const p = await butter(page).hoverCell('branch');
      const cell = p?.cells.find((c) => c.id === 'branch');
      assert.equal(p?.tip?.text, 'Ask in branch', 'no key: label');
      assert.equal(p?.tip?.kbd, '', 'no key: no hint');
      assert.ok(!p?.tip?.kbdShown, 'no key: no hint shown');
      assert.equal(cell?.keys, null, 'no key: no aria-keyshortcuts');
      await capture(page, 'shortcut-label', 1280, 'nokey');
      await page.close();
      pass('shortcut: with the key removed the label reads "Ask in branch" alone');
    } finally {
      await settings({});
      if ((await commandKey()) !== KEY) await setCommandKey(KEY);
    }
  },
};
