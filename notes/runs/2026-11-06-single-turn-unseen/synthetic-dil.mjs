import { chromium } from '../../../lab/harness/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.route('**/*', (r) =>
    r.request().isNavigationRequest()
      ? r.fulfill({ body: '<!doctype html>', contentType: 'text/html' })
      : r.abort(),
  );
  const source = (
    await Promise.all(
      ['core-main.js', 'layout-check-main.js', 'layout-codec.js', 'layout-cache-main.js'].map((f) =>
        fs.readFile(new URL('../../../extension/seek/' + f, import.meta.url), 'utf8'),
      ),
    )
  ).join('\n');
  for (const late of [false, true]) {
    await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
    if (!late) await page.addScriptTag({ content: source });
    const capture = JSON.parse(
      await fs.readFile(
        new URL('../2026-11-05-dil-renderer-blocks/user-capture.json', import.meta.url),
        'utf8',
      ),
    );
    const nodes = capture.dom.turn;
    const root = nodes.find((n) => n.classes.some((c) => c.includes('DilResponseRoot')));
    const blocks = nodes
      .filter((n) => n.parent === root.index)
      .map((n) =>
        n.dataAttributeNames.includes('data-client-defined-widget')
          ? `<div data-client-defined-widget style="height:${n.height}px"><div style="display:flex"><p>Label</p><p>Value</p></div><div style="display:grid"><div><div class="cm-line">Synthetic code</div><div class="cm-line">Second line</div></div></div><div></div></div>`
          : n.classes.includes('Math-C48SKy')
            ? '<div style="height:70.484375px"><span class="katex-display" style="display:block;height:38.484375px"><span class="katex"><annotation>x=1</annotation></span></span></div>'
            : `<${n.tag} style="height:${n.height}px">Synthetic block</${n.tag}>`,
      )
      .join('');
    await page.evaluate((html) => {
      document.body.innerHTML = html;
    }, `<style>body{margin:0}annotation{display:none}.thread-scroll-container{width:766px;height:700px;overflow:auto}p{margin:0} [data-turn-key]{width:640px;margin:auto}[class*=DilResponseRoot]>*{margin:16px 0}</style><div class="thread-scroll-container"><div><div data-turn-key="synthetic"><div data-talvt-turn-state="complete"><div data-user-message-bubble style="height:72px">Synthetic question</div><div data-message-author-role="assistant" data-message-id="synthetic"><div data-markdown-text-style="assistant-message"><div class="my-4"><div><div></div><div><div class="DilResponseRoot-fixture">${blocks}</div></div></div></div></div></div></div></div></div></div>`);
    if (late) await page.addScriptTag({ content: source });
    await page.evaluate(async () => {
      const s = document.querySelector('.thread-scroll-container');
      for (let y = 0; y < s.scrollHeight; y += 400) {
        s.scrollTop = y;
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    await page.waitForTimeout(500);
    const result = await page
      .evaluate(() => {
        const t = document.querySelector('[data-turn-key]'),
          sc = t.closest('.thread-scroll-container'),
          r = __butterLayoutCache.get('synthetic');
        const model = __butterSeekCore.buildModel({
          ids: ['synthetic'],
          measured: { synthetic: t.parentElement.getBoundingClientRect().height },
          records: { synthetic: r },
          texts: {},
          scrollHeight: sc.scrollHeight,
          gap: 12,
          sw: sc.clientWidth,
        });
        const stats = __heightCacheDump().stats;
        delete stats.hits;
        return { record: !!r, items: r?.items.length, layout: model[0].layout, stats };
      })
      .catch((e) => ({ error: e.message }));
    // late is a host variable; serialize it separately.
    console.log(JSON.stringify({ late, ...result }));
    await page.evaluate(() => {
      const turn = document.querySelector('[data-turn-key]');
      turn.__reactFiber$fixture = {
        memoizedProps: { entries: [{ turnKey: 'synthetic' }], RowComponent() {} },
        memoizedState: {
          memoizedState: { synthetic: turn.parentElement.getBoundingClientRect().height },
        },
      };
      globalThis.copy = (json) => {
        globalThis.fixtureReadiness = JSON.parse(json);
      };
    });
    await page.addScriptTag({
      content: await fs.readFile(
        new URL('../../diagnostics/capture-record-readiness.js', import.meta.url),
        'utf8',
      ),
    });
    const readiness = await page.evaluate(() => fixtureReadiness);
    assert.equal(readiness.turns[0].layout, true);
    assert.equal(readiness.turns[0].recorder.lastRejection, null);
    console.log(JSON.stringify({ readiness }));

    assert.equal(
      result.layout,
      true,
      `late=${late}: fully viewed single Dil answer must have a layout`,
    );
  }
} finally {
  await browser.close();
}
