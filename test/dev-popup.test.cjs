// The popup's dev slot (#46): the store popup renders nothing in it; the dev build's card and
// DEV tag go after the wordmark and before the footer, and its actions reach the dev worker.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const extension = path.join(__dirname, '../extension');
const read = (file) => fs.readFileSync(path.join(extension, file), 'utf8');
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise(setImmediate);
};

const popupSender = { id: 'butter', url: 'chrome-extension://butter/popup/popup.html' };

// One browser profile: extension storage shared by the worker and every popup opened on it.
function profile({ local = {}, shortcut = 'Alt+Shift+B', chat = true } = {}) {
  const changes = [];
  const area = (rows, name) => ({
    get: async (key) => structuredClone(key in rows ? { [key]: rows[key] } : {}),
    set: async (value) => {
      const change = {};
      for (const [k, v] of Object.entries(structuredClone(value)))
        change[k] = { oldValue: rows[k], newValue: (rows[k] = v) };
      changes.forEach((fn) => fn(structuredClone(change), name));
    },
  });
  const rows = { local, session: {} };
  const storage = {
    local: area(rows.local, 'local'),
    session: area(rows.session, 'session'),
    onChanged: { addListener: (fn) => changes.push(fn) },
  };
  const downloads = [],
    snapshots = [],
    messageListeners = [];
  // Every extension context in the profile sees the same chrome.* surface.
  const chrome = {
    storage,
    commands: { getAll: async () => [{ name: 'save-bug', shortcut }] },
    downloads: {
      download: async (options) => downloads.push(options),
      search: async () => [],
      onChanged: { addListener() {}, removeListener() {} },
      show() {},
      showDefaultFolder() {},
    },
    runtime: {
      id: 'butter',
      getURL: (file) => `chrome-extension://butter/${file}`,
      getManifest: () => ({ version_name: '0.1.0-alpha.15+dev.1' }),
      onMessage: { addListener: (fn) => messageListeners.push(fn) },
      // The popup's runtime messages reach the worker's listeners, as from an extension page.
      sendMessage: (message) =>
        new Promise((resolve) => {
          let handled = false;
          for (const fn of messageListeners)
            handled = fn(message, popupSender, (x) => resolve(structuredClone(x))) || handled;
          if (!handled) resolve(undefined);
        }),
    },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (_tab, message) => {
        if (!chat) throw new Error('Could not establish connection. Receiving end does not exist.');
        if (message.type === 'butter-dev-ping') return { chat: true };
        if (message.type === 'butter-dev-snapshot') {
          snapshots.push(message.request);
          return { snapshot: JSON.stringify({ savedAt: '2026-11-08T21:14:03' }) };
        }
        return { states: {} };
      },
    },
  };
  return { chrome, rows, downloads, snapshots };
}

// The dev service worker, with the store worker it imports.
function startWorker(p) {
  const ctx = vm.createContext({
    console,
    TextEncoder,
    URL,
    btoa,
    crypto: globalThis.crypto,
    chrome: {
      ...p.chrome,
      commands: { ...p.chrome.commands, onCommand: { addListener() {} } },
    },
    // Every importScripts path resolves against the worker script, dev/worker.js.
    importScripts: (...files) =>
      files.forEach((file) =>
        vm.runInContext(fs.readFileSync(path.resolve(extension, 'dev', file), 'utf8'), ctx),
      ),
  });
  vm.runInContext(read('dev/worker.js'), ctx);
}

// A popup page: the scripts popup.html loads, in order. `dev` adds dev/popup.js as the dev zip does.
function openPopup(p, { dev = true } = {}) {
  let html;
  const clicks = [];
  const root = {
    classList: { toggle() {} },
    addEventListener: (type, fn) => type === 'click' && clicks.push(fn),
    append() {},
  };
  const context = vm.createContext({
    ButterStatus: require('../extension/shared/status.js'),
    ButterPopup: require('../extension/popup/model.js'),
    structuredClone,
    chrome: p.chrome,
    document: {
      getElementById: () => root,
      documentElement: { classList: { toggle() {} } },
      createElement: () => ({
        set innerHTML(value) {
          html = value;
        },
        content: {},
      }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setInterval() {},
    clearInterval() {},
    setTimeout() {},
    clearTimeout() {},
    addEventListener() {},
  });
  context.globalThis = context;
  if (dev) vm.runInContext(read('dev/popup.js'), context);
  vm.runInContext(read('popup/popup.js'), context);
  return {
    html: () => html,
    // A click on the element carrying data-dev="<action>".
    click: (action) =>
      clicks.forEach((fn) =>
        fn({
          target: {
            closest: (selector) =>
              selector.includes('data-dev') ? { dataset: { dev: action }, disabled: false } : null,
          },
        }),
      ),
  };
}

const text = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const devCard = (html) =>
  html.match(/<div class="card dev">.*?<\/div><\/div>(?=\s*<div class="ft">)/s)?.[0];

test('without a dev renderer the slot renders nothing: no DEV tag, no dev card', async () => {
  const p = profile({
    local: { butter: { layoutConsent: 'granted' }, butterDev: { round: 2, bugs: 3 } },
  });
  const popup = openPopup(p, { dev: false });
  await settle();
  const html = popup.html();
  assert.match(html, /<div class="word">Butter<\/div><a class="ver"/);
  assert.match(html, /<\/label><div class="use[^"]*">.*?<\/div><\/div>\s*<div class="ft">/s);
  assert.doesNotMatch(html, /devtag|card dev|DEV|Round 2/);
});

test('the dev renderer puts the DEV tag after the wordmark and the card before the footer', async () => {
  const p = profile({
    local: { butter: { layoutConsent: 'granted' }, butterDev: { round: 2, bugs: 3 } },
  });
  startWorker(p);
  const popup = openPopup(p);
  await settle();
  const html = popup.html();
  assert.match(
    html,
    /<div class="word">Butter<\/div><span class="devtag">DEV<\/span><a class="ver"[^>]*>0\.1\.0-alpha\.15\+dev\.1<\/a>/,
  );
  const card = devCard(html);
  assert.ok(card, 'dev card right before the footer');
  assert.equal(text(card), 'Round 2 · 3 bugs Alt+Shift+B');
  assert.match(card, /title="Save bug snapshot" aria-label="Save bug snapshot"/);
  assert.match(card, /aria-label="Open round folder"/);
  assert.match(card, /aria-label="New round"/);
});

test('New round resets the count, survives a popup reopen, and the next button save is bug-01', async () => {
  const p = profile({
    local: { butter: { layoutConsent: 'granted' }, butterDev: { round: 2, bugs: 3 } },
  });
  startWorker(p);
  const first = openPopup(p);
  await settle();
  first.click('new-round');
  await settle();
  assert.match(text(devCard(first.html())), /^Round 3 · 0 bugs/);
  // Closing and reopening the popup reads the round back from storage.
  const reopened = openPopup(p);
  await settle();
  assert.match(text(devCard(reopened.html())), /^Round 3 · 0 bugs/);
  reopened.click('save');
  await settle();
  assert.equal(p.snapshots.at(-1).trigger, 'button');
  assert.deepEqual(
    p.downloads.map((d) => d.filename),
    ['butter-diag/round-3/bug-01_21-14-03.json'],
  );
  assert.deepEqual(p.rows.local.butterDev.round, 3);
  assert.deepEqual(p.rows.local.butterDev.bugs, 1);
  // Just saved: the file name, read as "Saved <file>", and no icon buttons.
  const card = devCard(reopened.html());
  assert.match(text(card), /^Saved bug-01_21-14-03\.json Alt\+Shift\+B$/);
  assert.doesNotMatch(card, /data-dev="new-round"|data-dev="open"/);
  assert.match(card, /data-dev="save"/);
});

test('in Chinese, and with no shortcut bound, the save button shows only its icon', async () => {
  const p = profile({
    local: { butter: { layoutConsent: 'granted', lang: 'zh' }, butterDev: { round: 2, bugs: 3 } },
    shortcut: '',
  });
  const popup = openPopup(p);
  await settle();
  const card = devCard(popup.html());
  assert.equal(text(card), '第 2 轮 · 3 个 bug');
  assert.doesNotMatch(card, /<kbd>/);
  assert.match(card, /title="保存 bug 快照" aria-label="保存 bug 快照"/);
});

test('off a ChatGPT chat the card says Not recording and the save button is disabled', async () => {
  const p = profile({
    local: { butter: { layoutConsent: 'granted' }, butterDev: { round: 1, bugs: 0 } },
    chat: false,
  });
  const popup = openPopup(p);
  await settle();
  const card = devCard(popup.html());
  assert.match(text(card), /^Not recording/);
  assert.match(card, /<button class="btn snap"[^>]* disabled[ >]/);
});
