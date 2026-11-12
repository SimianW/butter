// Isolated world. History rail: one tick per question at the right edge of the chat. Hovering swells
// the ticks around the pointer like a wave and previews the question; clicking jumps to it.
// Questions come from history/conversation-main.js (ChatGPT's own API responses); stream/offscreen.js reports every
// turn ChatGPT mounts. Cost: the rail lives in a shadow root and animates only transform and
// opacity, so hovering never restyles ChatGPT's page. Layout is read for jumps and their size corrections.
// This file is the rail's DOM adapter: rail/model.js decides what the rail shows (questions,
// geometry, the wave, the lit ticks, the card, the bookmark dots); here the shadow DOM is built and
// patched from it, the card is measured, frames run only while the model says something moves,
// and focus and the jump run. It installs the turn tracker (rail/turns.js: the scroller, its turns
// and the user's scrolling), the trip (rail/trip.js: a far jump's look) and the send pre-jump
// (rail/pre-jump.js), each holding its own state.
(() => {
  const model = ButterRailModel();
  const { RAIL_W, PAD, MORE_H, REST, EARLIER } = ButterRailModel;
  const zh = () => document.documentElement?.getAttribute('data-butter-lang') === 'zh';
  model.lang(zh());
  const railOff = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('rail');
  document.addEventListener('butter-settings', () => {
    model.lang(zh());
    if (host) {
      rail.setAttribute('aria-label', model.text.label);
      const i = model.unshow();
      if (i !== -2) hover(i);
      drawMarks(); // also the three dots' and the ticks' names
      host.style.display = railOff() ? 'none' : '';
      host.inert = !!railOff();
    }
    if (railOff()) {
      cancelJump();
      hover(-2);
      model.leave();
      rail?.classList.remove('hot');
    }
    if (model.seeking) showSeek();
    changed();
  });
  const TOP_INSET = 64; // a jumped-to question lands this far below the scroller's top
  const PAGE_AT = 240; // ChatGPT loads earlier messages when scrolled within ~230px of the top
  const MAX_EARLIER = 50; // at most 100 older turns / 60s per click; another click continues
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const convOfPath = () => /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1] ?? null;

  // ---- Messages per conversation: rail/conversations.js, inside the model.
  document.addEventListener('butter-nav', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    syncConv();
    if (m.type === 'page') {
      model.page(m);
      // Earlier messages go in above every recorded turn and push them all down: forget where they were.
      if (m.before && m.conv === model.conv) turns.forget();
    } else if (m.type === 'send') {
      model.send(m);
      cancelJump();
    } // ChatGPT scrolls to the new question
    changed();
  });

  const syncConv = () => {
    const c = convOfPath();
    if (!model.open(c)) return; // also forgets the marks, the seek preview and the active question
    clearTimeout(seekTimer);
    turns.forget();
    turns.reband();
    cancelJump();
    hover(-2);
    if (c) {
      opening = { end: performance.now() + 8000, sc: null, top: -1, height: -1, since: 0 };
      model.opening(true);
      cancelAnimationFrame(openRaf);
      openRaf = requestAnimationFrame(settleOpen);
    }
    changed();
  };
  setInterval(syncConv, 700);

  // Opening layout mustn't light the whole rail before ChatGPT restores its scroll; a kept copy
  // may restore somewhere in the middle. The model predicts the latest question until the visible
  // chat's geometry is quiet for 350ms, then trusts the band. The cap also releases
  // stalled/never-mounted chats.
  let opening = null,
    openRaf = 0;
  const endOpening = () => {
    if (!opening) return;
    opening = null;
    model.opening(false);
    cancelAnimationFrame(openRaf);
    openRaf = 0;
    kick();
  };
  addEventListener('wheel', endOpening, { capture: true, passive: true });
  addEventListener('touchstart', endOpening, { capture: true, passive: true });
  const settleOpen = () => {
    openRaf = 0;
    if (!opening) return;
    const now = performance.now();
    if (now >= opening.end) {
      endOpening();
      return;
    }
    // The previous chat can remain visible after the URL changes; don't settle against its scroller.
    if (model.box?.width && model.items.some((x) => x.q != null && turns.el(x.id))) {
      const s = sc(),
        top = s.scrollTop,
        height = s.scrollHeight;
      if (s !== opening.sc || top !== opening.top || height !== opening.height) {
        Object.assign(opening, { sc: s, top, height, since: now });
      } else if (now - opening.since >= 350) {
        endOpening();
        return;
      }
    } else opening.sc = null;
    openRaf = requestAnimationFrame(settleOpen);
  };

  // ---- Turns in the DOM: the turn tracker (rail/turns.js) follows the visible scroller and the
  // turns ChatGPT mounts in it, lights the band and notices the user scrolling.
  const turns = ButterRailTurns(model, {
    changed: () => changed(),
    kick: () => kick(),
    sync: syncConv,
    scrolled: cancelJump,
    mounted: (el) => anchor?.observe(el),
    ignore: (t) => t === host,
  });
  const sc = () => turns.scroller;

  // The send pre-jump (rail/pre-jump.js) belongs to the "smoother scrolling" switch, not to the
  // rail's: it runs with the rail off.
  ButterPreJump({ scroller: sc, cancel: cancelJump });

  // ---- Rail.
  const CSS = `
    :host { all: initial; position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 20; display: block;
      color: #0d0d0d; font: 13px/1.45 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
      --surface: #fff; --line: rgb(0 0 0 / .08); --muted: #8f8f8f; --streak: rgb(0 0 0 / .09);
      --shadow: 0 10px 30px rgb(0 0 0 / .12), 0 1px 3px rgb(0 0 0 / .08);
      --hoverbg: rgb(0 0 0 / .06); --dot: #d39e10; }
    :host([data-dark]) { color: #ececec; --surface: #2f2f2f; --line: rgb(255 255 255 / .1); --muted: #a3a3a3; --streak: rgb(255 255 255 / .1);
      --shadow: 0 10px 30px rgb(0 0 0 / .5), 0 1px 3px rgb(0 0 0 / .3);
      --hoverbg: rgb(255 255 255 / .08); --dot: #e3c766; }
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
    .more { box-sizing: border-box; height: ${MORE_H}px; gap: 3px; padding-right: 2px; }
    .more i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .35; transition: opacity .2s; }
    .more:hover i, .more:focus-visible i { opacity: 1; }
    .more.busy i { animation: dots .7s ease-in-out infinite alternate; }
    .more.busy i:nth-child(2) { animation-delay: .15s; }
    .more.busy i:nth-child(3) { animation-delay: .3s; }
    .more[hidden] { display: none; }
    .tick { height: var(--pitch); }
    .tick.busy .bar { animation: busy .7s ease-in-out infinite alternate; }
    @keyframes busy { to { opacity: .25; } }
    @keyframes dots { from { opacity: 1; } to { opacity: .2; } }
    .bar { width: 12px; height: 2px; border-radius: 2px; background: currentColor; opacity: ${REST.o};
      transform-origin: right center; }
    button:focus-visible { outline: 2px solid #10a37f; outline-offset: -1px; border-radius: 4px; }
    .marks { position: absolute; inset: 0; pointer-events: none; }
    .bdot { position: absolute; top: 0; right: 6px; border-radius: 50%; background: var(--dot); pointer-events: none; }
    .bdot.stale { background: transparent; box-shadow: inset 0 0 0 1px var(--dot); }
    .bdot.faint { opacity: .45; }
    .bdot.gone { opacity: 0; transition: opacity .16s; }
    .bdot.new { animation: dot-in .18s cubic-bezier(.2, .8, .2, 1), dot-halo .6s .18s; }
    @keyframes dot-in { from { scale: 0; } }
    @keyframes dot-halo { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--dot) 35%, transparent); } }
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
    .card:not(.qb) > .bmc, .card.bare > .text { display: none; }
    .card.qb { width: 280px; max-width: 280px; }
    .card.qb.show { pointer-events: auto; }
    .card.qb > .text { -webkit-line-clamp: 2; }
    .bmc { margin-top: 7px; padding-top: 5px; border-top: 1px solid var(--line); }
    .bare .bmc { margin-top: 2px; padding-top: 0; border-top: 0; }
    .rows { margin: 0 -6px; max-height: calc(var(--rows) * (8px + 1.45em)); overflow-y: auto; overscroll-behavior: contain; }
    .it { display: flex; align-items: center; border-radius: 6px; }
    .it:hover, .it:focus-within { background: var(--hoverbg); }
    .it .go { flex: 1; min-width: 0; justify-content: flex-start; gap: 7px; padding: 4px 6px; }
    .tx { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bmc .it .x { display: none; width: 18px; height: 18px; margin: 0 6px 0 1px; border-radius: 6px; place-items: center;
      justify-content: center;
      color: var(--muted); flex: none; }
    .bmc .it:hover .x, .bmc .it:focus-within .x { display: grid; }
    .bmc .it .x:hover, .bmc .it .x:focus-visible { background: var(--hoverbg); color: inherit; }
    .x svg { width: 10px; height: 10px; }
    .it.stale .go, .it.wait .go { color: var(--muted); }
    .why { font-size: 11px; color: var(--muted); flex: none; }
    .wspin { box-sizing: content-box; width: 10px; height: 10px; margin: 0 10px 0 7px; border-radius: 50%; flex: none;
      border: 1.5px solid var(--muted); border-right-color: transparent; animation: spin .8s linear infinite; }
    .warn { font-size: 11px; color: var(--muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
    .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dot); flex: none; }
    .it.stale .dot { background: transparent; box-shadow: inset 0 0 0 1px var(--dot); }
    .it.solo { margin: 0 -6px; align-items: flex-start; }
    .solo .go { align-items: flex-start; }
    .solo .tx { white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow-wrap: anywhere; }
    .solo .dot { margin-top: 7px; }
    .bmc .solo .x { margin-top: 4px; }
    .solo .wspin { margin-top: 7px; }
    .seek-card { max-width: 260px; }
    .seek-card .text { -webkit-line-clamp: 3; }
    .spin { display: inline-block; width: 9px; height: 9px; margin-right: 5px; vertical-align: -1px; border-radius: 50%;
      border: 1.5px solid #c4c4c4; border-top-color: #5d5d5d; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(1turn); } }
    .text { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
      white-space: pre-wrap; overflow-wrap: anywhere; }
    ${ButterRailTrip.CSS}
    @media (prefers-reduced-motion: reduce) { .rail, .pill, .cardpos, .card { transition: none; } .spin, .wspin, .tick.busy .bar, .more.busy i, .bdot.new { animation: none; }
      .bdot.gone { transition: none; } }`;

  let host = null,
    rail,
    more,
    tickBox,
    markBox,
    cardPos,
    card,
    meta,
    text,
    bmc,
    warp,
    streak,
    trip = null; // the trip of a far jump (rail/trip.js), once the rail is built
  let ticks = [],
    bars = [];

  const build = () => {
    host = document.createElement('chatgpt-butter-nav');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      `<style>${CSS}</style><nav class="rail" aria-label="${model.text.label}"><div class="pill"></div>` +
      `<button class="more" aria-label="${model.text.more}"><i></i><i></i><i></i></button><div class="ticks"></div><div class="marks"></div></nav>` +
      `<div class="cardpos instant"><div class="card" role="tooltip"><div class="meta"></div><div class="text"></div><div class="bmc"></div></div></div>` +
      `<div class="warp"><div class="streak"></div></div>`;
    [rail, more, tickBox, markBox, cardPos, card, meta, text, bmc, warp, streak] = [
      '.rail',
      '.more',
      '.ticks',
      '.marks',
      '.cardpos',
      '.card',
      '.meta',
      '.text',
      '.bmc',
      '.warp',
      '.streak',
    ].map((s) => root.querySelector(s));
    trip = ButterRailTrip({ warp, streak, scroller: sc });
    document.body.append(host);
    const dark = () =>
      host.toggleAttribute(
        'data-dark',
        document.documentElement.classList.contains('dark') ||
          /dark/.test(getComputedStyle(document.documentElement).colorScheme),
      );
    dark();
    new MutationObserver(dark).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
      setTimeout(dark, 50),
    ); // theme "System"

    rail.addEventListener('pointerenter', () => {
      clearTimeout(leaveTimer);
      model.hold(false);
      rail.classList.add('hot');
    });
    rail.addEventListener('pointermove', (e) => {
      // Heading left from a tick or the three dots to its bookmark card, within the card's height,
      // the card stays.
      if (model.move(e.clientX, e.clientY)) {
        const r = card.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) return kick();
      }
      hover(model.indexAt(e.clientY));
      kick();
    });
    rail.addEventListener('pointerleave', () => {
      // A bookmark card stays while the pointer crosses the gap onto it.
      if (model.leave()) {
        kick();
        leaveSoon();
        return;
      }
      rail.classList.remove('hot');
      hover(-2);
      kick();
    });
    rail.addEventListener('focusin', (e) =>
      hover(e.target === more ? -1 : ticks.indexOf(e.target)),
    );
    rail.addEventListener('focusout', (e) => {
      if (!model.pointing && !card.contains(e.relatedTarget)) hover(-2);
    });
    rail.addEventListener('click', (e) => {
      if (railOff()) return;
      endOpening();
      const i =
        e.target === more
          ? -1
          : e.detail === 0
            ? ticks.indexOf(e.target)
            : model.indexAt(e.clientY);
      // The click starts the trip: put the card away until the pointer comes back to the rail. While
      // the page is busy, moves on the way out and the leave event arrive late and would hold it up.
      if (i >= -1 && e.detail !== 0) {
        hover(-2);
        model.hold(true);
      }
      if (i === -1) loadEarlier();
      else if (i >= 0) jump(i);
    });
    // Arrows walk the earlier-history dots and the ticks. ArrowLeft on one that holds bookmarks
    // enters its card (#70, #72).
    rail.addEventListener('keydown', (e) => {
      const stops = [...(more.hidden ? [] : [more]), ...ticks],
        at = stops.indexOf(e.target);
      if (at < 0) return;
      const t = e.target === more ? EARLIER : ticks.indexOf(e.target),
        k = model.railKey(e.key, t, at, stops.length);
      if (!k) return;
      e.preventDefault();
      if (k.card == null) return stops[k.stop].focus();
      hover(k.card);
      bmc.querySelector('.go')?.focus();
    });
    // A click in the card keeps focus (and the reader's selection) where it was.
    card.addEventListener('mousedown', (e) => e.preventDefault());
    card.addEventListener('pointerenter', () => {
      overCard = true;
      clearTimeout(leaveTimer);
    });
    card.addEventListener('pointerleave', () => {
      overCard = false;
      if (!model.pointing) leaveSoon();
    });
    card.addEventListener('focusout', (e) => {
      if (!card.contains(e.relatedTarget) && !rail.contains(e.relatedTarget) && !model.pointing)
        leaveSoon();
    });
    // In the card: arrows between rows, Delete removes one, ArrowRight or Escape back to the tick,
    // or to the three dots for theirs.
    card.addEventListener('keydown', (e) => {
      const rows = [...bmc.querySelectorAll('.go')],
        k = model.cardKey(e.key, rows.indexOf(e.target), rows.length);
      if (!k) return;
      e.preventDefault();
      if (k.back != null) {
        (k.back === EARLIER ? more : ticks[k.back])?.focus();
        if (k.hide) hover(-2);
      } else if (k.row != null) rows[k.row].focus();
      else e.target.closest('.it')?.querySelector('.x')?.click();
    });
  };

  // ---- Bookmarks on the rail (bookmarks/content.js sends them). A question that holds bookmarks
  // shows one dot beside its tick (#71), and earlier history that isn't loaded yet one beside the
  // three dots (#72): no pointer events, no focus, hidden from the accessibility tree; the tick's or
  // the three dots' name says what they hold, and their card lists them. The model decides which
  // dots there are, their look and their place.
  const dotEls = new Map(); // question id or EARLIER -> its dot
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const placeDots = (place) => {
    for (const [id, translate] of place) dotEls.get(id).style.translate = translate;
  };
  const drawMarks = () => {
    const d = model.decorate();
    // A tick's name holds its question's bookmarks (#70), the three dots' name earlier history's (#72).
    ticks.forEach((t, i) => i < d.labels.length && t.setAttribute('aria-label', d.labels[i]));
    more?.setAttribute('aria-label', d.more);
    // A question's last bookmark deleted, or the last one on the three dots loaded: its dot fades
    // out (at once under reduced motion).
    for (const [id, fade] of d.drop) {
      const el = dotEls.get(id);
      dotEls.delete(id);
      if (fade && !reduced()) {
        el.classList.add('gone');
        setTimeout(() => el.remove(), 160);
      } else el.remove();
    }
    for (const { id, create, fresh, q, size, look } of d.dots) {
      let el = dotEls.get(id);
      if (create) {
        el = document.createElement('i');
        el.className = fresh ? 'bdot new' : 'bdot';
        el.setAttribute('aria-hidden', 'true');
        markBox.append(el);
        dotEls.set(id, el);
      }
      el.setAttribute('data-q', q);
      el.style.width = el.style.height = `${size}px`;
      if (look == null) continue;
      el.classList.toggle('stale', look === 'hollow');
      el.classList.toggle('faint', look === 'faint');
    }
    placeDots(d.place);
  };
  // The card open on the three dots or a tick follows its bookmarks, keeping keyboard focus on the
  // same row.
  const refill = () => {
    if (!host || !model.shownBm || model.shown === -2) return; // no bookmark card
    const a = host.shadowRoot.activeElement,
      inCard = card.contains(a),
      r = model.refill(
        [...bmc.querySelectorAll('.go')].indexOf(a?.closest('.it')?.querySelector('.go') ?? a),
      );
    if (!r) return;
    if (r.back != null) {
      hover(-2);
      if (inCard) (r.back === EARLIER ? more : ticks[r.back])?.focus();
      return;
    }
    if (r.earlier) fillEarlier(r.earlier);
    else {
      fillQuestion(r.question);
      host.style.setProperty('--cy', `${whole(r.cy)}px`);
    }
    if (inCard) bmc.querySelectorAll('.go')[r.row]?.focus();
  };
  globalThis.ButterRail = {
    // The rail's width and its right inset from the viewport's right edge, as drawn (`--r`): the
    // bookmark notification (bookmarks/notice.js) sits 8 px left of it. 0 before a chat is seen.
    WIDTH: RAIL_W,
    inset: () => model.inset(innerWidth),
    // `revision`: the revision (`rev`) of the items `groups` were worked out from, or null.
    setMarks(conv, { revision, groups }) {
      if (conv !== model.conv) return;
      model.setMarks(revision, groups);
      if (!host) return;
      drawMarks();
      refill();
    },
  };

  // ---- The card of a tick or the three dots that hold bookmarks: a row per bookmark, each
  // starting with the rail's dot; one bookmark's row runs to three lines.
  const X =
    '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const make = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tag === 'button') e.type = 'button';
    if (txt != null) e.textContent = txt;
    return e;
  };
  // The rows of a model fill (`c`, a `ButterBookmarks.card` or `questionCard`, for the bookmarks
  // under `id`, a question id or EARLIER), then its footer. While earlier messages load for one of
  // the three dots' bookmarks (`wait`, its key), its row shows a spinner where its × was.
  const fillRows = ({ id, card: c, wait }) => {
    const rows = c.single ? null : make('div', 'rows');
    rows?.style.setProperty('--rows', c.visible);
    const its = c.rows.map((b) => {
      const it = make('div', c.single ? 'it solo' : 'it'),
        g = make('button', 'go'),
        dot = make('i', 'dot');
      dot.setAttribute('aria-hidden', 'true');
      g.append(dot, make('span', 'tx', b.excerpt));
      g.addEventListener('click', (ev) => jumpTo(id, b, ev.detail === 0));
      // A stale row is grey; in a list it also says so (the space only separates them in its name).
      if (b.stale) {
        it.classList.add('stale');
        if (!c.single) g.append(' ', make('span', 'why', c.tag));
      }
      if (id === EARLIER && wait === b.key) {
        const spin = make('span', 'wspin');
        spin.setAttribute('aria-hidden', 'true');
        it.classList.add('wait');
        it.append(g, spin);
      } else {
        const x = make('button', 'x');
        x.innerHTML = X;
        x.setAttribute('aria-label', model.text.del(b.excerpt));
        x.addEventListener('click', () => !railOff() && model.mark(id)?.remove(b));
        it.append(g, x);
      }
      return it;
    });
    rows?.append(...its);
    bmc.replaceChildren(...(rows ? [rows] : its), ...(c.warn ? [make('div', 'warn', c.warn)] : []));
  };
  // A tick's card when its question holds bookmarks (#70): the question's text, then its bookmarks.
  const fillQuestion = (f) => {
    text.textContent = f.text;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', f.group);
    fillRows(f);
  };
  // The three dots' card (#72): its meta line, then the bookmarks.
  const fillEarlier = (f) => {
    meta.hidden = false;
    meta.textContent = f.meta;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', f.group);
    fillRows(f);
  };
  // The centre of a tick's card at `cy`, moved so that its top is on a whole pixel: its text and
  // dots then draw as crisply as the page's.
  const whole = (cy) => {
    const h = parseFloat(getComputedStyle(card).height);
    return Math.round(cy - h / 2) + h / 2;
  };
  // A row's jump goes through the rail's own jump, landing on that bookmark's text. A row on the
  // dots' card loads earlier messages first, with the card left open to show it.
  const jumpTo = (id, b, keyboard) => {
    if (id === EARLIER) return earlierJump(b, keyboard);
    const i = model.index(id),
      m = model.mark(id);
    if (i == null || !m || railOff()) return;
    endOpening();
    if (keyboard) ticks[i]?.focus();
    hover(-2);
    if (!keyboard) {
      model.hold(true);
      if (!model.pointing) rail.classList.remove('hot');
    }
    jump(
      i,
      false,
      (turn) => m.land(turn, b),
      null,
      (turn, draw) => m.wash?.(turn, b, draw),
    );
  };
  // Loads earlier pages until `b`'s answer is known and mounted, then lands on its text.
  // `wait` is that bookmark while its pages load: the dots blink and its row shows a spinner.
  let wait = null,
    waitKeyboard = false;
  const earlierJump = (b, keyboard) => {
    if (!b || railOff() || !sc() || !model.qs.length) return;
    endOpening();
    waitKeyboard = keyboard;
    jump(0, true, null, b.key);
  };
  const setWait = (next) => {
    wait = next;
    model.journey({ wait: next?.key ?? null });
    more?.classList.toggle('busy', !!wait);
    if (model.shown === EARLIER) refill();
  };
  // Waits for the bookmark session to send the marks of the items as they are now.
  const synced = async (live) => {
    for (const end = performance.now() + 1500; live() && performance.now() < end; ) {
      if (model.synced()) return;
      await frame();
    }
  };
  // Escape puts the dots' card away, also while the pointer holds it; any loading goes on.
  addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !host || !model.shownBm || model.shown !== EARLIER) return;
      if (card.contains(host.shadowRoot.activeElement)) return; // the card's own keys handle it
      hover(-2);
      model.hold(true);
    },
    { capture: true },
  );
  let overCard = false,
    leaveTimer = 0;
  const leaveSoon = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (overCard || model.pointing || card.contains(host.shadowRoot.activeElement)) return;
      rail.classList.remove('hot');
      hover(-2);
    }, 200);
  };

  let seekTimer;
  const showSeek = () => {
    if (!host || railOff()) return;
    const s = model.seekCard();
    if (!s) return;
    rail.classList.add('hot');
    card.classList.remove('qb', 'bare');
    card.setAttribute('role', 'tooltip');
    card.removeAttribute('aria-label');
    card.inert = true;
    card.classList.add('show', 'seek-card');
    cardPos.classList.add('instant');
    meta.hidden = false;
    meta.textContent = s.meta;
    if (s.loading) {
      const spinner = document.createElement('span');
      spinner.className = 'spin';
      meta.prepend(spinner);
    }
    text.textContent = s.text;
    host.style.setProperty('--cy', `${s.cy}px`);
    ticks.forEach((tick, j) => tick.classList.toggle('busy', j === s.busy));
    kick();
  };
  document.addEventListener('butter-seek-state', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (m.conv !== convOfPath() || !['idle', 'dragging', 'loading'].includes(m.state)) return;
    clearTimeout(seekTimer);
    if (m.state === 'idle') {
      if (!model.seek(m)) return;
      showSeek();
      seekTimer = setTimeout(() => {
        const y = model.seekEnd();
        card?.classList.remove('seek-card');
        if (y === null) {
          rail?.classList.remove('hot');
          card?.classList.remove('show');
        } else hover(model.indexAt(y));
        setBusy(model.busy, busyTok);
        kick();
      }, 1000);
    } else {
      if (!model.seeking) cancelJump();
      model.seek(m);
      showSeek();
    }
  });

  // Shows the model's card for index `i` (-2: none).
  const hover = (i) => {
    if (!host) return;
    const c = model.hover(i);
    if (!c) return;
    if (c.seek) return showSeek();
    card.inert = c.inert;
    if (c.hide) return void card.classList.remove('show');
    // Slide between ticks; appear in place.
    cardPos.classList.toggle('instant', c.instant);
    card.classList.toggle('qb', c.qb);
    card.classList.toggle('bare', c.bare);
    if (c.earlier) {
      fillEarlier(c.earlier);
      let cy = c.cy;
      if (c.clamp != null) cy = Math.max(cy, c.clamp + card.offsetHeight / 2);
      host.style.setProperty('--cy', `${whole(cy)}px`);
      card.classList.add('show');
      return;
    }
    card.setAttribute('role', 'tooltip');
    card.removeAttribute('aria-label');
    meta.textContent = c.meta;
    meta.hidden = c.metaHidden;
    text.textContent = c.text;
    if (c.question) fillQuestion(c.question);
    host.style.setProperty('--cy', `${c.whole ? whole(c.cy) : c.cy}px`);
    card.classList.add('show');
  };

  // Hover wave: each bar eases toward its target width/opacity; runs only while the model says
  // something moves.
  const step = (now) => {
    const f = model.frame(now);
    if (!f) return;
    for (const [j, transform, opacity] of f.bars) {
      bars[j].style.transform = transform;
      bars[j].style.opacity = opacity;
    }
    placeDots(f.dots);
    if (f.moving) requestAnimationFrame(step);
  };
  // Ids of the questions on screen, worked out once per animation run rather than per bar.
  const kick = () => {
    if (model.kick(turns.onScreen(), performance.now())) requestAnimationFrame(step);
  };
  const setActive = (id) => {
    if (model.setActive(id)) kick();
  };

  let renderQueued = false;
  const changed = () => {
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(render);
    }
  };
  const render = () => {
    renderQueued = false;
    const n = model.questions();
    // Bookmarks follow the conversation in view whether or not the rail shows: a one-question chat's
    // filled button and its remove work, and leaving a chat (for the home page, say) clears what
    // bookmarks/content.js last sent, so coming Back sends its marks again.
    globalThis.ButterBookmarkPage?.sync(model.conv, model.items, !model.hasPrev, model.rev);
    if (!model.shows(railOff())) {
      host?.removeAttribute('data-on');
      card?.classList.remove('show');
      model.hide();
      if (!model.seeking) hover(-2);
      return;
    }
    if (!host) {
      if (!document.body) return;
      build();
    }
    while (ticks.length < n) {
      const b = document.createElement('button');
      b.className = 'tick';
      b.append(document.createElement('span'));
      b.firstChild.className = 'bar';
      tickBox.append(b);
      ticks.push(b);
    }
    while (ticks.length > n) ticks.pop().remove();
    bars = ticks.map((b) => b.firstChild);
    const l = model.layout(innerWidth);
    ticks.forEach((b, i) => {
      b.classList.toggle('busy', l.busy[i]);
    });
    l.bars.forEach(([transform, opacity], j) => {
      bars[j].style.transform = transform;
      bars[j].style.opacity = opacity;
    });
    drawMarks();
    more.hidden = l.moreHidden;
    for (const [name, value] of l.css) host.style.setProperty(name, value);
    host.setAttribute('data-on', '');
    if (model.seeking) showSeek();
    if (model.shown >= n) hover(-2);
    kick();
  };

  // ---- Jumping. A turn ChatGPT hasn't mounted has no element to scroll to: go where it should be
  // (last seen there, or interpolated between turns that were), let ChatGPT mount it, then align.
  // While a jump travels only its target is lit; once it lands (or ends) the ticks show what is on screen.
  // The jump publishes its status to the model: `flying` (only its target is lit), `pinned`, the
  // active question (`setActive`), the busy tick and the earlier wait.
  let jumpTok = 0,
    journey = null;
  const landedAt = () => {
    model.journey({ flying: false });
    kick();
  };
  // Stops a jump in progress and shows the chat again at once.
  function cancelJump() {
    endOpening();
    jumpTok++;
    journey = null;
    model.journey({ flying: false });
    unpin();
    trip?.end();
    if (busyTok) setBusy(null);
    if (wait) setWait(null);
  }
  // From a click until the user scrolls, the clicked question stays the current one (`pinned`).
  let anchor = null;
  // Delayed KaTeX or a remounted neighbour can grow even after arrival. While the tick is pinned,
  // size changes keep its question aligned; no polling or layout reads while the chat is idle.
  const follow = (id, tok, off = 0) => {
    anchor?.ro.disconnect();
    const observe = (el) => {
      ro.observe(el);
      if (el.getAttribute('data-turn-key') === id)
        for (let p = el.parentElement; p && p !== sc(); p = p.parentElement) ro.observe(p);
    };
    const ro = new ResizeObserver((entries) => {
      // A remount gets observed by butterNavTurn; retain the logical id, not the old element.
      for (const e of entries) if (!e.target.isConnected) ro.unobserve(e.target);
      if (tok !== jumpTok || !model.pinned) return;
      const el = turns.el(id);
      if (el) {
        const t = targetTop(el, anchor.off);
        if (Math.abs(t - sc().scrollTop) > 2) sc().scrollTop = t;
      }
    });
    anchor = { ro, observe, off };
    turns.each(observe);
  };
  function unpin() {
    anchor?.ro.disconnect();
    anchor = null;
    if (!model.pinned) return;
    model.journey({ pinned: false });
    kick(); // back to lighting what is on screen; the set kept up to date while pinned
  }
  const MAX_TRIP = 12000;

  // A bookmark jump lands on the bookmarked text instead of the question: px below the turn's top.
  let landing = null;
  const landOff = (el) =>
    (landing && el.getAttribute('data-turn-key') === landing.id && landing.land(el)) || 0;
  // A bookmark trip from a card row that lands on live text gets the wash (#73) instead of the
  // bubble's flash: once the page has stopped, bookmarks/content.js washes the bookmarked text.
  // A stale bookmark lands with the flash, as a question jump does.
  const washes = (el) =>
    !!landing?.wash &&
    el?.getAttribute('data-turn-key') === landing.id &&
    !!landing.wash(el, false);
  const washAt = (el) => {
    el = el && turns.el(el.getAttribute('data-turn-key'));
    if (washes(el)) landing.wash(el);
  };
  const targetTop = (el, off = 0) =>
    Math.max(
      0,
      Math.min(
        sc().scrollHeight - sc().clientHeight,
        sc().scrollTop +
          el.getBoundingClientRect().top -
          sc().getBoundingClientRect().top -
          TOP_INSET +
          off +
          landOff(el),
      ),
    );

  // `want`: an earlier trip for a bookmark (its key) on the dots. Pages load only until bookmarks/
  // content.js places it under a question, then the trip lands on its text as a bookmark jump does.
  // `wash(turn, draw)`: the bookmark's landing wash, for a trip from a card row (`draw` false: only
  // whether there is one).
  const jump = async (i, earlier = false, land = null, want = null, wash = null) => {
    landing = land && !earlier ? { id: model.qs[i].id, land, wash } : null;
    globalThis.ButterBookmarkPage?.unwash(); // a new jump puts the last wash away at once
    // Repeated input for the current destination keeps its in-progress readiness work.
    // (Not during an earlier-dots trip: its target moves to older questions as pages arrive.)
    if (!earlier && trip.active && !journey?.earlier && model.busy === model.qs[i].id) return;
    const flight = journey ?? {
      end: performance.now() + (earlier ? 60000 : MAX_TRIP),
      ready: new Map(),
    };
    flight.earlier = earlier;
    const tok = ++jumpTok,
      end = flight.end,
      live = () => tok === jumpTok && performance.now() < end;
    setWait(want ? { key: want, tok } : null);
    anchor?.ro.disconnect();
    anchor = null;
    let id = model.qs[i].id;
    // A click during a trip takes the trip over (its jump is no longer live). Ending it would fade the
    // chat in and out again while the page is busy, showing whatever half-rendered part it is at.
    const relay = trip.take(tok);
    setBusy(null);
    model.journey({ flying: true });
    setActive(id);
    model.journey({ pinned: true });
    kick(); // setActive kicks only when the index changes
    let el = turns.el(id);
    // Close by: glide there.
    if (
      !earlier &&
      !relay &&
      el &&
      Math.abs(targetTop(el) - sc().scrollTop) < sc().clientHeight * 1.5 &&
      !(model.hasPrev && targetTop(el) < PAGE_AT)
    ) {
      journey = null;
      await glide(el, live);
      if (tok === jumpTok) landedAt();
      if (live() && model.pinned) follow(id, tok);
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
    const [, b] = turns.measure(seen);
    const m = earlier
      ? 1
      : -(
          Math.sign(
            el
              ? targetTop(el) - sc().scrollTop
              : b < 0
                ? turns.estimate(i) - sc().scrollTop
                : i - b,
          ) || 1
        );
    setBusy(want ? null : id, tok); // a bookmark's trip blinks the dots instead
    let landed = false,
      target = want && model.placed(want);
    try {
      if (live())
        await (relay
          ? trip.redirect(m, tok)
          : trip.depart(el ?? sc().querySelector('[data-turn-key]'), m, tok));
      if (!live()) return;
      if (earlier) {
        const loadEnd = end - 10000; // reserve time to align/reveal after the loading bound
        for (
          let pages = 0;
          !target && model.hasPrev && pages < MAX_EARLIER && live() && performance.now() < loadEnd;
          pages++
        ) {
          // Leave and re-enter the paging band: a prepend can keep the sentinel intersecting.
          sc().scrollTop = PAGE_AT + 32;
          await frame();
          await frame();
          if (!live()) return;
          const page = nextPage(Math.min(10000, loadEnd - performance.now()), live); // arm before scrolling
          sc().scrollTop = 0;
          if (!(await page)) break; // stalled/offline: reveal the oldest loaded question
          await frame();
          id = model.items.find((x) => x.q != null)?.id;
          // The fetch hook reports before React commits. Don't start another page in that gap.
          const until = performance.now() + 2000;
          while (live() && !turns.el(id) && performance.now() < until) {
            sc().scrollTop = 0;
            await frame();
          }
          if (want) {
            await synced(live);
            target = model.placed(want);
          }
        }
        await frame();
        if (!live()) return;
        if (target) {
          // The bookmark's answer is loaded: land on its text (at its question's start if stale).
          id = target;
          i = model.index(id);
          landing = {
            id,
            land: (turn) => {
              const m = model.mark(id),
                b = m?.bookmarks.find((x) => x.key === want);
              return b ? m.land(turn, b) : null;
            },
            wash: (turn, draw) => {
              const m = model.mark(id),
                b = m?.bookmarks.find((x) => x.key === want);
              return !!b && !!m.wash?.(turn, b, draw);
            },
          };
          // Focus follows a keyboard trip to the bookmark's tick; the dots' card goes away.
          setWait(null);
          if (waitKeyboard) ticks[i]?.focus();
          if (waitKeyboard || model.shown === EARLIER) {
            hover(-2);
            model.hold(!waitKeyboard);
          }
        } else {
          setWait(null);
          i = 0;
          id = model.qs[0]?.id;
        }
        el = turns.el(id);
        setActive(id);
        setBusy(id, tok);
      }
      el = turns.el(id);
      for (let tries = 0; tries < 8 && !el && live(); tries++) {
        i = model.index(id); // earlier pages may have changed the question's index
        if (i == null) return;
        // Where the records put the target, it didn't mount: measure again and move toward it.
        if (tries) turns.retarget(i, seen);
        sc().scrollTop = Math.max(0, turns.estimate(i) - TOP_INSET);
        for (let f = 0; f < 30 && live() && !(el = turns.el(id)); f++) await frame();
      }
      if (!el || !live()) return;
      sc().scrollTop = targetTop(el);
      let ready = flight.ready.get(id);
      const top =
        sc().scrollTop + el.getBoundingClientRect().top - sc().getBoundingClientRect().top;
      if (!ready || ready.el !== el || Math.abs(ready.top - top) > 2) {
        ready = { el, top, geometry: {} };
        flight.ready.set(id, ready);
      }
      if (!ready.page) {
        if (!earlier && model.hasPrev && sc().scrollTop < PAGE_AT) {
          await nextPage(4000, live);
          await new Promise((r) => setTimeout(r, 150));
        }
        if (!live()) return;
        ready.page = true;
      }
      // Soon after a chat opens ChatGPT mounts formulas as raw TeX and typesets them a moment later.
      const pendingMath = () =>
        [...(turns.el(id)?.querySelectorAll('[data-math-source]') ?? [])].some(
          (x) => !x.querySelector('.katex'),
        );
      if (!ready.math || pendingMath()) {
        for (
          const end = performance.now() + 3000;
          live() && performance.now() < end && pendingMath();

        )
          await frame();
        if (!live()) return;
        ready.math = !pendingMath();
      }
      el = turns.el(id);
      if (!el || !live()) return;
      const lead = reduced() ? 0 : m * Math.min(400, sc().clientHeight * 0.4);
      follow(id, tok, lead); // keep correcting while hidden, during reveal, and across remounts
      // Quiet frames and stable target geometry overlap. Recheck after quiet: it can outlast the
      // geometry check while ChatGPT renders another neighbour. Unrelated total-height growth is OK.
      await Promise.all([
        ready.quiet ? null : quiet(live, 4000),
        steady(el, live, lead, 3000, 150, ready.geometry),
      ]);
      if (!live()) return;
      ready.quiet = true;
      el = await steady(el, live, lead, 3000, 150, ready.geometry);
      if (!live() || !el?.isConnected || !model.pinned) return;
      flash(el);
      landed = true;
      anchor.off = 0;
      await trip.arrive(lead, () => targetTop(el));
      if (tok === jumpTok) {
        landedAt(); // stopped moving; settle only nudges by a few px
        washAt(el);
      }
      await settle(el, live);
    } finally {
      const expired = tok === jumpTok && performance.now() >= end;
      // A takeover inherits the first click's deadline. At expiry keep a mounted, aligned target;
      // otherwise reveal where ChatGPT got to and release the anchor, without another render.
      if (expired && !landed) {
        el = turns.el(id);
        if (el) {
          // `follow` may still hold it `lead` px short of the landing spot: align it before the reveal.
          const t = targetTop(el);
          if (model.pinned) sc().scrollTop = t;
          landed = Math.abs(t - sc().scrollTop) <= 2;
          if (landed) {
            flash(el);
            washAt(el);
          }
        }
      }
      trip.end(tok);
      if (busyTok === tok) setBusy(null);
      if (wait?.tok === tok) setWait(null);
      if (tok === jumpTok) {
        journey = null;
        landedAt();
        if (landed && model.pinned) follow(id, tok);
        else unpin();
      }
    }
  };

  const scrollEnd = () =>
    new Promise((r) => {
      sc().addEventListener('scrollend', r, { once: true });
      setTimeout(r, 1500);
    });
  // The browser's smooth scrolling runs on the compositor: it keeps going if the page is busy.
  const glide = async (el, live) => {
    flash(el);
    // Already there: smooth scrolling won't move, so no scrollend would come.
    const top = targetTop(el);
    if (Math.abs(top - sc().scrollTop) >= 1) {
      const done = scrollEnd();
      sc().scrollTo({ top, behavior: 'smooth' });
      await done;
    }
    if (live()) washAt(el);
    await settle(el, live);
  };
  // A few quiet frames don't mean neighbouring answers have finished mounting/typesetting. Keep
  // following the question through arrival, including a replacement of its virtualized element.
  const settle = (el, live) => steady(el, live, 0, 2000, 350);
  const steady = async (el, live, off = 0, max = 3000, span = 150, state = {}) => {
    const end = performance.now() + max,
      id = el.getAttribute('data-turn-key');
    while (live() && performance.now() < end) {
      el = turns.el(id);
      if (!el) {
        state.el = null;
        state.since = performance.now();
        await frame();
        continue;
      }
      const top =
        sc().scrollTop + el.getBoundingClientRect().top - sc().getBoundingClientRect().top;
      if (state.el !== el || Math.abs(state.top - top) > 2 || state.since == null) {
        state.el = el;
        state.top = top;
        state.since = performance.now();
      }
      const t = Math.max(
        0,
        Math.min(sc().scrollHeight - sc().clientHeight, top - TOP_INSET + off + landOff(el)),
      );
      if (Math.abs(t - sc().scrollTop) > 2) sc().scrollTop = t;
      if (performance.now() - state.since >= span) return el;
      await frame();
    }
    return turns.el(id);
  };
  // Resolves once the page paints at a normal pace again: three frames under 40 ms in a row.
  const quiet = async (live, max) => {
    const end = performance.now() + max;
    let last = await frame(),
      ok = 0;
    while (ok < 3 && live() && performance.now() < end) {
      const t = await frame();
      ok = t - last < 40 ? ok + 1 : 0;
      last = t;
    }
  };
  // Conversation-scoped and cancellable. A response from a hidden chat cannot wake this wait;
  // timed-out waits leave no callbacks behind. Completion also includes empty final pages.
  const nextPage = async (max, live) => {
    const first = model.items[0]?.id,
      end = performance.now() + max;
    while (live() && performance.now() < end) {
      if (!model.hasPrev || model.items[0]?.id !== first) return true;
      await frame();
    }
    return false;
  };

  let busyTok = 0;
  const setBusy = (id, tok = 0) => {
    model.journey({ busy: id });
    busyTok = tok;
    ticks.forEach((b, i) => b.classList.toggle('busy', model.busyAt(i)));
  };

  const flash = (el) => {
    const b = el.querySelector('[data-user-message-bubble]');
    if (!b || washes(el)) return;
    b.removeAttribute('data-butter-flash');
    void b.offsetWidth;
    b.setAttribute('data-butter-flash', '');
    setTimeout(() => b.removeAttribute('data-butter-flash'), 1600);
  };

  // ChatGPT loads the previous page when the top of the chat comes into view.
  const loadEarlier = () => {
    if (sc() && model.qs.length) jump(0, true);
  };
})();
