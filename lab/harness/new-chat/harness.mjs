// The new chat harness: one Chromium with Butter for the run, and for each scenario a fresh page on
// the fixture (fixture.mjs) at the route it declares. Every chatgpt.com request is answered with
// the fixture page; any other request is aborted and reported as foreign, which fails the run.
// With `keys` (an X display) it runs headed and xtest-keys.py presses the `new-chat` command's key
// (Alt+Shift+O) as real input: chrome.commands ignores DevTools key events. Without it, `press`
// asks the worker to relay the command to the active tab, as Chrome does on a press.
//
// A scenario declares its start:
// - `route`: the page's path and query (Butter reads `temporary-chat` from the URL);
// - `scene`: fixture parameters served with the page (`turns=<n>`, `work`), not in its URL;
// - `settings`: Butter's settings over the harness's defaults (on, English, consent declined).
// `start` hands the scenario `t`: `check`, `page`, `press()` (the key, then a settle), `type(text)`
// (into the visible composer), `blur()` (focus back on the page body), `state()` (what the page
// shows: route, reloaded, visible turns, the visible composer's label and text, whether it has
// focus and the caret is at its end, and the keys the page saw), and the fixture's ids.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { freshPage, launchButter, repo } from '../runner/chromium.mjs';
import { fixtureHtml, PROJECT, PROJECT_NAME, CHAT, GPT } from './fixture.mjs';

const KEY = 'Alt+Shift+O';
// The X pointer stays on the tab strip: without a window manager the X focus follows the pointer.
const xkeys = (chord) => execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), chord, '700', '20']);

export async function launchNewChat({ defer, keys, launch = launchButter }) {
  const { context, worker, errors } = await launch({
    defer,
    name: 'butter-new-chat-qa',
    viewport: { width: 1280, height: 800 },
    options: { headless: !keys },
  });
  const foreign = [];
  let scene = '';
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'chatgpt.com') {
      foreign.push(url.href);
      return route.abort();
    }
    for (const [k, v] of new URLSearchParams(scene)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    return route.fulfill({ contentType: 'text/html', body: fixtureHtml(url) });
  });
  const settings = (value) =>
    worker.evaluate((butter) => chrome.storage.local.set({ butter }), { enabled: true, lang: 'en', layoutConsent: 'declined', ...value });

  async function start(scenario, check) {
    await freshPage(context);
    scene = scenario.scene ?? '';
    await settings(scenario.settings ?? {});
    const page = await context.newPage();
    await page.goto(`https://chatgpt.com${scenario.route}`);
    await page.waitForFunction(() => window.__fixture?.renders === 1);
    // Butter's main switch reaches the page as an attribute on <html> (shared/settings.js).
    const paused = scenario.settings?.enabled === false;
    await page.waitForFunction((paused) => document.documentElement.hasAttribute('data-butter-disabled') === paused, paused);
    // A marker that a reload loses.
    await page.evaluate(() => (window.__mark = 1));
    const press = async () => {
      await page.bringToFront();
      if (keys) xkeys(KEY);
      else
        await worker.evaluate(async () => {
          for (const tab of await chrome.tabs.query({ active: true }))
            await chrome.tabs.sendMessage(tab.id, { version: 1, type: 'butter-command', command: 'new-chat' }).catch(() => {});
        });
      await page.waitForTimeout(500);
    };
    const visible = '.view:not([hidden]) .ProseMirror';
    const type = async (text) => {
      await page.locator(visible).click();
      await page.keyboard.type(text);
    };
    const blur = () => page.evaluate(() => document.activeElement?.blur());
    const state = () =>
      page.evaluate(() => {
        const shown = (el) => el.getClientRects().length > 0;
        const editor = [...document.querySelectorAll('.ProseMirror')].find(shown) || null;
        const s = document.getSelection();
        let caretAtEnd = false;
        if (editor && s.rangeCount && s.isCollapsed && editor.contains(s.anchorNode)) {
          const rest = document.createRange();
          rest.setStart(s.anchorNode, s.anchorOffset);
          rest.setEnd(editor, editor.childNodes.length);
          caretAtEnd = rest.toString() === '';
        }
        return {
          route: location.pathname + location.search,
          reloaded: window.__mark !== 1,
          turns: [...document.querySelectorAll('[data-turn-key]')].filter(shown).length,
          hiddenTurns: [...document.querySelectorAll('[data-turn-key]')].filter((t) => !shown(t)).length,
          label: editor?.getAttribute('aria-label') ?? null,
          text: editor?.textContent ?? null,
          focused: !!editor && document.activeElement === editor,
          active: document.activeElement?.localName ?? null,
          caretAtEnd,
          keys: window.__fixture.keys.filter((k) => k.key.toLowerCase() === 'o' || k.key === 'Ø'),
        };
      });
    return { check, page, press, type, blur, state, keys, PROJECT, PROJECT_NAME, CHAT, GPT };
  }
  return { start, report: () => ({ errors, foreign }) };
}
