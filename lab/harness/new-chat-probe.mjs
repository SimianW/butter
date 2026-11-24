// How real ChatGPT starts a new chat, in and out of a project: URL shapes, the page's own
// new-chat controls, plain navigations to a project page, ChatGPT's Ctrl+Shift+O, unsent drafts
// and Alt+Shift+O. Read-only with the send guard on; never sends, never creates or renames.
//
// On a lock you hold (lab/README.md, "One lock per sequence"):
//   LAB_ID=2 LAB_OWNER=<owner> [EXT=] [STEPS=survey,controls,nav,keys,draft,work] \
//     node lab/harness/new-chat-probe.mjs
// EXT set (empty = none) restarts the lab browser with exactly those extensions; unset uses the
// browser as it is. PROJECT_CHAT=<fixture name> (default math12) is the project chat. Prints
// `REPORT <step> <json>` lines with ids replaced by placeholders and chat/project titles masked;
// judges nothing. Raw lines also go to lab/harness/results/new-chat-probe-<time>.log (local).
// Exit 2 on a setup error.
// Side effects to know: `alt` is opt-in (not in the default STEPS) and must be followed by `undo-alt`:
// the `alt` step with the page body focused makes ChatGPT type "O" into the
// chat's draft (type-to-focus); `undo-alt` with UNDO_LENS='{"normalChat":1,"projectChat":<n+1>}'
// removes it. `restore-row` re-expands the project's sidebar row if a row click collapsed it.
// The sidebar's two "New chat" buttons take `js:<selector>` in CONTROLS (element.click()), since
// a pointer click times out on them. See notes/runs/2026-11-23-new-chat-project/report.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { heldLab, startLab } from './seek-live-page.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs')).href);
const env = process.env;
const pause = ms => new Promise(r => setTimeout(r, ms));
const STEPS = (env.STEPS || 'survey,controls,nav,keys,draft,work').split(',').filter(Boolean);
const lab = heldLab(L, env);
fs.mkdirSync(path.join(here, 'results'), { recursive: true });
const logFile = path.join(here, 'results', `new-chat-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Masks: ids in URLs, plus chat and project titles learnt from the sidebar at run time.
const titles = new Set();
const mask = s => {
  if (s == null) return s;
  let t = String(s)
    .replace(/g-p-[0-9a-f]{32}(-[A-Za-z0-9_-]+)?/g, (m, slug) => `g-p-<id>${slug ? '-<slug>' : ''}`)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/g-[0-9A-Za-z]{9,}/g, 'g-<id>');
  for (const x of [...titles].sort((a, b) => b.length - a.length)) if (x.length > 1) t = t.split(x).join('<title>');
  return t;
};
const shape = u => { try { const x = new URL(u); return mask(x.pathname + x.search); } catch { return mask(u); } };
const deep = v => typeof v === 'string' ? mask(v) : Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : v;
const report = (step, o) => {
  const line = `REPORT ${step} ${JSON.stringify(deep(o))}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};

// In-page helpers, installed after every load (page.evaluate(probe)).
function probe() {
  const lbl = el => el.getAttribute('aria-label');
  const d0 = el => el && ({
    tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), aria: lbl(el), testid: el.getAttribute('data-testid'),
    href: el.getAttribute('href'), haspopup: el.getAttribute('aria-haspopup'),
    // Text only for controls: never for links (chat/project titles), textboxes (drafts) or messages.
    text: el.matches('a, [role="textbox"], [contenteditable]') || el.closest('[data-message-author-role], [data-turn-key]') ? null : (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) || null,
  });
  const d = el => { const r = d0(el); if (r && r.tag === 'a' && r.aria !== 'Home') r.aria = r.aria ? '<link label>' : null; return r; };
  const composer = () => {
    const ed = [...document.querySelectorAll('#prompt-textarea, .ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]')].find(e => e.getBoundingClientRect().height > 0);
    const form = ed?.closest('form');
    return {
      present: !!ed, visible: !!ed && ed.getBoundingClientRect().height > 0,
      editable: ed?.getAttribute('contenteditable'), placeholder: ed?.querySelector('[data-placeholder]')?.getAttribute('data-placeholder') ?? ed?.getAttribute('placeholder') ?? null,
      textLen: (ed?.innerText || '').trim().length, formAria: form && lbl(form), placementAttr: form?.getAttribute('data-composer-placement') ?? null,
      chatAttr: form?.getAttribute('data-chatgpt-composer') ?? null, edAria: ed && lbl(ed),
      focused: !!ed && (document.activeElement === ed || ed.contains(document.activeElement)),
    };
  };
  window.__ncp = {
    d,
    mark(v) { window.__probe = v; },
    state(project) {
      const nav = performance.getEntriesByType('navigation')[0];
      const main = document.querySelector('main');
      const header = document.querySelector('header') || main?.querySelector('header');
      const has = (el, s) => !!s && !!el && (el.innerText || '').includes(s);
      return {
        href: location.href, probe: window.__probe ?? null, timeOrigin: Math.round(performance.timeOrigin), navType: nav?.type,
        turns: [...document.querySelectorAll('[data-turn-key], [data-message-author-role]')].filter(e => e.getBoundingClientRect().height > 0).length,
        hiddenTurns: [...document.querySelectorAll('[data-turn-key], [data-message-author-role]')].filter(e => e.getBoundingClientRect().height === 0).length,
        editors: document.querySelectorAll('.ProseMirror[contenteditable="true"]').length,
        mainProjectChatLinks: [...document.querySelectorAll('main a[href*="/c/"]')].filter(e => e.getBoundingClientRect().height > 0 && /\/g\/g-p-/.test(e.getAttribute('href'))).length,
        temporaryOn: !!document.querySelector('button[aria-label="Turn off temporary chat"]'),
        sidebarProjectChats: document.querySelectorAll('nav a[href*="/g/g-p-"][href*="/c/"]').length,
        composer: composer(),
        projectInHeader: has(header, project), projectInMain: has(main, project),
        projectInComposerArea: has(document.querySelector('.ProseMirror[contenteditable="true"]')?.closest('form')?.parentElement?.parentElement, project),
        composerLabelNamesProject: !!project && ([...document.querySelectorAll('.ProseMirror[contenteditable="true"]')].find(e => e.getBoundingClientRect().height > 0)?.getAttribute('aria-label') || '') === 'New chat in ' + project,
        headerProjectLink: !!document.querySelector('header a[href$="/project"]'),
        dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(e => e.getBoundingClientRect().height > 0).map(d),
        active: d(document.activeElement),
      };
    },
    // Sidebar links classified by href shape.
    sidebar() {
      const links = [...document.querySelectorAll('nav a[href]')];
      const kind = h => /\/g\/g-p-[^/]+\/project/.test(h) ? 'projectPage' : /\/g\/g-p-[^/]+\/c\//.test(h) ? 'projectChat' : /^\/c\//.test(h) ? 'chat' : 'other';
      return links.map(a => ({ kind: kind(a.getAttribute('href')), ...d(a), title: a.matches('a[href*="/c/"],a[href*="/project"]') ? (a.textContent || '').trim() : null }));
    },
    // Controls whose label/testid/text says new chat or project, anywhere on the page.
    controls() {
      const re = /new|project|chat/i;
      return [...document.querySelectorAll('a,button,[role="button"],[role="menuitem"],[role="link"]')]
        .filter(e => e.getBoundingClientRect().height > 0 && !e.matches('a[href*="/c/"]'))
        .filter(e => re.test(lbl(e) || '') || re.test(e.getAttribute('data-testid') || '') || re.test((e.getAttribute('href') || '')) || (/new chat|new project|chat in/i.test(e.textContent || '') && (e.textContent || '').length < 60))
        .map(e => ({ ...d(e), inNav: !!e.closest('nav'), inHeader: !!e.closest('header'), inMain: !!e.closest('main') }));
    },
    get keys() { return (window.__ncpKeyLog ||= []); },
    listen() {
      if (window.__ncpKeys) return;
      window.__ncpKeys = true;
      for (const t of ['keydown', 'keyup']) window.addEventListener(t, e => {
        if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
        const rec = { t, key: e.key, code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, trusted: e.isTrusted };
        window.__ncp.keys.push(rec);
        // Was it handled (default prevented) by the page after the capture phase?
        setTimeout(() => { rec.defaultPrevented = e.defaultPrevented; }, 0);
      }, true);
    },
  };
}

const install = async page => { await page.evaluate(probe); await page.evaluate(() => window.__ncp.listen()); };
const ED = '.ProseMirror[contenteditable="true"]';
const waitComposer = async page => { await page.locator(ED).first().waitFor({ state: 'visible', timeout: 45000 }).catch(() => {}); await pause(1500); };
const go = async (page, url) => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitComposer(page); await install(page); };
let project = null;
const state = async page => { await install(page).catch(() => {}); return page.evaluate(p => window.__ncp.state(p), project); };
const brief = s => ({ url: shape(s.href), probeKept: s.probe, navType: s.navType, timeOrigin: s.timeOrigin, turns: s.turns, hiddenTurns: s.hiddenTurns, editors: s.editors, mainProjectChatLinks: s.mainProjectChatLinks, sidebarProjectChats: s.sidebarProjectChats, temporaryOn: s.temporaryOn, composer: s.composer, projectInHeader: s.projectInHeader, projectInMain: s.projectInMain, projectInComposerArea: s.projectInComposerArea, composerLabelNamesProject: s.composerLabelNamesProject, headerProjectLink: s.headerProjectLink, dialogs: s.dialogs, active: s.active });

// Marks the page, runs act, waits and reports where it landed and whether it reloaded.
async function trial(page, step, name, act, wait = 3500) {
  const marker = `m${Date.now()}`;
  const before = await state(page);
  await page.evaluate(m => window.__ncp.mark(m), marker);
  const dialogs = [];
  const onDialog = async dlg => { dialogs.push({ type: dlg.type() }); await dlg.dismiss().catch(() => {}); };
  page.on('dialog', onDialog);
  let err = null;
  try { await act(); } catch (e) { err = String(e.message || e).split('\n')[0].slice(0, 160); }
  await pause(wait);
  await waitComposer(page);
  page.off('dialog', onDialog);
  const after = await state(page);
  const keys = await page.evaluate(() => (window.__ncpKeyLog || []).splice(0)).catch(() => null);
  report(step, { name, from: shape(before.href), err, nativeDialogs: dialogs, reloaded: after.probe !== marker || after.timeOrigin !== before.timeOrigin, keysSeen: keys, ...brief(after) });
  return after;
}

const projectUrl = u => u.replace(/^(https:\/\/chatgpt\.com\/g\/g-p-[0-9a-f]{32}(?:-[^/]+)?)\/c\/.*$/, '$1/project');

let browser, context, page;
try {
  if (env.EXT !== undefined) ({ browser, context, page } = await startLab(L, lab, env, env.EXT));
  else {
    ({ browser, context } = await L.connect(lab));
    if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
    page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  }
  report('setup', { lab: lab.id, extensions: L.browserArgs(lab), steps: STEPS, keyMethod: 'page.keyboard.press (CDP Input.dispatchKeyEvent)' });

  const projChat = L.fixture(lab, env.PROJECT_CHAT || 'math12');
  const projPage = projectUrl(projChat);
  await go(page, projPage);
  // Learn the project name (header/title of the project page) and the sidebar's titles for masking.
  const side = await page.evaluate(() => window.__ncp.sidebar());
  for (const s of side) if (s.title) titles.add(s.title);
  project = await page.evaluate(() => {
    const h = document.querySelector('main h1, main h2, header h1');
    return (h?.textContent || '').trim() || null;
  });
  if (project) titles.add(project);
  for (const n of await page.evaluate(() => [...document.querySelectorAll('[aria-label^="Project actions for "]')].map(e => e.getAttribute('aria-label').slice(20)))) titles.add(n);
  for (const n of await page.evaluate(() => [...document.querySelectorAll('nav a[href]')].map(a => a.getAttribute('aria-label') || (a.textContent || '').trim()).filter(Boolean))) if (n !== 'Home') titles.add(n);
  const slug = projChat.match(/g-p-[0-9a-f]{32}-([^/]+)/)?.[1];
  if (slug) titles.add(slug);
  const normalChat = side.find(s => s.kind === 'chat')?.href;
  report('setup', { projectNameFound: !!project, sidebarCounts: side.reduce((m, s) => (m[s.kind] = (m[s.kind] || 0) + 1, m), {}), normalChatFound: !!normalChat });
  const normalUrl = normalChat ? new URL(normalChat, 'https://chatgpt.com').href : null;

  if (STEPS.includes('survey')) {
    // Q1 URL shapes and Q2 the controls on each page.
    report('survey', { page: 'projectPage', ...brief(await state(page)) });
    report('survey', { page: 'projectPage', sidebar: side.map(({ title, ...s }) => s).filter(s => s.kind !== 'chat' && s.kind !== 'projectChat') });
    report('survey', { page: 'projectPage', sidebarChatLinkSample: side.filter(s => s.kind !== 'other').slice(0, 3).map(({ title, text, ...s }) => s) });
    report('survey', { page: 'projectPage', controls: await page.evaluate(() => window.__ncp.controls()) });
    // The project page's own list of its chats (structure only).
    report('survey', { page: 'projectPage', mainChatLinks: await page.evaluate(() => [...document.querySelectorAll('main a[href*="/c/"]')].slice(0, 2).map(a => ({ tag: 'a', href: a.getAttribute('href'), testid: a.getAttribute('data-testid'), role: a.getAttribute('role') }))), mainChatLinkCount: await page.evaluate(() => document.querySelectorAll('main a[href*="/c/"]').length) });
    for (const [name, url] of [['projectChat', projChat], ['normalChat', normalUrl], ['home', 'https://chatgpt.com/'], ['temporary', 'https://chatgpt.com/?temporary-chat=true']]) {
      if (!url) { report('survey', { page: name, skipped: 'no such chat in the sidebar' }); continue; }
      await go(page, url);
      report('survey', { page: name, ...brief(await state(page)) });
      report('survey', { page: name, controls: await page.evaluate(() => window.__ncp.controls()) });
    }
  }

  if (STEPS.includes('controls')) {
    // Q2/Q4b: each new-chat control from a project chat.
    // Hover first (row buttons may show on hover); on an actionability timeout, report why and click with force.
    const click = sel => async () => {
      if (sel.startsWith('js:')) { await page.locator(sel.slice(3)).first().evaluate(e => e.click()); return; }
      const loc = page.locator(sel).first();
      report('controls', { sel, count: await page.locator(sel).count(), el: await loc.evaluate(e => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { ...window.__ncp.d(e), expanded: e.getAttribute('aria-expanded'), rect: [r.x, r.y, r.width, r.height].map(Math.round), hitSelf: !!top && (top === e || e.contains(top)), hit: top && window.__ncp.d(top) }; }).catch(e => String(e.message).split('\n')[0]) });
      await loc.hover({ timeout: 3000 }).catch(() => {});
      try { await loc.click({ timeout: 4000 }); }
      catch (e) { report('controls', { sel, clickErr: String(e.message).split('\n').slice(0, 6).join(' | ').slice(0, 600) }); await loc.click({ force: true, timeout: 3000 }); report('controls', { sel, forced: true }); }
    };
    const cands = (env.CONTROLS ? env.CONTROLS.split('||') : [
      'js:nav button[aria-label="New chat"]',
      `js:nav button[aria-label=${JSON.stringify('New chat in ' + project)}]`,
    ]).filter(Boolean);
    // The sidebar's project row was expanded before run 2 collapsed it: expand it again if collapsed.
    if (STEPS.includes('restore-row')) {
      await go(page, projChat);
      const row = page.locator(`nav div[role="button"]:has(button[aria-label=${JSON.stringify('New chat in ' + project)}])`).first();
      const was = await row.getAttribute('aria-expanded');
      if (was === 'false') { await row.click({ timeout: 5000 }); await pause(1500); }
      report('controls', { restoreRow: { was, now: await row.getAttribute('aria-expanded'), sidebarProjectChats: (await state(page)).sidebarProjectChats } });
    }
    // The project's actions menu: list its items, click none.
    await go(page, projChat);
    await page.locator(`nav button[aria-label=${JSON.stringify('Project actions for ' + project)}]`).first().evaluate(e => { for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) e.dispatchEvent(new PointerEvent(t, { bubbles: true, button: 0, pointerType: 'mouse' })); e.click(); }).catch(e => report('controls', { menuErr: String(e.message).split('\n')[0] }));
    await pause(800);
    report('controls', { projectActionsMenu: await page.evaluate(() => [...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] a, [role="menu"] button')].filter(e => e.getBoundingClientRect().height > 0).map(e => window.__ncp.d(e))) });
    await page.keyboard.press('Escape'); await pause(400);
    // The sidebar row's structure around the current project.
    report('controls', { projectRow: await page.evaluate(n => { const b = document.querySelector(`nav button[aria-label="${CSS.escape('New chat in ' + n)}"]`); const row = b?.closest('[role="button"]'); const chain = []; for (let e = b; e && chain.length < 5; e = e.parentElement) chain.push(window.__ncp.d(e)); return { found: !!b, newChatVisible: !!b && b.getBoundingClientRect().height > 0 && getComputedStyle(b).visibility !== 'hidden' && getComputedStyle(b).opacity !== '0', opacity: b && getComputedStyle(b).opacity, rowAnchors: row ? [...row.querySelectorAll('a')].map(window.__ncp.d) : null, chain: chain.map(x => x && ({ ...x, text: null })) }; }, project) });
    for (const sel of cands) {
      await go(page, projChat);
      await trial(page, 'controls', `click ${sel}`, click(sel));
      if (sel.startsWith('nav div[role="button"]')) {
        // A row click may toggle the project open/closed: report and put it back.
        const ex = await page.locator(sel).first().getAttribute('aria-expanded').catch(() => null);
        report('controls', { rowAfterClick: { expanded: ex } });
        await page.locator(sel).first().click({ force: true, timeout: 3000 }).catch(() => {});
        await pause(1500);
        report('controls', { rowAfterSecondClick: { expanded: await page.locator(sel).first().getAttribute('aria-expanded').catch(() => null), sidebarProjectChats: (await state(page)).sidebarProjectChats } });
      }
    }
  }

  if (STEPS.includes('nav')) {
    // Q3: plain navigations from a project chat to the project page.
    await go(page, projChat);
    await trial(page, 'nav', 'click existing <a> to project page', async () => {
      const a = page.locator(`a[href$="/project"]`).first();
      report('nav', { anchorFound: await a.count(), anchor: await a.evaluate(e => window.__ncp.d(e)).catch(() => null) });
      await a.click({ timeout: 5000 });
    });
    await go(page, projChat);
    await trial(page, 'nav', 'history.pushState + popstate', () => page.evaluate(u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, new URL(projPage).pathname));
    await go(page, projChat);
    await trial(page, 'nav', 'location.assign', () => page.evaluate(u => location.assign(u), projPage), 6000);
  }

  if (STEPS.includes('keys')) {
    // Q4: ChatGPT's own Ctrl+Shift+O.
    const kp = env.KEYS_PAGES ? env.KEYS_PAGES.split(',') : null;
    for (const [name, url] of [['normalChat', normalUrl], ['projectChat', projChat], ['projectPage', projPage], ['temporary', 'https://chatgpt.com/?temporary-chat=true'], ['home', 'https://chatgpt.com/']]) {
      if (kp && !kp.includes(name)) continue;
      if (!url) { report('keys', { name, skipped: 'no such chat' }); continue; }
      await go(page, url);
      await trial(page, 'keys', `Control+Shift+O in ${name}`, () => page.keyboard.press('Control+Shift+O'));
    }
  }

  if (STEPS.includes('draft')) {
    // Q5: unsent composer text, then a new chat; then back.
    const draftChat = L.fixture(lab, env.DRAFT_PROJECT_CHAT || 'ats12');
    const typeDraft = async () => { await page.locator(ED).first().click(); await page.keyboard.type('probe draft text'); await pause(800); };
    const clearDraft = async () => { await page.locator(ED).first().click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await pause(500); };
    const routes = [['normalChat', normalUrl, () => page.keyboard.press('Control+Shift+O')], ['projectChat', draftChat, () => page.locator('header a[href$="/project"]').first().click({ timeout: 5000 })], ['projectChat-ctrlShiftO', draftChat, () => page.keyboard.press('Control+Shift+O')]];
    for (const [name, url, act] of routes) {
      if (!url) { report('draft', { name, skipped: 'no such chat' }); continue; }
      await go(page, url);
      const pre = (await state(page)).composer.textLen;
      if (pre) { report('draft', { name, skipped: `composer already holds a draft (${pre} chars); not touched` }); continue; }
      await typeDraft();
      report('draft', { name, typed: (await state(page)).composer.textLen });
      await trial(page, 'draft', `${name}: new chat with draft`, act);
      await trial(page, 'draft', `${name}: back`, () => page.goBack({ waitUntil: 'domcontentloaded' }));
      await go(page, url);
      report('draft', { name, afterReopen: (await state(page)).composer });
      if ((await state(page)).composer.textLen) await clearDraft();
      report('draft', { name, cleared: (await state(page)).composer.textLen === 0 });
    }
  }

  if (STEPS.includes('alt')) {
    // Q6: Alt+Shift+O with no extension.
    for (const [name, url] of [['normalChat', normalUrl], ['projectChat', projChat]]) {
      if (!url) continue;
      await go(page, url);
      await page.locator(ED).first().click().catch(() => {});
      await trial(page, 'alt', `Alt+Shift+O in ${name} (composer focused)`, () => page.keyboard.press('Alt+Shift+O'));
      await page.evaluate(() => document.activeElement?.blur());
      await trial(page, 'alt', `Alt+Shift+O in ${name} (body focused)`, () => page.keyboard.press('Alt+Shift+O'));
    }
  }

  if (STEPS.includes('undo-alt')) {
    // Alt+Shift+O with the body focused types one character into the composer (ChatGPT's
    // type-to-focus). Remove exactly that trailing character where a chat's draft gained it.
    const want = JSON.parse(env.UNDO_LENS || '{}'); // { normalChat: 1, projectChat: 39 }
    for (const [name, url] of [['normalChat', normalUrl], ['projectChat', projChat]]) {
      if (!url || want[name] == null) continue;
      await go(page, url);
      const before = await page.evaluate(sel => { const t = document.querySelector(sel)?.innerText.replace(/\n+$/, '') || ''; return { len: t.trim().length, last: t.slice(-1) === 'O' ? 'O' : 'other', count: (t.match(/O/g) || []).length }; }, ED);
      let done = false;
      if (before.len === want[name] && before.last === 'O') {
        await page.locator(ED).first().click(); await page.keyboard.press('Control+End'); await page.keyboard.press('Backspace'); await pause(1200); done = true;
      } else if (before.len === want[name] && before.count === 1) {
        // The draft held no 'O' before; select the one inserted and delete it.
        await page.locator(ED).first().click();
        const at = await page.evaluate(sel => { const ed = document.querySelector(sel), w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) { const i = n.data.indexOf('O'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return i; } } return -1; }, ED);
        if (at >= 0) { await page.keyboard.press('Delete'); await pause(1200); done = true; }
      }
      await go(page, url);
      report('undo-alt', { name, before, done, after: (await state(page)).composer.textLen });
    }
  }

  if (STEPS.includes('work')) {
    // Q7: is Work mode reachable? Look for a control naming it; report, do not switch accounts.
    await go(page, 'https://chatgpt.com/');
    report('work', { controls: await page.evaluate(() => [...document.querySelectorAll('a,button,[role="tab"],[role="menuitem"],[role="radio"]')].filter(e => /work|codex/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.textContent || '').slice(0, 60) + ' ' + (e.getAttribute('href') || ''))).map(e => window.__ncp.d(e))), composer: (await state(page)).composer });
    if (env.WORK_URL) {
      await go(page, env.WORK_URL);
      report('work', { page: 'work', ...brief(await state(page)) });
      await trial(page, 'work', 'Control+Shift+O in work', () => page.keyboard.press('Control+Shift+O'));
    }
  }
  await browser.close().catch(() => {});
} catch (e) {
  console.error('setup error:', e.stack || e);
  await browser?.close().catch(() => {});
  process.exit(2);
}
