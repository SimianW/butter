// Measure jank on your own machine (Windows, macOS, Linux) without the lab harness.
// 1. Open a long ChatGPT chat, open DevTools (F12 / Cmd+Opt+I) > Console, paste this file, Enter.
// 2. Ask a long question and use the page normally (scroll, type) while the answer streams.
// 3. When the answer has finished, run  turboMeasure.stop()  and note the printed table.
// Compare runs with the extension on and off (chrome://extensions toggle, then reload the tab).
(() => {
  const frames = [], loaf = [], keys = [];
  let running = true, last = performance.now();
  const t0 = last;
  const loop = t => { if (!running) return; frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const po = new PerformanceObserver(l => { for (const e of l.getEntries()) loaf.push(e); });
  po.observe({ type: 'long-animation-frame' });
  const onKey = e => { const s = e.timeStamp; requestAnimationFrame(() => setTimeout(() => keys.push(performance.now() - s))); };
  addEventListener('keydown', onKey, true);
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
  const r = x => x == null ? null : Math.round(x);
  window.turboMeasure = {
    stop() {
      running = false; po.disconnect(); removeEventListener('keydown', onKey, true);
      const secs = (performance.now() - t0) / 1000, f = frames.slice(1);
      const res = {
        'duration (s)': +secs.toFixed(1),
        'turbo extension active': !!window.__turboStats,
        'main thread blocked (s)': +(loaf.reduce((a, e) => a + e.blockingDuration, 0) / 1000).toFixed(1),
        'longest freeze (ms)': r(Math.max(0, ...loaf.map(e => e.duration))),
        'fps': +(f.length / secs).toFixed(1),
        'frame p95 (ms)': r(q(f, 0.95)),
        'keystroke p95 (ms)': r(q(keys, 0.95)),
        'slowest keystroke (ms)': r(keys.length ? Math.max(...keys) : null),
        'DOM nodes': document.getElementsByTagName('*').length,
        'browser': navigator.userAgent.match(/(Chrome|Edg)\/[\d.]+/g)?.join(' '),
        'platform': navigator.userAgentData?.platform ?? navigator.platform,
      };
      console.table(res);
      return res;
    },
  };
  console.log('Recording. Run turboMeasure.stop() when the answer has finished.');
})();
