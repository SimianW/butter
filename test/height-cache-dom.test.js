// Exercises the real MAIN-world recorder, including observer registration and restore retries.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../extension/seek/core-main.js');
function fixture({ mounted = false, setup = () => {} } = {}) {
  const frames = [],
    observed = new Set(),
    listeners = {},
    blocks = [];
  let mutation, resized;
  const nativeReads = [];
  const c = { complete: true, math: true, revealing: false };
  class Element {
    get clientWidth() {
      nativeReads.push(turn.style.contentVisibility || 'unrestored');
      return 768;
    }
  }
  const sc = Object.assign(new Element(), {
    clientHeight: 900,
    contains: () => true,
    getBoundingClientRect: () => ({ left: 0 }),
  });
  const item = Object.assign(new Element(), {
    nodeType: 1,
    isConnected: true,
    hasAttribute: () => false,
    tagName: 'P',
    className: 'p',
    classList: { contains: () => false },
    style: {},
    firstChild: { nodeType: 3, data: 'sample' },
    matches: () => false,
    getBoundingClientRect: () => ({ top: 120, left: 0, width: 768, height: 26 }),
  });
  const turn = Object.assign(new Element(), {
    nodeType: 1,
    isConnected: true,
    dataset: { turnKey: 'a' },
    style: {},
    clientHeight: 500,
    getBoundingClientRect: () => ({ top: 8, height: 480 }),
    parentElement: { getBoundingClientRect: () => ({ top: 0, width: 768, height: 500 }) },
    hasAttribute: (n) => n === 'data-turn-key',
    matches: () => false,
    closest: (s) => (s === '.thread-scroll-container' ? sc : turn),
    querySelector: (s) =>
      s.includes('AdaptiveStreaming')
        ? c.revealing
          ? {}
          : null
        : s.includes('in_progress')
          ? !c.complete
            ? {}
            : null
          : s.includes('complete')
            ? c.complete
              ? {}
              : null
            : s.includes('author-role')
              ? { getAttribute: () => 'm1' }
              : null,
    querySelectorAll: (s) =>
      s === '[data-math-source]'
        ? c.math
          ? []
          : [{ querySelector: () => null }]
        : s.includes(':not(')
          ? blocks
          : blocks,
  });
  item.closest = () => turn;
  sc.querySelectorAll = () => [turn];
  const doc = {
    scripts: [],
    addEventListener: (n, fn) => (listeners[n] = fn),
    querySelectorAll: (s) => (s === '[data-turn-key]' ? (mounted ? [turn] : []) : [sc]),
  };
  const context = {
    document: doc,
    location: { pathname: '/g/g-p-project/c/00000000-0000-0000-0000-000000000000' },
    innerWidth: 1600,
    Element,
    performance: { now: () => 1 },
    __butterSeekCore: core,
    __butterLayoutCheck: require('../extension/seek/layout-check-main.js'),
    ResizeObserver: class {
      constructor(fn) {
        resized = fn;
      }
      observe(e) {
        observed.add(e);
      }
      unobserve(e) {
        observed.delete(e);
      }
    },
    MutationObserver: class {
      constructor(fn) {
        mutation = fn;
      }
      observe() {}
    },
    requestAnimationFrame: (fn) => (frames.push(fn), frames.length),
    requestIdleCallback: (fn) => (frames.push(fn), frames.length),
    getComputedStyle: () => ({
      fontStyle: 'normal',
      fontWeight: '400',
      fontSize: '16px',
      lineHeight: '26px',
      fontFamily: 'system-ui',
      paddingTop: '0px',
      paddingRight: '0px',
      paddingBottom: '0px',
      paddingLeft: '0px',
      borderRadius: '0px',
      backgroundColor: 'transparent',
      color: 'black',
      textAlign: 'left',
    }),
  };
  context.crypto = require('node:crypto').webcrypto;
  context.TextEncoder = TextEncoder;
  context.setTimeout = () => 1;
  context.clearTimeout = () => {};
  context.queueMicrotask = queueMicrotask;
  context.window = context;
  setup({ context, turn, item, blocks, sc, Element });
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(require.resolve('../extension/seek/layout-cache-main.js'), 'utf8'),
    context,
  );
  const flush = () => {
    const jobs = frames.splice(0);
    jobs.forEach((f) => f());
  };
  return {
    context,
    c,
    turn,
    item,
    blocks,
    nativeReads,
    Element,
    sc,
    observed,
    flush,
    mutation: (r) => mutation(r),
    resize: (rs) => resized(rs),
    frames,
    listeners,
  };
}
test('real recorder observes blocks inserted after the empty turn, before a later layout', () => {
  const f = fixture();
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a'), null);
  f.blocks.push(f.item);
  f.mutation([{ target: f.turn, addedNodes: [f.item], removedNodes: [] }]);
  assert.ok(
    f.observed.has(f.item),
    'late block must be observed immediately, before the next idle/frame record',
  );
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  assert.equal(
    f.context.__butterLayoutCache.get('a')?.blocks[0],
    26,
    JSON.stringify(f.context.__heightCacheDump()),
  );
  assert.equal(f.context.__butterLayoutCache.get('a').turnOffset, 8);
  assert.equal(f.context.__butterLayoutCache.get('a').turnH, 480);
  f.resize([{ target: f.item, contentRect: { height: 80 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').blocks[0], 80);
});
test('real recorder preserves the last positive size across zero/skipped notifications and pending math', () => {
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  f.resize([{ target: f.item, contentRect: { height: 0 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').blocks[0], 26);
  f.c.math = false;
  f.mutation([{ target: f.turn, addedNodes: [], removedNodes: [] }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').blocks[0], 26);
  f.c.math = true;
  f.resize([{ target: f.item, contentRect: { height: 90 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').blocks[0], 90);
});
test('removed streamed blocks stop being observed and can be observed again if reinserted', () => {
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  assert.ok(f.observed.has(f.item));
  f.item.isConnected = false;
  f.blocks.length = 0;
  f.mutation([{ target: f.turn, addedNodes: [], removedNodes: [f.item] }]);
  assert.ok(!f.observed.has(f.item));
  f.item.isConnected = true;
  f.blocks.push(f.item);
  f.mutation([{ target: f.turn, addedNodes: [f.item], removedNodes: [] }]);
  assert.ok(f.observed.has(f.item));
});

test('restore applies cached sizes before any native geometry getter is read', () => {
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  f.context.__butterLayoutCache.get('a').removed = true;
  f.nativeReads.length = 0;
  const bubble = Object.assign(new f.Element(), {
    firstElementChild: { classList: { contains: () => true } },
    closest: (s) => (s === '.thread-scroll-container' ? f.sc : {}),
  });
  void bubble.clientWidth;
  assert.equal(
    f.nativeReads.length,
    1,
    'only the final original getter may read layout; restore itself must not',
  );
  assert.equal(
    f.nativeReads[0],
    'auto',
    'sizes must be installed before the original geometry read',
  );
});

test('the recorder keeps inline and display TeX spans with measured display height and trimmed offsets', () => {
  const f = fixture();
  const inline = {
    nodeType: 1,
    tagName: 'SPAN',
    classList: { contains: (n) => n === 'katex' },
    querySelector: () => ({ textContent: 'x^2' }),
    nextSibling: null,
  };
  const display = {
    nodeType: 1,
    tagName: 'SPAN',
    classList: { contains: (n) => n === 'katex-display' },
    querySelector: () => ({ textContent: '\\frac{a}{b}' }),
    getBoundingClientRect: () => ({ top: 130, left: 0, width: 768, height: 38 }),
    nextSibling: null,
  };
  f.item.getBoundingClientRect = () => ({ top: 120, left: 0, width: 768, height: 48 });
  f.item.firstChild = { nodeType: 3, data: '  value ', nextSibling: inline };
  inline.nextSibling = { nodeType: 3, data: '\n', nextSibling: display };
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 80 } },
  ]);
  f.flush();
  const item = f.context.__butterLayoutCache.get('a').items[0];
  assert.equal(item.text, 'value x^2\n\\frac{a}{b}');
  assert.equal(item.math.length, 2);
  assert.equal(item.text.slice(item.math[0].start, item.math[0].end), 'x^2');
  assert.equal(item.math[1].display, true);
  assert.equal(item.math[1].h, 38);
  assert.equal(item.text.slice(item.math[1].start, item.math[1].end), '\\frac{a}{b}');
  assert.ok(!JSON.stringify(f.context.__heightCacheDump()).includes('value'));
});

test('HTML-only display math keeps nested TeX sources instead of recording an empty block', () => {
  const tex = String.raw`\boxed{\widetilde{E} = E(f(X;\theta),T) + c\sum_{i=1}^{n}\left[\frac{1}{(\theta_i-10)^2+\varepsilon}+\frac{1}{(\theta_i+10)^2+\varepsilon}\right]}`;
  for (const annotation of [null, { textContent: '' }]) {
    const f = fixture();
    const source = { getAttribute: () => tex };
    f.item.firstChild = {
      nodeType: 1,
      tagName: 'SPAN',
      classList: { contains: (n) => n === 'katex-display' },
      querySelector: (s) => (s === '[data-math-source]' ? source : annotation),
      closest: () => null,
      getBoundingClientRect: () => ({ top: 136, left: 0, width: 768, height: 118 }),
      get firstChild() {
        throw Error('nested KaTeX/base glyphs must not be duplicated');
      },
    };
    f.item.getBoundingClientRect = () => ({ top: 120, left: 0, width: 768, height: 150 });
    f.blocks.push(f.item);
    f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
    f.resize([
      { target: f.turn, contentRect: { height: 500 } },
      { target: f.item, contentRect: { height: 150 } },
    ]);
    f.flush();
    const record = f.context.__butterLayoutCache.get('a');
    assert.equal(record.items[0].text, tex, 'the boxed formula must not disappear');
    assert.equal(record.items[0].math.length, 1);
    assert.equal(record.items[0].math[0].display, true);
    assert.equal(record.items[0].math[0].h, 118);
    // Follow the geometry-only disk path as well: the formula must survive source hydration.
    const check = require('../extension/seek/layout-check-main.js');
    const codec = require('../extension/seek/layout-codec.js');
    const parts = check.segments('\\[\n' + tex + '\n\\]');
    const stored = codec.unpack(codec.pack(check.geometryOnly(record, parts, {}, 1)));
    assert.equal(stored.items[0].source, 0);
    assert.equal(check.hydrate(stored, parts).items[0].text, tex);
  }
});

test('height cache uses the shared fingerprint and preserves checkpoint width values', () => {
  const f = fixture(),
    calls = [];
  const fingerprint = f.context.__butterLayoutCheck.layoutFingerprint;
  f.context.__butterLayoutCheck = {
    ...f.context.__butterLayoutCheck,
    layoutFingerprint: (input) => {
      calls.push({ ...input });
      return fingerprint(input);
    },
  };
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  for (const vw of [800, 1440, 1600]) {
    f.context.innerWidth = vw;
    f.resize([{ target: f.turn, contentRect: { height: 500 } }]);
    f.flush();
    const entry = f.context.__butterLayoutCache.get('a');
    assert.equal(entry.vw, vw);
    assert.equal(entry.sw, 768);
    assert.deepEqual(calls.at(-1), { vw, sw: 768 });
  }
});

test('display descendants inside a skipped block are not measured until it renders', () => {
  const f = fixture();
  let reads = 0;
  f.item.firstChild = {
    nodeType: 1,
    tagName: 'SPAN',
    classList: { contains: (n) => n === 'katex-display' },
    querySelector: () => ({ textContent: 'x=1' }),
    getBoundingClientRect: () => {
      reads++;
      return { top: 120, left: 0, width: 768, height: 26 };
    },
  };
  f.item.hasAttribute = (n) => n === 'data-butter-seen';
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  cvState(f, f.item, true);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  assert.equal(reads, 0, 'no forced descendant layout while skipped');
  // The seen block's box is real; its unmeasured formula is only a flagged estimate.
  assert.equal(f.context.__butterLayoutCache.get('a').items[0].approx, true);
  cvState(f, f.item, false);
  f.flush();
  assert.equal(reads, 1);
  assert.equal(f.context.__butterLayoutCache.get('a').items[0].math[0].h, 26);
  assert.equal(f.context.__butterLayoutCache.get('a').items[0].approx, undefined);
  cvState(f, f.item, true);
  f.resize([{ target: f.turn, contentRect: { height: 510 } }]);
  f.flush();
  assert.equal(reads, 1, 'unchanged skipped math reuses its measured geometry');
  assert.equal(f.context.__butterLayoutCache.get('a').h, 510);
});

test('a formula box that spans the rest of a partly rendered answer is not recorded', () => {
  // Seen in a user video: the snapshot ended at an early display formula whose box ran to the end
  // of the turn, so the preview drew one viewport-sized math box and none of the text after it.
  const f = fixture();
  let height = 1400;
  f.item.tagName = 'SPAN';
  f.item.className = 'Display';
  f.item.matches = () => false;
  f.item.getBoundingClientRect = () => ({ top: 120, left: 0, width: 768, height });
  f.item.firstChild = {
    nodeType: 1,
    tagName: 'SPAN',
    classList: { contains: (n) => n === 'katex-display' },
    querySelector: () => ({ textContent: 'y_{n+1}^{(4)}=1.2340' }),
    getBoundingClientRect: () => ({ top: 136, left: 0, width: 768, height: 33 }),
    nextSibling: null,
  };
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 1500 } },
    { target: f.item, contentRect: { height: 1368 } },
  ]);
  f.flush();
  const stats = () => f.context.__heightCacheDump().stats;
  assert.equal(f.context.__butterLayoutCache.get('a'), null);
  assert.equal(stats().rejected['math-height'], 1);

  height = 65;
  f.resize([{ target: f.item, contentRect: { height: 33 } }]);
  f.flush();
  const settled = f.context.__butterLayoutCache.get('a');
  assert.equal(settled.items[0].h, 65);

  // A later partial snapshot keeps the settled record instead of replacing it.
  height = 1400;
  f.resize([{ target: f.item, contentRect: { height: 1368 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').items[0].h, 65);
  assert.equal(stats().rejected['math-height'], 2);
});

test('an answer ChatGPT is still revealing is not recorded until it settles', () => {
  // ChatGPT can mark a turn complete while its markdown root still reveals text
  // (.AdaptiveStreaming). A snapshot then holds only the first paragraphs and a row as tall as the
  // whole answer, so the preview would show those lines and an empty area down to the next question.
  const f = fixture();
  const para = (text, top, height) =>
    Object.assign(new f.Element(), {
      ...f.item,
      firstChild: { nodeType: 3, data: text, nextSibling: null },
      getBoundingClientRect: () => ({ top, left: 0, width: 768, height }),
    });
  f.turn.parentElement.getBoundingClientRect = () => ({ top: 0, width: 768, height: 1500 });
  f.c.revealing = true;
  f.blocks.push(para('The first lines of the answer.', 120, 52));
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 1500 } },
    { target: f.blocks[0], contentRect: { height: 52 } },
  ]);
  f.flush();
  const stats = () => f.context.__heightCacheDump().stats;
  assert.equal(f.context.__butterLayoutCache.get('a'), null);
  assert.equal(stats().rejected.revealing, 1);

  // Once the reveal ends, the settled snapshot with every paragraph replaces the rejected state.
  f.c.revealing = false;
  f.blocks.push(para('The rest of the answer, now in the page.', 190, 1250));
  f.mutation([{ target: f.turn, addedNodes: [f.blocks[1]], removedNodes: [] }]);
  f.resize([{ target: f.blocks[1], contentRect: { height: 1250 } }]);
  f.flush();
  const settled = f.context.__butterLayoutCache.get('a');
  assert.deepEqual(
    Array.from(settled.items, (it) => it.text),
    ['The first lines of the answer.', 'The rest of the answer, now in the page.'],
  );
  assert.deepEqual([...settled.blocks], [52, 1250]);
  assert.equal(stats().rejected.revealing, 1);
});

// A recorded turn, measured once with no scrolling. Returns a counter of item geometry reads.
const recorded = () => {
  const f = fixture();
  let reads = 0;
  const rect = f.item.getBoundingClientRect;
  f.item.getBoundingClientRect = () => (reads++, rect());
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 1);
  return { f, reads: () => reads };
};
const cvState = (f, target, skipped) =>
  f.listeners.contentvisibilityautostatechange({ target, skipped });

test('a recorded turn coming back into view is not measured again', () => {
  // Fast wheel scrolling crosses the content-visibility boundary constantly; re-measuring the whole
  // turn every time forced layout inside the scroll frames (lab: 33-45 records per 6 s burst).
  const { f, reads } = recorded();
  const before = reads();
  cvState(f, f.item, true);
  cvState(f, f.item, false);
  cvState(f, f.turn, true);
  cvState(f, f.turn, false);
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 1, 'no second record');
  assert.equal(reads() - before, 0, 'no item geometry read');
});

test('a reveal event on a recorded turn makes no DOM query', () => {
  // A long math turn has hundreds of blocks; even querySelectorAll per cv event cost ~2 ms each
  // and 1.7 s per burst in the lab.
  const { f } = recorded();
  let queries = 0;
  for (const name of ['querySelector', 'querySelectorAll']) {
    const fn = f.turn[name];
    f.turn[name] = (s) => (queries++, fn(s));
  }
  for (let i = 0; i < 50; i++) cvState(f, f.item, i % 2 === 0);
  assert.equal(queries, 0);
});

test('a turn that changed while skipped is measured again once it is back in view', () => {
  const { f } = recorded();
  cvState(f, f.turn, true);
  f.mutation([{ target: f.turn, addedNodes: [], removedNodes: [] }]);
  f.flush();
  const stats = () => f.context.__heightCacheDump().stats;
  assert.equal(stats().rejected.skipped, 1);
  cvState(f, f.turn, false);
  f.flush();
  assert.equal(stats().records, 2);
});

// An idle period with ms to spare; each deadline check spends 1 ms.
const idle = (f, ms) => {
  for (const fn of f.frames.splice(0)) {
    let left = ms;
    fn({ timeRemaining: () => (left -= 1) });
  }
};
// A turn of n paragraphs, each with its observed size; counts item geometry reads.
const longTurn = (f, n) => {
  let reads = 0;
  for (let i = 0; i < n; i++)
    f.blocks.push(
      Object.assign(new f.Element(), {
        ...f.item,
        firstChild: { nodeType: 3, data: `paragraph ${i}`, nextSibling: null },
        getBoundingClientRect: () => (
          reads++,
          { top: 120 + 26 * i, left: 0, width: 768, height: 26 }
        ),
      }),
    );
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    ...f.blocks.map((target) => ({ target, contentRect: { height: 26 } })),
  ]);
  return () => reads;
};

test('a turn first seen while the page scrolls is recorded in idle slices while it is rendered', () => {
  // Measuring only after 250 ms without scroll events left turns seen during a fast scroll
  // unrecorded: by then they were skipped (lab: 6-10 records after a burst, 176-201 on HEAD).
  const f = fixture();
  const reads = longTurn(f, 100);
  const records = () => f.context.__heightCacheDump().stats.records;
  f.listeners.scroll?.({});
  f.listeners.wheel?.({});
  idle(f, 0);
  assert.equal(reads(), 0, 'no idle time: nothing is read');
  idle(f, 6);
  assert.ok(reads() > 0 && reads() <= 72, `one idle period reads a few slices, read ${reads()}`);
  assert.equal(records(), 0, 'a long turn is not finished in one short idle period');
  f.listeners.wheel?.({});
  idle(f, 6);
  assert.equal(records(), 1, 'recorded in the next idle period, still scrolling');
  assert.equal(reads(), 100, 'every item read once');
  assert.equal(f.context.__butterLayoutCache.get('a').items.length, 100);
});

test('a turn that is skipped part-way through its measure stops being read', () => {
  const f = fixture();
  const reads = longTurn(f, 100);
  idle(f, 6);
  const partial = reads();
  cvState(f, f.turn, true);
  idle(f, 50);
  assert.equal(reads(), partial, 'no reads once the turn is skipped');
  assert.equal(f.context.__heightCacheDump().stats.records, 0);
  cvState(f, f.turn, false);
  idle(f, 50);
  assert.equal(f.context.__heightCacheDump().stats.records, 1, 'measured again once rendered');
});

test('a turn that changes part-way through its measure is measured again from the start', () => {
  const f = fixture();
  const reads = longTurn(f, 100);
  idle(f, 6);
  f.resize([{ target: f.blocks[99], contentRect: { height: 52 } }]);
  idle(f, 50);
  const e = f.context.__butterLayoutCache.get('a');
  assert.equal(e.blocks[99], 52);
  assert.ok(reads() > 100, 'the slices read before the change are not reused');
});

test('a remounted copy of a recorded, unchanged turn adopts its record without measuring', () => {
  // ChatGPT mounts a fresh element whenever a turn scrolls back in; measuring each again would
  // bring back the per-scroll cost of re-measuring recorded turns.
  const { f, reads } = recorded();
  const entry = f.context.__butterLayoutCache.get('a');
  const copy = Object.assign(new f.Element(), { ...f.turn, dataset: { turnKey: 'a' } });
  f.turn.isConnected = false;
  f.mutation([{ target: {}, addedNodes: [copy], removedNodes: [f.turn] }]);
  f.resize([{ target: copy, contentRect: { height: 500 } }]);
  const before = reads();
  idle(f, 50);
  const stats = f.context.__heightCacheDump().stats;
  assert.equal(stats.records, 1, 'no second record');
  assert.equal(stats.adopted, 1);
  assert.equal(reads() - before, 0, 'no item geometry read');
  assert.equal(f.context.__butterLayoutCache.get('a'), entry);
  // Coming into view again is still free.
  cvState(f, copy, true);
  cvState(f, copy, false);
  idle(f, 50);
  assert.equal(f.context.__heightCacheDump().stats.records, 1);
});

test('a remounted turn whose size changed is measured', () => {
  const { f } = recorded();
  const copy = Object.assign(new f.Element(), { ...f.turn, dataset: { turnKey: 'a' } });
  f.turn.isConnected = false;
  f.mutation([{ target: {}, addedNodes: [copy], removedNodes: [f.turn] }]);
  f.resize([{ target: copy, contentRect: { height: 540 } }]);
  idle(f, 50);
  assert.equal(f.context.__heightCacheDump().stats.records, 2);
  assert.equal(f.context.__butterLayoutCache.get('a').h, 540);
});

test('a remounted turn whose blocks changed size at the same total is measured', () => {
  // Adopting on equal turn and row height alone kept [100, 200] for blocks now [200, 100].
  const f = fixture();
  const block = () => Object.assign(new f.Element(), { ...f.item, closest: () => f.turn });
  const [a, b] = [block(), block()];
  f.blocks.push(a, b);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: a, contentRect: { height: 100 } },
    { target: b, contentRect: { height: 200 } },
  ]);
  f.flush();
  assert.deepEqual([...f.context.__butterLayoutCache.get('a').blocks], [100, 200]);
  const copy = Object.assign(new f.Element(), { ...f.turn, dataset: { turnKey: 'a' } });
  a.closest = b.closest = () => copy;
  f.turn.isConnected = false;
  f.mutation([{ target: {}, addedNodes: [copy], removedNodes: [f.turn] }]);
  f.resize([
    { target: copy, contentRect: { height: 500 } },
    { target: a, contentRect: { height: 200 } },
    { target: b, contentRect: { height: 100 } },
  ]);
  idle(f, 50);
  assert.equal(f.context.__heightCacheDump().stats.adopted ?? 0, 0);
  assert.deepEqual([...f.context.__butterLayoutCache.get('a').blocks], [200, 100]);
});

test("a widget block with no box of its own gets its children's size", () => {
  // ChatGPT wraps widgets in long answers (learning cards, card rows) in a display: contents div.
  // It never gets a ResizeObserver size, so every snapshot of the answer was rejected (zero-block).
  const f = fixture();
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    hasAttribute: () => false,
    className: 'card',
    classList: { contains: () => false },
    firstChild: { nodeType: 3, data: 'Card text', nextSibling: null },
    nextSibling: null,
    firstElementChild: null,
    nextElementSibling: null,
    getBoundingClientRect: () => ({ top: 200, left: 10, width: 700, height: 344 }),
    getClientRects: () => [{}],
  };
  const footer = {
    ...card,
    firstChild: { nodeType: 3, data: 'more', nextSibling: null },
    getBoundingClientRect: () => ({ top: 544, left: 10, width: 700, height: 24 }),
  };
  card.nextSibling = card.nextElementSibling = footer;
  const widget = Object.assign(new f.Element(), {
    ...f.item,
    tagName: 'DIV',
    className: 'contents',
    firstChild: card,
    firstElementChild: card,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    getClientRects: () => [],
  });
  f.sc.clientLeft = 0;
  f.blocks.push(f.item, widget);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 600 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  const e = f.context.__butterLayoutCache.get('a');
  assert.ok(e, JSON.stringify(f.context.__heightCacheDump().stats.rejected));
  assert.deepEqual([...e.blocks], [26, 368]);
  assert.equal(e.items[1].top, 200);
  assert.equal(e.items[1].h, 368);
  assert.equal(e.items[1].left, 10);
  assert.equal(e.items[1].text, 'Card text\nmore');
});

test('a block skipped before it ever rendered is not recorded at its placeholder size', () => {
  // ChatGPT does not scroll with a streaming answer, so most of a long answer arrives below the fold
  // and the streaming rule skips it before it renders. A display formula then reads 152 px (the
  // 120px placeholder plus padding); the first record kept 180 of them (lab: +1.6-2.7k px per turn).
  for (const reveal of ['event', 'style']) {
    const f = fixture();
    let cv = 'auto',
      height = 152;
    const base = f.context.getComputedStyle;
    f.context.getComputedStyle = (el) => ({ ...base(el), contentVisibility: cv });
    f.item.getBoundingClientRect = () => ({ top: 120, left: 0, width: 768, height });
    f.blocks.push(f.item);
    f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
    cvState(f, f.item, true);
    f.resize([
      { target: f.turn, contentRect: { height: 500 } },
      { target: f.item, contentRect: { height: 120 } },
    ]);
    f.flush();
    assert.equal(f.context.__butterLayoutCache.get('a'), null, reveal);
    assert.equal(f.context.__heightCacheDump().stats.rejected.placeholder, 1, reveal);
    // It renders: it comes into view (an event), or the answer completes and the streaming rule no
    // longer applies to it (no event; content-visibility is no longer auto).
    height = 65;
    if (reveal === 'event') cvState(f, f.item, false);
    else cv = 'visible';
    f.resize([{ target: f.item, contentRect: { height: 33 } }]);
    f.flush();
    const e = f.context.__butterLayoutCache.get('a');
    assert.equal(e?.items[0].h, 65, reveal);
    assert.equal(e.blocks[0], 33, reveal);
  }
});

test('a skipped block that rendered before it was marked is recorded', () => {
  const f = fixture();
  f.context.getComputedStyle = () => ({ contentVisibility: 'auto' });
  f.item.hasAttribute = (n) => n === 'data-butter-seen';
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  cvState(f, f.item, true);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a')?.blocks[0], 26);
});

test('restore leaves content-visibility alone when the cv setting is off', () => {
  for (const off of ['cv', 'rail cv seek', 'rail']) {
    const f = fixture();
    f.blocks.push(f.item);
    f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
    f.resize([
      { target: f.turn, contentRect: { height: 500 } },
      { target: f.item, contentRect: { height: 26 } },
    ]);
    f.flush();
    f.context.__butterLayoutCache.get('a').removed = true;
    f.context.document.documentElement = {
      hasAttribute: () => false,
      getAttribute: (n) => (n === 'data-butter-off' ? off : null),
    };
    const bubble = Object.assign(new f.Element(), {
      firstElementChild: { classList: { contains: () => true } },
      closest: (s) => (s === '.thread-scroll-container' ? f.sc : {}),
    });
    void bubble.clientWidth;
    const cvOff = off.split(' ').includes('cv');
    assert.equal(f.turn.style.contentVisibility, cvOff ? undefined : 'auto', off);
    assert.equal(f.item.style.contentVisibility, cvOff ? undefined : 'auto', off);
    assert.equal(f.item.style.containIntrinsicSize, cvOff ? undefined : 'auto 26px', off);
  }
});

// What the layout fingerprint reads, for tests that run it (a page root, the scroller's column).
const layoutReady = (f, off = null) => {
  f.sc.querySelector = () => null;
  f.context.devicePixelRatio = 1;
  f.context.document.documentElement = {
    className: '',
    hasAttribute: () => false,
    getAttribute: (n) => (n === 'data-butter-off' ? off : null),
  };
};

test('nothing is measured while seek, cv and layout are all off', () => {
  for (const [off, records] of [
    ['seek cv layout', 0],
    ['seek layout', 1],
    ['cv layout', 1],
  ]) {
    const f = fixture();
    layoutReady(f, off);
    f.blocks.push(f.item);
    f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
    f.resize([
      { target: f.turn, contentRect: { height: 500 } },
      { target: f.item, contentRect: { height: 26 } },
    ]);
    f.flush();
    assert.equal(f.context.__heightCacheDump().stats.records, records, off);
  }
});

test('a measure in progress stops when seek, cv and layout are all turned off', () => {
  const f = fixture();
  let off = null;
  layoutReady(f);
  f.context.document.documentElement.getAttribute = (n) => (n === 'data-butter-off' ? off : null);
  const reads = longTurn(f, 100);
  idle(f, 6);
  const partial = reads();
  off = 'seek cv layout';
  idle(f, 50);
  assert.equal(reads(), partial, 'no reads once nothing needs records');
  assert.equal(f.context.__heightCacheDump().stats.records, 0);
});

test('the seek preview press measures turns still waiting for idle time', () => {
  const { f } = recorded();
  layoutReady(f);
  f.resize([{ target: f.item, contentRect: { height: 40 } }]);
  idle(f, 0);
  assert.equal(f.context.__heightCacheDump().stats.records, 1);
  f.context.__butterLayoutCache.prepare(f.sc, ['a']);
  assert.equal(f.context.__butterLayoutCache.get('a').blocks[0], 40);
});

test('a row that grows outside its turn gets the turn measured again', () => {
  // The record keeps the row's height; a row change outside [data-turn-key] is no mutation of the
  // turn, and with no re-measure on every reveal the preview distrusted the stale row (lab: 52 px).
  const { f } = recorded();
  let rowH = 500;
  f.turn.parentElement.isConnected = true;
  f.turn.parentElement.getBoundingClientRect = () => ({ top: 0, width: 768, height: rowH });
  assert.ok(f.observed.has(f.turn.parentElement), 'the row is observed');
  rowH = 552;
  f.resize([{ target: f.turn.parentElement, contentRect: { height: 552 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a').rowH, 552);
});

// A second turn, 'b', whose answer streams until done() (state attribute flips to complete).
const streamingTurn = (f) => {
  const s = { streaming: true, queries: 0, reads: 0 };
  f.context.setTimeout = (fn) => (f.frames.push(fn), 1); // the 1 s hold re-check runs on flush()
  const item = Object.assign(new f.Element(), {
    ...f.item,
    getBoundingClientRect: () => (s.reads++, { top: 120, left: 0, width: 768, height: 26 }),
  });
  const t = Object.assign(new f.Element(), {
    ...f.turn,
    dataset: { turnKey: 'b' },
    parentElement: { getBoundingClientRect: () => ({ top: 0, width: 768, height: 500 }) },
    closest: (sel) => (sel === '.thread-scroll-container' ? f.sc : t),
    querySelector: (sel) =>
      sel.includes('in_progress')
        ? s.streaming
          ? {}
          : null
        : sel.includes('complete')
          ? s.streaming
            ? null
            : {}
          : sel.includes('author-role')
            ? { getAttribute: () => 'm2' }
            : null,
    querySelectorAll: (sel) => (s.queries++, sel === '[data-math-source]' ? [] : [item]),
  });
  item.closest = () => t;
  const chunk = () =>
    f.mutation([{ type: 'childList', target: item, addedNodes: [], removedNodes: [] }]);
  const done = () => {
    s.streaming = false;
    f.mutation([
      {
        type: 'attributes',
        attributeName: 'data-talvt-turn-state',
        target: t,
        addedNodes: [],
        removedNodes: [],
      },
    ]);
  };
  return { s, t, item, chunk, done };
};

test('nothing is queried, observed or measured for a turn whose answer is streaming', () => {
  // On every streamed chunk the recorder re-queried the whole streaming turn (lab: 1.06 s of a
  // 2 min answer), and idle measuring rejected it as incomplete 393 times.
  const f = fixture();
  const b = streamingTurn(f);
  f.mutation([{ target: {}, addedNodes: [b.t], removedNodes: [] }]);
  for (let i = 0; i < 5; i++) {
    b.chunk();
    f.flush();
  }
  assert.equal(b.s.queries, 0, 'no querySelectorAll on the streaming turn');
  assert.equal(b.s.reads, 0, 'no geometry read');
  assert.ok(!f.observed.has(b.t) && !f.observed.has(b.item), 'no ResizeObserver on it');
  assert.equal(f.context.__heightCacheDump().stats.rejected.incomplete, undefined);
  // Completion catches up: the turn is watched afresh and recorded.
  b.done();
  assert.ok(f.observed.has(b.t) && f.observed.has(b.item));
  f.resize([
    { target: b.t, contentRect: { height: 500 } },
    { target: b.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('b')?.blocks[0], 26);
});

test('idle measuring waits while an answer streams and catches up when it completes', () => {
  // Measuring forces style and layout of a document every chunk dirties; right after a send it
  // re-measured the previous long answer in one 484 ms task.
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  const b = streamingTurn(f);
  f.mutation([{ target: {}, addedNodes: [b.t], removedNodes: [] }]);
  f.flush();
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 0, 'nothing measured while it streams');
  b.done();
  f.resize([
    { target: b.t, contentRect: { height: 500 } },
    { target: b.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  f.flush();
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a')?.blocks[0], 26);
  assert.equal(f.context.__butterLayoutCache.get('b')?.blocks[0], 26);
});

test('a block the stream held back is a placeholder until it renders, then it is recorded', () => {
  // stream/offscreen.js keeps a block skipped before it ever rendered skipped after completion
  // (data-butter-unrendered); its size is the placeholder until the user scrolls to it.
  const f = fixture();
  let held = true,
    styleReads = 0;
  const base = f.context.getComputedStyle;
  f.context.getComputedStyle = (el) => {
    if (el === f.item) styleReads++;
    return { ...base(el), contentVisibility: 'auto' };
  };
  f.item.hasAttribute = (n) => n === 'data-butter-unrendered' && held;
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  cvState(f, f.item, true);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 120 } },
  ]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a'), null);
  assert.equal(f.context.__heightCacheDump().stats.rejected.placeholder, 1);
  assert.equal(styleReads, 0, 'rejected without a forced style read');
  // Scrolled to: it renders at its real size and the turn is recorded.
  held = false;
  cvState(f, f.item, false);
  f.resize([{ target: f.item, contentRect: { height: 33 } }]);
  f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a')?.blocks[0], 33);
});

test('a sent question with no answer yet holds idle measuring like a streaming answer', () => {
  // ChatGPT inserts the sent question as a turn that already reads complete; it turns in_progress
  // seconds later. Measuring the previous answer in that gap slowed every later style recalc.
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  const b = streamingTurn(f);
  let answered = false;
  b.s.streaming = false; // reads complete
  const qs = b.t.querySelector;
  b.t.querySelector = (sel) =>
    sel === '[data-user-message-bubble]'
      ? {}
      : sel === '[data-markdown-text-style="assistant-message"]'
        ? answered
          ? { getBoundingClientRect: () => ({ left: 0, width: 768 }) }
          : null
        : qs(sel);
  f.mutation([{ target: {}, addedNodes: [b.t], removedNodes: [] }]);
  f.flush();
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 0, 'held while the answer is pending');
  assert.equal(b.s.queries, 0, 'the pending turn is not queried');
  // The answer streams, then completes.
  b.s.streaming = true;
  answered = true;
  f.mutation([
    {
      type: 'attributes',
      attributeName: 'data-talvt-turn-state',
      target: b.t,
      addedNodes: [],
      removedNodes: [],
    },
  ]);
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 0, 'held while it streams');
  b.done();
  f.resize([
    { target: b.t, contentRect: { height: 500 } },
    { target: b.item, contentRect: { height: 26 } },
  ]);
  for (let i = 0; i < 4; i++) f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a')?.blocks[0], 26);
  assert.equal(f.context.__butterLayoutCache.get('b')?.blocks[0], 26);
});

test('a sent question that never gets an answer stops holding idle measuring after 15 s', () => {
  const f = fixture();
  let now = 1;
  f.context.performance.now = () => now;
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  const b = streamingTurn(f);
  b.s.streaming = false;
  const qs = b.t.querySelector;
  b.t.querySelector = (sel) =>
    sel === '[data-user-message-bubble]'
      ? {}
      : sel === '[data-markdown-text-style="assistant-message"]'
        ? null
        : qs(sel);
  f.mutation([{ target: {}, addedNodes: [b.t], removedNodes: [] }]);
  f.flush();
  assert.equal(f.context.__heightCacheDump().stats.records, 0);
  now += 16000;
  for (let i = 0; i < 4; i++) f.flush();
  assert.equal(f.context.__butterLayoutCache.get('a')?.blocks[0], 26, 'no longer held');
  assert.ok(f.observed.has(b.t), 'the unanswered turn is watched as it is');
});

test('a streaming turn mounted together with completed turns is parked, not observed', () => {
  // A container holding several turns reached watch() through forEach, whose index argument read
  // as settled: every turn after the first skipped parking.
  const f = fixture();
  f.blocks.push(f.item);
  const b = streamingTurn(f);
  const c = streamingTurn(f);
  c.t.dataset = { turnKey: 'c' };
  const box = { nodeType: 1, hasAttribute: () => false, firstElementChild: {} };
  box.querySelectorAll = () => [f.turn, b.t, c.t];
  f.mutation([{ target: {}, addedNodes: [box], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  for (let i = 0; i < 3; i++) {
    b.chunk();
    f.flush();
  }
  for (const s of [b, c]) {
    assert.equal(s.s.queries, 0, `turn ${s.t.dataset.turnKey} is not queried`);
    assert.ok(!f.observed.has(s.t) && !f.observed.has(s.item), 'no ResizeObserver on it');
  }
  assert.equal(f.context.__heightCacheDump().stats.parked, 2);
  assert.equal(f.context.__heightCacheDump().stats.records, 0, 'nothing measured while it streams');
});

test('a regenerated answer in a restored turn is not recorded at its placeholder size', () => {
  // Parking kept the turn restored, and a restored turn's skipped blocks counted as real sizes:
  // the regenerated answer's held-back formula was recorded at 152 px.
  const { f } = recorded();
  layoutReady(f);
  f.context.__butterLayoutCache.get('a').removed = true;
  const bubble = Object.assign(new f.Element(), {
    firstElementChild: { classList: { contains: () => true } },
    closest: (s) => (s === '.thread-scroll-container' ? f.sc : {}),
  });
  void bubble.clientWidth;
  assert.equal(f.turn.style.contentVisibility, 'auto', 'restored');
  const state = () =>
    f.mutation([
      {
        type: 'attributes',
        attributeName: 'data-talvt-turn-state',
        target: f.turn,
        addedNodes: [],
        removedNodes: [],
      },
    ]);
  // Regenerate: the answer streams with a new message id; its formula is held back unrendered.
  f.c.complete = false;
  state();
  const qs = f.turn.querySelector;
  f.turn.querySelector = (s) => (s.includes('author-role') ? { getAttribute: () => 'm2' } : qs(s));
  const formula = Object.assign(new f.Element(), {
    ...f.item,
    hasAttribute: (n) => n === 'data-butter-unrendered',
    getBoundingClientRect: () => ({ top: 120, left: 0, width: 768, height: 152 }),
  });
  f.blocks.splice(0, f.blocks.length, formula);
  f.c.complete = true;
  state();
  cvState(f, formula, true);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: formula, contentRect: { height: 120 } },
  ]);
  for (let i = 0; i < 3; i++) f.flush();
  const e = f.context.__butterLayoutCache.get('a');
  assert.ok(!e || e.msg !== 'm2' || !e.blocks.includes(120), JSON.stringify(e?.blocks));
  assert.ok(!e?.items?.some((x) => x.h === 152), 'no item at the placeholder size');
  assert.equal(f.context.__heightCacheDump().stats.rejected.placeholder, 1);
});

test('a single Dil turn mounted before recorder startup is recorded without leaving the viewport', () => {
  // Capture-shaped Dil blocks: prose, a code widget, display math and a wide table. The real
  // selector/wrapper structure is also exercised by the run's synthetic-dil.mjs browser fixture.
  const f = fixture({
    mounted: true,
    setup({ turn, item, blocks, sc, Element }) {
      sc.clientLeft = 0;
      const paragraph = Object.assign(new Element(), { ...item, closest: () => turn });
      const code = Object.assign(new Element(), {
        ...paragraph,
        tagName: 'DIV',
        className: '',
        hasAttribute: (n) => n === 'data-client-defined-widget',
        children: [],
        firstChild: { nodeType: 3, data: 'Synthetic code' },
        getBoundingClientRect: () => ({ top: 162, left: 0, width: 768, height: 186 }),
      });
      const formula = Object.assign(new Element(), {
        ...paragraph,
        tagName: 'SPAN',
        className: 'katex-display',
        classList: { contains: (n) => n === 'katex-display' },
        querySelector: () => ({ textContent: 'x=1' }),
        getBoundingClientRect: () => ({ top: 364, left: 0, width: 768, height: 38.484375 }),
      });
      const table = Object.assign(new Element(), {
        ...paragraph,
        tagName: 'DIV',
        className: 'TableFrame-fixture',
        firstChild: { nodeType: 3, data: 'Synthetic cells' },
        getBoundingClientRect: () => ({ top: 420, left: 0, width: 768, height: 110.5 }),
      });
      blocks.push(paragraph, code, formula);
      const original = turn.querySelectorAll;
      turn.querySelectorAll = (s) => (s === core.PREVIEW_ITEMS ? [...blocks, table] : original(s));
    },
  });
  assert.ok(f.observed.has(f.turn), 'startup must observe the already-mounted turn');
  f.resize([
    { target: f.turn, contentRect: { height: 600 } },
    ...f.blocks.map((target) => ({
      target,
      contentRect: { height: target.getBoundingClientRect().height },
    })),
  ]);
  f.flush();
  const r = f.context.__butterLayoutCache.get('a');
  assert.ok(r, JSON.stringify(f.context.__heightCacheDump().stats.rejected));
  assert.equal(r.items.length, 4);
  assert.equal(r.items[2].math[0].h, 38.484375);
  assert.equal(
    core.buildModel({
      ids: ['a'],
      measured: { a: 500 },
      records: { a: r },
      texts: {},
      scrollHeight: 500,
      gap: 12,
      sw: 768,
    })[0].layout,
    true,
  );
});

test('readiness capture reports the actual per-turn rejection and never emits content or IDs', () => {
  const f = fixture();
  f.blocks.push(f.item);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.c.math = false;
  f.flush();
  assert.equal(f.context.__butterLayoutCache.diagnostics(f.turn).lastRejection, 'math-pending');
  f.turn.__reactFiber$fixture = {
    memoizedProps: { entries: [{ turnKey: 'a' }], RowComponent() {} },
    memoizedState: { memoizedState: { a: 500 } },
  };
  let copied;
  f.context.copy = (json) => (copied = JSON.parse(json));
  f.context.console = { table() {}, info() {} };
  const capture = () =>
    vm.runInContext(
      fs.readFileSync(require.resolve('../notes/diagnostics/capture-record-readiness.js'), 'utf8'),
      f.context,
    );
  capture();
  assert.equal(copied.rejectionDiagnosticsAvailable, true);
  assert.equal(copied.turns[0].hasRecord, false);
  assert.equal(copied.turns[0].recorder.observed, true);
  assert.equal(copied.turns[0].recorder.attempted, true);
  assert.equal(copied.turns[0].recorder.lastRejection, 'math-pending');
  assert.equal(copied.turns[0].layoutReason, 'no-record');
  f.c.math = true;
  f.resize([{ target: f.item, contentRect: { height: 26 } }]);
  f.flush();
  capture();
  assert.equal(copied.turns[0].layout, true);
  assert.equal(copied.turns[0].recorder.lastRejection, null);
  assert.equal(copied.turns[0].recordValidation, null);
  const json = JSON.stringify(copied);
  for (const privateValue of [
    'sample',
    'm1',
    '00000000-0000-0000-0000-000000000000',
    '"id"',
    '"text"',
  ])
    assert.ok(!json.includes(privateValue), privateValue);
});

test('recorder diagnostics report no attempt for a turn that was never measured', () => {
  const f = fixture();
  assert.deepEqual(
    { ...f.context.__butterLayoutCache.diagnostics(f.turn) },
    {
      observed: false,
      generating: false,
      queued: false,
      measuring: false,
      attempted: false,
      lastRejection: null,
    },
  );
});

test('press cache decisions retain pre-flush geometry and distinguish conversation filtering', () => {
  const f = fixture({ mounted: true, setup: ({ blocks, item }) => blocks.push(item) });
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    { target: f.item, contentRect: { height: 26 } },
  ]);
  f.flush();
  layoutReady(f);
  const cache = f.context.__butterLayoutCache;
  const first = cache.prepare(f.sc, ['a']).decisions[0];
  assert.equal(first.before.hasRecord, true);
  assert.equal(first.before.rowH, 500);
  assert.equal(first.after.rowH, 500);
  assert.equal(first.reason, null);
  f.turn.parentElement.getBoundingClientRect = () => ({ top: 0, width: 768, height: 540 });
  f.resize([{ target: f.turn, contentRect: { height: 540 } }]);
  const flushed = cache.prepare(f.sc, ['a']).decisions[0];
  assert.equal(flushed.before.rowH, 500);
  assert.equal(flushed.after.rowH, 540);
  assert.equal(flushed.recordChanged, true);
  f.context.location.pathname = '/g/g-p-synthetic/c/11111111-1111-1111-1111-111111111111';
  const filtered = cache.prepare(f.sc, ['a']);
  assert.equal(filtered.records.a, undefined);
  assert.equal(filtered.decisions[0].reason, 'conv-mismatch');
  assert.equal(filtered.decisions[0].after.convMatches, false);
  assert.deepEqual(Object.keys(filtered.decisions[0].before).sort(), [
    'blocks',
    'convMatches',
    'fromStorage',
    'hasRecord',
    'items',
    'rowH',
    'sw',
  ]);
  assert.equal(cache.prepare(f.sc, ['missing']).decisions[0].after.hasRecord, false);
});

// A long answer: several seen blocks, each a paragraph with one display formula. Only some are on
// screen at a time; content-visibility skips the rest at their remembered (real) size.
const plain = (x) => JSON.parse(JSON.stringify(x)); // vm-realm arrays
function longAnswer(n) {
  const f = fixture();
  const reads = [];
  const items = Array.from({ length: n }, (_, i) => {
    reads.push(0);
    const formula = {
      nodeType: 1,
      tagName: 'SPAN',
      classList: { contains: (c) => c === 'katex-display' },
      querySelector: () => ({ textContent: `x_${i}=1` }),
      getBoundingClientRect: () => {
        reads[i]++;
        return { top: 120 + i * 100, left: 0, width: 768, height: 44 };
      },
    };
    return Object.assign(new f.Element(), {
      ...f.item,
      hasAttribute: (a) => a === 'data-butter-seen',
      firstChild: formula,
      closest: () => f.turn,
      getBoundingClientRect: () => ({ top: 120 + i * 100, left: 0, width: 768, height: 90 }),
    });
  });
  f.blocks.push(...items);
  f.mutation([{ target: {}, addedNodes: [f.turn], removedNodes: [] }]);
  for (const it of items) cvState(f, it, true);
  f.resize([
    { target: f.turn, contentRect: { height: 500 } },
    ...items.map((target) => ({ target, contentRect: { height: 90 } })),
  ]);
  f.flush();
  // ChatGPT's hover action bar and similar updates add or remove nodes inside the turn.
  const churn = () => f.mutation([{ target: items[0], addedNodes: [], removedNodes: [] }]);
  const reveal = (i) => {
    cvState(f, items[i], false);
    f.flush();
    cvState(f, items[i], true);
  };
  return { f, items, reads, churn, reveal, get: () => f.context.__butterLayoutCache.get('a') };
}

test('a long answer read one block at a time is recorded despite DOM churn in the turn', () => {
  // Mac (Dil, 16k px turn): readiness hasRecord false, lastRejection math-pending, although every
  // formula had typeset. Any mutation in the turn dropped the lean-text cache, and skipped blocks'
  // geometry was only reused for the identical cached object, so it never accumulated.
  const { reads, churn, reveal, get } = longAnswer(3);
  for (let i = 0; i < 3; i++) {
    reveal(i);
    churn();
  }
  const r = get();
  assert.ok(r, 'a fully read answer has a record');
  assert.deepEqual(plain(r.items.map((it) => it.math[0].h)), [44, 44, 44]);
  assert.ok(!r.items.some((it) => it.approx), 'every formula was measured');
  assert.deepEqual(reads, [1, 1, 1], 'no descendant read while skipped');
});

test('blocks never on screen get flagged estimates, refined once revealed, never persisted', () => {
  const { f, reads, reveal, get } = longAnswer(3);
  const r = get();
  assert.ok(r, 'seen skipped blocks have real boxes: the answer is usable before it is read');
  assert.deepEqual(reads, [0, 0, 0], 'estimates force no layout inside skipped blocks');
  assert.deepEqual(plain(r.items.map((it) => [it.h, !!it.approx, it.math[0].h <= it.h])), [
    [90, true, true],
    [90, true, true],
    [90, true, true],
  ]);
  assert.equal(core.validateSnapshot({ ...r, complete: true, mathReady: true }), null);
  assert.equal(
    core.buildModel({
      ids: ['a'],
      measured: { a: 500 },
      records: { a: r },
      texts: {},
      scrollHeight: 500,
      gap: 12,
      sw: 768,
    })[0].layout,
    true,
  );
  reveal(1);
  const refined = get();
  assert.deepEqual(
    plain(refined.items.map((it) => !!it.approx)),
    [true, false, true],
    'a revealed block re-queues the turn and replaces its estimate',
  );
  assert.equal(refined.items[1].math[0].h, 44);
  reveal(0);
  reveal(2);
  assert.ok(!get().items.some((it) => it.approx));
  const records = f.context.__heightCacheDump().stats.records;
  reveal(1);
  assert.equal(
    f.context.__heightCacheDump().stats.records,
    records,
    'complete record: no re-measure',
  );
});

test('an estimate never replaces a record measured in full', () => {
  const { f, reveal, get, churn } = longAnswer(2);
  reveal(0);
  reveal(1);
  const measured = get();
  assert.ok(measured && !measured.items.some((it) => it.approx));
  // Both blocks skipped; the turn changes size (a new snapshot is taken) and one block's box with
  // it, so its measured geometry no longer applies.
  const old = f.blocks[1].getBoundingClientRect;
  f.blocks[1].getBoundingClientRect = () => ({ ...old(), height: 95 });
  churn();
  f.resize([{ target: f.turn, contentRect: { height: 505 } }]);
  f.flush();
  assert.equal(get(), measured, 'the measured record is kept');
  assert.equal(f.context.__butterLayoutCache.diagnostics(f.turn).lastRejection, 'estimated');
  reveal(1);
  assert.equal(get().items[1].h, 95, 'measured again once it is on screen');
  assert.ok(!get().items.some((it) => it.approx));
});
