// Bookmarks, pure: the excerpt rule. No DOM or chrome.* here; loaded by the content scripts and
// the service worker, and by node --test.
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
  // A bookmark is identified by where it points: the same paragraph and range is one bookmark.
  const key = (b) => JSON.stringify([b.account, b.conv, b.msg, b.para, b.start, b.end]);
  // The stored record, rebuilt from an allowlist: hashed ids, positions, the excerpt and its time.
  // Anything else (page text beyond the excerpt, raw ids, urls) never reaches the store.
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
      b.time < 0
    )
      return null;
    const { account, conv, msg, turn, para, start, end, excerpt, time } = b;
    return { account, conv, msg, turn, para, start, end, excerpt, time };
  }
  // `items` is the conversation, oldest first: `{ msg: hashed message id, q: is a question }`.
  // Returns `[{ question, bookmarks }]` by question index (0 = the first question), each list in
  // answer order: message, paragraph, then range. A bookmark whose message isn't in `items` stays
  // under the question it was made on (`turn`, clamped to the last question), after the others.
  function group(bookmarks, items) {
    const where = new Map();
    let question = -1;
    items.forEach((x, i) => {
      if (x.q) question++;
      else if (question >= 0) where.set(x.msg, { question, rank: i });
    });
    const last = question;
    if (last < 0) return [];
    const placed = bookmarks.map((b) => {
      const w = where.get(b.msg);
      return { b, question: w ? w.question : Math.min(b.turn, last), rank: w ? w.rank : Infinity };
    });
    placed.sort(
      (x, y) =>
        x.question - y.question ||
        x.rank - y.rank ||
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
  // Centre of a question's segment below its tick's centre, in px.
  const segmentOffset = (pitch) => (pitch < 12 ? 0.4 * pitch : 5);
  const api = { excerpt, key, clean, hash, group, segmentOffset };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ButterBookmarks = api;
})(globalThis);
