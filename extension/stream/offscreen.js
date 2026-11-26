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
// in the frame where its height leaves the placeholder (after a find, see `sized`), at the flush
// that marks it seen, when its answer leaves in_progress (unless it is held), when cv goes off or
// comes back on, when its turn starts streaming again, and when it comes back into the page
// outside the veil's rules (see watch()).
// Pre-layout: a held block's first style and layout, and the relayout its math fonts bring, would
// otherwise wait for whatever first needs them (a find, a jump into the answer); see prelayout().
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
  // A find, a selection, a focus or a scrollIntoView in a skipped block renders it on the spot, and
  // the state-change event that unveils it is a task posted then: a frame that runs first (on a
  // busy page, the browser's find bar) lays the block out and draws it veiled, blank. So a veiled
  // block is also watched for its height: skipped, it has its placeholder height; it renders at its
  // own (very rarely the same), and a ResizeObserver reports that in the frame, after layout and
  // before paint, where the block is unveiled. The first report is the placeholder; a block that
  // leaves the page (0 px) or is unveiled is let go.
  const placeholder = new WeakMap(),
    sized = new ResizeObserver((entries) => {
      for (const { target: el, contentRect: r } of entries)
        if (!el.hasAttribute(VEIL) || !r.height) sized.unobserve(el);
        else if (!placeholder.has(el)) placeholder.set(el, r.height);
        else if (r.height !== placeholder.get(el)) unveil(el);
    });
  const veil = (el) => {
    el.setAttribute(VEIL, '');
    placeholder.delete(el);
    sized.observe(el);
  };
  const unveil = (el) => {
    if (!el.hasAttribute(VEIL)) return;
    sized.unobserve(el);
    el.removeAttribute(VEIL);
    el.setAttribute(UNVEILED, '');
    unveiled.add(el);
    if (unveiled.size === 1) requestAnimationFrame(settle);
  };
  // Pre-layout (GLOSSARY.md): once an answer has completed, its held blocks are laid out in idle
  // time, a few per idle callback, so that a later find or jump into them finds them laid out, as
  // when ChatGPT's telemetry walk read into them at completion before the veil stopped it. A layout
  // read inside a skipped block (a Range over its contents; the block's own box is contained) makes
  // Chromium update that subtree on the spot, and the result persists. The blocks stay skipped,
  // held and veiled: nothing is drawn, written or resized. The first pass waits until the answer
  // has completed (never in an opened chat) and FLUSH_MS more, out of ChatGPT's completion work.
  // Web fonts that the pass itself requests (KaTeX's) arrive after it and invalidate the blocks laid
  // out before them, so every finished font load lays the laid-out blocks still held out again (a
  // clean block costs nothing). Each idle callback stops after CHUNK_MS, one block at least (live,
  // one block took 1-17 ms). It stops for good when cv goes off; while the document is hidden it
  // pauses, and it resumes where it stopped when the document shows (visibilitychange). A block is
  // skipped once it has rendered, left the page or its turn streams again.
  // A page that draws a frame every frame (a requestAnimationFrame loop, a scroll) gets no idle
  // periods at all: live, no idle callback ran for 15 s after completion. So each callback is also
  // due WAIT_MS after it is requested, and one that runs on that timeout still lays out CHUNK_MS
  // of blocks, at most one short task per WAIT_MS on a busy page
  // (notes/runs/2026-11-24-veil-acceptance/round2/prelayout-live/report.md).
  const CHUNK_MS = 8,
    WAIT_MS = 50,
    pending = new Set(), // held blocks queued for pre-layout
    prelaid = new WeakSet(); // blocks pre-layout has laid out (weak: a block that leaves is let go)
  let idle = 0,
    range;
  // A block pre-layout may lay out: in the page, held and not rendered since, its turn not streaming.
  const stillHeld = (el) =>
    el.isConnected &&
    waiting.has(el) &&
    el.hasAttribute('data-butter-unrendered') &&
    !el.closest(BUSY);
  const hidden = () => document.visibilityState === 'hidden';
  const stop = () => {
    pending.clear();
    if (idle) cancelIdleCallback(idle);
    idle = 0;
  };
  const request = () => {
    if (pending.size && !idle && !hidden()) idle = requestIdleCallback(chunk, { timeout: WAIT_MS });
  };
  const chunk = (deadline) => {
    idle = 0;
    if (off()) return stop();
    if (hidden()) return; // the queue waits for visibilitychange
    const end =
      performance.now() +
      (deadline.didTimeout ? CHUNK_MS : Math.min(CHUNK_MS, deadline.timeRemaining()));
    for (const el of pending) {
      pending.delete(el);
      if (!stillHeld(el)) continue;
      range ??= document.createRange();
      range.selectNodeContents(el);
      range.getBoundingClientRect();
      prelaid.add(el);
      if (performance.now() >= end) break;
    }
    request();
  };
  const prelayout = (els) => {
    if (off()) return;
    for (const el of els) if (stillHeld(el)) pending.add(el);
    request();
  };
  const relayout = () => prelayout([...waiting].filter((el) => prelaid.has(el)));
  document.fonts?.addEventListener('loadingdone', relayout);
  document.addEventListener('visibilitychange', request);
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
        veil(el);
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
          if (r.oldValue === 'in_progress')
            setTimeout(() => prelayout(t.querySelectorAll('[data-butter-unrendered]')), FLUSH_MS);
        } else if (t && r.oldValue !== 'in_progress' && r.target.matches(BUSY))
          // The turn streams again (Regenerate, Edit), maybe into its old elements: no veil from
          // before stays on. A held block so unveiled is still skipped; it only loses the gain.
          // Only the change into in_progress counts, not another state change inside a busy turn.
          for (const el of t.querySelectorAll(`[${VEIL}]`)) unveil(el);
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['data-talvt-turn-state'],
  });
  let wasOff = off(); // the event also comes for other settings
  document.addEventListener('butter-settings', () => {
    const isOff = off();
    if (isOff) {
      stop();
      ro.disconnect();
      queue.clear();
      waiting.clear();
      // Every block renders with cv off, so none may be veiled again once it is back on.
      for (const el of document.querySelectorAll(`[${VEIL}]`)) (unveil(el), drawn.add(el));
    } else {
      // Back on: every block in the page rendered while cv was off, also one streamed or brought
      // back then, which no event recorded and the cv-off sweep did not see. None keeps a veil,
      // and none is veiled again.
      if (wasOff) for (const el of document.querySelectorAll(BLOCKS)) (unveil(el), drawn.add(el));
      if (document.documentElement) scan(document.documentElement);
    }
    wasOff = isOff;
  });
  if (document.documentElement) scan(document.documentElement);
})();
