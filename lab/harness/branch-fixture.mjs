// Synthetic ChatGPT-like conversation for branch-qa.mjs. No ChatGPT requests: every
// https://chatgpt.com/** request is answered with this page. The scene follows the approved
// mockup (issue #26 artifact 1): 56 px header, 720 px column, composer 44 px above the bottom,
// and a native "Ask ChatGPT" chip shaped like the live one (fixed container > button).
// Attributes and labels mirror the live page of 2026-11-07 (ask-in-branch-29 report): the composer
// form's data-composer-placement / data-chatgpt-composer, the unlabelled submit "Send" button,
// data-talvt-turn-state on turns, and ChatGPT's English or Simplified Chinese menu labels.
export const ORIGINAL = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
export const BRANCH = 'local-chatgpt:0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
export const QUOTE = 'RAG (Retrieval-Augmented Generation) than traditional model training';
export const LATEST = 'Retrieval adds relevant context before an answer is generated.';
// ChatGPT's own labels per UI language (live, 2026-11-07).
const LABELS = {
  en: {
    ask: 'Ask ChatGPT',
    side: 'Ask in side chat',
    more: 'More actions',
    time: 'Wednesday, 1:50 PM',
    regen: 'Regenerate response',
    branch: 'Branch conversation',
    work: 'Branch into Work mode',
    newChat: 'Branch in new chat',
    composer: 'Ask ChatGPT',
    workComposer: 'Work with ChatGPT',
    send: 'Send',
    stop: 'Stop streaming',
  },
  zh: {
    ask: '向 ChatGPT 提问',
    side: '在侧边聊天中提问',
    more: '更多操作',
    time: '星期三，13:50',
    regen: '重新生成回复',
    branch: '创建对话分支',
    work: '在工作模式中创建分支',
    newChat: '在新聊天中创建分支',
    composer: '询问 ChatGPT',
    workComposer: '使用 ChatGPT Work',
    send: '发送',
    stop: '停止流式传输',
  },
};

export function fixtureHtml(url) {
  const q = url.searchParams;
  const dark = q.get('theme') === 'dark';
  const slow = Number(q.get('slow') || 0); // ms before each menu opens
  const land = Number(q.get('land') || 300); // ms from "Branch in new chat" to the new route
  const hold = Number(q.get('hold') || 0); // ms a sent message stays in the composer
  const sendDelay = Number(q.get('senddelay') || 0); // ms before Send enables after text arrives
  const pad = Number(q.get('pad') || 0); // px above the conversation, to push the quote down
  const L = LABELS[q.get('lang') === 'zh' ? 'zh' : 'en']; // ChatGPT's UI language
  const stream = Number(q.get('stream') || 0); // ms the latest reply is still being written
  const work = q.has('work'); // Work mode: composer form without data-chatgpt-composer, side chat
  const side = q.has('side') || work; // the selection toolbar also offers "Ask in side chat"
  const noBranch = q.has('nobranch'); // no More actions under any reply
  // Failure types: no More actions button, no "Branch conversation" item, no "Branch in new chat"
  // item, a "Branch in new chat" that leaves the route alone, a composer that never shows.
  const fail = q.get('fail') || '';
  const conv = decodeURIComponent(/\/c\/([^/?#]+)/.exec(url.pathname)?.[1] || '');
  const isBranch = conv !== ORIGINAL;
  const title = isBranch ? 'Branch · Explain Corpus Meaning' : 'Explain Corpus Meaning';
  const more = noBranch
    ? ''
    : `<button aria-label="${L.more}" class="more"${fail === 'more' ? ' style="display:none"' : ''}><svg width="16" height="16"><use href="#codex-icon-ellipsis-horizontal-light-16"></use></svg></button>`;
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
.composer .send[hidden],.acts[hidden]{display:none}
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
 <div data-turn-key="t-earlier" data-talvt-turn-state="complete"><div data-chatgpt-selection-conversation-id="${conv}" data-chatgpt-selection-message-id="m-earlier">
  <div class="a" data-markdown-text-style="assistant-message">
   <p>A corpus can be used for training, but it can also simply be searched when an AI needs information.</p>
   <p id="para">This is closer to <span id="quote">${QUOTE}</span>, although the page alone doesn't establish the exact architecture.</p>
  </div>
  <div class="acts"><span></span><span></span><span></span>${more}</div>
 </div></div>
 <div data-turn-key="t-latest" data-talvt-turn-state="${stream ? 'in_progress' : 'complete'}"><div data-chatgpt-selection-conversation-id="${conv}" data-chatgpt-selection-message-id="m-latest">
  <div class="a" data-markdown-text-style="assistant-message"><p id="latest">${stream ? 'Retrieval' : LATEST}</p></div>
  <div class="acts"${stream ? ' hidden' : ''}><span></span><span></span><span></span>${more}</div>
 </div></div>
</div></div>
<form class="composer" data-composer-placement="thread"${work ? '' : ' data-chatgpt-composer'}${fail === 'load' ? ' style="display:none"' : ''}><div class="ProseMirror" contenteditable="true" role="textbox" aria-label="${work ? L.workComposer : L.composer}"></div><span class="plus">+</span>
 <button class="send" type="submit" aria-label="${L.send}" disabled>↑</button>
 <button class="send stop" type="button" data-testid="stop-button" aria-label="${L.stop}" ${stream ? '' : 'hidden'}>■</button></form>
<div class="native" hidden><div><button type="button">${L.ask}</button>${side ? `<button type="button">${L.side}</button>` : ''}</div></div>
<script>
const ORIGINAL = ${JSON.stringify(ORIGINAL)}, BRANCH = ${JSON.stringify(BRANCH)};
window.fixture = { sent: [], branchedFrom: [], branchedText: [], workClicks: 0, nativeShift: 0, morePresses: 0,
  noBranch: ${JSON.stringify(fail === 'branch')}, noNewChat: ${JSON.stringify(fail === 'newchat')},
  sameRoute: ${JSON.stringify(fail === 'identity')} };
const editor = document.querySelector('.ProseMirror'), send = document.querySelector('.send');
document.querySelector('.composer').addEventListener('submit', (e) => e.preventDefault());
// The latest reply is still being written: it grows, has no actions, and the composer shows Stop.
if (${stream}) {
  const latest = document.querySelector('#latest'), words = ${JSON.stringify(LATEST)}.split(' ');
  let n = 1;
  const grow = setInterval(() => { if (n < words.length) latest.textContent = words.slice(0, ++n).join(' '); }, 250);
  setTimeout(() => {
    clearInterval(grow);
    latest.textContent = ${JSON.stringify(LATEST)};
    document.querySelector('[data-turn-key="t-latest"]').dataset.talvtTurnState = 'complete';
    document.querySelector('[data-turn-key="t-latest"] .acts').hidden = false;
    document.querySelector('.stop').hidden = true;
    send.hidden = false;
    fixture.streamEnded = true;
  }, ${stream});
  send.hidden = true;
}
let sendTimer;
const sync = () => {
  clearTimeout(sendTimer);
  if (!editor.innerText.trim() || !${sendDelay}) send.disabled = !editor.innerText.trim();
  else sendTimer = setTimeout(() => (send.disabled = false), ${sendDelay});
};
editor.addEventListener('input', sync);
send.addEventListener('click', () => {
  if (send.disabled || send.hidden) return;
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
  more.addEventListener('pointerdown', () => (fixture.morePresses++, setTimeout(() => {
    const id = more.closest('[data-chatgpt-selection-message-id]').dataset.chatgptSelectionMessageId;
    const r = more.getBoundingClientRect();
    menu([
      { label: ${JSON.stringify(L.time)} },
      { label: ${JSON.stringify(L.regen)}, sub: true, icon: 'arrows-clockwise-rotate-lg' },
      ...(fixture.noBranch ? [] : [{ label: ${JSON.stringify(L.branch)}, sub: true, icon: 'branch', on: () => setTimeout(() => {
        menu([
          { label: ${JSON.stringify(L.work)}, on: () => fixture.workClicks++ },
          ...(fixture.noNewChat ? [] : [{ label: ${JSON.stringify(L.newChat)}, on: () => {
            fixture.branchedFrom.push(id);
            fixture.branchedText.push(more.closest('[data-turn-key]').querySelector('[data-markdown-text-style]').innerText);
            closeMenus();
            if (!fixture.sameRoute) setTimeout(() => {
              history.pushState({}, '', location.pathname.replace(ORIGINAL, encodeURIComponent(BRANCH)) + location.search);
              document.title = 'Branch · Explain Corpus Meaning';
              document.querySelector('header .t').textContent = document.title;
              for (const w of document.querySelectorAll('[data-chatgpt-selection-conversation-id]')) w.dataset.chatgptSelectionConversationId = BRANCH;
            }, ${land});
          } }]),
        ], r.left + 230, r.top + 60);
      }, ${slow}) }]),
    ], r.left, r.top + 24);
  }, ${slow})));
</script></body></html>`;
}
