// Start states and the end-pull control for rail-jump-live.mjs (#171). ChatGPT keeps an end pin:
// while it is set and the transcript grows, it scrolls the chat to its end (the end pull). A script's
// scrollTop write never changes it; a real wheel notch does (notes/runs/2026-11-24-rail-jump-pin,
// Q3). So each start first ends the rail's pinned state (the caller's one-pixel wheel notch,
// `unpin`), then puts the end pin into the state its name says, reads it, and checks it holds:
//   top-unpinned  at the top with the pin cleared: a real wheel notch up away from the end (from at
//                 least 400 px, so the notch can move), a write to 0, then the chat must stay within
//                 HOLD_PX of the top for HOLD_MS (3000; a pinned write to 0 was pulled about 1.0 s
//                 later, other positions up to about 3 s).
//   end-pinned    at the end with the pin set, as seek-pin-live.mjs sets it: a write 300 px above the
//                 end, three wheel notches down, 1.5 s; then within AT_END px of the end, and never
//                 a viewport away from it for 1 s.
// A start that does not hold after TRIES attempts (3) is a setup error for that jump. The pin is read
// through React's fiber hooks (`__railJumpLive.pin()`); null when unreadable, which never fails a
// start (the caller reports it). Pure parts (`startName`, `sameStart`, `pulledAt`, `endWriters`) are checked by
// rail-jump-verdict-check.mjs.
export const STATES = ['top-unpinned', 'end-pinned'];
// The labels before #171; `bottom` was the end with the pin as the setup left it.
export const ALIASES = { top: 'top-unpinned', bottom: 'end-pinned' };
export const startName = from => ALIASES[from] ?? from;
// Whether an archived no-extension jump `j` started as this run's jump did (`from`, its start state
// `start`). A named start also needs the same end pin, read in both: a capture from before #171
// recorded none, so it never stands for a named start.
export const sameStart = (j, from, start) => startName(j.from) === from
  && (!STATES.includes(from) || (j.startState?.pin != null && j.startState.pin === start?.pin));
// ChatGPT's own "at the end" distance (extension/shared/leave-gesture.js).
const AT_END = 24;
// "Stayed at the top": a pull or ChatGPT's bottom-distance compensation moves the chat far beyond
// this; a re-render of the first turn (a 124–272 px shrink and regrowth, stage 1a Q2) does not.
const HOLD_PX = 300;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const geo = page => page.evaluate(() => ({ ...window.__railJumpLive.geo(), pin: window.__railJumpLive.pin() }));
const write = (page, y) => page.evaluate(y => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = y; }, y);
// The largest `away(geo)` sampled every 100 ms for `ms`.
async function hold(page, ms, away) {
  let worst = 0;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await pause(100))
    worst = Math.max(worst, away(await page.evaluate(() => window.__railJumpLive.geo())));
  return Math.round(worst);
}

const attempt = {
  async 'top-unpinned'(page, holdMs) {
    if ((await geo(page)).y < 400) { await write(page, 400); await pause(100); }
    await page.mouse.move(1000, 420); await page.mouse.wheel(0, -120); await pause(300);
    await write(page, 0); await pause(200);
    const set = await geo(page), drift = await hold(page, holdMs, g => g.y), after = await geo(page);
    const why = drift > HOLD_PX ? `left the top (scrollTop up to ${drift} in ${holdMs} ms)`
      : set.pin === true || after.pin === true ? 'the end pin stayed set' : null;
    return { why, pin: set.pin, pinAfterHold: after.pin, y: Math.round(after.y), end: Math.round(after.end), drift };
  },
  async 'end-pinned'(page) {
    const g = await geo(page);
    await write(page, g.end - 300); await pause(400);
    await page.mouse.move(1000, 420);
    for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, 200); await pause(250); }
    await pause(1500);
    const set = await geo(page), drift = await hold(page, 1000, g => g.end - g.y), after = await geo(page);
    const why = set.end - set.y > AT_END || after.end - after.y > AT_END || drift > after.vh ? `not at the end (${Math.round(after.end - after.y)} px from it, up to ${drift})`
      : set.pin === false || after.pin === false ? 'the end pin was not set' : null;
    return { why, pin: set.pin, pinAfterHold: after.pin, y: Math.round(after.y), end: Math.round(after.end), drift };
  },
};

// Puts the chat into start `state`; { state, ok, why, attempts, pin, pinAfterHold, y, end, drift }.
export async function setStart(page, state, { unpin, holdMs = 3000, tries = 3 }) {
  let result;
  for (let n = 1; n <= tries; n++) {
    await unpin();
    result = { state, attempts: n, ...await attempt[state](page, holdMs) };
    if (!result.why) break;
  }
  return { ...result, ok: !result.why };
}

// "Pulled": after leaving the end region (more than a viewport from the end), a sample back within a
// viewport of it; the ms, null (held), or 'never-left'. Rows are [ms, scrollTop, scrollHeight, vh].
export function pulledAt(trace) {
  let left = false;
  for (const [ms, y, h, vh] of trace) {
    if (h - vh - y > vh) left = true;
    else if (left) return ms;
  }
  return left ? null : 'never-left';
}

// The control: with the end pin set and no rail jump, a plain scrollTop write to question 0's
// position (its top less the rail's 64 px inset; the first turn, so 0 when it is not mounted, as at
// the end), sampled every 100 ms for `ms`.
export async function control(page, { unpin, ms = 6000 }) {
  const start = await setStart(page, 'end-pinned', { unpin });
  if (!start.ok) return { start, ok: false };
  const target = await page.evaluate(() => window.__railJumpLive.questionTop(0));
  await write(page, target);
  const trace = [];
  for (const t0 = Date.now(); Date.now() - t0 < ms; await pause(100)) {
    const g = await page.evaluate(() => window.__railJumpLive.geo());
    trace.push([Date.now() - t0, Math.round(g.y), Math.round(g.h), g.vh]);
  }
  const at = pulledAt(trace);
  return { start, ok: true, write: target, pulled: typeof at === 'number', at, pinAtEnd: (await geo(page)).pin,
    trace: trace.filter((_, i) => i % 5 === 0 || i === trace.length - 1) };
}

// The scroll probe's writes that put the chat within AT_END px of its end, with who made them: the
// world, the call and the first three calling function names (no URLs).
export function endWriters(calls = []) {
  const callers = stack => (stack || '').split('\n').slice(3, 6).map(l => /^\s*at (?:async )?([^\s(]+) \(/.exec(l)?.[1] ?? '<anonymous>');
  return calls.filter(c => {
    const top = c.kind === 'scrollTop:before' ? c.value : /^(scroll|scrollTo):before$/.test(c.kind)
      ? (typeof c.args?.[0] === 'object' ? c.args[0]?.top : c.args?.[1]) : undefined;
    return typeof top === 'number' && c.h - c.vh - top <= AT_END && c.h - c.vh - c.y > AT_END;
  }).map(c => ({ t: c.t, world: c.world, kind: c.kind.replace(':before', ''), callers: callers(c.stack) }));
}
