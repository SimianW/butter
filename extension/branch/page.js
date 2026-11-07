// Isolated world. Ask in branch: ChatGPT DOM lookups, and the page adapter that run.js drives.
// Selectors were checked on the live page on 2026-11-07 (notes/runs/2026-11-07-ask-in-branch-27).
// The "Branch in new chat" item has no test id or icon, so it is matched by its exact label and
// never by menu position (its sibling is "Branch into Work mode").
(() => {
  const ASSISTANT =
    '[data-markdown-text-style="assistant-message"], [data-message-author-role="assistant"]';
  const TURN = '[data-turn-key], [data-testid^="conversation-turn-"], article';
  const COMPOSER =
    '#prompt-textarea[contenteditable="true"], .ProseMirror[contenteditable="true"][role="textbox"]';
  const NATIVE_ASK = /^(Ask ChatGPT|询问 ChatGPT|询问ChatGPT|问问 ChatGPT|向 ChatGPT 提问)$/;
  const MORE_LABEL = /^(More actions)$/;
  const BRANCH_LABEL = /^(Branch conversation)$/;
  const NEW_CHAT_LABEL = /^(Branch in new chat)$/;
  const SEND =
    '[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send"], button[aria-label="Send message"]';

  const visible = (el) => {
    if (!el?.isConnected || !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim();
  const icon = (el, name) =>
    [...el.querySelectorAll('use')].some((u) => (u.getAttribute('href') || '').includes(name));
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
  const headerBottom = () => {
    const header = [...document.querySelectorAll('header')].find(visible);
    const bottom = header?.getBoundingClientRect().bottom;
    return bottom > 0 && bottom < 120 ? bottom : 56;
  };

  // ChatGPT's own "Ask ChatGPT" selection button, and the box that draws it (the first
  // ancestor with a background), whose geometry and colors Butter's button copies.
  const nativeAsk = () => {
    const button = [...document.querySelectorAll('button, [role="button"]')].find(
      (el) => NATIVE_ASK.test(label(el).replace(/^❝\s*/, '')) && visible(el),
    );
    if (!button) return null;
    let box = button;
    for (let el = button, i = 0; el && i < 3; el = el.parentElement, i++) {
      if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') {
        box = el;
        break;
      }
    }
    return { button, box };
  };
  const nativeStyle = ({ button, box }) => {
    const b = getComputedStyle(box),
      t = getComputedStyle(button);
    return {
      height: `${box.getBoundingClientRect().height}px`,
      borderRadius: b.borderRadius,
      boxShadow: b.boxShadow,
      border: b.border,
      backgroundColor: b.backgroundColor,
      color: t.color,
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
    };
  };

  const streaming = () =>
    !!(scroller() || document).querySelector('[data-talvt-turn-state="in_progress"]') ||
    [...document.querySelectorAll('[data-testid="stop-button"]')].some(visible);

  // The page adapter for run.js. One per run.
  function adapter() {
    const B = ButterBranch;
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
        const turn = last.closest(TURN);
        for (let scope = last; scope; scope = scope.parentElement) {
          const more = [...scope.querySelectorAll('button')].find(
            (el) =>
              visible(el) &&
              (el.dataset.testid === 'message-more-button' ||
                icon(el, 'icon-ellipsis-horizontal') ||
                MORE_LABEL.test(label(el))) &&
              replyOf(el) === null &&
              // Never a button of a later turn (a user turn under this one has none).
              (!turn || el.closest(TURN) === turn),
          );
          if (more) return more;
          if (!turn || scope === turn) break;
        }
        return null;
      },
      branchItem: () =>
        menuItems().find(
          (el) => el.getAttribute('aria-haspopup') === 'menu' && icon(el, 'icon-branch'),
        ) ||
        menuItems().find(
          (el) => el.getAttribute('aria-haspopup') === 'menu' && BRANCH_LABEL.test(label(el)),
        ) ||
        null,
      newChatItem: () =>
        menuItems().find(
          (el) => el.getAttribute('aria-haspopup') !== 'menu' && NEW_CHAT_LABEL.test(label(el)),
        ) || null,
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
        const scope = el?.closest('form') || document;
        return (
          [...scope.querySelectorAll(SEND)].find(
            (b) => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true',
          ) || null
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
    headerBottom,
    nativeAsk,
    nativeStyle,
    EXCLUDED: 'textarea, input, [contenteditable="true"], .katex, math, img, svg',
  };
})();
