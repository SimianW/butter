// Isolated world. The readiness waits (`ButterRailReadiness`) of a far jump (rail/jump.js): once its
// target has mounted, the chat is held near it, hidden, until ChatGPT has loaded the next earlier
// page, paints at a normal pace again, and keeps the target still; after arrival `steady` keeps
// following it while it settles. Each wait takes the jump's `live()` and stops once it is false.
// test/rail-jump.test.mjs and test/rail-jump-lost.test.mjs drive them through the jump.
(() => {
  // A target unmounted this long is gone, not having its element replaced in place by ChatGPT.
  const LOST = 250;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  // `model`: the rail presentation model (rail/model.js); `turns`: the turn tracker
  // (rail/turns.js); `targetTop(el, off)`: the scrollTop that puts turn `el` `off` px past its
  // landing spot.
  function ButterRailReadiness(model, turns, targetTop) {
    const sc = () => turns.scroller;
    // Whether question `id`'s target is lost: seen unmounted for LOST ms in a row, from one call
    // to the next (`state.gone`: since when). Once lost, `state.lost` stays set.
    const lost = (id, state) => {
      if (turns.el(id)) state.gone = null;
      else if (performance.now() - (state.gone ??= performance.now()) >= LOST) state.lost = true;
      return !!state.lost;
    };
    // Keeps question `el`'s turn at `targetTop(el, off)`, across a replacement of its virtualized
    // element, until its top has stayed within 2 px for `span` ms or `max` ms pass; resolves to its
    // element then (null while unmounted). `state` carries the target's element, top and since when
    // it is still from one call to the next.
    const steady = async (el, live, { off = 0, max = 3000, span = 150, state = {} } = {}) => {
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
        const t = targetTop(el, off);
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
    return { lost, steady, quiet, nextPage };
  }
  globalThis.ButterRailReadiness = ButterRailReadiness;
  if (typeof module !== 'undefined') module.exports = ButterRailReadiness;
})();
