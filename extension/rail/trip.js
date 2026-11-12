// Isolated world. The trip (`ButterRailTrip`): how a far jump looks. Both halves are things the
// compositor runs by itself, so they keep moving while the page is busy: opacity of the chat's
// content (the virtualizer's full-height box: turn > its wrapper > the window of mounted turns > the
// box), the browser's own smooth scrolling, and the placeholder layer `warp`, whose `streak` of text
// lines streams past. (A transform on the content box would make Chrome repaint all of it.)
// It privately owns the trip in progress: whose jump it is (`tok`), its direction, the content's
// fade, the placeholder's fade-in and its streaming loop. The jump (rail/jump.js) decides when
// to depart, redirect, arrive or end; this module does the animating and puts everything back.
// `ButterRailTrip.CSS` styles `.warp` and `.streak` in the rail's shadow root.
// test/rail-trip.test.mjs drives it directly.
(() => {
  const SPEED = 2.5; // far jumps travel at this many viewport heights per second
  const STREAK = 420; // height of one repeat of the travel placeholder, px
  const LEAVE = 260; // ms to speed off
  // Placeholder for a far jump: paragraphs of text lines and a centered formula, as seen when
  // scrolling too fast to read. Used as a mask so the color follows the theme.
  const STREAK_SVG =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${STREAK}" preserveAspectRatio="none">` +
        [
          [14, 100],
          [40, 96],
          [66, 98],
          [92, 58],
          [150, 30, 35],
          [204, 100],
          [230, 93],
          [256, 97],
          [282, 71],
          [340, 99],
          [366, 88],
        ]
          .map(([y, w, x = 0]) => `<rect x="${x}" y="${y}" width="${w}" height="10" rx="2"/>`)
          .join('') +
        '</svg>',
    );
  const CSS = `.warp { position: fixed; left: var(--wl); top: var(--wt); width: var(--ww); height: var(--wh); overflow: hidden;
      pointer-events: none; visibility: hidden; opacity: 0;
      -webkit-mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent);
      mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent); }
    .streak { position: absolute; left: 0; right: 0; top: -${STREAK}px; height: calc(100% + ${2 * STREAK}px);
      background: var(--streak); will-change: transform;
      -webkit-mask: url("${STREAK_SVG}") 0 0 / 100% ${STREAK}px repeat-y; mask: url("${STREAK_SVG}") 0 0 / 100% ${STREAK}px repeat-y; }`;

  // `warp` and `streak`: the placeholder layer and its lines, in the rail's shadow root.
  // `scroller()`: the visible chat's scroller.
  function ButterRailTrip({ warp, streak, scroller }) {
    let trip = null;
    const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollEnd = () =>
      new Promise((r) => {
        scroller().addEventListener('scrollend', r, { once: true });
        setTimeout(r, 1500);
      });
    const stream = (m) =>
      streak.animate([{ transform: 'none' }, { transform: `translateY(${m * STREAK}px)` }], {
        duration: STREAK / ((SPEED * scroller().clientHeight) / 1000),
        iterations: Infinity,
      });
    // Arrive: the chat, waiting `lead` px short of the target, fades in and scrolls the rest of the
    // way to `top()` (null: no target, just show the chat); the placeholder fades out.
    const arrive = (lead, top) => {
      const t = trip;
      trip = null;
      if (!t) return Promise.resolve();
      t.content?.isConnected &&
        t.content.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: lead ? 320 : 250,
          easing: 'ease-out',
        });
      t.off?.cancel();
      t.in?.cancel();
      if (t.in) {
        const out = warp.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 240,
          fill: 'forwards',
        });
        out.finished.then(
          () => {
            t.loop?.cancel();
            out.cancel();
            if (!trip) warp.style.visibility = 'hidden';
          },
          () => {},
        );
      }
      // Already there (near the chat's bottom both clamp): smooth scrolling won't move, so no
      // scrollend would come.
      const sc = scroller();
      if (!(top && lead) || Math.abs(top() - sc.scrollTop) < 1)
        return new Promise((r) => setTimeout(r, 250));
      const done = scrollEnd();
      sc.scrollTo({ top: top(), behavior: 'smooth' });
      return done;
    };
    return {
      // Speed off from `turn` (a mounted turn, or null): the chat scrolls toward the target and
      // fades while the placeholder lines fade in, streaming at SPEED. `m` = +1 moves the content
      // down (going up the chat), -1 up. A trip still in progress ends first. Resolves once it has
      // sped off.
      depart(turn, m, tok) {
        if (trip) arrive(0, null);
        const sc = scroller(),
          content = turn?.parentElement?.parentElement?.parentElement,
          T = LEAVE;
        trip = {
          tok,
          m,
          content: content && content !== sc && sc.contains(content) ? content : null,
        };
        trip.off = trip.content?.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: T,
          easing: 'ease-in',
          fill: 'forwards',
        });
        warp.style.visibility = 'visible';
        trip.in = warp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T, fill: 'forwards' });
        if (!still()) {
          sc.scrollTo({ top: sc.scrollTop - m * sc.clientHeight * 0.5, behavior: 'smooth' });
          trip.loop = stream(m);
        }
        return new Promise((r) => setTimeout(r, T));
      },
      // A new click mid-trip: the chat stays hidden and the placeholder turns around if the new
      // target is the other way. Waiting as long as speeding off would means a burst of clicks sends
      // the chat only to the last target, instead of making ChatGPT render every one on the way.
      redirect(m, tok) {
        trip.tok = tok;
        if (trip.loop && trip.m !== m) {
          trip.loop.cancel();
          trip.loop = stream(m);
        }
        trip.m = m;
        return new Promise((r) => setTimeout(r, LEAVE));
      },
      // Lands the trip `lead` px short of `top()`, as above; resolves once the chat has stopped.
      arrive,
      // A click during a trip takes the trip over: it belongs to jump `tok` now. Whether there was one.
      take(tok) {
        if (trip) trip.tok = tok;
        return !!trip;
      },
      // Shows the chat again at once: the trip of jump `tok`, or any trip without `tok`.
      end(tok) {
        if (trip && (tok === undefined || trip.tok === tok)) arrive(0, null);
      },
      get active() {
        return !!trip;
      },
    };
  }
  Object.assign(ButterRailTrip, { CSS });
  globalThis.ButterRailTrip = ButterRailTrip;
  if (typeof module !== 'undefined') module.exports = ButterRailTrip;
})();
