// A seek release towards a question whose position Butter only estimates (2026-11-18 live features,
// item 6: math12's questions 6 and 7 left the chat about 31k px inside the previous answer and timed
// out after 10 s). preview-main.js's commit and readiness wait run over a fake virtualizer that
// mounts the turns within OVERSCAN px of the view. The real turns are HEIGHTS tall; Butter's frozen
// model is off by a long answer above or below the target, so its destination lies inside another
// turn and the target does not mount there: the commit must find it from the mounted turns.
// REVIEW_SOURCE=<an extension/ tree> runs it on that tree's seek scripts.
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const tree = process.env.REVIEW_SOURCE || path.join(__dirname, '../extension');
// A REVIEW_SOURCE tree from before preview-main.js's split lacks its factory scripts: those come from
// this repo's extension/ then.
const read = (f) =>
  fs.readFileSync(
    fs.existsSync(`${tree}/${f}`) ? `${tree}/${f}` : path.join(__dirname, '../extension', f),
    'utf8',
  );
const conv = '00000000-0000-0000-0000-000000000000';
const HEIGHTS = [2000, 3000, 2500, 4000, 3000, 40000, 12000, 30000],
  TOPS = HEIGHTS.map((_, i) => HEIGHTS.slice(0, i).reduce((a, b) => a + b, 0)),
  CLIENT = 900,
  OVERSCAN = 300,
  INSET = 52,
  BUBBLE = 20, // the question's bubble below its turn's top
  SCROLL_HEIGHT = TOPS.at(-1) + HEIGHTS.at(-1);

// `model`: the frozen model's turn heights. Releases with question `target` at the view's top,
// `offset` px into it, and runs frames until the chat is readable (or 2000 frames). Returns the
// session and where the view's top is: which real turn, and how far into it. `layout`: the target
// has a stored layout, so the destination keeps that offset. `parent`: each turn's parentElement:
// 'own' (its row), 'contents' (a 0-height rect, as `display: contents`) or 'shared' (one
// full-height wrapper for all turns). `suppress`: turns that never mount.
function release({ model, target, offset = 100, layout = false, parent = 'own', suppress = [] }) {
  const frames = [],
    ids = HEIGHTS.map((_, i) => `q${i}`);
  let now = 0,
    top = 0;
  const total = () => SCROLL_HEIGHT;
  const rect = (i) => {
    if (parent === 'contents') return { top: 0, bottom: 0, height: 0 };
    if (parent === 'shared') return { top: -top, bottom: total() - top, height: total() };
    return { top: TOPS[i] - top, bottom: TOPS[i] + HEIGHTS[i] - top, height: HEIGHTS[i] };
  };
  const shared = { getBoundingClientRect: () => rect(0), querySelectorAll: () => mounted() };
  const turns = ids.map((id, i) => {
    const turn = {
      dataset: { turnKey: id },
      getAttribute: () => id,
      querySelectorAll: () => [],
      querySelector: (s) =>
        s === '[data-user-message-bubble]'
          ? { getBoundingClientRect: () => ({ top: TOPS[i] + BUBBLE - top }) }
          : null,
    };
    turn.parentElement =
      parent === 'shared'
        ? shared
        : { getBoundingClientRect: () => rect(i), querySelectorAll: () => [turn] };
    return turn;
  });
  function mounted() {
    return turns.filter(
      (_, i) =>
        !suppress.includes(i) &&
        TOPS[i] + HEIGHTS[i] > top - OVERSCAN &&
        TOPS[i] < top + CLIENT + OVERSCAN,
    );
  }
  const sc = {
    get scrollTop() {
      return top;
    },
    set scrollTop(v) {
      top = Math.max(0, Math.min(total() - CLIENT, v));
    },
    clientHeight: CLIENT,
    get scrollHeight() {
      return total();
    },
    isConnected: true,
    dispatchEvent() {},
    getBoundingClientRect: () => ({ top: 0 }),
    querySelectorAll: (s) => (s === '[data-turn-key]' ? mounted() : []),
    querySelector: (s) => mounted().find((t) => s.includes(`"${t.dataset.turnKey}"`)) || null,
  };
  const ctx = vm.createContext({
    document: {
      addEventListener() {},
      dispatchEvent() {},
      querySelectorAll: () => [],
      documentElement: { hasAttribute: () => false, getAttribute: () => null },
    },
    location: { pathname: '/c/' + conv },
    performance: { now: () => now },
    requestAnimationFrame: (fn) => frames.push(fn),
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    addEventListener() {},
    matchMedia: () => ({ matches: true }),
    Event: class {},
    CustomEvent: class {
      constructor(type, o = {}) {
        this.type = type;
        this.detail = o.detail;
      }
    },
    CSS: { escape: (x) => x },
    __butterPageReader: {},
    __butterAnchorVisibleSwap: () => ({ items: 0 }),
    __butterAnchorVisibleNeedles: () => [],
    __butterAnchorTextBoxes: () => [],
  });
  ctx.window = ctx;
  for (const f of [
    'seek/core-main.js',
    'seek/layout-check-main.js',
    'seek/preview-texts-main.js',
    'seek/landing-main.js',
    'seek/seek-diagnostics-main.js',
  ])
    vm.runInContext(read(f), ctx, { filename: f });
  const rows = model.map((h, i) => ({
    id: ids[i],
    index: i,
    top: model.slice(0, i).reduce((a, b) => a + b, 0),
    h,
    known: false,
    layout: layout && i === target,
    items: layout && i === target ? [] : null,
  }));
  const lastTop = rows[target].top + offset - INSET;
  top = lastTop;
  ctx.testActive = {
    sc,
    conv,
    prep: {
      model: rows,
      previewModel: rows,
      flat: [{ turn: target }],
      maxTop: SCROLL_HEIGHT - CLIENT,
      gap: 0,
    },
    startTop: lastTop - 60000,
    lastTop,
    insetTop: INSET,
    hostRect: { x: 0, y: INSET, width: 768, height: 500 },
    rendered: new Map([[0, {}]]),
  };
  ctx.testEst = { hidden: true };
  vm.runInContext(
    read('seek/preview-main.js').replace(
      /\}\)\(\);\s*$/,
      'active=testActive;revealOwner=active;est=testEst;globalThis.finishForTest=finish;})();',
    ),
    ctx,
    { filename: 'seek/preview-main.js' },
  );
  ctx.finishForTest('pointerup');
  const a = ctx.testActive;
  for (let i = 0; frames.length && i < 2000 && a.readable == null; i++) {
    now += 16;
    frames.shift()();
  }
  const at = top + INSET,
    turn = TOPS.findLastIndex((x) => x <= at);
  const landed = {
    turn,
    offset: at - TOPS[turn],
    top,
    ms: a.readable - a.end,
    timedOut: a.timedOut,
    finds: a.finds.length,
  };
  console.log('landed', JSON.stringify(landed), 'finds', JSON.stringify(a.finds));
  return landed;
}

test('a release to an estimated question finds its turn when the destination falls in a long answer above it', () => {
  // The model gives question 5 a fifth of its real 40000 px, so question 6's estimate is 32000 px
  // short: inside question 5, where only question 5 mounts.
  const landed = release({ model: [2000, 3000, 2500, 4000, 3000, 8000, 3000, 30000], target: 6 });
  assert.equal(landed.timedOut, false);
  assert.equal(landed.turn, 6);
  assert.ok(Math.abs(landed.offset - BUBBLE) <= 4, `question 6's bubble at the view's top`);
  assert.ok(landed.ms < 3000, `readable in ${landed.ms} ms`);
});

test('a release to an estimated question finds its turn when the destination falls in a long answer below it', () => {
  // The model overestimates question 4 by 40000 px, so question 6's estimate lands inside question
  // 7, below it, where only question 7 mounts.
  const landed = release({ model: [2000, 3000, 2500, 4000, 43000, 40000, 3000, 30000], target: 6 });
  assert.equal(landed.timedOut, false);
  assert.equal(landed.turn, 6);
  assert.ok(Math.abs(landed.offset - BUBBLE) <= 4, `question 6's bubble at the view's top`);
  assert.ok(landed.ms < 3000, `readable in ${landed.ms} ms`);
});

// #134: a destination with a stored layout keeps its offset into the turn and is not searched for,
// as before the search existed. The model is 32000 px short, as above, so the commit lands in
// question 5 and question 6 never mounts there: the release waits for the 10 s give-up.
test('a release to a stored-layout destination that does not mount does not search', () => {
  const landed = release({
    model: [2000, 3000, 2500, 4000, 3000, 8000, 12000, 30000],
    target: 6,
    offset: 10000,
    layout: true,
  });
  assert.equal(landed.finds, 0);
  assert.equal(landed.timedOut, true);
  assert.equal(landed.top, 32448, 'at the commit');
});

test('a release whose destination question mounts where the model put it does not search', () => {
  const landed = release({ model: HEIGHTS, target: 6 });
  assert.equal(landed.timedOut, false);
  assert.equal(landed.turn, 6);
});

// Review L9: a turn's parentElement is used as its row only when it is one: a `display: contents`
// wrapper (0-height rect) or one wrapper around several turns gives no row, so there is no search
// and the release stays where the commit left it, as before the search existed.
test('a release does not search from a turn whose parent has a 0-height rect', () => {
  const landed = release({
    model: [2000, 3000, 2500, 4000, 3000, 8000, 3000, 30000],
    target: 6,
    parent: 'contents',
  });
  assert.equal(landed.finds, 0);
  assert.equal(landed.top, 22448, 'at the commit');
});

test('a release does not search from turns that share one full-height parent', () => {
  // The commit lands at 14000 px, where questions 4 and 5 are both mounted.
  const landed = release({
    model: [2000, 3000, 2500, 4000, 2000, 552, 3000, 30000],
    target: 6,
    parent: 'shared',
  });
  assert.equal(landed.finds, 0);
  assert.equal(landed.top, 14000, 'at the commit');
});

// Review L11: when the target never mounts, the release times out where the commit left it, not at
// the last search position.
test('a release whose found turn never mounts ends at the commit position', () => {
  const landed = release({
    model: [2000, 3000, 2500, 4000, 3000, 8000, 3000, 30000],
    target: 6,
    suppress: [6],
  });
  assert.equal(landed.timedOut, true);
  assert.ok(landed.finds > 0, 'it searched');
  assert.equal(landed.top, 22448, 'at the commit');
});

// Review N3: a search whose answer is not a number (a model with no top for the turn after the
// last mounted one) moves nowhere.
test('the release search ignores a search answer that is not a number', () => {
  const { finder } = require(`${tree}/seek/layout-check-main.js`);
  const find = finder({ limit: 4 }),
    look = () => ({
      index: 1,
      mounted: [{ index: 0, top: 0, bottom: 1000 }],
      tops: [0],
      offset: -52,
      maxScroll: 1e6,
    });
  for (let t = 0; t <= 2000; t += 16) assert.equal(find(t, 0, look), null, `at ${t} ms`);
});

// layoutCheck.finder's timing rule, directly: a search is due once scrollTop has stayed put for 5
// unmounted frames and 250 ms; a scrollTop change, a frame with the target mounted (scrollTop NaN)
// or a search starts the stillness over; at most `limit` searches; findTurn's input is read only
// when one is due.
test('the release search waits 5 still frames and 250 ms, restarts on a scroll, and stops at its limit', () => {
  const { finder } = require(`${tree}/seek/layout-check-main.js`);
  let reads = 0;
  // Turn 0 mounted; the target, turn 1, starts after it; the destination's offset is -52 (an
  // estimated question below the header): findTurn says 1000 - 52.
  const look = () => {
    reads++;
    return {
      index: 1,
      mounted: [{ index: 0, top: 0, bottom: 1000 }],
      tops: [0, 500],
      offset: -52,
      maxScroll: 1e6,
    };
  };
  const find = finder({ limit: 4 });
  // Frames 16 ms apart: the 5th still frame comes at 80 ms, too early; the first due one at 256 ms.
  const run = (top, from, to) => {
    const out = [];
    for (let t = from; t <= to; t += 16) out.push([t, find(t, top, look)]);
    return out;
  };
  const first = run(0, 0, 256);
  assert.equal(reads, 1, 'findTurn read once, when due');
  assert.deepEqual(
    first.filter(([, to]) => to != null),
    [[256, 948]],
  );
  // The same position again: still, so the next search is due 5 frames and 250 ms later.
  assert.equal(find(272, 0, look), null, 'a search starts the stillness over');
  // A scroll restarts it: nothing until 250 ms after the new position.
  assert.equal(find(288, 10, look), null);
  const after = run(10, 304, 600).filter(([, to]) => to != null);
  assert.equal(after[0][0], 544, 'due 256 ms after the scroll, the first frame past 250 ms');
  // At most 4 searches that move.
  let n = 2;
  for (let t = 600, top = 20; t < 5000; t += 16) if (find(t, top, look) != null) n++;
  assert.equal(n, 4);
  // A search whose answer is where the chat already is does not count and moves nowhere.
  const here = finder({ limit: 1 });
  for (let t = 0; t <= 300; t += 16) assert.equal(here(t, 948, look), null);
  let moved = null;
  for (let t = 300; t <= 700 && moved == null; t += 16) moved = here(t, 100, look);
  assert.equal(moved, 948, 'still allowed its one search');
  // Review L2: a frame with the target mounted (NaN) starts the stillness over, even at the same
  // scrollTop: still from 0 ms, mounted at 112 ms, so due 250 ms after 128 ms (384), not at 256.
  const gap = finder({ limit: 1 }),
    due = [];
  for (let t = 0; t <= 600; t += 16) if (gap(t, t === 112 ? NaN : 0, look) != null) due.push(t);
  assert.deepEqual(due, [384]);
});
