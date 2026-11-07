// The extension worker keeps branch handoff jobs in chrome.storage.session and hands each out once.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
const extension = new URL('../extension/', import.meta.url).pathname;
const ORIGINAL = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const ID = '11111111-2222-4333-8444-555555555555';
function worker(session, local = {}, now = () => 1000, tabs = { messages: [], removed: [] }) {
  const listeners = [];
  const area = (rows) => ({
    get: async (key) =>
      structuredClone(key === null ? rows : key in rows ? { [key]: rows[key] } : {}),
    set: async (x) => Object.assign(rows, structuredClone(x)),
    remove: async (keys) => [keys].flat().forEach((k) => delete rows[k]),
  });
  const ctx = vm.createContext({
    console,
    TextEncoder,
    URL,
    crypto: globalThis.crypto,
    Date: { now },
    chrome: {
      runtime: { id: 'test', onMessage: { addListener: (fn) => listeners.push(fn) } },
      storage: { local: area(local), session: area(session), onChanged: { addListener() {} } },
      tabs: {
        sendMessage: async (id, message) => void tabs.messages.push([id, { ...message }]),
        remove: async (id) => void tabs.removed.push(id),
      },
    },
    importScripts: (...files) =>
      files.forEach((file) =>
        vm.runInContext(fs.readFileSync(path.resolve(extension, 'storage', file), 'utf8'), ctx),
      ),
  });
  vm.runInContext(fs.readFileSync(path.join(extension, 'storage/layout-worker.js'), 'utf8'), ctx);
  return (message, sender) =>
    new Promise((done) => {
      // Responses come from the worker's realm; compare plain copies.
      const resolve = (x) => done(x === undefined ? x : JSON.parse(JSON.stringify(x)));
      let handled = false;
      for (const fn of listeners)
        handled = fn(message, { id: 'test', ...sender }, resolve) || handled;
      if (!handled) resolve(undefined);
    });
}
const origin = { tab: { id: 1, url: `https://chatgpt.com/c/${ORIGINAL}` } };
const dest = { tab: { id: 2, url: `https://chatgpt.com/c/${ORIGINAL}#butter-branch=${ID}` } };
const job = { original: ORIGINAL, title: 'T', quote: 'q', question: 'why?' };

test('the worker stores a job in session storage only and hands it out once', async () => {
  const session = {},
    local = {},
    send = worker(session, local);
  assert.deepEqual(await send({ type: 'butter-branch-put', id: ID, job }, origin), { ok: true });
  assert.deepEqual(Object.keys(session), [`butterBranch.${ID}`]);
  assert.deepEqual(local, {});
  // A worker restart (MV3 suspends it) still finds the job.
  const restarted = worker(session, local);
  assert.deepEqual(await restarted({ type: 'butter-branch-claim', id: ID }, dest), { job });
  assert.deepEqual(await restarted({ type: 'butter-branch-claim', id: ID }, dest), {
    missing: true,
  });
  assert.deepEqual(session, {});
});

test('the worker ignores other extensions and drops expired jobs when it wakes', async () => {
  const session = {},
    send = worker(session);
  assert.equal(
    await send({ type: 'butter-branch-put', id: ID, job }, { ...origin, id: 'other' }),
    undefined,
  );
  assert.deepEqual(session, {});
  await send({ type: 'butter-branch-put', id: ID, job }, origin);
  worker(session, {}, () => 1000 + 60_000);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(session, {});
});

test('the original tab hears when its job is claimed, or when the claim failed', async () => {
  const tabs = { messages: [], removed: [] },
    send = worker({}, {}, () => 1000, tabs);
  await send({ type: 'butter-branch-put', id: ID, job }, origin);
  assert.deepEqual(await send({ type: 'butter-branch-claim', id: ID }, dest), { job });
  assert.deepEqual(tabs.messages, [[1, { type: 'butter-branch-claimed', id: ID }]]);
  // A claim the worker refuses (here: from the original tab itself) tells the original tab too.
  tabs.messages.length = 0;
  await send({ type: 'butter-branch-put', id: ID, job }, origin);
  assert.deepEqual(await send({ type: 'butter-branch-claim', id: ID }, origin), {
    error: 'sender',
  });
  assert.deepEqual(tabs.messages, [[1, { type: 'butter-branch-unclaimed', id: ID }]]);
  // An unknown job tells nobody.
  tabs.messages.length = 0;
  assert.deepEqual(await send({ type: 'butter-branch-claim', id: ID }, dest), { missing: true });
  assert.deepEqual(tabs.messages, []);
});

test('Close tab: the worker closes only the tab that asks', async () => {
  const tabs = { messages: [], removed: [] },
    send = worker({}, {}, () => 1000, tabs);
  assert.deepEqual(await send({ type: 'butter-branch-close', tab: 1 }, dest), { ok: true });
  assert.deepEqual(tabs.removed, [2]);
  assert.equal(await send({ type: 'butter-branch-close' }, { ...dest, id: 'other' }), undefined);
  assert.deepEqual(tabs.removed, [2]);
});
