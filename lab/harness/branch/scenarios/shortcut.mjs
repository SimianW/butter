// ---- The Ask in branch shortcut (#126): the `branch` command's key (Alt+Shift+Q) opens the
// question box for the selection in one reply, focused, with the selection as its quote, as a click
// on the cell does; also pressed right after selecting, before the pill shows, and with ChatGPT's
// "Ask ChatGPT" absent (no pill), when the box opens under the quote. A press that has nothing to act on does nothing, silently: no selection, a selection across
// two replies, Temporary Chat, an unsaved chat or branch, Ask in branch off, Butter paused; the same
// element keeps focus and the selection keeps its exact range. With the box open, the key puts focus back in its input; a
// draft left with Esc comes back when the key reopens the box. The cell's label reads "Ask in
// branch" + "⌥⇧Q" with the key set (aria-keyshortcuts too), and "Ask in branch" alone with
// the key removed in the profile.
// The key is real X input when the run is headed (an X display: run it under xvfb-run, see
// branch-qa.mjs); without a display the worker relays the command, which checks the page side only.
// Evidence shots for the mockup's panels (issue #126's Mockup artifact), cropped to the selection,
// the pill and the label: shortcut-label-1280-light.png is `after-light`, shortcut-label-1280-dark.png
// `after-dark`, and shortcut-label-1280-nokey.png the no-key half of `after-mac` (the ⌥⇧Q half can't
// render on Linux; the formatter's unit test covers it).
import assert from 'node:assert/strict';
import { butter, chipOf, HOST, inShadow, select, settle, xkeys } from '../driver.mjs';

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
    };
  }, HOST);

// Spec story 19, "no focus change, selection untouched": `mark` keeps the focused element (and the
// one focused inside its shadow root) and the selection's range in the page, `unchanged` compares
// them by identity after the press: the same nodes and offsets, not only the same tag and text.
const mark = (page) =>
  page.evaluate(() => {
    const s = getSelection(),
      a = document.activeElement;
    window.__quiet = {
      active: a,
      inner: a?.shadowRoot?.activeElement ?? null,
      rangeCount: s.rangeCount,
      anchorNode: s.anchorNode,
      anchorOffset: s.anchorOffset,
      focusNode: s.focusNode,
      focusOffset: s.focusOffset,
      text: s.toString(),
    };
  });
const unchanged = (page) =>
  page.evaluate(() => {
    const was = window.__quiet,
      s = getSelection(),
      a = document.activeElement;
    return {
      focus: a === was.active && (a?.shadowRoot?.activeElement ?? null) === was.inner,
      selection:
        s.rangeCount === was.rangeCount &&
        s.anchorNode === was.anchorNode &&
        s.anchorOffset === was.anchorOffset &&
        s.focusNode === was.focusNode &&
        s.focusOffset === was.focusOffset &&
        s.toString() === was.text,
      was: { active: was.active?.tagName ?? null, text: was.text, rangeCount: was.rangeCount },
      now: { active: a?.tagName ?? null, text: s.toString(), rangeCount: s.rangeCount },
    };
  });

// Samples every frame, from now until the question box shows, whether the pill has shown; resolves
// in `seen()` with { pill, box }.
const watchPill = (page, host) =>
  page.evaluate(
    ([pillHost, boxHost]) => {
      const w = (window.__pillWatch = { pill: false, box: false });
      const tick = () => {
        const pill = document.querySelector(pillHost)?.shadowRoot?.querySelector('.pill');
        w.box ||= !!document.querySelector(boxHost)?.shadowRoot?.querySelector('.qpop');
        if (!w.box) w.pill ||= !!pill && getComputedStyle(pill).display !== 'none';
        if (!w.box) requestAnimationFrame(tick);
      };
      tick();
    },
    ['chatgpt-butter-pill', host],
  );
const seen = (page) => page.evaluate(() => ({ ...window.__pillWatch }));

// Hovers Ask in branch's cell and returns the pill once its label shows (or after 1.5 s without it):
// the label's 300 ms delay can run late on a busy machine.
const hoverLabel = async (page) => {
  let p = await butter(page).hoverCell('branch');
  for (let i = 0; p && !p.tip && i < 15; i++) {
    await page.waitForTimeout(100);
    p = await butter(page).pill();
  }
  return p;
};

// The selection, the pill and its label together, in CSS px: the region the label shots crop to.
const labelArea = async (page, p) => {
  const quote = await page.evaluate(() => getSelection().getRangeAt(0).getBoundingClientRect().toJSON());
  const boxes = [quote, p.box, p.tip].filter(Boolean);
  const left = Math.min(...boxes.map((b) => b.left)),
    top = Math.min(...boxes.map((b) => b.top)),
    right = Math.max(...boxes.map((b) => b.right)),
    bottom = Math.max(...boxes.map((b) => b.bottom));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

export default {
  name: 'shortcut',
  description:
    'The Ask in branch key (Alt+Shift+Q): opens the focused box for a reply selection, before the pill shows, with it or without it; silent where the cell would not show, off or paused; refocuses an open box; keeps the draft; the label’s key hint, and none with the key removed',
  keys: true, // presses the `branch` command's key: headed under an X display
  async run({ open, settings, shortcut, commandKey, setCommandKey, capture, keys, log, pass, QUOTE, BRANCH }) {
    log(`INFO the key is ${keys ? 'pressed as X input' : 'relayed by the worker (no X display)'}`);
    // Headed, a clipped screenshot replays the real X pointer's position into the page, which ends
    // the label's hover: park the pointer on the tab strip first, as every key press does (a lone
    // Shift there, out of the page).
    if (keys) xkeys('Shift');
    try {
      // Read on the fresh profile before anything sets it: the manifest's suggested key.
      assert.equal(await commandKey(), KEY, 'Chrome assigns the suggested key');

      // The label's key hint, light and dark (the mockup's after-light and after-dark).
      for (const theme of ['light', 'dark']) {
        const page = await open(theme === 'dark' ? 'theme=dark' : '');
        await select(page);
        await chipOf(page).waitFor();
        await settle(page);
        const p = await hoverLabel(page);
        const cell = p?.cells.find((c) => c.id === 'branch');
        assert.equal(p?.tip?.text, 'Ask in branch', `${theme}: label`);
        assert.equal(p?.tip?.kbd, '⌥⇧Q', `${theme}: key hint`);
        assert.ok(p?.tip?.kbdShown, `${theme}: key hint shown`);
        assert.equal(cell?.keys, KEY, `${theme}: aria-keyshortcuts`);
        await capture(page, 'shortcut-label', 1280, theme, { target: await labelArea(page, p), margin: 24 });
        assert.ok((await butter(page).pill()).tip, `${theme}: the label still shows after the shot`);
        await page.close();
      }
      pass('shortcut: the cell’s label shows "Ask in branch" + "⌥⇧Q", and aria-keyshortcuts carries it');

      // Spec story 8: the key works right after selecting, before the pill shows. ChatGPT's button
      // (which the pill follows) is held back, so the press reliably comes first; every frame until
      // the box shows is sampled for the pill.
      let page = await open();
      await page.evaluate(() => {
        const place = fixture.placeNative;
        fixture.placeNative = () => setTimeout(place, 2000);
      });
      await select(page);
      await watchPill(page, HOST);
      await shortcut(page);
      let s = await state(page);
      const watched = await seen(page);
      assert.ok(watched.box && s.open, 'the key opens the box');
      assert.equal(watched.pill, false, 'the pill was not showing at the press');
      assert.ok(s.focused && s.quote === QUOTE, `focused, quoting the selection: ${JSON.stringify(s)}`);
      await inShadow(page, 'textarea').press('Escape');
      await page.close();
      pass('shortcut: pressed right after selecting, before the pill shows, the key opens the box');

      // A selection in one reply, the pill showing: the box opens, focused, with the selection as
      // its quote.
      page = await open();
      await select(page);
      await chipOf(page).waitFor();
      await settle(page);
      await shortcut(page);
      s = await state(page);
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

      // Nothing to act on: no box, the same focused element and the same selection range.
      const quiet = async (name, page, prepare) => {
        await prepare(page);
        await page.waitForTimeout(300);
        await mark(page);
        await shortcut(page);
        assert.equal((await state(page)).open, false, `${name}: no box`);
        const same = await unchanged(page);
        assert.ok(same.selection, `${name}: selection untouched: ${JSON.stringify(same)}`);
        assert.ok(same.focus, `${name}: no focus change: ${JSON.stringify(same)}`);
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
      const p = await hoverLabel(page);
      const cell = p?.cells.find((c) => c.id === 'branch');
      assert.equal(p?.tip?.text, 'Ask in branch', 'no key: label');
      assert.equal(p?.tip?.kbd, '', 'no key: no hint');
      assert.ok(!p?.tip?.kbdShown, 'no key: no hint shown');
      assert.equal(cell?.keys, null, 'no key: no aria-keyshortcuts');
      await capture(page, 'shortcut-label', 1280, 'nokey', { target: await labelArea(page, p), margin: 24 });
      assert.ok((await butter(page).pill()).tip, 'no key: the label still shows after the shot');
      await page.close();
      pass('shortcut: with the key removed the label reads "Ask in branch" alone');
    } finally {
      await settings({});
      if ((await commandKey()) !== KEY) await setCommandKey(KEY);
    }
  },
};
