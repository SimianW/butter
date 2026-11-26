// Ad-hoc, issue #171 stage 1a: is ChatGPT's end pin (`cc.current.bottom`) set during rail jumps, and what do
// rail-jump-live.mjs's setup inputs (the one-pixel wheel "unpin" and the edge write) do to it?
//
// LAB_ID=2 LAB_OWNER=<held lock owner> EXT=<unpacked dev build> LP=<lp.json> LP_URL=<regex of the scroll chunk's URL>
//   (LP_URL may hold HASH: each logpoint's `chunk` replaces it, so one lp.json covers several builds of the chunk)
//   STEPS='[{"from":"top","to":0},{"from":"bottom","to":1},...]' [OUT=<raw json>] [FIXTURE=math12]
//   node notes/runs/2026-11-24-rail-jump-pin/adhoc/rpin.mjs
//
// Same page setup as lab/harness/rail-jump-live.mjs (browser restart with EXT, fixture opened, earlier history
// loaded with scrollTop 280 → 0 writes, the same page and scroll probes) and the same per-step inputs, in the same
// order: unpin (mouse to 1000,420, wheel deltaY 1, 50 ms), edge write (scrollTop 0 or scrollHeight), 700 ms,
// prepare, the edge-positioning retry loop, start, trusted click on the tick, mouse back to 1000,420, wait done.
// `from` may also be "previous" (no setup, as in the harness) or "none" (no setup inputs at all).
// A step may carry extra inputs before the jump: "pre": ["wheeldown","wheelup","wheel1","write0","writeEnd","wait1000"]
// (run after the harness setup, each read like a setup input). Add a new input kind in `inputs` below.
//
// Pin readings: (1) `pinNow()` walks React fibers up from the scroller to the hook whose ref holds
// {bottom, top} (ChatGPT's `cc`), at any time; (2) CDP logpoints from LP (labels as in 2026-11-23's lp.json plus
// ROcb, ROgrow, ao, ar), each logging `pin` from inside ChatGPT's code. Logpoint hits carry page performance.now().
// Output: SETUP lines (pin before → after each setup input, with logpoint hits in between), JUMP lines (pin at the
// click, after each Butter write, at each end pull; observer growth after the target mounts), raw JSON to OUT.
// Send guard on. Logs hold numbers, labels, minified names; URLs are scrubbed to <script>.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.resolve(here, '../../../../lab/harness');
const L = await import(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs'));
const { installScrollProbe } = await import(path.join(harness, 'rail-jump-scroll-probe.mjs'));
const { installProbe, classify } = await import(path.join(harness, 'rail-jump-live-page.mjs'));

const env = process.env;
const STEPS = JSON.parse(env.STEPS || '[{"from":"top","to":0}]');
const OUT = env.OUT || path.join(os.homedir(), '.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-pin', `rpin-${Date.now()}.json`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (!env.LAB_OWNER || held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const scrub = (s) => String(s).replace(/(?:https?|chrome-extension):\/\/[^\s"'):]+/g, '<script>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>').split(os.homedir()).join('~');
const raw = { steps: [] };
let browser, exit = 0, previousSettings, workerPage;
const lp = [];
const lpSince = (t0, t1 = Infinity) => lp.filter((h) => h.t >= t0 && h.t <= t1);
const short = (h, t0) => `${h.label}@${Math.round(h.t - t0)}${h.v && typeof h.v === 'object' ? ':' + JSON.stringify(Object.fromEntries(Object.entries(h.v).filter(([k]) => ['pin', 'm', 'to', 'dir', 'type', 'src', 'dist', 'cb', 'a', 'b', 'p', 'dv', 'beh', 'bS'].includes(k)))) : ''}`;
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT ?? '', LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  let context; ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  const extDir = L.browserArgs(lab)?.extensions[0];
  let worker = null;
  if (extDir) {
    const id = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map((h) => String.fromCharCode(97 + parseInt(h, 16))).join('');
    worker = workerPage = await context.newPage();
    await worker.goto(`chrome-extension://${id}/popup/popup.html`);
    console.log('BUILD', await worker.evaluate(() => chrome.runtime.getManifest().version_name));
    // The rail is an Experimental setting, off on a new install: turn it on (as rail-jump-live.mjs's OPTS path does).
    previousSettings = await worker.evaluate(async () => (await chrome.storage.local.get('butter')).butter ?? null);
    await worker.evaluate(async () => { const { butter = {} } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: { ...butter, opts: { ...butter.opts, rail: true } } }); });
    console.log('OPTS before', JSON.stringify(previousSettings), 'set rail: true');
  }
  const page = context.pages().find((p) => p !== worker && /^https:\/\/chatgpt\.com\//.test(p.url())) || context.pages().find((p) => p !== worker) || await context.newPage();
  for (const o of context.pages()) if (o !== page && o !== worker) await o.close();
  page.on('console', (m) => {
    const t = m.text(); if (!t.startsWith('__LP ')) return;
    const [, label, at, ...rest] = t.split(' ');
    let v = rest.join(' '); try { v = JSON.parse(v); } catch {}
    lp.push({ label, t: Number(at), v });
  });
  const cdp = await context.newCDPSession(page);
  const worlds = new Map();
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.set(context.id, context));
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  const chunks = new Set(); let resolved = 0;
  cdp.on('Debugger.scriptParsed', (e) => { if (env.LP_URL && new RegExp(env.LP_URL.replace('HASH', '[0-9a-f]+')).test(e.url)) chunks.add(path.basename(new URL(e.url).pathname)); });
  cdp.on('Debugger.breakpointResolved', () => { resolved++; });
  await cdp.send('Debugger.enable');
  for (const p of env.LP ? JSON.parse(fs.readFileSync(env.LP, 'utf8')) : []) {
    const cond = `(console.debug('__LP ' + ${JSON.stringify(p.label)} + ' ' + Math.round(performance.now()) + ' ' + (()=>{try{return JSON.stringify(${p.expr || 'null'})}catch(e){return 'err:'+e.message}})()), false)`;
    const r = await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: env.LP_URL.replace('HASH', p.chunk || '[0-9a-f]+'), lineNumber: p.line, columnNumber: p.col, condition: cond });
    resolved += r.locations.length;
  }
  await page.addInitScript(installScrollProbe, 'MAIN');
  await page.bringToFront();
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, env.FIXTURE || 'math12'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  if (worker) await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(installProbe);
  if (worker) {
    const isolated = [...worlds.values()].find((c) => c.origin.startsWith('chrome-extension://') && !c.auxData?.isDefault);
    if (!isolated) throw Error('Butter isolated execution context not found');
    await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression: `(${installScrollProbe.toString()})('ISOLATED')` });
  }
  await page.evaluate(() => {
    const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight);
    // ChatGPT's pin ref: the hook ref whose current is exactly {bottom: boolean, top: boolean}, above the scroller.
    window.__pinNow = () => {
      const s = sc(); if (!s) return null;
      let f = s[Object.keys(s).find((k) => k.startsWith('__reactFiber$'))];
      for (let d = 0; f && d < 80; d++, f = f.return) {
        const found = [];
        for (let h = f.memoizedState, i = 0; h && typeof h === 'object' && 'next' in h && i < 400; h = h.next, i++) {
          const v = h.memoizedState, c = v && typeof v === 'object' && 'current' in v ? v.current : null;
          if (c && typeof c === 'object' && typeof c.bottom === 'boolean' && typeof c.top === 'boolean' && Object.keys(c).length === 2) found.push(c.bottom);
        }
        if (found.length) return found.length === 1 ? found[0] : 'multi:' + found.join(',');
      }
      return 'none';
    };
    window.__geo = () => { const s = sc(); return { y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight, end: s.scrollHeight - s.clientHeight, pin: window.__pinNow(), now: performance.now() }; };
  });
  console.log('LOGPOINTS', JSON.stringify({ set: env.LP ? JSON.parse(fs.readFileSync(env.LP, 'utf8')).length : 0, resolved, chunks: [...chunks] }));
  const prepare = async () => { const h = await page.waitForFunction(() => { try { return window.__railJumpLive.prepare(); } catch { return false; } }, null, { timeout: 15000, polling: 100 }); const v = await h.jsonValue(); await h.dispose(); return v; };
  let previous = 0, stable = 0;
  for (let n = 0; n < 20 && stable < 3; n++) {
    await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight); s.scrollTop = 280; });
    await page.waitForTimeout(30);
    await page.evaluate(() => window.__railJumpLive.edge('top'));
    await page.waitForTimeout(700);
    const state = await prepare();
    stable = state.questions === previous ? stable + 1 : 0; previous = state.questions;
  }
  const meta = await prepare();
  console.log('FIXTURE', JSON.stringify({ questions: meta.questions, height: meta.height, trace: meta.trace, off: meta.off }), 'geo', JSON.stringify(await page.evaluate(() => window.__geo())));
  const lp0 = lp.length;
  console.log(`LP hits during open/history: ${lp0}; labels ${JSON.stringify([...new Set(lp.map((h) => h.label))])}`);

  const geo = () => page.evaluate(() => window.__geo());
  let lastNow = null;
  // One setup input: read pin before, run, read pin after `wait` ms; logpoint hits in between.
  const setup = async (step, name, fn, wait) => {
    const a = await geo();
    const r = await fn();
    const b = await geo();
    if (wait) await page.waitForTimeout(wait);
    const c = await geo();
    const hits = lpSince(a.now, c.now);
    const rec = { input: name, before: { y: a.y, end: a.end, pin: a.pin }, sync: { y: b.y, pin: b.pin }, after: { y: c.y, end: c.end, pin: c.pin, ms: Math.round(c.now - a.now) }, r, hits: hits.map((h) => ({ ...h, t: Math.round(h.t - a.now) })) };
    step.setup.push(rec); lastNow = c.now;
    console.log(`SETUP ${step.name} ${name}: pin ${a.pin} → ${b.pin} (sync) → ${c.pin} (+${rec.after.ms} ms); y ${a.y} → ${b.y} → ${c.y} (end ${c.end})${r == null ? '' : ' ' + JSON.stringify(r)}; LP ${hits.map((h) => short(h, a.now)).join(' ')}`);
    return rec;
  };
  const inputs = {
    unpin: async () => { await page.mouse.move(1000, 420); await page.mouse.wheel(0, 1); await page.waitForTimeout(50); },
    wheeldown: async () => { await page.mouse.move(1000, 420); await page.mouse.wheel(0, 120); },
    wheelup: async () => { await page.mouse.move(1000, 420); await page.mouse.wheel(0, -120); },
    wheel1: async () => { await page.mouse.move(1000, 420); await page.mouse.wheel(0, 1); },
    write0: () => page.evaluate(() => { [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight).scrollTop = 0; }),
    writeEnd: () => page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight); s.scrollTop = s.scrollHeight; }),
    wait1000: async () => {},
  };
  for (let k = 0; k < STEPS.length; k++) {
    const { from, to, pre = [] } = STEPS[k];
    const step = { name: `#${k + 1} ${from}→${to}`, from, to, setup: [] };
    raw.steps.push(step);
    if (from === 'top' || from === 'bottom') {
      await setup(step, 'unpin-wheel1', inputs.unpin, 0);
      await setup(step, `edge-${from}`, () => page.evaluate((f) => window.__railJumpLive.edge(f), from), 700);
    }
    for (const p of pre) await setup(step, p, inputs[p], p === 'wait1000' ? 1000 : 700);
    await prepare();
    if (from === 'top' || from === 'bottom') {
      // rail-jump-live.mjs's positioning loop: rewrite the edge until the chat is within 2 px of it.
      let ok = false;
      for (let retry = 0; retry < 8 && !ok; retry++) {
        const a = await geo();
        const res = await page.evaluate((from) => {
          const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight);
          const desired = from === 'top' ? 0 : s.scrollHeight - s.clientHeight;
          if (Math.abs(s.scrollTop - desired) <= 2) return { ok: true, y: Math.round(s.scrollTop) };
          const was = Math.round(s.scrollTop); s.scrollTop = desired; return { ok: false, was, desired: Math.round(desired), pin: window.__pinNow() };
        }, from);
        ok = res.ok;
        if (!ok) { step.setup.push({ input: `position-retry-${retry}`, before: { y: a.y, pin: a.pin }, res }); console.log(`SETUP ${step.name} position-retry-${retry}: chat at ${res.was} (pin ${a.pin}), rewrote ${res.desired}`); await page.waitForTimeout(250); }
      }
      if (!ok) throw Error('could not establish the requested starting edge');
    }
    const startAt = await page.evaluate((to) => { window.__railJumpLive.start(to, false); return performance.now(); }, to);
    const g0 = await geo();
    // Logpoint hits between the last setup reading and the start (prepare, positioning loop): pulls before the click.
    const gap = lastNow == null ? [] : lpSince(lastNow, startAt);
    step.gap = gap.map((h) => ({ ...h, t: Math.round(h.t - startAt) }));
    console.log(`GAP ${step.name} (ms before start) ${gap.filter((h) => h.label !== 'scroll' && h.label !== 'cu' || (h.v && h.v.to === 0)).map((h) => short(h, startAt)).join(' ')}; pin at start ${g0.pin} y ${g0.y}`);
    lastNow = null;
    if (worker) {
      const box = await page.locator('chatgpt-butter-nav .tick').nth(to).boundingBox();
      if (!box) throw Error('target tick has no box');
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(1000, 420);
    } else await page.evaluate((to) => window.__railJumpLive.nativeJump(to), to);
    await page.waitForFunction(() => window.__railJumpLive.done(), null, { timeout: 90000, polling: 100 });
    const data = await page.evaluate(() => window.__railJumpLive.result());
    const gEnd = await geo();
    const cls = classify(data);
    const hits = lpSince(startAt - 5, gEnd.now).map((h) => ({ ...h, t: Math.round(h.t - startAt) }));
    const clickT = data.events.find((e) => e.type === 'rail-jump')?.t ?? null;
    const pinAt = (t) => { const h = [...hits].reverse().find((x) => x.t <= t && x.v && typeof x.v === 'object' && 'pin' in x.v); return h ? h.v.pin : null; };
    const pinAfter = (t) => { const h = hits.find((x) => x.t >= t && x.label === 'scroll'); return h ? { pin: h.v.pin, t: h.t } : null; };
    const butterWrites = data.scrollCalls.filter((c) => c.world === 'ISOLATED' && /:after$/.test(c.kind)).map((c) => ({ t: c.t, kind: c.kind, y: Math.round(c.y), pinBefore: pinAt(c.t), pinAfter: pinAfter(c.t) }));
    const pulls = data.scrollCalls.filter((c) => c.world === 'MAIN' && c.kind === 'scrollTo:before' && c.args?.[0]?.top != null && c.args[0].top >= c.h - c.vh - 2 && c.y < c.h - c.vh - c.vh)
      .map((c) => { const ah = [...hits].reverse().find((x) => x.label === 'ah' && x.t <= c.t + 1); const ro = [...hits].reverse().find((x) => (x.label === 'ROtail' || x.label === 'RO') && x.t <= c.t + 1); return { t: c.t, fromY: Math.round(c.y), top: Math.round(c.args[0].top), ahPin: ah && Math.abs(ah.t - c.t) <= 2 ? ah.v.pin : null, ro: ro && Math.abs(ro.t - c.t) <= 2 ? { label: ro.label, ...ro.v } : null, stack: /ResizeObserver/.test(c.stack || '') }; });
    const mountF = data.frames.find((f) => f.targetTop != null && f.targetHeight > 0);
    const mountT = mountF?.t ?? null;
    const grow = mountT == null ? [] : hits.filter((h) => h.t >= mountT && (h.label === 'ROgrow' || h.label === 'ROcb' || h.label === 'ROtail' || h.label === 'RO'));
    const summary = {
      step: step.name, class: cls.class, failureReason: cls.failureReason, clickT, startY: Math.round(data.frames[0].y), endY: Math.round(data.frames.at(-1).y),
      pinAtStart: g0.pin, pinAtClickLP: clickT == null ? null : pinAt(clickT), pinAtEnd: gEnd.pin, mountT,
      butterWrites, pulls, pullsPinTrue: pulls.filter((p) => p.ahPin === true).length,
      growthAfterMount: grow.filter((h) => h.label === 'ROgrow').map((h) => ({ t: h.t, m: h.v.m, pin: h.v.pin })),
      roCallbacksAfterMount: grow.filter((h) => h.label === 'ROcb').length,
      roTailAfterMount: grow.filter((h) => h.label === 'ROtail').map((h) => ({ t: h.t, m: h.v.m, p: h.v.p, pin: h.v.pin })),
      roBranchAfterMount: grow.filter((h) => h.label === 'RO').map((h) => ({ t: h.t, b: h.v.b, c: h.v.c, pin: h.v.pin })),
      pinSets: hits.filter((h) => ['ao', 'cE', 'cy', 'cH', 'ar'].includes(h.label)).map((h) => short(h, 0)),
    };
    step.jump = summary; step.lp = hits; step.frames = data.frames.map((f) => [f.t, Math.round(f.y), f.h, f.targetTop == null ? null : Math.round(f.targetTop)]);
    step.scrollCalls = data.scrollCalls.map((c) => ({ t: c.t, world: c.world, kind: c.kind, y: Math.round(c.y), h: c.h, args: c.args, value: c.value, caller: c.stack ? scrub(c.stack.split('\n').slice(1, 4).join(' < ')) : undefined }));
    console.log(`JUMP ${JSON.stringify(summary)}`);
    console.log(`LPJUMP ${step.name} ${hits.filter((h) => h.label !== 'scroll' || true).slice(0, 120).map((h) => short(h, 0)).join(' ')}`);
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(raw));
  }
  // The harness ends the last jump's pin too.
  const s = { name: 'final', setup: [] }; raw.steps.push(s);
  await setup(s, 'unpin-wheel1', inputs.unpin, 700);
} catch (e) { console.log('HARNESS ERROR:', scrub(e.stack || e.message)); exit = 2; } finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(raw));
  if (previousSettings !== undefined && workerPage) await workerPage.evaluate((v) => v == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: v }), previousSettings).then(() => console.log('OPTS put back')).catch(() => {});
  await browser?.close().catch(() => {});
}
console.log(`EXIT ${exit}; raw ${scrub(OUT)}`);
process.exit(exit);
