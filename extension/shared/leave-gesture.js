// Isolated world, before rail/turns.js. The leave gesture (`ButterLeaveGesture`): everything Butter
// knows about how ChatGPT decides that the reader left the chat's end. ChatGPT keeps an end pin: while it is set and the transcript grows, it scrolls
// the chat to its end (the end pull). A script's scrollTop write never clears it. The reader's own
// scrollbar gesture does, also when a script shows it to ChatGPT: on the scroller itself, a mouse
// pointerdown aimed at the scroller, a change of scrollTop with the chat's height unchanged, one
// scroll event, then pointerup. ChatGPT then applies its rule for a native drag: a move away from
// the end clears the pin, and a move toward the end that ends within AT_END px of it sets it
// (measured on 2026-11-24, notes/runs/2026-11-24-rail-jump-gesture/report.md). The rail's jump
// (rail/jump.js) shows it through here. A file loads in one world only (test/seek-ui.test.mjs), so
// the seek preview's release, in the MAIN world, has its part in shared/leave-gesture-main.js,
// which holds the other copy of `isReaderInput`. DOM events cross script worlds and expando properties
// do not, so `isReaderInput(e)` is how both worlds tell the gesture (and any other event Butter
// dispatches) from the reader's own input. test/rail-jump-end-pin.test.mjs drives it against a
// fake of ChatGPT's end pin.
(() => {
  // ChatGPT's own "at the end" distance: a move toward the end that stops this close to it sets the
  // end pin (read from ChatGPT's scroll code on 2026-11-23, notes/runs/2026-11-23-seek-pin-cause).
  const AT_END = 24;

  // The scrollbar press, at the scroller's right edge, as ChatGPT's listener takes it.
  const press = (sc, type) => {
    const r = sc.getBoundingClientRect(),
      x = Math.round(r.right - 5),
      y = Math.round(r.top + r.height / 2);
    sc.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: globalThis.window,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
      }),
    );
  };

  const ButterLeaveGesture = {
    AT_END,
    // The reader is leaving the chat's end in scroller `sc`, for scrollTop `dest`: shows ChatGPT the
    // scrollbar gesture around a 1 px step up, and returns whether it showed it. Nothing is shown
    // when `dest` is not above the chat (the move is not away from the end), when it is within
    // AT_END px of the end (a jump that lands at the end leaves following as it was), or when the
    // chat is at its top already. The step, not the whole move: a jump's first move is often a
    // smooth scroll, which changes nothing at once, and ChatGPT's virtualizer must not see a
    // scroll event at the far destination. The step is not put back.
    leave(sc, dest) {
      const top = sc.scrollTop;
      if (!(dest < top) || sc.scrollHeight - sc.clientHeight - dest <= AT_END || top < 1)
        return false;
      press(sc, 'pointerdown');
      sc.scrollTop = top - 1;
      sc.dispatchEvent(new Event('scroll'));
      press(sc, 'pointerup');
      return true;
    },
    // Whether event `e` is the reader's own input rather than one Butter dispatched.
    isReaderInput: (e) => e.isTrusted !== false,
  };

  globalThis.ButterLeaveGesture = ButterLeaveGesture;
  if (typeof module !== 'undefined') module.exports = ButterLeaveGesture;
})();
