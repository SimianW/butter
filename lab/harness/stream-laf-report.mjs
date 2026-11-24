// Node side of stream-laf-probe.mjs: turns the probe's raw entries into per-frame rows on a clock
// that starts at Enter, a timeline of marks, and REPORT lines (the longest frames, a histogram,
// blocking per 10 s bucket, script time by source). Measurement only; nothing here is a verdict.
//
//   const d = lafDetail(raw); for (const line of fmtLafDetail(d)) report(line); summary.lafDetail = d;
//
// stream-replay-live.mjs drives the probe through startLaf (just before Enter), tailWindow (after
// the replay loop) and lafReport (after the tail).
import { startLafProbe, stopLafProbe, summarizeLaf, fmtLaf } from './stream-laf-probe.mjs';

const r1 = v => Math.round(v * 10) / 10;

export const startLaf = page => page.evaluate(startLafProbe);

// After the replay loop: tick(el, sinceDone) every 200 ms for tailMs past completion (this call),
// el counted from t0. snap() runs once, 3 s past completion, as it did before the tail existed
// (after a shorter tail, the rest of the 3 s is waited out). Returns snap()'s value.
export async function tailWindow(tick, snap, t0, tailMs, { now = Date.now, pause }) {
  const t1 = now(), tEnd = t1 + tailMs, snapAt = t1 + 3000;
  let taken = false, after;
  const take = async () => {
    const w = snapAt - now();
    if (w > 0) await pause(w);
    after = await snap();
    taken = true;
  };
  while (now() < tEnd) {
    await tick(now() - t0, now() - t1);
    if (!taken && snapAt - now() <= 200) await take();
    else await pause(200);
  }
  if (!taken) await take();
  return after;
}

// After the tail: stops the probe, cuts it at the standard window (tw.split), and returns the
// REPORT lines of the probe, the stream windows (tw.finish) and the UX probe (ux.finish).
export async function lafReport(page, tw, ux, summary) {
  const raw = tw.split(await page.evaluate(stopLafProbe));
  summary.laf = summarizeLaf(raw);
  summary.lafDetail = lafDetail(raw);
  return [fmtLaf(summary.laf), ...fmtLafDetail(summary.lafDetail), ...(await tw.finish(raw, summary)), ...(await ux.finish())];
}

export function lafDetail(raw) {
  if (!raw) return null;
  const z = raw.enter;
  const at = t => (t == null ? null : r1(t - z));
  const ip = raw.marks.inProgress;
  const onRow = ip.find(m => m.on);
  const goneRow = onRow ? ip.find(m => !m.on && m.t >= onRow.t) : null;
  const marks = {
    enter: 0, replayPost: at(raw.marks.replayPost), firstChunk: at(raw.marks.firstChunk), lastChunk: at(raw.marks.lastChunk),
    inProgressOn: at(onRow?.t), inProgressGone: at(goneRow?.t), observedUntil: at(raw.end),
    inProgressRows: ip.map(m => ({ ...m, t: at(m.t) })),
    butter: raw.marks.butter.map(m => ({ ...m, t: at(m.t) })),
    settle: (raw.marks.settle || []).map(m => ({ ...m, t: at(m.t) })),
    hyd: (raw.marks.hyd || []).map(m => ({ ...m, t: at(m.t) })),
  };
  const gone = marks.inProgressGone;
  const frames = raw.loaf.map(f => ({ ...f, s: at(f.s), afterComplete: gone != null && f.s - z >= gone, scripts: f.scripts.map(x => ({ ...x, s: at(x.s) })) }));
  const named = ['enter', 'replayPost', 'firstChunk', 'lastChunk', 'inProgressOn', 'inProgressGone'].filter(k => marks[k] != null);
  const nearest = f => {
    let best = null;
    for (const k of named) { const dlt = r1(f.s - marks[k]); if (!best || Math.abs(dlt) < Math.abs(best.dlt)) best = { mark: k, dlt }; }
    const inside = marks.butter.filter(m => m.t >= f.s && m.t <= f.s + f.d + 5);
    let nb = null;
    for (const m of marks.butter) { const dlt = r1(m.t - f.s); if (!nb || Math.abs(dlt) < Math.abs(nb.dlt)) nb = { dlt, seen: m.seen, unrendered: m.unrendered }; }
    return { named: best, butterInside: inside.map(m => ({ t: m.t, seen: m.seen, unrendered: m.unrendered, seenOff: m.seenOff, unrenderedOff: m.unrenderedOff })), butterNearest: nb };
  };
  const byDur = [...frames].sort((a, b) => b.d - a.d);
  const top30 = byDur.slice(0, 30).map(f => ({ ...f, near: nearest(f) }));
  const hist = { ge200: frames.filter(f => f.d >= 200).length, ge500: frames.filter(f => f.d >= 500).length, ge1000: frames.filter(f => f.d >= 1000).length };
  const span = Math.max(marks.observedUntil || 0, ...frames.map(f => f.s));
  const buckets = Array.from({ length: Math.ceil(span / 10000) || 1 }, (_, i) => ({ from: i * 10000, blocking: 0, frames: 0, longest: 0 }));
  for (const f of frames) { const b = buckets[Math.max(0, Math.min(buckets.length - 1, Math.floor(f.s / 10000)))]; b.blocking = r1(b.blocking + f.b); b.frames++; b.longest = Math.max(b.longest, f.d); }
  const bySource = {}; let forced = 0, render = 0, scriptPart = 0, scripts = 0, frameCb = 0;
  for (const f of frames) {
    render += f.render; scriptPart += f.script; frameCb += f.frameCb;
    for (const x of f.scripts) { const k = x.src.startsWith('chatgpt:') ? 'chatgpt:*' : x.src; bySource[k] = r1((bySource[k] || 0) + x.d); forced += x.forced; scripts += x.d; }
  }
  const butterFiles = {};
  for (const f of frames) for (const x of f.scripts) if (x.src.startsWith('butter:')) { const e = (butterFiles[x.src] ||= { ms: 0, forced: 0, n: 0 }); e.ms = r1(e.ms + x.d); e.forced = r1(e.forced + x.forced); e.n++; }
  const totals = { frames: frames.length, totalMs: r1(frames.reduce((a, f) => a + f.d, 0)), blockingMs: r1(frames.reduce((a, f) => a + f.b, 0)), longestMs: byDur[0]?.d ?? 0,
    stream: sumPart(frames.filter(f => !f.afterComplete)), after: sumPart(frames.filter(f => f.afterComplete)) };
  return { marks, frames, top30, hist, histByPhase: { stream: histOf(frames.filter(f => !f.afterComplete)), after: histOf(frames.filter(f => f.afterComplete)) }, buckets,
    sums: { bySource, butterFiles, scriptsMs: r1(scripts), forcedMs: r1(forced), renderPartMs: r1(render), scriptPartMs: r1(scriptPart), rafPartMs: r1(frameCb) }, totals };
}

const histOf = fr => ({ ge200: fr.filter(f => f.d >= 200).length, ge500: fr.filter(f => f.d >= 500).length, ge1000: fr.filter(f => f.d >= 1000).length });
const sumPart = fr => ({ frames: fr.length, blockingMs: r1(fr.reduce((a, f) => a + f.b, 0)), longestMs: fr.length ? Math.max(...fr.map(f => f.d)) : 0 });

export function fmtLafDetail(d) {
  if (!d) return ['laf detail: probe not installed'];
  const m = d.marks, out = [];
  out.push(`laf marks (ms after Enter): replay POST ${m.replayPost}, first chunk ${m.firstChunk}, last chunk ${m.lastChunk}, in_progress on ${m.inProgressOn}, in_progress gone ${m.inProgressGone}, observed until ${m.observedUntil}; in_progress transitions ${m.inProgressRows.length}; butter mark batches ${m.butter.length} (seen +${m.butter.reduce((a, x) => a + x.seen, 0)}, unrendered +${m.butter.reduce((a, x) => a + x.unrendered, 0)})`);
  d.top30.slice(0, 10).forEach((f, i) => {
    const top = [...f.scripts].sort((a, b) => b.d - a.d)[0];
    const n = f.near;
    const bi = n.butterInside.length ? `butter marks inside: ${n.butterInside.map(b => `+${b.seen}s/+${b.unrendered}u@${b.t}`).join(' ')}` : `nearest butter batch ${n.butterNearest ? `${n.butterNearest.dlt} ms (+${n.butterNearest.seen}s/+${n.butterNearest.unrendered}u)` : 'none'}`;
    out.push(`laf top ${i + 1}: start ${f.s} ms (${f.afterComplete ? 'after' : 'before'} in_progress gone), duration ${f.d}, blocking ${f.b}, script part ${f.script}, rAF part ${f.frameCb}, render part ${f.render}, scripts ${f.scripts.length}; top script ${top ? `${top.d} ms ${top.src} ${top.invokerType} ${JSON.stringify(top.invoker)} fn ${JSON.stringify(top.fn)} forced ${top.forced} pause ${top.pause}` : 'none'}; nearest mark ${n.named ? `${n.named.mark} ${n.named.dlt >= 0 ? '+' : ''}${n.named.dlt} ms` : 'none'}; ${bi}`);
  });
  out.push(`laf histogram: >=200 ms ${d.hist.ge200}, >=500 ms ${d.hist.ge500}, >=1000 ms ${d.hist.ge1000} (before in_progress gone ${JSON.stringify(d.histByPhase.stream)}, after ${JSON.stringify(d.histByPhase.after)})`);
  out.push(`laf blocking per 10 s from Enter: ${d.buckets.map(b => `${b.from / 1000}s:${Math.round(b.blocking)}`).join(' ')}`);
  const s = d.sums;
  out.push(`laf sums over ${d.totals.frames} frames (total ${d.totals.totalMs}, blocking ${d.totals.blockingMs}): script by source ${JSON.stringify(Object.fromEntries(Object.entries(s.bySource).sort((a, b) => b[1] - a[1])))}; forced style/layout ${s.forcedMs}; script part ${s.scriptPartMs}; rAF part ${s.rafPartMs}; render part ${s.renderPartMs}`);
  out.push(`laf butter files: ${JSON.stringify(s.butterFiles)}`);
  out.push(`laf totals: before in_progress gone ${JSON.stringify(d.totals.stream)}, after ${JSON.stringify(d.totals.after)}`);
  return out;
}
