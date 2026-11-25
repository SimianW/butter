// Per-run u2 cut from stream-replay-live.mjs output (copied from stage-C2/commands.md). Usage: node u2-extract.mjs <run.json>...
import fs from 'node:fs';
const r1 = v => Math.round(v * 10) / 10;
const BLANK = 7;
for (const file of process.argv.slice(2)) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8')), u = s.ux;
  const name = file.split('/').pop().replace('.json', '');
  const mid = u.acts.find(a => a.kind === 'mid');
  const C = u.compact; // [rt, y, H, pend, hyd, anchorTop, centre, flags[7]]
  const blank = f => f[7].some(p => p >= 0 && (p & BLANK));
  const w = C.filter(f => f[0] >= mid.rt);
  let best = { frames: 0, ms: 0, from: null, to: null }, cur = null, total = 0;
  w.forEach((f, j) => {
    if (blank(f)) { total++; cur = cur ? { ...cur, frames: cur.frames + 1 } : { frames: 1, from: f[0] }; const end = w[j + 1]?.[0] ?? f[0]; const ms = r1(end - cur.from); if (cur.frames > best.frames || (cur.frames === best.frames && ms > best.ms)) best = { frames: cur.frames, ms, from: cur.from, to: end }; }
    else cur = null;
  });
  const firstBlank = w.findIndex(blank);
  const clear = firstBlank >= 0 ? w.slice(firstBlank).find(f => !blank(f)) : null;
  const k0 = Math.max(0, C.findIndex(f => f[0] >= mid.rt) - 1);
  const around = C.slice(k0, k0 + 8).map((f, j, a) => ({ rt: f[0], dt: a[j + 1] ? r1(a[j + 1][0] - f[0]) : null, y: f[1], H: f[2], c: f[6], fl: f[7].map(p => (p < 0 ? '-' : p & BLANK)).join('') }));
  const wE = r1(mid.rt + u.goneAfterEnter);
  const laf = (s.lafDetail?.frames ?? []).filter(f => f.s + f.d >= wE - 5 && f.s <= wE + 600).map(f => ({ s: r1(f.s - wE), d: f.d, script: f.script, frameCb: f.frameCb, render: f.render, b: f.b,
    forced: r1(f.scripts.reduce((a, x) => a + x.forced, 0)), scripts: f.scripts.slice().sort((a, b) => b.d - a.d).slice(0, 4).map(x => `${x.d}/${x.forced}f ${x.invokerType}:${x.invoker} ${x.src}`) }));
  const after = laf.filter(f => f.s + f.d > 0).slice(0, 2);
  const sp = u.shiftPost ?? {}, sh = u.shift ?? {};
  console.log(JSON.stringify({ name, gone: u.goneAfterEnter, completionFrame: s.completion?.frame?.d ?? s.completion?.d ?? null,
    u2: { at: mid.rt, y: [mid.y0, mid.y1], H: mid.H, info: mid.info },
    blank: { longestFrames: best.frames, longestMs: best.ms, from: best.from, totalFrames: total, probe: u.blank?.afterAct?.any, writeToClearMs: clear ? r1(clear[0] - mid.rt) : null, clearAt: clear?.[0] ?? null },
    around, lafAfterWrite: laf, firstTwoRender: after.map(f => f.render), firstTwoDur: after.map(f => f.d),
    settle: u.settle?.rt, anchor: u.end?.centreAtSettle, anchors: u.anchors?.map(a => `${a.why}:${a.i}@${a.rt}`),
    drawn: { jumps: sp.jumps, maxMove: sp.maxMove, first: (sp.firstJumps ?? []).map(j => `${j.d}@${j.rt}`), frames: sp.frames, lag: sp.lagMedian },
    start: { jumps: sh.jumps, maxMove: sh.maxMove, net: sh.net, first: (sh.firstJumps ?? []).map(j => `${j.d}@${j.rt}`), reanchors: sh.reanchors },
    end: u.end, endState: u.endState, leaks: u.leaks, errors: u.errors }));
}
