// Isolated world. The page reader: how Butter reads ChatGPT's answer structure (answer roots,
// message ids, turns, bookmark paragraphs and Ask in branch's replies) and ChatGPT's own "Ask
// ChatGPT" selection button. Callers ask for facts; no selector leaves this file. Where two callers
// read a fact differently, each reading is its own named function here, never merged.
// test/page-reader-contract.test.mjs checks it against the hand-written pages in
// test/fixtures/page/. Loads before selection/pill.js, bookmarks/content.js and branch/*.js.
// Only visible, nativeAsk, nativeBusy and nativeStyle read layout.
(() => {
  // ---- Answers, as bookmarks read them. An answer root is the element whose children are an
  // answer's blocks: the markdown root, or in ChatGPT's Dil renderer the response root nested
  // inside it behind wrapper layers (one of which can hold an empty sibling). The same rule as
  // page/reader-main.js ANSWER_ROOT (the MAIN-world copy) and stream/offscreen.js.
  const STYLE = '[data-markdown-text-style="assistant-message"]';
  const ANSWER = `:is(${STYLE}:not(:has([class*="DilResponseRoot"])), ${STYLE} [class*="DilResponseRoot"])`;
  // A paragraph (a bookmark's `para`, #51): a top-level block of an answer root (paragraph,
  // heading, code block, table, blockquote), except that each item of a top-level list is a
  // paragraph of its own. Items of a nested list belong to their top-level item.
  const KIDS = [':not(ul, ol)', ':is(ul, ol) > li'],
    PARAGRAPH = KIDS.map((k) => `${ANSWER} > ${k}`).join(', '),
    OWN = KIDS.map((k) => `:scope > ${k}`).join(', ');
  // The element that carries an answer's message id. Older chats wrap the answer in
  // [data-message-author-role="assistant"][data-message-id]; live chats (checked on 2026-11-08,
  // notes/runs/2026-11-08-bookmarks-live) have neither, and the answer's ancestor carries
  // data-chatgpt-selection-message-id instead (as seek/layout-cache-main.js reads it).
  const MESSAGE =
    '[data-message-author-role="assistant"][data-message-id], [data-chatgpt-selection-message-id]';
  // A turn: ChatGPT's block of one question and its answer, keyed by the question's message id.
  const TURN = '[data-turn-key]';
  // ---- Ask in branch's readings. A reply: the markdown root or the assistant role wrapper, so a
  // reply's role wrapper counts with what it holds outside its markdown root. Its loose turn also
  // takes ChatGPT's older turn wrappers, to keep a reply's buttons apart from a later turn's.
  const REPLY =
    '[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]';
  const LOOSE_TURN = '[data-turn-key], [data-testid^="conversation-turn-"], article';

  const elementOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement);
  const closest = (node, selector) => elementOf(node)?.closest(selector) || null;
  const idOf = (message) =>
    message?.getAttribute('data-message-id') ||
    message?.getAttribute('data-chatgpt-selection-message-id') ||
    null;
  // An answer root as `{ root, id }`; null while it has no message id yet.
  const answerAt = (root) => {
    const id = idOf(root.closest(MESSAGE));
    return id ? { root, id } : null;
  };

  // ---- ChatGPT's "Ask ChatGPT" selection toolbar. Labels in English and Simplified Chinese, as
  // seen on the live page (2026-11-07). sideChat: the same toolbar also offers "Ask in side chat",
  // which only Work mode has.
  const exact = (...names) => new RegExp(`^(?:${names.join('|')})$`);
  const labels = {
    nativeAsk: exact(
      'Ask ChatGPT',
      '询问 ChatGPT',
      '询问ChatGPT',
      '问问 ChatGPT',
      '向 ChatGPT 提问',
    ),
    sideChat: exact('Ask in side chat', '在侧边聊天中提问'),
  };
  const visible = (el) => {
    if (!el?.isConnected || !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  // ChatGPT's own "Ask ChatGPT" selection button, and the box that draws it (the first
  // ancestor with a background), whose geometry and colors Butter's button copies.
  // Live (2026-11-07) the button is transparent at rest and, while hovered, tints only itself with
  // no radius or shadow; that tint is not the box, so a hovered, pressed or focused button is
  // skipped and the toolbar box under it is still found.
  const busy = (el) => el.matches(':hover, :active, :focus-visible');
  const nativeAsk = () => {
    const button = [...document.querySelectorAll('button, [role="button"]')].find(
      (el) => labels.nativeAsk.test(label(el).replace(/^❝\s*/, '')) && visible(el),
    );
    if (!button) return null;
    let box = button;
    for (let el = busy(button) ? button.parentElement : button, i = 0; el && i < 3; i++) {
      if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        box = el;
        break;
      }
      el = el.parentElement;
    }
    let sideChat = false;
    for (let el = button.parentElement, i = 0; el && el !== document.body && i < 4; i++) {
      sideChat = [...el.querySelectorAll('button, [role="button"]')].some((b) =>
        labels.sideChat.test(label(b)),
      );
      if (sideChat) break;
      el = el.parentElement;
    }
    return { button, box, sideChat };
  };
  // The label's text style is copied whole, so both labels render alike. Live (2026-11-07) the label
  // is the button's own text: 14px/18px, weight 400, ChatGPT's font stack, and antialiased smoothing,
  // without which macOS draws Butter's label heavier. A label in a child element is read there.
  const labelOf = (button) => {
    const walk = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); ) if (n.textContent.trim()) return n.parentElement;
    return button;
  };
  const nativeStyle = ({ button, box }) => {
    const b = getComputedStyle(box),
      t = getComputedStyle(labelOf(button));
    return {
      height: `${box.getBoundingClientRect().height}px`,
      borderRadius: b.borderRadius,
      boxShadow: b.boxShadow,
      border: b.border,
      backgroundColor: b.backgroundColor,
      color: t.color,
      font: {
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        letterSpacing: t.letterSpacing,
        lineHeight: t.lineHeight,
        webkitFontSmoothing: t.webkitFontSmoothing,
      },
    };
  };

  globalThis.ButterPageReader = {
    // Answers. `root` (a turn or the document) and `node` may be any node, text nodes too.
    // The identified answers under `root`, in document order: `[{ root, id }]`.
    answersIn: (root) => [...root.querySelectorAll(ANSWER)].map(answerAt).filter(Boolean),
    // The identified answer `node` is in, or null.
    answerOf(node) {
      const root = closest(node, ANSWER);
      return root && answerAt(root);
    },
    // An answer root's paragraphs, in document order: their index is a bookmark's `para`.
    paragraphsOf: (answerRoot) => [...answerRoot.querySelectorAll(OWN)],
    // The paragraph `node` is in, or null.
    paragraphOf: (node) => closest(node, PARAGRAPH),
    // The paragraphs under `el`, of any answer, in document order.
    paragraphsIn: (el) => [...el.querySelectorAll(PARAGRAPH)],
    // Turns, keyed by the question's message id.
    turns: () => [...document.querySelectorAll(TURN)],
    turnByKey: (key) =>
      [...document.querySelectorAll(TURN)].find((t) => t.getAttribute('data-turn-key') === key) ??
      null,
    turnKeyOf: (node) => closest(node, TURN)?.getAttribute('data-turn-key') ?? null,
    // Ask in branch: the reply `node` is in, the replies under `root`, and the loose turn.
    replyOf: (node) => closest(node, REPLY),
    replies: (root = document) => [...root.querySelectorAll(REPLY)],
    looseTurnOf: (node) => closest(node, LOOSE_TURN),
    // ChatGPT's selection toolbar.
    labels,
    visible,
    nativeAsk,
    nativeBusy: ({ button }) => busy(button),
    nativeStyle,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterPageReader;
})();
