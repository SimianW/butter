// Streaming on live ChatGPT without sending (2026-11-18 live features). A recorded answer is replayed
// into a live lab fixture through an in-page fetch hook (bench.mjs's hook, adapted): nothing reaches
// OpenAI. Run only while you hold the lab lock: LAB_OWNER names it (this script never takes one).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked dir or empty> LABEL=<name> [FIXTURE=math9]
//   [REC=~/Dev/butter/lab/harness/recordings/en-t09.json] [OUT=<json>] [NOSEND=1] [PROBE=1]
//   [PHASES=stream] [OPTS=<settings json>] [TRACE_AT=<ms>] [TRACE_SPAN=<ms>] [TRACE_CATS=<a,b>] [APIPROBE=1] [TAIL_MS=5000] [VEILPROBE=1] node lab/harness/stream-replay-live.mjs
// PHASES=stream skips the wheel phase; OPTS sets Butter's options, put back as found at the end; TRACE_AT
// traces TRACE_SPAN ms (10 s) around it, with the extra categories in TRACE_CATS; APIPROBE=1 times layout-dependent DOM calls from 100 s on (stream-api-probe.mjs);
// TAIL_MS (5000 or more) keeps observing after completion, VEILPROBE=1 hit-tests veiled blocks while wheeling (stream-veil-probe.mjs); UX=u1,u2,u3,u4 probes the view around completion (stream-ux-probe.mjs).
//
// Safety, in three layers: the lab's send guard (aborts every non-GET request to chatgpt.com) on
// the connection, every WebSocket closed, the service worker bypassed; in the page, the hook answers
// the replay POST and ChatGPT's preparation POSTs locally and throws on every other non-GET fetch to
// chatgpt.com (recorded as a denial). Before Enter the hook is self-tested with a POST to a path the
// hook answers; if that answer does not come back, nothing is pressed (exit 2). Any POST to
// /backend-api/f/conversation the network layer sees is an escape (FAIL; the guard aborted it).
// NOSEND=1 stops after the composer/button probe, before Enter. PROBE=1 installs
// rail-jump-scroll-probe.mjs (MAIN before page scripts, Butter's world before the wheel phase) and
// reports the wrapped scroll writes during the wheel-up phase, by world and by top stack frame.
//
// Checks (verdict lines): replay-hook, replay-streams, in-progress, cv-blocks (Butter),
// seen-marks (Butter), throttle-matched (Butter), stream-no-jump, wheel-no-jump, rail-new-tick,
// rail-new-tick-lit (Butter), veil-none-rendered, veil-effective (judged only when blocks were veiled
// before completion; stream-veil-verdicts.mjs), no-escape, server-unchanged. REPORT lines: buttons, pre-jump
// condition, publish intervals, smoother callback sources, view shifts, follow-the-end samples,
// long animation frames to 5 s past stream complete, per frame (stream-laf-probe/-report.mjs).
// No chat text leaves the page; button labels are ChatGPT's UI strings.
// Exit 1: any FAIL. Exit 2: setup error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { installScrollProbe } from './rail-jump-scroll-probe.mjs';
import { startLaf, tailWindow, lafReport } from './stream-laf-report.mjs';
import { prepareOpts, putBack } from './stream-run-opts.mjs';
import { streamWindows } from './stream-api-probe.mjs';
import { veilProbe } from './stream-veil-probe.mjs';
import { uxProbe, isStreamDrop } from './stream-ux-probe.mjs';
import { veilVerdicts } from './stream-veil-verdicts.mjs';
import { median, q, intervals, shiftStats, fmtShift } from './stream-shift.mjs';

const env = process.env;
const label = env.LABEL || 'replay';
const FIXTURE = env.FIXTURE || 'math9';
const REC = env.REC || path.join(os.homedir(), 'Dev/butter/lab/harness/recordings/en-t09.json');
const out = env.OUT || path.join(L.root(), 'captures/2026-11-18-live-features', `replay-${label}.json`);
const GAP_CAP = 1500, STEP_PX = 700, STEP_WAIT = 140;
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);
const template = p => p.replace(/(\/oneshot)\/.*/, '$1/<id>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>').replace(/(?<=\/)[A-Za-z0-9_-]{20,}(?=\/|$)/g, '<id>');

if (!env.LAB_OWNER) { console.error('LAB_OWNER= must name the lab lock you hold'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}, not ${env.LAB_OWNER}`); process.exit(2); }

// ---- recording -> replay schedule (bench.mjs) ----
const rec = JSON.parse(fs.readFileSync(REC));
const s0 = rec.streams.find(x => /\/f\/conversation/.test(x.url));
const reqBody = JSON.parse(s0.reqBody);
const schedule = []; { let t = 300, prev = s0.chunks[0][0]; for (const [ct, txt] of s0.chunks) { t += Math.min(GAP_CAP, ct - prev); prev = ct; schedule.push([Math.round(t), txt]); } }
const REPLAY = { inputId: reqBody.messages[0].id, convId: reqBody.conversation_id, schedule };

const summary = { label, at: new Date().toISOString(), lab: lab.id, fixture: FIXTURE, chunks: schedule.length, net: { blocked: [], escapes: 0, wsClosed: 0 } };
const save = () => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(summary, null, 1)); };

// ---- in the page, before ChatGPT's scripts ----
function replayHook(R) {
  if (window.__replay) return;
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const st = window.__replay = { done: false, started: 0, chunksSent: 0, denied: [], local: [], order: null };
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
      st.localInputId = body.messages?.[0]?.id ?? null;
      st.reqKeys = Object.keys(body);
      const map = new Map([[R.inputId, st.localInputId], [R.convId, body.conversation_id]]);
      const remap = txt => txt.replace(UUID, x => map.has(x) ? map.get(x) : (map.set(x, crypto.randomUUID()), map.get(x)));
      st.started = performance.now();
      const enc = new TextEncoder();
      const stream = new ReadableStream({ async start(c) {
        const t0 = performance.now();
        for (const [at, txt] of R.schedule) {
          const wait = at - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
          c.enqueue(enc.encode(remap(txt))); st.chunksSent++; st.lastChunkAt = performance.now(); st.firstChunkAt ??= st.lastChunkAt;
        }
        c.close(); st.done = true; st.endedAt = performance.now();
      } });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    }
    st.denied.push({ method, path: u.pathname });
    throw new TypeError('replay harness: non-GET request denied locally');
  };
  window.fetch = hook;
  st.hook = hook;

  // Which requestAnimationFrame callbacks look like ChatGPT's stream smoother, natively.
  const SMOOTHER = /^\(\)\s*=>\s*\{\s*this\.frame\s*=\s*void 0\s*,\s*this\.publish\(\)\s*;?\s*\}$/;
  const raf = window.requestAnimationFrame, fts = Function.prototype.toString;
  const R2 = window.__rafSeen = { exact: 0, exactTimes: [], publishLike: new Map(), total: 0 };
  window.requestAnimationFrame = function requestAnimationFrame(cb) {
    R2.total++;
    if (typeof cb === 'function') {
      let src = ''; try { src = fts.call(cb); } catch {}
      if (SMOOTHER.test(src)) { R2.exact++; if (R2.exactTimes.length < 5000) R2.exactTimes.push(performance.now()); }
      else if (/publish|flush/.test(src) && src.length < 300) R2.publishLike.set(src, (R2.publishLike.get(src) || 0) + 1);
    }
    return raf.call(window, cb);
  };
  st.rafHook = window.requestAnimationFrame;
}

function helpers() {
  if (window.__rp) return;
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const root = () => document.querySelector('chatgpt-butter-nav')?.shadowRoot;
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const order = () => {
    const t = sc()?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const e = f.memoizedProps?.entries;
      if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) return e.map(x => x.turnKey);
    }
    return null;
  };
  const attrNames = el => [...el.attributes].map(a => a.name).filter(n => n.startsWith('data-'));
  const SEL = {
    'pre-jump SEND_BUTTON': '[data-testid="send-button"], #composer-submit-button, button[type="submit"]',
    'branch SEND (testid + aria-labels)': ['[data-testid="send-button"]', ...['Send prompt', 'Send', 'Send message', '发送', '发送提示', '发送消息'].map(n => `button[aria-label="${n}"]`)].join(', '),
    'branch structural button[type=submit]': 'button[type="submit"]',
    '[data-testid="send-button"]': '[data-testid="send-button"]',
    '#composer-submit-button': '#composer-submit-button',
    '[data-testid="stop-button"]': '[data-testid="stop-button"]',
  };
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  window.__rp = {
    order: () => order()?.length ?? null,
    geo() { const s = sc(); if (!s) return null; const r = s.getBoundingClientRect(); return { y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight, fromEnd: Math.round(s.scrollHeight - s.clientHeight - s.scrollTop), box: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } }; },
    toEnd() { const s = sc(); s.scrollTop = s.scrollHeight; return s.scrollTop; },
    // Buttons in the composer's form (and stop-ish buttons anywhere): structure only.
    buttons() {
      const ed = document.querySelector('.ProseMirror[contenteditable="true"]');
      const form = ed?.closest('form');
      const list = [...(form?.querySelectorAll('button') || [])].filter(visible);
      const extra = [...document.querySelectorAll('button[aria-label*="top" i], button[aria-label*="停止"]')].filter(b => visible(b) && !list.includes(b));
      const desc = b => ({
        tag: b.tagName.toLowerCase(), id: b.id || null, type: b.getAttribute('type'), aria: b.getAttribute('aria-label'), data: attrNames(b),
        disabled: b.disabled || b.getAttribute('aria-disabled') === 'true', inForm: !!form?.contains(b),
        icons: [...b.querySelectorAll('use')].map(u => (u.getAttribute('href') || '').replace(/^.*#/, '#')).slice(0, 3),
        match: Object.entries(SEL).filter(([, q]) => b.matches(q)).map(([k]) => k),
        rightmost: false, x: Math.round(b.getBoundingClientRect().right),
      });
      const all = [...list, ...extra].map(desc);
      const maxX = Math.max(...all.filter(b => b.inForm).map(b => b.x), -1);
      for (const b of all) b.rightmost = b.inForm && b.x === maxX;
      const counts = Object.fromEntries(Object.entries(SEL).map(([k, q]) => [k, document.querySelectorAll(q).length]));
      // pre-jump.js's keydown condition: the composer's form has a SEND_BUTTON that is not disabled.
      const pj = form?.querySelector(SEL['pre-jump SEND_BUTTON']);
      return { composerLen: (ed?.textContent || '').length, buttons: all, counts, preJumpButton: !!pj, preJumpWouldFire: !!pj && !pj.disabled && pj.getAttribute('aria-disabled') !== 'true' };
    },
    // The streaming (or last) turn and its blocks.
    stream() {
      const s = sc(); if (!s) return null;
      const inprog = s.querySelectorAll('[data-talvt-turn-state="in_progress"]');
      const turns = [...s.querySelectorAll('[data-turn-key]')];
      const turn = inprog[0]?.closest('[data-turn-key]') || turns.at(-1);
      const blocks = turn ? [...turn.querySelectorAll(BLOCKS)] : [];
      const cv = blocks.filter(b => getComputedStyle(b).contentVisibility === 'auto').length;
      const r = s.getBoundingClientRect(), tr = turn?.getBoundingClientRect();
      const ids = order() || [];
      return {
        t: performance.now(), y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight, fromEnd: Math.round(s.scrollHeight - s.clientHeight - s.scrollTop),
        inProgress: inprog.length, turnIdx: turn ? ids.indexOf(turn.getAttribute('data-turn-key')) : null, entries: ids.length,
        blocks: blocks.length, cvAuto: cv, seen: blocks.filter(b => b.hasAttribute('data-butter-seen')).length, unrendered: blocks.filter(b => b.hasAttribute('data-butter-unrendered')).length,
        turnSeen: !!turn?.hasAttribute('data-butter-seen'), turnCv: turn ? getComputedStyle(turn).contentVisibility : null,
        turnBottomInView: tr ? tr.bottom - r.top : null, chars: turn?.querySelector(COLUMN)?.textContent.length ?? 0,
        adaptive: s.querySelectorAll('[class*="AdaptiveStreaming"]').length,
        allSeen: document.querySelectorAll('[data-butter-seen]').length, allUnrendered: document.querySelectorAll('[data-butter-unrendered]').length,
      };
    },
    rail() {
      const r = root(); if (!r) return null;
      const bars = [...r.querySelectorAll('.tick > .bar')];
      const op = bars.map(b => parseFloat(b.style.opacity));
      return { ticks: r.querySelectorAll('.tick').length, lit: op.flatMap((o, j) => (o > 0.9 ? [j] : [])), dark: document.querySelector('chatgpt-butter-nav').hasAttribute('data-dark') };
    },
    // Publish timing: one record per MutationObserver callback that touched the streaming answer.
    watch() {
      const s = sc(); const P = window.__pub = { times: [] };
      P.mo = new MutationObserver(recs => {
        for (const r of recs) {
          const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
          if (t?.closest?.('[data-talvt-turn-state="in_progress"]') && t.closest(COLUMN)) { P.times.push(performance.now()); return; }
        }
      });
      P.mo.observe(s, { subtree: true, childList: true, characterData: true });
    },
    unwatch() { window.__pub?.mo.disconnect(); return window.__pub?.times || []; },
    state: () => ({ replay: { ...window.__replay, hook: undefined, rafHook: undefined, denied: window.__replay.denied.length, local: window.__replay.local },
      fetchOuter: window.fetch === window.__replay?.hook, rafOuter: window.requestAnimationFrame === window.__replay?.rafHook,
      butterStats: window.__butterStats ?? null, off: document.documentElement.getAttribute('data-butter-off'),
      raf: { exact: window.__rafSeen.exact, total: window.__rafSeen.total, publishLike: [...window.__rafSeen.publishLike].map(([k, v]) => [k.slice(0, 160), v]).slice(0, 8) } }),
    rafTimes: () => window.__rafSeen.exactTimes,
    denied: () => window.__replay.denied,
  };
  // View shift (wheel-jump-live.mjs SHIFT=1): pick before the step, measure after.
  window.__rp.pick = ({ dir, step, x }) => {
    const s = sc(), r = s.getBoundingClientRect();
    const blockParent = '[data-markdown-text-style], [class*="DilResponseRoot"]';
    let el = null, kind = null;
    for (const dy of [0, -40, 40, -80, 80, -120, 120]) {
      const hit = document.elementsFromPoint(x, r.top + s.clientHeight * (dir > 0 ? 0.8 : 0.2) + dy).find(e => e !== s && s.contains(e));
      for (let e = hit; e && e !== s && !el; e = e.parentElement) {
        if (e.parentElement?.matches(blockParent) && !e.matches('[data-dil-source-message-id]')) { el = e; kind = 'block'; }
        else if (e.matches('[data-user-message-bubble]')) { el = e; kind = 'user'; }
      }
      if (!el && hit?.closest('[data-turn-key]')) { el = hit.closest('[data-turn-key]'); kind = 'turn'; }
      if (el) break;
    }
    window.__shiftP = { el, kind, dir, step, top: el?.getBoundingClientRect().top, y: s.scrollTop, max: s.scrollHeight - s.clientHeight };
  };
  window.__rp.measure = () => {
    const s = sc(), p = window.__shiftP; window.__shiftP = null;
    const base = { y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight, atEnd: s.scrollTop + s.clientHeight >= s.scrollHeight - 2 };
    if (!p) return base;
    if (!p.el) return { ...base, shift: { dir: p.dir, none: true } };
    if (!p.el.isConnected) return { ...base, shift: { dir: p.dir, kind: p.kind, lost: true } };
    const dTop = p.el.getBoundingClientRect().top - p.top, dY = s.scrollTop - p.y;
    const user = p.dir > 0 ? Math.min(p.step, Math.max(0, p.max - p.y)) : -Math.min(p.step, Math.max(0, p.y));
    const r1 = v => Math.round(v * 10) / 10;
    // In the streamed answer? (the last turn)
    const last = [...s.querySelectorAll('[data-turn-key]')].at(-1);
    return { ...base, shift: { dir: p.dir, kind: p.kind, inLast: !!last?.contains(p.el), dTop: r1(dTop), dY: r1(dY), user: r1(user), visual: r1(dTop + user), doc: r1(dTop + dY), clamped: Math.abs(user) < p.step - 0.5 } };
  };
}

let browser, context, page, optSaved = null, extId = null;
let exit = 0;
try {
  if (env.EXT !== undefined) {
    execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
    for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
    await pause(2500);
  }
  ({ browser, context } = await L.connect(lab));
  const guard = await L.sendGuard(context, lab);
  if (typeof guard !== 'function') throw Error('send guard not installed');
  await context.route('**/*', route => {
    const r = route.request(), u = new URL(r.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) summary.net.blocked.push(`${r.method()} ${template(u.pathname)}`);
    return route.fallback();
  });
  await context.routeWebSocket(/.*/, ws => { summary.net.wsClosed++; ws.close(); });
  context.on('request', r => { if (r.method() === 'POST' && /\/backend-api\/f\/conversation(?:\?|$)/.test(r.url())) summary.net.escapes++; });
  const args = L.browserArgs(lab);
  const extDir = args?.extensions[0] || null;
  summary.extension = extDir ? path.basename(path.dirname(extDir)) : 'none';
  page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0] || await context.newPage();
  for (const o of context.pages()) if (o !== page) await o.close();
  let build = 'no extension';
  if (extDir) {
    const id = extId = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
    const po = await prepareOpts(context, id, env.OPTS, summary); optSaved = po.saved; report(po.line);
    const w = await context.newPage();
    await w.goto(`chrome-extension://${id}/popup/popup.html`);
    build = await w.evaluate(() => chrome.runtime.getManifest().version_name);
    summary.settings = await w.evaluate(async () => (await chrome.storage.local.get('butter')).butter?.opts ?? null);
    await w.close();
  }
  summary.build = build;
  report(`build ${build} (${summary.extension}), fixture ${FIXTURE}, ${schedule.length} chunks over ${(schedule.at(-1)[0] / 1000).toFixed(0)} s`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  const worlds = new Map();
  cdp.on('Runtime.executionContextCreated', ({ context: c }) => worlds.set(c.id, c));
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  if (env.PROBE === '1') await page.addInitScript(installScrollProbe, 'MAIN');
  await page.addInitScript(replayHook, REPLAY);
  const tw = await streamWindows(page, cdp, env, out); // APIPROBE, TRACE_AT, hydration counts (stream-api-probe.mjs)
  await page.bringToFront();

  // ---- open ----
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  if (extDir) await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(helpers);
  await pause(9000);
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__rp.toEnd()); await pause(700); }
  await pause(1500);
  const g0 = await page.evaluate(() => window.__rp.geo());
  const entries0 = await page.evaluate(() => window.__rp.order());
  const rail0 = await page.evaluate(() => window.__rp.rail());
  const st0 = await page.evaluate(() => window.__rp.state());
  summary.open = { geo: g0, entries: entries0, rail: rail0, state: st0 };
  report(`opened: scrollTop ${g0.y} of ${g0.h} (fromEnd ${g0.fromEnd}), entries ${entries0}, rail ${rail0 ? `${rail0.ticks} ticks, lit [${rail0.lit}]` : 'none'}, data-butter-off ${JSON.stringify(st0.off)}, fetch hook outermost ${st0.fetchOuter}, rAF hook outermost ${st0.rafOuter}`);

  // ---- composer and buttons ----
  const b0 = await page.evaluate(() => window.__rp.buttons());
  const ed = page.locator('.ProseMirror:visible').first();
  await ed.click();
  await page.keyboard.type('Replay check', { delay: 60 });
  await pause(800);
  const b1 = await page.evaluate(() => window.__rp.buttons());
  summary.buttons = { empty: b0, typed: b1 };
  const fmtB = b => b.buttons.map(x => `<${x.tag} id=${x.id ?? '-'} type=${x.type ?? '-'} aria-label=${JSON.stringify(x.aria)} data=[${x.data.join(' ')}] icons=[${x.icons.join(' ')}]${x.disabled ? ' disabled' : ''}${x.rightmost ? ' RIGHTMOST' : ''} matches=[${x.match.join('; ')}]>`).join(' ');
  report(`buttons, empty composer: ${fmtB(b0)}`);
  report(`buttons, typed (${b1.composerLen} chars): ${fmtB(b1)}`);
  report(`selector counts, typed: ${JSON.stringify(b1.counts)}`);
  report(`pre-jump condition with text typed: SEND_BUTTON in form ${b1.preJumpButton}, would fire on Enter ${b1.preJumpWouldFire}`);

  if (env.NOSEND === '1') {
    await ed.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
    report('NOSEND=1: stopped before Enter');
  } else {
    // ---- self-test the hook, then Enter ----
    const self = await page.evaluate(async () => { try { const r = await fetch('/__replay_selftest', { method: 'POST', body: '{}' }); return (await r.json()).replay; } catch (e) { return 'threw'; } });
    const hookOk = self === 'local';
    verdict(hookOk, 'replay-hook', `self-test POST answered ${JSON.stringify(self)}, not by the hook`);
    if (!hookOk) throw Object.assign(Error('replay hook not in the fetch chain; nothing pressed'), { setup: true });
    await page.evaluate(() => window.__rp.watch());
    await startLaf(page);
    const ux = await uxProbe(page, env, summary, schedule.at(-1)[0], { display: lab.display });
    await page.keyboard.press('Enter');
    const samples = []; let stopSeen = null, t0 = Date.now(), lastY = null, drops = [];
    const total = schedule.at(-1)[0];
    for (;;) {
      await tw.tick(Date.now() - t0);
      const s = await page.evaluate(() => ({ s: window.__rp.stream(), r: window.__replay.started ? { c: window.__replay.chunksSent, d: window.__replay.done } : null, rail: window.__rp.rail(), ux: window.__ux?.acts.length ?? 0 }));
      samples.push({ ...s.s, chunks: s.r?.c ?? 0, done: !!s.r?.d, rail: s.rail });
      if (isStreamDrop(lastY, s.s, s.ux)) drops.push([lastY, s.s.y]);
      lastY = s.s?.y ?? lastY;
      if (!stopSeen && s.r && s.r.c > schedule.length / 3) stopSeen = await page.evaluate(() => window.__rp.buttons());
      const el = Date.now() - t0;
      if (s.r?.d && !s.s?.inProgress && el > 4000) break;
      if (el > total + 60000) { report(`replay did not finish: ${JSON.stringify(s.r)}`); break; }
      if (!s.r && el > 20000) { report('replay never started within 20 s'); break; }
      await pause(200);
    }
    const pubTimes = await page.evaluate(() => window.__rp.unwatch());
    const after = await tailWindow((a, b) => tw.tick(a, b), () => page.evaluate(() => ({ s: window.__rp.stream(), rail: window.__rp.rail(), state: window.__rp.state(), denied: window.__rp.denied(), raf: window.__rp.rafTimes() })), t0, Number(env.TAIL_MS || 5000), { pause }); // ticks for TAIL_MS, `after` at 3 s
    for (const l of await lafReport(page, tw, ux, summary)) report(l);
    summary.stream = { samples, stopProbe: stopSeen, after, drops, pubIntervals: intervals(pubTimes) };
    const rs = after.state.replay;
    report(`replay: started ${!!rs.started}, chunks ${rs.chunksSent}/${schedule.length}, done ${rs.done}, local answers [${rs.local.join(', ')}], denied in page ${after.denied.length}: ${JSON.stringify([...new Set(after.denied.map(d => `${d.method} ${template(d.path)}`))])}, request keys ${JSON.stringify(rs.reqKeys ?? null)}`);
    const streamed = samples.filter(x => x.inProgress > 0);
    verdict(!!rs.started && rs.done && rs.chunksSent === schedule.length, 'replay-streams', `started ${!!rs.started}, chunks ${rs.chunksSent}/${schedule.length}`);
    verdict(streamed.length > 0, 'in-progress', 'no sample saw [data-talvt-turn-state="in_progress"]');
    if (streamed.length) {
      const mid = streamed[streamed.length >> 1];
      report(`in_progress in ${streamed.length}/${samples.length} samples; mid-stream: turn ${mid.turnIdx}/${mid.entries}, ${mid.blocks} blocks, ${mid.cvAuto} computed content-visibility auto, seen ${mid.seen}, unrendered ${mid.unrendered}, AdaptiveStreaming ${mid.adaptive}, turn cv ${mid.turnCv}`);
      report(`streaming turn blocks over time (blocks/cvAuto/seen/unrendered): ${streamed.filter((_, i) => i % Math.max(1, Math.floor(streamed.length / 8)) === 0).map(x => `${x.blocks}/${x.cvAuto}/${x.seen}/${x.unrendered}`).join(' ')}`);
    }
    const fin = after.s;
    report(`after completion: turn ${fin.turnIdx}/${fin.entries}, in_progress ${fin.inProgress}, ${fin.blocks} blocks, cv auto ${fin.cvAuto}, seen ${fin.seen}, unrendered ${fin.unrendered}, answer ${fin.chars} chars, scrollTop ${fin.y} of ${fin.h} (fromEnd ${fin.fromEnd})`);
    if (extDir) {
      const maxCv = Math.max(0, ...streamed.map(x => x.cvAuto));
      verdict(maxCv > 0, 'cv-blocks', `no block of the streaming answer computed content-visibility auto (max blocks ${Math.max(0, ...streamed.map(x => x.blocks))})`);
      const marks = Math.max(fin.seen + fin.unrendered, ...samples.map(x => x.seen + x.unrendered));
      verdict(marks > 0, 'seen-marks', 'no data-butter-seen or data-butter-unrendered mark on the streamed answer\'s blocks');
      report(`marks on the streamed answer: max during stream seen ${Math.max(0, ...streamed.map(x => x.seen))}, unrendered ${Math.max(0, ...streamed.map(x => x.unrendered))}; after: seen ${fin.seen}, unrendered ${fin.unrendered}`);
      const bs = after.state.butterStats;
      verdict(!!bs && bs.smootherFrames > 0, 'throttle-matched', `__butterStats ${JSON.stringify(bs)}: the smoother callback never matched`);
      report(`__butterStats ${JSON.stringify(bs)}`);
    }
    const iv = summary.stream.pubIntervals.filter(x => x > 0);
    report(`answer DOM updates while streaming: ${pubTimes.length}, interval p10 ${q(iv, 0.1)}, median ${median(iv)}, p90 ${q(iv, 0.9)} ms`);
    const rt = intervals(after.raf.filter(t => !rs.started || t >= rs.started));
    report(`native smoother rAF callbacks seen by the harness hook: ${after.state.raf.exact} (hook outermost ${after.state.rafOuter}), interval median ${median(rt)} ms; other publish/flush-like callbacks: ${JSON.stringify(after.state.raf.publishLike)}`);
    // Follow the end
    const atEnd = streamed.filter(x => x.fromEnd <= 4).length;
    report(`view while streaming: at the end (within 4 px) in ${atEnd}/${streamed.length} samples; fromEnd min ${Math.min(...streamed.map(x => x.fromEnd))}, median ${median(streamed.map(x => x.fromEnd))}, max ${Math.max(...streamed.map(x => x.fromEnd))}; scrollTop first ${streamed[0]?.y}, last ${streamed.at(-1)?.y}; after completion fromEnd ${fin.fromEnd}`);
    verdict(drops.length === 0, 'stream-no-jump', `scrollTop fell by more than a viewport ${drops.length} times while streaming: ${drops.slice(0, 3).map(d => d.join(' → ')).join(', ')}`);
    if (stopSeen) report(`buttons mid-stream: ${fmtB(stopSeen)}; counts ${JSON.stringify(stopSeen.counts)}`);
    // Rail
    if (extDir) {
      const r1 = after.rail;
      verdict(r1 && rail0 && r1.ticks === rail0.ticks + 1, 'rail-new-tick', `ticks ${rail0?.ticks} before, ${r1?.ticks} after`);
      const g = await page.evaluate(() => window.__rp.geo());
      await page.mouse.move(Math.round((g.box.left + g.box.right) / 2 - 200), Math.round((g.box.top + g.box.bottom) / 2));
      await pause(1200);
      const r2 = await page.evaluate(() => window.__rp.rail());
      verdict(r2 && r2.lit.includes(r2.ticks - 1), 'rail-new-tick-lit', `lit [${r2?.lit}] of ${r2?.ticks}`);
      report(`rail after completion: ${r2.ticks} ticks, lit [${r2.lit}]; during stream ticks ${[...new Set(samples.map(x => x.rail?.ticks))].join('/')}`);
    } else report(`native: no rail; entries ${fin.entries} (before ${entries0})`);

    // ---- wheel up through the streamed answer and back down, view shift per step ----
    if (env.PHASES === 'stream') report('PHASES=stream: wheel phase skipped'); else {
    const vp = await veilProbe(page, env, summary);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__rp.toEnd()); await pause(600); }
    await pause(1500);
    const g = await page.evaluate(() => window.__rp.geo());
    const x = Math.round((g.box.left + g.box.right) / 2 - 150), y = Math.round((g.box.top + g.box.bottom) / 2);
    await page.mouse.move(x, y);
    // Enough steps to pass the streamed answer's top by two steps.
    const lastH = await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); return [...s.querySelectorAll('[data-turn-key]')].at(-1)?.getBoundingClientRect().height || 0; });
    const upSteps = Math.min(60, Math.max(8, Math.ceil((lastH + 1400) / STEP_PX)));
    report(`wheel phase: last turn ${Math.round(lastH)} px high, ${upSteps} steps up`);
    if (env.PROBE === '1') {
      const iso = [...worlds.values()].find(c => c.origin.startsWith('chrome-extension://') && !c.auxData?.isDefault);
      if (iso) await cdp.send('Runtime.evaluate', { contextId: iso.id, expression: `(${installScrollProbe.toString()})('ISOLATED')` });
      report(`scroll probe: MAIN installed, Butter's world ${iso ? 'installed' : 'not found'}`);
      await page.evaluate(() => {
        const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
        const w = window.__probeLog = { writes: [], scrolls: 0 };
        s.addEventListener('rail-scroll-probe', e => { const d = JSON.parse(e.detail); if (/:before$/.test(d.kind)) w.writes.push({ at: d.at, world: d.world, kind: d.kind, value: d.value ?? d.args, frames: (d.stack || '').split('\n').slice(2, 6).map(l => l.trim().replace(/^at /, '').replace(/\?[^:)]*/, '')) }); else if (d.kind === 'scroll') w.scrolls++; });
        document.dispatchEvent(new Event('rail-probe-start'));
      });
    }
    const up = [], down = []; const wheelDrops = [];
    for (let i = 0; i < upSteps; i++) {
      await page.evaluate(a => window.__rp.pick(a), { dir: -1, step: STEP_PX, x });
      await page.mouse.wheel(0, -STEP_PX); await pause(STEP_WAIT);
      const m = await page.evaluate(() => window.__rp.measure()); up.push(m.shift);
      if (m.y <= 0) break;
    }
    if (env.PROBE === '1') {
      const pl = await page.evaluate(() => { document.dispatchEvent(new Event('rail-probe-stop')); return window.__probeLog; });
      summary.wheel_probe = pl;
      const by = {};
      for (const w of pl.writes) { const k = `${w.world} ${w.kind} ${w.frames.slice(0, 2).join(' < ')}`; by[k] = (by[k] || 0) + 1; }
      report(`scroll probe, wheel-up phase: ${pl.writes.length} wrapped writes, ${pl.scrolls} scroll events; by world/kind/top frames: ${JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6))}`);
    }
    let prevY = (await page.evaluate(() => window.__rp.geo())).y;
    for (let i = 0; i < upSteps + 15; i++) {
      await page.evaluate(a => window.__rp.pick(a), { dir: 1, step: STEP_PX, x });
      await page.mouse.wheel(0, STEP_PX); await pause(STEP_WAIT);
      const m = await page.evaluate(() => window.__rp.measure()); down.push(m.shift);
      if (prevY - m.y > m.vh) wheelDrops.push([Math.round(prevY), Math.round(m.y), i + 1]);
      prevY = m.y;
      if (m.atEnd) break;
    }
    await pause(1500);
    const gEnd = await page.evaluate(() => window.__rp.geo());
    summary.wheel = { upSteps, up, down, wheelDrops, end: gEnd };
    if (vp) for (const l of await vp.finish()) report(l);
    const su = shiftStats(up), sd = shiftStats(down);
    const inLast = rows => shiftStats(rows.filter(r => r?.inLast));
    report(`view shift up (${up.length} steps): ${fmtShift(su)}; in the streamed answer: ${fmtShift(inLast(up))}`);
    report(`view shift down (${down.length} steps, ended fromEnd ${gEnd.fromEnd}): ${fmtShift(sd)}; in the streamed answer: ${fmtShift(inLast(down))}`);
    verdict(wheelDrops.length === 0, 'wheel-no-jump', `scrollTop fell by more than a viewport while wheeling down: ${wheelDrops.slice(0, 3).map(d => `${d[0]} → ${d[1]} at step ${d[2]}`).join(', ')}`);
    }
    for (const v of veilVerdicts(summary)) v.check ? verdict(v.ok, v.check, v.why) : report(v.line); // stream-veil-verdicts.mjs
    await ed.click().catch(() => {}); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
  }

  verdict(summary.net.escapes === 0, 'no-escape', `${summary.net.escapes} POST /backend-api/f/conversation reached the network layer (the guard aborted them)`);
  report(`network: guard-blocked non-GET ${summary.net.blocked.length} ${JSON.stringify(Object.entries(summary.net.blocked.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})))}, WebSockets closed ${summary.net.wsClosed}`);

  // ---- server unchanged: a fresh load, 20 s after the last ----
  await page.goto('about:blank');
  await pause(20000);
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.evaluate(helpers);
  await pause(6000);
  const entries1 = await page.evaluate(() => window.__rp.order());
  summary.reload = { entries: entries1 };
  verdict(entries1 === entries0, 'server-unchanged', `ChatGPT's turn list has ${entries1} entries after a reload, ${entries0} before`);
  const ed2 = page.locator('.ProseMirror:visible').first();
  report(`composer after reload: ${((await ed2.textContent()) || '').length} chars`);
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally {
  if (optSaved) report(await putBack(context, extId, optSaved, summary));
  save();
  await browser?.close().catch(() => {});
}
console.log(`SUMMARY ${label}: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
