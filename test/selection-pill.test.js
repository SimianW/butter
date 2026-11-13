// The selection pill (#77): extension/selection/pill.js over a small fake page. Ask in branch and
// bookmarks each register a cell; the pill shows the cells whose switch is on and whose predicate
// holds, in a fixed order, 4 px right of ChatGPT's "Ask ChatGPT", inside <body>.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../extension/selection/pill.js'), 'utf8');

// Enough of a node for pill.js: tree links, attributes, styles and listeners.
function node(tag) {
  const attrs = {},
    listeners = {};
  const n = {
    tagName: tag.toUpperCase(),
    parentNode: null,
    children: [],
    style: {
      props: {},
      setProperty(k, v) {
        this.props[k] = v;
      },
      removeProperty(k) {
        delete this.props[k];
      },
    },
    innerHTML: '',
    textContent: '',
    offsetWidth: 0,
    append(...items) {
      for (const item of items) {
        if (typeof item !== 'object') continue;
        item.parentNode?.children.splice(item.parentNode.children.indexOf(item), 1);
        item.parentNode = n;
        n.children.push(item);
      }
    },
    replaceChildren(...items) {
      for (const c of n.children) c.parentNode = null;
      n.children = [];
      n.append(...items);
    },
    remove() {
      if (!n.parentNode) return;
      n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1);
      n.parentNode = null;
    },
    setAttribute: (k, v) => (attrs[k] = String(v)),
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
    removeAttribute: (k) => delete attrs[k],
    toggleAttribute(k, force = !(k in attrs)) {
      if (force) attrs[k] = '';
      else delete attrs[k];
      return force;
    },
    matches: () => false,
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    // Fires `type` at this node; returns the event, with `prevented` set by preventDefault.
    fire(type, init = {}) {
      const e = {
        type,
        button: 0,
        detail: 1,
        ...init,
        prevented: false,
        preventDefault() {
          e.prevented = true;
        },
        stopPropagation() {},
      };
      for (let t = n; t; t = t.parentNode) (t.listeners?.[type] || []).forEach((fn) => fn(e));
      return e;
    },
    listeners,
    attachShadow: () => (n.shadow = node('#shadow-root')),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  };
  return n;
}

const NATIVE = { left: 300, top: 420, right: 410, bottom: 450, width: 110, height: 30 };
const STYLE = {
  backgroundColor: 'rgb(48, 48, 48)',
  color: 'rgb(255, 255, 255)',
  borderRadius: '8px',
  boxShadow: 'rgba(0, 0, 0, 0.18) 0px 2px 8px 0px',
};

function page({ width = 1400 } = {}) {
  const html = node('html'),
    body = node('body');
  html.append(body);
  const docListeners = {},
    timers = [],
    frames = [];
  let selected = false;
  const range = {
    startContainer: { isConnected: true },
    getBoundingClientRect: () => ({ left: 300, top: 380, right: 700, bottom: 410 }),
    cloneRange() {
      return range;
    },
  };
  const native = { box: { getBoundingClientRect: () => NATIVE }, sideChat: false };
  const fake = { native, nativeShown: true, activated: [] };
  const ctx = {
    document: {
      documentElement: html,
      body,
      createElement: node,
      addEventListener: (type, fn) => (docListeners[type] ||= []).push(fn),
    },
    location: { pathname: '/c/4b1f7c2a-9d3e-4f60-8a1b-2c3d4e5f6a7b' },
    getSelection: () =>
      selected
        ? { rangeCount: 1, isCollapsed: false, getRangeAt: () => range }
        : { rangeCount: 0, isCollapsed: true },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class {
      observe() {}
    },
    innerWidth: width,
    innerHeight: 900,
    performance: { now: () => 0 },
    setTimeout: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return t;
    },
    clearTimeout: (t) => {
      if (t) t.fn = null;
    },
    requestAnimationFrame: (fn) => frames.push(fn),
    cancelAnimationFrame: () => frames.splice(0),
    ButterPageReader: {
      nativeAsk: () => (fake.nativeShown ? native : null),
      visible: () => fake.nativeShown,
      nativeBusy: () => false,
      nativeStyle: () => STYLE,
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const P = ctx.ButterPill;
  const cell = (id, feature, label, extra = {}) => ({
    id,
    feature,
    icon: `<svg data-icon="${id}"></svg>`,
    label: () => label,
    keys: () => '',
    shortcut: () => '',
    wants: () => true,
    activate: () => fake.activated.push(id),
    ...extra,
  });
  fake.branch = cell('branch', 'branch', 'Ask in branch');
  fake.bookmark = cell('bookmark', ['rail', 'bookmark'], 'Bookmark selection', {
    keys: () => '⌥⇧M',
    shortcut: () => 'Alt+Shift+M',
  });
  // Bookmarks register first: their script loads before Ask in branch's.
  P.register(fake.bookmark);
  P.register(fake.branch);
  const run = (ms) =>
    timers
      .filter((t) => t.ms === ms && t.fn)
      .splice(0)
      .forEach((t) => {
        const fn = t.fn;
        t.fn = null;
        fn();
      });
  const frame = () => frames.splice(0).forEach((fn) => fn());
  Object.assign(fake, {
    P,
    html,
    body,
    range,
    off(...features) {
      if (features.length) html.setAttribute('data-butter-off', features.join(' '));
      else html.removeAttribute('data-butter-off');
    },
    // The reader selects text: selectionchange, the 40 ms settle, then a frame.
    select(on = true) {
      selected = on;
      (docListeners.selectionchange || []).forEach((fn) => fn());
      run(40);
      frame();
    },
    settings() {
      (docListeners['butter-settings'] || []).forEach((fn) => fn());
      frame();
    },
    run,
    frame,
    host: () => body.children.find((c) => c.tagName === 'CHATGPT-BUTTER-PILL') ?? null,
    pill() {
      const root = fake.host()?.shadow;
      return root?.children.find(
        (c) => c.getAttribute('class') === 'pill' || c.className === 'pill',
      );
    },
    tip() {
      const root = fake.host()?.shadow;
      return root?.children.find((c) => c.className === 'tip');
    },
    // The cells shown: none when the pill is hidden.
    cells() {
      const pill = fake.pill();
      if (!pill?.hasAttribute('data-on')) return [];
      return pill.children.map((b) => ({
        name: b.getAttribute('aria-label'),
        keys: b.getAttribute('aria-keyshortcuts'),
        el: b,
      }));
    },
  });
  return fake;
}

test('a selection in an answer shows Ask in branch, then Bookmark, 4 px right of "Ask ChatGPT"', () => {
  const p = page();
  p.select();
  assert.deepEqual(
    p.cells().map((c) => c.name),
    ['Ask in branch', 'Bookmark selection'],
    'fixed order, whatever the registration order',
  );
  const pill = p.pill();
  assert.equal(pill.style.left, `${NATIVE.right + 4}px`);
  assert.equal(pill.style.top, `${NATIVE.top}px`, 'top edges aligned');
  assert.equal(pill.style.props['--native-bg'], STYLE.backgroundColor, 'ChatGPT’s background');
  assert.equal(pill.style.props['--native-radius'], STYLE.borderRadius);
  assert.equal(pill.style.props['--native-shadow'], STYLE.boxShadow);
});

test('the pill’s host mounts inside <body>', () => {
  const p = page();
  p.select();
  assert.equal(p.host().parentNode, p.body);
});

test('each cell’s label is its accessible name; the key hint is in aria-keyshortcuts', () => {
  const p = page();
  p.select();
  const [branch, bookmark] = p.cells();
  assert.equal(branch.name, 'Ask in branch');
  assert.equal(branch.keys, null, 'no shortcut, no hint');
  assert.equal(bookmark.name, 'Bookmark selection');
  assert.equal(bookmark.keys, 'Alt+Shift+M');
  assert.equal(bookmark.el.getAttribute('type'), 'button');
});

for (const [name, setup, expected] of [
  ['Ask in branch off', (p) => p.off('branch'), ['Bookmark selection']],
  ['the rail (bookmarks) off', (p) => p.off('rail'), ['Ask in branch']],
  ['Bookmarks off', (p) => p.off('bookmark'), ['Ask in branch']],
  ['both off', (p) => p.off('branch', 'rail'), []],
  ['Butter paused', (p) => p.html.setAttribute('data-butter-disabled', ''), []],
  ['no bookmark range (a question)', (p) => (p.bookmark.wants = () => false), ['Ask in branch']],
  ['Work mode ("Ask in side chat")', (p) => (p.native.sideChat = true), []],
  ['no "Ask ChatGPT" on the page', (p) => (p.nativeShown = false), []],
])
  test(`cells shown with ${name}`, () => {
    const p = page();
    setup(p);
    p.select();
    assert.deepEqual(
      p.cells().map((c) => c.name),
      expected,
    );
  });

test('a switch turned off while the pill shows drops its cell; both off drop the pill', () => {
  const p = page();
  p.select();
  p.off('branch');
  p.settings();
  assert.deepEqual(
    p.cells().map((c) => c.name),
    ['Bookmark selection'],
  );
  p.off('branch', 'rail');
  p.frame();
  assert.deepEqual(p.cells(), []);
  p.off();
  p.settings();
  assert.equal(p.cells().length, 2, 'back once the switches are on again');
});

test('the pill flips to the left of "Ask ChatGPT" when there is no room on the right', () => {
  const p = page({ width: NATIVE.right + 40 });
  p.select();
  p.pill().offsetWidth = 64;
  p.frame();
  assert.equal(p.pill().style.left, `${NATIVE.left - 4 - 64}px`);
});

test('a cell acts on a primary pointerdown and on a keyboard click, keeping the selection', () => {
  const p = page();
  p.select();
  const bookmark = p.cells()[1].el;
  assert.equal(bookmark.fire('mousedown').prevented, true, 'mousedown keeps the page selection');
  assert.equal(bookmark.fire('pointerdown', { button: 2 }).prevented, false);
  assert.deepEqual(p.activated, [], 'not on a secondary button');
  assert.equal(bookmark.fire('pointerdown').prevented, true);
  assert.deepEqual(p.activated, ['bookmark']);
  bookmark.fire('click', { detail: 1 });
  assert.deepEqual(p.activated, ['bookmark'], 'the pointer’s click does not act twice');
  bookmark.fire('click', { detail: 0 });
  assert.deepEqual(p.activated, ['bookmark', 'bookmark'], 'Enter or Space');
});

test('the label shows 8 px below after 300 ms of hover and switches at once between cells', () => {
  const p = page();
  p.select();
  const [branch, bookmark] = p.cells().map((c) => c.el);
  bookmark.fire('pointerenter');
  assert.equal(p.tip()?.hasAttribute('data-on') ?? false, false, 'not at once');
  p.run(300);
  const tip = p.tip();
  assert.equal(tip.hasAttribute('data-on'), true);
  assert.equal(tip.getAttribute('aria-hidden'), 'true', 'the name is the cell’s own');
  assert.deepEqual(
    tip.children.map((c) => c.textContent),
    ['Bookmark selection', '⌥⇧M'],
  );
  branch.fire('pointerenter');
  assert.deepEqual(
    tip.children.map((c) => c.textContent),
    ['Ask in branch', ''],
    'switched without waiting',
  );
  p.pill().fire('pointerleave');
  assert.equal(tip.hasAttribute('data-on'), false);
});

test('a held selection hides the pill and keeps placing its owner at the last anchor', () => {
  const p = page();
  p.select();
  const placed = [];
  p.P.hold(p.range, { place: (anchor, area) => placed.push({ anchor, area }) });
  assert.deepEqual(p.cells(), [], 'hidden while held');
  assert.equal(placed.length, 1, 'placed at once');
  assert.deepEqual(
    { left: placed[0].anchor.left, top: placed[0].anchor.top, bottom: placed[0].anchor.bottom },
    { left: NATIVE.left, top: NATIVE.top, bottom: NATIVE.bottom },
  );
  p.nativeShown = false; // ChatGPT hides its button once the selection moves into the box
  p.select(false); // the selection moved into the box; a frame passes
  assert.equal(placed.length, 2);
  assert.equal(placed[1].anchor.left, NATIVE.left, 'still where ChatGPT’s button last was');
  p.nativeShown = true;
  p.P.release();
  assert.deepEqual(p.cells(), [], 'nothing selected after release');
  p.select();
  assert.equal(p.cells().length, 2);
});
