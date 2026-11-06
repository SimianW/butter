// Captured Dil nesting with invented text; separate browser, no shared lab or ChatGPT requests.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const extension = new URL('../../extension/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const failures = [];
const check = (label, fn) => {
  try {
    fn();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`FAIL ${label}: ${error.message}`);
  }
};
try {
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
      : route.abort(),
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const rows = [
    ['Feature', 'Practice', 'Evaluation'],
    ['Mask', 'Enabled', 'Disabled'],
    ['Output', 'Scaled', 'Identity'],
    ['Gradient', 'Masked', 'Unchanged'],
  ];
  const table = (dil) =>
    `<div ${dil ? 'class="TableFrame-YxtDrz" data-d-column-sizing data-d-component' : 'data-wide-block'}><div class="TableViewport-RD3I2I" data-d-table-viewport><table class="Table-QT1UX2" data-d-column-sizing data-d-dividers><tbody>${rows.map((row, i) => `<tr data-d-component>${row.map((text) => `<${i ? 'td' : 'th'} data-d-component data-d-valign>${dil ? `<p class="TextBase-hXhSqg Text-lIMP0_" data-d-text-flow data-d-component>${text}</p>` : text}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table></div><div class="Edges-UXy4Ue"></div></div>`;
  // The supplied capture contains this code-widget subtree, not the screenshot card's DOM.
  const code =
    '<div data-client-defined-widget><div class="CodeBlock-zu1QM3"><div class="Root-iW7ipz CodeSurface-UAMd1A Surface-BCuIs1" data-code-block><div class="flex ActionBar-KWWAct"><div>Example</div><div data-code-block-controls><button>Copy</button></div></div><div class="grid"><div class="col-start-1 row-start-1 min-w-0"><div class="relative [container-type:inline-size]"><div class="InlineCodePane-EYx4bd w-full overflow-x-hidden"><div data-editor-search-surface><div class="cm-editor"><div class="cm-announced"></div><div class="cm-scroller chatgpt-code-scrollport"><div class="cm-content" data-language><div class="cm-line"><span>let </span><span>sample</span><span> = 7;</span></div><div class="cm-line"><span>sample += 1;</span></div></div></div></div></div></div><button>Scroll</button></div></div></div></div></div><div></div></div>';
  // Synthetic grid/flex cards cover the requested screenshot behavior, without claiming capture provenance.
  const card = (display) =>
    `<div data-client-defined-widget class="card" style="display:flex;flex-direction:column"><p>Input values</p><div class="${display}" style="${display === 'grid' ? 'grid-template-columns:repeat(4,1fr)' : ''}">${[
      3, 0, 9, 0, 6, 0, 12, 0,
    ]
      .slice(0, display === 'grid' ? 8 : 4)
      .map((n) => `<div><p><span>${n}</span></p></div>`)
      .join('')}</div><p>End of card</p></div>`;
  const recorded = [];
  for (const dil of [true, false]) {
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    const blocks = `<p>Before table</p>${table(dil)}${code}${card('grid')}${card('flex')}<p>After cards</p>`;
    const answer = dil
      ? `<div class="my-4" data-dil-source-message-id><div class="[--entity-prose-inset:0px]"><div></div><div class="relative PortalBoundary-TFj9W2 Renderer-ojZscX"><div class="DilRenderer-tB76Jj DilResponseRoot-HfQrEh Reveal-k2IWvM">${blocks}</div></div></div></div>`
      : blocks;
    await page.setContent(`<style>
      body{margin:0;font:16px/20px system-ui}.thread-scroll-container{width:766px;height:700px;overflow:auto}
      [data-turn-key]{width:640px;margin:0 auto}[data-user-message-bubble]{width:200px;margin-left:auto}
      p{margin:0} [data-wide-block],.TableFrame-YxtDrz{width:766px;margin-left:-63px;height:110px}
      table{width:640px;margin:auto;border-collapse:collapse} td,th{padding:0;height:27.5px;text-align:left}
      .grid{display:grid}.flex{display:flex}.card{height:186px}.card .flex>div{flex:1}
    </style><div class="thread-scroll-container"><div><div data-turn-key="synthetic"><div data-talvt-turn-state="complete"><div data-message-author-role="assistant" data-message-id="synthetic"><div data-user-message-bubble>Fixture question</div><div data-markdown-text-style="assistant-message">${answer}</div></div></div></div></div></div>`);
    for (const file of [
      'seek/core-main.js',
      'seek/layout-check-main.js',
      'seek/layout-codec.js',
      'seek/layout-cache-main.js',
    ])
      await page.addScriptTag({ content: await fs.readFile(new URL(file, extension), 'utf8') });
    await page.evaluate(() => {
      const turn = document.querySelector('[data-turn-key]'),
        row = turn.parentElement;
      turn.remove();
      row.append(turn);
    });
    await page.waitForFunction(() => __heightCacheDump().stats.records > 0);
    const result = await page.evaluate(() => __butterLayoutCache.get('synthetic'));
    recorded.push(result);
    const label = dil ? 'Dil' : 'classic';
    check(`${label}: table remains a preview item`, () => assert.equal(result.items.length, 7));
    check(`${label}: wide table excluded from intrinsic block sizes`, () =>
      assert.equal(result.blocks.length, 5),
    );
    check(`${label}: every item stays in the answer column`, () => {
      for (const it of result.items) {
        assert.ok(it.left >= 63, `left ${it.left}`);
        assert.ok(it.left + it.w <= 703, `right ${it.left + it.w}`);
      }
    });
    check(`${label}: all table cells survive as four text rows`, () =>
      assert.deepEqual(
        result.items[2].text.split('\n').map((r) => r.trim().split(/\s{2,}/)),
        rows,
      ),
    );
    const hydrated = await page.evaluate(
      ({ entry, rows }) => {
        const markdown = [
          rows[0].join(' | '),
          '--- | --- | ---',
          ...rows.slice(1).map((r) => r.join(' | ')),
        ].join('\n');
        const parts = __butterLayoutCheck.segments(markdown);
        const geometry = __butterLayoutCheck.geometryOnly(entry, parts, {});
        return {
          source: geometry.items[2].source,
          text: __butterLayoutCheck.hydrate(geometry, parts).items[2].text,
        };
      },
      { entry: result, rows },
    );
    check(`${label}: table text matches source for stored hydration`, () => {
      assert.equal(hydrated.source, 0);
      assert.equal(hydrated.text, result.items[2].text);
    });
    check(`${label}: code widget preserves code lines and omits buttons`, () =>
      assert.equal(result.items[3].text, 'Example\nlet sample = 7;\nsample += 1;'),
    );
    check(`${label}: grid cells keep two horizontal rows`, () =>
      assert.equal(result.items[4].text, 'Input values\n3  0  9  0\n6  0  12  0\nEnd of card'),
    );
    check(`${label}: flex cells keep one horizontal row`, () =>
      assert.equal(result.items[5].text, 'Input values\n3  0  9  0\nEnd of card'),
    );
    const preview = await fs.readFile(new URL('seek/preview-main.js', extension), 'utf8');
    await page.addStyleTag({ content: preview.match(/\.it\{[^}]+\}/)[0] });
    await page.addScriptTag({
      content: `globalThis.fixtureRender = (() => { const core = __butterSeekCore; let est = document.createElement('div'), fade = document.createElement('div'), notice = document.createElement('div'), layer = document.createElement('div'); document.body.append(layer); const railState = () => {}; ${preview.slice(preview.indexOf('  function content('), preview.indexOf('  // ----', preview.indexOf('  function render(')))} return (entry) => {const model = [{id:'synthetic',index:0,top:0,h:entry.h,layout:true,known:true}];const flat = entry.items.map((it,index)=>({it,index,turn:0,abs:it.top,h:it.h}));render({prep:{decision:{sequence:0},model,flat,colLeft:63,colWidth:640},hostRect:{height:2000},insetTop:0,rendered:new Map()},0);return [...layer.children].map(el=>({left:parseFloat(el.style.left),w:parseFloat(el.style.width),text:el.textContent}));}; })();`,
    });
    // Deliberately simulate a wide item arriving through a fallback/adopted record too.
    const drawn = await page.evaluate((entry) => {
      entry.items[2].left = 0;
      entry.items[2].w = 766;
      return fixtureRender(entry);
    }, result);
    check(`${label}: preview clamps a wide incoming record`, () => {
      for (const it of drawn) {
        assert.ok(it.left >= 63, `left ${it.left}`);
        assert.ok(it.left + it.w <= 703, `right ${it.left + it.w}`);
      }
    });
    check(`${label}: preview draws every cell`, () =>
      assert.equal(drawn[2].text, result.items[2].text),
    );
    const inkFits = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.it')].find((el) =>
        el.textContent.includes('Unchanged'),
      );
      const range = document.createRange();
      range.selectNodeContents(el);
      return [...range.getClientRects()].every(
        (r) => r.bottom <= el.getBoundingClientRect().bottom,
      );
    });
    check(`${label}: last table row fits inside the clipped preview height`, () =>
      assert.ok(inkFits),
    );
    await page.evaluate(() => {
      document.querySelector('.card .grid').style.gridTemplateColumns = 'repeat(2, 1fr)';
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() =>
      __butterLayoutCache.get('synthetic')?.items[4].text.includes('3  0\n9  0'),
    );
    check(`${label}: resize refreshes grid rows without a text mutation`, () => {});
    // Reusing a skipped widget must not read any of its descendants' layout.
    const reused = await page.evaluate(() => {
      const widget = document.querySelector('.card');
      widget.setAttribute('data-butter-seen', '');
      for (const cell of widget.querySelectorAll('*'))
        cell.getBoundingClientRect = () => {
          throw new Error('layout read inside skipped widget');
        };
      const event = new Event('contentvisibilityautostatechange', { bubbles: true });
      event.skipped = true;
      widget.dispatchEvent(event);
      const before = __heightCacheDump().stats.records;
      window.dispatchEvent(new Event('resize'));
      __butterLayoutCache.flushMeasurements();
      return __heightCacheDump().stats.records > before;
    });
    check(`${label}: unchanged skipped grid reuses its recorded rows`, () => assert.ok(reused));
    const rejected = await page.evaluate(() => {
      const widget = document.querySelector('.card');
      widget.style.width = '620px';
      const before = __heightCacheDump().stats.records;
      for (let i = 0; i < 2; i++) {
        window.dispatchEvent(new Event('resize'));
        __butterLayoutCache.flushMeasurements();
      }
      return __heightCacheDump().stats.records === before;
    });
    check(`${label}: changed skipped grid cannot replace good rows`, () => assert.ok(rejected));
    await page.evaluate(() => {
      const widget = document.querySelector('.card');
      for (const cell of widget.querySelectorAll('*')) delete cell.getBoundingClientRect;
      const event = new Event('contentvisibilityautostatechange', { bubbles: true });
      event.skipped = false;
      widget.dispatchEvent(event);
    });
    await page.addStyleTag({ path: new URL('stream/containment.css', extension).pathname });
    await page.addScriptTag({ path: new URL('stream/offscreen.js', extension).pathname });
    await page.waitForFunction(() =>
      document.querySelector('[data-turn-key]').hasAttribute('data-butter-seen'),
    );
    const wideCV = await page.evaluate(() => {
      document
        .querySelector('[data-talvt-turn-state]')
        .setAttribute('data-talvt-turn-state', 'in_progress');
      return getComputedStyle(document.querySelector('.TableFrame-YxtDrz, [data-wide-block]'))
        .contentVisibility;
    });
    check(`${label}: wide table stays outside block containment`, () =>
      assert.equal(wideCV, 'visible'),
    );
  }
  check('Dil and classic tables have identical preview text and geometry', () => {
    const item = (r) => {
      const { text, left, w, h } = r.items[2];
      return { text, left, w, h };
    };
    assert.deepEqual(item(recorded[0]), item(recorded[1]));
  });
  check('no browser errors', () => assert.deepEqual(errors, []));
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
