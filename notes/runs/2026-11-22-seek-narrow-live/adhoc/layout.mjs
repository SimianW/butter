// Ad-hoc, step 3: MODE=state|on|measure|probe|off. Writes only the extension's own storage (on/off).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import * as L from '~/.local/share/chatgpt-lab/lib/lab.mjs';
const env = process.env, MODE = env.MODE, EXT = env.EXT;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lab = { ...L.getLab(2), owner: env.LAB_OWNER };
if (env.RESTART) {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: '2', LAB_EXTENSIONS: EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
}
const { browser, context } = await L.connect(lab);
if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
const page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
for (const o of context.pages()) if (o !== page) await o.close();
let worker = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'));
if (!worker && (MODE !== 'measure' && MODE !== 'probe')) {
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  worker = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://')) || (await context.waitForEvent('serviceworker', { timeout: 20000 }));
}
const storeState = () => worker.evaluate(async () => {
  const all = await chrome.storage.local.get(null);
  const dbs = (await indexedDB.databases()).map((d) => [d.name, d.version]);
  let rows = null;
  if (dbs.some(([n]) => n === 'butter-layouts-v1')) {
    const db = await new Promise((ok, no) => { const r = indexedDB.open('butter-layouts-v1'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    rows = {};
    for (const s of db.objectStoreNames) rows[s] = await new Promise((ok) => { const r = db.transaction(s).objectStore(s).count(); r.onsuccess = () => ok(r.result); });
    db.close();
  }
  return { keys: Object.keys(all), butter: all.butter ?? null, cleared: 'butterLayoutCleared' in all, dbs, rows, normalized: ButterStatus.normalize(all.butter) };
});
const sc = () => page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0); return s ? { y: Math.round(s.scrollTop), h: s.scrollHeight, vh: s.clientHeight } : null; });
const storageDump = () => page.evaluate(() => { const d = window.__seekDump?.(true); const st = d?.storage; return { storage: st && Object.fromEntries(Object.entries(st).filter(([, v]) => typeof v !== 'object' || v === null)), butterOff: document.documentElement.getAttribute('data-butter-off') }; });
try {
  if (MODE === 'state') console.log('STATE', JSON.stringify(await storeState()));
  if (MODE === 'on') {
    console.log('BEFORE', JSON.stringify(await storeState()));
    // The popup's own toggle: ButterStatus.toggleGroup(settings, 'layout') grants consent and turns layout on.
    await worker.evaluate(async () => { const { butter } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: ButterStatus.toggleGroup(butter, 'layout') }); });
    await pause(500);
    console.log('AFTER', JSON.stringify(await storeState()));
  }
  if (MODE === 'off') {
    console.log('BEFORE', JSON.stringify(await storeState()));
    await worker.evaluate(async () => { const { butter } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: ButterStatus.toggleGroup(butter, 'layout') }); });
    await pause(2000);
    console.log('TOGGLED OFF', JSON.stringify(await storeState()));
    if (env.REMOVE_KEYS) { await worker.evaluate((ks) => chrome.storage.local.remove(ks), env.REMOVE_KEYS.split(',')); await pause(500); console.log('KEYS REMOVED', JSON.stringify(await storeState())); }
  }
  if (MODE === 'measure') {
    await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
    await pause(6000);
    console.log('OPENED', JSON.stringify(await sc()), JSON.stringify(await storageDump()));
    // Load all earlier history, as the seek harness does.
    let n = -1;
    for (let k = 0, stable = 0; k < 40 && stable < 4; k++) {
      await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0); s.scrollTop = 280; });
      await pause(30);
      await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0); s.scrollTop = 0; });
      await pause(1000);
      const c = await page.evaluate(() => document.querySelectorAll('.thread-scroll-container [data-turn-key]').length + ':' + (window.__seekDump?.(true)?.sessions?.length ?? 0));
      const h = (await sc()).h;
      stable = h === n ? stable + 1 : 0; n = h;
    }
    console.log('HISTORY', JSON.stringify(await sc()));
    // 2026-11-22 additions: UP=1 wheels from the end up to the top instead of down. today the chat sits at its end after the history loop; start the wheel at the top.
    if (env.FROMTOP) { await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0); s.scrollTop = 0; }); await pause(3000); console.log('FROMTOP', JSON.stringify(await sc())); }
    // Scroll through the whole chat with the wheel, top to end, so each turn mounts and is measured.
    const box = await page.evaluate(() => { const r = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(box.x, box.y);
    const STEP = Number(env.STEP || 600), PAUSE = Number(env.PAUSE || 120);
    let k = 0, last = -1, same = 0;
    while (k < 5000) {
      const y0 = env.FROMTOP ? (await sc()).y : 0;
      await page.mouse.wheel(0, env.UP ? -STEP : STEP); await pause(PAUSE); k++;
      if (env.FROMTOP) { const y1 = (await sc()).y; if (Math.abs(y1 - y0) > 5000) console.log('JUMP', k, y0, '->', y1); }
      if (k % 50 === 0) { const g = await sc(); console.log('STEP', k, JSON.stringify(g), JSON.stringify(await storageDump())); if (env.UP ? g.y <= 2 : g.y + g.vh >= g.h - 2) { if (++same > 2) break; } }
      if (k % 50 === 0) { await pause(1500); }
    }
    await pause(8000);
    await page.evaluate(() => window.__butterLayoutCache?.flush?.());
    await pause(4000);
    console.log('END', JSON.stringify(await sc()), JSON.stringify(await storageDump()));
  }
  if (MODE === 'probe') {
    const out = await page.evaluate(() => {
      const d = window.__seekDump?.(true);
      return { butterOff: document.documentElement.getAttribute('data-butter-off'), sessions: (d?.sessions || []).map((a) => ({ reason: a.reason, destination: a.destination, model: a.model, finds: a.finds, retargets: a.retargets && a.retargets.map((r) => ({ t: Math.round(r.t), drift: r.drift })), commitRetarget: a.commitRetarget, semantic: a.semantic, startTop: a.startTop && Math.round(a.startTop), realTop: a.realTop && Math.round(a.realTop), landingErrorPx: a.landingErrorPx && Math.round(a.landingErrorPx), releaseToCommitMs: a.releaseToCommitMs && Math.round(a.releaseToCommitMs), releaseToReadableMs: a.releaseToReadableMs && Math.round(a.releaseToReadableMs), timedOut: a.timedOut, textFallback: a.textFallback })), storage: d?.storage && Object.fromEntries(Object.entries(d.storage).filter(([, v]) => typeof v !== 'object' || v === null)) };
    });
    console.log('PROBE', JSON.stringify(out));
  }
} finally { await browser.close().catch(() => {}); }
