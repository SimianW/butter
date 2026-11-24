// Ad-hoc (2026-11-23 seek-pin-fix): put the dev build's layout memory back as found, in one run.
// Stage 1's cleanup.mjs + dbdelete.mjs: turn layout memory off with the popup's toggle value (the
// worker clears its rows), remove the keys, then restart the browser with the same build (the worker
// no longer holds the database open) and delete the layout database. LAB_OWNER must hold lab 2.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '~/.local/share/chatgpt-lab/lib/lab.mjs';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = process.env.EXT;
const id = [...crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const lab = L.getLab(2);
if (fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim() !== process.env.LAB_OWNER) throw Error('lock not held');
const state = (p) => p.evaluate(async () => {
  const all = await chrome.storage.local.get(null);
  const dbs = (await indexedDB.databases()).map((d) => [d.name, d.version]);
  let rows = null;
  if (dbs.some(([n]) => n === 'butter-layouts-v1')) {
    const db = await new Promise((ok, no) => { const r = indexedDB.open('butter-layouts-v1'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    rows = {};
    for (const s of db.objectStoreNames) rows[s] = await new Promise((ok) => { const r = db.transaction(s).objectStore(s).count(); r.onsuccess = () => ok(r.result); });
    db.close();
  }
  return { keys: Object.keys(all), layoutConsent: all.butter?.layoutConsent ?? null, layout: all.butter?.opts?.layout ?? null, dbs, rows };
});
{
  const { browser, context } = await L.connect(lab);
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('no guard');
  const p = await context.newPage();
  try {
    await p.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: 'load' });
    console.log('ID-OK', p.url().startsWith('chrome-extension://' + id));
    console.log('BEFORE', JSON.stringify(await state(p)));
    await p.evaluate(async () => { const { butter } = await chrome.storage.local.get('butter'); if (butter?.opts?.layout) await chrome.storage.local.set({ butter: ButterStatus.toggleGroup(butter, 'layout') }); });
    await pause(3000);
    console.log('LAYOUT OFF', JSON.stringify(await state(p)));
    await p.evaluate(() => chrome.storage.local.remove(['butter', 'butterLayoutMigrated', 'butterLayoutCleared']));
    await pause(500);
    console.log('KEYS REMOVED', JSON.stringify(await state(p)));
  } finally { await p.close().catch(() => {}); await browser.close().catch(() => {}); }
}
execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...process.env, LAB_ID: '2', LAB_EXTENSIONS: dir, LAB_FLAGS: '' }, stdio: 'pipe' });
for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
await pause(2500);
{
  const { browser, context } = await L.connect(lab);
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('no guard');
  const p = await context.newPage();
  try {
    await p.goto(`chrome-extension://${id}/manifest.json`, { waitUntil: 'load' });
    const look = () => p.evaluate(async () => ({ keys: Object.keys(await chrome.storage.local.get(null)), dbs: (await indexedDB.databases()).map((d) => [d.name, d.version]) }));
    console.log('RESTARTED', JSON.stringify(await look()));
    const del = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('butter-layouts-v1'); let blocked = false; r.onblocked = () => { blocked = true; }; r.onsuccess = () => ok({ deleted: true, blocked }); r.onerror = () => ok({ deleted: false, error: String(r.error) }); setTimeout(() => ok({ deleted: 'pending', blocked }), 30000); }));
    console.log('DELETE DB', JSON.stringify(del));
    console.log('AFTER', JSON.stringify(await look()));
  } finally { await p.close().catch(() => {}); await browser.close().catch(() => {}); }
}
