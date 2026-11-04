// Node check of stream/throttle-main.js's rAF throttle with a fake clock.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function setup(smoothMs = 250, off = '') {
  let now = 10_000,
    nextId = 1;
  const frames = new Map(),
    timers = []; // performance.now() is never near 0 on a real page
  const win = {
    __butterConfig: { smoothMs },
    requestAnimationFrame(cb) {
      const id = nextId++;
      frames.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const ctx = vm.createContext({
    window: win,
    document: { documentElement: { getAttribute: () => off }, addEventListener() {} },
    location: { pathname: '/' },
    performance: { now: () => now },
    Symbol,
    Map,
    Number,
    Math,
    Function,
    setTimeout: (f, ms) => {
      const t = { f, at: now + ms, live: true };
      timers.push(t);
      return t;
    },
    clearTimeout: (t) => {
      if (t) t.live = false;
    },
  });
  vm.runInContext(
    fs.readFileSync(new URL('../extension/stream/throttle-main.js', import.meta.url), 'utf8'),
    ctx,
  );
  const tick = (ms) => {
    // advance time in 16ms frames, running timers and frames
    for (let end = now + ms; now < end; ) {
      now += 16;
      for (const t of timers)
        if (t.live && t.at <= now) {
          t.live = false;
          t.f();
        }
      const due = [...frames];
      frames.clear();
      for (const [, cb] of due) cb(now);
    }
  };
  return { win, tick, stats: () => win.__butterStats };
}

// A smoother instance shaped like ChatGPT's: re-arms only when this.frame is null.
function smoother(win) {
  const s = {
    frame: undefined,
    pubs: 0,
    publish() {
      this.pubs++;
    },
  };
  s.arm = function () {
    // Callback source is the contract under test; parentheses added by formatting change the match.
    // prettier-ignore
    if (this.frame == null) this.frame = win.requestAnimationFrame(() => { this.frame = void 0, this.publish(); });
  };
  return s;
}

{
  // throttles the exact smoother callback to ~1 per 250ms
  const { win, tick } = setup(250);
  const s = smoother(win);
  for (let i = 0; i < 60; i++) {
    s.arm();
    tick(16);
  } // ~1s of per-frame arming
  assert.ok(s.pubs >= 3 && s.pubs <= 5, `pubs=${s.pubs}`);
}
{
  // other callbacks pass straight through, including ones that merely mention publish
  const { win, tick } = setup(250);
  let n = 0;
  const store = {
    publish() {
      n++;
    },
  };
  for (let i = 0; i < 10; i++) {
    win.requestAnimationFrame(() => {
      n++;
    });
    win.requestAnimationFrame(() => store.publish());
    tick(16);
  }
  assert.equal(n, 20);
  assert.equal(win.__butterStats.smootherFrames, 0);
}
{
  // cancel before and after the throttle timer fires: callback never runs
  const { win, tick } = setup(250);
  const s = smoother(win);
  s.arm();
  tick(16);
  s.arm();
  const h = s.frame;
  tick(32);
  win.cancelAnimationFrame(h);
  tick(500);
  assert.equal(s.pubs, 1);
  // cancel while the throttle timer is pending (published 16ms ago, so the next must wait)
  s.frame = undefined;
  tick(600);
  s.arm();
  tick(16);
  s.frame = undefined;
  s.arm();
  const h2 = s.frame;
  tick(16);
  const before = s.pubs;
  win.cancelAnimationFrame(h2);
  tick(500);
  assert.equal(s.pubs, before);
}
{
  // handles come from the native allocator (positive, unique)
  const { win } = setup(250);
  const s = smoother(win);
  s.arm();
  const a = s.frame;
  const b = win.requestAnimationFrame(() => {});
  assert.ok(a > 0 && b > 0 && a !== b);
}
{
  // bad config falls back to 250ms; 0 disables
  assert.equal(setup('x').stats().smootherFrames, 0);
  const off = setup(0);
  assert.equal(off.stats(), undefined);
}

{
  // Item off: even the exact callback is sent to native rAF on every frame.
  const { win, tick } = setup(250, 'throttle');
  const s = smoother(win);
  for (let i = 0; i < 10; i++) {
    s.arm();
    tick(16);
  }
  assert.equal(s.pubs, 10);
  assert.equal(win.__butterStats.smootherFrames, 0);
}
console.log('raf throttle: all checks passed');
