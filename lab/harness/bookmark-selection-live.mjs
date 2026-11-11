// #77 focused live selection / notification checks. Hold LAB_ID / LAB_OWNER's lock and load
// a fresh task-owned unpacked extension first. Never fills a composer; send guard stays on.
// OUT defaults to this run's report directory. Only numeric / boolean evidence is saved.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.OUT || path.join(repo, 'notes/runs/2026-11-10-bookmark-selection-77-live');
const lab = L.getLab(process.env.LAB_ID || 1);
assert.equal(
  (await fs.readFile(`${lab.lockPath}/owner`, 'utf8')).split('\n')[0],
  process.env.LAB_OWNER,
);
for (let i = 0; i < 60 && !(await L.cdpVersion(lab)); i++)
  await new Promise((resolve) => setTimeout(resolve, 500));
// Refuse the lab's own data before connecting or making any settings/bookmark write.
const running = L.browserArgs(lab);
assert.ok(running, 'running browser arguments must be readable');
const defaults = lab.defaultExtensions || [];
assert.ok(
  running.extensions.length > 0 &&
    running.extensions.every((extension) => !defaults.includes(extension)),
  'Refusing default lab extensions: load a fresh task-owned extension first',
);
const expected = (process.env.LAB_EXTENSIONS || '').split(',').filter(Boolean);
assert.equal(expected.length, 1, 'LAB_EXTENSIONS must name one fresh task-owned copy');
assert.deepEqual(running.extensions, expected, 'running extension must match the task-owned copy');
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
const result = {
  testedHead:
    process.env.TESTED_HEAD ||
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  checks: [],
  pageErrors: { butter: 0, other: 0 },
};
const check = (name, pass, numbers = {}) => {
  result.checks.push({ name, pass: !!pass, ...numbers });
  console.log(JSON.stringify(result.checks.at(-1)));
};
const watch = (p) =>
  p.on('pageerror', (e) => {
    result.pageErrors[
      /chrome-extension:|chatgpt-butter|\/bookmarks\/|\/selection\/|\/branch\//.test(e.stack || '')
        ? 'butter'
        : 'other'
    ]++;
  });
context.pages().forEach(watch);
context.on('page', watch);
const worker =
  context.serviceWorkers().find((worker) => worker.url().endsWith('/storage/layout-worker.js')) ||
  (await context.waitForEvent('serviceworker', {
    predicate: (worker) => worker.url().endsWith('/storage/layout-worker.js'),
  }));
const count = () =>
  worker.evaluate(async () => {
    // A brand-new task copy may not have opened its database yet. Do not create it here.
    if (!(await indexedDB.databases()).some((db) => db.name === 'butter-layouts-v1')) return 0;
    const db = await new Promise((ok, no) => {
      const r = indexedDB.open('butter-layouts-v1');
      r.onsuccess = () => ok(r.result);
      r.onerror = no;
    });
    try {
      return await new Promise((ok, no) => {
        const r = db.transaction('bookmarks').objectStore('bookmarks').count();
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
    } finally {
      db.close();
    }
  });
const page =
  context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) ||
  (await context.newPage());
const notice = 'chatgpt-butter-bookmark-notice';
async function selectReply() {
  await page.evaluate(() => {
    const replies = [
      ...document.querySelectorAll('[data-markdown-text-style="assistant-message"]'),
    ];
    for (const reply of replies.slice().reverse()) {
      const w = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode()); ) {
        if (
          n.textContent.trim().length < 60 ||
          n.parentElement.closest('code,pre,math,.katex,button,a')
        )
          continue;
        n.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' });
        window.__live77Text = n;
        return;
      }
    }
  });
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => {
    const n = window.__live77Text;
    const r = document.createRange();
    const s = n.textContent.search(/\S/);
    r.setStart(n, s);
    r.setEnd(n, s + 35);
    const b = r.getClientRects()[0];
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  });
  await page.mouse.move(b.x + 1, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.locator('chatgpt-butter-pill button[data-cell="bookmark"]').waitFor({ timeout: 5000 });
}
// This read-only freshness guard must pass before the main try can write or clear anything.
let baseline;
try {
  baseline = await count();
  assert.equal(baseline, 0, 'fresh task install');
} catch (e) {
  await browser.close();
  throw e;
}
try {
  await worker.evaluate(() =>
    chrome.storage.local.set({ butter: { enabled: true, lang: 'en', layoutConsent: 'declined' } }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded' });
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 45000 });
  await page.waitForTimeout(3000);
  await selectReply();
  const geometry = await page.evaluate(() => {
    const pill = document.querySelector('chatgpt-butter-pill').shadowRoot.querySelector('.pill');
    const ask = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Ask ChatGPT',
    );
    let box = ask;
    for (let el = ask, i = 0; el && i < 3; el = el.parentElement, i++)
      if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        box = el;
        break;
      }
    const p = pill.getBoundingClientRect(),
      a = box.getBoundingClientRect();
    const s = getComputedStyle(pill),
      t = getComputedStyle(box);
    return {
      gap: p.left - a.right,
      topDelta: p.top - a.top,
      radiusMatches: s.borderRadius === t.borderRadius,
      backgroundMatches: s.backgroundColor === t.backgroundColor,
      shadowMatches: s.boxShadow === t.boxShadow,
    };
  });
  check(
    'pill beside real Ask ChatGPT',
    geometry.gap === 4 &&
      geometry.topDelta === 0 &&
      geometry.radiusMatches &&
      geometry.backgroundMatches &&
      geometry.shadowMatches,
    geometry,
  );
  await page.locator('chatgpt-butter-pill button[data-cell="bookmark"]').click();
  await page.locator(`${notice} .saved`).waitFor({ timeout: 5000 });
  const pos = await page.locator(`${notice} .card`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, right: innerWidth - r.right };
  });
  check(
    'Bookmark cell saves and shows top-right card',
    (await count()) === baseline + 1 &&
      pos.top >= 0 &&
      pos.top < 100 &&
      pos.right >= 0 &&
      pos.right < 100,
    { stored: await count(), ...pos },
  );
  await page.locator(`${notice} button[data-notice="undo"]`).click();
  await page.waitForTimeout(700);
  check('Undo saved card deletes bookmark', (await count()) === baseline, {
    stored: await count(),
  });
  await selectReply();
  await page.locator('chatgpt-butter-pill button[data-cell="bookmark"]').click();
  await page.locator(`${notice} .saved`).waitFor();
  const got = page.locator(`${notice} button[data-notice="ok"]`);
  if (await got.count()) await got.click();
  await page.waitForTimeout(700);
  const qi = await page
    .locator('chatgpt-butter-nav .bdot:not(.gone)')
    .first()
    .getAttribute('data-q');
  const mark =
    Number(qi) < 0
      ? page.locator('chatgpt-butter-nav .more')
      : page.locator('chatgpt-butter-nav .tick').nth(Number(qi));
  await mark.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  await page.locator('chatgpt-butter-nav .x').first().click();
  await page.locator(`${notice} .removed`).waitFor();
  check('rail x removes and shows removed card', (await count()) === baseline, {
    stored: await count(),
  });
  await page.locator(`${notice} button[data-notice="undo"]`).click();
  await page.waitForTimeout(700);
  check('Undo removed card restores bookmark', (await count()) === baseline + 1, {
    stored: await count(),
  });
  // Re-query after scrolling: ChatGPT replaces virtualized turn nodes.
  await page.evaluate(() => {
    getSelection().removeAllRanges();
    const q = [...document.querySelectorAll('[data-user-message-bubble]')]
      .reverse()
      .find((q) => q.textContent.trim().length > 1 && q.getBoundingClientRect().height > 0);
    window.__live77UserTurn = q?.closest('[data-turn-key]')?.getAttribute('data-turn-key');
    const target =
      q && [q, ...q.querySelectorAll('*')].find((el) => el.getBoundingClientRect().height > 0);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  let q = null;
  for (let attempt = 0; attempt < 4 && !q; attempt++) {
    await page.waitForTimeout(800);
    q = await page.evaluate(() => {
      const id = window.__live77UserTurn;
      const bubble =
        id &&
        [
          ...document.querySelectorAll(
            `[data-turn-key="${CSS.escape(id)}"] [data-user-message-bubble]`,
          ),
        ].find((b) => b.getBoundingClientRect().height > 0);
      if (!bubble) return null;
      const walk = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (n.textContent.trim().length < 2) continue;
        const r = document.createRange();
        r.setStart(n, 0);
        r.setEnd(n, Math.min(20, n.length));
        const b = [...r.getClientRects()].find(
          (b) => b.width > 4 && b.height > 0 && b.top > 64 && b.bottom < innerHeight - 100,
        );
        if (b) return { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      const target = [bubble, ...bubble.querySelectorAll('*')].find(
        (el) => el.getBoundingClientRect().height > 0,
      );
      target?.scrollIntoView({ block: 'center', behavior: 'instant' });
      return null;
    });
  }
  assert.ok(q, 'a user question is available for a real drag');
  await page.mouse.move(q.x + 1, q.y + q.height / 2);
  await page.mouse.down();
  await page.mouse.move(q.x + q.width - 1, q.y + q.height / 2, { steps: 10 });
  await page.mouse.up();
  const nativeAsk = page.getByRole('button', { name: 'Ask ChatGPT', exact: true });
  await nativeAsk.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  // Give the pill its normal render window after the native control appears.
  await page.waitForTimeout(700);
  const nativeAskVisible = await nativeAsk.isVisible();
  const selected = await page.evaluate(() => {
    const selection = getSelection();
    return {
      characters: selection.toString().length,
      inUserQuestion: !!selection.anchorNode?.parentElement?.closest(
        '[data-user-message-bubble], [data-message-author-role="user"], [data-markdown-text-style="user-message"]',
      ),
    };
  });
  check(
    'pill absent for user question',
    nativeAskVisible &&
      selected.characters > 0 &&
      selected.inUserQuestion &&
      !(await page.locator('chatgpt-butter-pill .pill').isVisible()),
    { ...selected, nativeAskVisible },
  );
  check('no Butter page errors', result.pageErrors.butter === 0, result.pageErrors);
} catch (e) {
  result.failure = { kind: e.name };
  await fs.writeFile('/tmp/live-77-notice-error.txt', e.stack, { mode: 0o600 });
  console.log(`FAIL ${e.name}`);
  process.exitCode = 1;
} finally {
  // Reached only after ownership and freshness passed; never clear the lab's normal data.
  try {
    await worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        await new Promise((ok, no) => {
          const tx = db.transaction('bookmarks', 'readwrite');
          tx.objectStore('bookmarks').clear();
          tx.oncomplete = ok;
          tx.onerror = no;
        });
      } finally {
        db.close();
      }
    });
  } catch (e) {
    result.cleanupFailure = { kind: e.name };
    console.log(`FAIL cleanup ${e.name}`);
    process.exitCode = 1;
  } finally {
    try {
      await fs.mkdir(out, { recursive: true });
      await fs.writeFile(
        path.join(out, 'selection-notice.json'),
        JSON.stringify(result, null, 2) + '\n',
      );
    } finally {
      await browser.close();
    }
  }
}
if (result.checks.some((c) => !c.pass)) process.exitCode = 1;
