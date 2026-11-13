// Isolated world. The bookmark session (`ButterBookmarkSession`): a tab's bookmarks over time. It
// owns which account and conversation are in view, the conversation's list (read once from the
// store, read again after it was unavailable, after bookmarks were off and after a Clear), the raw ids behind hashed ones (kept across
// unmounts: an answer that streamed in this tab is never in a page GET), the staleness last seen
// in the tab, the dots that grow in, and the store writes: create, remove and their Undo. It
// publishes `{ revision, groups }` toward the rail, where `revision` is the rail's revision of the
// items they were resolved against, and hands each save and remove to the notification with its
// Undo. Nothing is read while bookmarks are off (the rail or Bookmarks switched off, or Butter
// paused; back on, the list is read again), and nothing runs while a scrollbar drag is seeking: a
// read asked for then runs once when seeking ends. The popup's Clear drops every list (`cleared`).
// No DOM and no chrome.* here: bookmarks/content.js builds it over the store client and the page
// reader; test/bookmark-session.test.js over an in-memory store and planted pages.
//
// Adapters:
// - `store(type, fields)`: resolves to the worker's response (bookmarks/client.js `send`).
// - `hash(string)`: resolves to its SHA-256 hex digest, as layouts hash ids.
// - `page.answers()`: the answers rendered now, `[{ id, paragraphs() }]` by raw message id;
//   `paragraphs()` gives their texts, or undefined once the answer left the page.
//   `page.answered(questionId)`: that question's turn is mounted with an answer in it.
//   `page.locate(turn, rawId, bookmark)` and `page.wash(turn, rawId, bookmark, draw)`: the rail's
//   landing offset and wash (bookmarks/content.js `locate`, `washAt`).
// - `off()`: bookmarks are off: Butter paused, or the rail or Bookmarks switched off.
//   `requestAccount()`: asks history/conversation-main.js again.
// - `publish(conv, { revision, groups })`: toward ButterRail.setMarks. `revision` is null when
//   the groups were resolved against no items (no conversation or account, or the rail off).
// - `outcome(kind, bookmark, undo)`: 'saved', 'already' or 'removed', toward the notification;
//   `undo()` (none for 'already') takes the save or the remove back.
(() => {
  const B = globalThis.ButterBookmarks || require('./model.js');

  function ButterBookmarkSession({ store, hash, page, off, requestAccount, publish, outcome }) {
    let account = null; // the account hash; null until history/conversation-main.js sends it
    const digests = new Map();
    const digest = (s) => {
      if (!digests.has(s)) digests.set(s, hash(s));
      return digests.get(s);
    };
    const lists = new Map(); // `${account} ${conv}` -> Promise of that conversation's bookmarks
    const listOf = (owner, conv) => {
      const key = `${owner} ${conv}`;
      if (!lists.has(key))
        lists.set(
          key,
          digest(conv)
            .then((h) => store('butter-bookmark-list', { account: owner, conv: h }))
            .then((r) => {
              if (Array.isArray(r.bookmarks)) return r.bookmarks;
              lists.delete(key); // unavailable: try again the next time the rail asks
              return [];
            }),
        );
      return lists.get(key);
    };

    // ---- Marks for the rail: one per question that holds bookmarks.
    let view = { conv: null, items: [], revision: null },
      shownList = [], // the bookmarks of the conversation in view
      serial = 0,
      seeking = false,
      deferred = false,
      sent = '', // what the rail was last sent: question, bookmarks and their stale flags
      sentRevision = null; // and the revision it was sent with
    const rawOf = new Map(); // hashed message id -> raw id, for every message seen in this tab
    const fresh = new Set(); // keys of bookmarks just made in this tab: their dot grows in
    let onDots = new Set(); // keys of the bookmarks last sent on the earlier-history dots
    const seen = new Map(); // key -> stale, as last resolved in this tab; never stored (#55)
    // `quiet`: only a re-check of staleness, so the rail hears nothing when nothing changed: the
    // same groups for the same revision, none fresh.
    async function refresh(quiet = false) {
      const token = ++serial,
        { conv, items, complete, revision } = view,
        owner = account;
      if (seeking) {
        deferred = true;
        return;
      }
      // Nothing is read while bookmarks are off (Bookmarks or the rail switched off, or Butter
      // paused), and what was read is dropped: back on, the store is read again.
      const isOff = off();
      if (isOff) lists.clear();
      if (!conv || !owner || isOff) {
        if (!owner && !isOff) requestAccount();
        publish(conv, { revision: null, groups: new Map() });
        return;
      }
      // The answers rendered now: a version the list doesn't hold can be on screen.
      const rendered = page.answers(),
        ids = rendered.map((a) => a.id);
      const [bookmarks, hashes, shown] = await Promise.all([
        listOf(owner, conv),
        Promise.all(items.map((x) => digest(x.id))),
        Promise.all(ids.map(digest)),
      ]);
      if (token !== serial) return;
      // Kept, not rebuilt: an answer that streamed in this tab is never listed, so once ChatGPT
      // unmounts it its raw id is known only from when it was on the page. Message ids are unique.
      hashes.forEach((h, i) => rawOf.set(h, items[i].id));
      shown.forEach((h, i) => rawOf.set(h, ids[i]));
      shownList = bookmarks;
      const questions = items.filter((x) => x.q != null);
      const onPage = new Map(shown.map((h, i) => [h, rendered[i]]));
      const groups = B.resolve(
        bookmarks,
        items.map((x, i) => ({ msg: hashes[i], q: x.q != null })),
        {
          complete,
          paragraphs: (msg) => onPage.get(msg)?.paragraphs(),
          // Its turn is mounted with an answer in it: an answer that isn't the bookmarked one replaced it.
          mounted: (q) => page.answered(questions[q].id),
        },
        seen,
      );
      // A question's id, or B.EARLIER for the bookmarks in earlier history the rail hasn't loaded.
      const idOf = (g) => (g.question === B.EARLIER ? B.EARLIER : questions[g.question].id);
      const sig = JSON.stringify(
        groups.map((g) => [idOf(g), g.bookmarks.map((b) => [b.key, b.stale])]),
      );
      if (quiet && sig === sent && revision === sentRevision && !fresh.size) return;
      sent = sig;
      sentRevision = revision;
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
          land: (turn, b = first) => page.locate(turn, rawOf.get(b.msg), b),
          wash: (turn, b = first, draw = true) => page.wash(turn, rawOf.get(b.msg), b, draw),
          remove: (b) => remove(owner, conv, [b]),
        });
      }
      fresh.clear();
      onDots = dots;
      publish(conv, { revision, groups: marks });
    }
    const inView = (owner, conv) => owner === account && conv === view.conv;

    // The page's copy of a conversation's list: a bookmark made or brought back (its dot grows in),
    // or one deleted.
    const keep = (list, b) => {
      if (list.some((x) => x.key === b.key)) return;
      list.push(b);
      fresh.add(b.key);
    };
    const drop = (list, key) => {
      const at = list.findIndex((b) => b.key === key);
      if (at >= 0) list.splice(at, 1);
    };
    // Bookmark a passage of answer `id` (raw), under question `ask` (raw) in conversation `conv`
    // (raw): its paragraph, range, excerpt and first line's length as the page measured them.
    // "Bookmark saved" with Undo, which deletes it (then its dot goes), or "Already bookmarked".
    async function create({ id, ask, conv, para, start, end, excerpt, line }) {
      const owner = account;
      if (!id || !ask || !conv || !owner || !excerpt) return;
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
        start,
        end,
        excerpt,
        line,
        time: Date.now(),
      };
      const r = await store('butter-bookmark-create', { bookmark });
      if (!r.bookmark) return;
      const list = await listOf(owner, conv);
      if (r.created) keep(list, r.bookmark);
      if (inView(owner, conv)) refresh();
      if (!r.created) return outcome('already', r.bookmark);
      // Undo after the tab moved on still deletes from the bookmark's own conversation.
      outcome('saved', r.bookmark, async () => {
        const { account: a, conv: c, key } = r.bookmark;
        const d = await store('butter-bookmark-delete', { account: a, conv: c, key });
        if (!d.deleted) return;
        drop(list, key);
        if (inView(owner, conv)) refresh();
      });
    }
    // × on a rail card: deletes bookmarks from the store and from the page's copy of the list.
    // "Bookmark removed", whose Undo stores it again (the same key and time) and brings its dot back.
    async function remove(owner, conv, bookmarks) {
      const h = await digest(conv);
      const done = await Promise.all(
        bookmarks.map((b) =>
          store('butter-bookmark-delete', { account: owner, conv: h, key: b.key }).then(
            (r) => r.deleted !== undefined && b.key,
          ),
        ),
      );
      const list = await listOf(owner, conv);
      for (const key of done) if (key) drop(list, key);
      if (inView(owner, conv)) refresh();
      const gone = bookmarks.filter((b) => done.includes(b.key)).at(-1);
      if (gone)
        outcome('removed', gone, async () => {
          const r = await store('butter-bookmark-create', { bookmark: gone });
          if (!r.bookmark) return;
          keep(list, r.bookmark);
          if (inView(owner, conv)) refresh();
        });
    }

    // Staleness follows the page between renders: a regenerated answer or a switched version shows
    // after a click on the page, and the rail is checked again as the pointer or focus reaches it.
    // Neither happens while scrolling.
    let checks = [];
    return {
      get signedIn() {
        return !!account;
      },
      get seeking() {
        return seeking;
      },
      // The account hash from history/conversation-main.js. True when it changed.
      setAccount(id) {
        const next = B.hash(id) ? id : null;
        if (next === account) return false;
        account = next;
        refresh();
        return true;
      },
      // The rail rendered conversation `conv`'s `items` (raw ids, oldest first) at `revision`.
      // `complete`: they reach back to the conversation's start (no earlier page left to load).
      view(conv, items, complete = false, revision = null) {
        if (conv === view.conv && items === view.items && complete === view.complete) return;
        view = { conv, items, complete, revision };
        refresh();
      },
      // A scrollbar drag is seeking: reads wait, and one runs when it ends if any was asked for.
      seek(on) {
        seeking = on;
        if (!on && deferred) {
          deferred = false;
          refresh();
        }
      },
      // Settings changed: reads the conversation once bookmarks are on, or clears its marks.
      refresh: () => refresh(),
      // The popup's Clear emptied the store (its token): every list read is dropped, and the
      // conversation in view is read and published again, so its dots and card rows go.
      cleared() {
        lists.clear();
        shownList = [];
        refresh();
      },
      // The pointer or focus reached the rail: staleness is checked again now.
      check() {
        if (!seeking && shownList.length) refresh(true);
      },
      // A click on the page: checked again about 0.6 s and 2.5 s later.
      recheck() {
        if (seeking || !shownList.length) return;
        checks.forEach(clearTimeout);
        checks = [600, 2500].map((ms) => setTimeout(() => refresh(true), ms));
      },
      create,
    };
  }
  globalThis.ButterBookmarkSession = ButterBookmarkSession;
  if (typeof module !== 'undefined') module.exports = ButterBookmarkSession;
})();
