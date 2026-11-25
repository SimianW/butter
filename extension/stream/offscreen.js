// Isolated world. Marks turns and answer blocks with `data-butter-seen` once they've been laid out
// at their real size; stream/containment.css only skips rendering for marked elements. Because the browser has
// already remembered a marked element's real height (`contain-intrinsic-size: auto`), skipping it
// never swaps in a placeholder height: no scroll jumps, and ChatGPT's turn virtualizer measures
// true heights. (Marking whole answers instead isn't enough: ChatGPT inserts a remounted answer's
// blocks progressively, so late blocks would be skipped before they were ever measured.)
// Blocks of an answer still streaming are skipped before they are marked (containment.css). ChatGPT
// does not scroll with the stream, so most of a long answer arrives below the fold and is skipped
// before it ever renders: its size is then only the 120px placeholder. Such a block is not marked;
// at the flush it gets data-butter-unrendered instead, which keeps it skipped after the answer
// completes (containment.css). It is marked once it has rendered, when it comes into view.
// The attribute must be in place before completion: ChatGPT lays out every block that is no longer
// skipped in the same task that marks the answer complete, before any observer callback runs, so
// letting a long answer's never-rendered blocks render then cost a 0.5 s freeze.
// An answer block that starts being skipped before it ever rendered is veiled (data-butter-veil,
// containment.css) until it renders: the veil comes off first thing when it stops being skipped,
// at the flush that marks it seen, when its answer leaves in_progress (unless it is held), when
// cv goes off, and when it comes back into the page outside the veil's rules (see watch()).
(() => {
  const off = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('cv');
  // Turns, and the answer blocks stream/containment.css may skip (copied from there; separate
  // script world): the markdown root's children except the Dil source wrapper, and the children of
  // a Dil response root; never wide blocks or table frames. No :has(), as there.
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const TARGETS = `[data-turn-key], ${BLOCKS}`;
  const BUSY = '[data-talvt-turn-state="in_progress"]'; // a turn whose answer is streaming
  // Marks are flushed in one batch per second: each flush is one style invalidation pass instead
  // of one per streamed block. The delay also lets Chrome record the sizes before we mark.
  const FLUSH_MS = 1000;
  const queue = new Set(),
    skipped = new WeakSet(),
    waiting = new Set(), // skipped when their size came in: wait until they render
    // Waited and then rendered: content-visibility stopped skipping them, so they were laid out
    // and the browser remembered their real size. One scrolled past again before the flush (a
    // scrollbar drag through the answer) is marked anyway; holding it back again left it a
    // placeholder for the seek recorder however often it was read.
    shown = new WeakSet(),
    drawn = new WeakSet(); // blocks whose content has rendered at least once: never veiled again
  let scheduled = false;
  // Veil (GLOSSARY.md): see containment.css. Unveiling must not start an opacity transition when
  // ChatGPT's styles put one on a block, so an unveiled block keeps data-butter-unveiled, under
  // which containment.css turns transitions off, until the style change that unveils it is done:
  // the blocks unveiled before a frame are taken at its start and cleared at the next one's.
  const VEIL = 'data-butter-veil',
    UNVEILED = 'data-butter-unveiled',
    unveiled = new Set();
  const settle = () => {
    const batch = [...unveiled];
    unveiled.clear();
    requestAnimationFrame(() => batch.forEach((el) => el.removeAttribute(UNVEILED)));
  };
  const unveil = (el) => {
    if (!el.hasAttribute(VEIL)) return;
    el.removeAttribute(VEIL);
    el.setAttribute(UNVEILED, '');
    unveiled.add(el);
    if (unveiled.size === 1) requestAnimationFrame(settle);
  };
  const flush = () => {
    scheduled = false;
    if (off()) {
      queue.clear();
      return;
    }
    for (const el of queue)
      if (!el.isConnected) continue;
      else if (skipped.has(el) && !shown.has(el)) hold(el);
      else {
        el.setAttribute('data-butter-seen', '');
        el.removeAttribute('data-butter-unrendered');
        unveil(el);
      }
    queue.clear();
  };
  // Only answer blocks take the attribute; containment.css has no rule for it on turns.
  const hold = (el) => {
    waiting.add(el);
    if (!el.hasAttribute('data-turn-key')) el.setAttribute('data-butter-unrendered', '');
  };
  const rendered = (el) => {
    skipped.delete(el);
    drawn.add(el);
    if (waiting.delete(el) && el.isConnected) {
      shown.add(el);
      ro.observe(el); // reports its rendered size
    }
  };
  document.addEventListener(
    'contentvisibilityautostatechange',
    (e) => {
      const el = e.target;
      if (!e.skipped) {
        unveil(el); // first: a block that renders must never be drawn veiled
        return rendered(el);
      }
      skipped.add(el);
      if (!off() && !drawn.has(el) && !el.hasAttribute('data-butter-seen') && el.matches(BLOCKS))
        el.setAttribute(VEIL, '');
    },
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
    if (el.hasAttribute('data-turn-key')) globalThis.butterNavTurn?.(el); // history rail's turn tracker (rail/turns.js)
    // A block that comes into the page veiled, not held and outside a streaming turn left the veil's
    // rules where no completion sweep saw it (its turn completed out of the document, or it moved),
    // so it renders: unveil it before a hold brings it back under the rules on screen, which draws
    // a frame before the state-change event that would unveil it.
    if (el.hasAttribute(VEIL) && !el.hasAttribute('data-butter-unrendered') && !el.closest(BUSY))
      unveil(el);
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
      // An answer that completes is no longer under the streaming rule. Its held-back blocks stay
      // skipped (data-butter-unrendered). Skipped blocks still queued for the flush got no
      // attribute in time, so ChatGPT's completion layout has just rendered them: measure them.
      // Every veiled block that is not held renders now too, also one that was never queued:
      // unveil them all.
      if (r.type === 'attributes') {
        const t = r.target.closest?.('[data-turn-key]');
        if (t && !t.matches(BUSY) && !t.querySelector(BUSY)) {
          for (const el of queue)
            if (skipped.has(el) && t.contains(el))
              (queue.delete(el), waiting.add(el), rendered(el));
          for (const el of t.querySelectorAll(`[${VEIL}]`))
            if (!el.hasAttribute('data-butter-unrendered')) unveil(el);
          for (const el of waiting) if (!el.isConnected) waiting.delete(el);
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
      // Every block renders with cv off, so none may be veiled again once it is back on.
      for (const el of document.querySelectorAll(`[${VEIL}]`)) (unveil(el), drawn.add(el));
    } else if (document.documentElement) scan(document.documentElement);
  });
  if (document.documentElement) scan(document.documentElement);
})();
