// Isolated world. History rail: one tick per question at the right edge of the chat. Hovering swells
// the ticks around the pointer like a wave and previews the question; clicking jumps to it.
// Questions come from history/conversation-main.js (ChatGPT's own API responses); stream/offscreen.js reports every
// turn ChatGPT mounts. Cost: the rail lives in a shadow root and animates only transform and
// opacity, so hovering never restyles ChatGPT's page. Layout is read for jumps and their size corrections.
(() => {
  const strings = zh => zh
    ? { label: '对话中的问题', more: '更早的问题还没加载，点击加载', seek: (n, total, state, unseen) => ButterSeekMeta(true, n, total, state, unseen), fromLatest: k => `最近第 ${k} 个问题` }
    : { label: 'Questions in this chat', more: 'Earlier questions are not loaded yet. Click to load them.', seek: (n, total, state, unseen) => ButterSeekMeta(false, n, total, state, unseen), fromLatest: k => k === 1 ? 'Latest question' : `${k} questions back` };
  let TXT = strings(document.documentElement?.getAttribute('data-butter-lang') === 'zh');
  const railOff = () => document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('rail');
  document.addEventListener('butter-settings', () => {
    TXT = strings(document.documentElement?.getAttribute('data-butter-lang') === 'zh');
    if (host) {
      rail.setAttribute('aria-label', TXT.label);
      more.setAttribute('aria-label', TXT.more);
      if (shown !== -2) { const i = shown; shown = -2; hover(i); }
      host.style.display = railOff() ? 'none' : '';
      host.inert = !!railOff();
    }
    if (railOff()) { cancelJump(); hover(-2); pointerY = null; rail?.classList.remove('hot'); }
    if (seek) showSeek();
    changed();
  });
  const PITCH_MAX = 14, PAD = 10, MORE_H = 16, RAIL_W = 52;
  const HEADER = 52, COMPOSER = 140;   // ChatGPT's fixed header and composer overlap the scroller
  const TOP_INSET = 64;                 // a jumped-to question lands this far below the scroller's top
  const EDGE = 40;                      // a turn showing only this much at the top or bottom isn't lit
  const PAGE_AT = 240;                 // ChatGPT loads earlier messages when scrolled within ~230px of the top
  const MAX_EARLIER = 50;               // at most 100 older turns / 60s per click; another click continues
  const SPEED = 2.5;                    // far jumps travel at this many viewport heights per second
  const STREAK = 420;                   // height of one repeat of the travel placeholder, px
  const SIGMA = 20, SWELL = 1.6;        // hover wave: width in px, extra width at the pointer
  const REST = { s: 1, o: 0.28 }, ACTIVE = { s: 1.75, o: 1 };
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const convOfPath = () => /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1] ?? null;

  // ---- Messages per conversation, oldest first. `q` is set on visible questions only.
  const states = new Map();   // ChatGPT doesn't refetch a chat it has cached, so keep earlier ones
  const stateOf = c => { let s = states.get(c); if (!s) states.set(c, s = { items: [], hasPrev: false }); return s; };
  let convId = null, cur = { items: [], hasPrev: false };

  const mergePage = (s, { before, hasPrev, items }) => {
    // An empty/overlapping final page can still tell us that history is complete.
    if (!items.length) { if (before) s.hasPrev = hasPrev; return; }
    if (before) {   // an older page; it ends where the loaded messages begin
      const have = new Set(s.items.map(x => x.id));
      const k = items.findIndex(x => have.has(x.id));
      if (k === 0) { s.hasPrev = hasPrev; return; }
      s.items = (k < 0 ? items : items.slice(0, k)).concat(s.items);
      s.hasPrev = hasPrev;
    } else {        // the newest page, on load or refetch
      const a = s.items.findIndex(x => x.id === items[0].id);
      if (a < 0) { s.items = items; s.hasPrev = hasPrev; } else s.items = s.items.slice(0, a).concat(items);
    }
  };
  const addSent = (s, { parent, item }) => {
    // A new question ends the thread. After an edit, what followed its parent was the old branch.
    const p = s.items.findIndex(x => x.id === parent);
    if (p >= 0) s.items = s.items.slice(0, p + 1);
    s.items = s.items.filter(x => x.id !== item.id).concat(item);
  };

  document.addEventListener('butter-nav', e => {
    let m; try { m = JSON.parse(e.detail); } catch { return; }
    syncConv();
    if (m.type === 'page') {
      mergePage(stateOf(m.conv), m);
      // Earlier messages go in above every recorded turn and push them all down: forget where they were.
      if (m.before && m.conv === convId) pos.clear();
    }
    else if (m.type === 'send') { addSent(m.conv ? stateOf(m.conv) : cur, m); cancelJump(); }   // ChatGPT scrolls to the new question
    changed();
  });

  const syncConv = () => {
    const c = convOfPath();
    if (c === convId) return;
    if (!convId && c && cur.items.length && !states.has(c)) states.set(c, cur);   // a new chat got its id
    convId = c;
    cur = c ? stateOf(c) : { items: [], hasPrev: false };
    clearTimeout(seekTimer); seek = null;
    pos.clear(); activeId = null; active = -1; reband(); cancelJump(); hover(-2);
    if (c) {
      opening = { end: performance.now() + 8000, sc: null, top: -1, height: -1, since: 0 };
      cancelAnimationFrame(openRaf); openRaf = requestAnimationFrame(settleOpen);
    }
    changed();
  };
  setInterval(syncConv, 700);

  // Opening layout mustn't light the whole rail before ChatGPT restores its scroll; a kept copy
  // may restore somewhere in the middle. Predict the latest question until the visible chat's geometry
  // is quiet for 350ms, then trust the band. The cap also releases stalled/never-mounted chats.
  let opening = null, openRaf = 0;
  const endOpening = () => {
    if (!opening) return;
    opening = null;
    cancelAnimationFrame(openRaf); openRaf = 0;
    kick();
  };
  addEventListener('wheel', endOpening, { capture: true, passive: true });
  addEventListener('touchstart', endOpening, { capture: true, passive: true });
  const settleOpen = () => {
    openRaf = 0;
    if (!opening) return;
    const now = performance.now();
    if (now >= opening.end) { endOpening(); return; }
    // The previous chat can remain visible after the URL changes; don't settle against its scroller.
    if (box?.width && cur.items.some(x => x.q != null && mountedEl(x.id))) {
      const top = sc.scrollTop, height = sc.scrollHeight;
      if (sc !== opening.sc || top !== opening.top || height !== opening.height) {
        Object.assign(opening, { sc, top, height, since: now });
      } else if (now - opening.since >= 350) { endOpening(); return; }
    } else opening.sc = null;
    openRaf = requestAnimationFrame(settleOpen);
  };

  // ---- Turns in the DOM. ChatGPT mounts a window of about five turns; `data-turn-key` is the
  // id of the turn's question.
  let sc = null, box = null, ioPos = null, ioBand = null;
  const onScreen = new Set();   // mounted turn elements with any part in view
  const mounted = new Map();   // question id -> its turn element while mounted
  const pos = new Map();       // question id -> top of its turn in scroll coordinates, last seen
  const mountedEl = id => { const el = mounted.get(id); return el?.isConnected && sc?.contains(el) ? el : null; };

  // ChatGPT keeps chats opened earlier in the tab as hidden copies, each with its own scroller, and
  // shows a copy again without remounting anything: follow whichever scroller is visible.
  // Layout is clean in a ResizeObserver callback, so reading it there is free.
  const scrollers = new WeakSet();
  const ro = new ResizeObserver(es => {
    for (const e of es) {
      const s = e.target;
      if (!s.isConnected) { ro.unobserve(s); continue; }
      if (e.contentRect.width > 0 && s !== sc) attach(s);
      if (s !== sc) continue;
      const r = s.getBoundingClientRect();
      box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right - (s.offsetWidth - s.clientWidth), width: r.width };
      changed();
    }
  });

  const attach = s => {
    syncConv();   // a newly visible scroller can precede both its turns and the next URL poll
    ioPos?.disconnect(); ioBand?.disconnect();
    sc = s; box = null; onScreen.clear();
    ioPos = new IntersectionObserver(es => {
      for (const e of es) pos.set(e.target.getAttribute('data-turn-key'), e.boundingClientRect.top - e.rootBounds.top + sc.scrollTop);
    }, { root: sc });
    // Every question showing more than EDGE px between the header and the composer is lit. A jump
    // lands its question TOP_INSET down, so the turn above shows only TOP_INSET - HEADER px under the
    // header (its last line or action buttons) and doesn't light too. Not shown while a jump is travelling.
    ioBand = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting && e.target.isConnected) onScreen.add(e.target); else onScreen.delete(e.target);
      if (!flying) kick();
    }, { root: sc, rootMargin: `-${HEADER + EDGE}px 0px -${COMPOSER + EDGE}px 0px` });
    for (const el of mounted.values()) if (el.isConnected && sc.contains(el)) { ioPos.observe(el); ioBand.observe(el); }
    if (!reconcileQueued) { reconcileQueued = true; setTimeout(reconcile, 150); }
  };
  // Start the lit set over. An observer reports a turn only when it crosses the band, so turns
  // already in view must be observed afresh: ChatGPT can show a chat kept in the tab, or change the
  // URL after mounting the new chat's turns, and clearing alone left no tick lit until a scroll.
  const reband = () => {
    onScreen.clear();
    if (ioBand) for (const el of mounted.values()) if (el.isConnected && sc.contains(el)) { ioBand.unobserve(el); ioBand.observe(el); }
  };

  let reconcileQueued = false;
  globalThis.butterNavTurn = el => {
    syncConv();
    const s = el.closest('.thread-scroll-container');
    if (!s) return;
    if (!scrollers.has(s)) {
      scrollers.add(s); ro.observe(s);
      // Any user scroll cancels a jump in progress.
      s.addEventListener('wheel', cancelJump, { passive: true });
      s.addEventListener('touchstart', cancelJump, { passive: true });
      s.addEventListener('pointerdown', e => { if (s === sc && e.target === s && box && e.clientX >= box.right) cancelJump(); }, { passive: true });   // scrollbar
    }
    mounted.set(el.getAttribute('data-turn-key'), el);
    if (anchor && s === sc) anchor.observe(el);
    if (s === sc) { ioPos.observe(el); ioBand.observe(el); }
    if (!reconcileQueued) { reconcileQueued = true; setTimeout(reconcile, 150); }
  };
  // Scrolling by keyboard too, unless the key goes to a text field, a button or the rail.
  const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
  addEventListener('keydown', e => {
    const t = e.target;
    if (!SCROLL_KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey || !(t instanceof Element) || t === host) return;
    if (t.isContentEditable || t.closest('input, textarea, select') || (e.key === ' ' && t.closest('button, a, [role="button"]'))) return;
    cancelJump();
  }, { capture: true, passive: true });

  // ChatGPT's submit spring visits every intervening virtualized turn. Move close to
  // the end before its handler measures placement, leaving it the final viewport to animate.
  // Capture is essential: the fetch-level `send` notification arrives after placement starts.
  const COMPOSER_INPUT = '.ProseMirror[contenteditable="true"]';
  const SEND_BUTTON = '[data-testid="send-button"], #composer-submit-button, button[type="submit"]';
  const beforeSend = composer => {
    if (!composer?.textContent.trim() || !sc?.isConnected || !sc.clientHeight) return;
    cancelJump();
    const bottom = sc.scrollHeight - sc.clientHeight;
    if (bottom - sc.scrollTop > 1.5 * sc.clientHeight) {
      sc.scrollTo({ top: Math.max(0, bottom - sc.clientHeight), behavior: 'instant' });
    }
  };
  addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.keyCode === 229 || e.repeat || !(e.target instanceof Element)) return;
    const composer = e.target.closest(COMPOSER_INPUT);
    const button = composer?.closest('form')?.querySelector(SEND_BUTTON);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    beforeSend(composer);
  }, { capture: true, passive: true });
  addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const button = e.target.closest(SEND_BUTTON);
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    beforeSend(button.closest('form')?.querySelector(COMPOSER_INPUT));
  }, { capture: true, passive: true });

  // Mounted turns are consecutive in the thread: add any the responses didn't cover (the extension
  // loaded late, or the API changed) and drop questions that sit between two of them (old branch).
  const reconcile = () => {
    reconcileQueued = false;
    if (!sc?.isConnected || !box?.width) return;   // a hidden copy holds another chat's turns
    const keys = [...sc.querySelectorAll('[data-turn-key]')].map(t => t.getAttribute('data-turn-key'));
    let list = cur.items, prev = -1;
    // Right after switching chats the previous chat's turns can still be the visible ones: only trust
    // turns that overlap what we know. (An empty list takes them; the chat's own response replaces them.)
    if (list.length && !keys.some(id => list.some(x => x.id === id))) return;
    keys.forEach((id, k) => {
      let i = list.findIndex(x => x.id === id);
      if (i < 0) {
        const q = mounted.get(id)?.querySelector('[data-user-message-bubble]')?.textContent.trim();
        if (!q) return;
        const next = keys.slice(k + 1).map(n => list.findIndex(x => x.id === n)).find(j => j >= 0);
        // After the previous turn's answer, i.e. before the next question; else before the next mounted turn.
        const after = prev >= 0 ? list.findIndex((x, j) => j > prev && x.q != null) : -1;
        i = prev >= 0 ? (after < 0 ? list.length : after) : next ?? list.length;
        list = [...list.slice(0, i), { id, q }, ...list.slice(i)];
      } else if (prev >= 0 && i > prev + 1) {
        const stale = list.slice(prev + 1, i).filter(x => x.q != null).length;
        if (stale) { list = list.filter((x, j) => !(j > prev && j < i && x.q != null)); i -= stale; }
      }
      prev = i;
    });
    if (list !== cur.items) { cur.items = list; changed(); }
  };

  // ---- Rail.
  // Placeholder for a far jump: paragraphs of text lines and a centered formula, as seen when
  // scrolling too fast to read. Used as a mask so the color follows the theme.
  const STREAK_SVG = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${STREAK}" preserveAspectRatio="none">` +
    [[14, 100], [40, 96], [66, 98], [92, 58], [150, 30, 35], [204, 100], [230, 93], [256, 97], [282, 71], [340, 99], [366, 88]]
      .map(([y, w, x = 0]) => `<rect x="${x}" y="${y}" width="${w}" height="10" rx="2"/>`).join('') + '</svg>');
  const CSS = `
    :host { all: initial; position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 20; display: block;
      color: #0d0d0d; font: 13px/1.45 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
      --surface: #fff; --line: rgb(0 0 0 / .08); --muted: #8f8f8f; --streak: rgb(0 0 0 / .09);
      --shadow: 0 10px 30px rgb(0 0 0 / .12), 0 1px 3px rgb(0 0 0 / .08); }
    :host([data-dark]) { color: #ececec; --surface: #2f2f2f; --line: rgb(255 255 255 / .1); --muted: #a3a3a3; --streak: rgb(255 255 255 / .1);
      --shadow: 0 10px 30px rgb(0 0 0 / .5), 0 1px 3px rgb(0 0 0 / .3); }
    .rail { position: absolute; top: 0; right: 0; width: ${RAIL_W}px; box-sizing: border-box; padding: ${PAD}px 6px;
      transform: translate(calc(-1 * var(--r)), var(--y)); opacity: 0; pointer-events: none; will-change: transform;
      transition: opacity .3s; }
    :host([data-on]) .rail { opacity: 1; pointer-events: auto; }
    .pill { position: absolute; inset: 0; border-radius: 14px; background: var(--surface); box-shadow: var(--shadow);
      opacity: 0; transform: scaleX(.4); transform-origin: right center;
      transition: opacity .2s, transform .35s cubic-bezier(.2, .9, .25, 1.15); }
    .rail.hot .pill { opacity: .94; transform: none; }
    button { all: unset; position: relative; display: flex; align-items: center; justify-content: flex-end;
      width: 100%; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .more { height: ${MORE_H}px; gap: 3px; padding-right: 2px; }
    .more i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .35; transition: opacity .2s; }
    .more:hover i, .more:focus-visible i { opacity: 1; }
    .more[hidden] { display: none; }
    .tick { height: var(--pitch); }
    .tick.busy .bar { animation: busy .7s ease-in-out infinite alternate; }
    @keyframes busy { to { opacity: .25; } }
    .bar { width: 12px; height: 2px; border-radius: 2px; background: currentColor; opacity: ${REST.o};
      transform-origin: right center; }
    button:focus-visible { outline: 2px solid #10a37f; outline-offset: -1px; border-radius: 4px; }
    .cardpos { position: absolute; top: 0; right: 0; pointer-events: none;
      transform: translate(calc(-1 * var(--r) - ${RAIL_W + 8}px), var(--cy));
      transition: transform .18s cubic-bezier(.2, .8, .2, 1); }
    .cardpos.instant { transition: none; }
    .card { position: absolute; top: 0; right: 0; box-sizing: border-box; width: max-content; max-width: 320px;
      padding: 9px 12px 10px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line);
      box-shadow: var(--shadow); opacity: 0; transform: translate(10px, -50%) scale(.97); transform-origin: right center;
      transition: opacity .16s, transform .22s cubic-bezier(.2, .8, .2, 1); }
    .card.show { opacity: 1; transform: translate(0, -50%); }
    .meta { font-size: 11px; color: var(--muted); margin-bottom: 2px; font-variant-numeric: tabular-nums; }
    .seek-card { max-width: 260px; }
    .seek-card .text { -webkit-line-clamp: 3; }
    .spin { display: inline-block; width: 9px; height: 9px; margin-right: 5px; vertical-align: -1px; border-radius: 50%;
      border: 1.5px solid #c4c4c4; border-top-color: #5d5d5d; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(1turn); } }
    .text { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
      white-space: pre-wrap; overflow-wrap: anywhere; }
    .warp { position: fixed; left: var(--wl); top: var(--wt); width: var(--ww); height: var(--wh); overflow: hidden;
      pointer-events: none; visibility: hidden; opacity: 0;
      -webkit-mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent);
      mask-image: linear-gradient(transparent, #000 15%, #000 85%, transparent); }
    .streak { position: absolute; left: 0; right: 0; top: -${STREAK}px; height: calc(100% + ${2 * STREAK}px);
      background: var(--streak); will-change: transform;
      -webkit-mask: url("${STREAK_SVG}") 0 0 / 100% ${STREAK}px repeat-y; mask: url("${STREAK_SVG}") 0 0 / 100% ${STREAK}px repeat-y; }
    @media (prefers-reduced-motion: reduce) { .rail, .pill, .cardpos, .card { transition: none; } .spin, .tick.busy .bar { animation: none; } }`;

  let host = null, rail, pill, more, tickBox, cardPos, card, meta, text, warp, streak;
  let ticks = [], bars = [], qs = [], idxOf = new Map(), activeId = null, active = -1;
  let geo = null;   // { y: rail top, top: first tick top, pitch } in viewport px

  const build = () => {
    host = document.createElement('chatgpt-butter-nav');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><nav class="rail" aria-label="${TXT.label}"><div class="pill"></div>` +
      `<button class="more" aria-label="${TXT.more}"><i></i><i></i><i></i></button><div class="ticks"></div></nav>` +
      `<div class="cardpos instant"><div class="card" role="tooltip"><div class="meta"></div><div class="text"></div></div></div>` +
      `<div class="warp"><div class="streak"></div></div>`;
    [rail, pill, more, tickBox, cardPos, card, meta, text, warp, streak] =
      ['.rail', '.pill', '.more', '.ticks', '.cardpos', '.card', '.meta', '.text', '.warp', '.streak'].map(s => root.querySelector(s));
    document.body.append(host);
    const dark = () => host.toggleAttribute('data-dark', document.documentElement.classList.contains('dark') ||
      /dark/.test(getComputedStyle(document.documentElement).colorScheme));
    dark();
    new MutationObserver(dark).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(dark, 50));   // theme "System"

    rail.addEventListener('pointerenter', () => { held = false; rail.classList.add('hot'); });
    rail.addEventListener('pointermove', e => { pointerY = e.clientY; hover(indexAt(e.clientY)); kick(); });
    rail.addEventListener('pointerleave', () => { rail.classList.remove('hot'); pointerY = null; hover(-2); kick(); });
    rail.addEventListener('focusin', e => { const i = ticks.indexOf(e.target); hover(e.target === more ? -1 : i); });
    rail.addEventListener('focusout', () => { if (pointerY === null) hover(-2); });
    rail.addEventListener('click', e => {
      if (railOff()) return;
      endOpening();
      const i = e.target === more ? -1 : e.detail === 0 ? ticks.indexOf(e.target) : indexAt(e.clientY);
      // The click starts the trip: put the card away until the pointer comes back to the rail. While
      // the page is busy, moves on the way out and the leave event arrive late and would hold it up.
      if (i >= -1 && e.detail !== 0) { hover(-2); held = true; }
      if (i === -1) loadEarlier(); else if (i >= 0) jump(i);
    });
    rail.addEventListener('keydown', e => {
      const i = ticks.indexOf(e.target), d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (i < 0 || !d) return;
      e.preventDefault(); held = false; ticks[Math.max(0, Math.min(ticks.length - 1, i + d))].focus();
    });
  };

  // Tick under a viewport y, from the rail's own geometry: no layout reads. -1 = the "earlier" dots.
  const indexAt = y => {
    if (!geo) return -2;
    const r = (y - geo.top) / geo.pitch;
    if (r < 0 && cur.hasPrev && y >= geo.top - MORE_H) return -1;
    return Math.max(0, Math.min(qs.length - 1, Math.floor(r)));
  };
  const tickY = i => geo.top + (i + 0.5) * geo.pitch;

  let seek = null, seekTimer;
  const showSeek = () => {
    if (!seek || !host || !geo || railOff()) return;
    const i = idxOf.get(seek.id); if (i == null) return;
    rail.classList.add('hot'); card.classList.add('show', 'seek-card'); cardPos.classList.add('instant');
    meta.hidden = false;
    meta.textContent = TXT.seek(seek.n, seek.total, seek.state, seek.unseen);
    if (seek.state === 'loading') { const spinner = document.createElement('span'); spinner.className = 'spin'; meta.prepend(spinner); }
    text.textContent = qs[i].q.slice(0, 400);
    host.style.setProperty('--cy', `${tickY(i)}px`);
    ticks.forEach((tick, j) => tick.classList.toggle('busy', j === i && seek.state === 'loading'));
    kick();
  };
  document.addEventListener('butter-seek-state', e => {
    let m; try { m = JSON.parse(e.detail); } catch { return; }
    if (m.conv !== convOfPath() || !['idle', 'dragging', 'loading'].includes(m.state)) return;
    clearTimeout(seekTimer);
    if (m.state === 'idle') {
      if (!seek) return;
      seek = { ...seek, state: 'settled' }; showSeek();
      seekTimer = setTimeout(() => {
        seek = null; card?.classList.remove('seek-card');
        if (pointerY === null) { rail?.classList.remove('hot'); card?.classList.remove('show'); shown = -2; }
        else { shown = -2; hover(indexAt(pointerY)); }
        setBusy(busyId, busyTok); kick();
      }, 1000);
    } else {
      if (!seek) cancelJump();
      seek = m; shown = -2; held = false; pointerY = null;
      showSeek();
    }
  });

  let shown = -2, held = false;
  const hover = i => {
    if (seek) { showSeek(); return; }
    if (i === shown || !host || (held && i !== -2)) return;
    const was = shown; shown = i;
    if (i === -2) { card.classList.remove('show'); return; }
    meta.textContent = i === -1 ? '' : cur.hasPrev ? TXT.fromLatest(qs.length - i) : `${i + 1} / ${qs.length}`;
    meta.hidden = i === -1;
    const q = i === -1 ? TXT.more : qs[i].q;
    text.textContent = q.length > 400 ? q.slice(0, 400) + '…' : q;
    // Slide between ticks; appear in place.
    cardPos.classList.toggle('instant', was === -2);
    host.style.setProperty('--cy', `${i === -1 ? geo.top - MORE_H / 2 : tickY(i)}px`);
    card.classList.add('show');
  };

  // Hover wave: each bar eases toward its target width/opacity; runs only while something moves.
  let pointerY = null, raf = 0, last = 0, cs = [], co = [], ct = [], barIds = [];   // current scaleX, opacity, scaleY; question per bar
  const targetOf = j => {
    const on = seek ? (seek.lit || [seek.id]).includes(qs[j].id) : opening ? j === qs.length - 1 : flying ? j === active : litIds.has(qs[j].id) || (pinned && j === active);
    let s = on ? ACTIVE.s : REST.s, o = on ? ACTIVE.o : REST.o, t = 1;
    if (pointerY !== null) {
      const d = (tickY(j) - pointerY) / SIGMA, g = Math.exp(-d * d / 2);
      s = Math.max(s, REST.s + SWELL * g); o = Math.max(o, REST.o + (1 - REST.o) * g); t = 1 + 0.6 * g;
    }
    return [s, o, t];
  };
  const step = now => {
    // A frame's timestamp is when Chrome began it, which can be earlier than the performance.now()
    // that kick() stored while the page was busy. A negative interval made k hugely negative and
    // threw the bars far past their targets: one tick swelled over the whole screen for a few frames.
    const k = 1 - Math.exp(-Math.max(0, Math.min(64, now - last)) / 60); last = Math.max(last, now);
    let moving = false;
    for (let j = 0; j < bars.length; j++) {
      const [s, o, t] = targetOf(j);
      if (Math.abs(s - cs[j]) < 0.003 && Math.abs(o - co[j]) < 0.003 && Math.abs(t - ct[j]) < 0.003) {
        if (cs[j] === s && co[j] === o && ct[j] === t) continue;
        cs[j] = s; co[j] = o; ct[j] = t;
      } else {
        cs[j] += (s - cs[j]) * k; co[j] += (o - co[j]) * k; ct[j] += (t - ct[j]) * k; moving = true;
      }
      bars[j].style.transform = `scale(${cs[j].toFixed(3)}, ${ct[j].toFixed(3)})`;
      bars[j].style.opacity = co[j].toFixed(3);
    }
    raf = moving ? requestAnimationFrame(step) : 0;
  };
  // Ids of the questions on screen, worked out once per animation run rather than per bar.
  let litIds = new Set();
  const lit = () => { litIds = new Set(); for (const el of onScreen) if (el.isConnected) litIds.add(el.getAttribute('data-turn-key')); else onScreen.delete(el); };
  const kick = () => { lit(); if (!raf && geo) { last = performance.now(); raf = requestAnimationFrame(step); } };

  const setActive = id => { activeId = id; const i = idxOf.get(id) ?? -1; if (i !== active) { active = i; kick(); } };

  let renderQueued = false;
  const changed = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };
  const render = () => {
    renderQueued = false;
    qs = cur.items.filter(x => x.q != null);
    idxOf = new Map(qs.map((x, i) => [x.id, i]));
    const n = qs.length;
    const on = !railOff() && !!box && box.width >= 560 && n >= 1 && n + (cur.hasPrev ? 1 : 0) >= 2;
    if (!on) { host?.removeAttribute('data-on'); card?.classList.remove('show'); geo = null; if (!seek) hover(-2); return; }
    if (!host) { if (!document.body) return; build(); }
    while (ticks.length < n) {
      const b = document.createElement('button');
      b.className = 'tick'; b.append(document.createElement('span')); b.firstChild.className = 'bar';
      tickBox.append(b); ticks.push(b);
    }
    while (ticks.length > n) ticks.pop().remove();
    bars = ticks.map(b => b.firstChild);
    ticks.forEach((b, i) => { b.setAttribute('aria-label', qs[i].q.slice(0, 120)); b.classList.toggle('busy', qs[i].id === busyId); });
    // A bar's animation state follows its question, not its slot: an older page adds questions at
    // the top and shifts every slot, which made the lit look slide onto the wrong tick and back.
    // While a chat is opening the bars show the prediction at once, in step with the ticks moving.
    const was = new Map(barIds.map((id, j) => [id, [cs[j], co[j], ct[j]]]));
    barIds = qs.map(x => x.id);
    cs.length = co.length = ct.length = n;
    for (let j = 0; j < n; j++) {
      const a = j === n - 1 ? ACTIVE : REST;
      [cs[j], co[j], ct[j]] = opening ? [a.s, a.o, 1] : was.get(barIds[j]) ?? [REST.s, REST.o, 1];   // new bars start at rest
      bars[j].style.transform = `scale(${cs[j].toFixed(3)}, ${ct[j].toFixed(3)})`;
      bars[j].style.opacity = co[j].toFixed(3);
    }
    active = idxOf.get(activeId) ?? -1;

    // Centered in the part of the chat that isn't under the header or the composer.
    const top = box.top + HEADER, bottom = box.bottom - COMPOSER, moreH = cur.hasPrev ? MORE_H : 0;
    const pitch = Math.min(PITCH_MAX, (bottom - top - 2 * PAD - moreH) * 0.85 / n);
    const h = 2 * PAD + moreH + n * pitch;
    const y = Math.round((top + bottom) / 2 - h / 2);
    geo = { y, top: y + PAD + moreH, pitch };
    more.hidden = !cur.hasPrev;
    host.style.setProperty('--r', `${Math.round(innerWidth - box.right + 4)}px`);
    host.style.setProperty('--y', `${y}px`);
    host.style.setProperty('--pitch', `${pitch}px`);
    const colW = Math.min(760, box.width - 96);   // the text column, for the travel placeholder
    host.style.setProperty('--wl', `${Math.round((box.left + box.right - colW) / 2)}px`);
    host.style.setProperty('--ww', `${Math.round(colW)}px`);
    host.style.setProperty('--wt', `${Math.round(top)}px`);
    host.style.setProperty('--wh', `${Math.round(bottom - top)}px`);
    host.setAttribute('data-on', '');
    if (seek) showSeek();
    if (shown >= n) hover(-2);
    kick();
  };

  // ---- Jumping. A turn ChatGPT hasn't mounted has no element to scroll to: go where it should be
  // (last seen there, or interpolated between turns that were), let ChatGPT mount it, then align.
  // While a jump travels only its target is lit; once it lands (or ends) the ticks show what is on screen.
  let jumpTok = 0, journey = null, flying = false;
  const landedAt = () => { flying = false; kick(); };
  // Stops a jump in progress and shows the chat again at once.
  function cancelJump() { endOpening(); jumpTok++; journey = null; flying = false; unpin(); if (trip) arrive(null, 0); if (busyTok) setBusy(null); }
  // From a click until the user scrolls, the clicked question stays the current one.
  let pinned = false;
  let anchor = null;
  // Delayed KaTeX or a remounted neighbour can grow even after arrival. While the tick is pinned,
  // size changes keep its question aligned; no polling or layout reads while the chat is idle.
  const follow = (id, tok, off = 0) => {
    anchor?.ro.disconnect();
    const observe = el => {
      ro.observe(el);
      if (el.getAttribute('data-turn-key') === id)
        for (let p = el.parentElement; p && p !== sc; p = p.parentElement) ro.observe(p);
    };
    const ro = new ResizeObserver(entries => {
      // A remount gets observed by butterNavTurn; retain the logical id, not the old element.
      for (const e of entries) if (!e.target.isConnected) ro.unobserve(e.target);
      if (tok !== jumpTok || !pinned) return;
      const el = mountedEl(id);
      if (el) {
        const t = targetTop(el, anchor.off);
        if (Math.abs(t - sc.scrollTop) > 2) sc.scrollTop = t;
      }
    });
    anchor = { ro, observe, off };
    for (const el of mounted.values()) if (el.isConnected && sc.contains(el)) observe(el);
  };
  function unpin() {
    anchor?.ro.disconnect(); anchor = null;
    if (!pinned) return;
    pinned = false;
    kick();   // back to lighting what is on screen; the set kept up to date while pinned
  }
  // Records where the mounted turns are now, adds them to `seen`, and returns their range in `qs`
  // ([Infinity, -1] if none). The turn after them starts where the last one ends, which keeps an
  // estimate below a tall turn from landing inside it again.
  const measure = seen => {
    const top = sc.getBoundingClientRect().top - sc.scrollTop;
    let a = Infinity, b = -1, bottom = 0;
    for (const [id, el] of mounted) {
      if (!el.isConnected || !sc.contains(el)) continue;
      const r = el.getBoundingClientRect();
      pos.set(id, r.top - top); seen.add(id);
      const j = idxOf.get(id);
      if (j != null) { a = Math.min(a, j); if (j > b) { b = j; bottom = r.bottom - top; } }
    }
    if (b >= 0 && b + 1 < qs.length) { pos.set(qs[b + 1].id, bottom); seen.add(qs[b + 1].id); }
    return [a, b];
  };
  const MAX_TRIP = 12000;
  const estimate = i => {
    let lo = i, hi = i;
    while (lo >= 0 && !pos.has(qs[lo].id)) lo--;
    while (hi < qs.length && !pos.has(qs[hi].id)) hi++;
    const y = j => pos.get(qs[j].id);
    if (lo === i) return y(i);
    const end = sc.scrollHeight;
    if (lo < 0 && hi >= qs.length) return end * i / qs.length;
    if (lo < 0) return y(hi) * i / hi;
    if (hi >= qs.length) return y(lo) + (end - y(lo)) * (i - lo) / (qs.length - lo);
    return y(lo) + (y(hi) - y(lo)) * (i - lo) / (hi - lo);
  };

  const targetTop = (el, off = 0) => Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight,
    sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - TOP_INSET + off));

  const jump = async (i, earlier = false) => {
    // Repeated input for the current destination keeps its in-progress readiness work.
    // (Not during an earlier-dots trip: its target moves to older questions as pages arrive.)
    if (!earlier && trip && !journey?.earlier && busyId === qs[i].id) return;
    const flight = journey ?? { end: performance.now() + (earlier ? 60000 : MAX_TRIP), ready: new Map() };
    flight.earlier = earlier;
    const tok = ++jumpTok, end = flight.end,
      live = () => tok === jumpTok && performance.now() < end;
    anchor?.ro.disconnect(); anchor = null;
    let id = qs[i].id;
    // A click during a trip takes the trip over (its jump is no longer live). Ending it would fade the
    // chat in and out again while the page is busy, showing whatever half-rendered part it is at.
    const relay = !!trip;
    if (relay) trip.tok = tok;
    setBusy(null);
    flying = true; setActive(id); pinned = true; kick();   // setActive kicks only when the index changes
    let el = mountedEl(id);
    // Close by: glide there.
    if (!earlier && !relay && el && Math.abs(targetTop(el) - sc.scrollTop) < sc.clientHeight * 1.5 && !(cur.hasPrev && targetTop(el) < PAGE_AT)) {
      journey = null;
      await glide(el, live);
      if (tok === jumpTok) landedAt();
      if (live() && pinned) follow(id, tok);
      else if (tok === jumpTok) unpin();
      return;
    }
    // Farther away the turn is unmounted or skipped by content-visibility, and rendering it takes the
    // page a second or more (more if arriving at the top makes ChatGPT load earlier messages), during
    // which nothing can paint; scrolling through the real turns in between would render each of them.
    // So the trip is played on the compositor, which keeps animating while the page is busy: the
    // chat speeds off toward the target, placeholder lines stream past while ChatGPT renders the
    // target behind them, and the chat slides in at the same speed and slows to a stop on it.
    // Content moves down when going up. Which side the target is on comes from the mounted turns,
    // whose positions are read now, rather than from records that may be stale.
    journey = flight;
    const seen = new Set();
    let [a, b] = measure(seen);
    const m = earlier ? 1 : -(Math.sign(el ? targetTop(el) - sc.scrollTop : b < 0 ? estimate(i) - sc.scrollTop : i - b) || 1);
    setBusy(id, tok);
    let landed = false;
    try {
      if (live()) await (relay ? redirect(m, tok) : depart(el ?? sc.querySelector('[data-turn-key]'), m, tok));
      if (!live()) return;
      if (earlier) {
        const loadEnd = end - 10000;   // reserve time to align/reveal after the loading bound
        for (let pages = 0; cur.hasPrev && pages < MAX_EARLIER && live() && performance.now() < loadEnd; pages++) {
          // Leave and re-enter the paging band: a prepend can keep the sentinel intersecting.
          sc.scrollTop = PAGE_AT + 32;
          await frame(); await frame();
          if (!live()) return;
          const page = nextPage(Math.min(10000, loadEnd - performance.now()), live);   // arm before scrolling
          sc.scrollTop = 0;
          if (!await page) break;             // stalled/offline: reveal the oldest loaded question
          await frame();
          id = cur.items.find(x => x.q != null)?.id;
          // The fetch hook reports before React commits. Don't start another page in that gap.
          const until = performance.now() + 2000;
          while (live() && !mountedEl(id) && performance.now() < until) { sc.scrollTop = 0; await frame(); }
        }
        await frame();
        if (!live()) return;
        i = 0; id = qs[0]?.id; el = mountedEl(id);
        setActive(id); setBusy(id, tok);
      }
      el = mountedEl(id);
      for (let tries = 0; tries < 8 && !el && live(); tries++) {
        i = idxOf.get(id);   // earlier pages may have changed the question's index
        if (i == null) return;
        if (tries) {
          // Where the records put the target, it didn't mount: ChatGPT has re-measured turns or inserted
          // earlier messages since they were taken. Drop the older records between the turns mounted
          // here and the target, so the next estimate starts from these and moves toward the target.
          // Positions read during this jump stay: after an overshoot they bound the target from the other side.
          [a, b] = measure(seen);
          const [from, to] = b < 0 || (i >= a && i <= b) ? [i, i + 1] : i < a ? [0, a] : [b + 2, qs.length];
          for (let j = from; j < to; j++) if (!seen.has(qs[j].id)) pos.delete(qs[j].id);
        }
        sc.scrollTop = Math.max(0, estimate(i) - TOP_INSET);
        for (let f = 0; f < 30 && live() && !(el = mountedEl(id)); f++) await frame();
      }
      if (!el || !live()) return;
      sc.scrollTop = targetTop(el);
      let ready = flight.ready.get(id);
      const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (!ready || ready.el !== el || Math.abs(ready.top - top) > 2) {
        ready = { el, top, geometry: {} }; flight.ready.set(id, ready);
      }
      if (!ready.page) {
        if (!earlier && cur.hasPrev && sc.scrollTop < PAGE_AT) { await nextPage(4000, live); await new Promise(r => setTimeout(r, 150)); }
        if (!live()) return;
        ready.page = true;
      }
      // Soon after a chat opens ChatGPT mounts formulas as raw TeX and typesets them a moment later.
      const pendingMath = () => [...(mountedEl(id)?.querySelectorAll('[data-math-source]') ?? [])].some(x => !x.querySelector('.katex'));
      if (!ready.math || pendingMath()) {
        for (const end = performance.now() + 3000; live() && performance.now() < end && pendingMath();) await frame();
        if (!live()) return;
        ready.math = !pendingMath();
      }
      el = mountedEl(id);
      if (!el || !live()) return;
      const lead = still() ? 0 : m * Math.min(400, sc.clientHeight * 0.4);
      follow(id, tok, lead);   // keep correcting while hidden, during reveal, and across remounts
      // Quiet frames and stable target geometry overlap. Recheck after quiet: it can outlast the
      // geometry check while ChatGPT renders another neighbour. Unrelated total-height growth is OK.
      await Promise.all([ready.quiet ? null : quiet(live, 4000), steady(el, live, lead, 3000, 150, ready.geometry)]);
      if (!live()) return;
      ready.quiet = true;
      el = await steady(el, live, lead, 3000, 150, ready.geometry);
      if (!live() || !el?.isConnected || !pinned) return;
      flash(el);
      landed = true;
      anchor.off = 0;
      await arrive(el, lead);
      if (tok === jumpTok) landedAt();   // stopped moving; settle only nudges by a few px
      await settle(el, live);
    } finally {
      const expired = tok === jumpTok && performance.now() >= end;
      // A takeover inherits the first click's deadline. At expiry keep a mounted, aligned target;
      // otherwise reveal where ChatGPT got to and release the anchor, without another render.
      if (expired && !landed) {
        el = mountedEl(id);
        if (el) {
          // `follow` may still hold it `lead` px short of the landing spot: align it before the reveal.
          const t = targetTop(el);
          if (pinned) sc.scrollTop = t;
          landed = Math.abs(t - sc.scrollTop) <= 2;
          if (landed) flash(el);
        }
      }
      if (trip?.tok === tok) arrive(null, 0);
      if (busyTok === tok) setBusy(null);
      if (tok === jumpTok) {
        journey = null; landedAt();
        if (landed && pinned) follow(id, tok);
        else unpin();
      }
    }
  };

  const scrollEnd = () => new Promise(r => { sc.addEventListener('scrollend', r, { once: true }); setTimeout(r, 1500); });
  // The browser's smooth scrolling runs on the compositor: it keeps going if the page is busy.
  const glide = async (el, live) => {
    flash(el);
    const done = scrollEnd();
    sc.scrollTo({ top: targetTop(el), behavior: 'smooth' });
    await done;
    await settle(el, live);
  };
  // A few quiet frames don't mean neighbouring answers have finished mounting/typesetting. Keep
  // following the question through arrival, including a replacement of its virtualized element.
  const settle = (el, live) => steady(el, live, 0, 2000, 350);
  const steady = async (el, live, off = 0, max = 3000, span = 150, state = {}) => {
    const end = performance.now() + max, id = el.getAttribute('data-turn-key');
    while (live() && performance.now() < end) {
      el = mountedEl(id);
      if (!el) { state.el = null; state.since = performance.now(); await frame(); continue; }
      const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (state.el !== el || Math.abs(state.top - top) > 2 || state.since == null) {
        state.el = el; state.top = top; state.since = performance.now();
      }
      const t = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, top - TOP_INSET + off));
      if (Math.abs(t - sc.scrollTop) > 2) sc.scrollTop = t;
      if (performance.now() - state.since >= span) return el;
      await frame();
    }
    return mountedEl(id);
  };
  // Resolves once the page paints at a normal pace again: three frames under 40 ms in a row.
  const quiet = async (live, max) => {
    const end = performance.now() + max;
    let last = await frame(), ok = 0;
    while (ok < 3 && live() && performance.now() < end) { const t = await frame(); ok = t - last < 40 ? ok + 1 : 0; last = t; }
  };
  // Conversation-scoped and cancellable. A response from a hidden chat cannot wake this wait;
  // timed-out waits leave no callbacks behind. Completion also includes empty final pages.
  const nextPage = async (max, live) => {
    const first = cur.items[0]?.id, end = performance.now() + max;
    while (live() && performance.now() < end) {
      if (!cur.hasPrev || cur.items[0]?.id !== first) return true;
      await frame();
    }
    return false;
  };

  // The trip. Both halves are things the compositor runs by itself, so they keep moving while the
  // page is busy: opacity of the chat's content (the virtualizer's full-height box: turn > its
  // wrapper > the window of mounted turns > the box), the browser's own smooth scrolling, and the
  // placeholder layer `warp`. (A transform on the content box would make Chrome repaint all of it.)
  let trip = null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEAVE = 260;   // ms to speed off
  const stream = m => streak.animate([{ transform: 'none' }, { transform: `translateY(${m * STREAK}px)` }],
    { duration: STREAK / (SPEED * sc.clientHeight / 1000), iterations: Infinity });
  // Speed off: the chat scrolls toward the target and fades while the placeholder lines fade in,
  // streaming at SPEED. `m` = +1 moves the content down (going up the chat), -1 up.
  const depart = (turn, m, tok) => {
    if (trip) arrive(null, 0);
    const content = turn?.parentElement?.parentElement?.parentElement, T = LEAVE;
    trip = { tok, m, content: content && content !== sc && sc.contains(content) ? content : null };
    trip.off = trip.content?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T, easing: 'ease-in', fill: 'forwards' });
    warp.style.visibility = 'visible';
    trip.in = warp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T, fill: 'forwards' });
    if (!still()) {
      sc.scrollTo({ top: sc.scrollTop - m * sc.clientHeight * 0.5, behavior: 'smooth' });
      trip.loop = stream(m);
    }
    return new Promise(r => setTimeout(r, T));
  };
  // A new click mid-trip: the chat stays hidden and the placeholder turns around if the new target is
  // the other way. Waiting as long as speeding off would means a burst of clicks sends the chat only
  // to the last target, instead of making ChatGPT render every one on the way.
  const redirect = (m, tok) => {
    trip.tok = tok;
    if (trip.loop && trip.m !== m) { trip.loop.cancel(); trip.loop = stream(m); }
    trip.m = m;
    return new Promise(r => setTimeout(r, LEAVE));
  };
  // Arrive: the chat, waiting `lead` px short of the target, fades in and scrolls the rest of the
  // way; the placeholder fades out.
  const arrive = (el, lead) => {
    const t = trip; trip = null;
    if (!t) return Promise.resolve();
    t.content?.isConnected && t.content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: lead ? 320 : 250, easing: 'ease-out' });
    t.off?.cancel(); t.in?.cancel();
    if (t.in) {
      const out = warp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
      out.finished.then(() => { t.loop?.cancel(); out.cancel(); if (!trip) warp.style.visibility = 'hidden'; }, () => {});
    }
    if (!(el && lead)) return new Promise(r => setTimeout(r, 250));
    const done = scrollEnd();
    sc.scrollTo({ top: targetTop(el), behavior: 'smooth' });
    return done;
  };

  let busyId = null, busyTok = 0;
  const setBusy = (id, tok = 0) => { busyId = id; busyTok = tok; ticks.forEach((b, i) => b.classList.toggle('busy', qs[i]?.id === id)); };

  const flash = el => {
    const b = el.querySelector('[data-user-message-bubble]');
    if (!b) return;
    b.removeAttribute('data-butter-flash'); void b.offsetWidth; b.setAttribute('data-butter-flash', '');
    setTimeout(() => b.removeAttribute('data-butter-flash'), 1600);
  };

  // ChatGPT loads the previous page when the top of the chat comes into view.
  const loadEarlier = () => { if (sc && qs.length) jump(0, true); };
})();
