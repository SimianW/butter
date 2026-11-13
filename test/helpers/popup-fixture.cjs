// The real popup (popup/popup.js) in a vm, with startup storage reads the test resolves by hand
// and the worker's answers by message type: test/popup-startup.test.cjs and popup-storage.test.cjs.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const status = require('../../extension/shared/status.js');
const tick = () => new Promise(setImmediate);

// Loads the real popup with startup storage reads the test resolves by hand.
// `answers[type]` is the worker's answer to a runtime message of that type (a function of the
// message, or a value); `timers` holds the popup's timeouts for the test to run.
function popup(answers = {}) {
  let changed, resolveLocal, resolveSession, click, html;
  const saved = [],
    sent = [],
    timers = [];
  const usage = {
    'butter-layout-usage': { conversations: 0, bytes: 0 },
    'butter-bookmark-usage': { count: 0, bytes: 0 },
    ...answers,
  };
  const context = vm.createContext({
    ButterStatus: status,
    ButterPopup: require('../../extension/popup/model.js'),
    structuredClone,
    chrome: {
      storage: {
        local: {
          get: () => new Promise((resolve) => (resolveLocal = resolve)),
          set: async (value) => saved.push(structuredClone(value)),
        },
        session: { get: () => new Promise((resolve) => (resolveSession = resolve)) },
        onChanged: { addListener: (fn) => (changed = fn) },
      },
      runtime: {
        getManifest: () => ({ version_name: '0.1.0-alpha.10' }),
        sendMessage: async (m) => {
          sent.push(m);
          const a = usage[m.type];
          return typeof a === 'function' ? a(m) : a;
        },
      },
      tabs: { query: async () => [] },
    },
    document: {
      getElementById: () => ({
        classList: { toggle() {} },
        addEventListener: (type, fn) => (click = fn),
        append() {},
        querySelector: () => null,
      }),
      documentElement: { classList: { toggle() {} } },
      createElement: () => ({
        set innerHTML(value) {
          html = value;
        },
        content: {},
      }),
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    setInterval() {},
    clearInterval() {},
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout() {},
    addEventListener() {},
  });
  const source = path.join(__dirname, '../../extension/popup/popup.js');
  vm.runInContext(fs.readFileSync(source, 'utf8'), context);
  return {
    changed: (...args) => changed(...args),
    finish: (local, session) => {
      resolveLocal(local);
      resolveSession(session);
    },
    html: () => html,
    saved,
    sent,
    timers,
    toggle: (key) => click({ target: { closest: () => ({ dataset: { switch: key } }) } }),
    // A Clear, red Clear or Cancel button of a storage row ('bookmarks' or 'layouts').
    clear: (store, step) =>
      click({ target: { closest: () => ({ dataset: { clear: step, store } }) } }),
    read: (expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
  };
}

// Each row's switch, name and description, in display order. A row is a label that wraps its
// switch, so the regex only matches a switch found before the row's closing tag.
// The description is the second line's text; a storage row's Clear button shows as "[Clear]".
const text = (html) =>
  html.replace(/<button [^>]*>(.*?)<\/button>/g, '[$1]').replace(/<[^>]+>/g, '');
const rows = (html) =>
  [
    ...html.matchAll(
      /<label class="row[^"]*"[^>]*>(?:(?!<\/label>).)*?<div class="n">(.*?)<\/div><div class="d"[^>]*>(.*?)<\/div>(?:(?!<\/label>).)*?<button [^>]*role="switch" aria-checked="(\w+)"[^>]*data-switch="(\w+)"[^>]*><\/button><\/label>/g,
    ),
  ].map(([, name, description, on, key]) => ({
    key,
    name,
    description: text(description),
    on: on === 'true',
  }));

const descriptions = (html) => Object.fromEntries(rows(html).map((r) => [r.key, r.description]));
module.exports = { popup, rows, descriptions, tick };
