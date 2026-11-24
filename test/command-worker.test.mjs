// The command keys module's worker side (commands/worker.js), loaded by the service worker as
// Chrome loads it: it relays a pressed command to its tab and tells a page which key Chrome reports.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const extension = new URL('../extension/', import.meta.url).pathname;

// The real service worker over a fake chrome. `shortcuts` is what chrome.commands.getAll reports;
// `failSend` makes chrome.tabs.sendMessage reject (no content script in that tab).
function worker({
  shortcuts = { bookmark: 'Alt+Shift+M', branch: 'Alt+Shift+Q', 'new-chat': 'Alt+Shift+O' },
  failSend,
} = {}) {
  const listeners = [],
    commands = [],
    sent = [],
    rejected = [];
  const area = () => ({ get: async () => ({}), set: async () => {}, remove: async () => {} });
  const ctx = vm.createContext({
    console,
    TextEncoder,
    URL,
    crypto: globalThis.crypto,
    setTimeout,
    chrome: {
      runtime: {
        id: 'butter',
        getURL: (file = '') => `chrome-extension://butter/${file}`,
        onMessage: { addListener: (fn) => listeners.push(fn) },
        onInstalled: { addListener() {} },
      },
      commands: {
        getAll: async () => [
          { name: '_execute_action', shortcut: 'Alt+Shift+K' },
          ...Object.entries(shortcuts).map(([name, shortcut]) => ({ name, shortcut })),
        ],
        onCommand: { addListener: (fn) => commands.push(fn) },
      },
      storage: { local: area(), session: area(), onChanged: { addListener() {} } },
      tabs: {
        sendMessage: (tabId, message) => {
          if (!failSend) return Promise.resolve(void sent.push({ tabId, ...message }));
          const p = Promise.reject(new Error('Receiving end does not exist.'));
          rejected.push(p);
          return p;
        },
      },
    },
    importScripts: (...files) =>
      files.forEach((file) =>
        vm.runInContext(fs.readFileSync(path.resolve(extension, 'storage', file), 'utf8'), ctx),
      ),
  });
  vm.runInContext(fs.readFileSync(path.join(extension, 'storage/layout-worker.js'), 'utf8'), ctx);
  const press = (command, tab) => commands.forEach((fn) => fn(command, tab));
  const ask = (message, sender = {}) =>
    new Promise((done) => {
      // Responses come from the worker's realm; compare plain copies.
      const resolve = (x) => done(x === undefined ? x : JSON.parse(JSON.stringify(x)));
      let handled = false;
      for (const fn of listeners)
        handled = fn({ version: 1, ...message }, { id: 'butter', ...sender }, resolve) || handled;
      if (!handled) resolve(undefined);
    });
  return { press, ask, sent, rejected };
}
const tab = { id: 7, url: 'https://chatgpt.com/c/x' };
const settle = () => new Promise(setImmediate);

test('each listed command is relayed to the tab it was pressed in, by name', async () => {
  const w = worker();
  w.press('branch', tab);
  w.press('bookmark', { ...tab, id: 9 });
  w.press('new-chat', { ...tab, id: 11 });
  await settle();
  assert.deepEqual(w.sent, [
    { tabId: 7, version: 1, type: 'butter-command', command: 'branch' },
    { tabId: 9, version: 1, type: 'butter-command', command: 'bookmark' },
    { tabId: 11, version: 1, type: 'butter-command', command: 'new-chat' },
  ]);
});

test('an unlisted command, or a press with no tab, sends nothing', async () => {
  const w = worker();
  w.press('save-bug', tab); // the dev build's own command: its own listener
  w.press('_execute_action', tab);
  w.press('branch', undefined); // a browser page: no tab to ask
  w.press('branch', {});
  await settle();
  assert.deepEqual(w.sent, []);
});

test('a tab that is not ChatGPT rejects the relay, and the worker swallows it', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  const w = worker({ failSend: true });
  w.press('branch', tab);
  w.press('new-chat', { id: 3, url: 'https://example.com/' });
  assert.equal(w.rejected.length, 2);
  await settle();
  await settle();
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(unhandled, []);
});

test('the key answer is the key Chrome reports, or none', async () => {
  const w = worker({ shortcuts: { bookmark: 'Alt+Shift+M', branch: '' } });
  assert.deepEqual(await w.ask({ type: 'butter-command-key', command: 'bookmark' }), {
    shortcut: 'Alt+Shift+M',
  });
  assert.deepEqual(await w.ask({ type: 'butter-command-key', command: 'branch' }), {
    shortcut: '',
  });
});

test('a command Chrome does not list, or one outside the closed list, has no key', async () => {
  const w = worker({ shortcuts: { bookmark: 'Alt+Shift+M' } });
  assert.deepEqual(await w.ask({ type: 'butter-command-key', command: 'branch' }), {
    shortcut: '',
  });
  for (const command of ['_execute_action', 'save-bug', undefined])
    assert.deepEqual(await w.ask({ type: 'butter-command-key', command }), { shortcut: '' });
});

test('another extension cannot ask; another protocol version is refused', async () => {
  const w = worker();
  assert.equal(
    await w.ask({ type: 'butter-command-key', command: 'branch' }, { id: 'other' }),
    undefined,
  );
  for (const version of [2, 0, undefined])
    assert.deepEqual(await w.ask({ type: 'butter-command-key', command: 'branch', version }), {
      error: 'command-protocol',
    });
});

test('the old bookmark-only messages are gone', async () => {
  const w = worker();
  assert.equal(await w.ask({ type: 'butter-bookmark-key' }), undefined);
  w.press('bookmark', tab);
  await settle();
  assert.equal(
    w.sent.some((m) => m.type === 'butter-bookmark-shortcut'),
    false,
  );
});
