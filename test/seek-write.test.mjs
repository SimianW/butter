import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('every conversation POST invalidates before fetch and a pre-write GET cannot feed geometry', async () => {
  const events = [], requests = [];
  let complete;
  const conv = '00000000-0000-0000-0000-000000000000';
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  const win = { addEventListener() {}, fetch(input, init) {
    requests.push({ input, init, writes: events.filter(e => e.type === 'butter-seek-write').length });
    if (!init?.method) return new Promise(r => complete = r);
    return Promise.resolve({ ok: false });
  } };
  vm.runInNewContext(fs.readFileSync(new URL('../extension/history/conversation-main.js', import.meta.url), 'utf8'), {
    window: win, URL, Request, Symbol, CustomEvent, location: { pathname: '/c/' + conv },
    document: { documentElement: { getAttribute: () => '' }, addEventListener() {}, dispatchEvent: e => events.push(e) },
  });
  const old = win.fetch('https://chatgpt.com/backend-api/conversations/' + conv);
  await win.fetch('/backend-api/f/conversation', {method: 'POST', body: JSON.stringify({conversation_id: conv, action: 'variant'})});
  assert.equal(requests.at(-1).writes, 1, 'Regeneration invalidates before delegating to fetch');
  complete({ok: true, clone: () => ({json: async () => ({messages: []})})});
  await old; await new Promise(setImmediate);
  assert.equal(events.filter(e => e.type === 'butter-seek-data').length, 0);
  const fresh = win.fetch('https://chatgpt.com/backend-api/conversations/' + conv);
  complete({ok: true, clone: () => ({json: async () => ({messages: []})})});
  await fresh; await new Promise(setImmediate);
  assert.equal(events.filter(e => e.type === 'butter-seek-data').length, 1);
});
