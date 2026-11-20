// Live tick selection on the history rail (2026-11-18 live survey). Real ChatGPT fixtures, real
// pointer, wheel and keyboard input; the send guard is on and nothing is ever submitted. Takes,
// restores and releases the lab lock itself unless LAB_OWNER names a lock the caller already holds.
//
// LAB_ID=2 EXT=<unpacked Butter dir> LABEL=<name> [FIXTURES=ats12,math12] [CLICKS=all|<n>]
//   [STEP=<px>] [SHOTS=1] [OUT=<json>] node lab/harness/rail-ticks-live.mjs
//
// Per fixture, after loading all earlier history:
// - `count`: the rail shows one tick per question: its ticks equal ChatGPT's turn list (React's
//   `entries` prop, read as rail-jump-live-page.mjs reads it).
// - `wheel-*`: wheels from the top to the end with real wheel input (STEP px per step, default
//   max(700, scrollHeight / 120)). After each step, with the pointer off the rail and the wave
//   settled, the lit ticks (bar opacity > 0.9) are compared with the rail's own rule (rail/turns.js,
//   GLOSSARY.md "Lit band"): the mounted turns showing more than EDGE = 40 px between HEADER = 52 px
//   below the scroller's top and COMPOSER = 140 px above its bottom. Checks: the lit set equals that
//   set (`wheel-lit-matches`, a mismatch counts only if it is still there 600 ms later), it is never
//   empty while a turn is in the band (`wheel-never-none`), the question whose turn covers the band's
//   top is lit (`wheel-top-lit`), and the first lit tick never moves back while the page did not
//   move back (`wheel-monotonic`). A drop of scrollTop by more than a viewport is the page's own
//   jump back (wheel-jump-live.mjs measures that): it is reported, not judged, one scroll write puts
//   the chat back where the wheel had it, and the order check starts over.
// - `card-text`: hovering each tick shows a card whose text is that question's text (the question
//   bubble's text as the wheel pass and the clicks saw it, whitespace collapsed; the card cuts at 400 characters).
// - `click-*`: clicking a tick (all of them, or CLICKS spread over the chat) lands its question
//   64 px below the scroller's top (±32, or the scroll range's end) (`click-lands`), and with the
//   pointer moved off the rail its tick is lit (`click-lit`) and no tick outside the lit band's rule
//   is (`click-only`); the same 2 s later (`click-lit-2s`, `click-only-2s`). REPORT lines give the
//   lit count when the rule lights more than the clicked question.
// - `keys`: focusing a tick and pressing ArrowDown moves focus to the next tick, whose card shows its
//   question (`keys-arrow`); Enter on it jumps there and lights it (`keys-enter`).
// Text never leaves the page: the output holds indexes, counts and booleans only.
// Exit 1: any FAIL. Exit 2: setup error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const env = process.env;
const fixtures = (env.FIXTURES || 'ats12,math12').split(',');
const label = env.LABEL || 'ticks';
const out = env.OUT || path.join(L.root(), 'captures/2026-11-18-live-survey', `ticks-${label}.json`);
const shotDir = path.join(path.dirname(out), `ticks-${label}-shots`);
const HEADER = 52, COMPOSER = 140, EDGE = 40, TOP_INSET = 64;
const borrowed = !!env.LAB_OWNER;
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const lines = [];
const verdict = (ok, check, why) => {
  const line = ok ? `PASS ${check}` : `FAIL ${check}: ${why}`;
  if (!ok) fails++;
  lines.push(line); console.log(line);
};
const report = s => { lines.push(`REPORT ${s}`); console.log(`REPORT ${s}`); };

if (!env.EXT) { console.error('EXT= must name an unpacked Butter build (the rail needs Butter)'); process.exit(2); }
const lab = borrowed ? { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER }
  : L.acquire(env.LAB_ID || 'auto', { owner: `rail-ticks-live-${process.pid}`, needsFixture: fixtures[0], wait: 1800 });
const summary = { label, at: new Date().toISOString(), lab: lab.id, fixtures: {}, guard: { blockedMutations: 0, sendAttempts: 0 }, cleanup: {} };
let browser, context, page, phase = 'setup';

// ---- In the page. Everything below runs in ChatGPT's MAIN world; texts and keys stay there.
function pageHelpers() {
  if (window.__ticks) return;
  const scroller = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const root = () => document.querySelector('chatgpt-butter-nav')?.shadowRoot;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const order = () => {
    const s = scroller(), t = s?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const e = f.memoizedProps?.entries;
      if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) return e.map(x => x.turnKey);
    }
    return null;
  };
  const texts = new Map(); // turn key -> question text, as the bubbles showed it
  const remember = () => {
    for (const t of scroller().querySelectorAll('[data-turn-key]')) {
      const b = t.querySelector('[data-user-message-bubble]');
      if (b) texts.set(t.getAttribute('data-turn-key'), norm(b.textContent));
    }
  };
  window.__ticks = {
    order: () => order()?.length ?? null,
    scrollTop: () => scroller().scrollTop,
    edge(where) { const s = scroller(); s.scrollTop = where === 'top' ? 0 : s.scrollHeight; },
    geometry() { const s = scroller(); return { y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight, box: (r => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right }))(s.getBoundingClientRect()) }; },
    ticks() {
      const r = root();
      if (!r) return null;
      const ticks = [...r.querySelectorAll('.tick')];
      return ticks.map(b => { const x = b.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2, w: x.width, h: x.height }; });
    },
    more: () => { const m = root()?.querySelector('.more'); return m ? !m.hidden && m.getBoundingClientRect().height > 0 : null; },
    // The lit ticks (bar opacity), the rule's expected set, and which question covers the band's top.
    state() {
      remember();
      const s = scroller(), ids = order() || [];
      const r = root(), bars = r ? [...r.querySelectorAll('.tick > .bar')] : [];
      const op = bars.map(b => parseFloat(b.style.opacity));
      const lit = op.flatMap((o, j) => (o > 0.9 ? [j] : []));
      const box = s.getBoundingClientRect();
      const bandTop = box.top + 52 + 40, bandBottom = box.bottom - 140 - 40;
      const expected = [], mounted = [];
      let topIdx = null;
      for (const t of s.querySelectorAll('[data-turn-key]')) {
        const j = ids.indexOf(t.getAttribute('data-turn-key'));
        const b = t.getBoundingClientRect();
        if (b.height <= 0) continue;
        mounted.push(j);
        if (b.top < bandBottom && b.bottom > bandTop) expected.push(j);
        if (b.top <= bandTop && b.bottom > bandTop) topIdx = j;
      }
      expected.sort((a, b) => a - b);
      const mid = op.filter(o => o > 0.35 && o <= 0.9).length; // bars still easing
      return { y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight, lit, expected, topIdx, mounted, easing: mid, bars: bars.length,
        pinned: document.documentElement.hasAttribute('data-butter-pinned') };
    },
    // Where question j's turn is now: its top below the scroller's top, or null while unmounted.
    landing(j) {
      const s = scroller(), ids = order() || [], key = ids[j];
      const t = [...s.querySelectorAll('[data-turn-key]')].find(x => x.getAttribute('data-turn-key') === key);
      const b = t?.getBoundingClientRect();
      return { top: b && b.height > 0 ? b.top - s.getBoundingClientRect().top : null, y: s.scrollTop, max: s.scrollHeight - s.clientHeight };
    },
    // The card's text against question j's text (null: not seen in the wheel pass).
    card(j) {
      const r = root(), card = r?.querySelector('.card');
      const shown = !!card && card.classList.contains('show') && card.getBoundingClientRect().height > 0;
      const ct = norm(r?.querySelector('.card .text')?.textContent);
      const key = (order() || [])[j], q = key ? texts.get(key) : undefined;
      if (q == null) return { shown, cardLen: ct.length, known: false };
      const cut = ct.endsWith('…') ? ct.slice(0, -1).trim() : ct;
      const cmp = s => s.replace(/\s+/g, '');
      const match = cut.length > 0 && (cmp(cut) === cmp(q) || (ct.endsWith('…') && cmp(q).startsWith(cmp(cut))));
      // Which question's text the card does show, if not j's (an index, never the text).
      let shows = null;
      if (!match) for (const [k, v] of texts) if (cmp(v) === cmp(cut) || (ct.endsWith('…') && cmp(v).startsWith(cmp(cut)))) { shows = (order() || []).indexOf(k); break; }
      return { shown, known: true, match, cardLen: ct.length, qLen: q.length, shows };
    },
    focusTick(j) { root()?.querySelectorAll('.tick')[j]?.focus(); },
    focused() { const r = root(); const a = r?.activeElement; return a ? [...r.querySelectorAll('.tick')].indexOf(a) : null; },
    seen: () => texts.size,
  };
}

async function settleScroll(max = 8000) {
  const t0 = Date.now(); let last = await page.evaluate(() => window.__ticks.scrollTop()), still = Date.now();
  while (Date.now() - t0 < max) {
    await pause(100);
    const y = await page.evaluate(() => window.__ticks.scrollTop());
    if (Math.abs(y - last) > 1) { last = y; still = Date.now(); }
    else if (Date.now() - still >= 600) return true;
  }
  return false;
}
const offRail = async geo => { await page.mouse.move(Math.round((geo.box.left + geo.box.right) / 2 - 200), Math.round((geo.box.top + geo.box.bottom) / 2)); };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
async function shot(name) {
  if (env.SHOTS !== '1') return;
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `${name}.png`), clip: { x: 580, y: 0, width: 1019, height: 912 } }).catch(() => {});
}

async function openFixture(name) {
  await page.goto('about:blank');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(L.fixture(lab, name), { waitUntil: 'domcontentloaded', timeout: 90000 });
    try {
      await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 45000 });
      break;
    } catch {
      if (attempt) throw Error('ChatGPT did not load the chat twice');
      await pause(20000);
    }
  }
  await page.locator('.ProseMirror:visible').first().waitFor();
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(pageHelpers);
  await pause(6000);
  // All earlier history: scroll writes to the top until ChatGPT's turn list stops growing.
  let previous = -1, stable = 0;
  for (let n = 0; n < 25 && stable < 3; n++) {
    await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = 280; });
    await pause(30);
    await page.evaluate(() => window.__ticks.edge('top'));
    await pause(800);
    const n2 = await page.evaluate(() => window.__ticks.order());
    stable = n2 === previous ? stable + 1 : 0; previous = n2;
  }
  await pause(1500);
}

async function runFixture(name) {
  const fx = { name, samples: [], clicks: [], cards: [] };
  summary.fixtures[name] = fx;
  phase = `${name} open`;
  await openFixture(name);
  let geo = await page.evaluate(() => window.__ticks.geometry());
  await offRail(geo);

  // ---- count
  phase = `${name} count`;
  const questions = await page.evaluate(() => window.__ticks.order());
  let ticks = await page.evaluate(() => window.__ticks.ticks());
  const more = await page.evaluate(() => window.__ticks.more());
  fx.questions = questions; fx.ticks = ticks?.length ?? null; fx.more = more;
  report(`${name} questions=${questions} ticks=${ticks?.length ?? 'none'} threeDots=${more}`);
  verdict(ticks && questions && ticks.length === questions, `${name} count`, `${ticks?.length ?? 'no'} ticks for ${questions} questions in ChatGPT's turn list`);
  if (!ticks?.length || !questions) return;

  // ---- wheel from the top to the end
  phase = `${name} wheel`;
  await page.evaluate(() => window.__ticks.edge('top'));
  await settleScroll();
  geo = await page.evaluate(() => window.__ticks.geometry());
  const STEP = Number(env.STEP || Math.max(700, Math.round(geo.h / 120)));
  fx.step = STEP;
  await offRail(geo);
  let mism = 0, none = 0, topMiss = 0, back = 0, pageJumps = 0, steps = 0, judged = 0;
  const firstWhy = {};
  let prevFirst = -1, prevY = 0, stuck = 0, lastResume = -1, stoppedAt = null;
  for (; steps < 400; steps++) {
    await page.mouse.wheel(0, STEP);
    await pause(650);
    let st = await page.evaluate(() => window.__ticks.state());
    const bad = s => !same(s.lit, s.expected) || s.easing;
    if (bad(st)) { await pause(600); st = await page.evaluate(() => window.__ticks.state()); }
    const row = { step: steps + 1, y: Math.round(st.y), h: st.h, lit: st.lit, expected: st.expected, top: st.topIdx, mounted: st.mounted, easing: st.easing };
    fx.samples.push(row);
    if (st.y < prevY - st.vh) {
      // The page's own jump back (wheel-jump-live.mjs): put the chat back where the wheel had it
      // with one scroll write, so the pass still reaches the end, and start the order check over.
      pageJumps++; row.pageJump = true;
      stuck = Math.abs(prevY - lastResume) < 1 ? stuck + 1 : 0; lastResume = prevY;
      if (stuck >= 5) { report(`${name} wheel pass stopped at scrollTop ${Math.round(prevY)}: the chat jumped back after 5 resumes there in a row`); stoppedAt = Math.round(prevY); break; }
      if (pageJumps <= 3) report(`${name} page jump back at step ${row.step}: scrollTop ${Math.round(prevY)} → ${row.y} (lit [${st.lit}]); resumed at ${Math.round(prevY)}`);
      await page.evaluate(y => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = y; }, prevY);
      await pause(900);
      prevFirst = -1;
      continue;
    }
    else {
      judged++;
      if (!same(st.lit, st.expected)) { mism++; firstWhy.mism ??= `step ${row.step}: lit [${st.lit}], rule [${st.expected}], scrollTop ${row.y}`; }
      if (st.expected.length && !st.lit.length) { none++; firstWhy.none ??= `step ${row.step}: no tick lit, rule [${st.expected}]`; }
      if (st.topIdx != null && st.topIdx >= 0 && !st.lit.includes(st.topIdx)) { topMiss++; firstWhy.top ??= `step ${row.step}: question ${st.topIdx} covers the band's top, lit [${st.lit}]`; }
      const first = st.lit.length ? Math.min(...st.lit) : -1;
      if (first >= 0 && prevFirst >= 0 && first < prevFirst) { back++; firstWhy.back ??= `step ${row.step}: first lit ${prevFirst} → ${first}, scrollTop ${Math.round(prevY)} → ${row.y}`; }
      if (first >= 0) prevFirst = first;
      prevY = Math.max(prevY, st.y);
    }
    if (st.y + st.vh >= st.h - 2) break;
  }
  if (pageJumps > 3) report(`${name} ${pageJumps - 3} more page jumps back, each resumed the same way`);
  fx.wheel = { steps: steps + 1, judged, mism, none, topMiss, back, pageJumps, stoppedAt };
  report(`${name} wheel: ${steps + 1} steps of ${STEP} px, ${judged} judged, ${pageJumps} page jumps back, questions seen ${await page.evaluate(() => window.__ticks.seen())}/${questions}`);
  verdict(mism === 0, `${name} wheel-lit-matches`, `${mism}/${judged} samples differ from the lit band's rule; first ${firstWhy.mism}`);
  verdict(none === 0, `${name} wheel-never-none`, `${none} samples with no lit tick; first ${firstWhy.none}`);
  verdict(topMiss === 0, `${name} wheel-top-lit`, `${topMiss} samples where the question covering the band's top was not lit; first ${firstWhy.top}`);
  verdict(back === 0, `${name} wheel-monotonic`, `${back} times the first lit tick moved back while the page did not; first ${firstWhy.back}`);
  if (mism || none || topMiss || back) await shot(`${name}-wheel-end`);

  phase = `${name} clicks`;
  // ---- clicks (before the cards: every question mounts, so its text is known for the card check)
  ticks = await page.evaluate(() => window.__ticks.ticks());
  const n = ticks.length;
  const want = env.CLICKS && env.CLICKS !== 'all' ? Number(env.CLICKS) : n;
  // From the end of the chat, alternate far and near targets so every click travels.
  const order = want >= n ? [...Array(n).keys()].map((_, k) => (k % 2 ? Math.floor(k / 2) : n - 1 - Math.floor(k / 2))).filter((v, i, a) => a.indexOf(v) === i)
    : [...new Set([...Array(want).keys()].map(k => Math.round((k * (n - 1)) / Math.max(1, want - 1))))];
  const cnt = { lands: 0, lit: 0, only: 0, lit2: 0, only2: 0 }; const why = { lands: [], lit: [], only: [], lit2: [], only2: [] };
  for (const j of order) {
    ticks = await page.evaluate(() => window.__ticks.ticks());
    await page.mouse.move(Math.round(ticks[j].x), Math.round(ticks[j].y), { steps: 3 });
    await pause(200);
    await page.mouse.click(Math.round(ticks[j].x), Math.round(ticks[j].y));
    await pause(300);
    geo = await page.evaluate(() => window.__ticks.geometry());
    // Moving the pointer is not a scroll: the jump keeps its pin.
    await page.mouse.move(Math.round((geo.box.left + geo.box.right) / 2 - 200), Math.round(geo.box.top + 300), { steps: 2 });
    await settleScroll(10000);
    await pause(700);
    const land = await page.evaluate(k => window.__ticks.landing(k), j);
    const st = await page.evaluate(() => window.__ticks.state());
    await pause(2000);
    const st2 = await page.evaluate(() => window.__ticks.state());
    const land2 = await page.evaluate(k => window.__ticks.landing(k), j);
    const landed = land.top != null && (Math.abs(land.top - TOP_INSET) <= 32 || (land.y >= land.max - 2 && land.top >= TOP_INSET - 32));
    const extra = s => s.lit.filter(x => x !== j && !s.expected.includes(x));
    const rec = { j, top: land.top == null ? null : Math.round(land.top), y: Math.round(land.y), atEnd: land.y >= land.max - 2, lit: st.lit, expected: st.expected, pinned: st.pinned, lit2: st2.lit, expected2: st2.expected, top2: land2.top == null ? null : Math.round(land2.top), pinned2: st2.pinned };
    fx.clicks.push(rec);
    if (!landed) { cnt.lands++; why.lands.push(`tick ${j}: its question's top at ${rec.top ?? 'unmounted'} px (want ${TOP_INSET}±32), scrollTop ${rec.y}`); await shot(`${name}-click-${j}-lands`); }
    if (!st.lit.includes(j)) { cnt.lit++; why.lit.push(`tick ${j}: lit [${st.lit}]`); await shot(`${name}-click-${j}-lit`); }
    if (extra(st).length) { cnt.only++; why.only.push(`tick ${j}: also lit [${extra(st)}] outside the band (rule [${st.expected}])`); }
    if (!st2.lit.includes(j)) { cnt.lit2++; why.lit2.push(`tick ${j}: lit [${st2.lit}] 2 s later, its top ${rec.top2 ?? 'unmounted'}`); }
    if (extra(st2).length) { cnt.only2++; why.only2.push(`tick ${j}: also lit [${extra(st2)}] 2 s later (rule [${st2.expected}])`); }
    if (st.lit.length > 1) report(`${name} click ${j}: ${st.lit.length} ticks lit [${st.lit}], rule [${st.expected}]`);
  }
  report(`${name} clicks: ${order.length} ticks clicked`);
  verdict(!cnt.lands, `${name} click-lands`, `${cnt.lands}/${order.length}; ${why.lands.slice(0, 4).join('; ')}`);
  verdict(!cnt.lit, `${name} click-lit`, `${cnt.lit}/${order.length}; ${why.lit.slice(0, 4).join('; ')}`);
  verdict(!cnt.only, `${name} click-only`, `${cnt.only}/${order.length}; ${why.only.slice(0, 4).join('; ')}`);
  verdict(!cnt.lit2, `${name} click-lit-2s`, `${cnt.lit2}/${order.length}; ${why.lit2.slice(0, 4).join('; ')}`);
  verdict(!cnt.only2, `${name} click-only-2s`, `${cnt.only2}/${order.length}; ${why.only2.slice(0, 4).join('; ')}`);

  // ---- hover cards
  phase = `${name} cards`;
  ticks = await page.evaluate(() => window.__ticks.ticks());
  let cardBad = 0, unknown = 0, notShown = 0; const cardWhy = [];
  for (let j = 0; j < ticks.length; j++) {
    await page.mouse.move(Math.round(ticks[j].x), Math.round(ticks[j].y), { steps: 3 });
    await pause(350);
    const c = await page.evaluate(k => window.__ticks.card(k), j);
    fx.cards.push({ j, ...c });
    if (!c.shown) { notShown++; cardWhy.push(`tick ${j}: no card shown`); }
    else if (!c.known) unknown++;
    else if (!c.match) { cardBad++; cardWhy.push(`tick ${j}: card text (${c.cardLen} chars) is not question ${j}'s (${c.qLen} chars)${c.shows != null ? `; it is question ${c.shows}'s` : ''}`); }
  }
  if (unknown) report(`${name} card-text: ${unknown} ticks whose question the wheel pass never mounted (not judged)`);
  verdict(cardBad === 0 && notShown === 0, `${name} card-text`, cardWhy.slice(0, 4).join('; '));
  geo = await page.evaluate(() => window.__ticks.geometry());
  await offRail(geo); await pause(700);

  phase = `${name} keys`;
  // ---- keyboard: focus tick a, ArrowDown to a+1 (its card), Enter jumps there.
  const a = Math.max(0, Math.floor(n / 2) - 1);
  await page.evaluate(k => window.__ticks.focusTick(k), a);
  await pause(300);
  await page.keyboard.press('ArrowDown');
  await pause(400);
  const foc = await page.evaluate(() => window.__ticks.focused());
  const kc = await page.evaluate(k => window.__ticks.card(k), a + 1);
  fx.keys = { from: a, focused: foc, card: kc };
  verdict(foc === a + 1 && kc.shown && (kc.match || !kc.known), `${name} keys-arrow`, `ArrowDown from tick ${a}: focus on ${foc}, card shown ${kc.shown}, matches question ${a + 1}: ${kc.known ? kc.match : 'not judged'}`);
  await page.keyboard.press('Enter');
  await pause(300);
  await settleScroll(10000);
  await pause(700);
  const kl = await page.evaluate(k => window.__ticks.landing(k), a + 1);
  const ks = await page.evaluate(() => window.__ticks.state());
  fx.keys.land = { top: kl.top, lit: ks.lit, expected: ks.expected };
  const kOk = kl.top != null && (Math.abs(kl.top - TOP_INSET) <= 32 || (kl.y >= kl.max - 2 && kl.top >= TOP_INSET - 32)) && ks.lit.includes(a + 1);
  verdict(kOk, `${name} keys-enter`, `Enter on tick ${a + 1}: its question's top at ${kl.top == null ? 'unmounted' : Math.round(kl.top)} px, lit [${ks.lit}]`);
  await page.evaluate(() => document.activeElement?.blur?.());
}

let code = 0;
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2000);
  ({ browser, context } = await L.connect(lab));
  await L.sendGuard(context, lab);
  await context.route('**/*', route => {
    const req = route.request(), u = new URL(req.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) {
      summary.guard.blockedMutations++;
      if (/^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname)) {
        summary.guard.sendAttempts++;
        report(`guard blocked ${req.method()} ${u.pathname} during ${phase}`);
      }
    }
    return route.fallback();
  });
  page = context.pages()[0] || await context.newPage();
  for (const other of context.pages()) if (other !== page) await other.close();
  await page.bringToFront();
  summary.chromium = browser.version();
  for (const name of fixtures) {
    try { await runFixture(name); }
    catch (e) { verdict(false, `${name} setup`, String(e.message).replace(/https?:\/\/\S+/g, '<url>').slice(0, 200)); code = 2; }
  }
  report(`guard sendAttempts=${summary.guard.sendAttempts} blockedMutations=${summary.guard.blockedMutations}`);
  await browser.close();
} catch (e) {
  console.log(`HARNESS ERROR ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').slice(0, 300)}`);
  code = 2;
} finally {
  summary.lines = lines;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(summary, null, 1));
  if (!borrowed) {
    try { await L.restore(lab); summary.cleanup.restored = true; } catch (e) { console.log(`REPORT restore failed: ${e.message}`); }
    try { L.release(lab); } catch (e) { console.log(`REPORT release failed: ${e.message}`); }
  }
}
const exit = code || (fails ? 1 : 0);
console.log(`SUMMARY ${label}: ${fails} FAIL${fails === 1 ? '' : 's'}`);
console.log(`EXIT ${exit}`);
process.exit(exit);
