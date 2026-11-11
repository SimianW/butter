// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.
import fs from 'node:fs/promises';
import { cardMatches } from '../scenarios/card.mjs';
import path from 'node:path';

// 14. The dot (#71), as the #69 mockup draws it. A 12-question chat at rest with the question being
// read lit (`f-after-*`: questions 3, 7 and 10 hold bookmarks, 10's all stale), then the mockup's
// close-ups at three times their size: a 7-question chat at rest in both themes (`s-rest-*`), under
// the pointer (`s-wave-light`), with a new bookmark at its halo's widest (`s-new-light`), and a
// 22-question chat 5 px apart (`s-dense-light`), and earlier history with a dot beside the three dots
// (`s-earlier-light`, #72) and their card (`f-earlier-light`). Each answer runs past the view, so only
// the question jumped to is lit, as in the mockup. With BUTTER_BOOKMARKS_DOT_MOCKUP each shot is
// compared with its panel: the rail's own box for `f-after-*`, the card's own box for
// `f-earlier-light`, the strip's box otherwise. Also the
// dot's gap through every frame of the hover wave, its motion under reduced motion, and no dot with
// the rail off or Butter paused, back after a reload. ONLY=dot runs this part alone.
export async function dotSection(qa) {
  const { open, settings, sha, CONV, PARAGRAPH, answer, page$, page, hoverTick, shots, context, seedStore, dotCount, rail, dotBeside, check, bookmark, toTop, removeRow, TURNS, compare } = qa;
  await settings({ bookmarkNotice: 'acknowledged' });
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  const live = (turn, time, para = 0) => {
    const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
    return { account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start: 0, end: text.length, excerpt: text.slice(0, 120).trim(), time };
  };
  const gone = (turn, time) => ({ ...live(turn, time, 2), excerpt: 'A paragraph this answer no longer has.' });
  page$.tail = 40;
  const LIGHT_DOT = 'rgb(211, 158, 16)',
    DARK_DOT = 'rgb(227, 199, 102)';
  const railBox = () =>
    page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.rail').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  // Jump to question `turn` with its tick, then the pointer leaves: that question alone is lit.
  const readAt = async (turn) => {
    const t = await hoverTick(turn);
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(3500);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(1200);
  };
  const lit = (r) => r.ticks.map((t, i) => [i, Math.round(t.w * 10) / 10]).filter(([, w]) => w !== 12);
  // Each tick's own box in the strip's device pixels, 1 px around it. `first`: the first tick's row,
  // in px below the strip's top. The strip ends at the rail's right edge, 6 px right of the ticks.
  const ticksOut = (r, first) =>
    r.ticks.map((t) => ({
      x: Math.floor((t.left - (t.right + 6) + 154 / 3 - 1) * 3),
      y: Math.floor((t.y - (r.ticks[0].y - first) - 3) * 3),
      w: Math.ceil((t.w + 2) * 3),
      h: 18,
    }));
  const built = [];
  // The strip: the rail from 8 px above its first tick's row, at three times its size (device pixels
  // through the DevTools protocol; the mockup draws it at 3x in CSS px). The mockup's strip box is
  // 154 x 394 inside its frame's 1 px border, its ticks 18 px from its right: here, 154 x 394 device
  // pixels ending at the rail's right edge.
  const strip = async (panel, masks = [], near = false) => {
    const r = await railBox(),
      file = `${shots}/${panel}.png`,
      cdp = await context.newCDPSession(page),
      vp = page.viewportSize();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 3, mobile: false });
    await page.waitForTimeout(300);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x + 52 - 154 / 3, y: r.y + 2, width: 154 / 3, height: 394 / 3, scale: 1 } });
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    await page.waitForTimeout(200);
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    built.push({ panel, file, strip: true, masks, near });
  };

  // (a) The rail at rest: one dot per question that holds bookmarks.
  const ROWS = [live(2, 1), live(6, 2), live(6, 3, 3), gone(6, 4), live(6, 5, 4), gone(9, 6)];
  await seedStore(ROWS, { clear: true });
  const at = {};
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await dotCount(3);
    await readAt(6);
    const r = await rail();
    at[theme] = r;
    const box = await railBox(),
      file = `${shots}/f-after-${theme}.png`;
    await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    built.push({ panel: `f-after-${theme}`, file });
  }
  let r = at.light;
  const d3 = dotBeside(r, 2),
    d7 = dotBeside(r, 6),
    d10 = dotBeside(r, 9);
  check('one dot per question that holds bookmarks, whatever their number: questions 3, 7 (four) and 10', r.dots.length === 3 && d3 && d7 && d10,
    { dots: r.dots.map((d) => [d.y, d.right]) });
  check('the question being read: its 21 px tick lit, the dot still 4 px from its end', JSON.stringify(lit(r)) === '[[6,21]]' && !!d7, { lit: lit(r) });
  check('a question with one live bookmark of four keeps a solid dot; one whose only bookmark is stale has a hollow one',
    d3.color === LIGHT_DOT && d7.color === LIGHT_DOT && !d7.cls.includes('stale') &&
      d10.cls.includes('stale') && d10.color === 'rgba(0, 0, 0, 0)' && d10.ring === `${LIGHT_DOT} 0px 0px 0px 1px inset`, { d7: d7.cls, d10: [d10.color, d10.ring] });
  check('dark theme: the dots in #e3c766, the hollow ring too', at.dark.dots.length === 3 && dotBeside(at.dark, 2)?.color === DARK_DOT &&
    dotBeside(at.dark, 9)?.ring === `${DARK_DOT} 0px 0px 0px 1px inset`, { dots: at.dark.dots.map((d) => [d.color, d.ring]) });

  // (b) Through every frame of the hover wave each dot keeps 4 px from its tick, inside the rail.
  const frames = page.evaluate(
    () =>
      new Promise((ok) => {
        const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
          rail = root.querySelector('.rail').getBoundingClientRect(),
          out = [];
        const step = () => {
          const bars = [...root.querySelectorAll('.tick .bar')].map((b) => b.getBoundingClientRect());
          out.push(
            [...root.querySelectorAll('.bdot:not(.gone)')].map((el) => {
              const d = el.getBoundingClientRect(),
                b = bars.find((b) => Math.abs(b.top + b.height / 2 - (d.top + d.height / 2)) <= 0.6);
              return { gap: b ? b.left - d.right : null, w: b?.width, inside: d.left >= rail.left && d.right <= rail.right };
            }),
          );
          if (out.length < 60) requestAnimationFrame(step);
          else ok(out);
        };
        requestAnimationFrame(step);
      }),
  );
  const t7 = r.ticks[6];
  await page.mouse.move(t7.x, t7.y - 30, { steps: 3 });
  await page.mouse.move(t7.x, t7.y, { steps: 10 });
  const wave = (await frames).flat();
  check('through the hover wave every dot keeps its 4 px gap and stays inside the 52 px rail',
    wave.length === 180 && wave.every((x) => x.gap !== null && Math.abs(x.gap - 4) <= 0.05 && x.inside) && Math.max(...wave.map((x) => x.w)) > 30,
    { frames: wave.length, gaps: [Math.min(...wave.map((x) => x.gap)), Math.max(...wave.map((x) => x.gap))], widest: Math.max(...wave.map((x) => x.w)) });

  // (c) Rail off, then Butter paused: no dots; back on, they return after the reload.
  for (const [name, butter] of [
    ['rail off', { bookmarkNotice: 'acknowledged', opts: { rail: false } }],
    ['Butter paused', { bookmarkNotice: 'acknowledged', enabled: false }],
  ]) {
    await page.goto('about:blank');
    await settings(butter);
    await open('light').catch(() => {});
    await page.waitForTimeout(600);
    const shown = await page.evaluate(() => {
      const nav = document.querySelector('chatgpt-butter-nav');
      return nav && getComputedStyle(nav).display !== 'none' && nav.hasAttribute('data-on')
        ? [...nav.shadowRoot.querySelectorAll('.bdot')].filter((d) => d.getBoundingClientRect().width).length
        : 0;
    });
    check(`${name}: no dots`, shown === 0, { shown });
  }
  await settings({ bookmarkNotice: 'acknowledged' });
  await open('light');
  await dotCount(3);
  r = await rail();
  check('back on, after a reload: the three dots are back beside their ticks, without the grow-in',
    !!dotBeside(r, 2) && !!dotBeside(r, 6) && !!dotBeside(r, 9) && r.dots.every((d) => !d.cls.includes('new')));

  // (d) The close-ups: a 7-question chat, question 4 being read; 2 and 4 hold live bookmarks, 6 a stale one.
  page$.turns = 7;
  await seedStore([live(1, 1), live(3, 2), gone(5, 3)], { clear: true });
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await dotCount(3);
    await readAt(3);
    r = await rail();
    check(`close-up (${theme}): question 4 alone is lit, dots beside 2, 4 and 6`, JSON.stringify(lit(r)) === '[[3,21]]' &&
      !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5), { lit: lit(r) });
    await strip(`s-rest-${theme}`);
  }
  // Under the pointer, on question 3's row. The mockup draws the wave without the rail's hover look,
  // which #71 doesn't change: the ticks thickening up to 1.6 times under the pointer, and the pill
  // behind the rail, whose bottom edge and shadow fall in the strip. Each tick's own box and the
  // pill's bottom edge are left out of the comparison; the dots and the rest are compared. The
  // dots sit on fractions of a pixel here: the rail moves them as it scales the ticks, drawn
  // between pixels, where the mockup's are placed and snapped to whole ones, so a pixel matches
  // when one within a device pixel of it in the mockup does.
  await open('light');
  await dotCount(3);
  await readAt(3);
  r = await rail();
  await page.mouse.move(r.ticks[2].x, r.ticks[2].y - 20, { steps: 3 });
  await page.mouse.move(r.ticks[2].x, r.ticks[2].y, { steps: 6 });
  await page.waitForTimeout(1500);
  r = await rail();
  check('under the pointer: each dot 4 px from its lengthened tick', !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5) && r.ticks[2].w > 31,
    { widths: r.ticks.map((t) => t.w) });
  const box7 = await railBox();
  await strip('s-wave-light', [...ticksOut(r, 15), { x: 0, y: (box7.h - 2 - 14) * 3, w: 154, h: 394 }], true);
  // A new bookmark under question 2: its motion is paused as it starts, the page goes back to
  // question 4, and the dot is shot at the halo's widest (300 ms into the halo).
  await page.mouse.move(700, 300);
  await seedStore([live(3, 2), gone(5, 3)], { clear: true });
  await open('light');
  await dotCount(2);
  const made = await bookmark(1, 0);
  await made.click();
  const paused = await page
    .waitForFunction(() => {
      const d = [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot.new')][0];
      if (!d || d.getAnimations().length < 2) return null;
      d.getAnimations().forEach((a) => a.pause());
      return d.getAnimations().map((a) => a.animationName);
    })
    .then((h) => h.jsonValue());
  await readAt(3);
  await page.evaluate(() => {
    for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new').getAnimations()) a.currentTime = 480;
  });
  await page.waitForTimeout(100);
  r = await rail();
  check('a new bookmark\'s dot: grow-in, then the halo; at its widest, 4 px around the dot', JSON.stringify(paused) === '["dot-in","dot-halo"]' &&
    /4px$/.test(dotBeside(r, 1)?.ring ?? '') && JSON.stringify(lit(r)) === '[[3,21]]', { paused, ring: dotBeside(r, 1)?.ring });
  await strip('s-new-light');
  await page.evaluate(() => {
    for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new')?.getAnimations() ?? []) a.finish();
  });
  // Reduced motion: no grow-in, no halo, no fade.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toTop(); // a wheel turn ends the pin the jump left on question 4
  const still = await bookmark(4, 0);
  await still.click();
  await dotCount(4);
  const quiet = await page.evaluate(() =>
    [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].map((d) => d.getAnimations().length),
  );
  check('reduced motion: a new dot appears with no grow-in and no halo', quiet.every((n) => n === 0), { quiet });
  await removeRow(4, 0); // × on the tick's card, the only remove (#77)
  await page.waitForTimeout(100);
  const left = await page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
  check('reduced motion: a deleted question\'s dot goes at once, with no fade', left === 3, { left });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // (e) A very long chat: 22 questions 5 px apart, question 16 being read. The scroller's box, just
  // over 212 + 22 x 5 / .85 px tall, gives a pitch of 5 px, as the mockup draws it: layout floors
  // each tick's height to 1/64 px, and rounds a fractional height, which a vertical scale avoids.
  // At this pitch a tick's top is on half a pixel, which Chrome snaps a device pixel lower at three
  // times the size than the mockup's 3x drawing in CSS px: each tick's own box is left out of the
  // comparison. The mockup draws question 10's dot (all its bookmarks stale, 3 px across) with a
  // ring; #69 decides it solid at 45 % (a 1 px ring can't be drawn under 4 px), so that dot is left
  // out too. The other dots are compared.
  page$.turns = 22;
  page$.css = `.thread-scroll-container { height: 342px; transform: scaleY(${341.42 / 342}); transform-origin: 0 0 }`;
  await seedStore([live(3, 1), live(4, 2), gone(9, 3), live(15, 4), live(18, 5)], { clear: true });
  await open('light');
  await dotCount(5);
  await readAt(15);
  r = await rail();
  const pitch = (r.ticks.at(-1).y - r.ticks[0].y) / 21,
    faint = dotBeside(r, 9);
  check('a very long chat: ticks 5 px apart, dots 3 px across, question 16 alone lit', Math.abs(pitch - 5) < 0.01 && r.dots.length === 5 &&
    [3, 4, 9, 15, 18].every((i) => dotBeside(r, i)?.w === 3) && JSON.stringify(lit(r)) === '[[15,21]]', { pitch, lit: lit(r), d: r.dots.map((d) => d.w) });
  check('ticks too close for a ring: the all-stale dot is solid at 45 %', faint && !faint.cls.includes('stale') && faint.cls.includes('faint') &&
    faint.color === LIGHT_DOT && Math.abs(faint.opacity - 0.45) < 0.001, { faint });
  const top = r.ticks[0].y - 10.5;
  await strip('s-dense-light', [
    ...ticksOut(r, 10.5),
    { x: Math.floor((faint.left - (r.ticks[0].right + 6) + 154 / 3 - 1) * 3), y: Math.floor((faint.y - top - faint.h / 2 - 1) * 3), w: 3 * (faint.w + 2) + 1, h: 3 * (faint.h + 2) + 1 },
  ]);

  page$.turns = TURNS;
  page$.css = '';

  // (f) Earlier history (#72), as the mockup's s-earlier-light and f-earlier-light draw it: the chat
  // opens with its latest 6 questions, the fifth being read and the third holding a bookmark; two
  // bookmarks in the history not loaded yet (the panel's rows) put the dot beside the three dots.
  // Then the pointer on the three dots and across onto the first row of their card.
  page$.first = 6;
  const early = (turn, time, excerpt) => ({ ...live(turn, time), excerpt });
  await seedStore([
    early(1, 1, 'COPY is the fastest way in: one transaction, no per-row overhead.'),
    early(2, 2, 'Drop the indexes first and rebuild them after the load.'),
    live(8, 3),
  ], { clear: true });
  await open('light');
  await dotCount(2);
  await readAt(4);
  r = await rail();
  check('earlier history at rest: question 11 alone lit, a dot beside question 9 and one beside the three dots',
    JSON.stringify(lit(r)) === '[[4,21]]' && !!dotBeside(r, 2) && r.dots.length === 2, { lit: lit(r), dots: r.dots.map((d) => [d.y, d.right]) });
  // The three dots' top is on half a pixel, which Chrome snaps a device pixel lower at three times
  // the size: a pixel matches when one within a device pixel of it in the mockup does.
  await strip('s-earlier-light', [], true);
  const dotsRow = await page.evaluate(() => {
    const m = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more').getBoundingClientRect();
    return { x: m.left + m.width / 2 - 10, y: m.top + m.height / 2 };
  });
  await page.mouse.move(dotsRow.x, dotsRow.y, { steps: 4 });
  await page.waitForTimeout(350);
  const firstRow = await page.evaluate(() => {
    const it = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bmc .it').getBoundingClientRect();
    return { x: it.left + it.width / 2 - 40, y: it.top + it.height / 2 };
  });
  await page.mouse.move(firstRow.x, firstRow.y, { steps: 12 });
  await page.waitForTimeout(400);
  const earlierCard = await page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      c = root.querySelector('.card'),
      q = c.getBoundingClientRect();
    return { shown: c.classList.contains('show'), meta: root.querySelector('.card > .meta').textContent, rect: { x: q.left, y: q.top, w: q.width, h: q.height } };
  });
  check('hovering the three dots: their card, "Earlier questions · 2 bookmarks", stays on the way to its first row',
    earlierCard.shown && earlierCard.meta === 'Earlier questions · 2 bookmarks', earlierCard);
  // Through the DevTools protocol, as the strips are: after their device metrics override a
  // Playwright screenshot resizes the page under the shot.
  const cardFile = `${shots}/f-earlier-light.png`,
    cr = earlierCard.rect,
    cdp = await context.newCDPSession(page),
    { data: cardPng } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.floor(cr.x), y: Math.floor(cr.y), width: Math.round(cr.w), height: Math.round(cr.h), scale: 1 } });
  await cdp.detach();
  await fs.writeFile(cardFile, Buffer.from(cardPng, 'base64'));
  built.push({ panel: 'f-earlier-light', file: cardFile, card: true, at: cr });
  await page.mouse.move(700, 300);
  page$.first = 0;
  page$.tail = 0;
  await seedStore([], { clear: true });

  // Against the #69 mockup's sections 1, 2 and 3, when given.
  if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) {
    const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
    await mock.addStyleTag({ content: 'html { scrollbar-width: none } .ann, .ring { display: none }' });
    await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    for (const b of built) {
      if (b.card) {
        await cardMatches(qa, mock, b);
        continue;
      }
      const el = mock.locator(b.strip ? `[data-panel="${b.panel}"]` : `[data-panel="${b.panel}"] .rail`);
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      const box = await el.boundingBox(),
        reference = `${shots}/mockup-${b.panel}.png`;
      // A strip's own box is inside its frame's 1 px border.
      const clip = b.strip ? { x: box.x + 1, y: box.y + 1, width: 154, height: 394 } : { x: box.x, y: box.y, width: 52, height: 188 };
      await mock.screenshot({ path: reference, clip });
      const radius = b.strip ? 13 : 0,
        diff = await compare(mock, b.file, reference, { radius, masks: b.masks ?? [], near: b.near }),
        strict = b.near ? await compare(mock, b.file, reference, { radius, masks: b.masks }) : undefined,
        whole = b.masks?.length ? await compare(mock, b.file, reference, { radius }) : undefined;
      check(`the rail matches the mockup's ${b.panel}`, diff.ratio !== undefined && diff.ratio < 0.001,
        { ...diff, ...(strict && { strict }), ...(whole && { unmasked: whole }), mockupAt: [box.x, box.y] });
    }
    await mock.close();
  }
}
