// Isolated world, no DOM. The rail's conversations (`ButterRailThread`): each conversation's
// messages, oldest first, as ChatGPT's own API responses report them (history/conversation-main.js),
// with `q` set on visible questions only. ChatGPT doesn't refetch a chat it has cached, so earlier
// conversations stay. Every new list of a conversation's items takes the next items revision
// (`rev`) from one counter for the tab; the bookmark session's marks carry it back.
// rail/model.js holds one; test/rail-thread.test.js drives it directly.
(() => {
  function ButterRailThread() {
    const states = new Map();
    let revs = 0;
    const blank = () => ({ items: Object.freeze([]), hasPrev: false, rev: ++revs });
    const setItems = (s, items) => ((s.rev = ++revs), (s.items = Object.freeze(items)));
    const stateOf = (c) => states.get(c) ?? states.set(c, blank()).get(c);
    let conv = null,
      cur = blank();

    const mergePage = (s, { before, hasPrev, items }) => {
      // An empty/overlapping final page can still tell us that history is complete.
      if (!items.length) {
        if (before) s.hasPrev = hasPrev;
        return;
      }
      if (before) {
        // an older page; it ends where the loaded messages begin
        const have = new Set(s.items.map((x) => x.id));
        const k = items.findIndex((x) => have.has(x.id));
        if (k === 0) {
          s.hasPrev = hasPrev;
          return;
        }
        setItems(s, (k < 0 ? items : items.slice(0, k)).concat(s.items));
        s.hasPrev = hasPrev;
      } else {
        // the newest page, on load or refetch
        const a = s.items.findIndex((x) => x.id === items[0].id);
        if (a < 0) {
          setItems(s, items);
          s.hasPrev = hasPrev;
        } else setItems(s, s.items.slice(0, a).concat(items));
      }
    };
    const addSent = (s, { parent, item }) => {
      // A new question ends the thread. After an edit, what followed its parent was the old branch.
      const p = s.items.findIndex((x) => x.id === parent);
      if (p >= 0) setItems(s, s.items.slice(0, p + 1));
      setItems(s, s.items.filter((x) => x.id !== item.id).concat(item));
    };

    return {
      // The conversation in view (null: none), its items (frozen), whether earlier history is
      // still unloaded, and its items revision.
      get conv() {
        return conv;
      },
      get items() {
        return cur.items;
      },
      get hasPrev() {
        return cur.hasPrev;
      },
      get rev() {
        return cur.rev;
      },
      // Shows conversation `c` (null: none). False when it is already the one in view.
      open(c) {
        if (c === conv) return false;
        if (!conv && c && cur.items.length && !states.has(c)) states.set(c, cur); // a new chat got its id
        conv = c;
        cur = c ? stateOf(c) : blank();
        return true;
      },
      // A page of conversation-main.js's `butter-nav` (`{ conv, before, hasPrev, items }`).
      page(m) {
        mergePage(stateOf(m.conv), m);
      },
      // A sent question (`{ conv, parent, item }`); without `conv`, the conversation in view.
      send(m) {
        addSent(m.conv ? stateOf(m.conv) : cur, m);
      },
      // Mounted turns are consecutive in the thread: add any the responses didn't cover (the
      // extension loaded late, or the API changed) and drop questions that sit between two of them
      // (old branch). `keys`: the mounted turn keys in page order; `text(id)`: a mounted turn's
      // question text, read only for a key the items lack. True when the items changed.
      reconcile(keys, text) {
        let list = cur.items,
          prev = -1;
        // Right after switching chats the previous chat's turns can still be the visible ones: only
        // trust turns that overlap what we know. (An empty list takes them; the chat's own response
        // replaces them.)
        if (list.length && !keys.some((id) => list.some((x) => x.id === id))) return false;
        keys.forEach((id, k) => {
          let i = list.findIndex((x) => x.id === id);
          if (i < 0) {
            const q = text(id);
            if (!q) return;
            const next = keys
              .slice(k + 1)
              .map((n) => list.findIndex((x) => x.id === n))
              .find((j) => j >= 0);
            // After the previous turn's answer, i.e. before the next question; else before the next
            // mounted turn.
            const after = prev >= 0 ? list.findIndex((x, j) => j > prev && x.q != null) : -1;
            i = prev >= 0 ? (after < 0 ? list.length : after) : (next ?? list.length);
            list = [...list.slice(0, i), { id, q }, ...list.slice(i)];
          } else if (prev >= 0 && i > prev + 1) {
            const stale = list.slice(prev + 1, i).filter((x) => x.q != null).length;
            if (stale) {
              list = list.filter((x, j) => !(j > prev && j < i && x.q != null));
              i -= stale;
            }
          }
          prev = i;
        });
        if (list === cur.items) return false;
        setItems(cur, list);
        return true;
      },
    };
  }
  globalThis.ButterRailThread = ButterRailThread;
  if (typeof module !== 'undefined') module.exports = ButterRailThread;
})();
