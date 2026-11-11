// Mockup comparisons for the bookmarks harness. A scenario shoots what Butter built (`panels(t)`),
// then, when the mockup is given, `match()` shoots the panel of the same name in it and compares
// the two (compare.mjs: under 0.1% of pixels differing by more than 24 in a channel).
// The mockups: BUTTER_BOOKMARKS_DOT_MOCKUP=<#69's 1-Mockup.html> (gh issue artifact download 69 1
// -R SimianW/butter): the rail, its strips, the tick's card and the wash's frames;
// BUTTER_BOOKMARKS_EARLIER_MOCKUP=<#51's 2-Earlier-history-mockup.html> and
// BUTTER_BOOKMARKS_MOCKUP=<#51's 1-Mockup.html> (gh issue artifact download 51 2 / 51 1): shot
// next to the built states, not compared.
import fs from 'node:fs/promises';
import path from 'node:path';

export const DOT_MOCKUP = process.env.BUTTER_BOOKMARKS_DOT_MOCKUP;

// `file` open in a new page of `context`, at the context's viewport (a persistent context's
// `newPage()` takes no options), with `css` added; `fonts`: once its fonts have loaded. No
// scrollbar: the centred mockup stays on whole pixels.
export async function openMockup(context, file, { css = '', fonts = false } = {}) {
  const mock = await context.newPage();
  await mock.goto(`file://${path.resolve(file)}`);
  await mock.addStyleTag({ content: `html { scrollbar-width: none } ${css}` });
  if (fonts) await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
  return mock;
}
// The #69 mockup without its annotations and focus rings.
export const openDotMockup = (context) => openMockup(context, DOT_MOCKUP, { css: '.ann, .ring { display: none }', fonts: true });

// The rail's card shot as `b.file` (its own box at `b.at`, a viewport rect) against the card in
// the #69 mockup's panel `b.panel`, open in `mock`: the same size, under 0.1% of pixels differing by
// more than 24, with the card's rounded corners (12 px) left out.
export async function cardMatches({ shots, compare, check }, mock, b) {
  const card = mock.locator(`[data-panel="${b.panel}"] .card`);
  await card.scrollIntoViewIfNeeded();
  // The mockup centres its card with translateY(-50%), which puts a card of odd height on half a
  // pixel and moves some lines' text by a pixel. Lift it by a whole number of pixels instead and
  // put it on the built card's fraction of a pixel, so both draw on the same grid.
  const frac = (v) => v - Math.floor(v);
  await card.evaluate((el) => (el.style.transform = `translateY(${-Math.round(el.offsetHeight / 2)}px)`));
  const box = await card.boundingBox();
  await card.evaluate((el, [dx, dy]) => {
    const s = getComputedStyle(el);
    el.style.right = `${parseFloat(s.right) - dx}px`;
    el.style.top = `${parseFloat(s.top) + dy}px`;
  }, [frac(b.at.x) - frac(box.x), frac(b.at.y) - frac(box.y)]);
  const moved = await card.boundingBox(),
    reference = `${shots}/mockup-${b.panel}.png`;
  await mock.screenshot({ path: reference, clip: { x: Math.floor(moved.x), y: Math.floor(moved.y), width: Math.round(b.at.w), height: Math.round(b.at.h) } });
  const diff = await compare(mock, b.file, reference, { radius: 12 });
  check(`the card matches the mockup's ${b.panel}`, diff.ratio !== undefined && diff.ratio < 0.001,
    { ...diff, built: [b.at.w, b.at.h], mockup: [moved.width, moved.height] });
}

// The shots a scenario builds for the #69 mockup's sections 1, 2 and 3, each named after its panel.
export function panels(t) {
  const { page, context, shots, check, compare, railBox, tickCard } = t;
  const built = [];
  // The rail's own box (`f-after-*`).
  const rail = async (panel) => {
    const box = await railBox(),
      file = `${shots}/${panel}.png`;
    await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    built.push({ panel, file });
  };
  // The strip: the rail from 8 px above its first tick's row, at three times its size (device pixels
  // through the DevTools protocol; the mockup draws it at 3x in CSS px). The mockup's strip box is
  // 154 x 394 inside its frame's 1 px border, its ticks 18 px from its right: here, 154 x 394 device
  // pixels ending at the rail's right edge. `masks` are left out of the comparison; `near`: a pixel
  // matches when one within a device pixel of it in the mockup does.
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
  // Each tick's own box in the strip's device pixels, 1 px around it. `first`: the first tick's row,
  // in px below the strip's top. The strip ends at the rail's right edge, 6 px right of the ticks.
  const ticksOut = (r, first) =>
    r.ticks.map((t) => ({
      x: Math.floor((t.left - (t.right + 6) + 154 / 3 - 1) * 3),
      y: Math.floor((t.y - (r.ticks[0].y - first) - 3) * 3),
      w: Math.ceil((t.w + 2) * 3),
      h: 18,
    }));
  // The open card's own box, on whole pixels; `at` keeps its fractional position for the mockup.
  // `cdp`: through the DevTools protocol, as the strips are: after their device metrics override a
  // Playwright screenshot resizes the page under the shot.
  const card = async (panel, { cdp = false } = {}) => {
    const { rect } = await tickCard(),
      file = `${shots}/${panel}.png`,
      clip = { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) };
    if (cdp) {
      const session = await context.newCDPSession(page),
        { data } = await session.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
      await session.detach();
      await fs.writeFile(file, Buffer.from(data, 'base64'));
    } else await page.screenshot({ path: file, clip });
    built.push({ panel, file, card: true, at: rect });
  };
  // Against the #69 mockup, when given: each shot with the panel of its name.
  const match = async () => {
    if (!DOT_MOCKUP) return;
    const mock = await openDotMockup(context);
    for (const b of built) {
      if (b.card) {
        await cardMatches(t, mock, b);
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
  };
  return { rail, strip, ticksOut, card, match };
}
