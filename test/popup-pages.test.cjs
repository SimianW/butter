// The popup's two pages (#158): the main page with the finished features and the Experimental row,
// and the Experimental page with the question rail, Bookmarks and Remember long-chat layouts.
const test = require('node:test');
const assert = require('node:assert/strict');
const { popup, rows, descriptions, tick } = require('./helpers/popup-fixture.cjs');

const keys = (html) => rows(html).map((r) => r.key);
// The Experimental row: its text and count, or undefined when the page has none.
const more = (html) => {
  const m = html.match(
    /<button type="button" class="more" data-go="experimental"><svg class="ic"[^>]*>.*?<\/svg><span>(.*?)<\/span><span class="cnt">(.*?)<\/span><svg class="chev"[^>]*>.*?<\/svg><\/button>/,
  );
  return m && { text: m[1], count: m[2] };
};
const back = (html) =>
  html
    .match(
      /<button type="button" class="back" data-go="main" aria-label="([^"]*)"><svg [^>]*>.*?<\/svg><span>(.*?)<\/span><\/button>/,
    )
    ?.slice(1);
const lead = (html) => html.match(/<p class="intro">(.*?)<\/p>/)?.[1];
const started = async (butter = {}, session = {}, options) => {
  const f = popup({}, options);
  f.finish({ butter }, session);
  await tick();
  return f;
};

test('on a fresh install the main page lists the three finished features and a quiet Experimental row', async () => {
  const f = await started();
  assert.deepEqual(keys(f.html()), ['streaming', 'scrolling', 'branch']);
  assert.deepEqual(more(f.html()), { text: 'Experimental', count: '' });
  assert.match(f.html(), /class="master/);
  assert.equal(back(f.html()), undefined);
  assert.equal(lead(f.html()), undefined);
  // The Experimental row is a real button, not a switch or a label.
  assert.doesNotMatch(f.html(), /class="more"[^>]*role=/);
  assert.doesNotMatch(f.html(), /class="note"/, 'the privacy note lives on the Experimental page');
});

test('the Experimental row counts the experimental switches that are on, even while paused', async () => {
  const cases = [
    [{ opts: { rail: true, bookmark: true } }, '2 on'],
    [{ opts: { rail: true, bookmark: true }, enabled: false }, '2 on'],
    [{ opts: { bookmark: true } }, '1 on'],
    [{ layoutConsent: 'granted', opts: { rail: true, bookmark: true } }, '3 on'],
    [{ layoutConsent: 'declined', opts: { rail: true } }, '1 on'],
    [{ opts: { rail: false, bookmark: false } }, ''],
  ];
  for (const [butter, count] of cases) {
    const f = await started(butter);
    assert.equal(more(f.html()).count, count, JSON.stringify(butter));
  }
  const f = await started({ lang: 'zh', opts: { rail: true, bookmark: true } });
  assert.deepEqual(more(f.html()), { text: '实验功能', count: '已开启 2 项' });
});

test('the Experimental row opens the Experimental page and its title goes back, moving focus', async () => {
  const f = await started();
  f.go('experimental');
  assert.deepEqual(keys(f.html()), ['rail', 'bookmarks', 'layout']);
  assert.deepEqual(back(f.html()), ['Back to all features', 'Experimental']);
  assert.equal(
    lead(f.html()),
    'Unfinished features. Each stays off until you switch it on, and may misbehave.',
  );
  assert.doesNotMatch(f.html(), /class="master/, 'no Enable Butter card');
  assert.equal(more(f.html()), null);
  assert.match(f.html(), /<div class="card exp">/);
  // The header and footer stay.
  assert.match(f.html(), /class="hd".*class="word">Butter<.*class="ver"/s);
  assert.match(f.html(), /class="ft">.*GitHub.*data-lang="zh".*data-lang="en"/s);
  // Fresh install: all three off.
  assert.deepEqual(
    rows(f.html()).map((r) => r.on),
    [false, false, false],
  );
  assert.deepEqual(f.focused, ['.back']);
  f.go('main');
  assert.deepEqual(keys(f.html()), ['streaming', 'scrolling', 'branch']);
  assert.deepEqual(f.focused, ['.back', '.more']);
});

test('the Experimental page stays open through settings, failures, polling and a language switch', async () => {
  const f = await started();
  f.go('experimental');
  f.changed({ butter: { newValue: { opts: { rail: true } } } }, 'local');
  assert.deepEqual(keys(f.html()), ['rail', 'bookmarks', 'layout']);
  assert.equal(rows(f.html())[0].on, true);
  f.changed({ butterFailures: { newValue: { rail: { rail: true } } } }, 'session');
  assert.deepEqual(keys(f.html()), ['rail', 'bookmarks', 'layout']);
  f.toggle('bookmarks');
  await tick();
  assert.equal(f.saved.at(-1).butter.opts.bookmark, true);
  assert.deepEqual(keys(f.html()), ['rail', 'bookmarks', 'layout']);
  f.changed({ butter: { newValue: { lang: 'zh', opts: { rail: true } } } }, 'local');
  assert.deepEqual(back(f.html()), ['返回全部功能', '实验功能']);
  assert.equal(lead(f.html()), '尚未完成的功能。每项在你打开前都保持关闭，可能会出问题。');
  assert.deepEqual(
    rows(f.html()).map((r) => r.name),
    ['问题导航条', '书签', '记住长对话的布局'],
  );
  assert.deepEqual(f.focused, ['.back'], 'live updates do not move focus');
});

test('the privacy note shows under the layouts row while layouts are pending and off', async () => {
  const f = await started({});
  f.go('experimental');
  assert.match(
    f.html(),
    /data-switch="layout"[^>]*><\/button><\/label><div class="note">Off until/,
  );
  f.toggle('layout');
  await tick();
  assert.equal(f.saved.at(-1).butter.layoutConsent, 'granted');
  assert.doesNotMatch(f.html(), /class="note"/);
  const g = await started({ layoutConsent: 'declined', opts: { layout: false } });
  g.go('experimental');
  assert.doesNotMatch(g.html(), /class="note"/, 'a stored decline shows no note');
  assert.equal(rows(g.html())[2].on, false);
});

test('Bookmarks on with the rail off says it needs the rail on the Experimental page', async () => {
  const f = await started({ opts: { bookmark: true } });
  f.go('experimental');
  assert.equal(descriptions(f.html()).bookmarks, 'Needs the question rail');
});

test('faults show only in their own row, and the short text counts the broken groups on the page showing', async () => {
  const failures = { butterFailures: { rail: { rail: true }, branch: { branch: true } } };
  const f = await started({ opts: { rail: true } }, failures);
  const long = 'Unavailable for now. ChatGPT may have changed its page; Butter resumes on its own.';
  // Main page: only Ask in branch is broken here; the Experimental row shows no fault.
  assert.equal(descriptions(f.html()).branch, long);
  assert.doesNotMatch(f.html(), /class="more[^"]*bad/);
  assert.deepEqual(more(f.html()), { text: 'Experimental', count: '1 on' });
  f.go('experimental');
  assert.equal(descriptions(f.html()).rail, long);
  assert.match(f.html(), /<label class="row bad" for="sw-rail">/);
  // Two broken groups on the Experimental page: each says it in one line.
  const g = await started(
    { layoutConsent: 'granted', opts: { rail: true } },
    { butterFailures: { rail: { rail: true }, layout: { layout: true } } },
  );
  g.go('experimental');
  assert.equal(descriptions(g.html()).rail, 'Unavailable; resumes on its own.');
  assert.match(descriptions(g.html()).layout, /^Unavailable; resumes on its own\./);
  g.go('main');
  assert.equal(descriptions(g.html()).branch, 'Select text, ask about it in a new branch');
});

test('paused, the Experimental page card looks paused like the main card', async () => {
  const f = await started({ enabled: false, opts: { rail: true } });
  assert.match(f.html(), /<div class="card paused">/);
  f.go('experimental');
  assert.match(f.html(), /<div class="card exp paused">/);
  assert.equal(rows(f.html())[0].on, true, 'the switches stay as set');
});

test('the page swap slides in from the right going in and from the left going back, only then', async () => {
  const f = await started();
  assert.deepEqual(f.animations, [], 'nothing on first render');
  f.go('experimental');
  assert.equal(f.animations.length, 1);
  const [selector, keyframes, options] = f.animations[0];
  assert.equal(selector, '.page');
  assert.deepEqual(JSON.parse(JSON.stringify(keyframes)), [
    { opacity: 0, transform: 'translateX(10px)' },
    { opacity: 1, transform: 'none' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(options)), { duration: 160, easing: 'ease-out' });
  f.changed({ butter: { newValue: { lang: 'zh' } } }, 'local');
  f.toggle('rail');
  assert.equal(f.animations.length, 1, 'nothing on re-renders');
  f.go('main');
  assert.equal(f.animations[1][1][0].transform, 'translateX(-10px)');
  const g = await started({}, {}, { reducedMotion: true });
  g.go('experimental');
  g.go('main');
  assert.deepEqual(g.animations, [], 'nothing under reduced motion');
  assert.deepEqual(g.focused, ['.back', '.more'], 'focus still moves');
});
