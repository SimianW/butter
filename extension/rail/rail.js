// Isolated world. History rail: one tick per question at the right edge of the chat. Hovering swells
// the ticks around the pointer like a wave and previews the question; clicking jumps to it.
// Questions come from history/conversation-main.js (ChatGPT's own API responses); stream/offscreen.js reports every
// turn ChatGPT mounts. Cost: the rail lives in a shadow root and animates only transform and
// opacity, so hovering never restyles ChatGPT's page. Layout is read for jumps and their size corrections.
// This file is the rail's DOM adapter: rail/model.js decides what the rail shows (questions,
// geometry, the wave, the lit ticks, the card, the bookmark dots); here the shadow DOM is built
// (its CSS: rail/style.js) and the rail, its ticks, the three dots and the dots patched from it,
// frames run only while the model says something moves, and focus runs. It installs the turn
// tracker (rail/turns.js: the scroller, its turns and the user's scrolling), the send pre-jump
// (rail/pre-jump.js), the trip (rail/trip.js: a far jump's look), the jump (rail/jump.js: glide,
// trip, pin) and the card (rail/card.js: its elements, rows, grace and keys), each holding its own
// state.
(() => {
  const model = ButterRailModel();
  const { RAIL_W, EARLIER } = ButterRailModel;
  const zh = () => document.documentElement?.getAttribute('data-butter-lang') === 'zh';
  model.lang(zh());
  const railOff = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('rail');
  document.addEventListener('butter-settings', () => {
    model.lang(zh());
    if (host) {
      rail.setAttribute('aria-label', model.text.label);
      const i = model.unshow();
      if (i !== -2) card.show(i);
      drawMarks(); // also the three dots' and the ticks' names
      host.style.display = railOff() ? 'none' : '';
      host.inert = !!railOff();
    }
    if (railOff()) {
      cancelJump();
      card?.show(-2);
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
    card?.show(-2);
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
    mounted: (el) => jump.observe(el),
    ignore: (t) => t === host,
  });
  const sc = () => turns.scroller;

  // The send pre-jump (rail/pre-jump.js) belongs to the "smoother scrolling" switch, not to the
  // rail's: it runs with the rail off.
  ButterPreJump({ scroller: sc, cancel: cancelJump });

  // ---- Rail. Its look: rail/style.js; its card: rail/card.js.
  let host = null,
    rail,
    more,
    tickBox,
    markBox,
    card = null, // the card (rail/card.js), once the rail is built
    trip = null; // the trip of a far jump (rail/trip.js), once the rail is built
  let ticks = [],
    bars = [];

  const build = () => {
    host = document.createElement('chatgpt-butter-nav');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      `<style>${ButterRailStyle}</style><nav class="rail" aria-label="${model.text.label}"><div class="pill"></div>` +
      `<button class="more" aria-label="${model.text.more}"><i></i><i></i><i></i></button><div class="ticks"></div><div class="marks"></div></nav>` +
      `<div class="cardpos instant"><div class="card" role="tooltip"><div class="meta"></div><div class="text"></div><div class="bmc"></div></div></div>` +
      `<div class="warp"><div class="streak"></div></div>`;
    const $ = (s) => root.querySelector(s);
    [rail, more, tickBox, markBox] = ['.rail', '.more', '.ticks', '.marks'].map($);
    trip = ButterRailTrip({ warp: $('.warp'), streak: $('.streak'), scroller: sc });
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
      card.stay();
      model.hold(false);
      rail.classList.add('hot');
    });
    rail.addEventListener('pointermove', (e) => {
      // Heading left from a tick or the three dots to its bookmark card, within the card's height,
      // the card stays.
      if (model.move(e.clientX, e.clientY) && card.spans(e.clientY)) return kick();
      card.show(model.indexAt(e.clientY));
      kick();
    });
    rail.addEventListener('pointerleave', () => {
      // A bookmark card stays while the pointer crosses the gap onto it.
      if (model.leave()) {
        kick();
        card.leave();
        return;
      }
      rail.classList.remove('hot');
      card.show(-2);
      kick();
    });
    rail.addEventListener('focusin', (e) =>
      card.show(e.target === more ? -1 : ticks.indexOf(e.target)),
    );
    rail.addEventListener('focusout', (e) => {
      if (!model.pointing && !card.holds(e.relatedTarget)) card.show(-2);
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
        card.show(-2);
        model.hold(true);
      }
      if (i === -1) jump.earlier();
      else if (i >= 0) jump.go(i);
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
      card.enter(k.card);
    });
    card = ButterRailCard(
      model,
      {
        host,
        rail,
        cardPos: $('.cardpos'),
        card: $('.card'),
        meta: $('.meta'),
        text: $('.text'),
        bmc: $('.bmc'),
      },
      {
        seek: () => showSeek(),
        jumpTo,
        remove: (id, b) => !railOff() && model.mark(id)?.remove(b),
        focusStop: (t) => (t === EARLIER ? more : ticks[t])?.focus(),
        cool: () => rail.classList.remove('hot'),
      },
    );
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
      card.refill();
    },
  };

  // A row's jump goes through the rail's jump (rail/jump.js), landing on that bookmark's text.
  // A row on the dots' card loads earlier messages first, with the card left open to show it.
  const jumpTo = (id, b, keyboard) => {
    if (id === EARLIER) return earlierJump(b, keyboard);
    const i = model.index(id),
      m = model.mark(id);
    if (i == null || !m || railOff()) return;
    endOpening();
    if (keyboard) ticks[i]?.focus();
    card.show(-2);
    if (!keyboard) {
      model.hold(true);
      if (!model.pointing) rail.classList.remove('hot');
    }
    jump.bookmark(i, m, b);
  };
  // Loads earlier pages until `b`'s answer is known and mounted, then lands on its text; while
  // they load the dots blink and its row shows a spinner.
  const earlierJump = (b, keyboard) => {
    if (!b || railOff() || !sc() || !model.qs.length) return;
    endOpening();
    jump.earlier(b, keyboard);
  };
  // Escape puts the dots' card away (rail/card.js).
  addEventListener('keydown', (e) => card?.escape(e), { capture: true });

  let seekTimer;
  const showSeek = () => {
    if (!host || railOff()) return;
    const s = model.seekCard();
    if (!s) return;
    rail.classList.add('hot');
    card.seek(s);
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
        card?.unseek();
        if (y === null) {
          rail?.classList.remove('hot');
          card?.hide();
        } else card?.show(model.indexAt(y));
        drawBusy();
        kick();
      }, 1000);
    } else {
      if (!model.seeking) cancelJump();
      model.seek(m);
      showSeek();
    }
  });

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
      card?.hide();
      model.hide();
      if (!model.seeking) card?.show(-2);
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
    if (model.shown >= n) card.show(-2);
    kick();
  };

  // ---- Jumping: the jump (rail/jump.js) owns the jump in progress and publishes its status to
  // the model; the rail lends it the few effects a jump has on the rail's own elements.
  const jump = ButterRailJump(model, turns, () => trip, {
    kick,
    busy: drawBusy,
    wait: (on) => {
      more?.classList.toggle('busy', on);
      if (model.shown === EARLIER) card?.refill();
    },
    // An earlier trip found its bookmark under question `i`: focus follows a keyboard trip to the
    // bookmark's tick; the dots' card goes away.
    found: (i, keyboard) => {
      if (keyboard) ticks[i]?.focus();
      if (keyboard || model.shown === EARLIER) {
        card?.show(-2);
        model.hold(!keyboard);
      }
    },
  });
  // Stops a jump in progress and shows the chat again at once.
  function cancelJump() {
    endOpening();
    jump.cancel();
  }
})();
