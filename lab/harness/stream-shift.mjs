// Statistics helpers of stream-replay-live.mjs: medians and quantiles, intervals between
// timestamps, and the view shift per wheel step (window.__rp.pick / measure in the page).
export const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
export const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : null; };
export const intervals = ts => ts.slice(1).map((t, i) => Math.round((t - ts[i]) * 10) / 10);
export const shiftStats = rows => {
  const ok = rows.filter(r => r && !r.none && !r.lost && !r.clamped), v = ok.map(r => Math.abs(r.visual));
  return { steps: rows.length, tracked: ok.length, lost: rows.filter(r => r?.lost).length, none: rows.filter(r => !r || r.none).length, clamped: rows.filter(r => r?.clamped).length,
    over4: v.filter(x => x > 4).length, over4Sizes: ok.filter(r => Math.abs(r.visual) > 4).map(r => r.visual), median: median(v), max: v.length ? Math.max(...v) : null };
};
export const fmtShift = st => `${st.over4}/${st.tracked} over 4px${st.over4 ? ` (${st.over4Sizes.join(', ')} px)` : ''}, median ${st.median ?? '-'}, max ${st.max ?? '-'} (lost ${st.lost}, none ${st.none}, clamped ${st.clamped})`;
