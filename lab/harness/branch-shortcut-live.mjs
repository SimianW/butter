// Ask in branch's key (Alt+Shift+Q, #126) on live ChatGPT, on a lock you hold: the one thing the
// fixture can't show. Text is selected in a reply with a real mouse drag, then the key is pressed as
// real X input (xtest-keys.py on the lab's display; chrome.commands ignores DevTools key events).
// Checks: the question box opens with the selection as its quote and its input focused
// (`box-opens`); ChatGPT itself does nothing with the key (`chatgpt-ignores`): no menu or dialog,
// the URL and composer unchanged, focus moves only into Butter's box, and the page selection is
// kept, sampled every frame, until the box shows. Esc closes the box (`esc-closes`); the box is
// never submitted. With NATIVE=1 (default) it then restarts the browser with no extension and
// presses the key on the same kind of selection: `REPORT native ...` lines say whether the page saw
// the keydown and what ChatGPT did with it (a control, never a verdict).
//
// Safety: the lab's send guard stays on (non-GET requests to chatgpt.com are aborted); nothing is
// typed into the box or the composer, and Enter is never pressed.
//
//   LAB=$(lab-lock acquire --lab auto --owner <owner> --needs-fixture math12 --wait 1800)
//   LAB_ID=$LAB LAB_OWNER=<owner> EXT=<snap-readable copy of extension/> [FIXTURE=math12] [NATIVE=0] \
//     node lab/harness/branch-shortcut-live.mjs
//   lab-restore --lab $LAB --owner <owner>; lab-lock release --lab $LAB --owner <owner>
//
// Output: PASS/FAIL/REPORT lines (lengths and counts only, never page text); exit 1 on FAIL, 2 on a
// setup error.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { heldLab, startLab } from './seek-live-page.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = process.env;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const pass = (name) => console.log(`PASS ${name}`);
const fail = (name, why) => ((failed = true), console.log(`FAIL ${name}: ${why}`));
const verdict = (name, ok, why) => (ok ? pass(name) : fail(name, why));
const report = (what) => console.log(`REPORT ${what}`);

if (!env.EXT) { console.error('EXT=<snap-readable copy of extension/> is required'); process.exit(2); }
const lab = heldLab(L, env);
const FIXTURE = env.FIXTURE || 'math12';
const HOST = 'chatgpt-butter-branch';

// Press the chord as X input on the lab's display, the pointer first moved to (x, y) on the screen
// (no window manager: X focus follows the pointer).
const xkey = (chord, x, y) =>
  execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), chord, String(x), String(y)], {
    env: { ...env, DISPLAY: lab.display },
  });

// Open the fixture, select part of a reply's text with a real mouse drag, and return where the X
// pointer goes for the key press (screen coordinates) and the selection's length.
async function selectInReply(page) {
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('[data-markdown-text-style="assistant-message"]').first().waitFor({ timeout: 60000 });
  await pause(5000);
  const line = await page.evaluate(() => {
    const vis = (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const replies = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].filter(vis);
    for (const reply of replies.reverse()) {
      const walk = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (n.textContent.trim().length < 60) continue;
        if (n.parentElement.closest('.katex, math, code, pre, button, svg, a')) continue;
        n.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' });
        const s = n.textContent.search(/\S/);
        const r = document.createRange();
        r.setStart(n, s);
        r.setEnd(n, s + 1);
        const first = r.getClientRects()[0];
        // Stay on the first line: drag 200 px or to the line's end, whichever is nearer.
        const lineRight = Math.min(...[...n.parentElement.getClientRects()].map((q) => q.right));
        return { x1: first.left + 1, x2: Math.min(first.left + 200, lineRight - 2), y: first.top + first.height / 2 };
      }
    }
    return null;
  });
  if (!line) throw Error('no reply text to select');
  await pause(500); // after the scroll
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(line.x1, line.y);
  await page.mouse.down();
  await page.mouse.move(line.x2, line.y, { steps: 10 });
  await page.mouse.up();
  await pause(600);
  // The X pointer goes to the tab strip, above the page, as the fixture harness's xkeys does: keys
  // go where the pointer is, and over the page it would hover what ChatGPT shows.
  return page.evaluate(() => ({
    x: window.screenX + 700,
    y: window.screenY + 20,
    len: getSelection().toString().length,
    inReply: !!getSelection().anchorNode?.parentElement?.closest('[data-markdown-text-style="assistant-message"]'),
  }));
}

// The page as ChatGPT and the reader see it: menus and dialogs, focus, the URL, the composer, the
// selection and Butter's box. Lengths and tags only.
const snapshot = (page) =>
  page.evaluate((host) => {
    const el = document.querySelector(host),
      root = el?.shadowRoot,
      box = root?.querySelector('.qpop');
    const a = document.activeElement;
    const composer = document.querySelector('#prompt-textarea, .ProseMirror');
    return {
      menus: document.querySelectorAll('[role="menu"], [role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]').length,
      active: a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}` : null,
      href: location.href,
      composerLen: composer?.textContent.length ?? null,
      sel: getSelection().toString(),
      open: !!box,
      focused: !!box && a === el && root.activeElement?.tagName === 'TEXTAREA',
      quote: box?.querySelector('.q span')?.textContent ?? null,
      draftLen: box?.querySelector('textarea')?.value.length ?? null,
    };
  }, HOST);

// Every frame from now: the selection and whether Butter's box shows, and every keydown the page
// sees (capture phase, before ChatGPT's own handlers), with whether it was prevented.
const watch = (page) =>
  page.evaluate((host) => {
    const w = (window.__b126 = { samples: [], keys: [] });
    addEventListener('keydown', (e) => w.keys.push({ code: e.code, alt: e.altKey, shift: e.shiftKey, at: performance.now(), prevented: () => e.defaultPrevented }), true);
    const tick = () => {
      const box = document.querySelector(host)?.shadowRoot?.querySelector('.qpop');
      w.samples.push({ at: performance.now(), sel: getSelection().toString(), open: !!box });
      if (w.samples.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, HOST);
const watched = (page) =>
  page.evaluate(() => ({
    samples: window.__b126.samples,
    keys: window.__b126.keys.map((k) => ({ ...k, prevented: k.prevented() })),
  }));

const lengthsOf = (s) => ({ ...s, sel: s.sel.length, quote: s.quote?.length ?? null, href: undefined });
let browser, page;
try {
  // ---- With Butter: the key opens the box; ChatGPT does nothing.
  ({ browser, page } = await startLab(L, lab, env, env.EXT));
  const worker = browser.contexts()[0].serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'));
  if (worker) {
    const key = await worker.evaluate(() => chrome.commands.getAll()).then((cs) => cs.find((c) => c.name === 'branch')?.shortcut ?? '');
    report(`branch command key: ${JSON.stringify(key)}`);
    verdict('key-assigned', key === 'Alt+Shift+Q', `Chrome reports ${JSON.stringify(key)}`);
  } else report('branch command key: worker not reachable over CDP, not read');
  await page.bringToFront();
  const at = await selectInReply(page);
  report(`selection: ${at.len} chars, in a reply: ${at.inReply}`);
  if (!at.len || !at.inReply) throw Error('the drag selected nothing in a reply');
  const before = await snapshot(page);
  await watch(page);
  await pause(300);
  xkey('Alt+Shift+Q', at.x, at.y);
  await pause(800);
  const after = await snapshot(page);
  const w = await watched(page);
  report(`before ${JSON.stringify(lengthsOf(before))}`);
  report(`after ${JSON.stringify(lengthsOf(after))}`);
  const q = w.keys.filter((k) => k.code === 'KeyQ');
  report(`page keydowns for Q: ${q.length}${q.length ? ' ' + JSON.stringify(q) : ''}; all keydowns: ${w.keys.length}`);

  verdict('box-opens', after.open && after.focused && after.quote === before.sel,
    `open ${after.open}, focused ${after.focused}, quote ${after.quote === before.sel ? 'is' : 'is not'} the selection (${after.quote?.length ?? 0} vs ${before.sel.length} chars)`);

  const firstOpen = w.samples.findIndex((s) => s.open);
  const pre = firstOpen < 0 ? w.samples : w.samples.slice(0, firstOpen);
  const lost = pre.filter((s) => s.sel !== before.sel).length;
  report(`frames sampled ${w.samples.length}, before the box ${pre.length}, selection differed in ${lost}`);
  const reasons = [];
  if (after.menus !== before.menus) reasons.push(`menus/dialogs ${before.menus} → ${after.menus}`);
  if (after.href !== before.href) reasons.push('the URL changed');
  if (after.composerLen !== before.composerLen) reasons.push(`composer ${before.composerLen} → ${after.composerLen} chars`);
  if (!(after.active === HOST || after.active === before.active)) reasons.push(`focus moved to ${after.active}`);
  if (lost) reasons.push(`selection changed in ${lost} frames before the box showed`);
  if (firstOpen < 0) reasons.push('the box never showed in the sampled frames');
  verdict('chatgpt-ignores', reasons.length === 0, reasons.join('; '));

  // Esc closes the box; nothing is typed or submitted.
  await page.keyboard.press('Escape');
  await pause(500);
  const closed = await snapshot(page);
  report(`after Esc ${JSON.stringify(lengthsOf(closed))}`);
  verdict('esc-closes', !closed.open && closed.composerLen === before.composerLen && closed.href === before.href,
    `open ${closed.open}, composer ${closed.composerLen}, URL ${closed.href === before.href ? 'same' : 'changed'}`);
  await browser.close().catch(() => {});
  browser = null;

  // ---- Native control: no extension, the same steps. Does ChatGPT do anything with the key?
  if (env.NATIVE !== '0') {
    ({ browser, page } = await startLab(L, lab, env, ''));
    await page.bringToFront();
    const nat = await selectInReply(page);
    report(`native selection: ${nat.len} chars, in a reply: ${nat.inReply}`);
    const b = await snapshot(page);
    await watch(page);
    await pause(300);
    xkey('Alt+Shift+Q', nat.x, nat.y);
    await pause(800);
    const a = await snapshot(page);
    const nw = await watched(page);
    const nq = nw.keys.filter((k) => k.code === 'KeyQ');
    report(`native page keydowns for Q: ${nq.length}${nq.length ? ' ' + JSON.stringify(nq) : ''}`);
    report(`native before ${JSON.stringify(lengthsOf(b))}`);
    report(`native after ${JSON.stringify(lengthsOf(a))}`);
    const why = [];
    if (a.menus !== b.menus) why.push(`menus/dialogs ${b.menus} → ${a.menus}`);
    if (a.href !== b.href) why.push('the URL changed');
    if (a.composerLen !== b.composerLen) why.push(`composer ${b.composerLen} → ${a.composerLen} chars`);
    if (a.active !== b.active) why.push(`focus ${b.active} → ${a.active}`);
    if (a.sel !== b.sel) why.push('the selection changed');
    // A measurement of ChatGPT, not of Butter: it never fails the run. On 2026-11-23 ChatGPT took
    // the keydown (defaultPrevented) and the selection cleared (notes/runs/2026-11-23-branch-shortcut).
    if (!nq.length) why.push('the page never saw the key (the press did not reach it)');
    report(`native ChatGPT ${why.length ? 'reacted: ' + why.join('; ') : 'did nothing with the key'}`);
    await browser.close().catch(() => {});
    browser = null;
  }
} catch (e) {
  console.error(`setup error: ${e.stack || e}`);
  await browser?.close().catch(() => {});
  process.exit(2);
}
process.exit(failed ? 1 : 0);
