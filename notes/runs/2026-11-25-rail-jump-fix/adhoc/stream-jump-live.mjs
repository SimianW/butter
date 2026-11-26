// Stage 3b of #171, adhoc: a rail jump to an earlier question while a replayed answer streams.
// Built from lab/harness/stream-replay-live.mjs (its fetch-hook replay, self-test, send guard,
// WebSockets closed, service worker bypassed, server-unchanged check), plus one step: while the
// replay streams and the chat follows its end, a trusted click on the rail tick of question TO
// (default 1), then scrollTop sampled every 100 ms.
//   (ii)  PASS stream-jump-stays when the chat reached the question (its turn's top within 48 px of
//         the rail's 64 px landing line) and was never within one viewport of the end afterwards,
//         from the click until BACK_MS after it, or (BACK_MS unset) until 3 s after completion.
//   (iii) then real wheel notches down to the end; REPORT whether the chat follows the end while
//         more growth arrives ("not established" when the stream completed before the end was
//         reached).
// Run from the repo root on a lock you hold:
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked dir> [FIXTURE=math9] [TO=1] [JUMP_AT=12000] [BACK_MS=<ms>]
//   [REC=<recording>] [OUT=<json>] node notes/runs/2026-11-25-rail-jump-fix/adhoc/stream-jump-live.mjs
// OPTS is fixed to {"rail":true} and put back as found. Logs hold indices, pixels and ms only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { prepareOpts, putBack } from '../../../../lab/harness/stream-run-opts.mjs';

const L = await import(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs'));
const env = process.env;
const FIXTURE = env.FIXTURE || 'math9', TO = Number(env.TO ?? 1), JUMP_AT = Number(env.JUMP_AT ?? 12000);
const BACK_MS = env.BACK_MS ? Number(env.BACK_MS) : null;
const REC = env.REC || path.join(os.homedir(), 'Dev/butter/lab/harness/recordings/en-t09.json');
const out = env.OUT || path.join(L.root(), 'captures/2026-11-25-rail-jump-fix', `stream-jump-${Date.now()}.json`);
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);

if (!env.LAB_OWNER) { console.error('LAB_OWNER= must name the lab lock you hold'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}, not ${env.LAB_OWNER}`); process.exit(2); }
if (!env.EXT) { console.error('EXT=<unpacked Butter dir> is required'); process.exit(2); }

const rec = JSON.parse(fs.readFileSync(REC));
const s0 = rec.streams.find(x => /\/f\/conversation/.test(x.url));
const reqBody = JSON.parse(s0.reqBody);
const schedule = []; { let t = 300, prev = s0.chunks[0][0]; for (const [ct, txt] of s0.chunks) { t += Math.min(1500, ct - prev); prev = ct; schedule.push([Math.round(t), txt]); } }
const REPLAY = { inputId: reqBody.messages[0].id, convId: reqBody.conversation_id, schedule };
const summary = { at: new Date().toISOString(), lab: lab.id, fixture: FIXTURE, to: TO, jumpAt: JUMP_AT, backMs: BACK_MS, chunks: schedule.length, net: { blocked: 0, escapes: 0, wsClosed: 0 } };
const save = () => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(summary, null, 1)); };

// ---- in the page, before ChatGPT's scripts (stream-replay-live.mjs's hook, without the rAF part) ----
function replayHook(R) {
  if (window.__replay) return;
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const st = window.__replay = { done: false, started: 0, chunksSent: 0, denied: [], local: [] };
  const native = window.fetch;
  const LOCAL = ['/backend-api/conversation/init', '/backend-api/f/conversation/prepare', '/backend-api/sentinel/chat-requirements/prepare', '/backend-api/sentinel/chat-requirements', '/__replay_selftest'];
  const hook = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const u = new URL(url, location.href);
    if (['GET', 'HEAD', 'OPTIONS'].includes(method) || !(u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) return native.apply(this, arguments);
    if (LOCAL.includes(u.pathname)) {
      st.local.push(u.pathname);
      const body = u.pathname.includes('sentinel') ? { token: 'local-replay-only', persona: 'chatgpt-paid', proofofwork: { required: false }, turnstile: { required: false }, arkose: { required: false } }
        : u.pathname === '/__replay_selftest' ? { replay: 'local' } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (method === 'POST' && /^\/backend-api\/f\/conversation$/.test(u.pathname) && !st.started) {
      const raw = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : String(init?.body ?? '');
      const body = JSON.parse(raw);
      const map = new Map([[R.inputId, body.messages?.[0]?.id ?? null], [R.convId, body.conversation_id]]);
      const remap = txt => txt.replace(UUID, x => map.has(x) ? map.get(x) : (map.set(x, crypto.randomUUID()), map.get(x)));
      st.started = performance.now();
      const enc = new TextEncoder();
      const stream = new ReadableStream({ async start(c) {
        const t0 = performance.now();
        for (const [at, txt] of R.schedule) {
          const wait = at - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
          c.enqueue(enc.encode(remap(txt))); st.chunksSent++; st.lastChunkAt = performance.now();
        }
        c.close(); st.done = true; st.endedAt = performance.now();
      } });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    }
    st.denied.push({ method, path: u.pathname });
    throw new TypeError('replay harness: non-GET request denied locally');
  };
  window.fetch = hook;
}

function helpers() {
  if (window.__sj) return;
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const order = () => {
    const t = sc()?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const e = f.memoizedProps?.entries;
      if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) return e.map(x => x.turnKey);
    }
    return null;
  };
  // ChatGPT's end pin (rail-jump-live-page.mjs's pin()): null unless exactly one {bottom, top} ref.
  const pin = () => {
    const s = sc();
    let f = s && s[Object.keys(s).find(k => k.startsWith('__reactFiber$'))];
    for (let depth = 0; f && depth < 80; depth++, f = f.return) {
      const found = [];
      for (let h = f.memoizedState, i = 0; h && typeof h === 'object' && 'next' in h && i < 400; h = h.next, i++) {
        const v = h.memoizedState, c = v && typeof v === 'object' && 'current' in v ? v.current : null;
        if (c && typeof c === 'object' && typeof c.bottom === 'boolean' && typeof c.top === 'boolean' && Object.keys(c).length === 2) found.push(c.bottom);
      }
      if (found.length) return found.length === 1 ? found[0] : null;
    }
    return null;
  };
  window.__sj = {
    toEnd() { const s = sc(); s.scrollTop = s.scrollHeight; return s.scrollTop; },
    entries: () => order()?.length ?? null,
    // One sample: geometry, the target question's top relative to the scroller, the question at the
    // view's top (ordinal), stream state.
    sample(to) {
      const s = sc(); if (!s) return null;
      const ids = order() || [], top0 = s.getBoundingClientRect().top;
      const turns = [...s.querySelectorAll('[data-turn-key]')];
      const tgt = turns.find(el => el.dataset.turnKey === ids[to]);
      let atTop = null;
      for (const el of turns) { const r = el.getBoundingClientRect(); if (r.bottom > top0 + 64 && r.top <= top0 + 64) { atTop = ids.indexOf(el.dataset.turnKey); break; } }
      const R = window.__replay;
      return { t: performance.now(), y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight, fromEnd: Math.round(s.scrollHeight - s.clientHeight - s.scrollTop),
        targetTop: tgt ? Math.round(tgt.getBoundingClientRect().top - top0) : null, atTop, entries: ids.length,
        inProgress: s.querySelectorAll('[data-talvt-turn-state="in_progress"]').length, chunks: R?.chunksSent ?? 0, done: !!R?.done, started: !!R?.started };
    },
    pin,
    box() { const r = sc().getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; },
  };
}

let browser, context, page, optSaved = null, extId = null, exit = 0;
const slim = s => s && { y: s.y, h: s.h, fromEnd: s.fromEnd, targetTop: s.targetTop, atTop: s.atTop, chunks: s.chunks, inProgress: s.inProgress, done: s.done };
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  ({ browser, context } = await L.connect(lab));
  const guard = await L.sendGuard(context, lab);
  if (typeof guard !== 'function') throw Error('send guard not installed');
  await context.route('**/*', route => {
    const r = route.request(), u = new URL(r.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) summary.net.blocked++;
    return route.fallback();
  });
  await context.routeWebSocket(/.*/, ws => { summary.net.wsClosed++; ws.close(); });
  context.on('request', r => { if (r.method() === 'POST' && /\/backend-api\/f\/conversation(?:\?|$)/.test(r.url())) summary.net.escapes++; });
  const extDir = L.browserArgs(lab)?.extensions[0] || null;
  if (!extDir) throw Error('the browser has no extension loaded');
  page = context.pages().find(p => new URL(p.url()).hostname === 'chatgpt.com') || context.pages()[0] || await context.newPage();
  for (const o of context.pages()) if (o !== page) await o.close();
  extId = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
  const po = await prepareOpts(context, extId, '{"rail":true}', summary); optSaved = po.saved; report(po.line);
  const w = await context.newPage();
  await w.goto(`chrome-extension://${extId}/popup/popup.html`);
  summary.build = await w.evaluate(() => chrome.runtime.getManifest().version_name);
  await w.close();
  report(`build ${summary.build}, fixture ${FIXTURE}, ${schedule.length} chunks over ${(schedule.at(-1)[0] / 1000).toFixed(0)} s, jump to question ${TO} at ${JUMP_AT} ms, back ${BACK_MS ?? 'after completion + 3 s'}`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await page.addInitScript(replayHook, REPLAY);
  await page.bringToFront();

  // ---- open, go to the end ----
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(helpers);
  await pause(9000);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__sj.toEnd()); await pause(700); }
  await pause(1500);
  const entries0 = await page.evaluate(() => window.__sj.entries());
  const ticks0 = await page.locator('chatgpt-butter-nav .tick').count();
  const g0 = await page.evaluate(to => window.__sj.sample(to), TO);
  report(`opened: scrollTop ${g0.y} of ${g0.h} (fromEnd ${g0.fromEnd}), entries ${entries0}, rail ticks ${ticks0}, pin ${await page.evaluate(() => window.__sj.pin())}`);
  if (ticks0 <= TO) throw Error(`rail has ${ticks0} ticks, no tick ${TO}`);

  // ---- type, self-test the hook, Enter ----
  const ed = page.locator('.ProseMirror:visible').first();
  await ed.click();
  await page.keyboard.type('Replay check', { delay: 60 });
  await pause(800);
  const self = await page.evaluate(async () => { try { const r = await fetch('/__replay_selftest', { method: 'POST', body: '{}' }); return (await r.json()).replay; } catch { return 'threw'; } });
  verdict(self === 'local', 'replay-hook', `self-test POST answered ${JSON.stringify(self)}, not by the hook`);
  if (self !== 'local') throw Error('replay hook not in the fetch chain; nothing pressed');
  await page.keyboard.press('Enter');
  const t0 = Date.now(), total = schedule.at(-1)[0];
  const pre = [];
  // Wait for the stream to start and the chat to follow its end; jump no earlier than JUMP_AT.
  for (;;) {
    const s = await page.evaluate(to => window.__sj.sample(to), TO);
    pre.push({ ...slim(s), el: Date.now() - t0 });
    // ChatGPT may not follow the end while streaming (b3-stream.log: the new question stays at the
    // top); jump once the answer streams and JUMP_AT has passed, and report where the chat was.
    const streaming = pre.slice(-3).every(x => x.inProgress > 0);
    if (Date.now() - t0 >= JUMP_AT && streaming) break;
    if (Date.now() - t0 > JUMP_AT + 30000) throw Error(`not streaming by ${JUMP_AT + 30000} ms: last ${JSON.stringify(slim(s))}`);
    await pause(200);
  }
  summary.pre = pre;
  const atEndPre = pre.filter(x => x.inProgress > 0);
  report(`before the jump: ${atEndPre.length} streaming samples, at the end (within 4 px) in ${atEndPre.filter(x => x.fromEnd <= 4).length}; pin ${await page.evaluate(() => window.__sj.pin())}`);

  // ---- (ii) trusted click on tick TO ----
  const tick = page.locator('chatgpt-butter-nav .tick').nth(TO);
  const tb = await tick.boundingBox();
  if (!tb) throw Error('target tick has no box');
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await pause(150);
  const c0 = await page.evaluate(to => window.__sj.sample(to), TO);
  const clickAt = Date.now();
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
  report(`jump: clicked tick ${TO} at ${clickAt - t0} ms after Enter, chunks ${c0.chunks}/${schedule.length}, scrollTop ${c0.y} of ${c0.h} (fromEnd ${c0.fromEnd})`);
  // Move the pointer off the rail into the chat (no wheel).
  const box = await page.evaluate(() => window.__sj.box());
  const cx = Math.round((box.left + box.right) / 2 - 150), cy = Math.round((box.top + box.bottom) / 2);
  await page.mouse.move(cx, cy);
  const S = []; let doneAt = null, pinAfter = null;
  for (;;) {
    const s = await page.evaluate(to => window.__sj.sample(to), TO);
    const el = Date.now() - clickAt;
    S.push({ ...slim(s), vh: s.vh, el });
    if (pinAfter == null && el > 2000) pinAfter = await page.evaluate(() => window.__sj.pin());
    if (s.done && !s.inProgress && doneAt == null) doneAt = Date.now();
    if (BACK_MS != null ? el >= BACK_MS : doneAt != null && Date.now() - doneAt >= 3000) break;
    if (Date.now() - t0 > total + 60000) { report('replay did not finish in time'); break; }
    await pause(100);
  }
  summary.jump = { c0: slim(c0), samples: S };
  const reachIdx = S.findIndex(x => x.targetTop != null && Math.abs(x.targetTop - 64) <= 48);
  const backs = reachIdx < 0 ? [] : S.slice(reachIdx).filter(x => x.fromEnd <= x.vh);
  const last = S.at(-1);
  if (reachIdx < 0) verdict(false, 'stream-jump-stays', `never reached question ${TO} in ${S.length} samples (closest targetTop ${Math.min(...S.filter(x => x.targetTop != null).map(x => Math.abs(x.targetTop - 64)))} px from the landing line; final scrollTop ${last.y}, fromEnd ${last.fromEnd})`);
  else verdict(backs.length === 0, 'stream-jump-stays', `back within one viewport of the end ${backs.length} times after reaching the question, first at ${backs[0]?.el} ms (scrollTop ${backs[0]?.y}, fromEnd ${backs[0]?.fromEnd})`);
  report(`jump reached question ${TO} at ${reachIdx < 0 ? 'never' : `${S[reachIdx].el} ms (targetTop ${S[reachIdx].targetTop})`}; samples ${S.length} over ${last.el} ms; min fromEnd after reaching ${reachIdx < 0 ? '-' : Math.min(...S.slice(reachIdx).map(x => x.fromEnd))}; pin 2 s after the click ${pinAfter}`);
  const comp = doneAt != null ? S.find(x => x.done && !x.inProgress) : null;
  report(`at completion: ${comp ? `scrollTop ${comp.y} of ${comp.h}, fromEnd ${comp.fromEnd}, question at the view's top ${comp.atTop}, target top ${comp.targetTop}` : 'not reached in this window'}; window end: scrollTop ${last.y} of ${last.h}, fromEnd ${last.fromEnd}, question at top ${last.atTop}, target top ${last.targetTop}`);
  const reached = reachIdx < 0 ? S[0] : S[reachIdx];
  report(`growth after the jump: chunks ${c0.chunks} → ${last.chunks} (of ${schedule.length}), scrollHeight at click ${c0.h}, at reaching ${reached.h}, at window end ${last.h} (+${last.h - reached.h} px after reaching); in_progress at window end ${last.inProgress}`);

  // ---- (iii) real wheel back to the end, then does it follow? ----
  await page.mouse.move(cx, cy);
  let steps = 0, g = await page.evaluate(to => window.__sj.sample(to), TO);
  while (g.fromEnd > 4 && steps < 160) { await page.mouse.wheel(0, 2400); steps++; await pause(120); g = await page.evaluate(to => window.__sj.sample(to), TO); }
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 300); await pause(150); }
  g = await page.evaluate(to => window.__sj.sample(to), TO);
  const backAt = Date.now();
  report(`wheel back: ${steps} notches of 2400 px + 3 of 300 px, now fromEnd ${g.fromEnd}, chunks ${g.chunks}/${schedule.length}, done ${g.done}, in_progress ${g.inProgress}, pin ${await page.evaluate(() => window.__sj.pin())}`);
  if (g.done && !g.inProgress) report('stream-back-follows: not established (the stream completed before the wheel reached the end)');
  else {
    const B = []; let done2 = null;
    for (;;) {
      const s = await page.evaluate(to => window.__sj.sample(to), TO);
      B.push({ ...slim(s), el: Date.now() - backAt });
      if (s.done && !s.inProgress && done2 == null) done2 = Date.now();
      if (done2 != null && Date.now() - done2 >= 3000) break;
      if (Date.now() - t0 > total + 60000) break;
      await pause(100);
    }
    summary.back = B;
    const grow = B.at(-1).h - B[0].h, ch = B.at(-1).chunks - B[0].chunks;
    const streaming = B.filter(x => x.inProgress > 0), atEnd = streaming.filter(x => x.fromEnd <= 4).length;
    const away = B.filter(x => x.fromEnd > x.vh).length;
    if (ch === 0 || grow <= 0) report(`stream-back-follows: not established (growth after reaching the end: ${ch} chunks, ${grow} px)`);
    else report(`stream-back-follows: ${atEnd === streaming.length && B.at(-1).fromEnd <= 4 ? 'yes' : 'no'}: ${ch} chunks and +${grow} px of growth after reaching the end; at the end (within 4 px) in ${atEnd}/${streaming.length} streaming samples, fromEnd max ${Math.max(...B.map(x => x.fromEnd))}, more than a viewport away in ${away} samples; at completion + 3 s fromEnd ${B.at(-1).fromEnd}`);
  }
  await ed.click().catch(() => {}); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');

  const denied = await page.evaluate(() => window.__replay.denied.length);
  verdict(summary.net.escapes === 0, 'no-escape', `${summary.net.escapes} POST /backend-api/f/conversation reached the network layer (the guard aborted them)`);
  report(`network: guard-blocked non-GET ${summary.net.blocked}, WebSockets closed ${summary.net.wsClosed}, denied in page ${denied}`);

  // ---- server unchanged: a fresh load, 20 s after the last ----
  await page.goto('about:blank');
  await pause(20000);
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.evaluate(helpers);
  await pause(6000);
  const entries1 = await page.evaluate(() => window.__sj.entries());
  verdict(entries1 === entries0, 'server-unchanged', `ChatGPT's turn list has ${entries1} entries after a reload, ${entries0} before`);
  report(`server turns: ${entries0} before, ${entries1} after a reload`);
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally {
  if (optSaved) report(await putBack(context, extId, optSaved, summary));
  save();
  await browser?.close().catch(() => {});
}
console.log(`SUMMARY stream-jump: ${fails} FAIL${fails === 1 ? '' : 's'}`);
console.log(`EXIT ${exit || (fails ? 1 : 0)}`);
process.exit(exit || (fails ? 1 : 0));
