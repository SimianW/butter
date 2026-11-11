// Earlier history's states shot light and dark, English and Chinese, desktop (1400 px) and narrow
// (600 px, the narrowest the rail draws at), each checked for its strings:
// `earlier-{rest,single,list,loading,landed}-<theme>-<lang>-<desktop|narrow>`; and at 390 px, where
// the rail stays off, `earlier-rest-light-en-mobile390`. With BUTTER_BOOKMARKS_EARLIER_MOCKUP=<#51's
// 2-Earlier-history-mockup.html> also that mockup's panels, as `mockup-earlier-*`, to look at side
// by side.
import { openMockup } from '../mockup.mjs';
import { A, earlier, LATEST, LIST, scene } from '../earlier.mjs';

export default {
  name: 'earlier-shots',
  description: "Earlier history's states shot in both themes, English and Chinese, at 1400, 600 and 390 px; #51's mockup panels",
  scene,
  store: [A, LATEST],
  async run(qa) {
    const { page, check, settings, serve, shots, context, seedStore, CONV } = qa;
    const { state, under, landed, openEarlier, hoverDots } = earlier(qa);
    let s, l;
    const strings = {
      en: { one: 'Bookmark · earlier question', foot: "This question isn't loaded yet. Clicking loads earlier messages first.", many: 'Earlier questions · 4 bookmarks', wait: 'Loading earlier questions…' },
      zh: { one: '书签 · 更早的问题', foot: '这个问题还没加载。点击会先加载更早的消息。', many: '更早的问题 · 4 个书签', wait: '正在加载更早的问题…' },
    };
    const shoot = async (name) => {
      const vw = page.viewportSize().width,
        s = await state(),
        w = Math.min(vw, 420),
        top = Math.max(0, Math.min(s.card.shown ? s.card.rect.top : Infinity, s.dotsY - 12, s.ticks[0] - 12) - 30),
        bottom = Math.max(s.card.shown ? s.card.rect.top + s.card.rect.h : 0, s.ticks.at(-1)) + 30;
      await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: vw - w, y: top, width: w, height: bottom - top } });
    };
    for (const [width, size] of [[1400, 'desktop'], [600, 'narrow']])
      for (const lang of ['en', 'zh'])
        for (const theme of ['light', 'dark']) {
          const tag = `${theme}-${lang}-${size}`,
            t = strings[lang];
          await page.setViewportSize({ width, height: 900 });
          await settings({ lang, bookmarkNotice: 'acknowledged' });
          serve({ pageDelay: 300 });
          await openEarlier(theme, 2, [A, LATEST]);
          await shoot(`earlier-rest-${tag}`);
          s = await hoverDots();
          await shoot(`earlier-single-${tag}`);
          const single = s.card;
          serve({ pageDelay: 2500 });
          await openEarlier(theme, 2, [...LIST, LATEST]);
          s = await hoverDots();
          await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
          await page.mouse.move(s.card.rows[1].x, s.card.rows[1].y, { steps: 4 });
          await page.waitForTimeout(200);
          await shoot(`earlier-list-${tag}`);
          const list = (await state()).card;
          await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
          await page.waitForTimeout(400);
          await shoot(`earlier-loading-${tag}`);
          const loading = (await state()).card;
          l = await landed(4, 2);
          await page.mouse.move(Math.min(700, width / 2), 300);
          await page.waitForTimeout(300);
          await shoot(`earlier-landed-${tag}`);
          s = await state();
          check(`earlier (${tag}): every state draws, with its strings`,
            single.meta === t.one && single.warn === t.foot && list.meta === t.many && loading.meta === t.wait && loading.rows[3]?.spin &&
              l.landed && !!s.dotsDot && !!under(s, 4), { single: single.meta, list: list.meta, loading: loading.meta, landed: l.landed });
        }
    // Under 560 px of chat the rail doesn't draw at all (unchanged).
    await page.setViewportSize({ width: 390, height: 844 });
    await settings({ lang: 'en', bookmarkNotice: 'acknowledged' });
    await seedStore([A, LATEST], { clear: true });
    await page.goto(`https://chatgpt.com/c/${CONV}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shots}/earlier-rest-light-en-mobile390.png` });
    check('earlier: at 390 px the rail stays off, as before', !(await page.evaluate(() => document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'))));
    await page.setViewportSize({ width: 1400, height: 900 });

    // The mockup's panels next to them, when given.
    if (process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP) {
      const mock = await openMockup(context, process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP);
      await mock.click('[data-mode="clean"]');
      const names = ['before', 'rest', 'single', 'list', 'loading', 'landed'];
      for (const lang of ['en', 'zh']) {
        await mock.click(`[data-lang="${lang}"]`);
        const figs = mock.locator('figure .page');
        for (let k = 0; k < (await figs.count()); k++)
          await figs.nth(k).screenshot({ path: `${shots}/mockup-earlier-${names[k % 6]}-${k < 6 ? 'light' : 'dark'}-${lang}.png` });
      }
      await mock.close();
    }
  },
};
