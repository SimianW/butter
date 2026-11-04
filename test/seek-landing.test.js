const test = require('node:test'),
  assert = require('node:assert/strict');
const vm = require('node:vm'),
  fs = require('node:fs'),
  crypto = require('node:crypto').webcrypto;
const seek = require(
    process.env.REVIEW_SOURCE
      ? process.env.REVIEW_SOURCE + '/seek/core-main.js'
      : '../extension/seek/core-main.js',
  ),
  layoutCheck = require(
    process.env.REVIEW_SOURCE
      ? process.env.REVIEW_SOURCE + '/seek/layout-check-main.js'
      : '../extension/seek/layout-check-main.js',
  );
const conv = '00000000-0000-0000-0000-000000000000';
const texts = { t: { q: 'question', answer: 'answer', msg: 'm', ids: ['m'] } };
const record = {
  conv,
  ready: true,
  removed: true,
  h: 500,
  rowH: 520,
  w: 768,
  vw: 1600,
  sw: 1258,
  msg: 'm',
  blocks: [26],
  items: [{ top: 20, h: 26, left: 200, w: 768, user: false, css: '', text: 'answer' }],
};
function fixture() {
  const events = {},
    resizeObservers = [];

  let restoring = false,
    prematureReads = 0;
  class Element {
    get clientWidth() {
      if (restoring && block.style.containIntrinsicSize !== 'auto 26px') prematureReads++;
      return 1258;
    }
  }
  const sc = Object.assign(new Element(), {
    clientHeight: 900,
    scrollHeight: 5200,
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelector: () => turn,
    querySelectorAll: () => [turn],
  });
  const block = { style: {} };
  const turn = {
    dataset: { turnKey: 't' },
    style: {},
    parentElement: { getBoundingClientRect: () => ({ top: 0, bottom: 520 }) },
    matches: (s) => s.includes('complete'),
    closest: () => sc,
    querySelector: (s) =>
      s.includes('in_progress') ? null : s.includes('complete') ? {} : { getAttribute: () => 'm' },
    querySelectorAll: (s) => (s === '[data-math-source]' ? [] : [block]),
    __reactFiber$test: {
      memoizedProps: { entries: [{ turnKey: 't' }], RowComponent() {} },
      memoizedState: { memoizedState: { t: 520 } },
    },
  };
  const on = (name, fn) => (events[name] ||= []).push(fn);
  const document = {
    fonts: { addEventListener: on },
    scripts: [],
    documentElement: { className: 'light', hasAttribute: () => false },
    addEventListener: on,
    querySelectorAll: () => [sc],
  };
  const ctx = {
    document,
    location: { pathname: '/c/' + conv },
    innerWidth: 1600,
    devicePixelRatio: 1,
    Element,
    performance: { now: () => 1 },
    __butterLayoutCheck: layoutCheck,
    __butterSeekCore: seek,
    TextEncoder,
    crypto,
    queueMicrotask,
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval() {},
    requestAnimationFrame: () => 1,
    addEventListener: on,
    ResizeObserver: class {
      constructor(fn) {
        resizeObservers.push(fn);
      }
      observe() {}
      unobserve() {}
    },
    MutationObserver: class {
      observe() {}
    },
    getComputedStyle: () => ({ font: '16px system-ui' }),
  };
  const storage = require('./helpers/layout-fixture.cjs').attachStorage(ctx, events);
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = (name) =>
    vm.runInContext(
      fs.readFileSync(
        `${process.env.REVIEW_SOURCE || require('node:path').join(__dirname, '../extension')}/${name}.js`,
        'utf8',
      ),
      ctx,
    );
  load('seek/layout-cache-main');
  storage.account();
  return {
    ctx,
    sc,
    turn,
    block,
    disk: storage.worker.disk,
    load,
    resizeObservers,
    get prematureReads() {
      return prematureReads;
    },
    store: ctx.__butterLayoutCache,
    cache: ctx.__butterLayoutCache,
    event: (name, detail) => {
      for (const fn of events[name] || []) fn({ detail });
    },
    restore() {
      const bubble = Object.assign(new Element(), {
        firstElementChild: { classList: { contains: () => true } },
        closest: (s) => (s === '.thread-scroll-container' ? sc : {}),
      });
      restoring = true;
      void bubble.clientWidth;
      restoring = false;
    },
  };
}
test('S1 queued geometry keeps its measurement content and layout identity', async () => {
  for (const change of ['font', 'content']) {
    const f = fixture();
    await f.store.setTexts(conv, texts);
    f.store.record('t', record);
    if (change === 'font') f.ctx.getComputedStyle = () => ({ font: '18px system-ui' });
    else await f.store.setTexts(conv, { t: { ...texts.t, answer: 'edited answer' } });
    await f.store.flush();
    assert.equal(
      f.disk.size,
      0,
      `${change}: stale queued geometry must not be persisted under the new identity`,
    );
    assert.equal(Object.keys(f.store.records(f.sc)).length, 0);
  }
});
test('S2 adopted geometry is revalidated before preview reads and remount restore', async (t) => {
  for (const change of ['theme', 'font', 'digest', 'expiry'])
    for (const use of ['preview', 'restore']) {
      const f = fixture();
      await f.store.setTexts(conv, texts);
      f.store.record('t', record);
      await f.store.flush();
      f.cache.adopt(f.store.records(f.sc), f.sc);
      assert.ok(f.cache.get('t'));
      if (change === 'theme') f.ctx.document.documentElement.className = 'dark';
      if (change === 'font') f.ctx.getComputedStyle = () => ({ font: '18px system-ui' });
      if (change === 'digest')
        await f.store.setTexts(conv, { t: { ...texts.t, answer: 'edited answer' } });
      if (change === 'expiry') {
        const now = Date.now();
        t.mock.method(Date, 'now', () => now + layoutCheck.TTL + 1);
      }
      assert.equal(
        Object.keys(f.store.records(f.sc)).length,
        0,
        `${change}: storage must reject the record`,
      );
      if (use === 'preview')
        assert.equal(
          f.cache.get('t'),
          null,
          `${change}: preview must retire stale adopted geometry`,
        );
      else {
        f.restore();
        assert.equal(
          f.block.style.containIntrinsicSize,
          undefined,
          `${change}: stale block height must not be restored`,
        );
      }
      assert.equal(
        f.ctx.__heightCacheDump().entries.length,
        0,
        'Rejected adopted entries must be removed',
      );
      t.mock.restoreAll();
    }
});
test('S3 warm layouts prepare after write invalidation without fetched source', async () => {
  const f = fixture();
  // Expose the real preparation closure only in this VM; production has no extra API.
  const source = fs.readFileSync(
    `${process.env.REVIEW_SOURCE || require('node:path').join(__dirname, '../extension')}/seek/preview-main.js`,
    'utf8',
  );
  vm.runInContext(
    source.replace(/\}\)\(\);\s*$/, 'globalThis.prepareForTest = prepare;})();'),
    f.ctx,
  );
  await f.store.setTexts(conv, texts);
  f.store.record('t', record);
  await f.store.flush();
  f.event('butter-seek-data', { conv, before: false, j: { messages: [] } });
  await new Promise(setImmediate);
  f.event('butter-seek-write', { conv });
  // The document recorder runs after the send, even though the SSE answer is not fetched source.
  f.cache.adopt({ t: record }, f.sc);
  const prep = f.ctx.prepareForTest(f.sc);
  assert.ok(prep, 'Fresh warm layouts must prepare without another history GET');
  assert.equal(prep.layoutTurns, 1);
  assert.equal(prep.flat.find((x) => !x.estimate).it.text, 'answer');
  assert.equal(prep.storedTurns, 0);
  assert.equal(
    Object.keys(f.store.records(f.sc)).length,
    0,
    'Stored invalidation must remain intact',
  );
});

test('S5 stored heights install before the first native layout read in the clientWidth hook', async () => {
  const f = fixture();
  await f.store.setTexts(conv, texts);
  f.store.record('t', record);
  await f.store.flush();
  f.cache.adopt(f.store.records(f.sc), f.sc);
  f.restore();
  assert.equal(
    f.block.style.containIntrinsicSize,
    'auto 26px',
    'The fixture must exercise actual stored restoration',
  );
  assert.equal(
    f.prematureReads,
    0,
    'Validation must not read native clientWidth before heights are installed',
  );
});
test('the product render completes before publishing rail state for a known preview', () => {
  const f = fixture();
  f.ctx.NodeFilter = { SHOW_TEXT: 4 };
  f.ctx.document.createTreeWalker = () => {
    let first = true;
    return {
      nextNode() {
        if (!first) return null;
        first = false;
        return { data: 'visible answer' };
      },
    };
  };
  f.ctx.testLayer = { style: {} };
  f.ctx.testEst = { hidden: true };
  f.ctx.testFade = {};
  f.ctx.document.createRange = () => ({
    selectNodeContents() {},
    getClientRects: () => [{ width: 100, height: 20, top: 60, bottom: 80, left: 20, right: 120 }],
  });
  const source = fs.readFileSync(
    require('node:path').join(__dirname, '../extension/seek/preview-main.js'),
    'utf8',
  );
  vm.runInContext(
    source.replace(
      /\}\)\(\);\s*$/,
      'layer=testLayer;est=testEst;fade=testFade;globalThis.renderForTest=render;})();',
    ),
    f.ctx,
  );
  const item = {
    textContent: 'visible answer',
    getBoundingClientRect: () => ({ top: 52, bottom: 200 }),
    remove() {},
  };
  const model = [{ id: 't', index: 0, top: 0, h: 500, layout: true, items: [{ top: 52, h: 148 }] }];
  assert.doesNotThrow(() =>
    f.ctx.renderForTest(
      {
        prep: { model, flat: [{ turn: 0, index: 0, abs: 52, h: 148, it: model[0].items[0] }] },
        insetTop: 52,
        hostRect: { x: 0, y: 52, width: 500, height: 300 },
        rendered: new Map([[0, item]]),
      },
      0,
    ),
  );
});

test('S5 resize and font events retire the fingerprint without reading layout inside restore', async () => {
  for (const event of ['resize', 'loading', 'loadingdone']) {
    const f = fixture();
    await f.store.setTexts(conv, texts);
    f.store.record('t', record);
    await f.store.flush();
    f.cache.adopt(f.store.records(f.sc), f.sc);
    f.event(event);
    f.restore();
    assert.equal(
      f.block.style.containIntrinsicSize,
      undefined,
      event + ' must prevent stale restoration',
    );
    assert.equal(
      f.prematureReads,
      1,
      'Only the caller native width read is allowed after rejecting a stale record',
    );
  }
});
test('a nested math or answer box is not proof of ink when its text is clipped away', () => {
  const f = fixture(),
    textNode = { data: 'capped text' };
  f.ctx.NodeFilter = { SHOW_TEXT: 4 };
  f.ctx.testLayer = { style: {} };
  f.ctx.testEst = { hidden: true, style: {}, replaceChildren() {}, append() {} };
  f.ctx.testFade = {};
  f.ctx.document.createTreeWalker = () => {
    let first = true;
    return {
      nextNode() {
        if (!first) return null;
        first = false;
        return textNode;
      },
    };
  };
  f.ctx.document.createRange = () => ({
    selectNodeContents(n) {
      this.node = n;
    },
    getClientRects() {
      return this.node === textNode
        ? [{ width: 100, height: 20, top: -8000, bottom: -7980, left: 20, right: 120 }]
        : [{ width: 100, height: 10000, top: -8000, bottom: 2000, left: 20, right: 120 }];
    },
  });
  f.ctx.document.createElement = () => ({ append() {}, style: {} });
  f.ctx.document.createTextNode = (text) => ({ textContent: text });
  const source = fs.readFileSync(
    process.env.RENDER_SOURCE ||
      require('node:path').join(__dirname, '../extension/seek/preview-main.js'),
    'utf8',
  );
  vm.runInContext(
    source.replace(
      /\}\)\(\);\s*$/,
      'layer=testLayer;est=testEst;fade=testFade;globalThis.renderForTest=render;})();',
    ),
    f.ctx,
  );
  const item = {
    textContent: 'capped text',
    getBoundingClientRect: () => ({ top: -8000, bottom: 2000 }),
    remove() {},
  };
  const model = [
    {
      id: 't',
      index: 0,
      top: 0,
      h: 10000,
      layout: true,
      q: 'question',
      answer: 'source excerpt',
      items: [{ top: 0, h: 10000 }],
    },
  ];
  const a = {
    prep: { model, flat: [{ turn: 0, index: 0, abs: 0, h: 10000, it: model[0].items[0] }] },
    insetTop: 52,
    hostRect: { x: 0, y: 52, width: 500, height: 300 },
    rendered: new Map([[0, item]]),
  };
  f.ctx.renderForTest(a, 8000);
  assert.equal(
    a.textFallback,
    true,
    'Intersecting child element boxes must not hide the absence of visible text',
  );
});

test('S1 rendered column resize invalidates adopted geometry before restore', async () => {
  const f = fixture();
  let width = 768;
  const column = { getBoundingClientRect: () => ({ width }) };
  f.sc.querySelector = () => column;
  await f.store.setTexts(conv, texts);
  f.store.record('t', record);
  await f.store.flush();
  f.cache.adopt(f.store.records(f.sc), f.sc);
  const before = f.store.refreshLayout(f.sc);
  width = 600;
  for (const observer of f.resizeObservers) observer([{ target: column, contentRect: { width } }]);
  f.restore();
  assert.equal(
    f.block.style.containIntrinsicSize,
    undefined,
    'Column resize must reject adopted restore before another fingerprint read',
  );
  assert.notEqual(f.store.refreshLayout(f.sc), before, 'Only the rendered column changed');
  assert.equal(Object.keys(f.store.records(f.sc)).length, 0);
  assert.equal(JSON.parse(f.store.refreshLayout(f.sc)).column, 600);
  f.sc.querySelector = () => null;
  assert.equal(
    JSON.parse(f.store.refreshLayout(f.sc)).column,
    null,
    'An unavailable column must not guess a reusable rendered width',
  );
});

test('S3 fallback excerpts begin with visible text after leading blank lines', () => {
  const result = seek.previewExcerpt(
    { h: 1000, q: '', answer: '\n'.repeat(100) + 'visible text' },
    0,
  );
  assert.equal(result.text, 'visible text');
  assert.equal(
    seek.previewExcerpt(
      { h: 1000, q: '', answer: 'early text' + '\n'.repeat(10000) + 'tail text' },
      500,
    ).text,
    'tail text',
    'The whitespace-only selected slice must also trim its tail fallback',
  );
  assert.ok(seek.previewExcerpt({ h: 1000, q: '  ', answer: '\n'.repeat(3000) }, 0).text.trim());
});

test('S4 preparation and storage flush reuse one fingerprint per batch', async () => {
  const f = fixture();
  let styles = 0,
    scripts = 0;
  f.ctx.getComputedStyle = () => {
    styles++;
    return { font: '16px system-ui' };
  };
  Object.defineProperty(f.ctx.document, 'scripts', {
    get() {
      scripts++;
      return [];
    },
  });
  const rows = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['t' + i, texts.t]));
  await f.store.setTexts(conv, rows);
  for (const id of Object.keys(rows)) f.store.record(id, record);
  styles = scripts = 0;
  await f.store.flush();
  assert.equal(styles, 1, 'A storage flush computes its current identity once');
  assert.equal(scripts, 1);
  f.cache.adopt(Object.fromEntries(Object.keys(rows).map((id) => [id, record])), f.sc);
  styles = scripts = 0;
  for (const id of Object.keys(rows)) assert.ok(f.cache.get(id));
  assert.equal(styles, 0, 'Warm cache lookups do not need a stored-layout fingerprint');
  assert.equal(scripts, 0);
  f.load('seek/preview-main');
  const source = fs.readFileSync(
    require('node:path').join(
      process.env.REVIEW_SOURCE || require('node:path').join(__dirname, '../extension'),
      'seek/preview-main.js',
    ),
    'utf8',
  );
  vm.runInContext(
    source.replace(/\}\)\(\);\s*$/, 'globalThis.prepareForTest=prepare;})();'),
    f.ctx,
  );
  styles = scripts = 0;
  f.ctx.prepareForTest(f.sc);
  assert.equal(
    styles,
    1,
    'Preparation shares its fingerprint across cache lookups and stored reads',
  );
  assert.equal(scripts, 1);
});

test('WARM dispatch refreshes invalidated stored fingerprints before restore and precedes semantic work', async () => {
  for (const { stored, error = 0, unstable = false } of [
    { stored: false },
    { stored: true },
    { stored: true, error: 40 },
    { stored: true, error: 40, unstable: true },
  ]) {
    const f = fixture(),
      frames = [];
    let now = 0,
      dispatched = false,
      selections = 0,
      lookups = 0;
    if (stored) {
      await f.store.setTexts(conv, texts);
      f.store.record('t', record);
      await f.store.flush();
      f.cache.adopt(f.store.records(f.sc), f.sc);
      // During a long native hold, RO may retire an otherwise unchanged column fingerprint.
      for (const observer of f.resizeObservers)
        observer([{ target: f.sc, contentRect: { width: 1258 } }]);
    }
    Object.assign(f.ctx, {
      Event: class {},
      CustomEvent: class {},
      CSS: { escape: (x) => x },
      clearInterval() {},
      matchMedia: () => ({ matches: true }),
      requestAnimationFrame: (fn) => frames.push(fn),
      __butterAnchorVisibleNeedles: () => {
        assert.ok(dispatched, 'Anchor selection must follow destination dispatch');
        selections++;
        return [{ needle: 'visible text', y: 52 }];
      },
      __butterAnchorTextBoxes: () => {
        lookups++;
        return [{ top: 52 + error - (unstable ? 0 : f.sc.scrollTop - 100) }];
      },
      __butterAnchorVisibleSwap: () => ({ items: 0 }),
    });
    f.ctx.performance.now = () => now;
    let probeFacts = {};
    f.ctx.CustomEvent = class {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    };
    f.ctx.document.dispatchEvent = (e) => {
      if (e.type === 'butter-status-response') Object.assign(probeFacts, JSON.parse(e.detail));
    };
    f.sc.isConnected = true;
    f.sc.dispatchEvent = () => {
      dispatched = true;
      if (stored) {
        f.restore();
        assert.equal(
          f.block.style.containIntrinsicSize,
          'auto 26px',
          'Stored restore must survive fingerprint invalidation during a long hold',
        );
        assert.equal(
          f.prematureReads,
          0,
          'Refresh occurs before dispatch, never inside clientWidth restore',
        );
      }
    };
    f.sc.scrollTop = 100;
    f.turn.parentElement.getBoundingClientRect = () => ({ top: -16, bottom: 504 });
    const model = [
      {
        id: 't',
        index: 0,
        top: 84,
        h: 1000,
        litTop: 0,
        litH: 1000,
        known: true,
        layout: true,
        stored,
        items: [],
      },
    ];
    f.ctx.testActive = {
      sc: f.sc,
      conv,
      prep: { model, previewModel: [{ ...model[0], top: 0 }], flat: [], maxTop: 4300 },
      startTop: 0,
      lastTop: 100,
      previewTop: 16,
      insetTop: 52,
      hostRect: { x: 0, y: 52, width: 768, height: 500 },
      rendered: new Map([[0, {}]]),
    };
    f.ctx.testActive.prep.flat = [{ turn: 0 }];
    f.ctx.testEst = { hidden: true };
    const source = fs.readFileSync(
      require('node:path').join(
        process.env.REVIEW_SOURCE || require('node:path').join(__dirname, '../extension'),
        'seek/preview-main.js',
      ),
      'utf8',
    );
    vm.runInContext(
      source.replace(
        /\}\)\(\);\s*$/,
        'active=testActive;revealOwner=active;est=testEst;globalThis.finishForTest=finish;})();',
      ),
      f.ctx,
    );
    f.ctx.finishForTest('pointerup');
    for (let i = 0; frames.length && i < 20; i++) {
      now += 16;
      frames.shift()();
    }
    assert.ok(f.ctx.testActive.readable, 'Readiness still completes');
    f.event('butter-status-request');
    const status = require('../extension/shared/status.js');
    assert.equal(
      status.classify(probeFacts).seek,
      unstable ? 'fail' : 'ok',
      'A normal release engages seek only when its landing succeeds',
    );
    assert.equal(selections, 1, 'Warm and stored landings both select a visible anchor');
    assert.equal(
      lookups,
      unstable ? 4 : error ? 2 : 1,
      'Alignment or exhausted passes must stop repeated text/range traversal',
    );
    assert.equal(
      f.sc.scrollTop,
      100 + (unstable ? 3 * error : error),
      'The bounded correction keeps the same landing',
    );
  }
});
