// Isolated world. Bookmarks on the page: the hover button over answer paragraphs, the client of the
// worker's store (bookmarks/worker.js), and the marks the history rail draws (rail/rail.js). The
// rules live in bookmarks/model.js. A conversation's bookmarks are read once when the rail shows it
// and written on create and delete; nothing here runs while a scrollbar drag is seeking.
(() => {
  const B = ButterBookmarks;
  // An answer's rendered content, as stream/offscreen.js finds it; its children are the paragraphs.
  const ANSWER =
    ':is([data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"])), [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"])';
  const BLOCK = `${ANSWER} > *`;
  const MESSAGE = '[data-message-author-role="assistant"][data-message-id]';
  const SHOW_AFTER = 120; // ms of hover before the button fades in
  const MEASURE = 1000; // UTF-16 units measured for line ends; the excerpt keeps at most 240 characters
  const strings = (zh) =>
    zh
      ? { add: '为这段加书签', remove: '删除书签', removeOf: (t) => `删除书签：${t}` }
      : {
          add: 'Bookmark paragraph',
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

  // ---- Store client. A stopped worker closes the port; the same request wakes it again.
  const send = async (type, fields) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await chrome.runtime.sendMessage({ version: 1, type, ...fields });
        if (r && r.error !== 'bookmark-storage') return r;
      } catch {}
    }
    return { error: 'bookmark-storage' };
  };
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
    rawOf = new Map(), // hashed message id -> raw id, for the conversation in view
    hashOf = new Map(), // and back
    shownList = [], // the bookmarks of the conversation in view
    serial = 0,
    seeking = false,
    deferred = false,
    sent = ''; // what the rail was last sent: question, bookmarks and their stale flags
  const fresh = new Set(); // keys of bookmarks just made in this tab: their segment grows in
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
    if (!conv || !owner) {
      if (!owner) document.dispatchEvent(new CustomEvent('butter-account-request'));
      globalThis.ButterRail?.setMarks(conv, new Map());
      return;
    }
    // The answers rendered now, by hashed id: a version the list doesn't hold can be on screen.
    const rendered = [...document.querySelectorAll(MESSAGE)],
      ids = rendered.map((m) => m.getAttribute('data-message-id'));
    const [bookmarks, hashes, shown] = await Promise.all([
      listOf(owner, conv),
      Promise.all(items.map((x) => digest(x.id))),
      Promise.all(ids.map(digest)),
    ]);
    if (token !== serial) return;
    rawOf = new Map(hashes.map((h, i) => [h, items[i].id]));
    hashOf = new Map(hashes.map((h, i) => [items[i].id, h]));
    shown.forEach((h, i) => {
      rawOf.set(h, ids[i]);
      hashOf.set(ids[i], h);
    });
    shownList = bookmarks;
    const questions = items.filter((x) => x.q != null);
    const onPage = new Map(shown.map((h, i) => [h, rendered[i]]));
    const groups = B.resolve(
      bookmarks,
      items.map((x, i) => ({ msg: hashes[i], q: x.q != null })),
      {
        complete,
        paragraphs: (msg) => {
          const m = onPage.get(msg);
          return m?.isConnected ? paragraphs(m) : undefined;
        },
        // Its turn is mounted with an answer in it: an answer that isn't the bookmarked one replaced it.
        mounted: (q) =>
          !![...document.querySelectorAll('[data-turn-key]')]
            .find((t) => t.getAttribute('data-turn-key') === questions[q].id)
            ?.querySelector(MESSAGE),
      },
      seen,
    );
    const sig = JSON.stringify(
      groups.map((g) => [questions[g.question].id, g.bookmarks.map((b) => [b.key, b.stale])]),
    );
    if (quiet && sig === sent && !fresh.size) return;
    sent = sig;
    const marks = new Map();
    for (const g of groups) {
      const first = g.bookmarks[0];
      // `bookmarks` in answer order, each with its `stale` flag; `stale` when all of them are;
      // `land(turn, b)` for the rail's jump, `remove(b)` for its ×.
      marks.set(questions[g.question].id, {
        count: g.bookmarks.length,
        fresh: g.bookmarks.some((b) => fresh.has(b.key)),
        bookmarks: g.bookmarks,
        stale: g.stale,
        land: (turn, b = first) => locate(turn, b),
        remove: (b) => remove(owner, conv, [b]),
      });
    }
    fresh.clear();
    globalThis.ButterRail?.setMarks(conv, marks);
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
    if (seeking) hide();
    else if (deferred) {
      deferred = false;
      refresh();
    }
  });
  // Called by the rail whenever it renders a conversation's questions.
  // `complete`: `items` reach back to the conversation's start (no earlier page left to load).
  globalThis.ButterBookmarkPage = {
    sync(conv, items, complete = false) {
      if (conv === view.conv && items === view.items && complete === view.complete) return;
      view = { conv, items, complete };
      refresh();
    },
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
  // A rendered answer's paragraphs, as text.
  const paragraphs = (message) => {
    const answer = message.querySelector(ANSWER);
    return answer
      ? [...answer.children].map((p) =>
          textNodes(p)
            .map((x) => x.n.data)
            .join(''),
        )
      : undefined;
  };
  // The paragraph's text and where its first rendered lines end, measured character by character.
  const lines = (block) => {
    const nodes = textNodes(block),
      r = document.createRange(),
      ends = [];
    let top = null,
      mid = 0;
    for (const { n, start } of nodes)
      for (let i = 0; i < n.data.length && ends.length < 3 && start + i < MEASURE; i++) {
        if (/\s/.test(n.data[i])) continue;
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const q = r.getClientRects()[0];
        if (!q?.height) continue;
        if (top !== null && q.top > mid) ends.push(start + i);
        if (top === null || q.top > mid) {
          top = q.top;
          mid = q.top + q.height / 2;
        }
      }
    return { text: nodes.map((x) => x.n.data).join(''), ends };
  };
  // Where a bookmark's text is, in px below the top of its question's turn; null (the rail lands at
  // the question's start) when it is stale now: its answer, paragraph or text no longer there.
  const locate = (turn, b) => {
    const raw = rawOf.get(b.msg),
      msg = raw && [...turn.querySelectorAll(MESSAGE)].find((m) => m.dataset.messageId === raw),
      block = msg?.querySelector(ANSWER)?.children[b.para];
    if (!block || !B.matches(b, paragraphs(msg))) return null;
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

  async function create(block) {
    const message = block.closest(MESSAGE),
      turn = block.closest('[data-turn-key]'),
      conv = convOfPath(),
      owner = account;
    if (!message || !turn || !conv || !owner || !block.parentElement) return;
    const para = [...block.parentElement.children].indexOf(block),
      { text, ends } = lines(block),
      excerpt = B.excerpt(text, ends);
    if (!excerpt) return;
    const questions = view.conv === conv ? view.items.filter((x) => x.q != null) : [];
    const [convHash, msg] = await Promise.all([
      digest(conv),
      digest(message.getAttribute('data-message-id')),
    ]);
    const bookmark = {
      account: owner,
      conv: convHash,
      msg,
      turn: Math.max(
        0,
        questions.findIndex((x) => x.id === turn.getAttribute('data-turn-key')),
      ),
      para,
      start: 0,
      end: text.length,
      excerpt,
      time: Date.now(),
    };
    const r = await send('butter-bookmark-create', { bookmark });
    if (!r.bookmark) return;
    const list = await listOf(owner, conv);
    if (r.created && !list.some((b) => b.key === r.bookmark.key)) {
      list.push(r.bookmark);
      fresh.add(r.bookmark.key);
    }
    hashOf.set(message.getAttribute('data-message-id'), msg);
    if (owner === account && conv === view.conv) refresh();
    // Every save, by the button or the shortcut, comes through here: the first one tells the user
    // what is kept (bookmarks/notice.js). Its Undo deletes the bookmark; then drop its segment.
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
    const msg = hashOf.get(block?.closest(MESSAGE)?.getAttribute('data-message-id'));
    const para = block?.parentElement ? [...block.parentElement.children].indexOf(block) : -1;
    return msg && view.conv === convOfPath()
      ? shownList.filter((b) => b.msg === msg && b.para === para)
      : [];
  };

  // ---- The hover button, in Butter's own layer over the left margin. ChatGPT's DOM is untouched.
  const ICON =
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const CSS = `
    :host { all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 20; display: block;
      --muted: #8f8f8f; --hoverbg: rgb(0 0 0 / .06); --tipbg: #0d0d0d; --tipfg: #fff; --butter: #fbe07a; --outline: #1b170f; }
    :host([data-dark]) { --muted: #a3a3a3; --hoverbg: rgb(255 255 255 / .08); --tipbg: #fff; --tipfg: #0d0d0d;
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
    button:hover .tip, button:focus-visible .tip { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { button.show { transition: none; } }`;
  let host = null,
    button,
    tip,
    target = null, // the paragraph the button is shown for
    zone = null, // its box extended over the margin to the button: the pointer may cross it
    waiting = null,
    timer = 0;
  const build = () => {
    host = document.createElement('chatgpt-butter-bookmark');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><button type="button">${ICON}<span class="tip"></span></button>`;
    button = root.querySelector('button');
    tip = root.querySelector('.tip');
    label();
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
    );
    // Keep the reader's selection: a click on the button must not move it.
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', () => {
      if (!target || railOff()) return;
      const marked = marksOf(target);
      if (marked.length) {
        if (account && view.conv) remove(account, view.conv, marked);
      } else create(target);
    });
  };
  // A bookmarked paragraph shows the button filled: clicking it removes the paragraph's bookmarks.
  const label = () => {
    if (!host) return;
    const marked = marksOf(target);
    button.classList.toggle('on', marked.length > 0);
    button.setAttribute(
      'aria-label',
      marked.length ? TXT.removeOf(marked.map((b) => b.excerpt).join(' ')) : TXT.add,
    );
    tip.textContent = marked.length ? TXT.remove : TXT.add;
  };
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
    const r = document.createRange();
    r.selectNodeContents(block);
    const line = [...r.getClientRects()].find((q) => q.height) ?? b;
    const x = Math.max(4, Math.round(b.left - 38)),
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
      const block = t && t.closest(MESSAGE) && !t.closest('button') ? t.closest(BLOCK) : null;
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
      if (block?.closest(MESSAGE) && convOfPath()) {
        waiting = block;
        timer = setTimeout(() => show(block), SHOW_AFTER);
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener('butter-settings', () => {
    TXT = strings(zh());
    label();
    if (railOff()) hide();
  });
})();
