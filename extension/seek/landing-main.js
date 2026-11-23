// MAIN world: the landing, what a seek release does after its commit, each frame until the chat
// is revealed: look for an estimated destination that did not mount, move to the previewed text
// (semantic retarget, or the question as fallback), correct drift and history-block alignment,
// then reveal and record the seek outcome. Classic script, loaded before seek/preview-main.js,
// which calls the factory once with its live state as getters, then once per release for `ready`.
globalThis.__butterSeekLanding = ({
  core,
  layoutCheck,
  event,
  emit,
  hide,
  conv,
  seekOutcome,
  active,
  revealOwner,
  est,
  tap,
}) => {
  // ---- swap alignment audit: where the preview showed text vs where the real text is ----
  const textRect = (root, needle) =>
    (globalThis.__butterAnchorTextBoxes?.(root, needle) || []).map((r) => r.top);
  // The swap audit is anchor-main.js's (__butterAnchorVisibleSwap), which loads before this file.
  function measureSwap(a) {
    a.swap = globalThis.__butterAnchorVisibleSwap(a);
  }
  // One release session `a`: its per-release state, and `ready`, which preview-main.js's commit
  // schedules once it has dispatched the destination scroll.
  return (a) => {
    let prev = 0,
      quiet = 0,
      lastTop = NaN;
    a.retargets = [];
    a.finds = [];
    const find = layoutCheck.finder({ limit: 4 });
    // findTurn's input (layoutCheck.findInput): the search aims at the target's top, by own rows.
    const look = () => layoutCheck.findInput(a);
    const rowTop = (el) =>
      el.parentElement.getBoundingClientRect().top -
      a.sc.getBoundingClientRect().top +
      a.sc.scrollTop;
    const ready = () => {
      if (revealOwner() !== a || a.canceled) return;
      if (active() || a.conv !== conv() || !a.sc.isConnected) {
        if (!active()) hide();
        return;
      }
      const now = performance.now(),
        d = a.destination,
        el = d && a.sc.querySelector(`[data-turn-key="${CSS.escape(d.id)}"]`);
      const pendingMath =
        el &&
        [...el.querySelectorAll('[data-math-source]')].some((n) => !n.querySelector('.katex'));
      // An estimated destination unmounted where the frozen model put it: look for it from the
      // mounted turns. A stored-layout destination is not looked for (#134).
      const from = a.sc.scrollTop,
        to = d && !d.layout ? find(now, el ? NaN : from, look) : null;
      if (to != null) {
        a.finds.push({ t: Math.round(now - a.end), from: Math.round(from), to: Math.round(to) });
        a.sc.scrollTop = to;
        event('find', a.finds.at(-1));
        if (tap()) emit('retarget', { kind: 'find', to, error: to - from });
        quiet = prev = 0;
      }
      if (el && !pendingMath && d.layout && !a.semantic) {
        // Aligned rows do not prove aligned text (fallback excerpts, transformed text): always check the anchor.
        const candidates =
          !est().hidden && a.estTurn === d.id
            ? [est()]
            : [...a.rendered]
                .filter(([i]) => a.prep.model[a.prep.flat[i].turn].id === d.id)
                .map(([, el]) => el);
        let visible;
        for (const el of candidates) {
          visible = globalThis.__butterAnchorVisibleNeedles?.(el, a.hostRect, 1)?.[0];
          if (visible) break;
        }
        a.semantic = {
          needle: visible?.needle || null,
          previewY: visible?.y ?? a.hostRect.y,
          anchorVisible: !!visible,
          attempts: 0,
          passes: 0,
          matched: false,
        };
      }
      if (el && !pendingMath && a.semantic && !a.semantic.done) {
        const sem = a.semantic;
        sem.passes++;
        const ys = sem.needle ? textRect(el, sem.needle) : [],
          y = ys.length
            ? ys.reduce((x, y) => (Math.abs(x - sem.previewY) < Math.abs(y - sem.previewY) ? x : y))
            : null;
        if (y != null) {
          sem.matched = true;
          sem.lastError = y - sem.previewY;
          const r = layoutCheck.semanticTarget({
            scrollTop: a.sc.scrollTop,
            realY: y,
            previewY: sem.previewY,
            maxScroll: a.sc.scrollHeight - a.sc.clientHeight,
          });
          if (r && sem.attempts < 3) {
            sem.attempts++;
            sem.clamped = r.clamped;
            a.sc.scrollTop = r.to;
            quiet = 0;
            prev = 0;
            event('semantic-retarget', { to: r.to, error: r.delta });
            if (tap()) emit('retarget', { kind: 'semantic', to: r.to, error: r.delta });
            requestAnimationFrame(ready);
            return;
          }
        } else {
          // Math-only/unmatched previews retain the selected question identity.
          const q =
            el.querySelector('[data-user-message-bubble]') ||
            el.querySelector('[data-message-author-role="user"]');
          if (q) {
            const y = q.getBoundingClientRect().top;
            sem.matched = false;
            sem.fallback = true;
            sem.lastError = y - a.hostRect.y;
            const r = layoutCheck.semanticTarget({
              scrollTop: a.sc.scrollTop,
              realY: y,
              previewY: a.hostRect.y,
              maxScroll: a.sc.scrollHeight - a.sc.clientHeight,
            });
            if (r && sem.attempts < 3) {
              sem.attempts++;
              sem.clamped = r.clamped;
              a.sc.scrollTop = r.to;
              quiet = 0;
              prev = 0;
              event('semantic-question-fallback', { to: r.to });
              if (tap()) emit('retarget', { kind: 'question', to: r.to, error: r.delta });
              requestAnimationFrame(ready);
              return;
            }
          }
        }
        sem.done = sem.matched || sem.fallback || sem.passes >= 4;
      }
      if (el && !pendingMath && !a.semantic && a.retargets.length < 2 && !a.alignmentCorrection) {
        const s = a.sc;
        const bubble = !d.layout && el.querySelector('[data-user-message-bubble]');
        const actual = bubble
          ? bubble.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop
          : rowTop(el);
        const r = core.retarget({
          known: true,
          frozenTurnTop: d.turnTop,
          actualTurnTop: actual,
          offset: d.offset,
          height: d.height,
          scrollTop: s.scrollTop,
          maxScroll: s.scrollHeight - s.clientHeight,
        });
        if (r) {
          a.retargets.push({
            t: now - a.end,
            drift: Math.round(r.drift),
            from: Math.round(s.scrollTop),
            to: Math.round(r.to),
          });
          s.scrollTop = r.to;
          event('retarget', a.retargets.at(-1));
          if (tap()) emit('retarget', { kind: 'drift', to: r.to, error: r.drift });
          quiet = 0;
          prev = 0;
          requestAnimationFrame(ready);
          return;
        }
      }
      const top = a.sc.scrollTop;
      if (prev && now - prev < 50 && Math.abs(top - lastTop) < 2 && el && !pendingMath) quiet++;
      else quiet = 0;
      prev = now;
      lastTop = top;
      if (quiet >= 3 || now - a.end > 10000) {
        // Prepending history may remove/change the old first turn's date/prefix without changing
        // the answer blocks. For a measured destination, preserve their shared visible position.
        // This branch is deliberately limited to sessions that began with unloaded history.
        if (quiet >= 3 && !a.semantic && a.hasPrev && d.layout && !a.alignmentCorrection) {
          measureSwap(a);
          const audit = a.swap,
            error = audit.itemErrSignedMedian;
          if (audit.items >= 2 && audit.itemErrSpread <= 2 && Math.abs(error) > 4) {
            const from = a.sc.scrollTop,
              to = Math.max(0, Math.min(a.sc.scrollHeight - a.sc.clientHeight, from - error));
            a.alignmentCorrection = { from, to, error, clamped: Math.abs(from - to - error) > 2 };
            a.sc.scrollTop = to;
            quiet = 0;
            prev = 0;
            lastTop = NaN;
            event('history-block-alignment', a.alignmentCorrection);
            if (tap()) emit('retarget', { kind: 'history-block', to, error });
            requestAnimationFrame(ready);
            return;
          }
        }
        // The target never mounted after a search: back to where the commit left the chat.
        if (!el && a.finds.length) a.sc.scrollTop = a.finds[0].from;
        a.readable = now;
        a.timedOut = quiet < 3;
        a.realTop = a.sc.scrollTop;
        hide(true);
        if (el) {
          const bubble = !d.layout && el.querySelector('[data-user-message-bubble]');
          const actual = bubble
            ? bubble.getBoundingClientRect().top - a.sc.getBoundingClientRect().top + a.sc.scrollTop
            : rowTop(el);
          a.actualTurnTop = actual;
          a.pixelModelErrorPx = actual + d.offset - top;
          const error =
            a.semantic && (a.semantic.matched || a.semantic.fallback)
              ? a.semantic.lastError
              : a.pixelModelErrorPx;
          // At either scroll boundary, text cannot always reach the preview inset. Validate
          // the achievable destination, retaining the raw model/semantic error for diagnostics.
          const target = Math.max(0, Math.min(a.sc.scrollHeight - a.sc.clientHeight, top + error));
          a.landingErrorPx = target - top;
          a.turnTopErrorPx = actual - d.turnTop;
        }
        try {
          measureSwap(a);
        } catch (err) {
          a.swapError = String(err);
        }
        const failed =
          a.timedOut || !Number.isFinite(a.landingErrorPx) || Math.abs(a.landingErrorPx) > 4;
        seekOutcome({
          exercised: true,
          failed,
          engaged: !failed && ['pointerup', 'mouseup'].includes(a.reason),
        });
        event('reveal', { ms: now - a.end, error: a.landingErrorPx, timedOut: a.timedOut });
        if (tap())
          emit('reveal', {
            durationMs: now - a.end,
            error: a.landingErrorPx,
            timedOut: a.timedOut,
            matched: a.semantic?.matched ?? null,
            fallback: a.semantic?.fallback ?? null,
          });
      } else requestAnimationFrame(ready);
    };
    return ready;
  };
};
