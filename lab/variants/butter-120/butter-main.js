// Runs in the page's main world at document_start.
(() => {
  const cfg = window.__butterConfig || {};
  const smoothMs = cfg.smoothMs ?? 120;
  if (!(smoothMs > 0)) return;

  // ChatGPT's stream smoother drains buffered text a few characters at a time and schedules
  // `requestAnimationFrame(() => { this.frame = undefined; this.publish() })` every frame.
  // We let those particular callbacks through at most once per `smoothMs`. The smoother computes
  // how much text to reveal from elapsed time, so fewer publishes means bigger steps, not slower text.
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  const isSmootherPublish = cb => {
    if (typeof cb !== 'function' || cb.length !== 0) return false;
    const src = Function.prototype.toString.call(cb);
    return src.length < 80 && src.includes('.publish()');
  };

  const stats = window.__butterStats = { smootherFrames: 0, published: 0 };
  let lastRun = 0;
  let nextId = -1;
  const pending = new Map();   // fake id -> { timer, realId }

  window.requestAnimationFrame = function (cb) {
    if (!isSmootherPublish(cb)) return raf(cb);
    stats.smootherFrames++;
    const id = nextId--;
    const entry = { timer: 0, realId: 0 };
    const fire = () => {
      entry.timer = 0;
      entry.realId = raf(t => { pending.delete(id); lastRun = performance.now(); stats.published++; cb(t); });
    };
    const wait = lastRun + smoothMs - performance.now();
    if (wait > 0) entry.timer = setTimeout(fire, wait); else fire();
    pending.set(id, entry);
    return id;
  };

  window.cancelAnimationFrame = function (id) {
    const entry = pending.get(id);
    if (!entry) return caf(id);
    pending.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.realId) caf(entry.realId);
  };
})();
