// Ask in branch UI mount point: extension/branch/ui.js over a small fake DOM. The question box's
// host must sit inside <body>. macOS dictation apps such as Typeless find the focused field through
// the Accessibility API; with the host on <html>, dictation typed nothing into the box while
// typing worked, and moving the host into <body> in DevTools made dictation work.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../extension/branch/ui.js'), 'utf8');

// Enough of a node for ui.js: tree links, attributes, styles, listeners, and a querySelector that
// hands back one stand-in node per selector.
function node(tag) {
  const attrs = {},
    found = {};
  const n = {
    tagName: tag.toUpperCase(),
    parentNode: null,
    children: [],
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    innerHTML: '',
    textContent: '',
    appends: 0,
    append(...items) {
      for (const item of items) {
        if (typeof item !== 'object') continue;
        item.parentNode?.children.splice(item.parentNode.children.indexOf(item), 1);
        item.parentNode = n;
        n.children.push(item);
        n.appends++;
      }
    },
    remove() {
      if (!n.parentNode) return;
      n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1);
      n.parentNode = null;
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
    addEventListener() {},
    attachShadow: () => node('#shadow-root'),
    querySelector: (selector) => (found[selector] ||= node('div')),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    scrollHeight: 24,
  };
  return n;
}

function page({ body = true } = {}) {
  const html = node('html');
  const document = {
    documentElement: html,
    body: null,
    createElement: node,
  };
  if (body) {
    document.body = node('body');
    html.append(document.body);
  }
  const ctx = {
    document,
    MutationObserver: class {
      observe() {}
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerHeight: 800,
    innerWidth: 1200,
    setTimeout,
  };
  vm.runInNewContext(source, ctx);
  const ui = ctx.ButterBranchUI.create();
  const open = () =>
    ui.question.open({
      quote: 'a quoted line',
      draft: '',
      onSubmit() {},
      onInput() {},
      onClose() {},
    });
  return { document, ui, open };
}

test('the question box opens in a host inside <body>', () => {
  const { document, ui, open } = page();
  open();
  assert.equal(ui.host.parentNode, document.body);
});

test('a host already in <body> is not moved again', () => {
  const { document, ui, open } = page();
  open();
  open();
  assert.equal(ui.host.parentNode, document.body);
  assert.equal(document.body.appends, 1);
});

test('the host follows a <body> that ChatGPT replaced', () => {
  const { document, ui, open } = page();
  open();
  const fresh = node('body');
  document.body.remove();
  document.documentElement.append(fresh);
  document.body = fresh;
  open();
  assert.equal(ui.host.parentNode, fresh);
});

test('before <body> exists the host goes on <html>, then moves into <body>', () => {
  const { document, ui, open } = page({ body: false });
  open();
  assert.equal(ui.host.parentNode, document.documentElement);
  document.body = node('body');
  document.documentElement.append(document.body);
  open();
  assert.equal(ui.host.parentNode, document.body);
});
