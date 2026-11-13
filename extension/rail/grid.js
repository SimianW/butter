// Isolated world, no DOM: the device-pixel grid the rail's bars are drawn on (`ButterRailGrid`),
// which rail/model.js uses for the ticks' layout. Chrome lays a box out in 1/64 device px and draws
// its edges at round(top) and round(bottom), so at a fractional ratio a 2 px bar is drawn 1, 2 or 3
// rows thick by where its top falls (#115). test/rail-model.test.mjs drives it through the model.
(() => {
  // A length of `len` CSS px as layout keeps it at ratio `dpr`: in whole 1/64 device px, rounded down.
  const snap = (len, dpr) => Math.floor(len * dpr * 64 + 1e-6) / 64 / dpr;
  // Where a box `h` device px high has its top, as an offset from the nearest device pixel in
  // [-0.5, 0.5), to be drawn round(h) rows thick: the middle of the offsets that draw it so, the
  // farthest from both rounding edges.
  const phase = (h) => {
    const t = Math.round(h);
    return (Math.max(-0.5, t - 0.5 - h) + Math.min(0.5, t + 0.5 - h)) / 2;
  };
  // The smallest move (CSS px, at most half a device pixel) that puts a box's top at `top` CSS px
  // on that offset, the box `h` CSS px high; 0 when it already is.
  const nudge = (top, h, dpr) => {
    const d = top * dpr - phase(h * dpr),
      dy = (Math.round(d) - d) / dpr;
    return Math.abs(dy) < 1e-6 ? 0 : dy;
  };
  const ButterRailGrid = { snap, nudge };
  globalThis.ButterRailGrid = ButterRailGrid;
  if (typeof module !== 'undefined') module.exports = ButterRailGrid;
})();
