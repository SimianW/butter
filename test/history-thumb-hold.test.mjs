import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const page = 'https://chatgpt.com/backend-api/conversations/12345678-1234-1234-1234-123456789abc/messages?before=abc&num_turns=10';
function setup({ rtl = false, overlay = false } = {}) {
  const win = new EventTarget(), doc = new EventTarget(), calls = [], timers = new Map(), messages = [];
  let off = '', timerId = 0;
  class CustomEvent extends Event { constructor(type, init) { super(type); this.detail = init.detail; } }
  doc.documentElement = { getAttribute: () => off }; doc.hidden = false;
  doc.addEventListener('butter-nav', e => messages.push(JSON.parse(e.detail)));
  win.__butterConfig = { olderPageTurns: 2 };
  const scroller = { matches: s => s === '.thread-scroll-container', scrollHeight: 5000, clientHeight: 600,
    clientWidth: overlay ? 800 : 780, offsetWidth: 800, clientLeft: rtl && !overlay ? 20 : 0, clientTop: 0,
    getBoundingClientRect: () => ({ left: 100, right: 900, top: 20, bottom: 620, width: 800, height: 600 }) };
  win.fetch = function(input, init) { calls.push({ input, init, receiver: this }); return Promise.resolve({ ok: true, clone: () => ({ json: async () => ({ messages: [{ id: 'q', author: { role: 'user' }, content: { content_type: 'text', parts: ['hello'] } }], page_info: { has_previous_page: true } }) }) }); };
  vm.runInNewContext(fs.readFileSync(new URL('../extension/history/conversation-main.js', import.meta.url), 'utf8'), {
    window: win, document: doc, URL, Request, DOMException, Symbol, CustomEvent,
    location: { href: 'https://chatgpt.com/', pathname: '/' },
    getComputedStyle: () => ({ direction: rtl ? 'rtl' : 'ltr', borderLeftWidth: '0', borderRightWidth: '0' }),
    setTimeout: (cb, ms) => { const id = ++timerId; timers.set(id, { cb, ms }); return id; }, clearTimeout: id => timers.delete(id),
  });
  const emit = (target, type, props = {}) => { const e = new Event(type); for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v }); target.dispatchEvent(e); };
  return { win, doc, calls, timers, messages, scroller, off: v => { off = v; },
    down: (props = {}, type = 'mousedown') => emit(win, type, { target: scroller, button: 0, clientX: rtl ? 105 : 895, clientY: 500, ...props }),
    up: (type = 'mouseup', props = {}) => emit(win, type, props), settings: () => emit(doc, 'butter-settings'),
    hide: () => { doc.hidden = true; emit(doc, 'visibilitychange'); },
    fetch: (input = page, init) => win.fetch(input, init),
  };
}
test('native scrollbar hold defers earlier pages, preserving init, receiver and page parsing', async () => {
  const s = setup(); s.down(); const init = { credentials: 'include' }; const result = s.fetch(page, init);
  assert.equal(s.calls.length, 0); s.up(); await result; await new Promise(setImmediate);
  assert.equal(s.calls.length, 1); assert.equal(s.calls[0].init, init); assert.equal(s.calls[0].receiver, s.win);
  assert.equal(new URL(s.calls[0].input).searchParams.get('num_turns'), '2');
  assert.equal(s.messages[0].before, true); assert.equal(s.messages[0].items[0].q, 'hello');
});
for (const type of ['mouseup', 'pointerup', 'pointercancel', 'blur']) test(`release on window ${type} flushes once`, async () => {
  const s = setup(); s.down({}, 'pointerdown'); s.down(); const a = s.fetch(), b = s.fetch();
  assert.equal(s.calls.length, 0); s.up(type); s.up(); await Promise.all([a,b]); assert.equal(s.calls.length, 2); assert.equal(s.timers.size, 0);
  await s.fetch(); assert.equal(s.calls.length, 3);
});
test('hidden document releases; visible document and element blur do not', async () => {
  const s = setup(); s.down(); const p = s.fetch(); s.doc.dispatchEvent(new Event('visibilitychange')); s.doc.dispatchEvent(new Event('blur'));
  assert.equal(s.calls.length, 0); s.hide(); await p; assert.equal(s.calls.length, 1);
});
test('safety timeout releases a missed up event', async () => {
  const s = setup(); s.down(); const p = s.fetch(); assert.equal(s.calls.length, 0);
  const timer = [...s.timers.values()][0]; assert.equal(timer.ms, 30000); timer.cb(); await p; assert.equal(s.calls.length, 1);
});
test('a move with no button releases a missed up event', async () => {
  const s = setup(); s.down(); const p = s.fetch(); s.up('mousemove', { buttons: 0 }); await p; assert.equal(s.calls.length, 1);
});
test('deferred AbortSignal rejects without starting fetch, including already aborted and Request signals', async () => {
  for (const fromRequest of [false,true]) for (const already of [false,true]) {
    const s = setup(), abort = new AbortController(); s.down(); if (already) abort.abort();
    const p = fromRequest ? s.fetch(new Request(page, { signal: abort.signal })) : s.fetch(page, { signal: abort.signal });
    const rejected = assert.rejects(p, { name: 'AbortError' }); if (!already) abort.abort(); await rejected;
    s.up(); assert.equal(s.calls.length, 0);
  }
});
test('init signal overrides a Request signal and custom abort reasons survive', async () => {
  const s = setup(), a = new AbortController(), b = new AbortController(); a.abort(); s.down();
  const p = s.fetch(new Request(page, { signal:a.signal }), { signal:b.signal }); const reason = new Error('cancel');
  const rejected = assert.rejects(p, e => e === reason); b.abort(reason); await rejected; s.up(); assert.equal(s.calls.length, 0);
});
test('older off prevents a hold and switching off flushes a pending hold', async () => {
  const s = setup(); s.off('cv older rail'); s.down(); await s.fetch(); assert.equal(s.calls.length, 1); assert.equal(s.calls[0].input,page);
  s.off(''); s.down(); const p = s.fetch(); assert.equal(s.calls.length, 1); s.off('older'); s.settings(); await p; assert.equal(s.calls.length, 2);
});
test('off marker releases pending work even before the settings notification', async () => {
  const s = setup(); s.down(); const p = s.fetch(); s.off('older'); await s.fetch(); await p; assert.equal(s.calls.length,2);
});
test('other requests and sends are untouched during a hold', async () => {
  const s = setup(); s.down();
  for (const input of [page.replace('/messages',''), 'https://chatgpt.com/backend-api/models']) { await s.fetch(input); assert.equal(s.calls.at(-1).input,input); }
  const init = { method:'POST', body:JSON.stringify({ conversation_id:'c', messages:[{id:'new',author:{role:'user'},content:{content_type:'text',parts:['sent']}}] }) };
  const send = 'https://chatgpt.com/backend-api/conversation'; await s.fetch(send,init);
  assert.equal(s.calls.at(-1).input,send); assert.equal(s.calls.at(-1).init,init); assert.equal(s.messages.at(-1).type,'send');
  await s.fetch(page,{method:'POST'}); assert.equal(s.calls.length,4);
});
test('wheel, keyboard and programmatic history loads start without a scrollbar hold', async () => {
  const s = setup();
  for (const type of ['wheel', 'keydown', 'scroll']) { s.up(type); await s.fetch(); }
  assert.equal(s.calls.length, 3); assert.equal(s.timers.size, 0);
});
test('aborting one queued request leaves the others ready for release', async () => {
  const s = setup(), controller = new AbortController(); s.down();
  const cancelled = s.fetch(page, { signal: controller.signal }), live = s.fetch(new URL(page));
  const rejected = assert.rejects(cancelled, { name: 'AbortError' }); controller.abort(); await rejected;
  s.up(); await live; assert.equal(s.calls.length, 1);
});
test('content, other scrollers, non-left buttons, touch and non-scrollable threads never hold', async () => {
  for (const props of [{clientX:500},{target:{matches:()=>false}},{button:2},{pointerType:'touch'},{clientY:700}]) {
    const s = setup(); s.down(props); await s.fetch(); assert.equal(s.calls.length,1);
  }
  const s = setup(); s.scroller.scrollHeight=600; s.down(); await s.fetch(); assert.equal(s.calls.length,1);
});
for (const rtl of [false,true]) for (const overlay of [false,true]) test(`scrollbar geometry rtl=${rtl}, overlay=${overlay}`, async () => {
  const s = setup({rtl,overlay}); s.down(); const p=s.fetch(); assert.equal(s.calls.length,0); s.up(); await p; assert.equal(s.calls.length,1);
});
