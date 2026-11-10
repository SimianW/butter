// Ask in branch, live lab check for ticket #29: the streaming wait, hidden-button cases, and the
// same flow with ChatGPT in Simplified Chinese. Companion of branch-live.mjs (#27).
//
// Streaming: a real stream needs a real message, which the lab forbids, and a replay in the
// original tab never reaches a newly opened tab. So in the new tab only, ChatGPT's own streaming
// marker (data-talvt-turn-state="in_progress" on the latest turn, "complete" when done) is held on
// the latest turn for STREAM_MS, then set back to "complete". Everything else is the real page.
//
// Hidden-button cases on the real page: a Work-mode branch ("Branch into Work mode", unsaved),
// the unsaved branch the run itself made, and Temporary Chat's markers (it has no replies to
// select without sending). A saved Chat-mode conversation is the control.
//
// Safety: the lab's send guard stays on; only POST /backend-api/conversation/new_branch passes.
// Butter's send click in the verified branch is blocked by the guard and recorded.
//
// Run with the lab lock held and the browser restarted with a snap-readable copy of extension/:
//   LAB_ID=1 LAB_OWNER=<owner> [LANG_TAG=zh] node lab/harness/branch-live-edges.mjs
// Output: notes/runs/2026-11-07-ask-in-branch-29/{live-<lang>.json,live-screenshots/} (redacted).
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-29');
const shots = path.join(out, 'live-screenshots');
await fs.mkdir(shots, { recursive: true });
const lab = L.getLab(process.env.LAB_ID || 1);
const owner = process.env.LAB_OWNER;
const lock = await fs.readFile(path.join(lab.lockPath, 'owner'), 'utf8').catch(() => '');
assert.equal(lock.split('\n')[0], owner, 'Take the lab lock first (LAB_OWNER = lock owner).');
const LANG = process.env.LANG_TAG === 'zh' ? 'zh' : 'en';
const STREAM_MS = Number(process.env.STREAM_MS || 8000);
const BRANCH_PATH = /^\/backend-api\/conversation\/new_branch$/;
const SEND_PATH = /^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$|^\/backend-api\/sentinel\//;
const ASK = /^(Ask ChatGPT|向 ChatGPT 提问)$/;
const SIDE = /^(Ask in side chat|在侧边聊天中提问)$/;
const WORK_LEAF = /^(Branch into Work mode|在工作模式中创建分支)$/;
// Butter's own UI language is Butter's setting (default English), independent of ChatGPT's.
const WAITING = ['Waiting for the reply to finish…', '正在等待回复完成…'];
const QUESTION = 'Explain this passage briefly.';

const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
await context.route('**/*', (route) => {
  const r = route.request(),
    u = new URL(r.url());
  // Registered after the guard, so it runs first: only the native branch request goes through.
  if (r.method() === 'POST' && u.hostname === 'chatgpt.com' && BRANCH_PATH.test(u.pathname))
    return route.continue();
  return route.fallback();
});
// The simulated stream, installed in Butter's new tab as soon as it shows the conversation (an
// init script would only reach the popup's initial about:blank, whose window ChatGPT's page
// reuses). If ChatGPT renders the turns first, Butter sees the stream start just after load, the
// case its settle window exists for.
const holdStream = (ms) => {
  const log = (window.__aib29Stream = { start: null, end: null, held: 0 });
  const latest = () => [...document.querySelectorAll('[data-talvt-turn-state]')].at(-1);
  const hold = () => {
    const turn = latest();
    if (!turn || log.end) return;
    log.start ??= Date.now();
    if (Date.now() - log.start >= ms) {
      observer.disconnect();
      for (const t of document.querySelectorAll('[data-aib29-held]')) {
        t.setAttribute('data-talvt-turn-state', 'complete');
        t.removeAttribute('data-aib29-held');
      }
      log.end = Date.now();
      return;
    }
    if (turn.getAttribute('data-talvt-turn-state') !== 'in_progress') {
      turn.setAttribute('data-talvt-turn-state', 'in_progress');
      turn.setAttribute('data-aib29-held', '');
      log.held++;
    }
  };
  const observer = new MutationObserver(hold);
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-talvt-turn-state'] });
  const timer = setInterval(() => {
    hold();
    if (log.end) clearInterval(timer);
  }, 200);
  hold();
};

// Non-GET requests per tab, paths only (ids redacted).
const requests = [];
const redactPath = (p) =>
  p.startsWith('/cdn-cgi/')
    ? '/cdn-cgi/<challenge>'
    : p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>').replace(/local-chatgpt(%3A|:)<id>/gi, '<local>');
const tag = new Map(),
  started = new WeakMap();
const watch = (page, name) => {
  tag.set(page, name);
  const log = (r, failed) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(r.method())) return;
    const u = new URL(r.url());
    if (u.hostname !== 'chatgpt.com') return;
    requests.push({
      tab: tag.get(page),
      method: r.method(),
      path: redactPath(u.pathname),
      blocked: failed ? r.failure()?.errorText || 'failed' : null,
      at: started.get(r) ?? Date.now(),
    });
  };
  page.on('request', (r) => started.set(r, Date.now()));
  page.on('requestfinished', (r) => log(r, false));
  page.on('requestfailed', (r) => log(r, true));
};

const HOST = 'chatgpt-butter-branch';
// Ask in branch's icon cell in the shared selection pill (selection/pill.js).
const CELL = 'chatgpt-butter-pill button[data-cell="branch"]';
// Screenshots show only Butter's UI and ChatGPT's selection toolbar; all page content is hidden.
const shot = async (page, file, masks = []) => {
  await page.evaluate((ask) => {
    for (const b of document.querySelectorAll('button'))
      if (new RegExp(ask).test(b.textContent.trim()))
        b.closest('.fixed, [class*="fixed"]')?.setAttribute('data-butter-capture', '');
  }, ASK.source);
  await page.screenshot({
    path: path.join(shots, file),
    animations: 'disabled',
    mask: masks.map((m) => page.locator(m)),
    maskColor: '#888',
    style: `body * { visibility: hidden !important; }
      [data-butter-capture], [data-butter-capture] * { visibility: visible !important; }
      chatgpt-butter-consent, chatgpt-butter-nav { display: none !important; }`,
  });
  return file;
};
const visibleFn = `const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;`;
// A real mouse drag over a plain-text passage of an earlier reply (or the latest, if alone).
const dragSelect = async (page) => {
  const box = await page.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    for (const reply of [...replies.slice(0, -1).reverse(), ...replies.slice(-1)]) {
      const walk = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (n.textContent.trim().length < 40) continue;
        if (n.parentElement.closest('.katex, math, code, pre, button, svg, a')) continue;
        const s = n.textContent.search(/\S/);
        const r = document.createRange();
        r.setStart(n, s);
        r.setEnd(n, s + 30);
        const rect = r.getClientRects()[0];
        if (!rect || rect.top < 80 || rect.bottom > innerHeight - 220) continue;
        return { x1: rect.left + 1, x2: rect.right - 1, y: rect.top + rect.height / 2 };
      }
    }
    // Nothing on screen: bring the second-to-last reply into view and try again.
    replies.at(-2)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    return null;
  }, visibleFn);
  if (!box) return false;
  await page.mouse.move(box.x1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y, { steps: 10 });
  await page.mouse.up();
  return true;
};
const selectText = async (page) => {
  for (let i = 0; i < 3; i++) {
    if (await dragSelect(page)) return;
    await page.waitForTimeout(500);
  }
  throw new Error('no plain-text passage on screen');
};
// What Butter's rules read on this page (the same signals page.js uses), redacted.
const evidence = (page) =>
  page.evaluate(
    ({ src, ask, side }) => {
      const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
      const editor = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].find(vis);
      const form = editor?.closest('form');
      const askBtn = [...document.querySelectorAll('button')].find((b) => vis(b) && new RegExp(ask).test(b.textContent.trim()));
      const toolbar = askBtn?.closest('.fixed, [class*="fixed"]');
      const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
      const turnOf = (r) => r.closest('[data-turn-key], [data-content-search-turn-key], article');
      const more = replies.filter((r) =>
        [...(turnOf(r) || r.parentElement).querySelectorAll('button')].some(
          (b) => vis(b) && [...b.querySelectorAll('use')].some((u) => (u.getAttribute('href') || '').includes('icon-ellipsis-horizontal')),
        ),
      ).length;
      const m = /\/c\/([^/?#]+)/.exec(location.pathname);
      const id = m ? decodeURIComponent(m[1]) : null;
      return {
        route: !id ? 'none' : id.startsWith('local-chatgpt:') ? 'unsaved local branch' : 'saved',
        temporaryParam: new URLSearchParams(location.search).get('temporary-chat'),
        composerForm: form
          ? {
              'data-composer-placement': form.getAttribute('data-composer-placement'),
              'data-chatgpt-composer': form.hasAttribute('data-chatgpt-composer'),
            }
          : null,
        composerLabel: editor?.getAttribute('aria-label') ?? null,
        selectionToolbar: toolbar
          ? [...toolbar.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim().slice(0, 30))
          : [],
        sideChat: !!toolbar && [...toolbar.querySelectorAll('button')].some((b) => new RegExp(side).test(b.textContent.trim())),
        replies: replies.length,
        repliesWithMoreActions: more,
        butterButton: (() => {
          const pill = document.querySelector('chatgpt-butter-pill')?.shadowRoot?.querySelector('.pill');
          return !!pill?.querySelector('[data-cell="branch"]') && getComputedStyle(pill).display !== 'none';
        })(),
      };
    },
    { src: visibleFn, ask: ASK.source, side: SIDE.source },
  );
const butterChip = async (page, timeout) =>
  page
    .locator(CELL)
    .waitFor({ timeout })
    .then(() => true, () => false);
const pageState = (page) =>
  page.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const editor = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].find(vis);
    const scroller = [...document.querySelectorAll('.thread-scroll-container')].find(vis);
    return { url: location.href, draft: editor?.innerText.trim() ?? null, scroll: scroller ? Math.round(scroller.scrollTop) : null };
  }, visibleFn);
const fingerprint = (page) =>
  page.evaluate(async (src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(replies.at(-1)?.innerText || ''));
    return [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
  }, visibleFn);
const settleScroll = async (page) => {
  for (let last = null, same = 0, i = 0; same < 6 && i < 80; i++) {
    const now = (await pageState(page)).scroll;
    same = now === last ? same + 1 : 0;
    last = now;
    await page.waitForTimeout(250);
  }
};
const openFixture = async (page) => {
  await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded' });
  await page.locator('.ProseMirror[contenteditable="true"]:visible').waitFor({ timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    replies.at(-2)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, visibleFn);
  await settleScroll(page);
};

const results = { at: new Date().toISOString(), lab: lab.id, lang: LANG, streamMs: STREAM_MS };
const sfx = LANG === 'zh' ? '-zh' : '';
try {
  const page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) || (await context.newPage());
  watch(page, 'original');
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFixture(page);
  const original = decodeURIComponent(/\/c\/([^/?#]+)/.exec(new URL(page.url()).pathname)[1]).toLowerCase();

  // ---- Control: a saved Chat-mode conversation. Butter's button is offered.
  await selectText(page);
  const shown = await butterChip(page, 5000);
  results.control = { ...(await evidence(page)), butterButton: shown };
  assert.ok(shown, 'button offered in a saved Chat-mode conversation');

  // ---- Streaming wait: ask; the new tab waits while the latest reply "streams", then branches.
  const before = await pageState(page);
  const latestPrint = await fingerprint(page);
  await page.waitForTimeout(300);
  await page.locator(CELL).click();
  await page.locator(`${HOST} textarea`).fill(QUESTION);
  const opened = context.waitForEvent('page');
  const enterAt = Date.now();
  await page.locator(`${HOST} textarea`).press('Enter');
  const dest = await opened;
  watch(dest, 'branch');
  await dest.waitForURL(/^https:\/\/chatgpt\.com\/.+\/c\//, { waitUntil: 'commit' });
  await dest.waitForFunction(() => !!document.body);
  const holdAt = Date.now();
  await dest.evaluate(holdStream, STREAM_MS);
  await dest.evaluate((original) => {
    window.__aib29Sends = [];
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target.closest?.('form button[type="submit"], [data-testid="send-button"], button[aria-label="Send"], button[aria-label="发送"]');
        if (!b) return;
        const m = /\/c\/([^/?#]+)/.exec(location.pathname);
        const id = m ? decodeURIComponent(m[1]).toLowerCase() : null;
        window.__aib29Sends.push({ at: Date.now(), inBranch: !!id && id !== original });
      },
      true,
    );
  }, original);
  await dest.setViewportSize({ width: 1280, height: 800 });
  const heading = dest.locator(`${HOST} .card h3`);
  await heading.waitFor({ timeout: 20000 });
  if (process.env.DIAG)
    for (let i = 0; i < 12; i++) {
      console.log(
        JSON.stringify(
          await dest.evaluate((host) => ({
            h: document.querySelector(host)?.shadowRoot?.querySelector('.card h3')?.textContent,
            s: window.__aib29Stream ?? 'not installed',
            states: [...document.querySelectorAll('[data-talvt-turn-state]')].map((t) => t.getAttribute('data-talvt-turn-state')).slice(-3),
            local: location.pathname.includes('local-chatgpt'),
          }), HOST),
        ),
      );
      await dest.waitForTimeout(1000);
    }
  await dest.waitForFunction(
    ({ host, texts }) => texts.includes(document.querySelector(host)?.shadowRoot?.querySelector('.card h3')?.textContent.trim()),
    { host: HOST, texts: WAITING },
    { timeout: 20000 },
  );
  const stream = { waitingShown: true, titleWhileWaiting: await dest.title() };
  await dest.waitForTimeout(500);
  stream.screenshot = await shot(dest, `waiting-1280${sfx}.png`);
  // Branch only after the stream ends.
  await dest.waitForFunction(() => window.__aib29Stream?.end, null, { timeout: STREAM_MS + 30000 });
  const end = await Promise.race([
    dest.locator(`${HOST} .line.ready`).waitFor({ timeout: 60000 }).then(() => 'ready'),
    dest.locator(`${HOST} .line.unsure`).waitFor({ timeout: 60000 }).then(() => 'unsure'),
    dest.locator(`${HOST} .card.err`).waitFor({ timeout: 60000 }).then(() => 'failed'),
  ]).catch(() => 'timeout');
  await dest.waitForTimeout(2500); // let the guarded send settle
  const log = await dest.evaluate(() => window.__aib29Stream);
  const branchReq = requests.find((r) => r.tab === 'branch' && BRANCH_PATH.test(r.path));
  const sends = await dest.evaluate(() => window.__aib29Sends);
  stream.end = end;
  stream.streamHeldMs = log.end - log.start;
  stream.holdInstalledMs = holdAt - enterAt;
  stream.markerReapplied = log.held;
  stream.branchRequestAfterStreamEndMs = branchReq ? branchReq.at - log.end : null;
  stream.branch = {
    route: /local-chatgpt/.test(dest.url()) ? 'unsaved local branch' : 'other',
    sameAsOriginal: dest.url().toLowerCase().includes(original),
    sameLatestReply: (await fingerprint(dest)) === latestPrint,
  };
  stream.sendClicks = sends.map((c) => ({ inBranch: c.inBranch, ms: c.at - enterAt }));
  stream.requests = requests.filter((r) => r.at >= enterAt).map(({ at, ...r }) => ({ ...r, ms: at - enterAt }));
  const click = stream.sendClicks[0]?.ms ?? Infinity;
  stream.afterSendClick = stream.requests.filter((r) => r.tab === 'branch' && r.ms >= click);
  stream.originalSendRequests = stream.requests.filter((r) => r.tab === 'original' && SEND_PATH.test(r.path));
  stream.screenshotReady = await shot(dest, `ready-after-wait-1280${sfx}.png`, [`${HOST} .line .t`, '.ProseMirror']);
  const after = await pageState(page);
  stream.originalUnchanged = JSON.stringify(after) === JSON.stringify(before);
  results.stream = stream;
  console.log(JSON.stringify({ stream }, null, 1));
  assert.ok(WAITING.includes(stream.titleWhileWaiting), 'tab title while waiting');
  assert.ok(stream.branchRequestAfterStreamEndMs >= 0, 'branched only after the reply finished');
  assert.equal(end, 'ready', 'branch verified and sent');
  assert.equal(stream.branch.sameAsOriginal, false);
  assert.ok(stream.branch.sameLatestReply, 'branched from the latest reply');
  assert.equal(stream.sendClicks.length, 1);
  assert.ok(stream.sendClicks[0].inBranch, 'send clicked only in the branch');
  assert.ok(stream.afterSendClick.length && stream.afterSendClick.every((r) => r.blocked), 'send blocked by the guard');
  assert.equal(stream.originalSendRequests.length, 0, 'nothing sent from the original tab');
  assert.ok(stream.originalUnchanged, 'original tab unchanged');

  // ---- Hidden: the unsaved branch the run just made (ChatGPT's button shows; Butter's doesn't).
  await dest.evaluate(() => getSelection().removeAllRanges());
  await selectText(dest);
  await dest.waitForTimeout(1500);
  results.unsavedBranch = await evidence(dest);
  results.unsavedBranch.screenshot = await shot(dest, `hidden-unsaved-1280${sfx}.png`, [`${HOST} .line .t`]);
  assert.ok(results.unsavedBranch.selectionToolbar.length, "ChatGPT's own button is shown");
  assert.equal(results.unsavedBranch.butterButton, false, 'no button in an unsaved branch');
  for (const editor of await dest.locator('.ProseMirror[contenteditable="true"]:visible').all())
    await editor.fill('');
  await dest.close();

  // ---- Hidden: Work mode. "Branch into Work mode" from the latest reply in a tab of our own.
  const work = await context.newPage();
  watch(work, 'work');
  await work.setViewportSize({ width: 1280, height: 800 });
  await openFixture(work);
  await work.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const box = [...document.querySelectorAll('.thread-scroll-container')].find(vis);
    if (box) box.scrollTop = box.scrollHeight;
  }, visibleFn);
  await work.waitForTimeout(1500);
  await work.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const last = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis).at(-1);
    const turn = last.closest('[data-turn-key], [data-content-search-turn-key], article');
    [...turn.querySelectorAll('button')]
      .find((b) => vis(b) && [...b.querySelectorAll('use')].some((u) => (u.getAttribute('href') || '').includes('icon-ellipsis-horizontal')))
      .setAttribute('data-aib29', 'more');
  }, visibleFn);
  const more = work.locator('[data-aib29=more]');
  await more.dispatchEvent('pointerdown', { button: 0, buttons: 1, pointerType: 'mouse' });
  await more.dispatchEvent('pointerup', { button: 0, pointerType: 'mouse' });
  await work.locator('[role=menuitem][aria-haspopup=menu]').filter({ has: work.locator('use[href*="icon-branch"]') }).click();
  await work.locator('[role=menuitem]').filter({ hasText: WORK_LEAF }).click();
  await work.waitForURL(/local-chatgpt/, { timeout: 20000 });
  await work.locator('.ProseMirror[contenteditable="true"]:visible').waitFor({ timeout: 20000 });
  await work.waitForTimeout(4000);
  await work.evaluate((src) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    replies.at(-2)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, visibleFn);
  await work.waitForTimeout(1000);
  await selectText(work);
  await work.waitForTimeout(1500);
  results.workBranch = await evidence(work);
  results.workBranch.screenshot = await shot(work, `hidden-work-1280${sfx}.png`);
  assert.ok(results.workBranch.sideChat, 'Work mode toolbar offers side chat');
  assert.equal(results.workBranch.butterButton, false, 'no button in Work mode');
  await work.close();

  // ---- Temporary Chat: the page and its markers (no replies to select without sending).
  const temp = await context.newPage();
  await temp.setViewportSize({ width: 1280, height: 800 });
  await temp.goto('https://chatgpt.com/?temporary-chat=true', { waitUntil: 'domcontentloaded' });
  await temp.locator('.ProseMirror[contenteditable="true"]:visible').waitFor({ timeout: 45000 });
  await temp.waitForTimeout(2500);
  results.temporary = {
    ...(await evidence(temp)),
    toggle: await temp.evaluate((src) => {
      const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
      return [...document.querySelectorAll('button')]
        .filter((b) => vis(b) && [...b.querySelectorAll('use')].some((u) => /chat-bubble.*dashed/.test(u.getAttribute('href') || '')))
        .map((b) => ({ label: b.getAttribute('aria-label'), icon: [...b.querySelectorAll('use')].map((u) => (u.getAttribute('href') || '').split('#')[1])[0] }));
    }, visibleFn),
  };
  await temp.close();

  // ---- Home page: Chat / Work switch (clicked back to Chat), composer form attributes.
  const home = await context.newPage();
  await home.setViewportSize({ width: 1280, height: 800 });
  await home.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  await home.locator('.ProseMirror[contenteditable="true"]:visible').waitFor({ timeout: 45000 });
  await home.waitForTimeout(2500);
  const modes = home.locator('button[aria-pressed]').filter({ hasText: /\S/ });
  results.home = { chat: await evidence(home) };
  await modes.last().click();
  await home.waitForTimeout(1500);
  results.home.work = await evidence(home);
  results.home.switch = await modes.evaluateAll((bs) => bs.map((b) => `${b.textContent.trim()}=${b.getAttribute('aria-pressed')}`));
  await modes.first().click();
  await home.waitForTimeout(1000);
  await home.close();
} finally {
  await fs.writeFile(path.join(out, `live-${LANG}.json`), JSON.stringify(results, null, 1) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ ...results, stream: undefined }, null, 1));
