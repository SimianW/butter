// Isolated world. Marks turns and answer blocks with `data-turbo-seen` once they've been laid out
// at their real size; turbo.css only skips rendering for marked elements. Because the browser has
// already remembered a marked element's real height (`contain-intrinsic-size: auto`), skipping it
// never swaps in a placeholder height: no scroll jumps, and ChatGPT's turn virtualizer measures
// true heights. (Marking whole answers instead isn't enough: ChatGPT inserts a remounted answer's
// blocks progressively, so late blocks would be skipped before they were ever measured.)
(() => {
  const TARGETS = '[data-turn-key], [data-markdown-text-style="assistant-message"] > :not([data-wide-block])';
  // Marks are flushed in one batch per second: each flush is one style invalidation pass instead
  // of one per streamed block. The delay also lets Chrome record the sizes before we mark.
  const FLUSH_MS = 1000;
  const queue = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const el of queue) if (el.isConnected) el.setAttribute('data-turbo-seen', '');
    queue.clear();
  };
  const ro = new ResizeObserver(entries => {
    for (const e of entries) {
      if (e.contentRect.height > 0 && e.target.isConnected) {
        ro.unobserve(e.target);
        queue.add(e.target);
      }
    }
    if (queue.size && !scheduled) { scheduled = true; setTimeout(() => requestAnimationFrame(flush), FLUSH_MS); }
  });
  const watch = el => {
    if (el.hasAttribute('data-turn-key')) globalThis.turboNavTurn?.(el);   // history rail (turbo-nav.js)
    if (!el.hasAttribute('data-turbo-seen')) ro.observe(el);
  };
  const scan = root => {
    if (root.matches?.(TARGETS)) watch(root);
    // Text and KaTeX spans make up most insertions while streaming; only containers can hold targets.
    if (root.firstElementChild) root.querySelectorAll(TARGETS).forEach(watch);
  };
  new MutationObserver(records => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document, { childList: true, subtree: true });
  if (document.documentElement) scan(document.documentElement);
})();
