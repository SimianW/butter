// Real recorder + Chromium content-visibility; synthetic long Dil answer, no ChatGPT requests.
// Usage: node lab/harness/math-pending-long-answer.mjs [scenario...]
//   history   completed answer loaded with the chat, read top to bottom with pauses
//   hover     as history, but ChatGPT-like DOM churn in the turn (action bar on hover) while reading
//   partial   as hover, but the user reads only the first third, then presses the scrollbar
//   streamed  answer streamed below the fold, then dragged through fast: blocks render for a few
//             frames each and are skipped again before stream/offscreen.js's one-second flush
// Env: BLOCKS (default 80); EXTENSION=<dir> runs another copy of extension/ (perf baseline).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BLOCKS = +(process.env.BLOCKS || 80);
const extension = process.env.EXTENSION
  ? new URL(`file://${process.env.EXTENSION.replace(/\/?$/, '/')}`)
  : new URL('../../extension/', import.meta.url);
const scenarios = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['history', 'hover', 'partial', 'streamed'];
const failures = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const name of scenarios) {
    try {
      await run(name);
    } catch (e) {
      failures.push(name);
      console.log(JSON.stringify({ scenario: name, FAIL: e.message }));
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.log('FAILED: ' + failures.join(', '));
  process.exit(1);
}
console.log('PASS: ' + scenarios.join(', '));

async function run(name) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.route('**/*', (r) =>
    r.request().isNavigationRequest()
      ? r.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
      : r.abort(),
  );
  await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => {
    globalThis.fixtureSkipped = new Set();
    document.addEventListener(
      'contentvisibilityautostatechange',
      (e) => (e.skipped ? fixtureSkipped.add(e.target) : fixtureSkipped.delete(e.target)),
      true,
    );
  });
  for (const f of ['core-main.js', 'layout-check-main.js', 'layout-codec.js', 'layout-cache-main.js'])
    await page.addScriptTag({ content: await fs.readFile(new URL('seek/' + f, extension), 'utf8') });
  await page.addStyleTag({ path: new URL('stream/containment.css', extension).pathname });
  await page.addScriptTag({ path: new URL('stream/offscreen.js', extension).pathname });
  const streamed = name === 'streamed';
  // History: no record is made before the blocks are marked seen and skip (on the Mac the turn
  // had no record at all). Stand-in for a busy load: idle measuring is held for 1.6 s.
  if (!streamed)
    await page.evaluate(() => {
      const until = performance.now() + 1600;
      globalThis.__butterSeeking = () => performance.now() < until;
    });
  await page.evaluate(
    ({ n, state }) => {
      // Dil: blocks are the DilResponseRoot's children; display math is KaTeX with an annotation
      // and no [data-math-source]. Every third block is a code widget (a spatial grid).
      const block = (i) =>
        i % 3 === 2
          ? `<div data-client-defined-widget class="Widget-fixture"><div style="display:grid;grid-template-columns:1fr 1fr"><span>Cell ${i}a</span><span>Cell ${i}b</span></div><p class="filler">Widget body</p></div>`
          : `<div class="Math-C48SKy"><p>Fixture block ${i}</p><span class="katex-display"><span class="katex"><annotation>x_${i}=1</annotation></span></span><p class="filler">After formula</p></div>`;
      document.body.innerHTML = `<style>
        body{margin:0}annotation{display:none}p{margin:0}
        .thread-scroll-container{width:766px;height:700px;overflow:auto}
        [data-turn-key]{width:640px;margin:auto}
        .DilResponseRoot-fixture>div{padding:16px 0}
        .katex-display{display:block;height:38px;margin:16px 0}
        .filler{height:150px}
      </style><div class="thread-scroll-container"><div><div data-turn-key="synthetic">
        <div data-talvt-turn-state="${state}"><div data-user-message-bubble>Fixture question</div>
        <div data-message-author-role="assistant" data-message-id="synthetic">
        <div data-markdown-text-style="assistant-message"><div class="my-4"><div>
        <div></div><div class="Renderer-fixture"><div class="DilResponseRoot-fixture">${Array.from(
          { length: n },
          (_, i) => block(i),
        ).join('')}</div></div></div></div></div><div class="actions"></div></div></div></div></div></div>`;
    },
    { n: BLOCKS, state: streamed ? 'in_progress' : 'complete' },
  );
  // History: blocks render once, are marked seen after the 1 s flush, then off-screen ones skip.
  // Streamed: most blocks are skipped at their intrinsic placeholder before they ever render.
  await page.waitForTimeout(1300);
  if (streamed)
    await page.evaluate(() =>
      document
        .querySelector('[data-talvt-turn-state]')
        .setAttribute('data-talvt-turn-state', 'complete'),
    );
  await page.waitForTimeout(400);
  const summary = () =>
    page.evaluate(() => {
      const t = document.querySelector('[data-turn-key]'),
        sc = t.closest('.thread-scroll-container');
      const r = __butterLayoutCache.get('synthetic');
      const model = __butterSeekCore.buildModel({
        ids: ['synthetic'],
        measured: { synthetic: t.parentElement.getBoundingClientRect().height },
        records: { synthetic: r },
        texts: {},
        scrollHeight: sc.scrollHeight,
        gap: 12,
        sw: sc.clientWidth,
      })[0];
      const { records, rejected, recordMs, recordMax } = __heightCacheDump().stats;
      return {
        record: !!r,
        items: r?.items.length ?? 0,
        math: r?.items.flatMap((it) => it.math).length ?? 0,
        estimated: r?.items.filter((it) => it.approx).length ?? 0,
        layout: model.layout,
        rowH: Math.round(t.parentElement.getBoundingClientRect().height),
        diagnostics: __butterLayoutCache.diagnostics(t),
        skipped: fixtureSkipped.size,
        sourceAttributes: t.querySelectorAll('[data-math-source]').length,
        marks: { seen: t.querySelectorAll('[data-butter-seen]').length, unrendered: t.querySelectorAll('[data-butter-unrendered]').length },
        stats: { records, rejected, recordMs: +recordMs.toFixed(1), recordMax: +recordMax.toFixed(1) },
      };
    });
  console.log(JSON.stringify({ scenario: name, phase: 'loaded', ...(await summary()) }));
  // Reading: one viewport step at a time with a pause (idle time) between steps; streamed is a
  // fast drag. ChatGPT's hover action bar adds/removes nodes inside the turn as the pointer moves.
  const churn = name === 'hover' || name === 'partial';
  const stop = name === 'partial' ? 1 / 3 : 1;
  await page.evaluate(
    async ({ step, pause, churn, stop }) => {
      const sc = document.querySelector('.thread-scroll-container');
      const bar = document.querySelector('.actions');
      for (let y = 0, i = 0; y < sc.scrollHeight * stop; y += step, i++) {
        sc.scrollTop = y;
        if (churn) {
          if (i % 2) bar.replaceChildren();
          else bar.innerHTML = '<button>Copy</button>';
        }
        await new Promise((r) => setTimeout(r, pause));
      }
    },
    streamed
      ? { step: 350, pause: 30, churn, stop }
      : { step: 500, pause: 250, churn, stop },
  );
  await page.waitForTimeout(1400);
  // A seek press measures whatever is still queued synchronously (preview-main prepare()).
  const pressed = await page.evaluate(() => {
    const t0 = performance.now();
    __butterLayoutCache.flushMeasurements();
    return +(performance.now() - t0).toFixed(1);
  });
  const result = { ...(await summary()), pressMs: pressed };
  // Ground truth: lay out every block (containment off) and compare the record's item boxes.
  // An estimate may only concern formula boxes inside a block, never an item's own top/height.
  result.truth = await page.evaluate(() => {
    const r = __butterLayoutCache.get('synthetic');
    if (!r) return null;
    document.documentElement.setAttribute('data-butter-off', 'cv');
    const t = document.querySelector('[data-turn-key]');
    const row = t.parentElement.getBoundingClientRect();
    const real = [...t.querySelectorAll(__butterSeekCore.PREVIEW_ITEMS)].map((el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top - row.top, h: b.height };
    });
    let worst = 0;
    r.items.forEach((it, i) => {
      worst = Math.max(worst, Math.abs(it.top - real[i].top), Math.abs(it.h - real[i].h));
    });
    return { worstItemPx: +worst.toFixed(2), realRowH: Math.round(row.height), recordedRowH: Math.round(r.rowH) };
  });
  console.log(JSON.stringify({ scenario: name, phase: 'read', ...result }));
  await page.close();
  assert.equal(result.sourceAttributes, 0);
  if (name !== 'partial') assert.ok(result.skipped > 40, 'most blocks must remain skipped');
  assert.equal(result.layout, true, `${name}: long Dil answer must have a trusted preview`);
  assert.equal(result.items, BLOCKS + 1, 'question and all answer blocks survive');
  assert.ok(result.math >= 1, 'measured formulas are kept');
  // A drag never leaves a block on screen for an idle measure; its formulas stay estimates.
  if (name === 'partial' || streamed)
    assert.ok(result.estimated > 0, 'unmeasured formulas are flagged estimates');
  else assert.equal(result.estimated, 0, 'a fully read answer has no estimates');
  assert.ok(result.truth.worstItemPx <= 1, 'every item box matches its real layout');
  assert.equal(result.truth.recordedRowH, result.truth.realRowH);
  assert.deepEqual(errors, []);
}
