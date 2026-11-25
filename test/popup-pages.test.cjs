// The popup's two pages (#158): the main page with the finished features and the Experimental row,
// and the Experimental page with Smoother scrolling and Remember long-chat layouts.
const test = require('node:test');
const assert = require('node:assert/strict');
const { popup, rows, descriptions, tick } = require('./helpers/popup-fixture.cjs');

const keys = (html) => rows(html).map((r) => r.key);
// The Experimental row: its text and count, or undefined when the page has none.
const experimentalRow = (html) => {
  const m = html.match(
    /<button type="button" class="exp-row" data-go="experimental"><svg class="ic"[^>]*>.*?<\/svg><span>(.*?)<\/span><span class="cnt">(.*?)<\/span><svg class="chev"[^>]*>.*?<\/svg><\/button>/,
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

test('on a fresh install the main page lists the four finished features and a quiet Experimental row', async () => {
  const f = await started();
  assert.deepEqual(keys(f.html()), ['streaming', 'rail', 'branch', 'bookmarks']);
  assert.deepEqual(experimentalRow(f.html()), { text: 'Experimental', count: '' });
  assert.match(f.html(), /class="master/);
  assert.equal(back(f.html()), undefined);
  assert.equal(lead(f.html()), undefined);
  // The Experimental row is a real button, not a switch or a label.
  assert.doesNotMatch(f.html(), /class="exp-row"[^>]*role=/);
  assert.doesNotMatch(f.html(), /class="note"/, 'the privacy note lives on the Experimental page');
});

test('the Experimental row counts the experimental switches that are on, even while paused', async () => {
  const cases = [
    [{ layoutConsent: 'granted', opts: { older: true, seek: true } }, '2 on'],
    [{ layoutConsent: 'granted', opts: { older: true, seek: true }, enabled: false }, '2 on'],
    [{ opts: { older: true, seek: true } }, '1 on'],
    [{ layoutConsent: 'granted' }, '1 on'],
    [{ layoutConsent: 'declined', opts: { older: true, seek: true } }, '1 on'],
    // Smoother scrolling counts as one switch only with both of its keys on.
    [{ opts: { seek: true } }, ''],
    [{ opts: { rail: true, bookmark: true } }, ''],
  ];
  for (const [butter, count] of cases) {
    const f = await started(butter);
    assert.equal(experimentalRow(f.html()).count, count, JSON.stringify(butter));
  }
  const f = await started({
    lang: 'zh',
    layoutConsent: 'granted',
    opts: { older: true, seek: true },
  });
  assert.deepEqual(experimentalRow(f.html()), { text: '实验功能', count: '已开启 2 项' });
});

test('the Experimental row opens the Experimental page and its title goes back, moving focus', async () => {
  const f = await started();
  f.go('experimental');
  assert.deepEqual(keys(f.html()), ['scrolling', 'layout']);
  assert.deepEqual(back(f.html()), ['Back to all features', 'Experimental']);
  assert.equal(
    lead(f.html()),
    'Unfinished features. Each stays off until you switch it on, and may misbehave.',
  );
  assert.doesNotMatch(f.html(), /class="master/, 'no Enable Butter card');
  assert.equal(experimentalRow(f.html()), null);
  assert.match(f.html(), /<div class="card exp">/);
  // The header and footer stay.
  assert.match(f.html(), /class="hd".*class="word">Butter<.*class="ver"/s);
  assert.match(f.html(), /class="ft">.*GitHub.*data-lang="zh".*data-lang="en"/s);
  // Fresh install: both off.
  assert.deepEqual(
    rows(f.html()).map((r) => r.on),
    [false, false],
  );
  assert.deepEqual(f.focused, ['.back']);
  f.go('main');
  assert.deepEqual(keys(f.html()), ['streaming', 'rail', 'branch', 'bookmarks']);
  assert.deepEqual(f.focused, ['.back', '.exp-row']);
});

test('the Experimental page stays open through settings, failures, polling and a language switch', async () => {
  const f = await started();
  f.go('experimental');
  f.changed({ butter: { newValue: { opts: { older: true, seek: true } } } }, 'local');
  assert.deepEqual(keys(f.html()), ['scrolling', 'layout']);
  assert.equal(rows(f.html())[0].on, true);
  f.changed({ butterFailures: { newValue: { scrolling: { seek: true } } } }, 'session');
  assert.deepEqual(keys(f.html()), ['scrolling', 'layout']);
  f.toggle('layout');
  await tick();
  assert.equal(f.saved.at(-1).butter.opts.layout, true);
  assert.deepEqual(keys(f.html()), ['scrolling', 'layout']);
  f.changed({ butter: { newValue: { lang: 'zh', opts: { seek: true } } } }, 'local');
  assert.deepEqual(back(f.html()), ['返回全部功能', '实验功能']);
  assert.equal(lead(f.html()), '尚未完成的功能。每项在你打开前都保持关闭，可能会出问题。');
  assert.deepEqual(
    rows(f.html()).map((r) => r.name),
    ['长对话滚动更顺', '记住长对话的布局'],
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
  assert.equal(rows(g.html())[1].on, false);
});

test('Bookmarks on with the rail off says it needs the rail on the main page', async () => {
  const f = await started({ opts: { rail: false } });
  assert.equal(descriptions(f.html()).bookmarks, 'Needs the question rail');
});

test('layouts on with Smoother scrolling off says it needs Smoother scrolling on the Experimental page', async () => {
  const f = await started({ layoutConsent: 'granted' });
  f.go('experimental');
  assert.equal(descriptions(f.html()).layout, 'Needs Smoother scrolling');
  f.toggle('scrolling');
  assert.equal(descriptions(f.html()).layout, 'Faster jumps when you come back');
});

test('faults show only in their own row, and the short text counts the broken groups on the page showing', async () => {
  const failures = { butterFailures: { scrolling: { seek: true }, branch: { branch: true } } };
  const f = await started({ opts: { older: true, seek: true } }, failures);
  const long = 'Unavailable for now. ChatGPT may have changed its page; Butter resumes on its own.';
  // Main page: only Ask in branch is broken here; the Experimental row shows no fault.
  assert.equal(descriptions(f.html()).branch, long);
  assert.doesNotMatch(f.html(), /class="exp-row[^"]*bad/);
  assert.deepEqual(experimentalRow(f.html()), { text: 'Experimental', count: '1 on' });
  f.go('experimental');
  assert.equal(descriptions(f.html()).scrolling, long);
  assert.match(f.html(), /<label class="row bad" for="sw-scrolling">/);
  // Two broken groups on the Experimental page: each says it in one line.
  const g = await started(
    { layoutConsent: 'granted', opts: { older: true, seek: true } },
    { butterFailures: { scrolling: { seek: true }, layout: { layout: true } } },
  );
  g.go('experimental');
  assert.equal(descriptions(g.html()).scrolling, 'Unavailable; resumes on its own.');
  assert.match(descriptions(g.html()).layout, /^Unavailable; resumes on its own\./);
  g.go('main');
  assert.equal(descriptions(g.html()).branch, 'Select text, ask about it in a new branch');
});

test('paused, the Experimental page card looks paused like the main card', async () => {
  const f = await started({ enabled: false, opts: { older: true, seek: true } });
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
  f.toggle('scrolling');
  assert.equal(f.animations.length, 1, 'nothing on re-renders');
  f.go('main');
  assert.equal(f.animations[1][1][0].transform, 'translateX(-10px)');
  const g = await started({}, {}, { reducedMotion: true });
  g.go('experimental');
  g.go('main');
  assert.deepEqual(g.animations, [], 'nothing under reduced motion');
  assert.deepEqual(g.focused, ['.back', '.exp-row'], 'focus still moves');
});
