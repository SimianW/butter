// Red regression: the real DOM adapter round-trips a formatted, multi-paragraph quote.
// No ChatGPT requests. Run: node lab/harness/branch-unsure-composer.mjs
// BROWSER_EXECUTABLE overrides Playwright's pinned Chromium executable.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(repo, 'notes/runs/2026-11-08-branch-unsure/data');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const cases = [
  { name: 'one English paragraph', quote: 'A short public example.', question: 'Explain.' },
  {
    name: 'two Chinese paragraphs with inline math',
    quote: '起点 $a$ 的访问顺序。\n\n终点 $b$ 的完成顺序。',
    question: '解释。',
  },
  {
    name: 'two English paragraphs',
    quote: 'First public paragraph.\n\nSecond public paragraph.',
    question: 'Explain.',
  },
];
const results = [];
try {
  for (const input of cases) {
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>.ProseMirror{white-space:break-spaces}p{margin:0}</style><div data-message-author-role="assistant">Public fixture reply.</div><form><div class="ProseMirror" contenteditable="true" role="textbox"><p><br class="ProseMirror-trailingBreak"></p></div><button type="button" aria-label="Send">Send</button></form>`,
      }),
    );
    await page.goto('https://chatgpt.com/c/local-chatgpt:11111111-2222-4333-8444-555555555555');
    // branch/page.js reads replies through the page reader, which the manifest loads first.
    for (const name of ['page/reader', 'branch/logic', 'branch/run', 'branch/page'])
      await page.addScriptTag({ path: path.join(repo, `extension/${name}.js`) });
    const result = await page.evaluate(async (input) => {
      const page = ButterBranchPage.adapter(),
        reads = [],
        fills = [];
      let clicks = 0,
        t = 0;
      document.querySelector('button').addEventListener('click', () => clicks++);
      const adapter = {
        ...page,
        composerText() {
          const text = page.composerText();
          reads.push(text);
          return text;
        },
        fill(text) {
          fills.push(text);
          return page.fill(text);
        },
      };
      const result = await ButterBranchRun.start({
        job: {
          original: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          title: 'Fixture',
          quote: input.quote,
          question: input.question,
        },
        page: adapter,
        clock: {
          now: () => t,
          sleep: async (ms) => {
            t += ms;
          },
        },
      }).done;
      return {
        name: input.name,
        state: result.state,
        cause: result.cause,
        typed: fills[0],
        read: reads.at(-1),
        normalized: reads
          .at(-1)
          ?.trim()
          .replace(/\n{3,}/g, '\n\n'),
        sendClicks: clicks,
        editorHtml: document.querySelector('.ProseMirror').innerHTML,
      };
    }, input);
    results.push(result);
    console.log(JSON.stringify(result));
    await page.close();
  }
  await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(results, null, 2) + '\n');
  for (const result of results)
    assert.equal(
      result.state,
      'ready',
      `${result.name}: full formatted message should be sent in the verified branch (cause=${result.cause})`,
    );
} finally {
  await browser.close();
}
