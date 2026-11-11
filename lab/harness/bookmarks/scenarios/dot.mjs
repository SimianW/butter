// The dot (#71) in a 12-question chat at rest, as the #69 mockup's section 1 draws it, with
// question 7 being read: one dot per question that holds bookmarks (3, 7 with four, 10 with only a
// stale one, hollow), the 21 px tick keeping its dot 4 px away, and dark theme (`f-after-*`, the
// rail's own box, compared with its panel when BUTTER_BOOKMARKS_DOT_MOCKUP is set); every frame of
// the hover wave keeping each dot's 4 px gap inside the rail; no dots with the rail off or Butter
// paused, back after a reload. Each answer runs past the view, so only the question jumped to is
// lit, as in the mockup.
import { goneRow, row } from '../fixture.mjs';
import { panels } from '../mockup.mjs';

// A live bookmark on block `para` of question `turn`'s answer, and a stale one (its paragraph no
// longer holds its text).
const live = (turn, time, para = 0) => row(turn, para, { time }),
  gone = (turn, time) => goneRow(turn, { time });

const LIGHT_DOT = 'rgb(211, 158, 16)',
  DARK_DOT = 'rgb(227, 199, 102)';

export default {
  name: 'dot',
  description: "The dot (#71) at rest beside its tick, light and dark, through the hover wave, gone with the rail off or paused; #69's f-after-*",
  scene: { tail: 40 },
  store: [live(2, 1), live(6, 2), live(6, 3, 3), gone(6, 4), live(6, 5, 4), gone(9, 6)],
  async run(qa) {
    const { open, settings, page, dotCount, rail, dotBeside, check, readAt, lit } = qa;
    const mockup = panels(qa);
    const at = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(3);
      await readAt(6);
      const r = await rail();
      at[theme] = r;
      await mockup.rail(`f-after-${theme}`);
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
      ['rail off', { opts: { rail: false } }],
      ['Butter paused', { enabled: false }],
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
    await settings({});
    await open('light');
    await dotCount(3);
    r = await rail();
    check('back on, after a reload: the three dots are back beside their ticks, without the grow-in',
      !!dotBeside(r, 2) && !!dotBeside(r, 6) && !!dotBeside(r, 9) && r.dots.every((d) => !d.cls.includes('new')));
    await mockup.match();
  },
};
