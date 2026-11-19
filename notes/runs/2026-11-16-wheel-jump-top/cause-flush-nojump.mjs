// Consecutive page-log scroll rows (wheel-down phase) where the marked-turn count rose: with or without a drop of more than a viewport.
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f)); let rises = 0, withDrop = 0; const without = [];
  for (const l of d.loads.filter(l => l.pageLog)) {
    const r = l.pageLog.scroll, vh = l.at.vh;
    for (let i = 1; i < r.length; i++) if (r[i][9] > r[i - 1][9] || r[i][10] > r[i - 1][10]) {
      rises++; if (r[i - 1][1] - r[i][1] > vh) withDrop++; else without.push(`#${l.i} y ${r[i - 1][1]}->${r[i][1]} h ${r[i][2]} seenT ${r[i - 1][9]}->${r[i][9]} seenB ${r[i - 1][10]}->${r[i][10]}`);
    }
  }
  console.log(f.split('/').pop(), `rows where marks rose: ${rises}; with a drop > 1 viewport: ${withDrop}; without: ${without.length}`);
  for (const w of without) console.log('   without:', w);
}
