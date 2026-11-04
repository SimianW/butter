// Isolated world. Marks turns and answer blocks with `data-butter-seen` once they've been laid out
// at their real size; stream/containment.css only skips rendering for marked elements. Because the browser has
// already remembered a marked element's real height (`contain-intrinsic-size: auto`), skipping it
// never swaps in a placeholder height: no scroll jumps, and ChatGPT's turn virtualizer measures
// true heights. (Marking whole answers instead isn't enough: ChatGPT inserts a remounted answer's
// blocks progressively, so late blocks would be skipped before they were ever measured.)
// Blocks of an answer still streaming are skipped before they are marked (containment.css). ChatGPT
// does not scroll with the stream, so most of a long answer arrives below the fold and is skipped
// before it ever renders: its size is then only the 120px placeholder. Such a block is not marked;
// it is marked once it has rendered: when it comes into view, or when the answer completes and the
// streaming rule no longer skips it.
(() => {
  const off = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('cv');
  const TARGETS =
    '[data-turn-key], [data-markdown-text-style="assistant-message"] > :not([data-wide-block])';
  // Marks are flushed in one batch per second: each flush is one style invalidation pass instead
  // of one per streamed block. The delay also lets Chrome record the sizes before we mark.
  const FLUSH_MS = 1000;
  const queue = new Set(),
    skipped = new WeakSet(),
    waiting = new Set(); // skipped when their size came in: wait until they render
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    if (off()) {
      queue.clear();
      return;
    }
    for (const el of queue)
      if (!el.isConnected) continue;
      else if (skipped.has(el)) waiting.add(el);
      else el.setAttribute('data-butter-seen', '');
    queue.clear();
  };
  const rendered = (el) => {
    skipped.delete(el);
    if (waiting.delete(el) && el.isConnected) ro.observe(el); // reports its rendered size
  };
  document.addEventListener(
    'contentvisibilityautostatechange',
    (e) => (e.skipped ? skipped.add(e.target) : rendered(e.target)),
    true,
  );
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.contentRect.height > 0 && e.target.isConnected) {
        ro.unobserve(e.target);
        queue.add(e.target);
      }
    }
    if (queue.size && !scheduled) {
      scheduled = true;
      setTimeout(() => requestAnimationFrame(flush), FLUSH_MS);
    }
  });
  const watch = (el) => {
    if (el.hasAttribute('data-turn-key')) globalThis.butterNavTurn?.(el); // history rail (rail/rail.js)
    if (!off() && !el.hasAttribute('data-butter-seen')) ro.observe(el);
  };
  const scan = (root) => {
    if (root.matches?.(TARGETS)) watch(root);
    // Text and KaTeX spans make up most insertions while streaming; only containers can hold targets.
    if (root.firstElementChild) root.querySelectorAll(TARGETS).forEach(watch);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
      // An answer that completes is no longer under the streaming rule: its unmarked blocks render,
      // including skipped ones still queued for the next flush.
      if (r.type === 'attributes' && (waiting.size || queue.size)) {
        const t = r.target.closest?.('[data-turn-key]');
        const busy = '[data-talvt-turn-state="in_progress"]';
        if (t && !t.matches(busy) && !t.querySelector(busy)) {
          for (const el of queue)
            if (skipped.has(el) && t.contains(el)) (queue.delete(el), waiting.add(el));
          for (const el of waiting)
            if (!el.isConnected) waiting.delete(el);
            else if (t.contains(el)) rendered(el);
        }
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-talvt-turn-state'],
  });
  document.addEventListener('butter-settings', () => {
    if (off()) {
      ro.disconnect();
      queue.clear();
      waiting.clear();
    } else if (document.documentElement) scan(document.documentElement);
  });
  if (document.documentElement) scan(document.documentElement);
})();
