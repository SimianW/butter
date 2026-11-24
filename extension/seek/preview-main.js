// MAIN world: native-thumb scroll suppression, lean preview and one destination commit.
// Conversation markdown is seek/preview-texts-main.js, the landing after the commit is
// seek/landing-main.js and the diagnostics' session serializer is seek/seek-diagnostics-main.js;
// all three load before this file, which calls their factories.
// ChatGPT's answer structure (preview items, markdown columns) is read through the page reader,
// page/reader-main.js.
(() => {
  const core = globalThis.__butterSeekCore,
    page = globalThis.__butterPageReader,
    layoutCheck = globalThis.__butterLayoutCheck,
    textsOf = globalThis.__butterPreviewTexts,
    landingOf = globalThis.__butterSeekLanding,
    diagnosticsOf = globalThis.__butterSeekDiagnostics;
  if (!core || !page || !textsOf || !landingOf || !diagnosticsOf) return;
  const S = { v: 2, events: [], updates: [], sessions: [], presses: [], active: false };
  let seekFacts = {},
    statusPath = location.pathname;
  document.addEventListener('butter-status-request', () => {
    if (statusPath !== location.pathname) {
      statusPath = location.pathname;
      seekFacts = {};
    }
    document.dispatchEvent(
      new CustomEvent('butter-status-response', {
        detail: JSON.stringify({ seek: seekFacts }),
      }),
    );
  });
  const seekOutcome = (facts) => {
    statusPath = location.pathname;
    seekFacts = facts;
  };
  let host,
    layer,
    est,
    fade,
    notice,
    active = null,
    pendingCommit = null,
    held = false,
    releaseScroll = null,
    lastPointerDown = -1e9;
  const act = core.createActivation();
  let revealOwner = null,
    hideTimer;
  let candidate = null; // {sc, model, flat, ...} prepared at press time
  let pressDecision = null,
    prepareSequence = 0;
  // Dev build only: dev/recorder-main.js sets a listener through __seekDump.tap. Unset in the
  // store build, so each hook below is one null check and builds no summary.
  let tap = null;
  const emit = (type, fields) => {
    try {
      tap(type, fields);
    } catch {}
  };
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1];
  const event = (kind, more = {}) => {
    S.events.push({ kind, t: performance.now(), ...more });
    if (S.events.length > 2000) S.events.splice(0, 500);
  };
  const disabled = () =>
    document.documentElement?.hasAttribute('data-butter-disabled') ||
    document.documentElement?.getAttribute('data-butter-off')?.split(/\s+/).includes('seek');
  const railState = (a, state) => {
    const destination =
      a && core.previewQuestion(a.prep.model, a.lastTop ?? a.startTop, a.insetTop);
    // An unseen preview shows one question from its beginning. Measured previews retain the
    // normal rail's full lit set, even if a preceding answer has a small tail below the header.
    const lit =
      a && destination?.layout
        ? core.previewLitQuestions(
            a.prep.previewModel,
            a.previewTop ?? a.lastTop ?? a.startTop,
            a.sc.clientHeight,
          )
        : [];
    const q =
      (a &&
        core.previewCardQuestion(
          lit,
          a.previewTop ?? a.lastTop ?? a.startTop,
          a.sc.clientHeight,
        )) ||
      destination;
    document.dispatchEvent(
      new CustomEvent('butter-seek-state', {
        detail: JSON.stringify({
          conv: a?.conv ?? conv(),
          state,
          id: q?.id,
          n: q ? q.index + 1 : 0,
          lit: lit.length ? lit.map((t) => t.id) : q ? [q.id] : [],
          total: a?.prep.model.length ?? 0,
          unseen: q ? !q.layout : false,
        }),
      }),
    );
  };
  globalThis.__butterSeeking = () => !!active;

  // Conversation markdown (texts) and its listeners: seek/preview-texts-main.js.
  const { texts } = textsOf({
    conv,
    event,
    finish,
    seekOutcome,
    active: () => active,
    pendingCommit: () => pendingCommit,
  });
  // ChatGPT's virtualizer: row order and measured row heights (private React shape; read only).
  const measured = (s) => {
    const t = s.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))];
    for (let depth = 0; f && depth < 80; depth++, f = f.return)
      if (Array.isArray(f.memoizedProps?.entries) && f.memoizedProps.RowComponent) {
        const ids = f.memoizedProps.entries.map((e) => e.turnKey);
        let heights = {};
        for (let h = f.memoizedState, i = 0; h && i < 80; h = h.next, i++) {
          const v = h.memoizedState;
          if (
            v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            ids.some((id) => typeof v[id] === 'number')
          ) {
            heights = v;
            break;
          }
        }
        return { ids, heights };
      }
    return null;
  };
  // Built at press time (off the drag's critical path): frozen model + flattened item layout.
  function prepare(s, phase = 'press') {
    const t0 = performance.now(),
      tx = texts(),
      fib = measured(s),
      cache = globalThis.__butterLayoutCache;
    const ids = fib?.ids || Object.keys(tx.byId);
    const threadScrollers = [...document.querySelectorAll('.thread-scroll-container')],
      threadScroller = threadScrollers.find((sc) => sc.clientHeight > 0),
      decision = {
        schema: 1,
        sequence: ++prepareSequence,
        phase,
        fiberFound: !!fib,
        idsFromFallback: !fib,
        idsReason: fib ? null : 'ids-from-fallback',
        modelLength: ids.length,
        scroller: {
          matchesThreadScroller: s === threadScroller,
          threadScrollerCount: threadScrollers.length,
          threadScrollerSw: threadScroller?.clientWidth ?? null,
          swBefore: s.clientWidth,
          sw: null,
          clientHeight: s.clientHeight,
          scrollHeight: s.scrollHeight,
        },
        turns: [],
        render: null,
      };
    if (phase === 'press') pressDecision = decision;
    else if (pressDecision) pressDecision.releasePrepare = decision;
    if (!ids.length) return null;
    const sr = s.getBoundingClientRect(),
      rows = [...s.querySelectorAll('[data-turn-key]')].map((t) => ({
        id: t.dataset.turnKey,
        r: t.parentElement.getBoundingClientRect(),
      }));
    let anchor = null,
      gap = 12;
    if (rows.length) {
      anchor = { id: rows[0].id, top: rows[0].r.top - sr.top + s.scrollTop };
      if (rows.length > 1) {
        const g = rows[1].r.top - rows[0].r.bottom;
        if (g >= 0 && g < 64) gap = g;
      }
    }
    const { records, storedTurns, decisions } = cache?.prepare(s, ids) || {
      records: {},
      storedTurns: 0,
    };
    const sw = s.clientWidth;
    // A mounted row's live height is the truth; ChatGPT's height map can hold a stale value for it
    // (macOS: 266 for a settled 1896 row). Unmounted turns still use the virtualizer heights.
    const rowHeights = new Map(rows.map(({ id, r }) => [id, r.height]));
    const heights = { ...fib?.heights, ...Object.fromEntries(rowHeights) };
    const model = core.buildModel({
      ids,
      measured: heights,
      records,
      texts: tx.byId,
      scrollHeight: s.scrollHeight,
      gap,
      anchor,
      sw,
    });
    decision.scroller.sw = sw;
    decision.recordCount = Object.keys(records).length;
    decision.storedTurns = storedTurns;
    decision.mountedTurns = rows.length;
    decision.turns = model.map((t, index) => {
      const r = records[t.id],
        measuredHeight = fib?.heights[t.id] || 0,
        cacheDecision = decisions?.[index],
        number = (value) => (Number.isFinite(value) ? value : null);
      return {
        index,
        mounted: rowHeights.has(t.id),
        rowHeightAtPrepare: number(rowHeights.get(t.id)),
        measuredHeight: number(measuredHeight),
        rowH: number(r?.rowH),
        recordSw: number(r?.sw),
        items: r?.items?.length ?? 0,
        fromStorage: !!r?.fromStorage,
        modelTop: number(t.top),
        modelHeight: number(t.h),
        layout: t.layout,
        layoutReason: cacheDecision?.reason || core.layoutReason(r, heights[t.id] || 0, sw),
        cache: cacheDecision ?? null,
      };
    });
    const previewModel = core.buildPreviewModel(model, records, gap);
    const flat = core.flatten(previewModel);
    const column = Object.values(records)
      .flatMap((r) => r.items)
      .find((it) => !it.user);
    const colLeft = column?.left ?? Math.max(24, (s.clientWidth - 768) / 2);
    const colWidth = column?.w ?? Math.max(0, Math.min(768, s.clientWidth - 2 * colLeft));
    return {
      decision,
      model,
      previewModel,
      flat,
      storedTurns,
      maxTop: s.scrollHeight - s.clientHeight,
      hasPrev: tx.hasPrev,
      gap,
      colLeft,
      colWidth,
      prepMs: performance.now() - t0,
      layoutTurns: model.filter((t) => t.layout).length,
      knownTurns: model.filter((t) => t.known).length,
    };
  }

  // ---- surface ----
  const opaque = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent') return c;
    }
    return getComputedStyle(document.documentElement).backgroundColor || '#fff';
  };
  function surface() {
    if (host) return;
    host = document.createElement('butter-seek-preview');
    host.style.cssText =
      'position:fixed;z-index:19;pointer-events:none;display:block;opacity:0;contain:strict;overflow:hidden;left:0;top:0;width:0;height:0';
    host.inert = true;
    host.setAttribute('aria-hidden', 'true');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
:host{all:initial;--math-bg:rgb(0 0 0 / .04);--math-fg:#5d5d5d;--notice-bg:#fafafa;--notice-border:#bbb;--notice-fg:#444}
:host([data-dark]){--math-bg:rgb(255 255 255 / .06);--math-fg:#a3a3a3;--notice-bg:#262626;--notice-border:#666;--notice-fg:#ccc}
.layer{position:absolute;left:0;top:0;width:100%;height:0}
.it{position:absolute;box-sizing:border-box;margin:0;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;opacity:.5}
.est{position:absolute;box-sizing:border-box;overflow:hidden;overflow-wrap:anywhere}
.est .question{white-space:pre-wrap;box-sizing:border-box;width:fit-content;max-width:72%;margin:14px 0 14px auto;padding:8px 14px;border-radius:18px;background:var(--bubble);opacity:.5}
.est .answer{white-space:pre-wrap;opacity:.5}
.est p{margin:0 0 10px}.est h4{margin:14px 0 6px;font-size:16px}
.math{font:13px ui-monospace,"SF Mono",Menlo,monospace;color:var(--math-fg)}
.math.display{display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:var(--math-bg);border-radius:8px;padding:0 12px;font:12px/1.5 ui-monospace,"SF Mono",Menlo,monospace;white-space:nowrap;overflow:hidden}
.math.display span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fade{position:absolute;inset:auto 0 0;height:60px;background:linear-gradient(transparent,var(--page));pointer-events:none}
.fade.unseen{height:110px;background:linear-gradient(transparent,var(--page) 55%)}
.notice{position:absolute;bottom:8px;box-sizing:border-box;padding:8px 10px;border:1px dashed var(--notice-border);border-radius:8px;background:var(--notice-bg);font-size:13px;line-height:1.45;color:var(--notice-fg)}
.notice:not([hidden]){display:flex;gap:8px;align-items:flex-start}
.notice b{display:block;font-weight:600;color:var(--preview-fg)}
</style><div class="layer"></div><div class="est" hidden></div><div class="fade" hidden></div><div class="notice" hidden><span>⋯</span><span><b></b><span class="notice-detail"></span></span></div>`;
    layer = shadow.querySelector('.layer');
    est = shadow.querySelector('.est');
    fade = shadow.querySelector('.fade');
    notice = shadow.querySelector('.notice');
    document.documentElement.append(host);
  }
  function place(a) {
    const s = a.sc,
      sr = s.getBoundingClientRect();
    const head = [...document.querySelectorAll('header')]
      .map((h) => h.getBoundingClientRect())
      .filter(
        (r) => r.height > 0 && r.bottom > sr.top && r.bottom < sr.top + 200 && r.right > sr.left,
      )
      .reduce((m, r) => Math.max(m, r.bottom - sr.top), 0);
    const form = [...document.querySelectorAll('form')]
      .map((f) => f.getBoundingClientRect())
      .filter(
        (r) =>
          r.height > 0 && r.top > sr.top + sr.height / 2 && r.left < sr.right && r.right > sr.left,
      )
      .sort((x, y) => x.top - y.top)[0];
    a.insetTop = Math.round(head);
    a.insetBottom = form ? Math.max(0, Math.round(sr.bottom - form.top + 8)) : 140;
    const st = getComputedStyle(s),
      span = core.previewHostSpan({
        offsetWidth: s.offsetWidth,
        clientWidth: s.clientWidth,
        borderLeft: parseFloat(st.borderLeftWidth) || 0,
        borderRight: parseFloat(st.borderRightWidth) || 0,
        rtl: st.direction === 'rtl',
      });
    a.hostRect = {
      x: sr.left + s.clientLeft + span.offset,
      y: sr.top + a.insetTop,
      width: span.width,
      height: Math.max(0, s.clientHeight - a.insetTop - a.insetBottom),
    };
    a.dark =
      document.documentElement.classList.contains('dark') ||
      /dark/.test(getComputedStyle(document.documentElement).colorScheme);
    host.toggleAttribute('data-dark', a.dark);
    const md = globalThis.__butterLayoutCache?.column?.(s) || page.firstColumn(s);
    const fg = md ? getComputedStyle(md).color : getComputedStyle(document.body).color,
      bg = opaque(s);
    host.style.cssText += `;left:${a.hostRect.x}px;top:${a.hostRect.y}px;width:${a.hostRect.width}px;height:${a.hostRect.height}px;background:${bg};color:${fg}`;
    layer.style.left = `${span.shift}px`;
    est.style.cssText = `left:${a.prep.colLeft + span.shift}px;width:${Math.min(a.prep.colWidth, s.clientWidth - a.prep.colLeft)}px;font:16px/26px ${md ? getComputedStyle(md).fontFamily : 'system-ui,sans-serif'};color:${fg}`;
    notice.style.cssText = `left:${a.prep.colLeft + span.shift}px;width:${Math.min(a.prep.colWidth, s.clientWidth - a.prep.colLeft)}px;font-family:${md ? getComputedStyle(md).fontFamily : 'system-ui,sans-serif'}`;
    host.style.setProperty('--preview-fg', fg);
    host.style.setProperty('--page', bg);
    host.style.setProperty('--bubble', a.dark ? '#303030' : '#f4f4f4');
  }
  // Text nodes and typed math spans only: no chat HTML is inserted into the preview.
  function content(el, text, math = []) {
    let at = 0;
    for (const m of math) {
      el.append(document.createTextNode(text.slice(at, m.start)));
      const span = document.createElement('span');
      span.className = 'math' + (m.display ? ' display' : '');
      if (m.display) {
        span.style.height = `${Math.min(m.h, core.displayMathLimit({ text, math }, m))}px`;
        const line = document.createElement('span');
        line.textContent = text.slice(m.start, m.end).replace(/\s+/g, ' ');
        span.append(line);
      } else span.textContent = text.slice(m.start, m.end);
      el.append(span);
      at = m.end;
    }
    el.append(document.createTextNode(text.slice(at)));
  }
  function estimatedContent(el, text) {
    const math = [],
      re = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)|(?<!\\)\$([^$\n]+)\$/g;
    let out = '',
      at = 0;
    for (const m of text.matchAll(re)) {
      out += text.slice(at, m.index);
      const start = out.length;
      out += m[1] ?? m[2] ?? m[3] ?? m[4];
      math.push({ start, end: out.length, display: m[1] != null || m[2] != null, h: 38 });
      at = m.index + m[0].length;
    }
    out += text.slice(at);
    content(el, out, math);
  }
  function render(a, top) {
    const t0 = performance.now(),
      display = a.prep.previewModel || a.prep.model;
    a.previewTop = core.previewScrollTop(a.prep.model, display, top, a.insetTop);
    const view = a.previewTop + a.insetTop,
      H = a.hostRect.height;
    const question = core.previewQuestion(a.prep.model, top, a.insetTop);
    const unseen = question && !question.layout;
    // Diagnostics only: record which turn this press's frozen model selected.
    if (a.prep.decision)
      a.prep.decision.render = {
        prepareSequence: a.prep.decision.sequence,
        modelLength: a.prep.model.length,
        turnIndex: question?.index ?? null,
        layout: question?.layout ?? null,
        unseen: !!unseen,
        top,
        insetTop: a.insetTop,
        previewTop: a.previewTop,
      };
    notice.hidden = !unseen;
    if (unseen) {
      // Match the rail's language setting; seek-meta.js lives in the isolated world.
      const zh = document.documentElement.getAttribute('data-butter-lang') === 'zh';
      notice.querySelector('b').textContent = zh
        ? '只能预览这个回答的开头'
        : 'Only the start of this answer can be previewed';
      notice.querySelector('.notice-detail').textContent = zh
        ? '其余部分还没有缓存，打开这个问题即可查看。'
        : "The rest isn't cached yet. Open the question to see it.";
    }
    fade.className = unseen ? 'fade unseen' : 'fade';
    const vis = unseen ? [] : core.windowAt(a.prep.flat, view, H, 400),
      want = new Set();
    const estimated = unseen
      ? a.prep.model[question.index]
      : vis
          .map((i) => a.prep.flat[i])
          .find((f) => f.estimate && !f.fallback && f.abs <= view + H && f.abs + f.h >= view);
    if (estimated) {
      const t = unseen ? estimated : a.prep.model[estimated.turn];
      const y = unseen ? 0 : Math.max(0, estimated.abs - view);
      if (a.estTurn !== t.id || est.hidden) {
        est.replaceChildren();
        const q = document.createElement('div'),
          answer = document.createElement('div');
        q.className = 'question';
        estimatedContent(q, t.q);
        answer.className = 'answer';
        for (const raw of t.answer.slice(0, 6000).split(/\n\s*\n/)) {
          const block = raw.trim();
          if (!block) continue;
          const heading = /^#{1,6}\s+/.test(block);
          const paragraph = document.createElement(heading ? 'h4' : 'p');
          estimatedContent(paragraph, core.fallbackText(block));
          answer.append(paragraph);
        }
        est.append(q, answer);
      }
      est.hidden = false;
      est.style.top = `${y}px`;
      est.style.height = `${H - y}px`;
      a.estTurn = t.id;
    } else est.hidden = true;
    fade.hidden = !estimated;
    for (const i of vis) {
      const f = a.prep.flat[i];
      if (f.estimate) continue;
      want.add(i);
      if (!a.rendered.has(i)) {
        const el = document.createElement('div'),
          it = f.it;
        el.className = 'it';
        const span = core.previewItemSpan(it, { left: a.prep.colLeft, w: a.prep.colWidth });
        el.style.cssText = `${it.css};top:${f.abs}px;left:${span.left}px;width:${span.w}px;height:${it.h}px`;
        if (it.user) {
          el.style.background = 'var(--bubble)';
          el.style.borderRadius = '18px';
        }
        if (core.displayMath(it)) {
          el.className = 'it math display';
          // Rows stored by earlier builds can still carry a formula box that spans the rest of its
          // turn (see core.displayMathLimit); never draw more than one formula's worth of box.
          el.style.cssText += `;font:12px/1.5 ui-monospace,"SF Mono",Menlo,monospace;padding:0 12px;border-radius:8px;background:var(--math-bg);color:var(--math-fg);height:${Math.min(it.h, core.displayMathLimit(it))}px`;
          const line = document.createElement('span');
          line.textContent = it.text.replace(/\s+/g, ' ');
          el.append(line);
        } else content(el, it.text, it.math);
        layer.append(el);
        a.rendered.set(i, el);
      }
    }
    for (const [i, el] of a.rendered)
      if (!want.has(i)) {
        el.remove();
        a.rendered.delete(i);
      }
    layer.style.transform = `translateY(${-view}px)`;
    // An intersecting block box does not imply visible ink: lean text is capped, TeX can shrink,
    // hydration may lack text, and real blocks can have large empty geometry. Read only the tiny
    // preview tree; never mount or measure real turns during the hold.
    const hasText = (el) => {
      if (!el.textContent.trim()) return false;
      const box = el.getBoundingClientRect(),
        range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.data.trim()) continue;
        range.selectNodeContents(node);
        if (
          [...range.getClientRects()].some(
            (r) =>
              r.width > 0 &&
              r.height > 0 &&
              r.bottom > Math.max(box.top, a.hostRect.y) &&
              r.top < Math.min(box.bottom, a.hostRect.y + H) &&
              r.right > a.hostRect.x &&
              r.left < a.hostRect.x + a.hostRect.width,
          )
        )
          return true;
      }
      return false;
    };
    a.textFallback = false;
    if (!(!est.hidden && hasText(est)) && ![...a.rendered.values()].some(hasText)) {
      const t = core.turnAt(display, view),
        excerpt = core.previewExcerpt(t, view - t.top);
      est.hidden = false;
      est.style.top = '0px';
      est.style.height = `${H}px`;
      est.replaceChildren();
      const answer = document.createElement('div');
      answer.className = 'answer';
      estimatedContent(answer, excerpt.text);
      est.append(answer);
      a.estFrom = excerpt.from;
      a.estTurn = t.id;
      a.textFallback = true;
    }
    if (tap) previewTap(a, question, estimated);
    return performance.now() - t0;
  }
  // Dev build: one preview event each time the previewed question or its mode changes, and a
  // preview-miss when that mode shows less than the recorded layout (for the turn the estimate or
  // excerpt stands in for, with the press's layout reason for it).
  function previewTap(a, question, estimated) {
    if (!question) return;
    const mode = !question.layout
        ? 'unseen'
        : a.textFallback
          ? 'text-fallback'
          : estimated
            ? 'estimate'
            : 'layout',
      seen = `${question.index}:${mode}`;
    if (a.tapPreview === seen) return;
    a.tapPreview = seen;
    emit('preview', {
      turn: question.index,
      mode,
      layout: question.layout,
      unseen: mode === 'unseen',
      items: a.rendered.size,
      estimate: !est.hidden,
      textFallback: !!a.textFallback,
    });
    if (mode === 'layout') return;
    const shown = a.prep.model.findIndex((t) => t.id === a.estTurn),
      turn = shown < 0 ? question.index : shown;
    emit('preview-miss', {
      turn,
      reason: mode,
      layoutReason: a.prep.decision?.turns?.[turn]?.layoutReason ?? null,
    });
  }
  function update(e, knownTop) {
    const a = active || pendingCommit;
    if (!a) return;
    const start = performance.now(),
      top = knownTop ?? a.sc.scrollTop,
      m = core.mapTop(a.prep.model, top);
    if (!m) return;
    a.previousTop = a.lastTop ?? a.startTop;
    a.last = m;
    a.lastTop = top;
    const renderMs = render(a, top);
    railState(a, a.end ? 'loading' : 'dragging');
    const seq = S.updates.length + 1;
    const row = {
      seq,
      t: start,
      eventTime: e?.timeStamp ?? start,
      top,
      turn: m.index,
      offset: Math.round(m.offset),
      layout: m.layout,
      known: m.known,
      items: a.rendered.size,
      textFallback: a.textFallback,
      renderMs,
      jsMs: performance.now() - start,
    };
    if (tap)
      emit('seek', {
        top,
        turn: m.index,
        offset: row.offset,
        layout: m.layout,
        known: m.known,
        items: row.items,
        textFallback: row.textFallback,
        renderMs,
        jsMs: row.jsMs,
      });
    S.updates.push(row);
    if (S.updates.length > 5000) S.updates.splice(0, 1000);
    requestAnimationFrame(() =>
      setTimeout(() => {
        row.afterPaint = performance.now();
        row.latency = row.afterPaint - row.eventTime;
      }, 0),
    );
  }

  // ---- press / activation ----
  const selection = () => {
    const s = getSelection();
    return s ? [s.type, s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
  };
  const isScroller = (el) => el?.matches?.('.thread-scroll-container') && el.clientHeight > 0;
  function down(e) {
    if (disabled()) return;
    if (e.type === 'pointerdown') lastPointerDown = e.timeStamp;
    else if (Math.abs(e.timeStamp - lastPointerDown) < 50) return; // mousedown after a handled pointerdown
    if (e.button === 0) held = true;
    if (active || pendingCommit) return;
    const s = e.target,
      onSc = isScroller(s);
    let c = { kind: null, reason: 'target' };
    if (onSc) {
      const r = s.getBoundingClientRect(),
        st = getComputedStyle(s);
      c = core.classifyPress({
        isTrusted: e.isTrusted,
        button: e.button,
        pointerType: e.pointerType,
        targetIsScroller: true,
        x: ((e.clientX - r.left) * s.offsetWidth) / r.width,
        y: ((e.clientY - r.top) * s.offsetHeight) / r.height,
        offsetWidth: s.offsetWidth,
        clientLeft: s.clientLeft,
        clientWidth: s.clientWidth,
        clientHeight: s.clientHeight,
        scrollHeight: s.scrollHeight,
        scrollTop: s.scrollTop,
        borderLeft: parseFloat(st.borderLeftWidth) || 0,
        borderRight: parseFloat(st.borderRightWidth) || 0,
        borderTop: parseFloat(st.borderTopWidth) || 0,
        rtl: st.direction === 'rtl',
      });
    }
    S.presses.push({
      t: performance.now(),
      type: e.type,
      onScroller: onSc,
      kind: c.kind,
      reason: c.reason,
      x: onSc ? Math.round(e.clientX - s.getBoundingClientRect().left) : null,
      w: onSc ? s.clientWidth : null,
      ow: onSc ? s.offsetWidth : null,
    });
    if (S.presses.length > 200) S.presses.shift();
    if (!c.kind) {
      if (tap && onSc) emit('press', { kind: null, reason: c.reason });
      act.cancel();
      candidate = null;
      return;
    }
    const prep = prepare(s);
    if (!prep) event('no-model');
    if (tap)
      emit('press', {
        kind: c.kind,
        sequence: pressDecision?.sequence ?? null,
        modelLength: pressDecision?.modelLength ?? null,
        layoutTurns: prep?.layoutTurns ?? null,
        prepMs: prep?.prepMs ?? null,
        scrollTop: s.scrollTop,
      });
    candidate = {
      t: performance.now(),
      sc: s,
      prep,
      kind: c.kind,
      startTop: s.scrollTop,
      conv: conv(),
    };
    act.press({ t: candidate.t, kind: c.kind, scrollTop: s.scrollTop, selection: selection() });
    event('candidate', { kind: c.kind, prepMs: prep?.prepMs, layoutTurns: prep?.layoutTurns });
  }
  function activate(e) {
    const c = candidate,
      s = c.sc;
    candidate = null;
    surface();
    layer.replaceChildren();
    est.hidden = true;
    const a = (active = {
      start: performance.now(),
      pressAt: c.t,
      kind: c.kind,
      conv: c.conv,
      sc: s,
      prep: c.prep,
      hasPrev: c.prep.hasPrev,
      startTop: c.startTop,
      rendered: new Map(),
    });
    restoreMask(revealOwner);
    revealOwner = a;
    S.sessions.push(a);
    if (S.sessions.length > 50) S.sessions.shift();
    S.active = true;
    const el = s.querySelector('[data-turn-key]')?.parentElement?.parentElement;
    if (el && el !== s) {
      a.shift = {
        el,
        value: el.style.getPropertyValue('transform'),
        priority: el.style.getPropertyPriority('transform'),
      };
      el.style.setProperty('transform', 'translateX(-100000px)', 'important');
    }
    clearTimeout(hideTimer);
    place(a);
    host.style.visibility = 'visible';
    host.style.transition = 'none';
    host.style.opacity = '1';
    a.timer = setInterval(() => {
      if (active === a && performance.now() - (a.lastScroll || a.start) > 60000) finish('timeout');
    }, 1000);
    event('start', { kind: c.kind, top: s.scrollTop });
    update(e);
  }
  addEventListener('pointerdown', down, true);
  addEventListener('mousedown', down, true);
  // Installed at document_start, ahead of ChatGPT's own listeners.
  addEventListener(
    'scroll',
    (e) => {
      if (e === releaseScroll) return;
      const a = active || pendingCommit;
      if (!a && candidate && e.target === candidate.sc) {
        const r = act.scroll({
          t: performance.now(),
          scrollTop: candidate.sc.scrollTop,
          selection: selection(),
          held,
        });
        if (r === 'activate') {
          if (candidate.conv !== conv()) {
            act.cancel();
            candidate = null;
            return;
          }
          seekOutcome({ exercised: true, engaged: false, failed: false });
          if (!candidate.prep) {
            seekFacts.failed = true;
            act.cancel();
            candidate = null;
            return;
          }
          e.stopImmediatePropagation();
          try {
            activate(e);
          } catch {
            seekFacts.failed = true;
            finish('activation-failure', false);
            act.cancel();
            candidate = null;
          }
        } else if (r === 'reject') {
          event('reject', { why: act.detail?.reason });
          if (tap) emit('activation-reject', { reason: act.detail?.reason });
          candidate = null;
        }
        return;
      }
      if (!a || e.target !== a.sc) return;
      if (a.conv !== conv()) {
        finish('chat-switch', false);
        return;
      }
      e.stopImmediatePropagation();
      if (
        pendingCommit === a &&
        !a.release.sample({ top: a.sc.scrollTop, height: a.sc.scrollHeight }).accept
      ) {
        event('geometry-during-release', { top: a.sc.scrollTop });
        return;
      }
      a.lastScroll = performance.now();
      event(active ? 'suppressed' : 'coalesced-after-up', { top: a.sc.scrollTop });
      update(e);
    },
    true,
  );
  const up = (type) => () => {
    held = false;
    const r = act.up();
    if (r === 'reset' && candidate) {
      if (tap) emit('release', { reason: type, commit: false });
      event('candidate-end', { why: 'up' });
      candidate = null;
    }
    if (active && type === 'pointerup') {
      // ChatGPT unpins the chat's end only on a scroll its listener sees before its own pointerup;
      // the drag's were swallowed. Sent before finish, so the release still reads the same top.
      active.sc.dispatchEvent((releaseScroll = new Event('scroll')));
    }
    if (active) finish(type);
  };
  addEventListener('pointerup', up('pointerup'), true);
  addEventListener('mouseup', up('mouseup'), true);
  addEventListener(
    'wheel',
    () => {
      const r = act.wheel();
      if (r === 'reject') {
        event('reject', { why: 'wheel' });
        if (tap) emit('activation-reject', { reason: 'wheel' });
        candidate = null;
      } else if (r === 'end' && active) finish('wheel');
    },
    { capture: true, passive: true },
  );
  addEventListener(
    'keydown',
    () => {
      if (act.key() === 'reject') {
        event('reject', { why: 'key' });
        if (tap) emit('activation-reject', { reason: 'key' });
        candidate = null;
      }
    },
    true,
  );
  addEventListener(
    'mousemove',
    (e) => {
      if (!(e.buttons & 1)) held = false;
      const r = act.move({ buttons: e.buttons });
      if (r === 'end' && active) finish('lost-up');
      else if (r === 'reset') candidate = null;
    },
    true,
  );
  // Endings with no thumb release to coalesce: release and commit at once.
  const endNow = (reason) => {
    held = false;
    act.cancel();
    candidate = null;
    finish(reason);
    pendingCommit?.flush?.();
  };
  addEventListener('pointercancel', () => endNow('pointercancel'), true);
  addEventListener('blur', () => endNow('blur'));
  document.addEventListener('visibilitychange', () => document.hidden && endNow('hidden'));
  addEventListener('popstate', () => finish('navigation', false));
  addEventListener('resize', () => endNow('resize'));
  setInterval(() => {
    const a = active || pendingCommit;
    if (a && (a.conv !== conv() || !a.sc.isConnected)) finish('chat-switch', false);
  }, 100);

  // ---- release ----
  function restoreShift(a) {
    if (a.shift) {
      if (a.shift.value) a.shift.el.style.setProperty('transform', a.shift.value, a.shift.priority);
      else a.shift.el.style.removeProperty('transform');
      a.shift = null;
    }
  }
  // Opacity suppresses every descendant (including outside the preview's insets) without
  // moving the destination out of content-visibility/IntersectionObserver layout bounds.
  function mask(a) {
    const el = a.shift?.el;
    if (el) {
      a.mask = {
        el,
        value: el.style.getPropertyValue('opacity'),
        priority: el.style.getPropertyPriority('opacity'),
      };
      el.style.setProperty('opacity', '0', 'important');
    }
  }
  function restoreMask(a) {
    if (!a?.mask) return;
    const { el, value, priority } = a.mask;
    if (value) el.style.setProperty('opacity', value, priority);
    else el.style.removeProperty('opacity');
    a.mask = null;
  }
  function hide(smooth = false) {
    restoreMask(revealOwner);
    if (host) {
      host.style.transition =
        smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'opacity 120ms ease-out'
          : 'none';
      host.style.opacity = '0';
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(
      () => {
        if (host) host.style.visibility = 'hidden';
        layer?.replaceChildren();
      },
      smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 0,
    );
    railState(null, 'idle');
  }
  // The landing after the commit (find, retargets, reveal): seek/landing-main.js.
  const land = landingOf({
    core,
    layoutCheck,
    event,
    emit,
    hide,
    conv,
    seekOutcome,
    active: () => active,
    revealOwner: () => revealOwner,
    est: () => est,
    tap: () => tap,
  });
  function finish(reason, commit = true) {
    const a = active;
    if (!a) {
      if (pendingCommit && !commit) {
        pendingCommit.canceled = true;
        restoreShift(pendingCommit);
        pendingCommit = null;
        hide();
      }
      return;
    }
    act.cancel();
    const finalTop = a.sc.scrollTop;
    a.release = core.createRelease({
      top: finalTop,
      height: a.sc.scrollHeight,
      maxTop: a.prep.maxTop,
      direction: Math.sign(finalTop - (a.previousTop ?? a.startTop)),
    });
    active = null;
    pendingCommit = commit ? a : null;
    S.active = false;
    clearInterval(a.timer);
    a.end = performance.now();
    a.reason = reason;
    if (commit && finalTop !== a.lastTop) update({ timeStamp: performance.now() }, finalTop);
    event('release', { reason, commit, top: finalTop });
    if (tap) emit('release', { reason, commit, top: finalTop, durationMs: a.end - a.start });
    if (commit) mask(a);
    restoreShift(a);
    if (!commit || !a.sc.isConnected || a.conv !== conv()) {
      pendingCommit = null;
      hide();
      a.canceled = true;
      return;
    }
    railState(a, 'loading');
    // Chromium may deliver the last native scroll after pointerup: coalesce it, then one commit.
    pendingCommit = a;
    let stable = 0,
      priorTop = finalTop;
    const perform = () => {
      if (pendingCommit !== a) return;
      if (a.conv !== conv() || !a.sc.isConnected) {
        pendingCommit = null;
        a.canceled = true;
        hide();
        return;
      }
      let currentTop = a.sc.scrollTop;
      const decision = a.release.sample({ top: currentTop, height: a.sc.scrollHeight });
      if (decision.accept && currentTop !== a.lastTop)
        update({ timeStamp: performance.now() }, currentTop);
      if (!decision.accept && decision.reason === 'application-adjustment') {
        // The application moved outside the frozen gesture. Commit the preserved logical row,
        // using its current estimated/measured top, so readiness does not wait on an unmounted row.
        const fresh = prepare(a.sc, 'release-retarget'),
          row = fresh?.model.find((t) => t.id === a.last.id);
        if (row) {
          const to = Math.max(
            0,
            Math.min(a.sc.scrollHeight - a.sc.clientHeight, row.top + a.last.offset),
          );
          a.commitRetarget = { from: currentTop, to, turn: a.last.index };
          a.sc.scrollTop = to;
          currentTop = a.sc.scrollTop;
        }
      }
      const question = core.previewQuestion(a.prep.model, a.lastTop, a.insetTop);
      a.destination = core.landing(question, a.insetTop, a.sc.scrollHeight - a.sc.clientHeight);
      if (!question.layout) {
        a.sc.scrollTop = a.destination.top;
        currentTop = a.sc.scrollTop;
      }
      // A long hold can retire the fingerprint via RO/font events without changing its value.
      // Refresh before React sees the destination; the native width hook itself stays layout-free.
      if (question.layout) globalThis.__butterLayoutCache?.refreshLayout(a.sc);
      pendingCommit = null;
      a.sc.dispatchEvent(new Event('scroll'));
      a.dispatched = performance.now();
      event('destination-commit', { top: currentTop });
      if (tap)
        emit('commit', {
          turn: question.index,
          top: currentTop,
          layout: question.layout,
          retarget: !!a.commitRetarget,
        });
      requestAnimationFrame(ready);
    };
    a.flush = perform;
    const settle = () => {
      if (pendingCommit !== a) return;
      const t = a.sc.scrollTop;
      stable = Math.abs(t - priorTop) < 1 ? stable + 1 : 0;
      priorTop = t;
      if (stable >= 2 || performance.now() - a.end > 200) perform();
      else requestAnimationFrame(settle);
    };
    const ready = land(a);
    requestAnimationFrame(settle);
  }

  // Opt-in diagnostics' session serializer (clean): seek/seek-diagnostics-main.js.
  const { clean } = diagnosticsOf();
  window.__seekDump = (full) => {
    const ups = S.updates,
      js = ups.map((u) => u.jsMs).sort((x, y) => x - y),
      lat = ups
        .filter((u) => u.latency != null)
        .map((u) => u.latency)
        .sort((x, y) => x - y);
    const q = (xs, p) =>
      xs.length
        ? Math.round(xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] * 10) / 10
        : null;
    const out = {
      v: 2,
      active: S.active,
      pending: !!pendingCommit,
      sessions: S.sessions.map(clean),
      presses: S.presses.slice(-20),
      updateCount: ups.length,
      scriptMsP95: q(js, 0.95),
      scriptMsMax: q(js, 1),
      eventToPaintMsP95: q(lat, 0.95),
      eventToPaintMsMax: q(lat, 1),
      storage: globalThis.__butterLayoutCache?.dump(),
      cache: window.__heightCacheDump?.().stats
        ? (({
            observed,
            records,
            refreshes,
            rejected,
            restored,
            blocksRestored,
            restoreMisses,
            recordMs,
            recordMax,
          }) => ({
            observed,
            records,
            refreshes,
            rejected,
            restored,
            blocksRestored,
            restoreMisses,
            recordMs: Math.round(recordMs),
            recordMax: Math.round(recordMax),
          }))(window.__heightCacheDump().stats)
        : null,
      scroller: (() => {
        const s = [...document.querySelectorAll('.thread-scroll-container')].find(
          (s) => s.clientHeight > 0,
        );
        return s
          ? { clientWidth: s.clientWidth, offsetWidth: s.offsetWidth, scrollHeight: s.scrollHeight }
          : null;
      })(),
    };
    if (full) {
      out.events = S.events.map(({ kind, t, top, why, ms, error, reason }) => ({
        kind,
        t,
        top,
        why,
        ms,
        error,
        reason,
      }));
      out.updates = ups.map(
        ({
          seq,
          t,
          eventTime,
          top,
          turn,
          offset,
          layout,
          known,
          items,
          renderMs,
          jsMs,
          latency,
        }) => ({
          seq,
          t,
          eventTime,
          top,
          turn,
          offset,
          layout,
          known,
          items,
          renderMs,
          jsMs,
          latency,
        }),
      );
    }
    return out;
  };
  // Snapshot only: reading this property does not touch the page/cache or mutate the frozen model.
  Object.defineProperty(window.__seekDump, 'pressDecision', {
    get: () => JSON.parse(JSON.stringify(pressDecision)),
  });
  // Dev build: the recorder's listener, and whether the left button is held (for pointerHeld).
  Object.defineProperty(window.__seekDump, 'tap', {
    set: (listener) => {
      tap = typeof listener === 'function' ? listener : null;
    },
  });
  Object.defineProperty(window.__seekDump, 'held', { get: () => held });
  // Dev build: the conversation the seek code is on, so the recorder can tell a switch apart.
  Object.defineProperty(window.__seekDump, 'conv', { get: () => conv() ?? null });
  window.__seekCoverage = () => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(
      (s) => s.clientHeight > 0,
    );
    const ids = (s && measured(s)?.ids) || [];
    return {
      ids: ids.length,
      ...(globalThis.__butterLayoutCache?.coverage(ids) ?? {
        covered: [],
        missing: ids.map((id) => ({ id, why: 'no-cache-module' })),
      }),
    };
  };
  document.addEventListener('butter-settings', () => {
    if (disabled()) {
      held = false;
      act.cancel();
      candidate = null;
      if (revealOwner) revealOwner.canceled = true;
      finish('disabled', false);
      hide();
    }
  });
})();
