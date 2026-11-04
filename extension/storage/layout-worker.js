// Extension-origin IndexedDB. A single queue serializes clears, LRU updates and quota eviction.
importScripts('../seek/layout-codec.js', '../shared/status.js');
let statusQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'butter-status-record') return;
  statusQueue = statusQueue
    .catch(() => {})
    .then(async () => {
      const { butterFailures } = await chrome.storage.session.get('butterFailures');
      const failures = ButterStatus.updateFailures(butterFailures, message.states);
      await chrome.storage.session.set({ butterFailures: failures });
      return failures;
    });
  statusQueue.then(respond, () => respond({}));
  return true;
});
const codec = ButterLayoutCodec;
const TTL = 30 * 24 * 60 * 60 * 1000,
  CAP = 50_000_000;
let enabled = false,
  consent = 'pending',
  settingsVersion = 0,
  queue = Promise.resolve(),
  opened;
const settingsReady = chrome.storage.local.get('butter').then(({ butter }) => {
  if (!settingsVersion) {
    const settings = ButterStatus.normalize(butter);
    enabled = settings.opts.layout;
    consent = settings.layoutConsent;
  }
});
const request = (r) =>
  new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
function database() {
  return (opened ||= new Promise((ok, no) => {
    const r = indexedDB.open('butter-layouts-v1', 1);
    r.onupgradeneeded = () => {
      const rows = r.result.createObjectStore('geometry', { keyPath: 'key' });
      rows.createIndex('conversation', ['account', 'conv']);
      r.result.createObjectStore('state');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => {
      opened = null;
      no(r.error);
    };
  }));
}
async function transaction(work) {
  const db = await database(),
    tx = db.transaction(['geometry', 'state'], 'readwrite');
  const done = new Promise((ok, no) => {
    tx.oncomplete = ok;
    tx.onabort = tx.onerror = () => no(tx.error);
  });
  const result = await work(tx.objectStore('geometry'), tx.objectStore('state'));
  await done;
  return result;
}
const serial = (fn) => {
  const next = queue.then(() => fn());
  queue = next.catch(() => {});
  return next;
};
async function clear(requestId) {
  const result = await transaction(async (rows, state) => {
    const clears = (await request(state.get('clears'))) || [];
    if (requestId && clears.some((x) => x.id === requestId)) return { conversations: 0, bytes: 0 };
    const generation = ((await request(state.get('generation'))) || 0) + 1;
    if (requestId) state.put([...clears, { id: requestId, time: Date.now() }].slice(-64), 'clears');
    rows.clear();
    state.put(generation, 'generation');
    return { conversations: 0, bytes: 0 };
  });
  await chrome.storage.local.set({ butterLayoutCleared: crypto.randomUUID() });
  return result;
}
function expired(x, now) {
  return !Number.isFinite(x.time) || now - x.time > TTL || x.time > now + 60000;
}
// No volatile byte total: reconstruct accounting from durable rows on every operation, including
// the first message after a worker restart. The transaction commits eviction and writes together.
const measure = (row) => {
  let size = codec.bytes(row);
  while (row.bytes !== size) {
    row.bytes = size;
    size = codec.bytes(row);
  }
  return size;
};
async function reconcile(rows, now) {
  const all = await request(rows.getAll());
  let bytes = 0;
  const keep = [];
  for (const value of all) {
    const clean = codec.clean(value);
    if (
      !clean ||
      value.key !== codec.key(clean) ||
      expired(clean, now) ||
      !Number.isFinite(value.used) ||
      value.used < 0 ||
      value.used > now + 60000
    ) {
      rows.delete(value.key);
    } else {
      const x = { ...clean, key: codec.key(clean), used: value.used, bytes: 0 };
      bytes += measure(x);
      // Rebuild the allowlist before any maintenance write as well as before returning a row.
      if (JSON.stringify(value) !== JSON.stringify(x)) rows.put(x);
      keep.push(x);
    }
  }
  keep.sort((a, b) => a.used - b.used || a.time - b.time || a.key.localeCompare(b.key));
  while (bytes > CAP && keep.length) {
    const x = keep.shift();
    rows.delete(x.key);
    bytes -= x.bytes;
  }
  return {
    conversations: new Set(keep.map((x) => JSON.stringify([x.account, x.conv]))).size,
    bytes,
  };
}
async function handle(message) {
  await settingsReady;
  const op = message.type;
  if (op === 'butter-layout-clear')
    return consent === 'pending' ? { conversations: 0, bytes: 0 } : clear(message.requestId);
  if (!enabled)
    return op === 'butter-layout-usage' ? { conversations: 0, bytes: 0 } : { records: [] };
  if (
    ['butter-layout-load', 'butter-layout-put'].includes(op) &&
    (!codec.hash(message.account) || !codec.hash(message.conv))
  )
    return { records: [] };
  return transaction(async (rows, state) => {
    const now = Date.now(),
      generation = (await request(state.get('generation'))) || 0;
    if (op === 'butter-layout-load') {
      let bytes = (await reconcile(rows, now)).bytes;
      const found = await request(
        rows.index('conversation').getAll([message.account, message.conv]),
      );
      const records = [];
      for (const x of found) {
        if (!codec.valid(x) || x.key !== codec.key(x) || expired(x, now)) rows.delete(x.key);
        else {
          const previousBytes = x.bytes;
          x.used = now;
          bytes += measure(x) - previousBytes;
          rows.put(x);
          records.push(codec.clean(x));
        }
      }
      if (bytes > CAP) await reconcile(rows, now);
      return { generation, records: records.filter(Boolean) };
    }
    if (op === 'butter-layout-put') {
      if (
        message.generation !== generation ||
        !codec.hash(message.account) ||
        !codec.hash(message.conv)
      )
        return {};
      for (const value of Array.isArray(message.records) && message.records.length <= 256
        ? message.records
        : []) {
        const x = codec.clean(value);
        if (!x || x.account !== message.account || x.conv !== message.conv || expired(x, now))
          continue;
        const key = codec.key(x),
          previous = await request(rows.get(key));
        if (previous && previous.time > x.time) continue;
        const row = { ...x, key, used: now, bytes: 0 };
        measure(row);
        if (row.bytes <= CAP) rows.put(row);
      }
    }
    return reconcile(rows, now);
  });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    ![
      'butter-layout-load',
      'butter-layout-put',
      'butter-layout-usage',
      'butter-layout-clear',
    ].includes(message?.type)
  )
    return;
  if (
    message.version !== 1 ||
    (message.type === 'butter-layout-clear' &&
      (typeof message.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(message.requestId)))
  ) {
    respond({ error: 'layout-protocol' });
    return;
  }
  serial(() => handle(message)).then(respond, () => respond({ error: 'layout-storage' }));
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.butter) return;
  settingsVersion++;
  const settings = ButterStatus.normalize(changes.butter.newValue);
  enabled = settings.opts.layout;
  consent = settings.layoutConsent;
  if (!enabled && consent !== 'pending') serial(clear);
});
serial(async () => {
  await settingsReady;
  if (!enabled && consent !== 'pending') await clear();
});
