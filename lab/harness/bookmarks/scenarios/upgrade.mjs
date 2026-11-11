// Existing users have a version-1 database with saved layouts: the upgrade keeps them and adds the
// bookmarks store. Reaches into the worker's connection (`opened`, `database()`) to rebuild a
// version-1 database, then leaves the layouts empty again.
export default {
  name: 'upgrade',
  description: 'A version-1 database upgrades with its layouts kept and a bookmarks store added',
  async run({ worker, check }) {
    const upgrade = await worker.evaluate(async () => {
      const done = (r) => new Promise((ok, no) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => no(r.error))));
      (await opened)?.close();
      opened = null;
      await done(indexedDB.deleteDatabase('butter-layouts-v1'));
      const v1 = indexedDB.open('butter-layouts-v1', 1);
      v1.onupgradeneeded = () => {
        v1.result.createObjectStore('geometry', { keyPath: 'key' }).createIndex('conversation', ['account', 'conv']);
        v1.result.createObjectStore('state');
        v1.transaction.objectStore('geometry').put({ key: 'fixture-row', account: 'a', conv: 'c' });
        v1.transaction.objectStore('state').put(3, 'generation');
      };
      (await done(v1)).close();
      const db = await database();
      const tx = db.transaction(['geometry', 'state', 'bookmarks']);
      return {
        version: db.version,
        stores: [...db.objectStoreNames],
        row: !!(await done(tx.objectStore('geometry').get('fixture-row'))),
        generation: await done(tx.objectStore('state').get('generation')),
        index: [...tx.objectStore('bookmarks').indexNames],
      };
    });
    check('a version-1 database upgrades with its layouts kept and a bookmarks store added',
      upgrade.version === 2 && upgrade.row && upgrade.generation === 3 && upgrade.stores.includes('bookmarks') &&
        upgrade.index.includes('conversation'), upgrade);
    await worker.evaluate(() => {
      const tx = opened.then((db) => db.transaction('geometry', 'readwrite').objectStore('geometry').clear());
      return tx.then(() => {});
    });
  },
};
