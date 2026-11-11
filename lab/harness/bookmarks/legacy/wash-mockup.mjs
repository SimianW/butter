// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.
import path from 'node:path';
import { WASH } from './wash-kit.mjs';

// Called by washSection, which defines the helpers it passes. Builds each panel's state, rail
// included: questions 3, 7 and 10 hold bookmarks (10's stale), question 7's is the one jumped to
// and washed, and question 7 is the one being read. The whole frame is compared, inside its 1 px
// border and its rounded corners.
export async function washMockup(qa, { rowJump, waitWash, coverage, blockCoverage, sc, record, recorded, phases }) {
  const { context, page$, page, sha, CONV, answer, MOCK_TURN, PARAS, seedStore, dotCount, question, shots, check, compare } = qa;
  const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
  await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
  // No scrollbar: the centred mockup stays on whole pixels (as for the notice above).
  await mock.addStyleTag({ content: 'html { scrollbar-width: none }' });
  await mock.click('label:has(#labels-off)');
  await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
  // The panels' chat: the question, the answer's blocks, and the washed paragraph with the
  // selection's offsets in it. The wash's span stays as a plain span: the browser draws the text
  // of an inline element as a run of its own, so the glyphs match the panel's to the pixel.
  page$.scene = await mock.evaluate(() => {
    const col = document.querySelector('[data-panel="l-sel-dark"] .col').cloneNode(true),
      land = col.querySelector('.land'),
      goal = land.closest('p'),
      at = goal.textContent.indexOf(land.textContent),
      sel = [at, at + land.textContent.length];
    land.removeAttribute('class');
    land.removeAttribute('style');
    goal.removeAttribute('class');
    const q = col.querySelector('.q'),
      blocks = [...col.children].filter((e) => e !== q);
    return { q: q.innerHTML, blocks: blocks.map((e) => e.outerHTML), goal: blocks.indexOf(goal), text: goal.textContent, sel };
  });
  const s = page$.scene;
  // The bookmarked code block: the second one, as in l-code-light.
  const code = s.blocks.findIndex((h) => h.startsWith('<pre') && h.includes('CREATE INDEX'));
  // The frame's inside: 558 x 438.
  const REGION = { x: 0, y: 0, width: 558, height: 438 };
  await page.setViewportSize({ width: 566, height: 438 });
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  const seed = (turn, para, start, end, text) => ({
    account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end,
    excerpt: text.slice(start, Math.min(end, start + 120)).trim(), time: Date.now() + turn,
  });
  // The rail's other two dots: question 3's live bookmark and question 10's stale one.
  const OTHERS = [
    seed(2, 0, 0, 'Fixture answer 3.'.length, 'Fixture answer 3.'),
    { ...seed(9, 4, 0, 40, 'A paragraph this answer no longer has.'), excerpt: 'A paragraph this answer no longer has.' },
  ];
  for (const [theme, panel, para, range] of [
    ['light', 'l-3-light', s.goal, [0, s.text.length]],
    ['dark', 'l-sel-dark', s.goal, s.sel],
    ['light', 'l-code-light', code, null],
  ]) {
    await page.bringToFront(); // a tab in the background draws no frames
    await open(theme);
    // The bookmark's text: the paragraph's, or the code block's whole text.
    const text = await page.evaluate(([id, k, PARAS]) =>
      document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k].textContent, [answer(MOCK_TURN), para, PARAS]);
    const [start, end] = range ?? [0, text.length],
      b = seed(MOCK_TURN, para, start, end, text);
    await seedStore([b, ...OTHERS], { clear: true });
    await open(theme);
    await dotCount(3);
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await page.waitForTimeout(300);
    await record();
    await rowJump(MOCK_TURN, b);
    await waitWash();
    await page.waitForTimeout(400);
    // Where the panel has the chat: its column's top, below the frame's 44 px header. A wheel turn
    // first ends the pin the jump leaves on its landing.
    const colTop = await mock.evaluate((panel) => 44 + parseFloat(document.querySelector(`[data-panel="${panel}"] .col`).style.top), panel);
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(50);
    await page.evaluate(([sc, id, colTop]) => {
      const el = document.querySelector(sc);
      el.scrollTop += document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - colTop;
    }, [sc, question(MOCK_TURN), colTop]);
    await page.mouse.move(300, 420); // off the rail and the text: the rail at rest
    await page.waitForTimeout(150);
    const cover = range ? await coverage(b) : await blockCoverage(b, 'pre'),
      composer = await page.evaluate((WASH) => ({
        clip: document.querySelector(WASH)?.shadowRoot.querySelector('div').getBoundingClientRect().bottom,
        composer: document.querySelector('#thread-bottom-container').getBoundingClientRect().top,
      }), WASH);
    const built = `${shots}/wash-${panel}.png`,
      holding = () =>
        page.evaluate((WASH) => {
          const d = document.querySelector(WASH)?.shadowRoot.querySelector('div');
          return !!d && +getComputedStyle(d).opacity === 1 &&
            [...d.querySelectorAll('i')].every((i) => getComputedStyle(i).clipPath === 'none' && +getComputedStyle(i).opacity === 1);
        }, WASH);
    const before = await holding();
    await page.screenshot({ path: built, clip: REGION });
    const held = before && (await holding());
    check(`wash mockup ${panel}: built at the hold, on the bookmarked ${range ? 'text' : 'code block'}, clipped above the composer`,
      held && cover.ok && composer.clip === composer.composer, { held, boxes: cover.boxes, ...(range ? {} : { box: cover.box, want: cover.want, corners: cover.corners }), ...composer });
    // The same chat once the wash has gone, for the mask below.
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    const p = phases(await recorded());
    if (!range) check('wash: in the mockup\'s chat a bookmarked code block is washed, with no bubble flash', p.washed && !p.flash && !p.swept, { washed: p.washed, flash: p.flash });
    const builtPlain = `${shots}/wash-${panel}-after.png`;
    await page.screenshot({ path: builtPlain, clip: REGION });
    await mock.bringToFront();
    // The panel at the window's top left, on the built chat's pixel grid.
    const frame = mock.locator(`[data-panel="${panel}"]`);
    await frame.evaluate((el) => Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 99 }));
    await mock.waitForTimeout(100);
    const reference = `${shots}/mockup-${panel}.png`,
      referencePlain = `${shots}/mockup-${panel}-plain.png`,
      at = { ...REGION, x: 1 + REGION.x, y: 1 + REGION.y };
    await mock.screenshot({ path: reference, clip: at });
    const unwashed = (el, off) =>
      el.querySelectorAll('.land, .landb').forEach((e) => {
        for (const k of ['background-image', 'box-shadow']) off ? e.style.setProperty(k, 'none') : e.style.removeProperty(k);
      });
    await frame.evaluate(unwashed, true);
    await mock.screenshot({ path: referencePlain, clip: at });
    await frame.evaluate(unwashed, false);
    await frame.evaluate((el) => (el.style.cssText = ''));
    // Masked where the two chats differ without any wash: the same text, a glyph drawn a pixel
    // apart (a code line, a letter) by the two pages. The mask stays small or the check fails.
    const diff = await compare(mock, built, reference, { radius: 13, plain: [builtPlain, referencePlain] });
    check(`wash: the held wash matches the mockup's ${panel}, the whole frame with the rail`,
      diff.ratio !== undefined && diff.ratio < 0.001 && diff.masked < 0.005, diff);
  }
  page$.scene = null;
  await mock.close();
  await page.bringToFront();
  await page.setViewportSize({ width: 1400, height: 900 });
}
