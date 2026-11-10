// The landing wash, pure (#73): which boxes a bookmark's text gets and when each one fills. No DOM
// or chrome.* here; bookmarks/content.js draws it, and node --test checks it.
((root) => {
  const SWEEP = 360, // ms for the whole range
    HOLD = 1200,
    FADE = 900;
  const EASING = 'cubic-bezier(.3, .7, .3, 1)';
  const BEZIER = [0.3, 0.7, 0.3, 1]; // the same curve, for the times below
  const at = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  // The time (0..1) at which the eased sweep reaches `progress` (0..1). The curve rises steadily.
  const timeOf = (progress) => {
    const [x1, y1, x2, y2] = BEZIER;
    let lo = 0,
      hi = 1;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (at(y1, y2, mid) < progress) lo = mid;
      else hi = mid;
    }
    return at(x1, x2, (lo + hi) / 2);
  };

  // `widths`: the rendered lines of the range, in reading order. The sweep's progress runs over
  // their joined length under one easing, so each line fills from its start to its end in turn:
  // `from`..`to` is its share of the progress, `at` and `ms` the time it takes. Under reduced
  // motion every line shows at once. Then the wash holds and fades.
  function plan(widths, { reduced = false } = {}) {
    const total = widths.reduce((t, w) => t + w, 0) || 1;
    let sum = 0;
    const sweep = widths.map((w) => {
      const from = sum / total;
      sum += w;
      const to = sum / total;
      if (reduced) return { from, to, at: 0, ms: 0 };
      const a = from === 0 ? 0 : timeOf(from) * SWEEP,
        b = to === 1 ? SWEEP : timeOf(to) * SWEEP;
      return { from, to, at: a, ms: b - a };
    });
    const len = reduced ? 0 : SWEEP;
    return {
      sweep,
      easing: EASING,
      in: len,
      hold: HOLD,
      fade: FADE,
      fadeEasing: 'ease-out',
      total: len + HOLD + FADE,
    };
  }

  // The range's client rectangles, in document order, as one box per rendered line: the union of
  // the rectangles on it, reaching PAD px above and below the text. A rectangle is on the line
  // before it when its middle is within that line's height. Empty rectangles are skipped.
  const PAD = 2;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function boxes(rects) {
    const lines = [];
    for (const q of rects) {
      if (!(q.right > q.left && q.bottom > q.top)) continue;
      const line = lines.at(-1),
        mid = (q.top + q.bottom) / 2;
      if (line && mid >= line.top && mid <= line.bottom) {
        line.left = Math.min(line.left, q.left);
        line.right = Math.max(line.right, q.right);
        line.top = Math.min(line.top, q.top);
        line.bottom = Math.max(line.bottom, q.bottom);
      } else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
    }
    return lines.map((l) => ({
      left: r3(l.left),
      top: r3(l.top - PAD),
      width: r3(l.right - l.left),
      height: r3(l.bottom - l.top + 2 * PAD),
    }));
  }

  const api = { plan, boxes };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ButterWash = api;
})(globalThis);
