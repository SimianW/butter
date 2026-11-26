// Shared by the seek live harnesses (seek-landing-live.mjs, seek-pin-live.mjs): the lock check, the
// browser restart with the run's extensions, opening a fixture with all earlier history loaded, the
// page probe `window.__sl` and the native scrollbar thumb's position. Indices and pixel numbers only.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { switchOn } from './runner/options.mjs';

const pause = ms => new Promise(r => setTimeout(r, ms));

// The lab the run borrows: exits 2 unless LAB_OWNER holds its lock.
export function heldLab(L, env) {
  if (!env.LAB_OWNER) { console.error('LAB_OWNER= is required: take the lab lock first (lab/README.md, "One lock per sequence")'); process.exit(2); }
  const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
  const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
  if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}, not ${env.LAB_OWNER}`); process.exit(2); }
  return lab;
}

// Restarts the lab browser with exactly `ext` (empty: none), connects with the send guard on and
// keeps one ChatGPT tab. It writes no settings unless `scrolling` is set: then, with Butter, it
// switches Smoother scrolling on for the run (it starts off), and the caller must call the returned
// `restoreOptions()` in its `finally`, before closing the browser, to put the stored settings back.
export async function startLab(L, lab, env, ext, { scrolling = false } = {}) {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: ext, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(Number(env.LAB_SETTLE_MS ?? 2500)); // the restarted browser settles; 0 in the unit test
  const { browser, context } = await L.connect(lab);
  if (typeof (await L.sendGuard(context, lab)) !== 'function') { await browser.close().catch(() => {}); throw Error('send guard not installed'); }
  const page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  const restoreOptions = ext && scrolling ? await switchOn(L, lab, context) : null;
  return { browser, context, page, restoreOptions };
}

// Opens the fixture, installs the probe and loads all earlier history; returns the entry count.
export async function openFixture(L, lab, page, fixture, butter) {
  await page.goto(L.fixture(lab, fixture), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  if (butter) await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.evaluate(seekPage);
  await pause(6000);
  let n = -1;
  for (let k = 0, stable = 0; k < 40 && stable < 4; k++) {
    await page.evaluate(() => window.__sl.top(280)); await pause(30);
    await page.evaluate(() => window.__sl.top(0)); await pause(1000);
    const c = await page.evaluate(() => window.__sl.entries());
    stable = c === n ? stable + 1 : 0; n = c;
  }
  return n;
}

// The native thumb's centre for scroll fraction f (geo() from the probe; `arrow` px scrollbar buttons).
export function thumbAt(g, f, arrow) {
  const track = g.vh - 2 * arrow, thumb = Math.max(20, track * g.vh / g.h);
  return { x: Math.round(g.right - 5), y: Math.round(g.top + arrow + (track - thumb) * f + thumb / 2) };
}

// Runs in the page (page.evaluate(seekPage)).
export function seekPage() {
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const order = () => {
    const t = sc()?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) { const e = f.memoizedProps?.entries; if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) return e.map(x => x.turnKey); }
    return [];
  };
  // The header's overlap of the scroller, as the seek preview computes it (place()).
  const inset = () => {
    const s = sc(), sr = s.getBoundingClientRect();
    return [...document.querySelectorAll('header')].map(h => h.getBoundingClientRect()).filter(r => r.height > 0 && r.bottom > sr.top && r.bottom < sr.top + 200 && r.right > sr.left).reduce((m, r) => Math.max(m, r.bottom - sr.top), 0);
  };
  window.__sl = {
    entries: () => order().length,
    geo() { const s = sc(), r = s.getBoundingClientRect(); return { top: r.top, right: r.right, left: r.left, y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight }; },
    put(f) { const s = sc(); s.scrollTop = (s.scrollHeight - s.clientHeight) * f; },
    top(edge) { const s = sc(); s.scrollTop = edge; },
    // The question at the view's top: the turn covering y = scroller top + header inset + 1.
    // Where question j's turn is relative to the view's top (null: not mounted).
    target(j) {
      const s = sc(), sr = s.getBoundingClientRect(), ids = order(), t = s.querySelector(`[data-turn-key="${CSS.escape(ids[j] || '')}"]`);
      const b = t?.getBoundingClientRect();
      return { mounted: !!b && b.height > 0, top: b && b.height > 0 ? Math.round(b.top - sr.top - inset()) : null, h: b ? Math.round(b.height) : null, mountedTurns: [...s.querySelectorAll('[data-turn-key]')].map(x => ids.indexOf(x.getAttribute('data-turn-key'))) };
    },
    // scrollTop, scrollHeight and the mounted turns as [question, top relative to the scroller, height].
    sample() {
      const s = sc(), sr = s.getBoundingClientRect(), ids = order();
      return { y: Math.round(s.scrollTop), h: Math.round(s.scrollHeight), turns: [...s.querySelectorAll('[data-turn-key]')].map(t => { const b = t.getBoundingClientRect(); return [ids.indexOf(t.getAttribute('data-turn-key')), Math.round(b.top - sr.top), Math.round(b.height)]; }) };
    },
    landed() {
      const s = sc(), sr = s.getBoundingClientRect(), ids = order(), yTop = sr.top + inset() + 1;
      for (const t of s.querySelectorAll('[data-turn-key]')) {
        const b = t.getBoundingClientRect();
        if (b.height > 0 && b.top <= yTop && b.bottom > yTop) return { turn: ids.indexOf(t.getAttribute('data-turn-key')), offset: Math.round(yTop - b.top), entries: ids.length, y: Math.round(s.scrollTop), inset: Math.round(inset()) };
      }
      return { turn: null, entries: ids.length, y: Math.round(s.scrollTop), inset: Math.round(inset()) };
    },
    preview() {
      const host = document.querySelector('butter-seek-preview');
      const shown = !!host && parseFloat(getComputedStyle(host).opacity) > 0 && host.getBoundingClientRect().height > 0;
      const d = window.__seekDump?.(true);
      const u = d?.updates?.at(-1);
      const sr = host?.shadowRoot, est = sr?.querySelector('.est'), fade = sr?.querySelector('.fade'), notice = sr?.querySelector('.notice');
      // What it draws: stored layout items, or (no layout) the estimate of one question from its start.
      const drawn = { est: !!est && !est.hidden, estTop: est && !est.hidden ? parseFloat(est.style.top) || 0 : null, unseen: !!fade && !fade.hidden && fade.classList.contains('unseen'), notice: !!notice && !notice.hidden };
      return { shown, drawn, items: sr?.querySelector('.layer')?.childElementCount ?? null, active: d?.active ?? null, updates: d?.updateCount ?? null, last: u ? { turn: u.turn, offset: u.offset, layout: u.layout, known: u.known, top: Math.round(u.top) } : null, session: d?.sessions?.at(-1) ? (({ kind, reason, canceled, landingErrorPx, turnTopErrorPx, destination, semantic, releaseToReadableMs, timedOut }) => ({ kind, reason, canceled, landingErrorPx, turnTopErrorPx, destination, semantic, releaseToReadableMs: releaseToReadableMs == null ? null : Math.round(releaseToReadableMs), timedOut }))(d.sessions.at(-1)) : null };
    },
  };
}
