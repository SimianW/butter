// The bookmarks harness's synthetic ChatGPT chat: its ids and text, the page the fixture serves
// for /c/<CONV> (with ChatGPT's paging of earlier history and its "Ask ChatGPT" chip), the
// conversation's messages as /backend-api returns them, and the wash mockup's frame.
//
// A scene says what the fixture serves: `createFixture` holds one, `reset(declared)` starts it from
// the defaults plus a scenario's declaration, `serve(changes)` changes it mid-scenario (as ChatGPT's
// server would after a regeneration). Its fields:
// - `theme`: 'light' or 'dark' (set by `open(theme)`).
// - `first`: the chat opens with questions first..TURNS-1 only, as ChatGPT opens a long chat; its
//   earlier messages come two questions per page from /messages?before=<first> when the chat is
//   scrolled near its top (#51 addendum). Each page is answered after `pageDelay` ms; `pages`
//   counts them.
// - `turns`: the chat holds only its first `turns` questions (1: a one-question chat, one tick).
// - `tail`: filler paragraphs after every answer, so that one turn fills the view (#71); `css` is
//   added to the page's style.
// - `asked` (Map or object, question -> text) gives some questions other text, as the mockup's
//   (#70); `said` (question -> blocks' HTML) gives some answers other blocks.
// - `regen` (question numbers): those answers are regenerated, a new message id and other text;
//   `edited`: those answers keep their id, but their third paragraph (block 2) says something else.
// - `scene`: the wash mockup's chat (see `mockHtml`) instead of the fixture chat, when set.
// A scenario declares a scene as an object, or as a function of `{ live }` when it depends on the
// markup (as `washBlocks` does).
import { createHash } from 'node:crypto';

export const sha = (s) => createHash('sha256').update(s).digest('hex');

export const CONV = '4b1f7c2a-9d3e-4f60-8a1b-2c3d4e5f6a7b';
export const TURNS = 12;
export const hex = (prefix, i) => `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const question = (i) => hex('7a10c3d2', i),
  answer = (i) => hex('3e5b9f81', i);
// Long enough to wrap over four lines in the 720 px column: the excerpt keeps the first three.
export const PARAGRAPH = (i, k) =>
  `Fixture answer ${i + 1} paragraph ${k + 1}: the planner compares the estimated cost of a sequential scan with an index scan, ` +
  'reads the table statistics gathered by ANALYZE, weighs the share of rows a predicate is expected to match, and picks ' +
  'whichever plan reads fewer pages overall, which is why a selective predicate on a well-analysed column usually ' +
  'gets the index while a broad one gets the scan, and why stale statistics after a bulk load mislead it.';
// Regenerated answers (#55): a new message id and other text. Edited ones keep the id, but their
// third paragraph (block 2) says something else.
export const regen = (i) => hex('5c7d2e90', i);
export const REGENERATED = (i, k) =>
  `Regenerated answer ${i + 1}, point ${k + 1}: a different explanation of when an index helps a query.`;
export const EDITED = (i) => `Edited answer ${i + 1}: this paragraph now says something else entirely.`;
export const PAGE_TURNS = 2;
// The store's hashed ids for the fixture's account and conversation.
export const ACCOUNT = sha('user-fixture'),
  CONV_HASH = sha(CONV);
// An answer's paragraphs, as bookmarks count them: its top-level blocks, each item of a top-level
// list on its own (blocks: p, h3, p, p, p, p, then the list's two items).
export const PARAS = ':scope > :not(ul, ol), :scope > :is(ul, ol) > li';
export const MOCK_TURN = 6;

// A stored bookmark, as an earlier session would have left it: on block `para` of question `turn`'s
// answer (blocks: p, h3, p, p, p, p, li, li), from `start` to `end` (the whole block by default) of
// `text` (that block's text by default); its excerpt, unless given, at most 120 characters from
// `start`. `more` adds fields (`ask`, say).
export const row = (
  turn,
  para,
  {
    start = 0,
    text = PARAGRAPH(turn, para === 0 ? 0 : para - 1),
    end = text.length,
    excerpt = text.slice(start, Math.min(end, start + 120)).trim(),
    time = Date.now(),
    msg = answer(turn),
    ...more
  } = {},
) => ({ account: ACCOUNT, conv: CONV_HASH, msg: sha(msg), turn, para, start, end, excerpt, time, ...more });
// A bookmark on paragraph 2 of question `turn`'s answer whose text that paragraph no longer holds:
// stale once the answer is mounted.
export const goneRow = (turn, opts) => row(turn, 2, { ...opts, excerpt: 'A paragraph this answer no longer has.' });

// Question 6's answer for the block wash (#74): paragraphs around a code block (block 1) and a table
// (block 3), each in the markup's own shape. MARKUP=old has ChatGPT's <pre> round its rounded panel
// and a table in its scrolling wrapper; MARKUP=live has the code widget's surface and the table's
// frame. With `BLOCK_CSS` added to the page.
export const BLOCK_TURN = 5;
export const washBlocks = (live) => {
  const lines = ['EXPLAIN ANALYZE', "SELECT * FROM orders WHERE status = 'pending';"];
  const table = `<table><tbody>${[
    ['Status', 'Rows', 'Plan'],
    ['pending', '1,204', 'Index scan'],
    ['shipped', '912,330', 'Sequential scan'],
  ].map((r, i) => `<tr>${r.map((c) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</tbody></table>`;
  return [
    `<p>${PARAGRAPH(BLOCK_TURN, 0)}</p>`,
    live
      ? `<div data-client-defined-widget><div class="fx-codeblock"><div class="fx-surface" data-code-block><div class="fx-bar"><div>sql</div><div data-code-block-controls><button>Copy</button></div></div>` +
        `<div class="cm-editor"><div class="cm-content">${lines.map((l) => `<div class="cm-line">${l}</div>`).join('')}</div></div></div></div><div></div></div>`
      : `<pre><div class="fx-panel"><div class="fx-bar">sql<button>Copy</button></div><div class="fx-code"><code>${lines.join('\n')}</code></div></div></pre>`,
    `<p>${PARAGRAPH(BLOCK_TURN, 1)}</p>`,
    live
      ? `<div class="fx-tableframe"><div class="fx-viewport" data-d-table-viewport>${table}</div><div class="fx-edges"></div></div>`
      : `<div class="fx-tablecontainer"><div class="fx-tablewrapper">${table}</div></div>`,
    `<p>${PARAGRAPH(BLOCK_TURN, 2)}</p>`,
  ];
};
export const BLOCK_CSS = `
  [data-markdown-text-style] pre { margin:0 0 16px }
  .fx-panel, .fx-surface { border-radius:16px; background:#f4f4f4; overflow:hidden }
  .dark .fx-panel, .dark .fx-surface { background:#171717 }
  .fx-bar { display:flex; justify-content:space-between; padding:4px 12px; font:12px/20px system-ui, sans-serif }
  .fx-code, .cm-content { padding:12px; font:14px/20px ui-monospace, monospace; white-space:pre }
  [data-client-defined-widget], .fx-tableframe, .fx-tablecontainer { margin:0 0 16px }
  .fx-viewport, .fx-tablewrapper { overflow-x:auto }
  table { border-collapse:collapse } th, td { border:1px solid rgb(0 0 0 / .15); padding:4px 12px; text-align:left }`;

const defaults = () => ({ theme: 'light', regen: new Set(), edited: new Set(), asked: new Map(), said: new Map(), first: 0, turns: TURNS, pageDelay: 0, pages: 0, scene: null, tail: 0, css: '' });
// A declared scene's collections as the fixture keeps them.
const normalize = (decl = {}) => {
  const out = { ...decl };
  for (const k of ['asked', 'said']) if (decl[k] && !(decl[k] instanceof Map)) out[k] = new Map(Object.entries(decl[k]).map(([i, v]) => [+i, v]));
  for (const k of ['regen', 'edited']) if (decl[k]) out[k] = new Set(decl[k]);
  return out;
};

// `live`: the answer markup live chats have (MARKUP=live), rather than the earlier wrapper.
export function createFixture({ live }) {
  const LIVE = live;
  // The scene: scenarios declare it, and change it only through `serve`.
  const page$ = defaults();
  const reset = (decl) => Object.assign(page$, defaults(), normalize(decl));
  const serve = (changes) => Object.assign(page$, normalize(changes));

  // `page$.asked` gives some questions other text, as the mockup's (#70).
  const QUESTION = (i) => page$.asked.get(i) ?? `Fixture question ${i + 1} about query planning`;
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
    `<div ${answerAttrs(answerId(i))}><div data-markdown-text-style="assistant-message" class="markdown prose">${blocks(i)}${'<p>Fixture filler: more of the answer.</p>'.repeat(page$.tail)}</div></div><button type="button" class="fx-more" aria-label="More actions" tabindex="-1"></button></article></div>`;
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
  // The fixture's "Ask ChatGPT": shown 60 ms after a selection settles inside an answer, its left
  // edge under the selection's first line and 8 px below its last; it follows the chat's scroll.
  const nativeScript = `
  const fxNative = document.querySelector('.fx-native');
  let fxNativeTimer;
  const fxPlace = () => {
    const s = getSelection();
    const el = s.rangeCount && !s.isCollapsed && s.getRangeAt(0).commonAncestorContainer;
    const inAnswer = el && (el.nodeType === 1 ? el : el.parentElement)?.closest('[data-markdown-text-style]');
    if (!inAnswer) { fxNative.hidden = true; return; }
    const rects = [...s.getRangeAt(0).getClientRects()].filter((r) => r.width);
    if (!rects.length) { fxNative.hidden = true; return; }
    fxNative.hidden = false;
    fxNative.style.left = rects[0].left + 'px';
    // Below the selection's end, kept in the view as ChatGPT keeps its toolbar.
    fxNative.style.top = Math.min(rects.at(-1).bottom + 8, innerHeight - 180) + 'px';
  };
  document.addEventListener('selectionchange', () => { clearTimeout(fxNativeTimer); fxNativeTimer = setTimeout(fxPlace, 60); });
  document.querySelector('.thread-scroll-container').addEventListener('scroll', fxPlace, { passive: true });`;
  const html = () => `<!doctype html><html lang="en" class="${page$.theme}"><head><meta charset="utf-8"><title>Fixture chat</title><style>
  body { margin:0; overflow:hidden; font:16px/26px system-ui, sans-serif; background:#fff; color:#0d0d0d }
  .dark body { background:#212121; color:#ececec }
  header { position:fixed; top:0; left:0; right:0; height:52px; background:inherit; z-index:5; display:flex; align-items:center; padding:0 16px; font-weight:600 }
  .thread-scroll-container { height:100vh; overflow-y:scroll; overflow-anchor:none }
  .content { padding:64px 0 600px }
  article { display:block; position:relative; width:720px; max-width:calc(100% - 120px); margin:0 auto 24px }
  /* ChatGPT's "More actions" under each answer, which Ask in branch needs to offer its cell; out of
     the text's flow and unseen, so nothing moves. */
  .fx-more { position:absolute; right:-40px; bottom:0; width:24px; height:24px; opacity:0; padding:0; border:0 }
  /* ChatGPT's own "Ask ChatGPT" for a selection in an answer (#77), shaped as live: a fixed
     container round a dark chip, below the selection. Butter's pill sits 4 px right of it. */
  .fx-native { position:fixed; z-index:50; pointer-events:none; width:max-content }
  .fx-native > div { pointer-events:auto; display:flex; height:30px; border-radius:8px; background:rgb(48 48 48);
    box-shadow:0 4px 8px -2px rgb(0 0 0 / .1), 0 2px 8px rgb(0 0 0 / .18); overflow:hidden }
  .dark .fx-native > div { background:#3a3a3a }
  .fx-native button { all:unset; display:flex; align-items:center; gap:6px; height:30px; padding:0 9px; color:#fff; font:14px/18px system-ui, sans-serif }
  .fx-native[hidden] { display:none }
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
  ).join('')}</div></div><div class="fx-native" hidden><div><button type="button">❝ Ask ChatGPT</button></div></div><script>
  ${nativeScript}
  fetch('/backend-api/me');
  fetch('/backend-api/conversation/${CONV}');
  ${page$.first ? earlierScript() : ''}
  </script></body></html>`;

  // The mockup's chat for the wash comparison: its question and answer (section 5's text, column,
  // type and colours) as question 7 of the fixture chat, the other turns short; with its header,
  // the fade above its composer and the composer. Laid out as the panels' frame: in a 566 x 438
  // window the rail's right edge is 4 px from the frame's (558 px inside its border) and, with the
  // scroller 506 px tall, the rail is centred where the panels draw it (rail.js centres it between
  // its 52 px header and 140 px composer allowances). Below 374 px only the composer shows, as in
  // the panels. Served by the wash-mockup scenario; `page$.scene` null is the usual fixture.
  const mockHtml = () => {
    const s = page$.scene;
    const turn = (i) =>
      i === MOCK_TURN
        ? `<div><article class="mocked" data-turn-key="${question(i)}"><div class="user">${userOf(i).replace(QUESTION(i), s.q)}</div>` +
          `<div ${answerAttrs(answer(i))}><div data-markdown-text-style="assistant-message" class="markdown prose">${s.blocks.join('')}</div></div></article></div>`
        : `<div><article class="filler" data-turn-key="${question(i)}"><div class="user">${userOf(i)}</div>` +
          `<div ${answerAttrs(answer(i))}><div data-markdown-text-style="assistant-message" class="markdown prose"><p>Fixture answer ${i + 1}.</p></div></div></article></div>`;
    return `<!doctype html><html lang="en" class="${page$.theme}"><head><meta charset="utf-8"><title>Fixture chat</title><style>
  body { margin:0; overflow:hidden; background:#fff; color:#0d0d0d; font:14.5px/1.6 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif }
  .dark body { background:#212121; color:#ececec }
  header { position:fixed; top:0; left:0; right:0; height:44px; background:inherit; z-index:5; display:flex; align-items:center; padding:0 16px; font-weight:600; font-size:15px }
  .thread-scroll-container { position:fixed; top:0; left:0; width:100%; height:506px; overflow-y:scroll; overflow-anchor:none; scrollbar-width:none }
  .content { padding:64px 0 600px }
  article { display:block; width:386px; margin:0 0 24px 70px }
  header span { color:#5d5d5d; font-weight:400; margin-left:4px }
  .dark header span { color:#b4b4b4 }
  .below { position:fixed; left:0; right:0; bottom:0; height:64px; background:#fff; z-index:2 }
  .fade { position:fixed; left:0; right:0; bottom:64px; height:24px; background:linear-gradient(transparent, #fff); z-index:2 }
  .dark .below { background:#212121 }
  .dark .fade { background:linear-gradient(transparent, #212121) }
  article.filler { height:300px; overflow:hidden }
  /* As in the panels, nothing follows the answer within the view: the next question's turn stays out of it. */
  article.mocked { margin-bottom:520px }
  .user { display:flex; justify-content:flex-end }
  [data-user-message-bubble] { margin:0 0 18px; max-width:300px; padding:8px 14px; background:#f4f4f4; border-radius:18px }
  .dark [data-user-message-bubble] { background:#303030 }
  [data-markdown-text-style] p { margin:0 0 14px }
  [data-markdown-text-style] h3 { margin:18px 0 8px; font-size:16px; font-weight:600 }
  [data-markdown-text-style] pre { margin:0 0 14px; background:#f9f9f9; border:1px solid rgb(0 0 0 / .08); border-radius:10px; padding:10px 12px; font:12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space:pre-wrap }
  .dark [data-markdown-text-style] pre { background:#171717; border-color:rgb(255 255 255 / .08) }
  #thread-bottom-container { position:fixed; left:60px; right:108px; bottom:12px; height:44px; box-sizing:border-box; border-radius:22px; background:#f4f4f4; color:#5d5d5d; display:flex; align-items:center; padding:0 18px; font-size:14px; z-index:3 }
  .dark #thread-bottom-container { background:#303030; color:#b4b4b4 }
  </style></head><body><header>ChatGPT<span>5 ▾</span></header><div class="thread-scroll-container"><div class="content">${Array.from({ length: TURNS }, (_, i) => turn(i)).join('')}</div></div>` +
      `<div class="fade"></div><div class="below"></div><div id="thread-bottom-container">Ask anything</div><script>fetch('/backend-api/me'); fetch('/backend-api/conversation/${CONV}');</script></body></html>`;
  };
  return { page$, reset, serve, QUESTION, answerId, messages, answerAttrs, userOf, turnHtml, served: () => (page$.scene ? mockHtml() : html()) };
}
