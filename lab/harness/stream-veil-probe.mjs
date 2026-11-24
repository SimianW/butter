// Stage 4 of the Smoother streaming long-frame work (2026-11-24 stream veil), for
// stream-replay-live.mjs through stream-api-probe.mjs. Measurement only: REPORT lines, never a
// verdict; structure only, no chat text.
//
// - TAIL_MS (default 5000): how long the observation window stays open after the stream completes.
//   Use 5000 or more. Below 5000 the standard window is not cut at 5 s, and below 3000 the
//   long-frame probe still runs to 3 s (the verdicts' snapshot) while the ticks stop at TAIL_MS.
//   splitTail() cuts the long-animation-frame entries at the standard window's end (5 s after the
//   harness saw the stream complete), so every standard REPORT line keeps its meaning;
//   tailReport() sums the frames after it: long frames, blocking, the longest frame, frames of at
//   least 100 ms with the nearest hydration batch (data-butter-measure on) and flush
//   (data-butter-seen), block counts and the last turn's height over time.
// - veilReport(): blocks with data-butter-veil (prototype pv) mid-stream, just before the
//   completion frame and after the window, and veiled blocks whose computed content-visibility is
//   not `auto` (those would paint blank if on screen).
// - VEILPROBE=1 (veilProbe): from the scroll to the end that starts the wheel phase until it ends,
//   on every animation frame, 7 points down the text column inside the view are hit-tested with
//   document.elementFromPoint; a hit's nearest answer block counts when it has data-butter-veil or
//   computes opacity 0. Steps are counted from the page's wheel events. Then one scrollTop write
//   to the middle of the streamed answer, with the same test for 30 frames.

const r1 = v => Math.round(v * 10) / 10;

// raw: stopLafProbe's result (page clock). Returns the standard window's raw and keeps the tail.
export function splitTail(raw) {
  if (!raw || raw.stdEnd == null) return { std: raw, tail: null };
  const cut = raw.stdEnd, before = r => r.s <= cut, after = r => r.s > cut;
  const marks = Object.fromEntries(Object.entries(raw.marks).map(([k, v]) => [k, Array.isArray(v) ? v.filter(m => m.t == null || m.t <= cut) : v]));
  const std = { ...raw, end: cut, loaf: raw.loaf.filter(before), longtask: raw.longtask.filter(before), marks };
  const tail = { start: cut, end: raw.end, enter: raw.enter, loaf: raw.loaf.filter(after), marks: raw.marks };
  return { std, tail };
}

const fmtRow = r => `${r.hydrated ?? '-'}/${r.pending ?? '-'}/${r.measuring}/${r.unrendered}/${r.veiled ?? '-'}`;

// rows: hydration samples (t in ms after Enter); g: answerGeo after the window; d: lafDetail of the
// standard window, whose marks count when there is no tail.
export function tailReport(tail, rows, g, lines, d) {
  const z = tail?.enter ?? 0;
  const at = t => r1(t - z);
  const hyd = tail ? (tail.marks.hyd || []).map(m => ({ ...m, t: at(m.t) })) : d?.marks?.hyd || [];
  const flushes = tail ? (tail.marks.butter || []).filter(m => m.seen).map(m => ({ ...m, t: at(m.t) })) : (d?.marks?.butter || []).filter(m => m.seen);
  // Measuring blocks over time from the marks: most at once, hydration start and end.
  let cur = 0, most = 0;
  for (const m of hyd) { cur += m.measureOn - m.measureOff; most = Math.max(most, cur); }
  const on = hyd.filter(m => m.measureOn), offs = hyd.filter(m => m.measureOff);
  const hydration = { batches: on.length, first: on[0]?.t ?? null, lastOn: on.at(-1)?.t ?? null, lastOff: offs.at(-1)?.t ?? null, mostMeasuringFromMarks: most,
    measureOn: on.reduce((a, m) => a + m.measureOn, 0), veilOff: hyd.reduce((a, m) => a + m.veilOff, 0) };
  const sRows = rows.filter(r => r && r.turnH != null);
  const fin = g?.turn ?? sRows.at(-1)?.turnH ?? null;
  const exact = fin != null ? sRows.find((r, i) => r.turnH === fin && sRows.slice(i).every(x => x.turnH === fin)) : null;
  const out = { hydration, finalHeight: fin, heightFinalFrom: exact?.t ?? null };
  if (!tail) {
    lines.push(`tail: none (TAIL_MS ${tailMs()}); hydration marks in the window: ${JSON.stringify(hydration)}`);
    return out;
  }
  const fr = tail.loaf.map(f => ({ ...f, s: at(f.s) }));
  const near = (list, t) => list.reduce((b, m) => (b == null || Math.abs(m.t - t) < Math.abs(b.t - t) ? m : b), null);
  const big = fr.filter(f => f.d >= 100).map(f => {
    const b = near(on, f.s), fl = near(flushes, f.s);
    return { s: f.s, d: f.d, b: f.b, render: f.render, frameCb: f.frameCb, batch: b ? r1(b.t - f.s) : null, flush: fl ? r1(fl.t - f.s) : null };
  });
  const longest = fr.reduce((b, f) => (!b || f.d > b.d ? f : b), null);
  Object.assign(out, { from: at(tail.start), to: at(tail.end), frames: fr.length, blockingMs: r1(fr.reduce((a, f) => a + f.b, 0)), totalMs: r1(fr.reduce((a, f) => a + f.d, 0)),
    longest: longest ? { s: longest.s, d: longest.d } : null, hist: { ge100: big.length, ge200: fr.filter(f => f.d >= 200).length, ge500: fr.filter(f => f.d >= 500).length, ge1000: fr.filter(f => f.d >= 1000).length },
    ge100: big, forcedMs: r1(fr.reduce((a, f) => a + f.scripts.reduce((x, s) => x + s.forced, 0), 0)) });
  lines.push(`tail (${out.from}-${out.to} ms after Enter): LoAF ${out.frames}, total ${out.totalMs} ms, blocking ${out.blockingMs} ms, longest ${longest ? `${longest.d} ms at ${longest.s}` : '-'}, >=100/200/500/1000 ms ${out.hist.ge100}/${out.hist.ge200}/${out.hist.ge500}/${out.hist.ge1000}, forced ${out.forcedMs} ms`);
  lines.push(`tail frames >= 100 ms (start, duration, render part; ms to the nearest hydration batch and flush): ${big.map(f => `${f.d}@${f.s} r${f.render} batch ${f.batch ?? '-'} flush ${f.flush ?? '-'}`).join('; ') || 'none'}`);
  lines.push(`hydration marks: ${hydration.batches} batches (${hydration.measureOn} blocks) from ${hydration.first ?? '-'} to ${hydration.lastOn ?? '-'} ms, last measure off ${hydration.lastOff ?? '-'} ms, most measuring at once ${most}; veils removed in these callbacks ${hydration.veilOff}`);
  const tr = sRows.filter(r => r.t >= at(tail.start) - 6000);
  const every = tr.filter((r, i) => i === 0 || Math.floor(r.t / 1000) !== Math.floor(tr[i - 1].t / 1000));
  lines.push(`tail over time (s after Enter: hydrated/pending/measuring/unrendered/veiled, last turn px): ${every.map(r => `${r1(r.t / 1000)}s:${fmtRow(r)},${r.turnH}`).join(' ')}`);
  lines.push(`last turn height: final ${fin ?? '-'} px, exactly final from ${exact ? `${exact.t} ms` : '-'}`);
  return out;
}
const tailMs = () => Number(process.env.TAIL_MS || 5000);

// d: lafDetail of the standard window; f: the completion frame.
export function veilReport(rows, d, f, g, lines) {
  const vr = rows.filter(r => r && r.veiled != null);
  if (!vr.length) return null;
  const gone = d?.marks?.inProgressGone ?? null;
  const mid = vr.filter(r => r.inProgress);
  const midMax = mid.reduce((b, r) => (!b || r.veiled > b.veiled ? r : b), null), midAt = mid[mid.length >> 1] ?? null;
  const before = vr.filter(r => r.t < (f?.s ?? gone ?? Infinity)).at(-1) ?? null;
  const notAuto = Math.max(0, ...vr.map(r => r.veiledNotAuto ?? 0));
  const out = { midStream: midAt && { t: midAt.t, veiled: midAt.veiled }, midStreamMax: midMax && { t: midMax.t, veiled: midMax.veiled }, beforeCompletion: before && { t: before.t, veiled: before.veiled },
    afterWindow: g?.blocks?.veiled ?? null, afterWindowNotAuto: g?.blocks?.veiledNotAuto ?? null, maxVeiledNotAutoInSamples: notAuto };
  lines.push(`veil counts (last turn): mid-stream ${midAt ? `${midAt.veiled} at ${midAt.t} ms` : '-'} (max ${midMax ? `${midMax.veiled} at ${midMax.t}` : '-'}); just before the completion frame ${before ? `${before.veiled} at ${before.t} ms` : '-'}; after the window ${out.afterWindow ?? '-'}; veiled but not content-visibility auto: max ${notAuto} in samples, ${out.afterWindowNotAuto ?? '-'} after the window`);
  return out;
}

// In the page (MAIN world): per-frame hit test of 7 points down the text column.
function startVeil() {
  if (window.__veilProbe) return;
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const blockOf = e => { for (; e && e !== document.body; e = e.parentElement) if (e.parentElement?.matches(`${COLUMN}, [class*="DilResponseRoot"]`) && !e.matches('[data-dil-source-message-id]')) return e; return null; };
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const V = (window.__veilProbe = { on: true, phase: 'end', up: 0, down: 0, frames: [], n: 0, hit: 0, onBlock: 0 });
  addEventListener('wheel', e => { if (e.deltaY < 0) { V.up++; V.phase = `up ${V.up}`; } else if (e.deltaY > 0) { V.down++; V.phase = `down ${V.down}`; } }, { capture: true, passive: true });
  const tick = () => {
    if (!V.on) return;
    const s = sc(), col = [...document.querySelectorAll(COLUMN)].at(-1);
    if (s && col) {
      const r = s.getBoundingClientRect(), c = col.getBoundingClientRect(), x = c.left + c.width / 3;
      let veiled = 0, op0 = 0, blocks = 0;
      for (let k = 0; k < 7; k++) {
        const b = blockOf(document.elementFromPoint(x, r.top + (s.clientHeight * (k + 0.5)) / 7));
        if (!b) continue;
        blocks++;
        const v = b.hasAttribute('data-butter-veil'), o = getComputedStyle(b).opacity === '0';
        if (v) veiled++;
        if (o) op0++;
      }
      V.n++; V.onBlock += blocks;
      if (veiled || op0) { V.hit++; V.frames.push({ i: V.n, t: Math.round(performance.now()), phase: V.phase, veiled, op0 }); }
    }
    V.raf = requestAnimationFrame(tick);
  };
  V.tick = tick;
  V.raf = requestAnimationFrame(tick);
}
// Cancels the sampler's queued frame, so a later jumpMid runs one sampling loop, not two.
function stopVeil() {
  const V = window.__veilProbe;
  V.on = false;
  cancelAnimationFrame(V.raf);
  return { n: V.n, hit: V.hit, onBlock: V.onBlock, frames: V.frames, up: V.up, down: V.down };
}
// A scrollTop write to the middle of the streamed answer (the last turn), then the test for 30
// frames (at most 300 frames: n counts only frames with the scroller and an answer column).
async function jumpMid() {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(x => x.clientHeight > 0);
  const t = [...s.querySelectorAll('[data-turn-key]')].at(-1), V = window.__veilProbe;
  const sr = s.getBoundingClientRect(), tr = t.getBoundingClientRect();
  Object.assign(V, { on: true, phase: 'mid', n: 0, hit: 0, onBlock: 0, frames: [] });
  const from = s.scrollTop;
  V.raf = requestAnimationFrame(V.tick);
  s.scrollTop = Math.round(s.scrollTop + tr.top - sr.top + tr.height / 2 - s.clientHeight / 2);
  const to = s.scrollTop;
  let k = 0;
  await new Promise(res => { const f = () => (V.n >= 30 || ++k >= 300 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const r = window.__veilStop();
  return { ...r, from: Math.round(from), to: Math.round(to) };
}

const runs = fr => { let best = 0, cur = 0, prev = null; for (const f of fr) { cur = prev != null && f.i === prev + 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = f.i; } return best; };
const byPhase = fr => fr.reduce((a, f) => ((a[f.phase] = (a[f.phase] || 0) + 1), a), {});

export async function veilProbe(page, env, summary) {
  if (env.VEILPROBE !== '1') return null;
  await page.evaluate(`window.__veilStop = ${stopVeil.toString()}; (${startVeil.toString()})()`);
  return {
    async finish() {
      const w = await page.evaluate(() => window.__veilStop());
      const m = await page.evaluate(jumpMid);
      summary.veilProbe = { wheel: w, mid: m };
      const fmt = (r, what) => `${what}: frames sampled ${r.n} (point hits on an answer block ${r.onBlock}), frames with a tested point on a veiled or opacity-0 block ${r.hit}, longest consecutive run ${runs(r.frames)}, by step ${JSON.stringify(byPhase(r.frames))}, veiled/op0 hits ${r.frames.reduce((a, f) => a + f.veiled, 0)}/${r.frames.reduce((a, f) => a + f.op0, 0)}`;
      return [fmt(w, `veil probe, wheel phase (${w.up} wheel events up, ${w.down} down)`), fmt(m, `veil probe, scrollTop write to the streamed answer's middle (${m.from} → ${m.to})`)];
    },
  };
}
