// Isolated world. Bookmarks on the page: the Bookmark cell of the selection pill (selection/pill.js),
// the shortcut, the landing wash, and the page facts and user intent the bookmark session
// (bookmarks/session.js) works from: it owns the store client (bookmarks/client.js), the marks the
// history rail draws (rail/rail.js) and the notification on every save and remove
// (bookmarks/notice.js). The rules live in bookmarks/model.js. Nothing here runs while a scrollbar
// drag is seeking.
(() => {
  const B = ButterBookmarks,
    // Answer roots, message ids, turns and an answer's paragraphs (its top-level blocks, each item
    // of a top-level list on its own, #51): page/reader.js.
    R = ButterPageReader;
  const MEASURE = 1000; // UTF-16 units measured for line ends; the excerpt keeps at most 240 characters
  const HEADER = 52; // ChatGPT's fixed header overlaps the top of the chat's scroller (rail/model.js)
  const strings = (zh) => (zh ? { sel: '为选中内容加书签' } : { sel: 'Bookmark selection' });
  const zh = () => document.documentElement?.getAttribute('data-butter-lang') === 'zh';
  let TXT = strings(zh());
  const railOff = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('rail');
  const convOfPath = () => /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1] ?? null;

  // ---- The session, over the store client, the page reader and the DOM below. Ids are hashed as
  // layouts hash them.
  const sha256 = (s) =>
    crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(s))
      .then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''));
  const session = ButterBookmarkSession({
    store: ButterBookmarkStore.send,
    hash: sha256,
    page: {
      answers: () =>
        R.answersIn(document).map(({ root, id }) => ({
          id,
          paragraphs: () => (root.isConnected ? paragraphs(root) : undefined),
        })),
      answered(ask) {
        const turn = R.turnByKey(ask);
        return !!turn && R.answersIn(turn).length > 0;
      },
      locate,
      wash: washAt,
    },
    off: railOff,
    requestAccount: () => document.dispatchEvent(new CustomEvent('butter-account-request')),
    publish: (conv, marks) => globalThis.ButterRail?.setMarks(conv, marks),
    outcome: (kind, b, undo) => globalThis.ButterBookmarkNotice?.[kind](b, undo),
  });
  // The account hash from history/conversation-main.js.
  document.addEventListener('butter-account', (e) => {
    if (session.setAccount(e.detail)) pill();
  });
  document.dispatchEvent(new CustomEvent('butter-account-request'));

  // Staleness follows the page between renders: a regenerated answer or a switched version shows
  // after a click on the page, and the rail is checked again as the pointer or focus reaches it.
  document.addEventListener('click', () => session.recheck(), { capture: true, passive: true });
  const toRail = (e) => {
    if (e.target?.localName === 'chatgpt-butter-nav' && e.relatedTarget !== e.target)
      session.check();
  };
  document.addEventListener('pointerover', toRail, { capture: true, passive: true });
  document.addEventListener('focusin', toRail, { capture: true });
  document.addEventListener('butter-seek-state', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    const was = session.seeking,
      seeking = m.state === 'dragging' || m.state === 'loading';
    session.seek(seeking); // a read asked for while seeking runs now that it ended
    if (seeking !== was) pill();
    if (seeking) unwash(); // a scrollbar drag puts the wash away as it starts
  });
  // Called by the rail whenever it renders a conversation's questions.
  // `complete`: `items` reach back to the conversation's start (no earlier page left to load).
  // `revision`: the rail's revision of `items`, published back with their marks.
  let inView = null; // the conversation the rail last rendered
  globalThis.ButterBookmarkPage = {
    sync(conv, items, complete = false, revision = null) {
      if (conv !== inView) unwash();
      inView = conv;
      session.view(conv, items, complete, revision);
    },
    // Called by the rail as any jump starts.
    unwash: () => unwash(),
  };

  // ---- Text in a paragraph, as rendered: formulas count once (their visible glyphs, not MathML).
  const textNodes = (block) => {
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT),
      nodes = [];
    let at = 0;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.parentElement?.closest('button,script,style,.katex-mathml')) continue;
      nodes.push({ n, start: at });
      at += n.data.length;
    }
    return nodes;
  };
  const textOf = (block) =>
    textNodes(block)
      .map((x) => x.n.data)
      .join('');
  // A rendered answer's paragraphs, as text.
  const paragraphs = (answer) => R.paragraphsOf(answer).map(textOf);
  // Where the first rendered lines of a run of text end, measured character by character. `parts`
  // are `{ block, from, to }` ranges in paragraph offsets, in order; the run's text joins them with
  // one separator each, as ButterBookmarks.anchor does, and `ends` are offsets into that text.
  const measure = (parts) => {
    const r = document.createRange(),
      ends = [];
    let top = null,
      mid = 0,
      base = 0;
    for (const { block, from, to } of parts) {
      for (const { n, start } of textNodes(block)) {
        if (start + n.data.length <= from) continue;
        for (let i = Math.max(0, from - start); i < n.data.length && start + i < to; i++) {
          if (ends.length >= 3 || base + start + i - from >= MEASURE) return ends;
          if (/\s/.test(n.data[i])) continue;
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const q = r.getClientRects()[0];
          if (!q?.height) continue;
          if (top !== null && q.top > mid) ends.push(base + start + i - from);
          if (top === null || q.top > mid) {
            top = q.top;
            mid = q.top + q.height / 2;
          }
        }
      }
      base += to - from + 1;
    }
    return ends;
  };
  // A range boundary (node, offset) as an offset into the block's rendered text.
  const offsetOf = (block, node, offset) => {
    const nodes = textNodes(block),
      own = nodes.find((x) => x.n === node);
    if (own) return own.start + Math.min(offset, node.data.length);
    const r = document.createRange();
    r.setStart(node, offset);
    let at = 0;
    for (const x of nodes)
      if (r.comparePoint(x.n, 0) < 0) at = x.start + x.n.data.length;
      else break;
    return at;
  };
  // The reader's selection inside one answer, as a bookmark's range: anchored to its first
  // paragraph, ending at that answer's last selected paragraph. `blocks` are the paragraphs it
  // touches. Null when nothing is selected or the selection holds no answer text. With `full` false
  // only whether there is such a range: its first lines aren't measured.
  const selection = (full = true) => {
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    const r = s.getRangeAt(0),
      common = r.commonAncestorContainer,
      el = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
    if (!el) return null;
    const inside = R.paragraphOf(el);
    let blocks = inside ? [inside] : R.paragraphsIn(el).filter((b) => r.intersectsNode(b));
    const home = R.answerOf(blocks[0])?.root;
    blocks = blocks.filter((b) => home && R.answerOf(b)?.root === home);
    if (!blocks.length) return null;
    const siblings = R.paragraphsOf(home),
      first = blocks[0],
      last = blocks.at(-1),
      paras = [];
    for (const b of blocks) paras[siblings.indexOf(b)] = textOf(b);
    const from = siblings.indexOf(first),
      to = siblings.indexOf(last);
    const a = B.anchor(
      paras,
      {
        para: from,
        offset: first.contains(r.startContainer)
          ? offsetOf(first, r.startContainer, r.startOffset)
          : 0,
      },
      {
        para: to,
        offset: last.contains(r.endContainer)
          ? offsetOf(last, r.endContainer, r.endOffset)
          : paras[to].length,
      },
    );
    if (!a) return null;
    if (!full) return { block: siblings[a.para], blocks };
    const parts = [];
    for (let p = a.para; p <= a.last.para; p++)
      parts.push({
        block: siblings[p],
        from: p === a.para ? a.start : 0,
        to: p === a.last.para ? a.last.offset : paras[p].length,
      });
    const ends = measure(parts);
    return {
      block: siblings[a.para],
      blocks,
      start: a.start,
      end: a.end,
      excerpt: B.excerpt(a.text, ends),
      line: B.firstLine(a.text, ends),
    };
  };
  // The chat's scroller: the nearest ancestor of `el` that scrolls.
  const scrollerOf = (el) => {
    let s = el.parentElement;
    while (
      s &&
      !(s.scrollHeight > s.clientHeight && /auto|scroll/.test(getComputedStyle(s).overflowY))
    )
      s = s.parentElement;
    return s;
  };
  // With nothing selected: the first answer paragraph whose top is at or below ChatGPT's header.
  // Turns off screen skip layout (stream/containment.css), so their blocks' boxes are stale: only
  // the turns showing below the header are read, and only their answers' blocks measured.
  const topBlock = () => {
    const turns = R.turns(),
      boxes = turns.map((t) => t.getBoundingClientRect()),
      seen = boxes.findIndex((b) => b.height && b.bottom > HEADER);
    if (seen < 0) return null;
    const box = scrollerOf(turns[seen])?.getBoundingClientRect(),
      line = Math.max(0, box?.top ?? 0) + HEADER,
      bottom = box?.bottom ?? innerHeight;
    const blocks = turns
      .filter((t, i) => boxes[i].height && boxes[i].bottom > line && boxes[i].top < bottom)
      .flatMap((t) => R.answersIn(t).flatMap((a) => R.paragraphsOf(a.root)));
    const tops = blocks.map((b) => b.getBoundingClientRect().top);
    return blocks[B.topParagraph(tops, line)] ?? null;
  };
  // A bookmark's paragraph in its question's turn, given its answer's raw id (the session keeps
  // them); null when it is stale now: its answer, paragraph or text no longer there.
  const blockIn = (turn, raw, b) => {
    const answer = raw && R.answersIn(turn).find((a) => a.id === raw)?.root,
      block = answer && R.paragraphsOf(answer)[b.para];
    return block && B.matches(b, paragraphs(answer)) ? block : null;
  };
  // Where a bookmark's text is, in px below the top of its question's turn; null (the rail lands at
  // the question's start) when it is stale now.
  function locate(turn, raw, b) {
    const block = blockIn(turn, raw, b);
    if (!block) return null;
    let top = block.getBoundingClientRect().top;
    if (b.start > 0) {
      const at = textNodes(block).findLast((x) => x.start <= b.start);
      if (at && b.start - at.start < at.n.data.length) {
        const r = document.createRange();
        r.setStart(at.n, b.start - at.start);
        r.setEnd(at.n, b.start - at.start + 1);
        top = r.getClientRects()[0]?.top ?? top;
      }
    }
    return top - turn.getBoundingClientRect().top;
  }

  // Bookmark a paragraph: the whole of it, or `range` (`{ start, end, excerpt, line }`) within it.
  // Every save, by the Bookmark cell or the shortcut, comes through here; the session stores it and
  // shows the notification.
  function create(block, range = null) {
    const answer = R.answerOf(block),
      id = answer?.id,
      ask = R.turnKeyOf(block), // the question's message id
      conv = convOfPath();
    if (!id || !ask || !conv || !session.signedIn) return;
    const text = textOf(block),
      ends = range ? null : measure([{ block, from: 0, to: text.length }]);
    session.create({
      id,
      ask,
      conv,
      para: R.paragraphsOf(answer.root).indexOf(block),
      start: range ? range.start : 0,
      end: range ? range.end : text.length,
      excerpt: range ? range.excerpt : B.excerpt(text, ends),
      line: range ? range.line : B.firstLine(text, ends),
    });
  }
  // ---- The Bookmark cell of the selection pill (selection/pill.js), beside Ask in branch: shown
  // for a selection the shortcut would bookmark (inside one answer) while the rail is on, Butter
  // enabled, the reader isn't seeking and the tab shows a conversation. It saves that range,
  // clears the selection and the pill. Its label shows the key Chrome reports for the command.
  const ICON =
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const isDark = () =>
    document.documentElement.classList.contains('dark') ||
    /dark/.test(getComputedStyle(document.documentElement).colorScheme);
  let shortcut = null, // the key Chrome reports for the command; null until read
    reading = false;
  // Read again each time the cell shows: the reader may have changed it in Chrome's settings.
  const readKey = async () => {
    if (reading) return;
    reading = true;
    let next = '';
    try {
      const r = await chrome.runtime.sendMessage({ version: 1, type: 'butter-bookmark-key' });
      next = typeof r?.shortcut === 'string' ? r.shortcut : '';
    } catch {}
    reading = false;
    if (next === shortcut) return;
    shortcut = next;
    pill();
  };
  function pill() {
    globalThis.ButterPill?.update();
  }
  ButterPill.register({
    id: 'bookmark',
    feature: 'rail',
    icon: ICON,
    label: () => TXT.sel,
    keys: () => B.keyHint(shortcut ?? ''),
    shortcut: () => B.ariaKeys(shortcut ?? ''),
    wants() {
      if (!session.signedIn || session.seeking || !convOfPath() || !selection(false)) return false;
      readKey();
      return true;
    },
    activate() {
      const range = railOff() ? null : selection();
      if (range) create(range.block, range);
      getSelection()?.removeAllRanges();
      ButterPill.hide();
    },
  });
  document.addEventListener('butter-settings', () => {
    TXT = strings(zh());
    if (railOff()) unwash();
    session.refresh(); // reads the conversation once the rail is on, or clears its marks when it goes off
  });

  // ---- The landing wash (#73). When a bookmark trip from a card row lands on live text, the rail
  // calls its `wash`: the bookmark's range is washed in butter, line by line in reading order, held
  // and faded (bookmarks/wash.js has the plan). The boxes are in Butter's own fixed layer, so nothing
  // goes into ChatGPT's answer. They are measured from the range's text, clipped to the scroller between ChatGPT's header and composer, and measured again on the
  // scroller's scroll and resize, listened to only while the wash shows. Light theme multiplies the
  // butter into the page and dark theme lightens it, so the text keeps its own colour in both. As
  // one highlight broken across lines, the range's start and end are rounded, the line ends between
  // them are not (the mockup's section 5). A code block or a table (#74) gets one box over the
  // whole block instead, 3 px beyond it with the block's own corners, fading in instead of sweeping.
  const W = ButterWash;
  const COMPOSER = '#thread-bottom-container, form:has(.ProseMirror[contenteditable="true"])';
  const WASH_CSS = `
    :host { all: initial; position: fixed; inset: 0; z-index: 19; display: block; pointer-events: none; mix-blend-mode: multiply; }
    :host([data-dark]) { mix-blend-mode: lighten; }
    div { position: fixed; overflow: hidden; }
    i { --w: rgb(251 224 122 / .62); position: absolute; background: var(--w); }
    i:first-child { border-start-start-radius: 3px; border-end-start-radius: 3px; }
    i:last-child { border-start-end-radius: 3px; border-end-end-radius: 3px; }
    :host([data-dark]) i { --w: rgb(227 199 102 / .3); }
    i.block { box-sizing: border-box; border: 3px solid var(--w); background-clip: content-box; }`;
  // The rectangles of a bookmark's text in its paragraph: its text runs only, so an element in the
  // range (a link, bold text) adds no box of its own.
  const rectsOf = (block, b) => {
    const r = document.createRange(),
      out = [];
    for (const { n, start } of textNodes(block)) {
      const from = Math.max(b.start, start),
        to = Math.min(b.end, start + n.data.length);
      if (from >= to) continue;
      r.setStart(n, from - start);
      r.setEnd(n, to - start);
      out.push(...r.getClientRects());
    }
    return out;
  };
  // The bottom of ChatGPT's header over the scroller's top edge: the fixed or sticky box drawn
  // there. Some chats' scrollers start below the header (a project's chats, checked on
  // 2026-11-10): their content shows from the scroller's own top. Found nothing to go by, the
  // header is taken to overlap the scroller, as the rail does (rail/model.js, rail/turns.js band).
  const headerBottom = (sc, r) => {
    const top = Math.max(0, r.top);
    for (
      let h = document.elementFromPoint(r.left + sc.clientWidth / 2, top + 1);
      h && h !== document.body;
      h = h.parentElement
    ) {
      if (h === sc) return top;
      if (/fixed|sticky/.test(getComputedStyle(h).position))
        return Math.max(top, h.getBoundingClientRect().bottom);
    }
    return top + HEADER;
  };
  // The part of the scroller the wash may paint: under the header, above the composer.
  const clipOf = (sc) => {
    const r = sc.getBoundingClientRect(),
      top = headerBottom(sc, r),
      c = document.querySelector(COMPOSER)?.getBoundingClientRect();
    let bottom = Math.min(r.bottom, innerHeight);
    if (c?.height && c.top > top && c.top < bottom) bottom = c.top;
    return { left: r.left, top, width: sc.clientWidth, height: Math.max(0, bottom - top) };
  };
  let wash = null; // the wash showing: its layer, scroller and listener
  // Removes the wash at once: a new jump, a conversation change, a scrollbar drag, the rail off.
  function unwash() {
    const w = wash;
    if (!w) return;
    wash = null;
    w.sc.removeEventListener('scroll', w.draw);
    removeEventListener('resize', w.draw);
    w.ro?.disconnect();
    w.host.remove();
  }
  // A code block's or a table's drawn box (#74): ChatGPT's code widget surface, a <pre> (or the
  // rounded panel inside it), or a <table>. A paragraph is such a block when all its text is in
  // that box; a paragraph that holds one among its own text (a list item with code) gets the text
  // wash. Null for any other paragraph.
  const SURFACE = '[data-code-block], pre, table';
  const surfaceOf = (block) => {
    let el = block.matches(SURFACE) ? block : block.querySelector(SURFACE);
    if (!el || textOf(el).trim().length < textOf(block).trim().length) return null;
    // ChatGPT's <pre> holds the rounded panel it draws, as its only child, down a wrapper or two.
    if (el.matches('pre'))
      for (let k = el; k; k = k.children.length === 1 ? k.firstElementChild : null)
        if (parseFloat(getComputedStyle(k).borderTopLeftRadius)) {
          el = k;
          break;
        }
    return el;
  };
  // A block's box as it shows: its rectangle cut to any box that scrolls it sideways inside the
  // paragraph (a wide table's viewport), grown 3 px with the block's corners (bookmarks/wash.js).
  const blockLine = (block, el) => {
    const r = el.getBoundingClientRect();
    let { left, right } = r;
    for (let k = el.parentElement; k && block.contains(k); k = k.parentElement)
      if (getComputedStyle(k).overflowX !== 'visible') {
        const v = k.getBoundingClientRect();
        left = Math.max(left, v.left);
        right = Math.min(right, v.right);
      }
    if (!(right > left && r.bottom > r.top)) return [];
    const q = { left, right, top: r.top, bottom: r.bottom },
      cs = getComputedStyle(el),
      border = ['Top', 'Right', 'Bottom', 'Left'].map(
        (k) => parseFloat(cs[`border${k}Width`]) || 0,
      );
    return [W.blockBox(q, parseFloat(cs.borderTopLeftRadius) || 0, border)];
  };
  // Washes bookmark `b` (its answer's raw id `raw`) in its question's `turn`, or with `draw` false
  // only says whether it would. False when it can't: stale, or nothing to show.
  function washAt(turn, raw, b, draw = true) {
    const block = blockIn(turn, raw, b),
      sc = block && scrollerOf(block);
    if (!sc || railOff() || session.seeking) return false;
    if (!draw) return true;
    unwash();
    const host = document.createElement('chatgpt-butter-wash'),
      root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${WASH_CSS}</style><div></div>`;
    host.toggleAttribute('data-dark', isDark());
    const clip = root.querySelector('div'),
      rtl = getComputedStyle(block).direction === 'rtl',
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
      // The sweep runs from each line's start: its right end in right-to-left text.
      [hidden, shown] = rtl
        ? ['inset(0 0 0 100%)', 'inset(0 0 0 0%)']
        : ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
      start = document.timeline.currentTime,
      // Every part of the wash keeps the time it started, also when its lines are drawn again.
      play = (el, frames, timing) => {
        const a = el.animate(frames, timing);
        a.startTime = start;
        return a;
      };
    clip.dir = rtl ? 'rtl' : 'ltr'; // the rounded start and end follow the text's direction
    const surface = surfaceOf(block);
    const w = { host, sc, conv: convOfPath(), boxes: [], plan: null, ro: null };
    w.draw = () => {
      if (wash !== w) return;
      const lines =
        block.isConnected && convOfPath() === w.conv
          ? surface
            ? blockLine(block, surface)
            : W.boxes(rectsOf(block, b))
          : [];
      if (!lines.length) return unwash(); // its text left the page
      const c = clipOf(sc);
      Object.assign(clip.style, {
        left: `${c.left}px`,
        top: `${c.top}px`,
        width: `${c.width}px`,
        height: `${c.height}px`,
      });
      // A change of width can rewrap the text: the lines are laid out again, in step with the sweep.
      if (lines.length !== w.boxes.length) {
        w.plan = W.plan(
          lines.map((l) => l.width),
          { reduced, block: !!surface },
        );
        w.boxes = w.plan.sweep.map(({ from, to }) => {
          const el = document.createElement('i');
          el.classList.toggle('block', !!surface);
          if (w.plan.fadeIn)
            play(el, [{ opacity: 0 }, { opacity: 1 }], {
              duration: w.plan.in,
              easing: w.plan.easing,
            });
          else if (!reduced)
            play(
              el,
              [
                { clipPath: hidden, offset: 0 },
                { clipPath: hidden, offset: from },
                { clipPath: shown, offset: to },
                { clipPath: shown, offset: 1 },
              ],
              { duration: w.plan.in, easing: w.plan.easing },
            );
          return el;
        });
        clip.replaceChildren(...w.boxes);
      }
      lines.forEach((l, k) =>
        Object.assign(w.boxes[k].style, {
          left: `${l.left - c.left}px`,
          top: `${l.top - c.top}px`,
          width: `${l.width}px`,
          height: `${l.height}px`,
          borderRadius: l.radius === undefined ? '' : `${l.radius}px`,
          // A block's own border shows between the ring outside it and the fill inside it.
          padding: l.gap ? l.gap.map((g) => `${g}px`).join(' ') : '',
        }),
      );
    };
    wash = w;
    document.body.append(host);
    w.draw();
    if (wash !== w) return false;
    const p = w.plan;
    play(clip, [{ opacity: 1 }, { opacity: 0 }], {
      delay: p.in + p.hold,
      duration: p.fade,
      easing: p.fadeEasing,
      fill: 'forwards',
    }).finished.then(
      () => wash === w && unwash(),
      () => {},
    );
    sc.addEventListener('scroll', w.draw, { passive: true });
    addEventListener('resize', w.draw, { passive: true });
    w.ro = new ResizeObserver(w.draw);
    w.ro.observe(sc);
    w.ro.observe(block);
    return true;
  }

  // ---- The bookmark shortcut (a Chrome command; bookmarks/worker.js relays it to this tab). It
  // bookmarks the selection inside one answer, or with nothing selected the paragraph at the top.
  // A selection outside the answers creates nothing.
  chrome.runtime.onMessage.addListener((m) => {
    if (m?.type !== 'butter-bookmark-shortcut' || m.version !== 1) return;
    if (railOff() || !session.signedIn || session.seeking || !convOfPath()) return;
    const s = getSelection();
    if (s && !s.isCollapsed) {
      const range = selection();
      if (range) create(range.block, range);
      return;
    }
    const block = topBlock();
    if (block) create(block);
  });
})();
