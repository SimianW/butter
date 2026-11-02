// Runs in the page's main world at document_start.
(() => {
  const MARK = Symbol.for('chatgpt-butter.installed');
  if (window[MARK]) return;
  window[MARK] = true;

  const cfg = window.__butterConfig || {};
  const smoothMs = Number.isFinite(cfg.smoothMs) ? Math.min(Math.max(cfg.smoothMs, 0), 2000) : 250;
  let hook;
  let matched = false;
  let statusPath = location.pathname;
  document.addEventListener('butter-status-request', () => {
    if (statusPath !== location.pathname) { statusPath = location.pathname; matched = false; }
    document.dispatchEvent(new CustomEvent('butter-status-response', { detail: JSON.stringify({
      throttle: { configured: smoothMs > 0, available: window.requestAnimationFrame === hook,
        matched, engaged: matched },
    }) }));
  });
  if (!(smoothMs > 0)) return;

  // ChatGPT's stream smoother drains buffered text a few characters at a time and schedules
  // `requestAnimationFrame(() => { this.frame = void 0, this.publish() })` every frame; each publish
  // re-renders the answer and restyles the page. We let that one callback through at most once
  // per `smoothMs`. The smoother computes how much text to reveal from elapsed time, so fewer
  // publishes means bigger steps, not slower text. Anything that doesn't match exactly is untouched.
  const raf = window.requestAnimationFrame;
  const caf = window.cancelAnimationFrame;
  const fnToString = Function.prototype.toString;
  const SMOOTHER = /^\(\)\s*=>\s*\{\s*this\.frame\s*=\s*void 0\s*,\s*this\.publish\(\)\s*;?\s*\}$/;
  const isSmootherPublish = cb => {
    if (typeof cb !== 'function' || cb.length !== 0) return false;
    try { return SMOOTHER.test(fnToString.call(cb)); } catch { return false; }
  };

  const stats = window.__butterStats = { smootherFrames: 0, published: 0 };
  let lastRun = 0;
  // Handles we hand out come from the native allocator, so they can't collide with other code's ids.
  const pending = new Map();   // handle -> { canceled, timer, realId }

  hook = window.requestAnimationFrame = function requestAnimationFrame(cb) {
    if (!isSmootherPublish(cb)) return raf.call(window, cb);
    // Switched off in the popup (butter-settings.js). Checked only for the smoother's callback.
    if (document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('throttle')) return raf.call(window, cb);
    if (statusPath !== location.pathname) { statusPath = location.pathname; matched = false; }
    matched = true;
    stats.smootherFrames++;
    const entry = { canceled: false, timer: 0, realId: 0 };
    const run = t => {
      pending.delete(handle);
      if (entry.canceled) return;
      lastRun = performance.now(); stats.published++;
      cb(t);
    };
    const handle = raf.call(window, t => {
      if (entry.canceled) return;
      const wait = lastRun + smoothMs - performance.now();
      if (wait <= 0) return run(t);
      entry.timer = setTimeout(() => {
        entry.timer = 0;
        if (!entry.canceled) entry.realId = raf.call(window, run);
      }, wait);
    });
    pending.set(handle, entry);
    return handle;
  };

  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    const entry = pending.get(id);
    if (!entry) return caf.call(window, id);
    entry.canceled = true;
    pending.delete(id);
    caf.call(window, id);
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.realId) caf.call(window, entry.realId);
  };
})();
