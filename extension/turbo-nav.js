// Isolated world. History rail: one tick per question at the right edge of the chat. Hovering swells
// the ticks around the pointer like a wave and previews the question; clicking jumps to it.
// Questions come from turbo-nav-main.js (ChatGPT's own API responses); turbo-cv.js reports every
// turn ChatGPT mounts. Cost: the rail lives in a shadow root and animates only transform and
// opacity, so hovering never restyles ChatGPT's page. Nothing reads layout except a click.
(() => {
  const ZH = /^zh\b/i.test(navigator.language);
  const TXT = ZH
    ? { label: '对话中的问题', more: '更早的问题还没加载，点击加载', fromLatest: k => `最近第 ${k} 个问题` }
    : { label: 'Questions in this chat', more: 'Earlier questions are not loaded yet. Click to load them.', fromLatest: k => k === 1 ? 'Latest question' : `${k} questions back` };
  const PITCH_MAX = 14, PAD = 10, MORE_H = 16, RAIL_W = 52;
  const HEADER = 52, COMPOSER = 140;   // ChatGPT's fixed header and composer overlap the scroller
  const TOP_INSET = 64;                 // a jumped-to question lands this far below the scroller's top
  const SIGMA = 20, SWELL = 1.6;        // hover wave: width in px, extra width at the pointer
  const REST = { s: 1, o: 0.28 }, ACTIVE = { s: 1.75, o: 1 };
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const convOfPath = () => /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1] ?? null;

  // ---- Messages per conversation, oldest first. `q` is set on visible questions only.
  const states = new Map();   // ChatGPT doesn't refetch a chat it has cached, so keep earlier ones
  const stateOf = c => { let s = states.get(c); if (!s) states.set(c, s = { items: [], hasPrev: false }); return s; };
  let convId = null, cur = { items: [], hasPrev: false };

  const mergePage = (s, { before, hasPrev, items }) => {
    if (!items.length) return;
    if (before) {   // an older page; it ends where the loaded messages begin
      const have = new Set(s.items.map(x => x.id));
      const k = items.findIndex(x => have.has(x.id));
      if (k === 0) return;
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

  document.addEventListener('turbo-nav', e => {
    let m; try { m = JSON.parse(e.detail); } catch { return; }
    syncConv();
    if (m.type === 'page') mergePage(stateOf(m.conv), m);
    else if (m.type === 'send') addSent(m.conv ? stateOf(m.conv) : cur, m);
    changed();
  });

  const syncConv = () => {
    const c = convOfPath();
    if (c === convId) return;
    if (!convId && c && cur.items.length && !states.has(c)) states.set(c, cur);   // a new chat got its id
    convId = c;
    cur = c ? stateOf(c) : { items: [], hasPrev: false };
    pos.clear(); activeId = null; active = -1; jumpTok++; hover(-2);
    changed();
  };
  setInterval(syncConv, 700);

  // ---- Turns in the DOM. ChatGPT mounts a window of about five turns; `data-turn-key` is the
  // id of the turn's question.
  let sc = null, box = null, ioPos = null, ioBand = null, ro = null;
  const mounted = new Map();   // question id -> its turn element while mounted
  const pos = new Map();       // question id -> top of its turn in scroll coordinates, last seen
  const mountedEl = id => { const el = mounted.get(id); return el?.isConnected && sc?.contains(el) ? el : null; };

  const attach = s => {
    ioPos?.disconnect(); ioBand?.disconnect(); ro?.disconnect();
    sc = s; box = null;
    ro = new ResizeObserver(() => {   // layout is clean in this callback, so reading it is free
      const r = sc.getBoundingClientRect();
      box = { top: r.top, bottom: r.bottom, right: r.right - (sc.offsetWidth - sc.clientWidth), width: r.width };
      changed();
    });
    ro.observe(sc);
    ioPos = new IntersectionObserver(es => {
      for (const e of es) pos.set(e.target.getAttribute('data-turn-key'), e.boundingClientRect.top - e.rootBounds.top + sc.scrollTop);
    }, { root: sc });
    // The turn crossing a line 30% down the view is the current one.
    ioBand = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) setActive(e.target.getAttribute('data-turn-key'));
    }, { root: sc, rootMargin: '-30% 0px -69% 0px' });
    for (const el of mounted.values()) if (el.isConnected && sc.contains(el)) { ioPos.observe(el); ioBand.observe(el); }
    // Any user scroll cancels a jump in progress.
    sc.addEventListener('wheel', () => jumpTok++, { passive: true });
    sc.addEventListener('touchstart', () => jumpTok++, { passive: true });
  };

  let reconcileQueued = false;
  globalThis.turboNavTurn = el => {
    syncConv();
    const s = el.closest('.thread-scroll-container');
    if (!s) return;
    if (s !== sc) attach(s);
    mounted.set(el.getAttribute('data-turn-key'), el);
    ioPos.observe(el); ioBand.observe(el);
    if (!reconcileQueued) { reconcileQueued = true; setTimeout(reconcile, 150); }
  };

  // Mounted turns are consecutive in the thread: add any the responses didn't cover (the extension
  // loaded late, or the API changed) and drop questions that sit between two of them (old branch).
  const reconcile = () => {
    reconcileQueued = false;
    if (!sc?.isConnected) return;
    const keys = [...sc.querySelectorAll('[data-turn-key]')].map(t => t.getAttribute('data-turn-key'));
    let list = cur.items, prev = -1;
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
  const CSS = `
    :host { all: initial; position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 20; display: block;
      color: #0d0d0d; font: 13px/1.45 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
      --surface: #fff; --line: rgb(0 0 0 / .08); --muted: #8f8f8f;
      --shadow: 0 10px 30px rgb(0 0 0 / .12), 0 1px 3px rgb(0 0 0 / .08); }
    :host([data-dark]) { color: #ececec; --surface: #2f2f2f; --line: rgb(255 255 255 / .1); --muted: #a3a3a3;
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
    .text { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
      white-space: pre-wrap; overflow-wrap: anywhere; }
    @media (prefers-reduced-motion: reduce) { .rail, .pill, .cardpos, .card { transition: none; } }`;

  let host = null, rail, pill, more, tickBox, cardPos, card, meta, text;
  let ticks = [], bars = [], qs = [], idxOf = new Map(), activeId = null, active = -1;
  let geo = null;   // { y: rail top, top: first tick top, pitch } in viewport px

  const build = () => {
    host = document.createElement('chatgpt-turbo-nav');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><nav class="rail" aria-label="${TXT.label}"><div class="pill"></div>` +
      `<button class="more" aria-label="${TXT.more}"><i></i><i></i><i></i></button><div class="ticks"></div></nav>` +
      `<div class="cardpos instant"><div class="card" role="tooltip"><div class="meta"></div><div class="text"></div></div></div>`;
    [rail, pill, more, tickBox, cardPos, card, meta, text] =
      ['.rail', '.pill', '.more', '.ticks', '.cardpos', '.card', '.meta', '.text'].map(s => root.querySelector(s));
    document.body.append(host);
    const dark = () => host.toggleAttribute('data-dark', document.documentElement.classList.contains('dark') ||
      /dark/.test(getComputedStyle(document.documentElement).colorScheme));
    dark();
    new MutationObserver(dark).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(dark, 50));   // theme "System"

    rail.addEventListener('pointerenter', () => { rail.classList.add('hot'); });
    rail.addEventListener('pointermove', e => { pointerY = e.clientY; hover(indexAt(e.clientY)); kick(); });
    rail.addEventListener('pointerleave', () => { rail.classList.remove('hot'); pointerY = null; hover(-2); kick(); });
    rail.addEventListener('focusin', e => { const i = ticks.indexOf(e.target); hover(e.target === more ? -1 : i); });
    rail.addEventListener('focusout', () => { if (pointerY === null) hover(-2); });
    rail.addEventListener('click', e => {
      const i = e.target === more ? -1 : e.detail === 0 ? ticks.indexOf(e.target) : indexAt(e.clientY);
      if (i === -1) loadEarlier(); else if (i >= 0) jump(i);
    });
    rail.addEventListener('keydown', e => {
      const i = ticks.indexOf(e.target), d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (i < 0 || !d) return;
      e.preventDefault(); ticks[Math.max(0, Math.min(ticks.length - 1, i + d))].focus();
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

  let shown = -2;
  const hover = i => {
    if (i === shown || !host) return;
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
  let pointerY = null, raf = 0, last = 0, cs = [], co = [], ct = [];   // current scaleX, opacity, scaleY
  const targetOf = j => {
    let s = j === active ? ACTIVE.s : REST.s, o = j === active ? ACTIVE.o : REST.o, t = 1;
    if (pointerY !== null) {
      const d = (tickY(j) - pointerY) / SIGMA, g = Math.exp(-d * d / 2);
      s = Math.max(s, REST.s + SWELL * g); o = Math.max(o, REST.o + (1 - REST.o) * g); t = 1 + 0.6 * g;
    }
    return [s, o, t];
  };
  const step = now => {
    const k = 1 - Math.exp(-Math.min(64, now - last) / 60); last = now;
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
  const kick = () => { if (!raf && geo) { last = performance.now(); raf = requestAnimationFrame(step); } };

  const setActive = id => { activeId = id; const i = idxOf.get(id) ?? -1; if (i !== active) { active = i; kick(); } };

  let renderQueued = false;
  const changed = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } };
  const render = () => {
    renderQueued = false;
    qs = cur.items.filter(x => x.q != null);
    idxOf = new Map(qs.map((x, i) => [x.id, i]));
    const n = qs.length;
    const on = !!box && box.width >= 560 && n >= 1 && n + (cur.hasPrev ? 1 : 0) >= 2;
    if (!on) { host?.removeAttribute('data-on'); hover(-2); geo = null; return; }
    if (!host) { if (!document.body) return; build(); }
    while (ticks.length < n) {
      const b = document.createElement('button');
      b.className = 'tick'; b.append(document.createElement('span')); b.firstChild.className = 'bar';
      tickBox.append(b); ticks.push(b);
    }
    while (ticks.length > n) ticks.pop().remove();
    bars = ticks.map(b => b.firstChild);
    ticks.forEach((b, i) => b.setAttribute('aria-label', qs[i].q.slice(0, 120)));
    const had = cs.length;
    cs.length = co.length = ct.length = n;
    for (let j = had; j < n; j++) { cs[j] = REST.s; co[j] = REST.o; ct[j] = 1; }   // new bars start at rest
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
    host.setAttribute('data-on', '');
    if (shown >= n) hover(-2);
    kick();
  };

  // ---- Jumping. A turn ChatGPT hasn't mounted has no element to scroll to: go where it should be
  // (last seen there, or interpolated between turns that were), let ChatGPT mount it, then align.
  let jumpTok = 0;
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

  const jump = async i => {
    const tok = ++jumpTok, id = qs[i].id;
    setActive(id);
    for (let tries = 0; tries < 6; tries++) {
      let el = mountedEl(id);
      if (!el) {
        sc.scrollTop = Math.max(0, estimate(i) - TOP_INSET);
        for (let f = 0; f < 30 && !(el = mountedEl(id)); f++) { await frame(); if (tok !== jumpTok) return; }
      }
      if (el) return glide(el, tok);
    }
  };

  const glide = async (el, tok) => {
    const targetTop = () => Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight,
      sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - TOP_INSET));
    let to = targetTop(), from = sc.scrollTop;
    const vh = sc.clientHeight;
    if (Math.abs(to - from) > vh * 1.5) {
      // Scrolling the whole way would render every turn in between; cut to just short of it.
      sc.scrollTop = from = to - Math.sign(to - from) * vh * 0.6;
      await frame(); if (tok !== jumpTok || !el.isConnected) return;
      to = targetTop();
    }
    flash(el);
    const t0 = performance.now(), D = 450;
    for (;;) {
      const p = Math.min(1, (performance.now() - t0) / D);
      sc.scrollTop = from + (to - from) * (1 - Math.pow(1 - p, 4));
      if (p === 1) break;
      await frame(); if (tok !== jumpTok) return;
    }
    // Turns that mounted on the way may have been re-measured.
    await frame(); await frame();
    if (tok === jumpTok && el.isConnected) { const t = targetTop(); if (Math.abs(t - sc.scrollTop) > 2) sc.scrollTop = t; }
  };

  const flash = el => {
    const b = el.querySelector('[data-user-message-bubble]');
    if (!b) return;
    b.removeAttribute('data-turbo-flash'); void b.offsetWidth; b.setAttribute('data-turbo-flash', '');
    setTimeout(() => b.removeAttribute('data-turbo-flash'), 1600);
  };

  // ChatGPT loads the previous page when the top of the chat comes into view.
  const loadEarlier = async () => {
    const tok = ++jumpTok, from = sc.scrollTop, t0 = performance.now();
    for (;;) {
      const p = Math.min(1, (performance.now() - t0) / 450);
      sc.scrollTop = from * Math.pow(1 - p, 4);
      if (p === 1 || tok !== jumpTok) return;
      await frame();
    }
  };
})();
