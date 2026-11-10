// Isolated world. The selection pill (#77): Butter's icon buttons for a selection, in one pill 4 px
// right of ChatGPT's own "Ask ChatGPT" (flipped to its left when there is no room), shown and hidden
// with it, and never in Work mode (its toolbar offers "Ask in side chat"). ChatGPT's button is
// never touched. While ChatGPT's button is hovered, pressed or focused, the pill keeps the look it
// copied at rest: background, radius, shadow and text colour.
// Features register cells: Ask in branch (branch/content.js) and Bookmark (bookmarks/content.js).
// Each has its own switch, so neither owns the pill. A cell is
// `{ id, feature, icon, label(), keys(), shortcut(), wants(), activate(), reset() }`: `feature` is
// its switch in `data-butter-off`; `label()` its accessible name and hover label; `keys()` the key
// hint shown in the label and `shortcut()` the same key for `aria-keyshortcuts` ('' for none);
// `wants()` whether it shows for the current selection (read on selection change); `activate()`
// runs on a primary pointerdown or a keyboard click; `reset()` (optional) when the pill goes. The
// pill shows the cells whose switch is on and that want the selection, Ask in branch first.
// `hold(range, { place, lost })` hides the pill while a feature works from the selection (Ask in
// branch's question box): every frame it calls `place(anchor, area)`, `anchor` being where
// ChatGPT's button last was relative to `range` (null if it never showed) and `area` the range's
// box, until `release()`; `lost()` runs if the range leaves the page or Work mode shows.
// Geometry follows the approved mockup: 30 px high, 32 px per cell with a 1 px divider (one cell
// alone 30 × 30), the label 8 px below after 300 ms of hover, switching at once between cells.
// This script loads before both features' scripts; ChatGPT's button is found through
// branch/page.js (ButterBranchPage), which is read only once a selection exists.
(() => {
  const ORDER = ['branch', 'bookmark'];
  const GAP = 4, // px between ChatGPT's button and the pill
    EDGE = 8, // px the pill keeps from the window's right edge
    CELL = 32,
    HIGH = 30,
    TIP_AFTER = 300, // ms of hover before a label shows
    TIP_GAP = 8; // px between the pill and its label
  const CSS = `
:host { all: initial; position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 2147483000;
  --tip-bg: #0d0d0d; --tip-fg: #fff; --tip-keys: #b4b4b4; }
:host([data-dark]) { --tip-bg: #fff; --tip-fg: #0d0d0d; --tip-keys: #6b6b6b; }
.pill { position: fixed; display: none; box-sizing: border-box; height: ${HIGH}px; padding: 0; border-radius: var(--native-radius, 8px);
  background: var(--native-bg, rgb(48 48 48)); color: var(--native-fg, #fff);
  box-shadow: var(--native-shadow, 0 4px 8px -2px rgb(0 0 0 / .1), 0 2px 8px rgb(0 0 0 / .18)); }
:host([data-dark]) .pill { background: var(--native-bg, #3a3a3a); }
.pill[data-on] { display: flex; }
button { all: unset; box-sizing: border-box; width: ${CELL}px; height: ${HIGH}px; display: grid; place-items: center; cursor: pointer;
  color: inherit; -webkit-tap-highlight-color: transparent; }
button + button { border-left: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
button:only-child { width: ${HIGH}px; }
button:first-child { border-radius: var(--native-radius, 8px) 0 0 var(--native-radius, 8px); }
button:last-child { border-radius: 0 var(--native-radius, 8px) var(--native-radius, 8px) 0; }
button:only-child { border-radius: var(--native-radius, 8px); }
button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
button:focus-visible { outline: 2px solid #3b82f6; outline-offset: -2px; }
svg { display: block; width: 16px; height: 16px; }
.tip { position: fixed; display: none; white-space: nowrap; pointer-events: none; background: var(--tip-bg); color: var(--tip-fg);
  font: 600 12px/1 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, "PingFang SC", "Noto Sans CJK SC", sans-serif;
  padding: 7px 9px; border-radius: 8px; }
.tip[data-on] { display: block; }
.tip kbd { font: inherit; color: var(--tip-keys); margin-left: 8px; }
.tip kbd:empty { display: none; }
`;
  const cells = new Map(),
    buttons = new Map();
  let host = null,
    pill,
    tip,
    tipLabel,
    tipKeys;
  let ids = [], // the cells shown for the current selection, in ORDER
    range = null, // that selection
    path = '',
    held = null, // { range, place, lost } while a feature holds the selection
    frame = 0,
    native = null,
    nativeAt = 0,
    last = null, // ChatGPT's button relative to the selection: { dx, dy, width, height, style }
    checkTimer = 0,
    tipFor = null, // the cell whose label shows
    tipTimer = 0,
    hovering = null; // the cell under the pointer

  const off = (feature) => {
    const html = document.documentElement;
    return (
      !html ||
      html.hasAttribute('data-butter-disabled') ||
      (html.getAttribute('data-butter-off') || '').split(' ').includes(feature)
    );
  };
  const isDark = () => {
    const html = document.documentElement;
    const mode = html.getAttribute('data-appearance-mode') || html.getAttribute('data-theme');
    if (mode === 'dark' || mode === 'light') return mode === 'dark';
    if (html.classList?.contains('dark') || html.classList?.contains('light'))
      return html.classList.contains('dark');
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const mount = () => {
    if (host) return;
    host = document.createElement('chatgpt-butter-pill');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    pill = document.createElement('div');
    pill.className = 'pill';
    pill.setAttribute('role', 'group');
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('aria-hidden', 'true');
    tipLabel = document.createElement('span');
    tipKeys = document.createElement('kbd');
    tip.append(tipLabel, tipKeys);
    root.append(style, pill, tip);
    // Keys and clicks inside Butter's UI are not ChatGPT's business (e.g. type-to-focus).
    for (const type of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click'])
      host.addEventListener(type, (e) => e.stopPropagation());
    pill.addEventListener('pointerleave', () => {
      hovering = null;
      hideTip();
    });
  };
  // In <body>, as Ask in branch's UI: ChatGPT can replace <html> or <body>.
  const attach = () => {
    const parent = document.body || document.documentElement;
    if (host.parentNode !== parent) parent.append(host);
  };

  const activate = (id) => {
    hovering = null;
    hideTip();
    cells.get(id)?.activate();
  };
  const buttonOf = (id) => {
    let b = buttons.get(id);
    if (b) return b;
    b = document.createElement('button');
    b.setAttribute('type', 'button');
    b.innerHTML = cells.get(id).icon; // static markup only
    // Act on pointerdown: ChatGPT may hide its own button, and so the pill, before a click lands.
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      activate(id);
    });
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keeps the page selection
    b.addEventListener('click', (e) => {
      if (e.detail === 0) activate(id); // Enter or Space
    });
    b.addEventListener('pointerenter', () => {
      hovering = id;
      if (tipFor) showTip(id);
      else if (!tipTimer)
        tipTimer = setTimeout(() => {
          tipTimer = 0;
          if (hovering) showTip(hovering);
        }, TIP_AFTER);
    });
    b.addEventListener('focus', () => {
      if (b.matches(':focus-visible')) showTip(id);
    });
    b.addEventListener('blur', () => {
      if (tipFor === id && hovering !== id) hideTip();
    });
    buttons.set(id, b);
    return b;
  };
  const render = (next) => {
    mount();
    ids = next;
    pill.replaceChildren(...next.map(buttonOf));
    for (const id of next) {
      const c = cells.get(id),
        b = buttons.get(id),
        keys = c.shortcut?.() || '';
      b.setAttribute('aria-label', c.label());
      if (keys) b.setAttribute('aria-keyshortcuts', keys);
      else b.removeAttribute('aria-keyshortcuts');
    }
    if (tipFor) {
      if (next.includes(tipFor)) showTip(tipFor);
      else hideTip();
    }
  };

  function showTip(id) {
    const c = cells.get(id);
    if (!c || !ids.includes(id) || !pill?.hasAttribute('data-on')) return;
    clearTimeout(tipTimer);
    tipTimer = 0;
    tipFor = id;
    tipLabel.textContent = c.label();
    tipKeys.textContent = c.keys?.() || '';
    tip.setAttribute('data-on', '');
    placeTip();
  }
  function hideTip() {
    clearTimeout(tipTimer);
    tipTimer = 0;
    tipFor = null;
    tip?.removeAttribute('data-on');
  }
  // Centred under its cell, 8 px below the pill, inside the window.
  const placeTip = () => {
    const b = buttons.get(tipFor);
    if (!b) return;
    const r = b.getBoundingClientRect(),
      p = pill.getBoundingClientRect(),
      w = tip.offsetWidth;
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, innerWidth - EDGE - w));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(p.bottom + TIP_GAP)}px`;
  };

  // The pill at `anchor` (ChatGPT's button), or hidden with null.
  const draw = (anchor, style) => {
    if (!anchor || !ids.length) {
      pill?.removeAttribute('data-on');
      hideTip();
      return;
    }
    mount();
    attach();
    host.toggleAttribute('data-dark', isDark());
    const st = pill.style;
    if (style) {
      st.setProperty('--native-bg', style.backgroundColor);
      st.setProperty('--native-fg', style.color);
      st.setProperty('--native-radius', style.borderRadius);
      st.setProperty('--native-shadow', style.boxShadow);
    }
    const width = pill.offsetWidth || (ids.length === 1 ? HIGH : ids.length * CELL);
    let left = anchor.right + GAP;
    if (left + width > innerWidth - EDGE) left = anchor.left - GAP - width;
    st.left = `${left}px`;
    st.top = `${anchor.top}px`;
    pill.setAttribute('data-on', '');
    if (tipFor) placeTip();
  };

  // Follow ChatGPT's button every frame while a selection is shown or held.
  function tick() {
    frame = 0;
    const h = held,
      r = h ? h.range : range;
    if (!r) return;
    if (!r.startContainer.isConnected || (!h && location.pathname !== path)) return lost();
    if (!h) {
      const live = ids.filter((id) => !off(cells.get(id).feature));
      if (!live.length) return hide();
      if (live.length !== ids.length) render(live);
    }
    const P = globalThis.ButterBranchPage;
    if (!P) return lost();
    const now = performance.now();
    if (!native || !P.visible(native.box) || now - nativeAt > 250) {
      native = P.nativeAsk();
      nativeAt = now;
    }
    // ChatGPT's toolbar offers "Ask in side chat": Work mode, where Butter shows nothing.
    if (native?.sideChat) return lost();
    const area = r.getBoundingClientRect();
    if (native) {
      const n = native.box.getBoundingClientRect();
      // While ChatGPT's button is hovered, pressed or focused, keep the look it had at rest.
      const busy = P.nativeBusy(native);
      last = {
        dx: n.left - area.left,
        dy: n.top - area.bottom,
        width: n.width,
        height: n.height,
        style: busy && last?.style ? last.style : P.nativeStyle(native),
      };
    } else if (!h) last = null;
    let anchor = null;
    if (last) {
      anchor = { left: area.left + last.dx, top: area.bottom + last.dy };
      anchor.right = anchor.left + last.width;
      anchor.bottom = anchor.top + last.height;
    }
    if (h) {
      draw(null);
      h.place(anchor, area);
      if (held !== h) return; // the owner let go while placing
    } else draw(anchor, last?.style);
    frame = requestAnimationFrame(tick);
  }
  const follow = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // The current page selection: which cells want it.
  function check() {
    clearTimeout(checkTimer);
    checkTimer = 0;
    if (held) return;
    const s = getSelection();
    const next = ORDER.filter((id) => {
      const c = cells.get(id);
      return !!c && !off(c.feature) && !!c.wants();
    });
    if (!s || !s.rangeCount || s.isCollapsed || !next.length) return hide();
    range = s.getRangeAt(0).cloneRange();
    path = location.pathname;
    render(next);
    follow();
  }
  function hide() {
    clearTimeout(checkTimer);
    checkTimer = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    held = range = native = last = null;
    draw(null);
    ids = [];
    for (const c of cells.values()) c.reset?.();
  }
  function lost() {
    const h = held;
    hide();
    h?.lost?.();
  }
  document.addEventListener('selectionchange', () => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, 40);
  });
  document.addEventListener('butter-settings', () => check());

  globalThis.ButterPill = {
    register(cell) {
      cells.set(cell.id, cell);
    },
    // Read the selection, switches and labels again (a cell's predicate or label changed).
    update: () => check(),
    hold(r, { place, lost: onLost }) {
      cancelAnimationFrame(frame);
      frame = 0;
      hovering = null;
      held = { range: r, place, lost: onLost };
      tick();
    },
    // Back to the page selection.
    release() {
      if (!held) return;
      held = null;
      cancelAnimationFrame(frame);
      frame = 0;
      check();
    },
    hide,
  };
})();
