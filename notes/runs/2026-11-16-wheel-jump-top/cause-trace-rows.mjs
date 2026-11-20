// Merge the page scroll log, the scroll-type trace triplets and the page log around each jump back.
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[2]));
const l = d.loads.find(l => l.trace);
const ev = l.trace.events;
const rows = [];
for (let i = 0; i < ev.length; i++) if (ev[i].name === 'PaintLayerScrollableArea::UpdateScrollOffset') {
  const set = [...ev.slice(Math.max(0, i - 3), i)].reverse().find(e => e.name === 'ScrollableArea::SetScrollOffset');
  const type = ev.slice(i + 1, i + 4).find(e => e.name === 'Type');
  rows.push({ t: ev[i].t, y: ev[i].args.y, x: ev[i].args.x, type: type?.args.type, request: set?.args.offset, setT: set?.t });
}
const types = rows.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {});
console.log('UpdateScrollOffset types:', JSON.stringify(types));
const fa = ev.filter(e => e.name === 'ScrollAnchor::FindAnchor');
const log = l.scrollLog, pl = l.pageLog;
const vh = l.at.vh, jumps = []; let peak = -Infinity, cur = null, prev = null;
for (const [t, y, h] of log) {
  if (cur && y < cur.to) { cur.to = y; cur.toT = t; } else if (cur && y > cur.to) { cur = null; peak = y; }
  if (!cur && peak - y > vh) { cur = { from: peak, to: y, fromT: prev?.[0] ?? t, toT: t, h: [prev?.[2], h], step: '?' }; jumps.push(cur); }
  if (!cur) peak = Math.max(peak, y); prev = [t, y, h];
}
for (const [k, j] of jumps.entries()) {
  const t0 = log.find(r => r[0] >= j.fromT - 400)?.[0] ?? j.fromT - 400, t1 = j.toT + 300;
  console.log(`\n=== jump ${k + 1}: ${j.from} -> ${j.to} at step ${j.step}, scrollHeight ${j.h}, log fromT ${j.fromT} toT ${j.toT}`);
  const merged = [
    ...log.filter(r => r[0] >= t0 && r[0] <= t1).map(r => [r[0], `scroll event   y=${r[1]} h=${r[2]}`]),
    ...rows.filter(r => r.t >= t0 && r.t <= t1).map(r => [r.t, `trace Update   y=${r.y} ${r.type}  (SetScrollOffset ${r.request} at ${r.setT})`]),
    ...fa.filter(e => e.t >= t0 && e.t <= t1).map(e => [e.t, `trace FindAnchor dur ${e.dur}us`]),
    ...(pl ? pl.scroll.filter(r => r[0] >= t0 && r[0] <= t1).map(r => [r[0] + 0.0001, `page  mounted=${r[3]} ord ${r[4]}..${r[5]} of ${r[6]} skippedTurns=${r[7]} skippedBlocks=${r[8]} seenTurns=${r[9]} seenBlocks=${r[10]}`]) : []),
    ...(pl ? pl.muts.filter(m => m[0] >= t0 && m[0] <= t1 && m[1] !== 'style').map(m => [m[0], `mutation ${m.join(' ')}`]) : []),
    ...(pl ? pl.cv.filter(c => c[0] >= t0 && c[0] <= t1).map(c => [c[0] + 0.0002, `cv ${c[1] ? 'turn' : 'block'} ${c[2] ? 'skipped' : 'rendered'}`]) : []),
  ].sort((a, b) => a[0] - b[0]);
  // collapse runs of cv lines
  let last = null, n = 0;
  for (const [t, s] of merged) { if (s.startsWith('cv ') && s === last) { n++; continue; } if (n) console.log(`        (x${n + 1})`); n = 0; last = s; console.log(String(t.toFixed ? t.toFixed(3) : t).padStart(10), s); }
  if (n) console.log(`        (x${n + 1})`);
}
