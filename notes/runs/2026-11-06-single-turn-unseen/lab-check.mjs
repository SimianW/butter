import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import fs from 'node:fs/promises';
const lab = L.acquire('1', { owner: 'single-turn-unseen', wait: 60 });
try {
  const { browser, context } = await L.connect(lab);
  await L.sendGuard(context, lab);
  const page = context.pages().find((p) => p.url().includes('chatgpt.com'));
  const files = ['core-main.js', 'layout-check-main.js', 'layout-codec.js', 'layout-cache-main.js'];
  const source = (
    await Promise.all(
      files.map((f) =>
        fs.readFile(new URL('../../../extension/seek/' + f, import.meta.url), 'utf8'),
      ),
    )
  ).join('\n');
  await page.addInitScript({ content: source });
  // Discover existing conversation links without printing their URLs or titles.
  const urls = await page
    .locator('a[href*="/c/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.href))]);
  let single = false;
  for (const url of [page.url(), ...urls].slice(0, 16)) {
    await page.goto(url);
    await page.waitForSelector('[data-turn-key]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => {
      const t = document.querySelector('[data-turn-key]');
      let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))];
      for (let d = 0; f && d < 80; d++, f = f.return)
        if (Array.isArray(f.memoizedProps?.entries) && f.memoizedProps.RowComponent) {
          const ids = f.memoizedProps.entries.map((e) => e.turnKey);
          let heights = {};
          for (let h = f.memoizedState, i = 0; h && i < 80; h = h.next, i++) {
            const v = h.memoizedState;
            if (
              v &&
              typeof v === 'object' &&
              !Array.isArray(v) &&
              ids.some((id) => typeof v[id] === 'number')
            ) {
              heights = v;
              break;
            }
          }
          return {
            turns: ids.length,
            mounted: document.querySelectorAll('[data-turn-key]').length,
            dil: !!document.querySelector('[class*="DilResponseRoot"]'),
            heights: ids.map((id) => heights[id] ?? null),
            rows: [...document.querySelectorAll('[data-turn-key]')].map((t) => ({
              row: t.parentElement.getBoundingClientRect().height,
              record: !!globalThis.__butterLayoutCache?.get(t.dataset.turnKey),
            })),
          };
        }
      return { turns: null };
    });
    console.log(JSON.stringify(state));
    if (state.turns === 1) {
      // Scroll through the existing answer; do not change its DOM or send a message.
      await page.evaluate(async () => {
        const sc = [...document.querySelectorAll('.thread-scroll-container')].find(
          (s) => s.clientHeight > 0,
        );
        for (let y = 0; y < sc.scrollHeight; y += 400) {
          sc.scrollTop = y;
          await new Promise((r) => setTimeout(r, 80));
        }
      });
      await page.waitForTimeout(1800);
      const current = await page.evaluate(() => {
        const t = document.querySelector('[data-turn-key]'),
          sc = t.closest('.thread-scroll-container'),
          r = __butterLayoutCache.get(t.dataset.turnKey);
        return {
          record: !!r,
          items: r?.items.length,
          rowH: r?.rowH,
          actual: t.parentElement.getBoundingClientRect().height,
          sw: r?.sw,
          currentSw: sc.clientWidth,
          stats: __heightCacheDump().stats,
        };
      });
      // stats contain truncated turn identifiers in hits; omit them.
      delete current.stats.hits;
      console.log(JSON.stringify({ singleAfterScroll: current }));
    }
    if (state.turns === 1) {
      single = true;
      break;
    }
  }
  console.log(JSON.stringify({ singleFound: single }));
  await browser.close();
} finally {
  await L.restore(lab);
  L.release(lab);
}
