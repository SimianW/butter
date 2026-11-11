// MAIN world. The page reader for seek's MAIN-world scripts (seek/layout-cache-main.js,
// seek/anchor-main.js, seek/preview-main.js): the same contract as the isolated-world
// page/reader.js (ButterPageReader), for the facts seek reads. Callers ask for facts; no selector
// leaves this file. Each function runs the same queries on the element it is given as seek ran
// inline before (one querySelector or querySelectorAll; turnMessageId up to two), so seek's DOM
// reads keep their number and order; none reads layout. List functions return the static
// NodeList itself, unspread.
// test/page-reader-contract.test.mjs checks it against test/fixtures/page/. Loads before
// seek/core-main.js. Nothing is shared across worlds: the answer-root rule and the message-id
// attributes are copied from page/reader.js, which holds the other copy.
(() => {
  // An answer root is the element whose children are an answer's blocks: the markdown root, or in
  // ChatGPT's Dil renderer the response root nested inside it behind wrapper layers (one of which
  // can hold an empty sibling). Only the response root owns blocks in the latter. Same rule as
  // page/reader.js ANSWER. Keep the isolated-world stream/offscreen.js ANSWER_ROOT and
  // stream/containment.css in sync; lab/harness/dil-renderer.mjs exercises all three against real
  // DOM, including the hr and wide-block exclusions.
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const ANSWER_ROOT = `:is(${COLUMN}:not(:has([class*="DilResponseRoot"])), ${COLUMN} [class*="DilResponseRoot"])`;
  // Seek's blocks: an answer root's children, except wide-block wrappers, table frames and rules
  // (the containment policy).
  const BLOCKS = `${ANSWER_ROOT} > :not([data-wide-block]):not([class*="TableFrame-"]):not(hr)`;
  // The preview's items: each question's bubble and every child of an answer root.
  const PREVIEW_ITEMS = `[data-user-message-bubble], ${ANSWER_ROOT} > *`;
  // A turn's message id: its first assistant role wrapper's data-message-id, else (live chats,
  // which have no such wrapper) its first data-chatgpt-selection-message-id. The same attributes
  // as page/reader.js MESSAGE.
  const ROLE = '[data-message-author-role="assistant"]';
  const SELECTION_ID = 'data-chatgpt-selection-message-id';

  globalThis.__butterPageReader = {
    // `scope` is a turn, a scroller or the document.
    // Seek's blocks under `scope`, in document order: the elements it observes and records.
    blocksIn: (scope) => scope.querySelectorAll(BLOCKS),
    // The preview's items under `scope`, in document order.
    previewItemsIn: (scope) => scope.querySelectorAll(PREVIEW_ITEMS),
    // Markdown columns: the markdown roots, whose box and style seek reads for width, font and
    // colour. The first under `scope` or null, and all of them in document order.
    firstColumn: (scope) => scope.querySelector(COLUMN),
    columnsIn: (scope) => scope.querySelectorAll(COLUMN),
    // Whether `turn` holds an answer's markdown column yet.
    hasAnswer: (turn) => !!turn.querySelector(COLUMN),
    // The message id of `turn`'s answer; null or undefined while it has none.
    turnMessageId: (turn) =>
      turn.querySelector(ROLE)?.getAttribute('data-message-id') ||
      turn.querySelector(`[${SELECTION_ID}]`)?.getAttribute(SELECTION_ID),
  };
  if (typeof module !== 'undefined') module.exports = globalThis.__butterPageReader;
})();
