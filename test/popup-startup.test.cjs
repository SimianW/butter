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

test('a stale startup session read cannot bring back a failure that was already cleared', async () => {
  const f = popup();
  f.changed({ butterFailures: { newValue: {} } }, 'session');
  f.finish({ butter: { layoutConsent: 'granted' } }, { butterFailures: { rail: { rail: true } } });
  await tick();
  assert.deepEqual(f.read('failures'), {});
  assert.doesNotMatch(f.html(), /class="row bad"|Unavailable for now/);
});

// Each row's switch, name and description, in display order. A row is a label that wraps its
// switch, so the regex only matches a switch found before the row's closing tag.
const rows = (html) =>
  [
    ...html.matchAll(
      /<label class="row[^"]*">(?:(?!<\/label>).)*?<div class="n">(.*?)<\/div><div class="d"[^>]*>(.*?)<\/div>(?:(?!<\/label>).)*?<button [^>]*role="switch" aria-checked="(\w+)"[^>]*data-switch="(\w+)"[^>]*><\/button><\/label>/g,
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

test('pending consent shows the note with the privacy link for the language, and the switch grants consent', async () => {
  const f = popup();
  f.finish({ butter: { lang: 'en', opts: { layout: true } } }, {});
  await tick();
  // The note follows the layouts row's label, inside the layouts card, and nothing else does.
  const note = (html) => html.match(/<\/label><div class="note">(.*?)<\/div><\/div>/)?.[1];
  assert.equal(
    note(f.html()),
    'Off until you turn it on. Butter saves layout numbers only, never chat text, and deletes them after 30 days. <a target="_blank" rel="noopener" href="https://github.com/SimianW/butter/blob/main/PRIVACY.md">Privacy policy</a>',
  );
  assert.doesNotMatch(f.html(), /class="pend"|class="use/);
  f.changed({ butter: { newValue: { lang: 'zh', opts: { layout: true } } } }, 'local');
  assert.equal(
    note(f.html()),
    '打开前不会保存。Butter 只保存布局数字，不保存聊天内容，30 天后自动删除。<a target="_blank" rel="noopener" href="https://github.com/SimianW/butter/blob/main/PRIVACY.zh-CN.md">隐私政策</a>',
  );
  f.toggle('layout');
  await tick();
  assert.equal(f.saved.at(-1).butter.layoutConsent, 'granted');
  assert.equal(f.saved.at(-1).butter.opts.layout, true);
  assert.doesNotMatch(f.html(), /class="note"/);
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

const faultEn =
  'Unavailable for now. ChatGPT may have changed its page; Butter resumes on its own.';
const faultZh = '暂时不可用。ChatGPT 可能更新了页面，恢复后 Butter 会自动继续。';
const descriptions = (html) => Object.fromEntries(rows(html).map((r) => [r.key, r.description]));
const faulted = (html) =>
  [...html.matchAll(/<label class="row bad">(?:(?!<\/label>).)*?data-switch="(\w+)"/g)].map(
    ([, key]) => key,
  );

test('a recorded failure replaces its row description with the fault text, in place of a warning card or chip', async () => {
  const f = popup();
  f.finish(
    { butter: { layoutConsent: 'granted' } },
    { butterFailures: { branch: { branch: true } } },
  );
  await tick();
  assert.deepEqual(faulted(f.html()), ['branch']);
  assert.equal(descriptions(f.html()).branch, faultEn);
  assert.equal(descriptions(f.html()).rail, 'Click a question on the right to jump');
  // The description is a live region, so the fault text is announced when it appears.
  assert.match(f.html(), /<div class="d" role="status">Unavailable for now\./);
  assert.doesNotMatch(f.html(), /class="(?:warn|chip|warning-slot)"|<b>/);
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.equal(descriptions(f.html()).branch, faultZh);
  // Turning the group off clears its fault display.
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', opts: { branch: false } } } },
    'local',
  );
  assert.deepEqual(faulted(f.html()), []);
  assert.equal(descriptions(f.html()).branch, 'Select text, ask about it in a new branch');
});

test('several broken groups each show their own fault text', async () => {
  const f = popup();
  f.finish(
    { butter: { layoutConsent: 'granted' } },
    { butterFailures: { rail: { rail: true }, branch: { branch: true } } },
  );
  await tick();
  assert.deepEqual(faulted(f.html()), ['rail', 'branch']);
  assert.equal(descriptions(f.html()).rail, faultEn);
  assert.equal(descriptions(f.html()).branch, faultEn);
  assert.equal(descriptions(f.html()).streaming, 'Long answers stream without lag');
});

test('paused marks the features card paused, keeps every switch as set, and shows no faults', async () => {
  const f = popup();
  f.finish(
    { butter: { layoutConsent: 'granted', enabled: false, opts: { rail: false } } },
    { butterFailures: { branch: { branch: true } } },
  );
  await tick();
  const cards = [...f.html().matchAll(/<div class="card( [^"]*)?">/g)].map(([, c]) =>
    (c || '').trim(),
  );
  assert.deepEqual(cards, ['paused', '']);
  assert.deepEqual(
    rows(f.html()).map(({ key, on }) => [key, on]),
    [
      ['streaming', true],
      ['scrolling', true],
      ['rail', false],
      ['branch', true],
      ['layout', true],
    ],
  );
  assert.deepEqual(faulted(f.html()), []);
  assert.doesNotMatch(f.html(), /class="card dim"/);
  f.toggle('master');
  await tick();
  assert.equal(f.saved.at(-1).butter.enabled, true);
  assert.match(f.html(), /<div class="card ?">/);
  assert.deepEqual(faulted(f.html()), ['branch']);
});
