// The bookmark store of the run's own unpacked install (IndexedDB `butter-layouts-v1`, read in its
// worker). Only this install's database is read, and no stored record is returned to Node.
export function storeOps(worker) {
  // The number of stored bookmarks.
  const count = () =>
    worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        return await new Promise((ok, no) => {
          const r = db.transaction('bookmarks').objectStore('bookmarks').count();
          r.onsuccess = () => ok(r.result);
          r.onerror = no;
        });
      } finally {
        db.close();
      }
    });
  // Every stored bookmark removed: the fallback cleanup, after the card's own delete controls.
  const clear = () =>
    worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        await new Promise((ok, no) => {
          const tx = db.transaction('bookmarks', 'readwrite');
          tx.objectStore('bookmarks').clear();
          tx.oncomplete = ok;
          tx.onerror = no;
        });
      } finally {
        db.close();
      }
    });
  return { count, clear };
}
