// Isolated world. Marks turns and answer blocks with `data-butter-seen` once they've been laid out
// at their real size; butter.css only skips rendering for marked elements. Because the browser has
// already remembered a marked element's real height (`contain-intrinsic-size: auto`), skipping it
// never swaps in a placeholder height: no scroll jumps, and ChatGPT's turn virtualizer measures
// true heights.
(() => {
  const TARGETS = '[data-markdown-text-style="assistant-message"] > :not([data-wide-block])';
  const ro = new ResizeObserver(entries => {
    for (const e of entries) {
      if (e.contentRect.height > 0 && e.target.isConnected) {
        e.target.setAttribute('data-butter-seen', '');
        ro.unobserve(e.target);
      }
    }
  });
  const watch = el => { if (!el.hasAttribute('data-butter-seen')) ro.observe(el); };
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
