// ISOLATED world. The bookmark worker's client, shared by bookmarks/content.js and bookmarks/notice.js:
// version-1 runtime messages to bookmarks/worker.js (docs/development.md, "Bookmarks store API").
// A storage failure (`bookmark-storage`) or a stopped worker closing the port is retried with the
// same request, which wakes the worker again, up to three times in all. It also reports the
// popup's Clear (its token in local storage) and reads the Bookmark command's key.
(() => {
  const TRIES = 3;
  let key = null, // the key Chrome reports for the command; null until read
    reading = false;
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
    // The Bookmark command's key ('' for none). Content scripts can't read chrome.commands, so the
    // worker answers. Read again on each `readKey`, since the reader may change it in Chrome's
    // settings; `changed()` runs when it differs from the last read.
    get key() {
      return key;
    },
    async readKey(changed) {
      if (reading) return;
      reading = true;
      let next = '';
      try {
        const r = await chrome.runtime.sendMessage({ version: 1, type: 'butter-bookmark-key' });
        next = typeof r?.shortcut === 'string' ? r.shortcut : '';
      } catch {}
      reading = false;
      if (next === key) return;
      key = next;
      changed();
    },
  };
})();
