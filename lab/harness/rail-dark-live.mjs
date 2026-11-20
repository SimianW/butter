// The rail in ChatGPT's dark theme (2026-11-18 live features, item 5). Switches ChatGPT to dark the
// way the 2026-11-16 scrollbar-cover run did (the `codex_appearance_theme` cookie and
// localStorage.theme), reloads a fixture with Butter, checks that the rail's host has `data-dark` and
// that the ticks stand out from the page, then puts the theme back exactly as it was and confirms it
// after a reload. Read-only on chats, send guard on. Needs the lab lock you hold (LAB_OWNER).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked Butter dir> [FIXTURE=ats12] [SHOT=<png>] node lab/harness/rail-dark-live.mjs
// Checks: dark-page, dark-host, dark-ticks-visible, light-restored, light-host. Exit 1 on FAIL, 2 on setup error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'ats12';
const pause = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, exit = 0;
const verdict = (ok, check, why) => { if (!ok) fails++; console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`); };
const report = s => console.log(`REPORT ${s}`);
if (!env.LAB_OWNER || !env.EXT) { console.error('LAB_OWNER= and EXT= are required'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }

function probe() {
  const html = document.documentElement, host = document.querySelector('chatgpt-butter-nav');
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
  const bars = host?.shadowRoot ? [...host.shadowRoot.querySelectorAll('.tick > .bar')] : [];
  const bar = bars[0], hb = bar?.getBoundingClientRect();
  // The page colour behind the rail: the topmost non-Butter element under the bar.
  let bg = null;
  if (hb) {
    const under = document.elementsFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2).filter(e => e !== host);
    for (const e of under) for (let x = e; x && !bg; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent') bg = c; }
  }
  bg ||= getComputedStyle(document.body).backgroundColor;
  const cs = bar ? getComputedStyle(bar) : null;
  const barColor = cs ? cs.backgroundColor : null;
  const blend = (fg, back, a) => fg.slice(0, 3).map((v, i) => v * a + back[i] * (1 - a));
  const ops = bars.map(b => parseFloat(b.style.opacity) || parseFloat(getComputedStyle(b).opacity));
  const rest = Math.min(...ops), lit = Math.max(...ops);
  const fg = barColor ? rgb(barColor) : null, back = rgb(bg);
  const fgA = fg && fg.length > 3 ? fg[3] : 1;
  return {
    htmlClass: html.className, dataTheme: html.getAttribute('data-theme'), appearance: html.getAttribute('data-appearance-mode'),
    colorScheme: getComputedStyle(html).colorScheme, bodyBg: getComputedStyle(document.body).backgroundColor, lsTheme: localStorage.getItem('theme'),
    host: !!host, hostDark: !!host?.hasAttribute('data-dark'), ticks: bars.length, barColor, bgBehind: bg, barSize: hb ? [hb.width, hb.height] : null,
    restOpacity: rest, litOpacity: lit,
    contrastRest: fg ? contrast(blend(fg, back, rest * fgA), back) : null, contrastLit: fg ? contrast(blend(fg, back, lit * fgA), back) : null,
  };
}

let browser;
let original = null, originalLs = null, restored = false, context, page;
const COOKIE = 'codex_appearance_theme';
async function setTheme(value, ls) {
  const cur = (await context.cookies('https://chatgpt.com')).find(c => c.name === COOKIE);
  const base = cur || original || { domain: '.chatgpt.com', path: '/', expires: Math.floor(Date.now() / 1000) + 365 * 86400, httpOnly: false, secure: true, sameSite: 'Lax' };
  if (value == null) await context.clearCookies({ name: COOKIE });
  else await context.addCookies([{ name: COOKIE, value, domain: base.domain, path: base.path, expires: base.expires, httpOnly: base.httpOnly, secure: base.secure, sameSite: base.sameSite }]);
  await page.evaluate(v => (v == null ? localStorage.removeItem('theme') : localStorage.setItem('theme', v)), ls);
}
async function open() {
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await pause(5000);
  await page.mouse.move(700, 500); await pause(800);
  return page.evaluate(probe);
}
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  const light0 = await open();
  original = (await context.cookies('https://chatgpt.com')).find(c => c.name === COOKIE) || null;
  originalLs = light0.lsTheme;
  report(`before: cookie ${original ? JSON.stringify(original.value) : 'absent'}, localStorage.theme ${JSON.stringify(originalLs)}; ${JSON.stringify(light0)}`);

  await setTheme('dark', 'dark');
  await pause(20000);
  const dark = await open();
  report(`dark: ${JSON.stringify(dark)}`);
  verdict(/dark/.test(dark.colorScheme) || dark.dataTheme === 'dark', 'dark-page', `ChatGPT did not switch: color-scheme ${dark.colorScheme}, data-theme ${dark.dataTheme}`);
  verdict(dark.hostDark, 'dark-host', `chatgpt-butter-nav has no data-dark (html class ${JSON.stringify(dark.htmlClass)}, data-theme ${dark.dataTheme}, color-scheme ${dark.colorScheme})`);
  verdict(dark.contrastRest >= 1.5 && dark.contrastLit >= 3, 'dark-ticks-visible', `contrast rest ${dark.contrastRest}, lit ${dark.contrastLit} (bar ${dark.barColor} on ${dark.bgBehind})`);
  if (env.SHOT) {
    const box = await page.evaluate(() => { const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.rail').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    await page.screenshot({ path: env.SHOT, clip: { x: Math.max(0, box.x - 8), y: box.y, width: Math.min(box.width + 16, 1600 - Math.max(0, box.x - 8)), height: box.height } }).catch(() => {});
  }

  await setTheme(original?.value ?? null, originalLs);
  restored = true;
  await pause(20000);
  const light1 = await open();
  const cookieNow = (await context.cookies('https://chatgpt.com')).find(c => c.name === COOKIE) || null;
  report(`after restore: cookie ${cookieNow ? JSON.stringify(cookieNow.value) : 'absent'}, localStorage.theme ${JSON.stringify(light1.lsTheme)}; ${JSON.stringify(light1)}`);
  verdict((cookieNow?.value ?? null) === (original?.value ?? null) && light1.lsTheme === originalLs && light1.colorScheme === light0.colorScheme && light1.dataTheme === light0.dataTheme, 'light-restored', `cookie ${cookieNow?.value}, localStorage ${light1.lsTheme}, color-scheme ${light1.colorScheme}, data-theme ${light1.dataTheme}`);
  verdict(!light1.hostDark, 'light-host', 'chatgpt-butter-nav still has data-dark in the light theme');
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
  if (!restored && context && page) { try { await setTheme(original?.value ?? null, originalLs); report('theme put back after the error'); } catch {} }
} finally { await browser?.close().catch(() => {}); }
console.log(`SUMMARY dark: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
