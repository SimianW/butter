const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const status = require('../extension/shared/status.js');
const tick = () => new Promise(setImmediate);

// Loads the real popup with startup storage reads the test resolves by hand.
function popup() {
  let changed, resolveLocal, resolveSession, click, html;
  const saved = [];
  const context = vm.createContext({
    ButterStatus: status,
    ButterPopup: require('../extension/popup/model.js'),
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
        sendMessage: async () => ({ conversations: 0, bytes: 0 }),
      },
      tabs: { query: async () => [] },
    },
    document: {
      getElementById: () => ({
        classList: { toggle() {} },
        addEventListener: (type, fn) => (click = fn),
        append() {},
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
    setInterval() {},
    clearInterval() {},
    clearTimeout() {},
    addEventListener() {},
  });
  const source = path.join(__dirname, '../extension/popup/popup.js');
  vm.runInContext(fs.readFileSync(source, 'utf8'), context);
  return {
    changed: (...args) => changed(...args),
    finish: (local, session) => {
      resolveLocal(local);
      resolveSession(session);
    },
    html: () => html,
    saved,
    toggle: (key) => click({ target: { closest: () => ({ dataset: { switch: key } }) } }),
    read: (expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
  };
}

test('a stale startup session read cannot bring back a warning that was already cleared', async () => {
  const f = popup();
  f.changed({ butterFailures: { newValue: {} } }, 'session');
  f.finish({ butter: { layoutConsent: 'granted' } }, { butterFailures: { rail: { rail: true } } });
  await tick();
  assert.deepEqual(f.read('failures'), {});
});

// Each row's switch, name and description, in display order.
const rows = (html) =>
  [
    ...html.matchAll(
      /<div class="row[^"]*">.*?<div class="n">(.*?)(?:<span class="chip">.*?<\/span>)?<\/div><div class="d">(.*?)<\/div>.*?aria-checked="(\w+)"[^>]*data-switch="(\w+)"/g,
    ),
  ].map(([, name, description, on, key]) => ({ key, name, description, on: on === 'true' }));

test('Ask in branch has its own row after the question rail, on by default, in both languages', async () => {
  const f = popup();
  f.finish({ butter: { layoutConsent: 'granted' } }, {});
  await tick();
  assert.deepEqual(rows(f.html()), [
    {
      key: 'streaming',
      name: 'Smoother streaming',
      description: 'Long answers stream without lag',
      on: true,
    },
    {
      key: 'scrolling',
      name: 'Smoother scrolling',
      description: 'Drag the scrollbar to preview; it loads when you let go',
      on: true,
    },
    {
      key: 'rail',
      name: 'Question rail',
      description: 'Your questions on the right; click one to jump',
      on: true,
    },
    {
      key: 'branch',
      name: 'Ask in branch',
      description: 'Ask about a selection in a branch',
      on: true,
    },
    {
      key: 'layout',
      name: 'Remember long-chat layouts',
      description: 'Faster jumps when you come back; uses some storage',
      on: true,
    },
  ]);
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', lang: 'zh', opts: { branch: false } } } },
    'local',
  );
  assert.deepEqual(rows(f.html())[3], {
    key: 'branch',
    name: '在分支中问',
    description: '选中文字，在新分支里提问',
    on: false,
  });
});

test('the branch switch writes only the branch setting', async () => {
  const f = popup();
  f.finish({ butter: { layoutConsent: 'granted', opts: { rail: false } } }, {});
  await tick();
  f.toggle('branch');
  await tick();
  assert.equal(f.saved.at(-1).butter.opts.branch, false);
  assert.equal(f.saved.at(-1).butter.opts.rail, false);
  assert.equal(f.saved.at(-1).butter.opts.cv, true);
  f.toggle('branch');
  await tick();
  assert.equal(f.saved.at(-1).butter.opts.branch, true);
});

test('a branch failure marks its row and names it in the warning; turning it off hides both', async () => {
  const f = popup();
  f.finish(
    { butter: { layoutConsent: 'granted' } },
    { butterFailures: { branch: { branch: true } } },
  );
  await tick();
  assert.match(
    f.html(),
    /<div class="row broken">.*?Ask in branch<span class="chip">Unavailable<\/span>/,
  );
  assert.match(f.html(), /<b>Ask in branch is unavailable for now\.<\/b>/);
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.match(f.html(), /在分支中问<span class="chip">暂不可用<\/span>/);
  assert.match(f.html(), /<b>在分支中问暂时不可用。<\/b>/);
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', opts: { branch: false } } } },
    'local',
  );
  assert.doesNotMatch(f.html(), /class="chip"|class="warn"/);
  f.changed({ butterFailures: { newValue: {} } }, 'session');
  f.changed({ butter: { newValue: { layoutConsent: 'granted' } } }, 'local');
  assert.doesNotMatch(f.html(), /class="chip"|class="warn"/);
});
