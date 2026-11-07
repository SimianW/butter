// Isolated world. Ask in branch: ChatGPT DOM lookups, and the page adapter that run.js drives.
// Selectors were checked on the live page on 2026-11-07 (notes/runs/2026-11-07-ask-in-branch-27
// and -29). Menus are matched by ButterBranch.pick: structure (roles, icons) first, then English or
// Simplified Chinese labels. The "Branch in new chat" item has no test id or icon, so it is
// matched by its exact label and never by menu position (its sibling is "Branch into Work mode").
(() => {
  const B = ButterBranch;
  const ASSISTANT =
    '[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]';
  const TURN = '[data-turn-key], [data-testid^="conversation-turn-"], article';
  const COMPOSER =
    '#prompt-textarea[contenteditable="true"], .ProseMirror[contenteditable="true"][role="textbox"]';
  // Live: English "Send", Chinese "发送", no test id; the composer form's submit button.
  const SEND = [
    '[data-testid="send-button"]',
    ...['Send prompt', 'Send', 'Send message', '发送', '发送提示', '发送消息'].map(
      (name) => `button[aria-label="${name}"]`,
    ),
  ].join(', ');

  const visible = (el) => {
    if (!el?.isConnected || !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  // What ButterBranch.pick needs to know about a button or menu item.
  const describe = (el) => ({
    el,
    popup: el.getAttribute('aria-haspopup') === 'menu',
    icons: [...el.querySelectorAll('use')].map((u) => u.getAttribute('href') || ''),
    label: label(el),
    testid: el.dataset.testid,
  });
  const elementOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement);
  const replyOf = (node) => elementOf(node)?.closest(ASSISTANT) || null;
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
  // The top edge the line goes above: the composer's, or that of ChatGPT's own text sitting within
  // `band` px above it, such as its "ChatGPT can make mistakes" disclaimer, whose box ends on the
  // composer's top edge (live, 2026-11-07). Found by hit-testing the band, so it needs no selector;
  // the conversation's text scrolling behind doesn't count.
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const clearTop = (rect, band) => {
    let top = rect.top;
    for (let round = 0; round < 3; round++) {
      let next = top;
      for (let y = top - 1; y > top - band; y -= 5)
        for (let i = 0; i < 5; i++)
          for (const el of document.elementsFromPoint(
            rect.left + 4 + ((rect.width - 8) * i) / 4,
            y,
          ))
            if (ownText(el) && !el.closest(TURN))
              next = Math.min(next, el.getBoundingClientRect().top);
      if (next >= top) break;
      top = next;
    }
    return top;
  };
  // Keys of this conversation's replies in page order (ButterBranch.replyStarted): the turn's
  // data-turn-key (live: one turn holds a question and its reply), else the reply element.
  // written: only replies that show text, not the empty one ChatGPT mounts while it thinks.
  const replyKeys = ({ written = false } = {}) =>
    [...(scroller() || document).querySelectorAll(ASSISTANT)]
      .filter((el) => !written || el.textContent.trim())
      .map((el) => el.closest('[data-turn-key]')?.getAttribute('data-turn-key') || el);
  const headerBottom = () => {
    const header = [...document.querySelectorAll('header')].find(visible);
    const bottom = header?.getBoundingClientRect().bottom;
    return bottom > 0 && bottom < 120 ? bottom : 56;
  };

  // ChatGPT's own "Ask ChatGPT" selection button, and the box that draws it (the first
  // ancestor with a background), whose geometry and colors Butter's button copies.
  // sideChat: the same toolbar also offers "Ask in side chat", which only Work mode has.
  // Live (2026-11-07) the button is transparent at rest and, while hovered, tints only itself with
  // no radius or shadow; that tint is not the box, so a hovered, pressed or focused button is
  // skipped and the toolbar box under it is still found.
  const busy = (el) => el.matches(':hover, :active, :focus-visible');
  const nativeAsk = () => {
    const button = [...document.querySelectorAll('button, [role="button"]')].find(
      (el) => B.labels.nativeAsk.test(label(el).replace(/^❝\s*/, '')) && visible(el),
    );
    if (!button) return null;
    let box = button;
    for (let el = busy(button) ? button.parentElement : button, i = 0; el && i < 3; i++) {
      if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        box = el;
        break;
      }
      el = el.parentElement;
    }
    let sideChat = false;
    for (let el = button.parentElement, i = 0; el && el !== document.body && i < 4; i++) {
      sideChat = [...el.querySelectorAll('button, [role="button"]')].some((b) =>
        B.labels.sideChat.test(label(b)),
      );
      if (sideChat) break;
      el = el.parentElement;
    }
    return { button, box, sideChat };
  };
  // The label's text style is copied whole, so both labels render alike. Live (2026-11-07) the label
  // is the button's own text: 14px/18px, weight 400, ChatGPT's font stack, and antialiased smoothing,
  // without which macOS draws Butter's label heavier. A label in a child element is read there.
  const labelOf = (button) => {
    const walk = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); ) if (n.textContent.trim()) return n.parentElement;
    return button;
  };
  const nativeStyle = ({ button, box }) => {
    const b = getComputedStyle(box),
      t = getComputedStyle(labelOf(button));
    return {
      height: `${box.getBoundingClientRect().height}px`,
      borderRadius: b.borderRadius,
      boxShadow: b.boxShadow,
      border: b.border,
      backgroundColor: b.backgroundColor,
      color: t.color,
      font: {
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        letterSpacing: t.letterSpacing,
        lineHeight: t.lineHeight,
        webkitFontSmoothing: t.webkitFontSmoothing,
      },
    };
  };

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
    const turn = reply.closest(TURN);
    for (let scope = reply; scope; scope = scope.parentElement) {
      const candidates = [...scope.querySelectorAll('button')].filter(
        (el) => visible(el) && replyOf(el) === null && (!turn || el.closest(TURN) === turn),
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
    const replies = [...document.querySelectorAll(ASSISTANT)].filter(visible);
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
        sideChat: !!nativeAsk()?.sideChat,
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
      isLoaded: () => !!composer() && [...document.querySelectorAll(ASSISTANT)].some(visible),
      isStreaming: streaming,
      // The branch's own conversation has rendered: composer, a reply, and (where ChatGPT marks
      // message wrappers with their conversation) wrappers that belong to this identity.
      isRendered(id) {
        if (!composer()) return false;
        const replies = [...document.querySelectorAll(ASSISTANT)].filter(visible);
        if (!replies.length) return false;
        const owners = replies.map(conversationOf).filter(Boolean);
        return !owners.length || owners.includes(id);
      },
      // More actions of the latest reply. Scrolls this tab to the end so the latest turn is
      // mounted, and waits until the last reply has stayed the same for 400 ms.
      latestReplyMenu() {
        const box = scroller();
        if (box) box.scrollTop = box.scrollHeight;
        const replies = [...(box || document).querySelectorAll(ASSISTANT)].filter(visible);
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
    visible,
    replyOf,
    composer,
    composerBox,
    clearTop,
    replyKeys,
    headerBottom,
    nativeAsk,
    nativeBusy: ({ button }) => busy(button),
    nativeStyle,
    facts,
    quoteDom,
    FORMULA,
    // A selection may not start or end in these, nor touch NON_TEXT, outside a formula.
    EXCLUDED: 'textarea, input, [contenteditable="true"], math, img, svg',
    NON_TEXT: 'math, img, video, canvas, iframe',
  };
})();
