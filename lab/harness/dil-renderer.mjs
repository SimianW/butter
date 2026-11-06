// Synthetic renderer fixture in a separate browser: no shared lab or ChatGPT requests.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const extension = new URL('../../extension/', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
      : route.abort(),
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const dil of [true, false]) {
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    const formula = (tex) =>
      `<span class="katex-display"><span class="katex"><annotation>${tex}</annotation></span></span>`;
    const blocks = Array.from({ length: 22 }, (_, i) =>
      i === 4 || i === 12
        ? `<div class="Math-C48SKy" data-d-block>${formula(`x_${i}=1`)}</div>`
        : i === 9
          ? `<div>Mixed prose${formula('y=2')}After the formula</div>`
          : i === 10
            ? '<hr>'
            : `<p ${i === 16 ? 'data-wide-block' : ''}>Synthetic paragraph ${i} with enough text to identify this block.</p>`,
    ).join('');
    const answer = dil
      ? `<div class="my-4" data-dil-source-message-id="synthetic" data-markdown-copy><div class="[--entity-prose-inset:0px]"><div></div><div class="relative PortalBoundary-TFj9W2 Renderer-ojZscX" data-theme="light"><div class="DilRenderer-tB76Jj DilResponseRoot-HfQrEh Reveal-k2IWvM" data-d-direction data-dil-message-id="synthetic">${blocks}</div></div></div></div>`
      : blocks;
    await page.setContent(`<style>
      .thread-scroll-container{height:700px;overflow:auto;width:768px}
      [data-turn-key]{padding:20px}.katex-display{display:block;height:38px;margin:16px 0}
      annotation{display:none}
    </style><div class="thread-scroll-container"><div><div data-turn-key="synthetic"><div data-talvt-turn-state="complete"><div data-message-author-role="assistant" data-message-id="synthetic"><div data-user-message-bubble>Fixture question</div><div class="MarkdownRoot-rZKhxa" data-markdown-text-style="assistant-message">${answer}</div></div></div></div></div></div>`);
    // Scripts normally start before ChatGPT inserts the turns.
    for (const file of [
      'seek/core-main.js',
      'seek/layout-check-main.js',
      'seek/layout-codec.js',
      'seek/layout-cache-main.js',
      'seek/anchor-main.js',
    ]) {
      const content = await fs.readFile(new URL(file, extension), 'utf8');
      await page.addScriptTag({ content });
    }
    await page.evaluate(() => {
      const turn = document.querySelector('[data-turn-key]');
      const row = turn.parentElement;
      turn.remove();
      row.append(turn);
    });
    await page.waitForFunction(() => __heightCacheDump().stats.records > 0);
    const result = await page.evaluate(() => {
      const e = __butterLayoutCache.get('synthetic');
      return {
        blocks: e.blocks.length,
        items: e.items.length,
        text: e.items.map((it) => it.text),
        math: e.items.flatMap((it) => it.math),
        measured: [...document.querySelectorAll('.katex-display')].map(
          (el) => el.getBoundingClientRect().height,
        ),
      };
    });
    assert.equal(
      result.blocks,
      20,
      `${dil ? 'Dil' : 'direct'}: one size per real block except hr/wide`,
    );
    assert.equal(result.items, 23, 'question plus every real answer block');
    assert.equal(result.math.length, 3);
    assert.deepEqual(
      result.math.map((m) => m.h),
      result.measured,
      'display spans use their own boxes',
    );
    assert.ok(result.text.at(-1).includes('paragraph 21'), 'tail survives');
    console.log(
      `${dil ? 'Dil' : 'direct'}: ${result.blocks} block sizes, ${result.items} items, math heights ${result.math.map((m) => m.h).join(', ')}`,
    );
    const audit = await page.evaluate(() => {
      const sc = document.querySelector('.thread-scroll-container');
      const els = [...sc.querySelectorAll(__butterSeekCore.PREVIEW_ITEMS)];
      const flat = els.map((el, index) => {
        const r = el.getBoundingClientRect();
        return { turn: 0, index, abs: r.top - sc.getBoundingClientRect().top, h: r.height };
      });
      return __butterAnchorVisibleSwap({
        sc,
        hostRect: { x: 0, y: 0, width: 1000, height: 10000 },
        rendered: new Map(els.map((el, i) => [i, el])),
        prep: { flat, model: [{ id: 'synthetic' }] },
        previewTop: 0,
        lastTop: 0,
      });
    });
    assert.equal(audit.items, 23, 'anchor indexes address every real block');
    assert.equal(audit.hMatch, 23);
    assert.equal(audit.itemErrMax, 0);
    console.log('anchors: 23 matching block indexes, zero geometry error');
    // A resize without a text mutation must refresh math geometry too.
    await page.evaluate(() => (document.querySelector('.katex-display').style.height = '62px'));
    await page.waitForFunction(
      () => __butterLayoutCache.get('synthetic')?.items.flatMap((it) => it.math)[0]?.h === 62,
    );
    console.log('resize: display height refreshed to 62');
    // Exercise the actual preview content renderer against a legacy mixed-prose record.
    const preview = await fs.readFile(new URL('seek/preview-main.js', extension), 'utf8');
    await page.addScriptTag({
      content: `globalThis.fixtureContent = (() => { const core = __butterSeekCore; ${preview.slice(preview.indexOf('  function content('), preview.indexOf('  function estimatedContent('))} return content; })();`,
    });
    const clamped = await page.evaluate(() => {
      const el = document.createElement('div');
      fixtureContent(el, 'before x=1 after', [
        { start: 7, end: 10, display: true, h: 2169.484375 },
      ]);
      return el.querySelector('.math.display').style.height;
    });
    assert.equal(clamped, '184px', 'mixed-prose preview uses the same per-formula clamp');
    console.log('preview: legacy mixed-prose display height clamped to 184px');
    await page.addStyleTag({ path: new URL('stream/containment.css', extension).pathname });
    await page.addScriptTag({ path: new URL('stream/offscreen.js', extension).pathname });
    await page.waitForFunction(() => {
      const md = document.querySelector('[data-markdown-text-style]');
      const root = md.querySelector('[data-dil-message-id]') || md;
      return root.lastElementChild.hasAttribute('data-butter-seen');
    });
    const cv = await page.evaluate(() => {
      const md = document.querySelector('[data-markdown-text-style]');
      const root = md.querySelector('[data-dil-message-id]') || md;
      return {
        block: getComputedStyle(root.lastElementChild).contentVisibility,
        wrapper: getComputedStyle(md.firstElementChild).contentVisibility,
      };
    });
    assert.equal(cv.block, 'auto');
    if (dil) assert.equal(cv.wrapper, 'visible', 'wrapper must not become one huge skipped block');
    console.log('containment: real blocks marked and skipped, wrapper left visible');
    const streaming = await page.evaluate(() => {
      document
        .querySelector('[data-talvt-turn-state]')
        .setAttribute('data-talvt-turn-state', 'in_progress');
      for (const el of document.querySelectorAll('[data-butter-seen]'))
        el.removeAttribute('data-butter-seen');
      const md = document.querySelector('[data-markdown-text-style]');
      const root = md.querySelector('[data-dil-message-id]') || md;
      return {
        block: getComputedStyle(root.lastElementChild).contentVisibility,
        wide: getComputedStyle(root.querySelector('[data-wide-block]')).contentVisibility,
        wrapper: getComputedStyle(md.firstElementChild).contentVisibility,
      };
    });
    assert.equal(streaming.block, 'auto');
    assert.equal(streaming.wide, 'visible');
    if (dil) assert.equal(streaming.wrapper, 'visible');
    console.log(
      'streaming containment: real blocks skipped before marking, wide block left visible',
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
