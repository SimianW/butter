// Isolated world, no DOM, no timers, no frames: the rail presentation model (`ButterRailModel`).
// It privately owns what the rail shows: the conversation's questions (rail/conversations.js) and
// each tick's identity, the rail's geometry, the hover wave's progress per question, which ticks
// are lit (seek, opening, a jump's target, the lit band, pinned), the card (which tick or the three
// dots it shows, its contents and place, held or not) and the bookmark dots. rail/rail.js, its DOM
// adapter, feeds it events, measured facts and time, patches the DOM from what it returns (the card
// through rail/card.js, which measures what only layout knows: the card's height), schedules frames
// while it says something moves, and runs focus. The jump (rail/jump.js) reads the questions and marks from here and publishes
// its status (flying, pinned, the active question, the busy tick, the earlier wait) back.
// test/rail-model.test.mjs and test/rail-card.test.mjs drive it through this interface.
(() => {
  const B = () => globalThis.ButterBookmarks || require('../bookmarks/model.js');
  const seekMeta = (...a) => (globalThis.ButterSeekMeta || require('../seek/seek-meta.js'))(...a);
  const strings = (zh) =>
    zh
      ? {
          label: '对话中的问题',
          more: '更早的问题还没加载，点击加载',
          seek: (n, total, state, unseen) => seekMeta(true, n, total, state, unseen),
          fromLatest: (k) => `最近第 ${k} 个问题`,
          zh: true,
          del: (t) => `删除书签：${t}`,
        }
      : {
          label: 'Questions in this chat',
          more: 'Earlier questions are not loaded yet. Click to load them.',
          seek: (n, total, state, unseen) => seekMeta(false, n, total, state, unseen),
          fromLatest: (k) => (k === 1 ? 'Latest question' : `${k} questions back`),
          zh: false,
          del: (t) => `Delete bookmark: ${t}`,
        };
  const PITCH_MAX = 14,
    PAD = 10,
    MORE_H = 16,
    RAIL_W = 52;
  const HEADER = 52,
    COMPOSER = 140; // ChatGPT's fixed header and composer overlap the scroller
  const OVERLAY_SCROLLBAR_GAP = 8; // overlay thumbs have no measured gutter; keep their strip clear
  const SIGMA = 20,
    SWELL = 1.6; // hover wave: width in px, extra width at the pointer
  const REST = { s: 1, o: 0.28 },
    ACTIVE = { s: 1.75, o: 1 };
  // Earlier history that isn't loaded yet: its key in the marks and its index are both EARLIER
  // (-1, the three dots' index; ButterBookmarks.EARLIER).
  const EARLIER = -1;
  // The three dots' span from the ticks' right end: their 2 px padding, three 3 px dots and two
  // 3 px gaps (see .more in rail/style.js).
  const DOTS_W = 17;

  function ButterRailModel() {
    const convs = (globalThis.ButterRailConversations || require('./conversations.js'))(),
      wave = (globalThis.ButterRailWave || require('./wave.js'))();
    let TXT = strings(false),
      box = null; // the scroller's measured box: { top, bottom, left, right, gutter, width }
    // The questions and their index as of the last render: re-derived one frame after the items
    // change, as the ticks are.
    let qs = Object.freeze([]),
      idxOf = new Map(),
      geo = null; // { y: rail top, top: first tick top, pitch } in viewport px; null while off
    // The pointer over the rail, and the questions in the lit band, taken once per kick.
    let pointerY = null,
      lastX = 0,
      litIds = new Set();
    // What lights a tick besides the band: a seek preview, the opening prediction and the jump.
    let seek = null,
      opening = false,
      activeId = null,
      active = -1,
      flying = false,
      pinned = false,
      busyId = null,
      wait = null; // the bookmark key an earlier trip loads pages for
    // The card: the tick (or EARLIER) it shows, -2 none; whether it lists bookmarks; whether a
    // click put it away until the pointer comes back.
    let shown = -2,
      shownBm = false,
      held = false;
    // Bookmarks: question id or EARLIER -> { count, fresh, bookmarks, stale, land, wash, remove },
    // the items revision they were worked out from, and the ids with a dot drawn.
    let marks = new Map(),
      marksRev = -1;
    const dotIds = new Set();

    const tickY = (i) => geo.top + (i + 0.5) * geo.pitch;
    const inset = (innerWidth) =>
      box ? Math.round(innerWidth - box.right + 4 + (box.gutter ? 0 : OVERLAY_SCROLLBAR_GAP)) : 0;
    // Tick under a viewport y, from the rail's own geometry. -1 = the three dots, -2 = none.
    const indexAt = (y) => {
      if (!geo) return -2;
      const r = (y - geo.top) / geo.pitch;
      if (r < 0 && convs.hasPrev && y >= geo.top - MORE_H) return -1;
      return Math.max(0, Math.min(qs.length - 1, Math.floor(r)));
    };
    const idAt = (i) => (i === EARLIER ? EARLIER : qs[i]?.id);
    // A mark's index, or null while it has no place: the three dots show only while earlier
    // history isn't loaded.
    const markAt = (id) => (id === EARLIER ? (convs.hasPrev ? EARLIER : null) : idxOf.get(id));
    // Whether index `i` (a tick, or EARLIER for the three dots) holds bookmarks.
    const holds = (i) => (i === EARLIER ? markAt(EARLIER) != null : i >= 0) && marks.has(idAt(i));

    // Whether tick j is lit: a seek preview's, the opening prediction, a jump's target, the band.
    const lit = (j) =>
      seek
        ? (seek.lit || [seek.id]).includes(qs[j].id)
        : opening
          ? j === qs.length - 1
          : flying
            ? j === active
            : litIds.has(qs[j].id) || (pinned && j === active);
    const targetOf = (j) => {
      const on = lit(j);
      let s = on ? ACTIVE.s : REST.s,
        o = on ? ACTIVE.o : REST.o,
        t = 1;
      if (pointerY !== null) {
        const d = (tickY(j) - pointerY) / SIGMA,
          g = Math.exp((-d * d) / 2);
        s = Math.max(s, REST.s + SWELL * g);
        o = Math.max(o, REST.o + (1 - REST.o) * g);
        t = 1 + 0.6 * g;
      }
      return [s, o, t];
    };
    // Each dot's right edge 4 px left of its tick's current length, centred on the tick's row: the
    // wave's frames place them with the ticks' widths, so a dot needs no motion of its own. Earlier
    // history's dot sits the same way beside the three dots, which don't move.
    const place = () => {
      const out = [];
      if (!geo) return out;
      const d = B().dotSize(geo.pitch);
      for (const id of dotIds) {
        if (id === EARLIER) {
          out.push([
            id,
            `${-B().dotBeside(DOTS_W)}px ${(geo.top - MORE_H / 2 - geo.y - 2).toFixed(2)}px`,
          ]);
          continue;
        }
        const j = idxOf.get(id);
        if (j == null || wave.scale(j) == null) continue;
        out.push([
          id,
          `${(-B().dotRight(wave.scale(j))).toFixed(2)}px ${(tickY(j) - geo.y - d / 2).toFixed(2)}px`,
        ]);
      }
      return out;
    };
    // The three dots' card: their meta line ("Earlier questions · k bookmarks", or "Loading
    // earlier questions…" while messages load for one of them), then the bookmarks.
    const fillEarlier = () => {
      const c = B().card(marks.get(EARLIER).bookmarks, { earlier: true }, TXT.zh),
        title = wait ? c.wait : c.meta;
      return { id: EARLIER, card: c, meta: title, group: title, wait };
    };
    // A tick's card when its question holds bookmarks: the question's text, then its bookmarks.
    const fillQuestion = (i) => {
      const id = qs[i].id,
        c = B().questionCard(
          qs[i].q,
          marks.get(id).bookmarks,
          convs.hasPrev ? { back: qs.length - i } : { n: i + 1, total: qs.length },
          TXT.zh,
        );
      return { id, card: c, text: c.text, group: c.group, wait };
    };
    // The card for index `i` (-2: none), or null when nothing changes. `{ seek }`: a seek preview
    // owns the card. Otherwise `inert` (it takes no pointer), and either `hide` or how to show it:
    // `instant` (appear in place rather than slide), `qb`/`bare` (its bookmark looks), the fill
    // (`earlier`, or `meta`, `metaHidden`, `text` and a `question` fill), and its centre `cy`, which
    // the adapter puts on a whole pixel when `whole`, and for the three dots' card keeps at least
    // half the card's height below `clamp`.
    const hover = (i) => {
      if (seek) return { seek: true };
      const bm = holds(i);
      if ((i === shown && bm === shownBm) || (held && i !== -2)) return null;
      const was = shown;
      shown = i;
      shownBm = bm;
      if (i === -2) return { inert: true, hide: true };
      const out = { inert: !bm, instant: was === -2, qb: bm, bare: bm && i === EARLIER };
      // The three dots' card, centred on their row at the rail's top, comes down to stay in the chat.
      if (bm && i === EARLIER)
        return Object.assign(out, {
          earlier: fillEarlier(),
          cy: geo.top - MORE_H / 2,
          clamp: box ? box.top + 8 : null,
          whole: true,
        });
      const q = i === -1 ? TXT.more : qs[i].q;
      return Object.assign(out, {
        meta:
          i === -1 ? '' : convs.hasPrev ? TXT.fromLatest(qs.length - i) : `${i + 1} / ${qs.length}`,
        metaHidden: i === -1,
        text: q.length > 400 ? q.slice(0, 400) + '…' : q,
        question: bm ? fillQuestion(i) : null,
        cy: i === -1 ? geo.top - MORE_H / 2 : tickY(i),
        whole: bm,
        clamp: null,
      });
    };

    const api = {
      lang(zh) {
        TXT = strings(zh);
      },

      // ---- The conversation (rail/conversations.js).
      // Shows conversation `c`; on a change, forgets its marks, the seek preview and the active
      // question. False when it is already in view.
      open(c) {
        if (!convs.open(c)) return false;
        marks = new Map();
        marksRev = -1;
        seek = null;
        activeId = null;
        active = -1;
        return true;
      },
      page: (m) => convs.page(m),
      send: (m) => convs.send(m),
      reconcile: (keys, text) => convs.reconcile(keys, text),
      // A question's index in the last render's questions, the tick under a y, a tick's centre.
      index: (id) => idxOf.get(id),
      indexAt,
      tickY,

      // ---- Measured facts.
      measure(b) {
        box = b;
      },
      // The rail's right inset from the viewport's right edge, as drawn (`--r`); 0 before a box.
      inset,

      // ---- Render, in the adapter's order: `questions()`, then whether it `shows(off)`; then
      // `hide()`, or `layout(innerWidth)` once the DOM is built.
      questions() {
        qs = Object.freeze(convs.items.filter((x) => x.q != null));
        idxOf = new Map(qs.map((x, i) => [x.id, i]));
        return qs.length;
      },
      shows(off) {
        return !off && !!box && box.width >= 560 && qs.length >= 1;
      },
      hide() {
        geo = null;
      },
      // The ticks for the questions now: per bar its style (`[transform, opacity]`) and whether it
      // is busy, whether the three dots are hidden, and the host's CSS values.
      layout(innerWidth) {
        const n = qs.length;
        // While a chat is opening the bars show the prediction at once, in step with the ticks
        // moving; new bars start at rest.
        const bars = wave.carry(
          qs.map((x) => x.id),
          (j, kept) => {
            const a = j === n - 1 ? ACTIVE : REST;
            return opening ? [a.s, a.o, 1] : (kept ?? [REST.s, REST.o, 1]);
          },
        );
        active = idxOf.get(activeId) ?? -1;
        // Centered in the part of the chat that isn't under the header or the composer.
        const top = box.top + HEADER,
          bottom = box.bottom - COMPOSER,
          moreH = convs.hasPrev ? MORE_H : 0;
        const pitch = Math.min(PITCH_MAX, ((bottom - top - 2 * PAD - moreH) * 0.85) / n);
        const h = 2 * PAD + moreH + n * pitch;
        const y = Math.round((top + bottom) / 2 - h / 2);
        geo = { y, top: y + PAD + moreH, pitch };
        const colW = Math.min(760, box.width - 96); // the text column, for the travel placeholder
        return {
          bars,
          busy: qs.map((x) => x.id === busyId),
          moreHidden: !convs.hasPrev,
          css: [
            ['--r', `${inset(innerWidth)}px`],
            ['--y', `${y}px`],
            ['--pitch', `${pitch}px`],
            ['--wl', `${Math.round((box.left + box.right - colW) / 2)}px`],
            ['--ww', `${Math.round(colW)}px`],
            ['--wt', `${Math.round(top)}px`],
            ['--wh', `${Math.round(bottom - top)}px`],
          ],
        };
      },

      // ---- The wave. `kick(ids, now)`: the questions in the lit band now; true when a frame
      // must be scheduled (none is, and the rail shows). `frame(now)`: one frame's bar styles
      // (`[j, transform, opacity]`, changed bars only) and dot places, and whether to schedule the
      // next; null once the rail went off.
      kick(ids, now) {
        litIds = new Set(ids);
        return !!geo && wave.start(now);
      },
      frame(now) {
        // The rail went off after this frame was queued: the questions may have changed but not the
        // bars, and the ticks have no geometry. The next kick starts the wave again.
        if (!geo) {
          wave.stop();
          return null;
        }
        const { bars, moving } = wave.frame(now, targetOf);
        return { bars, dots: place(), moving };
      },
      // The opening prediction: the latest question stays lit until rail.js sees the chat settle.
      opening(on) {
        opening = on;
      },

      // ---- The jump's status. `setActive(id)`: true when the active tick moved.
      setActive(id) {
        activeId = id;
        const i = idxOf.get(id) ?? -1;
        if (i === active) return false;
        active = i;
        return true;
      },
      // Any of `{ flying, pinned, busy: question id or null, wait: bookmark key or null }`.
      journey(s) {
        if ('flying' in s) flying = s.flying;
        if ('pinned' in s) pinned = s.pinned;
        if ('busy' in s) busyId = s.busy;
        if ('wait' in s) wait = s.wait;
      },
      busyAt: (i) => qs[i]?.id === busyId,

      // ---- The pointer and the card.
      // The pointer at (x, y) over the rail. True when it heads left while a bookmark card shows:
      // on its way to the card it crosses other ticks, and within the card's height the card stays.
      move(x, y) {
        pointerY = y;
        const was = lastX;
        lastX = x;
        return shownBm && x < was;
      },
      // The pointer left the rail (or a setting took it away). True when a bookmark card stays
      // while the pointer crosses the gap onto it.
      leave() {
        const stay = shownBm && !seek;
        pointerY = null;
        return stay;
      },
      // A click put the card away until the pointer comes back (true), or the pointer or the
      // keyboard came back (false).
      hold(on) {
        held = on;
      },
      hover,
      // Forgets which card shows, so that the next hover fills it afresh; the index it showed.
      unshow() {
        const i = shown;
        shown = -2;
        return i;
      },
      // The card open on the three dots or a tick follows its bookmarks (a deletion, or one leaving
      // the three dots as its answer loads), keeping keyboard focus on the same row (`at`, -1 when
      // none). Null, `{ back: i }` (the card no longer holds any: hide it and focus index `i` back
      // if focus was in it), or the new fill with the `row` to focus.
      refill(at) {
        if (!shownBm || shown === -2) return null;
        if (!holds(shown)) return { back: shown };
        const fill =
          shown === EARLIER ? { earlier: fillEarlier() } : { question: fillQuestion(shown) };
        if (fill.question) fill.cy = tickY(shown);
        const rows = (fill.earlier ?? fill.question).card.rows.length;
        return Object.assign(fill, { row: Math.min(Math.max(at, 0), rows - 1) });
      },
      // Keys on the rail's stops (`at` of `count`, the three dots first while shown) for index `t`.
      // ArrowLeft on one that holds bookmarks enters its card (`{ card: t }`); arrows walk the stops.
      railKey(key, t, at, count) {
        const d = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
        if (key === 'ArrowLeft' && holds(t)) {
          held = false;
          return { card: t };
        }
        if (!d) return null;
        held = false;
        return { stop: Math.max(0, Math.min(count - 1, at + d)) };
      },
      // Keys in a bookmark card, on row `at` of `count`: arrows between rows, Delete removes one,
      // ArrowRight or Escape go back to the tick or the three dots (`back`); while earlier messages
      // load for it, Escape also puts the three dots' card away (`hide`); the loading goes on.
      cardKey(key, at, count) {
        if (!shownBm) return null;
        const d = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
        if (key === 'Escape' || key === 'ArrowRight')
          return { back: shown, hide: key === 'Escape' && shown === EARLIER && !!wait };
        if (at >= 0 && d) return { row: Math.max(0, Math.min(count - 1, at + d)) };
        if (at >= 0 && (key === 'Delete' || key === 'Backspace')) return { remove: at };
        return null;
      },

      // ---- Seek (`butter-seek-state`). `seek(m)`: false for an idle state with no preview;
      // dragging or loading takes the card and the wave from the pointer.
      seek(m) {
        if (m.state === 'idle') {
          if (!seek) return false;
          seek = { ...seek, state: 'settled' };
          return true;
        }
        seek = m;
        shown = -2;
        held = false;
        pointerY = null;
        return true;
      },
      // The settled preview's second is over: the card is free again. The pointer's y, or null.
      seekEnd() {
        seek = null;
        shown = -2;
        return pointerY;
      },
      // The seek card for the previewed question, or null when it has no tick: its meta line,
      // whether it is loading, text and centre, and the tick that blinks (`busy`) while it loads.
      seekCard() {
        if (!seek || !geo) return null;
        const i = idxOf.get(seek.id);
        if (i == null) return null;
        shownBm = false;
        return {
          meta: TXT.seek(seek.n, seek.total, seek.state, seek.unseen),
          loading: seek.state === 'loading',
          text: qs[i].q.slice(0, 400),
          cy: tickY(i),
          busy: seek.state === 'loading' ? i : -1,
        };
      },

      // ---- Bookmarks. `setMarks(revision, groups)` from the bookmark session; `decorate()` the
      // ticks' and the three dots' names and the dots to drop (`[id, fade]`), create or update
      // (`{ id, create, fresh, q, size, look }`, look null beside the three dots) and place.
      setMarks(revision, groups) {
        marks = groups;
        marksRev = revision ?? -1;
      },
      mark: (id) => marks.get(id),
      decorate() {
        const labels = qs.map((x) => B().tickLabel(x.q, marks.get(x.id)?.bookmarks, TXT.zh));
        const more = B().moreLabel(TXT.more, marks.get(EARLIER)?.bookmarks, TXT.zh);
        const drop = [],
          dots = [];
        for (const id of dotIds)
          if (!marks.has(id) || markAt(id) == null || !geo) {
            dotIds.delete(id);
            drop.push([id, markAt(id) != null && !!geo]);
          }
        if (!geo) return { labels, more, drop, dots, place: [] };
        const d = B().dotSize(geo.pitch);
        for (const [id, m] of marks) {
          const i = markAt(id);
          if (i == null) continue;
          const create = !dotIds.has(id);
          dotIds.add(id);
          // Beside the three dots: always 4 px and solid, as bookmarks in unloaded history count
          // as live.
          dots.push(
            i === EARLIER
              ? { id, create, fresh: m.fresh, q: i, size: 4, look: null }
              : { id, create, fresh: m.fresh, q: i, size: d, look: B().dotLook(m.bookmarks, d) },
          );
        }
        return { labels, more, drop, dots, place: place() };
      },
      // The question the bookmark `key` is under now, other than the three dots; null while none.
      placed(key) {
        for (const [id, m] of marks)
          if (id !== EARLIER && idxOf.has(id) && m.bookmarks.some((b) => b.key === key)) return id;
        return null;
      },
      // Whether the marks are those of the items as they are now (an earlier trip waits for it).
      synced: () => marksRev >= convs.rev,
    };
    // What the model publishes, read only.
    const published = {
      text: () => TXT, // the strings in the page's language
      conv: () => convs.conv, // the conversation in view (rail/conversations.js)
      items: () => convs.items, // its items, frozen
      hasPrev: () => convs.hasPrev, // earlier history is still unloaded
      rev: () => convs.rev, // its items revision
      qs: () => qs, // the questions as of the last render, frozen
      box: () => box, // the scroller's measured box
      moving: () => wave.moving, // a frame is scheduled
      flying: () => flying, // the jump's status as it published it
      pinned: () => pinned,
      busy: () => busyId,
      active: () => active, // the active tick's index, -1 for none (the dev build's bug file)
      lit: () => qs.flatMap((_, j) => (lit(j) ? [j] : [])), // the lit ticks' indexes (likewise)
      pointing: () => pointerY !== null, // the pointer is over the rail
      shown: () => shown, // the card's index (-2: none) and whether it lists bookmarks
      shownBm: () => shownBm,
      seeking: () => !!seek, // a seek preview owns the card and the lit ticks
    };
    for (const [name, get] of Object.entries(published)) Object.defineProperty(api, name, { get });
    return api;
  }
  Object.assign(ButterRailModel, { RAIL_W, PAD, MORE_H, HEADER, COMPOSER, REST, EARLIER });
  globalThis.ButterRailModel = ButterRailModel;
  if (typeof module !== 'undefined') module.exports = ButterRailModel;
})();
