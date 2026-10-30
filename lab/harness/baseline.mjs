// Baseline run: chat N turns in the "Test" project and record rendering/jank metrics per turn.
// Usage: node baseline.mjs <outDir> [chatUrl-to-resume]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import prompts from './prompts-baseline.mjs';

const OUT = path.resolve(process.argv[2] ?? `results/baseline-${new Date().toISOString().slice(0, 10)}`);
const RESUME_URL = process.argv[3];
const PROJECT_URL = process.env.PROJECT ?? (() => { throw new Error('set PROJECT=<url of a ChatGPT project page>'); })();
const LAST = Math.min(prompts.length, +process.env.MAX_TURNS || prompts.length);
const RELOAD_AT = new Set([5, 10, 15, LAST]);
const TURN_TIMEOUT = 8 * 60_000;
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? await ctx.newPage();
await page.bringToFront();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');

async function cdpMetrics() {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map(m => [m.name, m.value]));
}
const CDP_KEYS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount'];
const diff = (a, b) => Object.fromEntries(CDP_KEYS.map(k => [k, +(b[k] - a[k]).toFixed(4)]));

// In-page recorder: rAF frame intervals, long animation frames, slow events, key-to-frame latency.
const INSTRUMENT = () => {
  if (window.__lab) return;
  window.__lab = {
    start() {
      this.frames = []; this.loaf = []; this.events = []; this.keys = []; this.running = true;
      let last = performance.now();
      const loop = t => { if (!this.running) return; this.frames.push(+(t - last).toFixed(2)); last = t; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      this.po1 = new PerformanceObserver(l => { for (const e of l.getEntries()) this.loaf.push({
        t: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration),
        styleLayout: e.styleAndLayoutStart ? Math.round(e.startTime + e.duration - e.styleAndLayoutStart) : 0,
        scripts: e.scripts.slice(0, 3).map(s => ({ src: (s.sourceURL || '').split('/').pop().slice(0, 50), fn: s.sourceFunctionName, inv: s.invoker?.slice(0, 60), dur: Math.round(s.duration) })),
      }); });
      this.po1.observe({ type: 'long-animation-frame' });
      this.po2 = new PerformanceObserver(l => { for (const e of l.getEntries()) this.events.push({ name: e.name, dur: e.duration, delay: Math.round(e.processingStart - e.startTime) }); });
      this.po2.observe({ type: 'event', durationThreshold: 16 });
      this.onKey = e => { const t0 = e.timeStamp; requestAnimationFrame(() => setTimeout(() => this.keys.push(+(performance.now() - t0).toFixed(1)))); };
      addEventListener('keydown', this.onKey, true);
    },
    stop() {
      this.running = false; this.po1.disconnect(); this.po2.disconnect();
      removeEventListener('keydown', this.onKey, true);
      return { frames: this.frames, loaf: this.loaf, events: this.events, keys: this.keys };
    },
  };
};
async function recStart() { await page.evaluate(INSTRUMENT); await page.evaluate(() => window.__lab.start()); }
async function recStop() { return page.evaluate(() => window.__lab.stop()); }

function summarizeFrames(r, wallMs) {
  const f = r.frames.slice(1).sort((a, b) => a - b);
  const q = p => f.length ? f[Math.min(f.length - 1, Math.floor(p * f.length))] : null;
  return {
    frames: f.length, fps: f.length ? +(f.length / (wallMs / 1000)).toFixed(1) : 0,
    p50: q(0.5), p95: q(0.95), max: f.at(-1) ?? null,
    jankPct: f.length ? +(100 * f.filter(x => x > 50).length / f.length).toFixed(1) : 0,
    loafCount: r.loaf.length, loafBlockMs: r.loaf.reduce((s, e) => s + e.block, 0),
    loafMaxMs: Math.max(0, ...r.loaf.map(e => e.dur)),
    slowEvents: r.events.length, keyP50: r.keys.length ? r.keys.sort((a, b) => a - b)[Math.floor(r.keys.length / 2)] : null,
    keyMax: r.keys.length ? Math.max(...r.keys) : null,
  };
}

const DOM_STATS = () => {
  const sc = document.querySelector('.thread-scroll-container');
  const turns = document.querySelectorAll('[data-turn-key]');
  const last = turns[turns.length - 1];
  return {
    nodes: document.getElementsByTagName('*').length,
    katex: document.querySelectorAll('.katex').length,
    mathBlocks: document.querySelectorAll('[data-math-source]').length,
    turns: turns.length,
    virtualized: document.querySelectorAll('[data-virtualized-turn-content]').length,
    scrollHeight: sc?.scrollHeight ?? 0,
    lastTurnNodes: last ? last.getElementsByTagName('*').length : 0,
    lastTag: +(last?.innerText.match(/\[t(\d+)\]/)?.[1] ?? 0),   // ChatGPT unmounts far-away turns, so the turn count isn't reliable
    lastAnswerChars: last?.querySelector('[data-markdown-text-style="assistant-message"]')?.innerText.length ?? 0,
    states: [...document.querySelectorAll('[data-talvt-turn-state]')].map(e => e.dataset.talvtTurnState),
    stopBtn: !!document.querySelector('button[aria-label*="Stop" i], button[data-testid="stop-button"]'),
    url: location.pathname,
  };
};
const domStats = () => page.evaluate(DOM_STATS);

async function heap() {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  return Math.round((await cdpMetrics()).JSHeapUsedSize / 1e6 * 10) / 10;
}

async function scrollerBox() {
  await page.locator('.thread-scroll-container').first().waitFor({ timeout: 30_000 });
  return page.evaluate(() => { const r = document.querySelector('.thread-scroll-container').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
}

async function idleScrollTest() {
  const box = await scrollerBox();
  await page.mouse.move(box.x, box.y);
  const m0 = await cdpMetrics(); await recStart(); const t0 = Date.now();
  const wheelMs = [];
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 80; i++) {
      const w0 = Date.now(); await page.mouse.wheel(0, dir * 600); wheelMs.push(Date.now() - w0);
      await sleep(40);
      const top = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); return [s.scrollTop, s.scrollHeight - s.clientHeight]; });
      if ((dir < 0 && top[0] <= 0) || (dir > 0 && top[0] >= top[1] - 2)) break;
    }
  }
  const wall = Date.now() - t0; const r = await recStop(); const m1 = await cdpMetrics();
  return { wallMs: wall, ...summarizeFrames(r, wall), wheelAckP95: wheelMs.sort((a, b) => a - b)[Math.floor(wheelMs.length * 0.95)], cdp: diff(m0, m1), topLoaf: r.loaf.sort((a, b) => b.dur - a.dur).slice(0, 3) };
}

async function sendAndStream(i, prompt) {
  const ed = page.locator('.ProseMirror').first();
  await ed.click();
  const before = await domStats();
  const m0 = await cdpMetrics(); await recStart();
  await page.keyboard.type(`[t${String(i + 1).padStart(2, '0')}] `, { delay: 60 });   // real key events for input latency
  await page.keyboard.insertText(prompt);
  await sleep(300);
  await page.keyboard.press('Enter');
  const t0 = Date.now(); let tFirst = null, tDone = null; const timeline = []; const stateSeen = new Set();
  const box = await scrollerBox(); await page.mouse.move(box.x, box.y);
  let wheelDir = -1, lastWheel = 0, stableSince = null; const wheelMs = [];
  while (Date.now() - t0 < TURN_TIMEOUT) {
    const s = await domStats();
    s.states.forEach(x => stateSeen.add(x));
    const t = Date.now() - t0;
    const mine = s.lastTag === i + 1;
    if (mine && s.lastAnswerChars > 0 && tFirst === null) tFirst = t;
    if (timeline.length === 0 || t - timeline.at(-1).t >= 1000) timeline.push({ t, nodes: s.nodes, chars: s.lastAnswerChars, katex: s.katex });
    // Simulate the user scrolling while the answer streams: a small up/down wheel burst every ~1.5s.
    if (tFirst !== null && t - lastWheel > 1500) {
      for (let k = 0; k < 3; k++) { const w0 = Date.now(); await page.mouse.wheel(0, wheelDir * 250); wheelMs.push(Date.now() - w0); await sleep(30); }
      wheelDir = -wheelDir; lastWheel = t;
    }
    const done = mine && s.lastAnswerChars > 0 && !s.stopBtn && s.states.at(-1) === 'complete';
    if (done) { stableSince ??= Date.now(); if (Date.now() - stableSince > 2500) { tDone = stableSince - t0; break; } }
    else stableSince = null;
    await sleep(250);
  }
  const wall = Date.now() - t0; const r = await recStop(); const m1 = await cdpMetrics();
  const cd = diff(m0, m1);
  return {
    ttftMs: tFirst, totalMs: tDone, timedOut: tDone === null, states: [...stateSeen],
    stream: { wallMs: wall, ...summarizeFrames(r, wall), wheelAckP95: wheelMs.sort((a, b) => a - b)[Math.floor(wheelMs.length * 0.95)] ?? null,
      mainThreadBusyPct: +(100 * cd.TaskDuration / (wall / 1000)).toFixed(1), cdp: cd, topLoaf: r.loaf.sort((a, b) => b.dur - a.dur).slice(0, 5) },
    timeline,
  };
}

async function reloadTest(expectedTurns) {
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  let tTurns = null, tMath = null;
  while (Date.now() - t0 < 60_000) {
    const s = await page.evaluate(DOM_STATS).catch(() => null);
    if (s && s.lastTag >= expectedTurns && tTurns === null) tTurns = Date.now() - t0;
    if (s && s.lastTag >= expectedTurns && s.lastAnswerChars > 0 && s.katex > 0) { tMath = Date.now() - t0; break; }
    await sleep(100);
  }
  await sleep(3000);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const loaf = performance.getEntriesByType('long-animation-frame');
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd),
      loafBlockMs: loaf.reduce((s, e) => s + e.blockingDuration, 0), loafCount: loaf.length, loafMaxMs: Math.round(Math.max(0, ...loaf.map(e => e.duration))) };
  });
  return { allTurnsMs: tTurns, lastAnswerMathMs: tMath, ...nav, heapMB: await heap(), dom: await domStats() };
}

// ---- main ----
const runMeta = { started: new Date().toISOString(), browser: browser.version(), viewport: page.viewportSize(), prompts: prompts.length };
let start = 0;
if (process.env.FINAL_ONLY) {   // reload + idle scroll on an existing chat, then exit
  await page.goto(RESUME_URL); await sleep(8000);
  const turns = (await domStats()).lastTag;
  const reload = await reloadTest(turns);
  log(`final (${turns} turns): reload allTurns=${reload.allTurnsMs}ms math=${reload.lastAnswerMathMs}ms loafBlock=${reload.loafBlockMs}ms heap=${reload.heapMB}MB`);
  const idle = await idleScrollTest();
  log(`final: idle scroll fps=${idle.fps} p95=${idle.p95} loafBlock=${idle.loafBlockMs}ms`);
  save('final.json', { turns, reload, idle });
  await browser.close(); process.exit(0);
}
if (RESUME_URL) {
  await page.goto(RESUME_URL); await sleep(5000);
  start = (await domStats()).lastTag; log('resuming at turn', start + 1);
} else {
  await page.goto(PROJECT_URL); await page.locator('.ProseMirror').first().waitFor(); await sleep(2000);
}
save('meta.json', runMeta);

for (let i = start; i < LAST; i++) {
  log(`turn ${i + 1}/${LAST}: sending`);
  const res = await sendAndStream(i, prompts[i]);
  await sleep(1500);
  const dom = await domStats(); const heapMB = await heap();
  log(`turn ${i + 1}: ttft=${res.ttftMs}ms total=${res.totalMs}ms nodes=${dom.nodes} katex=${dom.katex} heap=${heapMB}MB stream fps=${res.stream.fps} p95=${res.stream.p95} busy=${res.stream.mainThreadBusyPct}% virt=${dom.virtualized}`);
  if (res.timedOut) log(`turn ${i + 1}: TIMED OUT, states=${res.states}`);
  const idle = await idleScrollTest();
  log(`turn ${i + 1}: idle scroll fps=${idle.fps} p95=${idle.p95} loafBlock=${idle.loafBlockMs}ms`);
  let reload = null;
  if (RELOAD_AT.has(i + 1)) { reload = await reloadTest(i + 1); log(`turn ${i + 1}: reload allTurns=${reload.allTurnsMs}ms math=${reload.lastAnswerMathMs}ms loafBlock=${reload.loafBlockMs}ms`); }
  if (i === 0) { runMeta.chatUrl = page.url(); save('meta.json', runMeta); log('chat url', page.url()); }
  save(`turn-${String(i + 1).padStart(2, '0')}.json`, { turn: i + 1, prompt: prompts[i], ...res, dom, heapMB, idle, reload });
  await page.screenshot({ path: path.join(OUT, `turn-${String(i + 1).padStart(2, '0')}.png`) });
  if (res.timedOut) break;
}
runMeta.finished = new Date().toISOString(); save('meta.json', runMeta);
log('done', OUT);
await browser.close();
