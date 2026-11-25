// Veil acceptance stage D, part 2 (#177): one load of a long fixture with a stored layout record, on
// the veil build. Read-only for the chat: it navigates and scrolls, never types or sends.
//
//   LAB_ID=2 LAB_OWNER=<held lock owner> EXT=<veil build> [FIXTURE=math12] [OUT=<json>] \
//     node notes/runs/2026-11-24-veil-acceptance/stage-D/stored-layout-check.mjs
//
// 1. Restarts the lab browser with EXT, notes the stored `butter` value and the layout store's row
//    count (IndexedDB butter-layouts-v1, store geometry), then turns "Remember long-chat layouts"
//    on (opts.layout, layoutConsent granted; rail and bookmark on as in the stream runs).
// 2. Loads FIXTURE, loads all earlier history, scrolls through it a viewport at a time so every
//    turn is drawn and measured, flushes the layout cache and waits for new rows in the store.
// 3. Reloads, and samples every 500 ms for 12 s, then once per step of a second pass through the
//    chat: answer blocks computing opacity 0, blocks with data-butter-veil, rendered veiled blocks
//    (stream-veil-verdicts.mjs's check), and the turns and blocks with inline content-visibility
//    auto (the restored layout), with how many of those compute opacity 0 or carry the veil.
// 4. Switches layouts off with consent granted (the worker then clears the store), checks the row
//    count is back to what it was, and writes the `butter` value back as found.
// Verdicts: stored-layout-restored, stored-layout-none-opacity0, stored-layout-cv-not-veiled,
// stored-layout-opts-put-back. Counts only: no chat text, turn keys or URLs are printed.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { heldLab, startLab } from '../../../../lab/harness/seek-live-page.mjs';
import { veilCheckScript } from '../../../../lab/harness/stream-veil-verdicts.mjs';

const env = process.env;
const pause = ms => new Promise(r => setTimeout(r, ms));
const FIXTURE = env.FIXTURE || 'math12';
if (!env.EXT) { console.error('EXT= (the veil build) is required'); process.exit(2); }
const lab = heldLab(L, env);
const out = { fixture: FIXTURE, samples: [] };
let fails = 0;
const report = l => console.log(`REPORT ${l}`);
const verdict = (ok, check, why) => { console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); if (!ok) fails++; };

const extIdOf = dir => [...createHash('sha256').update(dir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');

// In an extension page: the `butter` value and the layout store's row count.
async function inExt(context, id, fn, arg) {
  const w = await context.newPage();
  try { await w.goto(`chrome-extension://${id}/popup/popup.html`); return await w.evaluate(fn, arg); } finally { await w.close().catch(() => {}); }
}
const storeState = async () => {
  const { butter, butterLayoutCleared } = await chrome.storage.local.get(['butter', 'butterLayoutCleared']);
  const rows = await new Promise(ok => {
    const r = indexedDB.open('butter-layouts-v1');
    r.onerror = () => ok(-1);
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('geometry')) { db.close(); return ok(0); }
      const c = db.transaction('geometry').objectStore('geometry').count();
      c.onsuccess = () => { db.close(); ok(c.result); };
      c.onerror = () => { db.close(); ok(-1); };
    };
  });
  return { butter: butter ?? null, cleared: butterLayoutCleared ?? null, rows };
};
const setButter = v => (v == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: v }));
// The worker's clear writes butterLayoutCleared (a new id each time); put it back as found too.
const setCleared = v => (v == null ? chrome.storage.local.remove('butterLayoutCleared') : chrome.storage.local.set({ butterLayoutCleared: v }));

// In the page: counts over every answer block in the chat.
function sample() {
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const sc = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  if (!sc) return null;
  const turns = [...sc.querySelectorAll('[data-turn-key]')], blocks = [...sc.querySelectorAll(BLOCKS)];
  const op0 = b => getComputedStyle(b).opacity === '0';
  const cvTurns = turns.filter(t => t.style.contentVisibility === 'auto');
  const cvBlocks = blocks.filter(b => b.style.contentVisibility === 'auto');
  const st = window.__heightCacheDump?.().stats ?? null;
  const num = st ? Object.fromEntries(Object.entries(st).filter(([, v]) => typeof v === 'number')) : null;
  return {
    y: Math.round(sc.scrollTop), H: sc.scrollHeight, turns: turns.length, blocks: blocks.length,
    opacity0: blocks.filter(op0).length, veilAttr: document.querySelectorAll('[data-butter-veil]').length,
    leaking: window.__veilCheck ? window.__veilCheck.count(sc) : null,
    unrendered: sc.querySelectorAll('[data-butter-unrendered]').length, inProgress: sc.querySelectorAll('[data-talvt-turn-state="in_progress"]').length,
    cvTurns: cvTurns.length, cvBlocks: cvBlocks.length, cvBlocksOpacity0: cvBlocks.filter(op0).length,
    cvBlocksVeil: cvBlocks.filter(b => b.hasAttribute('data-butter-veil') || b.closest('[data-butter-veil]')).length,
    cvTurnsOpacity0: cvTurns.filter(op0).length,
    stats: num, restoreMisses: st?.restoreMisses ?? null,
  };
}
const scrollTo = (page, f) => page.evaluate(f => { const sc = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0); sc.scrollTop = f === 'top' ? 0 : f === 'end' ? sc.scrollHeight : sc.scrollTop + sc.clientHeight * f; return { y: sc.scrollTop, H: sc.scrollHeight, vh: sc.clientHeight }; }, f);

// Every turn drawn once: top to end, 0.8 viewport per step.
async function pass(page, each) {
  await scrollTo(page, 'top'); await pause(800);
  for (let k = 0; k < 400; k++) {
    const g = await scrollTo(page, 0.8); await pause(250);
    if (each) await each(k);
    if (g.y + g.vh >= g.H - 2) break;
  }
}

let context, page, id, found = null, exit = 0;
try {
  ({ context, page } = await startLab(L, lab, env, env.EXT));
  const extDir = L.browserArgs(lab)?.extensions?.[0];
  if (!extDir) throw Error('no extension in the restarted browser');
  id = extIdOf(extDir);
  const build = await inExt(context, id, () => chrome.runtime.getManifest().version_name);
  found = await inExt(context, id, storeState);
  out.build = build; out.found = { rows: found.rows, opts: found.butter?.opts ?? null, layoutConsent: found.butter?.layoutConsent ?? null };
  report(`build ${build}, fixture ${FIXTURE}; stored as found: layout store rows ${found.rows}, opts ${JSON.stringify(found.butter?.opts ?? null)}, layoutConsent ${found.butter?.layoutConsent ?? '-'}`);
  const on = { ...(found.butter ?? {}), layoutConsent: 'granted', opts: { ...(found.butter?.opts ?? {}), rail: true, bookmark: true, layout: true } };
  await inExt(context, id, setButter, on);
  await page.addInitScript(veilCheckScript());

  // First load: make sure a record is stored.
  const t1 = Date.now();
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await pause(5000);
  let n = -1;
  for (let k = 0, stable = 0; k < 30 && stable < 3; k++) {
    await scrollTo(page, 'top'); await pause(1000);
    const c = await page.evaluate(() => document.querySelectorAll('.thread-scroll-container [data-turn-key]').length);
    stable = c === n ? stable + 1 : 0; n = c;
  }
  await pass(page);
  await pause(2000);
  await page.evaluate(() => window.__butterLayoutCache?.flush?.()).catch(() => {});
  let rows = found.rows;
  for (let k = 0; k < 30 && rows <= found.rows; k++) { await pause(1000); rows = (await inExt(context, id, storeState)).rows; }
  const s1 = await page.evaluate(sample);
  out.firstLoad = { turnsLoaded: n, rowsAfter: rows, sample: s1, ms: Date.now() - t1 };
  report(`first load: ${n} turns after loading earlier history, ${s1?.blocks} answer blocks; layout store rows ${found.rows} → ${rows}; cache stats ${JSON.stringify(s1?.stats)}`);
  if (rows <= found.rows) report('first load: no new layout row was stored');

  // Reload: the stored layout is restored.
  const t2 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  for (let k = 0; k < 24; k++) { const s = await page.evaluate(sample); if (s) out.samples.push({ phase: 'load', ms: Date.now() - t2, ...s }); await pause(500); }
  await pass(page, async k => { const s = await page.evaluate(sample); if (s) out.samples.push({ phase: 'pass', k, ms: Date.now() - t2, ...s }); });
  await pause(1500);
  const sEnd = await page.evaluate(sample); out.samples.push({ phase: 'end', ms: Date.now() - t2, ...sEnd });

  const S = out.samples;
  const max = k => Math.max(0, ...S.map(s => s[k] ?? 0));
  const restored = sEnd?.stats?.restored ?? null, blocksRestored = sEnd?.stats?.blocksRestored ?? null;
  report(`after reload: ${S.length} samples over ${sEnd?.ms} ms (${S.filter(s => s.phase === 'load').length} at load, ${S.filter(s => s.phase === 'pass').length} in a pass through the chat); turns ${sEnd?.turns}, answer blocks ${sEnd?.blocks}; restored turns ${restored}, blocks ${blocksRestored}, restore misses ${JSON.stringify(sEnd?.restoreMisses)}`);
  report(`after reload: turns with inline content-visibility auto, max ${max('cvTurns')} (end ${sEnd?.cvTurns}); answer blocks with it, max ${max('cvBlocks')} (end ${sEnd?.cvBlocks})`);
  report(`after reload, most in any sample: answer blocks at opacity 0 ${max('opacity0')}, data-butter-veil ${max('veilAttr')}, rendered veiled (veil check) ${max('leaking')}, data-butter-unrendered ${max('unrendered')}, in_progress ${max('inProgress')}; inline-cv blocks at opacity 0 ${max('cvBlocksOpacity0')}, veiled ${max('cvBlocksVeil')}; inline-cv turns at opacity 0 ${max('cvTurnsOpacity0')}`);
  report(`after reload, per sample (ms: scrollTop/scrollHeight, blocks, opacity0, veil, cvTurns/cvBlocks, restored): ${S.map(s => `${s.ms}:${s.y}/${s.H},${s.blocks},${s.opacity0},${s.veilAttr},${s.cvTurns}/${s.cvBlocks},${s.stats?.restored ?? '-'}`).join(' ')}`);
  verdict(restored > 0 && max('cvBlocks') > 0, 'stored-layout-restored', `restored turns ${restored}, blocks ${blocksRestored}, most inline-cv blocks in a sample ${max('cvBlocks')}: no stored layout was restored, so the check did not run`);
  verdict(max('opacity0') === 0 && max('leaking') === 0, 'stored-layout-none-opacity0', `answer blocks at opacity 0: most ${max('opacity0')} in a sample (rendered veiled ${max('leaking')})`);
  verdict(max('cvBlocksVeil') === 0 && max('cvBlocksOpacity0') === 0 && max('cvTurnsOpacity0') === 0, 'stored-layout-cv-not-veiled', `inline-cv blocks veiled ${max('cvBlocksVeil')}, at opacity 0 ${max('cvBlocksOpacity0')}; turns at opacity 0 ${max('cvTurnsOpacity0')}`);
} catch (e) {
  console.error(`ERROR ${e.stack || e}`); exit = 2;
} finally {
  if (context && id && found) {
    try {
      // Layouts off with consent granted makes the worker clear the store; then the value as found.
      await inExt(context, id, setButter, { ...(found.butter ?? {}), layoutConsent: 'granted', opts: { ...(found.butter?.opts ?? {}), layout: false } });
      let st = null;
      for (let k = 0; k < 20; k++) { await pause(500); st = await inExt(context, id, storeState); if (st.rows <= found.rows) break; }
      const rowsCleared = st.rows;
      await inExt(context, id, setButter, found.butter);
      await pause(500);
      await inExt(context, id, setCleared, found.cleared);
      const after = await inExt(context, id, storeState);
      const same = JSON.stringify(after.butter) === JSON.stringify(found.butter) && after.cleared === found.cleared;
      out.putBack = { rowsCleared, rows: after.rows, same };
      report(`put back: layout store rows ${rowsCleared} after layouts off, ${after.rows} at the end (found ${found.rows}); butter and butterLayoutCleared values same as found ${same} (cleared key found ${found.cleared == null ? 'absent' : 'present'}, now ${after.cleared == null ? 'absent' : after.cleared === found.cleared ? 'the same' : 'different'}), opts ${JSON.stringify(after.butter?.opts ?? null)}`);
      verdict(same && after.rows === found.rows, 'stored-layout-opts-put-back', `butter same ${same}, rows ${after.rows} against ${found.rows}`);
    } catch (e) { console.error(`ERROR put back: ${e.message}`); exit = 2; }
  }
  if (env.OUT) fs.writeFileSync(env.OUT, JSON.stringify(out, null, 1));
  console.log(`SUMMARY ${fails ? 'FAIL' : 'PASS'} (${fails} FAIL)`);
  process.exit(exit || (fails ? 1 : 0));
}
