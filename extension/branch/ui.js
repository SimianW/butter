// Isolated world. Ask in branch UI in one shadow root: the question box, the new tab's overlay
// card and the line above the composer. Its button is a cell of the selection pill
// (selection/pill.js), with ICON.branch.
// Tokens follow the approved mockup (issue #26 artifact 1). Only static markup enters innerHTML;
// quotes, questions and titles are always set as textContent.
(() => {
  const STRINGS = {
    en: {
      ask: 'Ask in branch',
      placeholder: 'Ask about this…',
      hint: 'Opens in a new tab · this chat stays unchanged',
      escClose: 'close',
      close: 'Close',
      creating: 'Creating branch…',
      waiting: 'Waiting for the reply to finish…',
      creatingNote: 'Your question will be sent in the new chat when it’s ready.',
      cancel: 'Cancel',
      ready: (title) =>
        title
          ? `Branched from “${title}” · original unchanged`
          : 'Branched from the original chat · original unchanged',
      unsure: 'Not sent: couldn’t confirm this is a new branch.',
      failed: 'Couldn’t create branch',
      // One sentence per cause; failedNote adds "Nothing was sent.".
      causes: {
        more: 'Couldn’t find the latest reply’s “More actions” button.',
        branch: 'Couldn’t find ChatGPT’s “Branch conversation” menu.',
        newchat: 'Couldn’t find ChatGPT’s “Branch in new chat” menu.',
        identity: 'The tab didn’t move to a new chat.',
        load: 'This chat didn’t finish loading.',
        stream: 'The reply didn’t finish in time.',
        error: 'Something went wrong while making the branch.',
      },
      failedNote: (cause) => `${cause} Nothing was sent.`,
      closeTab: 'Close tab',
      copy: 'Copy question',
      copied: 'Copied',
      retry: 'Try again',
      blocked: 'Chrome blocked the new tab. Allow pop-ups for chatgpt.com, then try again.',
      handoff: 'Couldn’t hand your question to the new tab. Try again.',
    },
    zh: {
      ask: '在分支中问',
      placeholder: '就这段内容提问…',
      hint: '在新标签页打开，这个对话不受影响',
      escClose: '关闭',
      close: '关闭',
      creating: '正在创建分支…',
      waiting: '正在等待回复完成…',
      creatingNote: '完成后会在新对话中发送你的问题。',
      cancel: '取消',
      ready: (title) => (title ? `分支自《${title}》· 原对话不变` : '分支自原对话 · 原对话不变'),
      unsure: '未发送：无法确认这是新的分支。',
      failed: '没能创建分支',
      causes: {
        more: '找不到最新回复的 “More actions” 按钮。',
        branch: '找不到 ChatGPT 的 “Branch conversation” 菜单。',
        newchat: '找不到 ChatGPT 的 “Branch in new chat” 菜单。',
        identity: '标签页没有转到新的对话。',
        load: '这个对话没有加载完成。',
        stream: '回复没有及时生成完。',
        error: '创建分支时出了问题。',
      },
      failedNote: (cause) => `${cause}没有发送任何内容。`,
      closeTab: '关闭标签页',
      copy: '复制问题',
      copied: '已复制',
      retry: '重试',
      blocked: 'Chrome 拦截了新标签页。请允许 chatgpt.com 打开弹出窗口，然后重试。',
      handoff: '没能把问题交给新标签页，请重试。',
    },
  };
  const ICON = {
    branch:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
  };
  const CSS = `
:host { all: initial; position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 2147483000;
  --fg: #0d0d0d; --fg2: #5d5d5d; --fg3: #8f8f8f; --bg: #fff; --bubble: #f4f4f4; --hair: rgb(0 0 0 / .1);
  --pop: #fff; --pop-shadow: 0 8px 24px rgb(0 0 0 / .12), 0 0 0 1px rgb(0 0 0 / .08);
  --chip: #2f2f2f; --chip-fg: #fff; --scrim: rgb(255 255 255 / .86); --err: #d03e2b;
  font: 16px/1.65 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, "PingFang SC", "Noto Sans CJK SC", sans-serif;
  color: var(--fg); }
:host([data-dark]) { --fg: #ececec; --fg2: #b4b4b4; --fg3: #8f8f8f; --bg: #212121; --bubble: #303030; --hair: rgb(255 255 255 / .1);
  --pop: #303030; --pop-shadow: 0 8px 24px rgb(0 0 0 / .45), 0 0 0 1px rgb(255 255 255 / .08);
  --chip: #3a3a3a; --scrim: rgb(33 33 33 / .88); --err: #f1806d; }
* { box-sizing: border-box; }
button, textarea { font: inherit; color: inherit; margin: 0; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
svg { display: block; }

/* 2 · question box: a small ChatGPT composer */
.qpop { position: fixed; width: min(440px, calc(100vw - 32px)); border-radius: 22px; background: var(--pop);
  box-shadow: var(--pop-shadow); padding: 12px 12px 10px 16px; font-size: 15px; }
.qpop .q { display: flex; gap: 8px; align-items: baseline; color: var(--fg2); font-size: 14px; margin-bottom: 6px; }
.qpop .q span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.qpop .row { display: flex; align-items: center; gap: 8px; }
.qpop textarea { flex: 1; min-width: 0; border: 0; padding: 0; background: transparent; resize: none; outline: none;
  font-size: 15px; line-height: 24px; height: 24px; max-height: 144px; color: var(--fg); }
.qpop textarea::placeholder { color: var(--fg3); }
.qpop .go { width: 32px; height: 32px; border-radius: 50%; border: 0; background: var(--fg); color: var(--bg);
  display: grid; place-items: center; flex: none; align-self: flex-end; padding: 0; }
.qpop .go:disabled { opacity: .3; cursor: default; }
.qpop .go svg { width: 16px; height: 16px; }
.qpop .foot { margin-top: 8px; font-size: 12.5px; color: var(--fg3); display: flex; justify-content: space-between; gap: 12px; }
.qpop .foot span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.qpop .foot span:last-child { white-space: nowrap; }
.qpop .foot span.reason { color: var(--err); white-space: normal; overflow: visible; }
.qpop kbd { font: 11px ui-monospace, monospace; border: 1px solid var(--hair); border-radius: 4px; padding: 0 4px; }

/* 3 · new tab: cover and card while Butter drives ChatGPT's menu */
/* The cover takes the whole page, header included, so nothing under it can be clicked mid-run. */
.scrim { position: fixed; inset: 0; background: var(--scrim); }
.card { position: fixed; left: 50vw; top: clamp(72px, 31.25vh, 250px); transform: translateX(-50%);
  width: min(400px, calc(100vw - 32px)); border-radius: 20px; background: var(--pop); box-shadow: var(--pop-shadow);
  padding: 20px 22px 18px; font-size: 15px; }
.card .x { position: absolute; right: 12px; top: 12px; width: 28px; height: 28px; border-radius: 8px; border: 0;
  background: transparent; display: grid; place-items: center; color: var(--fg2); padding: 0; }
.card .x:hover { background: var(--bubble); }
.card .x svg { width: 16px; height: 16px; }
.card h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; line-height: 1.65; display: flex; align-items: center; gap: 10px; padding-right: 28px; }
.card p { margin: 0; color: var(--fg2); font-size: 14px; }
.card .quoted { margin-top: 12px; padding: 8px 12px; border-radius: 12px; background: var(--bubble); font-size: 14px;
  color: var(--fg); font-weight: 500; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 4;
  -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--hair); border-top-color: var(--fg);
  animation: spin .8s linear infinite; flex: none; }
@keyframes spin { to { transform: rotate(360deg); } }
.card .btns { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
.card .btn { font-size: 14px; line-height: 1.65; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--hair);
  color: var(--fg); background: var(--pop); }
.card .btn:hover { background: var(--bubble); }
.card .btn.pri { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.card .btn.pri:hover { background: color-mix(in srgb, var(--fg) 85%, var(--bg)); }
.card.err h3 { color: var(--err); }
.card.err h3 svg { width: 18px; height: 18px; flex: none; }

/* 4 · line: in the row of ChatGPT's disclaimer (.row), covering it; else above the composer */
.line { position: fixed; display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--fg2); padding: 0 6px;
  transition: opacity .2s ease; }
.line.out { opacity: 0; pointer-events: none; }
.line > svg { width: 15px; height: 15px; flex: none; }
.line .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.line .sp { flex: 1; }
.line .xs { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; border: 0; background: transparent;
  color: inherit; padding: 0; flex: none; }
.line .xs:hover { background: var(--bubble); }
.line .xs svg { width: 13px; height: 13px; }
.line.unsure > svg { color: var(--err); }
.line.row { justify-content: center; gap: 6px; background: var(--row-bg, var(--bg)); }
.line.row .sp { display: none; }
.line.row > svg { width: 14px; height: 14px; }
.line.row .xs { width: 20px; height: 20px; }
.line.row .xs svg { width: 12px; height: 12px; }

@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } * { transition: none !important; } }
:host([data-still]) .spinner { animation: none; }
`;
  const html = document.documentElement;
  const isDark = () => {
    const mode = html.getAttribute('data-appearance-mode') || html.getAttribute('data-theme');
    if (mode === 'dark' || mode === 'light') return mode === 'dark';
    if (html.classList.contains('dark') || html.classList.contains('light'))
      return html.classList.contains('dark');
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const lang = () => (html.getAttribute('data-butter-lang') === 'zh' ? 'zh' : 'en');

  function create() {
    const host = document.createElement('chatgpt-butter-branch');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>`;
    // Keys and clicks inside Butter's UI are not ChatGPT's business (e.g. type-to-focus).
    for (const type of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click'])
      host.addEventListener(type, (e) => e.stopPropagation());
    const theme = () => {
      host.toggleAttribute('data-dark', isDark());
      host.toggleAttribute('data-still', html.getAttribute('data-reduced-motion') === 'true');
    };
    new MutationObserver(theme).observe(html, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-appearance-mode', 'data-reduced-motion'],
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
    theme();
    // Live in <body>: macOS dictation apps (Typeless) reach the focused field through the
    // Accessibility API and type nothing into a field mounted outside it. ChatGPT can replace
    // <html> or <body>; attach to the current one, and to <html> only before <body> exists.
    const attach = () => {
      const parent = document.body || document.documentElement;
      if (host.parentNode !== parent) parent.append(host);
    };
    const t = () => STRINGS[lang()];
    const el = (tag, cls, markup = '') => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      node.innerHTML = markup;
      return node;
    };

    // ---- 2 · question box
    let box = null;
    const question = {
      open({ quote, draft, onSubmit, onInput, onClose }) {
        question.close();
        attach();
        const s = t();
        box = el(
          'div',
          'qpop',
          `<div class="q">❝ <span></span></div>
           <div class="row"><textarea rows="1"></textarea><button class="go" type="button">${ICON.up}</button></div>
           <div class="foot"><span></span><span><kbd>Esc</kbd> </span></div>`,
        );
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', s.ask);
        box.querySelector('.q span').textContent = quote.replace(/\s+/g, ' ');
        const input = box.querySelector('textarea'),
          go = box.querySelector('.go');
        input.placeholder = s.placeholder;
        input.setAttribute('aria-label', s.placeholder);
        go.setAttribute('aria-label', s.ask);
        box.querySelector('.foot span').textContent = s.hint;
        box.querySelector('.foot span:last-child').append(s.escClose);
        input.value = draft || '';
        const grow = () => {
          input.style.height = '24px';
          input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
          go.disabled = !input.value.trim();
        };
        input.addEventListener('input', () => {
          grow();
          onInput(input.value);
        });
        input.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.value.trim()) onSubmit(input.value.trim());
          }
        });
        go.addEventListener('click', () => input.value.trim() && onSubmit(input.value.trim()));
        root.append(box);
        grow();
        return { el: box, input };
      },
      place(left, top) {
        if (!box) return;
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
      },
      // Why the last Enter didn't go through (pop-up blocked, hand-over failed), in place of the
      // hint; null puts the hint back.
      reason(text) {
        const hint = box?.querySelector('.foot span');
        if (!hint) return;
        hint.textContent = text || t().hint;
        hint.classList.toggle('reason', !!text);
        if (text) hint.setAttribute('role', 'alert');
        else hint.removeAttribute('role');
      },
      size: () => (box ? box.getBoundingClientRect() : null),
      close() {
        box?.remove();
        box = null;
      },
      get el() {
        return box;
      },
    };

    // ---- 3 · overlay card
    let scrim = null,
      card = null,
      onFailureClose = null;
    const overlay = {
      working({ question: text, onCancel }) {
        overlay.remove();
        attach();
        const s = t();
        scrim = el('div', 'scrim');
        card = el(
          'div',
          'card',
          `<button class="x" type="button">${ICON.x}</button><h3><span class="spinner"></span><span></span></h3><p></p><div class="quoted"></div><div class="btns"><button class="btn" type="button"></button></div>`,
        );
        card.setAttribute('role', 'status');
        card.querySelector('.x').setAttribute('aria-label', s.close);
        card.querySelector('h3 span:last-child').textContent = s.creating;
        card.querySelector('p').textContent = s.creatingNote;
        card.querySelector('.quoted').textContent = text;
        card.querySelector('.btn').textContent = s.cancel;
        card.querySelector('.x').addEventListener('click', onCancel);
        card.querySelector('.btn').addEventListener('click', onCancel);
        root.append(scrim, card);
      },
      // Mockup state 5. × (and Esc) close only the card and keep the tab.
      failure({ question: text, cause, onRetry, onCopy, onCloseTab, onClose }) {
        overlay.remove();
        attach();
        const s = t();
        scrim = el('div', 'scrim');
        card = el(
          'div',
          'card err',
          `<button class="x" type="button">${ICON.x}</button><h3>${ICON.warn}<span></span></h3><p></p><div class="quoted"></div><div class="btns"><button class="btn" type="button" data-act="close-tab"></button><button class="btn" type="button" data-act="copy"></button><button class="btn pri" type="button" data-act="retry"></button></div>`,
        );
        card.setAttribute('role', 'alert');
        card.querySelector('.x').setAttribute('aria-label', s.close);
        card.querySelector('h3 span').textContent = s.failed;
        card.querySelector('p').textContent = s.failedNote(s.causes[cause] || s.causes.error);
        card.querySelector('.quoted').textContent = text;
        const act = (name) => card.querySelector(`[data-act="${name}"]`);
        act('close-tab').textContent = s.closeTab;
        act('copy').textContent = s.copy;
        act('retry').textContent = s.retry;
        card.querySelector('.x').addEventListener('click', () => overlay.close());
        act('close-tab').addEventListener('click', () => onCloseTab?.());
        act('retry').addEventListener('click', () => onRetry?.());
        let copiedTimer;
        act('copy').addEventListener('click', async () => {
          const button = act('copy');
          const ok = await onCopy?.();
          if (!ok || !button.isConnected) return;
          button.textContent = s.copied;
          clearTimeout(copiedTimer);
          copiedTimer = setTimeout(() => (button.textContent = s.copy), 1500);
        });
        onFailureClose = onClose;
        root.append(scrim, card);
        act('retry').focus({ preventScroll: true });
      },
      // Close the failure card only (× or Esc).
      close() {
        if (!card?.classList.contains('err')) return false;
        const done = onFailureClose;
        overlay.remove();
        done?.();
        return true;
      },
      // The working card while the latest reply is still being written: same card, own heading.
      waiting(on) {
        const heading = card?.querySelector('.spinner + span');
        if (heading) heading.textContent = t()[on ? 'waiting' : 'creating'];
      },
      remove() {
        scrim?.remove();
        card?.remove();
        scrim = card = onFailureClose = null;
      },
      get shown() {
        return !!card;
      },
      get failed() {
        return !!card?.classList.contains('err');
      },
    };

    // ---- 4 · line in the disclaimer's row, or above the composer
    let line = null;
    const note = {
      show({ kind, title, onClose }) {
        note.remove();
        attach();
        const s = t();
        line = el(
          'div',
          `line ${kind}`,
          `${kind === 'unsure' ? ICON.warn : ICON.branch}<span class="t"></span><span class="sp"></span><button class="xs" type="button">${ICON.x}</button>`,
        );
        line.setAttribute('role', 'status');
        const text = kind === 'unsure' ? s.unsure : s.ready(title);
        line.querySelector('.t').textContent = text;
        line.title = text; // readable when the row cuts it short
        line.querySelector('.xs').setAttribute('aria-label', s.close);
        line.querySelector('.xs').addEventListener('click', () => {
          note.remove();
          onClose?.();
        });
        root.append(line);
      },
      // rect: ChatGPT's disclaimer row (page.js disclaimerRow), which the line covers with the
      // page's background and the disclaimer's type; or, with below, the composer box, whose top
      // edge the line sits 8 px above in its own row.
      place(rect) {
        if (!line || !rect) return;
        const row = !rect.below;
        line.classList.toggle('row', row);
        const st = line.style;
        st.left = `${rect.left}px`;
        st.width = `${rect.width}px`;
        st.top = row ? `${rect.top}px` : '';
        st.height = row ? `${rect.height}px` : '';
        st.bottom = row ? '' : `${innerHeight - rect.top + 8}px`;
        st.fontSize = row ? rect.fontSize : '';
        st.lineHeight = row ? rect.lineHeight : '';
        if (row && rect.background) st.setProperty('--row-bg', rect.background);
        else st.removeProperty('--row-bg');
      },
      // ChatGPT's reply has started: fade out, or go at once under reduced motion.
      fade() {
        const el = line;
        line = null;
        if (!el) return;
        if (
          host.hasAttribute('data-still') ||
          matchMedia('(prefers-reduced-motion: reduce)').matches
        )
          return el.remove();
        el.classList.add('out');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 400);
      },
      remove() {
        line?.remove();
        line = null;
      },
      get shown() {
        return !!line;
      },
    };

    return { host, root, question, overlay, note, strings: t };
  }

  globalThis.ButterBranchUI = { create, STRINGS, ICON, isDark, strings: () => STRINGS[lang()] };
})();
