import test from 'node:test';
import assert from 'node:assert/strict';
import status from '../extension/shared/status.js';

test('missing selector after observing turns fails; unexercised hooks stay neutral', () => {
  const states = status.classify({ container: { exercised: true, failed: true } });
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
    opts: Object.fromEntries(status.keys.map((k) => [k, k !== 'layout'])),
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
  assert.deepEqual(status.updateFailures({}, status.classify({ rail: { failed: true } })), {});
  const failed = status.updateFailures(
    {},
    status.classify({
      rail: { exercised: true, failed: true },
      cv: { exercised: true, failed: true },
    }),
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
  const off = status.toggleGroup({ lang: 'zh' }, 'branch');
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
