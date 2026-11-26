// Earlier-history page size on live ChatGPT (2026-11-18 live features). Opens a fixture, wheels to
// its top with real wheel input until ChatGPT's turn list stops growing, and records the `num_turns`
// of every conversation GET (newest page and `/messages?before=` pages) as the network layer sees it,
// i.e. after Butter's page-world rewrite (history/conversation-main.js, shared/config-main.js).
// Read-only: the send guard is on and nothing is typed. Needs the lab lock you hold (LAB_OWNER).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked dir or empty> LABEL=<name> [FIXTURE=math12] [EXPECT=2]
//   node lab/harness/history-pages-live.mjs
// With an extension: PASS/FAIL older-page-size (every earlier page asks num_turns <= EXPECT).
// Without: REPORT only. Exit 1 on FAIL, 2 on a setup error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { switchOn } from './runner/options.mjs';

const env = process.env;
const label = env.LABEL || 'history', FIXTURE = env.FIXTURE || 'math12', EXPECT = Number(env.EXPECT || 2);
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, exit = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);
if (!env.LAB_OWNER) { console.error('LAB_OWNER= must name the lab lock you hold'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const PAGE = /\/backend-api\/conversations?\/[0-9a-f-]{36}(\/messages)?(?:\?|$)/;
let browser, restoreOptions;
try {
  if (env.EXT !== undefined) {
    execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
    for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
    await pause(2500);
  }
  let context; ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  const ext = L.browserArgs(lab)?.extensions[0] || null;
  const page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  // Smoother scrolling's `older` asks the small earlier pages this run checks; it starts off.
  restoreOptions = await switchOn(L, lab, context);
  const reqs = [];
  page.on('request', r => {
    if (r.method() !== 'GET' || !PAGE.test(r.url())) return;
    const u = new URL(r.url());
    reqs.push({ older: !!PAGE.exec(r.url())[1], numTurns: u.searchParams.get('num_turns'), before: u.searchParams.has('before'), keys: [...u.searchParams.keys()] });
  });
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('.ProseMirror:visible').first().waitFor();
  await pause(8000);
  const info = () => page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
    const t = s.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))], n = null;
    for (let d = 0; f && d < 80; d++, f = f.return) { const e = f.memoizedProps?.entries; if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) { n = e.length; break; } }
    const r = s.getBoundingClientRect();
    return { y: s.scrollTop, h: s.scrollHeight, entries: n, x: r.left + r.width / 2 - 150, cy: r.top + r.height / 2 };
  });
  let g = await info();
  report(`${ext ? path.basename(path.dirname(ext)) : 'native'} ${FIXTURE}: opened with ${g.entries} entries, scrollTop ${g.y} of ${g.h}`);
  await page.mouse.move(g.x, g.cy);
  let stable = 0, last = -1, wheels = 0;
  const t0 = Date.now();
  while (stable < 6 && Date.now() - t0 < 240000) {
    for (let k = 0; k < 10; k++) { await page.mouse.wheel(0, -6000); wheels++; await pause(60); }
    await pause(900);
    g = await info();
    stable = g.y <= 0 && g.entries === last ? stable + 1 : 0;
    last = g.entries;
  }
  report(`top reached: ${g.y <= 0}, entries ${g.entries}, ${wheels} wheel steps of -6000 px, ${Math.round((Date.now() - t0) / 1000)} s`);
  const older = reqs.filter(r => r.older), newest = reqs.filter(r => !r.older);
  report(`newest-page GETs: ${newest.length}, num_turns [${newest.map(r => r.numTurns).join(', ')}], params ${JSON.stringify([...new Set(newest.flatMap(r => r.keys))])}`);
  report(`earlier-page GETs: ${older.length}, num_turns [${older.map(r => r.numTurns).join(', ')}], before param on ${older.filter(r => r.before).length}, params ${JSON.stringify([...new Set(older.flatMap(r => r.keys))])}`);
  if (ext) verdict(older.length > 0 && older.every(r => Number(r.numTurns) <= EXPECT), 'older-page-size', older.length ? `num_turns [${older.map(r => r.numTurns).join(', ')}], expected <= ${EXPECT}` : 'no earlier-page GET seen');
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally { await restoreOptions?.().catch(() => {}); await browser?.close().catch(() => {}); }
console.log(`SUMMARY ${label}: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
