// The popup's two storage rows (#108), Bookmarks and Remember long-chat layouts: what each says it
// holds, its Clear, the question that asks first, and "Cleared", over the worker's answers.
// Bookmarks are on the main page and layouts on the Experimental page, so `both` reads the two.
const test = require('node:test');
const assert = require('node:assert/strict');
const { popup, rows, descriptions, tick } = require('./helpers/popup-fixture.cjs');

const saved = {
  'butter-bookmark-usage': { count: 12, bytes: 4_200 },
  'butter-layout-usage': { conversations: 14, bytes: 3_400_000 },
};
// Layouts granted and Smoother scrolling on: both rows can show what they hold.
const inUse = { layoutConsent: 'granted', opts: { older: true, seek: true } };
const started = async (butter = inUse, answers = saved) => {
  const f = popup(answers);
  f.finish({ butter }, {});
  await tick();
  return f;
};
// Both pages' markup, main then Experimental; the popup is left on the Experimental page.
const both = (f) => {
  f.go('main');
  const main = f.html();
  f.go('experimental');
  return main + f.html();
};

test('each page has one card; the usage bar and the storage line are gone', async () => {
  const f = await started();
  assert.equal([...f.html().matchAll(/<div class="card[ "]/g)].length, 1);
  assert.deepEqual(
    rows(f.html()).map((r) => r.key),
    ['streaming', 'rail', 'branch', 'bookmarks'],
  );
  f.go('experimental');
  assert.equal([...f.html().matchAll(/<div class="card[ "]/g)].length, 1);
  assert.deepEqual(
    rows(f.html()).map((r) => r.key),
    ['scrolling', 'layout'],
  );
  assert.doesNotMatch(both(f), /class="(?:jar|use)/);
  // Each row's label points at its own switch, so the Clear button inside it is not the label's control.
  for (const key of ['bookmarks', 'layout'])
    assert.match(
      both(f),
      new RegExp(`<label class="row" for="sw-${key}">(?:(?!</label>).)*id="sw-${key}"`),
    );
});

test('both storage rows show what is saved, then Clear, in both languages', async () => {
  const f = await started();
  assert.equal(descriptions(both(f)).bookmarks, '12 saved, about 4 KB [Clear]');
  assert.equal(descriptions(both(f)).layout, '14 chats, about 3.4 MB [Clear]');
  // The saved line is a live region; Clear is a real button outside it.
  assert.match(
    both(f),
    /<div class="d"><span role="status">12 saved, about 4 KB<\/span> <button type="button" class="lk" data-clear="ask" data-store="bookmarks">Clear<\/button><\/div>/,
  );
  f.changed({ butter: { newValue: { ...inUse, lang: 'zh' } } }, 'local');
  await tick();
  assert.equal(descriptions(both(f)).bookmarks, '已保存 12 个，约 4 KB [清除]');
  assert.equal(descriptions(both(f)).layout, '14 个对话，约 3.4 MB [清除]');
});

test('with nothing saved each row shows its description and no Clear', async () => {
  const g = await started(inUse, {});
  assert.equal(descriptions(both(g)).bookmarks, 'Select text, mark the spot to jump back');
  assert.equal(descriptions(both(g)).layout, 'Faster jumps when you come back');
  assert.doesNotMatch(both(g), /class="lk"/);
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
  const f = await started({ layoutConsent: 'declined', opts: { layout: false, seek: true } });
  assert.equal(descriptions(both(f)).layout, 'Faster jumps when you come back');
  assert.equal(f.sent.filter((m) => m.type === 'butter-layout-usage').length, 0);
  const g = await started({});
  g.go('experimental');
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
  f.changed({ butter: { newValue: { layoutConsent: 'granted', opts: {} } } }, 'local');
  assert.equal(descriptions(f.html()).bookmarks, 'Select text, mark the spot to jump back');
});

// Saved layouts are read only by the scrollbar preview (Smoother scrolling): without it they are
// kept but unused, so the row says what it needs in place of what it holds, with no count or Clear.
test('layouts on with Smoother scrolling off say they need it, in place of the saved line', async () => {
  const f = await started({ layoutConsent: 'granted' });
  f.go('experimental');
  assert.equal(descriptions(f.html()).layout, 'Needs Smoother scrolling');
  assert.match(
    f.html(),
    /<label class="row" for="sw-layout">(?:(?!<\/label>).)*<div class="d"><span role="status">Needs Smoother scrolling<\/span><\/div>/,
  );
  assert.doesNotMatch(f.html(), /data-store="layouts"/, 'no Clear');
  f.changed({ butter: { newValue: { layoutConsent: 'granted', lang: 'zh' } } }, 'local');
  assert.equal(descriptions(f.html()).layout, '需要先打开长对话滚动更顺');
  // Switching Smoother scrolling on brings the saved line back (Chrome echoes the popup's own
  // save through storage.onChanged, which reads the usage).
  f.toggle('scrolling');
  await tick();
  f.changed({ butter: { newValue: f.saved.at(-1).butter } }, 'local');
  await tick();
  assert.equal(descriptions(f.html()).layout, '14 个对话，约 3.4 MB [清除]');
  // Layouts off: the description, whatever Smoother scrolling is.
  const g = await started({ layoutConsent: 'declined', opts: { layout: false } });
  g.go('experimental');
  assert.equal(descriptions(g.html()).layout, 'Faster jumps when you come back');
});

test('usage that cannot be read says Unavailable', async () => {
  const f = await started(inUse, { 'butter-bookmark-usage': { error: 'bookmark-storage' } });
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
  const f = await started(inUse, {
    ...saved,
    'butter-bookmark-clear': { count: 0, bytes: 0 },
  });
  f.clear('bookmarks', 'ask');
  assert.deepEqual(ask(f.html(), 'bookmarks'), [
    'Clear 12 bookmarks?',
    "This can't be undone.",
    'Clear',
    'Cancel',
  ]);
  assert.equal(rows(f.html()).length, 3, 'the question replaces the whole row, switch and icon');
  assert.equal(descriptions(both(f)).layout, '14 chats, about 3.4 MB [Clear]', 'layouts untouched');
  f.go('main');
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
  f.go('experimental');
  f.clear('layouts', 'ask');
  assert.deepEqual(ask(f.html(), 'layouts'), [
    'Clear 14 saved layouts?',
    "This can't be undone.",
    'Clear',
    'Cancel',
  ]);
  assert.equal(descriptions(both(f)).bookmarks, '12 saved, about 4 KB [Clear]');
  f.changed({ butter: { newValue: { ...inUse, lang: 'zh' } } }, 'local');
  assert.deepEqual(ask(f.html(), 'layouts'), [
    '清除 14 个对话的已保存布局？',
    '无法撤销。',
    '清除',
    '取消',
  ]);
});

test('a failed clear says Unavailable and offers Clear again', async () => {
  const f = await started(inUse, {
    ...saved,
    'butter-bookmark-clear': { error: 'bookmark-storage' },
  });
  f.clear('bookmarks', 'ask');
  f.clear('bookmarks', 'confirm');
  await tick();
  assert.equal(descriptions(f.html()).bookmarks, 'Unavailable [Clear]');
  f.clear('bookmarks', 'ask');
  assert.equal(ask(f.html(), 'bookmarks')[0], 'Clear 12 bookmarks?');
});

test('toggling a storage row’s switch puts its own question away, not the other’s', async () => {
  const f = await started(inUse);
  f.clear('bookmarks', 'ask');
  f.clear('layouts', 'ask');
  f.toggle('bookmarks');
  await tick();
  assert.equal(ask(both(f), 'bookmarks'), undefined);
  assert.notEqual(ask(both(f), 'layouts'), undefined);
  assert.equal(f.saved.at(-1).butter.opts.bookmark, false);
});

test('the bookmarks cleared token from another page refreshes the count', async () => {
  let count = 12;
  const f = await started(inUse, {
    ...saved,
    'butter-bookmark-usage': () => ({ count, bytes: count * 350 }),
  });
  assert.equal(descriptions(f.html()).bookmarks, '12 saved, about 4 KB [Clear]');
  count = 0;
  f.changed({ butterBookmarksCleared: { newValue: 'token' } }, 'local');
  await tick();
  assert.equal(descriptions(f.html()).bookmarks, 'Select text, mark the spot to jump back');
});

test('a layouts fault with layouts saved keeps Clear beside the fault text', async () => {
  const f = popup(saved);
  f.finish({ butter: inUse }, { butterFailures: { layout: { layout: true } } });
  await tick();
  f.go('experimental');
  assert.match(descriptions(f.html()).layout, /^Unavailable for now\..* \[Clear\]$/);
  assert.match(f.html(), /<label class="row bad" for="sw-layout">/);
  // With nothing saved the faulted row offers no Clear.
  const g = popup({});
  g.finish({ butter: inUse }, { butterFailures: { layout: { layout: true } } });
  await tick();
  g.go('experimental');
  assert.match(descriptions(g.html()).layout, /^Unavailable for now\.[^[]*$/);
});

// Switching off the switch a storage row needs while its question is open (#171 review L2): the
// row shows what it needs, the question is dropped and does not come back with the switch.
test('switching Smoother scrolling off while Clear asks drops the question for the needs line', async () => {
  const f = await started(inUse, {
    ...saved,
    'butter-layout-clear': { conversations: 0, bytes: 0 },
  });
  f.go('experimental');
  f.clear('layouts', 'ask');
  assert.equal(ask(f.html(), 'layouts')[0], 'Clear 14 saved layouts?');
  // Off, by the switch and by another popup's write (storage.onChanged), with the echo each way.
  f.toggle('scrolling');
  await tick();
  f.changed({ butter: { newValue: f.saved.at(-1).butter } }, 'local');
  await tick();
  assert.equal(ask(f.html(), 'layouts'), undefined, 'the question is gone');
  assert.equal(descriptions(f.html()).layout, 'Needs Smoother scrolling');
  f.clear('layouts', 'confirm');
  await tick();
  assert.equal(f.sent.filter((m) => m.type === 'butter-layout-clear').length, 0, 'nothing cleared');
  f.toggle('scrolling');
  await tick();
  f.changed({ butter: { newValue: f.saved.at(-1).butter } }, 'local');
  await tick();
  assert.equal(ask(f.html(), 'layouts'), undefined, 'the question does not come back');
  assert.equal(descriptions(f.html()).layout, '14 chats, about 3.4 MB [Clear]');
  // The same from another popup's write: the question is dropped there too.
  f.clear('layouts', 'ask');
  f.changed({ butter: { newValue: { layoutConsent: 'granted' } } }, 'local');
  await tick();
  assert.equal(ask(f.html(), 'layouts'), undefined);
  assert.equal(descriptions(f.html()).layout, 'Needs Smoother scrolling');
});

// Bookmarks in the same sequence: with bookmarks saved, the row with the rail off still shows
// what it holds and Clear (its saved line ranks above "Needs the question rail"), so its question
// stays open and its Clear still clears.
test('switching the question rail off while Bookmarks asks keeps the question: its saved line ranks first', async () => {
  const f = await started(inUse, { ...saved, 'butter-bookmark-clear': { count: 0, bytes: 0 } });
  f.clear('bookmarks', 'ask');
  f.toggle('rail');
  await tick();
  f.changed({ butter: { newValue: f.saved.at(-1).butter } }, 'local');
  await tick();
  assert.equal(ask(f.html(), 'bookmarks')[0], 'Clear 12 bookmarks?');
  f.clear('bookmarks', 'confirm');
  await tick();
  assert.equal(f.sent.filter((m) => m.type === 'butter-bookmark-clear').length, 1);
});

// A remembered layouts fault (session storage) cannot clear while Smoother scrolling is off,
// since layouts then never report ok: the row says what it needs instead of the fault.
test('a remembered layouts fault gives way to the needs line while Smoother scrolling is off', async () => {
  const f = popup(saved);
  f.finish(
    { butter: { layoutConsent: 'granted' } },
    { butterFailures: { layout: { layout: true } } },
  );
  await tick();
  f.go('experimental');
  assert.equal(descriptions(f.html()).layout, 'Needs Smoother scrolling');
  assert.doesNotMatch(f.html(), /<label class="row bad" for="sw-layout">/);
  f.changed({ butter: { newValue: inUse } }, 'local');
  await tick();
  assert.match(
    descriptions(f.html()).layout,
    /^Unavailable for now\./,
    'with it on, the fault shows',
  );
});
