import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup() {
  let off = '', inputSeen, initSeen; const listeners = new Map(); let facts;
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  const win = { addEventListener() {}, __butterConfig: { olderPageTurns: 2 }, fetch(input, init) {
    inputSeen = input; initSeen = init; return Promise.resolve({ ok: false });
  } };
  vm.runInNewContext(fs.readFileSync(new URL('../extension/history/conversation-main.js', import.meta.url), 'utf8'), {
    window: win, URL, Request, Symbol, CustomEvent, location: { href: 'https://chatgpt.com/', pathname: '/' },
    document: { documentElement: { getAttribute: () => off }, addEventListener(type, cb) { listeners.set(type, cb); }, dispatchEvent(e) { facts = JSON.parse(e.detail); } },
  });
  return { fetch: (input, init) => win.fetch(input, init), off: value => { off = value; }, seen: () => [inputSeen, initSeen], wrap: () => { const old = win.fetch; win.fetch = (...args) => old(...args); }, facts: () => { listeners.get('butter-status-request')(); return facts; } };
}
const url = 'https://chatgpt.com/backend-api/conversations/12345678-1234-1234-1234-123456789abc/messages?before=abc&num_turns=10';
test('older hook lowers only older GET page sizes, and switches live without reloading', () => {
  const s = setup(); const init = { credentials: 'include' };
  s.fetch(url, init); assert.equal(new URL(s.seen()[0]).searchParams.get('num_turns'), '2'); assert.equal(s.seen()[1], init);
  for (const input of [url, new URL(url), new Request(url)]) {
    s.off('older'); s.fetch(input, init); assert.equal(s.seen()[0], input); assert.equal(s.seen()[1], init);
  }
  s.off(''); s.fetch(url); assert.equal(new URL(s.seen()[0]).searchParams.get('num_turns'), '2');
  s.fetch(url, { method: 'POST' }); assert.equal(s.seen()[0], url);
  s.fetch(url.replace('/messages', '')); assert.equal(s.seen()[0], url.replace('/messages', ''));
});

test('a later fetch wrapper that delegates to Butter does not falsely fail the engaged hook', () => {
  const s = setup(); s.wrap(); s.fetch(url);
  assert.equal(s.facts().older.engaged, true);
  assert.equal(s.facts().older.failed, false);
});
