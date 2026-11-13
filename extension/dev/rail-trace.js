// Dev build only. Isolated world, loaded before rail/rail.js: the rail trace. It defines the rail's
// trace hook (`__butterRailTrace(step, fields)`, see rail/rail.js), turns a jump's steps into the
// bug file's `rail-*` events, and answers the recorder's request for the snapshot's `rail` part.
// The recorder runs in the MAIN world, so both go across as document events with JSON details:
// `butter-dev-rail` carries one event, `butter-dev-rail-snapshot-request` asks for the part and
// `butter-dev-rail-snapshot-response` answers it (dev/recorder-main.js listens and asks).
// Only numbers, booleans and fixed codes leave this file, except the questions' ids in the
// snapshot reply: the recorder compares them with ChatGPT's turn order and never stores them.
// test/dev-rail-trace.test.mjs drives it over the whole rail.
(() => {
  const TRIES = 8; // the jump's mount tries (rail/jump.js)
  const round = (x) => (Number.isFinite(x) ? Math.round(x) : null);
  const num = (x) => (Number.isFinite(x) ? x : null);
  // A bar's style as the rail model set it: `scale(<x>, <y>)` and an opacity.
  const SCALE = /^scale\(([^,]+), ([^)]+)\)$/;

  // `emit(type, fields)`: records one event. `now()`: the page's clock. `win`: devicePixelRatio
  // and visualViewport.
  function createRailTrace({ emit, now = () => performance.now(), win = globalThis }) {
    // What rail/rail.js lends the trace: { model, turns, host(), bars() }.
    let rail = null;
    // Jumps not ended yet, by their token: what their start saw, their tries, whether their target
    // mounted, why they were cancelled.
    const jumps = new Map();
    let latest = 0; // the newest jump's token

    const sc = () => rail?.turns.scroller ?? null;
    // The scroller's content top in viewport px: a rect's top minus this is in scroll coordinates.
    const origin = (s) => s.getBoundingClientRect().top - s.scrollTop;
    // The mounted turns' range in the rail's questions, as rail/turns.js `measure` finds it, and
    // the last one's bottom and its wrapper's (whose inline height is the virtualizer's
    // reservation), without measure's side effects on the turn tracker.
    const range = () => {
      const s = sc();
      let a = null,
        b = null,
        last = null;
      if (!s) return { mountedFrom: null, mountedTo: null };
      rail.turns.each((el) => {
        const j = rail.model.index(el.getAttribute('data-turn-key'));
        if (j == null) return;
        if (a == null || j < a) a = j;
        if (b == null || j > b) [b, last] = [j, el];
      });
      const out = { mountedFrom: a, mountedTo: b };
      if (last) {
        const top = origin(s),
          wrapper = last.parentElement;
        out.lastBottom = num(last.getBoundingClientRect().bottom - top);
        out.lastWrapperBottom = wrapper ? num(wrapper.getBoundingClientRect().bottom - top) : null;
        out.lastWrapperInline = !!wrapper?.style.height;
      }
      return out;
    };
    const scroll = () => {
      const s = sc();
      return {
        scrollTop: num(s?.scrollTop),
        scrollHeight: num(s?.scrollHeight),
        clientHeight: num(s?.clientHeight),
      };
    };
    // The target's top below the scroller's top (a landed jump's is 64), or null while unmounted.
    const topOf = (el) => {
      const s = sc();
      return s && el?.isConnected
        ? num(el.getBoundingClientRect().top - s.getBoundingClientRect().top)
        : null;
    };

    const outcome = (j, { landed, expired, el, pinned }) => {
      // The jump marks itself landed before the chat slides in and settles: one stopped during
      // that did not land.
      if (j.cause) return 'cancelled';
      if (latest > j.tok) return 'superseded';
      if (landed) return 'landed';
      if (expired) return 'expired';
      if (!j.mounted && !el) return j.tries >= TRIES ? 'never-mounted' : 'no-question';
      if (!el?.isConnected) return 'lost';
      if (pinned === false) return 'unpinned';
      return 'error'; // an exception ended it
    };

    const steps = {
      rail(fields) {
        rail = fields;
      },
      // A click on the tick whose trip is under way: ignored.
      repeat({ i }) {
        emit('rail-jump', { jump: latest, target: i, path: 'repeat', ...scroll() });
      },
      jump({ tok, i, earlier }) {
        latest = Math.max(latest, tok);
        for (const old of jumps.keys()) if (old < tok - 50) jumps.delete(old);
        const id = rail.model.qs[i]?.id,
          el = id == null ? null : rail.turns.el(id),
          top = topOf(el),
          { mountedFrom, mountedTo } = range();
        jumps.set(tok, {
          tok,
          at: now(),
          tries: 0,
          mounted: !!el,
          start: {
            target: i,
            activeBefore: rail.model.active,
            ...scroll(),
            mountedFrom,
            mountedTo,
            earlier: !!earlier,
            mounted: !!el,
          },
          // A glide's direction, from where its target is now (a trip's comes with its path).
          direction: top == null ? null : top > 64 ? 'down' : 'up',
        });
      },
      // Glide, trip, or a takeover of the trip in flight; `m` is the trip's direction (+1 up).
      path({ tok, path, m }) {
        const j = jumps.get(tok);
        if (!j) return;
        j.path = path;
        const direction = m == null ? j.direction : m > 0 ? 'up' : 'down';
        emit('rail-jump', { jump: tok, ...j.start, path, direction });
      },
      write({ tok, tries, estimate, written }) {
        const j = jumps.get(tok);
        if (!j) return;
        j.tries = tries + 1;
        const s = sc();
        j.write = {
          try: tries + 1,
          estimate: num(estimate),
          written: num(written),
          scrollTopRead: num(s?.scrollTop), // a clamped or refused write shows here
          scrollHeight: num(s?.scrollHeight),
          at: now(),
        };
      },
      mount({ tok, frames, el, live }) {
        const j = jumps.get(tok);
        if (!j?.write) return;
        if (el) j.mounted = true;
        const { at, ...write } = j.write;
        emit('rail-try', {
          jump: tok,
          ...write,
          frames,
          waitMs: round(now() - at),
          scrollTopAfter: num(sc()?.scrollTop),
          ...range(),
          mounted: !!el,
          live,
        });
      },
      // A readiness wait starts (quiet and steady start together).
      waiting({ tok }) {
        const j = jumps.get(tok);
        if (j) j.since = now();
      },
      wait({ tok, wait, live, pending }) {
        const j = jumps.get(tok);
        if (!j) return;
        j.mounted = true; // the readiness waits come after the target mounted
        // The recheck starts when the last of quiet and steady ended.
        const start = wait === 'recheck' ? j.waited : j.since;
        j.waited = now();
        emit('rail-wait', { jump: tok, wait, durationMs: round(j.waited - start), live, pending });
      },
      // cancel() runs on every user scroll; only one that stops a jump not ended yet is recorded.
      cancel({ tok, cause }) {
        const j = jumps.get(tok);
        if (!j || j.cause) return;
        j.cause = typeof cause === 'string' ? cause : 'other';
        emit('rail-cancel', { jump: tok, cause: j.cause });
      },
      end(fields) {
        const j = jumps.get(fields.tok);
        if (!j) return;
        jumps.delete(j.tok);
        const out = outcome(j, fields);
        emit('rail-end', {
          jump: j.tok,
          outcome: out,
          path: j.path ?? null,
          cause: out === 'cancelled' ? j.cause : undefined,
          elapsedMs: round(now() - j.at),
          tries: j.tries,
          expired: !!fields.expired,
          scrollTop: num(sc()?.scrollTop),
          targetTop: topOf(fields.el),
        });
      },
    };

    return {
      // The hook: one step of a jump with its fields (rail/jump.js), or the rail itself (`rail`).
      trace(step, fields) {
        if (Object.hasOwn(steps, step)) steps[step](fields ?? {});
      },
      // The snapshot's `rail` part, before the recorder compares `ids` with ChatGPT's turn order.
      // The model's state first, then the DOM reads.
      snapshot() {
        if (!rail) return { unavailable: 'missing' };
        const { model } = rail,
          qs = model.qs;
        const busy = model.busy == null ? null : (model.index(model.busy) ?? null);
        const state = {
          questions: qs.length,
          active: model.active,
          lit: model.lit,
          busy,
          pinned: model.pinned,
          flying: model.flying,
          hasPrev: model.hasPrev,
        };
        const ids = qs.map((q) => q.id);
        const host = rail.host(),
          bars = host ? rail.bars() : [];
        const ticks = {
          shown: !!host?.hasAttribute('data-on'),
          pitch: num(parseFloat(host?.style.getPropertyValue('--pitch'))),
          devicePixelRatio: num(win.devicePixelRatio),
          viewportScale: num(win.visualViewport?.scale),
          bars: bars.map((bar, index) => {
            const m = SCALE.exec(bar.style.transform ?? ''),
              r = bar.getBoundingClientRect(),
              t = bar.parentElement?.getBoundingClientRect();
            return {
              index,
              scaleX: m ? num(Number(m[1])) : null,
              scaleY: m ? num(Number(m[2])) : null,
              opacity: num(parseFloat(bar.style.opacity)),
              top: num(r.top),
              height: num(r.height),
              width: num(r.width),
              tickTop: num(t?.top),
              tickHeight: num(t?.height),
            };
          }),
        };
        return { ids, state, ticks };
      },
    };
  }

  globalThis.ButterDevRailTrace = { createRailTrace };
  if (typeof module !== 'undefined') {
    module.exports = globalThis.ButterDevRailTrace;
    return;
  }
  // In the page: events and the snapshot part go to dev/recorder-main.js.
  const send = (type, detail) =>
    document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(detail) }));
  const trace = createRailTrace({
    emit: (type, fields) => send('butter-dev-rail', { type, fields }),
  });
  globalThis.__butterRailTrace = trace.trace;
  document.addEventListener('butter-dev-rail-snapshot-request', () => {
    let part;
    try {
      part = trace.snapshot();
    } catch {
      part = { unavailable: 'error' };
    }
    send('butter-dev-rail-snapshot-response', part);
  });
})();
