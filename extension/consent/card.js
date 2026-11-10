// ISOLATED world. The shell Butter's cards share: the layout consent card
// (consent/layout-consent.js) and the bookmark notification (bookmarks/notice.js). One look,
// palette, font, width and themes; each caller fills in its own copy and buttons.
// Bottom-right cards (the consent card) rise in from below and stack upwards in the order they
// were created, so they never overlap. A top-right card (`top`, the notification, #77) sits 12 px
// below ChatGPT's 52 px header and 8 px left of the rail, outside that stack; it slides 16 px in
// from the right while it fades in, and under reduced motion only fades.
(() => {
  const PAT =
    '<svg aria-hidden="true" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs>    <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset="1" stop-color="#fde487"/></linearGradient>    <linearGradient id="l1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde07a"/><stop offset="1" stop-color="#f4c74a"/></linearGradient>    <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c23a"/><stop offset="1" stop-color="#e0a227"/></linearGradient>    <clipPath id="c1"><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z"/></clipPath></defs><g transform="translate(0 6)" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="64" cy="90" rx="50" ry="7" fill="rgb(27 23 15 / .12)"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#r1)"/><g clip-path="url(#c1)"><path d="M0 0 L62 0 L62 128 L0 128 Z" fill="url(#l1)"/></g><path d="M19.65 37.97 Q14 40 19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#t1)"/><path d="M21.5 46.5 L55.5 59.5" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M69 60 L106.5 47" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 M62 59.5 L62 85.5" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75 L42 47.25 L24 40.25 Z" fill="#fde487"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08 L83 47.6 L72 51.2 Z" fill="#fde487"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M31.5 53 L32.3 57.5" stroke="#fff" stroke-width="2" stroke-opacity=".8"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85 L100 69.85 L84 75.4 Z" fill="#e8ad2e"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M91.6 86 L91.6 95.5" stroke="#fff" stroke-width="2.2" stroke-opacity=".85"/><path d="M25.5 41.2 C24 39.5 26 37.6 29 36.6 L39.5 32.8 C42.5 31.8 44.5 32.6 43.6 34.4 C43 35.6 41.6 36.3 40 36.9 L29.6 40.9 C27.8 41.6 26.4 41.9 25.5 41.2 Z" fill="#fff" fill-opacity=".92"/><circle cx="48" cy="32.2" r="1.9" fill="#fff" fill-opacity=".92"/></g></svg>';
  // The rail uses z-index 20: keep its ticks and hover card above these non-modal prompts.
  const CSS = `

:host { all: initial; position: fixed; right: 30px; bottom: var(--consent-bottom, 82px); width: 300px; z-index: 19; color-scheme: light; --body: 'ButterConsentNunito', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; }
:host([hidden]) { display: none !important; }
.card { --card: #fffdf6; --ink: #1b170f; --ink-2: #5c5240; --line: rgb(27 23 15 / .16); --butter: #fbe07a; --butter-deep: #f2c23a; --track: #e3dac3;
box-sizing: border-box; padding: 14px 16px; border: 1.5px solid var(--line); border-radius: 16px; background: var(--card); color: var(--ink); box-shadow: 0 12px 28px rgb(0 0 0 / .14), 0 1px 2px rgb(0 0 0 / .08); font-family: var(--body); opacity: 0; transform: translateY(16px); transition: opacity 200ms ease-out, transform 200ms ease-out; }
:host([data-visible]) .card { opacity: 1; transform: translateY(0); }
:host([data-leaving]) .card { opacity: 0; transform: translateY(0); transition: opacity 160ms ease-out; }
:host([data-dark]) { color-scheme: dark; }
:host([data-dark]) .card { --card: #26211b; --ink: #ece3cf; --ink-2: #b3a78e; --line: rgb(236 227 207 / .14); --butter: #e3c766; --butter-deep: #c9a53f; --track: #3a3328; box-shadow: 0 12px 28px rgb(0 0 0 / .45), 0 1px 2px rgb(0 0 0 / .3); }
.hd { display: flex; gap: 10px; align-items: center; }
.hd svg { width: 36px; height: 36px; flex: none; }
.t { font-weight: 700; font-size: 14px; line-height: 1.35; }
.d { font-size: 12px; font-weight: 500; color: var(--ink-2); line-height: 1.5; margin: 8px 0 0; }
a { color: var(--ink); font-weight: 700; text-decoration: underline; text-decoration-color: var(--butter-deep); text-decoration-thickness: 2px; text-underline-offset: 2px; }
.btns { display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; }
button { font: 700 12px var(--body); padding: 6px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--ink-2); cursor: pointer; }
button:hover { background: var(--track); }
button.yes { background: var(--butter); color: #1b170f; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--butter-deep); outline-offset: 3px; }
@media (width < 760px) { :host { left: 16px; right: 16px; width: calc(100% - 32px); } }
@media (prefers-reduced-motion: reduce) { .card, :host([data-leaving]) .card { transition: none; transform: none; } }
:host([data-top]) { top: 64px; bottom: auto; right: var(--note-right, 60px); }
:host([data-top]) .card { transform: translateX(16px); }
:host([data-top][data-visible]) .card, :host([data-top][data-leaving]) .card { transform: none; }
@media (width < 760px) { :host([data-top]) { right: 16px; } }
@media (prefers-reduced-motion: reduce) {
  :host([data-top]) .card { transform: none; transition: opacity 200ms ease-out; }
  :host([data-top][data-leaving]) .card { transition: opacity 160ms ease-out; } }
`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [];
  let font;
  const layout = () => cards.forEach((c) => c.position());
  // `tag` names the host element; `onClick(event)` gets every click inside the card. `top` places
  // it top right; `css` is added to its stylesheet.
  function ButterCard(tag, onClick, { top = false, css = '' } = {}) {
    let host,
      shadow,
      hideTimer,
      showing = false,
      language,
      composerObserver;
    const dark = () =>
      host?.toggleAttribute(
        'data-dark',
        document.documentElement.classList.contains('dark') ||
          /dark/.test(getComputedStyle(document.documentElement).colorScheme),
      );
    const position = () => {
      if (!host || host.hidden) return;
      if (top) {
        // 8 px left of the rail (rail/rail.js: its right inset and width).
        const rail = globalThis.ButterRail;
        host.style.setProperty(
          '--note-right',
          `${(rail?.inset?.() ?? 0) + (rail?.WIDTH ?? 52) + 8}px`,
        );
        return;
      }
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
      // Above any card created earlier that is on screen.
      for (const c of cards) {
        if (c === self) break;
        if (c.showing) bottom = Math.max(bottom, c.top() + 12);
      }
      host.style.setProperty('--consent-bottom', `${bottom}px`);
    };
    function mount() {
      host = document.createElement(tag);
      host.hidden = true;
      shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      // Chromium does not register @font-face rules inside a shadow stylesheet. Register the
      // bundled face in the document font set, under a private name, for shadow-only use.
      if (!font) {
        font = new FontFace(
          'ButterConsentNunito',
          `url("${chrome.runtime.getURL('popup/fonts/nunito-latin.woff2')}")`,
          { weight: '200 900' },
        );
        document.fonts.add(font);
        font.load().catch(() => {});
      }
      style.textContent = CSS + css;
      shadow.append(style);
      const card = document.createElement('section');
      card.className = 'card';
      // A notification is announced politely and never takes focus; a prompt is a region.
      card.setAttribute('role', top ? 'status' : 'region');
      shadow.append(card);
      shadow.addEventListener('click', onClick);
      host.toggleAttribute('data-top', top);
      document.documentElement.append(host);
      new MutationObserver(dark).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
      if (!top) {
        composerObserver = new ResizeObserver(position);
        composerObserver.observe(document.documentElement);
        new MutationObserver(position).observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
        setTimeout(dark, 50),
      );
      addEventListener('resize', position);
      dark();
    }
    const self = {
      get showing() {
        return showing;
      },
      get host() {
        if (!host) mount();
        return host;
      },
      position,
      // Distance from the viewport's bottom to the card's top edge.
      top: () => innerHeight - host.getBoundingClientRect().top,
      // Fill the card: `title` names the region, `body` is the paragraph's HTML (the privacy link
      // is appended in the card's language), `buttons` the buttons' HTML. Only on a language change.
      fill(lang, title, body, link, buttons) {
        if (!host) mount();
        if (language === lang) return;
        language = lang;
        const card = shadow.querySelector('.card');
        card.lang = lang === 'zh' ? 'zh-CN' : 'en';
        card.setAttribute('aria-label', title);
        card.innerHTML = `<div class="hd">${PAT}<div class="t">${title}</div></div><p class="d">${body} ${self.policy(lang, link)}</p><div class="btns">${buttons}</div>`;
      },
      // The privacy policy link in `lang`, as `fill` appends it.
      policy: (lang, link) =>
        `<a href="https://github.com/SimianW/butter/blob/main/PRIVACY${lang === 'zh' ? '.zh-CN' : ''}.md" target="_blank" rel="noopener noreferrer">${link}</a>`,
      // Replace the card's content with static `markup`, every time; returns the card element so
      // the caller sets page text (an excerpt) as textContent.
      set(lang, markup) {
        if (!host) mount();
        language = null; // a later `fill` writes its copy again
        const card = shadow.querySelector('.card');
        card.lang = lang === 'zh' ? 'zh-CN' : 'en';
        card.innerHTML = markup;
        return card;
      },
      show() {
        if (showing) return;
        clearTimeout(hideTimer);
        showing = true;
        host.hidden = false;
        host.inert = false;
        host.removeAttribute('data-leaving');
        if (top) position();
        else layout();
        requestAnimationFrame(() => {
          if (showing) host.setAttribute('data-visible', '');
        });
      },
      hide(animate) {
        if (!host || !showing) return;
        showing = false;
        host.removeAttribute('data-visible');
        host.toggleAttribute('data-leaving', animate);
        // Disable controls immediately while retaining the fade; no invisible keyboard targets.
        host.inert = true;
        const finish = () => {
          host.hidden = true;
          host.removeAttribute('data-leaving');
          layout();
        };
        if (animate && (top || !reduced.matches)) hideTimer = setTimeout(finish, 160);
        else finish();
      },
    };
    if (!top) cards.push(self);
    return self;
  }
  globalThis.ButterCard = ButterCard;
})();
