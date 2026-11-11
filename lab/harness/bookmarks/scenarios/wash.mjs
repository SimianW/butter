// The landing wash (#73). A jump from a tick card row to a live bookmark washes its text once the
// page has stopped, instead of flashing the question's bubble: a sweep through the lines in reading
// order (about 360 ms), held 1.2 s, faded over 0.9 s, then gone with its listeners (counted by CDP
// in the content scripts' world). It covers the bookmark's range and nothing else (one box per
// line, measured against the text's own rectangles), keeps the text's colour (multiplied in light
// theme, lightened in dark), takes no pointer events, stays under the header, adds nothing inside the
// answer, follows a scroll during the hold, and goes at once on a second jump, a scrollbar drag, a
// conversation change or a pause. A stale bookmark lands with the bubble flash and no wash; reduced
// motion shows it without a sweep.
import { PARA, SEL, STALE, T, WASH, washDriver } from '../wash.mjs';

export default {
  name: 'wash',
  description: 'The landing wash (#73): sweep, hold and fade, its boxes, a scroll, what removes it, a stale bookmark, reduced motion, dark',
  scene: { edited: [STALE.turn] },
  store: [PARA, SEL, STALE],
  async run(qa) {
    const { log, page, shots, check, rail, CONV, question, settings } = qa;
    const { sc, openChat, rowJump, record, recorded, phases, washHost, waitWash, coverage, listeners, textUnder } = washDriver(qa);
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
  },
};
