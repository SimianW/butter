// Isolated world. The card's DOM adapter (`ButterRailCard`): the panel a tick or the three dots
// shows. The rail presentation model (rail/model.js) decides what the card shows (`hover`,
// `seekCard`, `refill`, `cardKey`); this module privately owns the card's elements and patches them
// from it: the question tooltip, a row per bookmark, the seek preview, its place (`--cy` on the
// host), the 200 ms grace before a bookmark card left by the pointer goes, and its keys.
// rail/rail.js builds it once the rail's shadow root exists, with `els`: the host, the rail (only
// to tell whether focus moved there) and the card's own elements; and `view`, the rail's side:
// - `seek()`: the model says a seek preview owns the card: the rail shows it (calling `seek(s)`);
// - `jumpTo(id, b, keyboard)`: a row was clicked: jump to bookmark `b` under `id` (a question id
//   or EARLIER);
// - `remove(id, b)`: a row's × was clicked;
// - `focusStop(t)`: focus the rail's stop for index `t` (a tick, or the three dots for EARLIER);
// - `cool()`: the pointer is gone for good: the rail drops its hover look.
// test/rail-card-dom.test.mjs drives it directly; test/rail-card.test.mjs tests the model's card.
(() => {
  const { EARLIER } = globalThis.ButterRailModel || require('./model.js');
  const X =
    '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const make = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tag === 'button') e.type = 'button';
    if (txt != null) e.textContent = txt;
    return e;
  };

  function ButterRailCard(model, { host, rail, cardPos, card, meta, text, bmc }, view) {
    // ---- The card of a tick or the three dots that hold bookmarks: a row per bookmark, each
    // starting with the rail's dot; one bookmark's row runs to three lines.
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
        g.addEventListener('click', (ev) => view.jumpTo(id, b, ev.detail === 0));
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
          x.addEventListener('click', () => view.remove(id, b));
          it.append(g, x);
        }
        return it;
      });
      rows?.append(...its);
      bmc.replaceChildren(
        ...(rows ? [rows] : its),
        ...(c.warn ? [make('div', 'warn', c.warn)] : []),
      );
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
    const focused = () => card.contains(host.shadowRoot.activeElement);

    // Shows the model's card for index `i` (-2: none).
    const show = (i) => {
      const c = model.hover(i);
      if (!c) return;
      if (c.seek) return view.seek();
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

    // A bookmark card the pointer left goes after a grace, unless the pointer or focus came back.
    let overCard = false,
      leaveTimer = 0;
    const leaveSoon = () => {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (overCard || model.pointing || focused()) return;
        view.cool();
        show(-2);
      }, 200);
    };

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
        view.focusStop(k.back);
        if (k.hide) show(-2);
      } else if (k.row != null) rows[k.row].focus();
      else e.target.closest('.it')?.querySelector('.x')?.click();
    });

    return {
      show,
      // The keyboard enters the card of index `i`: its first row takes focus.
      enter(i) {
        show(i);
        bmc.querySelector('.go')?.focus();
      },
      // The card half of a seek preview `s` (the model's `seekCard()`): instant, inert, its text.
      seek(s) {
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
      },
      // The seek preview ended: the card loses its seek look.
      unseek: () => card.classList.remove('seek-card'),
      // Takes the card off screen without telling the model (the rail hidden, a seek preview gone).
      hide: () => card.classList.remove('show'),
      // The card open on the three dots or a tick follows its bookmarks, keeping keyboard focus on
      // the same row.
      refill() {
        if (!model.shownBm || model.shown === -2) return; // no bookmark card
        const a = host.shadowRoot.activeElement,
          inCard = card.contains(a),
          r = model.refill(
            [...bmc.querySelectorAll('.go')].indexOf(a?.closest('.it')?.querySelector('.go') ?? a),
          );
        if (!r) return;
        if (r.back != null) {
          show(-2);
          if (inCard) view.focusStop(r.back);
          return;
        }
        if (r.earlier) fillEarlier(r.earlier);
        else {
          fillQuestion(r.question);
          host.style.setProperty('--cy', `${whole(r.cy)}px`);
        }
        if (inCard) bmc.querySelectorAll('.go')[r.row]?.focus();
      },
      // Whether `el` is in the card; whether the card spans the viewport's `y` (a layout read).
      holds: (el) => card.contains(el),
      spans(y) {
        const r = card.getBoundingClientRect();
        return y >= r.top && y <= r.bottom;
      },
      // The pointer reached the rail: a pending grace ends with the card kept; it left the rail
      // while a bookmark card stays: the grace starts.
      stay: () => clearTimeout(leaveTimer),
      leave: leaveSoon,
      // The page's keydown (capture): Escape puts the dots' card away, also while the pointer holds
      // it; any loading goes on.
      escape(e) {
        if (e.key !== 'Escape' || !model.shownBm || model.shown !== EARLIER) return;
        if (focused()) return; // the card's own keys handle it
        show(-2);
        model.hold(true);
      },
    };
  }
  globalThis.ButterRailCard = ButterRailCard;
  if (typeof module !== 'undefined') module.exports = ButterRailCard;
})();
