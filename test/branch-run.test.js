// Branch run state machine, driven through a fake page adapter and a virtual clock.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start, TIMING } = require('../extension/branch/run.js');

const ORIGINAL = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const BRANCH = 'local-chatgpt:0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
const job = { original: ORIGINAL, title: 'Explain', quote: 'line one\nline two', question: 'Why?' };
const MESSAGE = '> line one\n> line two\n\nWhy?';

// A ChatGPT-like page in virtual time. Each option models one way the real page behaves.
function fakePage(o = {}) {
  let t = 0;
  const calls = [];
  const s = {
    id: o.startId ?? ORIGINAL,
    landAt: null, // virtual time the route changes after "Branch in new chat"
    composer: o.composer ?? '',
    sent: [],
    filled: [],
    menu: 0, // 0 closed, 1 top menu, 2 submenu
    streamingUntil: o.streamingUntil ?? 0,
  };
  const clock = {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
      if (s.landAt !== null && t >= s.landAt) {
        s.id = o.landId === undefined ? BRANCH : o.landId;
        s.landAt = null;
      }
      o.tick?.(t, s);
      await Promise.resolve();
    },
  };
  const handle = (name) => ({ name });
  const record =
    (name, fn) =>
    (...args) => {
      calls.push(name);
      return fn(...args);
    };
  const page = {
    identity: record('identity', () => s.id),
    isLoaded: record('isLoaded', () => t >= (o.loadedAt ?? 0)),
    isStreaming: record('isStreaming', () => t < s.streamingUntil),
    isRendered: record('isRendered', (id) => (o.rendered ?? true) && id === s.id),
    latestReplyMenu: record('latestReplyMenu', () =>
      o.noMore || t < s.streamingUntil ? null : handle('more'),
    ),
    branchItem: record('branchItem', () =>
      s.menu === 1 && !o.noBranchItem ? handle('branch') : null,
    ),
    newChatItem: record('newChatItem', () =>
      s.menu === 2 && !o.noNewChat && t >= (o.newChatFrom ?? 0) ? handle('newchat') : null,
    ),
    press: record('press', (h) => {
      if (h.name === 'more') s.menu = 1;
      if (h.name === 'branch') s.menu = 2;
      if (h.name === 'newchat') {
        s.newChatPresses = (s.newChatPresses || 0) + 1;
        s.menu = 0;
        s.landAt = t + (o.landAfter ?? 500);
        if (o.newChatThrows) throw new Error('detached');
      }
    }),
    dismissMenus: record('dismissMenus', () => (s.menu = 0)),
    composerText: record('composerText', () => (o.noComposer ? null : s.composer)),
    fill: record('fill', (text) => {
      // The rule under test everywhere: nothing is ever typed into the original conversation.
      assert.notEqual(s.id, ORIGINAL, 'typed into the original conversation');
      s.filled.push({ id: s.id, text });
      s.composer = text;
      return true;
    }),
    sendButton: record('sendButton', () =>
      o.noSend || t < (o.sendFrom ?? 0) ? null : handle('send'),
    ),
    send: record('send', () => {
      assert.notEqual(s.id, ORIGINAL, 'sent in the original conversation');
      s.sent.push({ id: s.id, text: s.composer });
      return true;
    }),
  };
  return { page, clock, s, calls, at: () => t };
}

const run = (fake, extra = {}) => {
  const states = [];
  const r = start({
    job,
    page: fake.page,
    clock: fake.clock,
    onState: (state, info) => {
      states.push(state);
      extra.onState?.(state, info, r);
    },
  });
  return r.done.then((result) => ({ ...result, states }));
};

test('happy path: branches, verifies the new identity, then sends the quote and question there', async () => {
  const fake = fakePage();
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.deepEqual(result.states, ['loading', 'branching', 'verifying', 'sending', 'ready']);
  assert.deepEqual(fake.s.sent, [{ id: BRANCH, text: MESSAGE }]);
  const presses = fake.calls.filter((c) => c === 'press').length;
  assert.equal(presses, 3);
});

test('false-failure regression: a menu step times out but the tab already landed on a branch → ready', async () => {
  // The submenu never shows up for Butter, yet ChatGPT made the branch anyway (a slow,
  // retried earlier step). The first version reported "Couldn't make a branch" here.
  const fake = fakePage({
    noNewChat: true,
    tick: (t, s) => {
      if (t === 2000) s.id = BRANCH;
    },
  });
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.deepEqual(fake.s.sent, [{ id: BRANCH, text: MESSAGE }]);
});

test('false-failure regression: the branch lands after the verification window → ready, not failed', async () => {
  const fake = fakePage({ landAfter: TIMING.verify + TIMING.recheck / 2 });
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.deepEqual(fake.s.sent, [{ id: BRANCH, text: MESSAGE }]);
});

test('false-failure regression: clicking "Branch in new chat" throws, but the branch is made → ready', async () => {
  const fake = fakePage({ newChatThrows: true });
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.equal(fake.s.sent.length, 1);
  assert.equal(fake.s.newChatPresses, 1);
});

test('a real failure is reported only after the re-check, and nothing is filled or sent', async () => {
  const fake = fakePage({ noNewChat: true });
  const result = await run(fake);
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'newchat');
  assert.deepEqual(fake.s.filled, []);
  assert.deepEqual(fake.s.sent, []);
  assert.ok(fake.at() >= TIMING.step * 2 + TIMING.recheck, 'failed before re-checking');
});

test('a missing More actions button fails as "more" after a retry, sending nothing', async () => {
  const fake = fakePage({ noMore: true });
  const result = await run(fake);
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'more');
  assert.deepEqual(fake.s.filled, []);
});

test('never sends when the identity stays equal to the original: fails without typing', async () => {
  const fake = fakePage({ landId: ORIGINAL });
  const result = await run(fake);
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'identity');
  assert.deepEqual(fake.s.filled, []);
  assert.deepEqual(fake.s.sent, []);
});

test('never sends when the identity cannot be read: fills the composer, leaves it unsent (unsure)', async () => {
  const fake = fakePage({ landId: null });
  const result = await run(fake);
  assert.equal(result.state, 'unsure');
  assert.deepEqual(fake.s.filled, [{ id: null, text: MESSAGE }]);
  assert.deepEqual(fake.s.sent, []);
});

test('never sends when the new conversation has not rendered: unsure, filled, unsent', async () => {
  const fake = fakePage({ rendered: false });
  const result = await run(fake);
  assert.equal(result.state, 'unsure');
  assert.equal(fake.s.filled.length, 1);
  assert.deepEqual(fake.s.sent, []);
});

test('the identity is re-checked right before typing: back on the original → no typing', async () => {
  const fake = fakePage();
  const result = await run(fake, {
    onState: (state) => {
      if (state === 'sending') fake.s.id = ORIGINAL;
    },
  });
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'identity');
  assert.deepEqual(fake.s.filled, []);
  assert.deepEqual(fake.s.sent, []);
});

test('no send button after filling → unsure, the message stays in the composer', async () => {
  const fake = fakePage({ noSend: true });
  const result = await run(fake);
  assert.equal(result.state, 'unsure');
  assert.equal(result.cause, 'send');
  assert.equal(fake.s.composer, MESSAGE);
  assert.deepEqual(fake.s.sent, []);
});

test('an existing different draft in the branch composer is not overwritten', async () => {
  const fake = fakePage({ composer: 'my own draft' });
  const result = await run(fake);
  assert.equal(result.state, 'unsure');
  assert.equal(result.cause, 'composer');
  assert.equal(fake.s.composer, 'my own draft');
  assert.deepEqual(fake.s.sent, []);
});

test('"Branch in new chat" is pressed at most once, so a slow branch is never made twice', async () => {
  const fake = fakePage({ landId: ORIGINAL });
  await run(fake);
  const newChatPresses = fake.calls.filter((c) => c === 'press').length;
  assert.equal(newChatPresses, 3);
});

test('menus are not retried once the tab has landed on a branch', async () => {
  // The first try's submenu is slow; meanwhile the page lands on a branch. Retrying the menu
  // there would branch the branch.
  const fake = fakePage({
    newChatFrom: TIMING.step + 1,
    tick: (t, s) => {
      if (t === 2000) s.id = BRANCH;
    },
  });
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.equal(fake.s.newChatPresses, undefined);
});

test('a page that already shows the branch (rerun after success) verifies without menus', async () => {
  const fake = fakePage({ startId: BRANCH });
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.ok(!fake.calls.includes('press'));
});

test('waits while the latest reply streams, then branches from the finished reply', async () => {
  const fake = fakePage({ streamingUntil: 5000 });
  let menuAt = null;
  const latest = fake.page.latestReplyMenu;
  fake.page.latestReplyMenu = () => {
    const h = latest();
    if (h && menuAt === null) menuAt = fake.at();
    return h;
  };
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.ok(result.states.includes('waiting-for-reply'));
  assert.ok(menuAt >= 5000);
});

test('a page that never loads fails as "load" without typing', async () => {
  const fake = fakePage({ loadedAt: Infinity });
  const result = await run(fake);
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'load');
  assert.deepEqual(fake.s.filled, []);
});

for (const at of ['loading', 'waiting-for-reply', 'branching', 'verifying', 'sending'])
  test(`cancel in ${at} stops every further page call and sends nothing`, async () => {
    const fake = fakePage({ streamingUntil: at === 'waiting-for-reply' ? 5000 : 0 });
    let callsAtCancel = null;
    const result = await run(fake, {
      onState: (state, _info, r) => {
        if (state === at && callsAtCancel === null) {
          r.cancel();
          callsAtCancel = fake.calls.length;
        }
      },
    });
    assert.equal(result.state, 'cancelled');
    assert.equal(fake.calls.length, callsAtCancel);
    assert.deepEqual(fake.s.sent, []);
    assert.deepEqual(fake.s.filled, []);
  });

// Cancel arriving from outside (×, Cancel, Esc) while the run waits inside a state: the next
// page call never happens, nothing is typed or sent, and the run ends cancelled.
const CANCEL_IN = {
  loading: { loadedAt: 2000 },
  'waiting-for-reply': { streamingUntil: 5000 },
  branching: { newChatFrom: 2000 },
  verifying: { landAfter: 3000 },
  sending: { sendFrom: 1_000_000 }, // verified branch, filled, send button not enabled yet
};
for (const [at, options] of Object.entries(CANCEL_IN))
  test(`cancel while waiting in ${at} stops every further page call and sends nothing`, async () => {
    let r = null,
      entered = false,
      callsAtCancel = null;
    const fake = fakePage({
      ...options,
      tick: () => {
        if (entered && callsAtCancel === null) {
          assert.equal(r.cancel(), true);
          callsAtCancel = fake.calls.length;
        }
      },
    });
    const states = [];
    r = start({
      job,
      page: fake.page,
      clock: fake.clock,
      onState: (state) => {
        states.push(state);
        if (state === at) entered = true;
      },
    });
    const result = await r.done;
    assert.ok(callsAtCancel !== null, `never waited in ${at}`);
    assert.equal(result.state, 'cancelled');
    assert.equal(states.at(-1), 'cancelled');
    assert.equal(fake.calls.length, callsAtCancel, 'a page call after cancel');
    assert.deepEqual(fake.s.sent, []);
    if (at !== 'sending') assert.deepEqual(fake.s.filled, []);
  });

test('cancel before the run reaches its first state makes no page call at all', async () => {
  const fake = fakePage();
  const r = start({ job, page: fake.page, clock: fake.clock });
  assert.equal(r.cancel(), true);
  const result = await r.done;
  assert.equal(result.state, 'cancelled');
  assert.deepEqual(fake.calls, []);
});

test('cancel after the run ended changes nothing', async () => {
  const fake = fakePage();
  const r = start({ job, page: fake.page, clock: fake.clock });
  assert.equal((await r.done).state, 'ready');
  assert.equal(r.cancel(), false);
  assert.equal(r.state, 'ready');
});

test('false-failure regression: a page error while verifying, with the branch landed → ready', async () => {
  // A throwing lookup must not turn a made branch into a failure card.
  const fake = fakePage();
  const rendered = fake.page.isRendered;
  let thrown = 0;
  fake.page.isRendered = (id) => {
    if (id !== ORIGINAL && !thrown++) throw new TypeError('detached node');
    return rendered(id);
  };
  const result = await run(fake);
  assert.equal(result.state, 'ready');
  assert.deepEqual(fake.s.sent, [{ id: BRANCH, text: MESSAGE }]);
});

test('a page error with no branch fails only after the re-check, nothing typed or sent', async () => {
  const fake = fakePage();
  let thrownAt = null;
  fake.page.isStreaming = () => {
    thrownAt = fake.at();
    throw new TypeError('bad selector');
  };
  const result = await run(fake);
  assert.equal(result.state, 'failed');
  assert.equal(result.cause, 'error');
  assert.ok(fake.at() - thrownAt >= TIMING.recheck, 'failed before re-checking');
  assert.deepEqual(fake.s.filled, []);
  assert.deepEqual(fake.s.sent, []);
});

test('a page error after the send click never sends again: unsure', async () => {
  const fake = fakePage();
  const send = fake.page.send;
  fake.page.send = (button) => {
    send(button);
    throw new TypeError('detached');
  };
  const result = await run(fake);
  assert.equal(result.state, 'unsure');
  assert.equal(fake.s.sent.length, 1);
});
