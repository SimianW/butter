const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const repo = require('node:path').resolve(__dirname, '..');
const conv = '00000000-0000-0000-0000-000000000000';
const crypto = require('node:crypto').webcrypto;
test('F5 initial account discovery preserves in-flight conversation publications', async () => {
  const emitted = [];
  let resolveConversation;
  const response = (j) => ({ ok: true, clone: () => ({ json: async () => j }) });
  const win = {
    addEventListener() {},
    fetch(input) {
      if (input === '/api/auth/session')
        return Promise.resolve(response({ user: { id: 'first-account' } }));
      return new Promise((resolve) => {
        resolveConversation = resolve;
      });
    },
  };
  vm.runInNewContext(fs.readFileSync(repo + '/extension/history/conversation-main.js', 'utf8'), {
    window: win,
    URL,
    Request,
    Symbol,
    crypto,
    TextEncoder,
    location: {
      href: 'https://chatgpt.com/c/' + conv,
      origin: 'https://chatgpt.com',
      pathname: '/c/' + conv,
    },
    document: {
      documentElement: { getAttribute: () => '' },
      addEventListener() {},
      dispatchEvent: (e) => emitted.push(e),
    },
    CustomEvent: class {
      constructor(type, o = {}) {
        this.type = type;
        this.detail = o.detail;
      }
    },
  });
  const pending = win.fetch('/backend-api/conversations/' + conv);
  await win.fetch('/api/auth/session');
  for (let i = 0; i < 1000 && !emitted.some((e) => e.type === 'butter-account'); i++)
    await new Promise(setImmediate);
  assert.ok(emitted.some((e) => e.type === 'butter-account'));
  resolveConversation(
    response({ messages: [{ id: 'q', author: { role: 'user' }, content: { parts: ['hello'] } }] }),
  );
  await pending;
  await new Promise(setImmediate);
  const count = emitted.filter((e) => e.type === 'butter-seek-data').length;
  console.log('Initial same-account conversation publications:', count, '(expected 1)');
  assert.equal(count, 1);
  assert.equal(emitted.filter((e) => e.type === 'butter-nav').length, 1);
});
test('F7 computed normal line-height is accepted with strict font validation', () => {
  const codec = require(repo + '/extension/seek/layout-codec.js');
  const x = codec.pack({
    account: 'a'.repeat(64),
    conv: 'b'.repeat(64),
    turn: 'c'.repeat(64),
    msg: 'd'.repeat(64),
    digest: 'e'.repeat(64),
    layout: 'f'.repeat(64),
    time: Date.now(),
    h: 500,
    rowH: 520,
    turnOffset: 8,
    turnH: 480,
    w: 768,
    vw: 1440,
    sw: 1258,
    blocks: [26],
    items: [
      {
        top: 20,
        h: 26,
        left: 0,
        w: 768,
        user: false,
        css: 'font:normal 400 16px/normal system-ui;padding:0px 0px 0px 0px;border-radius:0px;background:rgba(0, 0, 0, 0);color:rgb(0, 0, 0);text-align:right',
        source: 0,
        math: [],
      },
    ],
  });
  console.log('Computed font with /normal accepted:', codec.valid(x));
  assert.equal(codec.valid(x), true);
  for (const value of ['26px', '1.5', 'normal']) {
    x.styles[0] = x.styles[0].replace(/\/(?:normal|26px|1.5)/, '/' + value);
    assert.equal(codec.valid(x), true);
  }
  for (const value of ['normality', 'Normal', 'normal extra', 'var(--line)', 'url(secret)']) {
    const bad = structuredClone(x);
    bad.styles[0] = bad.styles[0].replace('/normal', '/' + value);
    assert.equal(codec.valid(bad), false, value);
  }
});
