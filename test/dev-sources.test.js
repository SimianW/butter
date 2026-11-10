// dev/sources.js: the bug file's turns and usage, read from planted page state (a fake DOM, cache,
// seek core and counters), through the real recorder and its privacy filter.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/seek/core-main.js');
const { createRecorder, serialize } = require('../extension/dev/recorder.js');
const { collect } = require('../extension/dev/sources.js');
const { el, getComputedStyle, reads } = require('./helpers/fake-dom.cjs');

const QUESTION = 'Why does the integral of x squared from zero to one equal one third?',
  ANSWER = 'Because the antiderivative is x cubed over three.',
  TEX = '\\int_0^1 x^2\\,dx = \\tfrac13',
  CONV = '6a1f0c2e-8b7d-4c3e-9f10-2d4b6a8c0e12',
  MESSAGE = 'b2c4d6e8-1a3c-4e5f-8a9b-0c1d2e3f4a5b',
  URL = `https://chatgpt.com/c/${CONV}`;
const KEYS = ['turn-key-alpha', 'turn-key-beta', 'turn-key-gamma'];

// Three turns: the first two mounted (the second holds math, one formula not yet typeset), the
// third only in the virtualizer. Records for the first two carry text, as real records do.
function page({ fiber = true, mutate = () => {} } = {}) {
  const turn = (i, extra = []) =>
    el(
      'article',
      {
        attrs: { 'data-turn-key': KEYS[i], 'data-testid': `conversation-turn-${i + 1}` },
        rect: { top: 100 + i * 600, height: 560 },
      },
      [
        el('div', {
          attrs: { 'data-user-message-bubble': '' },
          text: QUESTION,
          rect: { top: 110 + i * 600, height: 40 },
        }),
        el(
          'div',
          {
            attrs: { 'data-markdown-text-style': 'assistant-message', 'data-message-id': MESSAGE },
            classes: ['markdown', 'prose', `w-[${CONV}]`],
          },
          [
            el('p', { text: ANSWER, rect: { top: 160 + i * 600, height: 52 } }),
            el('a', { attrs: { href: URL }, text: URL }),
            ...extra,
          ],
        ),
      ],
    );
  const katex = el('span', { classes: ['katex'] }, [
    el('span', { classes: ['katex-mathml'] }, [
      el('math', {}, [el('semantics', {}, [el('mrow')])]),
    ]),
    el('span', { classes: ['katex-html'], attrs: { 'aria-hidden': 'true' } }),
  ]);
  const typeset = el('div', { attrs: { 'data-math-source': TEX }, classes: ['katex-display'] }, [
    katex,
  ]);
  const raw = el('div', { attrs: { 'data-math-source': TEX }, text: TEX });
  const turns = [turn(0), turn(1, [typeset, raw])];
  const rows = turns.map((t, i) => el('div', { rect: { top: 90 + i * 600, height: 580 } }, [t]));
  const sc = el(
    'div',
    {
      classes: ['thread-scroll-container'],
      clientWidth: 900,
      props: { clientHeight: 800, scrollHeight: 2400 },
    },
    [el('div', {}, rows)],
  );
  if (fiber)
    turns[0]['__reactFiber$abc'] = {
      memoizedProps: {},
      return: {
        memoizedProps: { entries: KEYS.map((turnKey) => ({ turnKey })), RowComponent() {} },
        memoizedState: {
          memoizedState: { other: 1 },
          next: { memoizedState: { [KEYS[0]]: 580, [KEYS[1]]: 580, [KEYS[2]]: 640 }, next: null },
        },
      },
    };
  const item = (top, h, text, extra = {}) => ({
    top,
    h,
    left: 0,
    w: 768,
    text,
    math: [],
    ...extra,
  });
  const records = {
    [KEYS[0]]: {
      conv: CONV,
      msg: MESSAGE,
      ready: true,
      h: 560,
      rowH: 580,
      turnOffset: 10,
      turnH: 560,
      w: 900,
      vw: 1280,
      sw: 900,
      recordedAt: 1_000,
      records: 2,
      blocks: [52],
      items: [item(10, 40, QUESTION, { user: true }), item(60, 52, ANSWER)],
    },
    [KEYS[1]]: {
      conv: CONV,
      msg: MESSAGE,
      ready: true,
      fromStorage: true,
      h: 560,
      rowH: 600,
      sw: 900,
      blocks: [52, 80],
      items: [
        item(10, 40, QUESTION, { user: true }),
        item(60, 80, TEX, { math: [{ start: 0, end: 27, display: true, h: 60 }] }),
      ],
    },
  };
  const S = {
    observed: 2,
    records: 5,
    refreshes: 1,
    rejected: { 'math-pending': 3 },
    recordMs: 12.345,
    recordMax: 4.5,
    restored: 1,
    blocksRestored: 2,
    restoreMisses: { 'not-removed': 9 },
    hooks: 40,
    parked: 0,
    released: 0,
    hits: [{ key: KEYS[0], t: 5 }],
  };
  const shadow = el('div', {}, [
    el('div', { classes: ['est'], props: { hidden: true } }),
    el('div', { classes: ['it'], text: ANSWER, style: { top: '160px' }, rect: { height: 52 } }),
    el('div', {
      classes: ['it', 'math', 'display'],
      text: TEX,
      style: { top: '220px' },
      rect: { height: 60 },
    }),
  ]);
  const document = el('html', {}, [el('body', {}, [sc])]);
  const env = {
    document,
    getComputedStyle,
    now: 5_000,
    core,
    seeking: () => true,
    lastSeek: { turn: 1, offset: 40, layout: true, known: true, textFallback: false },
    previewRoot: () => shadow,
    cache: {
      get: (key) => records[key] ?? null,
      diagnostics: (t) => ({
        observed: true,
        generating: false,
        queued: t.dataset.turnKey === KEYS[1],
        measuring: false,
        attempted: true,
        lastRejection: t.dataset.turnKey === KEYS[1] ? 'math-pending' : null,
      }),
      dump: () => ({
        ready: true,
        loads: 1,
        hits: 1,
        writes: 3,
        bytes: 4096,
        rejected: {},
        errors: 0,
        entries: 2,
        pending: 0,
      }),
    },
    heightCache: () => ({ stats: { ...S, hits: S.hits.slice() } }),
  };
  mutate(env, { records, S, sc, turns, shadow });
  return env;
}
const snapshot = (sources) =>
  createRecorder().snapshot({
    now: 5_000,
    date: new Date(2026, 10, 8, 21, 14, 3),
    bug: 1,
    round: 1,
    version: '0.1.0-alpha.15+dev.1',
    trigger: 'shortcut',
    sources,
  });

test('turns and usage carry the documented fields from planted page state', () => {
  const snap = snapshot(collect(page()));
  const { order, active, readiness, math } = snap.turns;
  assert.deepEqual(order, {
    count: 3,
    mounted: 2,
    fiberFound: true,
    idsFromFallback: false,
    idsReason: null,
  });

  assert.equal(readiness.rejectionDiagnosticsAvailable, true);
  assert.equal(readiness.currentSw, 900);
  assert.equal(readiness.turns.length, 3);
  assert.deepEqual(readiness.turns[0], {
    index: 0,
    mounted: true,
    hasRecord: true,
    items: 2,
    blocks: 1,
    recorder: {
      observed: true,
      generating: false,
      queued: false,
      measuring: false,
      attempted: true,
      lastRejection: null,
    },
    recordValidation: null,
    rowH: 580,
    measuredHeight: 580,
    rowHeightNow: 580,
    rowHeightDelta: 0,
    sw: 900,
    fromStorage: false,
    layout: true,
    layoutReason: null,
  });
  assert.equal(readiness.turns[1].recorder.lastRejection, 'math-pending');
  assert.equal(readiness.turns[1].fromStorage, true);
  assert.deepEqual(
    { ...readiness.turns[2], recorder: undefined },
    {
      index: 2,
      mounted: false,
      hasRecord: false,
      items: 0,
      blocks: 0,
      recorder: undefined,
      recordValidation: null,
      rowH: null,
      measuredHeight: 640,
      rowHeightNow: null,
      rowHeightDelta: null,
      sw: null,
      fromStorage: false,
      layout: false,
      layoutReason: 'no-record',
    },
  );
  assert.equal(readiness.turns[2].recorder, null);

  assert.equal(active.turnIndex, 1);
  assert.equal(active.selection, 'active-preview-update');
  assert.deepEqual(
    { ...active.preview, renderedItems: active.preview.renderedItems.length },
    {
      active: true,
      updateTurnIndex: 1,
      offset: 40,
      layout: true,
      known: true,
      textFallback: false,
      estimateVisible: false,
      renderedItems: 2,
    },
  );
  assert.deepEqual(active.preview.renderedItems[1], {
    classes: ['it', 'math', 'display'],
    height: 60,
    top: 220,
    textLength: TEX.length,
    flags: { tallerThan300: false, zeroTextLength: false, textLengthUnavailable: false },
  });
  assert.equal(active.memory.source, 'restored');
  assert.equal(active.memory.fromStorage, true);
  assert.deepEqual(active.memory.blockHeights, [52, 80]);
  assert.deepEqual(
    active.memory.items.map((it) => [it.kind, it.textLength, it.math.length]),
    [
      ['user', QUESTION.length, 0],
      ['display-math', TEX.length, 1],
    ],
  );
  assert.equal(active.dom.mounted, true);
  assert.equal(active.dom.itemCount, 5); // bubble, p, a, typeset formula, raw formula
  const root = active.dom.turn[0];
  assert.deepEqual(root.dataAttributeNames, ['data-turn-key', 'data-testid']);
  assert.equal(root.tag, 'article');
  assert.equal(root.parent, null);
  assert.equal(root.height, 560);
  const column = active.dom.turn.find((n) =>
    n.dataAttributeNames?.includes('data-markdown-text-style'),
  );
  assert.deepEqual(column.classes, ['markdown', 'prose']);
  assert.equal(column.classCount, 3);
  // The KaTeX subtree is one node with a count, not dozens of spans.
  const formula = active.dom.turn.find((n) => n.classes.includes('katex'));
  assert.equal(formula.collapsed, 5);
  assert.equal(
    active.dom.turn.some((n) => n.tag === 'semantics'),
    false,
  );

  assert.deepEqual(math, [
    {
      index: 0,
      formulas: 0,
      withoutKatex: 0,
      katexError: 0,
      mathmlOnly: 0,
      partsNoRoot: 0,
      rawText: 0,
      empty: 0,
      other: 0,
      missingInsideCvBlock: 0,
      displayMissing: 0,
    },
    {
      index: 1,
      formulas: 2,
      withoutKatex: 1,
      katexError: 0,
      mathmlOnly: 0,
      partsNoRoot: 0,
      rawText: 1,
      empty: 0,
      other: 0,
      missingInsideCvBlock: 0,
      displayMissing: 1,
    },
  ]);

  assert.deepEqual(snap.usage.store, {
    ready: true,
    loads: 1,
    hits: 1,
    writes: 3,
    bytes: 4096,
    errors: 0,
    entries: 2,
    pending: 0,
    rejected: [],
  });
  assert.deepEqual(snap.usage.cache, {
    observed: 2,
    records: 5,
    refreshes: 1,
    restored: 1,
    blocksRestored: 2,
    recordMs: 12.3,
    recordMax: 4.5,
    hooks: 40,
    parked: 0,
    released: 0,
    adopted: 0,
    approx: 0,
    rejected: [{ reason: 'math-pending', count: 3 }],
    restoreMisses: [{ reason: 'not-removed', count: 9 }],
  });
  assert.equal(snap.redacted, 0);
});

test('no question or answer text, TeX, IDs or URLs from the page reach the file', () => {
  const env = page({
    mutate: (env, { S }) => {
      // Values the sources pass through to the filter: a planted string in each is dropped and counted.
      const diagnostics = env.cache.diagnostics;
      env.cache.diagnostics = (t) => ({ ...diagnostics(t), lastRejection: QUESTION });
      S.rejected[URL] = 2;
      S.restoreMisses[MESSAGE] = 1;
      const dump = env.cache.dump;
      env.cache.dump = () => ({ ...dump(), rejected: { [TEX]: 1 } });
    },
  });
  const snap = snapshot(collect(env));
  const text = serialize(snap);
  for (const planted of [QUESTION, ANSWER, TEX, CONV, MESSAGE, URL, 'chatgpt.com', ...KEYS])
    assert.ok(!text.includes(planted), `leaks ${planted}`);
  // Two mounted lastRejection texts, the URL, message ID and TeX reasons.
  assert.equal(snap.redacted, 5);
  assert.deepEqual(snap.usage.cache.rejected, [{ reason: 'math-pending', count: 3 }, { count: 2 }]);
  assert.equal(snap.turns.readiness.turns[0].recorder.lastRejection, undefined);
});

test("Butter's memory is copied before the first layout or style read", () => {
  const calls = [];
  const env = page({
    mutate: (env) => {
      const { get, diagnostics, dump } = env.cache;
      env.cache.get = (key) => (calls.push(['memory', reads.length]), get(key));
      env.cache.diagnostics = (t) => (calls.push(['memory', reads.length]), diagnostics(t));
      env.cache.dump = () => (calls.push(['memory', reads.length]), dump());
      const heightCache = env.heightCache;
      env.heightCache = () => (calls.push(['memory', reads.length]), heightCache());
    },
  });
  reads.length = 0;
  const sources = collect(env);
  assert.equal(reads.length, 0, `read before the memory copy: ${JSON.stringify(reads)}`);
  assert.equal(calls.length, 3 + 2 + 2); // three records, two mounted turns, two counter dumps
  snapshot(sources);
  assert.ok(reads.length > 0);
  assert.deepEqual(calls.slice(7), [], 'no memory read after the DOM reads began');
});

test('a failing part of turns or usage becomes unavailable and the rest still saves', () => {
  const cases = {
    'readiness: the seek model throws': [
      (env) =>
        (env.core = {
          ...core,
          buildModel: () => {
            throw new Error(QUESTION);
          },
        }),
      ['turns', 'readiness'],
    ],
    'readiness: recorder status throws': [
      (env) =>
        (env.cache.diagnostics = () => {
          throw new Error();
        }),
      ['turns', 'readiness'],
    ],
    'active: the preview root throws': [
      (env) =>
        (env.previewRoot = () => {
          throw new Error();
        }),
      ['turns', 'active'],
    ],
    'math: a formula query throws': [
      (env, { turns }) => {
        for (const t of turns)
          t.querySelectorAll = (s) => {
            if (s === '[data-math-source]') throw new Error();
            return Object.getPrototypeOf(t).querySelectorAll.call(t, s);
          };
      },
      ['turns', 'math'],
    ],
    'store: the store counters throw': [
      (env) =>
        (env.cache.dump = () => {
          throw new Error(URL);
        }),
      ['usage', 'store'],
    ],
    'cache: the height-cache counters throw': [
      (env) =>
        (env.heightCache = () => {
          throw new Error();
        }),
      ['usage', 'cache'],
    ],
  };
  for (const [name, [mutate, [group, part]]] of Object.entries(cases)) {
    const snap = snapshot(collect(page({ mutate: (env, refs) => mutate(env, refs) })));
    assert.deepEqual(snap[group][part], { unavailable: 'error' }, name);
    for (const other of ['order', 'active', 'readiness', 'math'])
      if (other !== part)
        assert.equal(snap.turns[other].unavailable, undefined, `${name}: turns.${other}`);
    for (const other of ['store', 'cache'])
      if (other !== part)
        assert.equal(snap.usage[other].unavailable, undefined, `${name}: usage.${other}`);
    assert.doesNotMatch(serialize(snap), /chatgpt|integral/, name);
  }
});

test('without the virtualizer, turn order is the mounted turns, flagged ids-from-dom', () => {
  const snap = snapshot(collect(page({ fiber: false })));
  assert.deepEqual(snap.turns.order, {
    count: 2,
    mounted: 2,
    fiberFound: false,
    idsFromFallback: true,
    idsReason: 'ids-from-dom',
  });
  assert.equal(snap.turns.readiness.turns.length, 2);
  assert.equal(snap.turns.active.turnIndex, 1);
});

test('no visible conversation scroller: turns parts say so, usage still saves', () => {
  const env = page();
  env.document = el('html', {}, [el('body')]);
  const snap = snapshot(collect(env));
  for (const part of ['order', 'active', 'readiness', 'math'])
    assert.deepEqual(snap.turns[part], { unavailable: 'no-scroller' }, part);
  assert.equal(snap.usage.store.ready, true);
});

test('no seek yet: the active part says none and reads no turn', () => {
  const env = page();
  env.lastSeek = null;
  env.seeking = () => false;
  assert.deepEqual(snapshot(collect(env)).turns.active, { turnIndex: null, selection: 'none' });
  env.lastSeek = { turn: 0, offset: 0, layout: true, known: true, textFallback: false };
  const active = snapshot(collect(env)).turns.active;
  assert.equal(active.selection, 'last-seek-update');
  assert.equal(active.preview.active, false);
  assert.equal(active.memory.source, 'measured');
  assert.equal(active.memory.recordedAt, -4_000);
});

test('a huge turn structure stops at the node cap and says it was truncated', () => {
  const env = page({
    mutate: (env, { turns }) => {
      const md = turns[1].children[1];
      for (let i = 0; i < 3_000; i++) md.append(el('p', { text: ANSWER }));
    },
  });
  const { dom } = snapshot(collect(env)).turns.active;
  assert.equal(dom.truncated, true);
  assert.equal(dom.turn.length, 1_000);
  assert.equal(dom.itemCount, 3_005);
});
