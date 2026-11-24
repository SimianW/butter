import test from 'node:test';
import assert from 'node:assert/strict';
import status from '../extension/shared/status.js';

const railOn = { opts: { rail: true } };

test('missing selector after observing turns fails; unexercised hooks stay neutral', () => {
  const states = status.classify(
    { container: { exercised: true, failed: true } },
    { opts: { rail: true } },
  );
  assert.equal(states.container, 'fail');
  for (const key of ['cv', 'throttle', 'older', 'rail']) assert.equal(states[key], 'idle');
});
test('confirmed engagement works; ambiguous exercise stays neutral', () => {
  assert.equal(status.classify({ cv: { engaged: true } }).cv, 'ok');
  assert.equal(status.classify({ older: { exercised: true } }).older, 'idle');
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
    opts: Object.fromEntries(
      status.keys.map((k) => [k, !['rail', 'bookmark', 'layout'].includes(k)]),
    ),
    layoutConsent: 'pending',
    lang: 'en',
  });
  assert.equal(status.normalize({ lang: 'fr', opts: { rail: false } }).lang, 'en');
  assert.equal(status.normalize({ lang: 'zh' }).lang, 'zh');
  assert.equal(status.normalize({ opts: { rail: false } }).opts.container, true);
});

test('groups preserve old option values, default seek on, and toggle all keys together', () => {
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
  assert.equal(migrated.opts.seek, true);
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
test('Bookmarks start off, are on only when stored true, and toggle as their own group', () => {
  assert.equal(status.normalize().opts.bookmark, false);
  assert.equal(status.normalize({ opts: { rail: true } }).opts.bookmark, false);
  assert.equal(status.normalize({ opts: { bookmark: 'no' } }).opts.bookmark, false);
  assert.equal(status.normalize({ opts: { bookmark: false } }).opts.bookmark, false);
  assert.equal(status.normalize({ opts: { bookmark: true } }).opts.bookmark, true);
  assert.equal(status.groupOn({}, 'bookmarks'), false);
  const on = status.toggleGroup({ lang: 'zh', layoutConsent: 'pending' }, 'bookmarks');
  assert.equal(on.opts.bookmark, true);
  assert.equal(on.opts.rail, false);
  assert.equal(on.layoutConsent, 'pending', 'no consent of their own');
  assert.equal(status.classify({}, on).bookmark, 'idle');
  const off = status.toggleGroup(on, 'bookmarks');
  assert.equal(off.opts.bookmark, false);
  assert.equal(status.classify({}, off).bookmark, 'off');
});
test('bookmarks are active only while Butter, the rail and Bookmarks are all on', () => {
  const on = { opts: { rail: true, bookmark: true } };
  assert.equal(status.bookmarksOn(), false, 'both start off');
  assert.equal(status.bookmarksOn(on), true);
  assert.equal(status.bookmarksOn({ ...on, enabled: false }), false);
  assert.equal(status.bookmarksOn({ opts: { bookmark: true } }), false, 'the rail is off');
  assert.equal(status.bookmarksOn({ opts: { rail: true } }), false, 'Bookmarks are off');
  assert.equal(status.bookmarksOn({ opts: { rail: true, bookmark: false } }), false);
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

test('the rail, Bookmarks and layouts read off unless switched on; the other features keep on', () => {
  for (const value of [
    undefined,
    {},
    { opts: {} },
    { opts: { rail: 'yes', bookmark: 1 } },
    { opts: { rail: null, bookmark: undefined } },
    { layoutConsent: 'pending', opts: { layout: true } },
  ]) {
    const s = status.normalize(value);
    assert.equal(s.opts.rail, false, JSON.stringify(value));
    assert.equal(s.opts.bookmark, false, JSON.stringify(value));
    assert.equal(s.opts.layout, false, JSON.stringify(value));
    for (const key of ['container', 'cv', 'throttle', 'older', 'seek', 'branch'])
      assert.equal(s.opts[key], true, `${key} in ${JSON.stringify(value)}`);
  }
  const on = status.normalize({ layoutConsent: 'granted', opts: { rail: true, bookmark: true } });
  assert.deepEqual([on.opts.rail, on.opts.bookmark, on.opts.layout], [true, true, true]);
  const off = status.normalize({
    layoutConsent: 'granted',
    opts: { rail: false, bookmark: false, layout: false },
  });
  assert.deepEqual([off.opts.rail, off.opts.bookmark, off.opts.layout], [false, false, false]);
});

test('the experimental groups are the rail, Bookmarks and layouts, and each is a group', () => {
  assert.deepEqual(status.experimental, ['rail', 'bookmarks', 'layout']);
  for (const group of status.experimental) assert.ok(status.groups[group], group);
});

test('the settings marker survives normalizing', () => {
  const marked = status.migrate(undefined, 'install');
  assert.equal(status.normalize(marked).defaultsVersion, marked.defaultsVersion);
  assert.ok(marked.defaultsVersion >= 1);
});

test('install marks the settings, and the three experimental features read off', () => {
  for (const value of [undefined, {}, { lang: 'zh', bookmarkNotice: 'acknowledged' }]) {
    const next = status.migrate(value, 'install');
    assert.deepEqual(next, { ...value, defaultsVersion: next.defaultsVersion });
    const s = status.normalize(next);
    assert.deepEqual([s.opts.rail, s.opts.bookmark, s.opts.layout], [false, false, false]);
    assert.equal(status.migrate(next, 'update'), undefined, 'a later update changes nothing');
  }
});

test('the first update keeps on what the old rule read as on, and every other field', () => {
  const oldRule = (value, key) => value?.opts?.[key] !== false;
  for (const value of [
    undefined,
    {},
    { opts: { rail: false } },
    { opts: { bookmark: false } },
    { opts: { rail: false, bookmark: false } },
    { enabled: false },
    { lang: 'zh' },
    { layoutConsent: 'granted', opts: { layout: true } },
    { layoutConsent: 'granted', opts: { layout: false } },
    { layoutConsent: 'declined', opts: { layout: false } },
    { layoutConsent: 'pending' },
    {
      enabled: false,
      lang: 'zh',
      bookmarkNotice: 'acknowledged',
      opts: { branch: false, cv: false },
    },
  ]) {
    const before = structuredClone(value);
    const next = status.migrate(value, 'update');
    assert.deepEqual(value, before, 'the old value is not changed in place');
    assert.ok(next.defaultsVersion >= 1);
    const s = status.normalize(next);
    const was = status.normalize(value);
    for (const key of ['rail', 'bookmark'])
      assert.equal(s.opts[key], oldRule(value, key), `${key} in ${JSON.stringify(value)}`);
    assert.equal(s.opts.layout, was.opts.layout);
    assert.equal(s.layoutConsent, was.layoutConsent);
    assert.equal(next.layoutConsent, value?.layoutConsent);
    assert.equal(next.opts.layout, value?.opts?.layout);
    // Everything but the rail, Bookmarks and the marker is stored exactly as it was.
    const without = (v) => {
      const copy = structuredClone(v || {});
      delete copy.defaultsVersion;
      delete copy.opts?.rail;
      delete copy.opts?.bookmark;
      if (copy.opts && !Object.keys(copy.opts).length) delete copy.opts;
      return copy;
    };
    assert.deepEqual(without(next), without(value));
    assert.equal(status.migrate(next, 'update'), undefined, 'it runs once');
  }
});

test('an update after the marker, and any other reason, changes nothing', () => {
  const marked = status.migrate({ opts: { rail: false } }, 'install');
  assert.equal(status.migrate(marked, 'update'), undefined);
  for (const reason of ['chrome_update', 'shared_module_update', undefined])
    for (const value of [undefined, {}, { opts: { rail: false } }, marked])
      assert.equal(status.migrate(value, reason), undefined, `${reason}`);
});
