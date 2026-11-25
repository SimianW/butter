// MAIN world, before history/conversation-main.js. The leave gesture's MAIN-world part
// (`ButterLeaveGesture`), for the seek preview (seek/preview-main.js) and the history thumb hold
// (history/conversation-main.js). How ChatGPT decides that the reader left the chat's end is in the
// isolated world's shared/leave-gesture.js; a file loads in one world only (test/seek-ui.test.mjs),
// so `readers` here is the other copy of its own. test/seek-release-pin.test.mjs drives it against
// the fake of ChatGPT's end pin.
(() => {
  const ButterLeaveGesture = {
    // The seek preview's release: the reader's real scrollbar press is still down and the chat has
    // moved under it, so ChatGPT is shown only the scrollbar gesture's scroll event, before its
    // pointerup (the drag's own scroll events were kept from it).
    release(sc) {
      sc.dispatchEvent(new Event('scroll'));
    },
    // Whether event `e` is the reader's own input rather than one Butter dispatched (the rail's leave
    // gesture, from the isolated world, or the release's scroll event).
    readers: (e) => e.isTrusted !== false,
  };

  globalThis.ButterLeaveGesture = ButterLeaveGesture;
  if (typeof module !== 'undefined') module.exports = ButterLeaveGesture;
})();
