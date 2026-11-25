import test from 'node:test';
import assert from 'node:assert/strict';
import status from '../extension/shared/status.js';

const railOn = { opts: { rail: true } };

test('missing selector after observing turns fails; unexercised hooks stay neutral', () => {
  const states = status.classify(
    { container: { exercised: true, failed: true } },
    { opts: { older: true } },
  );
  assert.equal(states.container, 'fail');
  for (const key of ['cv', 'throttle', 'older', 'rail']) assert.equal(states[key], 'idle');
});
test('confirmed engagement works; ambiguous exercise stays neutral', () => {
  assert.equal(status.classify({ cv: { engaged: true } }).cv, 'ok');
  assert.equal(
    status.classify({ older: { exercised: true } }, { opts: { older: true } }).older,
    'idle',
  );
});
test('individual and master switches override engagement and failure', () => {
  const facts = Object.fromEntries(
    status.keys.map((k) => [k, { engaged: true, exercised: true, failed: true }]),
  );
  assert.equal(status.classify(facts, { opts: { cv: false } }).cv, 'off');
  assert.equal(status.classify(facts).cv, 'ok');
  assert.deepEqual(
    Object.values(status.classify(facts, { enabled: false })),
    status.keys.map(() => 'off'),
  );
});
test('partial and missing storage values keep all defaults; English is default', () => {
  assert.deepEqual(status.normalize(), {
    enabled: true,
    opts: Object.fromEntries(status.keys.map((k) => [k, !['older', 'seek', 'layout'].includes(k)])),
    layoutConsent: 'pending',
    lang: 'en',
  });
  assert.equal(status.normalize({ lang: 'fr', opts: { rail: false } }).lang, 'en');
  assert.equal(status.normalize({ lang: 'zh' }).lang, 'zh');
  assert.equal(status.normalize({ opts: { rail: false } }).opts.container, true);
});

test('groups preserve old option values, default seek off, and toggle all keys together', () => {
  const old = {
    enabled: false,
    lang: 'zh',
    custom: 42,
    opts: {
      container: false,
      cv: true,
      throttle: true,
      older: false,
      rail: false,
      layout: false,
      branch: false,
      future: false,
    },
  };
  const migrated = status.normalize(old);
  assert.equal(migrated.opts.seek, false);
  assert.equal(migrated.custom, 42);
  assert.equal(migrated.opts.future, false);
  assert.equal(status.groupOn(migrated, 'streaming'), false);
  assert.equal(status.groupOn(migrated, 'scrolling'), false);
  assert.deepEqual(status.groups, {
    streaming: ['container', 'cv', 'throttle'],
    scrolling: ['older', 'seek'],
    rail: ['rail'],
    branch: ['branch'],
    bookmarks: ['bookmark'],
    layout: ['layout'],
  });
  for (const group of Object.keys(status.groups)) {
    // Keys missing from old values (such as branch) default on; start every group from off.
    const start = status.groupOn(migrated, group) ? status.toggleGroup(migrated, group) : migrated;
    const on = status.toggleGroup(start, group);
    assert.ok(status.groups[group].every((key) => on.opts[key]));
    const off = status.toggleGroup(on, group);
    assert.ok(status.groups[group].every((key) => !off.opts[key]));
    assert.equal(off.enabled, false);
    assert.equal(off.lang, 'zh');
    assert.equal(off.opts.future, false);
    for (const key of Object.keys(migrated.opts).filter((k) => !status.groups[group].includes(k)))
      assert.equal(on.opts[key], migrated.opts[key]);
  }
  assert.deepEqual(old.opts, {
    container: false,
    cv: true,
    throttle: true,
    older: false,
    rail: false,
    layout: false,
    branch: false,
    future: false,
  });
});
test('master status depends on connection and pause only; never waits for feature evidence', () => {
  assert.equal(status.masterState({}, true), 'ok');
  assert.equal(status.masterState({}, false), 'away');
  assert.equal(status.masterState({ enabled: false }, true), 'paused');
  assert.equal(status.masterState({ enabled: false }, false), 'paused');
  assert.ok(!Object.values(status.classify()).includes('wait'));
});
test('only exercised failures persist; chat changes, unrelated successes and off switches preserve them', () => {
  assert.deepEqual(
    status.updateFailures({}, status.classify({ rail: { failed: true } }, railOn)),
    {},
  );
  const failed = status.updateFailures(
    {},
    status.classify(
      {
        rail: { exercised: true, failed: true },
        cv: { exercised: true, failed: true },
      },
      railOn,
    ),
  );
  assert.deepEqual(failed, { streaming: { cv: true }, rail: { rail: true } });
  assert.deepEqual(status.updateFailures(failed, status.classify()), failed);
  assert.deepEqual(status.updateFailures(failed, status.classify({}, { enabled: false })), failed);
  assert.deepEqual(status.updateFailures(failed, { container: 'ok' }), failed);
  const recovered = status.updateFailures(failed, { cv: 'ok' });
  assert.deepEqual(recovered, { rail: { rail: true } });
  assert.deepEqual(status.updateFailures(recovered, { rail: 'ok' }), {});
  assert.deepEqual(failed, { streaming: { cv: true }, rail: { rail: true } });
});
test('Ask in branch defaults on, keeps an explicit off, and toggles as its own group', () => {
  assert.equal(status.normalize().opts.branch, true);
  assert.equal(status.normalize({ opts: { rail: false } }).opts.branch, true);
  assert.equal(status.normalize({ opts: { branch: false } }).opts.branch, false);
  assert.equal(status.groupOn({}, 'branch'), true);
  const off = status.toggleGroup({ lang: 'zh', opts: { rail: true } }, 'branch');
  assert.equal(off.opts.branch, false);
  assert.equal(off.opts.rail, true);
  assert.equal(status.classify({}, off).branch, 'off');
  assert.equal(status.toggleGroup(off, 'branch').opts.branch, true);
});
test('a branch failure is kept as its own group and cleared only by a branch success', () => {
  const failed = status.updateFailures({}, { branch: 'fail' });
  assert.deepEqual(failed, { branch: { branch: true } });
  assert.deepEqual(status.updateFailures(failed, { branch: 'idle', rail: 'ok' }), failed);
  assert.deepEqual(status.updateFailures(failed, { branch: 'off' }), failed);
  assert.deepEqual(status.updateFailures(failed, { branch: 'ok' }), {});
});
test('Bookmarks default on, keep an explicit off, survive unknown values, and toggle as their own group', () => {
  assert.equal(status.normalize().opts.bookmark, true);
  assert.equal(status.normalize({ opts: { rail: false } }).opts.bookmark, true);
  assert.equal(status.normalize({ opts: { bookmark: 'no' } }).opts.bookmark, true);
  assert.equal(status.normalize({ opts: { bookmark: false } }).opts.bookmark, false);
  assert.equal(status.groupOn({}, 'bookmarks'), true);
  const off = status.toggleGroup({ lang: 'zh', layoutConsent: 'pending' }, 'bookmarks');
  assert.equal(off.opts.bookmark, false);
  assert.equal(off.opts.rail, true);
  assert.equal(off.layoutConsent, 'pending', 'no consent of their own');
  assert.equal(status.classify({}, off).bookmark, 'off');
  assert.equal(status.toggleGroup(off, 'bookmarks').opts.bookmark, true);
});
test('bookmarks are active only while Butter, the rail and Bookmarks are all on', () => {
  assert.equal(status.bookmarksOn(), true, 'both start on');
  assert.equal(status.bookmarksOn({ enabled: false }), false);
  assert.equal(status.bookmarksOn({ opts: { rail: false } }), false, 'the rail is off');
  assert.equal(status.bookmarksOn({ opts: { bookmark: false } }), false, 'Bookmarks are off');
  assert.equal(status.classify({}, { enabled: false }).bookmark, 'off');
});
test('with no health facts reported, the bookmark key is never recorded as a failure', () => {
  const states = status.classify(
    { rail: { exercised: true, failed: true } },
    { opts: { rail: true, bookmark: true } },
  );
  assert.equal(states.bookmark, 'idle');
  assert.deepEqual(status.updateFailures({}, states), { rail: { rail: true } });
});

test('Smoother scrolling and layouts read off unless switched on; every other feature reads on', () => {
  for (const value of [
    undefined,
    {},
    { opts: {} },
    { opts: { older: 'yes', seek: 1 } },
    { opts: { older: null, seek: undefined } },
    { layoutConsent: 'pending', opts: { layout: true } },
  ]) {
    const s = status.normalize(value);
    assert.equal(s.opts.older, false, JSON.stringify(value));
    assert.equal(s.opts.seek, false, JSON.stringify(value));
    assert.equal(s.opts.layout, false, JSON.stringify(value));
    for (const key of ['container', 'cv', 'throttle', 'rail', 'branch', 'bookmark'])
      assert.equal(s.opts[key], true, `${key} in ${JSON.stringify(value)}`);
  }
  const on = status.normalize({ layoutConsent: 'granted', opts: { older: true, seek: true } });
  assert.deepEqual([on.opts.older, on.opts.seek, on.opts.layout], [true, true, true]);
  const off = status.normalize({
    layoutConsent: 'granted',
    opts: { rail: false, bookmark: false, layout: false },
  });
  assert.deepEqual([off.opts.rail, off.opts.bookmark, off.opts.layout], [false, false, false]);
});

test('the experimental groups are Smoother scrolling and layouts, in that order, and each is a group', () => {
  assert.deepEqual(status.experimental, ['scrolling', 'layout']);
  for (const group of status.experimental) assert.ok(status.groups[group], group);
});

test('the settings marker survives normalizing', () => {
  const marked = status.migrate(undefined, 'install');
  assert.equal(status.normalize(marked).defaultsVersion, marked.defaultsVersion);
  assert.ok(marked.defaultsVersion >= 1);
});

test('install stamps defaults version 2: the rail and Bookmarks read on, scrolling and layouts off', () => {
  for (const value of [undefined, {}, { lang: 'zh', bookmarkNotice: 'acknowledged' }]) {
    const next = status.migrate(value, 'install');
    assert.deepEqual(next, { ...value, defaultsVersion: 2 });
    const s = status.normalize(next);
    assert.deepEqual(
      [s.opts.rail, s.opts.bookmark, s.opts.older, s.opts.seek, s.opts.layout],
      [true, true, false, false, false],
    );
    assert.equal(status.migrate(next, 'update'), undefined, 'a later update changes nothing');
  }
});

// What the update to defaults version 2 must keep: every field but older, seek and the marker.
const without = (v) => {
  const copy = structuredClone(v || {});
  delete copy.defaultsVersion;
  delete copy.opts?.older;
  delete copy.opts?.seek;
  if (copy.opts && !Object.keys(copy.opts).length) delete copy.opts;
  return copy;
};

test('the update switches Smoother scrolling off once, from alpha.22 storage, keeping everything else', () => {
  // v0.1.0-alpha.22 and earlier store no defaultsVersion; their rail and Bookmarks were on unless
  // stored false, as they read now.
  for (const value of [
    undefined,
    {},
    { opts: { older: true, seek: true } },
    { opts: { seek: false } },
    { opts: { rail: false } },
    { opts: { bookmark: false } },
    { opts: { rail: false, bookmark: false, older: true } },
    { enabled: false, lang: 'zh' },
    { layoutConsent: 'granted', opts: { layout: true } },
    { layoutConsent: 'declined', opts: { layout: false } },
    { bookmarkNotice: 'acknowledged', opts: { branch: false, cv: false } },
  ]) {
    const before = structuredClone(value);
    const next = status.migrate(value, 'update');
    assert.deepEqual(value, before, 'the old value is not changed in place');
    assert.equal(next.defaultsVersion, 2);
    assert.equal(next.opts.older, false, JSON.stringify(value));
    assert.equal(next.opts.seek, false, JSON.stringify(value));
    const s = status.normalize(next),
      was = status.normalize(value);
    for (const key of ['rail', 'bookmark', 'layout', 'container', 'cv', 'throttle', 'branch'])
      assert.equal(s.opts[key], was.opts[key], `${key} in ${JSON.stringify(value)}`);
    assert.equal(s.opts.rail, value?.opts?.rail !== false, 'the rail as alpha.22 read it');
    assert.equal(s.opts.bookmark, value?.opts?.bookmark !== false, 'Bookmarks as alpha.22 read it');
    assert.equal(s.layoutConsent, was.layoutConsent);
    assert.deepEqual(without(next), without(value));
    assert.equal(status.migrate(next, 'update'), undefined, 'it runs once');
  }
});

test('the update switches Smoother scrolling off from defaults version 1 storage too', () => {
  // Builds of main since #164 stamped 1 and stored the rail and Bookmarks explicitly.
  for (const value of [
    { defaultsVersion: 1 },
    { defaultsVersion: 1, opts: { rail: true, bookmark: true, older: true, seek: true } },
    { defaultsVersion: 1, opts: { rail: false, bookmark: false } },
    { defaultsVersion: 1, layoutConsent: 'granted', opts: { layout: true, seek: true } },
  ]) {
    const next = status.migrate(value, 'update');
    assert.equal(next.defaultsVersion, 2);
    assert.deepEqual([next.opts.older, next.opts.seek], [false, false]);
    assert.deepEqual(without(next), without(value));
    const s = status.normalize(next);
    assert.equal(s.opts.rail, value.opts?.rail !== false);
    assert.equal(s.opts.bookmark, value.opts?.bookmark !== false);
  }
});

test('Smoother scrolling switched back on after the update stays on through later updates', () => {
  const updated = status.migrate({ opts: { older: true, seek: true } }, 'update');
  const switched = status.toggleGroup(updated, 'scrolling');
  assert.equal(status.groupOn(switched, 'scrolling'), true);
  assert.equal(status.migrate(switched, 'update'), undefined);
  assert.equal(status.migrate({ ...switched, defaultsVersion: 3 }, 'update'), undefined);
});

test('an update after the marker, and any other reason, changes nothing', () => {
  const marked = status.migrate({ opts: { rail: false } }, 'install');
  assert.equal(status.migrate(marked, 'update'), undefined);
  for (const reason of ['chrome_update', 'shared_module_update', undefined])
    for (const value of [undefined, {}, { opts: { seek: true } }, { defaultsVersion: 1 }, marked])
      assert.equal(status.migrate(value, reason), undefined, `${reason}`);
});
