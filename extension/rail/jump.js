// Isolated world. The jump (`ButterRailJump`): moving the chat to a question or a bookmark from
// the rail, as a glide when the question is near and mounted, otherwise as a trip (rail/trip.js)
// while ChatGPT renders it, loading earlier pages first for the three dots. A turn ChatGPT hasn't
// mounted has no element to scroll to: go where it should be (the turn tracker's estimate), let
// ChatGPT mount it, then align.
// It privately owns the jump in progress: its token, the journey (a far jump's deadline and
// readiness, carried over when a new click takes the trip over), the pin keeping the clicked
// question aligned until the user scrolls, the bookmark landing, the busy tick and the earlier
// wait. It publishes its status to the rail presentation model: `flying` (only its target is lit),
// `pinned`, the active question (`setActive`), the busy tick and the earlier wait; the model
// decides what is lit. rail/rail.js builds it with `trip()`, the trip once the rail is built (or
// null), and `view`, the rail effects a jump has:
// - `kick()`: what is lit may have changed;
// - `busy()`: the ticks' busy classes follow the model's busy tick;
// - `wait(on)`: an earlier trip loads pages for a bookmark (the three dots blink, their card
//   refills);
// - `found(i, keyboard)`: that bookmark is under question `i` now: focus follows a keyboard trip to
//   its tick, and the dots' card goes away;
// - `trace(step, fields)` (optional): the dev build's trace hook, given each step of a jump
//   (dev/rail-trace.js); `fields()` runs only in the dev build.
// test/rail-jump.test.mjs drives it directly.
(() => {
  const TOP_INSET = 64; // a jumped-to question lands this far below the scroller's top
  const PAGE_AT = 240; // ChatGPT loads earlier messages when scrolled within ~230px of the top
  const MAX_EARLIER = 50; // at most 100 older turns / 60s per click; another click continues
  const MAX_TRIP = 12000;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // `model`: the rail presentation model (rail/model.js); `turns`: the turn tracker (rail/turns.js).
  function ButterRailJump(model, turns, trip, view) {
    const sc = () => turns.scroller;
    const trace = view.trace ?? (() => {});
    const setActive = (id) => {
      if (model.setActive(id)) view.kick();
    };
    // `wait` is the bookmark an earlier trip loads pages for: the dots blink and its row shows a
    // spinner. `waitKeyboard`: that trip came from the keyboard.
    let wait = null,
      waitKeyboard = false;
    const setWait = (next) => {
      wait = next;
      model.journey({ wait: next?.key ?? null });
      view.wait(!!wait);
    };
    // Waits for the bookmark session to send the marks of the items as they are now.
    const synced = async (live) => {
      for (const end = performance.now() + 1500; live() && performance.now() < end; ) {
        if (model.synced()) return;
        await frame();
      }
    };

    let jumpTok = 0,
      journey = null;
    const landedAt = () => {
      model.journey({ flying: false });
      view.kick();
    };
    // Stops a jump in progress and shows the chat again at once. `cause`: why (the dev build's trace).
    const cancel = (cause) => {
      trace('cancel', () => ({ tok: jumpTok, cause }));
      jumpTok++;
      journey = null;
      model.journey({ flying: false });
      unpin();
      trip()?.end();
      if (busyTok) setBusy(null);
      if (wait) setWait(null);
    };
    // From a click until the user scrolls, the clicked question stays the current one (`pinned`).
    let anchor = null;
    // Delayed KaTeX or a remounted neighbour can grow even after arrival. While the tick is pinned,
    // size changes keep its question aligned; no polling or layout reads while the chat is idle.
    const follow = (id, tok, off = 0) => {
      anchor?.ro.disconnect();
      const observe = (el) => {
        ro.observe(el);
        if (el.getAttribute('data-turn-key') === id)
          for (let p = el.parentElement; p && p !== sc(); p = p.parentElement) ro.observe(p);
      };
      const ro = new ResizeObserver((entries) => {
        // A remount gets observed by butterNavTurn; retain the logical id, not the old element.
        for (const e of entries) if (!e.target.isConnected) ro.unobserve(e.target);
        if (tok !== jumpTok || !model.pinned) return;
        const el = turns.el(id);
        if (el) {
          const t = targetTop(el, anchor.off);
          if (Math.abs(t - sc().scrollTop) > 2) sc().scrollTop = t;
        }
      });
      anchor = { ro, observe, off };
      turns.each(observe);
    };
    const unpin = () => {
      anchor?.ro.disconnect();
      anchor = null;
      if (!model.pinned) return;
      model.journey({ pinned: false });
      view.kick(); // back to lighting what is on screen; the set kept up to date while pinned
    };
    // A bookmark jump lands on the bookmarked text instead of the question: px below the turn's top.
    let landing = null;
    const landOff = (el) =>
      (landing && el.getAttribute('data-turn-key') === landing.id && landing.land(el)) || 0;
    // A bookmark trip from a card row that lands on live text gets the wash (#73) instead of the
    // bubble's flash: once the page has stopped, bookmarks/content.js washes the bookmarked text.
    // A stale bookmark lands with the flash, as a question jump does.
    const washes = (el) =>
      !!landing?.wash &&
      el?.getAttribute('data-turn-key') === landing.id &&
      !!landing.wash(el, false);
    const washAt = (el) => {
      el = el && turns.el(el.getAttribute('data-turn-key'));
      if (washes(el)) landing.wash(el);
    };
    const targetTop = (el, off = 0) =>
      Math.max(
        0,
        Math.min(
          sc().scrollHeight - sc().clientHeight,
          sc().scrollTop +
            el.getBoundingClientRect().top -
            sc().getBoundingClientRect().top -
            TOP_INSET +
            off +
            landOff(el),
        ),
      );

    // `want`: an earlier trip for a bookmark (its key) on the dots. Pages load only until bookmarks/
    // content.js places it under a question, then the trip lands on its text as a bookmark jump does.
    // `wash(turn, draw)`: the bookmark's landing wash, for a trip from a card row (`draw` false: only
    // whether there is one).
    const jump = async (i, earlier = false, land = null, want = null, wash = null) => {
      landing = land && !earlier ? { id: model.qs[i].id, land, wash } : null;
      globalThis.ButterBookmarkPage?.unwash(); // a new jump puts the last wash away at once
      // Repeated input for the current destination keeps its in-progress readiness work.
      // (Not during an earlier-dots trip: its target moves to older questions as pages arrive.)
      if (!earlier && trip().active && !journey?.earlier && model.busy === model.qs[i].id)
        return trace('repeat', () => ({ i }));
      const flight = journey ?? {
        end: performance.now() + (earlier ? 60000 : MAX_TRIP),
        ready: new Map(),
      };
      flight.earlier = earlier;
      const tok = ++jumpTok,
        end = flight.end,
        live = () => tok === jumpTok && performance.now() < end;
      setWait(want ? { key: want, tok } : null);
      anchor?.ro.disconnect();
      anchor = null;
      let id = model.qs[i].id;
      // A click during a trip takes the trip over (its jump is no longer live). Ending it would fade the
      // chat in and out again while the page is busy, showing whatever half-rendered part it is at.
      const relay = trip().take(tok);
      trace('jump', () => ({ tok, i, earlier }));
      setBusy(null);
      model.journey({ flying: true });
      setActive(id);
      model.journey({ pinned: true });
      view.kick(); // setActive kicks only when the index changes
      let el = turns.el(id);
      // Close by: glide there.
      if (
        !earlier &&
        !relay &&
        el &&
        Math.abs(targetTop(el) - sc().scrollTop) < sc().clientHeight * 1.5 &&
        !(model.hasPrev && targetTop(el) < PAGE_AT)
      ) {
        journey = null;
        trace('path', () => ({ tok, path: 'glide' }));
        await glide(el, live);
        trace('end', () => ({ tok, landed: tok === jumpTok, el: turns.el(id) }));
        if (tok === jumpTok) landedAt();
        if (live() && model.pinned) follow(id, tok);
        else if (tok === jumpTok) unpin();
        return;
      }
      // Farther away the turn is unmounted or skipped by content-visibility, and rendering it takes the
      // page a second or more (more if arriving at the top makes ChatGPT load earlier messages), during
      // which nothing can paint; scrolling through the real turns in between would render each of them.
      // So the trip is played on the compositor, which keeps animating while the page is busy: the
      // chat speeds off toward the target, placeholder lines stream past while ChatGPT renders the
      // target behind them, and the chat slides in at the same speed and slows to a stop on it.
      // Content moves down when going up. Which side the target is on comes from the mounted turns,
      // whose positions are read now, rather than from records that may be stale.
      journey = flight;
      const seen = new Set();
      const [, b] = turns.measure(seen);
      const m = earlier
        ? 1
        : -(
            Math.sign(
              el
                ? targetTop(el) - sc().scrollTop
                : b < 0
                  ? turns.estimate(i) - sc().scrollTop
                  : i - b,
            ) || 1
          );
      trace('path', () => ({ tok, path: relay ? 'takeover' : 'trip', m }));
      setBusy(want ? null : id, tok); // a bookmark's trip blinks the dots instead
      let landed = false,
        target = want && model.placed(want);
      try {
        if (live())
          await (relay
            ? trip().redirect(m, tok)
            : trip().depart(el ?? sc().querySelector('[data-turn-key]'), m, tok));
        if (!live()) return;
        if (earlier) {
          const loadEnd = end - 10000; // reserve time to align/reveal after the loading bound
          for (
            let pages = 0;
            !target &&
            model.hasPrev &&
            pages < MAX_EARLIER &&
            live() &&
            performance.now() < loadEnd;
            pages++
          ) {
            // Leave and re-enter the paging band: a prepend can keep the sentinel intersecting.
            sc().scrollTop = PAGE_AT + 32;
            await frame();
            await frame();
            if (!live()) return;
            const page = nextPage(Math.min(10000, loadEnd - performance.now()), live); // arm before scrolling
            sc().scrollTop = 0;
            if (!(await page)) break; // stalled/offline: reveal the oldest loaded question
            await frame();
            id = model.items.find((x) => x.q != null)?.id;
            // The fetch hook reports before React commits. Don't start another page in that gap.
            const until = performance.now() + 2000;
            while (live() && !turns.el(id) && performance.now() < until) {
              sc().scrollTop = 0;
              await frame();
            }
            if (want) {
              await synced(live);
              target = model.placed(want);
            }
          }
          await frame();
          if (!live()) return;
          if (target) {
            // The bookmark's answer is loaded: land on its text (at its question's start if stale).
            id = target;
            i = model.index(id);
            landing = {
              id,
              land: (turn) => {
                const m = model.mark(id),
                  b = m?.bookmarks.find((x) => x.key === want);
                return b ? m.land(turn, b) : null;
              },
              wash: (turn, draw) => {
                const m = model.mark(id),
                  b = m?.bookmarks.find((x) => x.key === want);
                return !!b && !!m.wash?.(turn, b, draw);
              },
            };
            // Focus follows a keyboard trip to the bookmark's tick; the dots' card goes away.
            setWait(null);
            view.found(i, waitKeyboard);
          } else {
            setWait(null);
            i = 0;
            id = model.qs[0]?.id;
          }
          el = turns.el(id);
          setActive(id);
          setBusy(id, tok);
        }
        el = turns.el(id);
        for (let tries = 0; tries < 8 && !el && live(); tries++) {
          i = model.index(id); // earlier pages may have changed the question's index
          if (i == null) return;
          // Where the records put the target, it didn't mount: measure again and move toward it.
          if (tries) turns.retarget(i, seen);
          const estimate = turns.estimate(i),
            written = Math.max(0, estimate - TOP_INSET);
          sc().scrollTop = written;
          trace('write', () => ({ tok, tries, estimate, written }));
          let f = 0;
          for (; f < 30 && live() && !(el = turns.el(id)); f++) await frame();
          trace('mount', () => ({ tok, frames: f, el, live: live() }));
        }
        if (!el || !live()) return;
        sc().scrollTop = targetTop(el);
        let ready = flight.ready.get(id);
        const top =
          sc().scrollTop + el.getBoundingClientRect().top - sc().getBoundingClientRect().top;
        if (!ready || ready.el !== el || Math.abs(ready.top - top) > 2) {
          ready = { el, top, geometry: {} };
          flight.ready.set(id, ready);
        }
        if (!ready.page) {
          if (!earlier && model.hasPrev && sc().scrollTop < PAGE_AT) {
            trace('waiting', () => ({ tok }));
            await nextPage(4000, live);
            await new Promise((r) => setTimeout(r, 150));
            trace('wait', () => ({ tok, wait: 'page', live: live() }));
          }
          if (!live()) return;
          ready.page = true;
        }
        // Soon after a chat opens ChatGPT mounts formulas as raw TeX and typesets them a moment later.
        const pendingMath = () =>
          [...(turns.el(id)?.querySelectorAll('[data-math-source]') ?? [])].some(
            (x) => !x.querySelector('.katex'),
          );
        if (!ready.math || pendingMath()) {
          trace('waiting', () => ({ tok }));
          for (
            const end = performance.now() + 3000;
            live() && performance.now() < end && pendingMath();

          )
            await frame();
          trace('wait', () => ({ tok, wait: 'math', live: live(), pending: pendingMath() }));
          if (!live()) return;
          ready.math = !pendingMath();
        }
        el = turns.el(id);
        if (!el || !live()) return;
        const lead = reduced() ? 0 : m * Math.min(400, sc().clientHeight * 0.4);
        follow(id, tok, lead); // keep correcting while hidden, during reveal, and across remounts
        // Quiet frames and stable target geometry overlap. Recheck after quiet: it can outlast the
        // geometry check while ChatGPT renders another neighbour. Unrelated total-height growth is OK.
        trace('waiting', () => ({ tok }));
        const waited = (wait) => () => trace('wait', () => ({ tok, wait, live: live() }));
        await Promise.all([
          ready.quiet ? null : quiet(live, 4000).then(waited('quiet')),
          steady(el, live, lead, 3000, 150, ready.geometry).then(waited('steady')),
        ]);
        if (!live()) return;
        ready.quiet = true;
        el = await steady(el, live, lead, 3000, 150, ready.geometry);
        trace('wait', () => ({ tok, wait: 'recheck', live: live() })); // since quiet and steady
        if (!live() || !el?.isConnected || !model.pinned) return;
        flash(el);
        landed = true;
        anchor.off = 0;
        await trip().arrive(lead, () => targetTop(el));
        if (tok === jumpTok) {
          landedAt(); // stopped moving; settle only nudges by a few px
          washAt(el);
          trace('arrived', () => ({ tok }));
        }
        await settle(el, live);
      } finally {
        const expired = tok === jumpTok && performance.now() >= end;
        // A takeover inherits the first click's deadline. At expiry keep a mounted, aligned target;
        // otherwise reveal where ChatGPT got to and release the anchor, without another render.
        if (expired && !landed) {
          el = turns.el(id);
          if (el) {
            // `follow` may still hold it `lead` px short of the landing spot: align it before the reveal.
            const t = targetTop(el);
            if (model.pinned) sc().scrollTop = t;
            landed = Math.abs(t - sc().scrollTop) <= 2;
            if (landed) {
              flash(el);
              washAt(el);
            }
          }
        }
        trace('end', () => ({ tok, landed, expired, el: turns.el(id), pinned: model.pinned }));
        trip().end(tok);
        if (busyTok === tok) setBusy(null);
        if (wait?.tok === tok) setWait(null);
        if (tok === jumpTok) {
          journey = null;
          landedAt();
          if (landed && model.pinned) follow(id, tok);
          else unpin();
        }
      }
    };

    const scrollEnd = () =>
      new Promise((r) => {
        sc().addEventListener('scrollend', r, { once: true });
        setTimeout(r, 1500);
      });
    // The browser's smooth scrolling runs on the compositor: it keeps going if the page is busy.
    const glide = async (el, live) => {
      flash(el);
      // Already there: smooth scrolling won't move, so no scrollend would come.
      const top = targetTop(el);
      if (Math.abs(top - sc().scrollTop) >= 1) {
        const done = scrollEnd();
        sc().scrollTo({ top, behavior: 'smooth' });
        await done;
      }
      if (live()) {
        washAt(el);
        trace('arrived', () => ({ tok: jumpTok }));
      }
      await settle(el, live);
    };
    // A few quiet frames don't mean neighbouring answers have finished mounting/typesetting. Keep
    // following the question through arrival, including a replacement of its virtualized element.
    const settle = (el, live) => steady(el, live, 0, 2000, 350);
    const steady = async (el, live, off = 0, max = 3000, span = 150, state = {}) => {
      const end = performance.now() + max,
        id = el.getAttribute('data-turn-key');
      while (live() && performance.now() < end) {
        el = turns.el(id);
        if (!el) {
          state.el = null;
          state.since = performance.now();
          await frame();
          continue;
        }
        const top =
          sc().scrollTop + el.getBoundingClientRect().top - sc().getBoundingClientRect().top;
        if (state.el !== el || Math.abs(state.top - top) > 2 || state.since == null) {
          state.el = el;
          state.top = top;
          state.since = performance.now();
        }
        const t = Math.max(
          0,
          Math.min(sc().scrollHeight - sc().clientHeight, top - TOP_INSET + off + landOff(el)),
        );
        if (Math.abs(t - sc().scrollTop) > 2) sc().scrollTop = t;
        if (performance.now() - state.since >= span) return el;
        await frame();
      }
      return turns.el(id);
    };
    // Resolves once the page paints at a normal pace again: three frames under 40 ms in a row.
    const quiet = async (live, max) => {
      const end = performance.now() + max;
      let last = await frame(),
        ok = 0;
      while (ok < 3 && live() && performance.now() < end) {
        const t = await frame();
        ok = t - last < 40 ? ok + 1 : 0;
        last = t;
      }
    };
    // Conversation-scoped and cancellable. A response from a hidden chat cannot wake this wait;
    // timed-out waits leave no callbacks behind. Completion also includes empty final pages.
    const nextPage = async (max, live) => {
      const first = model.items[0]?.id,
        end = performance.now() + max;
      while (live() && performance.now() < end) {
        if (!model.hasPrev || model.items[0]?.id !== first) return true;
        await frame();
      }
      return false;
    };

    let busyTok = 0;
    const setBusy = (id, tok = 0) => {
      model.journey({ busy: id });
      busyTok = tok;
      view.busy();
    };

    const flash = (el) => {
      const b = el.querySelector('[data-user-message-bubble]');
      if (!b || washes(el)) return;
      b.removeAttribute('data-butter-flash');
      void b.offsetWidth;
      b.setAttribute('data-butter-flash', '');
      setTimeout(() => b.removeAttribute('data-butter-flash'), 1600);
    };

    return {
      // Jumps to question `i` (a tick's click).
      go: (i) => jump(i),
      // Jumps to bookmark `b`, of `mark` (the model's marks of question `i`): lands on its text.
      bookmark: (i, mark, b) =>
        jump(
          i,
          false,
          (turn) => mark.land(turn, b),
          null,
          (turn, draw) => mark.wash?.(turn, b, draw),
        ),
      // Loads earlier pages: with bookmark `b` (a row on the dots' card), until its answer is known
      // and mounted, then lands on its text; without, the previous page (a click on the three dots:
      // ChatGPT loads it when the top of the chat comes into view).
      earlier(b, keyboard) {
        if (!sc() || !model.qs.length) return;
        if (b) waitKeyboard = keyboard;
        jump(0, true, null, b ? b.key : null);
      },
      cancel,
      // A turn mounted in the visible scroller (the turn tracker's `mounted`): followed while pinned.
      observe: (el) => anchor?.observe(el),
    };
  }
  globalThis.ButterRailJump = ButterRailJump;
  if (typeof module !== 'undefined') module.exports = ButterRailJump;
})();
