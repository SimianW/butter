// Per-load view-shift numbers (SHIFT=1 runs). Tracked = element still connected and the step not cut by the scroll range.
// For loads with a jump back, "down" stops before the first step whose scrollTop fell by more than a viewport (or lost its element).
import fs from 'node:fs';
const med = a => { if (!a.length) return '-'; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const st = rows => { const ok = rows.filter(r => r && !r.none && !r.lost && !r.clamped), v = ok.map(r => Math.abs(r.visual));
  return `${v.filter(x => x > 4).length} | ${ok.length} | ${med(v)} | ${v.length ? Math.max(...v) : '-'}`; };
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f));
  for (const l of d.loads.filter(l => l.shift)) {
    const cut = l.shift.down.findIndex(r => r && (r.lost || r.dY < -l.at.vh));
    const down = cut < 0 ? l.shift.down : l.shift.down.slice(0, cut);
    console.log(`| ${f.split('/').pop().replace('.json', '')} #${l.i} | up | ${st(l.shift.up)} |`);
    console.log(`| ${f.split('/').pop().replace('.json', '')} #${l.i} | down${cut < 0 ? '' : ` (steps 1–${cut}, before the first jump back)`} | ${st(down)} |`);
  }
}
