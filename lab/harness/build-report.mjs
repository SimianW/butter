// Build a self-contained HTML report from a baseline results dir.
// Usage: node build-report.mjs <resultsDir>
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.argv[2]);
const turns = fs.readdirSync(DIR).filter(f => /^turn-\d+\.json$/.test(f)).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(DIR, f))));
const final = fs.existsSync(path.join(DIR, 'final.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'final.json'))) : null;
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'meta.json')));

const pct = (s, w) => +(100 * s / (w / 1000)).toFixed(1);
const rows = turns.map((t, i) => {
  if (t.missing) return { turn: t.turn, missing: true };
  const prev = turns.slice(0, i).reverse().find(x => !x.missing);
  const c = t.stream.cdp, w = t.stream.wallMs;
  const style = pct(c.RecalcStyleDuration, w), layout = pct(c.LayoutDuration, w), script = pct(c.ScriptDuration, w);
  return {
    turn: t.turn, nodesK: +(t.dom.nodes / 1000).toFixed(1), katex: t.dom.katex, heapMB: t.heapMB,
    mountedTurns: t.dom.turns, answerSec: +(t.totalMs / 1000).toFixed(0),
    streamFps: t.stream.fps, idleFps: t.idle.fps, streamP95: t.stream.p95, jankPct: t.stream.jankPct,
    freezeMs: t.stream.loafMaxMs, blockedSec: +(t.stream.loafBlockMs / 1000).toFixed(1),
    keyMaxMs: Math.round(t.stream.keyMax ?? 0), wheelP95: t.stream.wheelAckP95,
    style, script, layout, other: +Math.max(0, t.stream.mainThreadBusyPct - style - layout - script).toFixed(1),
    busy: t.stream.mainThreadBusyPct, virtualized: t.dom.virtualized,
  };
});
const reloads = [
  ...turns.filter(t => t.reload).map(t => ({ turn: t.turn, ...t.reload })),
  ...(final ? [{ turn: final.turns, ...final.reload }] : []),
].map(r => ({ turn: r.turn, allTurnsSec: +(r.allTurnsMs / 1000).toFixed(1), mathSec: +(r.lastAnswerMathMs / 1000).toFixed(1), blockedSec: +(r.loafBlockMs / 1000).toFixed(1), heapMB: r.heapMB }));

// Top script sources blamed by Long Animation Frames across all streaming windows.
const blame = {};
for (const t of turns.filter(t => !t.missing)) for (const l of t.stream.topLoaf) for (const s of l.scripts) {
  const k = `${s.inv || '?'}`; blame[k] = (blame[k] || 0) + s.dur;
}

const data = { rows, reloads, meta, final: final && { idleFps: final.idle.fps, turns: final.turns } };
const html = fs.readFileSync(new URL('./report-template.html', import.meta.url), 'utf8')
  .replace('/*DATA*/null', JSON.stringify(data));
fs.writeFileSync(path.join(DIR, 'report.html'), html);
console.log('wrote', path.join(DIR, 'report.html'));
console.table(rows);
console.table(reloads);
console.log(Object.entries(blame).sort((a, b) => b[1] - a[1]).slice(0, 8));
