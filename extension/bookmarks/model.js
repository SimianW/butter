// Bookmarks, pure: the excerpt rule, grouping, resolution to live or stale, and the hover card.
// No DOM or chrome.* here; loaded by the content scripts and the service worker, and by node --test.
((root) => {
  const LINES = 3,
    CHARS = 240;
  // The marked text cut to its first three rendered lines and to at most 240 characters, whichever
  // is shorter. `ends` are the UTF-16 offsets where its rendered lines end, as the page measured
  // them. Characters are code points, so CJK text and emoji are never split. Whitespace runs
  // collapse to one space, as the page renders them.
  function excerpt(text, ends = []) {
    const cut = [...ends].sort((a, b) => a - b)[LINES - 1] ?? text.length;
    const flat = text.slice(0, cut).replace(/\s+/g, ' ').trim();
    return [...flat].slice(0, CHARS).join('').trim();
  }
  // How many characters of that excerpt its first rendered line holds (`ends` as for `excerpt`),
  // stored as `line`: staleness checks that the paragraph still holds this first line.
  function firstLine(text, ends = []) {
    const first = Math.min(...ends, text.length);
    const line = [...text.slice(0, first).replace(/\s+/g, ' ').trim()].length;
    return Math.min(line, [...excerpt(text, ends)].length);
  }
  // A bookmark is identified by where it points: the same paragraph and range is one bookmark.
  const key = (b) => JSON.stringify([b.account, b.conv, b.msg, b.para, b.start, b.end]);
  // The stored record, rebuilt from an allowlist: hashed ids, positions, the excerpt and its time.
  // Anything else (page text beyond the excerpt, raw ids, urls) never reaches the store. `ask`, the
  // hashed id of the question the bookmark was made under, and `line`, the length of the excerpt's
  // first rendered line, are optional: older records lack them.
  const hash = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const int = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
  function clean(b) {
    if (
      !b ||
      !['account', 'conv', 'msg'].every((k) => hash(b[k])) ||
      !int(b.turn, 1_000_000) ||
      !int(b.para, 100_000) ||
      !int(b.start, 10_000_000) ||
      !int(b.end, 10_000_000) ||
      b.start > b.end ||
      typeof b.excerpt !== 'string' ||
      !b.excerpt ||
      [...b.excerpt].length > CHARS ||
      !Number.isFinite(b.time) ||
      b.time < 0 ||
      (b.ask !== undefined && !hash(b.ask)) ||
      (b.line !== undefined && !(int(b.line, CHARS) && b.line > 0))
    )
      return null;
    const { account, conv, msg, turn, para, start, end, excerpt, time } = b;
    const out = { account, conv, msg, turn, para, start, end, excerpt, time };
    if (b.ask !== undefined) out.ask = b.ask;
    if (b.line !== undefined) out.line = b.line;
    return out;
  }
  // `items` is the conversation as loaded, oldest first: `{ msg: hashed message id, q: is a
  // question }`. Returns `[{ question, bookmarks }]` by question index (0 = the first listed
  // question), each list in answer order: message, paragraph, then range.
  // A bookmark whose message isn't listed stays under the question it was made under, after the
  // others: its `ask` when that question is listed. Otherwise, while earlier history isn't loaded
  // (`complete` false), one whose message isn't `shown(msg)` (rendered now) belongs to that earlier
  // history: it goes in the group `EARLIER` (-1), the rail's earlier-history dots, oldest first.
  // Else it goes under its question's position at creation (`turn`, clamped to the last question).
  const EARLIER = -1;
  function group(bookmarks, items, { complete = true, shown = () => false } = {}) {
    const where = new Map(),
      asked = new Map(); // a question's hashed id -> its index
    let question = -1;
    items.forEach((x, i) => {
      if (x.q) asked.set(x.msg, ++question);
      else if (question >= 0) where.set(x.msg, { question, rank: i });
    });
    const last = question;
    if (last < 0) return [];
    const placed = bookmarks.map((b) => {
      const w = where.get(b.msg);
      if (w) return { b, question: w.question, rank: w.rank };
      if (asked.has(b.ask)) return { b, question: asked.get(b.ask), rank: Infinity };
      const earlier = !complete && !shown(b.msg);
      return { b, question: earlier ? EARLIER : Math.min(b.turn, last), rank: Infinity };
    });
    placed.sort(
      (x, y) =>
        x.question - y.question ||
        x.rank - y.rank ||
        x.b.turn - y.b.turn ||
        x.b.para - y.b.para ||
        x.b.start - y.b.start ||
        x.b.end - y.b.end ||
        x.b.time - y.b.time,
    );
    const out = [];
    for (const p of placed) {
      if (out.at(-1)?.question !== p.question) out.push({ question: p.question, bookmarks: [] });
      out.at(-1).bookmarks.push(p.b);
    }
    return out;
  }
  // Resolution (#55): whether each bookmark still points at its text. `view` is what the page
  // shows now: `paragraphs(msg)` gives a rendered answer's paragraph texts by hashed message id
  // (undefined when that message isn't rendered), `mounted(question)` whether that question's turn
  // is in the DOM, and `complete` whether `items` reaches back to the conversation's start.
  // A bookmark is live when its message is rendered, its paragraph exists and the paragraph's text
  // still contains the excerpt's first line (its first `line` characters; records without `line`
  // check the first `HEAD`). It is stale when the paragraph or its text no longer
  // matches, when its question is shown with another answer (regenerated), when its question (`ask`)
  // is listed with another answer, or when its message and question have left a complete
  // conversation. Otherwise (not rendered now) it keeps what `last` remembers for
  // it, live by default. A bookmark in the earlier, unloaded history (the `EARLIER` group) is live:
  // nothing can be known about it yet. Returns `group`'s groups with each bookmark copied with its `stale` flag,
  // plus `stale` on a group whose bookmarks are all stale; `last` is updated. Nothing is stored, so
  // a bookmark that resolves again (the original version switched back) is live again.
  const flat = (s) => s.replace(/\s+/g, ' ').trim();
  const HEAD = 40; // about one rendered line, for records stored without `line`
  function matches(b, paragraphs) {
    const own = flat(paragraphs[b.para] ?? '');
    if (!own) return false;
    const head = [...flat(b.excerpt)].slice(0, b.line ?? HEAD).join('');
    // A selection that ran on into the next paragraphs: its first line starts in this one.
    const at = paragraphs.slice(b.para).map(flat).filter(Boolean).join(' ').indexOf(head);
    return at >= 0 && at < own.length;
  }
  function resolve(bookmarks, items, view, last = new Map()) {
    const listed = new Set(items.map((x) => x.msg));
    const shown = (msg) => !!view.paragraphs(msg);
    // Questions listed with an answer. An answer that streamed in this tab isn't listed until a
    // reload, so a listed question without one says nothing about the bookmark.
    const answered = new Set();
    let question = -1;
    for (const x of items) x.q ? question++ : question >= 0 && answered.add(question);
    return group(bookmarks, items, { complete: view.complete, shown }).map((g) => {
      if (g.question === EARLIER) {
        const rows = g.bookmarks.map((b) => ({ ...b, stale: false }));
        return { question: EARLIER, bookmarks: rows, stale: false };
      }
      const rows = g.bookmarks.map((b) => {
        const shown = view.paragraphs(b.msg);
        let stale = null;
        if (shown) stale = !matches(b, shown);
        else if (!listed.has(b.msg)) {
          if (listed.has(b.ask))
            stale = answered.has(g.question) || view.mounted(g.question) ? true : null;
          else if (view.complete) stale = true;
        } else if (view.mounted(g.question)) stale = true;
        if (stale === null) stale = last.get(b.key) ?? false;
        last.set(b.key, stale);
        return { ...b, stale };
      });
      return { question: g.question, bookmarks: rows, stale: pale(rows) };
    });
  }
  // A question's segment turns pale only when every one of its bookmarks is stale.
  const pale = (rows) => rows.length > 0 && rows.every((b) => b.stale);
  // A selection in an answer, as a bookmark's anchor. `paras` are the answer's paragraphs as
  // rendered text; `from` and `to` are `{ para, offset }` in UTF-16 units, in document order.
  // Returns `{ para, start, end, text, last }`: the range within the first paragraph, the selected
  // text, and where the selection ends (`{ para, offset }`).
  // A selection across paragraphs is anchored to its first one, up to that paragraph's end; its text
  // keeps every selected paragraph, one per line, for the three-line excerpt.
  // Whitespace at either end is left out, so the same words are the same bookmark; a selection of
  // only whitespace anchors nothing (null).
  function anchor(paras, from, to) {
    // A boundary between the two halves of a surrogate pair (an emoji) takes the whole character.
    const low = (p, i) => /[\udc00-\udfff]/.test(paras[p][i] ?? '');
    from = { ...from, offset: from.offset - (low(from.para, from.offset) ? 1 : 0) };
    to = { ...to, offset: to.offset + (low(to.para, to.offset) ? 1 : 0) };
    const space = (p, i) => /\s/.test(paras[p][i]);
    for (;;) {
      if (from.para > to.para || (from.para === to.para && from.offset >= to.offset)) return null;
      if (from.offset >= paras[from.para].length) from = { para: from.para + 1, offset: 0 };
      else if (space(from.para, from.offset)) from.offset++;
      else break;
    }
    for (;;) {
      if (to.offset <= 0) to = { para: to.para - 1, offset: paras[to.para - 1].length };
      else if (space(to.para, to.offset - 1)) to.offset--;
      else break;
    }
    const parts = [];
    for (let p = from.para; p <= to.para; p++)
      parts.push(
        paras[p].slice(p === from.para ? from.offset : 0, p === to.para ? to.offset : undefined),
      );
    const end = from.para === to.para ? to.offset : paras[from.para].length;
    return { para: from.para, start: from.offset, end, text: parts.join('\n'), last: to };
  }
  // With nothing selected the shortcut bookmarks the first answer paragraph whose top is at or below
  // `line` (the bottom of ChatGPT's fixed header). `tops` are the paragraphs' tops in document
  // order; returns its index, or -1 when none is.
  const topParagraph = (tops, line) => tops.findIndex((top) => top >= line);
  // The tooltip's key hint from chrome.commands' `shortcut`: "Alt+Shift+M" reads "Alt Shift M", as
  // the mockup writes keys; a command without a key shows no hint.
  const keyHint = (shortcut) => (typeof shortcut === 'string' ? shortcut.split('+').join(' ') : '');
  // Centre of a question's segment below its tick's centre, in px.
  const segmentOffset = (pitch) => (pitch < 12 ? 0.4 * pitch : 5);
  // What the rail's hover card shows for one question's bookmarks (`rows`, already in answer
  // order). `at` places the question: `{ n, total }`, `{ back }` (1 = the latest question) while
  // earlier questions aren't loaded and the total is unknown, or `{ earlier: true }` for the
  // bookmarks in that unloaded history, on the rail's earlier-history dots. One bookmark gets the
  // single card; several get a list that shows `visible` rows and scrolls for the rest. `label` is
  // the segment's accessible name; `wait` the meta line while earlier messages load for a click.
  const VISIBLE = 5;
  function card(rows, at, zh = false) {
    const k = rows.length,
      single = k === 1,
      earlier = !!at.earlier;
    const where = zh
      ? earlier
        ? '更早的问题'
        : at.back != null
          ? `最近第 ${at.back} 个问题`
          : `第 ${at.n} / ${at.total} 个问题`
      : earlier
        ? single
          ? 'earlier question'
          : 'earlier questions'
        : at.back != null
          ? at.back === 1
            ? 'latest question'
            : `${at.back} questions back`
          : `question ${at.n} of ${at.total}`;
    const meta = zh
      ? single
        ? `书签 · ${where}`
        : `${where} · ${k} 个书签`
      : single
        ? `Bookmark · ${where}`
        : `${where[0].toUpperCase()}${where.slice(1)} · ${k} bookmarks`;
    const tag = zh ? '回答已变化' : 'answer changed';
    // One stale bookmark: the meta line says so and a footer explains where a click lands.
    const stale = single && !earlier && !!rows[0].stale;
    const warn =
      earlier && single
        ? zh
          ? '这个问题还没加载。点击会先加载更早的消息。'
          : "This question isn't loaded yet. Clicking loads earlier messages first."
        : !stale
          ? null
          : zh
            ? `找不到这一段了。点击会跳到${at.back != null ? '这个问题' : `第 ${at.n} 个问题`}的开头。`
            : `This paragraph can't be found any more. Clicking opens ${at.back != null ? 'its question' : `question ${at.n}`} instead.`;
    return {
      single,
      meta: stale ? (zh ? `书签 · ${tag}` : `Bookmark · ${tag}`) : meta,
      rows,
      visible: Math.min(k, VISIBLE),
      label: earlier ? `${meta}${zh ? '：' : ': '}${texts(rows, zh)}` : label(rows, zh),
      stale,
      warn,
      tag,
      wait: zh ? '正在加载更早的问题…' : 'Loading earlier questions…',
    };
  }
  // The bookmarks' text for an accessible name, a stale one marked so.
  const texts = (rows, zh) =>
    rows
      .map((b) =>
        !b.stale ? b.excerpt : zh ? `${b.excerpt}（回答已变化）` : `${b.excerpt} (answer changed)`,
      )
      .join(zh ? '；' : '; ');
  // The segment's accessible name: how many bookmarks, and their text.
  function label(rows, zh = false) {
    const k = rows.length,
      t = texts(rows, zh);
    if (zh) return k === 1 ? `书签：${t}` : `${k} 个书签：${t}`;
    return k === 1 ? `Bookmark: ${t}` : `${k} bookmarks: ${t}`;
  }
  // The hover button's accessible name while it adds: the action and the start of the text it
  // would bookmark (the paragraph's, or the selection's), up to 80 characters.
  const LEAD = 80;
  function addLabel(text, selection = false, zh = false) {
    const all = [...flat(text)],
      lead = all.slice(0, LEAD).join('').trim() + (all.length > LEAD ? '…' : '');
    const action = zh
      ? selection
        ? '为选中内容加书签'
        : '加书签'
      : selection
        ? 'Bookmark selection'
        : 'Bookmark';
    return lead ? `${action}${zh ? '：' : ': '}${lead}` : action;
  }
  const api = {
    EARLIER,
    excerpt,
    firstLine,
    key,
    clean,
    hash,
    group,
    resolve,
    matches,
    pale,
    anchor,
    topParagraph,
    keyHint,
    segmentOffset,
    card,
    label,
    addLabel,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ButterBookmarks = api;
})(globalThis);
