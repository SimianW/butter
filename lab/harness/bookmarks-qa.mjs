// Bookmarks fixture QA (#52). The real MV3 extension in its own Chromium over a synthetic
// ChatGPT chat: every chatgpt.com request is answered locally (the page, /backend-api/me and the
// conversation's messages, which Butter's own fetch hook reads), and the run fails if anything
// else is requested. No ChatGPT requests.
// Checks: hover a paragraph, the button waits 120 ms, click it, a dot appears beside the right
// question's tick (#71) with its grow-in and halo, no segment under any tick, the pointer over the
// dot shows the tick's card and a click there opens the question, the card's row lands on the
// paragraph, a reload shows the dot again, a bookmarked paragraph shows the filled button, the
// conversation's bookmarks are read once and not during scrolling, going to the home page and Back
// through history shows the dot again, and with the rail off or Butter paused neither the button
// nor a dot shows.
// A one-question chat (ONLY=one runs it alone): no rail, but the filled button and its remove work.
// The rail's hover card (#53), now the tick's card (#70): one and several bookmarks, moving onto the
// card, jumping from a row, deleting with × and the filled button, the dot fading out (at once
// under reduced motion), keyboard-only jump and delete with arrow stops on the ticks only, and light
// and dark screenshots of both cards.
// Stale bookmarks (#55): regenerating a bookmarked answer in the fixture (in the page, then as the
// conversation's current version after a reload) and editing a bookmarked paragraph: the grey row
// with "answer changed", the hollow dot only when every bookmark under the question is stale,
// the stale single card with its footer, the jump landing at the question's start, a bookmark
// turning live again when the original version is switched back, and light and dark screenshots
// of the stale cards (`card-stale-*`, `card-list-stale-*`; with BUTTER_BOOKMARKS_MOCKUP also the
// mockup's `mockup-card-stale-*` and `mockup-card-list-*` next to them). An answer that streamed in
// this tab (sent here, so no page GET lists it): its bookmark stays live once the virtualizer
// unmounts the turn, and its row still lands on the paragraph.
// First-use notice (#56): the first save shows it, Undo deletes the bookmark and its dot and the
// next save shows it again (light and dark, English and Chinese, with layout consent pending,
// declined, granted and switched off), Got it keeps it away on a third save and after a reload.
// Earlier history (#51 addendum), near the end: the chat opens with its latest 5 questions and loads
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
// The landing wash (#73), after the earlier history: see washSection (ONLY=wash runs it alone;
// BUTTER_BOOKMARKS_DOT_MOCKUP=<#69's 1-Mockup.html> adds the comparison with its section 5).
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
// `page$.asked` gives some questions other text, as the mockup's (#70).
const QUESTION = (i) => page$.asked.get(i) ?? `Fixture question ${i + 1} about query planning`;
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
// `page$.said` gives some answers other blocks, as the mockup's (#70).
const blocks = (i) =>
  page$.said.has(i)
    ? page$.said.get(i).join('')
    : page$.regen.has(i)
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
// `tail`: filler paragraphs after every answer, so that one turn fills the view (#71); `css` is added
// to the page's style.
const page$ = { theme: 'light', regen: new Set(), edited: new Set(), asked: new Map(), said: new Map(), first: 0, turns: TURNS, pageDelay: 0, pages: 0, scene: null, tail: 0, css: '' };
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
  `<div ${answerAttrs(answerId(i))}><div data-markdown-text-style="assistant-message" class="markdown prose">${blocks(i)}${'<p>Fixture filler: more of the answer.</p>'.repeat(page$.tail)}</div></div></article></div>`;
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
${page$.css}
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
  return route.fulfill({ contentType: 'text/html', body: page$.scene ? mockHtml() : html() });
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
// `radius`: the images are a card's own box with that corner radius; the corners outside it (the
// page and the shadow behind the card, which differ between the two) are left out.
// With `plain` ([a's page, b's page] without the drawing under test), pixels where those two
// already differ (the pages' own text drawn a pixel apart) are masked: `ratio` is over the rest,
// `strict` over all, `masked` the share masked. `masks`: boxes { x, y, w, h } in the images' pixels
// that are left out too. `near`: a pixel also matches when one of `b`'s within 1 px of it does (for
// marks drawn on fractions of a pixel).
async function compare(page, a, b, { radius = 0, plain = null, masks = [], near = false } = {}) {
  return page.evaluate(
    async ([a, b, radius, plain, masks, near]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [x, y, ...pl] = await Promise.all([a, b, ...(plain ?? [])].map(load));
      if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
      const data = (img) => {
        const c = new OffscreenCanvas(img.width, img.height),
          g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const p = data(x),
        q = data(y),
        [u, v] = pl.map(data);
      const w = x.width,
        h = x.height,
        out = (i, j) => {
          const dx = Math.max(0, radius - (i + 0.5), i + 0.5 - (w - radius)),
            dy = Math.max(0, radius - (j + 0.5), j + 0.5 - (h - radius));
          return dx > 0 && dy > 0 && Math.hypot(dx, dy) > radius - 1;
        };
      const off = (p, q, k) => Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24;
      let n = 0,
        px = 0,
        all = 0,
        masked = 0;
      const boxed = (i, j) => masks.some((m) => i >= m.x && i < m.x + m.w && j >= m.y && j < m.y + m.h);
      for (let k = 0; k < p.length; k += 4) {
        const i = (k / 4) % w,
          j = Math.floor(k / 4 / w);
        if (radius && out(i, j)) continue;
        if (masks.length && boxed(i, j)) continue;
        px++;
        let d = off(p, q, k);
        // `near`: a pixel matches when one of b's within 1 px of it does.
        if (d && near)
          for (let dj = -1; dj <= 1 && d; dj++)
            for (let di = -1; di <= 1 && d; di++) {
              const o = 4 * ((j + dj) * w + i + di);
              if (i + di >= 0 && i + di < w && j + dj >= 0 && j + dj < h)
                d = Math.max(Math.abs(p[k] - q[o]), Math.abs(p[k + 1] - q[o + 1]), Math.abs(p[k + 2] - q[o + 2])) > 24;
            }
        all += d;
        if (u && off(u, v, k)) masked++;
        else n += d;
      }
      return u ? { ratio: n / (px - masked), strict: all / px, masked: masked / px } : { ratio: n / px, pixels: n };
    },
    [await png(a), await png(b), radius, plain && (await Promise.all(plain.map(png))), masks, near],
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
// The rail: its ticks (each bar's box and its tick's name), the bookmark dots beside them (#71), and
// `marks`, the segments (only the earlier-history dots keep one).
const rail = () =>
  page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, right: r.right };
    };
    return {
      ticks: [...root.querySelectorAll('.tick .bar')].map((b) => ({ ...center(b), label: b.parentElement.getAttribute('aria-label') })),
      dots: [...root.querySelectorAll('.bdot:not(.gone)')].map((el) => {
        const s = getComputedStyle(el);
        return {
          ...center(el),
          cls: el.className,
          color: s.backgroundColor,
          ring: s.boxShadow,
          radius: s.borderRadius,
          opacity: +s.opacity,
          pe: s.pointerEvents,
          hidden: el.getAttribute('aria-hidden'),
          tag: el.tagName,
          tabIndex: el.tabIndex,
        };
      }),
      marks: [...root.querySelectorAll('.mark:not(.gone)')].map((el) => ({
        ...center(el),
        cls: el.className,
        color: getComputedStyle(el).backgroundColor,
      })),
      visible: getComputedStyle(document.querySelector('chatgpt-butter-nav')).display !== 'none',
    };
  });
// Question `turn`'s dot: on its tick's row, its right edge 4 px left of the tick's left end.
const dotBeside = (r, turn) => {
  const t = r.ticks[turn];
  return t && r.dots.find((d) => Math.abs(d.y - t.y) <= 0.6 && Math.abs(d.right - (t.left - 4)) <= 0.6);
};
// Waits for `n` bookmark dots on the rail (fading ones not counted).
const dotCount = (n, timeout = 5000) =>
  page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === n, n, { timeout });
// The card open on the rail, as the tick's card shows a question's bookmarks (#70): its name, rows,
// footer, the row box and the focused element.
const tickCard = () =>
  page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      c = root.querySelector('.card'),
      s = getComputedStyle(c),
      r = c.getBoundingClientRect(),
      box = root.querySelector('.bmc .rows'),
      a = root.activeElement;
    const rect = (el) => {
      const q = el.getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height };
    };
    return {
      shown: c.classList.contains('show') && +s.opacity > 0.5,
      merged: c.classList.contains('qb'),
      pe: s.pointerEvents,
      name: c.getAttribute('aria-label'),
      rows: c.classList.contains('qb')
        ? [...root.querySelectorAll('.bmc .it')].map((it) => {
            const tx = it.querySelector('.tx'),
              x = it.querySelector('.x'),
              dot = it.querySelector('.dot');
            return {
              text: tx.textContent,
              lines: Math.round(tx.getBoundingClientRect().height / parseFloat(getComputedStyle(tx).lineHeight)),
              stale: it.classList.contains('stale'),
              why: it.querySelector('.why')?.textContent ?? null,
              color: getComputedStyle(tx).color,
              dot: dot && { bg: getComputedStyle(dot).backgroundColor, ring: getComputedStyle(dot).boxShadow },
              bg: getComputedStyle(it).backgroundColor,
              xShown: getComputedStyle(x).display !== 'none' && +getComputedStyle(x).opacity === 1,
              xLabel: x.getAttribute('aria-label'),
              ...rect(it),
              xAt: rect(x),
            };
          })
        : [],
      warn: root.querySelector('.bmc .warn')?.textContent ?? null,
      box: box && { client: box.clientHeight, scroll: box.scrollHeight },
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      active: a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null,
    };
  });
// Hover question `turn`'s tick, on its row.
const hoverTick = async (turn) => {
  await page.mouse.move(700, 300);
  await page.waitForTimeout(200);
  const t = (await rail()).ticks[turn];
  await page.mouse.move(t.x, t.y, { steps: 4 });
  await page.waitForTimeout(350);
  return t;
};
// From the tick across the gap onto row k of its card, the pointer resting on its text.
const ontoRow = async (k) => {
  const c = await tickCard();
  await page.mouse.move(c.rows[k].x - 40, c.rows[k].y, { steps: 12 });
  await page.waitForTimeout(300);
  return tickCard();
};
// A wheel turn first: a user scroll ends the pin a jump leaves on its question.
const toTop = async () => {
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, -1);
  await page.waitForTimeout(50);
  await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
  await page.waitForTimeout(300);
};
const questionTop = (turn) =>
  page.evaluate(
    (id) => document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top,
    question(turn),
  );
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
// From the top of the chat, click row k of question `turn`'s card (its tick holds a dot) and wait
// for the jump.
async function jumpByRow(turn, k = 0) {
  await toTop();
  if (!dotBeside(await rail(), turn)) return false;
  await hoverTick(turn);
  const c = await tickCard();
  if (!c.merged || !c.rows[k]) return false;
  await ontoRow(k);
  await page.mouse.click(c.rows[k].x - 40, c.rows[k].y);
  await page.waitForTimeout(3500);
  return true;
}

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
// shows the filled button and can be removed with it; with a second question its dot shows.
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
  // Saved again, then a second question: the rail shows, with the dot beside question 1.
  await (await bookmark(0, PARA)).click();
  await page.waitForTimeout(600);
  page$.turns = 2;
  await open();
  await dotCount(1).catch(() => {});
  const two = await rail();
  check('with a second question the rail shows the dot beside question 1', (await stored()).length === 1 && two.dots.length === 1 && !!dotBeside(two, 0),
    { stored: (await stored()).length, dots: two.dots.length });
  page$.turns = TURNS;
  await seedStore([], { clear: true });
}

// 13. The tick's card (#70). Hovering or focusing a tick whose question holds bookmarks shows the
// question's card with its bookmarks under the question. Questions 3, 5, 7 and 10 take the text of
// the #69 mockup's section 3 and their bookmarks its rows, so the card can be compared with the
// mockup's panels (BUTTER_BOOKMARKS_DOT_MOCKUP). ONLY=card runs this part alone.
async function cardSection() {
  await settings({ bookmarkNotice: 'acknowledged' });
  const Q7 = 'Why does Postgres ignore my index on orders.status?',
    TARGET =
      'Postgres skips an index when it expects a large share of rows to match, roughly more than 5–10% of the table. ' +
      'A sequential scan reads pages in order, which is cheaper than jumping around the heap for every matching row.',
    VACUUM = 'Run VACUUM ANALYZE after a bulk load, so the planner sees the new row counts before the next query plans against them.';
  page$.asked = new Map([
    [2, 'How do I bulk-load 2M rows quickly?'],
    [4, 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?'],
    [6, Q7],
    [9, 'Should I add a partial index?'],
  ]);
  const p = (t) => `<p>${t}</p>`;
  // Question 7's blocks: p, h3, p, p, p, p, p. Paragraph 5 no longer says what its bookmark kept.
  page$.said = new Map([
    [2, [p(VACUUM), p('Then check the plan again with EXPLAIN ANALYZE.')]],
    [6, [p("Most of the time it isn't ignoring it. The planner decided a sequential scan is cheaper."), '<h3>When a sequential scan wins</h3>',
      p(TARGET), p("Compare the planner's estimate with reality:"), p("EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';"),
      p('Run ANALYZE orders after a bulk load.'), p('A partial index on the rare statuses stays small, and the planner trusts it.')]],
  ]);
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  const row = (turn, para, start, excerpt, time) =>
    ({ account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end: start + excerpt.length, excerpt, time });
  const ROWS = [
    row(6, 2, TARGET.indexOf('roughly'), 'roughly more than 5–10% of the table. A sequential scan reads pages in order.', 1),
    row(6, 6, 0, 'A partial index on the rare statuses stays small, and the planner trusts it.', 2),
    row(6, 5, 0, 'If estimated rows are far from actual rows, run ANALYZE orders to refresh the statistics.', 3),
    row(6, 2, 0, TARGET, 4),
    row(2, 0, 0, VACUUM, 5),
    row(9, 2, 0, "Use a partial index when only a few statuses are queried often, for example WHERE status IN ('pending', 'failed').", 6),
  ];
  // Question 7's rows in answer order: paragraph 2 (twice), 5 (stale), 6.
  const ORDER = [ROWS[3], ROWS[0], ROWS[2], ROWS[1]].map((b) => b.excerpt);
  await seedStore(ROWS, { clear: true });
  const marked = () => dotCount(3);
  const tickCard = () =>
    page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        c = root.querySelector('.card'),
        s = getComputedStyle(c),
        r = c.getBoundingClientRect(),
        text = c.querySelector(':scope > .text'),
        box = root.querySelector('.bmc .rows');
      const rect = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height };
      };
      return {
        shown: c.classList.contains('show') && +s.opacity > 0.5,
        merged: c.classList.contains('qb'),
        role: c.getAttribute('role'),
        name: c.getAttribute('aria-label'),
        inert: c.inert,
        pe: s.pointerEvents,
        meta: getComputedStyle(c.querySelector(':scope > .meta')).display === 'none' ? null : c.querySelector(':scope > .meta').textContent,
        text: getComputedStyle(text).display === 'none' ? null : text.textContent,
        textLines: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)),
        rows: getComputedStyle(root.querySelector('.bmc')).display === 'none' ? [] : [...root.querySelectorAll('.bmc .it')].map((it) => {
          const dot = it.querySelector('.dot'),
            tx = it.querySelector('.tx'),
            x = it.querySelector('.x');
          return {
            text: tx.textContent,
            lines: Math.round(tx.getBoundingClientRect().height / parseFloat(getComputedStyle(tx).lineHeight)),
            tag: it.querySelector('.why')?.textContent ?? null,
            stale: it.classList.contains('stale'),
            color: getComputedStyle(tx).color,
            dot: dot && { w: dot.getBoundingClientRect().width, bg: getComputedStyle(dot).backgroundColor, ring: getComputedStyle(dot).boxShadow },
            bg: getComputedStyle(it).backgroundColor,
            xShown: getComputedStyle(x).display !== 'none' && +getComputedStyle(x).opacity === 1,
            xLabel: x.getAttribute('aria-label'),
            ...rect(it),
            xAt: rect(x),
          };
        }),
        flags: root.querySelectorAll('.bmc .flag').length,
        warn: root.querySelector('.bmc .warn')?.textContent ?? null,
        box: box && { client: box.clientHeight, scroll: box.scrollHeight },
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      };
    });
  const tickName = (turn) =>
    page.evaluate((turn) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')[turn].getAttribute('aria-label'), turn);
  const toTop = async () => {
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, -1);
    await page.waitForTimeout(50);
    await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
    await page.waitForTimeout(300);
  };
  // On the tick's row.
  const hoverTick = async (turn) => {
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    const t = (await rail()).ticks[turn];
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await page.waitForTimeout(350);
    return t;
  };
  // From the tick across the gap onto row k, then the pointer rests on its text.
  const ontoRow = async (k) => {
    const c = await tickCard();
    await page.mouse.move(c.rows[k].x - 40, c.rows[k].y, { steps: 12 });
    await page.waitForTimeout(300);
    return tickCard();
  };
  // The card's own box, on whole pixels; `at` keeps its fractional position for the mockup.
  const built = [];
  const shoot = async (panel) => {
    const { rect } = await tickCard(),
      file = `${shots}/${panel}.png`;
    await page.screenshot({ path: file, clip: { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) } });
    built.push({ panel, file, at: rect });
  };
  const LIGHT_DOT = 'rgb(211, 158, 16)',
    DARK_DOT = 'rgb(227, 199, 102)';
  const seen = {};
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await marked();
    await toTop();
    await hoverTick(6);
    const many = await tickCard();
    const onCard = await ontoRow(1);
    await shoot(`f-many-${theme}`);
    await hoverTick(2);
    const one = await ontoRow(0);
    if (theme === 'light') await shoot('f-one-light');
    await hoverTick(9);
    const stale = await ontoRow(0);
    if (theme === 'dark') await shoot('f-stale-dark');
    await hoverTick(4);
    const plain = await tickCard();
    if (theme === 'dark') await shoot('f-plain-dark');
    seen[theme] = { many, onCard, one, stale, plain };
  }
  const { many, onCard, one, stale, plain } = seen.light;
  check('a tick that holds bookmarks: its card shows the meta line, the question and the rows in answer order',
    many.shown && many.merged && many.meta === '7 / 12' && many.text === Q7 && JSON.stringify(many.rows.map((r) => r.text)) === JSON.stringify(ORDER),
    { meta: many.meta, text: many.text, rows: many.rows.map((r) => r.text) });
  check('the card is 280 px wide, a group named "Question 7 of 12 · 4 bookmarks", and takes the pointer',
    Math.abs(many.rect.w - 280) < 0.5 && many.role === 'group' && many.name === 'Question 7 of 12 · 4 bookmarks' && !many.inert && many.pe === 'auto',
    { w: many.rect.w, role: many.role, name: many.name, inert: many.inert, pe: many.pe });
  check('the question is clamped to two lines; the rows are one line each', many.textLines <= 2 && many.rows.every((r) => r.lines === 1),
    { textLines: many.textLines, lines: many.rows.map((r) => r.lines) });
  check('each row starts with a 5 px dot, #d39e10 in light theme, hollow for the stale row; no flag',
    many.flags === 0 && many.rows.every((r) => r.dot?.w === 5) &&
      many.rows.filter((r) => !r.stale).every((r) => r.dot.bg === LIGHT_DOT) &&
      many.rows[2].dot.bg === 'rgba(0, 0, 0, 0)' && many.rows[2].dot.ring.includes(LIGHT_DOT) && many.rows[2].dot.ring.includes('inset'),
    { dots: many.rows.map((r) => r.dot), flags: many.flags });
  check('the stale row is grey and ends with "answer changed"; the others have no tag',
    many.rows[2].stale && many.rows[2].tag === 'answer changed' && many.rows[2].color === 'rgb(143, 143, 143)' &&
      many.rows.filter((r) => !r.stale).every((r) => r.tag === null && r.color !== 'rgb(143, 143, 143)'),
    { rows: many.rows.map((r) => [r.tag, r.color]) });
  check('moving onto the card keeps it open; the hovered row has the hover background and an ×, the others no ×',
    onCard.shown && onCard.merged && onCard.rows[1].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[1].xShown &&
      onCard.rows[1].xLabel === `Delete bookmark: ${ORDER[1]}` && !onCard.rows[0].xShown && !onCard.rows[3].xShown,
    { rows: onCard.rows.map((r) => [r.bg, r.xShown]) });
  check('one bookmark: a single row whose text runs to three lines, no tag, no footer',
    one.shown && one.merged && one.meta === '3 / 12' && one.name === 'Bookmark · question 3 of 12' && one.rows.length === 1 &&
      one.rows[0].text === VACUUM && one.rows[0].lines >= 2 && one.rows[0].lines <= 3 && one.rows[0].tag === null && one.warn === null,
    { meta: one.meta, name: one.name, rows: one.rows.map((r) => [r.text, r.lines]), warn: one.warn });
  check("one stale bookmark: grey text, a hollow dot, no tag, and the footer about the paragraph that can't be found",
    stale.shown && stale.merged && stale.meta === '10 / 12' && stale.rows.length === 1 && stale.rows[0].stale && stale.rows[0].tag === null &&
      stale.rows[0].color === 'rgb(143, 143, 143)' && stale.rows[0].dot.bg === 'rgba(0, 0, 0, 0)' &&
      stale.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.",
    { rows: stale.rows.map((r) => [r.tag, r.color, r.dot]), warn: stale.warn });
  check("a tick without bookmarks: today's card, unchanged and inert",
    plain.shown && !plain.merged && plain.role === 'tooltip' && plain.inert && plain.pe === 'none' && plain.meta === '5 / 12' &&
      plain.text === 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?' && plain.rows.length === 0,
    { plain: { ...plain, rows: plain.rows.length } });
  check('dark theme: the same card, its dots #e3c766',
    seen.dark.many.merged && seen.dark.many.rows.filter((r) => !r.stale).every((r) => r.dot.bg === DARK_DOT) &&
      seen.dark.many.rows[2].dot.ring.includes(DARK_DOT) && seen.dark.onCard.shown && seen.dark.stale.warn === stale.warn && !seen.dark.plain.merged,
    { dots: seen.dark.many.rows.map((r) => r.dot) });
  check("the tick's name appends the bookmarks' count and text, the stale one marked",
    (await tickName(6)) === `${Q7} · 4 bookmarks: ${ORDER[0]}; ${ORDER[1]}; ${ORDER[2]} (answer changed); ${ORDER[3]}` &&
      (await tickName(4)) === 'What does EXPLAIN ANALYZE actually measure, and why is it slower than the query itself?',
    { seven: await tickName(6), five: await tickName(4) });

  // Clicks. The tick still opens its question.
  await open('light');
  await marked();
  await toTop();
  let t = await hoverTick(6);
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(3500);
  const questionTop = (turn) =>
    page.evaluate((id) => document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top, question(turn));
  check('clicking a tick that holds bookmarks lands on its question', Math.abs((await questionTop(6)) - 64) <= 3, { fromTop: await questionTop(6) });
  // A row jumps to its bookmark (the last row: paragraph 6) and the card closes.
  await toTop();
  await hoverTick(6);
  let c = await ontoRow(3);
  await page.mouse.click(c.rows[3].x - 40, c.rows[3].y);
  await page.waitForTimeout(3500);
  check('clicking a row lands on its bookmark', Math.abs((await block(6, 6)).fromTop - 64) <= 3, { fromTop: (await block(6, 6)).fromTop });
  check('the card closes after a row is clicked', !(await tickCard()).shown);
  // × deletes that bookmark: the first row.
  await toTop();
  await hoverTick(6);
  c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  await page.waitForTimeout(400);
  c = await tickCard();
  let left = (await stored()).filter((b) => b.turn === 6);
  check('× deletes that bookmark; the card stays open with the rest', left.length === 3 && !left.some((b) => b.para === 2 && b.start === 0) &&
    c.shown && c.merged && c.name === 'Question 7 of 12 · 3 bookmarks' && c.rows.length === 3, { left: left.length, name: c.name });
  // The last one: question 3's only bookmark. Its card closes.
  await hoverTick(2);
  c = await ontoRow(0);
  await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
  await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
  await page.waitForTimeout(400);
  check("× on a question's last bookmark deletes it and closes the card", !(await stored()).some((b) => b.turn === 2) && !(await tickCard()).shown);

  // Keyboard alone: Tab into the rail, arrows to tick 7, ArrowLeft into its card.
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
    if (f?.cls.startsWith('tick') && f.label.startsWith(Q7)) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.waitForTimeout(250);
  c = await tickCard();
  check('focusing a tick that holds bookmarks shows its card', f?.label.startsWith(`${Q7} · 3 bookmarks: `) && c.shown && c.merged, { f, merged: c.merged });
  await page.keyboard.press('ArrowLeft');
  f = await focused();
  const first = f;
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  f = await focused();
  check('ArrowLeft focuses the first row; ArrowDown moves between rows',
    first?.cls === 'go' && first.text.startsWith(ORDER[1]) && f?.cls === 'go' && f.text === ORDER[3], { first, f });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  f = await focused();
  check('Enter on a row jumps to it; focus ends on the tick', Math.abs((await block(6, 6)).fromTop - 64) <= 3 && f?.cls.startsWith('tick') && f.label.startsWith(Q7),
    { fromTop: (await block(6, 6)).fromTop, f });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  left = (await stored()).filter((b) => b.turn === 6);
  f = await focused();
  check('Delete removes the focused row; focus stays in the card', left.length === 2 && !left.some((b) => b.para === 2) &&
    f?.cls === 'go' && (await tickCard()).rows.length === 2, { left: left.map((b) => b.para), f });
  await page.keyboard.press('ArrowRight');
  f = await focused();
  const back = f;
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  f = await focused();
  check('ArrowRight and Escape return to the tick', back?.cls.startsWith('tick') && back.label.startsWith(Q7) && f?.cls.startsWith('tick') && f.label.startsWith(Q7), { back, f });

  // Reload: both deletions are still gone.
  await page.evaluate(() => document.activeElement?.blur());
  await open('light');
  await page.waitForTimeout(500);
  const after = await stored();
  check('after a reload the deleted bookmarks are still gone', after.length === 3 && !after.some((b) => b.turn === 2) &&
    after.filter((b) => b.turn === 6).length === 2 && (await tickName(2)) === 'How do I bulk-load 2M rows quickly?', { stored: after.map((b) => [b.turn, b.para]) });

  // Against the #69 mockup's section 3, when given: the card's own box in each panel.
  if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) {
    const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
    await mock.addStyleTag({ content: 'html { scrollbar-width: none } .ann, .ring { display: none }' });
    await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    for (const b of built) {
      const card = mock.locator(`[data-panel="${b.panel}"] .card`);
      await card.scrollIntoViewIfNeeded();
      // The mockup centres its card with translateY(-50%), which puts a card of odd height on half a
      // pixel and moves some lines' text by a pixel. Lift it by a whole number of pixels instead and
      // put it on the built card's fraction of a pixel, so both draw on the same grid.
      const frac = (v) => v - Math.floor(v);
      await card.evaluate((el) => (el.style.transform = `translateY(${-Math.round(el.offsetHeight / 2)}px)`));
      const box = await card.boundingBox();
      await card.evaluate((el, [dx, dy]) => {
        const s = getComputedStyle(el);
        el.style.right = `${parseFloat(s.right) - dx}px`;
        el.style.top = `${parseFloat(s.top) + dy}px`;
      }, [frac(b.at.x) - frac(box.x), frac(b.at.y) - frac(box.y)]);
      const moved = await card.boundingBox(),
        reference = `${shots}/mockup-${b.panel}.png`;
      await mock.screenshot({ path: reference, clip: { x: Math.floor(moved.x), y: Math.floor(moved.y), width: Math.round(b.at.w), height: Math.round(b.at.h) } });
      const diff = await compare(mock, b.file, reference, { radius: 12 });
      check(`the card matches the mockup's ${b.panel}`, diff.ratio !== undefined && diff.ratio < 0.001,
        { ...diff, built: [b.at.w, b.at.h], mockup: [moved.width, moved.height] });
    }
    await mock.close();
  }
  page$.asked = new Map();
  page$.said = new Map();
  await seedStore([], { clear: true });
}

// 14. The dot (#71), as the #69 mockup draws it. A 12-question chat at rest with the question being
// read lit (`f-after-*`: questions 3, 7 and 10 hold bookmarks, 10's all stale), then the mockup's
// close-ups at three times their size: a 7-question chat at rest in both themes (`s-rest-*`), under
// the pointer (`s-wave-light`), with a new bookmark at its halo's widest (`s-new-light`), and a
// 22-question chat 5 px apart (`s-dense-light`). Each answer runs past the view, so only the
// question jumped to is lit, as in the mockup. With BUTTER_BOOKMARKS_DOT_MOCKUP each shot is
// compared with its panel: the rail's own box for `f-after-*`, the strip's box otherwise. Also the
// dot's gap through every frame of the hover wave, its motion under reduced motion, and no dot with
// the rail off or Butter paused, back after a reload. ONLY=dot runs this part alone.
async function dotSection() {
  await settings({ bookmarkNotice: 'acknowledged' });
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  const live = (turn, time, para = 0) => {
    const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
    return { account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start: 0, end: text.length, excerpt: text.slice(0, 120).trim(), time };
  };
  const gone = (turn, time) => ({ ...live(turn, time, 2), excerpt: 'A paragraph this answer no longer has.' });
  page$.tail = 40;
  const LIGHT_DOT = 'rgb(211, 158, 16)',
    DARK_DOT = 'rgb(227, 199, 102)';
  const railBox = () =>
    page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.rail').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  // Jump to question `turn` with its tick, then the pointer leaves: that question alone is lit.
  const readAt = async (turn) => {
    const t = await hoverTick(turn);
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(3500);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(1200);
  };
  const lit = (r) => r.ticks.map((t, i) => [i, Math.round(t.w * 10) / 10]).filter(([, w]) => w !== 12);
  // Each tick's own box in the strip's device pixels, 1 px around it. `first`: the first tick's row,
  // in px below the strip's top. The strip ends at the rail's right edge, 6 px right of the ticks.
  const ticksOut = (r, first) =>
    r.ticks.map((t) => ({
      x: Math.floor((t.left - (t.right + 6) + 154 / 3 - 1) * 3),
      y: Math.floor((t.y - (r.ticks[0].y - first) - 3) * 3),
      w: Math.ceil((t.w + 2) * 3),
      h: 18,
    }));
  const built = [];
  // The strip: the rail from 8 px above its first tick's row, at three times its size (device pixels
  // through the DevTools protocol; the mockup draws it at 3x in CSS px). The mockup's strip box is
  // 154 x 394 inside its frame's 1 px border, its ticks 18 px from its right: here, 154 x 394 device
  // pixels ending at the rail's right edge.
  const strip = async (panel, masks = [], near = false) => {
    const r = await railBox(),
      file = `${shots}/${panel}.png`,
      cdp = await context.newCDPSession(page),
      vp = page.viewportSize();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 3, mobile: false });
    await page.waitForTimeout(300);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x + 52 - 154 / 3, y: r.y + 2, width: 154 / 3, height: 394 / 3, scale: 1 } });
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    await page.waitForTimeout(200);
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    built.push({ panel, file, strip: true, masks, near });
  };

  // (a) The rail at rest: one dot per question that holds bookmarks.
  const ROWS = [live(2, 1), live(6, 2), live(6, 3, 3), gone(6, 4), live(6, 5, 4), gone(9, 6)];
  await seedStore(ROWS, { clear: true });
  const at = {};
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await dotCount(3);
    await readAt(6);
    const r = await rail();
    at[theme] = r;
    const box = await railBox(),
      file = `${shots}/f-after-${theme}.png`;
    await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    built.push({ panel: `f-after-${theme}`, file });
  }
  let r = at.light;
  const d3 = dotBeside(r, 2),
    d7 = dotBeside(r, 6),
    d10 = dotBeside(r, 9);
  check('one dot per question that holds bookmarks, whatever their number: questions 3, 7 (four) and 10', r.dots.length === 3 && d3 && d7 && d10,
    { dots: r.dots.map((d) => [d.y, d.right]) });
  check('the question being read: its 21 px tick lit, the dot still 4 px from its end', JSON.stringify(lit(r)) === '[[6,21]]' && !!d7, { lit: lit(r) });
  check('a question with one live bookmark of four keeps a solid dot; one whose only bookmark is stale has a hollow one',
    d3.color === LIGHT_DOT && d7.color === LIGHT_DOT && !d7.cls.includes('stale') &&
      d10.cls.includes('stale') && d10.color === 'rgba(0, 0, 0, 0)' && d10.ring === `${LIGHT_DOT} 0px 0px 0px 1px inset`, { d7: d7.cls, d10: [d10.color, d10.ring] });
  check('dark theme: the dots in #e3c766, the hollow ring too', at.dark.dots.length === 3 && dotBeside(at.dark, 2)?.color === DARK_DOT &&
    dotBeside(at.dark, 9)?.ring === `${DARK_DOT} 0px 0px 0px 1px inset`, { dots: at.dark.dots.map((d) => [d.color, d.ring]) });
  check('no segment under any tick', r.marks.length === 0);

  // (b) Through every frame of the hover wave each dot keeps 4 px from its tick, inside the rail.
  const frames = page.evaluate(
    () =>
      new Promise((ok) => {
        const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
          rail = root.querySelector('.rail').getBoundingClientRect(),
          out = [];
        const step = () => {
          const bars = [...root.querySelectorAll('.tick .bar')].map((b) => b.getBoundingClientRect());
          out.push(
            [...root.querySelectorAll('.bdot:not(.gone)')].map((el) => {
              const d = el.getBoundingClientRect(),
                b = bars.find((b) => Math.abs(b.top + b.height / 2 - (d.top + d.height / 2)) <= 0.6);
              return { gap: b ? b.left - d.right : null, w: b?.width, inside: d.left >= rail.left && d.right <= rail.right };
            }),
          );
          if (out.length < 60) requestAnimationFrame(step);
          else ok(out);
        };
        requestAnimationFrame(step);
      }),
  );
  const t7 = r.ticks[6];
  await page.mouse.move(t7.x, t7.y - 30, { steps: 3 });
  await page.mouse.move(t7.x, t7.y, { steps: 10 });
  const wave = (await frames).flat();
  check('through the hover wave every dot keeps its 4 px gap and stays inside the 52 px rail',
    wave.length === 180 && wave.every((x) => x.gap !== null && Math.abs(x.gap - 4) <= 0.05 && x.inside) && Math.max(...wave.map((x) => x.w)) > 30,
    { frames: wave.length, gaps: [Math.min(...wave.map((x) => x.gap)), Math.max(...wave.map((x) => x.gap))], widest: Math.max(...wave.map((x) => x.w)) });

  // (c) Rail off, then Butter paused: no dots; back on, they return after the reload.
  for (const [name, butter] of [
    ['rail off', { bookmarkNotice: 'acknowledged', opts: { rail: false } }],
    ['Butter paused', { bookmarkNotice: 'acknowledged', enabled: false }],
  ]) {
    await page.goto('about:blank');
    await settings(butter);
    await open('light').catch(() => {});
    await page.waitForTimeout(600);
    const shown = await page.evaluate(() => {
      const nav = document.querySelector('chatgpt-butter-nav');
      return nav && getComputedStyle(nav).display !== 'none' && nav.hasAttribute('data-on')
        ? [...nav.shadowRoot.querySelectorAll('.bdot')].filter((d) => d.getBoundingClientRect().width).length
        : 0;
    });
    check(`${name}: no dots`, shown === 0, { shown });
  }
  await settings({ bookmarkNotice: 'acknowledged' });
  await open('light');
  await dotCount(3);
  r = await rail();
  check('back on, after a reload: the three dots are back beside their ticks, without the grow-in',
    !!dotBeside(r, 2) && !!dotBeside(r, 6) && !!dotBeside(r, 9) && r.dots.every((d) => !d.cls.includes('new')));

  // (d) The close-ups: a 7-question chat, question 4 being read; 2 and 4 hold live bookmarks, 6 a stale one.
  page$.turns = 7;
  await seedStore([live(1, 1), live(3, 2), gone(5, 3)], { clear: true });
  for (const theme of ['light', 'dark']) {
    await open(theme);
    await dotCount(3);
    await readAt(3);
    r = await rail();
    check(`close-up (${theme}): question 4 alone is lit, dots beside 2, 4 and 6`, JSON.stringify(lit(r)) === '[[3,21]]' &&
      !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5), { lit: lit(r) });
    await strip(`s-rest-${theme}`);
  }
  // Under the pointer, on question 3's row. The mockup draws the wave without the rail's hover look,
  // which #71 doesn't change: the ticks thickening up to 1.6 times under the pointer, and the pill
  // behind the rail, whose bottom edge and shadow fall in the strip. Each tick's own box and the
  // pill's bottom edge are left out of the comparison; the dots and the rest are compared. The
  // dots sit on fractions of a pixel here: the rail moves them as it scales the ticks, drawn
  // between pixels, where the mockup's are placed and snapped to whole ones, so a pixel matches
  // when one within a device pixel of it in the mockup does.
  await open('light');
  await dotCount(3);
  await readAt(3);
  r = await rail();
  await page.mouse.move(r.ticks[2].x, r.ticks[2].y - 20, { steps: 3 });
  await page.mouse.move(r.ticks[2].x, r.ticks[2].y, { steps: 6 });
  await page.waitForTimeout(1500);
  r = await rail();
  check('under the pointer: each dot 4 px from its lengthened tick', !!dotBeside(r, 1) && !!dotBeside(r, 3) && !!dotBeside(r, 5) && r.ticks[2].w > 31,
    { widths: r.ticks.map((t) => t.w) });
  const box7 = await railBox();
  await strip('s-wave-light', [...ticksOut(r, 15), { x: 0, y: (box7.h - 2 - 14) * 3, w: 154, h: 394 }], true);
  // A new bookmark under question 2: its motion is paused as it starts, the page goes back to
  // question 4, and the dot is shot at the halo's widest (300 ms into the halo).
  await page.mouse.move(700, 300);
  await seedStore([live(3, 2), gone(5, 3)], { clear: true });
  await open('light');
  await dotCount(2);
  const made = await bookmark(1, 0);
  await made.click();
  const paused = await page
    .waitForFunction(() => {
      const d = [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot.new')][0];
      if (!d || d.getAnimations().length < 2) return null;
      d.getAnimations().forEach((a) => a.pause());
      return d.getAnimations().map((a) => a.animationName);
    })
    .then((h) => h.jsonValue());
  await readAt(3);
  await page.evaluate(() => {
    for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new').getAnimations()) a.currentTime = 480;
  });
  await page.waitForTimeout(100);
  r = await rail();
  check('a new bookmark\'s dot: grow-in, then the halo; at its widest, 4 px around the dot', JSON.stringify(paused) === '["dot-in","dot-halo"]' &&
    /4px$/.test(dotBeside(r, 1)?.ring ?? '') && JSON.stringify(lit(r)) === '[[3,21]]', { paused, ring: dotBeside(r, 1)?.ring });
  await strip('s-new-light');
  await page.evaluate(() => {
    for (const a of document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.new')?.getAnimations() ?? []) a.finish();
  });
  // Reduced motion: no grow-in, no halo, no fade.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toTop(); // a wheel turn ends the pin the jump left on question 4
  const still = await bookmark(4, 0);
  await still.click();
  await dotCount(4);
  const quiet = await page.evaluate(() =>
    [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].map((d) => d.getAnimations().length),
  );
  check('reduced motion: a new dot appears with no grow-in and no halo', quiet.every((n) => n === 0), { quiet });
  const removed = await bookmark(4, 0);
  await removed.click();
  await page.waitForTimeout(100);
  const left = await page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
  check('reduced motion: a deleted question\'s dot goes at once, with no fade', left === 3, { left });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // (e) A very long chat: 22 questions 5 px apart, question 16 being read. The scroller's box, just
  // over 212 + 22 x 5 / .85 px tall, gives a pitch of 5 px, as the mockup draws it: layout floors
  // each tick's height to 1/64 px, and rounds a fractional height, which a vertical scale avoids.
  // At this pitch a tick's top is on half a pixel, which Chrome snaps a device pixel lower at three
  // times the size than the mockup's 3x drawing in CSS px: each tick's own box is left out of the
  // comparison. The mockup draws question 10's dot (all its bookmarks stale, 3 px across) with a
  // ring; #69 decides it solid at 45 % (a 1 px ring can't be drawn under 4 px), so that dot is left
  // out too. The other dots are compared.
  page$.turns = 22;
  page$.css = `.thread-scroll-container { height: 342px; transform: scaleY(${341.42 / 342}); transform-origin: 0 0 }`;
  await seedStore([live(3, 1), live(4, 2), gone(9, 3), live(15, 4), live(18, 5)], { clear: true });
  await open('light');
  await dotCount(5);
  await readAt(15);
  r = await rail();
  const pitch = (r.ticks.at(-1).y - r.ticks[0].y) / 21,
    faint = dotBeside(r, 9);
  check('a very long chat: ticks 5 px apart, dots 3 px across, question 16 alone lit', Math.abs(pitch - 5) < 0.01 && r.dots.length === 5 &&
    [3, 4, 9, 15, 18].every((i) => dotBeside(r, i)?.w === 3) && JSON.stringify(lit(r)) === '[[15,21]]', { pitch, lit: lit(r), d: r.dots.map((d) => d.w) });
  check('ticks too close for a ring: the all-stale dot is solid at 45 %', faint && !faint.cls.includes('stale') && faint.cls.includes('faint') &&
    faint.color === LIGHT_DOT && Math.abs(faint.opacity - 0.45) < 0.001, { faint });
  const top = r.ticks[0].y - 10.5;
  await strip('s-dense-light', [
    ...ticksOut(r, 10.5),
    { x: Math.floor((faint.left - (r.ticks[0].right + 6) + 154 / 3 - 1) * 3), y: Math.floor((faint.y - top - faint.h / 2 - 1) * 3), w: 3 * (faint.w + 2) + 1, h: 3 * (faint.h + 2) + 1 },
  ]);

  page$.turns = TURNS;
  page$.tail = 0;
  page$.css = '';
  await seedStore([], { clear: true });

  // Against the #69 mockup's sections 1 and 2, when given.
  if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) {
    const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
    await mock.addStyleTag({ content: 'html { scrollbar-width: none } .ann, .ring { display: none }' });
    await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    for (const b of built) {
      const el = mock.locator(b.strip ? `[data-panel="${b.panel}"]` : `[data-panel="${b.panel}"] .rail`);
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      const box = await el.boundingBox(),
        reference = `${shots}/mockup-${b.panel}.png`;
      // A strip's own box is inside its frame's 1 px border.
      const clip = b.strip ? { x: box.x + 1, y: box.y + 1, width: 154, height: 394 } : { x: box.x, y: box.y, width: 52, height: 188 };
      await mock.screenshot({ path: reference, clip });
      const radius = b.strip ? 13 : 0,
        diff = await compare(mock, b.file, reference, { radius, masks: b.masks ?? [], near: b.near }),
        strict = b.near ? await compare(mock, b.file, reference, { radius, masks: b.masks }) : undefined,
        whole = b.masks?.length ? await compare(mock, b.file, reference, { radius }) : undefined;
      check(`the rail matches the mockup's ${b.panel}`, diff.ratio !== undefined && diff.ratio < 0.001,
        { ...diff, ...(strict && { strict }), ...(whole && { unmasked: whole }), mockupAt: [box.x, box.y] });
    }
    await mock.close();
  }
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
      // The questions' bookmark dots (#71), each with its tick's name.
      const bars = [...root.querySelectorAll('.tick .bar')];
      const dots = [...root.querySelectorAll('.bdot:not(.gone)')].map((el) => {
        const r = rect(el),
          bar = bars.find((b) => Math.abs(rect(b).y - r.y) <= 0.6);
        return { ...r, cls: el.className, label: bar?.parentElement.getAttribute('aria-label') ?? null };
      });
      const card = root.querySelector('.card'),
        bmc = root.querySelector('.bmc'),
        a = root.activeElement;
      return {
        more: !more.hidden,
        dotsY,
        busy: more.classList.contains('busy'),
        dotsMark: more.hidden ? null : (marks.find((m) => Math.abs(m.y - dotsY - 5) <= 0.6) ?? null),
        marks,
        dots,
        ticks: bars.map((b) => rect(b).y),
        tickRight: bars[0] && rect(bars[0]).right,
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
  // The dot beside question `turn`'s tick (0 = the chat's first question), among those loaded.
  // A landing near the top loads one more page, as ChatGPT does: count from the loaded ticks.
  const under = (s, turn) => {
    const i = turn - (TURNS - s.ticks.length);
    return i >= 0 && s.dots.find((m) => Math.abs(m.y - s.ticks[i]) <= 0.6);
  };
  // Records marks growing in and fading out, in the rail's own layer.
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
    await page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark:not(.gone), .bdot:not(.gone)').length === n, marks, { timeout: 5000 });
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
  check('earlier: the chat opens with its latest 5 questions and the earlier-history dots', s.ticks.length === 5 && s.more, { ticks: s.ticks.length });
  // The dots keep their segment until #72: 8 × 2 px in butter with its ring, right-aligned with the ticks.
  check('earlier: one segment on the dots, 5 px below their centre, 8 × 2 px in butter with its ring',
    !!s.dotsMark && s.dotsMark.w === 8 && s.dotsMark.h === 2 && s.dotsMark.color === 'rgb(251, 224, 122)' && s.dotsMark.shadow.includes('1px') &&
      Math.abs(s.dotsMark.right - s.tickRight) < 0.5, { dotsMark: s.dotsMark, tickRight: s.tickRight });
  check('earlier: the loaded question\'s bookmark is a dot beside its tick (question 11)', !!under(s, 10), { dots: s.dots.length });
  check('earlier: no dot beside a loaded question the bookmark isn\'t from, no segment under any tick',
    s.marks.length === 1 && s.dots.length === 1 && !under(s, 9) && !under(s, 8), { marks: s.marks.map((m) => m.y), dots: s.dots.map((m) => m.y), ticks: s.ticks });
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
  check('earlier: the bookmark moves to its real tick (question 3), its dot growing in; the dots\' segment fades out',
    !s.dotsMark && s.more && !!under(s, 2) && rec.grown >= 1 && rec.gone >= 1, { rec, dots: s.dots.length });

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
  check('earlier: Enter on a row loads and lands; focus moves to question 7\'s tick, beside its dot',
    l.landed && page$.pages === 1 && s.active?.cls.startsWith('tick') && !!under(s, 6) && under(s, 6).label === s.active.label &&
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
    !!under(s, 9)?.cls.includes('stale') && !!s.dotsMark && s.marks.length === 1 && s.dots.length === 1, { marks: s.marks.map((m) => m.cls), dots: s.dots.map((m) => m.cls) });
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

// 14. The landing wash (#73). A jump from a tick card row to a live bookmark washes its text once the
// page has stopped, instead of flashing the question's bubble: a sweep through the lines in
// reading order (about 360 ms), held 1.2 s, faded over 0.9 s, then gone with its listeners. It
// covers the bookmark's range and nothing else, keeps the text's colour, follows a scroll during the
// hold, and goes at once on a second jump, a scrollbar drag, a conversation change or a pause. A
// stale bookmark lands with the bubble flash and no wash. ONLY=wash runs this part alone.
// With BUTTER_BOOKMARKS_DOT_MOCKUP=<#69's 1-Mockup.html> it also builds the mockup's chat (its
// column, text and type) and compares the held wash with the panels l-3-light and l-sel-dark, on
// the chat column only: under 0.1% of pixels differing by more than 24 in a channel.
const WASH = 'chatgpt-butter-wash';
async function washSection() {
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  // A bookmark on block `para` of question `turn`'s answer (blocks: p, h3, p, p, p, p, li, li),
  // from `start` to `end` (the whole paragraph by default).
  const wseed = (turn, para, start = 0, end = null, text = PARAGRAPH(turn, para === 0 ? 0 : para - 1)) => ({
    account: ACCOUNT, conv: CONV_HASH, msg: sha(answer(turn)), turn, para, start, end: end ?? text.length,
    excerpt: text.slice(start, Math.min(end ?? text.length, start + 120)).trim(), time: Date.now() + para,
  });
  const T = 4,
    PARA = wseed(T, 2), // a whole paragraph, four lines
    SEL = wseed(T, 4, 20, 150), // a selection of about two lines in another one
    STALE = wseed(8, 2); // question 9's third paragraph, edited below
  await settings({ bookmarkNotice: 'acknowledged' });
  await seedStore([PARA, SEL, STALE], { clear: true });
  page$.edited.add(8);
  const sc = '.thread-scroll-container';
  if (!page) page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  // ---- Helpers. Only `rowJump` knows how a question's bookmark card opens.
  const openChat = async (theme, marks = 2) => {
    await open(theme);
    await dotCount(marks);
  };
  // Opens question `turn`'s card from its tick (#70: the tick's card holds its bookmarks), crosses
  // the gap onto the row that holds `b`'s excerpt and clicks it. The pointer stays on the tick's
  // row (its dot, #71, takes no pointer).
  const rowJump = async (turn, b) => {
    await page.mouse.move(5, 300);
    await page.waitForTimeout(150);
    const t = (await rail()).ticks[turn];
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await page.waitForTimeout(350);
    const at = await page.evaluate((text) => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        e = [...root.querySelectorAll('.card.qb.show .bmc .go')].find((x) => x.textContent.includes(text)),
        q = e?.getBoundingClientRect();
      return q && { x: q.left + Math.min(q.width / 2, 60), y: q.top + q.height / 2 };
    }, b.excerpt.slice(0, 40));
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await page.waitForTimeout(300);
    await page.mouse.click(at.x, at.y);
    await page.mouse.move(5, 300);
  };
  // Records every frame from now: the wash's boxes and how far each is filled, the layer's opacity,
  // the scroller's position and any bubble flash; and nodes added inside the answers.
  const record = () =>
    page.evaluate(([WASH, sc]) => {
      const R = (window.__wash = { frames: [], added: 0, clicks: [], stop: false });
      const fill = (s) => {
        if (s === 'none') return 1;
        const m = /inset\(([^)]*)\)/.exec(s);
        if (!m) return 1;
        const p = m[1].split(' ');
        const right = p[1] ?? p[0];
        return right.endsWith('%') ? 1 - parseFloat(right) / 100 : parseFloat(right) === 0 ? 1 : 0;
      };
      const mo = new MutationObserver((ms) => {
        for (const m of ms) R.added += [...m.addedNodes].filter((n) => n.nodeType === 1 || n.nodeType === 3).length;
      });
      for (const a of document.querySelectorAll('[data-markdown-text-style]')) mo.observe(a, { childList: true, subtree: true });
      addEventListener('click', () => R.clicks.push(performance.now()), true);
      const loop = (t) => {
        const host = document.querySelector(WASH),
          div = host?.shadowRoot.querySelector('div');
        R.frames.push({
          t,
          host: !!host,
          op: div ? +getComputedStyle(div).opacity : 0,
          boxes: div ? [...div.querySelectorAll('i')].map((i) => fill(getComputedStyle(i).clipPath)) : [],
          top: document.querySelector(sc).scrollTop,
          flash: !!document.querySelector('[data-butter-flash]'),
        });
        if (!R.stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, [WASH, sc]);
  const recorded = () => page.evaluate(() => ((window.__wash.stop = true), window.__wash));
  // The phases of the first wash in a recording, in ms.
  const phases = (R) => {
    const f = R.frames,
      i0 = f.findIndex((x) => x.host && x.boxes.length);
    if (i0 < 0) return { washed: false, flash: f.some((x) => x.flash), added: R.added };
    const t0 = f[i0].t,
      full = f.find((x, i) => i >= i0 && x.boxes.length && x.boxes.every((v) => v > 0.999)),
      fading = f.find((x, i) => i >= i0 && x.host && x.op < 0.999),
      end = f.find((x, i) => i > i0 && !x.host);
    // When each line starts and ends filling, in reading order.
    const lines = f[i0].boxes.map((_, k) => ({
      start: f.find((x, i) => i >= i0 && x.boxes[k] > 0.001)?.t - t0,
      full: f.find((x, i) => i >= i0 && x.boxes[k] > 0.999)?.t - t0,
    }));
    const around = f.filter((x) => x.t >= t0 - 50 && x.t <= t0 + 600).map((x) => x.top);
    return {
      washed: true,
      lines: f[i0].boxes.length,
      first: f[i0].boxes,
      sweep: full ? Math.round(full.t - t0) : null,
      hold: full && fading ? Math.round(fading.t - full.t) : null,
      fade: fading && end ? Math.round(end.t - fading.t) : null,
      order: lines.every((l, k) => !k || (l.start >= lines[k - 1].start && lines[k - 1].full <= l.start + 17)),
      moved: Math.max(...around) - Math.min(...around),
      flash: f.some((x) => x.flash),
      added: R.added,
      t0,
      startedAfterClick: R.clicks.length ? Math.round(t0 - R.clicks.at(-1)) : null,
    };
  };
  const washHost = () => page.evaluate((WASH) => !!document.querySelector(WASH), WASH);
  const waitWash = () => page.waitForFunction((WASH) => document.querySelector(WASH)?.shadowRoot.querySelector('i'), WASH, { timeout: 15000 });
  // The wash's boxes now, and the lines of the bookmark's text measured here: each line's text
  // rectangles joined, 2 px above and below. They match within 1 px when it covers its range only.
  const coverage = (b) =>
    page.evaluate(([WASH, id, b, PARAS]) => {
      const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[b.para];
      // The range from its offsets in the paragraph's text (the mockup's chat has a span in it).
      const r = document.createRange(),
        w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(), at = 0; n; at += n.data.length, n = w.nextNode()) {
        if (b.start >= at && b.start < at + n.data.length) r.setStart(n, b.start - at);
        if (b.end > at && b.end <= at + n.data.length) r.setEnd(n, b.end - at);
      }
      const lines = [];
      for (const q of r.getClientRects()) {
        if (!q.width) continue;
        const l = lines.find((x) => Math.abs(x.top - q.top) < 4);
        if (l) ((l.left = Math.min(l.left, q.left)), (l.right = Math.max(l.right, q.right)));
        else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
      }
      const host = document.querySelector(WASH),
        boxes = host ? [...host.shadowRoot.querySelectorAll('i')].map((i) => i.getBoundingClientRect()) : [];
      const want = lines.map((l) => ({ left: l.left, right: l.right, top: l.top - 2, bottom: l.bottom + 2 }));
      const ok = boxes.length === want.length && boxes.every((q, k) => ['left', 'right', 'top', 'bottom'].every((s) => Math.abs(q[s] - want[k][s]) <= 1));
      const clip = host?.shadowRoot.querySelector('div').getBoundingClientRect(),
        s = host && getComputedStyle(host),
        box = boxes[0],
        hit = box && document.elementFromPoint(box.left + 10, box.top + box.height / 2);
      return {
        ok,
        boxes: boxes.map((q) => [q.left, q.top, q.width, q.height].map(Math.round)),
        want: want.map((q) => [q.left, q.top, q.right - q.left, q.bottom - q.top].map(Math.round)),
        // Rounded at the range's start and end only, as one highlight broken across lines.
        radius: host && [...host.shadowRoot.querySelectorAll('i')].map((i) => getComputedStyle(i).borderRadius).join(' / '),
        color: host && getComputedStyle(host.shadowRoot.querySelector('i')).backgroundColor,
        blend: s?.mixBlendMode,
        pointer: s?.pointerEvents,
        clipTop: clip && Math.round(clip.top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top),
        through: !!hit && el.contains(hit),
        inAnswer: !!el.closest('article').querySelector(WASH),
      };
    }, [WASH, answer(b.turn), b, PARAS]);
  // Listeners on the chat scroller (scroll) and the window (resize), by CDP, as Butter's content
  // scripts added them (their own world: DevTools lists a world's listeners only from inside it).
  const butterWorld = async () => {
    const contexts = [];
    const on = (e) => contexts.push(e.context);
    cdp.on('Runtime.executionContextCreated', on);
    await cdp.send('Runtime.enable');
    await cdp.send('Runtime.disable');
    cdp.off('Runtime.executionContextCreated', on);
    return contexts.findLast((c) => c.auxData?.type === 'isolated' && c.origin.startsWith('chrome-extension://') && c.auxData.isDefault === false)?.id;
  };
  const listeners = async () => {
    const contextId = await butterWorld();
    const of = async (expression, type) => {
      const { result } = await cdp.send('Runtime.evaluate', { expression, contextId });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      return listeners.filter((l) => l.type === type).length;
    };
    return { world: !!contextId, scroll: await of(`document.querySelector('${sc}')`, 'scroll'), resize: await of('window', 'resize') };
  };
  // The text's own colour under the wash: the darkest (light theme) or lightest (dark theme) pixel
  // inside the first box, from a screenshot.
  const textUnder = async (theme) => {
    const box = await page.evaluate((WASH) => {
      const q = document.querySelector(WASH).shadowRoot.querySelector('i').getBoundingClientRect();
      return { x: Math.round(q.left) + 2, y: Math.round(q.top) + 3, width: Math.round(q.width) - 4, height: Math.round(q.height) - 6 };
    }, WASH);
    const file = `${shots}/wash-text-${theme}.png`;
    await page.screenshot({ path: file, clip: box });
    return page.evaluate(async ([src, dark]) => {
      const i = new Image();
      await new Promise((r) => ((i.onload = r), (i.src = src)));
      const c = new OffscreenCanvas(i.width, i.height),
        g = c.getContext('2d');
      g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, i.width, i.height).data;
      let best = null;
      for (let k = 0; k < d.length; k += 4) {
        const v = d[k] + d[k + 1] + d[k + 2];
        if (!best || (dark ? v > best.v : v < best.v)) best = { v, rgb: [d[k], d[k + 1], d[k + 2]] };
      }
      return best.rgb;
    }, [await png(file), theme === 'dark']);
  };

  // (a) A paragraph, from the top of the chat: a far trip.
  await openChat('light');
  const idle = await listeners();
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForTimeout(800); // into the hold
  const cover = await coverage(PARA),
    during = await listeners(),
    ink = await textUnder('light');
  await page.screenshot({ path: `${shots}/wash-paragraph-light.png` });
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  await page.waitForTimeout(100);
  let p = await phases(await recorded());
  const after = await listeners();
  check('wash: a row jump to a paragraph washes it, starting only once the page has stopped', p.washed && p.moved <= 2 && p.startedAfterClick > 0, p);
  check('wash: no bubble flash on that trip', p.washed && !p.flash);
  check('wash: one box per line over exactly the bookmarked paragraph, 2 px above and below, rounded 3 px at its start and end',
    cover.ok && cover.boxes.length > 1 && cover.radius === ['3px 0px 0px 3px', ...Array(cover.boxes.length - 2).fill('0px'), '0px 3px 3px 0px'].join(' / ') && cover.color === 'rgba(251, 224, 122, 0.62)', cover);
  check('wash: the sweep fills the lines in reading order in about 360 ms', p.order && Math.abs(p.sweep - 360) <= 50, { sweep: p.sweep, first: p.first });
  check('wash: held about 1.2 s, then faded over about 0.9 s', Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, { hold: p.hold, fade: p.fade });
  check('wash: afterwards the layer is gone, and so are its scroll and resize listeners',
    !(await washHost()) && idle.world && during.scroll === idle.scroll + 1 && during.resize === idle.resize + 1 && after.scroll === idle.scroll && after.resize === idle.resize,
    { idle, during, after });
  check('wash: Butter\'s own layer, multiplied in light theme, under the header, taking no pointer events; nothing added inside the answer',
    cover.blend === 'multiply' && cover.pointer === 'none' && cover.through && cover.clipTop === 52 && !cover.inAnswer && p.added === 0, { ...cover, added: p.added });
  check('wash: the text keeps its colour in light theme', Math.max(...ink) <= 40, { ink });
  console.log('wash phases (paragraph, far trip)', JSON.stringify({ sweep: p.sweep, hold: p.hold, fade: p.fade }));

  // (b) A selection, from near by (a glide); a scroll during the hold keeps it on its text.
  await record();
  await rowJump(T, SEL);
  await waitWash();
  await page.waitForTimeout(700);
  const selCover = await coverage(SEL),
    top0 = await page.evaluate((sc) => document.querySelector(sc).scrollTop, sc);
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(250);
  const scrolled = await coverage(SEL),
    dy = (await page.evaluate((sc) => document.querySelector(sc).scrollTop, sc)) - top0;
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  p = await phases(await recorded());
  check('wash: a bookmarked selection washes that text only, not its whole paragraph', p.washed && !p.flash && p.moved <= 2 && selCover.ok && selCover.boxes.length >= 2, { ...selCover, moved: p.moved });
  check('wash: it stays on its text while the chat scrolls during the hold',
    dy > 20 && scrolled.ok && Math.abs(scrolled.boxes[0][1] - (selCover.boxes[0][1] - dy)) <= 1, { dy, before: selCover.boxes[0], after: scrolled.boxes[0] });
  console.log('wash phases (selection, glide)', JSON.stringify({ sweep: p.sweep, hold: p.hold, fade: p.fade }));

  // (c) Removed at once: a second jump, a scrollbar drag, a conversation change, Butter paused.
  const goneIn = async (act) => {
    await waitWash();
    await page.waitForTimeout(600);
    await page.evaluate((WASH) => {
      window.__gone = null;
      const at = performance.now();
      new MutationObserver((ms, o) => {
        if (!document.querySelector(WASH)) {
          window.__gone = performance.now() - at;
          o.disconnect();
        }
      }).observe(document.body, { childList: true });
    }, WASH);
    await act();
    await page.waitForFunction(() => window.__gone !== null, null, { timeout: 3000 }).catch(() => {});
    return page.evaluate(() => window.__gone);
  };
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await rowJump(T, PARA);
  const second = await goneIn(async () => {
    const r = await rail();
    await page.mouse.click(r.ticks[1].right - 4, r.ticks[1].y);
  });
  check('wash: a second jump removes it at once', second !== null && second < 200, { ms: second });
  await page.waitForTimeout(3500);
  await rowJump(T, PARA);
  // A scrollbar drag: seek/preview-main.js tells the page with this event as the drag starts. (The
  // fixture's chat has no layout for the preview to engage, so the harness sends it, as the
  // preview does, and the drag's end after it.)
  const seekState = (state) =>
    page.evaluate(([conv, state, id, n]) => document.dispatchEvent(new CustomEvent('butter-seek-state', {
      detail: JSON.stringify({ conv, state, id, n, lit: [id], total: 12, unseen: false }),
    })), [CONV, state, question(T), T + 1]);
  const drag = await goneIn(() => seekState('dragging'));
  check('wash: a scrollbar drag starting (seek state "dragging") removes it at once', drag !== null && drag < 100, { ms: drag });
  await seekState('idle');
  await page.waitForTimeout(1500); // the rail's seek card goes 1 s after the drag ends
  await rowJump(T, SEL);
  const paused = await goneIn(() => settings({ enabled: false }));
  check('wash: Butter paused removes it at once', paused !== null && paused < 300, { ms: paused });
  await settings({});
  await openChat('light');
  await rowJump(T, PARA);
  // ChatGPT shows another chat: a new path, and the old chat's turns leave the page.
  const moved = await goneIn(() =>
    page.evaluate(() => {
      history.pushState({}, '', '/c/00000000-0000-4000-8000-000000000000');
      document.querySelector('.content').replaceChildren();
    }));
  check('wash: a conversation change removes it at once', moved !== null && moved < 100, { ms: moved });

  // (d) A stale bookmark: the bubble flash at its question's start, and no wash.
  await openChat('light');
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(8, STALE);
  await page.waitForTimeout(4500);
  p = await phases(await recorded());
  check('wash: a stale bookmark lands with the bubble flash and no wash', !p.washed && p.flash, p);

  // (e) Reduced motion: no sweep; it shows at once, holds 1.2 s and fades over 0.9 s.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record();
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  p = await phases(await recorded());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check('wash: under reduced motion it appears without a sweep, holds 1.2 s and fades over 0.9 s',
    p.washed && p.first.every((v) => v > 0.999) && p.sweep === 0 && Math.abs(p.hold - 1200) <= 50 && Math.abs(p.fade - 900) <= 60, p);

  // (f) Dark theme: the text keeps its colour.
  await openChat('dark');
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await rowJump(T, PARA);
  await waitWash();
  await page.waitForTimeout(800);
  const darkCover = await coverage(PARA),
    darkInk = await textUnder('dark');
  await page.screenshot({ path: `${shots}/wash-paragraph-dark.png` });
  check('wash: dark theme washes in rgb(227 199 102 / .3), lightened, and the text keeps its colour',
    darkCover.ok && darkCover.color === 'rgba(227, 199, 102, 0.3)' && darkCover.blend === 'lighten' && darkInk.every((v) => Math.abs(v - 236) <= 12),
    { ink: darkInk, blend: darkCover.blend });
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
  page$.edited.delete(8);

  if (process.env.BUTTER_BOOKMARKS_DOT_MOCKUP) await washMockup({ rowJump, waitWash, coverage, sc, record, recorded, phases });
  await seedStore([], { clear: true });
  await cdp.detach();
}

// The mockup's chat for the wash comparison: its question and answer (section 5's text, column,
// type and colours) as question 7 of the fixture chat, the other turns short; with its header and
// composer. Set by washMockup; `page$.scene` null is the usual fixture.
const MOCK_TURN = 6;
const mockHtml = () => {
  const s = page$.scene;
  const turn = (i) =>
    i === MOCK_TURN
      ? `<div><article data-turn-key="${question(i)}"><div class="user">${userOf(i).replace(QUESTION(i), s.q)}</div>` +
        `<div ${answerAttrs(answer(i))}><div data-markdown-text-style="assistant-message" class="markdown prose">${s.blocks.join('')}</div></div></article></div>`
      : `<div><article class="filler" data-turn-key="${question(i)}"><div class="user">${userOf(i)}</div>` +
        `<div ${answerAttrs(answer(i))}><div data-markdown-text-style="assistant-message" class="markdown prose"><p>Fixture answer ${i + 1}.</p></div></div></article></div>`;
  return `<!doctype html><html lang="en" class="${page$.theme}"><head><meta charset="utf-8"><title>Fixture chat</title><style>
body { margin:0; overflow:hidden; background:#fff; color:#0d0d0d; font:14.5px/1.6 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif }
.dark body { background:#212121; color:#ececec }
header { position:fixed; top:0; left:0; right:0; height:44px; background:inherit; z-index:5; display:flex; align-items:center; padding:0 16px; font-weight:600; font-size:15px }
.thread-scroll-container { height:100vh; overflow-y:scroll; overflow-anchor:none; scrollbar-width:none }
.content { padding:64px 0 600px }
article { display:block; width:386px; margin:0 0 24px 70px }
article.filler { height:300px; overflow:hidden }
.user { display:flex; justify-content:flex-end }
[data-user-message-bubble] { margin:0 0 18px; max-width:300px; padding:8px 14px; background:#f4f4f4; border-radius:18px }
.dark [data-user-message-bubble] { background:#303030 }
[data-markdown-text-style] p { margin:0 0 14px }
[data-markdown-text-style] h3 { margin:18px 0 8px; font-size:16px; font-weight:600 }
[data-markdown-text-style] pre { margin:0 0 14px; background:#f9f9f9; border:1px solid rgb(0 0 0 / .08); border-radius:10px; padding:10px 12px; font:12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space:pre-wrap }
.dark [data-markdown-text-style] pre { background:#171717; border-color:rgb(255 255 255 / .08) }
#thread-bottom-container { position:fixed; left:60px; right:100px; bottom:12px; height:44px; box-sizing:border-box; border-radius:22px; background:#f4f4f4; color:#5d5d5d; display:flex; align-items:center; padding:0 18px; font-size:14px; z-index:3 }
.dark #thread-bottom-container { background:#303030; color:#b4b4b4 }
</style></head><body><header>ChatGPT</header><div class="thread-scroll-container"><div class="content">${Array.from({ length: TURNS }, (_, i) => turn(i)).join('')}</div></div>` +
    `<div id="thread-bottom-container">Ask anything</div><script>fetch('/backend-api/me'); fetch('/backend-api/conversation/${CONV}');</script></body></html>`;
};
// Called by washSection, which defines the helpers it passes.
async function washMockup({ rowJump, waitWash, coverage, sc, record, recorded, phases }) {
  const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
  await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_DOT_MOCKUP)}`);
  // No scrollbar: the centred mockup stays on whole pixels (as for the notice above).
  await mock.addStyleTag({ content: 'html { scrollbar-width: none }' });
  await mock.click('label:has(#labels-off)');
  await mock.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
  // The panels' chat: the question, the answer's blocks, and the washed paragraph with the
  // selection's offsets in it. The wash's span stays as a plain span: the browser draws the text
  // of an inline element as a run of its own, so the glyphs match the panel's to the pixel.
  page$.scene = await mock.evaluate(() => {
    const col = document.querySelector('[data-panel="l-sel-dark"] .col').cloneNode(true),
      land = col.querySelector('.land'),
      goal = land.closest('p'),
      at = goal.textContent.indexOf(land.textContent),
      sel = [at, at + land.textContent.length];
    land.removeAttribute('class');
    land.removeAttribute('style');
    goal.removeAttribute('class');
    const q = col.querySelector('.q'),
      blocks = [...col.children].filter((e) => e !== q);
    return { q: q.innerHTML, blocks: blocks.map((e) => e.outerHTML), goal: blocks.indexOf(goal), text: goal.textContent, sel };
  });
  const s = page$.scene;
  // The chat column, below the header and above the composer's fade: x 60..470, y 44..350 of the
  // frame's inside (the mockup's frame has a 1 px border; the built window is 560 px wide, the
  // rail's minimum, and only its right edge differs).
  const REGION = { x: 60, y: 44, width: 410, height: 306 };
  await page.setViewportSize({ width: 560, height: 438 });
  for (const [theme, panel, [start, end]] of [
    ['light', 'l-3-light', [0, s.text.length]],
    ['dark', 'l-sel-dark', s.sel],
  ]) {
    const b = {
      account: sha('user-fixture'), conv: sha(CONV), msg: sha(answer(MOCK_TURN)), turn: MOCK_TURN, para: s.goal, start, end,
      excerpt: s.text.slice(start, Math.min(end, start + 120)).trim(), time: Date.now(),
    };
    await seedStore([b], { clear: true });
    await page.bringToFront(); // a tab in the background draws no frames
    await open(theme);
    await dotCount(1);
    await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
    await page.waitForTimeout(300);
    await rowJump(MOCK_TURN, b);
    await waitWash();
    await page.waitForTimeout(400);
    // Where the panel has the chat: the question's turn 457 px above the window's top. A wheel
    // turn first ends the pin the jump leaves on its landing.
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(50);
    await page.evaluate(([sc, id]) => {
      const el = document.querySelector(sc);
      el.scrollTop += document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top + 457;
    }, [sc, question(MOCK_TURN)]);
    await page.waitForTimeout(120);
    const cover = await coverage(b),
      composer = await page.evaluate((WASH) => ({
        clip: document.querySelector(WASH)?.shadowRoot.querySelector('div').getBoundingClientRect().bottom,
        composer: document.querySelector('#thread-bottom-container').getBoundingClientRect().top,
      }), WASH);
    const built = `${shots}/wash-${panel}.png`,
      holding = () =>
        page.evaluate((WASH) => {
          const d = document.querySelector(WASH)?.shadowRoot.querySelector('div');
          return !!d && +getComputedStyle(d).opacity === 1 && [...d.querySelectorAll('i')].every((i) => getComputedStyle(i).clipPath === 'none');
        }, WASH);
    const before = await holding();
    await page.screenshot({ path: built, clip: REGION });
    const held = before && (await holding());
    check(`wash mockup ${panel}: built at the hold, on the bookmarked text, clipped above the composer`,
      held && cover.ok && composer.clip === composer.composer, { held, boxes: cover.boxes, ...composer });
    // The same chat once the wash has gone, for the mask below.
    await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH, { timeout: 5000 });
    const builtPlain = `${shots}/wash-${panel}-after.png`;
    await page.screenshot({ path: builtPlain, clip: REGION });
    await mock.bringToFront();
    // The panel at the window's top left, on the built chat's pixel grid.
    const frame = mock.locator(`[data-panel="${panel}"]`);
    await frame.evaluate((el) => Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 99 }));
    await mock.waitForTimeout(100);
    const reference = `${shots}/mockup-${panel}.png`,
      referencePlain = `${shots}/mockup-${panel}-plain.png`,
      at = { ...REGION, x: 1 + REGION.x, y: 1 + REGION.y };
    await mock.screenshot({ path: reference, clip: at });
    await frame.evaluate((el) => el.querySelector('.land').style.setProperty('background', 'none'));
    await mock.screenshot({ path: referencePlain, clip: at });
    await frame.evaluate((el) => {
      el.style.cssText = '';
      el.querySelector('.land').style.removeProperty('background');
    });
    // Masked where the two chats differ without any wash: the same text, a glyph drawn a pixel
    // apart (a code line, a letter) by the two pages. The mask stays small or the check fails.
    const diff = await compare(mock, built, reference, { plain: [builtPlain, referencePlain] });
    check(`wash: the held wash matches the mockup's ${panel} on the chat column`,
      diff.ratio !== undefined && diff.ratio < 0.001 && diff.masked < 0.005, diff);
  }
  // A bookmarked code block keeps the bubble's flash for now (#74 washes the whole block).
  const code = s.blocks.findIndex((h) => h.startsWith('<pre') && h.includes('CREATE INDEX')),
    codeText = await page.evaluate(([id, k, PARAS]) =>
      document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k].textContent, [answer(MOCK_TURN), code, PARAS]);
  const cb = {
    account: sha('user-fixture'), conv: sha(CONV), msg: sha(answer(MOCK_TURN)), turn: MOCK_TURN, para: code, start: 0, end: codeText.length,
    excerpt: codeText.slice(0, 120).trim(), time: Date.now(),
  };
  await seedStore([cb], { clear: true });
  await page.bringToFront();
  await open('light');
  await dotCount(1);
  await page.evaluate((sc) => (document.querySelector(sc).scrollTop = 0), sc);
  await page.waitForTimeout(300);
  await record();
  await rowJump(MOCK_TURN, cb);
  await page.waitForTimeout(4000);
  const cp = phases(await recorded());
  check('wash: a bookmarked code block lands with the bubble flash and no wash (for now)', code >= 0 && !cp.washed && cp.flash, { code, ...cp });
  page$.scene = null;
  await mock.close();
  await page.bringToFront();
  await page.setViewportSize({ width: 1400, height: 900 });
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
  // ONLY=earlier, ONLY=one, ONLY=card, ONLY=dot and ONLY=wash run that section alone.
  if (process.env.ONLY === 'earlier') await earlierSection();
  else if (process.env.ONLY === 'one') await oneQuestionSection();
  else if (process.env.ONLY === 'card') await cardSection();
  else if (process.env.ONLY === 'dot') await dotSection();
  else if (process.env.ONLY === 'wash') await washSection();
  else {
    await settings({});
    await open();
    const before = await rail();
    check('rail draws no dot before any bookmark', before.dots.length === 0 && before.marks.length === 0);

    // 1. Hover, wait, click: a dot appears beside question 7's tick (#71).
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
    // The new dot's motion, read before it ends: its animations, their timing and the halo's widest.
    const motion = await page
      .waitForFunction(() => {
        const d = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot');
        if (!d) return null;
        const halo = d.getAnimations().find((a) => a.animationName === 'dot-halo');
        return {
          cls: d.className,
          easing: getComputedStyle(d).animationTimingFunction,
          anims: d.getAnimations().map((a) => ({ name: a.animationName, duration: a.effect.getTiming().duration, delay: a.effect.getTiming().delay, iterations: a.effect.getTiming().iterations })),
          grow: d.getAnimations().find((a) => a.animationName === 'dot-in')?.effect.getKeyframes().map((k) => k.scale),
          halo: halo?.effect.getKeyframes().find((k) => k.offset === 0.5)?.boxShadow,
        };
      })
      .then((h) => h.jsonValue());
    await page.waitForTimeout(60);
    const made = await rail();
    const tick = made.ticks[TURN],
      pitch = made.ticks[1].y - made.ticks[0].y;
    check("one dot, beside question 7's tick: on its row, its right edge 4 px left of the tick", made.dots.length === 1 && !!dotBeside(made, TURN),
      { dot: made.dots[0], tick });
    check('no segment under any question\'s tick', made.marks.length === 0 &&
      (await page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.mark').length)) === 0);
    check('the new dot grows in from 0 over 180 ms, cubic-bezier(.2, .8, .2, 1), then one 600 ms halo, 4 px, at 35 %',
      motion.cls.includes('new') && motion.easing.startsWith('cubic-bezier(0.2, 0.8, 0.2, 1)') &&
        JSON.stringify(motion.anims) === JSON.stringify([{ name: 'dot-in', duration: 180, delay: 0, iterations: 1 }, { name: 'dot-halo', duration: 600, delay: 180, iterations: 1 }]) &&
        motion.grow?.[0] === '0' && / 4px$/.test(motion.halo) && /\/ 0\.35\)/.test(motion.halo),
      motion);
    await page.waitForTimeout(900);
    const settled = (await rail()).dots[0];
    check('the dot is a 4 px circle in #d39e10; it takes no pointer events, is not focusable and is hidden from the accessibility tree',
      settled.w === 4 && settled.h === 4 && settled.radius === '50%' && settled.color === 'rgb(211, 158, 16)' && settled.opacity === 1 &&
        settled.pe === 'none' && settled.hidden === 'true' && settled.tag === 'I' && settled.tabIndex === -1,
      { settled });
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
    check('the paragraph is saved once', (await stored()).length === 1 && (await rail()).dots.length === 1);

    // 3. The dot is not a target: the pointer over it is over its tick's row, which shows the tick's card.
    await toTop();
    const r0 = await rail(),
      d0 = dotBeside(r0, TURN);
    await page.mouse.move(d0.x, d0.y, { steps: 4 });
    await page.waitForTimeout(350);
    const overDot = await tickCard();
    check("the pointer over the dot shows its tick's card", overDot.shown && overDot.merged && overDot.name === 'Bookmark · question 7 of 12',
      { name: overDot.name, merged: overDot.merged });

    // 4. A click on the dot's position opens the question; the card's row lands on the paragraph.
    await page.mouse.click(d0.x, d0.y);
    await page.waitForTimeout(3500);
    check("a click on the dot's position opens its question", Math.abs((await questionTop(TURN)) - 64) <= 3, { fromTop: await questionTop(TURN) });
    const viaRow = await jumpByRow(TURN);
    const landed = await block(TURN, PARA);
    check("clicking the bookmark's row in the tick's card lands on the bookmarked paragraph", viaRow && Math.abs(landed.fromTop - 64) <= 3, { fromTop: landed.fromTop });
    // A click on the tick itself still lands on the question.
    await toTop();
    const r1 = await rail();
    await page.mouse.click(r1.ticks[TURN].x, r1.ticks[TURN].y);
    await page.waitForTimeout(3500);
    const q = await questionTop(TURN);
    check('clicking the tick still lands on the question', Math.abs(q - 64) <= 3, { fromTop: q });

    // 5. Reload: the dot is back, without the grow-in, from one read.
    const read = (await requests())['butter-bookmark-list'] || 0;
    await open();
    await dotCount(1);
    const reloaded = await rail();
    check('after a reload the dot is beside question 7 again', reloaded.dots.length === 1 && !!dotBeside(reloaded, TURN) &&
      !reloaded.dots[0].cls.includes('new'));
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
    // comes back to it, and its dot with it; hovering the rail is not needed.
    await page.mouse.move(700, 400);
    await page.evaluate(() => history.pushState({}, '', '/'));
    await page.waitForFunction(() => !document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav').hasAttribute('data-on'), null, { timeout: 5000 });
    await page.waitForTimeout(1000);
    const backAgain = await rail();
    check('away to the home page and Back: the dot is beside question 7 again', backAgain.dots.length === 1 && !!dotBeside(backAgain, TURN),
      { dots: backAgain.dots.length });

    // 6. Dark theme: the dot and the button in dark butter.
    await open('dark');
    await dotCount(1);
    const dark = await rail();
    check('dark theme dot is #e3c766', dark.dots[0].color === 'rgb(227, 199, 102)', { color: dark.dots[0].color });
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
    check('the selection bookmark has its dot beside question 3', !!dotBeside(await rail(), 2));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking its row lands on the selected text, not the paragraph',
      (await jumpByRow(2)) && Math.abs((await textTop(2, 2, selStart)) - 64) <= 3,
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
    check('its dot is beside question 5', !!dotBeside(await rail(), 4));
    await page.evaluate(() => getSelection().removeAllRanges());
    check('clicking its row lands on the selection\'s start',
      (await jumpByRow(4)) && Math.abs((await textTop(4, 2, crossStart)) - 64) <= 3, { fromTop: await textTop(4, 2, crossStart) });

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
    check('its dot is beside question 9', !!dotBeside(await rail(), 8));
    check('clicking its row lands on that paragraph', (await jumpByRow(8)) && Math.abs((await block(8, 3)).fromTop - 64) <= 3,
      { fromTop: (await block(8, 3)).fromTop });

    // (d) A selection outside the answers (the user's question) creates nothing.
    const count = (await stored()).length;
    await scrollTo(10);
    await page.evaluate((id) => {
      const q = document.querySelector(`[data-turn-key="${id}"] [data-user-message-bubble]`);
      getSelection().selectAllChildren(q);
    }, question(10));
    await shortcut();
    check('a selection in a question creates nothing', (await stored()).length === count && !dotBeside(await rail(), 10));
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
    check('clicking its row lands on that item, not on the start of the list',
      (await jumpByRow(3)) && Math.abs((await block(3, LI)).fromTop - 64) <= 3,
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
    // Questions 4 and 6: the only ticks whose names hold the second item's text; their dots solid.
    const liRail = await rail(),
      liTicks = liRail.ticks.map((t, i) => [i, t.label]).filter(([, l]) => l.includes(LI_TEXT));
    check('after a reload the list items\' bookmarks are live', liTicks.length === 2 &&
      liTicks.every(([i, l]) => !l.includes('(answer changed)') && dotBeside(liRail, i) && !dotBeside(liRail, i).cls.includes('stale')), { liTicks });

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

    // 7. Turning the rail off live hides a shown button and the dots at once.
    await open('light');
    const live = await bookmark(TURN, PARA);
    await settings({ opts: { rail: false } });
    await page.waitForTimeout(300);
    const liveOff = await page.evaluate(() => getComputedStyle(document.querySelector('chatgpt-butter-nav')).display);
    check('rail switched off live: button and dots hide', live.kept?.shown && !(await button()).shown && liveOff === 'none', { liveOff });
    await settings({});

    // 8. Rail off, then Butter paused, from a fresh load: neither the button nor a dot.
    for (const [name, butter] of [
      ['rail off', { opts: { rail: false } }],
      ['Butter paused', { enabled: false }],
    ]) {
      // Leave the open page first: turning settings back on below would let it read, racing the count.
      await page.goto('about:blank');
      await settings(butter);
      const reads = (await requests())['butter-bookmark-list'] || 0;
      await open('light').catch(() => {});
      await page.waitForTimeout(600);
      const off = await page.evaluate(() => {
        const nav = document.querySelector('chatgpt-butter-nav');
        return {
          marks: nav ? [...nav.shadowRoot.querySelectorAll('.bdot, .mark')].filter((m) => m.getBoundingClientRect().width && getComputedStyle(nav).display !== 'none' && nav.hasAttribute('data-on')).length : 0,
        };
      });
      await scrollTo(TURN);
      const b = await block(TURN, PARA);
      await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
      await page.waitForTimeout(400);
      const btn = await button();
      check(`${name}: no dot and no button`, off.marks === 0 && !btn?.shown, { off, btn });
      const after = (await requests())['butter-bookmark-list'] || 0;
      check(`${name}: the page reads no bookmarks`, after === reads, { reads, after });
      await settings({});
    }
    // And back on, the dot returns: question 7's.
    await open('light');
    await dotCount(1);
    check('rail back on: the dot returns', !!dotBeside(await rail(), TURN));

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
    const cardState = tickCard;
    const shoot = async (name) => {
      const c = await cardState(),
        r = await rail();
      const y = Math.max(0, Math.min(c.rect.y, r.ticks[0].y) - 30);
      await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: 1400 - 420, y, width: 420, height: Math.max(c.rect.y + c.rect.h, r.ticks.at(-1).y) - y + 30 } });
    };
    // The tick's card (#70) is the way to a question's bookmarks: hover the tick, then onto its rows.
    const cards = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(2);
      await toTop();
      await hoverTick(2);
      const single = await cardState();
      const singleOn = await ontoRow(0);
      await shoot(`card-single-${theme}`);
      await hoverTick(TURN);
      const list = await cardState();
      // Across the rail and the gap, onto the first row: the card stays and the row lights up.
      const onCard = await ontoRow(0);
      await shoot(`card-list-${theme}`);
      cards[theme] = { single, singleOn, list, onCard };
    }
    const { single, singleOn, list, onCard } = cards.light;
    check('one bookmark: the tick\'s card, named "Bookmark · question 3 of 12", shows its excerpt and, on the row, an ×',
      single.shown && single.merged && single.name === 'Bookmark · question 3 of 12' && single.rows.length === 1 &&
        single.rows[0].text === excerptOf(2, 0) && singleOn.rows[0].xShown && singleOn.rows[0].xLabel === `Delete bookmark: ${excerptOf(2, 0)}`,
      { single: single.name, rows: single.rows.map((r) => r.text) });
    check('the single row clamps its excerpt to three lines', single.rows[0].lines <= 3, { lines: single.rows[0].lines });
    check('several: "Question 7 of 12 · 6 bookmarks" and the rows in answer order',
      list.shown && list.name === 'Question 7 of 12 · 6 bookmarks' && JSON.stringify(list.rows.map((x) => x.text)) === JSON.stringify(ORDER),
      { name: list.name, rows: list.rows.map((x) => x.text) });
    check('five rows show and the sixth scrolls',
      list.box && Math.abs(list.box.client - 5 * list.rows[0].h) <= 1 && list.box.scroll > list.box.client + list.rows[0].h / 2, { box: list.box, row: list.rows[0].h });
    check('the card takes the pointer while it shows bookmarks', list.pe === 'auto');
    check('moving onto the card keeps it open; the hovered row has a background and an ×',
      onCard.shown && onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)' && onCard.rows[0].xShown && !onCard.rows[1].xShown &&
        onCard.rows[0].xLabel === `Delete bookmark: ${ORDER[0]}`, { rows: onCard.rows.slice(0, 2).map((r) => [r.bg, r.xShown]) });
    check('dark theme: the same cards', cards.dark.single.name === single.name && cards.dark.onCard.shown &&
      cards.dark.onCard.rows[0].bg !== 'rgba(0, 0, 0, 0)', { dark: cards.dark.onCard.rows[0].bg });

    // Jump from a row: the fifth row (paragraph 4) lands 64 px below the scroller's top, card put away.
    await open('light');
    await dotCount(2);
    check('jump from the fifth row', await jumpByRow(TURN, 4));
    check('clicking a row jumps to that bookmark', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    check('the card goes away after the jump', !(await cardState()).shown);

    // Delete the first row with its ×: the store and the card both lose it.
    await toTop();
    await hoverTick(TURN);
    let c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    let left = (await stored()).filter((b) => b.turn === TURN);
    check('× deletes that bookmark; the card now lists five', left.length === 5 && !left.some((b) => b.para === 0) &&
      c.shown && c.name === 'Question 7 of 12 · 5 bookmarks' && c.rows.length === 5, { left: left.length, name: c.name });

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

    // Keyboard alone: Tab into the rail, arrows to the tick (no stop for its bookmarks), left into the
    // card, Enter to jump.
    await toTop();
    await page.mouse.move(700, 300);
    const focused = () => page.evaluate(() => {
      const a = document.querySelector('chatgpt-butter-nav')?.shadowRoot.activeElement;
      return a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null;
    });
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 8 && !(await focused())?.cls.startsWith('tick'); k++) await page.keyboard.press('Tab');
    let f;
    const stops = [];
    for (let k = 0; k < 30; k++) {
      f = await focused();
      stops.push(f?.cls);
      if (f?.cls.startsWith('tick') && f.label.includes(' · 3 bookmarks: ')) break;
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(250); // the card fades in
    check('arrows walk the ticks only; the tick\'s name holds the bookmark text', f?.cls.startsWith('tick') && stops.every((x) => x?.startsWith('tick')) &&
      f.label === `${QUESTION(TURN)} · 3 bookmarks: ${ORDER[3]}; ${ORDER[4]}; ${ORDER[5]}` && (await cardState()).shown, { f, stops });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    f = await focused();
    check('ArrowLeft enters the card, ArrowDown moves to the next row', f?.cls === 'go' && f.text === ORDER[4], { f });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);
    check('Enter on a row jumps to it', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });
    f = await focused();
    check('after the jump, focus is on the question\'s tick', f?.cls.startsWith('tick') && f.label.startsWith(QUESTION(TURN)), { f });
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

    // The single row's × under reduced motion: the dot goes at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toTop();
    await hoverTick(2);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(150);
    const allDots = () => page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
    check('the single row\'s × deletes; under reduced motion the dot goes at once, with no fade',
      !(await stored()).some((b) => b.turn === 2) && (await allDots()) === 1 && !(await cardState()).shown, { dots: await allDots() });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Delete question 7's last two: the last deletion fades the dot out over 160 ms.
    await hoverTick(TURN);
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    await page.waitForTimeout(400);
    c = await cardState();
    check('one left: the card shows the single row', c.shown && c.name === 'Bookmark · question 7 of 12' && c.rows.length === 1 && c.rows[0].text === ORDER[5], { c: c.name });
    c = await ontoRow(0);
    await page.mouse.move(c.rows[0].xAt.x, c.rows[0].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[0].xAt.x, c.rows[0].xAt.y);
    const fading = await page.waitForFunction(
      () => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].some((m) => m.classList.contains('gone') && +getComputedStyle(m).opacity < 1),
      null, { timeout: 1000 }).then(() => true, () => false);
    const fade = await page.evaluate(() => {
      const d = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bdot.gone');
      return d && getComputedStyle(d).transition;
    });
    await page.waitForTimeout(400);
    let r = await rail();
    check('deleting the last bookmark fades the dot out over 160 ms, then removes it', fading && /opacity 0.16s/.test(fade ?? '') && r.dots.length === 0 &&
      (await allDots()) === 0 && !(await cardState()).shown, { fading, fade, dots: r.dots.length });

    // Reload: every deletion is still gone.
    await open('light');
    await page.waitForTimeout(500);
    check('after a reload the deletions are still gone', (await stored()).length === 0 && (await rail()).dots.length === 0);

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
      check(`notice (${name}): the save drew its dot`, (await rail()).dots.length === 1);
      if (i < 3) {
        await press('undo');
        await page
          .waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === 0, null, { timeout: 5000 })
          .catch(() => {});
        await page.waitForTimeout(300);
        const after = await notice();
        check(`notice (${name}): Undo deletes the bookmark, its dot goes, the notice hides unacknowledged`,
          (await stored()).length === 0 && (await rail()).dots.length === 0 && !after.shown &&
            (await acknowledged()) === undefined,
          { stored: (await stored()).length, dots: (await rail()).dots.length, after: after.shown });
      } else {
        await press('ok');
        await page.waitForTimeout(400);
        check(`notice (${name}): Got it keeps the bookmark and records the acknowledgement`,
          !(await notice()).shown && (await stored()).length === 1 && (await rail()).dots.length === 1 &&
            (await acknowledged()) === 'acknowledged');
      }
    }
    // A third save, and one after a reload: no notice.
    const third = await bookmark(TURN, 0);
    await third.click();
    await dotCount(1);
    await page.waitForTimeout(800);
    check('after Got it, a third save shows no notice', !(await notice()).shown && (await stored()).length === 2);
    await open('light');
    const fourth = await bookmark(2, 0);
    await fourth.click();
    await dotCount(2);
    await page.waitForTimeout(800);
    check('after Got it and a reload, a save shows no notice', !(await notice()).shown && (await stored()).length === 3);

    // 11. Stale bookmarks (#55). Start over with seeded bookmarks: question 10 holds one, question 7
    // three (blocks 0, 2 and 4). English, the notice already acknowledged.
    await settings({ bookmarkNotice: 'acknowledged' });
    const LONE = 9;
    const STALE_SEEDS = [seed(LONE, 0), seed(TURN, 0, 0, null, 1), seed(TURN, 2, 0, null, 2), seed(TURN, 4, 0, null, 3)];
    await seedStore(STALE_SEEDS, { clear: true });
    // The tick's card for a stale bookmark: its name, footer and rows (the first's centre in `one`).
    const staleState = async () => {
      const c = await tickCard();
      return { ...c, stale: c.rows.length === 1 && c.rows[0].stale, one: c.rows[0] && { x: c.rows[0].x - 40, y: c.rows[0].y } };
    };
    // Questions 10's and 7's dots: hollow or solid, and their ticks' names.
    const LIGHT_DOT = 'rgb(211, 158, 16)';
    const dotsNow = async () => {
      const r = await rail(),
        at = (turn) => {
          const d = dotBeside(r, turn);
          return d ? { stale: d.cls.includes('stale'), bg: d.color, ring: d.ring, opacity: d.opacity, label: r.ticks[turn].label, x: d.x, y: d.y } : null;
        };
      return { lone: at(LONE), turn: at(TURN), count: r.dots.length };
    };
    const hollow = (d, color = LIGHT_DOT) => d?.stale && d.bg === 'rgba(0, 0, 0, 0)' && d.ring === `${color} 0px 0px 0px 1px inset` && d.opacity === 1;
    const solid = (d, color = LIGHT_DOT) => d && !d.stale && d.bg === color && d.opacity === 1;
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
    await dotCount(2);
    await toTop();
    let seg = await dotsNow();
    check('stale: before any change, both dots are solid', solid(seg.lone) && solid(seg.turn), { seg });

    // Regenerate question 10's answer and edit paragraph 2 of question 7's, in the page.
    await act('regen', LONE);
    await act('edit', TURN);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    check('regenerated: the dot of a question whose only bookmark is stale turns hollow, a 1 px inner ring in its colour',
      hollow(seg.lone) && seg.lone.label.endsWith('(answer changed)'), { seg });
    check('edited: one stale bookmark of three keeps the dot solid', solid(seg.turn), { seg });
    check('nothing about staleness is stored', (await stored()).length === 4 && (await stored()).every((b) => !('stale' in b)));

    const muted = { light: 'rgb(143, 143, 143)', dark: 'rgb(163, 163, 163)' };
    await hoverTick(LONE);
    let st = await staleState();
    check('the stale single row: the card is named "Bookmark · answer changed", grey text, a hollow dot and the footer',
      st.shown && st.stale && st.name === 'Bookmark · answer changed' && st.rows[0].color === muted.light && st.rows[0].dot.bg === 'rgba(0, 0, 0, 0)' &&
        st.rows[0].why === null && st.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { name: st.name, rows: st.rows, warn: st.warn });
    await hoverTick(TURN);
    st = await staleState();
    check('the list: the edited paragraph\'s row is grey with "answer changed", the others are not',
      st.shown && st.rows.length === 3 && JSON.stringify(st.rows.map((r) => r.stale)) === '[false,true,false]' &&
        st.rows[1].why === 'answer changed' && st.rows[1].color === muted.light && st.rows[0].why === null && st.rows[0].color !== muted.light, { rows: st.rows });

    // A jump to a stale bookmark lands at the start of its question: from the single row, and a
    // click on the hollow dot's position opens the question too.
    await toTop();
    await hoverTick(LONE);
    st = await staleState();
    await page.mouse.move(st.one.x, st.one.y, { steps: 12 });
    await page.mouse.click(st.one.x, st.one.y);
    await page.waitForTimeout(3500);
    let atQuestion = await questionTop(LONE);
    check('clicking the stale bookmark lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    const d10 = (await dotsNow()).lone;
    await page.mouse.move(d10.x, d10.y, { steps: 4 });
    await page.mouse.click(d10.x, d10.y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(LONE);
    check("a click on the hollow dot's position opens its question", Math.abs(atQuestion - 64) <= 3, { atQuestion });
    // The edited row too; a live row still lands on its paragraph.
    await toTop();
    await hoverTick(TURN);
    c = await ontoRow(1);
    await page.mouse.click(c.rows[1].x - 40, c.rows[1].y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(TURN);
    check('clicking the grey row lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    await hoverTick(TURN);
    c = await ontoRow(2);
    await page.mouse.click(c.rows[2].x - 40, c.rows[2].y);
    await page.waitForTimeout(3500);
    check('a live row next to it still lands on its paragraph', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });

    // The original version switched back: live again.
    await toTop();
    await act('back', LONE);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    await hoverTick(LONE);
    st = await staleState();
    check('switched back to the original answer: the bookmark is live again, its dot solid', solid(seg.lone) &&
      !st.stale && st.name === 'Bookmark · question 10 of 12' && st.warn === null, { seg, st: st.name });

    // Regenerating every bookmarked answer under question 7 turns its dot hollow.
    await act('regen', TURN);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    check('all of question 7\'s bookmarks stale: now its dot is hollow too', hollow(seg.turn), { seg });

    // After a reload the regenerated answer is the conversation's version: the old message is gone
    // from the list, and the bookmark is still kept, stale, under question 10. Light and dark shots.
    page$.regen = new Set([LONE]);
    page$.edited = new Set([TURN]);
    const staleShots = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(2);
      await toTop();
      seg = await dotsNow();
      await hoverTick(LONE);
      const single = await staleState();
      await shoot(`card-stale-${theme}`);
      await hoverTick(TURN);
      const list = await staleState();
      await ontoRow(0);
      await shoot(`card-list-stale-${theme}`);
      staleShots[theme] = { seg, single, list };
    }
    for (const theme of ['light', 'dark']) {
      const { seg, single, list } = staleShots[theme];
      const dot = theme === 'dark' ? 'rgb(227, 199, 102)' : LIGHT_DOT;
      check(`after a reload (${theme}): the vanished message's bookmark is kept, stale, its dot hollow beside question 10`,
        hollow(seg.lone, dot) && single.stale && single.rows[0].color === muted[theme] &&
          single.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { seg, single: single.name });
      check(`after a reload (${theme}): the edited row stays grey, its dot solid`,
        solid(seg.turn, dot) && JSON.stringify(list.rows.map((r) => r.stale)) === '[false,true,false]' && list.rows[1].color === muted[theme], { rows: list.rows });
    }
    check('after the reload, all four bookmarks are still stored', (await stored()).length === 4);

    // Chinese: the stale strings.
    await settings({ lang: 'zh', bookmarkNotice: 'acknowledged' });
    await open('light');
    await dotCount(2);
    await toTop();
    await hoverTick(LONE);
    const zhSingle = await staleState();
    await hoverTick(TURN);
    const zhList = await staleState();
    check('Chinese: "书签 · 回答已变化", its footer and the "回答已变化" row',
      zhSingle.name === '书签 · 回答已变化' && zhSingle.warn === '找不到这一段了。点击会跳到第 10 个问题的开头。' && zhList.rows[1].why === '回答已变化',
      { name: zhSingle.name, warn: zhSingle.warn, why: zhList.rows[1].why });
    await settings({ bookmarkNotice: 'acknowledged' });
    page$.regen = new Set();
    page$.edited = new Set();

    // 11c. An answer that streamed in this tab (#51). The user sends question 13 here: the rail
    // hears the send (a `butter-nav` 'send', as history/conversation-main.js reports it) and the turn
    // mounts with an answer no page GET lists. A bookmark on its paragraph 2 stays live after
    // ChatGPT's virtualizer unmounts the turn and the bookmarks refresh, and its row still lands on
    // that paragraph once the turn mounts again.
    const SENT = TURNS,
      SENT_PARA = 2;
    await seedStore([], { clear: true });
    await open('light');
    await page.evaluate(
      ([conv, parent, id, q, turn]) => {
        document.dispatchEvent(new CustomEvent('butter-nav', { detail: JSON.stringify({ type: 'send', conv, parent, item: { id, q } }) }));
        document.querySelector('.content').insertAdjacentHTML('beforeend', turn);
      },
      [CONV, answer(TURNS - 1), question(SENT), QUESTION(SENT), turnHtml(SENT)],
    );
    await page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick').length === n, TURNS + 1, { timeout: 5000 });
    await page.waitForTimeout(400);
    const sentMark = await bookmark(SENT, SENT_PARA);
    await sentMark.click();
    await dotCount(1);
    await page.waitForTimeout(800);
    const sentRows = await stored();
    check('streamed here: the sent question\'s answer, not in any page GET, takes a bookmark under question 13',
      sentRows.length === 1 && sentRows[0].msg === sha(answer(SENT)) && sentRows[0].ask === sha(question(SENT)) &&
        sentRows[0].turn === SENT && sentRows[0].para === SENT_PARA && !!dotBeside(await rail(), SENT), { stored: sentRows.map(({ turn, para }) => ({ turn, para })) });
    // Scrolled away, the virtualizer swaps the turn for a placeholder of its height, as ChatGPT
    // keeps only the turns around the view. When the placeholder nears the view the turn mounts
    // again 700 ms later: rendering a far turn takes ChatGPT a second or more (rail/rail.js `jump`),
    // so the page's re-check 600 ms after the click runs while the turn is still out.
    await toTop();
    const unmounted = await page.evaluate((id) => {
      const sc = document.querySelector('.thread-scroll-container'),
        turn = document.querySelector(`[data-turn-key="${id}"]`),
        hole = document.createElement('div');
      hole.style.height = `${turn.offsetHeight}px`;
      hole.style.marginBottom = '24px';
      turn.replaceWith(hole);
      const io = new IntersectionObserver(
        (es) => {
          if (!es.some((e) => e.isIntersecting)) return;
          io.disconnect();
          setTimeout(() => hole.replaceWith(turn), 700);
        },
        { root: sc, rootMargin: '200px 0px' },
      );
      io.observe(hole);
      return !document.querySelector(`[data-turn-key="${id}"]`);
    }, question(SENT));
    // The pointer reaching the rail re-checks the bookmarks (bookmarks/content.js `toRail`); then the
    // card is read afresh.
    await hoverTick(SENT);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(400);
    await hoverTick(SENT);
    const sentCard = await staleState(),
      sentRail = await rail(),
      sentDot = dotBeside(sentRail, SENT),
      stillOut = await page.evaluate((id) => !document.querySelector(`[data-turn-key="${id}"]`), question(SENT));
    check('streamed here, unmounted: the dot stays solid, not "answer changed"',
      unmounted && stillOut && sentDot && !sentDot.cls.includes('stale') && sentDot.opacity === 1 && !sentRail.ticks[SENT].label.endsWith('(answer changed)'),
      { unmounted, stillOut, dot: sentDot, label: sentRail.ticks[SENT].label });
    check('streamed here, unmounted: its card is live, with no "answer changed" or footer',
      sentCard.shown && !sentCard.stale && sentCard.name === 'Bookmark · question 13 of 13' && sentCard.warn === null, { name: sentCard.name, warn: sentCard.warn });
    // The row's click mounts the turn again on the way and lands on the bookmarked paragraph.
    const sentOn = await ontoRow(0);
    await page.mouse.click(sentOn.rows[0].x - 40, sentOn.rows[0].y);
    await page.waitForTimeout(3500);
    const remounted = await page.evaluate((id) => !!document.querySelector(`[data-turn-key="${id}"]`), question(SENT)),
      sentAt = remounted ? (await block(SENT, SENT_PARA)).fromTop : null,
      sentQuestion = remounted ? await questionTop(SENT) : null;
    check('streamed here, unmounted: clicking its row lands on the bookmarked paragraph, not the question',
      remounted && Math.abs(sentAt - 64) <= 3, { remounted, fromTop: sentAt, question: sentQuestion });
    await seedStore([], { clear: true });

    await cardSection();
    await dotSection();
    await oneQuestionSection();
    await earlierSection();
    await washSection();

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
