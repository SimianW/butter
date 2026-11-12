// Isolated world. History rail: one tick per question at the right edge of the chat. Hovering swells
// the ticks around the pointer like a wave and previews the question; clicking jumps to it.
// Questions come from history/conversation-main.js (ChatGPT's own API responses); stream/offscreen.js reports every
// turn ChatGPT mounts. Cost: the rail lives in a shadow root and animates only transform and
// opacity, so hovering never restyles ChatGPT's page. Layout is read for jumps and their size corrections.
// This file is the rail's DOM adapter: rail/model.js decides what the rail shows (questions,
// geometry, the wave, the lit ticks, the card, the bookmark dots); here the shadow DOM is built and
// patched from it, the card is measured, frames run only while the model says something moves,
// and focus runs. It installs the turn tracker (rail/turns.js: the scroller, its turns and the
// user's scrolling), the send pre-jump (rail/pre-jump.js), the trip (rail/trip.js: a far jump's
// look) and the jump (rail/journey.js: glide, trip, pin), each holding its own state.
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
    mounted: (el) => journey.observe(el),
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
      if (i === -1) journey.earlier();
      else if (i >= 0) journey.go(i);
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
  // A row's jump goes through the rail's jump (rail/journey.js), landing on that bookmark's text.
  // A row on the dots' card loads earlier messages first, with the card left open to show it.
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
    journey.bookmark(i, m, b);
  };
  // Loads earlier pages until `b`'s answer is known and mounted, then lands on its text; while
  // they load the dots blink and its row shows a spinner.
  const earlierJump = (b, keyboard) => {
    if (!b || railOff() || !sc() || !model.qs.length) return;
    endOpening();
    journey.earlier(b, keyboard);
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
        drawBusy();
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
  // The ticks' busy classes, from the model's busy tick (a jump's, or seek's).
  const drawBusy = () => ticks.forEach((b, i) => b.classList.toggle('busy', model.busyAt(i)));

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

  // ---- Jumping: the jump (rail/journey.js) owns the jump in progress and publishes its status to
  // the model; the rail lends it the few effects a jump has on the rail's own elements.
  const journey = ButterRailJourney(model, turns, () => trip, {
    kick,
    busy: drawBusy,
    wait: (on) => {
      more?.classList.toggle('busy', on);
      if (model.shown === EARLIER) refill();
    },
    // An earlier trip found its bookmark under question `i`: focus follows a keyboard trip to the
    // bookmark's tick; the dots' card goes away.
    found: (i, keyboard) => {
      if (keyboard) ticks[i]?.focus();
      if (keyboard || model.shown === EARLIER) {
        hover(-2);
        model.hold(!keyboard);
      }
    },
  });
  // Stops a jump in progress and shows the chat again at once.
  function cancelJump() {
    endOpening();
    journey.cancel();
  }
})();
