// For every jump back in page-logged loads: did the marked (data-butter-seen) counts rise between the
// last scroll row at the high position and the first row after the drop?
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f)); let tot = 0, rise = 0, riseT = 0, riseB = 0, noRise = [];
  const skipT = [];
  for (const l of d.loads.filter(l => l.pageLog)) {
    const log = l.scrollLog, pl = l.pageLog, vh = l.at.vh; let peak = -Infinity, cur = null, prev = null; const jumps = [];
    for (const [t, y, h] of log) {
      if (cur && y < cur.to) { cur.to = y; } else if (cur && y > cur.to) { cur = null; peak = y; }
      if (!cur && peak - y > vh) { cur = { from: peak, to: y, fromT: prev?.[0] ?? t, dropT: t }; jumps.push(cur); }
      if (!cur) peak = Math.max(peak, y); prev = [t, y, h];
    }
    for (const j of jumps) {
      const b = pl.scroll.filter(r => r[0] <= j.fromT + 1 && r[0] < j.dropT - 3).at(-1), a = pl.scroll.find(r => r[0] >= j.dropT - 3);
      if (!a || !b) { noRise.push(`#${l.i} ${j.from}->${j.to} no page row (${!b ? "before" : "after"})`); tot++; continue; }
      tot++; const dT = a[9] - b[9], dB = a[10] - b[10];
      if (dT > 0 || dB > 0) rise++; if (dT > 0) riseT++; if (dB > 0) riseB++;
      if (!(dT > 0 || dB > 0)) noRise.push(`#${l.i} t=${j.fromT}/${j.dropT} rows ${b[0]}/${a[0]} ${j.from}->${j.to} seenT ${b[9]}->${a[9]} seenB ${b[10]}->${a[10]} mounted ${b[3]}->${a[3]}`);
      skipT.push(a[7]);
    }
  }
  console.log(f.split('/').pop(), `jumps ${tot}; marked counts rose at the drop: ${rise} (turns ${riseT}, blocks ${riseB}); skipped turns just after: ${JSON.stringify(skipT.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {}))}`);
  for (const s of noRise) console.log('   no rise:', s);
}
