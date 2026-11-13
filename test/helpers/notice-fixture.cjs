// The bookmark notification's test tab (test/bookmark-notice.test.js): the real consent/card.js,
// bookmark session and notice.js in a vm over a fake shadow DOM, with chrome.storage shared between
// tabs and the real store client and worker store behind chrome.runtime.
const vm = require('node:vm');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const status = require('../../extension/shared/status.js');
const read = (file) => fs.readFileSync(require.resolve('../../extension/' + file), 'utf8');
const tick = () => new Promise(setImmediate);
const settle = async () => {
  for (let i = 0; i < 20; i++) await tick();
};

const sha = (s) => createHash('sha256').update(s).digest('hex');
const ACCOUNT = 'a'.repeat(64),
  CONV = '11111111-2222-4333-8444-555555555555';
const EXCERPT = 'Postgres skips an index when it expects';

function sharedStorage(initial) {
  let butter = initial;
  const listeners = [];
  return {
    storage: {
      local: {
        get: async () => ({ butter }),
        set: async (value) => {
          butter = value.butter;
          listeners.forEach((fn) => fn({ butter: { newValue: butter } }, 'local'));
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    value: () => butter,
  };
}

// An element with attributes and listeners; `parts` hands back one stand-in per selector, reset
// whenever its markup is replaced.
function element(name) {
  const attrs = {},
    listeners = {};
  let html = '',
    parts = {};
  return {
    name,
    hidden: false,
    style: {
      props: {},
      setProperty(k, v) {
        this.props[k] = v;
      },
    },
    get innerHTML() {
      return html;
    },
    set innerHTML(v) {
      html = v;
      parts = {};
    },
    querySelector: (sel) => (parts[sel] ||= { textContent: '' }),
    setAttribute: (k, v) => (attrs[k] = String(v)),
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => delete attrs[k],
    toggleAttribute(k, force = !(k in attrs)) {
      if (force) attrs[k] = '';
      else delete attrs[k];
      return force;
    },
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    fire: (type, e = {}) => (listeners[type] || []).forEach((fn) => fn({ type, ...e })),
    getBoundingClientRect: () => ({ left: 1050, right: 1350, top: 64, height: 66 }),
    focusCalls: 0,
    focus() {
      this.focusCalls++;
    },
  };
}

// One ChatGPT tab: the notification's host, its card and its click handler, over the shared
// settings and the worker store; the session shows CONV with its answer rendered.
function noticeTab(shared, store, { rail = null } = {}) {
  const timers = [],
    messages = [], // every store request the tab sent
    published = []; // what the session sent the rail
  let host, clicked;
  const card = element('section');
  const shadow = {
    append() {},
    querySelector: () => card,
    addEventListener: (type, fn) => (clicked = fn),
  };
  const ctx = {
    ButterStatus: status,
    ButterRail: rail,
    FontFace: class {
      load() {
        return Promise.resolve();
      }
    },
    innerHeight: 900,
    innerWidth: 1400,
    chrome: {
      storage: shared.storage,
      runtime: {
        getURL: (p) => 'chrome-extension://test/' + p,
        sendMessage: (m) => (messages.push(m), store.message(m)),
      },
    },
    document: {
      readyState: 'complete',
      fonts: { add() {} },
      documentElement: { classList: { contains: () => false }, append() {} },
      querySelectorAll: () => [],
      createElement: (type) => {
        if (type === 'chatgpt-butter-bookmark-notice') {
          host = element(type);
          host.hidden = true;
          host.attachShadow = () => shadow;
          return host;
        }
        if (type === 'section') return card;
        return element(type);
      },
    },
    getComputedStyle: () => ({ colorScheme: 'light' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class {
      observe() {}
    },
    ResizeObserver: class {
      observe() {}
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.fn = () => {};
    },
    requestAnimationFrame: (fn) => fn(),
    addEventListener() {},
  };
  vm.createContext(ctx);
  vm.runInContext(read('consent/card.js'), ctx);
  for (const file of ['bookmarks/model.js', 'bookmarks/client.js', 'bookmarks/session.js'])
    vm.runInContext(read(file), ctx);
  vm.runInContext(read('bookmarks/notice.js'), ctx);
  const session = ctx.ButterBookmarkSession({
    store: ctx.ButterBookmarkStore.send,
    hash: async (s) => sha(s),
    page: { answers: () => [{ id: 'a1', paragraphs: () => ['', '', EXCERPT] }] },
    off: () => false,
    requestAccount() {},
    publish: (conv, marks) => published.push(marks),
    outcome: (kind, b, undo) => ctx.ButterBookmarkNotice[kind](b, undo),
  });
  session.setAccount(ACCOUNT);
  session.view(CONV, [{ id: 'q1', q: 'Question' }, { id: 'a1' }], true, 1);
  const marks = () => published.at(-1)?.groups.get('q1'),
    row = (key) => marks().bookmarks.find((x) => x.key === key);
  const tab = {
    host: () => host,
    card,
    shown: () => !!host && host.hidden === false && host.inert === false,
    // What the card shows now.
    view: () => ({
      kind: card.className,
      html: card.innerHTML,
      excerpt: card.querySelector('.ex').textContent,
      role: card.getAttribute('role'),
      undo: card.innerHTML.includes('data-notice="undo"'),
      ok: card.innerHTML.includes('data-notice="ok"'),
    }),
    // A save through the session (the Bookmark cell or the shortcut); the stored bookmark.
    save: async (m) => {
      await session.create(m);
      await settle();
      return (await list(store, m.conv)).find((b) => b.para === m.para);
    },
    // × on the bookmark's rail card.
    remove: (b) => marks().remove(row(b.key)).then(settle),
    // The bookmarks the rail was last sent for the question, with their dot's `fresh`.
    rail: () => Array.from(marks()?.bookmarks ?? [], (b) => [b.key, marks().fresh]),
    deletes: () => messages.filter((m) => m.type === 'butter-bookmark-delete').length,
    // Runs the timers waiting `ms`, once.
    elapse: (ms) =>
      timers
        .filter((t) => t.ms === ms)
        .splice(0)
        .forEach((t) => {
          const fn = t.fn;
          t.fn = () => {};
          fn();
        }),
    waiting: (ms) => timers.some((t) => t.ms === ms && !/^\(\) => \{\}$/.test(String(t.fn))),
    // A click on the card's `choice` button; `stale` clicks a button of the card before this one.
    click: async (choice, { trusted = true, card: id } = {}) => {
      const now = /data-card="(\d+)"/.exec(card.innerHTML)?.[1];
      clicked({
        isTrusted: trusted,
        target: { closest: () => ({ dataset: { notice: choice, card: String(id ?? now) } }) },
      });
      await settle();
    },
    cardId: () => +/data-card="(\d+)"/.exec(card.innerHTML)?.[1],
  };
  return tab;
}
const list = async (store, conv = CONV) =>
  (await store.message({ type: 'butter-bookmark-list', account: ACCOUNT, conv: sha(conv) }))
    .bookmarks;
const stored = async (store) => (await list(store)).length;
const acknowledged = (o = {}) =>
  sharedStorage({ lang: 'en', bookmarkNotice: 'acknowledged', ...o });

module.exports = {
  settle,
  ACCOUNT,
  CONV,
  EXCERPT,
  sharedStorage,
  noticeTab,
  list,
  stored,
  acknowledged,
};
