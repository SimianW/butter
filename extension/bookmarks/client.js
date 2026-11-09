// ISOLATED world. The bookmark store's client, shared by bookmarks/content.js and bookmarks/notice.js:
// one version-1 runtime message to bookmarks/worker.js (docs/development.md, "Bookmarks store API").
// A storage failure (`bookmark-storage`) or a stopped worker closing the port is retried with the
// same request, which wakes the worker again, up to three times in all.
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
  };
})();
