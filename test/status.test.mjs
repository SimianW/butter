import test from 'node:test';
import assert from 'node:assert/strict';
import status from '../extension/shared/status.js';

test('missing selector after observing turns fails; unexercised hooks wait', () => {
  const states = status.classify({ container: { exercised: true, failed: true } });
  assert.equal(states.container, 'fail');
  for (const key of ['cv', 'throttle', 'older', 'rail']) assert.equal(states[key], 'wait');
});
test('confirmed engagement works; ambiguous exercise waits', () => {
  assert.equal(status.classify({ cv: { engaged: true } }).cv, 'ok');
  assert.equal(status.classify({ older: { exercised: true } }).older, 'wait');
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
    opts: Object.fromEntries([...status.keys, 'layout'].map((k) => [k, true])),
    lang: 'en',
  });
  assert.equal(status.normalize({ lang: 'fr', opts: { rail: false } }).lang, 'en');
  assert.equal(status.normalize({ lang: 'zh' }).lang, 'zh');
  assert.equal(status.normalize({ opts: { rail: false } }).opts.container, true);
});
