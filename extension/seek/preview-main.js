// MAIN world: native-thumb scroll suppression, lean preview and one destination commit.
(() => {
  const core = globalThis.__butterSeekCore,
    layoutCheck = globalThis.__butterLayoutCheck;
  if (!core) return;
  const S = { v: 2, events: [], updates: [], sessions: [], presses: [], active: false };
  const conversations = new Map();
  let host,
    layer,
    est,
    fade,
    active = null,
    pendingCommit = null,
    held = false,
    lastPointerDown = -1e9;
  const act = core.createActivation();
  let revealOwner = null,
    hideTimer;
  let candidate = null; // {sc, model, flat, ...} prepared at press time
  const conv = () => location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1];
  const event = (kind, more = {}) => {
    S.events.push({ kind, t: performance.now(), ...more });
    if (S.events.length > 2000) S.events.splice(0, 500);
  };
  const disabled = () => document.documentElement?.hasAttribute('data-butter-disabled');
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

  // ---- conversation markdown (estimate fallback for turns without a layout record) ----
  document.addEventListener('butter-seek-data', (e) => {
    const { conv: c, before, j } = e.detail;
    let msgs = j.messages;
    if (!msgs && j.mapping) {
      msgs = [];
      for (let n = j.mapping[j.current_node]; n; n = j.mapping[n.parent])
        if (n.message) msgs.push(n.message);
      msgs.reverse();
    }
    if (!Array.isArray(msgs)) return;
    msgs = msgs.map((m) => ({
      id: m.id,
      role: m.author?.role,
      channel: m.channel,
      recipient: m.recipient,
      hidden: m.metadata?.is_visually_hidden_from_conversation,
      text: (m.content?.parts || []).filter((x) => typeof x === 'string').join('\n'),
    }));
    let old = conversations.get(c) || { messages: [], hasPrev: false };
    if (before) {
      const have = new Set(old.messages.map((m) => m.id));
      msgs = msgs.filter((m) => !have.has(m.id)).concat(old.messages);
    }
    conversations.set(c, { messages: msgs, hasPrev: !!j.page_info?.has_previous_page });
    const source = texts(c).byId;
    queueMicrotask(() => globalThis.__butterLayoutCache?.setTexts(c, source));
    while (conversations.size > 2) conversations.delete(conversations.keys().next().value);
    if (active?.conv === c) {
      event('data-during-hold', { before });
      finish('data-invalidation', false);
    } else if (pendingCommit?.conv === c) {
      pendingCommit.release.invalidate('history-data');
      event('data-during-release');
    }
  });
  document.addEventListener('butter-nav', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (m.type !== 'send') return;
    if (active || pendingCommit) finish('send-invalidation', false);
    const data = conversations.get(m.conv || conv());
    if (!data) return;
    const parent = data.messages.findIndex((x) => x.id === m.parent);
    if (parent >= 0) data.messages = data.messages.slice(0, parent + 1);
    data.messages.push({ id: m.item.id, role: 'user', text: m.item.q || '' });
  });
  document.addEventListener('butter-layout-account-ready', () => {
    const c = conv();
    if (conversations.has(c))
      queueMicrotask(() => globalThis.__butterLayoutCache?.setTexts(c, texts(c).byId));
  });
  document.addEventListener('butter-layout-account-change', () => {
    conversations.clear();
    if (active || pendingCommit) finish('account-invalidation', false);
  });
  document.addEventListener('butter-seek-write', (e) => {
    conversations.delete(e.detail.conv || conv());
    if (active || pendingCommit) finish('mutation-invalidation', false);
  });
  const texts = (c = conv()) => {
    const data = conversations.get(c),
      out = {};
    let current;
    for (const m of data?.messages || []) {
      if (m.hidden) continue;
      if (m.role === 'user') {
        current = { q: m.text, answer: '', msg: '', ids: [] };
        out[m.id] = current;
      } else if (
        current &&
        m.role === 'assistant' &&
        (!m.channel || m.channel === 'final') &&
        (!m.recipient || m.recipient === 'all')
      ) {
        current.answer += m.text + '\n';
        current.msg = m.id;
        current.ids.push(m.id);
      }
    }
    return { byId: out, hasPrev: !!data?.hasPrev };
  };
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
  function prepare(s) {
    const t0 = performance.now(),
      tx = texts(),
      fib = measured(s),
      cache = globalThis.__butterLayoutCache;
    const ids = fib?.ids || Object.keys(tx.byId);
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
    const { records, storedTurns } = cache?.prepare(s, ids) || { records: {}, storedTurns: 0 };
    const model = core.buildModel({
      ids,
      measured: fib?.heights || {},
      records,
      texts: tx.byId,
      scrollHeight: s.scrollHeight,
      gap,
      anchor,
      sw: s.clientWidth,
    });
    const previewModel = core.buildPreviewModel(model, records, gap);
    const flat = core.flatten(previewModel);
    const column = Object.values(records)
      .flatMap((r) => r.items)
      .find((it) => !it.user);
    const colLeft = column?.left ?? Math.max(24, (s.clientWidth - 768) / 2);
    const colWidth = column?.w ?? Math.max(0, Math.min(768, s.clientWidth - 2 * colLeft));
    return {
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
:host{all:initial;--math-bg:rgb(0 0 0 / .04);--math-fg:#5d5d5d}
:host([data-dark]){--math-bg:rgb(255 255 255 / .06);--math-fg:#a3a3a3}
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
</style><div class="layer"></div><div class="est" hidden></div><div class="fade" hidden></div>`;
    layer = shadow.querySelector('.layer');
    est = shadow.querySelector('.est');
    fade = shadow.querySelector('.fade');
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
    a.hostRect = {
      x: sr.left + s.clientLeft,
      y: sr.top + a.insetTop,
      width: s.clientWidth,
      height: Math.max(0, s.clientHeight - a.insetTop - a.insetBottom),
    };
    a.dark =
      document.documentElement.classList.contains('dark') ||
      /dark/.test(getComputedStyle(document.documentElement).colorScheme);
    host.toggleAttribute('data-dark', a.dark);
    const md = s.querySelector('[data-markdown-text-style="assistant-message"]');
    const fg = md ? getComputedStyle(md).color : getComputedStyle(document.body).color,
      bg = opaque(s);
    host.style.cssText += `;left:${a.hostRect.x}px;top:${a.hostRect.y}px;width:${a.hostRect.width}px;height:${a.hostRect.height}px;background:${bg};color:${fg}`;
    est.style.cssText = `left:${a.prep.colLeft}px;width:${Math.min(a.prep.colWidth, a.hostRect.width - a.prep.colLeft)}px;font:16px/26px ${md ? getComputedStyle(md).fontFamily : 'system-ui,sans-serif'};color:${fg}`;
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
        span.style.height = `${m.h}px`;
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
          estimatedContent(
            paragraph,
            block.replace(/^#{1,6}\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1'),
          );
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
        el.style.cssText = `${it.css};top:${f.abs}px;left:${it.left}px;width:${it.w}px;height:${it.h}px`;
        if (it.user) {
          el.style.background = 'var(--bubble)';
          el.style.borderRadius = '18px';
        }
        const math = it.math?.length === 1 && it.math[0].display ? it.math[0] : null;
        if (math && it.text.trim() === it.text.slice(math.start, math.end).trim()) {
          el.className = 'it math display';
          el.style.cssText +=
            ';font:12px/1.5 ui-monospace,"SF Mono",Menlo,monospace;padding:0 12px;border-radius:8px;background:var(--math-bg);color:var(--math-fg)';
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
    return performance.now() - t0;
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
      act.cancel();
      candidate = null;
      return;
    }
    const prep = prepare(s);
    if (!prep) {
      act.cancel();
      candidate = null;
      event('no-model');
      return;
    }
    candidate = {
      t: performance.now(),
      sc: s,
      prep,
      kind: c.kind,
      startTop: s.scrollTop,
      conv: conv(),
    };
    act.press({ t: candidate.t, kind: c.kind, scrollTop: s.scrollTop, selection: selection() });
    event('candidate', { kind: c.kind, prepMs: prep.prepMs, layoutTurns: prep.layoutTurns });
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
          e.stopImmediatePropagation();
          activate(e);
        } else if (r === 'reject') {
          event('reject', { why: act.detail?.reason });
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
      event('candidate-end', { why: 'up' });
      candidate = null;
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
  addEventListener(
    'pointercancel',
    () => {
      held = false;
      act.cancel();
      candidate = null;
      finish('pointercancel');
      pendingCommit?.flush?.();
    },
    true,
  );
  addEventListener('blur', () => {
    held = false;
    act.cancel();
    candidate = null;
    finish('blur');
    pendingCommit?.flush?.();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      held = false;
      act.cancel();
      candidate = null;
      finish('hidden');
      pendingCommit?.flush?.();
    }
  });
  addEventListener('popstate', () => finish('navigation', false));
  addEventListener('resize', () => {
    held = false;
    act.cancel();
    candidate = null;
    finish('resize');
    pendingCommit?.flush?.();
  });
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
        const fresh = prepare(a.sc),
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
      pendingCommit = null;
      a.sc.dispatchEvent(new Event('scroll'));
      a.dispatched = performance.now();
      event('destination-commit', { top: currentTop });
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
    let prev = 0,
      quiet = 0,
      lastTop = NaN;
    a.retargets = [];
    const rowTop = (el) =>
      el.parentElement.getBoundingClientRect().top -
      a.sc.getBoundingClientRect().top +
      a.sc.scrollTop;
    const ready = () => {
      if (revealOwner !== a || a.canceled) return;
      if (active || a.conv !== conv() || !a.sc.isConnected) {
        if (!active) hide();
        return;
      }
      const now = performance.now(),
        d = a.destination,
        el = d && a.sc.querySelector(`[data-turn-key="${CSS.escape(d.id)}"]`);
      const pendingMath =
        el &&
        [...el.querySelectorAll('[data-math-source]')].some((n) => !n.querySelector('.katex'));
      if (el && !pendingMath && d.layout && !a.semantic) {
        // Aligned rows do not prove aligned text (fallback excerpts, transformed text): always check the anchor.
        const candidates =
          !est.hidden && a.estTurn === d.id
            ? [est]
            : [...a.rendered]
                .filter(([i]) => a.prep.model[a.prep.flat[i].turn].id === d.id)
                .map(([, el]) => el);
        let visible;
        for (const el of candidates) {
          visible = globalThis.__butterAnchorVisibleNeedles?.(el, a.hostRect, 1)?.[0];
          if (visible) break;
        }
        a.semantic = {
          needle: visible?.needle || null,
          previewY: visible?.y ?? a.hostRect.y,
          anchorVisible: !!visible,
          attempts: 0,
          passes: 0,
          matched: false,
        };
      }
      if (el && !pendingMath && a.semantic && !a.semantic.done) {
        const sem = a.semantic;
        sem.passes++;
        const ys = sem.needle ? textRect(el, sem.needle) : [],
          y = ys.length
            ? ys.reduce((x, y) => (Math.abs(x - sem.previewY) < Math.abs(y - sem.previewY) ? x : y))
            : null;
        if (y != null) {
          sem.matched = true;
          sem.lastError = y - sem.previewY;
          const r = layoutCheck.semanticTarget({
            scrollTop: a.sc.scrollTop,
            realY: y,
            previewY: sem.previewY,
            maxScroll: a.sc.scrollHeight - a.sc.clientHeight,
          });
          if (r && sem.attempts < 3) {
            sem.attempts++;
            sem.clamped = r.clamped;
            a.sc.scrollTop = r.to;
            quiet = 0;
            prev = 0;
            event('semantic-retarget', { to: r.to, error: r.delta });
            requestAnimationFrame(ready);
            return;
          }
        } else {
          // Math-only/unmatched previews retain the selected question identity.
          const q =
            el.querySelector('[data-user-message-bubble]') ||
            el.querySelector('[data-message-author-role="user"]');
          if (q) {
            const y = q.getBoundingClientRect().top;
            sem.matched = false;
            sem.fallback = true;
            sem.lastError = y - a.hostRect.y;
            const r = layoutCheck.semanticTarget({
              scrollTop: a.sc.scrollTop,
              realY: y,
              previewY: a.hostRect.y,
              maxScroll: a.sc.scrollHeight - a.sc.clientHeight,
            });
            if (r && sem.attempts < 3) {
              sem.attempts++;
              sem.clamped = r.clamped;
              a.sc.scrollTop = r.to;
              quiet = 0;
              prev = 0;
              event('semantic-question-fallback', { to: r.to });
              requestAnimationFrame(ready);
              return;
            }
          }
        }
        sem.done = sem.matched || sem.fallback || sem.passes >= 4;
      }
      if (el && !pendingMath && !a.semantic && a.retargets.length < 2 && !a.alignmentCorrection) {
        const s = a.sc;
        const bubble = !d.layout && el.querySelector('[data-user-message-bubble]');
        const actual = bubble
          ? bubble.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop
          : rowTop(el);
        const r = core.retarget({
          known: true,
          frozenTurnTop: d.turnTop,
          actualTurnTop: actual,
          offset: d.offset,
          height: d.height,
          scrollTop: s.scrollTop,
          maxScroll: s.scrollHeight - s.clientHeight,
        });
        if (r) {
          a.retargets.push({
            t: now - a.end,
            drift: Math.round(r.drift),
            from: Math.round(s.scrollTop),
            to: Math.round(r.to),
          });
          s.scrollTop = r.to;
          event('retarget', a.retargets.at(-1));
          quiet = 0;
          prev = 0;
          requestAnimationFrame(ready);
          return;
        }
      }
      const top = a.sc.scrollTop;
      if (prev && now - prev < 50 && Math.abs(top - lastTop) < 2 && el && !pendingMath) quiet++;
      else quiet = 0;
      prev = now;
      lastTop = top;
      if (quiet >= 3 || now - a.end > 10000) {
        // Prepending history may remove/change the old first turn's date/prefix without changing
        // the answer blocks. For a measured destination, preserve their shared visible position.
        // This branch is deliberately limited to sessions that began with unloaded history.
        if (quiet >= 3 && !a.semantic && a.hasPrev && d.layout && !a.alignmentCorrection) {
          measureSwap(a);
          const audit = a.swap,
            error = audit.itemErrSignedMedian;
          if (audit.items >= 2 && audit.itemErrSpread <= 2 && Math.abs(error) > 4) {
            const from = a.sc.scrollTop,
              to = Math.max(0, Math.min(a.sc.scrollHeight - a.sc.clientHeight, from - error));
            a.alignmentCorrection = { from, to, error, clamped: Math.abs(from - to - error) > 2 };
            a.sc.scrollTop = to;
            quiet = 0;
            prev = 0;
            lastTop = NaN;
            event('history-block-alignment', a.alignmentCorrection);
            requestAnimationFrame(ready);
            return;
          }
        }
        a.readable = now;
        a.timedOut = quiet < 3;
        a.realTop = top;
        hide(true);
        if (el) {
          const bubble = !d.layout && el.querySelector('[data-user-message-bubble]');
          const actual = bubble
            ? bubble.getBoundingClientRect().top - a.sc.getBoundingClientRect().top + a.sc.scrollTop
            : rowTop(el);
          a.actualTurnTop = actual;
          a.pixelModelErrorPx = actual + d.offset - top;
          a.landingErrorPx =
            a.semantic && (a.semantic.matched || a.semantic.fallback)
              ? a.semantic.lastError
              : a.pixelModelErrorPx;
          a.turnTopErrorPx = actual - d.turnTop;
        }
        try {
          measureSwap(a);
        } catch (err) {
          a.swapError = String(err);
        }
        event('reveal', { ms: now - a.end, error: a.landingErrorPx, timedOut: a.timedOut });
      } else requestAnimationFrame(ready);
    };
    requestAnimationFrame(settle);
  }

  // ---- swap alignment audit: where the preview showed text vs where the real text is ----
  const ITEMS = '[data-user-message-bubble], [data-markdown-text-style="assistant-message"] > *';
  const ANCHOR = /[\p{Script=Han}]{8,}|[A-Za-z][A-Za-z ,]{24,}/u;
  const textRect = (root, needle) =>
    (globalThis.__butterAnchorTextBoxes?.(root, needle) || []).map((r) => r.top);
  function measureSwap(a) {
    if (globalThis.__butterAnchorVisibleSwap) {
      a.swap = globalThis.__butterAnchorVisibleSwap(a);
      return;
    }
    const s = a.sc,
      sr = s.getBoundingClientRect(),
      top = a.lastTop,
      H = a.hostRect;
    const items = [],
      anchors = [];
    // Block level: each rendered preview item vs the same-index real item of the same turn.
    const realItems = new Map();
    for (const [i, el] of a.rendered) {
      const f = a.prep.flat[i],
        t = a.prep.model[f.turn];
      const py = sr.top + f.abs - top;
      if (py < H.y || py > H.y + H.height - 20) continue;
      if (!realItems.has(t.id)) {
        const te = s.querySelector(`[data-turn-key="${CSS.escape(t.id)}"]`);
        realItems.set(t.id, te ? [...te.querySelectorAll(ITEMS)] : null);
      }
      const real = realItems.get(t.id)?.[f.index];
      if (!real) continue;
      const rr = real.getBoundingClientRect();
      items.push({ err: Math.round(py - rr.top), hMatch: Math.abs(rr.height - f.h) <= 2 });
      // Text level: a plain-text run inside this item, located in both trees.
      if (anchors.length < 3) {
        const m = el.textContent.match(ANCHOR);
        if (!m) continue;
        const needle = m[0].slice(0, 16),
          pr = textRect(el, needle)[0];
        if (pr == null || pr < H.y || pr > H.y + H.height - 20) continue;
        const rs = textRect(real, needle);
        if (!rs.length) continue;
        const best = rs.reduce((x, y) => (Math.abs(y - pr) < Math.abs(x - pr) ? y : x));
        anchors.push({ err: Math.round(pr - best), mode: 'layout' });
      }
    }
    // Estimated-turn text: audit the answer beginning against the mounted destination.
    if (!est.hidden && a.estTurn) {
      const m = est.textContent.match(ANCHOR),
        te = s.querySelector(`[data-turn-key="${CSS.escape(a.estTurn)}"]`);
      if (m && te) {
        const needle = m[0].slice(0, 16),
          pr = textRect(est, needle)[0],
          rs = textRect(te, needle);
        if (pr != null && rs.length)
          anchors.push({
            err: Math.round(
              pr - rs.reduce((x, y) => (Math.abs(y - pr) < Math.abs(x - pr) ? y : x)),
            ),
            mode: 'estimate',
          });
      }
    }
    const abs = items.map((x) => Math.abs(x.err)).sort((x, y) => x - y),
      signed = items.map((x) => x.err).sort((x, y) => x - y);
    a.swap = {
      items: items.length,
      itemErrSignedMedian: signed[signed.length >> 1] ?? null,
      itemErrSpread: signed.length ? signed.at(-1) - signed[0] : null,
      itemErrMedian: abs[abs.length >> 1] ?? null,
      itemErrMax: abs.at(-1) ?? null,
      hMatch: items.filter((x) => x.hMatch).length,
      anchors,
    };
  }

  // Opt-in diagnostics return timing, counts and geometry only; never chat text.
  const clean = (a) =>
    a && {
      kind: a.kind,
      reason: a.reason,
      canceled: !!a.canceled,
      start: a.start,
      pressAt: a.pressAt,
      end: a.end,
      dispatched: a.dispatched,
      readable: a.readable,
      timedOut: a.timedOut,
      pressToActivateMs: a.start - a.pressAt,
      releaseToCommitMs: a.dispatched ? a.dispatched - a.end : null,
      releaseToReadableMs: a.readable ? a.readable - a.end : null,
      semantic:
        a.semantic &&
        (({ attempts, matched, fallback, clamped, lastError, anchorVisible, previewY }) => ({
          attempts,
          matched,
          fallback,
          clamped,
          lastError,
          anchorVisible,
          previewY,
        }))(a.semantic),
      textFallback: a.textFallback,
      startTop: a.startTop,
      realTop: a.realTop,
      landingErrorPx: a.landingErrorPx,
      turnTopErrorPx: a.turnTopErrorPx,
      retargets: a.retargets,
      coalescing: a.release?.dump(),
      commitRetarget: a.commitRetarget,
      alignmentCorrection: a.alignmentCorrection,
      swap: a.swap,
      swapError: a.swapError,
      destination: a.destination && {
        turn: a.destination.index,
        offset: Math.round(a.destination.offset),
        known: a.destination.known,
        stored: a.prep.model[a.destination.index]?.stored,
        layout: a.destination.layout,
      },
      model: {
        stored: a.prep.storedTurns,
        turns: a.prep.model.length,
        known: a.prep.knownTurns,
        layout: a.prep.layoutTurns,
        items: a.prep.flat.length,
        prepMs: a.prep.prepMs,
        gap: a.prep.gap,
      },
      insetTop: a.insetTop,
      insetBottom: a.insetBottom,
      hostRect: a.hostRect,
    };
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
      out.events = S.events.map(({ kind, t, top, why, ms, error, reason, kind2 }) => ({
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
