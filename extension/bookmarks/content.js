// Isolated world. Bookmarks on the page: the hover button over answer paragraphs, the client of the
// worker's store (bookmarks/worker.js), and the marks the history rail draws (rail/rail.js). The
// rules live in bookmarks/model.js. A conversation's bookmarks are read once when the rail shows it
// and written on create and delete; nothing here runs while a scrollbar drag is seeking.
(() => {
  const B = ButterBookmarks;
  // An answer's rendered content, as stream/offscreen.js finds it. Its paragraphs are its top-level
  // blocks (paragraph, heading, code block, table, blockquote), except that each item of a
  // top-level list is a paragraph of its own (#51).
  const STYLE = '[data-markdown-text-style="assistant-message"]';
  const ANSWER = `:is(${STYLE}:not(:has([class*="DilResponseRoot"])), ${STYLE} [class*="DilResponseRoot"])`;
  const KIDS = [':not(ul, ol)', ':is(ul, ol) > li'], // a paragraph, below its answer
    BLOCK = KIDS.map((k) => `${ANSWER} > ${k}`).join(', '),
    OWN = KIDS.map((k) => `:scope > ${k}`).join(', ');
  // An answer's paragraphs, in document order: their index is a bookmark's `para`.
  const blocksOf = (answer) => [...answer.querySelectorAll(OWN)];
  // The element that carries an answer's message id. Older chats wrap the answer in
  // [data-message-author-role="assistant"][data-message-id]; live chats (checked on 2026-11-08,
  // notes/runs/2026-11-08-bookmarks-live) have neither, and the answer's ancestor carries
  // data-chatgpt-selection-message-id instead (as seek/layout-cache-main.js reads it).
  const MESSAGE =
    '[data-message-author-role="assistant"][data-message-id], [data-chatgpt-selection-message-id]';
  const idOf = (message) =>
    message?.getAttribute('data-message-id') ||
    message?.getAttribute('data-chatgpt-selection-message-id') ||
    null;
  // An answer as bookmarks see it: `answer`, the element that holds its paragraphs, and `id`, its
  // message id. Null without an id (an answer that has none yet).
  const answerAt = (answer) => {
    const id = idOf(answer.closest(MESSAGE));
    return id ? { answer, id } : null;
  };
  // A paragraph's answer; null for a paragraph outside one.
  const answerOf = (block) => (block?.matches(BLOCK) ? answerAt(block.closest(ANSWER)) : null);
  // The answers rendered in `root` (a turn or the document).
  const answersIn = (root) => [...root.querySelectorAll(ANSWER)].map(answerAt).filter(Boolean);
  const SHOW_AFTER = 120; // ms of hover before the button fades in
  const MEASURE = 1000; // UTF-16 units measured for line ends; the excerpt keeps at most 240 characters
  const HEADER = 52; // ChatGPT's fixed header overlaps the top of the chat's scroller (rail/rail.js)
  const strings = (zh) =>
    zh
      ? {
          add: '加书签',
          sel: '为选中内容加书签',
          remove: '删除书签',
          removeOf: (t) => `删除书签：${t}`,
        }
      : {
          add: 'Bookmark',
          sel: 'Bookmark selection',
          remove: 'Remove bookmark',
          removeOf: (t) => `Remove bookmark: ${t}`,
        };
  const zh = () => document.documentElement?.getAttribute('data-butter-lang') === 'zh';
  let TXT = strings(zh());
  const railOff = () =>
    document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('rail');
  const convOfPath = () => /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1] ?? null;

  // ---- Identity: the account hash from history/conversation-main.js, ids hashed as layouts hash them.
  let account = null;
  document.addEventListener('butter-account', (e) => {
    const next = B.hash(e.detail) ? e.detail : null;
    if (next === account) return;
    account = next;
    hide();
    refresh();
  });
  document.dispatchEvent(new CustomEvent('butter-account-request'));
  const digests = new Map();
  const digest = (s) => {
    if (!digests.has(s))
      digests.set(
        s,
        crypto.subtle
          .digest('SHA-256', new TextEncoder().encode(s))
          .then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')),
      );
    return digests.get(s);
  };

  // ---- Store client (bookmarks/client.js).
  const { send } = ButterBookmarkStore;
  const lists = new Map(); // `${account} ${conv}` -> Promise of that conversation's bookmarks
  const listOf = (owner, conv) => {
    const key = `${owner} ${conv}`;
    if (!lists.has(key))
      lists.set(
        key,
        digest(conv)
          .then((hash) => send('butter-bookmark-list', { account: owner, conv: hash }))
          .then((r) => {
            if (Array.isArray(r.bookmarks)) return r.bookmarks;
            lists.delete(key); // unavailable: try again the next time the rail asks
            return [];
          }),
      );
    return lists.get(key);
  };

  // ---- Marks for the rail: one per question that holds bookmarks.
  let view = { conv: null, items: [] },
    rawOf = new Map(), // hashed message id -> raw id, for every message seen in this tab
    hashOf = new Map(), // and back
    shownList = [], // the bookmarks of the conversation in view
    serial = 0,
    seeking = false,
    deferred = false,
    sent = ''; // what the rail was last sent: question, bookmarks and their stale flags
  const fresh = new Set(); // keys of bookmarks just made in this tab: their dot grows in
  let onDots = new Set(); // keys of the bookmarks last sent on the earlier-history dots
  const seen = new Map(); // key -> stale, as last resolved in this tab; never stored (#55)
  // `quiet`: only a re-check of staleness, so the rail hears nothing when nothing changed.
  async function refresh(quiet = false) {
    const token = ++serial,
      { conv, items, complete } = view,
      owner = account;
    if (seeking) {
      deferred = true;
      return;
    }
    // Nothing is read while the rail is off, which includes Butter paused.
    const off = railOff();
    if (!conv || !owner || off) {
      if (!owner && !off) document.dispatchEvent(new CustomEvent('butter-account-request'));
      globalThis.ButterRail?.setMarks(conv, new Map());
      return;
    }
    // The answers rendered now, by hashed id: a version the list doesn't hold can be on screen.
    const rendered = answersIn(document),
      ids = rendered.map((a) => a.id);
    const [bookmarks, hashes, shown] = await Promise.all([
      listOf(owner, conv),
      Promise.all(items.map((x) => digest(x.id))),
      Promise.all(ids.map(digest)),
    ]);
    if (token !== serial) return;
    // Kept, not rebuilt: an answer that streamed in this tab is never listed, so once ChatGPT
    // unmounts it its raw id is known only from when it was on the page. Message ids are unique.
    hashes.forEach((h, i) => {
      rawOf.set(h, items[i].id);
      hashOf.set(items[i].id, h);
    });
    shown.forEach((h, i) => {
      rawOf.set(h, ids[i]);
      hashOf.set(ids[i], h);
    });
    shownList = bookmarks;
    const questions = items.filter((x) => x.q != null);
    const onPage = new Map(shown.map((h, i) => [h, rendered[i].answer]));
    const groups = B.resolve(
      bookmarks,
      items.map((x, i) => ({ msg: hashes[i], q: x.q != null })),
      {
        complete,
        paragraphs: (msg) => {
          const answer = onPage.get(msg);
          return answer?.isConnected ? paragraphs(answer) : undefined;
        },
        // Its turn is mounted with an answer in it: an answer that isn't the bookmarked one replaced it.
        mounted: (q) => {
          const turn = [...document.querySelectorAll('[data-turn-key]')].find(
            (t) => t.getAttribute('data-turn-key') === questions[q].id,
          );
          return !!turn && answersIn(turn).length > 0;
        },
      },
      seen,
    );
    // A question's id, or B.EARLIER for the bookmarks in earlier history the rail hasn't loaded.
    const idOf = (g) => (g.question === B.EARLIER ? B.EARLIER : questions[g.question].id);
    const sig = JSON.stringify(
      groups.map((g) => [idOf(g), g.bookmarks.map((b) => [b.key, b.stale])]),
    );
    if (quiet && sig === sent && !fresh.size) return;
    sent = sig;
    const marks = new Map(),
      dots = new Set(groups.find((g) => g.question === B.EARLIER)?.bookmarks.map((b) => b.key));
    for (const g of groups) {
      const first = g.bookmarks[0];
      // `bookmarks` in answer order, each with its `stale` flag; `stale` when all of them are;
      // `land(turn, b)` for the rail's jump, `remove(b)` for its ×. A bookmark that leaves the
      // dots for its question's tick (its answer loaded) grows in there, as a new one does.
      marks.set(idOf(g), {
        count: g.bookmarks.length,
        fresh: g.bookmarks.some(
          (b) => fresh.has(b.key) || (g.question !== B.EARLIER && onDots.has(b.key)),
        ),
        bookmarks: g.bookmarks,
        stale: g.stale,
        land: (turn, b = first) => locate(turn, b),
        wash: (turn, b = first, draw = true) => washAt(turn, b, draw),
        remove: (b) => remove(owner, conv, [b]),
      });
    }
    fresh.clear();
    onDots = dots;
    globalThis.ButterRail?.setMarks(conv, marks, items);
    label();
  }
  // Staleness follows the page between renders: a regenerated answer or a switched version shows
  // after a click on the page, and the rail is checked again as the pointer or focus reaches it.
  // Neither happens while scrolling.
  let checks = [];
  const recheck = () => {
    if (seeking || !shownList.length) return;
    checks.forEach(clearTimeout);
    checks = [600, 2500].map((ms) => setTimeout(() => refresh(true), ms));
  };
  document.addEventListener('click', recheck, { capture: true, passive: true });
  const toRail = (e) => {
    if (e.target?.localName === 'chatgpt-butter-nav' && e.relatedTarget !== e.target)
      if (!seeking && shownList.length) refresh(true);
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
    seeking = m.state === 'dragging' || m.state === 'loading';
    if (seeking) {
      hide();
      unwash(); // a scrollbar drag puts the wash away as it starts
    } else if (deferred) {
      deferred = false;
      refresh();
    }
  });
  // Called by the rail whenever it renders a conversation's questions.
  // `complete`: `items` reach back to the conversation's start (no earlier page left to load).
  globalThis.ButterBookmarkPage = {
    sync(conv, items, complete = false) {
      if (conv === view.conv && items === view.items && complete === view.complete) return;
      if (conv !== view.conv) unwash();
      view = { conv, items, complete };
      refresh();
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
  const paragraphs = (answer) => blocksOf(answer).map(textOf);
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
  // touches. Null when nothing is selected or the selection holds no answer text.
  const selection = () => {
    const s = getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    const r = s.getRangeAt(0),
      common = r.commonAncestorContainer,
      el = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
    if (!el) return null;
    const inside = el.closest(BLOCK);
    let blocks = inside
      ? [inside]
      : [...el.querySelectorAll(BLOCK)].filter((b) => r.intersectsNode(b));
    const home = answerOf(blocks[0])?.answer;
    blocks = blocks.filter((b) => home && answerOf(b)?.answer === home);
    if (!blocks.length) return null;
    const siblings = blocksOf(home),
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
    const turns = [...document.querySelectorAll('[data-turn-key]')],
      boxes = turns.map((t) => t.getBoundingClientRect()),
      seen = boxes.findIndex((b) => b.height && b.bottom > HEADER);
    if (seen < 0) return null;
    const box = scrollerOf(turns[seen])?.getBoundingClientRect(),
      line = Math.max(0, box?.top ?? 0) + HEADER,
      bottom = box?.bottom ?? innerHeight;
    const blocks = turns
      .filter((t, i) => boxes[i].height && boxes[i].bottom > line && boxes[i].top < bottom)
      .flatMap((t) => answersIn(t).flatMap((a) => blocksOf(a.answer)));
    const tops = blocks.map((b) => b.getBoundingClientRect().top);
    return blocks[B.topParagraph(tops, line)] ?? null;
  };
  // A bookmark's paragraph in its question's turn; null when it is stale now: its answer,
  // paragraph or text no longer there.
  const blockIn = (turn, b) => {
    const raw = rawOf.get(b.msg),
      answer = raw && answersIn(turn).find((a) => a.id === raw)?.answer,
      block = answer && blocksOf(answer)[b.para];
    return block && B.matches(b, paragraphs(answer)) ? block : null;
  };
  // Where a bookmark's text is, in px below the top of its question's turn; null (the rail lands at
  // the question's start) when it is stale now.
  const locate = (turn, b) => {
    const block = blockIn(turn, b);
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
  };

  // Bookmark a paragraph: the whole of it, or `range` (`{ start, end, excerpt, line }`) within it.
  async function create(block, range = null) {
    const answer = answerOf(block),
      id = answer?.id,
      turn = block.closest('[data-turn-key]'),
      ask = turn?.getAttribute('data-turn-key'), // the question's message id
      conv = convOfPath(),
      owner = account;
    if (!id || !ask || !conv || !owner) return;
    const para = blocksOf(answer.answer).indexOf(block),
      text = textOf(block),
      ends = range ? null : measure([{ block, from: 0, to: text.length }]),
      excerpt = range ? range.excerpt : B.excerpt(text, ends),
      line = range ? range.line : B.firstLine(text, ends);
    if (!excerpt) return;
    const questions = view.conv === conv ? view.items.filter((x) => x.q != null) : [];
    const [convHash, msg, askHash] = await Promise.all([digest(conv), digest(id), digest(ask)]);
    const bookmark = {
      account: owner,
      conv: convHash,
      msg,
      ask: askHash,
      turn: Math.max(
        0,
        questions.findIndex((x) => x.id === ask),
      ),
      para,
      start: range ? range.start : 0,
      end: range ? range.end : text.length,
      excerpt,
      line,
      time: Date.now(),
    };
    const r = await send('butter-bookmark-create', { bookmark });
    if (!r.bookmark) return;
    const list = await listOf(owner, conv);
    if (r.created && !list.some((b) => b.key === r.bookmark.key)) {
      list.push(r.bookmark);
      fresh.add(r.bookmark.key);
    }
    hashOf.set(id, msg);
    if (owner === account && conv === view.conv) refresh();
    // Every save, by the button or the shortcut, comes through here: the first one tells the user
    // what is kept (bookmarks/notice.js). Its Undo deletes the bookmark; then drop its dot.
    if (r.created)
      globalThis.ButterBookmarkNotice?.saved(r.bookmark, () => {
        const at = list.findIndex((b) => b.key === r.bookmark.key);
        if (at >= 0) list.splice(at, 1);
        if (owner === account && conv === view.conv) refresh();
      });
  }
  // Deletes bookmarks from the store and from the page's copy of the conversation's list.
  async function remove(owner, conv, bookmarks) {
    const hash = await digest(conv);
    const done = await Promise.all(
      bookmarks.map((b) =>
        send('butter-bookmark-delete', { account: owner, conv: hash, key: b.key }).then(
          (r) => r.deleted !== undefined && b.key,
        ),
      ),
    );
    const list = await listOf(owner, conv);
    for (const key of done) {
      const at = list.findIndex((b) => b.key === key);
      if (key && at >= 0) list.splice(at, 1);
    }
    if (owner === account && conv === view.conv) refresh();
  }
  // The bookmarks anchored to a paragraph of the conversation in view.
  const marksOf = (block) => {
    const answer = answerOf(block),
      msg = hashOf.get(answer?.id);
    const para = answer ? blocksOf(answer.answer).indexOf(block) : -1;
    return msg && view.conv === convOfPath()
      ? shownList.filter((b) => b.msg === msg && b.para === para)
      : [];
  };

  // ---- The hover button, in Butter's own layer over the left margin. ChatGPT's DOM is untouched.
  const ICON =
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const CSS = `
    :host { all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 20; display: block;
      --muted: #8f8f8f; --hoverbg: rgb(0 0 0 / .06); --tipbg: #0d0d0d; --tipfg: #fff; --tipmute: #b4b4b4; --butter: #fbe07a; --outline: #1b170f; }
    :host([data-dark]) { --muted: #a3a3a3; --hoverbg: rgb(255 255 255 / .08); --tipbg: #fff; --tipfg: #0d0d0d; --tipmute: #6b6b6b;
      --butter: #e3c766; --outline: var(--butter); }
    button { all: unset; position: fixed; left: var(--x); top: var(--y); box-sizing: border-box; width: 28px; height: 28px;
      border-radius: 8px; display: grid; place-items: center; color: var(--muted); background: var(--hoverbg); cursor: pointer;
      opacity: 0; visibility: hidden; pointer-events: none; -webkit-tap-highlight-color: transparent; }
    button.show { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity .15s; }
    button:focus-visible { outline: 2px solid #10a37f; outline-offset: 1px; }
    svg { width: 16px; height: 16px; }
    button.on path { fill: var(--butter); stroke: var(--outline); }
    .tip { position: absolute; left: 0; bottom: calc(100% + 8px); white-space: nowrap; background: var(--tipbg); color: var(--tipfg);
      font: 600 12px/1 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif; padding: 7px 9px;
      border-radius: 8px; opacity: 0; pointer-events: none; }
    .tip kbd { font: inherit; color: var(--tipmute); margin-left: 8px; }
    .tip kbd:empty { display: none; }
    button:hover .tip, button:focus-visible .tip { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { button.show { transition: none; } }`;
  let host = null,
    button,
    tip,
    kbd,
    target = null, // the paragraph the button is shown for
    zone = null, // its box extended over the margin to the button: the pointer may cross it
    waiting = null,
    timer = 0;
  const isDark = () =>
    document.documentElement.classList.contains('dark') ||
    /dark/.test(getComputedStyle(document.documentElement).colorScheme);
  const build = () => {
    host = document.createElement('chatgpt-butter-bookmark');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><button type="button">${ICON}<span class="tip"><span></span><kbd></kbd></span></button>`;
    button = root.querySelector('button');
    tip = root.querySelector('.tip span');
    kbd = root.querySelector('.tip kbd');
    label();
    document.body.append(host);
    const dark = () => host.toggleAttribute('data-dark', isDark());
    dark();
    new MutationObserver(dark).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
      setTimeout(dark, 50),
    );
    // Keep the reader's selection: a click on the button must not move it.
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', () => {
      if (!target || railOff()) return;
      // A selection that touches the paragraph is saved on its own, even in a bookmarked paragraph.
      const s = selection();
      if (s?.blocks.includes(target)) create(s.block, s);
      else {
        const marked = marksOf(target);
        if (marked.length) {
          if (account && view.conv) remove(account, view.conv, marked);
        } else create(target);
      }
    });
  };
  // Three states: "Bookmark selection" while the reader's selection touches the paragraph; filled
  // on a bookmarked paragraph, where a click removes its bookmarks; else "Bookmark". The
  // first two show the key Chrome reports for the bookmark command (none when it has no key).
  // The accessible name adds the start of the text the click would bookmark or remove.
  const label = () => {
    if (!host) return;
    const s = target ? selection() : null,
      sel = !!s?.blocks.includes(target),
      marked = sel ? [] : marksOf(target);
    button.classList.toggle('on', marked.length > 0);
    button.setAttribute(
      'aria-label',
      sel
        ? B.addLabel(s.excerpt, true, zh())
        : marked.length
          ? TXT.removeOf(marked.map((b) => b.excerpt).join(' '))
          : B.addLabel(target ? textOf(target) : '', false, zh()),
    );
    tip.textContent = sel ? TXT.sel : marked.length ? TXT.remove : TXT.add;
    kbd.textContent = marked.length ? '' : keys;
  };
  let keys = '';
  const readKey = async () => {
    try {
      const r = await chrome.runtime.sendMessage({ version: 1, type: 'butter-bookmark-key' });
      keys = B.keyHint(r?.shortcut);
    } catch {}
    label();
  };
  document.addEventListener('selectionchange', () => {
    if (target) label();
  });
  function hide() {
    clearTimeout(timer);
    waiting = null;
    if (!target) return;
    target = zone = null;
    button.classList.remove('show');
    removeEventListener('scroll', hide, true);
    removeEventListener('wheel', hide, true);
  }
  // Over the left margin, centred on the paragraph's first rendered line. False if it has no box.
  const place = (block) => {
    const b = block.getBoundingClientRect();
    if (!b.height) return false;
    // In the answer's own margin, so a list item's button lines up with the paragraphs' buttons.
    const left = Math.min(b.left, block.closest(ANSWER)?.getBoundingClientRect().left ?? b.left);
    const r = document.createRange();
    r.selectNodeContents(block);
    const line = [...r.getClientRects()].find((q) => q.height) ?? b;
    const x = Math.max(4, Math.round(left - 38)),
      y = Math.round(line.top + line.height / 2 - 14);
    host.style.setProperty('--x', `${x}px`);
    host.style.setProperty('--y', `${y}px`);
    zone = { left: x, right: b.right, top: Math.min(y, b.top), bottom: Math.max(y + 28, b.bottom) };
    return true;
  };
  const show = (block) => {
    if (waiting !== block || !block.isConnected || railOff() || !account) return;
    waiting = null;
    if (!host) build();
    if (!place(block)) return;
    button.classList.add('show');
    target = block;
    label();
    readKey(); // the reader may have changed it in Chrome's shortcut settings since
    // The first scroll puts the button away; pointer moves over the paragraph keep it in place
    // when content above it changes size.
    addEventListener('scroll', hide, { capture: true, passive: true, once: true });
    addEventListener('wheel', hide, { capture: true, passive: true, once: true });
  };
  addEventListener(
    'pointermove',
    (e) => {
      if (e.buttons || e.pointerType === 'touch' || seeking || railOff() || !account) {
        if (target || waiting) hide();
        return;
      }
      if (host && e.target === host) return; // over the button
      const t = e.target instanceof Element ? e.target : null;
      // Cheap tests first: most moves are nowhere near an answer.
      const near = t && t.closest(STYLE) && !t.closest('button') ? t.closest(BLOCK) : null,
        block = answerOf(near) ? near : null;
      if (block && block === target) {
        place(block);
        return;
      }
      if (block && block === waiting) return;
      if (
        !block &&
        zone &&
        e.clientX >= zone.left &&
        e.clientX <= zone.right &&
        e.clientY >= zone.top &&
        e.clientY <= zone.bottom
      )
        return;
      hide();
      if (block && convOfPath()) {
        waiting = block;
        timer = setTimeout(() => show(block), SHOW_AFTER);
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener('butter-settings', () => {
    TXT = strings(zh());
    label();
    if (railOff()) {
      hide();
      unwash();
    }
    refresh(); // reads the conversation once the rail is on, or clears its marks when it goes off
  });

  // ---- The landing wash (#73). When a bookmark trip from a card row lands on live text, the rail
  // calls its `wash`: the bookmark's range is washed in butter, line by line in reading order, held
  // and faded (bookmarks/wash.js has the plan). The boxes are in Butter's own fixed layer, as the
  // hover button is, so nothing goes into ChatGPT's answer. They are measured from the range's
  // text, clipped to the scroller between ChatGPT's header and composer, and measured again on the
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
  // header is taken to overlap the scroller, as rail/rail.js takes it.
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
  // Washes bookmark `b` in its question's `turn`, or with `draw` false only says whether it would.
  // False when it can't: stale, or nothing to show.
  function washAt(turn, b, draw = true) {
    const block = blockIn(turn, b),
      sc = block && scrollerOf(block);
    if (!sc || railOff() || seeking) return false;
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
    if (railOff() || !account || seeking || !convOfPath()) return;
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
