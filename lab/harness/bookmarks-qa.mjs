// Bookmarks fixture QA (#52). The real MV3 extension in its own headless Chromium over a synthetic
// ChatGPT chat: every chatgpt.com request is answered locally (the page, /backend-api/me and the
// conversation's messages, which Butter's own fetch hook reads), and the run fails if anything
// else is requested. No ChatGPT requests.
// Checks: hover a paragraph, the button waits 120 ms, click it, the segment appears under the right
// question, clicking the segment lands on the paragraph, a reload shows the segment again, the same
// paragraph is not saved twice, the conversation's bookmarks are read once and not during scrolling,
// and with the rail off or Butter paused neither the button nor a segment shows.
// Selection and shortcut (#54): a selection's tooltip and the key Chrome reports, a selection saved
// with the button and with the shortcut (also across paragraphs), the top paragraph with the
// shortcut and nothing selected, nothing for a selection outside the answers, each landing on its
// text, and no key hint once the command's key is cleared in chrome://extensions/shortcuts.
// The shortcut must be real keyboard input (chrome.commands ignores DevTools key events): with an X
// display the browser runs headed and xtest-keys.py presses the key, so run it under xvfb-run as
// below. Without a display the run asks the worker to relay the command instead and says so.
// Run: npm ci --prefix lab/harness && xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/bookmarks-qa.mjs
// SHOTS=<dir> sets the screenshot directory (default /tmp/butter-bookmarks-qa).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOTS || '/tmp/butter-bookmarks-qa';
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
const blocks = (i) =>
  [
    `<p>${PARAGRAPH(i, 0)}</p>`,
    `<h3>Fixture heading ${i + 1}</h3>`,
    ...[1, 2, 3, 4].map((k) => `<p${k === 2 ? ' class="narrow"' : ''}>${PARAGRAPH(i, k)}</p>`),
    `<ul><li>Fixture list item one</li><li>Fixture list item two</li></ul>`,
  ].join('');
const messages = [];
for (let i = 0; i < TURNS; i++)
  messages.push(
    { id: question(i), author: { role: 'user' }, content: { content_type: 'text', parts: [QUESTION(i)] } },
    { id: answer(i), author: { role: 'assistant' }, content: { content_type: 'text', parts: ['answer'] } },
  );
const page$ = { theme: 'light' };
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
  { length: TURNS },
  (_, i) =>
    `<div><article data-turn-key="${question(i)}" data-testid="conversation-turn-${i + 1}"><div class="user"><div data-message-author-role="user" data-message-id="${question(i)}"><div data-user-message-bubble>${QUESTION(i)}</div></div></div>` +
    `<div data-message-author-role="assistant" data-message-id="${answer(i)}"><div data-markdown-text-style="assistant-message" class="markdown prose">${blocks(i)}</div></div></article></div>`,
).join('')}</div></div><script>
fetch('/backend-api/me');
fetch('/backend-api/conversation/${CONV}');
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
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages }) });
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
    TURNS,
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
    };
  });
const block = (turn, k) =>
  page.evaluate(
    ([id, k]) => {
      const el = document.querySelector(`[data-message-id="${id}"] [data-markdown-text-style]`).children[k];
      const r = el.getBoundingClientRect(),
        sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, fromTop: r.top - sc.top };
    },
    [answer(turn), k],
  );
const scrollTo = (turn) =>
  page.evaluate((id) => {
    const sc = document.querySelector('.thread-scroll-container');
    sc.scrollTop += document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - 120;
  }, question(turn));
// Select text in answer paragraphs: from `start` in paragraph k to `end` in paragraph k2.
const select = (turn, k, start, k2, end) =>
  page.evaluate(
    ([id, k, start, k2, end]) => {
      const blocks = document.querySelector(`[data-message-id="${id}"] [data-markdown-text-style]`).children;
      const r = document.createRange();
      r.setStart(blocks[k].firstChild, start);
      r.setEnd(blocks[k2].firstChild, end);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    },
    [answer(turn), k, start, k2, end],
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
    ([id, k, offset]) => {
      const node = document.querySelector(`[data-message-id="${id}"] [data-markdown-text-style]`).children[k].firstChild;
      const r = document.createRange();
      r.setStart(node, offset);
      r.setEnd(node, offset + 1);
      return r.getClientRects()[0].top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
    },
    [answer(turn), k, offset],
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

// Hover a paragraph (away from its first line), then click the button.
async function bookmark(turn, k) {
  await scrollTo(turn);
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
  await page.mouse.move(placed.x + 14, placed.y + 14, { steps: 8 }); // across the margin to the button
  const kept = await button();
  return {
    first: b,
    b: moved,
    early,
    shown,
    placed,
    kept,
    click: () => page.mouse.click(placed.x + 14, placed.y + 14),
  };
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
  check('tooltip and name say "Bookmark paragraph"', hover.shown?.tip === 'Bookmark paragraph' && hover.shown.label === 'Bookmark paragraph');
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
  const cut = await page.evaluate(
    ([id, k, n]) => {
      const p = document.querySelector(`[data-message-id="${id}"] [data-markdown-text-style]`).children[k];
      const text = p.firstChild,
        r = document.createRange(),
        top = (i) => {
          r.setStart(text, i);
          r.setEnd(text, i + 1);
          return r.getClientRects()[0].top;
        };
      const line = (i) => Math.round((top(i) - top(0)) / 26) + 1;
      return { last: line(n - 1), next: line(n + 1) };
    },
    [answer(TURN), PARA, excerpt.length],
  );
  check('the store holds one bookmark with hashed ids and the first three lines as its excerpt',
    saved.length === 1 && [saved[0].account, saved[0].conv, saved[0].msg].every((h) => /^[a-f0-9]{64}$/.test(h)) &&
      saved[0].para === PARA && saved[0].turn === TURN && TEXT.startsWith(excerpt) &&
      cut.last === 3 && cut.next === 4,
    { excerpt, length: excerpt.length, cut, para: saved[0]?.para, turn: saved[0]?.turn });
  check('no raw ids reach the store', !JSON.stringify(saved).includes(CONV) && !JSON.stringify(saved).includes(answer(TURN)));

  // 2. Duplicate: bookmarking the same paragraph again keeps one bookmark.
  const again = await bookmark(TURN, PARA);
  await again.click();
  await page.waitForTimeout(400);
  check('the same paragraph is saved once', (await stored()).length === 1 && (await rail()).marks.length === 1);

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

  // 6. Dark theme: the segment and the button in dark butter.
  await open('dark');
  await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 1);
  const dark = await rail();
  check('dark theme segment is #e3c766', dark.marks[0].color === 'rgb(227, 199, 102)', { color: dark.marks[0].color });
  await page.screenshot({ path: `${shots}/rail-dark.png`, clip: { x: 1400 - 120, y: dark.ticks[0].y - 30, width: 120, height: pitch * TURNS + 60 } });
  const hoverDark = await bookmark(2, 0);
  await page.screenshot({ path: `${shots}/button-dark.png`, clip: { x: hoverDark.b.x - 60, y: hoverDark.b.y - 50, width: 820, height: 160 } });
  check('dark theme button shows', hoverDark.shown?.shown);

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
    selHover.kept?.tip === 'Bookmark selection' && selHover.kept.label === 'Bookmark selection' && selHover.kept.kbd === 'Alt Shift M',
    { tip: selHover.kept?.tip, kbd: selHover.kept?.kbd });
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
      const p = document.querySelector(`[data-message-id="${id}"] [data-markdown-text-style]`).children[2];
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
  check('in Chinese the selection tooltip reads 为选中内容加书签', zhTip?.tip === '为选中内容加书签' && zhTip.label === '为选中内容加书签', { tip: zhTip?.tip });
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
    cleared.find((c) => c.name === 'bookmark')?.shortcut === '' && noKey.kept?.tip === 'Bookmark paragraph' && noKey.kept.kbd === '' && !noKey.kept.kbdShown,
    { cleared, kbd: noKey.kept?.kbd });

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
  await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length === 4, null, { timeout: 5000 });
  check('rail back on: the segments return', true);
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
