// For every jump back in page-logged loads: turn insertions/removals between the last scroll row at the
// high position and the drop's row, and the wrappers' parent's margin-top just before the drop.
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f)); let tot = 0, withMut = 0; const spacer = {}, mounted = {};
  for (const l of d.loads.filter(l => l.pageLog)) {
    const log = l.scrollLog, pl = l.pageLog, vh = l.at.vh; let peak = -Infinity, cur = null, prev = null; const jumps = [];
    for (const [t, y, h] of log) {
      if (cur && y < cur.to) cur.to = y; else if (cur && y > cur.to) { cur = null; peak = y; }
      if (!cur && peak - y > vh) { cur = { to: y, fromT: prev?.[0] ?? t, dropT: t }; jumps.push(cur); }
      if (!cur) peak = Math.max(peak, y); prev = [t, y, h];
    }
    for (const j of jumps) {
      tot++;
      if (pl.muts.some(m => m[1] !== 'style' && m[0] > j.fromT + 1 && m[0] < j.dropT - 3)) withMut++;
      const st = pl.muts.filter(m => m[1] === 'style' && m[0] <= j.dropT - 3).at(-1)?.[2] || 'none';
      const k = /margin-top: 0px/.test(st) ? '0px' : /margin-top/.test(st) ? '>0' : st; spacer[k] = (spacer[k] || 0) + 1;
      const b = pl.scroll.filter(r => r[0] <= j.fromT + 1 && r[0] < j.dropT - 3).at(-1); if (b) mounted[b[3]] = (mounted[b[3]] || 0) + 1;
    }
  }
  console.log(f.split('/').pop(), `jumps ${tot}; with a turn inserted/removed between the high row and the drop: ${withMut}; spacer margin-top before the drop: ${JSON.stringify(spacer)}; mounted turns at the high row: ${JSON.stringify(mounted)}`);
}
