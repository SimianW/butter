// Dev build toast (#45): extension/dev/toast.js in the isolated world, over a small fake DOM and
// a virtual clock. The worker tells the tab after a save; the toast reads the saved file's bug and
// round numbers in Butter's language, never takes focus or pointer events, and goes after ~2 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const status = require('../extension/shared/status.js');

const source = fs.readFileSync(require.resolve('../extension/dev/toast.js'), 'utf8');
const tick = () => new Promise(setImmediate);

function tab({ butter = {}, dark = false } = {}) {
  let now = 0,
    listener;
  const timers = [];
  const root = {
    children: [],
    classList: { contains: (name) => dark && name === 'dark' },
    append(el) {
      el.parentNode = root;
      root.children.push(el);
    },
  };
  const body = { tagName: 'BODY' };
  const document = {
    documentElement: root,
    body,
    activeElement: body,
    fonts: { add() {} },
    createElement(tag) {
      const attrs = {},
        props = {};
      return {
        tagName: tag.toUpperCase(),
        parentNode: null,
        style: {
          setProperty: (name, value, priority = '') => (props[name] = { value, priority }),
          getPropertyValue: (name) => props[name]?.value ?? '',
          getPropertyPriority: (name) => props[name]?.priority ?? '',
        },
        setAttribute: (name, value) => (attrs[name] = String(value)),
        getAttribute: (name) => attrs[name] ?? null,
        hasAttribute: (name) => name in attrs,
        removeAttribute: (name) => delete attrs[name],
        toggleAttribute(name, force) {
          if (force) attrs[name] = '';
          else delete attrs[name];
          return !!force;
        },
        attachShadow() {
          this.shadowRoot = { innerHTML: '' };
          return this.shadowRoot;
        },
        focus() {
          document.activeElement = this;
        },
        remove() {
          if (!this.parentNode) return;
          root.children.splice(root.children.indexOf(this), 1);
          this.parentNode = null;
        },
      };
    },
  };
  const storage = { butter };
  vm.runInNewContext(source, {
    ButterStatus: status,
    document,
    getComputedStyle: () => ({ colorScheme: 'normal' }),
    FontFace: class {
      load() {
        return Promise.resolve();
      }
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, at: now + ms };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      const i = timers.indexOf(timer);
      if (i >= 0) timers.splice(i, 1);
    },
    chrome: {
      runtime: {
        getURL: (file) => `chrome-extension://butter/${file}`,
        onMessage: { addListener: (fn) => (listener = fn) },
      },
      storage: { local: { get: async (key) => ({ [key]: storage[key] }) } },
    },
  });
  const toasts = () => root.children.filter((el) => el.tagName === 'CHATGPT-BUTTER-TOAST');
  return {
    document,
    toasts,
    // What the toast reads: its markup without the stylesheet, the icon and the tags.
    text: () =>
      toasts()
        .map((el) =>
          el.shadowRoot.innerHTML
            .replace(/<style>[\s\S]*?<\/style>/g, '')
            .replace(/<svg[\s\S]*?<\/svg>/g, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .join(' | '),
    async saved(bug, round) {
      listener({ type: 'butter-dev-saved', bug, round }, { id: 'butter' }, () => {});
      await tick();
    },
    async message(message) {
      listener(message, { id: 'butter' }, () => {});
      await tick();
    },
    elapse(ms) {
      now += ms;
      for (const timer of timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
    },
  };
}

test('a save shows the bug and round numbers in English and Simplified Chinese', async () => {
  const en = tab({ butter: { lang: 'en' } });
  assert.deepEqual(en.toasts(), [], 'nothing on the page before a save');
  await en.saved(4, 2);
  assert.equal(en.text(), 'Bug 4 saved last 30 s · round 2');

  const zh = tab({ butter: { lang: 'zh' } });
  await zh.saved(12, 3);
  assert.equal(zh.text(), 'Bug 12 已保存 最近 30 秒 · 第 3 轮');

  // No saved settings yet: Butter's default language.
  const fresh = tab({ butter: undefined });
  await fresh.saved(1, 1);
  assert.equal(fresh.text(), 'Bug 1 saved last 30 s · round 1');
});

test('the toast takes no pointer events and never moves focus', async () => {
  const t = tab();
  const focused = t.document.activeElement;
  await t.saved(4, 2);
  const [host] = t.toasts();
  assert.equal(host.style.getPropertyValue('pointer-events'), 'none');
  assert.equal(host.style.getPropertyPriority('pointer-events'), 'important');
  assert.equal(t.document.activeElement, focused);
  // Nothing inside it can take focus either.
  assert.doesNotMatch(host.shadowRoot.innerHTML, /<(button|a|input)\b|tabindex|autofocus/);
  assert.match(host.shadowRoot.innerHTML, /role="status"/);
});

test('the toast goes after about 2 s, and a second save replaces it instead of stacking', async () => {
  const t = tab();
  await t.saved(4, 2);
  t.elapse(1500);
  assert.equal(t.toasts().length, 1);
  await t.saved(5, 2);
  assert.equal(t.toasts().length, 1, 'one toast at a time');
  assert.equal(t.text(), 'Bug 5 saved last 30 s · round 2');
  t.elapse(1900);
  assert.equal(t.toasts().length, 1, 'the second save restarts the 2 s');
  t.elapse(200);
  assert.deepEqual(t.toasts(), []);
  // A later save shows it again.
  await t.saved(6, 2);
  assert.equal(t.text(), 'Bug 6 saved last 30 s · round 2');
});

test('the toast follows the page theme with the consent card dark check', async () => {
  const light = tab();
  await light.saved(4, 2);
  assert.equal(light.toasts()[0].hasAttribute('data-dark'), false);
  const dark = tab({ dark: true });
  await dark.saved(4, 2);
  assert.equal(dark.toasts()[0].hasAttribute('data-dark'), true);
});

test('only a save message with whole bug and round numbers shows the toast', async () => {
  const t = tab();
  await t.message({ type: 'butter-dev-snapshot', request: {} });
  await t.message({ type: 'butter-dev-saved', bug: '<b>4</b>', round: 2 });
  await t.message({ type: 'butter-dev-saved', bug: 4 });
  assert.deepEqual(t.toasts(), []);
});
