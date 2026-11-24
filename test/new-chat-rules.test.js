// New chat shortcut (#163): what a press of the key does, from the page's facts at the press.
// URL shapes come from the lab (notes/runs/2026-11-23-new-chat-project/report.md, Q1): a project
// page is /g/g-p-<id>[-<slug>]/project, a project chat /g/g-p-<id>[-<slug>]/c/<id>, a normal chat
// /c/<id>, a new chat /, Temporary Chat /?temporary-chat=true.
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('../extension/new-chat/logic.js');

const ID = '6820a1b2c3d4e5f60718293a4b5c6d7e';
const CHAT = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const at = (path) => `https://chatgpt.com${path}`;
const PROJECT = `/g/g-p-${ID}/project`;
const press = (path, facts = {}) =>
  decide({ url: at(path), paused: false, work: false, fresh: false, ...facts });
const go = (path) => ({ kind: 'go', path });
const FOCUS = { kind: 'focus' },
  NONE = { kind: 'none' };

test('a project chat goes to its project page, with or without the slug', () => {
  assert.deepEqual(press(`/g/g-p-${ID}/c/${CHAT}`), go(PROJECT));
  assert.deepEqual(press(`/g/g-p-${ID}-math-12/c/${CHAT}`), go(PROJECT));
});

test('a fresh project page only focuses, with or without the slug', () => {
  assert.deepEqual(press(PROJECT, { fresh: true }), FOCUS);
  assert.deepEqual(press(`/g/g-p-${ID}-math-12/project`, { fresh: true }), FOCUS);
  assert.deepEqual(press(`${PROJECT}/`, { fresh: true }), FOCUS);
});

test('a project page with turns goes to the project page again', () => {
  assert.deepEqual(press(PROJECT), go(PROJECT));
  assert.deepEqual(press(`/g/g-p-${ID}-math-12/project`), go(PROJECT));
});

test('a project chat with no turns shown yet still goes to the project page', () => {
  assert.deepEqual(press(`/g/g-p-${ID}/c/${CHAT}`, { fresh: true }), go(PROJECT));
});

test('a Temporary Chat with turns goes to a new Temporary Chat; a fresh one only focuses', () => {
  assert.deepEqual(press('/?temporary-chat=true'), go('/?temporary-chat=true'));
  assert.deepEqual(press('/?temporary-chat=true', { fresh: true }), FOCUS);
});

test('a fresh new chat only focuses; a new chat with turns goes to a new chat', () => {
  assert.deepEqual(press('/', { fresh: true }), FOCUS);
  assert.deepEqual(press('/'), go('/'));
});

test('a normal chat goes to a new chat', () => {
  assert.deepEqual(press(`/c/${CHAT}`), go('/'));
  assert.deepEqual(press(`/c/${CHAT}`, { fresh: true }), go('/'));
});

test('a custom GPT is not a project: its chat goes to a normal new chat', () => {
  assert.deepEqual(press(`/g/g-${ID}/c/${CHAT}`), go('/'));
  assert.deepEqual(press(`/g/g-${ID}-tutor/c/${CHAT}`), go('/'));
  assert.deepEqual(press(`/g/g-${ID}-tutor`, { fresh: true }), go('/'));
  // A custom GPT whose name starts with "p-" is still not a project: the id comes first.
  assert.deepEqual(press(`/g/g-p${ID}/c/${CHAT}`), go('/'));
});

test('other ChatGPT routes go to a new chat', () => {
  for (const path of ['/gpts', '/library', '/codex', '/admin/settings'])
    for (const fresh of [true, false]) assert.deepEqual(press(path, { fresh }), go('/'));
  // ChatGPT's settings open over the page as a hash route: the page under them decides.
  assert.deepEqual(press('/#settings/General', { fresh: true }), FOCUS);
  assert.deepEqual(press(`/c/${CHAT}#settings/General`), go('/'));
});

test('a query or hash does not change the place', () => {
  assert.deepEqual(press(`/g/g-p-${ID}/c/${CHAT}?model=gpt-5#x`), go(PROJECT));
  assert.deepEqual(press(`${PROJECT}?tab=chats#top`, { fresh: true }), FOCUS);
  assert.deepEqual(press(`/c/${CHAT}?model=gpt-5#x`), go('/'));
  assert.deepEqual(press('/?model=gpt-5', { fresh: true }), FOCUS);
  assert.deepEqual(press('/?model=gpt-5'), go('/'));
  assert.deepEqual(press('/?model=gpt-5&temporary-chat=true#x'), go('/?temporary-chat=true'));
  assert.deepEqual(press('/?temporary-chat=true#x', { fresh: true }), FOCUS);
});

test('paused does nothing, before every other rule', () => {
  for (const path of [PROJECT, `/g/g-p-${ID}/c/${CHAT}`, '/?temporary-chat=true', '/', '/gpts'])
    for (const fresh of [true, false]) {
      assert.deepEqual(press(path, { paused: true, fresh }), NONE);
      assert.deepEqual(press(path, { paused: true, work: true, fresh }), NONE);
    }
});

test('Work mode does nothing, even in a project', () => {
  for (const path of [PROJECT, `/g/g-p-${ID}/c/${CHAT}`, '/?temporary-chat=true', '/', '/gpts'])
    for (const fresh of [true, false]) assert.deepEqual(press(path, { work: true, fresh }), NONE);
});

test('a page that is not ChatGPT, or no URL, does nothing', () => {
  assert.deepEqual(decide({ url: 'https://example.com/c/x', fresh: false }), NONE);
  assert.deepEqual(decide({ url: 'not a url', fresh: false }), NONE);
  assert.deepEqual(decide({}), NONE);
});
