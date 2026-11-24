// The new chat key (Alt+Shift+O, #163) on live ChatGPT with the build loaded, on a lock you hold:
// what the fixture harness (new-chat-qa.mjs) can't show. Grown from new-chat-probe.mjs (see
// notes/runs/2026-11-23-new-chat-project/report.md). The key is pressed as real X input
// (xtest-keys.py on the lab's display; chrome.commands ignores DevTools key events), with the X
// pointer on the tab strip and focus on the page body unless a step says otherwise.
// Verdicts:
// - `key-assigned`: Chrome reports Alt+Shift+O for `new-chat`;
// - `project-chat`: from a project chat, lands on its project page without a reload, the visible
//   composer labelled as the project page's own ("New chat in <project>") and focused;
// - `project-page`: on an empty project page with typed text, URL and text unchanged, composer focused;
// - `normal-chat`: from a normal chat, lands on / without a reload;
// - `no-stray-key`: in that normal chat, the page saw no Alt+Shift+O keydown, and a known draft is
//   exactly the same text when you go back (ChatGPT's type-to-focus never got the key);
// - `temporary`: from a Temporary Chat with turns, lands on an empty Temporary Chat; the line says
//   whether that took a client-side navigation or a reload. It needs one send in Temporary Chat, so
//   it runs only with TEMP_SEND=1 on a lab whose labs.json allows sends; otherwise a REPORT line.
// Work mode: REPORT only. With WORK_URL=<a Work-mode page> it presses the key there and reports
// whether anything changed; it never switches modes or changes account settings.
//
// Safety: the send guard stays on (non-GET requests to chatgpt.com are aborted), except for the one
// TEMP_SEND message, after which it is put back. Text typed into a composer is removed before the
// step ends.
//
//   LAB=$(lab-lock acquire --lab 2 --owner <owner> --needs-fixture math12 --wait 1800)
//   LAB_ID=$LAB LAB_OWNER=<owner> EXT=<snap-readable copy of extension/> [FIXTURE=math12] \
//     [TEMP_SEND=1] [WORK_URL=...] node lab/harness/new-chat-live.mjs
//   lab-restore --lab $LAB --owner <owner>; lab-lock release --lab $LAB --owner <owner>
//
// Output: PASS/FAIL/REPORT lines (URL shapes with ids masked, lengths and flags; never page text);
// exit 1 on FAIL (a key that cannot be confirmed too), 2 on a setup error. The report goes to notes/runs/<date>-new-chat-shortcut/.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { heldLab, startLab } from './seek-live-page.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = process.env;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
let keyOk = false; // the TEMP_SEND send happens only after PASS key-assigned (2026-11-24: a send was spent on an unbound key)
const verdict = (name, ok, why) => (ok ? console.log(`PASS ${name}`) : ((failed = true), console.log(`FAIL ${name}: ${why}`)));
const report = (what) => console.log(`REPORT ${what}`);

if (!env.EXT) { console.error('EXT=<snap-readable copy of extension/> is required'); process.exit(2); }
const lab = heldLab(L, env);
const FIXTURE = env.FIXTURE || 'math12';
const ED = '.ProseMirror[contenteditable="true"]';
const TEXT = 'butter key check';
const shape = (u) => {
  const x = new URL(u);
  return (x.pathname + x.search)
    .replace(/g-p-[0-9a-f]{32}(-[^/?]+)?/g, (m, slug) => `g-p-<id>${slug ? '-<slug>' : ''}`)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>');
};

// The page as the reader sees it, marked so that a reload shows; keydowns are logged from here on.
const arm = (page) =>
  page.evaluate(() => {
    window.__nc = { mark: performance.timeOrigin, keys: [] };
    addEventListener('keydown', (e) => window.__nc.keys.push({ code: e.code, alt: e.altKey, shift: e.shiftKey }), true);
  });
const state = (page) =>
  page.evaluate((ED) => {
    const shown = (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0;
    const ed = [...document.querySelectorAll(ED)].find(shown) || null;
    return {
      href: location.href,
      reloaded: window.__nc?.mark !== performance.timeOrigin,
      turns: [...document.querySelectorAll('[data-turn-key]')].filter(shown).length,
      label: ed?.getAttribute('aria-label') ?? null,
      len: (ed?.innerText || '').trim().length,
      text: ed?.innerText ?? '',
      focused: !!ed && (document.activeElement === ed || ed.contains(document.activeElement)),
      temporaryOn: !!document.querySelector('button[aria-label="Turn off temporary chat"]'),
      keysO: (window.__nc?.keys || []).filter((k) => k.code === 'KeyO' && k.alt).length,
    };
  }, ED);
const brief = ({ text: _text, ...s }) => JSON.stringify({ ...s, href: shape(s.href), label: s.label ? (s.label.startsWith('New chat in ') ? 'New chat in <project>' : s.label) : null });

// Press the key as X input with the pointer on the tab strip (no window manager: X focus follows it).
async function press(page, { body = true } = {}) {
  await page.bringToFront();
  if (body) await page.evaluate(() => document.activeElement?.blur());
  const at = await page.evaluate(() => ({ x: window.screenX + 700, y: window.screenY + 20 }));
  execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), 'Alt+Shift+O', String(at.x), String(at.y)], { env: { ...env, DISPLAY: lab.display } });
  await pause(3000);
}
async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator(ED).first().waitFor({ state: 'visible', timeout: 60000 });
  await pause(3000);
  await arm(page);
}
const clearComposer = async (page) => {
  await page.locator(`${ED}:visible`).first().click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await pause(800);
};

let browser, context, page;
try {
  ({ browser, context, page } = await startLab(L, lab, env, env.EXT));
  const worker = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'));
  if (!worker) verdict('key-assigned', false, 'worker not reachable over CDP, key not read');
  else {
    const key = await worker.evaluate(() => chrome.commands.getAll()).then((cs) => cs.find((c) => c.name === 'new-chat')?.shortcut ?? '');
    keyOk = key === 'Alt+Shift+O';
    verdict('key-assigned', keyOk, key ? `Chrome reports ${JSON.stringify(key)}` : 'no key assigned to new-chat');
  }

  const projChat = L.fixture(lab, FIXTURE);
  const id = /\/g\/g-p-([0-9a-f]+)/.exec(projChat)?.[1];
  if (!id) throw Error(`fixture ${FIXTURE} is not a project chat`);
  const projPage = `https://chatgpt.com/g/g-p-${id}/project`;

  // ---- The project page's own label: what a new chat in this project reads.
  await open(page, projPage);
  const home = await state(page);
  report(`project page loaded ${brief(home)}`);
  if (home.turns || home.len) throw Error('the project page has turns or a draft: left as it is');

  // ---- project-page: empty, typed text, body focused → nothing but focus.
  await page.locator(`${ED}:visible`).first().click();
  await page.keyboard.type(TEXT);
  await arm(page);
  await press(page);
  const pp = await state(page);
  report(`project-page after ${brief(pp)}`);
  verdict('project-page', shape(pp.href) === shape(projPage) && !pp.reloaded && pp.text === TEXT && pp.focused && !pp.keysO,
    `url ${shape(pp.href)}, reloaded ${pp.reloaded}, text ${pp.text === TEXT ? 'same' : `differs (${pp.text.length}/${TEXT.length})`}, focused ${pp.focused}, page keydowns ${pp.keysO}`);
  if (new URL(page.url()).pathname === new URL(projPage).pathname) await clearComposer(page);

  // ---- project-chat → the project page, client-side, labelled and focused.
  await open(page, projChat);
  const pcBefore = await state(page);
  await press(page);
  const pc = await state(page);
  report(`project-chat before ${brief(pcBefore)} after ${brief(pc)}`);
  verdict('project-chat', new URL(pc.href).pathname === `/g/g-p-${id}/project` && !pc.reloaded && pc.label === home.label && pc.focused && pc.turns === 0 && !pc.keysO,
    `url ${shape(pc.href)}, reloaded ${pc.reloaded}, label ${pc.label === home.label ? 'same' : 'differs'}, focused ${pc.focused}, turns ${pc.turns}, page keydowns ${pc.keysO}`);

  // ---- normal-chat and no-stray-key: the first saved chat outside a project in the sidebar.
  const normal = await page.evaluate(() => [...document.querySelectorAll('nav a[href^="/c/"]')][0]?.getAttribute('href'));
  if (!normal) report('normal-chat: no normal chat in the sidebar, not run');
  else {
    await open(page, new URL(normal, 'https://chatgpt.com').href);
    const nb = await state(page);
    const DRAFT = 'butter stray-key marker';
    const setDraft = async (text) => {
      await clearComposer(page);
      if (text) await page.keyboard.type(text);
      await pause(800);
    };
    await setDraft(DRAFT);
    await arm(page);
    await press(page);
    const nc = await state(page);
    report(`normal-chat before ${brief(nb)} after ${brief(nc)}`);
    verdict('normal-chat', new URL(nc.href).pathname === '/' && !nc.temporaryOn && !nc.reloaded && nc.turns === 0,
      `url ${shape(nc.href)}, reloaded ${nc.reloaded}, turns ${nc.turns}, temporary ${nc.temporaryOn}`);
    const normalPath = new URL(normal, 'https://chatgpt.com').pathname;
    const here = () => new URL(page.url()).pathname;
    if (here() === normalPath) {
      // The press did not navigate: the draft is still in this chat. Restore it here, no Back.
      verdict('no-stray-key', false, `no navigation, so no way to tell a stray key from the draft; page keydowns ${nc.keysO}`);
      await setDraft(nb.text);
    } else {
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await pause(3000);
      if (here() !== normalPath) {
        console.log('FAIL no-stray-key: back did not return to the normal chat; draft not restored');
        failed = true;
      } else {
        const back = await state(page);
        verdict('no-stray-key', !nc.keysO && back.text === DRAFT, `page keydowns ${nc.keysO}, draft ${back.text === DRAFT ? 'same' : `differs (${DRAFT.length} → ${back.text.length})`}`);
        // Put the composer back to what it held before the check.
        await setDraft(nb.text);
      }
    }
  }

  // ---- temporary: needs a Temporary Chat with turns, so one send.
  if (env.TEMP_SEND !== '1') report('temporary: not run (needs one send in Temporary Chat; TEMP_SEND=1 on a lab that allows sends)');
  else if (!keyOk) report('temporary: not run, nothing sent (key-assigned did not pass, so the key would not be the command)');
  else {
    L.sendsAllowed(lab, true); // throws unless this lab's labs.json allows sends
    let guardBack = false;
    try {
      await open(page, 'https://chatgpt.com/?temporary-chat=true');
      await context.unrouteAll({ behavior: 'ignoreErrors' });
      await page.locator(`${ED}:visible`).first().click();
      await page.keyboard.type('Reply with the single word: ok');
      await page.keyboard.press('Enter');
      await page.locator('[data-turn-key]:visible').first().waitFor({ timeout: 60000 });
      await pause(8000);
    } finally {
      // Whatever happened above (timeout, throw), the send guard goes back before anything else.
      try {
        guardBack = typeof (await L.sendGuard(context, lab)) === 'function';
      } catch {}
    }
    if (!guardBack) {
      verdict('temporary', false, 'send guard could not be put back');
      throw Error('send guard not put back');
    }
    await arm(page);
    const tb = await state(page);
    await press(page);
    const tc = await state(page);
    report(`temporary before ${brief(tb)} after ${brief(tc)}`);
    verdict('temporary', tb.turns > 0 && shape(tc.href) === '/?temporary-chat=true' && tc.temporaryOn && tc.turns === 0 && tc.len === 0,
      `turns before ${tb.turns}, url ${shape(tc.href)}, temporary ${tc.temporaryOn}, turns ${tc.turns}, composer ${tc.len}`);
    report(`temporary navigation: ${tc.reloaded ? 'reload' : 'client-side'}`);
  }

  // ---- Work mode: report only.
  if (!env.WORK_URL) report('work: not run (no Work-mode page without changing account settings; WORK_URL=...)');
  else {
    await open(page, env.WORK_URL);
    const wb = await state(page);
    await press(page);
    const wa = await state(page);
    report(`work before ${brief(wb)} after ${brief(wa)}; unchanged: ${wa.href === wb.href && !wa.focused && wa.len === wb.len}`);
  }
  await browser.close().catch(() => {});
} catch (e) {
  console.error('setup error:', e.stack || e);
  await browser?.close().catch(() => {});
  process.exit(2);
}
process.exit(failed ? 1 : 0);
