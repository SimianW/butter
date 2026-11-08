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

// Each row's switch, name and description, in display order. A row is a label that wraps its
// switch, so the regex only matches a switch found before the row's closing tag.
const rows = (html) =>
  [
    ...html.matchAll(
      /<label class="row[^"]*">(?:(?!<\/label>).)*?<div class="n">(.*?)(?:<span class="chip">.*?<\/span>)?<\/div><div class="d">(.*?)<\/div>(?:(?!<\/label>).)*?<button [^>]*role="switch" aria-checked="(\w+)"[^>]*data-switch="(\w+)"[^>]*><\/button><\/label>/g,
    ),
  ].map(([, name, description, on, key]) => ({ key, name, description, on: on === 'true' }));

test('rows are labels wrapping their switches, in order, with the new copy in both languages', async () => {
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
      description: 'Preview while you drag the scrollbar',
      on: true,
    },
    {
      key: 'rail',
      name: 'Question rail',
      description: 'Click a question on the right to jump',
      on: true,
    },
    {
      key: 'branch',
      name: 'Ask in branch',
      description: 'Select text, ask about it in a new branch',
      on: true,
    },
    {
      key: 'layout',
      name: 'Remember long-chat layouts',
      description: 'Faster jumps when you come back',
      on: true,
    },
  ]);
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', lang: 'zh', opts: { branch: false } } } },
    'local',
  );
  assert.deepEqual(rows(f.html()), [
    { key: 'streaming', name: '回答生成时更顺', description: '长回答输出时页面不卡', on: true },
    {
      key: 'scrolling',
      name: '长对话滚动更顺',
      description: '拖动滚动条先看预览，松手再加载',
      on: true,
    },
    {
      key: 'rail',
      name: '问题导航条',
      description: '右侧列出你问过的问题，点一下就跳过去',
      on: true,
    },
    { key: 'branch', name: '在分支中问', description: '选中文字，在新分支里提问', on: false },
    { key: 'layout', name: '记住长对话的布局', description: '再次打开时跳转更快', on: true },
  ]);
});

test('the header shows version_name as written and the footer links GitHub and the privacy policy for the language', async () => {
  const f = popup();
  f.finish({ butter: { layoutConsent: 'granted' } }, {});
  await tick();
  const links = (html) =>
    [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(([, href, text]) => ({
      href,
      text,
    }));
  assert.deepEqual(links(f.html()), [
    {
      href: 'https://github.com/SimianW/butter/blob/main/CHANGELOG.md',
      text: '0.1.0-alpha.10',
    },
    { href: 'https://github.com/SimianW/butter', text: 'GitHub' },
    { href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.md', text: 'Privacy policy' },
  ]);
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.deepEqual(links(f.html()).slice(1), [
    { href: 'https://github.com/SimianW/butter', text: 'GitHub' },
    { href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.zh-CN.md', text: '隐私政策' },
  ]);
  // The language switch sits in the footer, after the links.
  assert.match(f.html(), /PRIVACY\.zh-CN\.md"[^>]*>隐私政策<\/a>.*data-lang="zh".*data-lang="en"/s);
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
    /<label class="row broken">.*?Ask in branch<span class="chip">Unavailable<\/span>/,
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
