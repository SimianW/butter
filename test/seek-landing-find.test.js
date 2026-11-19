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
const read = (f) => fs.readFileSync(`${tree}/${f}`, 'utf8');
const conv = '00000000-0000-0000-0000-000000000000';
const HEIGHTS = [2000, 3000, 2500, 4000, 3000, 40000, 3000, 30000],
  TOPS = HEIGHTS.map((_, i) => HEIGHTS.slice(0, i).reduce((a, b) => a + b, 0)),
  CLIENT = 900,
  OVERSCAN = 300,
  INSET = 52,
  BUBBLE = 20, // the question's bubble below its turn's top
  SCROLL_HEIGHT = TOPS.at(-1) + HEIGHTS.at(-1);

// `model`: the frozen model's turn heights. Releases with question `target` at the view's top and
// runs frames until the chat is readable (or 2000 frames). Returns the session and where the view's
// top is: which real turn, and how far into it.
function release({ model, target }) {
  const frames = [],
    ids = HEIGHTS.map((_, i) => `q${i}`);
  let now = 0,
    top = 0;
  const turns = ids.map((id, i) => ({
    dataset: { turnKey: id },
    getAttribute: () => id,
    querySelectorAll: () => [],
    querySelector: (s) =>
      s === '[data-user-message-bubble]'
        ? { getBoundingClientRect: () => ({ top: TOPS[i] + BUBBLE - top }) }
        : null,
    parentElement: {
      getBoundingClientRect: () => ({
        top: TOPS[i] - top,
        bottom: TOPS[i] + HEIGHTS[i] - top,
        height: HEIGHTS[i],
      }),
    },
  }));
  const mounted = () =>
    turns.filter(
      (_, i) => TOPS[i] + HEIGHTS[i] > top - OVERSCAN && TOPS[i] < top + CLIENT + OVERSCAN,
    );
  const sc = {
    get scrollTop() {
      return top;
    },
    set scrollTop(v) {
      top = Math.max(0, Math.min(SCROLL_HEIGHT - CLIENT, v));
    },
    clientHeight: CLIENT,
    scrollHeight: SCROLL_HEIGHT,
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
  });
  ctx.window = ctx;
  for (const f of ['seek/core-main.js', 'seek/layout-check-main.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  const rows = model.map((h, i) => ({
    id: ids[i],
    index: i,
    top: model.slice(0, i).reduce((a, b) => a + b, 0),
    h,
    known: false,
    layout: false,
    items: null,
  }));
  const lastTop = rows[target].top + 100 - INSET;
  top = lastTop;
  ctx.testActive = {
    sc,
    conv,
    prep: { model: rows, previewModel: rows, flat: [], maxTop: SCROLL_HEIGHT - CLIENT, gap: 0 },
    startTop: lastTop - 60000,
    lastTop,
    insetTop: INSET,
    hostRect: { x: 0, y: INSET, width: 768, height: 500 },
    rendered: new Map(),
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
    turn = TOPS.findLastIndex((t) => t <= at);
  const landed = { turn, offset: at - TOPS[turn], ms: a.readable - a.end, timedOut: a.timedOut };
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

test('a release whose destination question mounts where the model put it does not search', () => {
  const landed = release({ model: HEIGHTS, target: 6 });
  assert.equal(landed.timedOut, false);
  assert.equal(landed.turn, 6);
});
