// ISOLATED world. The bookmark worker's client, shared by bookmarks/content.js and bookmarks/notice.js:
// version-1 runtime messages to bookmarks/worker.js (docs/runtime-api.md, "Bookmarks store API").
// A storage failure (`bookmark-storage`) or a stopped worker closing the port is retried with the
// same request, which wakes the worker again, up to three times in all. It also reports the
// popup's Clear (its token in local storage). The Bookmark command's key: commands/keys.js.
(() => {
  const TRIES = 3;
  globalThis.ButterBookmarkStore = {
    // Resolves to the worker's response, or `{ error: 'bookmark-storage' }` once every try failed.
    async send(type, fields) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        try {
          const r = await chrome.runtime.sendMessage({ version: 1, type, ...fields });
          if (r && r.error !== 'bookmark-storage') return r;
        } catch {}
      }
      return { error: 'bookmark-storage' };
    },
    // `fn()` runs each time the popup's Clear has emptied the store (bookmarks/worker.js's token).
    cleared(fn) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.butterBookmarksCleared) fn();
      });
    },
  };
})();
