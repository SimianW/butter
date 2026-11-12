// Isolated world. The turn tracker (`ButterRailTurns`): which of ChatGPT's turns are mounted, in
// which scroller, and where. ChatGPT mounts a window of about five turns; `data-turn-key` is the id
// of the turn's question, and stream/offscreen.js reports every turn it mounts (`butterNavTurn`).
// It privately owns the visible scroller (following ChatGPT's hidden kept copies), the mounted
// turns, the ones on screen in the lit band, each question's last-seen position, the reconcile with
// the conversation, and noticing that the user scrolls. rail/rail.js and its jump (rail/journey.js)
// read it through the interface below; rail.js is told through its callbacks:
// - `changed()`: what the rail shows may have changed (scroller box, reconciled questions);
// - `kick()`: the lit band changed (not called while a jump travels);
// - `sync()`: check which conversation is open (a newly visible scroller or turn can precede the URL poll);
// - `scrolled()`: the user scrolls (wheel, touch, scrollbar, scroll keys): a jump in progress stops;
// - `mounted(el)`: a turn mounted in the visible scroller;
// - `ignore(target)`: a scroll key aimed here is not the chat's (the rail's own host).
// test/rail-turns.test.mjs drives it directly.
(() => {
  const EDGE = 40; // a turn showing only this much at the top or bottom isn't lit
  // Scrolling by keyboard too, unless the key goes to a text field, a button or the rail.
  const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
  // `model`: the rail presentation model (rail/model.js); this reads its questions, box and
  // journey status, and gives it the scroller's box and the mounted turns to reconcile.
  function ButterRailTurns(model, { changed, kick, sync, scrolled, mounted: onMount, ignore }) {
    const { HEADER, COMPOSER } = globalThis.ButterRailModel || require('./model.js');
    let sc = null,
      ioPos = null,
      ioBand = null;
    const onScreen = new Set(); // mounted turn elements with any part in view
    const mounted = new Map(); // question id -> its turn element while mounted
    const pos = new Map(); // question id -> top of its turn in scroll coordinates, last seen
    const mountedEl = (id) => {
      const el = mounted.get(id);
      return el?.isConnected && sc?.contains(el) ? el : null;
    };

    // ChatGPT keeps chats opened earlier in the tab as hidden copies, each with its own scroller, and
    // shows a copy again without remounting anything: follow whichever scroller is visible.
    // Layout is clean in a ResizeObserver callback, so reading it there is free.
    const scrollers = new WeakSet();
    const ro = new ResizeObserver((es) => {
      for (const e of es) {
        const s = e.target;
        if (!s.isConnected) {
          ro.unobserve(s);
          continue;
        }
        if (e.contentRect.width > 0 && s !== sc) attach(s);
        if (s !== sc) continue;
        const r = s.getBoundingClientRect();
        model.measure({
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right - (s.offsetWidth - s.clientWidth),
          gutter: s.offsetWidth - s.clientWidth,
          width: r.width,
        });
        changed();
      }
    });

    const attach = (s) => {
      sync(); // a newly visible scroller can precede both its turns and the next URL poll
      ioPos?.disconnect();
      ioBand?.disconnect();
      sc = s;
      model.measure(null);
      onScreen.clear();
      ioPos = new IntersectionObserver(
        (es) => {
          for (const e of es)
            pos.set(
              e.target.getAttribute('data-turn-key'),
              e.boundingClientRect.top - e.rootBounds.top + sc.scrollTop,
            );
        },
        { root: sc },
      );
      // Every question showing more than EDGE px between the header and the composer is lit. A jump
      // lands its question TOP_INSET down, so the turn above shows only TOP_INSET - HEADER px under the
      // header (its last line or action buttons) and doesn't light too. Not shown while a jump is travelling.
      ioBand = new IntersectionObserver(
        (es) => {
          for (const e of es)
            if (e.isIntersecting && e.target.isConnected) onScreen.add(e.target);
            else onScreen.delete(e.target);
          if (!model.flying) kick();
        },
        { root: sc, rootMargin: `-${HEADER + EDGE}px 0px -${COMPOSER + EDGE}px 0px` },
      );
      for (const el of mounted.values())
        if (el.isConnected && sc.contains(el)) {
          ioPos.observe(el);
          ioBand.observe(el);
        }
      if (!reconcileQueued) {
        reconcileQueued = true;
        setTimeout(reconcile, 150);
      }
    };

    let reconcileQueued = false;
    globalThis.butterNavTurn = (el) => {
      sync();
      const s = el.closest('.thread-scroll-container');
      if (!s) return;
      if (!scrollers.has(s)) {
        scrollers.add(s);
        ro.observe(s);
        // Any user scroll cancels a jump in progress.
        s.addEventListener('wheel', scrolled, { passive: true });
        s.addEventListener('touchstart', scrolled, { passive: true });
        s.addEventListener(
          'pointerdown',
          (e) => {
            const box = model.box;
            if (s === sc && e.target === s && box && e.clientX >= box.right) scrolled();
          },
          { passive: true },
        ); // scrollbar
      }
      mounted.set(el.getAttribute('data-turn-key'), el);
      if (s === sc) {
        onMount(el);
        ioPos.observe(el);
        ioBand.observe(el);
      }
      if (!reconcileQueued) {
        reconcileQueued = true;
        setTimeout(reconcile, 150);
      }
    };
    addEventListener(
      'keydown',
      (e) => {
        const t = e.target;
        if (
          !SCROLL_KEYS.has(e.key) ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          !(t instanceof Element) ||
          ignore(t)
        )
          return;
        if (
          t.isContentEditable ||
          t.closest('input, textarea, select') ||
          (e.key === ' ' && t.closest('button, a, [role="button"]'))
        )
          return;
        scrolled();
      },
      { capture: true, passive: true },
    );

    // Mounted turns are consecutive in the thread: rail/conversations.js adds any the responses
    // didn't cover and drops questions that sit between two of them (old branch).
    const reconcile = () => {
      reconcileQueued = false;
      if (!sc?.isConnected || !model.box?.width) return; // a hidden copy holds another chat's turns
      const keys = [...sc.querySelectorAll('[data-turn-key]')].map((t) =>
        t.getAttribute('data-turn-key'),
      );
      const text = (id) =>
        mounted.get(id)?.querySelector('[data-user-message-bubble]')?.textContent.trim();
      if (model.reconcile(keys, text)) changed();
    };

    // Records where the mounted turns are now, adds them to `seen`, and returns their range in `qs`
    // ([Infinity, -1] if none). The turn after them starts where the last one ends, which keeps an
    // estimate below a tall turn from landing inside it again.
    const measure = (seen) => {
      const qs = model.qs;
      const top = sc.getBoundingClientRect().top - sc.scrollTop;
      let a = Infinity,
        b = -1,
        bottom = 0;
      for (const [id, el] of mounted) {
        if (!el.isConnected || !sc.contains(el)) continue;
        const r = el.getBoundingClientRect();
        pos.set(id, r.top - top);
        seen.add(id);
        const j = model.index(id);
        if (j != null) {
          a = Math.min(a, j);
          if (j > b) {
            b = j;
            bottom = r.bottom - top;
          }
        }
      }
      if (b >= 0 && b + 1 < qs.length) {
        pos.set(qs[b + 1].id, bottom);
        seen.add(qs[b + 1].id);
      }
      return [a, b];
    };

    return {
      // The visible chat's scroller (null before one is seen).
      get scroller() {
        return sc;
      },
      // Question `id`'s turn element while it is mounted in the visible scroller, else null.
      el: mountedEl,
      // Ids of the mounted turns showing in the lit band.
      onScreen() {
        const ids = [];
        for (const el of onScreen)
          if (el.isConnected) ids.push(el.getAttribute('data-turn-key'));
          else onScreen.delete(el);
        return ids;
      },
      // Forgets where every turn was: earlier messages went in above them, or another chat opened.
      forget() {
        pos.clear();
      },
      // Start the lit set over. An observer reports a turn only when it crosses the band, so turns
      // already in view must be observed afresh: ChatGPT can show a chat kept in the tab, or change
      // the URL after mounting the new chat's turns, and clearing alone left no tick lit until a scroll.
      reband() {
        onScreen.clear();
        if (ioBand)
          for (const el of mounted.values())
            if (el.isConnected && sc.contains(el)) {
              ioBand.unobserve(el);
              ioBand.observe(el);
            }
      },
      measure,
      // Where question `i`'s turn should be, in scroll coordinates: last seen there, or
      // interpolated between the nearest questions that were (or the chat's ends).
      estimate(i) {
        const qs = model.qs;
        let lo = i,
          hi = i;
        while (lo >= 0 && !pos.has(qs[lo].id)) lo--;
        while (hi < qs.length && !pos.has(qs[hi].id)) hi++;
        const y = (j) => pos.get(qs[j].id);
        if (lo === i) return y(i);
        const end = sc.scrollHeight;
        if (lo < 0 && hi >= qs.length) return (end * i) / qs.length;
        if (lo < 0) return (y(hi) * i) / hi;
        if (hi >= qs.length) return y(lo) + ((end - y(lo)) * (i - lo)) / (qs.length - lo);
        return y(lo) + ((y(hi) - y(lo)) * (i - lo)) / (hi - lo);
      },
      // Question `i` didn't mount where the records put it: ChatGPT has re-measured turns or
      // inserted earlier messages since they were taken. Measures again (as `measure`), then drops
      // the older records between the turns mounted now and the target, so the next estimate starts
      // from these and moves toward the target. Positions in `seen` (read during this jump) stay:
      // after an overshoot they bound the target from the other side.
      retarget(i, seen) {
        const [a, b] = measure(seen);
        const [from, to] =
          b < 0 || (i >= a && i <= b) ? [i, i + 1] : i < a ? [0, a] : [b + 2, model.qs.length];
        for (let j = from; j < to; j++) if (!seen.has(model.qs[j].id)) pos.delete(model.qs[j].id);
        return [a, b];
      },
      // Calls `fn(el)` for each turn mounted in the visible scroller.
      each(fn) {
        for (const el of mounted.values()) if (el.isConnected && sc.contains(el)) fn(el);
      },
    };
  }
  globalThis.ButterRailTurns = ButterRailTurns;
  if (typeof module !== 'undefined') module.exports = ButterRailTurns;
})();
