// The bookmark session (bookmarks/session.js), through its interface only: an async in-memory store
// whose replies the test can hold and release, and a planted page the test changes between steps.
// What the rail is sent (`publish`) and what the notification is handed (`outcome`) are recorded.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const B = require('../extension/bookmarks/model.js');
const Session = require('../extension/bookmarks/session.js');

const sha = (s) => createHash('sha256').update(s).digest('hex');
const tick = () => new Promise(setImmediate);
const settle = async () => {
  for (let i = 0; i < 20; i++) await tick();
};
const A = 'a'.repeat(64),
  OTHER = 'b'.repeat(64);
const TEXT = 'Postgres skips an index when it expects a large share of rows to match.';
// The conversation as the rail lists it, raw ids, oldest first.
const ITEMS = [{ id: 'q1', q: 'First' }, { id: 'a1' }, { id: 'q2', q: 'Second' }, { id: 'a2' }];

// The worker's replies (bookmarks/worker.js), in memory. While `hold()` is on, every request waits
// in `held` until the test releases it; its reply is worked out then.
function memoryStore() {
  const rows = new Map(),
    log = [],
    held = [];
  let holding = false,
    failLists = 0;
  const reply = (type, f) => {
    if (type === 'butter-bookmark-list') {
      if (failLists && failLists--) return { error: 'bookmark-storage' };
      return {
        bookmarks: [...rows.values()]
          .filter((b) => b.account === f.account && b.conv === f.conv)
          .map((b) => ({ ...b })),
      };
    }
    if (type === 'butter-bookmark-create') {
      const b = B.clean(f.bookmark),
        key = B.key(b);
      if (rows.has(key)) return { bookmark: { ...rows.get(key) }, created: false };
      rows.set(key, { ...b, key });
      return { bookmark: { ...b, key }, created: true };
    }
    const p = rows.get(f.key);
    if (!p || p.account !== f.account || p.conv !== f.conv) return { deleted: false };
    rows.delete(f.key);
    return { deleted: true };
  };
  return {
    rows,
    log,
    held,
    send(type, fields) {
      log.push({ type, ...fields });
      if (!holding) return Promise.resolve().then(() => reply(type, fields));
      return new Promise((r) => held.push({ type, fields, go: () => r(reply(type, fields)) }));
    },
    hold: () => (holding = true),
    release: (i) => held.splice(i, 1)[0].go(),
    failNextList: () => failLists++,
    reads: () => log.filter((m) => m.type === 'butter-bookmark-list').length,
    // A stored bookmark, as the page would have made it.
    put(o = {}) {
      const b = B.clean({
        account: A,
        conv: sha('conv-1'),
        msg: sha('a1'),
        ask: sha('q1'),
        turn: 0,
        para: 0,
        start: 0,
        end: 20,
        excerpt: TEXT.slice(0, 40),
        line: 20,
        time: 1000,
        ...o,
      });
      const key = B.key(b);
      rows.set(key, { ...b, key });
      return key;
    },
  };
}

// One tab: the session over the store and a planted page. `page.texts`: the answers rendered now
// (raw id -> paragraph texts); `page.answered`: questions whose turn shows an answer.
function tab({ store = memoryStore() } = {}) {
  const page = { texts: new Map(), answered: new Set(), located: [] },
    published = [],
    outcomes = [],
    state = { off: false, requests: 0 };
  const session = Session({
    store: store.send,
    hash: async (s) => sha(s),
    page: {
      answers: () =>
        [...page.texts.keys()].map((id) => ({ id, paragraphs: () => page.texts.get(id) })),
      answered: (q) => page.answered.has(q),
      locate(turn, raw) {
        page.located.push(raw);
        return raw ? 10 : null;
      },
      wash: (turn, raw) => !!raw,
    },
    off: () => state.off,
    requestAccount: () => state.requests++,
    publish: (conv, { revision, groups }) => published.push({ conv, revision, groups }),
    outcome: (kind, bookmark, undo) => outcomes.push({ kind, bookmark, undo }),
  });
  const last = () => published.at(-1);
  // The last publish as { question id: [key, stale, fresh] }.
  const marks = (p = last()) =>
    Object.fromEntries(
      [...p.groups].map(([id, m]) => [id, m.bookmarks.map((b) => [b.key, b.stale, m.fresh])]),
    );
  // Saves a passage of answer `id`: what bookmarks/content.js hands over.
  const save = (o = {}) =>
    session.create({
      id: 'a1',
      ask: 'q1',
      conv: 'conv-1',
      para: 0,
      start: 0,
      end: 20,
      excerpt: TEXT.slice(0, 40),
      line: 20,
      ...o,
    });
  return { session, store, page, published, outcomes, state, last, marks, save };
}
// A tab signed in, showing conv-1 at revision 1 with both answers rendered.
async function shown(o) {
  const t = tab(o);
  t.page.texts.set('a1', [TEXT]).set('a2', ['Another answer.']);
  t.page.answered.add('q1').add('q2');
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  return t;
}

test('an account switch during a read publishes only the new account’s bookmarks', async () => {
  const t = tab();
  const mine = t.store.put(),
    theirs = t.store.put({ account: OTHER });
  t.store.hold();
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  assert.equal(t.store.held.length, 1, "A's read is waiting");
  t.session.setAccount(OTHER);
  await settle();
  assert.equal(t.store.held.length, 2);
  t.store.release(1); // the other account's read answers first
  await settle();
  t.store.release(0); // A's late answer is dropped
  await settle();
  assert.deepEqual(t.marks(), { q1: [[theirs, false, false]] });
  assert.ok(!t.published.some((p) => JSON.stringify(t.marks(p)).includes(mine)));
});

test('a chat switch during a read publishes only the chat in view', async () => {
  const t = tab();
  t.store.put();
  const there = t.store.put({ conv: sha('conv-2') });
  t.store.hold();
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  t.session.view('conv-2', [...ITEMS], true, 2);
  await settle();
  t.store.release(1);
  await settle();
  const count = t.published.length;
  t.store.release(0);
  await settle();
  assert.equal(t.published.length, count, 'the first chat is never published');
  assert.equal(t.last().conv, 'conv-2');
  assert.equal(t.last().revision, 2);
  assert.deepEqual(t.marks(), { q1: [[there, false, false]] });
});

test('while seeking nothing is read or published; one read and one publish when it ends', async () => {
  const t = tab();
  t.store.put();
  t.session.seek(true);
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  t.session.refresh();
  await settle();
  assert.equal(t.store.reads(), 0);
  assert.equal(t.published.length, 0);
  assert.equal(t.session.seeking, true);
  t.session.seek(false);
  await settle();
  assert.equal(t.store.reads(), 1);
  assert.equal(t.published.length, 1);
  assert.equal(t.last().revision, 1);
  t.session.seek(true);
  t.session.seek(false);
  await settle();
  assert.equal(t.published.length, 1, 'a seek that asked for nothing runs nothing');
});

test('a streamed answer, unmounted: its raw id still lands, and its staleness is remembered', async () => {
  const t = tab();
  // The answer streamed in this tab: on the page, never listed.
  const listed = [{ id: 'q1', q: 'First' }];
  t.page.texts.set('s1', [TEXT]);
  t.page.answered.add('q1');
  t.session.setAccount(A);
  t.session.view('conv-1', listed, true, 1);
  await settle();
  await t.save({ id: 's1' });
  await settle();
  const [[key]] = t.marks().q1;
  assert.deepEqual(t.marks().q1, [[key, false, true]], 'grows in under its question');
  // The answer changes (an edit), and the pointer reaches the rail.
  t.page.texts.set('s1', ['Something else entirely.']);
  t.session.check();
  await settle();
  assert.deepEqual(t.marks().q1, [[key, true, false]], 'stale');
  // ChatGPT unmounts the turn; the rail renders again.
  t.page.texts.delete('s1');
  t.page.answered.delete('q1');
  t.session.view('conv-1', [...listed], true, 2);
  await settle();
  assert.deepEqual(t.marks().q1, [[key, true, false]], 'still stale, as last seen');
  t.page.texts.set('s1', [TEXT]); // mounted again, as saved
  const m = t.last().groups.get('q1');
  assert.equal(m.land({}), 10);
  assert.deepEqual(t.page.located, ['s1'], 'the page is asked for the raw id');
  assert.equal(m.wash({}, m.bookmarks[0], false), true);
});

test('a bookmark leaves the earlier-history dots for its question, fresh, at the new revision', async () => {
  const t = tab();
  const key = t.store.put(); // on a1, under q1: not loaded yet
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS.slice(2), false, 1);
  await settle();
  assert.deepEqual(t.marks(), { [B.EARLIER]: [[key, false, false]] });
  t.page.texts.set('a1', [TEXT]);
  t.session.view('conv-1', ITEMS, true, 2); // the earlier page loaded
  await settle();
  assert.equal(t.last().revision, 2);
  assert.deepEqual(t.marks(), { q1: [[key, false, true]] });
  t.session.view('conv-1', [...ITEMS], true, 3);
  await settle();
  assert.deepEqual(t.marks(), { q1: [[key, false, false]] }, 'grows in once');
});

test('a duplicate save says "already": nothing fresh, the list unchanged', async () => {
  const t = await shown();
  await t.save();
  await settle();
  await t.save({ excerpt: TEXT.slice(0, 41) });
  await settle();
  assert.deepEqual(
    t.outcomes.map((o) => o.kind),
    ['saved', 'already'],
  );
  assert.equal(t.outcomes[1].undo, undefined, 'nothing to take back');
  assert.equal(t.store.rows.size, 1);
  const [[key]] = t.marks().q1;
  assert.deepEqual(t.marks(), { q1: [[key, false, false]] });
});

test('delete and Undo: the same key and time come back, fresh', async () => {
  const t = await shown();
  await t.save();
  await settle();
  const [b] = t.last().groups.get('q1').bookmarks;
  await t.last().groups.get('q1').remove(b);
  await settle();
  assert.equal(t.store.rows.size, 0);
  assert.deepEqual(t.marks(), {});
  const removed = t.outcomes.at(-1);
  assert.equal(removed.kind, 'removed');
  assert.equal(removed.bookmark.key, b.key);
  await removed.undo();
  await settle();
  const back = [...t.store.rows.values()];
  assert.deepEqual(
    back.map((x) => [x.key, x.time]),
    [[b.key, b.time]],
  );
  assert.deepEqual(t.marks(), { q1: [[b.key, false, true]] });
  // Undo of a save deletes it again.
  const saved = t.outcomes.find((o) => o.kind === 'saved');
  await saved.undo();
  await settle();
  assert.equal(t.store.rows.size, 0);
  assert.deepEqual(t.marks(), {});
});

test('Undo after the tab moved on goes to the bookmark’s own chat and account', async () => {
  const t = await shown();
  await t.save();
  await settle();
  const saved = t.outcomes.at(-1),
    reads = t.store.reads();
  t.session.view('conv-2', [...ITEMS], true, 2);
  t.session.setAccount(OTHER);
  await settle();
  const count = t.published.length;
  await saved.undo();
  await settle();
  assert.deepEqual(t.store.log.at(-1), {
    type: 'butter-bookmark-delete',
    account: A,
    conv: sha('conv-1'),
    key: saved.bookmark.key,
  });
  assert.equal(t.store.rows.size, 0);
  assert.equal(t.published.length, count, 'the chat in view hears nothing');
  // Back in conv-1 as A: the cached list was updated, not read again.
  t.session.setAccount(A);
  t.session.view('conv-1', [...ITEMS], true, 3);
  await settle();
  assert.equal(t.store.reads(), reads + 2, 'only conv-2 under each account was read');
  assert.deepEqual(t.marks(), {});
});

test('the publish carries the revision; a quiet check speaks only when something changed', async () => {
  const t = await shown();
  await t.save();
  await settle();
  assert.equal(t.last().revision, 1);
  let count = t.published.length;
  t.session.check();
  await settle();
  assert.equal(t.published.length, count, 'nothing changed: silent');
  // A render's read superseded by a quiet check before it answers: the same groups, but the rail
  // must hear the new revision or an earlier trip waits its full 1.5 s.
  t.session.view('conv-1', [...ITEMS], true, 2);
  t.session.check();
  await settle();
  assert.equal(t.published.length, count + 1);
  assert.equal(t.last().revision, 2);
  count = t.published.length;
  t.session.check();
  await settle();
  assert.equal(t.published.length, count);
  // A changed answer speaks in a quiet check.
  t.page.texts.set('a1', ['Rewritten.']);
  t.session.check();
  await settle();
  assert.equal(t.published.length, count + 1);
  assert.equal(t.marks().q1[0][1], true);
});

test('a list the store could not read is published empty and read again next time', async () => {
  const t = tab();
  const key = t.store.put();
  t.store.failNextList();
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  assert.deepEqual(t.marks(), {});
  t.session.view('conv-1', [...ITEMS], true, 2);
  await settle();
  assert.deepEqual(t.marks(), { q1: [[key, false, false]] });
  t.session.view('conv-1', [...ITEMS], true, 3);
  await settle();
  assert.equal(t.store.reads(), 2, 'read once it answered');
});

test('rail off or paused, or no account: no store reads and empty marks', async () => {
  const t = tab();
  t.store.put();
  t.state.off = true;
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  assert.equal(t.store.reads(), 0);
  assert.deepEqual(
    t.published.map((p) => [p.revision, p.groups.size]),
    [
      [null, 0],
      [null, 0],
    ],
  );
  assert.equal(t.state.requests, 0, 'the account is not asked for while off');
  t.state.off = false;
  t.session.refresh(); // the rail came on
  await settle();
  assert.equal(t.store.reads(), 1);
  assert.equal(t.last().groups.size, 1);
  t.session.setAccount('not a hash');
  await settle();
  assert.equal(t.session.signedIn, false);
  assert.equal(t.state.requests, 1, 'asked again');
  assert.deepEqual([t.last().revision, t.last().groups.size], [null, 0]);
  assert.equal(t.store.reads(), 1);
});

test('Bookmarks off publishes no marks; back on, it reads the store again', async () => {
  const t = await shown();
  const key = t.store.put();
  t.session.refresh();
  await settle();
  assert.equal(t.store.reads(), 1);
  t.state.off = true; // Bookmarks switched off
  t.session.refresh();
  await settle();
  assert.deepEqual([t.last().revision, t.last().groups.size], [null, 0]);
  // Another tab saves a bookmark while this one is off.
  const later = t.store.put({ start: 21, end: 40, excerpt: TEXT.slice(21, 40) });
  t.state.off = false;
  t.session.refresh();
  await settle();
  assert.equal(t.store.reads(), 2, 'read again, not served from before');
  assert.deepEqual(t.marks(), {
    q1: [
      [key, false, false],
      [later, false, false],
    ],
  });
});

test('the cleared token drops the lists and republishes empty marks', async () => {
  const t = tab();
  t.store.put();
  t.page.texts.set('a1', [TEXT]);
  t.page.answered.add('q1');
  t.session.setAccount(A);
  t.session.view('conv-1', ITEMS, true, 1);
  await settle();
  assert.equal(t.last().groups.size, 1);
  t.store.rows.clear(); // the popup's Clear emptied the store
  t.session.cleared();
  await settle();
  assert.deepEqual([t.last().revision, t.last().groups.size], [1, 0]);
  assert.equal(t.store.reads(), 2);
});

test('Undo of a removal still on screen after the Clear brings the bookmark and its dot back', async () => {
  const t = await shown();
  await t.save();
  await settle();
  const [b] = t.last().groups.get('q1').bookmarks;
  await t.last().groups.get('q1').remove(b);
  await settle();
  const removed = t.outcomes.at(-1);
  t.store.rows.clear(); // the popup's Clear emptied the store
  t.session.cleared();
  await settle();
  assert.deepEqual(t.marks(), {});
  await removed.undo();
  await settle();
  assert.deepEqual([...t.store.rows.keys()], [b.key]);
  assert.deepEqual(Object.keys(t.marks()), ['q1']);
  assert.equal(t.marks().q1[0][0], b.key);
});

test('Undo of a save still on screen after the Clear takes the dot away with the bookmark', async () => {
  const t = await shown();
  await t.save();
  await settle();
  const saved = t.outcomes.at(-1),
    { key, ...b } = saved.bookmark;
  t.store.rows.clear(); // the popup's Clear emptied the store
  t.store.put(b); // and another tab saved the same passage again
  t.session.cleared();
  await settle();
  assert.equal(t.marks().q1[0][0], key);
  await saved.undo();
  await settle();
  assert.equal(t.store.rows.size, 0);
  assert.deepEqual(t.marks(), {});
});
