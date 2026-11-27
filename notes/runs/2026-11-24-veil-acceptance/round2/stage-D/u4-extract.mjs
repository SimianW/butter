// u4-extract.mjs (round 2: builds head and veil2) <run.json>... : one JSON line per run with the u4 numbers, then medians per build
// and the spec's window.find rule; exit 3 when the veil's median over all calls is outside both bounds.
import fs from 'node:fs';
const med = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round(((b[m - 1] + b[m]) / 2) * 10) / 10; };
const by = { head: { first: [], later: [], sel: [], selMs: [] }, veil2: { first: [], later: [], sel: [], selMs: [] } };
for (const file of process.argv.slice(2)) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8')), u = s.ux?.u4;
  const name = file.split('/').pop().replace('.json', ''), build = name.split('-')[0];
  if (!u) { console.log(JSON.stringify({ name, u4: null, driveError: s.ux?.driveError ?? null })); continue; }
  const call = (x, k) => (x?.none ? { k, none: true } : { k, block: x.block, len: x.len, found: x.found, ms: x.callMs, sel: x.selectionInBlock, flags: x.flagsBefore, y: [x.y0, x.yAfterCall], inView: x.firstInView, unveiled: x.firstUnveiled, endY: x.end?.y, endInView: x.end?.inView, endFlags: x.end?.f });
  const calls = [call(u.find, 0), ...(u.finds ?? []).map(x => call(x, x.k))];
  const iv = u.intoView;
  const row = { name, build: s.build, completionFrame: s.completion?.frame?.d ?? s.completion?.d ?? null, held: u.held, calls,
    intoView: iv?.none ? null : { block: iv.block, flags: iv.flagsBefore, y: [iv.y0, iv.yAfterCall], inView: iv.firstInView, unveiled: iv.firstUnveiled, ok: iv.firstOk, topFirst: iv.topFirstInView, endY: iv.end?.y, endTop: iv.end?.top, endInView: iv.end?.inView, endFlags: iv.end?.f },
    select: u.select, leaks: s.ux?.leaks, errors: s.ux?.errors, driveError: s.ux?.driveError };
  console.log(JSON.stringify(row));
  const B = by[build]; if (!B) continue;
  calls.forEach(c => { if (!c.none) (c.k === 0 ? B.first : B.later).push(c.ms); });
  B.sel.push(u.select.selLen); B.selMs.push(u.select.selMs);
}
const m = {};
for (const b of ['head', 'veil2']) { const B = by[b], all = [...B.first, ...B.later]; m[b] = { n: all.length, first: B.first, later: B.later, medAll: med(all), medFirst: med(B.first), medLater: med(B.later), selLens: B.sel, selMs: B.selMs, medSelMs: med(B.selMs) }; }
const h = m.head.medAll, v = m.veil2.medAll;
const within = h != null && v != null && (v <= 2 * h || v <= h + 150);
const selSame = m.head.selLens.length > 0 && new Set([...m.head.selLens, ...m.veil2.selLens]).size === 1;
console.log(JSON.stringify({ medians: m, rule: { headMedian: h, veilMedian: v, twiceHead: h == null ? null : 2 * h, headPlus150: h == null ? null : h + 150, within, selectAllSameLength: selSame } }));
process.exit(within ? 0 : 3);
