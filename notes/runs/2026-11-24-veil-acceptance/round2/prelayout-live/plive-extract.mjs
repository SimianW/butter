// plive-extract.mjs <run.json>...: one JSON line per run of this stage: the u4 calls, and the dev
// build's pre-layout counters (veil2dbg only): when the turn left in_progress, the start, each pass
// (start or font) with its reads and idle callbacks, and the font loads, in ms after completion.
// Counts, ms, flags and KaTeX font family names only; no text, URL or turn key.
import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const u = s.ux.u4, comp = u.enter + s.ux.goneAfterEnter, rel = (t) => (t == null ? null : Math.round(t - comp));
  const call = (c) => ({ block: c.block, flags: c.flagsBefore, ms: c.callMs, atAfterCompletion: rel(c.at), found: c.found, inBlock: c.selectionInBlock });
  const d = u.dbgBefore;
  const row = {
    run: s.label, verdicts: (s.veilVerdicts && Object.keys(s.veilVerdicts)) ? undefined : undefined,
    first: call(u.find), later: u.finds.map(call),
    select: { len: u.select.selLen, ms: u.select.selMs, veiledBefore: u.select.veiledBefore, veiledAfter: u.select.veiledAfter },
  };
  if (d) {
    row.turnState = d.recs.map(([t, oldValue, value, inTurn, busy, connected]) => ({ at: rel(t), oldValue, value, inTurn, busy, connected }));
    row.start = d.starts.map((x) => ({ ...x, at: rel(x.at) }));
    const passes = (u.dbgAfterFirst ?? d).passes;
    row.passes = passes.map((p) => ({ why: p.why, at: rel(p.at), given: p.given, queued: p.queued, reads: p.reads, readMs: p.readMs, maxRead: p.maxRead, chunks: p.chunks, maxChunk: p.maxChunk, end: rel(p.end), laidTotal: p.laid, firstChunkAt: p.ct?.length ? rel(p.ct[0][0]) : null, timedOut: p.ct ? p.ct.filter((c) => c[3]).length : null, beforeFirstFind: p.at < u.find.at }));
    row.laidAtFirstFind = d.laidNow; row.pendingAtFirstFind = d.pendingNow; row.waitingAtFirstFind = d.waitingNow;
    row.fonts = (u.dbgAfterFirst ?? d).fonts.map(([t, laid, fam]) => ({ at: rel(t), laid, families: fam }));
    row.mutationsInLaidBlocks = (u.dbgAfterFirst ?? d).mut.inLaid;
  }
  delete row.verdicts;
  console.log(JSON.stringify(row));
}
