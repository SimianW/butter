// Pure seek classification, layout model and release policy; shared by both worlds and tests.
(function (root) {
  'use strict';
  const OVERLAY_BAND = 15; // overlay bars: press must sit within this many px of the inline-end edge
  const CLASSIC_ARROW = 12; // Chromium classic scrollbar endpoint height
  const CLASSIC_MIN_THUMB = 12;

  // ---- 1. Thumb press classification ----------------------------------------------------------
  // p.x / p.y: pointer position relative to the scroller's border box, in CSS px of the element.
  // Classic bars (a gutter exists): the press must hit the computed thumb.
  // Overlay bars (no gutter, e.g. macOS): no DOM-exposed thumb geometry, so any press on the scroller
  // itself within the edge band is only a *candidate*; activation needs scroll evidence (below).
  function classifyPress(p) {
    if (!p.isTrusted) return { kind: null, reason: 'untrusted' };
    if (p.button !== 0) return { kind: null, reason: 'button' };
    if (p.pointerType && p.pointerType !== 'mouse') return { kind: null, reason: 'pointer-type' };
    if (!p.targetIsScroller) return { kind: null, reason: 'target' };
    if (!(p.scrollHeight > p.clientHeight + 1)) return { kind: null, reason: 'not-scrollable' };
    const bl = p.borderLeft || 0,
      br = p.borderRight || 0,
      bt = p.borderTop || 0;
    const gutter = p.offsetWidth - p.clientWidth - bl - br;
    if (gutter > 0) {
      const leftGutter =
        p.clientLeft == null ? (p.rtl ? gutter : 0) : Math.max(0, p.clientLeft - bl);
      const barWidth = p.rtl ? leftGutter : gutter - leftGutter;
      const barStart = p.rtl ? bl : p.offsetWidth - br - barWidth;
      if (!(p.x >= barStart && p.x < barStart + barWidth))
        return { kind: null, reason: 'classic-off-bar' };
      const arrow = p.arrow ?? CLASSIC_ARROW,
        track = p.clientHeight - 2 * arrow;
      const thumb = Math.max(
        p.minThumb ?? CLASSIC_MIN_THUMB,
        (track * p.clientHeight) / p.scrollHeight,
      );
      const thumbTop = arrow + ((track - thumb) * p.scrollTop) / (p.scrollHeight - p.clientHeight);
      const y = p.y - bt;
      if (y < thumbTop - 2 || y > thumbTop + thumb + 2)
        return { kind: null, reason: 'classic-track' };
      return { kind: 'classic', gutter };
    }
    const fromEdge = p.rtl ? p.x - bl : bl + p.clientWidth - p.x;
    if (fromEdge < -1 || fromEdge > (p.band ?? OVERLAY_BAND))
      return { kind: null, reason: 'overlay-off-band' };
    return { kind: 'overlay', fromEdge };
  }

  // ---- 2. Activation: a candidate becomes a seek session only on scroll evidence ----------------
  // A session starts at the first scroll event of the pressed scroller while the button is still
  // held, with no wheel or key input since the press and the selection unchanged since the press
  // (a press on content collapses/moves the selection; a scrollbar press does not). A plain click
  // near the edge never scrolls, so it never activates.
  function sameSelection(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function createActivation() {
    let st = null; // {phase:'candidate'|'active'|'rejected', ...}
    return {
      get state() {
        return st ? st.phase : 'idle';
      },
      get detail() {
        return st;
      },
      press(e) {
        // {t, kind, scrollTop, selection}
        if (!e.kind) {
          st = null;
          return null;
        }
        st = {
          phase: 'candidate',
          kind: e.kind,
          t: e.t,
          scrollTop: e.scrollTop,
          selection: e.selection,
          reason: null,
        };
        return 'candidate';
      },
      wheel() {
        if (!st) return null;
        if (st.phase === 'candidate') {
          st.phase = 'rejected';
          st.reason = 'wheel';
          return 'reject';
        }
        if (st.phase === 'active') return 'end'; // trackpad scroll during a held drag: hand back to ChatGPT
        return null;
      },
      key() {
        if (st?.phase === 'candidate') {
          st.phase = 'rejected';
          st.reason = 'key';
          return 'reject';
        }
        return null;
      },
      move(e) {
        // pointer/mouse move; thumb drags normally deliver none, but a move without the button = lost release
        if (!st || e.buttons & 1) return null;
        if (st.phase === 'active') return 'end';
        st = null;
        return 'reset';
      },
      scroll(e) {
        // {t, scrollTop, selection, held}
        if (!st || st.phase !== 'candidate') return st?.phase === 'active' ? 'continue' : null;
        if (!e.held) {
          st.phase = 'rejected';
          st.reason = 'not-held';
          return 'reject';
        }
        if (!sameSelection(st.selection, e.selection)) {
          st.phase = 'rejected';
          st.reason = 'selection';
          return 'reject';
        }
        if (Math.abs(e.scrollTop - st.scrollTop) < 1) return null;
        st.phase = 'active';
        st.activatedAt = e.t;
        return 'activate';
      },
      up() {
        const was = st?.phase;
        st = null;
        return was === 'active' ? 'release' : was ? 'reset' : null;
      },
      cancel() {
        const was = st?.phase;
        st = null;
        return was === 'active' ? 'cancel' : null;
      },
    };
  }

  // ---- 3. Height-cache recording ----------------------------------------------------------------
  // A snapshot is only authoritative when the turn is complete, its math has typeset, it is not
  // content-visibility-skipped, it has at least one block, and every block has a non-zero size.
  // Anything else keeps the previous authoritative record (never replaces it with zeros).
  function validateSnapshot(s) {
    if (!s) return 'missing';
    if (!s.complete) return 'incomplete';
    if (!s.mathReady) return 'math-pending';
    if (s.skipped) return 'skipped';
    if (!(s.h > 0) || !Number.isFinite(s.h)) return 'zero-turn';
    if (!s.blocks || !s.blocks.length) return 'no-blocks';
    if (s.blocks.some((h) => !(h > 0) || !Number.isFinite(h))) return 'zero-block';
    if (s.items && s.items.some((it) => !(it.h >= 0) || !Number.isFinite(it.top)))
      return 'bad-item';
    return null;
  }
  function mergeRecord(prev, snap, now) {
    const reason = validateSnapshot(snap);
    if (reason) return { entry: prev || null, changed: false, reason };
    const entry = {
      conv: snap.conv,
      h: snap.h,
      rowH: snap.rowH,
      turnOffset: snap.turnOffset,
      turnH: snap.turnH,
      w: snap.w,
      vw: snap.vw,
      sw: snap.sw,
      msg: snap.msg,
      blocks: snap.blocks.slice(),
      items: snap.items ? snap.items.slice() : prev?.items || [],
      ready: true,
      removed: prev?.conv === snap.conv ? !!prev.removed : false,
      recordedAt: now,
      records: (prev?.records || 0) + 1,
    };
    const changed =
      !prev ||
      !prev.ready ||
      prev.h !== entry.h ||
      prev.blocks.length !== entry.blocks.length ||
      prev.blocks.some((h, i) => h !== entry.blocks[i]) ||
      (prev.items?.length || 0) !== entry.items.length;
    return { entry, changed, reason: null };
  }
  // Restore needs the live turn to be the same message, at the same width, with the same number of
  // blocks the cache recorded.
  function canRestore(e, live) {
    if (!e || !e.ready) return 'no-entry';
    if (!e.removed) return 'not-removed';
    if (e.conv !== live.conv) return 'conv';
    if (e.vw !== live.vw || (live.sw != null && e.sw !== live.sw)) return 'width';
    if (!live.complete) return 'incomplete';
    if (live.msg !== e.msg) return 'identity';
    if (!live.mathReady) return 'math-pending';
    if (live.blockCount !== e.blocks.length) return 'block-count';
    if (e.blocks.some((h) => !(h > 0))) return 'zero-block';
    return null;
  }
  function coverage(get, ids, live) {
    const out = { covered: [], missing: [] };
    for (const id of ids) {
      const e = get(id);
      const why = !e
        ? 'no-entry'
        : !e.ready
          ? 'not-ready'
          : e.conv !== live.conv
            ? 'conv'
            : e.vw !== live.vw
              ? 'width'
              : !e.blocks.length
                ? 'no-blocks'
                : e.blocks.some((h) => !(h > 0))
                  ? 'zero-block'
                  : null;
      if (why) out.missing.push({ id, why });
      else out.covered.push(id);
    }
    return out;
  }

  // ---- 4. Preview model: turn tops + per-item layout ---------------------------------------------
  // ids: virtualizer row order. measured[id]: ChatGPT's measured row height. records[id]: height-cache
  // entry (items with top relative to the row). texts[id]: {q, answer} markdown. anchor: one mounted
  // row's real top in scroll coordinates. gap: px between rows.
  function buildModel({ ids, measured, records, texts, scrollHeight, gap, anchor, sw }) {
    const est = ids.map((id) => {
      const t = texts[id];
      return records?.[id]?.fromStorage
        ? records[id].rowH
        : Math.max(208, ((t?.q.length || 0) + (t?.answer.length || 0)) * 2.1);
    });
    const known = ids.map((id) => measured[id] || 0);
    const rest = Math.max(
      0,
      scrollHeight - known.reduce((a, b) => a + b, 0) - gap * Math.max(0, ids.length - 1),
    );
    const weight = est.reduce((a, b, i) => a + (known[i] ? 0 : b), 0);
    let top = 0;
    const turns = ids.map((id, i) => {
      const h = known[i] || Math.max(208, (rest * est[i]) / (weight || 1));
      const r = records?.[id];
      // Per-item layout is trusted only when the cache height agrees with ChatGPT's measured height.
      const layout = !!(
        r &&
        r.items?.length &&
        (sw == null || r.sw === sw) &&
        (r.fromStorage || (known[i] && Math.abs(r.rowH - known[i]) <= 2))
      );
      const t = {
        id,
        index: i,
        top,
        h,
        known: !!known[i] || !!r?.fromStorage,
        stored: !!r?.fromStorage,
        layout,
        items: layout ? r.items : null,
        q: texts[id]?.q || '',
        answer: texts[id]?.answer || '',
      };
      // The rail observes the turn element, excluding any row date/prefix and trailing gap.
      t.litTop = top + (layout ? (r.turnOffset ?? 0) : 0);
      t.litH = layout ? (r.turnH ?? r.h) : h;
      top += h + gap;
      return t;
    });
    if (anchor) {
      const at = turns.find((t) => t.id === anchor.id);
      if (at) {
        const d = anchor.top - at.top;
        for (const t of turns) {
          t.top += d;
          t.litTop += d;
        }
      }
    }
    return turns;
  }
  // Native estimated rows remain untouched. The preview has a separate full-height coordinate
  // system so stored block positions cannot overlap adjacent native estimated row spans.
  function buildPreviewModel(turns, records, gap) {
    let top = 0;
    return turns.map((t) => {
      const h = t.layout ? records[t.id]?.rowH || t.h : t.h;
      const row = { ...t, top, h, litTop: top + (t.litTop ?? t.top) - t.top };
      top += h + gap;
      return row;
    });
  }
  function previewScrollTop(turns, preview, scrollTop, insetTop) {
    const t = turnAt(turns, scrollTop + insetTop);
    if (!t) return scrollTop;
    const row = preview[t.index],
      offset = Math.max(0, scrollTop + insetTop - t.top);
    return row.top + (Math.min(offset, t.h) * row.h) / t.h + Math.max(0, offset - t.h) - insetTop;
  }
  function turnAt(turns, top) {
    let lo = 0,
      hi = turns.length - 1;
    if (hi < 0) return null;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (turns[mid].top <= top) lo = mid;
      else hi = mid - 1;
    }
    return turns[lo];
  }
  function mapTop(turns, top) {
    const t = turnAt(turns, top);
    if (!t) return null;
    return {
      id: t.id,
      index: t.index,
      offset: Math.max(0, top - t.top),
      turnTop: t.top,
      height: t.h,
      known: t.known,
      layout: t.layout,
    };
  }
  // Every turn retains a row-height fallback: recorded block geometry can outlive or exceed its
  // capped lean text. The renderer uses a measured turn's fallback only if its text is clipped away.
  function flatten(turns) {
    const out = [];
    for (const t of turns) {
      if (t.layout)
        for (let i = 0; i < t.items.length; i++) {
          const it = t.items[i];
          out.push({ turn: t.index, index: i, abs: t.top + it.top, h: it.h, it });
        }
      out.push({
        turn: t.index,
        index: -1,
        abs: t.top,
        h: t.h,
        estimate: true,
        fallback: !!t.layout,
      });
    }
    out.sort((a, b) => a.abs - b.abs);
    let bottom = -Infinity;
    for (const f of out) {
      bottom = Math.max(bottom, f.abs + f.h);
      f.maxBottom = bottom;
    }
    return out;
  }
  // Prefix bottoms stay monotonic even when a whole-turn fallback overlaps shorter block spans.
  function windowAt(flat, top, height, margin = 0) {
    const lo = top - margin,
      hi = top + height + margin;
    let a = 0,
      b = flat.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if ((flat[m].maxBottom ?? flat[m].abs + flat[m].h) < lo) a = m + 1;
      else b = m;
    }
    const res = [];
    for (let i = Math.max(0, a - 1); i < flat.length && flat[i].abs <= hi; i++)
      if (flat[i].abs + flat[i].h >= lo) res.push(i);
    return res;
  }
  // Pure fallback shared by estimated rows and measured rows whose lean text has been clipped.
  // Clamp stale/shifted model offsets and use a question or explicit placeholder if source is absent.
  function previewExcerpt(t, offset) {
    const answer = t?.answer || '',
      q = t?.q || '';
    const frac = Math.min(1, Math.max(0, offset / (t?.h || 1)));
    const from = Math.max(0, Math.floor(answer.length * frac) - 100);
    const text = (frac < 0.02 ? q + '\n\n' : '') + answer.slice(from, from + 2600);
    return {
      text: (text.trim()
        ? text
        : q.trim() || answer.trim().slice(-2600) || 'Preview text unavailable'
      ).trimStart(),
      from,
    };
  }

  // ---- 5. Post-release correction for height drift above the destination -------------------------
  // If rows above the destination were re-measured at mount, the destination's real top moved; keep
  // the preview's promise by moving the scroll position by the same amount (bounded, known turns only).
  function retarget({
    known,
    frozenTurnTop,
    actualTurnTop,
    offset,
    height,
    scrollTop,
    maxScroll,
    tolerance = 4,
  }) {
    if (!known) return null;
    const drift = actualTurnTop - frozenTurnTop;
    if (Math.abs(drift) <= tolerance) return null;
    const want = Math.min(
      maxScroll,
      Math.max(0, actualTurnTop + Math.min(offset, Math.max(0, height - 1))),
    );
    if (Math.abs(want - scrollTop) <= tolerance) return null;
    return { to: want, drift };
  }

  // Coalesce only final native movement while geometry is unchanged. A history response or
  // virtualizer height change invalidates numeric scrollTop as a thumb-position signal.
  function createRelease({ top, height, maxTop = height, direction = 0 }) {
    let last = top,
      reason = null;
    return {
      invalidate(why) {
        reason = reason || why;
      },
      sample(next) {
        if (!reason && (next.top > maxTop + 4 || (direction && (next.top - last) * direction < -4)))
          reason = 'application-adjustment';
        if (reason) return { accept: false, top: last, reason };
        last = next.top;
        return { accept: true, top: last };
      },
      dump() {
        return { top: last, height, maxTop, direction, reason };
      },
    };
  }

  // The turn at the top owns preview rendering and the destination, independently of rail lighting.
  function previewQuestion(turns, scrollTop, insetTop) {
    return mapTop(turns, scrollTop + insetTop);
  }
  function landing(question, insetTop, maxScroll) {
    if (!question) return null;
    const offset = question.layout ? question.offset - insetTop : -insetTop;
    return {
      ...question,
      offset,
      known: question.layout || question.known,
      top: Math.max(0, Math.min(maxScroll, question.turnTop + offset)),
    };
  }

  function previewLitQuestions(turns, scrollTop, height) {
    // Match rail/rail.js ioBand: HEADER=52, COMPOSER=140, EDGE=40.
    const top = scrollTop + 52 + 40,
      bottom = scrollTop + height - 140 - 40;
    if (bottom < top) return [];
    return turns.filter(
      (t) => (t.litTop ?? t.top) <= bottom && (t.litTop ?? t.top) + (t.litH ?? t.h) >= top,
    );
  }
  // The card names the lit question that fills most of the lit band, so a preceding answer's
  // short tail below the header stays lit without taking the card from the question on screen.
  function previewCardQuestion(lit, scrollTop, height) {
    const top = scrollTop + 52 + 40,
      bottom = scrollTop + height - 140 - 40;
    let best = null,
      most = -1;
    for (const t of lit) {
      const a = t.litTop ?? t.top,
        span = Math.min(bottom, a + (t.litH ?? t.h)) - Math.max(top, a);
      if (span > most) {
        best = t;
        most = span;
      }
    }
    return best;
  }

  const api = {
    previewLitQuestions,
    previewCardQuestion,
    previewQuestion,
    landing,
    OVERLAY_BAND,
    createRelease,
    classifyPress,
    sameSelection,
    createActivation,
    validateSnapshot,
    mergeRecord,
    canRestore,
    coverage,
    buildModel,
    buildPreviewModel,
    previewScrollTop,
    turnAt,
    mapTop,
    flatten,
    windowAt,
    previewExcerpt,
    retarget,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.__butterSeekCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
