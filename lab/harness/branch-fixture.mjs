// Synthetic ChatGPT-like conversation for branch-qa.mjs. No ChatGPT requests: every
// https://chatgpt.com/** request is answered with this page. The scene follows the approved
// mockup (issue #26 artifact 1): 56 px header, 720 px column, composer 44 px above the bottom,
// and a native "Ask ChatGPT" chip shaped like the live one (fixed container > button).
export const ORIGINAL = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
export const BRANCH = 'local-chatgpt:0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
export const QUOTE = 'RAG (Retrieval-Augmented Generation) than traditional model training';

export function fixtureHtml(url) {
  const q = url.searchParams;
  const dark = q.get('theme') === 'dark';
  const slow = Number(q.get('slow') || 0); // ms before each menu opens
  const land = Number(q.get('land') || 300); // ms from "Branch in new chat" to the new route
  const hold = Number(q.get('hold') || 0); // ms a sent message stays in the composer
  const pad = Number(q.get('pad') || 0); // px above the conversation, to push the quote down
  const conv = decodeURIComponent(/\/c\/([^/?#]+)/.exec(url.pathname)?.[1] || '');
  const isBranch = conv !== ORIGINAL;
  const title = isBranch ? 'Branch · Explain Corpus Meaning' : 'Explain Corpus Meaning';
  return `<!doctype html><html lang="en" data-theme="${dark ? 'dark' : 'light'}" style="color-scheme:${dark ? 'dark' : 'light'}"><head><meta charset="utf-8"><title>${title}</title><style>
:root{--bg:#fff;--fg:#0d0d0d;--fg2:#5d5d5d;--fg3:#8f8f8f;--bubble:#f4f4f4;--hair:rgb(0 0 0 / .1);--pop:#fff;
 --chip:#2f2f2f;--chip-fg:#fff;--sel:rgb(0 102 255 / .22)}
[data-theme=dark]{--bg:#212121;--fg:#ececec;--fg2:#b4b4b4;--fg3:#8f8f8f;--bubble:#303030;--hair:rgb(255 255 255 / .1);--pop:#303030;
 --chip:#3a3a3a;--sel:rgb(80 150 255 / .35)}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:16px/1.65 ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,Arial,sans-serif;overflow:hidden}
::selection{background:var(--sel)}
header{position:fixed;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font-size:18px;background:var(--bg);z-index:10}
header .t{font-size:15px;color:var(--fg2)}
.thread-scroll-container{position:absolute;top:56px;left:0;right:0;bottom:0;overflow:auto}
.col{width:min(720px,calc(100% - 48px));margin:24px auto 0;padding-bottom:260px}
.u{margin-left:auto;width:fit-content;max-width:70%;background:var(--bubble);border-radius:18px;padding:8px 16px;margin-bottom:24px}
.a p{margin:0 0 14px}
.acts{display:flex;gap:14px;color:var(--fg3);margin:-4px 0 18px;align-items:center}
.acts span{width:16px;height:16px;border:1.6px solid currentColor;border-radius:4px;opacity:.8}
.acts button{all:unset;width:16px;height:16px;cursor:pointer;color:var(--fg3);font-size:14px;line-height:16px;text-align:center}
.composer{position:absolute;left:50%;transform:translateX(-50%);width:min(720px,calc(100% - 48px));bottom:44px;min-height:104px;border-radius:28px;background:var(--pop);
 box-shadow:0 4px 4px rgb(0 0 0 / .04),0 0 1px rgb(0 0 0 / .62);padding:14px 20px 52px;z-index:5}
[data-theme=dark] .composer{box-shadow:0 0 0 1px rgb(255 255 255 / .06)}
.ProseMirror{outline:none;min-height:26px;white-space:pre-wrap;max-height:200px;overflow:auto}
.ProseMirror:empty::before{content:'Ask anything';color:var(--fg3)}
.composer .plus{position:absolute;left:16px;bottom:12px;font-size:22px;color:var(--fg2);line-height:1}
.composer .send{position:absolute;right:12px;bottom:10px;width:36px;height:36px;border-radius:50%;background:var(--fg);color:var(--bg);border:0;display:grid;place-items:center;font-size:18px}
.composer .send:disabled{opacity:.3}
.native{position:fixed;z-index:50;pointer-events:none;width:max-content}
.native>div{pointer-events:auto;display:flex;height:30px;border-radius:7px;background:var(--chip);box-shadow:0 2px 8px rgb(0 0 0 / .18);overflow:hidden}
.native button{all:unset;height:30px;padding:0 9px;color:var(--chip-fg);font-size:14px;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap}
.native[hidden]{display:none}
[role=menu]{position:fixed;background:var(--pop);border:1px solid var(--hair);border-radius:14px;padding:6px;z-index:60;min-width:220px;font-size:14px}
[role=menuitem]{padding:7px 10px;border-radius:8px;cursor:pointer;display:flex;gap:8px;align-items:center}
</style></head><body>
<header><span>ChatGPT</span><span class="t">${title}</span></header>
<div class="thread-scroll-container"><div class="col" style="padding-top:${pad}px">
 <div data-turn-key="t-user"><div class="u" data-message-author-role="user">What does “Corpus Hub” mean on this page?</div></div>
 <div data-turn-key="t-earlier"><div data-chatgpt-selection-conversation-id="${conv}" data-chatgpt-selection-message-id="m-earlier">
  <div class="a" data-markdown-text-style="assistant-message">
   <p>A corpus can be used for training, but it can also simply be searched when an AI needs information.</p>
   <p id="para">This is closer to <span id="quote">${QUOTE}</span>, although the page alone doesn't establish the exact architecture.</p>
  </div>
  <div class="acts"><span></span><span></span><span></span><button aria-label="More actions" class="more"><svg width="16" height="16"><use href="#codex-icon-ellipsis-horizontal-light-16"></use></svg></button></div>
 </div></div>
 <div data-turn-key="t-latest"><div data-chatgpt-selection-conversation-id="${conv}" data-chatgpt-selection-message-id="m-latest">
  <div class="a" data-markdown-text-style="assistant-message"><p id="latest">Retrieval adds relevant context before an answer is generated.</p></div>
  <div class="acts"><span></span><span></span><span></span><button aria-label="More actions" class="more"><svg width="16" height="16"><use href="#codex-icon-ellipsis-horizontal-light-16"></use></svg></button></div>
 </div></div>
</div></div>
<form class="composer"><div class="ProseMirror" contenteditable="true" role="textbox"></div><span class="plus">+</span>
 <button class="send" type="button" data-testid="send-button" aria-label="Send prompt" disabled>↑</button></form>
<div class="native" hidden><div><button type="button">Ask ChatGPT</button></div></div>
<script>
const ORIGINAL = ${JSON.stringify(ORIGINAL)}, BRANCH = ${JSON.stringify(BRANCH)};
window.fixture = { sent: [], branchedFrom: [], workClicks: 0, nativeShift: 0 };
const editor = document.querySelector('.ProseMirror'), send = document.querySelector('.send');
const sync = () => (send.disabled = !editor.innerText.trim());
editor.addEventListener('input', sync);
send.addEventListener('click', () => {
  if (send.disabled) return;
  fixture.sent.push({ conv: decodeURIComponent(location.pathname.split('/c/')[1] || ''), text: editor.innerText });
  setTimeout(() => { editor.textContent = ''; sync(); }, ${hold});
});
// Native "Ask ChatGPT": mounts a moment after selectionchange, below the selection.
const native = document.querySelector('.native');
let nativeTimer;
fixture.placeNative = () => {
  const s = getSelection();
  const inReply = s.rangeCount && !s.isCollapsed && s.anchorNode?.parentElement?.closest('[data-markdown-text-style]');
  if (!inReply || fixture.nativeHidden) { native.hidden = true; return; }
  const rects = [...s.getRangeAt(0).getClientRects()];
  native.hidden = false;
  native.style.left = rects[0].left + fixture.nativeShift + 'px';
  // Like the mockup: under the paragraph holding the selection.
  const para = s.anchorNode.parentElement.closest('p') || s.getRangeAt(0);
  native.style.top = para.getBoundingClientRect().bottom + 8 + 'px';
};
document.addEventListener('selectionchange', () => { clearTimeout(nativeTimer); nativeTimer = setTimeout(fixture.placeNative, 60); });
document.querySelector('.thread-scroll-container').addEventListener('scroll', () => fixture.placeNative());
// Radix-like menus: More opens on pointerdown; submenus on click.
const menu = (items, x, y) => {
  const m = document.createElement('div'); m.setAttribute('role', 'menu');
  m.style.left = x + 'px'; m.style.top = y + 'px';
  for (const it of items) {
    const el = document.createElement('div'); el.setAttribute('role', 'menuitem');
    if (it.sub) el.setAttribute('aria-haspopup', 'menu');
    el.innerHTML = it.icon ? '<svg width="16" height="16"><use href="#codex-icon-' + it.icon + '-light-16"></use></svg>' : '';
    el.append(it.label); el.addEventListener('click', it.on || (() => {})); m.append(el);
  }
  document.body.append(m); return m;
};
const closeMenus = () => document.querySelectorAll('[role=menu]').forEach((m) => m.remove());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
for (const more of document.querySelectorAll('.more'))
  more.addEventListener('pointerdown', () => setTimeout(() => {
    const id = more.closest('[data-chatgpt-selection-message-id]').dataset.chatgptSelectionMessageId;
    const r = more.getBoundingClientRect();
    menu([
      { label: 'Wednesday, 1:50 PM' },
      { label: 'Regenerate response', sub: true, icon: 'arrows-clockwise-rotate-lg' },
      { label: 'Branch conversation', sub: true, icon: 'branch', on: () => setTimeout(() => {
        menu([
          { label: 'Branch into Work mode', on: () => fixture.workClicks++ },
          { label: 'Branch in new chat', on: () => {
            fixture.branchedFrom.push(id); closeMenus();
            setTimeout(() => {
              history.pushState({}, '', location.pathname.replace(ORIGINAL, encodeURIComponent(BRANCH)) + location.search);
              document.title = 'Branch · Explain Corpus Meaning';
              document.querySelector('header .t').textContent = document.title;
              for (const w of document.querySelectorAll('[data-chatgpt-selection-conversation-id]')) w.dataset.chatgptSelectionConversationId = BRANCH;
            }, ${land});
          } },
        ], r.left + 230, r.top + 60);
      }, ${slow}) },
    ], r.left, r.top + 24);
  }, ${slow}));
</script></body></html>`;
}
