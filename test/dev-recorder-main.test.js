// dev/recorder-main.js in a planted page: the seek and press it remembers belong to the
// conversation they happened in, and a chat switch shows in the file as a `conversation` event.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../extension/seek/core-main.js');
const { el, getComputedStyle } = require('./helpers/fake-dom.cjs');

// The page's dev scripts, in manifest order, run in one realm as they do in the page.
const SCRIPTS = ['recorder.js', 'sources.js', 'recorder-main.js'].map((name) =>
  fs.readFileSync(path.join(__dirname, '../extension/dev', name), 'utf8'),
);
const CONV_A = '6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12',
  CONV_B = 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f';

// A chat with `count` turns, all mounted, each record `height` px tall.
function chat(prefix, count, height) {
  const keys = Array.from({ length: count }, (_, i) => `${prefix}-turn-${i}`);
  const turns = keys.map((key, i) =>
    el('article', { attrs: { 'data-turn-key': key }, rect: { top: i * 300, height } }, [
      el('div', { attrs: { 'data-user-message-bubble': '' }, rect: { top: i * 300, height: 40 } }),
    ]),
  );
  turns[0]['__reactFiber$x'] = {
    memoizedProps: { entries: keys.map((turnKey) => ({ turnKey })), RowComponent() {} },
    memoizedState: null,
  };
  const sc = el(
    'div',
    {
      classes: ['thread-scroll-container'],
      clientWidth: 900,
      props: { clientHeight: 800, scrollHeight: count * 300 },
    },
    turns.map((t, i) => el('div', { rect: { top: i * 300, height: height + 20 } }, [t])),
  );
  const records = Object.fromEntries(
    keys.map((key) => [key, { ready: true, h: height, rowH: height + 20, sw: 900, items: [] }]),
  );
  return { root: el('html', {}, [el('body', {}, [sc])]), records };
}

// Loads recorder-main.js against a page on conversation A, and returns controls for the test.
function load() {
  const pages = { [CONV_A]: chat('a', 6, 111), [CONV_B]: chat('b', 14, 258) };
  let conv = CONV_A,
    clock = 1_000,
    pressDecision = null;
  const listeners = {},
    intervals = [];
  const page = () => pages[conv];
  const dump = { held: false };
  Object.defineProperty(dump, 'conv', { get: () => conv });
  Object.defineProperty(dump, 'pressDecision', {
    // A copy made in the page's realm, as __seekDump's getter makes it.
    get: () => vm.runInContext('JSON', context).parse(JSON.stringify(pressDecision)),
  });
  Object.defineProperty(dump, 'tap', { set: (fn) => (dump.listen = fn) });
  const cache = {
    get: (key) => page().records[key] ?? null,
    diagnostics: () => null,
    dump: () => ({ ready: true, rejected: {} }),
  };
  const document = {
    querySelector: (s) => page().root.querySelector(s),
    querySelectorAll: (s) => page().root.querySelectorAll(s),
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    dispatchEvent: (e) => (listeners[e.type] || []).forEach((fn) => fn(e)),
  };
  const context = vm.createContext({
    __seekDump: dump,
    __butterLayoutCache: cache,
    __butterSeekCore: core,
    __heightCacheDump: () => ({ stats: {} }),
    __butterSeeking: () => false,
    document,
    getComputedStyle,
    performance: { now: () => clock },
    setInterval: (fn) => intervals.push(fn),
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    CSS: { escape: (s) => s },
  });
  for (const script of SCRIPTS) vm.runInContext(script, context);
  return {
    tick: (ms) => {
      clock += ms;
      intervals.forEach((fn) => fn());
    },
    switchTo: (c) => (conv = c),
    seek: (turn) => dump.listen('seek', { top: turn * 300, turn, offset: 12, layout: true }),
    press: (sequence) => {
      pressDecision = {
        schema: 1,
        sequence,
        phase: 'press',
        modelLength: Object.keys(page().records).length,
      };
      dump.listen('press', { kind: 'classic', sequence });
    },
    save() {
      let file;
      listeners['butter-dev-snapshot-response'] = [(e) => (file = e.detail)];
      document.dispatchEvent({
        type: 'butter-dev-snapshot-request',
        detail: JSON.stringify({ bug: 1, round: 1, version: '0.1.0-alpha.15+dev.1' }),
      });
      return { text: file, json: JSON.parse(file) };
    },
  };
}

test('a seek in the same conversation is the active turn', () => {
  const p = load();
  p.press(1);
  p.seek(5);
  p.tick(500);
  const { json } = p.save();
  assert.equal(json.turns.active.selection, 'last-seek-update');
  assert.equal(json.turns.active.turnIndex, 5);
  assert.equal(json.turns.active.memory.height, 111);
  assert.equal(json.pressDecision.sequence, 1);
  assert.ok(!json.events.some((e) => e.type === 'conversation'));
});

test("after a chat switch, the old chat's seek and press decision are not used", () => {
  const p = load();
  p.press(1);
  p.seek(5);
  p.tick(1_000);
  p.switchTo(CONV_B);
  p.tick(250); // the recorder's next check
  p.tick(10_000);
  const { text, json } = p.save();
  assert.deepEqual(json.turns.active, { turnIndex: null, selection: 'none' });
  assert.deepEqual(json.pressDecision, { unavailable: 'conversation-changed' });
  // The switch shows in the events, after everything from conversation A.
  const types = json.events.map((e) => e.type);
  assert.deepEqual(types, ['press', 'seek', 'conversation']);
  const change = json.events[2];
  assert.equal(change.conversation, 1);
  assert.equal(change.t, -10_000);
  for (const id of [CONV_A, CONV_B]) assert.ok(!text.includes(id), 'no conversation ID');
});

test('the switch is recorded before the next event, even between interval checks', () => {
  const p = load();
  p.seek(2);
  p.switchTo(CONV_B);
  p.press(2);
  p.seek(9);
  const { json } = p.save();
  assert.deepEqual(
    json.events.map((e) => e.type),
    ['seek', 'conversation', 'press', 'seek'],
  );
  assert.equal(json.turns.active.selection, 'last-seek-update');
  assert.equal(json.turns.active.turnIndex, 9);
  assert.equal(json.turns.active.memory.height, 258);
  assert.equal(json.pressDecision.sequence, 2);
});

test('a switch detected only at save time still drops the old seek', () => {
  const p = load();
  p.seek(5);
  p.switchTo(CONV_B);
  const { json } = p.save();
  assert.deepEqual(json.turns.active, { turnIndex: null, selection: 'none' });
  assert.deepEqual(
    json.events.map((e) => e.type),
    ['seek', 'conversation'],
  );
});
