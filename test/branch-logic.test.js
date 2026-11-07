const test = require('node:test');
const assert = require('node:assert/strict');
const branch = require('../extension/branch/logic.js');

test('message is a Markdown quote of every selected line, a blank line, then the question', () => {
  assert.equal(
    branch.formatMessage('first line\r\nsecond line\n\nfourth line', '  What does this mean?  '),
    '> first line\n> second line\n> \n> fourth line\n\nWhat does this mean?',
  );
});

test('the full quote is kept, never truncated', () => {
  const long = 'word '.repeat(2000).trim();
  assert.equal(branch.formatMessage(long, 'Why?'), `> ${long}\n\nWhy?`);
});

const SAVED = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const LOCAL = '0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
test('identity parsing reads saved and unsaved conversation routes, and nothing else', () => {
  assert.equal(branch.identity(`https://chatgpt.com/c/${SAVED}`), SAVED);
  assert.equal(branch.identity(`https://chatgpt.com/c/${SAVED.toUpperCase()}?model=x#y`), SAVED);
  assert.equal(branch.identity(`https://chatgpt.com/g/g-p-abc123/c/${SAVED}`), SAVED);
  assert.equal(
    branch.identity(`https://chatgpt.com/c/local-chatgpt%3A${LOCAL}`),
    `local-chatgpt:${LOCAL}`,
  );
  assert.equal(
    branch.identity(`https://chatgpt.com/c/local-chatgpt:${LOCAL}`),
    `local-chatgpt:${LOCAL}`,
  );
  for (const url of [
    'https://chatgpt.com/',
    'https://chatgpt.com/c/not-a-uuid',
    `https://example.com/c/${SAVED}`,
    `https://chatgpt.com/c/other:${SAVED}`,
    'not a url',
    undefined,
  ])
    assert.equal(branch.identity(url), null, String(url));
  assert.equal(branch.saved(SAVED), true);
  assert.equal(branch.saved(`local-chatgpt:${LOCAL}`), false);
});

test('a branch is a readable identity different from the original', () => {
  assert.equal(branch.isBranch(`local-chatgpt:${LOCAL}`, SAVED), true);
  assert.equal(branch.isBranch(LOCAL, SAVED), true);
  assert.equal(branch.isBranch(SAVED, SAVED), false);
  assert.equal(branch.isBranch(null, SAVED), false);
  assert.equal(branch.isBranch(SAVED, null), false);
});

// In-memory stand-in for chrome.storage.session (same promise API).
const memory = (rows = {}) => ({
  rows,
  get: async (key) => (key === null ? { ...rows } : key in rows ? { [key]: rows[key] } : {}),
  set: async (items) => Object.assign(rows, structuredClone(items)),
  remove: async (keys) => [keys].flat().forEach((key) => delete rows[key]),
});
const ID = '11111111-2222-4333-8444-555555555555';
const origin = { tab: { id: 7, url: `https://chatgpt.com/c/${SAVED}` } };
const dest = { tab: { id: 8, url: `https://chatgpt.com/c/${SAVED}#butter-branch=${ID}` } };
const job = { original: SAVED, title: 'Explain Corpus Meaning', quote: 'a\nb', question: 'Why?' };

test('a handoff job is claimed once by a new tab of the same conversation, then deleted', async () => {
  const store = memory(),
    handoff = branch.handoff(store);
  assert.deepEqual(await handoff.put(ID, job, origin, 1000), { ok: true });
  assert.deepEqual(Object.keys(store.rows), [`butterBranch.${ID}`]);
  assert.deepEqual(await handoff.claim(ID, dest, 2000), { job, origin: 7 });
  assert.deepEqual(store.rows, {});
  assert.deepEqual(await handoff.claim(ID, dest, 2001), { missing: true });
});

test('expired, foreign or malformed jobs are refused and deleted', async () => {
  const store = memory(),
    handoff = branch.handoff(store);
  await handoff.put(ID, job, origin, 1000);
  assert.deepEqual(await handoff.claim(ID, dest, 1000 + branch.TTL), {
    error: 'expired',
    origin: 7,
  });
  assert.deepEqual(store.rows, {});
  // Claimed from the original tab itself: never run the branch where the user is reading.
  await handoff.put(ID, job, origin, 1000);
  assert.deepEqual(await handoff.claim(ID, { tab: { ...origin.tab } }, 1001), {
    error: 'sender',
    origin: 7,
  });
  // Claimed from a tab showing a different conversation.
  await handoff.put(ID, job, origin, 1000);
  const other = { tab: { id: 9, url: `https://chatgpt.com/c/${LOCAL}` } };
  assert.deepEqual(await handoff.claim(ID, other, 1001), { error: 'sender', origin: 7 });
  assert.deepEqual(store.rows, {});
  // Put from a tab that isn't the job's conversation, or with missing text, is refused.
  assert.deepEqual(await handoff.put(ID, job, other, 1000), { error: 'invalid' });
  assert.deepEqual(await handoff.put(ID, { ...job, question: '  ' }, origin, 1000), {
    error: 'invalid',
  });
  assert.deepEqual(await handoff.put('nope', job, origin, 1000), { error: 'invalid' });
  assert.deepEqual(store.rows, {});
});

test('pruning deletes only expired branch jobs', async () => {
  const store = memory({ other: 1 }),
    handoff = branch.handoff(store);
  await handoff.put(ID, job, origin, 1000);
  const fresh = '11111111-2222-4333-8444-666666666666';
  await handoff.put(fresh, job, origin, 1000 + branch.TTL);
  await handoff.prune(1000 + branch.TTL + 1);
  assert.deepEqual(Object.keys(store.rows).sort(), ['butterBranch.' + fresh, 'other']);
});

test('a selection qualifies only as non-empty text inside one reply of a saved conversation', () => {
  const reply = {},
    other = {};
  const page = { temporary: false, work: false, branchAction: true }; // Chat mode, see branch-rules
  const ok = { text: ' corpus ', start: reply, end: reply, identity: SAVED, excluded: false, page };
  assert.equal(branch.qualifies(ok), true);
  assert.equal(branch.qualifies({ ...ok, text: '  \n ' }), false);
  assert.equal(branch.qualifies({ ...ok, end: other }), false);
  assert.equal(branch.qualifies({ ...ok, start: null, end: null }), false);
  assert.equal(branch.qualifies({ ...ok, excluded: true }), false);
  assert.equal(branch.qualifies({ ...ok, identity: null }), false);
  assert.equal(branch.qualifies({ ...ok, identity: `local-chatgpt:${LOCAL}` }), false);
});

test('settings add an Ask in branch key that defaults to on and can be turned off', () => {
  const status = require('../extension/shared/status.js');
  assert.ok(status.keys.includes('branch'));
  assert.equal(status.normalize().opts.branch, true);
  assert.equal(status.normalize({ opts: { rail: false } }).opts.branch, true);
  assert.equal(status.normalize({ opts: { branch: false } }).opts.branch, false);
  assert.equal(status.classify({}, { opts: { branch: false } }).branch, 'off');
});

test('status: menu, identity, load and page-error failures count against the feature; a long reply does not', () => {
  for (const cause of ['more', 'branch', 'newchat', 'identity', 'load', 'error'])
    assert.equal(branch.confirmedFailure(cause), true, cause);
  for (const cause of ['stream', undefined, 'cancelled'])
    assert.equal(branch.confirmedFailure(cause), false);
});
