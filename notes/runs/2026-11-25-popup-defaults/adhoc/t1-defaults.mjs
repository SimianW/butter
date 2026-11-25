// T1 (adhoc, PR #181): a fresh install's defaults on the real page. On a lock you hold:
//   LAB_ID=2 LAB_OWNER=<owner> EXT=<new unpacked dev build path> [FIXTURE=math12] [AT=0.5]
//   node notes/runs/2026-11-25-popup-defaults/adhoc/t1-defaults.mjs
// Restarts the lab browser with EXT only (its path is new, so its storage starts empty), then checks:
// the stored settings after install, <html data-butter-off>, the rail without any setting written,
// and that a real thumb drag shows no seek preview while Smoother scrolling is off; then switches
// Smoother scrolling on with the popup's own switch and checks the attribute and the preview again
// without a reload. Puts the stored settings back as found. Send guard on (startLab); read-only
// on ChatGPT apart from scrollbar drags and scrollTop writes. Logs booleans, indices and pixels.
import os from 'node:os';
import { heldLab, startLab, openFixture, thumbAt } from '../../../../lab/harness/seek-live-page.mjs';
import { extensionId } from '../../../../lab/harness/runner/options.mjs';

const L = await import(`${os.homedir()}/.local/share/chatgpt-lab/lib/lab.mjs`);
const env = process.env;
const FIXTURE = env.FIXTURE || 'math12', ARROW = 15, AT = Number(env.AT ?? 0.5);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, exit = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = (s) => console.log(`REPORT ${s}`);
const lab = heldLab(L, env);
if (!env.EXT) { console.error('EXT=<unpacked build> is required'); process.exit(2); }

let browser, context, page, found;
const popupUrl = `chrome-extension://${extensionId(env.EXT)}/popup/popup.html`;
// Runs fn in a fresh tab of the extension's popup page (as runner/options.mjs does).
async function inExtension(fn, arg) {
  const p = await context.newPage();
  try { await p.goto(popupUrl); return await p.evaluate(fn, arg); } finally { await p.close().catch(() => {}); }
}
const readStored = () => inExtension(async () => (await chrome.storage.local.get('butter')).butter ?? null);
const offList = () => page.evaluate(() => (document.documentElement.getAttribute('data-butter-off') || '').split(/\s+/).filter(Boolean));
const sessions = () => page.evaluate(() => window.__seekDump?.(true)?.sessions?.length ?? null);

// A real thumb drag from the end to fraction AT, held, then let go (as seek-pin-live.mjs drags).
async function drag(label) {
  await page.bringToFront();
  await page.evaluate(() => window.__sl.put(1)); await pause(1500);
  const g = await page.evaluate(() => window.__sl.geo());
  const before = { y: Math.round(g.y), sessions: await sessions(), dump: await page.evaluate(() => typeof window.__seekDump === 'function') };
  const end1 = thumbAt(g, 1, ARROW), from = { x: end1.x, y: Math.round(g.top + g.vh - 18) };
  const to = { x: from.x, y: thumbAt(g, AT, ARROW).y + from.y - end1.y };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let k = 1; k <= 4; k++) { await page.mouse.move(from.x, Math.round(from.y + (to.y - from.y) * k / 4), { steps: 4 }); await pause(250); }
  await pause(600);
  const held = await page.evaluate(() => ({ y: Math.round(window.__sl.geo().y), pv: window.__sl.preview(), host: !!document.querySelector('butter-seek-preview') }));
  await page.mouse.up();
  await pause(3000);
  const after = { y: Math.round((await page.evaluate(() => window.__sl.geo())).y), sessions: await sessions() };
  report(`${label}: thumb ${from.y} → ${to.y}; scrollTop end ${before.y} → held ${held.y} → after ${after.y} (viewport ${g.vh}); __seekDump ${before.dump}; preview host ${held.host}, shown ${held.pv.shown}, active ${held.pv.active}, updates ${held.pv.updates}; sessions ${before.sessions} → ${after.sessions}`);
  return { before, held, after, vh: g.vh };
}

try {
  ({ browser, context, page } = await startLab(L, lab, env, env.EXT));
  report(`build ${await inExtension(() => chrome.runtime.getManifest().version_name)}`);
  // The install event's own write: wait up to 5 s for its marker.
  let stored = null;
  for (let i = 0; i < 10 && !(stored?.defaultsVersion >= 2); i++) { stored = await readStored(); if (!(stored?.defaultsVersion >= 2)) await pause(500); }
  found = stored;
  const keys = await inExtension(async () => Object.keys(await chrome.storage.local.get(null)).sort());
  report(`storage keys after install: ${JSON.stringify(keys)}`);
  verdict(JSON.stringify(stored) === JSON.stringify({ defaultsVersion: 2 }), 'install settings {defaultsVersion: 2}, no opts', `stored ${JSON.stringify(stored)}`);

  const n = await openFixture(L, lab, page, FIXTURE, true);
  report(`${FIXTURE}: history loaded, ${n} entries (Smoother scrolling off: native loading)`);
  const off = await offList();
  report(`data-butter-off: ${JSON.stringify(off)}`);
  verdict(off.includes('older') && off.includes('seek'), 'data-butter-off lists older and seek', JSON.stringify(off));
  verdict(!off.includes('rail') && !off.includes('bookmark'), 'data-butter-off does not list rail or bookmark', JSON.stringify(off));
  const rail = await page.evaluate(() => document.querySelectorAll('chatgpt-butter-nav[data-on]').length);
  const afterRail = await readStored();
  verdict(rail > 0 && JSON.stringify(afterRail) === JSON.stringify(found), 'rail on with no setting written', `rail elements ${rail}, stored ${JSON.stringify(afterRail)}`);

  const a = await drag('drag with Smoother scrolling off');
  const scrolled = a.before.y - a.held.y > a.vh;
  verdict(!a.held.pv.shown && !a.held.pv.active && a.after.sessions === a.before.sessions, 'no seek preview with Smoother scrolling off', `shown ${a.held.pv.shown}, active ${a.held.pv.active}, sessions ${a.before.sessions} → ${a.after.sessions}`);
  verdict(scrolled, 'the drag scrolls the chat natively', `scrollTop ${a.before.y} → held ${a.held.y}`);

  // Switch Smoother scrolling on with the popup's own switch (Experimental page), no page reload.
  const p = await context.newPage();
  try {
    await p.goto(popupUrl);
    await p.locator('[data-go="experimental"]').click();
    const sw = p.locator('#sw-scrolling');
    report(`popup Smoother scrolling switch before: aria-checked ${await sw.getAttribute('aria-checked')}`);
    await sw.click();
    for (let i = 0; i < 20 && (await sw.getAttribute('aria-checked')) !== 'true'; i++) await pause(100);
    report(`popup Smoother scrolling switch after: aria-checked ${await sw.getAttribute('aria-checked')}`);
    await pause(500);
  } finally { await p.close().catch(() => {}); }
  const on = await readStored();
  report(`stored after the switch: opts.older ${on?.opts?.older}, opts.seek ${on?.opts?.seek}, opts.rail ${on?.opts?.rail}, opts.bookmark ${on?.opts?.bookmark}, defaultsVersion ${on?.defaultsVersion}`);
  verdict(on?.opts?.older === true && on?.opts?.seek === true, 'switch stores older and seek on', JSON.stringify(on?.opts));
  let off2 = await offList();
  for (let i = 0; i < 30 && (off2.includes('older') || off2.includes('seek')); i++) { await pause(100); off2 = await offList(); }
  report(`data-butter-off after the switch: ${JSON.stringify(off2)}`);
  verdict(!off2.includes('older') && !off2.includes('seek'), 'data-butter-off drops older and seek without a reload', JSON.stringify(off2));
  const b = await drag('drag with Smoother scrolling on');
  verdict(b.held.pv.shown && (b.after.sessions ?? 0) > (b.before.sessions ?? 0), 'seek preview with Smoother scrolling on', `shown ${b.held.pv.shown}, sessions ${b.before.sessions} → ${b.after.sessions}`);
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/(https?|chrome-extension):\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally {
  if (context && found !== undefined) {
    const same = await inExtension(async (value) => {
      await (value == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: value }));
      return JSON.stringify((await chrome.storage.local.get('butter')).butter ?? null) === JSON.stringify(value);
    }, found).catch(() => false);
    verdict(same, 'stored settings put back as found', 'they differ');
  }
  await browser?.close().catch(() => {});
}
console.log(`SUMMARY t1-defaults: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
