// Synthetic ChatGPT-shaped page for the new chat harness (harness.mjs). No ChatGPT requests: every
// https://chatgpt.com/** request is answered with this page, whatever its URL. What it mirrors, from
// the lab (notes/runs/2026-11-23-new-chat-project/report.md):
// - routes (Q1): a project page /g/g-p-<id>[-<slug>]/project, whose composer is labelled
//   "New chat in <project>" with placement "home"; a chat (/c/<id>, a project chat, a custom GPT's
//   chat) with turns and placement "thread"; the home page / and Temporary Chat
//   /?temporary-chat=true, both "home";
// - a client-side router (Q3): popstate renders the new route and leaves the old view, its turns
//   and composer, in the DOM, hidden; the new route's composer gets focus on arrival;
// - ChatGPT's type-to-focus handler (Q6): a printable key pressed outside a field, Alt+Shift+O
//   included, is prevented, focuses the composer and is typed into it.
// The composer is .ProseMirror[contenteditable][role=textbox] inside a form with
// data-composer-placement, and data-chatgpt-composer unless the page is in Work mode.
// The page records what it saw in window.__fixture: { keys: [keydown], renders }.
// Scene parameters (served with the page, not in its URL): `turns=<n>` gives the first route turns
// where it would have none (a Temporary Chat with turns); `work` puts every composer in Work mode.
export const PROJECT = '6820a1b2c3d4e5f60718293a4b5c6d7e';
export const PROJECT_NAME = 'Fixture project';
export const CHAT = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
export const GPT = '5f0e1d2c3b4a59687766554433221100';

export function fixtureHtml(url) {
  const q = url.searchParams;
  const scene = { turns: Number(q.get('turns') || 0), work: q.has('work') };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ChatGPT</title>
<style>
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #fff; color: #0d0d0d; }
  header { position: fixed; top: 0; left: 0; right: 0; height: 52px; border-bottom: 1px solid #eee; background: #fff; }
  .view { max-width: 720px; margin: 0 auto; padding: 72px 16px 160px; }
  .view[hidden] { display: none; }
  section[data-turn-key] { margin: 24px 0; }
  .user { margin-left: auto; width: fit-content; background: #f4f4f4; border-radius: 18px; padding: 8px 16px; }
  form { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); width: 680px; border-radius: 28px; background: #fff; box-shadow: 0 0 0 1px #ddd; padding: 12px 20px; }
  .view[hidden] form { display: none; }
  .ProseMirror { min-height: 24px; outline: none; }
</style></head>
<body><header>ChatGPT</header><main id="main"></main>
<script>
(() => {
  const scene = ${JSON.stringify(scene)};
  const fixture = (window.__fixture = { keys: [], renders: 0 });
  const main = document.getElementById('main');
  const turn = (i) =>
    '<section data-turn-key="q' + i + '-' + fixture.renders + '">' +
    '<div class="user" data-message-author-role="user">Question ' + i + '</div>' +
    '<div data-message-author-role="assistant" data-message-id="a' + i + '-' + fixture.renders + '">' +
    '<div data-markdown-text-style="assistant-message"><p>Answer ' + i + '.</p></div></div></section>';
  const composer = (placement, label) =>
    '<form data-composer-placement="' + placement + '"' + (scene.work ? '' : ' data-chatgpt-composer') + '>' +
    '<div class="ProseMirror" contenteditable="true" role="textbox" aria-label="' +
    (scene.work ? 'Work with ChatGPT' : label) + '"></div></form>';
  const visibleComposer = () =>
    [...document.querySelectorAll('.ProseMirror')].find((el) => el.getClientRects().length) || null;
  // The route's view; the old one stays in the DOM, hidden, as ChatGPT leaves it.
  function render(first) {
    const path = location.pathname;
    let turns = 0, placement = 'home', label = 'Ask ChatGPT';
    if (/^\\/g\\/g-p-[0-9a-z]+(-[^/]*)?\\/project\\/?$/i.test(path)) label = 'New chat in ${PROJECT_NAME}';
    else if (/\\/c\\/[^/]+\\/?$/.test(path)) (turns = 3), (placement = 'thread');
    else if (path !== '/') placement = null; // another page (the GPTs page, the library): no composer
    if (first && scene.turns) turns = scene.turns;
    for (const old of main.children) old.hidden = true;
    const view = document.createElement('div');
    view.className = 'view';
    view.dataset.route = path + location.search;
    view.innerHTML = Array.from({ length: turns }, (_, i) => turn(i + 1)).join('') +
      (placement ? composer(placement, label) : '');
    main.append(view);
    fixture.renders++;
    if (!first) visibleComposer()?.focus();
  }
  addEventListener('popstate', () => render(false));
  // Type-to-focus: a printable key outside a field goes to the composer.
  addEventListener('keydown', (e) => {
    fixture.keys.push({ key: e.key, alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey, trusted: e.isTrusted });
    if (e.ctrlKey || e.metaKey || e.key.length !== 1) return;
    if (document.activeElement?.closest('[contenteditable="true"], input, textarea')) return;
    const editor = visibleComposer();
    if (!editor) return;
    e.preventDefault();
    editor.focus();
    editor.append(e.key);
  }, true);
  render(true);
})();
</script></body></html>`;
}
