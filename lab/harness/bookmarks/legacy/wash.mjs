// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.
import { WASH, washKit } from './wash-kit.mjs';
import { washMockup } from './wash-mockup.mjs';

// 14. The landing wash (#73). A jump from a tick card row to a live bookmark washes its text once the
// page has stopped, instead of flashing the question's bubble: a sweep through the lines in
// reading order (about 360 ms), held 1.2 s, faded over 0.9 s, then gone with its listeners. It
// covers the bookmark's range and nothing else, keeps the text's colour, follows a scroll during the
// hold, and goes at once on a second jump, a scrollbar drag, a conversation change or a pause. A
// stale bookmark lands with the bubble flash and no wash. Under a header that the scroller starts
// below, it reaches the scroller's top. A code block and a table (#74) get one box over the whole
// block that fades in instead of sweeping, and a bookmark in unloaded history is washed after its
// pages load and the page lands. ONLY=wash runs this part alone.
// With BUTTER_BOOKMARKS_DOT_MOCKUP=<#69's 1-Mockup.html> it also builds the panels' frame (the
// mockup's chat, its header, fade and composer, and the rail) and compares the held wash with the
// panels l-3-light, l-sel-dark and l-code-light as whole frames, rail included: under 0.1% of
// pixels differing by more than 24 in a channel.
export async function washSection(qa) {
  const { open, log, page, shots, check, rail, CONV, question, settings, page$, answer, PARAS, seedStore, LIVE, TURNS } = qa;
  const { BT, BLOCKS, BLOCK_CSS, wseed, T, sc, cdp, openChat, rowJump, earlierRowJump, record, recorded, phases, washHost, waitWash, coverage, listeners, blockCoverage, textUnder, PARA, SEL, STALE } = await washKit(qa);
  // (a) A paragraph, from the top of the chat: a far trip.
  await openChat('light');
  const idle = await listeners();
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForTimeout(800); // into the hold
  const cover = await coverage(PARA),
    during = await listeners(),
    ink = await textUnder('light');
  await page.screenshot({ path: `${shots}/wash-paragraph-light.png` });
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  await page.waitForTimeout(100);
  let p = await phases(await recorded());
  const after = await listeners();
  check('wash: a row jump to a paragraph washes it, starting only once the page has stopped', p.washed && p.moved <= 2 && p.startedAfterClick > 0, p);
  check('wash: no bubble flash on that trip', p.washed && !p.flash);
  check('wash: one box per line over exactly the bookmarked paragraph, 2 px above and below, rounded 3 px at its start and end',
    cover.ok && cover.boxes.length > 1 && cover.radius === ['3px 0px 0px 3px', ...Array(cover.boxes.length - 2).fill('0px'), '0px 3px 3px 0px'].join(' / ') && cover.color === 'rgba(251, 224, 122, 0.62)', cover);
  check('wash: the sweep fills the lines in reading order in about 360 ms', p.order && Math.abs(p.sweep - 360) <= 50, { sweep: p.sweep, first: p.first });
  check('wash: held about 1.2 s, then faded over about 0.9 s', Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, { hold: p.hold, fade: p.fade });
  check('wash: afterwards the layer is gone, and so are its scroll and resize listeners',
    !(await washHost()) && idle.world && during.scroll === idle.scroll + 1 && during.resize === idle.resize + 1 && after.scroll === idle.scroll && after.resize === idle.resize,
    { idle, during, after });
  check('wash: Butter\'s own layer, multiplied in light theme, under the header, taking no pointer events; nothing added inside the answer',
    cover.blend === 'multiply' && cover.pointer === 'none' && cover.through && cover.clipTop === 52 && !cover.inAnswer && p.added === 0, { ...cover, added: p.added });
  check('wash: the text keeps its colour in light theme', Math.max(...ink) <= 40, { ink });
  log('wash phases (paragraph, far trip)', JSON.stringify({ sweep: p.sweep, hold: p.hold, fade: p.fade }));

  // (b) A selection, from near by (a glide); a scroll during the hold keeps it on its text.
  await record();
  await rowJump(T, SEL);
  await waitWash();
  await page.waitForTimeout(700);
  const selCover = await coverage(SEL),
    top0 = await page.evaluate((sc) => document.querySelector(sc).scrollTop, sc);
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(250);
  const scrolled = await coverage(SEL),
    dy = (await page.evaluate((sc) => document.querySelector(sc).scrollTop, sc)) - top0;
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  p = await phases(await recorded());
  check('wash: a bookmarked selection washes that text only, not its whole paragraph', p.washed && !p.flash && p.moved <= 2 && selCover.ok && selCover.boxes.length >= 2, { ...selCover, moved: p.moved });
  check('wash: it stays on its text while the chat scrolls during the hold',
    dy > 20 && scrolled.ok && Math.abs(scrolled.boxes[0][1] - (selCover.boxes[0][1] - dy)) <= 1, { dy, before: selCover.boxes[0], after: scrolled.boxes[0] });
  log('wash phases (selection, glide)', JSON.stringify({ sweep: p.sweep, hold: p.hold, fade: p.fade }));

  // (c) Removed at once: a second jump, a scrollbar drag, a conversation change, Butter paused.
  const goneIn = async (act) => {
    await waitWash();
    await page.waitForTimeout(600);
    await page.evaluate((WASH) => {
      window.__gone = null;
      const at = performance.now();
      new MutationObserver((ms, o) => {
        if (!document.querySelector(WASH)) {
          window.__gone = performance.now() - at;
          o.disconnect();
        }
      }).observe(document.body, { childList: true });
    }, WASH);
    await act();
    await page.waitForFunction(() => window.__gone !== null, null, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => window.__gone);
  };
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await rowJump(T, PARA);
  const second = await goneIn(async () => {
    const r = await rail();
    await page.mouse.click(r.ticks[1].right - 4, r.ticks[1].y);
  });
  check('wash: a second jump removes it at once', second !== null && second < 200, { ms: second });
  await page.waitForTimeout(3500);
  await rowJump(T, PARA);
  // A scrollbar drag: seek/preview-main.js tells the page with this event as the drag starts. (The
  // fixture's chat has no layout for the preview to engage, so the harness sends it, as the
  // preview does, and the drag's end after it.)
  const seekState = (state) =>
    page.evaluate(([conv, state, id, n]) => document.dispatchEvent(new CustomEvent('butter-seek-state', {
      detail: JSON.stringify({ conv, state, id, n, lit: [id], total: 12, unseen: false }),
    })), [CONV, state, question(T), T + 1]);
  const drag = await goneIn(() => seekState('dragging'));
  check('wash: a scrollbar drag starting (seek state "dragging") removes it at once', drag !== null && drag < 100, { ms: drag });
  await seekState('idle');
  await page.waitForTimeout(1500); // the rail's seek card goes 1 s after the drag ends
  await rowJump(T, SEL);
  const paused = await goneIn(() => settings({ enabled: false }));
  check('wash: Butter paused removes it at once', paused !== null && paused < 300, { ms: paused });
  await settings({});
  await openChat('light');
  await rowJump(T, PARA);
  // ChatGPT shows another chat: a new path, and the old chat's turns leave the page.
  const moved = await goneIn(() =>
    page.evaluate(() => {
      history.pushState({}, '', '/c/00000000-0000-4000-8000-000000000000');
      document.querySelector('.content').replaceChildren();
    }));
  check('wash: a conversation change removes it at once', moved !== null && moved < 100, { ms: moved });

  // (d) A stale bookmark: the bubble flash at its question's start, and no wash.
  await openChat('light');
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(8, STALE);
  await page.waitForTimeout(4500);
  p = await phases(await recorded());
  check('wash: a stale bookmark lands with the bubble flash and no wash', !p.washed && p.flash, p);

  // (e) Reduced motion: no sweep; it shows at once, holds 1.2 s and fades over 0.9 s.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record();
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  p = await phases(await recorded());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('wash: under reduced motion it appears without a sweep, holds 1.2 s and fades over 0.9 s',
    p.washed && p.first.every((v) => v > 0.999) && p.sweep === 0 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, p);

  // (f) Dark theme: the text keeps its colour.
  await openChat('dark');
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForTimeout(800);
  const darkCover = await coverage(PARA),
    darkInk = await textUnder('dark');
  await page.screenshot({ path: `${shots}/wash-paragraph-dark.png` });
  check('wash: dark theme washes in rgb(227 199 102 / .3), lightened, and the text keeps its colour',
    darkCover.ok && darkCover.color === 'rgba(227, 199, 102, 0.3)' && darkCover.blend === 'lighten' && darkInk.every((v) => Math.abs(v - 236) <= 12),
    { ink: darkInk, blend: darkCover.blend });
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  page$.edited.delete(8);

  // (f2) A chat whose scroller starts below ChatGPT's header, as a project chat's does (seen live
  // on 2026-11-10): the wash reaches the scroller's own top, not a header's height below it, and
  // paints nothing above it.
  page$.css = '.thread-scroll-container { position:fixed; top:52px; left:0; right:0; bottom:0; height:auto }';
  await openChat('light');
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForTimeout(500);
  const below = await coverage(PARA);
  check('wash: under a header that the scroller starts below, it reaches the scroller\'s top', below.ok && below.clipTop === 0, below);
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  page$.css = '';

  // (g) A code block and a table (#74): one box over the whole block, 3 px beyond it with its
  // corners, fading in over about 160 ms with no sweep, then held and faded; no bubble flash. In
  // each markup's own shape: MARKUP=old has ChatGPT's <pre> round its rounded panel and a table in
  // its scrolling wrapper; MARKUP=live has the code widget's surface and the table's frame.
  page$.said.set(BT, BLOCKS);
  page$.css = BLOCK_CSS;
  await openChat('light', 2);
  const blockSeed = async (para) => {
    const text = await page.evaluate(([id, para, PARAS]) => {
      const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[para],
        w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t = '';
      for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('button')) t += n.data;
      return t;
    }, [answer(BT), para, PARAS]);
    return wseed(BT, para, 0, text.length, text);
  };
  const CODE = await blockSeed(1),
    TABLE = await blockSeed(3);
  await seedStore([PARA, SEL, CODE, TABLE], { clear: true });
  await openChat('light', 2);
  for (const [name, b, sel] of [['code block', CODE, LIVE ? '[data-code-block]' : '.fx-panel'], ['table', TABLE, 'table']]) {
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await page.waitForTimeout(300);
    await record();
    await rowJump(BT, b);
    await waitWash();
    await page.waitForTimeout(700); // into the hold
    const cover = await blockCoverage(b, sel);
    await page.screenshot({ path: `${shots}/wash-${name.replace(' ', '-')}-light.png` });
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    p = phases(await recorded());
    check(`wash: a bookmarked ${name} gets one box over the whole block, 3 px beyond it, with the block's corners`,
      p.washed && cover.ok && cover.color === 'rgba(251, 224, 122, 0.62)' && cover.blend === 'multiply', cover);
    check(`wash: the ${name}'s box fades in over about 160 ms, with no sweep, then holds 1.2 s and fades over 0.9 s`,
      p.washed && !p.swept && p.firstOpacity[0] < 0.5 && Math.abs(p.sweep - 160) <= 50 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60,
      { firstOpacity: p.firstOpacity, fadeIn: p.sweep, hold: p.hold, fade: p.fade, swept: p.swept });
    check(`wash: no bubble flash on the ${name}'s trip, and it starts once the page has stopped`, p.washed && !p.flash && p.moved <= 2, { flash: p.flash, moved: p.moved });
  }
  // Under reduced motion the block's box appears at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await record();
  await rowJump(BT, CODE);
  await waitWash();
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  p = phases(await recorded());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('wash: under reduced motion a code block\'s box appears at once, holds 1.2 s and fades over 0.9 s',
    p.washed && p.firstOpacity.every((v) => v > 0.999) && p.sweep === 0 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, p);
  page$.said.delete(BT);
  page$.css = '';

  // (g2) A trip that has nowhere to go (review of #75): the same row clicked again after its wash
  // has faded, and a bookmark in the last answer with the chat at its bottom, where the page can't
  // scroll to it. The wash starts at once, not after the wait for a scroll's end.
  const LAST = wseed(TURNS - 1, 6, 0, null, 'Fixture list item one'); // its first list item
  await seedStore([SEL, LAST], { clear: true });
  await openChat('light', 2);
  const startsAtOnce = async (turn, b) => {
    await record();
    await rowJump(turn, b);
    await waitWash();
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    const R = await recorded();
    const tops = R.frames.map((x) => x.top);
    return { ...phases(R), still: Math.max(...tops) - Math.min(...tops) };
  };
  await rowJump(T, SEL);
  await waitWash();
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  await page.waitForTimeout(300);
  p = await startsAtOnce(T, SEL);
  check('wash: the same row clicked again after its wash has faded washes within about 300 ms',
    p.washed && p.still <= 1 && p.startedAfterClick <= 300, { startedAfterClick: p.startedAfterClick, still: p.still });
  // A wheel, as a reader scrolls: it ends the follow that holds the page on the last landing.
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(800);
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 1e6), sc);
  await page.waitForTimeout(300);
  p = await startsAtOnce(TURNS - 1, LAST);
  check('wash: a bookmark in the last answer, with the chat at its bottom, washes within about 300 ms',
    p.washed && p.still <= 1 && p.startedAfterClick <= 300, { startedAfterClick: p.startedAfterClick, still: p.still });
  // A far trip from the top to the last answer's last block, in a chat with little room below its
  // last answer: the page waits `lead` px short of the bottom and the bottom both, so the arrival
  // has nowhere to scroll. The wash starts after the target's 150 ms steady check and the 250 ms
  // reveal (about 430 ms after the page's last move), not after the 1.5 s wait for a scrollend.
  page$.css = '.content { padding-bottom: 150px }';
  const END = wseed(TURNS - 1, 7, 0, null, 'Fixture list item two');
  await seedStore([SEL, END], { clear: true });
  await openChat('light', 2);
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(TURNS - 1, END);
  await waitWash();
  const bottom = await page.evaluate((sc) => {
    const s = document.querySelector(sc);
    return s.scrollHeight - s.clientHeight - s.scrollTop;
  }, sc);
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  {
    const R = await recorded();
    p = phases(R);
    const f = R.frames.filter((x) => x.t <= p.t0),
      last = f.findLast((x, i) => i && x.top !== f[i - 1].top);
    p.afterLastMove = last ? Math.round(p.t0 - last.t) : null;
  }
  check('wash: a far trip to the last answer\'s last block, with the chat at its bottom, washes within about 0.5 s of the page\'s last move',
    p.washed && Math.abs(bottom) <= 1 && p.afterLastMove !== null && p.afterLastMove <= 600,
    { afterLastMove: p.afterLastMove, startedAfterClick: p.startedAfterClick, bottom });
  page$.css = '';

  // (h) Earlier history: a bookmark in unloaded history is washed once its messages have loaded
  // and the page has landed.
  page$.first = 7;
  page$.pageDelay = 300;
  page$.pages = 0;
  const EARLY = wseed(2, 2);
  await seedStore([EARLY], { clear: true });
  await open('light');
  await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === 1, null, { timeout: 5000 });
  await record();
  await earlierRowJump(EARLY);
  await waitWash().catch(() => {});
  await page.waitForTimeout(700);
  const earlyCover = await coverage(EARLY);
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 }).catch(() => {});
  p = phases(await recorded());
  check('wash: a bookmark in unloaded history is washed after its pages load and the page lands',
    p.washed && page$.pages >= 2 && p.moved <= 2 && !p.flash && earlyCover.ok && Math.abs(p.hold - 1200) <= 50,
    { washed: p.washed, pages: page$.pages, moved: p.moved, flash: p.flash, cover: earlyCover.ok, boxes: earlyCover.boxes, want: earlyCover.want, hold: p.hold });
  page$.first = 0;
  page$.pageDelay = 0;

  if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) await washMockup(qa, { rowJump, waitWash, coverage, blockCoverage, sc, record, recorded, phases });
  await seedStore([], { clear: true });
  await cdp.detach();
}
