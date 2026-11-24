// Ad-hoc, stage 3 (issue #152): what sets and clears ChatGPT's pin to the chat's end, and does Butter's release clear it?
// LAB_ID=2 LAB_OWNER=<owner> EXT=<dir or empty> MODE=src|steps [STEPS=ctl,wheel,...] [LP=<logpoints.json>]
//   [TARGET=0.6] [MS=6000] [REPIN=write|wheel] [OUT=<raw dir>] node pin.mjs
// Restarts the lab browser with EXT, opens math12, loads all earlier history (seek-landing-live.mjs's loop).
// MODE=src: one hold check of scrollTop 0, then saves (raw, local only) the pull's caller frames with
//   script URL:line:col, the scroll/wheel/touch/pointer/key listener registrations and ResizeObserver /
//   IntersectionObserver constructions with their frames, and the source of every script those frames name.
// MODE=steps: per step: re-pin (scrollTop to the end, 1.5 s), the step's input, then a hold check: write
//   scrollTop = TARGET x range once, sample every 100 ms for MS ms; "pulled" = back within a viewport of the end.
// LP: CDP logpoints [{label, urlRegex, line, col, expr}] (0-based line/col); hits are printed per step.
// Logs hold pixel numbers, ms, labels and frames with script URLs replaced by <script>. Send guard on.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as L from '~/.local/share/chatgpt-lab/lib/lab.mjs';
const env = process.env, EXT = env.EXT ?? '', MODE = env.MODE || 'steps';
const STEPS = (env.STEPS || 'ctl').split(','), MS = Number(env.MS || 6000), TARGET = Number(env.TARGET || 0.6), ARROW = 15;
const OUT = env.OUT || path.join(process.env.HOME, '.local/share/chatgpt-lab/captures/2026-11-23-seek-pin-cause');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (!env.LAB_OWNER || held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const scrub = (s) => String(s).replace(/https?:\/\/[^\s"'):]+/g, '<script>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let browser, exit = 0;
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  let context; ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  console.log('BROWSER', JSON.stringify(await L.browserArgs(lab)).split(process.env.HOME).join('~'));
  const page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  const lpHits = [];
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('__LP ')) lpHits.push(t.slice(5)); });
  if (env.LP) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Debugger.enable');
    for (const p of JSON.parse(fs.readFileSync(env.LP, 'utf8'))) {
      const cond = `(console.debug('__LP ' + ${JSON.stringify(p.label)} + ' ' + Math.round(performance.now()) + ' ' + (()=>{try{return JSON.stringify(${p.expr || 'null'})}catch(e){return 'err:'+e.message}})()), false)`;
      const r = await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: p.urlRegex, lineNumber: p.line, columnNumber: p.col, condition: cond });
      console.log('LOGPOINT', p.label, r.locations.length ? 'resolved' : 'pending');
    }
  }
  await page.addInitScript(() => {
    Error.stackTraceLimit = 30;
    const frames = (skip) => (new Error().stack || '').split('\n').slice(skip, skip + 16).map((l) => l.trim().replace(/^at /, ''));
    const log = (window.__pullLog = []);
    const near = (el, v) => el && el.classList?.contains('thread-scroll-container') && v > el.scrollHeight - 3 * el.clientHeight;
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get: d.get, set(v) { if (near(this, v)) log.push([Math.round(performance.now()), 'scrollTop=', Math.round(v), frames(2)]); return d.set.call(this, v); } });
    for (const m of ['scrollTo', 'scroll', 'scrollBy']) {
      const o = Element.prototype[m];
      Element.prototype[m] = function (a, b) { const v = typeof a === 'object' && a ? a.top : b; const to = m === 'scrollBy' ? this.scrollTop + (v || 0) : v; if (to != null && near(this, to)) log.push([Math.round(performance.now()), m, Math.round(to), frames(2)]); return o.apply(this, arguments); };
    }
    const desc = (t) => t === window ? 'window' : t === document ? 'document' : t?.nodeType === 1 ? `${t.tagName}.${String(t.className).slice(0, 60)}` : String(t);
    const types = new Set(['scroll', 'scrollend', 'wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'keydown']);
    const regs = (window.__regs = []);
    const ael = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      try { if (types.has(type)) regs.push({ type, target: desc(this), opt: typeof opt === 'object' ? JSON.stringify(opt) : String(opt), fn: String(fn).slice(0, 120), frames: frames(2) }); } catch {}
      return ael.call(this, type, fn, opt);
    };
    const obs = (window.__obs = []);
    if (window.__noObs) for (const k of ['ResizeObserver', 'IntersectionObserver']) {}
  });
  await page.goto(L.fixture(lab, env.FIXTURE || 'math12'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  if (EXT) await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(() => {
    const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
    const order = () => { const t = sc()?.querySelector('[data-turn-key]'); let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))]; for (let d = 0; f && d < 80; d++, f = f.return) { const e = f.memoizedProps?.entries; if (Array.isArray(e) && e.length && e.every((x) => typeof x?.turnKey === 'string')) return e.map((x) => x.turnKey); } return []; };
    const at = () => { const s = sc(), sr = s.getBoundingClientRect(), ids = order(), y = sr.top + 60; for (const t of s.querySelectorAll('[data-turn-key]')) { const b = t.getBoundingClientRect(); if (b.height > 0 && b.top <= y && b.bottom > y) return ids.indexOf(t.getAttribute('data-turn-key')); } return null; };
    let swallow = null;
    window.__h = {
      sc, entries: () => order().length, at,
      geo: () => { const s = sc(), r = s.getBoundingClientRect(); return { y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight, end: s.scrollHeight - s.clientHeight, at: at(), top: r.top, right: r.right, left: r.left, bottom: r.bottom }; },
      top: (v) => { sc().scrollTop = v; },
      toEnd: () => { const s = sc(); s.scrollTop = s.scrollHeight; },
      synth: () => sc().dispatchEvent(new Event('scroll')),
      // Butter-like: swallow every scroll event of the scroller at window capture.
      swallow(on) {
        if (on && !swallow) { swallow = { n: 0, f: (e) => { if (e.target === sc()) { swallow.n++; e.stopImmediatePropagation(); } } }; addEventListener('scroll', swallow.f, true); }
        if (!on && swallow) { removeEventListener('scroll', swallow.f, true); const n = swallow.n; swallow = null; return n; }
      },
      async hold(v, ms, synth) {
        const s = sc(), out = [], t0 = performance.now(), logFrom = window.__pullLog.length;
        let ev = 0; const on = () => { ev++; }; s.addEventListener('scroll', on);
        s.scrollTop = v; if (synth) s.dispatchEvent(new Event('scroll'));
        out.push([0, Math.round(s.scrollTop), s.scrollHeight, at()]);
        while (performance.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 100)); out.push([Math.round(performance.now() - t0), Math.round(s.scrollTop), s.scrollHeight, at()]); }
        s.removeEventListener('scroll', on);
        return { t0: Math.round(t0), samples: out, scrollEvents: ev, writes: window.__pullLog.slice(logFrom).map((w) => [Math.round(w[0] - t0), ...w.slice(1)]) };
      },
    };
  });
  await pause(6000);
  console.log('OPENED', JSON.stringify(await page.evaluate(() => window.__h.geo())));
  let n = -1;
  for (let k = 0, stable = 0; k < 40 && stable < 4; k++) {
    await page.evaluate(() => window.__h.top(280)); await pause(30);
    await page.evaluate(() => window.__h.top(0)); await pause(1000);
    const c = await page.evaluate(() => window.__h.entries());
    stable = c === n ? stable + 1 : 0; n = c;
  }
  console.log(`HISTORY ${n} entries`, JSON.stringify(await page.evaluate(() => window.__h.geo())));
  await pause(3000);
  console.log('HISTORY+3s', JSON.stringify(await page.evaluate(() => window.__h.geo())));

  const holdCheck = async (label, v, synth = false) => {
    const before = await page.evaluate(() => window.__h.geo());
    const lp0 = lpHits.length;
    const res = await page.evaluate(([v, ms, synth]) => window.__h.hold(v, ms, synth), [v, MS, synth]);
    const s = res.samples, last = s.at(-1);
    const pulled = s.find((x) => x[1] > x[2] - 2 * before.vh && x[1] > v + before.vh);
    console.log(`REPORT ${label} hold scrollTop=${v}: before ${before.y} (end ${before.end}); first ${s[0][1]}; last ${last[1]} at ${last[0]} ms; ${pulled ? `PULLED at ${pulled[0]} ms (scrollTop ${pulled[1]})` : 'HELD'}; samples ${s.length}; scroll events ${res.scrollEvents}; writes near end ${res.writes.length} ${scrub(JSON.stringify(res.writes.map((w) => [w[0], w[1], w[2]])))}`);
    console.log(`TRACE ${label} ${JSON.stringify(s.filter((_, i) => i % 5 === 0 || i === s.length - 1))}`);
    if (lpHits.length > lp0) console.log(`LP ${label} during hold (page ms, t0 ${res.t0}): ${scrub(lpHits.slice(lp0).slice(0, 60).join(' | '))}`);
    return { res, pulled };
  };
  const thumb = async () => {
    const g = await page.evaluate(() => window.__h.geo());
    const track = g.vh - 2 * ARROW, th = Math.max(20, track * g.vh / g.h), thumbTop = ARROW + (track - th) * g.y / (g.h - g.vh);
    return { g, x: Math.round(g.right - 5), y: Math.round(g.top + thumbTop + th / 2) };
  };
  const drag = async (dy) => {
    const { x, y } = await thumb();
    await page.mouse.move(x, y); await page.mouse.down();
    for (let k = 1; k <= 4; k++) { await page.mouse.move(x, y + Math.sign(dy) * k * Math.abs(dy) / 4, { steps: 4 }); await pause(250); }
    await pause(600);
    await page.mouse.up();
  };
  const repin = async () => {
    if (env.REPIN === 'wheel') {
      // ChatGPT re-pins on a user gesture toward the end that ends near it (scrollToBottom from cO): write near the end, then wheel down.
      await page.evaluate(() => { const s = window.__h.sc(); s.scrollTop = s.scrollHeight - s.clientHeight - 300; }); await pause(400);
      const g = await page.evaluate(() => window.__h.geo()); await page.mouse.move(g.left + 300, g.top + 300);
      for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, 200); await pause(250); }
      await pause(1500);
    } else { await page.evaluate(() => window.__h.toEnd()); await pause(1500); }
  };

  if (MODE === 'src') {
    const r = await holdCheck('src', 0);
    const raw = { pull: r.res.writes, regs: await page.evaluate(() => window.__regs), obs: await page.evaluate(() => window.__obs) };
    fs.writeFileSync(path.join(OUT, `src-${stamp}.json`), JSON.stringify(raw, null, 1));
    const urls = new Set();
    for (const f of [...raw.pull.flatMap((w) => w[3]), ...raw.regs.flatMap((x) => x.frames), ...raw.obs.flatMap((x) => x.frames)]) { const m = String(f).match(/(https?:\/\/[^\s)]+?):\d+:\d+/); if (m) urls.add(m[1]); }
    const index = [];
    for (const u of urls) {
      const text = await page.evaluate((u) => fetch(u).then((r) => r.text()).catch((e) => 'ERR ' + e.message), u);
      const name = `s${index.length}-${path.basename(new URL(u).pathname)}`;
      fs.writeFileSync(path.join(OUT, 'src', name), text); index.push({ name, url: u, bytes: text.length });
    }
    fs.writeFileSync(path.join(OUT, 'src', 'index.json'), JSON.stringify(index, null, 1));
    console.log(`REPORT src: ${raw.pull.length} pull writes, ${raw.regs.length} listener registrations, ${raw.obs.length} observers, ${index.length} scripts saved`);
    console.log('REGS', scrub(JSON.stringify(raw.regs.map((x) => [x.type, x.target, x.opt, x.frames[0]]))));
  } else {
    for (const step of STEPS) {
      await repin();
      const g = await page.evaluate(() => window.__h.geo());
      const target = Math.round(g.end * TARGET), lp0 = lpHits.length;
      console.log(`STEP ${step}: after re-pin scrollTop ${g.y} end ${g.end}`);
      let synth = false, info = '';
      if (step === 'ctl') { /* nothing */ }
      else if (step === 'synth') synth = true;
      else if (step === 'wheelup' || step === 'wheeldown') { await page.mouse.move(g.left + 300, g.top + 300); await page.mouse.wheel(0, step === 'wheelup' ? -120 : 120); await pause(1000); }
      else if (step === 'press') { const t = await thumb(); await page.mouse.move(t.x, t.y); await page.mouse.down(); await pause(300); await page.mouse.up(); await pause(1000); }
      else if (step === 'drag') { await drag(-160); await pause(1000); }
      else if (step === 'dragswallow' || step === 'dragswallowcommit' || step === 'dragswallowlate') {
        await page.evaluate(() => window.__h.swallow(true));
        await drag(-160);
        if (step === 'dragswallowlate') await pause(300);
        const n = await page.evaluate(() => window.__h.swallow(false));
        info = ` swallowed ${n} scroll events`;
        if (step === 'dragswallowcommit') { await pause(40); await page.evaluate(() => { const s = window.__h.sc(); s.scrollTop = s.scrollTop - 3000; s.dispatchEvent(new Event('scroll')); }); }
        await pause(1000);
      } else if (step === 'keyup') { await page.mouse.click(g.left + 300, g.top + 200); await page.keyboard.press('PageUp'); await pause(1000); }
      else if (step === 'write') { await page.evaluate(() => { const s = window.__h.sc(); s.scrollTop = s.scrollTop - 3000; }); await pause(1000); }
      else if (step === 'butter') {
        // Butter thumb release: drag the thumb from the end upward and let go, then wait as the harness trace does.
        await drag(-160); await pause(8000);
        info = ' ' + JSON.stringify(await page.evaluate(() => { const d = window.__seekDump?.(true); const s = d?.sessions?.at(-1); return s ? { reason: s.reason, canceled: s.canceled, destination: s.destination, timedOut: s.timedOut, releaseToReadableMs: s.releaseToReadableMs && Math.round(s.releaseToReadableMs) } : null; }));
      } else throw Error('unknown step ' + step);
      const g2 = await page.evaluate(() => window.__h.geo());
      console.log(`STEP ${step}: after input scrollTop ${g2.y} end ${g2.end} question ${g2.at}${info}`);
      if (lpHits.length > lp0) console.log(`LP ${step} during input: ${scrub(lpHits.slice(lp0).slice(0, 80).join(' | '))}`);
      await holdCheck(step, target, synth);
      await pause(800);
    }
  }
} catch (e) { console.log('HARNESS ERROR:', scrub(e.stack || e.message)); exit = 2; } finally { await browser?.close().catch(() => {}); }
process.exit(exit);
