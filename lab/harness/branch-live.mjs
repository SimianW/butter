// Ask in branch, live lab check. Needs the real ChatGPT page for what the fixture can't show:
// the native "Branch in new chat" path, identity verification on real routes, the send being
// attempted only in the verified branch, and the original tab staying unchanged.
//
// Safety: the lab's send guard stays on (non-GET requests to chatgpt.com are aborted). The only
// exception is BRANCH_PATH (default: none), the native branch request, when it exists. No message
// can go out: the send request is aborted by the guard and recorded as "attempted".
//
// Run with the lab lock held, the browser restarted with a snap-readable copy of extension/:
//   LAB_ID=1 LAB_OWNER=<owner> [BRANCH_PATH=<regex>] node lab/harness/branch-live.mjs
// Output: notes/runs/2026-11-07-ask-in-branch-27/{live.json,live-screenshots/} (redacted).
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { butterDriver } from './driver/butter.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-27');
const shots = path.join(out, 'live-screenshots');
await fs.mkdir(shots, { recursive: true });
const lab = L.getLab(process.env.LAB_ID || 1);
const owner = process.env.LAB_OWNER;
const lock = await fs.readFile(path.join(lab.lockPath, 'owner'), 'utf8').catch(() => '');
assert.equal(lock.split('\n')[0], owner, 'Take the lab lock first (LAB_OWNER = lock owner).');
const BRANCH_PATH = process.env.BRANCH_PATH ? new RegExp(process.env.BRANCH_PATH) : null;
// The send pipeline: ChatGPT's first request after a send click is f/conversation/prepare.
const SEND_PATH = /^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$|^\/backend-api\/sentinel\//;
const QUESTION = 'Explain this passage briefly.';

for (let i = 0; i < 60 && !(await L.cdpVersion(lab)); i++)
  await new Promise((resolve) => setTimeout(resolve, 500));
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
if (BRANCH_PATH)
  await context.route('**/*', (route) => {
    const r = route.request(),
      u = new URL(r.url());
    // Registered after the guard, so it runs first: only this one native request goes through.
    if (r.method() === 'POST' && u.hostname === 'chatgpt.com' && BRANCH_PATH.test(u.pathname))
      return route.continue();
    return route.fallback();
  });

// Every non-GET request, per tab, with whether the guard stopped it. Paths only, no ids.
const requests = [];
const redactPath = (p) =>
  p.startsWith('/cdn-cgi/')
    ? '/cdn-cgi/<challenge>'
    : p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>').replace(/local-chatgpt(%3A|:)<id>/gi, '<local>');
const pageErrors = { butter: 0, other: 0 };
const tag = new Map(),
  started = new WeakMap();
const watch = (page, name) => {
  tag.set(page, name);
  page.on('pageerror', (e) => {
    pageErrors[/chrome-extension:|chatgpt-butter/.test(e.stack || '') ? 'butter' : 'other']++;
  });
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
// The selection pill (selection/pill.js) through the shared Butter driver: Ask in branch's cell,
// and a selection made with a real mouse drag. `run.button` reads the pill's box beside ChatGPT's
// own "Ask ChatGPT" box here: on the live page that box has no CSS of its own (it is found by its
// text and its background), and its look is recorded as one string, its height included.
const PILL = 'chatgpt-butter-pill';
const butter = (page) => butterDriver({ page });
const results = { at: new Date().toISOString(), lab: lab.id, pageErrors, runs: [] };
const shot = async (page, file, masks = []) => {
  await page.evaluate(() => {
    // Mark ChatGPT's own selection button so it stays visible; hide every other page content.
    for (const b of document.querySelectorAll('button'))
      if (b.textContent.trim() === 'Ask ChatGPT')
        b.closest('.fixed, [class*="fixed"]')?.setAttribute('data-butter-capture', '');
  });
  await page.screenshot({
    path: path.join(shots, file),
    animations: 'disabled',
    mask: masks.map((m) => page.locator(m)),
    maskColor: '#888',
    style: `body * { visibility: hidden !important; }
      [data-butter-capture], [data-butter-capture] *,
      chatgpt-butter-pill, chatgpt-butter-pill *,
      chatgpt-butter-branch, chatgpt-butter-branch * { visibility: visible !important; }
      chatgpt-butter-consent, chatgpt-butter-nav { display: none !important; }`,
  });
  return file;
};

const pickText = (page, { latest }) =>
  page.evaluate((latest) => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    const pool = latest ? replies.slice(-1) : replies.slice(0, -1).reverse();
    for (const reply of pool) {
      const walk = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (n.textContent.trim().length < 40) continue;
        if (n.parentElement.closest('.katex, math, code, pre, button, svg, a')) continue;
        n.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' });
        window.__butterQaPick = n; // dragSelect uses this same passage
        return { ok: true };
      }
    }
    return { ok: false };
  }, latest);
const dragSelect = async (page) => {
  // A real mouse drag, so ChatGPT shows its own "Ask ChatGPT" button as for a user.
  const box = await page.evaluate(() => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    const picked = window.__butterQaPick?.isConnected ? [window.__butterQaPick] : [];
    const nodes = [...picked];
    for (const reply of replies.slice(0, -1).reverse()) {
      const walk = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) nodes.push(n);
    }
    {
      for (const n of nodes) {
        if (n.textContent.trim().length < 40) continue;
        if (n.parentElement.closest('.katex, math, code, pre, button, svg, a')) continue;
        const s = n.textContent.search(/\S/);
        const r = document.createRange();
        r.setStart(n, s);
        r.setEnd(n, s + 30);
        const rect = r.getClientRects()[0];
        if (!rect || rect.top < 80 || rect.bottom > innerHeight - 200) continue;
        return { x1: rect.left + 1, x2: rect.right - 1, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  });
  assert.ok(box, 'a plain-text passage in an earlier reply is on screen');
  await butter(page).dragAcross(box);
};
const pageState = (page) =>
  page.evaluate(() => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const editor = [...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].find(vis);
    const scroller = [...document.querySelectorAll('.thread-scroll-container')].find(vis);
    return {
      url: location.href,
      draft: editor?.innerText.trim() ?? null,
      scroll: scroller ? Math.round(scroller.scrollTop) : null,
    };
  });
// Content fingerprints (lengths and a hash), so the report can say "same latest reply" without
// keeping any chat text.
const fingerprint = (page) =>
  page.evaluate(async () => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    const text = replies.at(-1)?.innerText || '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return {
      replies: replies.length,
      latestHash: [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join(''),
    };
  });
const identityKind = (url, original) => {
  const m = /\/c\/([^/?#]+)/.exec(new URL(url).pathname);
  const id = m ? decodeURIComponent(m[1]).toLowerCase() : null;
  return {
    kind: !id ? 'none' : id.startsWith('local-chatgpt:') ? 'local' : 'saved',
    sameAsOriginal: id === original,
  };
};

const drift = [];
try {
  const page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) || (await context.newPage());
  watch(page, 'original');
  await page.bringToFront();
  const fixtureUrl = L.fixture(lab, 'math12');
  for (const width of [1280, 800]) {
    const run = { width, screenshots: [] };
    await page.setViewportSize({ width, height: 800 });
    await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.ProseMirror[contenteditable="true"]:visible').waitFor({ timeout: 45000 });
    await page.waitForTimeout(2500);
    const original = decodeURIComponent(/\/c\/([^/?#]+)/.exec(new URL(page.url()).pathname)[1]).toLowerCase();
    await pickText(page, { latest: false });
    // ChatGPT keeps adjusting the scroll position for a while after loading a chat; start only
    // once it has stayed put for 1.5 s, so a late adjustment isn't counted as Butter's.
    for (let last = null, same = 0, i = 0; same < 6 && i < 80; i++) {
      const now = (await pageState(page)).scroll;
      same = now === last ? same + 1 : 0;
      last = now;
      await page.waitForTimeout(250);
    }
    const before = await pageState(page);
    const originalPrint = await fingerprint(page);
    // Original tab's scroll position at each step, to tell Butter's effect from ChatGPT's own.
    const timeline = [];
    const mark = async (step) => timeline.push([step, (await pageState(page)).scroll]);
    await mark('before');
    await dragSelect(page);
    await mark('selected');
    await butter(page).cell('branch').waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    run.button = await page.evaluate((host) => {
      // The pill draws the look; Ask in branch is its first cell.
      const chip = document.querySelector(host).shadowRoot.querySelector('.pill');
      const ask = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ask ChatGPT');
      let box = ask;
      for (let el = ask, i = 0; el && i < 3; el = el.parentElement, i++)
        if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') {
          box = el;
          break;
        }
      const a = box.getBoundingClientRect(),
        c = chip.getBoundingClientRect();
      const css = (el) => {
        const s = getComputedStyle(el);
        return [s.height, s.borderTopLeftRadius, s.backgroundColor, s.boxShadow].join(' | ');
      };
      return {
        gap: Math.round((c.left - a.right) * 10) / 10,
        topDelta: Math.round((c.top - a.top) * 10) / 10,
        native: css(box),
        butter: css(chip),
      };
    }, PILL);
    await mark('button shown');
    run.screenshots.push(await shot(page, `button-${width}.png`));
    await butter(page).cell('branch').click();
    await mark('box open');
    await page.locator(`${HOST} textarea`).fill(QUESTION);
    await page.waitForTimeout(200);
    await mark('typed');
    run.screenshots.push(await shot(page, `question-${width}.png`, [`${HOST} .q span`]));
    const opened = context.waitForEvent('page');
    const sentAt = Date.now();
    await page.locator(`${HOST} textarea`).press('Enter');
    const dest = await opened;
    await mark('enter');
    watch(dest, 'branch');
    // Record every click on ChatGPT's send button in this tab, with the route at that moment.
    await dest.evaluate((original) => {
      window.__butterQaSends = [];
      document.addEventListener(
        'click',
        (e) => {
          const b = e.target.closest?.('[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send"]');
          if (!b) return;
          const m = /\/c\/([^/?#]+)/.exec(location.pathname);
          const id = m ? decodeURIComponent(m[1]).toLowerCase() : null;
          window.__butterQaSends.push({ at: Date.now(), inBranch: !!id && id !== original, trusted: e.isTrusted });
        },
        true,
      );
    }, original);
    await dest.setViewportSize({ width, height: 800 });
    await dest.locator(`${HOST} .card`).waitFor({ timeout: 20000 });
    await dest.waitForTimeout(400);
    run.titleWhileWorking = await dest.title();
    run.screenshots.push(await shot(dest, `working-${width}.png`));
    // End: the ready line, the unsure line, or the failure card.
    const end = await Promise.race([
      dest.locator(`${HOST} .line.ready`).waitFor({ timeout: 60000 }).then(() => 'ready'),
      dest.locator(`${HOST} .line.unsure`).waitFor({ timeout: 60000 }).then(() => 'unsure'),
      dest.locator(`${HOST} .card.err`).waitFor({ timeout: 60000 }).then(() => 'failed'),
    ]).catch(() => 'timeout');
    run.end = end;
    await dest.waitForTimeout(2500); // let the guarded send settle
    run.branch = { ...identityKind(dest.url(), original), ...(await fingerprint(dest)) };
    run.original = { latest: originalPrint };
    run.screenshots.push(
      await shot(dest, `ready-${width}.png`, [`${HOST} .line .t`, '.ProseMirror']),
    );
    await mark('end');
    run.originalScroll = timeline;
    const after = await pageState(page);
    run.originalUnchanged = JSON.stringify(after) === JSON.stringify(before);
    // Redacted comparison: which field changed, if any (no URLs or text kept).
    run.originalCompare = {
      sameUrl: after.url === before.url,
      draftLength: [before.draft?.length ?? null, after.draft?.length ?? null],
      scroll: [before.scroll, after.scroll],
    };
    run.sendClicks = await dest.evaluate(() =>
      (window.__butterQaSends || []).map((c) => ({ at: c.at, inBranch: c.inBranch })),
    );
    // Times relative to the Enter press in the original tab.
    run.requests = requests
      .filter((r) => r.at >= sentAt)
      .map(({ at, ...r }) => ({ ...r, ms: at - sentAt }));
    run.sendClicks = run.sendClicks.map(({ at, ...c }) => ({ ...c, ms: at - sentAt }));
    // What Butter's send click set off: non-GET requests in the branch tab after the click.
    const click = run.sendClicks[0]?.ms ?? Infinity;
    run.afterSendClick = run.requests.filter((r) => r.tab === 'branch' && r.ms >= click);
    run.originalSendRequests = run.requests.filter(
      (r) => r.tab === 'original' && SEND_PATH.test(r.path),
    );
    results.runs.push(run);
    console.log(JSON.stringify(run, null, 1));
    if (BRANCH_PATH) {
      assert.equal(run.end, 'ready', 'branch verified and sent');
      assert.equal(run.branch.sameAsOriginal, false, 'new identity');
      assert.equal(run.branch.latestHash, originalPrint.latestHash, 'branched from the latest reply');
      assert.equal(run.sendClicks.length, 1, 'one send click');
      assert.ok(run.sendClicks[0].inBranch, 'send clicked only in the branch');
      assert.ok(run.afterSendClick.length && run.afterSendClick.every((r) => r.blocked), 'send blocked by the guard');
    }
    assert.equal(run.originalSendRequests.length, 0, 'nothing sent from the original tab');
    // Checked after both widths, so one run's drift doesn't hide the other's result.
    if (!run.originalUnchanged) drift.push(width);
    // Discard the unsent branch: clear its composer, close the tab.
    for (const editor of await dest.locator('.ProseMirror[contenteditable="true"]:visible').all())
      await editor.fill('');
    await dest.close();
  }
  assert.deepEqual(drift, [], 'original tab unchanged');
} finally {
  await fs.writeFile(path.join(out, process.env.OUT_JSON || 'live.json'), JSON.stringify(results, null, 1) + '\n');
  await browser.close();
}
