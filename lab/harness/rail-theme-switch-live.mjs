// The rail when ChatGPT's theme changes without a reload (2026-11-18 seek landing, bug B). Opens a
// fixture with Butter, opens ChatGPT's own settings (profile menu, Settings, Appearance), picks Dark,
// and checks that the rail's host (`chatgpt-butter-nav`) has `data-dark` within a second, and still
// after going Back to the chat; then the same for Light. It records which attributes of <html>
// ChatGPT changed meanwhile. Then it puts the theme cookie and localStorage.theme back to
// their values before the run and confirms the light theme after a reload. Read-only on chats,
// send guard on (a settings write to the server is refused, as every non-GET is). Needs the lab
// lock you hold (LAB_OWNER).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked Butter dir> [FIXTURE=ats12] node lab/harness/rail-theme-switch-live.mjs
// Checks: switch-dark-page, switch-dark-host, switch-dark-chat, the same for light, light-restored,
// light-host. Exit 1 on FAIL, 2 on setup error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'ats12';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0,
  exit = 0;
const verdict = (ok, check, why) => {
  if (!ok) fails++;
  console.log(ok ? `PASS ${check}` : `FAIL ${check}: ${why}`);
};
const report = (s) => console.log(`REPORT ${s}`);
if (!env.LAB_OWNER || !env.EXT) {
  console.error('LAB_OWNER= and EXT= are required');
  process.exit(2);
}
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => {
  try {
    return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim();
  } catch {
    return null;
  }
})();
if (held !== env.LAB_OWNER) {
  console.error(`lab ${lab.id} lock is held by ${held}`);
  process.exit(2);
}

// In the page: log <html>'s attribute changes and the rail host's data-dark, every frame.
function watch() {
  const html = document.documentElement,
    host = () => document.querySelector('chatgpt-butter-nav');
  const w = (window.__themeWatch = { muts: [], dark: [], t0: performance.now() });
  new MutationObserver((ms) => {
    for (const m of ms) w.muts.push([Math.round(performance.now() - w.t0), m.attributeName]);
  }).observe(html, { attributes: true });
  let last = null;
  const tick = () => {
    const d = !!host()?.hasAttribute('data-dark');
    if (d !== last) w.dark.push([Math.round(performance.now() - w.t0), d]);
    last = d;
    requestAnimationFrame(tick);
  };
  tick();
}
const state = () =>
  page.evaluate(() => {
    const html = document.documentElement;
    return {
      htmlClass: html.className,
      dataTheme: html.getAttribute('data-theme'),
      appearance: html.getAttribute('data-appearance-mode'),
      colorScheme: getComputedStyle(html).colorScheme,
      lsTheme: localStorage.getItem('theme'),
      hostDark: !!document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-dark'),
      t: Math.round(performance.now() - (window.__themeWatch?.t0 ?? 0)),
    };
  });

let browser, context, page;
let original = null,
  originalLs = null,
  restored = false;
const COOKIE = 'codex_appearance_theme';
async function putBack() {
  if (original) await context.addCookies([original]);
  else await context.clearCookies({ name: COOKIE });
  await page.evaluate(
    (v) => (v == null ? localStorage.removeItem('theme') : localStorage.setItem('theme', v)),
    originalLs,
  );
}
async function open() {
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page
    .locator('.thread-scroll-container:visible [data-turn-key]')
    .first()
    .waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await pause(4000);
}
// ChatGPT's own settings: the profile menu's Settings item opens the /settings page in the app (no
// reload; the rail's host stays in the page), its Appearance section has the theme as radio inputs
// labelled System, Light and Dark.
async function pick(label) {
  if (!new URL(page.url()).pathname.startsWith('/settings/appearance')) {
    await page.getByRole('button', { name: 'Open profile menu' }).click({ timeout: 10000 });
    await pause(600);
    await page.getByRole('menuitem', { name: /^Settings$/ }).first().click({ timeout: 10000 });
    await pause(1200);
    await page.getByRole('button', { name: 'Appearance', exact: true }).click({ timeout: 10000 });
    await pause(1200);
  }
  const t = (await state()).t;
  // The radio input is visually hidden; its card (the input's parent) takes the click.
  await page.locator(`input[aria-label="${label}"]`).first().locator('xpath=..').click({ timeout: 10000 });
  return t;
}
// Back to the chat the way a user does (the browser's Back, no reload), until its turns show.
async function back() {
  for (let n = 0; n < 3 && !(await page.locator('.thread-scroll-container:visible [data-turn-key]').count()); n++) {
    await page.goBack({ waitUntil: 'commit' });
    await pause(1500);
  }
}
async function measure(label, want) {
  const t = await pick(label);
  await pause(1000);
  const after = await state();
  const w = await page.evaluate(() => window.__themeWatch);
  const muts = w.muts.filter(([at]) => at >= t);
  const flips = w.dark.filter(([at]) => at >= t);
  report(`${label}: ${JSON.stringify(after)}; <html> attributes changed: ${JSON.stringify([...new Set(muts.map((m) => m[1]))])}; data-dark changes after the pick: ${JSON.stringify(flips.map(([at, d]) => [at - t, d]))}`);
  verdict(want ? after.dataTheme === 'dark' || /dark/.test(after.colorScheme) : after.dataTheme !== 'dark' && !/dark/.test(after.colorScheme), `switch-${label.toLowerCase()}-page`, `ChatGPT did not switch: data-theme ${after.dataTheme}, color-scheme ${after.colorScheme}`);
  // Read 1 s after the pick: right then means it followed within a second (or never had to change).
  verdict(after.hostDark === want, `switch-${label.toLowerCase()}-host`, `the rail host's data-dark is ${after.hostDark} 1 s after picking ${label} (changes: ${JSON.stringify(flips.map(([at, d]) => [at - t, d]))})`);
  await back();
  await pause(1000);
  const chat = await state();
  report(`${label}, back in the chat: ${JSON.stringify(chat)}; reloaded: ${(await page.evaluate(() => !window.__themeWatch))}`);
  verdict(chat.hostDark === want, `switch-${label.toLowerCase()}-chat`, `back in the chat, the rail host's data-dark is ${chat.hostDark}`);
}

try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], {
    env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' },
    stdio: 'pipe',
  });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  page = context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  await open();
  original = (await context.cookies('https://chatgpt.com')).find((c) => c.name === COOKIE) || null;
  const s0 = await state();
  originalLs = s0.lsTheme;
  report(`before: cookie ${original ? JSON.stringify(original.value) : 'absent'}; ${JSON.stringify(s0)}`);
  await page.evaluate(watch);
  await measure('Dark', true);
  await measure('Light', false);
  await putBack();
  restored = true;
  await pause(20000);
  await open();
  const s1 = await state();
  const cookieNow = (await context.cookies('https://chatgpt.com')).find((c) => c.name === COOKIE) || null;
  report(`after restore and reload: cookie ${cookieNow ? JSON.stringify(cookieNow.value) : 'absent'}; ${JSON.stringify(s1)}`);
  verdict((cookieNow?.value ?? null) === (original?.value ?? null) && s1.lsTheme === originalLs && s1.dataTheme === s0.dataTheme && s1.colorScheme === s0.colorScheme, 'light-restored', `cookie ${cookieNow?.value}, localStorage ${s1.lsTheme}, data-theme ${s1.dataTheme}, color-scheme ${s1.colorScheme}`);
  verdict(!s1.hostDark, 'light-host', 'chatgpt-butter-nav has data-dark after the restore');
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
  if (!restored && context && page) {
    try {
      await putBack();
      report('theme put back after the error');
    } catch {}
  }
} finally {
  await browser?.close().catch(() => {});
}
console.log(`SUMMARY theme-switch: ${fails} FAIL${fails === 1 ? '' : 's'}`);
process.exit(exit || (fails ? 1 : 0));
