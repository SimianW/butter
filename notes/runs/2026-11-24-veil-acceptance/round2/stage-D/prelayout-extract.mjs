// prelayout-extract.mjs <run.json>... : one JSON line per run on what pre-layout could show in a u4 run:
// long animation frames after completion (to the LoAF window's end, completion + 5 s) and any Butter script in them,
// Butter's block marks once a second after completion, and the ux sampler's scrollTop / scrollHeight and frame gaps
// from completion to +16 s (before u4 starts). Times are ms after in_progress went (LoAF and marks: the LoAF clock;
// ux: the ux probe's clock, which is the same event seen by another observer).
import fs from 'node:fs';
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);
for (const file of process.argv.slice(2)) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const name = file.split('/').pop().replace('.json', '');
  const L = s.lafDetail, gone = L.marks.inProgressGone;
  const after = L.frames.filter(f => f.s >= gone - 50).map(f => ({ at: r1(f.s - gone), d: f.d, b: f.b, render: f.render,
    scripts: f.scripts.map(x => ({ inv: x.invokerType, src: x.src, d: x.d, forced: x.forced })) }));
  const butterScripts = L.frames.flatMap(f => f.scripts.filter(x => /^butter:/.test(x.src)).map(x => ({ at: r1(f.s - gone), frameD: f.d, inv: x.invokerType, src: x.src, d: x.d, forced: x.forced })));
  const marks = s.hydration.rows.filter(r => r.t >= gone - 1000).map(r => ({ at: r1(r.t - gone), veiled: r.veiled, unrendered: r.unrendered, seen: r.seen, turnH: r.turnH, leaks: r.leaks }));
  const c = (s.ux.compact ?? []).filter(f => f[0] >= 0 && f[0] <= 16000);
  const ys = c.map(f => f[1]), Hs = c.map(f => f[2]);
  const gaps = []; for (let j = 1; j < c.length; j++) { const g = c[j][0] - c[j - 1][0]; if (g >= 50) gaps.push({ at: r1(c[j - 1][0]), gap: r1(g) }); }
  const win = c.filter(f => f[0] >= 900);
  console.log(JSON.stringify({ name, completion: { at: r1(s.completion.s - gone), d: s.completion.d }, rafForced: s.veilVerdicts?.effective?.forced ?? null,
    lafWindowEnd: r1(L.marks.observedUntil - gone), afterFrames: after, butterFiles: L.sums.butterFiles, butterScripts,
    marks, ux: { frames: c.length, yMin: Math.min(...ys), yMax: Math.max(...ys), Hfrom900: win.length ? [Math.min(...win.map(f => f[2])), Math.max(...win.map(f => f[2]))] : null,
      HMin: Math.min(...Hs), HMax: Math.max(...Hs), gapsOver50From0: gaps, longestGapFrom900: win.length ? Math.max(...gaps.filter(g => g.at >= 900).map(g => g.gap), 0) : null },
    veilAfterWindow: s.veil?.afterWindow, leaks: s.ux.leaks, blocking: s.lafDetail.totals }));
}
