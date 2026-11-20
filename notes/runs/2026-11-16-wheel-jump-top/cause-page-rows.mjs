// Page log around the first N jumps back of each load: scroll rows, turn mutations, skip changes.
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[2])); const N = Number(process.argv[3] || 2), LOADI = process.argv[4];
for (const l of d.loads.filter(l => l.pageLog && (!LOADI || String(l.i) === LOADI))) {
  const log = l.scrollLog, pl = l.pageLog, vh = l.at.vh, jumps = []; let peak = -Infinity, cur = null, prev = null;
  for (const [t, y, h] of log) {
    if (cur && y < cur.to) { cur.to = y; cur.toT = t; } else if (cur && y > cur.to) { cur = null; peak = y; }
    if (!cur && peak - y > vh) { cur = { from: peak, to: y, fromT: prev?.[0] ?? t, toT: t }; jumps.push(cur); }
    if (!cur) peak = Math.max(peak, y); prev = [t, y, h];
  }
  console.log(`##### load ${l.i}: ${jumps.length} jumps; turn muts ${pl.muts.filter(m => m[1] !== 'style').length}; listChildren ${pl.listChildren}; style rows ${pl.muts.filter(m => m[1] === 'style').length}`);
  // at every jump: seen turns before/after
  const at = t => pl.scroll.filter(r => r[0] <= t).at(-1);
  const summary = jumps.map(j => { const b = pl.scroll.filter(r => r[0] < j.toT).at(-1), a = pl.scroll.find(r => r[0] >= j.toT); return `${j.from}->${j.to} seenT ${b?.[9]}->${a?.[9]} seenB ${b?.[10]}->${a?.[10]} skT ${b?.[7]}->${a?.[7]} mounted ${b?.[3]}(${b?.[4]}..${b?.[5]})->${a?.[3]}(${a?.[4]}..${a?.[5]}) of ${a?.[6]}`; });
  for (const s of summary) console.log('  ', s);
  for (const j of jumps.slice(0, N)) {
    const t0 = j.fromT - 350, t1 = j.toT + 250;
    console.log(`  --- ${j.from} -> ${j.to}`);
    const rows = [
      ...pl.scroll.filter(r => r[0] >= t0 && r[0] <= t1).map(r => [r[0], `scroll y=${r[1]} h=${r[2]} mounted=${r[3]} ord ${r[4]}..${r[5]}/${r[6]} skippedT=${r[7]} skippedB=${r[8]} seenT=${r[9]} seenB=${r[10]}`]),
      ...pl.muts.filter(m => m[0] >= t0 && m[0] <= t1).map(m => [m[0], `mut ${m.join(' ')}`]),
      ...pl.cv.filter(c => c[0] >= t0 && c[0] <= t1).map(c => [c[0] + 0.1, `cv ${c[1] ? 'turn' : 'block'} ${c[2] ? 'skipped' : 'rendered'}`]),
    ].sort((a, b) => a[0] - b[0]);
    let last = null, n = 0;
    for (const [t, s] of rows) { if (s.startsWith('cv ') && s === last) { n++; continue; } if (n) console.log(`        (x${n + 1})`); n = 0; last = s; console.log('   ', String(Math.round(t)).padStart(6), s); }
    if (n) console.log(`        (x${n + 1})`);
  }
}
