// u4's find-bar mode (U4_FINDBAR=1, with UX=u4), for stream-ux-probe.mjs: the browser's own find
// bar on a held block of the just-streamed answer, in place of u4's window.find stand-in (#170,
// "Acceptance runs": a window.find gap is measured with the real find bar before judging).
// Measurement only: REPORT lines, never a verdict. The search string never leaves the page and the
// typing helper: only its length is reported or saved.
//
// When u4 would start, the page picks the block and string u4's first window.find call would (a
// held block in the answer's last 30%, veiled where any is; a 12-24 character string found once in
// the page) and starts sampling every frame (scrollTop, the block's top in the view, in view, its
// flags) and observing long-animation-frame and longtask entries. Then, as real X input on the
// lab's display (xtest-type.py; DevTools key events do not open the find bar), with the pointer on
// the tab strip: Ctrl+F, 300 ms, the string one key every FINDBAR_GAP ms (100), FINDBAR_WAIT ms
// (5000), Escape; 1.5 s later the sampling stops.
// Times are from the Ctrl+F press: the helper's epoch stamps minus the page's performance.timeOrigin,
// checked against the page's own keydown for Ctrl+F (the typed keys go to the find bar, not the page).
// "Match": the first frame with the block in view (a prefix of the string may get there first);
// "settled": the first frame of the last in-view run that lasts until Escape; "drawn": in view with
// no veil, opacity 0 or skipped content. Frames (LoAF) count in a window when they start in it;
// "to match" ends at the settled drawn frame.
// Before paint: each frame's sample is completed, when the block's size changed in that frame, by
// [in view, flags] read after layout and before paint (stream-ux-probe.mjs's U.beforePaint), after
// the marker's `sized` observer has unveiled a block that just rendered. "Rendered": the first frame
// with the block in view and its content not skipped; "drawn at opacity 0": frames, Ctrl+F to
// Escape, whose before-paint sample has the block in view, not skipped and at opacity 0. The
// frame-start flags cannot tell these apart: in the frame a find renders the block they read 11
// (veil, opacity 0, held) on every build (notes/runs/2026-11-24-veil-acceptance/final/find-frame).
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { median } from './stream-shift.mjs';

const HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'xtest-type.py');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (v) => Math.round(v * 10) / 10;

// In the page; needs stream-ux-probe.mjs's window.__ux (pickHeld, flags, geom, inView, beforePaint).
export function installFindbar() {
  const U = window.__ux, q1 = (v) => Math.round(v * 10) / 10;
  const p = U.pickHeld();
  if (!p.b) return { none: true, held: p.held };
  const F = (window.__fb = { frames: [], loaf: [], lt: [], keys: [], on: true, obs: [] });
  for (const [type, into] of [['long-animation-frame', F.loaf], ['longtask', F.lt]]) {
    try {
      const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) into.push([q1(e.startTime), q1(e.duration), q1(e.blockingDuration ?? Math.max(0, e.duration - 50))]); });
      o.observe({ type, buffered: false });
      F.obs.push(o);
    } catch { /* not supported */ }
  }
  const onKey = (e) => F.keys.push([q1(e.timeStamp), e.code, e.ctrlKey]);
  addEventListener('keydown', onKey, true);
  // `row`: this frame's sample, which the before-paint sample (U.beforePaint) completes.
  let row = null;
  F.obs.push(U.beforePaint(p.b, (v, f) => { if (row) row[5] = [v, f]; }));
  const frame = () => {
    if (!F.on) return;
    const g = U.geom();
    row = g && F.frames.length < 3000 ? [q1(performance.now()), q1(g.s.scrollTop), q1(p.b.getBoundingClientRect().top - g.r.top), U.inView(p.b, g), U.flags(p.b)] : null;
    if (row) F.frames.push(row);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  F.stop = () => {
    F.on = false;
    F.obs.forEach((o) => o.disconnect());
    removeEventListener('keydown', onKey, true);
    const sel = getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
    const out = { frames: F.frames, loaf: F.loaf, lt: F.lt, keys: F.keys, timeOrigin: performance.timeOrigin, selLen: sel.toString().length, selInBlock: r ? p.b.contains(r.commonAncestorContainer) : false, flagsEnd: U.flags(p.b) };
    sel.removeAllRanges();
    return out;
  };
  const g = U.geom();
  return { block: p.i, len: p.str.length, str: p.str, held: p.held, flagsBefore: U.flags(p.b), y0: q1(g.s.scrollTop), at: { x: Math.round(screenX + 700), y: Math.round(screenY + 20) } };
}

// Run the key steps as X input on `display`; returns the helper's { stamps }.
const runKeys = (steps, display) => JSON.parse(execFileSync('python3', [HELPER], { input: JSON.stringify(steps), env: { ...process.env, DISPLAY: display } }).toString());

export async function findbarDrive(page, env, display, run = runKeys) {
  if (!display) return { error: 'no lab display' };
  const prep = await page.evaluate(installFindbar);
  if (prep.none) return prep;
  const gapMs = Number(env.FINDBAR_GAP || 100), waitMs = Number(env.FINDBAR_WAIT || 5000);
  const steps = [{ move: [prep.at.x, prep.at.y] }, { chord: 'ctrl+f' }, { sleep: 300 }, { text: prep.str, gapMs }, { sleep: waitMs }, { chord: 'Escape' }];
  delete prep.str;
  let keys;
  try { keys = run(steps, display); } catch (e) { keys = { error: String(e.message).slice(0, 200), stamps: [] }; }
  await pause(1500);
  const raw = await page.evaluate(() => window.__fb.stop());
  if (!keys.stamps?.length) return { ...prep, gapMs, waitMs, keyError: keys.error ?? 'no key stamps' }; // nothing to time from
  return { ...prep, gapMs, waitMs, keyError: keys.error ?? null, selLen: raw.selLen, selInBlock: raw.selInBlock, flagsEnd: raw.flagsEnd, longtask: sumIn(raw.lt, ...windowOf(raw, keys.stamps)), ...findbarAnalyse({ ...raw, stamps: keys.stamps }) };
}

const windowOf = (raw, stamps) => {
  const t = stamps.map((s) => s.at - raw.timeOrigin);
  return t.length ? [t[0], t.length > 1 ? t.at(-1) : Infinity, t[0]] : [Infinity, Infinity, 0];
};

// Frames (LoAF or longtask entries, [start, duration, blocking]) that start in [from, to).
function sumIn(entries, from, to, t0) {
  const e = entries.filter(([s]) => s >= from && s < to);
  const top = e.reduce((m, x) => (x[1] > (m?.[1] ?? -1) ? x : m), null);
  return { frames: e.length, blocking: r1(e.reduce((a, x) => a + x[2], 0)), longest: top ? top[1] : 0, longestAt: top ? r1(top[0] - t0) : null };
}

// The before-paint sample over a block's frames, each { inView, flags } at the frame's start and
// `paint`, [in view, flags] after layout and before paint (null: no report in that frame). `first`:
// the index of the first frame with the block in view and its content not skipped, by the
// before-paint sample where there is one, else by the frame's start; `opacity0`: frames whose
// before-paint sample has the block in view, not skipped (bit 4 clear) and at opacity 0 (bit 2
// set), i.e. frames drawn with it rendered at opacity 0; `samples`: frames with a sample.
export function beforePaint(frames) {
  const shown = (inView, f) => inView && !(f & 4);
  const first = frames.findIndex(({ inView, flags, paint }) => (paint && shown(...paint)) || shown(inView, flags));
  const sampled = frames.filter((f) => f.paint);
  return { first, opacity0: sampled.filter(({ paint: [v, f] }) => shown(v, f) && f & 2).length, samples: sampled.length };
}

// stamps: the helper's key presses (epoch ms; the first is Ctrl+F, the last chord is Escape);
// frames: [page ms, scrollTop, block top, in view, flags, before-paint sample [in view, flags] or
// absent]; loaf: [start, duration, blocking]; keys: the page's keydowns [timeStamp, code, ctrl].
export function findbarAnalyse({ timeOrigin, stamps, frames, loaf, keys }) {
  const t = stamps.map((s) => ({ kind: s.kind, t: s.at - timeOrigin }));
  const t0 = t[0].t, chars = t.filter((s) => s.kind === 'char');
  const escK = t.length > 1 && t.at(-1).kind === 'chord' ? t.at(-1).t : Infinity;
  const lastKey = chars.length ? chars.at(-1).t : t0;
  const rel = (v) => r1(v - t0);
  const inFind = frames.filter(([ft]) => ft >= t0 && ft < escK);
  const at = (f) => (f ? { rt: rel(f[0]), sinceLastKey: r1(f[0] - lastKey), y: f[1], flags: f[4] } : null);
  const match = at(inFind.find((f) => f[3]));
  const drawnF = inFind.find((f) => f[3] && !(f[4] & 7));
  // The last run of in-view frames that lasts until Escape: where the full string's match settled.
  let k = inFind.length;
  while (k > 0 && inFind[k - 1][3]) k--;
  const run = inFind.slice(k);
  const settledDrawnF = run.find((f) => !(f[4] & 7));
  const before = frames.filter(([ft]) => ft < t0).at(-1);
  let prevY = before?.[1] ?? inFind[0]?.[1];
  const moves = [];
  for (const f of inFind) { if (f[1] !== prevY) moves.push(f[0]); prevY = f[1]; }
  const gaps = frames.slice(1).map((f, j) => [frames[j][0], f[0] - frames[j][0]]).filter(([s]) => s >= t0 && s < escK);
  const pageF = keys.find((k) => k[1] === 'KeyF' && k[2]);
  const bp = beforePaint(inFind.map((f) => ({ inView: f[3], flags: f[4], paint: f[5] ?? null })));
  const renderedF = inFind[bp.first];
  return {
    keys: { chars: chars.length, lastKey: rel(lastKey), escape: escK === Infinity ? null : rel(escK), gapMedian: median(chars.slice(1).map((c, j) => r1(c.t - chars[j].t))), pageCtrlF: pageF ? rel(pageF[0]) : null },
    match,
    matchDrawn: at(drawnF),
    settled: at(run[0]),
    settledDrawn: at(settledDrawnF),
    scroll: { y0: before?.[1] ?? null, moves: moves.length, first: moves.length ? rel(moves[0]) : null, last: moves.length ? rel(moves.at(-1)) : null, yEnd: inFind.at(-1)?.[1] ?? null },
    frameMax: r1(Math.max(0, ...gaps.map(([, d]) => d))),
    find: sumIn(loaf, t0, escK, t0),
    toMatch: sumIn(loaf, t0, settledDrawnF ? settledDrawnF[0] + 0.001 : escK, t0),
    afterEsc: sumIn(loaf, escK, Infinity, t0),
    rendered: renderedF ? { ...at(renderedF), beforePaint: renderedF[5]?.[1] ?? null } : null,
    drawnAtOpacity0: { frames: bp.opacity0, samples: bp.samples },
  };
}

const fw = (w) => `${w.frames} frames, blocking ${w.blocking} ms, longest ${w.longest} ms${w.longestAt != null ? ` at +${w.longestAt} ms` : ''}`;
const fm = (m) => (m ? `+${m.rt} ms (${m.sinceLastKey} ms after the last key; scrollTop ${m.y}, flags ${m.flags})` : 'never before Escape');

export function fmtFindbar(P, f) {
  if (f.error) return [`${P} u4 find bar: ${f.error}`];
  if (f.none) return [`${P} u4 find bar: no unique string in a held block (${JSON.stringify(f.held)})`];
  return [
    `${P} u4 find bar: string of ${f.len} chars in block ${f.block} (held candidates ${f.held.candidates} of ${f.held.blocks}, veiled ${f.held.veiledAny}), flags before ${f.flagsBefore}, scrollTop ${f.y0}; keys: Ctrl+F, ${f.keys.chars} chars every ${f.gapMs} ms (median ${f.keys.gapMedian}), last at +${f.keys.lastKey} ms, Escape at +${f.keys.escape} ms; page keydown for Ctrl+F at ${f.keys.pageCtrlF ?? 'never'} ms (clock check)${f.keyError ? `; key error ${f.keyError}` : ''}`,
    `${P} u4 find bar match: settled in view ${fm(f.settled)}, settled and drawn (no veil, opacity 0 or skipped) ${fm(f.settledDrawn)}; first in view ${fm(f.match)}, first drawn ${fm(f.matchDrawn)}; scrollTop ${f.scroll.y0} → ${f.scroll.yEnd}, ${f.scroll.moves} moves (first +${f.scroll.first}, last +${f.scroll.last} ms); after Escape selection ${f.selLen} chars, in the block ${f.selInBlock}, flags ${f.flagsEnd}`,
    `${P} u4 find bar frames (LoAF starting in the window): Ctrl+F to Escape ${fw(f.find)}; Ctrl+F to the settled drawn match ${fw(f.toMatch)}; after Escape ${fw(f.afterEsc)}; longest sampled frame interval Ctrl+F to Escape ${f.frameMax} ms; longtasks Ctrl+F to Escape ${fw(f.longtask)}`,
    `${P} u4 find bar before paint (a ResizeObserver on the block after the marker's; frames where its size changed): first rendered in view (not skipped) ${f.rendered ? `+${f.rendered.rt} ms (${f.rendered.sinceLastKey} ms after the last key; scrollTop ${f.rendered.y}), flags at the frame's start ${f.rendered.flags}, before paint ${f.rendered.beforePaint ?? 'no report'}` : 'never before Escape'}; frames drawn with the matched block rendered at opacity 0, Ctrl+F to Escape: ${f.drawnAtOpacity0.frames} (of ${f.drawnAtOpacity0.samples} before-paint samples)`,
  ];
}
