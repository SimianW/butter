const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const codec = require('../../extension/seek/layout-codec.js');
const crypto = require('node:crypto').webcrypto;
function workerFixture({
  cap,
  now = Date.now(),
  initialLayout = true,
  initialSettings = { layoutConsent: 'granted', opts: { layout: initialLayout } },
  shortcut = 'Alt+Shift+M', // the key Chrome reports for the bookmark command
} = {}) {
  const disk = new Map(),
    state = new Map(),
    marks = new Map(),
    changes = [],
    events = [],
    settings = { butter: initialSettings };
  let changed;
  const listeners = [],
    commandListeners = [],
    tabMessages = [];
  const counters = { opens: 0, reads: 0, writes: 0 };
  const database = {
    transaction() {
      const tx = {};
      let completion;
      const touch = () => {
        if (completion) clearImmediate(completion);
        completion = setImmediate(() => tx.oncomplete?.());
      };
      tx.objectStore = (name) => {
        const data = name === 'state' ? state : name === 'bookmarks' ? marks : disk;
        const req = (fn) => {
          const r = {};
          touch();
          queueMicrotask(() => {
            r.result = structuredClone(fn());
            r.onsuccess?.();
          });
          return r;
        };
        return {
          get: (key) => req(() => data.get(key)),
          getAll: () =>
            req(() => {
              counters.reads++;
              return [...data.values()];
            }),
          put(x, key = x.key) {
            counters.writes++;
            data.set(key, structuredClone(x));
            touch();
          },
          delete(key) {
            data.delete(key);
            touch();
          },
          clear() {
            data.clear();
            touch();
          },
          index: () => ({
            getAll: ([account, conv]) =>
              req(() => {
                counters.reads++;
                return [...data.values()].filter((x) => x.account === account && x.conv === conv);
              }),
          }),
        };
      };
      touch();
      return tx;
    },
  };
  const chrome = {
    runtime: {
      id: 'butter-test',
      getURL: (file = '') => `chrome-extension://butter-test/${file}`,
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    commands: {
      getAll: async () => [
        { name: '_execute_action', shortcut: '' },
        { name: 'bookmark', shortcut },
      ],
      onCommand: { addListener: (fn) => commandListeners.push(fn) },
    },
    tabs: { sendMessage: async (tabId, message) => void tabMessages.push({ tabId, message }) },
    storage: {
      local: {
        get: async () => structuredClone(settings),
        set: async (value) => {
          Object.assign(settings, value);
          changes.push(value);
          for (const fn of events)
            fn(
              Object.fromEntries(Object.entries(value).map(([k, newValue]) => [k, { newValue }])),
              'local',
            );
        },
      },
      onChanged: { addListener: (fn) => (changed = fn) },
    },
  };
  const ctx = {
    ButterLayoutCodec: codec,
    ButterStatus: require('../../extension/shared/status.js'),
    crypto,
    chrome,
    TextEncoder,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    indexedDB: {
      open() {
        counters.opens++;
        const r = { result: database };
        queueMicrotask(() => r.onsuccess());
        return r;
      },
    },
  };
  let source = fs.readFileSync(
    path.join(__dirname, '../../extension/storage/layout-worker.js'),
    'utf8',
  );
  if (cap) source = source.replace('50_000_000', String(cap));
  // The worker's imports are globals here, except the bookmark store, which runs in the worker.
  const boot = (c) => {
    vm.createContext(c);
    c.importScripts = (...files) => {
      for (const file of files)
        if (file.startsWith('../bookmarks/'))
          vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../extension/storage', file), 'utf8'),
            c,
          );
    };
    vm.runInContext(source, c);
  };
  boot(ctx);
  return {
    disk,
    state,
    marks,
    restart: () => {
      listeners.length = 0; // the old worker is gone
      commandListeners.length = 0;
      boot({ ...ctx });
    },
    counters,
    changes,
    settings,
    events,
    message: (message, sender = { id: 'butter-test' }) =>
      new Promise((resolve) => {
        // As in Chrome: every listener sees the message, and the first response wins.
        const m = { version: 1, requestId: crypto.randomUUID(), ...message };
        let responded = false;
        const respond = (x) => {
          if (!responded) resolve(x);
          responded = true;
        };
        const handled = listeners.map((fn) => fn(m, sender, respond)).some((x) => x === true);
        if (!handled && !responded) resolve(undefined);
      }),
    setting: (layout) => {
      settings.butter = { layoutConsent: 'granted', opts: { layout } };
      changed({ butter: { newValue: settings.butter } }, 'local');
    },
    changeSettings: (butter) => {
      settings.butter = butter;
      changed({ butter: { newValue: butter } }, 'local');
    },
    advance: (ms) => (now += ms),
    // Chrome runs an extension command (its key was pressed) in this tab.
    command: (name, tab) => commandListeners.forEach((fn) => fn(name, tab)),
    tabMessages,
    setShortcut: (key) => (shortcut = key),
  };
}
function attachStorage(ctx, events, worker = workerFixture()) {
  ctx.ButterLayoutCodec = codec;
  ctx.CustomEvent = class {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const event = (name, detail) => {
    for (const fn of events[name] || []) fn({ detail });
  };
  ctx.document.dispatchEvent = (e) => event(e.type, e.detail);
  (events['butter-layout-request'] ||= []).push(async (e) => {
    const m = JSON.parse(e.detail);
    if (m.op === 'state') {
      event('butter-layout-response', JSON.stringify({ state: true, enabled: true }));
      return;
    }
    const result = await worker.message({ type: 'butter-layout-' + m.op, ...m });
    event('butter-layout-response', JSON.stringify({ id: m.id, ...result }));
  });
  worker.events.push((changes) => {
    if (changes.butterLayoutCleared)
      event('butter-layout-response', JSON.stringify({ cleared: true }));
  });
  ctx.queueMicrotask ||= queueMicrotask;
  return { worker, event, account: () => event('butter-account', 'a'.repeat(64)) };
}
module.exports = { workerFixture, attachStorage };
