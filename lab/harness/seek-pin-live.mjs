// Seek release and ChatGPT's pin to the chat's end (issue #152). ChatGPT pins the chat to its end;
// while pinned, a ResizeObserver pulls the chat back to the end whenever the transcript grows. A
// native thumb drag unpins it; before the fix, a Butter release kept the pin and the chat was
// pulled to the end 1–4 s later (notes/runs/2026-11-23-seek-pin-cause/report.md).
//
// On a lock you hold, opens a fixture with all earlier history loaded. Per trial: re-pin the chat at
// its end (a scrollTop write 300 px above the end, then 3 wheel notches down: ChatGPT's own
// gesture toward the end pins), do the trial's action, sample scrollTop, scrollHeight and the
// question at the view's top every 100 ms for MS ms (8000), then settle. Trial kinds:
//   release  (needs EXT): drag the native scrollbar thumb from the end to fraction AT[i], read the
//            destination Butter's seek session reports, let go. `seek-pin #N` passes when the chat,
//            after leaving the end region, is never back within one viewport of the end in the
//            window. Landing on the previewed question is a REPORT, not a verdict.
//   write    (control, any EXT): scrollTop = AT[i] × range. `REPORT control #N pulled|held`.
//            `FAIL control` when no control in the run was pulled: the run could not see the bug.
// A pull needs the pin and transcript growth, so choose AT where turns mount after the jump
// (math12: about 0.6–0.72, where question 7 mounts and replaces its height estimate, and 0).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked Butter dir, or empty> [FIXTURE=math12]
//   [AT=0.66,0.62,0.7,0.05] [KINDS=release|write|release,write,...] [MS=8000] [ARROW=15]
//   node lab/harness/seek-pin-live.mjs
// KINDS cycles over the trials (default: release with EXT, write without). Exit 1 on any FAIL, 2
// on a setup error. Read-only apart from scrollbar drags, wheel notches and scrollTop writes; send
// guard on. Logs hold indices, pixel numbers and ms only.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { heldLab, startLab, openFixture, thumbAt } from './seek-live-page.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'math12', ARROW = Number(env.ARROW ?? 15), MS = Number(env.MS ?? 8000);
const AT = (env.AT || '0.66,0.62,0.7,0.05').split(',').map(Number);
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, exit = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);
const lab = heldLab(L, env);
if (env.EXT == null) { console.error('EXT= is required (EXT= empty: no extension, write controls only)'); process.exit(2); }
const NATIVE = env.EXT === '';
const KINDS = (env.KINDS || (NATIVE ? 'write' : 'release')).split(',');
if (KINDS.some(k => k !== 'release' && k !== 'write')) { console.error(`KINDS: release or write, not ${env.KINDS}`); process.exit(2); }
if (NATIVE && KINDS.includes('release')) { console.error('release trials need EXT=<unpacked Butter dir>'); process.exit(2); }

// In the page: [scrollTop, scrollHeight, clientHeight, question at the view's top].
const read = () => {
  const s = [...document.querySelectorAll('.thread-scroll-container')].find(x => x.clientHeight > 0);
  return [Math.round(s.scrollTop), Math.round(s.scrollHeight), s.clientHeight, window.__sl.landed().turn];
};
// "Pulled": after the chat has left the end region (more than a viewport from the end), a sample
// back within one viewport of the end.
function pulledAt(trace, vh) {
  let left = false;
  for (const [ms, , , dist] of trace) {
    if (dist > vh) left = true;
    else if (left) return ms;
  }
  return left ? null : 'never-left';
}

async function repin(page) {
  await page.evaluate(() => { const g = window.__sl.geo(); window.__sl.top(g.h - g.vh - 300); });
  await pause(400);
  const g = await page.evaluate(() => window.__sl.geo());
  await page.mouse.move(Math.round(g.left + 300), Math.round(g.top + 300));
  for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, 200); await pause(250); }
  await pause(1500);
}

async function watch(page) {
  const t0 = Date.now(), trace = [];
  while (Date.now() - t0 < MS) {
    const [y, h, vh, at] = await page.evaluate(read);
    trace.push([Date.now() - t0, y, h, h - vh - y, at]);
    await pause(100);
  }
  return trace;
}

// Settle: no seek preview and scrollTop still for 1.5 s (max 6 s).
async function settle(page) {
  const t0 = Date.now();
  let last = null, still = 0;
  while (Date.now() - t0 < 6000) {
    await pause(250);
    const p = await page.evaluate(() => ({ y: window.__sl.geo().y, shown: window.__sl.preview().shown }));
    if (!p.shown && last != null && Math.abs(p.y - last) < 1) { still += 250; if (still >= 1500) break; } else still = 0;
    last = p.y;
  }
  return page.evaluate(() => window.__sl.landed());
}

const short = trace => trace.filter((_, i) => i % 5 === 0 || i === trace.length - 1).map(([ms, y, h, , at]) => [ms, y, h, at]);
const dest = { estimated: 0, 'layout stored': 0, 'layout session': 0, none: 0 };
const counts = { release: 0, releasePulled: 0, landed: 0, write: 0, writePulled: 0 };

let browser, restoreOptions;
try {
  let page; ({ browser, page, restoreOptions } = await startLab(L, lab, env, env.EXT, { scrolling: true }));
  const n = await openFixture(L, lab, page, FIXTURE, !NATIVE);
  report(`${FIXTURE}: history loaded, ${n} entries; ${NATIVE ? 'no extension' : 'Butter'}; trials ${JSON.stringify(AT.map((f, i) => `${KINDS[i % KINDS.length]}@${f}`))}`);
  for (const [i, f] of AT.entries()) {
    const kind = KINDS[i % KINDS.length], N = i + 1;
    await repin(page);
    const g = await page.evaluate(() => window.__sl.geo());
    const end = g.h - g.vh;
    report(`trial ${N} ${kind}@${f}: after re-pin scrollTop ${Math.round(g.y)} of end ${end} (distance ${Math.round(end - g.y)})`);
    if (kind === 'write') {
      await page.evaluate(v => window.__sl.put(v), f);
      const trace = await watch(page);
      const p = pulledAt(trace, g.vh);
      const land = await settle(page);
      counts.write++;
      if (typeof p === 'number') counts.writePulled++;
      report(`control #${N} ${typeof p === 'number' ? `pulled (back at the end at ${p} ms)` : p === 'never-left' ? 'held (never left the end region)' : 'held'}; after settle question ${land.turn}, scrollTop ${land.y}`);
      report(`trial ${N} trace [ms, scrollTop, scrollHeight, question at the view's top] every 500 ms: ${JSON.stringify(short(trace))}`);
      continue;
    }
    // Release: press the thumb at the end, drag it to fraction f in 4 steps, hold, let go.
    // At the end the computed thumb centre (vh − ARROW − 10) can miss the thumb when the scrollbar
    // has no arrow buttons, and a held track press pages instead of dragging. vh − 18 is on the
    // thumb with or without 15 px buttons (20 px thumb: vh − 35…vh − 15, or vh − 20…vh).
    const end1 = thumbAt(g, 1, ARROW), from = { x: end1.x, y: Math.round(g.top + g.vh - 18) };
    const to = { x: from.x, y: thumbAt(g, f, ARROW).y + from.y - end1.y };
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let k = 1; k <= 4; k++) { await page.mouse.move(from.x, Math.round(from.y + (to.y - from.y) * k / 4), { steps: 4 }); await pause(250); }
    await pause(600);
    const pv = await page.evaluate(() => window.__sl.preview());
    const heldY = (await page.evaluate(() => window.__sl.geo())).y;
    await page.mouse.up();
    const trace = await watch(page);
    const land = await settle(page);
    const s = await page.evaluate(() => window.__sl.preview().session);
    const d = s?.destination;
    const kindOf = !d ? 'none' : !d.layout ? 'estimated' : d.stored ? 'layout stored' : 'layout session';
    dest[kindOf]++;
    counts.release++;
    const onQ = pv.last != null && land.turn === pv.last.turn;
    if (onQ) counts.landed++;
    report(`trial ${N} release@${f}: thumb ${from.y} → ${to.y}; held scrollTop ${Math.round(heldY)}; preview shown ${pv.shown}, top question ${pv.last?.turn} (layout ${pv.last?.layout}); destination ${kindOf} ${JSON.stringify(d ?? null)}; session reason ${s?.reason}, canceled ${s?.canceled}, timedOut ${s?.timedOut}, readable ${s?.releaseToReadableMs} ms`);
    report(`trial ${N} landing: ${onQ ? 'on' : 'not on'} the previewed question (previewed ${pv.last?.turn}, landed question ${land.turn} +${land.offset} px, scrollTop ${land.y})`);
    report(`trial ${N} trace [ms, scrollTop, scrollHeight, question at the view's top] every 500 ms: ${JSON.stringify(short(trace))}`);
    const p = pulledAt(trace, g.vh);
    if (typeof p === 'number') counts.releasePulled++;
    if (!pv.shown) verdict(false, `seek-pin #${N}`, `the drag did not take (no seek preview while held, scrollTop ${Math.round(heldY)})`);
    else if (p === 'never-left') verdict(false, `seek-pin #${N}`, `the chat never left the end region (aim lower than ${f})`);
    else verdict(p == null, `seek-pin #${N}`, `pulled to the end at ${p} ms`);
  }
  if (counts.write && !counts.writePulled) verdict(false, 'control', 'none of the controls was pulled (no growth after the writes, or no pin: this run cannot see the bug)');
  report(`summary: releases ${counts.release} (pulled ${counts.releasePulled}, landed on the previewed question ${counts.landed}; destinations ${JSON.stringify(dest)}); controls ${counts.write} (pulled ${counts.writePulled})`);
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally { await restoreOptions?.().catch(() => {}); await browser?.close().catch(() => {}); }
console.log(`SUMMARY seek-pin: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
