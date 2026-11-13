// Loaded by the service worker (storage/layout-worker.js, which defines `database`, `request` and
// the `serial` queue). Bookmarks live in the extension-origin database that saved layouts use, in
// their own object store, keyed by ButterBookmarks.key and indexed by account and hashed
// conversation. They share nothing else with layouts: no "Remember long-chat layouts" switch, no
// consent, no expiry, no byte cap or eviction; the layout Clear never touches them and the
// bookmark Clear never touches layouts.
// The popup's usage and Clear cover the whole store (every account and conversation), so they
// are taken only from extension pages, never from a tab's content script.
(() => {
  const B = ButterBookmarks;
  const TYPES = ['butter-bookmark-list', 'butter-bookmark-create', 'butter-bookmark-delete'];
  const POPUP = ['butter-bookmark-usage', 'butter-bookmark-clear'];
  async function bookmarks(work, stores = ['bookmarks']) {
    const db = await database(),
      tx = db.transaction(stores, 'readwrite');
    const done = new Promise((ok, no) => {
      tx.oncomplete = ok;
      tx.onabort = tx.onerror = () => no(tx.error);
    });
    const result = await work(...stores.map((name) => tx.objectStore(name)));
    await done;
    return result;
  }
  // The store's size as the popup shows it: the count, and the UTF-8 length of each row as JSON,
  // summed (an estimate: "about").
  const encoder = new TextEncoder();
  const measure = (all) => ({
    count: all.length,
    bytes: all.reduce((sum, x) => sum + encoder.encode(JSON.stringify(x)).length, 0),
  });
  const usage = () => bookmarks(async (rows) => measure(await request(rows.getAll())));
  // Clear empties the store once per request id: the popup retries the identical request, which
  // must not delete a bookmark saved after the first try went through. Then every tab hears the
  // token and drops its lists.
  async function clear(requestId) {
    const result = await bookmarks(
      async (rows, state) => {
        const clears = (await request(state.get('bookmarkClears'))) || [];
        if (clears.some((x) => x.id === requestId)) return measure(await request(rows.getAll()));
        state.put([...clears, { id: requestId, time: Date.now() }].slice(-64), 'bookmarkClears');
        rows.clear();
        return { count: 0, bytes: 0, cleared: true };
      },
      ['bookmarks', 'state'],
    );
    if (!result.cleared) return result;
    await chrome.storage.local.set({ butterBookmarksCleared: crypto.randomUUID() });
    return { count: 0, bytes: 0 };
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
  // The bookmark shortcut is the `bookmark` command (manifest.json): its key, rebindable in Chrome's
  // shortcut settings, asks the tab it was pressed in to bookmark the selection or the top paragraph.
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'bookmark' || tab?.id == null) return;
    chrome.tabs
      .sendMessage(tab.id, { version: 1, type: 'butter-bookmark-shortcut' })
      .catch(() => {}); // not a ChatGPT tab: no content script answers
  });
  // Content scripts can't read chrome.commands: the tooltip asks here for the key Chrome reports.
  const shortcut = async () =>
    (await chrome.commands.getAll()).find((c) => c.name === 'bookmark')?.shortcut ?? '';
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (POPUP.includes(message?.type)) {
      if (sender.tab) respond({ error: 'bookmark-sender' });
      else if (
        message.version !== 1 ||
        (message.type === 'butter-bookmark-clear' &&
          (typeof message.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(message.requestId)))
      )
        respond({ error: 'bookmark-protocol' });
      else {
        const work =
          message.type === 'butter-bookmark-usage' ? usage : () => clear(message.requestId);
        serial(work).then(respond, () => respond({ error: 'bookmark-storage' }));
        return true;
      }
      return;
    }
    if (!TYPES.includes(message?.type) && message?.type !== 'butter-bookmark-key') return;
    if (message.version !== 1) {
      respond({ error: 'bookmark-protocol' });
      return;
    }
    if (message.type === 'butter-bookmark-key') {
      shortcut().then(
        (key) => respond({ shortcut: key }),
        () => respond({ shortcut: '' }),
      );
      return true;
    }
    serial(() => handle(message)).then(respond, () => respond({ error: 'bookmark-storage' }));
    return true;
  });
})();
