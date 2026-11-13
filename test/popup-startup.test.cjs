const test = require('node:test');
const assert = require('node:assert/strict');
const { popup, rows, descriptions, tick } = require('./helpers/popup-fixture.cjs');

test('a stale startup session read cannot bring back a failure that was already cleared', async () => {
  const f = popup();
  f.changed({ butterFailures: { newValue: {} } }, 'session');
  f.finish({ butter: { layoutConsent: 'granted' } }, { butterFailures: { rail: { rail: true } } });
  await tick();
  assert.deepEqual(f.read('failures'), {});
  assert.doesNotMatch(f.html(), /class="row bad"|Unavailable for now/);
});

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
      key: 'bookmarks',
      name: 'Bookmarks',
      description: 'Select text, mark the spot to jump back',
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
    { key: 'bookmarks', name: '书签', description: '选中文字，标记位置，随时跳回', on: true },
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
  // The note follows the layouts row's label and closes the card.
  const note = (html) =>
    html.match(
      /data-switch="layout"[^>]*><\/button><\/label><div class="note">(.*?)<\/div><\/div>/,
    )?.[1];
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
const faulted = (html) =>
  [...html.matchAll(/<label class="row bad"[^>]*>(?:(?!<\/label>).)*?data-switch="(\w+)"/g)].map(
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

test('with two or more broken groups, each faulted row shows the short one-line fault text', async () => {
  const f = popup();
  f.finish(
    { butter: { layoutConsent: 'granted' } },
    { butterFailures: { rail: { rail: true }, branch: { branch: true } } },
  );
  await tick();
  assert.deepEqual(faulted(f.html()), ['rail', 'branch']);
  assert.equal(descriptions(f.html()).rail, 'Unavailable; resumes on its own.');
  assert.equal(descriptions(f.html()).branch, 'Unavailable; resumes on its own.');
  assert.equal(descriptions(f.html()).streaming, 'Long answers stream without lag');
  assert.match(f.html(), /<div class="d" role="status">Unavailable; resumes/);
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.equal(descriptions(f.html()).rail, '暂时不可用，Butter 会自动恢复。');
  assert.equal(descriptions(f.html()).branch, '暂时不可用，Butter 会自动恢复。');
  // Back to one broken group: its row shows the full text again.
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', lang: 'zh', opts: { rail: false } } } },
    'local',
  );
  assert.deepEqual(faulted(f.html()), ['branch']);
  assert.equal(descriptions(f.html()).branch, faultZh);
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
  assert.deepEqual(cards, ['paused']);
  assert.deepEqual(
    rows(f.html()).map(({ key, on }) => [key, on]),
    [
      ['streaming', true],
      ['scrolling', true],
      ['rail', false],
      ['branch', true],
      ['bookmarks', true],
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
