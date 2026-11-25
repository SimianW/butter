// Seek release landing on live ChatGPT (2026-11-18 live features, item 6). With Butter, loads all
// earlier history of a fixture, then per trial puts the chat at a fraction of its range, presses the
// native scrollbar thumb, drags it in steps, holds, and lets go. While held, Butter's seek preview
// reports which question is at the view's top and how far into it (`__seekDump(true).updates`, the
// last row: turn index, offset). After release the chat settles; the question whose turn covers the
// view's top (below the header) and the offset into it are read from the page. `seek-landing`
// passes when the landed question is the previewed one and the offsets differ by less than a
// viewport. Read-only apart from scrollbar drags; send guard on. Needs the lab lock you hold.
// After each release it samples, every 100 ms for TRACE ms (2000; 0 off), scrollTop, scrollHeight
// and the mounted turns' boxes (`REPORT trial N trace`), to show what ChatGPT mounts where Butter
// put the chat.
//
// `EXT=` (empty) is the native control: the same drags with no preview. It reports which question
// covers the view's top after the release, how long until the turn under the view is mounted, and
// the same trace; it prints no seek-landing verdicts.
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked Butter dir> [FIXTURE=math12] [AT=0.2,0.4,0.55,0.7,0.85]
//   [ARROW=15] [TRACE=2000] node lab/harness/seek-landing-live.mjs
// Exit 1 on FAIL, 2 on setup error. Indices and pixel numbers only.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { heldLab, startLab, openFixture, thumbAt } from './seek-live-page.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'math12', AT = (env.AT || '0.2,0.4,0.55,0.7,0.85').split(',').map(Number), ARROW = Number(env.ARROW ?? 15), TRACE = Number(env.TRACE ?? 2000);
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, exit = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);
if (!env.LAB_OWNER || env.EXT == null) { console.error('LAB_OWNER= and EXT= are required (EXT= empty: native)'); process.exit(2); }
const NATIVE = env.EXT === '';
const lab = heldLab(L, env);

let browser, restoreOptions;
try {
  let page; ({ browser, page, restoreOptions } = await startLab(L, lab, env, env.EXT));
  const n = await openFixture(L, lab, page, FIXTURE, !NATIVE);
  report(`${FIXTURE}: history loaded, ${n} entries`);
  for (const [i, f] of AT.entries()) {
    await page.evaluate(v => window.__sl.put(v), f);
    await pause(3500);
    const g = await page.evaluate(() => window.__sl.geo());
    const { x, y: y0 } = thumbAt(g, g.y / (g.h - g.vh), ARROW);
    const dir = f > 0.6 ? -1 : 1;
    await page.mouse.move(x, y0); await page.mouse.down();
    const heldYs = [];
    for (let k = 1; k <= 4; k++) { await page.mouse.move(x, y0 + dir * k * 40, { steps: 4 }); await pause(250); heldYs.push((await page.evaluate(() => window.__sl.geo())).y); }
    await pause(600);
    const pv = await page.evaluate(() => window.__sl.preview());
    await page.mouse.up();
    const t0 = Date.now(), trace = [];
    // Native: how long until a turn covers the view's top (the turn under the released thumb mounted).
    let coveredMs = null;
    for (let t = 0; t < TRACE; t += 100) {
      const p = await page.evaluate(() => ({ ...window.__sl.sample(), at: window.__sl.landed().turn }));
      trace.push([Date.now() - t0, p.y, p.h, p.at, p.turns]);
      if (coveredMs == null && p.at != null) coveredMs = Date.now() - t0;
      await pause(100);
    }
    if (TRACE) report(`trial ${i + 1} trace [ms, scrollTop, scrollHeight, question at the view's top, mounted [question, top, height]]: ${JSON.stringify(trace)}`);
    // Settle: preview gone and scrollTop still for 1.5 s (max 10 s).
    let last = null, still = 0;
    while (Date.now() - t0 < 10000) {
      await pause(250);
      const p = await page.evaluate(() => ({ g: window.__sl.geo(), shown: window.__sl.preview().shown, at: window.__sl.landed().turn }));
      if (coveredMs == null && p.at != null) coveredMs = Date.now() - t0;
      if (!p.shown && last != null && Math.abs(p.g.y - last) < 1) { still += 250; if (still >= 1500) break; } else still = 0;
      last = p.g.y;
    }
    const land = await page.evaluate(() => window.__sl.landed());
    if (NATIVE) {
      const moved = heldYs.at(-1) - g.y;
      report(`trial ${i + 1} at ${f} native: scrollTop ${Math.round(g.y)} → held ${Math.round(heldYs.at(-1))} (moved ${Math.round(moved)}); after release: question ${land.turn} +${land.offset} px of ${land.entries} entries, scrollTop ${land.y}; a turn covered the view's top ${coveredMs == null ? 'never (10 s)' : `after ${coveredMs} ms`}; mounted ${JSON.stringify((await page.evaluate(() => window.__sl.sample())).turns.map(t => t[0]))}`);
      await pause(4000);
      continue;
    }
    const tgt = await page.evaluate(j => window.__sl.target(j), pv.last?.turn ?? -1);
    const full = await page.evaluate(() => { const a = window.__seekDump?.(true)?.sessions?.at(-1); return a ? { startTop: a.startTop && Math.round(a.startTop), realTop: a.realTop && Math.round(a.realTop), destination: a.destination, finds: a.finds, retargets: a.retargets, commitRetarget: a.commitRetarget, swap: a.swap, swapError: a.swapError, alignmentCorrection: a.alignmentCorrection, releaseToCommitMs: a.releaseToCommitMs && Math.round(a.releaseToCommitMs) } : null; });
    report(`trial ${i + 1} target question ${pv.last?.turn} after settle: ${JSON.stringify(tgt)}; session detail ${JSON.stringify(full)}`);
    const after = await page.evaluate(() => window.__sl.preview());
    const moved = heldYs.at(-1) - g.y;
    report(`trial ${i + 1} at ${f}: thumb press y ${y0}, scrollTop ${Math.round(g.y)} → held ${Math.round(heldYs.at(-1))} (moved ${Math.round(moved)}), preview shown while held ${pv.shown} (${pv.items} items, ${pv.updates} updates), preview top: question ${pv.last?.turn} +${pv.last?.offset} px (layout ${pv.last?.layout}, known ${pv.last?.known}); landed: question ${land.turn} +${land.offset} px of ${land.entries} entries, scrollTop ${land.y}, inset ${land.inset}; session ${JSON.stringify(after.session)}`);
    const dragged = Math.abs(moved) > 200 && pv.shown;
    if (!dragged) { verdict(false, `seek-landing #${i + 1}`, `the drag did not take (scrollTop moved ${Math.round(moved)} px, preview shown ${pv.shown})`); continue; }
    // The unseen estimate draws question `turn` from its start (preview-main.js render(): y 0), so the
    // chat should show that question's top; with stored layout, the offset the thumb maps to.
    const want = pv.drawn.unseen ? 0 : pv.last.offset;
    report(`trial ${i + 1} preview drew: ${JSON.stringify(pv.drawn)} → expected question ${pv.last.turn} +${want} px`);
    const ok = land.turn === pv.last?.turn && Math.abs(land.offset - want) < g.vh;
    verdict(ok, `seek-landing #${i + 1}`, `preview showed question ${pv.last?.turn} +${want}${pv.drawn.unseen ? ' (unseen estimate, from its start)' : ''}, landed on question ${land.turn} +${land.offset} (viewport ${g.vh})`);
    await pause(4000);
  }
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally { await restoreOptions?.().catch(() => {}); await browser?.close().catch(() => {}); }
console.log(`SUMMARY seek-landing: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
