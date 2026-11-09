// Bookmarks fixture QA (#52). The real MV3 extension in its own Chromium over a synthetic
// ChatGPT chat: every chatgpt.com request is answered locally (the page, /backend-api/me and the
// conversation's messages, which Butter's own fetch hook reads), and the run fails if anything
// else is requested. No ChatGPT requests.
// Checks: hover a paragraph, the button waits 120 ms, click it, the segment appears under the right
// question, clicking the segment lands on the paragraph, a reload shows the segment again, a
// bookmarked paragraph shows the filled button, the conversation's bookmarks are read once and not
// during scrolling, going to the home page and Back through history shows the segment again, and
// with the rail off or Butter paused neither the button nor a segment shows.
// A one-question chat (ONLY=one runs it alone): no rail, but the filled button and its remove work.
// The rail's hover card (#53): the single and list cards, moving onto the card, jumping from a row,
// deleting with × and the filled button, the segment fading out, keyboard-only jump and delete, and
// light and dark screenshots of both cards.
// Stale bookmarks (#55): regenerating a bookmarked answer in the fixture (in the page, then as the
// conversation's current version after a reload) and editing a bookmarked paragraph: the grey row
// with "answer changed", the pale segment only when every bookmark under the question is stale,
// the stale single card with its footer, the jump landing at the question's start, a bookmark
// turning live again when the original version is switched back, and light and dark screenshots
// of the stale cards (`card-stale-*`, `card-list-stale-*`; with BUTTER_BOOKMARKS_MOCKUP also the
// mockup's `mockup-card-stale-*` and `mockup-card-list-*` next to them).
// First-use notice (#56): the first save shows it, Undo deletes the bookmark and its segment and the
// next save shows it again (light and dark, English and Chinese, with layout consent pending,
// declined, granted and switched off), Got it keeps it away on a third save and after a reload.
// Earlier history (#51 addendum), run last: the chat opens with its latest 5 questions and loads
// earlier ones two per page, as ChatGPT does; a bookmark in that history sits on the rail's
// earlier-history dots, its card, the loading state, a click loading pages until its answer mounts
// and landing on the text, keyboard, Escape, reduced motion, and screenshots of each state in light
// and dark, English and Chinese, at 1400 and 600 px (ONLY=earlier runs this part alone;
// BUTTER_BOOKMARKS_EARLIER_MOCKUP=<2-Earlier-history-mockup.html> also shoots the mockup's panels).
// Selection and shortcut (#54): a selection's tooltip and the key Chrome reports, a selection saved
// with the button and with the shortcut (also across paragraphs), the top paragraph with the
// shortcut and nothing selected, nothing for a selection outside the answers, each landing on its
// text, and no key hint once the command's key is cleared in chrome://extensions/shortcuts.
// List items (#51): each item of the fixture answer's list is a paragraph of its own for the
// button, a selection, the shortcut's top paragraph, landing and staleness. The button's name holds
// the start of the paragraph or selection (#53); the store keeps `ask` and `line` (#55).
// The shortcut must be real keyboard input (chrome.commands ignores DevTools key events): with an X
// display the browser runs headed and xtest-keys.py presses the key, so run it under xvfb-run as
// below. Without a display the run asks the worker to relay the command instead and says so.
// Run: npm ci --prefix lab/harness && xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/bookmarks-qa.mjs
// The run covers both answer markups, each in its own browser: MARKUP=old has the earlier wrapper,
// [data-message-author-role="assistant"][data-message-id]; MARKUP=live renders answers as live chats
// do (notes/runs/2026-11-08-bookmarks-live), with no role or message id on any message and the
// answer's ancestor carrying data-chatgpt-selection-message-id and -conversation-id. MARKUP=old or
// MARKUP=live runs only that one.
// SHOTS=<dir> sets the screenshot directory (default /tmp/butter-bookmarks-qa); each markup writes
// to its own subdirectory.
// BUTTER_BOOKMARKS_MOCKUP=<1-Mockup.html> (gh issue artifact download 51 1 -R SimianW/butter) also
// compares the notice in each theme and language with the mockup's section 4: same size, under 0.1%
// of pixels differing by more than 24 in a channel.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKUPS = ['old', 'live'];
if (!process.env.MARKUP) {
  const failed = [];
  for (const markup of MARKUPS) {
    console.log(`== markup: ${markup}`);
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, MARKUP: markup } });
    } catch {
      failed.push(markup);
    }
  }
  console.log(failed.length ? `FAIL markup: ${failed.join(', ')}` : `markups passed: ${MARKUPS.join(', ')}`);
  process.exit(failed.length ? 1 : 0);
}
assert.ok(MARKUPS.includes(process.env.MARKUP), `MARKUP is one of ${MARKUPS.join(', ')}`);
const LIVE = process.env.MARKUP === 'live';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = path.join(process.env.SHOTS || '/tmp/butter-bookmarks-qa', process.env.MARKUP);
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-bookmarks-qa-'));

const CONV = '4b1f7c2a-9d3e-4f60-8a1b-2c3d4e5f6a7b';
const TURNS = 12;
const hex = (prefix, i) => `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;
const question = (i) => hex('7a10c3d2', i),
  answer = (i) => hex('3e5b9f81', i);
const QUESTION = (i) => `Fixture question ${i + 1} about query planning`;
// Long enough to wrap over four lines in the 720 px column: the excerpt keeps the first three.
const PARAGRAPH = (i, k) =>
  `Fixture answer ${i + 1} paragraph ${k + 1}: the planner compares the estimated cost of a sequential scan with an index scan, ` +
  'reads the table statistics gathered by ANALYZE, weighs the share of rows a predicate is expected to match, and picks ' +
  'whichever plan reads fewer pages overall, which is why a selective predicate on a well-analysed column usually ' +
  'gets the index while a broad one gets the scan, and why stale statistics after a bulk load mislead it.';
// Regenerated answers (#55): a new message id and other text. Edited ones keep the id, but their
// third paragraph (block 2) says something else.
const regen = (i) => hex('5c7d2e90', i);
const REGENERATED = (i, k) =>
  `Regenerated answer ${i + 1}, point ${k + 1}: a different explanation of when an index helps a query.`;
const EDITED = (i) => `Edited answer ${i + 1}: this paragraph now says something else entirely.`;
const blocks = (i) =>
  page$.regen.has(i)
    ? [0, 1, 2, 3].map((k) => `<p>${REGENERATED(i, k)}</p>`).join('')
    : [
    `<p>${PARAGRAPH(i, 0)}</p>`,
    `<h3>Fixture heading ${i + 1}</h3>`,
    ...[1, 2, 3, 4].map((k) => `<p${k === 2 ? ' class="narrow"' : ''}>${PARAGRAPH(i, k)}</p>`),
    `<ul><li>Fixture list item one</li><li>Fixture list item two</li></ul>`,
  ]
      .map((b, k) => (k === 2 && page$.edited.has(i) ? `<p>${EDITED(i)}</p>` : b))
      .join('');
const answerId = (i) => (page$.regen.has(i) ? regen(i) : answer(i));
const messages = (from = 0, to = TURNS) =>
  Array.from({ length: to - from }, (_, k) => k + from).map((i) => [
    { id: question(i), author: { role: 'user' }, content: { content_type: 'text', parts: [QUESTION(i)] } },
    { id: answerId(i), author: { role: 'assistant' }, content: { content_type: 'text', parts: ['answer'] } },
  ]).flat();
// `first`: the chat opens with questions first..TURNS-1 only, as ChatGPT opens a long chat; its
// earlier messages come two questions per page from /messages?before=<first> when the chat is
// scrolled near its top (#51 addendum). Each page is answered after `pageDelay` ms; `pages` counts them.
// `turns`: the chat holds only its first `turns` questions (1: a one-question chat, no rail).
const page$ = { theme: 'light', regen: new Set(), edited: new Set(), first: 0, turns: TURNS, pageDelay: 0, pages: 0 };
const PAGE_TURNS = 2;
// The answer's wrapper in each markup. `data-fx-answer` is the harness's own handle on it.
const answerAttrs = (id) =>
  LIVE
    ? `data-chatgpt-selection-conversation-id="${CONV}" data-chatgpt-selection-message-id="${id}" data-fx-answer="${id}"`
    : `data-message-author-role="assistant" data-message-id="${id}" data-fx-answer="${id}"`;
const userOf = (i) =>
  LIVE
    ? `<div data-user-message-bubble>${QUESTION(i)}</div>`
    : `<div data-message-author-role="user" data-message-id="${question(i)}"><div data-user-message-bubble>${QUESTION(i)}</div></div>`;
const turnHtml = (i) =>
  `<div><article data-turn-key="${question(i)}" data-testid="conversation-turn-${i + 1}"><div class="user">${userOf(i)}</div>` +
  `<div ${answerAttrs(answerId(i))}><div data-markdown-text-style="assistant-message" class="markdown prose">${blocks(i)}</div></div></article></div>`;
// ChatGPT's paging, in the page: opened at the bottom; within 230 px of the top it fetches the
// page before the first loaded question, then mounts its turns above and keeps the view in place.
const earlierScript = () => `
const fxTurns = ${JSON.stringify(Array.from({ length: page$.first }, (_, i) => turnHtml(i)))};
let fxFirst = ${page$.first}, fxLoading = false, fxArmed = true;
const sc = document.querySelector('.thread-scroll-container'), content = document.querySelector('.content');
sc.scrollTop = sc.scrollHeight;
sc.addEventListener('scroll', () => {
  if (sc.scrollTop > 250) fxArmed = true;
  if (!fxFirst || !fxArmed || fxLoading || sc.scrollTop > 230) return;
  fxLoading = true;
  fxArmed = false;
  fetch('/backend-api/conversation/${CONV}/messages?before=' + fxFirst).then((r) => r.json()).then(() => setTimeout(() => {
    const from = Math.max(0, fxFirst - ${PAGE_TURNS}), old = sc.scrollHeight;
    content.insertAdjacentHTML('afterbegin', fxTurns.slice(from, fxFirst).join(''));
    sc.scrollTop += sc.scrollHeight - old;
    fxFirst = from;
    fxLoading = false;
  }, 100));
});`;
const html = () => `<!doctype html><html lang="en" class="${page$.theme}"><head><meta charset="utf-8"><title>Fixture chat</title><style>
body { margin:0; overflow:hidden; font:16px/26px system-ui, sans-serif; background:#fff; color:#0d0d0d }
.dark body { background:#212121; color:#ececec }
header { position:fixed; top:0; left:0; right:0; height:52px; background:inherit; z-index:5; display:flex; align-items:center; padding:0 16px; font-weight:600 }
.thread-scroll-container { height:100vh; overflow-y:scroll; overflow-anchor:none }
.content { padding:64px 0 600px }
article { display:block; width:720px; margin:0 auto 24px }
.user { display:flex; justify-content:flex-end }
[data-user-message-bubble] { margin:14px 0; padding:8px 14px; background:#f4f4f4; border-radius:18px }
.dark [data-user-message-bubble] { background:#303030 }
[data-markdown-text-style] p, [data-markdown-text-style] ul { margin:0 0 16px }
/* Three lines of this one hold fewer than 240 characters: the line rule decides its excerpt. */
[data-markdown-text-style] p.narrow { max-width:300px }
</style></head><body><header>ChatGPT</header><div class="thread-scroll-container"><div class="content">${Array.from(
  { length: page$.turns - page$.first },
  (_, k) => turnHtml(k + page$.first),
).join('')}</div></div><script>
fetch('/backend-api/me');
fetch('/backend-api/conversation/${CONV}');
${page$.first ? earlierScript() : ''}
</script></body></html>`;

const headed = !!process.env.DISPLAY;
const context = await chromium.launchPersistentContext(profile, {
  headless: !headed,
  channel: 'chromium',
  viewport: { width: 1400, height: 900 },
  args: [
    `--disable-extensions-except=${repo}/extension`,
    `--load-extension=${repo}/extension`,
    '--window-position=0,0',
    // Grayscale text, as the notice's own compositing layer draws it, for the mockup comparison.
    '--disable-lcd-text',
  ],
});
const errors = [],
  foreign = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (['file:', 'data:', 'chrome-extension:'].includes(url.protocol)) return route.continue();
  if (url.hostname !== 'chatgpt.com') {
    foreign.push(url.href);
    return route.abort();
  }
  if (url.pathname === '/backend-api/me')
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'user-fixture' }) });
  if (url.pathname === `/backend-api/conversation/${CONV}`)
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ messages: messages(page$.first, page$.turns), page_info: { has_previous_page: page$.first > 0 } }),
    });
  if (url.pathname === `/backend-api/conversation/${CONV}/messages`) {
    const before = +url.searchParams.get('before'),
      from = Math.max(0, before - PAGE_TURNS);
    page$.pages++;
    return new Promise((r) => setTimeout(r, page$.pageDelay)).then(() =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ messages: messages(from, before), page_info: { has_previous_page: from > 0 } }),
      }),
    );
  }
  return route.fulfill({ contentType: 'text/html', body: html() });
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
const settings = (butter) =>
  worker.evaluate((butter) => chrome.storage.local.set({ butter }), {
    enabled: true,
    lang: 'en',
    layoutConsent: 'declined',
    ...butter,
  });
// Count the store's requests by type, in the worker.
await worker.evaluate(() => {
  globalThis.bookmarkRequests = {};
  chrome.runtime.onMessage.addListener((m) => {
    if (m?.type?.startsWith('butter-bookmark-'))
      bookmarkRequests[m.type] = (bookmarkRequests[m.type] || 0) + 1;
  });
});
const requests = () => worker.evaluate(() => ({ ...bookmarkRequests }));
const stored = () =>
  worker.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('bookmarks').objectStore('bookmarks').getAll();
          q.onsuccess = () => {
            r.result.close();
            resolve(q.result);
          };
        };
      }),
  );

// Put `rows` straight into the worker's store, as an earlier session would have left them; `clear`
// empties the store first.
const seedStore = (rows, { clear = false } = {}) =>
  worker.evaluate(
    async ([rows, clear]) => {
      const db = await database(),
        tx = db.transaction('bookmarks', 'readwrite'),
        st = tx.objectStore('bookmarks');
      if (clear) st.clear();
      for (const r of rows) st.put({ ...r, key: ButterBookmarks.key(r) });
      await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
    },
    [rows, clear],
  );
const sha = (s) => createHash('sha256').update(s).digest('hex');
const png = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
// Share of pixels that differ by more than 24 in any channel (as consent-qa.mjs measures it).
async function compare(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
      const data = (img) => {
        const c = new OffscreenCanvas(img.width, img.height),
          g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const p = data(x),
        q = data(y);
      let n = 0;
      for (let k = 0; k < p.length; k += 4)
        if (Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24) n++;
      return { ratio: n / (p.length / 4) };
    },
    [await png(a), await png(b)],
  );
}

const results = [];
const check = (name, pass, detail = {}) => {
  results.push({ name, pass: !!pass, ...detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${Object.keys(detail).length ? ' ' + JSON.stringify(detail) : ''}`);
};
let page;
async function open(theme = 'light') {
  page$.theme = theme;
  if (!page) page = await context.newPage();
  await page.goto(`https://chatgpt.com/c/${CONV}`);
  await page.waitForSelector('chatgpt-butter-nav[data-on]', { state: 'attached', timeout: 10000 });
  await page.waitForFunction(
    (n) => document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelectorAll('.tick').length === n,
    page$.turns - page$.first,
  );
  await page.waitForTimeout(400);
}
const rail = () =>
  page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, right: r.right };
    };
    return {
      ticks: [...root.querySelectorAll('.tick .bar')].map(center),
      marks: [...root.querySelectorAll('.mark')].map((el) => ({
        ...center(el),
        cls: el.className,
        color: getComputedStyle(el).backgroundColor,
      })),
      visible: getComputedStyle(document.querySelector('chatgpt-butter-nav')).display !== 'none',
    };
  });
const button = () =>
  page.evaluate(() => {
    const b = document.querySelector('chatgpt-butter-bookmark')?.shadowRoot.querySelector('button');
    if (!b) return null;
    const r = b.getBoundingClientRect(),
      s = getComputedStyle(b);
    return {
      shown: s.visibility === 'visible' && +s.opacity > 0,
      x: r.left,
      y: r.top,
      w: r.width,
      h: r.height,
      radius: s.borderRadius,
      label: b.getAttribute('aria-label'),
      tip: b.querySelector('.tip span').textContent,
      kbd: b.querySelector('.tip kbd').textContent,
      kbdShown: getComputedStyle(b.querySelector('.tip kbd')).display !== 'none',
      on: b.classList.contains('on'),
      fill: getComputedStyle(b.querySelector('svg path')).fill,
      stroke: getComputedStyle(b.querySelector('svg path')).stroke,
    };
  });
// An answer's paragraphs, as bookmarks count them: its top-level blocks, each item of a top-level
// list on its own (blocks: p, h3, p, p, p, p, then the list's two items).
const PARAS = ':scope > :not(ul, ol), :scope > :is(ul, ol) > li';
const block = (turn, k) =>
  page.evaluate(
    ([id, k, PARAS]) => {
      const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
      const r = el.getBoundingClientRect(),
        sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, fromTop: r.top - sc.top };
    },
    [answer(turn), k, PARAS],
  );
const scrollTo = (turn) =>
  page.evaluate((id) => {
    const sc = document.querySelector('.thread-scroll-container');
    sc.scrollTop += document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - 120;
  }, question(turn));
// Select text in answer paragraphs: from `start` in paragraph k to `end` in paragraph k2.
const select = (turn, k, start, k2, end) =>
  page.evaluate(
    ([id, k, start, k2, end, PARAS]) => {
      const blocks = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS);
      const r = document.createRange();
      r.setStart(blocks[k].firstChild, start);
      r.setEnd(blocks[k2].firstChild, end);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    },
    [answer(turn), k, start, k2, end, PARAS],
  );
// Press the bookmark command's key as real input, with the X pointer parked on the header; without
// a display, the worker relays the command to the tab as Chrome would.
// The X pointer stays on the tab strip (screen y 20, above the page): over the page, its own moves
// would compete with the harness's hover. Without a window manager, keys go where the pointer is.
const xkeys = (chord) =>
  execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), chord, '700', '20']);
if (headed) xkeys('Shift');
async function shortcut() {
  if (headed) xkeys('Alt+Shift+M');
  else
    await worker.evaluate(async () => {
      // Reading tab urls needs a permission Butter doesn't have: only the chat's tab listens.
      for (const tab of await chrome.tabs.query({ active: true }))
        await chrome.tabs.sendMessage(tab.id, { version: 1, type: 'butter-bookmark-shortcut' }).catch(() => {});
    });
  await page.waitForTimeout(600);
}
// Where a stored bookmark's text starts, in px below the scroller's top.
const textTop = (turn, k, offset) =>
  page.evaluate(
    ([id, k, offset, PARAS]) => {
      const node = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k].firstChild;
      const r = document.createRange();
      r.setStart(node, offset);
      r.setEnd(node, offset + 1);
      return r.getClientRects()[0].top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
    },
    [answer(turn), k, offset, PARAS],
  );
// Click question `turn`'s segment from the top of the chat and wait for the jump.
async function jumpBySegment(turn) {
  await page.mouse.move(10, 10);
  await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
  await page.waitForTimeout(300);
  const r = await rail();
  const m = r.marks.find((x) => Math.abs(x.y - r.ticks[turn].y - 5) <= 0.6);
  if (!m) return false;
  await page.mouse.click(m.right - 4, m.y + 3);
  await page.waitForTimeout(3500);
  return true;
}
const markUnder = (r, turn) => r.marks.some((m) => Math.abs(m.y - r.ticks[turn].y - 5) <= 0.6);

// Hover a paragraph (away from its first line), then click the button. `low`: the paragraph sits
// too far down its answer to show after scrolling to its question; scroll it to 200 px instead.
async function bookmark(turn, k, low = false) {
  if (low)
    await page.evaluate(
      ([id, k, PARAS]) => {
        const sc = document.querySelector('.thread-scroll-container');
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
        sc.scrollTop += el.getBoundingClientRect().top - 200;
      },
      [answer(turn), k, PARAS],
    );
  else await scrollTo(turn);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(100);
  const b = await block(turn, k);
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  await page.waitForTimeout(40);
  const early = await button();
  await page.waitForTimeout(260);
  const shown = await button();
  // Content above settles a moment after a scroll (stream/offscreen.js marks blocks after 1 s):
  // moving within the paragraph keeps the button on its first line.
  await page.waitForTimeout(1200);
  await page.mouse.move(b.x + 200, b.y + b.h / 2);
  const moved = await block(turn, k),
    placed = await button();
  // Across the margin to the button (when there is one: without it the checks below fail).
  if (placed) await page.mouse.move(placed.x + 14, placed.y + 14, { steps: 8 });
  const kept = await button();
  return {
    first: b,
    b: moved,
    early,
    shown,
    placed,
    kept,
    click: () => placed && page.mouse.click(placed.x + 14, placed.y + 14),
  };
}

// 11b. A one-question chat: the rail stays hidden, as before, but a bookmark made there still
// shows the filled button and can be removed with it; with a second question its segment shows.
async function oneQuestionSection() {
  await settings({ bookmarkNotice: 'acknowledged' });
  await seedStore([], { clear: true });
  page$.turns = 1;
  page$.theme = 'light';
  if (!page) page = await context.newPage();
  await page.goto(`https://chatgpt.com/c/${CONV}`);
  await page.waitForSelector(`[data-fx-answer="${answer(0)}"]`);
  await page.waitForTimeout(1500);
  const railOn = () => page.evaluate(() => !!document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'));
  const PARA = 3;
  const first = await bookmark(0, PARA);
  await first.click();
  await page.waitForTimeout(600);
  const made = await stored();
  check('one question: the button saves a bookmark and the rail stays hidden',
    first.kept?.shown && !first.kept.on && made.length === 1 && made[0].turn === 0 && made[0].para === PARA && !(await railOn()),
    { button: first.kept, stored: made.length });
  const read = (await requests())['butter-bookmark-list'] || 0;
  for (let k = 0; k < 10; k++) {
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, k % 2 ? -400 : 400);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  const again = await bookmark(0, PARA);
  check('one question: the bookmarked paragraph shows the filled "Remove bookmark" button',
    again.kept?.on && again.kept.tip === 'Remove bookmark', { button: again.kept });
  check('one question: scrolling reads no bookmarks', ((await requests())['butter-bookmark-list'] || 0) === read,
    { read, now: (await requests())['butter-bookmark-list'] });
  await again.click();
  await page.waitForTimeout(600);
  check('one question: the filled button removes it', (await stored()).length === 0 && !(await railOn()), { stored: (await stored()).length });
  // Saved again, then a second question: the rail shows, with the segment under question 1.
  await (await bookmark(0, PARA)).click();
  await page.waitForTimeout(600);
  page$.turns = 2;
  await open();
  await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1, null, { timeout: 5000 }).catch(() => {});
  const two = await rail();
  check('with a second question the rail shows the segment under question 1', (await stored()).length === 1 && two.marks.length === 1 && markUnder(two, 0),
    { stored: (await stored()).length, marks: two.marks.length });
  page$.turns = TURNS;
  await seedStore([], { clear: true });
}

// 12. Earlier history (#51 addendum). After a reload a long chat lists only its latest questions; a
// bookmark whose question is earlier sits on the rail's earlier-history dots until its answer is
// loaded. The fixture opens with questions 8 to 12; each earlier page brings two more.
async function earlierSection() {
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  // A whole-paragraph bookmark on block `para` of question `turn`'s answer (blocks: p, h3, p, p, p, p, li, li).
  const eseed = (turn, para, time, msgId = answer(turn)) => {
    const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
    return { account: ACCOUNT, conv: CONV_HASH, msg: sha(msgId), turn, para, start: 0, end: text.length, excerpt: text.slice(0, 120).trim(), time };
  };
  const reseed = (rows) => seedStore(rows, { clear: true });
  const FIRST = 7,
    LATEST = eseed(10, 0, 100);
  const state = () =>
    page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        more = root.querySelector('.more'),
        mr = more.getBoundingClientRect(),
        dotsY = mr.top + mr.height / 2;
      const rect = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height, top: q.top, right: q.right };
      };
      const marks = [...root.querySelectorAll('.mark:not(.gone)')].map((el) => ({
        ...rect(el),
        cls: el.className,
        label: el.getAttribute('aria-label'),
        color: getComputedStyle(el).backgroundColor,
        shadow: getComputedStyle(el).boxShadow,
      }));
      const card = root.querySelector('.card'),
        bmc = root.querySelector('.bmc'),
        a = root.activeElement;
      return {
        more: !more.hidden,
        dotsY,
        busy: more.classList.contains('busy'),
        dotsMark: more.hidden ? null : (marks.find((m) => Math.abs(m.y - dotsY - 5) <= 0.6) ?? null),
        marks,
        ticks: [...root.querySelectorAll('.tick .bar')].map((b) => rect(b).y),
        card: {
          shown: card.classList.contains('show') && +getComputedStyle(card).opacity > 0.5,
          label: card.getAttribute('aria-label'),
          meta: bmc.querySelector('.meta')?.textContent,
          metaFlag: !!bmc.querySelector('.meta .flag'),
          metaSpin: !!bmc.querySelector('.meta .wspin'),
          text: bmc.querySelector('.one')?.textContent ?? null,
          one: bmc.querySelector('.one') && rect(bmc.querySelector('.one')),
          warn: bmc.querySelector('.warn')?.textContent ?? null,
          why: bmc.querySelectorAll('.why').length,
          x: bmc.querySelector('.meta .x')?.getAttribute('aria-label') ?? null,
          rows: [...bmc.querySelectorAll('.it')].map((it) => ({
            text: it.querySelector('.go').textContent,
            wait: it.classList.contains('wait'),
            spin: !!it.querySelector('.wspin'),
            del: it.querySelector('.x')?.getAttribute('aria-label') ?? null,
            ...rect(it),
          })),
          rect: rect(card),
        },
        active: a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null,
      };
    });
  // The segment under question `turn`'s tick (0 = the chat's first question), among those loaded.
  // A landing near the top loads one more page, as ChatGPT does: count from the loaded ticks.
  const under = (s, turn) => {
    const i = turn - (TURNS - s.ticks.length);
    return i >= 0 && s.marks.find((m) => Math.abs(m.y - s.ticks[i] - 5) <= 0.6);
  };
  // Records segments growing in and fading out, in the rail's own layer.
  const record = () =>
    page.evaluate(() => {
      const box = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.marks');
      globalThis.fxMarks = { gone: 0, grown: 0 };
      new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === 'attributes' && m.target.classList.contains('gone')) fxMarks.gone++;
          for (const n of m.addedNodes) if (n.classList?.contains('new')) fxMarks.grown++;
        }
      }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  const recorded = () => page.evaluate(() => globalThis.fxMarks);
  const fromTop = (turn, k) =>
    page.evaluate(
      ([id, k]) => {
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`)?.children[k];
        return el ? el.getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top : null;
      },
      [answer(turn), k],
    );
  // Waits until the bookmarked paragraph has sat 64 px below the scroller's top for a moment.
  const landed = async (turn, k, ms = 30000) => {
    const end = Date.now() + ms;
    let ok = 0,
      y = null;
    while (Date.now() < end && ok < 4) {
      y = await fromTop(turn, k);
      ok = y != null && Math.abs(y - 64) <= 3 ? ok + 1 : 0;
      await page.waitForTimeout(250);
    }
    return { landed: ok >= 4, y };
  };
  const openEarlier = async (theme, rows, marks) => {
    page$.first = FIRST;
    page$.pages = 0;
    await reseed(rows);
    await open(theme);
    await page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === n, marks, { timeout: 5000 });
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    return state();
  };
  const hoverDots = async () => {
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    const s = await state();
    if (!s.dotsMark) return s;
    await page.mouse.move(s.dotsMark.right - 4, s.dotsMark.y, { steps: 4 });
    await page.waitForTimeout(350);
    return state();
  };
  const tab = async (cls) => {
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 10 && !(await state()).active?.cls.startsWith(cls); k++) await page.keyboard.press('Tab');
    return (await state()).active;
  };
  await settings({ bookmarkNotice: 'acknowledged' });
  page$.pageDelay = 300;
  const A = eseed(2, 2, 1);

  // (a) At rest: the earlier bookmark on the dots, the loaded one under its question.
  let s = await openEarlier('light', [A, LATEST], 2);
  const other = s.marks.find((m) => m !== s.dotsMark);
  check('earlier: the chat opens with its latest 5 questions and the earlier-history dots', s.ticks.length === 5 && s.more, { ticks: s.ticks.length });
  check('earlier: one segment on the dots, 5 px below their centre, 8 × 2 px in the segments\' colour and ring',
    !!s.dotsMark && s.dotsMark.w === 8 && s.dotsMark.h === 2 && s.dotsMark.color === other?.color && s.dotsMark.shadow === other?.shadow &&
      Math.abs(s.dotsMark.right - other.right) < 0.5, { dotsMark: s.dotsMark, other });
  check('earlier: the loaded question\'s bookmark stays under its tick (question 11)', !!under(s, 10), { marks: s.marks.length });
  check('earlier: no segment under a loaded question the bookmark isn\'t from', s.marks.length === 2 && !under(s, 9) && !under(s, 8), { marks: s.marks.map((m) => m.y), ticks: s.ticks });
  check('earlier: the dots\' segment is never "answer changed"; its name holds the text',
    s.dotsMark && !s.dotsMark.cls.includes('stale') && s.dotsMark.label === `Bookmark · earlier question: ${A.excerpt}`, { label: s.dotsMark?.label });
  // Scrolling the loaded part reads nothing and loads no page.
  const before = await requests();
  await page.mouse.move(700, 500);
  for (let k = 0; k < 3; k++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
  check('earlier: scrolling reads no bookmarks and loads no page', JSON.stringify(await requests()) === JSON.stringify(before) && page$.pages === 0,
    { before, after: await requests(), pages: page$.pages });

  // (b) The single card, and a click on its text: earlier pages load until the answer mounts.
  s = await hoverDots();
  check('earlier: hovering the dots\' segment shows "Bookmark · earlier question", the text, × and the footer',
    s.card.shown && s.card.meta === 'Bookmark · earlier question' && s.card.text === A.excerpt && s.card.x === `Delete bookmark: ${A.excerpt}` &&
      s.card.warn === "This question isn't loaded yet. Clicking loads earlier messages first.", { card: s.card });
  await record();
  await page.mouse.move(s.card.one.x, s.card.one.y, { steps: 10 });
  await page.mouse.click(s.card.one.x, s.card.one.y);
  await page.waitForTimeout(150);
  s = await state();
  check('earlier: while loading, the card stays with "Loading earlier questions…", a spinner for its × and blinking dots',
    s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.metaSpin && !s.card.x && s.busy, { card: s.card, busy: s.busy });
  let l = await landed(2, 2);
  s = await state();
  let rec = await recorded();
  check('earlier: the click loads earlier pages until the answer mounts and lands on the text', l.landed && page$.pages === 3, { ...l, pages: page$.pages });
  check('earlier: the segment moves to its real tick (question 3) with the grow-in; the dots\' segment fades out',
    !s.dotsMark && s.more && !!under(s, 2) && rec.grown >= 1 && rec.gone >= 1, { rec, marks: s.marks.length });

  // (c) The list, a row's click, and what is left on the dots afterwards.
  const LIST = [eseed(1, 0, 1), eseed(1, 2, 2), eseed(3, 0, 3), eseed(4, 2, 4)];
  s = await openEarlier('light', [...LIST, LATEST], 2);
  s = await hoverDots();
  check('earlier: several: "Earlier questions · 4 bookmarks", oldest first, the flag in the meta line',
    s.card.shown && s.card.meta === 'Earlier questions · 4 bookmarks' && s.card.metaFlag &&
      JSON.stringify(s.card.rows.map((r) => r.text)) === JSON.stringify(LIST.map((b) => b.excerpt)) &&
      s.dotsMark.label === `Earlier questions · 4 bookmarks: ${LIST.map((b) => b.excerpt).join('; ')}`, { card: s.card });
  await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
  await page.mouse.move(s.card.rows[3].x, s.card.rows[3].y, { steps: 4 });
  await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
  await page.waitForTimeout(150);
  s = await state();
  check('earlier: the clicked row\'s × turns into a spinner, the others keep theirs',
    s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.rows[3]?.wait && s.card.rows[3].spin && !s.card.rows[3].del &&
      s.card.rows.slice(0, 3).every((r) => r.del && !r.spin) && s.busy, { rows: s.card.rows });
  l = await landed(4, 2);
  await page.mouse.move(700, 300);
  await page.waitForTimeout(300);
  s = await state();
  check('earlier: a row\'s click lands on that bookmark after two pages', l.landed && page$.pages === 2, { ...l, pages: page$.pages });
  check('earlier: the loaded ones move to questions 4 and 5; question 2\'s two stay on the dots',
    !!under(s, 3) && !!under(s, 4) && s.dotsMark?.label?.startsWith('Earlier questions · 2 bookmarks: '), { label: s.dotsMark?.label });

  // (d) Escape while loading puts the card away; the loading goes on and lands.
  await record();
  s = await hoverDots();
  await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
  await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const escaped = await state();
  l = await landed(1, 0);
  s = await state();
  rec = await recorded();
  // Question 2 lands at the chat's top, where the fixture loads the last page too.
  check('earlier: Escape closes the card but the loading goes on and lands', !escaped.card.shown && l.landed && page$.pages >= 3, { shown: escaped.card.shown, ...l, pages: page$.pages });
  check('earlier: none left on the dots: their segment goes', !s.dotsMark && !!under(s, 1), { rec });

  // (e) Keyboard alone: the dots, their segment, its card's rows; Enter loads and lands.
  s = await openEarlier('light', [eseed(3, 2, 1), eseed(6, 0, 2), LATEST], 2);
  let f = await tab('more');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  s = await state();
  check('earlier: ArrowDown from the dots reaches their segment and opens its card',
    f?.cls.startsWith('more') && s.active?.cls.startsWith('mark') && s.active.label === s.dotsMark?.label && s.card.shown && s.card.meta === 'Earlier questions · 2 bookmarks', { f, active: s.active });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  s = await state();
  check('earlier: ArrowLeft enters the card, ArrowDown moves to the next row', s.active?.cls === 'go' && s.active.text === PARAGRAPH(6, 0).slice(0, 120).trim(), { active: s.active });
  await page.keyboard.press('Enter');
  l = await landed(6, 0);
  s = await state();
  check('earlier: Enter on a row loads and lands; focus moves to its segment under question 7',
    l.landed && page$.pages === 1 && s.active?.cls.startsWith('mark') && under(s, 6)?.label === s.active.label &&
      s.dotsMark?.label === `Bookmark · earlier question: ${PARAGRAPH(3, 1).slice(0, 120).trim()}`, { ...l, active: s.active, pages: page$.pages });

  // (f) A click on the dots' segment targets the oldest; under reduced motion it goes at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record();
  s = await state();
  await page.mouse.move(s.dotsMark.right - 4, s.dotsMark.y, { steps: 4 });
  await page.mouse.click(s.dotsMark.right - 4, s.dotsMark.y);
  l = await landed(3, 2);
  s = await state();
  rec = await recorded();
  check('earlier: clicking the dots\' segment loads and lands on the oldest; reduced motion removes it at once',
    l.landed && s.more && !s.dotsMark && !!under(s, 3) && rec.gone === 0, { ...l, rec, more: s.more });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // (g) A bookmark whose message is gone from the whole conversation: on the dots while history
  // is unloaded, then today's stale bookmark once it is all loaded, landing at its question.
  s = await openEarlier('light', [eseed(2, 0, 1, regen(2))], 1);
  check('earlier: an unknown message waits on the dots, live', !!s.dotsMark && !s.dotsMark.cls.includes('stale'));
  await page.mouse.move(s.dotsMark.right - 4, s.dotsMark.y, { steps: 4 });
  await page.mouse.click(s.dotsMark.right - 4, s.dotsMark.y);
  let q = null;
  for (let k = 0; k < 120; k++) {
    await page.waitForTimeout(250);
    q = await page.evaluate((id) => {
      const el = document.querySelector(`[data-turn-key="${id}"]`);
      return el && el.getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
    }, question(2));
    if (page$.pages >= 4 && q != null && Math.abs(q - 64) <= 3) break;
  }
  await page.waitForTimeout(600);
  s = await state();
  check('earlier: once all is loaded and the message isn\'t there, it is stale under its question and the click opened that question',
    !s.more && page$.pages === 4 && under(s, 2)?.cls.includes('stale') && q != null && Math.abs(q - 64) <= 3, { q, pages: page$.pages, more: s.more });

  // (g2) Question 10's answer was regenerated (the new one is the conversation's current version)
  // while earlier history is unloaded. A bookmark stored with its question (`ask`) is stale under
  // that loaded question (#55); one stored without it keeps going on the dots, as before.
  page$.regen.add(9);
  s = await openEarlier('light', [{ ...eseed(9, 0, 1), ask: sha(question(9)) }, eseed(9, 2, 2)], 2).catch(() => state());
  check('earlier: a regenerated answer\'s bookmark is stale under its loaded question; one stored without its question is on the dots',
    !!under(s, 9)?.cls.includes('stale') && !!s.dotsMark && s.marks.length === 2, { marks: s.marks.map((m) => m.cls), dots: !!s.dotsMark });
  page$.regen.delete(9);

  // (h) Screenshots of each mockup state, light and dark, English and Chinese, desktop and narrow.
  // The rail shows when the chat is at least 560 px wide: 600 px is the narrowest it draws at.
  const strings = {
    en: { one: 'Bookmark · earlier question', foot: "This question isn't loaded yet. Clicking loads earlier messages first.", many: 'Earlier questions · 4 bookmarks', wait: 'Loading earlier questions…' },
    zh: { one: '书签 · 更早的问题', foot: '这个问题还没加载。点击会先加载更早的消息。', many: '更早的问题 · 4 个书签', wait: '正在加载更早的问题…' },
  };
  const shoot = async (name) => {
    const vw = page.viewportSize().width,
      s = await state(),
      w = Math.min(vw, 420),
      top = Math.max(0, Math.min(s.card.shown ? s.card.rect.top : Infinity, s.dotsY - 12, s.ticks[0] - 12) - 30),
      bottom = Math.max(s.card.shown ? s.card.rect.top + s.card.rect.h : 0, s.ticks.at(-1)) + 30;
    await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: vw - w, y: top, width: w, height: bottom - top } });
  };
  for (const [width, size] of [[1400, 'desktop'], [600, 'narrow']])
    for (const lang of ['en', 'zh'])
      for (const theme of ['light', 'dark']) {
        const tag = `${theme}-${lang}-${size}`,
          t = strings[lang];
        await page.setViewportSize({ width, height: 900 });
        await settings({ lang, bookmarkNotice: 'acknowledged' });
        page$.pageDelay = 300;
        await openEarlier(theme, [A, LATEST], 2);
        await shoot(`earlier-rest-${tag}`);
        s = await hoverDots();
        await shoot(`earlier-single-${tag}`);
        const single = s.card;
        page$.pageDelay = 2500;
        await openEarlier(theme, [...LIST, LATEST], 2);
        s = await hoverDots();
        await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
        await page.mouse.move(s.card.rows[1].x, s.card.rows[1].y, { steps: 4 });
        await page.waitForTimeout(200);
        await shoot(`earlier-list-${tag}`);
        const list = (await state()).card;
        await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
        await page.waitForTimeout(400);
        await shoot(`earlier-loading-${tag}`);
        const loading = (await state()).card;
        l = await landed(4, 2);
        await page.mouse.move(Math.min(700, width / 2), 300);
        await page.waitForTimeout(300);
        await shoot(`earlier-landed-${tag}`);
        s = await state();
        check(`earlier (${tag}): every state draws, with its strings`,
          single.meta === t.one && single.warn === t.foot && list.meta === t.many && loading.meta === t.wait && loading.rows[3]?.spin &&
            l.landed && !!s.dotsMark && !!under(s, 4), { single: single.meta, list: list.meta, loading: loading.meta, landed: l.landed });
      }
  // Under 560 px of chat the rail doesn't draw at all (unchanged).
  await page.setViewportSize({ width: 390, height: 844 });
  await settings({ lang: 'en', bookmarkNotice: 'acknowledged' });
  page$.first = FIRST;
  await reseed([A, LATEST]);
  await page.goto(`https://chatgpt.com/c/${CONV}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/earlier-rest-light-en-mobile390.png` });
  check('earlier: at 390 px the rail stays off, as before', !(await page.evaluate(() => document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'))));
  await page.setViewportSize({ width: 1400, height: 900 });

  // The mockup's panels next to them, when given.
  if (process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP) {
    const mock = await context.newPage({ viewport: { width: 1400, height: 900 } });
    await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP)}`);
    await mock.click('[data-mode="clean"]');
    const names = ['before', 'rest', 'single', 'list', 'loading', 'landed'];
    for (const lang of ['en', 'zh']) {
      await mock.click(`[data-lang="${lang}"]`);
      const figs = mock.locator('figure .page');
      for (let k = 0; k < (await figs.count()); k++)
        await figs.nth(k).screenshot({ path: `${shots}/mockup-earlier-${names[k % 6]}-${k < 6 ? 'light' : 'dark'}-${lang}.png` });
    }
    await mock.close();
  }
  page$.first = 0;
  page$.pageDelay = 0;
  await reseed([]);
}

try {
  // Existing users have a version-1 database with saved layouts: the upgrade keeps them and adds
  // the bookmarks store. (Reaches into the worker's connection to rebuild a version-1 database.)
  const upgrade = await worker.evaluate(async () => {
    const done = (r) => new Promise((ok, no) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => no(r.error))));
    (await opened)?.close();
    opened = null;
    await done(indexedDB.deleteDatabase('butter-layouts-v1'));
    const v1 = indexedDB.open('butter-layouts-v1', 1);
    v1.onupgradeneeded = () => {
      v1.result.createObjectStore('geometry', { keyPath: 'key' }).createIndex('conversation', ['account', 'conv']);
      v1.result.createObjectStore('state');
      v1.transaction.objectStore('geometry').put({ key: 'fixture-row', account: 'a', conv: 'c' });
      v1.transaction.objectStore('state').put(3, 'generation');
    };
    (await done(v1)).close();
    const db = await database();
    const tx = db.transaction(['geometry', 'state', 'bookmarks']);
    return {
      version: db.version,
      stores: [...db.objectStoreNames],
      row: !!(await done(tx.objectStore('geometry').get('fixture-row'))),
      generation: await done(tx.objectStore('state').get('generation')),
      index: [...tx.objectStore('bookmarks').indexNames],
    };
  });
  check('a version-1 database upgrades with its layouts kept and a bookmarks store added',
    upgrade.version === 2 && upgrade.row && upgrade.generation === 3 && upgrade.stores.includes('bookmarks') &&
      upgrade.index.includes('conversation'), upgrade);
  await worker.evaluate(() => {
    const tx = opened.then((db) => db.transaction('geometry', 'readwrite').objectStore('geometry').clear());
    return tx.then(() => {});
  });
  // ONLY=earlier runs the earlier-history section alone.
  if (process.env.ONLY === 'earlier') await earlierSection();
  else if (process.env.ONLY === 'one') await oneQuestionSection();
  else {
    await settings({});
    await open();
    const before = await rail();
    check('rail draws no segment before any bookmark', before.marks.length === 0);

    // 1. Hover, wait, click: the segment appears under question 7.
    const TURN = 6,
      PARA = 3, // the narrow paragraph: blocks are p, h3, p, p, p, p, ul
      TEXT = PARAGRAPH(TURN, 2);
    // The user's own question is not a target.
    await scrollTo(TURN);
    await page.waitForTimeout(1200);
    const bubble = await page.evaluate((id) => {
      const r = document.querySelector(`[data-turn-key="${id}"] [data-user-message-bubble]`).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, question(TURN));
    await page.mouse.move(bubble.x, bubble.y);
    await page.waitForTimeout(400);
    check('the user question shows no button', !(await button())?.shown);
    const hover = await bookmark(TURN, PARA);
    check('button waits before it shows', !hover.early?.shown);
    check('button shows over the left margin, on the first line', hover.shown?.shown &&
      hover.shown.w === 28 && hover.shown.h === 28 && hover.shown.radius === '8px' &&
      Math.abs(hover.shown.x - (hover.first.x - 38)) <= 1 && Math.abs(hover.shown.y + 14 - (hover.first.y + 13)) <= 3,
      { button: hover.shown, block: hover.first });
    // The name holds the start of the paragraph (#53): its first 80 characters.
    check('tooltip says "Bookmark"; the name adds the start of the paragraph',
      hover.shown?.tip === 'Bookmark' && hover.shown.label === `Bookmark: ${TEXT.slice(0, 80).trim()}…`, { label: hover.shown?.label });
    // Chrome assigned the suggested key (it does not when the key is one of its own), and the
    // tooltip shows it as the mockup writes keys.
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    check('Chrome reports Alt+Shift+M for the bookmark command, and the tooltip shows it',
      commands.find((c) => c.name === 'bookmark')?.shortcut === 'Alt+Shift+M' && hover.shown.kbd === 'Alt Shift M' && hover.shown.kbdShown,
      { commands, kbd: hover.shown.kbd });
    check('button follows its paragraph when content above it settles',
      Math.abs(hover.placed.x - (hover.b.x - 38)) <= 1 && Math.abs(hover.placed.y + 14 - (hover.b.y + 13)) <= 3,
      { button: hover.placed, block: hover.b });
    check('button stays while the pointer crosses the margin', hover.kept?.shown);
    await page.screenshot({ path: `${shots}/button-light.png`, clip: { x: hover.b.x - 60, y: hover.b.y - 50, width: 820, height: 160 } });
    await hover.click();
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1);
    await page.waitForTimeout(60);
    const made = await rail();
    const mark = made.marks[0],
      tick = made.ticks[TURN],
      pitch = made.ticks[1].y - made.ticks[0].y;
    check('one segment, under question 7, 5 px below its tick', made.marks.length === 1 &&
      Math.abs(mark.y - (tick.y + (pitch < 12 ? 0.4 * pitch : 5))) <= 0.6, { mark, tick, pitch });
    check('segment is new: it grows in and pulses', mark.cls.includes('new'));
    await page.waitForTimeout(900);
    const settled = (await rail()).marks[0];
    check('segment is 8 x 2 px, right-aligned with the ticks, butter yellow',
      settled.w === 8 && settled.h === 2 && Math.abs(settled.right - tick.right) <= 0.5 && settled.color === 'rgb(251, 224, 122)',
      { settled, tickRight: tick.right });
    await page.screenshot({ path: `${shots}/rail-light.png`, clip: { x: 1400 - 120, y: made.ticks[0].y - 30, width: 120, height: pitch * TURNS + 60 } });
    const saved = await stored();
    const excerpt = saved[0]?.excerpt ?? '';
    // Which rendered line the excerpt's last character and the next word start on, measured here.
    // And the text of its first rendered line.
    const cut = await page.evaluate(
      ([id, k, n, PARAS]) => {
        const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
        const text = p.firstChild,
          r = document.createRange(),
          top = (i) => {
            r.setStart(text, i);
            r.setEnd(text, i + 1);
            return r.getClientRects()[0].top;
          };
        const line = (i) => Math.round((top(i) - top(0)) / 26) + 1;
        let i = 0;
        while (i < text.data.length && line(i) === 1) i++;
        return { last: line(n - 1), next: line(n + 1), first: text.data.slice(0, i).trim() };
      },
      [answer(TURN), PARA, excerpt.length, PARAS],
    );
    check('the store holds one bookmark with hashed ids and the first three lines as its excerpt',
      saved.length === 1 && [saved[0].account, saved[0].conv, saved[0].msg].every((h) => /^[a-f0-9]{64}$/.test(h)) &&
        saved[0].para === PARA && saved[0].turn === TURN && TEXT.startsWith(excerpt) &&
        cut.last === 3 && cut.next === 4,
      { excerpt, length: excerpt.length, cut, para: saved[0]?.para, turn: saved[0]?.turn });
    check('no raw ids reach the store', !JSON.stringify(saved).includes(CONV) && !JSON.stringify(saved).includes(answer(TURN)) &&
      !JSON.stringify(saved).includes(question(TURN)));
    check('the store keeps the hashed id of the question it was made under (#55)', saved[0]?.ask === sha(question(TURN)), { ask: saved[0]?.ask });
    check("the store keeps the length of the excerpt's first rendered line (#55)",
      cut.first.length > 0 && cut.first.length < 80 && saved[0]?.line === cut.first.length && excerpt.startsWith(cut.first),
      { line: saved[0]?.line, first: cut.first });

    // 2. Hovering the bookmarked paragraph again shows the filled button (a click would remove it).
    const again = await bookmark(TURN, PARA);
    check('a bookmarked paragraph shows the filled button', again.kept?.on && again.kept.tip === 'Remove bookmark',
      { button: again.kept });
    check('the paragraph is saved once', (await stored()).length === 1 && (await rail()).marks.length === 1);

    // 3. Hovering the segment grows it to 12 px; the tick's wave does not move it.
    await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
    await page.waitForTimeout(300);
    const r0 = await rail();
    await page.mouse.move(r0.marks[0].right - 4, r0.marks[0].y + 3, { steps: 4 });
    await page.waitForTimeout(250);
    const hot = (await rail()).marks[0];
    check('the segment wins the pointer within 4 px and grows to 12 px', hot.w === 12 && hot.cls.includes('hover'), { hot });

    // 4. Click the segment: the bookmarked paragraph lands 64 px below the scroller's top.
    await page.mouse.click(r0.marks[0].right - 4, r0.marks[0].y + 3);
    await page.waitForTimeout(3500);
    const landed = await block(TURN, PARA);
    check('clicking the segment lands on the bookmarked paragraph', Math.abs(landed.fromTop - 64) <= 3, { fromTop: landed.fromTop });
    // A click on the tick itself still lands on the question.
    await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
    await page.waitForTimeout(300);
    const r1 = await rail();
    await page.mouse.click(r1.ticks[TURN].x, r1.ticks[TURN].y - 3);
    await page.waitForTimeout(3500);
    const q = await page.evaluate((id) => {
      const sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
      return document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - sc.top;
    }, question(TURN));
    check('clicking the tick still lands on the question', Math.abs(q - 64) <= 3, { fromTop: q });

    // 5. Reload: the segment is back, without the new-segment motion, from one read.
    const read = (await requests())['butter-bookmark-list'] || 0;
    await open();
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1, null, { timeout: 5000 });
    const reloaded = await rail();
    check('after a reload the segment is under question 7 again', reloaded.marks.length === 1 &&
      Math.abs(reloaded.marks[0].y - reloaded.ticks[TURN].y - 5) <= 0.6 && !reloaded.marks[0].cls.includes('new'));
    const afterLoad = (await requests())['butter-bookmark-list'] || 0;
    for (let k = 0; k < 20; k++) {
      await page.mouse.move(700, 400);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(300);
    const afterScroll = await requests();
    check('bookmarks are read once per conversation and not while scrolling',
      afterLoad - read === 1 && (afterScroll['butter-bookmark-list'] || 0) === afterLoad, { read, afterLoad, afterScroll });

    // 5b. Away to ChatGPT's home and Back through history (no reload): the rail leaves the chat and
    // comes back to it, and its segment with it; hovering the rail is not needed.
    await page.mouse.move(700, 400);
    await page.evaluate(() => history.pushState({}, '', '/'));
    await page.waitForFunction(() => !document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
    await page.waitForTimeout(1000);
    const backAgain = await rail();
    check('away to the home page and Back: the segment is under question 7 again', backAgain.marks.length === 1 && markUnder(backAgain, TURN),
      { marks: backAgain.marks.length });

    // 6. Dark theme: the segment and the button in dark butter.
    await open('dark');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1);
    const dark = await rail();
    check('dark theme segment is #e3c766', dark.marks[0].color === 'rgb(227, 199, 102)', { color: dark.marks[0].color });
    await page.screenshot({ path: `${shots}/rail-dark.png`, clip: { x: 1400 - 120, y: dark.ticks[0].y - 30, width: 120, height: pitch * TURNS + 60 } });
    const hoverDark = await bookmark(2, 0);
    await page.screenshot({ path: `${shots}/button-dark.png`, clip: { x: hoverDark.b.x - 60, y: hoverDark.b.y - 50, width: 820, height: 160 } });
    check('dark theme button shows', hoverDark.shown?.shown);
    // The bookmarked paragraph's filled button, for the mockup's dark "Remove bookmark" frame.
    const filledDark = await bookmark(TURN, PARA);
    check('dark theme: a bookmarked paragraph shows the filled "Remove bookmark" button',
      filledDark.kept?.on && filledDark.kept.tip === 'Remove bookmark', { button: filledDark.kept });
    await page.screenshot({ path: `${shots}/button-remove-dark.png`, clip: { x: filledDark.b.x - 60, y: filledDark.b.y - 50, width: 820, height: 160 } });

    // 6b. Selection and shortcut (#54).
    await open('light');
    // (a) A selection inside one paragraph, saved with the button: question 3, paragraph 2.
    const SEL = 'reads the table statistics gathered by ANALYZE',
      selText = PARAGRAPH(2, 1),
      selStart = selText.indexOf(SEL);
    await scrollTo(2);
    await select(2, 2, selStart, 2, selStart + SEL.length);
    const selHover = await bookmark(2, 2);
    check('with a selection, the tooltip and name say "Bookmark selection", with the key',
      selHover.kept?.tip === 'Bookmark selection' && selHover.kept.label === `Bookmark selection: ${SEL}` && selHover.kept.kbd === 'Alt Shift M',
      { tip: selHover.kept?.tip, label: selHover.kept?.label, kbd: selHover.kept?.kbd });
    await page.screenshot({ path: `${shots}/button-selection-light.png`, clip: { x: selHover.b.x - 60, y: selHover.b.y - 50, width: 820, height: 160 } });
    await selHover.click();
    await page.waitForTimeout(600);
    let all = await stored();
    const bySel = all.find((b) => b.turn === 2);
    check('the button saves only the selection: its offsets and its text',
      bySel && bySel.para === 2 && bySel.start === selStart && bySel.end === selStart + SEL.length && bySel.excerpt === SEL,
      { bySel });
    check('the selection survives the click', await page.evaluate(() => getSelection().toString()) === SEL);
    check('the selection bookmark has its segment under question 3', markUnder(await rail(), 2));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking its segment lands on the selected text, not the paragraph',
      (await jumpBySegment(2)) && Math.abs((await textTop(2, 2, selStart)) - 64) <= 3,
      { fromTop: await textTop(2, 2, selStart), paragraph: (await block(2, 2)).fromTop });

    // (b) A selection across paragraphs, saved with the shortcut: question 5, paragraphs 2 to 3.
    const crossStart = PARAGRAPH(4, 1).indexOf('weighs the share');
    await scrollTo(4);
    await page.mouse.move(10, 10);
    await select(4, 2, crossStart, 3, 'Fixture answer 5 paragraph 3'.length);
    await shortcut();
    all = await stored();
    const cross = all.find((b) => b.turn === 4);
    check('the shortcut saves a selection across paragraphs, anchored to its first paragraph',
      cross && cross.para === 2 && cross.start === crossStart && cross.end === PARAGRAPH(4, 1).length &&
        cross.excerpt.startsWith('weighs the share') && [...cross.excerpt].length <= 240,
      { cross, via: headed ? 'Alt+Shift+M through XTest' : 'the worker relaying the command' });
    check('its segment is under question 5', markUnder(await rail(), 4));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking it lands on the selection\'s start',
      (await jumpBySegment(4)) && Math.abs((await textTop(4, 2, crossStart)) - 64) <= 3, { fromTop: await textTop(4, 2, crossStart) });

    // (c) Nothing selected: the shortcut bookmarks the first answer paragraph at or below the header.
    // Question 9's paragraph 2 sits 40 px down, under the 52 px header: paragraph 3 is the one.
    // Off-screen turns skip layout, so their boxes are estimates until they come into view: scroll,
    // let layout catch up, and measure again until the paragraph sits there.
    for (let k = 0; k < 8; k++) {
      const off = await page.evaluate((id) => {
        const sc = document.querySelector('.thread-scroll-container');
        const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).children[2];
        const d = p.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
        sc.scrollTop += d;
        return d;
      }, answer(8));
      await page.waitForTimeout(150);
      if (Math.abs(off) < 1) break;
    }
    await page.waitForTimeout(300);
    await shortcut();
    all = await stored();
    const top = all.find((b) => b.turn === 8);
    check('with nothing selected the shortcut bookmarks the top paragraph below the header',
      top && top.para === 3 && top.start === 0 && top.end === PARAGRAPH(8, 2).length && PARAGRAPH(8, 2).startsWith(top.excerpt),
      { top });
    check('its segment is under question 9', markUnder(await rail(), 8));
    check('clicking it lands on that paragraph', (await jumpBySegment(8)) && Math.abs((await block(8, 3)).fromTop - 64) <= 3,
      { fromTop: (await block(8, 3)).fromTop });

    // (d) A selection outside the answers (the user's question) creates nothing.
    const count = (await stored()).length;
    await scrollTo(10);
    await page.evaluate((id) => {
      const q = document.querySelector(`[data-turn-key="${id}"] [data-user-message-bubble]`);
      getSelection().selectAllChildren(q);
    }, question(10));
    await shortcut();
    check('a selection in a question creates nothing', (await stored()).length === count && !markUnder(await rail(), 10));
    await page.evaluate(() => getSelection().removeAllRanges());

    // (d2) List items (#51): each item of a top-level list is a paragraph of its own. Question 4's
    // answer ends in a two-item list: blocks 6 and 7.
    const LI = 7,
      LI_TEXT = 'Fixture list item two';
    await page.mouse.move(10, 10);
    const liHover = await bookmark(3, LI, true);
    const firstPara = await block(3, 0);
    check('a list item shows the button on its own first line, in the paragraphs\' column, named with its text',
      liHover.kept?.shown && Math.abs(liHover.placed.x - (firstPara.x - 38)) <= 1 &&
        Math.abs(liHover.placed.y + 14 - (liHover.b.y + 13)) <= 3 && liHover.kept.label === `Bookmark: ${LI_TEXT}`,
      { button: liHover.placed, item: liHover.b, label: liHover.kept?.label });
    await liHover.click();
    await page.waitForTimeout(600);
    const liMark = (await stored()).find((b) => b.turn === 3);
    check('clicking it bookmarks that item alone', liMark && liMark.para === LI && liMark.start === 0 && liMark.end === LI_TEXT.length && liMark.excerpt === LI_TEXT,
      { liMark });
    const liOther = await bookmark(3, LI - 1, true);
    check('the other item of the list is not shown as bookmarked', liOther.kept?.shown && !liOther.kept.on && liOther.kept.label === 'Bookmark: Fixture list item one',
      { button: liOther.kept });
    check('clicking its segment lands on that item, not on the start of the list',
      (await jumpBySegment(3)) && Math.abs((await block(3, LI)).fromTop - 64) <= 3,
      { fromTop: (await block(3, LI)).fromTop, list: (await block(3, LI - 1)).fromTop });
    // A selection inside the first item, saved with the button.
    await select(3, LI - 1, 8, LI - 1, 12);
    const liSel = await bookmark(3, LI - 1, true);
    await liSel.click();
    await page.waitForTimeout(600);
    await page.evaluate(() => getSelection().removeAllRanges());
    const liSelMark = (await stored()).find((b) => b.turn === 3 && b.para === LI - 1);
    check('a selection in a list item is anchored to that item', liSelMark && liSelMark.start === 8 && liSelMark.end === 12 && liSelMark.excerpt === 'list',
      { liSelMark });
    // The shortcut with nothing selected: the first item sits under the header, so the second is the top paragraph.
    for (let k = 0; k < 8; k++) {
      const off = await page.evaluate(([id, PARAS]) => {
        const sc = document.querySelector('.thread-scroll-container');
        const p = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[6];
        const d = p.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40;
        sc.scrollTop += d;
        return d;
      }, [answer(5), PARAS]);
      await page.waitForTimeout(150);
      if (Math.abs(off) < 1) break;
    }
    await page.waitForTimeout(300);
    await shortcut();
    const liTop = (await stored()).find((b) => b.turn === 5);
    check('with nothing selected the shortcut takes the list item at the top', liTop && liTop.para === LI && liTop.excerpt === LI_TEXT, { liTop });
    // After a reload both list items' bookmarks resolve: live, not "answer changed".
    await open('light');
    await page.waitForTimeout(400);
    // Questions 4 and 6: the only segments whose names hold the second item's text.
    const liSegs = await page.evaluate((text) => {
      const marks = [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark')];
      return marks.filter((m) => (m.getAttribute('aria-label') || '').includes(text)).map((m) => m.className);
    }, LI_TEXT);
    check('after a reload the list items\' bookmarks are live', liSegs.length === 2 && liSegs.every((c) => !c.includes('stale')), { liSegs });

    // (e) Dark theme, the selection tooltip.
    await open('dark');
    await scrollTo(2);
    await select(2, 2, selStart, 2, selStart + SEL.length);
    const selDark = await bookmark(2, 2);
    await page.screenshot({ path: `${shots}/button-selection-dark.png`, clip: { x: selDark.b.x - 60, y: selDark.b.y - 50, width: 820, height: 160 } });
    check('dark theme: the selection tooltip shows', selDark.kept?.tip === 'Bookmark selection');
    await settings({ lang: 'zh' });
    await page.waitForTimeout(400);
    const zhTip = await button();
    check('in Chinese the selection tooltip reads 为选中内容加书签', zhTip?.tip === '为选中内容加书签' && zhTip.label === `为选中内容加书签：${SEL}`, { tip: zhTip?.tip, label: zhTip?.label });
    await settings({});
    await page.evaluate(() => getSelection().removeAllRanges());

    // (f) Clear the command's key in Chrome's shortcut settings: the tooltip shows no hint.
    const settingsPage = await context.newPage();
    await settingsPage.goto('chrome://extensions/shortcuts');
    // The action's input has no key (its Clear is disabled); the bookmark command's is the other one.
    await settingsPage.locator('cr-shortcut-input #clear:not([disabled])').click();
    await settingsPage.waitForTimeout(300);
    await settingsPage.close();
    const cleared = await worker.evaluate(() => chrome.commands.getAll());
    await open('light');
    const noKey = await bookmark(TURN, 2);
    check('with the key cleared, the tooltip shows no shortcut hint',
      cleared.find((c) => c.name === 'bookmark')?.shortcut === '' && noKey.kept?.tip === 'Bookmark' && noKey.kept.kbd === '' && !noKey.kept.kbdShown,
      { cleared, kbd: noKey.kept?.kbd });
    // Leave the store and the key as the later sections expect: only question 7's bookmark.
    await worker.evaluate(async () => {
      const db = await database(),
        tx = db.transaction('bookmarks', 'readwrite'),
        rows = tx.objectStore('bookmarks');
      const all = await new Promise((ok) => (rows.getAll().onsuccess = (e) => ok(e.target.result)));
      for (const b of all) if (b.turn !== 6) rows.delete(b.key);
      await new Promise((ok, no) => ((tx.oncomplete = ok), (tx.onerror = () => no(tx.error))));
    });

    // 7. Turning the rail off live hides a shown button and the segments at once.
    await open('light');
    const live = await bookmark(TURN, PARA);
    await settings({ opts: { rail: false } });
    await page.waitForTimeout(300);
    const liveOff = await page.evaluate(() => getComputedStyle(document.querySelector('chatgpt-butter-nav')).display);
    check('rail switched off live: button and segments hide', live.kept?.shown && !(await button()).shown && liveOff === 'none', { liveOff });
    await settings({});

    // 8. Rail off, then Butter paused, from a fresh load: neither the button nor a segment.
    for (const [name, butter] of [
      ['rail off', { opts: { rail: false } }],
      ['Butter paused', { enabled: false }],
    ]) {
      await settings(butter);
      await open('light').catch(() => {});
      await page.waitForTimeout(600);
      const off = await page.evaluate(() => {
        const nav = document.querySelector('chatgpt-butter-nav');
        return {
          marks: nav ? [...nav.shadowRoot.querySelectorAll('.mark')].filter((m) => m.getBoundingClientRect().width && getComputedStyle(nav).display !== 'none' && nav.hasAttribute('data-on')).length : 0,
        };
      });
      await scrollTo(TURN);
      const b = await block(TURN, PARA);
      await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
      await page.waitForTimeout(400);
      const btn = await button();
      check(`${name}: no segment and no button`, off.marks === 0 && !btn?.shown, { off, btn });
      await settings({});
    }
    // And back on, the segments return: questions 3, 5, 7 and 9.
    await open('light');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1, null, { timeout: 5000 });
    check('rail back on: the segment returns', true);

    // 9. The rail's hover card (#53). Seed bookmarks straight into the store, as an earlier session
    // would have left them, then reload so the page reads them once.
    const [{ account: ACCOUNT, conv: CONV_HASH }] = await stored();
    const seed = (turn, para, start = 0, end = null, time = Date.now()) => {
      const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
      const excerpt = text.slice(start, end ?? 120).trim();
      return { account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end: end ?? text.length, excerpt, time };
    };
    // Question 3: one bookmark. Question 7: six (blocks are p, h3, p, p, p, p, li, li), two of them
    // in paragraph 2, stored out of answer order.
    const SEEDS = [seed(2, 0), seed(TURN, 5, 0, null, 1), seed(TURN, 0, 0, null, 2), seed(TURN, 2, 20, 80, 3), seed(TURN, 2, 0, null, 4), seed(TURN, 4, 0, null, 5)];
    await seedStore(SEEDS);
    const excerptOf = (turn, para, start = 0) =>
      [...SEEDS, ...saved].find((b) => b.turn === turn && b.para === para && b.start === start).excerpt;
    const ORDER = [[0], [2], [2, 20], [3], [4], [5]].map(([para, start]) => excerptOf(TURN, para, start));
    const cardState = () =>
      page.evaluate(() => {
        const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
          c = root.querySelector('.card'),
          s = getComputedStyle(c),
          r = c.getBoundingClientRect(),
          box = root.querySelector('.bmc .rows');
        const rect = (el) => {
          const q = el.getBoundingClientRect();
          return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height };
        };
        return {
          shown: c.classList.contains('show') && +s.opacity > 0.5,
          bm: c.classList.contains('bm'),
          pe: s.pointerEvents,
          meta: root.querySelector('.bmc .meta')?.textContent,
          text: root.querySelector('.bmc .one')?.textContent,
          x: root.querySelector('.bmc .meta .x') && { label: root.querySelector('.bmc .meta .x').getAttribute('aria-label'), ...rect(root.querySelector('.bmc .meta .x')) },
          rows: [...root.querySelectorAll('.bmc .it')].map((it) => ({
            text: it.querySelector('.go').textContent,
            bg: getComputedStyle(it).backgroundColor,
            xOpacity: +getComputedStyle(it.querySelector('.x')).opacity,
            xLabel: it.querySelector('.x').getAttribute('aria-label'),
            ...rect(it),
            xAt: rect(it.querySelector('.x')),
          })),
          box: box && { client: box.clientHeight, scroll: box.scrollHeight },
          rect: { x: r.left, y: r.top, w: r.width, h: r.height },
          active: root.activeElement ? { cls: root.activeElement.className, label: root.activeElement.getAttribute('aria-label'), text: root.activeElement.textContent } : null,
        };
      });
    const markFor = (r, turn) => r.marks.find((m) => Math.abs(m.y - r.ticks[turn].y - 5) <= 1);
    const hoverSegment = async (turn) => {
      await page.mouse.move(700, 300);
      await page.waitForTimeout(200);
      const r = await rail(),
        m = markFor(r, turn);
      await page.mouse.move(m.right - 4, m.y, { steps: 4 });
      await page.waitForTimeout(350);
      return m;
    };
    const shoot = async (name) => {
      const c = await cardState(),
        r = await rail();
      const y = Math.max(0, Math.min(c.rect.y, r.ticks[0].y) - 30);
      await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: 1400 - 420, y, width: 420, height: Math.max(c.rect.y + c.rect.h, r.ticks.at(-1).y) - y + 30 } });
    };
    // A wheel turn first: a user scroll ends the pin a jump leaves on its question.
    const toTop = async () => {
      await page.mouse.move(700, 400);
      await page.mouse.wheel(0, -1);
      await page.waitForTimeout(50);
      await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
      await page.waitForTimeout(300);
    };
    const cards = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2, null, { timeout: 5000 });
      await toTop();
      await hoverSegment(2);
      const single = await cardState();
      await shoot(`card-single-${theme}`);
      await hoverSegment(TURN);
      const list = await cardState();
      // Across the rail and the gap, onto the first row: the card stays and the row lights up.
      await page.mouse.move(list.rows[0].x, list.rows[0].y, { steps: 12 });
      await page.waitForTimeout(250);
      const onCard = await cardState();
      await shoot(`card-list-${theme}`);
      cards[theme] = { single, list, onCard };
    }
    const { single, list, onCard } = cards.light;
    check('one bookmark: the card shows "Bookmark · question 3 of 12", its excerpt and an ×',
      single.shown && single.bm && single.meta === 'Bookmark · question 3 of 12' && single.text === excerptOf(2, 0) &&
        single.x?.label === `Delete bookmark: ${excerptOf(2, 0)}`, { single });
    check('the single card clamps its excerpt to three lines', single.rect.h < 13 * 1.45 * 4 + 40, { h: single.rect.h });
    check('several: "Question 7 of 12 · 6 bookmarks" and the rows in answer order',
      list.shown && list.meta === 'Question 7 of 12 · 6 bookmarks' && JSON.stringify(list.rows.map((x) => x.text)) === JSON.stringify(ORDER),
      { meta: list.meta, rows: list.rows.map((x) => x.text) });
    check('five rows show and the sixth scrolls',
      list.box && Math.abs(list.box.client - 5 * list.rows[0].h) <= 1 && list.box.scroll > list.box.client + list.rows[0].h / 2, { box: list.box, row: list.rows[0].h });
    check('the card takes the pointer while it shows bookmarks', list.pe === 'auto');
    check('moving onto the card keeps it open; the hovered row has a background and an ×',
      onCard.shown && onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[0].xOpacity === 1 && onCard.rows[1].xOpacity === 0 &&
        onCard.rows[0].xLabel === `Delete bookmark: ${ORDER[0]}`, { rows: onCard.rows.slice(0, 2) });
    check('dark theme: the same cards', cards.dark.single.meta === single.meta && cards.dark.onCard.shown &&
      cards.dark.onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)', { dark: cards.dark.onCard.rows[0].bg });

    // Jump from a row: the fifth row (paragraph 4) lands 64 px below the scroller's top, card put away.
    await open('light');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2);
    await toTop();
    await hoverSegment(TURN);
    let c = await cardState();
    await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
    await page.mouse.move(c.rows[4].x, c.rows[4].y, { steps: 4 });
    await page.mouse.click(c.rows[4].x - 40, c.rows[4].y);
    await page.waitForTimeout(3500);
    check('clicking a row jumps to that bookmark', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    check('the card goes away after the jump', !(await cardState()).shown);

    // Delete the first row with its ×: the store and the card both lose it.
    await toTop();
    await hoverSegment(TURN);
    c = await cardState();
    await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    let left = (await stored()).filter((b) => b.turn === TURN);
    check('× deletes that bookmark; the card now lists five', left.length === 5 && !left.some((b) => b.para === 0) &&
      c.shown && c.meta === 'Question 7 of 12 · 5 bookmarks' && c.rows.length === 5, { left: left.length, meta: c.meta });

    // The filled button removes every bookmark in its paragraph (two in paragraph 2).
    await toTop();
    const filled = await bookmark(TURN, 2);
    check('a bookmarked paragraph: filled butter button with a dark outline, "Remove bookmark"',
      filled.kept?.on && filled.kept.tip === 'Remove bookmark' && filled.kept.fill === 'rgb(251, 224, 122)' &&
        filled.kept.stroke === 'rgb(27, 23, 15)' && filled.kept.label.startsWith('Remove bookmark: ') &&
        filled.kept.label.includes(excerptOf(TURN, 2)), { button: filled.kept });
    await page.screenshot({ path: `${shots}/button-remove-light.png`, clip: { x: filled.b.x - 60, y: filled.b.y - 50, width: 820, height: 160 } });
    await filled.click();
    await page.waitForTimeout(400);
    left = (await stored()).filter((b) => b.turn === TURN);
    check('clicking the filled button removes both bookmarks in that paragraph', left.length === 3 && !left.some((b) => b.para === 2) &&
      !(await button()).on, { left: left.map((b) => b.para) });

    // Keyboard alone: Tab into the rail, arrows to the segment, left into the card, Enter to jump.
    await toTop();
    await page.mouse.move(700, 300);
    const focused = () => page.evaluate(() => {
      const a = document.querySelector('chatgpt-butter-nav')?.shadowRoot.activeElement;
      return a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null;
    });
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 8 && !(await focused())?.cls.startsWith('tick'); k++) await page.keyboard.press('Tab');
    let f;
    for (let k = 0; k < 30; k++) {
      f = await focused();
      if (f?.cls.startsWith('mark') && f.label.startsWith('3 bookmarks')) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(250); // the card fades in
    check('arrows reach the segment; its name holds the bookmark text', f?.cls.startsWith('mark') &&
      f.label === `3 bookmarks: ${ORDER[3]}; ${ORDER[4]}; ${ORDER[5]}` && (await cardState()).shown, { f });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    f = await focused();
    check('ArrowLeft enters the card, ArrowDown moves to the next row', f?.cls === 'go' && f.text === ORDER[4], { f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);
    check('Enter on a row jumps to it', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    f = await focused();
    check('after the jump, focus is back on the segment', f?.cls.startsWith('mark'), { f });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Tab');
    f = await focused();
    check('Tab moves from a row to its ×', f?.cls === 'x' && f.label === `Delete bookmark: ${ORDER[3]}`, { f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    left = (await stored()).filter((b) => b.turn === TURN);
    f = await focused();
    check('Enter on × deletes it; focus stays in the card', left.length === 2 && !left.some((b) => b.para === 3) &&
      f?.cls === 'go' && (await cardState()).rows.length === 2, { left: left.map((b) => b.para), f });
    await page.keyboard.press('Escape');
    await page.mouse.move(700, 300);

    // The single card's × under reduced motion: the segment goes at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toTop();
    await hoverSegment(2);
    c = await cardState();
    await page.mouse.move(c.x.x, c.x.y, { steps: 12 });
    await page.mouse.click(c.x.x, c.x.y);
    await page.waitForTimeout(150);
    let r = await rail();
    check('the single card × deletes; under reduced motion the segment goes at once',
      !(await stored()).some((b) => b.turn === 2) && r.marks.length === 1 && !(await cardState()).shown, { marks: r.marks.length });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Delete question 7's last two: the last deletion fades the segment out over 160 ms.
    await hoverSegment(TURN);
    c = await cardState();
    await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    check('one left: the card turns into the single card', c.shown && c.meta === 'Bookmark · question 7 of 12' && c.text === ORDER[5], { c });
    await page.mouse.move(c.x.x, c.x.y, { steps: 6 });
    await page.mouse.click(c.x.x, c.x.y);
    const fading = await page.waitForFunction(
      () => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark')].some((m) => m.classList.contains('gone') && +getComputedStyle(m).opacity < 1),
      null, { timeout: 1000 }).then(() => true, () => false);
    await page.waitForTimeout(400);
    r = await rail();
    check('deleting the last bookmark fades the segment out, then removes it', fading && r.marks.length === 0 && !(await cardState()).shown, { fading, marks: r.marks.length });

    // Reload: every deletion is still gone.
    await open('light');
    await page.waitForTimeout(500);
    check('after a reload the deletions are still gone', (await stored()).length === 0 && (await rail()).marks.length === 0);

    // 10. First-use notice (#56). Each run below starts unacknowledged: `settings` replaces the whole
    // settings object. The first three save, check the notice and press Undo; the last presses Got it.
    const notice = () =>
      page.evaluate(() => {
        const host = document.querySelector('chatgpt-butter-bookmark-notice');
        if (!host) return { shown: false };
        const card = host.shadowRoot.querySelector('.card'),
          r = card.getBoundingClientRect();
        return {
          shown: !host.hidden && host.hasAttribute('data-visible') && !host.inert,
          lang: card.lang,
          title: card.querySelector('.t')?.textContent,
          body: card.querySelector('.d')?.textContent,
          href: card.querySelector('a')?.getAttribute('href'),
          buttons: [...card.querySelectorAll('button')].map((b) => b.textContent),
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          width: r.width,
          z: getComputedStyle(host).zIndex,
          font: getComputedStyle(card).fontFamily,
        };
      });
    const consentCard = () =>
      page.evaluate(() => {
        const host = document.querySelector('chatgpt-butter-consent');
        if (!host || host.hidden) return null;
        const r = host.shadowRoot.querySelector('.card').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, z: getComputedStyle(host).zIndex };
      });
    const press = async (which) => {
      const at = await page.evaluate((which) => {
        const b = document
          .querySelector('chatgpt-butter-bookmark-notice')
          .shadowRoot.querySelector(`button[data-notice="${which}"]`)
          .getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }, which);
      await page.mouse.click(at.x, at.y);
    };
    const acknowledged = () =>
      worker.evaluate(() => chrome.storage.local.get('butter').then(({ butter }) => butter.bookmarkNotice));
    const waitNotice = () =>
      page
        .waitForFunction(() => document.querySelector('chatgpt-butter-bookmark-notice')?.hasAttribute('data-visible'), null, {
          timeout: 5000,
        })
        .then(() => page.waitForTimeout(400)); // the 200 ms enter motion
    await seedStore([], { clear: true });
    const COPY = {
      en: {
        title: 'Bookmark saved',
        body: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove a bookmark with the × on its card in the rail. Privacy policy',
        href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.md',
        buttons: ['Undo', 'Got it'],
      },
      zh: {
        title: '书签已保存',
        body: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 即可删除。 隐私政策',
        href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.zh-CN.md',
        buttons: ['撤销', '知道了'],
      },
    };
    const built = [];
    for (const [i, run] of [
      { theme: 'light', lang: 'en', butter: {}, consent: 'declined' },
      { theme: 'dark', lang: 'en', butter: { layoutConsent: 'pending' }, consent: 'pending' },
      { theme: 'light', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: true } }, consent: 'granted' },
      { theme: 'dark', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: false } }, consent: 'layouts off' },
    ].entries()) {
      const name = `${run.theme} ${run.lang}, consent ${run.consent}`;
      await settings(run.butter);
      await open(run.theme);
      const save = await bookmark(TURN, PARA);
      check(`notice (${name}): nothing before the save`, !(await notice()).shown);
      await save.click();
      await waitNotice().catch(() => {});
      const n = await notice();
      const c = COPY[run.lang];
      check(`notice (${name}): shown after the save, with the approved copy`,
        n.shown && n.title === c.title && n.body === c.body && n.href === c.href &&
          JSON.stringify(n.buttons) === JSON.stringify(c.buttons) && n.lang === (run.lang === 'zh' ? 'zh-CN' : 'en'),
        n);
      check(`notice (${name}): the consent card's place, width and stacking`,
        // With consent pending, the consent card may already show: then the notice stacks above it.
        n.width === 300 && Math.round(1400 - n.right) === 30 && n.z === '19' &&
          (run.consent === 'pending' || Math.round(900 - n.bottom) === 82) &&
          n.font.includes('ButterConsentNunito'),
        { right: 1400 - n.right, bottom: 900 - n.bottom, width: n.width, z: n.z });
      if (run.consent === 'pending') {
        await page.waitForSelector('chatgpt-butter-consent[data-visible]', { state: 'attached', timeout: 5000 });
        await page.waitForTimeout(400);
        const [m, k] = [await notice(), await consentCard()];
        check(`notice (${name}): stacks above the pending consent card, not over it`,
          k && m.shown && m.bottom <= k.top - 12 + 0.5 && Math.abs(m.right - k.right) < 0.5, { notice: m, consent: k });
      }
      const file = `${shots}/notice-${run.theme}-${run.lang}.png`;
      // On whole pixels, as the mockup's card sits (a stacked card's top can be fractional).
      const shot = await notice();
      // The rail is hidden for this capture only: with a classic scrollbar (headed, under Xvfb) it
      // sits 15 px further left and its ticks, which stack above cards, cross the card's right edge.
      // notice-page-* below keeps the rail.
      const railHost = (v) => page.evaluate((v) => (document.querySelector('chatgpt-butter-nav').style.visibility = v), v);
      await railHost('hidden');
      await page.screenshot({
        path: file,
        clip: { x: Math.round(shot.left), y: Math.round(shot.top), width: 300, height: Math.round(shot.bottom - shot.top) },
      });
      await railHost('');
      built.push({ ...run, file });
      await page.screenshot({ path: `${shots}/notice-page-${run.theme}-${run.lang}.png` });
      check(`notice (${name}): the save drew its segment`, (await rail()).marks.length === 1);
      if (i < 3) {
        await press('undo');
        await page
          .waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 0, null, { timeout: 5000 })
          .catch(() => {});
        await page.waitForTimeout(300);
        const after = await notice();
        check(`notice (${name}): Undo deletes the bookmark, its segment goes, the notice hides unacknowledged`,
          (await stored()).length === 0 && (await rail()).marks.length === 0 && !after.shown &&
            (await acknowledged()) === undefined,
          { stored: (await stored()).length, marks: (await rail()).marks.length, after: after.shown });
      } else {
        await press('ok');
        await page.waitForTimeout(400);
        check(`notice (${name}): Got it keeps the bookmark and records the acknowledgement`,
          !(await notice()).shown && (await stored()).length === 1 && (await rail()).marks.length === 1 &&
            (await acknowledged()) === 'acknowledged');
      }
    }
    // A third save, and one after a reload: no notice.
    const third = await bookmark(TURN, 0);
    await third.click();
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1);
    await page.waitForTimeout(800);
    check('after Got it, a third save shows no notice', !(await notice()).shown && (await stored()).length === 2);
    await open('light');
    const fourth = await bookmark(2, 0);
    await fourth.click();
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2, null, { timeout: 5000 });
    await page.waitForTimeout(800);
    check('after Got it and a reload, a save shows no notice', !(await notice()).shown && (await stored()).length === 3);

    // 11. Stale bookmarks (#55). Start over with seeded bookmarks: question 10 holds one, question 7
    // three (blocks 0, 2 and 4). English, the notice already acknowledged.
    await settings({ bookmarkNotice: 'acknowledged' });
    const LONE = 9;
    const STALE_SEEDS = [seed(LONE, 0), seed(TURN, 0, 0, null, 1), seed(TURN, 2, 0, null, 2), seed(TURN, 4, 0, null, 3)];
    await seedStore(STALE_SEEDS, { clear: true });
    const staleState = () =>
      page.evaluate(() => {
        const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
          bmc = root.querySelector('.bmc'),
          one = bmc.querySelector('.one');
        return {
          shown: root.querySelector('.card').classList.contains('show'),
          stale: bmc.classList.contains('stale'),
          meta: bmc.querySelector('.meta')?.textContent,
          warn: bmc.querySelector('.warn')?.textContent ?? null,
          textColor: one && getComputedStyle(one.querySelector('span')).color,
          metaColor: getComputedStyle(bmc.querySelector('.meta')).color,
          flag: one && +getComputedStyle(bmc.querySelector('.meta .flag path')).opacity,
          one: one && (() => {
            const r = one.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })(),
          rows: [...bmc.querySelectorAll('.it')].map((it) => ({
            stale: it.classList.contains('stale'),
            why: it.querySelector('.why')?.textContent ?? null,
            color: getComputedStyle(it.querySelector('.tx')).color,
            go: it.querySelector('.go').textContent,
          })),
        };
      });
    const segments = async () => {
      const r = await rail(),
        opacity = (turn) => page.evaluate((y) => {
          const m = [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark')].find(
            (el) => Math.abs(el.getBoundingClientRect().top + 1 - y) <= 1.5);
          return m ? { stale: m.classList.contains('stale'), opacity: +getComputedStyle(m).opacity, label: m.getAttribute('aria-label') } : null;
        }, r.ticks[turn].y + 5);
      return { lone: await opacity(LONE), turn: await opacity(TURN), count: r.marks.length };
    };
    // A control in the fixture page that stands in for ChatGPT's regenerate, edit and version arrows:
    // a real click, as the user's click on ChatGPT's own button would be.
    const act = async (fn, turn) => {
      await page.evaluate(
        ([fn, turn, id, regenId, regenAttrs, regenHtml, editHtml]) => {
          let b = document.getElementById('fx');
          if (!b) {
            b = document.createElement('button');
            b.id = 'fx';
            b.textContent = 'fixture';
            b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:10';
            document.body.append(b);
          }
          b.onclick = () => {
            globalThis.fxKept ??= {};
            const m = document.querySelector(`[data-fx-answer="${id}"]`);
            if (fn === 'regen') {
              // A new answer replaces the bookmarked one in its turn; the old one is kept for the arrows.
              const n = document.createElement('div');
              n.innerHTML = `<div ${regenAttrs}><div data-markdown-text-style="assistant-message" class="markdown prose">${regenHtml}</div></div>`;
              globalThis.fxKept[turn] = m;
              m.replaceWith(n.firstChild);
            } else if (fn === 'back') document.querySelector(`[data-fx-answer="${regenId}"]`).replaceWith(globalThis.fxKept[turn]);
            else if (fn === 'edit') m.querySelector('[data-markdown-text-style]').children[2].outerHTML = editHtml;
          };
        },
        [fn, turn, answer(turn), regen(turn), answerAttrs(regen(turn)), [0, 1, 2, 3].map((k) => `<p>${REGENERATED(turn, k)}</p>`).join(''), `<p>${EDITED(turn)}</p>`],
      );
      await page.mouse.click(20, 888);
      await page.waitForTimeout(900); // the page re-checks staleness 600 ms after a click
    };
    await open('light');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2, null, { timeout: 5000 });
    await toTop();
    let seg = await segments();
    check('stale: before any change, both segments are live and full colour', seg.lone && !seg.lone.stale && seg.lone.opacity === 1 && seg.turn && !seg.turn.stale, { seg });

    // Regenerate question 10's answer and edit paragraph 2 of question 7's, in the page.
    await act('regen', LONE);
    await act('edit', TURN);
    await page.mouse.move(700, 300);
    seg = await segments();
    check('regenerated: the segment of a question whose only bookmark is stale turns pale (40 %)',
      seg.lone?.stale && Math.abs(seg.lone.opacity - 0.4) < 0.01 && seg.lone.label.endsWith('(answer changed)'), { seg });
    check('edited: one stale bookmark of three keeps the segment full colour', seg.turn && !seg.turn.stale && seg.turn.opacity === 1, { seg });
    check('nothing about staleness is stored', (await stored()).length === 4 && (await stored()).every((b) => !('stale' in b)));

    const muted = { light: 'rgb(143, 143, 143)', dark: 'rgb(163, 163, 163)' };
    await hoverSegment(LONE);
    let st = await staleState();
    check('the stale single card: "Bookmark · answer changed", grey text, faded flag and the footer',
      st.shown && st.stale && st.meta === 'Bookmark · answer changed' && st.textColor === muted.light && st.flag < 0.5 &&
        st.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { st });
    await hoverSegment(TURN);
    st = await staleState();
    check('the list: the edited paragraph\'s row is grey with "answer changed", the others are not',
      st.shown && st.rows.length === 3 && JSON.stringify(st.rows.map((r) => r.stale)) === '[false,true,false]' &&
        st.rows[1].why === 'answer changed' && st.rows[1].color === muted.light && st.rows[0].why === null && st.rows[0].color !== muted.light, { rows: st.rows });

    // A jump to a stale bookmark lands at the start of its question: from the single card's text,
    // then from the segment itself.
    const questionTop = (turn) =>
      page.evaluate((id) => document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top, question(turn));
    await toTop();
    await hoverSegment(LONE);
    st = await staleState();
    await page.mouse.move(st.one.x, st.one.y, { steps: 12 });
    await page.mouse.click(st.one.x, st.one.y);
    await page.waitForTimeout(3500);
    let atQuestion = await questionTop(LONE);
    check('clicking the stale bookmark lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    const m10 = await hoverSegment(LONE);
    await page.mouse.click(m10.right - 4, m10.y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(LONE);
    check('clicking the pale segment lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    // The edited row too; a live row still lands on its paragraph.
    await toTop();
    await hoverSegment(TURN);
    c = await cardState();
    await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
    await page.mouse.move(c.rows[1].x, c.rows[1].y, { steps: 4 });
    await page.mouse.click(c.rows[1].x - 40, c.rows[1].y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(TURN);
    check('clicking the grey row lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    await hoverSegment(TURN);
    c = await cardState();
    await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
    await page.mouse.move(c.rows[2].x, c.rows[2].y, { steps: 4 });
    await page.mouse.click(c.rows[2].x - 40, c.rows[2].y);
    await page.waitForTimeout(3500);
    check('a live row next to it still lands on its paragraph', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });

    // The original version switched back: live again.
    await toTop();
    await act('back', LONE);
    await page.mouse.move(700, 300);
    seg = await segments();
    await hoverSegment(LONE);
    st = await staleState();
    check('switched back to the original answer: the bookmark is live again', seg.lone && !seg.lone.stale && seg.lone.opacity === 1 &&
      !st.stale && st.meta === 'Bookmark · question 10 of 12' && st.warn === null, { seg, st: st.meta });

    // Regenerating every bookmarked answer under question 7 turns its segment pale.
    await act('regen', TURN);
    await page.mouse.move(700, 300);
    seg = await segments();
    check('all of question 7\'s bookmarks stale: now its segment is pale too', seg.turn?.stale && Math.abs(seg.turn.opacity - 0.4) < 0.01, { seg });

    // After a reload the regenerated answer is the conversation's version: the old message is gone
    // from the list, and the bookmark is still kept, stale, under question 10. Light and dark shots.
    page$.regen = new Set([LONE]);
    page$.edited = new Set([TURN]);
    const staleShots = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2, null, { timeout: 5000 });
      await toTop();
      seg = await segments();
      await hoverSegment(LONE);
      const single = await staleState();
      await shoot(`card-stale-${theme}`);
      await hoverSegment(TURN);
      const list = await staleState();
      c = await cardState();
      await page.mouse.move(c.rows[0].x, c.rows[0].y, { steps: 12 });
      await page.waitForTimeout(250);
      await shoot(`card-list-stale-${theme}`);
      staleShots[theme] = { seg, single, list };
    }
    for (const theme of ['light', 'dark']) {
      const { seg, single, list } = staleShots[theme];
      check(`after a reload (${theme}): the vanished message's bookmark is kept, stale and pale under question 10`,
        seg.lone?.stale && Math.abs(seg.lone.opacity - 0.4) < 0.01 && single.stale && single.textColor === muted[theme] &&
          single.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { seg, single: single.meta });
      check(`after a reload (${theme}): the edited row stays grey, its segment full colour`,
        !seg.turn?.stale && JSON.stringify(list.rows.map((r) => r.stale)) === '[false,true,false]' && list.rows[1].color === muted[theme], { rows: list.rows });
    }
    check('after the reload, all four bookmarks are still stored', (await stored()).length === 4);

    // Chinese: the stale strings.
    await settings({ lang: 'zh', bookmarkNotice: 'acknowledged' });
    await open('light');
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 2, null, { timeout: 5000 });
    await toTop();
    await hoverSegment(LONE);
    const zhSingle = await staleState();
    await hoverSegment(TURN);
    const zhList = await staleState();
    check('Chinese: "书签 · 回答已变化", its footer and the "回答已变化" row',
      zhSingle.meta === '书签 · 回答已变化' && zhSingle.warn === '找不到这一段了。点击会跳到第 10 个问题的开头。' && zhList.rows[1].why === '回答已变化',
      { meta: zhSingle.meta, warn: zhSingle.warn, why: zhList.rows[1].why });
    await settings({ bookmarkNotice: 'acknowledged' });
    page$.regen = new Set();
    page$.edited = new Set();

    await oneQuestionSection();
    await earlierSection();

    // Against the mockup's section 4, when given.
    if (process.env.BUTTER_BOOKMARKS_MOCKUP) {
      const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
      await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_MOCKUP)}`);
      // Headed (under Xvfb) Chromium draws a 15 px classic scrollbar, which moves the centred mockup
      // half a pixel off the grid; without it the layout is the headless one, on whole pixels.
      await mock.addStyleTag({ content: 'html { scrollbar-width: none }' });
      for (const b of built) {
        await mock.click(`#lang button[data-l="${b.lang}"]`);
        await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
        const reference = `${shots}/mockup-notice-${b.theme}-${b.lang}.png`;
        // Clipped on whole pixels, as the built notice is: a locator screenshot widens a card at a
        // fractional x by one pixel.
        const card = mock.locator(`.frame${b.theme === 'dark' ? '.dark' : ':not(.dark)'}[data-scene="notice"] .notice`);
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        await mock.screenshot({
          path: reference,
          clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        });
        const diff = await compare(mock, b.file, reference);
        check(`notice ${b.theme} ${b.lang} matches the mockup`, diff.ratio !== undefined && diff.ratio < 0.001, diff);
      }
      // Section 3's stale states, for a side-by-side look at card-stale-* and card-list-stale-*.
      await mock.click('#lang button[data-l="en"]');
      for (const theme of ['light', 'dark'])
        for (const [scene, name] of [['stale', 'card-stale'], ['list', 'card-list']])
          await mock
            .locator(`.frame${theme === 'dark' ? '.dark' : ':not(.dark)'}[data-scene="${scene}"]`)
            .screenshot({ path: `${shots}/mockup-${name}-${theme}.png` });
      await mock.close();
    }
  }
} finally {
  console.log('errors', JSON.stringify(errors), 'foreign', JSON.stringify(foreign));
  await fs.writeFile(`${shots}/summary.json`, JSON.stringify({ results, errors, foreign }, null, 2));
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
assert.deepEqual(errors, []);
assert.deepEqual(foreign, []);
assert.ok(results.length && results.every((r) => r.pass), 'bookmark fixture checks');
console.log(`${results.length} checks passed; screenshots in ${shots}`);
