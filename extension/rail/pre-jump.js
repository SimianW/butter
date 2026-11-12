// Isolated world. The send pre-jump (`ButterPreJump`): ChatGPT's submit spring visits every
// intervening virtualized turn, so when a question is sent from far up the chat, move close to the
// end before the spring's first frame, leaving it the final viewport to animate.
// The send is seen in the capture phase (the fetch-level `send` notification arrives after
// placement starts), but the jump waits for the bubble phase, after ChatGPT's own key or click
// handler: jumping before it made that handler mount and lay out the end of the chat before the
// composer cleared (lab: the Enter task took 3.1 s instead of 0.6 s, with the typed text still
// showing). Still in the same task, so the spring starts from the end. If nothing reaches the
// bubble phase, jump after the task.
// It belongs to the "smoother scrolling" switch (older + seek), not to the rail switch: it runs with
// the rail off. rail/rail.js installs it once with `scroller()`, the visible chat's scroller (or
// null), and `cancel()`, which stops a rail jump in progress. test/pre-jump.test.mjs drives it directly.
(() => {
  const COMPOSER_INPUT = '.ProseMirror[contenteditable="true"]';
  const SEND_BUTTON = '[data-testid="send-button"], #composer-submit-button, button[type="submit"]';
  function ButterPreJump({ scroller, cancel }) {
    const scrollingOff = () => {
      const off = document.documentElement?.getAttribute('data-butter-off')?.split(' ') || [];
      return off.includes('older') || off.includes('seek');
    };
    const beforeSend = (composer, type) => {
      if (scrollingOff()) return;
      const sc = scroller();
      if (!composer?.textContent.trim() || !sc?.isConnected || !sc.clientHeight) return;
      cancel();
      const s = scroller();
      const jump = () => {
        removeEventListener(type, jump);
        clearTimeout(late);
        if (s !== scroller() || !s.isConnected) return;
        const bottom = s.scrollHeight - s.clientHeight;
        if (bottom - s.scrollTop > 1.5 * s.clientHeight)
          s.scrollTo({ top: Math.max(0, bottom - s.clientHeight), behavior: 'instant' });
      };
      addEventListener(type, jump, { passive: true });
      const late = setTimeout(jump, 0);
    };
    addEventListener(
      'keydown',
      (e) => {
        if (
          e.key !== 'Enter' ||
          e.shiftKey ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          e.isComposing ||
          e.keyCode === 229 ||
          e.repeat ||
          !(e.target instanceof Element)
        )
          return;
        const composer = e.target.closest(COMPOSER_INPUT);
        const button = composer?.closest('form')?.querySelector(SEND_BUTTON);
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        beforeSend(composer, 'keydown');
      },
      { capture: true, passive: true },
    );
    addEventListener(
      'click',
      (e) => {
        if (!(e.target instanceof Element)) return;
        const button = e.target.closest(SEND_BUTTON);
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        beforeSend(button.closest('form')?.querySelector(COMPOSER_INPUT), 'click');
      },
      { capture: true, passive: true },
    );
  }
  globalThis.ButterPreJump = ButterPreJump;
  if (typeof module !== 'undefined') module.exports = ButterPreJump;
})();
