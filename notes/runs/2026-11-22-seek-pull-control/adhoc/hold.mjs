// Ad-hoc, stage 2 step 2: does a scrollTop write hold on math12 after all history is loaded?
// LAB_ID=2 LAB_OWNER=<owner> [EXT=<dir or empty>] [TOPS=0,229284] [REPS=3] [MS=6000] node hold.mjs
// Restarts the lab browser with EXT (empty: no extension), loads the fixture, loads all earlier history
// as seek-landing-live.mjs does, then per rep and per target writes scrollTop once and samples, in the
// page, scrollTop/scrollHeight every 100 ms for MS ms. A probe wraps the scrollTop setter, scrollTo,
// scrollBy and scrollIntoView and logs every write landing within 2 viewports of the end (caller
// function names only, no URLs). Read-only otherwise; send guard on.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as L from '~/.local/share/chatgpt-lab/lib/lab.mjs';
const env = process.env, EXT = env.EXT ?? '';
const TOPS = (env.TOPS || '0,229284').split(',').map(Number), REPS = Number(env.REPS || 3), MS = Number(env.MS || 6000);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (!env.LAB_OWNER || held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const scrub = (s) => String(s).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>');
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
  await page.addInitScript(() => {
    const log = (window.__pullLog = []);
    const near = (el, v) => el && el.classList?.contains('thread-scroll-container') && v > el.scrollHeight - 3 * el.clientHeight;
    const who = () => (new Error().stack || '').split('\n').slice(3, 9).map((l) => (l.trim().match(/^at (\S+)/) || [])[1] || '?').join(' < ');
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get: d.get, set(v) { if (near(this, v)) log.push([Math.round(performance.now()), 'scrollTop=', Math.round(v), who()]); return d.set.call(this, v); } });
    for (const m of ['scrollTo', 'scroll', 'scrollBy']) {
      const o = Element.prototype[m];
      Element.prototype[m] = function (a, b) { const v = typeof a === 'object' && a ? a.top : b; const to = m === 'scrollBy' ? this.scrollTop + (v || 0) : v; if (to != null && near(this, to)) log.push([Math.round(performance.now()), m, Math.round(to), who()]); return o.apply(this, arguments); };
    }
    const siv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () { log.push([Math.round(performance.now()), 'scrollIntoView', this.tagName, who()]); return siv.apply(this, arguments); };
  });
  await page.goto(L.fixture(lab, env.FIXTURE || 'math12'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.evaluate(() => {
    const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
    const order = () => { const t = sc()?.querySelector('[data-turn-key]'); let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))]; for (let d = 0; f && d < 80; d++, f = f.return) { const e = f.memoizedProps?.entries; if (Array.isArray(e) && e.length && e.every((x) => typeof x?.turnKey === 'string')) return e.map((x) => x.turnKey); } return []; };
    const at = () => { const s = sc(), sr = s.getBoundingClientRect(), ids = order(), y = sr.top + 60; for (const t of s.querySelectorAll('[data-turn-key]')) { const b = t.getBoundingClientRect(); if (b.height > 0 && b.top <= y && b.bottom > y) return ids.indexOf(t.getAttribute('data-turn-key')); } return null; };
    window.__h = {
      sc, entries: () => order().length, at,
      geo: () => { const s = sc(); return { y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight, end: s.scrollHeight - s.clientHeight, at: at(), mounted: [...s.querySelectorAll('[data-turn-key]')].map((x) => order().indexOf(x.getAttribute('data-turn-key'))) }; },
      top: (v) => { sc().scrollTop = v; },
      async hold(v, ms) {
        const s = sc(), out = [], t0 = performance.now(), logFrom = window.__pullLog.length;
        let jumps = 0; const onScroll = () => { jumps++; }; s.addEventListener('scroll', onScroll);
        s.scrollTop = v;
        out.push([0, Math.round(s.scrollTop), s.scrollHeight, at()]);
        while (performance.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 100)); out.push([Math.round(performance.now() - t0), Math.round(s.scrollTop), s.scrollHeight, at()]); }
        s.removeEventListener('scroll', onScroll);
        return { samples: out, scrollEvents: jumps, writes: window.__pullLog.slice(logFrom).map((w) => [Math.round(w[0] - t0), ...w.slice(1)]) };
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
  for (let r = 1; r <= REPS; r++) for (const v of TOPS) {
    const before = await page.evaluate(() => window.__h.geo());
    const res = await page.evaluate(([v, ms]) => window.__h.hold(v, ms), [v, MS]);
    const end = before.end, s = res.samples;
    const pulled = s.find((x) => x[1] > x[2] - 2 * before.vh - 0 && x[1] > v + before.vh);
    const after = await page.evaluate(() => window.__h.geo());
    console.log(`REPORT rep ${r} scrollTop=${v}: before ${before.y} (end ${end}); first sample ${s[0][1]}; last ${s.at(-1)[1]} at ${s.at(-1)[0]} ms (question ${s.at(-1)[3]}); pulled to the end: ${pulled ? `yes, at ${pulled[0]} ms (scrollTop ${pulled[1]})` : 'no'}; samples ${s.length}; scroll events ${res.scrollEvents}; mounted after ${JSON.stringify(after.mounted)}`);
    console.log(`TRACE rep ${r} scrollTop=${v} [ms, scrollTop, scrollHeight, question]: ${JSON.stringify(s)}`);
    console.log(`WRITES rep ${r} scrollTop=${v} (near the end, or scrollIntoView): ${scrub(JSON.stringify(res.writes))}`);
    await pause(1500);
  }
} catch (e) { console.log('HARNESS ERROR:', scrub(e.message)); exit = 2; } finally { await browser?.close().catch(() => {}); }
process.exit(exit);
