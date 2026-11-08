// Loaded by the service worker (storage/layout-worker.js, which defines `database`, `request` and
// the `serial` queue). Bookmarks live in the extension-origin database that saved layouts use, in
// their own object store, keyed by ButterBookmarks.key and indexed by account and hashed
// conversation. They share nothing else with layouts: no "Remember long-chat layouts" switch, no
// consent, no expiry, no byte cap or eviction, and the layout Clear never touches them.
(() => {
  const B = ButterBookmarks;
  const TYPES = ['butter-bookmark-list', 'butter-bookmark-create', 'butter-bookmark-delete'];
  async function bookmarks(work) {
    const db = await database(),
      tx = db.transaction(['bookmarks'], 'readwrite');
    const done = new Promise((ok, no) => {
      tx.oncomplete = ok;
      tx.onabort = tx.onerror = () => no(tx.error);
    });
    const result = await work(tx.objectStore('bookmarks'));
    await done;
    return result;
  }
  const row = (x) => {
    const b = B.clean(x);
    return b && x.key === B.key(b) ? { ...b, key: x.key } : null;
  };
  function handle(m) {
    const identity = m.type === 'butter-bookmark-create' ? m.bookmark : m;
    if (!B.hash(identity?.account) || !B.hash(identity?.conv))
      return { error: 'bookmark-identity' };
    if (m.type === 'butter-bookmark-list')
      return bookmarks(async (rows) => ({
        bookmarks: (await request(rows.index('conversation').getAll([m.account, m.conv])))
          .map(row)
          .filter((b) => b && b.account === m.account && b.conv === m.conv),
      }));
    if (m.type === 'butter-bookmark-create') {
      const b = B.clean(m.bookmark);
      if (!b) return { error: 'bookmark-protocol' };
      const key = B.key(b);
      return bookmarks(async (rows) => {
        const previous = row((await request(rows.get(key))) || {});
        if (previous) return { bookmark: previous, created: false };
        rows.put({ ...b, key });
        return { bookmark: { ...b, key }, created: true };
      });
    }
    if (typeof m.key !== 'string') return { error: 'bookmark-protocol' };
    return bookmarks(async (rows) => {
      const previous = row((await request(rows.get(m.key))) || {});
      if (!previous || previous.account !== m.account || previous.conv !== m.conv)
        return { deleted: false };
      rows.delete(m.key);
      return { deleted: true };
    });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !TYPES.includes(message?.type)) return;
    if (message.version !== 1) {
      respond({ error: 'bookmark-protocol' });
      return;
    }
    serial(() => handle(message)).then(respond, () => respond({ error: 'bookmark-storage' }));
    return true;
  });
})();
