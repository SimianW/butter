// The rail's conversations (extension/rail/conversations.js) through their interface: pages, sends and
// reconciliation against the mounted turns, and the items revision every new list takes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const Conversations = createRequire(import.meta.url)('../extension/rail/conversations.js');
const A = 'aaaaaaaa-0000-0000-0000-000000000001',
  C = 'cccccccc-0000-0000-0000-000000000003';
const q = (id) => ({ id, q: `Question ${id}` });
const a = (id) => ({ id }); // an answer: no `q`
const ids = (t) => t.items.map((x) => x.id);

function opened(items = [q('q1'), a('a1'), q('q2'), a('a2')], hasPrev = true) {
  const t = Conversations();
  t.open(A);
  t.page({ conv: A, before: null, hasPrev, items });
  return t;
}

test('the newest page sets the items; a refetch replaces what follows its first message', () => {
  const t = opened();
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2', 'a2']);
  assert.equal(t.hasPrev, true);
  t.page({ conv: A, before: null, hasPrev: false, items: [q('q2'), a('a2b'), q('q3')] });
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2', 'a2b', 'q3']);
  assert.equal(t.hasPrev, true, 'a refetch that overlaps keeps whether earlier history is loaded');
  t.page({ conv: A, before: null, hasPrev: false, items: [q('x1'), q('x2')] });
  assert.deepEqual(ids(t), ['x1', 'x2'], 'a newest page that does not overlap replaces them');
  assert.equal(t.hasPrev, false);
});

test('an older page goes in above, without the messages it shares; an empty or overlapping final page only completes history', () => {
  const t = opened();
  const page = { conv: A, before: 'q1', hasPrev: true, items: [q('q0'), a('a0'), q('q1')] };
  t.page(page);
  t.page(page); // the same page again
  assert.deepEqual(ids(t), ['q0', 'a0', 'q1', 'a1', 'q2', 'a2']);
  let rev = t.rev;
  t.page({ ...page, items: [q('q0')], hasPrev: true }); // starts where the loaded ones begin
  assert.equal(t.rev, rev, 'no new items, no new revision');
  t.page({ ...page, items: [], hasPrev: false });
  assert.equal(t.hasPrev, false);
  assert.equal(t.rev, rev);
  rev = t.rev;
  t.page({ conv: A, before: null, hasPrev: true, items: [] });
  assert.equal(t.hasPrev, false, 'an empty newest page changes nothing');
});

test('a sent question ends the thread; after an edit, what followed its parent goes', () => {
  const t = opened();
  t.send({ conv: A, parent: 'a2', item: q('q3') });
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2', 'a2', 'q3']);
  t.send({ conv: A, parent: 'a1', item: q('q2b') }); // q2 edited
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2b']);
  t.send({ parent: 'missing', item: q('q2b') }); // no conv: the one in view; the same id moves to the end
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2b']);
});

test('reconcile adds a mounted turn the responses missed and drops an old branch between two mounted turns', () => {
  const t = opened([q('q1'), a('a1'), q('old'), a('a-old'), q('q3'), a('a3')]);
  const texts = { q2: 'Question q2' };
  const text = (id) => texts[id];
  let rev = t.rev;
  // q2 mounted after q1's answer; the old branch between q1 and q3 is not.
  assert.equal(t.reconcile(['q1', 'q2', 'q3'], text), true);
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2', 'a-old', 'q3', 'a3']);
  assert.ok(t.rev > rev, 'a reconciled list takes a revision');
  rev = t.rev;
  assert.equal(t.reconcile(['q1', 'q2', 'q3'], text), false, 'nothing left to change');
  assert.equal(t.rev, rev);
  // A turn whose question text can't be read is left out; another chat's turns are not trusted.
  assert.equal(
    t.reconcile(['q0', 'q1'], () => ''),
    false,
  );
  assert.equal(
    t.reconcile(['z1', 'z2'], () => 'Other chat'),
    false,
  );
  assert.deepEqual(ids(t), ['q1', 'a1', 'q2', 'a-old', 'q3', 'a3']);
  // A turn mounted before every known one goes before the next mounted turn.
  assert.equal(
    t.reconcile(['q0', 'q1'], () => 'Question q0'),
    true,
  );
  assert.equal(ids(t)[0], 'q0');
  // An empty list takes the mounted turns.
  const empty = Conversations();
  empty.open(A);
  assert.equal(
    empty.reconcile(['m1', 'm2'], (id) => id),
    true,
  );
  assert.deepEqual(ids(empty), ['m1', 'm2']);
});

test('one revision counter for the tab: every new list takes the next, per conversation', () => {
  const t = opened();
  const r1 = t.rev;
  t.page({ conv: C, before: null, hasPrev: false, items: [q('c1'), q('c2')] }); // not in view
  assert.equal(t.rev, r1, 'the conversation in view keeps its revision');
  assert.equal(t.open(C), true);
  assert.ok(t.rev > r1);
  assert.deepEqual(ids(t), ['c1', 'c2']);
  assert.equal(t.open(C), false, 'already in view');
  t.open(A);
  assert.equal(t.rev, r1, 'a conversation kept in the tab keeps its items and revision');
  assert.ok(Object.isFrozen(t.items), 'callers cannot change the items');
});

test('a new chat that got its id keeps the questions it had before', () => {
  const t = Conversations();
  t.open(null);
  t.send({ parent: null, item: q('n1') });
  t.open(A);
  assert.deepEqual(ids(t), ['n1']);
  t.open(null);
  assert.deepEqual(ids(t), [], 'leaving for the home page shows none');
});
