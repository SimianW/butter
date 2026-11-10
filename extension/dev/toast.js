// Dev build only. Isolated world: after dev/worker.js has written a bug file, it tells this tab,
// and a toast reads "Bug 4 saved / last 30 s · round 2" bottom-right for about 2 s. Styled like
// the layout consent card (consent/card.js): its tokens, its dark check and Butter's
// language. It takes no pointer events and nothing in it can take focus, so a held scrollbar
// drag carries on. A save while it shows replaces its text and restarts the 2 s.
(() => {
  const SHOW_MS = 2000;
  const T = {
    en: (bug, round) => [`Bug ${bug} saved`, `last 30 s · round ${round}`],
    zh: (bug, round) => [`Bug ${bug} 已保存`, `最近 30 秒 · 第 ${round} 轮`],
  };
  // Lucide "bug".
  const icon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>';
  // Above ChatGPT's own layers and the rail: the toast must show up in screen recordings.
  const style = `<style>
:host { all: initial; position: fixed; right: 24px; bottom: 18px; z-index: 2147483647; pointer-events: none; color-scheme: light; --body: 'ButterDevToastNunito', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; }
:host([data-dark]) { color-scheme: dark; }
* { box-sizing: border-box; }
.toast { --card: #fffdf6; --ink: #1b170f; --ink-2: #5c5240; --line: rgb(27 23 15 / .16);
display: flex; align-items: center; gap: 10px; padding: 10px 16px 10px 13px; border: 1.5px solid var(--line); border-radius: 14px; background: var(--card); color: var(--ink); box-shadow: 0 12px 28px rgb(0 0 0 / .14), 0 1px 2px rgb(0 0 0 / .08); font: 500 12px/1.35 var(--body); }
:host([data-dark]) .toast { --card: #26211b; --ink: #ece3cf; --ink-2: #b3a78e; --line: rgb(236 227 207 / .14); box-shadow: 0 12px 28px rgb(0 0 0 / .45), 0 1px 2px rgb(0 0 0 / .3); }
svg { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--ink-2); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
b { display: block; font-size: 13px; font-weight: 700; }
span { color: var(--ink-2); }
</style>`;
  let host, shadow, timer, font;
  // The consent card's check: ChatGPT marks its dark theme on <html>.
  const dark = () =>
    document.documentElement.classList.contains('dark') ||
    /dark/.test(getComputedStyle(document.documentElement).colorScheme);

  function show(bug, round, lang) {
    if (!font) {
      // Chromium does not register @font-face inside a shadow stylesheet (see the consent card).
      font = new FontFace(
        'ButterDevToastNunito',
        `url("${chrome.runtime.getURL('popup/fonts/nunito-latin.woff2')}")`,
        { weight: '200 900' },
      );
      document.fonts.add(font);
      font.load().catch(() => {});
    }
    if (!host) {
      host = document.createElement('chatgpt-butter-toast');
      // Inline and important, so no page rule on the host can make it catch the pointer.
      host.style.setProperty('pointer-events', 'none', 'important');
      shadow = host.attachShadow({ mode: 'open' });
      document.documentElement.append(host);
    }
    host.toggleAttribute('data-dark', dark());
    const [title, detail] = T[lang](bug, round);
    shadow.innerHTML = `${style}<div class="toast" role="status" lang="${lang === 'zh' ? 'zh-CN' : 'en'}">${icon}<div><b>${title}</b><span>${detail}</span></div></div>`;
    clearTimeout(timer);
    timer = setTimeout(() => {
      host.remove();
      host = shadow = null;
    }, SHOW_MS);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'butter-dev-saved') return;
    const { bug, round } = message;
    if (!Number.isInteger(bug) || !Number.isInteger(round)) return;
    chrome.storage.local.get('butter').then(
      ({ butter }) => show(bug, round, ButterStatus.normalize(butter).lang),
      () => show(bug, round, 'en'),
    );
  });
})();
