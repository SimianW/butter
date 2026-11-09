// No-extension control: native composer accepts and attempts the formatted message.
// The send guard aborts the request; no ChatGPT message is sent.
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const L = await import(
  pathToFileURL(
    path.join(
      process.env.LAB_ROOT || path.join(os.homedir(), '.local/share/chatgpt-lab'),
      'lib/lab.mjs',
    ),
  )
);
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const lab = L.getLab(2);
assert.equal(
  (await fs.readFile(`${lab.lockPath}/owner`, 'utf8')).split('\n')[0],
  'branch-unsure-research',
);
assert.equal(L.browserArgs(lab).extensions.length, 0);
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
const blocked = [];
context.on('requestfailed', (r) => {
  const u = new URL(r.url());
  if (
    r.method() === 'POST' &&
    /^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname)
  )
    blocked.push({ path: u.pathname, error: r.failure()?.errorText });
});
try {
  const page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com'));
  await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded' });
  await page.locator('.katex').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  const editor = page.locator('.ProseMirror[contenteditable="true"]');
  await editor.fill('');
  const result = await editor.evaluate((e) => {
    const text = '> 起点 $a$ 的访问顺序。\n> \n> 终点 $b$ 的完成顺序。\n\n解释。';
    e.focus();
    const fill = document.execCommand('insertText', false, text);
    return {
      fill,
      typed: text,
      read: e.innerText.replace(/ /g, ' ').trim(),
      whiteSpace: getComputedStyle(e).whiteSpace,
      paragraphs: e.querySelectorAll('p').length,
      butterPresent: !!document.querySelector('chatgpt-butter-branch'),
    };
  });
  const send = page.locator('button[aria-label="Send"]:visible');
  await send.waitFor({ timeout: 10000 });
  await send.click();
  await page.waitForTimeout(3000);
  result.nativeSendClicked = true;
  result.blocked = blocked;
  console.log(JSON.stringify(result));
  await fs.writeFile('/tmp/branch-unsure-control.json', JSON.stringify(result, null, 2) + '\n');
  assert.ok(blocked.length, 'native send reaches request pipeline, blocked by guard');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
