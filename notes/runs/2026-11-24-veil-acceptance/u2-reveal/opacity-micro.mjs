// Micro-check: does an opacity change on a skipped (content-visibility: auto, off screen) block
// dirty layout? For each case, 25 skipped blocks change style in a task; the page then forces a
// style and layout update, and the trace shows how many layout objects that update found dirty.
// Usage: node notes/runs/2026-11-24-veil-acceptance/u2-reveal/opacity-micro.mjs
import { chromium } from 'playwright';

/* global document, getComputedStyle, console -- in the page */
const CASES = [
  ['opacity 0 -> 1', 'opacity: 0', 'opacity: 1'],
  ['opacity 0 -> 0.5', 'opacity: 0', 'opacity: 0.5'],
  ['opacity 0.5 -> 1', 'opacity: 0.5', 'opacity: 1'],
  ['opacity 1 -> 0', 'opacity: 1', 'opacity: 0'],
  ['color red -> blue', 'color: red', 'color: blue'],
  ['no computed change', 'color: red', 'color: red'],
  ['nothing changed', 'color: red', 'color: red', false, true],
  ['transition none -> default', 'transition: none', 'transition: all 0s'],
  ['opacity 0 -> 1, rendered block', 'opacity: 0', 'opacity: 1', true],
];
const browser = await chromium.launch();
for (const [name, from, to, onScreen, none] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent(`<style>
      p { margin: 0; height: 40px; content-visibility: auto; contain-intrinsic-size: auto 120px }
      .a { ${from} } .b { ${to} }
    </style><div id="c">${'<p class="a"><span>text <b>x</b></span></p>'.repeat(2000)}</div>`);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  await page.evaluate(() => document.body.offsetHeight);
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  await page.evaluate(([on, none]) => {
    const ps = [...document.querySelectorAll('p')];
    const pick = on ? ps.slice(0, 25) : ps.slice(1000, 1025);
    console.timeStamp('change');
    if (!none) for (const p of pick) p.className = 'b';
    getComputedStyle(pick[0]).opacity; // style only
    document.body.offsetHeight; // and layout
    console.timeStamp('done');
  }, [!!onScreen, !!none]);
  const ev = JSON.parse(await browser.stopTracing()).traceEvents;
  const a = ev.find((e) => e.args?.data?.message === 'change'),
    b = ev.find((e) => e.args?.data?.message === 'done');
  const inWin = ev.filter((e) => e.tid === a.tid && e.ts >= a.ts && e.ts <= b.ts);
  const layouts = inWin.filter((e) => e.name === 'Layout' && e.ph === 'X');
  const styles = inWin.filter((e) => e.name === 'UpdateLayoutTree');
  console.log(
    `${name.padEnd(32)} style el=${styles.map((e) => e.args?.elementCount).join('+') || 0}  layout ${layouts.length ? layouts.map((e) => `dirty ${e.args.beginData.dirtyObjects}/${e.args.beginData.totalObjects}`).join(', ') : 'none'}  InvalidateLayout=${inWin.filter((e) => e.name === 'InvalidateLayout').length}`,
  );
  await page.close();
}
await browser.close();
