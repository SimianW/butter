// The popup's two storage rows (#108), Bookmarks and Remember long-chat layouts: what each says it
// holds, its Clear, the question that asks first, and "Cleared", over the worker's answers.
const test = require('node:test');
const assert = require('node:assert/strict');
const { popup, rows, descriptions, tick } = require('./helpers/popup-fixture.cjs');

const saved = {
  'butter-bookmark-usage': { count: 12, bytes: 4_200 },
  'butter-layout-usage': { conversations: 14, bytes: 3_400_000 },
};
const started = async (butter = { layoutConsent: 'granted' }, answers = saved) => {
  const f = popup(answers);
  f.finish({ butter }, {});
  await tick();
  return f;
};

test('one card holds all six rows; the usage bar and the storage line are gone', async () => {
  const f = await started();
  assert.equal([...f.html().matchAll(/<div class="card[ "]/g)].length, 1);
  assert.equal(rows(f.html()).length, 6);
  assert.doesNotMatch(f.html(), /class="(?:jar|use)/);
  // Each row's label points at its own switch, so the Clear button inside it is not the label's control.
  for (const key of ['bookmarks', 'layout'])
    assert.match(
      f.html(),
      new RegExp(`<label class="row" for="sw-${key}">(?:(?!</label>).)*id="sw-${key}"`),
    );
});

test('both storage rows show what is saved, then Clear, in both languages', async () => {
  const f = await started();
  assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  assert.equal(descriptions(f.html()).layout, '14 chats, about 3.4 MB [Clear]');
  // The saved line is a live region; Clear is a real button outside it.
  assert.match(
    f.html(),
    /<div class="d"><span role="status">12 saved, about 4 KB<\/span><button type="button" class="lk" data-clear="ask" data-store="bookmarks">Clear<\/button><\/div>/,
  );
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  await tick();
  assert.equal(descriptions(f.html()).bookmarks, '已保存 12 个，约 4 KB [清除]');
  assert.equal(descriptions(f.html()).layout, '14 个对话，约 3.4 MB [清除]');
});

test('with nothing saved each row shows its description and no Clear', async () => {
  const g = await started({ layoutConsent: 'granted' }, {});
  assert.equal(descriptions(g.html()).bookmarks, 'Select text, mark the spot to jump back');
  assert.equal(descriptions(g.html()).layout, 'Faster jumps when you come back');
  assert.doesNotMatch(g.html(), /class="lk"/);
});

test('bookmarks saved show their count and Clear with Bookmarks, the rail or Butter off', async () => {
  for (const butter of [
    { layoutConsent: 'granted', opts: { bookmark: false } },
    { layoutConsent: 'granted', opts: { rail: false } },
    { layoutConsent: 'granted', enabled: false },
  ]) {
    const f = await started(butter);
    assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  }
});

test('the layouts row shows no usage while layouts are off; the note stays under it while pending', async () => {
  const f = await started({ layoutConsent: 'declined', opts: { layout: false } });
  assert.equal(descriptions(f.html()).layout, 'Faster jumps when you come back');
  assert.equal(f.sent.filter((m) => m.type === 'butter-layout-usage').length, 0);
  const g = await started({});
  assert.match(g.html(), /data-switch="layout"[^>]*><\/button><\/label><div class="note">/);
});

test('with the rail off and Bookmarks on and nothing saved, the row says it needs the rail', async () => {
  const f = await started({ layoutConsent: 'granted', opts: { rail: false } }, {});
  assert.equal(descriptions(f.html()).bookmarks, 'Needs the question rail');
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', lang: 'zh', opts: { rail: false } } } },
    'local',
  );
  assert.equal(descriptions(f.html()).bookmarks, '需要先打开问题导航条');
  f.changed(
    { butter: { newValue: { layoutConsent: 'granted', opts: { rail: false, bookmark: false } } } },
    'local',
  );
  assert.equal(descriptions(f.html()).bookmarks, 'Select text, mark the spot to jump back');
});

test('usage that cannot be read says Unavailable', async () => {
  const f = await started(
    { layoutConsent: 'granted' },
    { 'butter-bookmark-usage': { error: 'bookmark-storage' } },
  );
  assert.equal(descriptions(f.html()).bookmarks, 'Unavailable');
  assert.equal(f.sent.filter((m) => m.type === 'butter-bookmark-usage').length, 3, 'retried');
});

// The confirm row of a store: its question, its second line, and its two buttons.
const ask = (html, store) =>
  html
    .match(
      new RegExp(
        `<div class="row ask"><div class="t"><div class="n">(.*?)</div><div class="d">(.*?)</div></div><button type="button" class="btn danger" data-clear="confirm" data-store="${store}"[^>]*>(.*?)</button><button type="button" class="btn" data-clear="cancel" data-store="${store}"[^>]*>(.*?)</button></div>`,
      ),
    )
    ?.slice(1);

test('Clear on bookmarks asks first with the count; Cancel puts the row back; the red Clear clears', async () => {
  const f = await started(
    { layoutConsent: 'granted' },
    {
      ...saved,
      'butter-bookmark-clear': { count: 0, bytes: 0 },
    },
  );
  f.clear('bookmarks', 'ask');
  assert.deepEqual(ask(f.html(), 'bookmarks'), [
    'Clear 12 bookmarks?',
    "This can't be undone.",
    'Clear',
    'Cancel',
  ]);
  assert.equal(rows(f.html()).length, 5, 'the question replaces the whole row, switch and icon');
  assert.equal(
    descriptions(f.html()).layout,
    '14 chats, about 3.4 MB [Clear]',
    'layouts untouched',
  );
  f.clear('bookmarks', 'cancel');
  assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  assert.equal(f.sent.filter((m) => m.type === 'butter-bookmark-clear').length, 0);
  f.clear('bookmarks', 'ask');
  f.clear('bookmarks', 'confirm');
  await tick();
  const clears = f.sent.filter((m) => m.type === 'butter-bookmark-clear');
  assert.equal(clears.length, 1);
  assert.equal(clears[0].version, 1);
  assert.match(clears[0].requestId, /^[a-f0-9-]{36}$/);
  assert.equal(descriptions(f.html()).bookmarks, 'Cleared');
  assert.match(f.html(), /<span role="status">Cleared<\/span>/);
  assert.equal(f.timers.at(-1).ms, 2000);
});

test('Clear on layouts asks the same way, naming its chats, in both languages', async () => {
  const f = await started();
  f.clear('layouts', 'ask');
  assert.deepEqual(ask(f.html(), 'layouts'), [
    'Clear 14 saved layouts?',
    "This can't be undone.",
    'Clear',
    'Cancel',
  ]);
  assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.deepEqual(ask(f.html(), 'layouts'), [
    '清除 14 个对话的已保存布局？',
    '无法撤销。',
    '清除',
    '取消',
  ]);
});

test('a failed clear says Unavailable and offers Clear again', async () => {
  const f = await started(
    { layoutConsent: 'granted' },
    {
      ...saved,
      'butter-bookmark-clear': { error: 'bookmark-storage' },
    },
  );
  f.clear('bookmarks', 'ask');
  f.clear('bookmarks', 'confirm');
  await tick();
  assert.equal(descriptions(f.html()).bookmarks, 'Unavailable [Clear]');
  f.clear('bookmarks', 'ask');
  assert.equal(ask(f.html(), 'bookmarks')[0], 'Clear 12 bookmarks?');
});

test('toggling a storage row’s switch puts its own question away, not the other’s', async () => {
  const f = await started();
  f.clear('bookmarks', 'ask');
  f.clear('layouts', 'ask');
  f.toggle('bookmarks');
  await tick();
  assert.equal(ask(f.html(), 'bookmarks'), undefined);
  assert.notEqual(ask(f.html(), 'layouts'), undefined);
  assert.equal(f.saved.at(-1).butter.opts.bookmark, false);
});

test('the bookmarks cleared token from another page refreshes the count', async () => {
  let count = 12;
  const f = await started(
    { layoutConsent: 'granted' },
    { ...saved, 'butter-bookmark-usage': () => ({ count, bytes: count * 350 }) },
  );
  assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  count = 0;
  f.changed({ butterBookmarksCleared: { newValue: 'token' } }, 'local');
  await tick();
  assert.equal(descriptions(f.html()).bookmarks, 'Select text, mark the spot to jump back');
});
