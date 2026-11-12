// The send pre-jump (extension/rail/pre-jump.js) driven directly: a fake window, a scroller 900 px
// tall over a 5000 px chat, and the composer's form. No rail boots; `cancel` counts the jumps it
// would stop. test/rail.test.mjs checks that the rail installs it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { FakeElement } from './helpers/rail-dom.mjs';

const source = fs.readFileSync(new URL('../extension/rail/pre-jump.js', import.meta.url), 'utf8');

function setup() {
  let nextId = 1;
  const timers = new Map();
  const window = new FakeElement();
  const document = new FakeElement();
  document.documentElement = new FakeElement('html');
  const ctx = vm.createContext({
    document,
    Element: FakeElement,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    setTimeout(callback) {
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(source, ctx, { filename: 'rail/pre-jump.js' });
  const scroller = new FakeElement();
  Object.assign(scroller, {
    scrollTop: 0,
    scrollHeight: 5000,
    clientHeight: 900,
    scrollTo({ top, behavior }) {
      this.scrollTop = top;
      this.behavior = behavior;
    },
  });
  const form = new FakeElement('form'),
    composer = new FakeElement(),
    sendButton = new FakeElement('button');
  composer.className = 'ProseMirror';
  composer.textContent = 'New question';
  sendButton.setAttribute('data-testid', 'send-button');
  form.append(composer);
  form.append(sendButton);
  const nav = {
    window,
    document,
    scroller,
    composer,
    sendButton,
    visible: scroller, // what `scroller()` returns
    cancels: 0,
    pendingTimers: () => timers.size,
    runTimers: () => {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
  ctx.ButterPreJump({ scroller: () => nav.visible, cancel: () => nav.cancels++ });
  return nav;
}

for (const trigger of ['Enter', 'click']) {
  test(`${trigger} pre-jumps a distant send but leaves the last viewport for ChatGPT`, () => {
    const nav = setup();
    if (trigger === 'Enter') nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    else {
      const icon = new FakeElement('svg');
      nav.sendButton.append(icon);
      nav.window.dispatch('click', { target: icon });
    }
    assert.equal(nav.scroller.scrollTop, 3200);
    assert.equal(nav.scroller.behavior, 'instant');
    assert.equal(nav.cancels, 1, 'a rail jump in progress stops');
  });

  test(`${trigger}: ChatGPT's submit handler runs before the pre-jump, in the same event`, () => {
    // Jumping first made ChatGPT's handler mount and lay out the end of the chat before it cleared
    // the composer: the page froze for 2-3 s with the typed text still showing.
    const nav = setup();
    let seen = null;
    const submit = () => (seen = nav.scroller.scrollTop);
    if (trigger === 'Enter')
      nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer }, submit);
    else nav.window.dispatch('click', { target: nav.sendButton }, submit);
    assert.equal(seen, 0, 'the handler sees the thread where the user left it');
    assert.equal(nav.scroller.scrollTop, 3200, 'the jump lands before the task ends');
    assert.equal(nav.pendingTimers(), 0, 'the fallback is cleared');
    nav.scroller.scrollTop = 0;
    nav.runTimers();
    assert.equal(nav.scroller.scrollTop, 0, 'one jump per send');
  });

  test(`${trigger}: a send whose event never bubbles still pre-jumps after the task`, () => {
    const nav = setup();
    if (trigger === 'Enter')
      nav.window.emit('keydown', { key: 'Enter', target: nav.composer }, 'capture');
    else nav.window.emit('click', { target: nav.sendButton }, 'capture');
    assert.equal(nav.scroller.scrollTop, 0);
    nav.runTimers();
    assert.equal(nav.scroller.scrollTop, 3200);
    nav.window.dispatch('keyup', { key: 'Enter', target: nav.composer });
    assert.equal(nav.window.listeners.get(trigger === 'Enter' ? 'keydown' : 'click').length, 1);
    assert.ok(nav.window.listeners.get(trigger === 'Enter' ? 'keydown' : 'click')[0].capture);
  });
}

test('the scrolling group switch turns off the send pre-jump', () => {
  for (const off of ['seek', 'older', 'older seek', 'rail older']) {
    const nav = setup();
    nav.document.documentElement.setAttribute('data-butter-off', off);
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    nav.window.dispatch('click', { target: nav.sendButton });
    assert.equal(nav.scroller.scrollTop, 0, `pre-jump must stay off when ${off} is off`);
    assert.equal(nav.cancels, 0);
  }
  const nav = setup();
  nav.document.documentElement.setAttribute('data-butter-off', 'rail layout');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200, 'the rail switch does not control the pre-jump');
});

test('near-bottom sends and non-send key events preserve the thread position', () => {
  const nav = setup();
  for (const event of [
    { shiftKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { keyCode: 229 },
    { repeat: true },
    { key: 'x' },
    { target: nav.scroller },
    { target: {} }, // not an element
  ]) {
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer, ...event });
    assert.equal(nav.scroller.scrollTop, 0);
  }
  for (const top of [2750, 3200, 4100]) {
    nav.scroller.scrollTop = top;
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    assert.equal(nav.scroller.scrollTop, top);
  }
  // 1.5 screens above the end exactly: stays; one pixel more: jumps.
  nav.scroller.scrollTop = 2750;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 2750);
  nav.scroller.scrollTop = 2749;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200);
});

test('empty composers and disabled send buttons do not pre-jump', () => {
  const nav = setup();
  for (const text of ['', '  \n ']) {
    nav.composer.textContent = text;
    nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
    nav.window.dispatch('click', { target: nav.sendButton });
    assert.equal(nav.scroller.scrollTop, 0);
  }
  nav.composer.textContent = 'New question';
  nav.sendButton.disabled = true;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  nav.window.dispatch('click', { target: nav.sendButton });
  assert.equal(nav.scroller.scrollTop, 0);
  nav.sendButton.disabled = false;
  nav.sendButton.setAttribute('aria-disabled', 'true');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  nav.window.dispatch('click', { target: nav.sendButton });
  assert.equal(nav.scroller.scrollTop, 0);
  assert.equal(nav.cancels, 0);
});

test('the current composer submit button works without legacy IDs', () => {
  const nav = setup();
  nav.sendButton.removeAttribute('data-testid');
  nav.sendButton.setAttribute('type', 'submit');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200);
});

test('no visible scroller, a hidden one, or another one shown by the time it lands: no jump', () => {
  const nav = setup();
  nav.visible = null;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.cancels, 0);
  nav.visible = nav.scroller;
  nav.scroller.isConnected = false;
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.cancels, 0);
  nav.scroller.isConnected = true;
  nav.scroller.clientHeight = 0; // a kept copy, not displayed
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.cancels, 0);
  nav.scroller.clientHeight = 900;
  // ChatGPT shows a kept chat between the capture and the bubble phase.
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer }, () => {
    nav.visible = new FakeElement();
  });
  assert.equal(nav.cancels, 1);
  assert.equal(nav.scroller.scrollTop, 0);
});
