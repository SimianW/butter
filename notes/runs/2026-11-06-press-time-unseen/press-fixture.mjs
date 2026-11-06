// Synthetic single-turn Dil page. Real cache + full press/render listeners; no network requests.
import { chromium } from '../../../lab/harness/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../../../', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) =>
    r.request().isNavigationRequest()
      ? r.fulfill({ body: '<!doctype html>', contentType: 'text/html' })
      : r.abort(),
  );
  const scenarios = [
    { name: 'ordinary', project: false, reason: null },
    { name: 'project', project: true, reason: null },
    { name: 'press-width', project: true, reason: 'sw-mismatch' },
    { name: 'no-measured', project: true, reason: 'no-measured' },
    { name: 'height-mismatch', project: true, reason: 'height-mismatch' },
    { name: 'fallback-ids', project: true, reason: 'no-record' },
    { name: 'conv-mismatch', project: true, reason: 'conv-mismatch' },
    { name: 'different-scroller', project: true, reason: 'sw-mismatch' },
  ];
  for (const { name, project, reason } of scenarios) {
    await page.goto(
      'https://butter.invalid/' +
        (project ? 'g/g-p-synthetic/' : '') +
        'c/00000000-0000-0000-0000-000000000000',
    );
    await page.evaluate(() => {
      document.body.innerHTML = `<style>body{margin:0}.thread-scroll-container{height:700px;width:931px;overflow:auto;user-select:none} .thread-scroll-container>div{pointer-events:none} [data-turn-key]{width:640px;margin:auto} p{height:62px;margin:16px 0}</style><div class="thread-scroll-container"><div><div><div data-turn-key="turn-synthetic"><div data-talvt-turn-state="complete"><div data-user-message-bubble style="height:72px">Synthetic question</div><div data-message-author-role="assistant" data-message-id="answer-synthetic"><div data-markdown-text-style="assistant-message"><div class="my-4"><div><div></div><div><div class="DilResponseRoot-fixture">${Array.from({ length: 62 }, (_, i) => `<p>Synthetic paragraph ${i}</p>`).join('')}</div></div></div></div></div></div></div></div></div></div></div>`;
    });
    for (const file of [
      'core-main.js',
      'layout-check-main.js',
      'layout-codec.js',
      'layout-cache-main.js',
      'preview-main.js',
    ])
      await page.addScriptTag({ path: new URL('extension/seek/' + file, root).pathname });
    await page.waitForFunction(() => __butterLayoutCache.get('turn-synthetic')?.items.length > 0);
    await page.evaluate(() => {
      const turn = document.querySelector('[data-turn-key]');
      turn.__reactFiber$fixture = {
        memoizedProps: { entries: [{ turnKey: 'turn-synthetic' }], RowComponent() {} },
        memoizedState: {
          memoizedState: { 'turn-synthetic': turn.parentElement.getBoundingClientRect().height },
        },
      };
      document.dispatchEvent(
        new CustomEvent('butter-seek-data', {
          detail: {
            conv: '00000000-0000-0000-0000-000000000000',
            j: {
              messages: [
                {
                  id: 'turn-synthetic',
                  author: { role: 'user' },
                  content: { parts: ['Synthetic question'] },
                },
                {
                  id: 'answer-synthetic',
                  author: { role: 'assistant' },
                  content: { parts: ['Synthetic answer'] },
                },
              ],
            },
          },
        }),
      );
      globalThis.copy = (json) => {
        globalThis.fixtureReadiness = JSON.parse(json);
      };
    });
    await page.evaluate(async () => {
      const sc = document.querySelector('.thread-scroll-container');
      for (let y = 0; y < sc.scrollHeight; y += 450) {
        sc.scrollTop = y;
        await new Promise((r) => setTimeout(r, 10));
      }
    });
    await page.waitForTimeout(200);
    await page.addScriptTag({
      path: new URL('notes/diagnostics/capture-record-readiness.js', root).pathname,
    });
    assert.equal(await page.evaluate(() => fixtureReadiness.turns[0].layout), true);
    await page.evaluate((name) => {
      const sc = document.querySelector('.thread-scroll-container'),
        turn = sc.querySelector('[data-turn-key]');
      if (name === 'press-width') {
        const style = document.createElement('style');
        style.textContent = '.thread-scroll-container:active{width:916px}';
        document.head.append(style);
      }
      if (name === 'no-measured') turn.__reactFiber$fixture.memoizedState.memoizedState = {};
      if (name === 'height-mismatch')
        turn.__reactFiber$fixture.memoizedState.memoizedState['turn-synthetic'] -= 40;
      if (name === 'fallback-ids') {
        delete turn.__reactFiber$fixture;
        document.dispatchEvent(
          new CustomEvent('butter-seek-data', {
            detail: {
              conv: '00000000-0000-0000-0000-000000000000',
              j: {
                messages: [
                  {
                    id: 'message-synthetic',
                    author: { role: 'user' },
                    content: { parts: ['Synthetic question'] },
                  },
                ],
              },
            },
          }),
        );
      }
      if (name === 'conv-mismatch')
        history.replaceState(null, '', '/g/g-p-synthetic/c/11111111-1111-1111-1111-111111111111');
      if (name === 'different-scroller') {
        const second = sc.cloneNode(true);
        second.style.cssText = 'position:fixed;top:0;left:0;width:800px';
        second.querySelector('[data-turn-key]').__reactFiber$fixture = turn.__reactFiber$fixture;
        document.body.append(second);
      }
    }, name);
    await page.mouse.move(
      name === 'different-scroller' ? 798 : name === 'press-width' ? 915 : 929,
      650,
    );
    await page.mouse.down();
    await page.evaluate(
      () => ([...document.querySelectorAll('.thread-scroll-container')].at(-1).scrollTop = 1000),
    );
    await page.waitForFunction(() => __butterSeeking(), null, { timeout: 1000 });
    const result = await page.evaluate(() => ({
      active: __butterSeeking(),
      notice: !document.querySelector('butter-seek-preview').shadowRoot.querySelector('.notice')
        .hidden,
      layout: __seekDump().sessions.at(-1).model.layout,
      press: __seekDump().presses.at(-1),
    }));
    const decision = await page.evaluate(() => __seekDump.pressDecision);
    assert.equal(result.notice, reason !== null, `${name}: actual notice`);
    assert.equal(decision.turns[0].layoutReason, reason, `${name}: exact trust decision`);
    assert.equal(decision.render.turnIndex, 0);
    assert.equal(decision.render.prepareSequence, decision.sequence);
    assert.equal(decision.render.modelLength, 1);
    assert.equal(decision.render.unseen, result.notice);
    assert.equal(decision.scroller.matchesThreadScroller, name !== 'different-scroller');
    assert.equal(decision.idsFromFallback, name === 'fallback-ids');
    if (name === 'press-width') {
      assert.equal(decision.turns[0].recordSw, 931);
      assert.equal(decision.scroller.sw, 916);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
    // The capture must remain usable even if live DOM/cache reads become unavailable.
    const before = await page.evaluate(() => {
      const snapshot = __seekDump.pressDecision;
      const again = __seekDump.pressDecision;
      again.turns[0].layoutReason = 'tampered';
      if (__seekDump.pressDecision.turns[0].layoutReason === 'tampered')
        throw new Error('mutable debug state');
      if (Object.getOwnPropertyDescriptor(__seekDump, 'pressDecision').set)
        throw new Error('writable debug state');
      globalThis.copy = (json) => {
        globalThis.fixturePressCapture = JSON.parse(json);
      };
      globalThis.fixtureOriginalQuery = document.querySelectorAll;
      document.querySelectorAll = () => {
        throw new Error('capture read live DOM');
      };
      __butterLayoutCache.get =
        __butterLayoutCache.prepare =
        __butterLayoutCache.flushMeasurements =
          () => {
            throw new Error('capture read live cache');
          };
      return snapshot;
    });
    await page.evaluate(
      await fs.readFile(new URL('notes/diagnostics/capture-press-decision.js', root), 'utf8'),
    );
    const capture = await page.evaluate(() => {
      document.querySelectorAll = fixtureOriginalQuery;
      return fixturePressCapture;
    });
    assert.deepEqual(capture, before);
    assert.doesNotMatch(
      JSON.stringify(capture),
      /turn-synthetic|answer-synthetic|message-synthetic|Synthetic question|butter\.invalid|00000000|11111111/,
    );
    console.log(JSON.stringify({ name, project, ...result, decision: capture }));
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
