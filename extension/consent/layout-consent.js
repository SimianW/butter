// ISOLATED world: consent stays in extension settings; the page receives only off markers.
(() => {
  const T = {
    zh: {
      t: 'Butter 现在可以记住长对话的布局',
      d: '以后拖到之前看过的地方，会快很多。只在你的电脑上保存高度和位置这类数字，不保存聊天文字，也不上传任何东西。',
      link: '隐私政策',
      yes: '好的',
      no: '不用了',
    },
    en: {
      t: 'Butter can now remember long-chat layouts',
      d: 'Jumping back to parts you have read gets much faster. Only numbers such as heights and positions are saved, on this computer. No chat text, and nothing is uploaded.',
      link: 'Privacy policy',
      yes: 'Sounds good',
      no: 'No thanks',
    },
  };
  const pat =
    '<svg aria-hidden="true" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs>    <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset="1" stop-color="#fde487"/></linearGradient>    <linearGradient id="l1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde07a"/><stop offset="1" stop-color="#f4c74a"/></linearGradient>    <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c23a"/><stop offset="1" stop-color="#e0a227"/></linearGradient>    <clipPath id="c1"><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z"/></clipPath></defs><g transform="translate(0 6)" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="64" cy="90" rx="50" ry="7" fill="rgb(27 23 15 / .12)"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#r1)"/><g clip-path="url(#c1)"><path d="M0 0 L62 0 L62 128 L0 128 Z" fill="url(#l1)"/></g><path d="M19.65 37.97 Q14 40 19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#t1)"/><path d="M21.5 46.5 L55.5 59.5" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M69 60 L106.5 47" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 M62 59.5 L62 85.5" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75 L42 47.25 L24 40.25 Z" fill="#fde487"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08 L83 47.6 L72 51.2 Z" fill="#fde487"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M31.5 53 L32.3 57.5" stroke="#fff" stroke-width="2" stroke-opacity=".8"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85 L100 69.85 L84 75.4 Z" fill="#e8ad2e"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M91.6 86 L91.6 95.5" stroke="#fff" stroke-width="2.2" stroke-opacity=".85"/><path d="M25.5 41.2 C24 39.5 26 37.6 29 36.6 L39.5 32.8 C42.5 31.8 44.5 32.6 43.6 34.4 C43 35.6 41.6 36.3 40 36.9 L29.6 40.9 C27.8 41.6 26.4 41.9 25.5 41.2 Z" fill="#fff" fill-opacity=".92"/><circle cx="48" cy="32.2" r="1.9" fill="#fff" fill-opacity=".92"/></g></svg>';
  let settings = ButterStatus.normalize(),
    ready = false,
    loaded = false,
    version = 0;
  let host,
    shadow,
    hideTimer,
    showing = false,
    choosing = false,
    language,
    composerObserver;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = () =>
    host?.toggleAttribute(
      'data-dark',
      document.documentElement.classList.contains('dark') ||
        /dark/.test(getComputedStyle(document.documentElement).colorScheme),
    );
  const position = () => {
    if (!host || host.hidden) return;
    // Keep the approved placement unless a tall/wide composer would intersect the card.
    const box = host.getBoundingClientRect();
    let bottom = 82;
    for (const el of document.querySelectorAll(
      '[data-composer-body], form:has(#prompt-textarea), form:has(.ProseMirror), [data-testid="composer"]',
    )) {
      composerObserver?.observe(el);
      const r = el.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.height > 0 &&
        r.right > box.left &&
        r.left < box.right &&
        innerHeight - 82 > r.top
      )
        bottom = Math.max(bottom, innerHeight - r.top + 16);
    }
    host.style.setProperty('--consent-bottom', `${bottom}px`);
  };
  const hide = (animate) => {
    if (!host || !showing) return;
    showing = false;
    host.removeAttribute('data-visible');
    host.toggleAttribute('data-leaving', animate);
    // Disable controls immediately while retaining the fade; no invisible keyboard targets.
    host.inert = true;
    const finish = () => {
      host.hidden = true;
      host.removeAttribute('data-leaving');
    };
    if (animate && !reduced.matches) hideTimer = setTimeout(finish, 160);
    else finish();
  };
  async function choose(granted) {
    if (choosing) return;
    choosing = true;
    try {
      // Re-read so a simultaneous language/master change in the popup is preserved.
      const { butter } = await chrome.storage.local.get('butter');
      settings = ButterStatus.normalize(butter);
      if (settings.layoutConsent === 'pending') {
        settings = ButterStatus.chooseLayout(settings, granted);
        await chrome.storage.local.set({ butter: settings });
      }
      render();
    } finally {
      choosing = false;
    }
  }
  function mount() {
    host = document.createElement('chatgpt-butter-consent');
    host.hidden = true;
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    // Chromium does not register @font-face rules inside a shadow stylesheet. Register the
    // bundled face in the document font set, under a private name, for shadow-only use.
    const font = new FontFace(
      'ButterConsentNunito',
      `url("${chrome.runtime.getURL('popup/fonts/nunito-latin.woff2')}")`,
      { weight: '200 900' },
    );
    document.fonts.add(font);
    font.load().catch(() => {});
    // The rail uses z-index 20: keep its ticks and hover card above this non-modal prompt.
    style.textContent = `

:host { all: initial; position: fixed; right: 30px; bottom: var(--consent-bottom, 82px); width: 300px; z-index: 19; color-scheme: light; --body: 'ButterConsentNunito', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; }
:host([hidden]) { display: none !important; }
.card { --card: #fffdf6; --ink: #1b170f; --ink-2: #5c5240; --edge: #1b170f; --shadow: #1b170f; --butter: #fbe07a;
box-sizing: border-box; padding: 14px 14px 12px; border: 2.5px solid var(--edge); border-radius: 16px; background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--shadow), 0 12px 28px rgb(0 0 0 / .14); font-family: var(--body); opacity: 0; transform: translateY(16px); transition: opacity 200ms ease-out, transform 200ms ease-out; }
:host([data-visible]) .card { opacity: 1; transform: translateY(0); }
:host([data-leaving]) .card { opacity: 0; transform: translateY(0); transition: opacity 160ms ease-out; }
:host([data-dark]) { color-scheme: dark; }
:host([data-dark]) .card { --card: #26211b; --ink: #e6dcc6; --ink-2: #a99d85; --edge: #4f4638; --shadow: #0d0b08; --butter: #d9bd5f; box-shadow: 0 4px 0 var(--shadow), 0 12px 28px rgb(0 0 0 / .4); }
.hd { display: flex; gap: 10px; align-items: center; }
.hd svg { width: 40px; height: 40px; flex: none; }
.t { font-weight: 900; font-size: 14px; line-height: 1.35; }
.d { font-size: 12px; font-weight: 600; color: var(--ink-2); line-height: 1.5; margin: 8px 0 0; }
a { color: var(--ink); font-weight: 800; text-decoration: underline; text-underline-offset: 2px; }
.btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
button { font: 900 12px var(--body); padding: 5px 14px; border: 2px solid var(--edge); border-radius: 999px; background: var(--card); color: var(--ink); box-shadow: 0 2px 0 var(--shadow); cursor: pointer; }
.yes { background: var(--butter); color: #1b170f; }
:host([data-dark]) .yes { color: #1d1914; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
@media (width < 760px) { :host { left: 16px; right: 16px; width: calc(100% - 32px); } }
@media (prefers-reduced-motion: reduce) { .card, :host([data-leaving]) .card { transition: none; transform: none; } }
`;
    shadow.append(style);
    const card = document.createElement('section');
    card.className = 'card';
    card.setAttribute('role', 'region');
    shadow.append(card);
    shadow.addEventListener('click', (e) => {
      if (!e.isTrusted) return;
      const button = e.target.closest('button[data-choice]');
      if (button) choose(button.dataset.choice === 'yes').catch(() => {});
    });
    document.documentElement.append(host);
    new MutationObserver(dark).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    composerObserver = new ResizeObserver(position);
    composerObserver.observe(document.documentElement);
    new MutationObserver(position).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
      setTimeout(dark, 50),
    );
    addEventListener('resize', position);
    dark();
  }
  function render() {
    if (!ready || !loaded || !document.documentElement) return;
    if (!settings.enabled || settings.layoutConsent !== 'pending') {
      hide(settings.layoutConsent !== 'pending');
      return;
    }
    if (!host) mount();
    if (language !== settings.lang) {
      language = settings.lang;
      const t = T[language],
        card = shadow.querySelector('.card');
      card.lang = language === 'zh' ? 'zh-CN' : 'en';
      card.setAttribute('aria-label', t.t);
      card.innerHTML = `<div class="hd">${pat}<div class="t">${t.t}</div></div><p class="d">${t.d} <a href="https://github.com/SimianW/butter/blob/main/PRIVACY${language === 'zh' ? '.zh-CN' : ''}.md" target="_blank" rel="noopener noreferrer">${t.link}</a></p><div class="btns"><button type="button" data-choice="no">${t.no}</button><button type="button" class="yes" data-choice="yes">${t.yes}</button></div>`;
    }
    if (showing) return;
    clearTimeout(hideTimer);
    showing = true;
    host.hidden = false;
    host.inert = false;
    host.removeAttribute('data-leaving');
    position();
    requestAnimationFrame(() => {
      if (showing) host.setAttribute('data-visible', '');
    });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.butter) return;
    version++;
    settings = ButterStatus.normalize(changes.butter.newValue);
    render();
  });
  chrome.storage.local.get('butter').then(({ butter }) => {
    if (!version) settings = ButterStatus.normalize(butter);
    loaded = true;
    render();
  });
  const start = () =>
    setTimeout(() => {
      ready = true;
      render();
    }, 1000);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
