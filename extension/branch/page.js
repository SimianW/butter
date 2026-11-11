// Isolated world. Ask in branch: ChatGPT DOM lookups, and the page adapter that run.js drives.
// Selectors were checked on the live page on 2026-11-07 (notes/runs/2026-11-07-ask-in-branch-27
// and -29). Menus are matched by ButterBranch.pick: structure (roles, icons) first, then English or
// Simplified Chinese labels. The "Branch in new chat" item has no test id or icon, so it is
// matched by its exact label and never by menu position (its sibling is "Branch into Work mode").
(() => {
  const B = ButterBranch,
    // Replies, turns and ChatGPT's "Ask ChatGPT" selection button: page/reader.js.
    R = ButterPageReader,
    { visible } = R;
  const COMPOSER =
    '#prompt-textarea[contenteditable="true"], .ProseMirror[contenteditable="true"][role="textbox"]';
  // Live: English "Send", Chinese "发送", no test id; the composer form's submit button.
  const SEND = [
    '[data-testid="send-button"]',
    ...['Send prompt', 'Send', 'Send message', '发送', '发送提示', '发送消息'].map(
      (name) => `button[aria-label="${name}"]`,
    ),
  ].join(', ');

  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  // What ButterBranch.pick needs to know about a button or menu item.
  const describe = (el) => ({
    el,
    popup: el.getAttribute('aria-haspopup') === 'menu',
    icons: [...el.querySelectorAll('use')].map((u) => u.getAttribute('href') || ''),
    label: label(el),
    testid: el.dataset.testid,
  });
  const scroller = () => [...document.querySelectorAll('.thread-scroll-container')].find(visible);
  const composer = () => [...document.querySelectorAll(COMPOSER)].find(visible) || null;
  // The rounded box around the composer, for placing the line above it.
  const composerBox = () => {
    for (let el = composer(); el && el !== document.body; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (parseFloat(s.borderTopLeftRadius) >= 16 && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
        return el.getBoundingClientRect();
    }
    return composer()?.getBoundingClientRect() || null;
  };
  // The row the line takes over: ChatGPT's own text within `band` px above the composer box
  // `rect`, such as its "ChatGPT can make mistakes" disclaimer, whose box ends on the composer's
  // top edge (live, 2026-11-07). Found by hit-testing the band, so it needs no selector; the
  // conversation's text scrolling behind doesn't count. Of several, the one nearest the composer.
  // Returns its box, its type, and the page background behind it (the first ancestor with an
  // opaque background-color; null when none, so the line keeps its own), or null when none.
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const opaque = (color) => {
    const inner = /\(([^)]*)\)/.exec(color)?.[1];
    if (!inner) return false; // "transparent"
    let alpha = inner.includes('/') ? inner.split('/')[1] : null;
    if (alpha === null && /^rgba?\(/.test(color)) alpha = inner.split(',')[3] ?? null;
    if (alpha === null) return true;
    alpha = alpha.trim();
    return (alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha)) >= 1;
  };
  const disclaimerRow = (rect, band) => {
    let found = null;
    for (let y = rect.top - 1; y > rect.top - band; y -= 5)
      for (let i = 0; i < 5; i++)
        for (const el of document.elementsFromPoint(rect.left + 4 + ((rect.width - 8) * i) / 4, y))
          if (
            ownText(el) &&
            !R.looseTurnOf(el) &&
            (!found || el.getBoundingClientRect().bottom > found.getBoundingClientRect().bottom)
          )
            found = el;
    if (!found) return null;
    let background = null;
    for (let el = found; el && !background; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor;
      if (opaque(color)) background = color;
    }
    const { left, top, width, height } = found.getBoundingClientRect();
    const s = getComputedStyle(found);
    return { left, top, width, height, background, fontSize: s.fontSize, lineHeight: s.lineHeight };
  };
  // Keys of this conversation's replies in page order (ButterBranch.replyStarted): the turn's
  // data-turn-key (live: one turn holds a question and its reply), else the reply element.
  // written: only replies that show text, not the empty one ChatGPT mounts while it thinks.
  const replyKeys = ({ written = false } = {}) =>
    R.replies(scroller() || document)
      .filter((el) => !written || el.textContent.trim())
      .map((el) => R.turnKeyOf(el) || el);

  // Formulas, for ButterBranch.quoteOf. ChatGPT renders them with KaTeX (live, 2026-11-07):
  // .katex inline, .katex-display > .katex for display math, each keeping its LaTeX source in
  // annotation[encoding="application/x-tex"]; the wrapper's data-math-source holds it too.
  const FORMULA = '.katex';
  const quoteDom = {
    formula(el) {
      const display = el.matches('.katex-display');
      if (!display && !(el.matches('.katex') && !el.parentElement?.closest('.katex-display')))
        return null;
      const tex =
        el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ??
        el.closest('[data-math-source]')?.getAttribute('data-math-source') ??
        null;
      return { tex, display };
    },
    layout(el) {
      const { display } = getComputedStyle(el);
      if (display === 'none') return 'hidden';
      if (display === 'table-cell') return 'cell';
      if (/^(inline|contents|ruby)/.test(display)) return 'inline';
      return /^(P|H[1-6]|UL|OL|PRE|BLOCKQUOTE|TABLE|HR)$/.test(el.tagName) ? 'paragraph' : 'line';
    },
    pre: (el) => /^pre/.test(getComputedStyle(el).whiteSpace),
  };

  const streaming = () =>
    !!(scroller() || document).querySelector('[data-talvt-turn-state="in_progress"]') ||
    [...document.querySelectorAll('[data-testid="stop-button"]')].some(visible);

  // More actions of one reply: a button of the reply's own turn, outside the reply text, never
  // a button of a later turn (a user turn under this one has none).
  const moreOf = (reply) => {
    const turn = R.looseTurnOf(reply);
    for (let scope = reply; scope; scope = scope.parentElement) {
      const candidates = [...scope.querySelectorAll('button')].filter(
        (el) => visible(el) && R.replyOf(el) === null && (!turn || R.looseTurnOf(el) === turn),
      );
      const more = B.pick(candidates.map(describe), 'more')?.el;
      if (more) return more;
      if (!turn || scope === turn) break;
    }
    return null;
  };

  // What decides whether ChatGPT can branch here (ButterBranch.hiddenReason). Evidence for each
  // signal is in notes/runs/2026-11-07-ask-in-branch-29/report.md.
  const facts = () => {
    const editor = composer(),
      form = editor?.closest('form');
    const replies = R.replies().filter(visible);
    const branchAction = replies.some((r) => moreOf(r)) ? true : streaming() ? null : false;
    return {
      temporary:
        B.temporaryUrl(location.href) ||
        // The Temporary Chat switch while it's on.
        [...document.querySelectorAll('use[href*="chat-bubble-checkmark-dashed"]')].some(visible),
      work: B.isWorkMode({
        composer: form && {
          placement: form.hasAttribute('data-composer-placement'),
          chat: form.hasAttribute('data-chatgpt-composer'),
        },
        label: editor?.getAttribute('aria-label'),
        sideChat: !!R.nativeAsk()?.sideChat,
      }),
      branchAction,
    };
  };

  // The page adapter for run.js. One per run.
  function adapter() {
    let latest = null,
      latestSince = 0;
    const menuItems = () => [...document.querySelectorAll('[role="menuitem"]')].filter(visible);
    const conversationOf = (el) =>
      el.closest('[data-chatgpt-selection-conversation-id]')?.dataset
        .chatgptSelectionConversationId;
    return {
      identity: () => B.identity(location.href),
      isLoaded: () => !!composer() && R.replies().some(visible),
      isStreaming: streaming,
      // The branch's own conversation has rendered: composer, a reply, and (where ChatGPT marks
      // message wrappers with their conversation) wrappers that belong to this identity.
      isRendered(id) {
        if (!composer()) return false;
        const replies = R.replies().filter(visible);
        if (!replies.length) return false;
        const owners = replies.map(conversationOf).filter(Boolean);
        return !owners.length || owners.includes(id);
      },
      // More actions of the latest reply. Scrolls this tab to the end so the latest turn is
      // mounted, and waits until the last reply has stayed the same for 400 ms.
      latestReplyMenu() {
        const box = scroller();
        if (box) box.scrollTop = box.scrollHeight;
        const replies = R.replies(box || document).filter(visible);
        const last = replies.at(-1);
        if (!last) return null;
        if (last !== latest) {
          latest = last;
          latestSince = performance.now();
          return null;
        }
        if (performance.now() - latestSince < 400) return null;
        return moreOf(last);
      },
      branchItem: () => B.pick(menuItems().map(describe), 'branch')?.el || null,
      newChatItem: () => B.pick(menuItems().map(describe), 'newchat')?.el || null,
      press(el) {
        if (el.getAttribute('role') === 'menuitem') {
          el.click();
          return;
        }
        // Radix opens the top-level dropdown on pointerdown, not on an untrusted click.
        el.focus({ preventScroll: true });
        const init = { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 };
        el.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }));
        el.dispatchEvent(new PointerEvent('pointerup', init));
      },
      dismissMenus() {
        for (let i = 0; i < 2 && document.querySelector('[role="menu"]'); i++)
          (document.activeElement || document.body).dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
          );
      },
      composerText() {
        const el = composer();
        return el ? el.innerText.replace(/ /g, ' ').trim() : null;
      },
      fill(text) {
        const el = composer();
        if (!el) return false;
        el.focus({ preventScroll: true });
        return document.execCommand('insertText', false, text);
      },
      sendButton() {
        const el = composer();
        const form = el?.closest('form');
        const usable = (b) =>
          visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
        return (
          [...(form || document).querySelectorAll(SEND)].find(usable) ||
          // Structural fallback: the composer form's submit button (labels vary by language).
          [...(form?.querySelectorAll('button[type="submit"]') || [])].find(usable) ||
          null
        );
      },
      send(button) {
        button.click();
        return true;
      },
    };
  }

  globalThis.ButterBranchPage = {
    adapter,
    composer,
    composerBox,
    disclaimerRow,
    replyKeys,
    facts,
    quoteDom,
    FORMULA,
    // A selection may not start or end in these, nor touch NON_TEXT, outside a formula.
    EXCLUDED: 'textarea, input, [contenteditable="true"], math, img, svg',
    NON_TEXT: 'math, img, video, canvas, iframe',
  };
})();
