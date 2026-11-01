// Deterministic streaming benchmark: replay a recorded SSE answer into a long chat and measure jank.
// Usage: node bench.mjs <variant> [reps=2]
//   EXT=/abs/ext1,/abs/ext2   load unpacked extensions (restarts the lab browser)
//   TRACE=1                   also capture a 12s Chrome trace with invalidation tracking + selector stats
//   REC=recordings/t09.json   recording to replay;  CHAT=<url> chat to replay into
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2] ?? 'baseline';
const reps = +(process.argv[3] ?? 2);
const REC_FILE = process.env.REC ?? 'recordings/t09.json';
const CHAT = process.env.CHAT ?? (() => { throw new Error('set CHAT=<url of a long ChatGPT chat>'); })();
const OUT = path.resolve('results/bench', variant); fs.mkdirSync(OUT, { recursive: true });
const GAP_CAP = 1500;   // compress the model's long "thinking" pauses; keep real inter-chunk timing otherwise
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), `[${variant}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- recording -> replay schedule ----
const rec = JSON.parse(fs.readFileSync(REC_FILE));
const s = rec.streams.find(x => /\/f\/conversation/.test(x.url));
const reqBody = JSON.parse(s.reqBody);
const schedule = []; let t = 300, prev = s.chunks[0][0];
for (const [ct, txt] of s.chunks) { t += Math.min(GAP_CAP, ct - prev); prev = ct; schedule.push([Math.round(t), txt]); }
const REPLAY = { inputId: reqBody.messages[0].id, convId: reqBody.conversation_id, schedule };

// ---- browser ----
if (process.env.EXT !== undefined) {
  execFileSync(process.env.LAB_BIN ?? new URL('../lab', import.meta.url).pathname, ['restart-browser'], { env: { ...process.env, LAB_EXTENSIONS: process.env.EXT }, stdio: 'inherit' });
  for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
  await sleep(3000);
}
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? ctx.pages()[0] ?? await ctx.newPage();
await page.bringToFront();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');

await page.addInitScript(R => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const st = window.__replay = { done: false, started: 0, chunksSent: 0 };
  const of = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'POST' && /\/backend-api\/f\/conversation(\?|$)/.test(url) && !st.started) {
      const body = JSON.parse(init.body);
      const map = new Map([[R.inputId, body.messages[0].id]]);
      const remap = txt => txt.replace(UUID, u => u === R.convId ? u : (map.has(u) ? map.get(u) : (map.set(u, crypto.randomUUID()), map.get(u))));
      st.started = performance.now();
      const enc = new TextEncoder();
      const stream = new ReadableStream({ async start(c) {
        const t0 = performance.now();
        for (const [at, txt] of R.schedule) {
          const wait = at - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
          c.enqueue(enc.encode(remap(txt))); st.chunksSent++;
        }
        c.close(); st.done = true; st.endedAt = performance.now();
      } });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
    }
    return of.apply(this, arguments);
  };
}, REPLAY);

// ---- in-page recorder (same as baseline.mjs) ----
const INSTRUMENT = () => {
  window.__lab = {
    start() {
      this.frames = []; this.loaf = []; this.keys = []; this.running = true;
      let last = performance.now();
      const loop = t => { if (!this.running) return; this.frames.push(+(t - last).toFixed(2)); last = t; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      // attr: where long-frame time goes. renderSL = style+layout in the frame's rendering phase;
      // forced[k] = style+layout forced synchronously by script k; script[k] = script time of k.
      this.attr = { renderSL: 0, renderOther: 0, forced: {}, script: {} };
      const A = this.attr;
      this.po = new PerformanceObserver(l => { for (const e of l.getEntries()) {
        this.loaf.push({ t: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration),
          scripts: e.scripts.slice(0, 3).map(x => ({ src: (x.sourceURL || '').split('/').pop().slice(0, 50), fn: x.sourceFunctionName, inv: x.invoker?.slice(0, 60), dur: Math.round(x.duration), forced: Math.round(x.forcedStyleAndLayoutDuration) })) });
        const end = e.startTime + e.duration;
        if (e.styleAndLayoutStart) A.renderSL += end - e.styleAndLayoutStart;
        if (e.renderStart) A.renderOther += (e.styleAndLayoutStart || end) - e.renderStart;
        for (const x of e.scripts) {
          const k = `${x.invokerType}|${(x.invoker || '').slice(0, 50)}|${(x.sourceURL || '').split('/').pop().slice(0, 30)}:${x.sourceFunctionName || '?'}@${x.sourceCharPosition}`;
          A.forced[k] = (A.forced[k] || 0) + x.forcedStyleAndLayoutDuration;
          A.script[k] = (A.script[k] || 0) + x.duration - x.forcedStyleAndLayoutDuration;
        }
      } });
      this.po.observe({ type: 'long-animation-frame' });
      this.onKey = e => { const t0 = e.timeStamp; requestAnimationFrame(() => setTimeout(() => this.keys.push(+(performance.now() - t0).toFixed(1)))); };
      addEventListener('keydown', this.onKey, true);
      // Big subtree insertions/removals (remounts) inside the thread.
      this.remounts = []; const t0 = performance.now();
      const size = n => n.nodeType === 1 ? 1 + n.getElementsByTagName('*').length : 0;
      this.mo = new MutationObserver(recs => {
        let add = 0, rem = 0, where = '';
        for (const r of recs) { for (const n of r.addedNodes) add += size(n); for (const n of r.removedNodes) rem += size(n);
          if (!where && (r.addedNodes.length || r.removedNodes.length)) where = `${r.target.tagName}.${String(r.target.className).slice(0, 60)}|${r.target.closest?.('[data-turn-key]') ? 'in-turn' : 'outside'}`; }
        if (add + rem > 1500) this.remounts.push({ t: Math.round(performance.now() - t0), add, rem, where });
      });
      this.mo.observe(document.querySelector('.thread-scroll-container') || document.body, { childList: true, subtree: true });
      this.seenMarks = 0; this.blockAdds = 0;
      this.mo2 = new MutationObserver(recs => { for (const r of recs) {
        if (r.type === 'attributes') this.seenMarks++;
        else for (const n of r.addedNodes) if (n.nodeType === 1 && n.parentElement?.matches('[data-markdown-text-style="assistant-message"]')) this.blockAdds++; } });
      this.mo2.observe(document.querySelector('.thread-scroll-container') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-butter-seen'] });
    },
    stop() { this.running = false; this.po.disconnect(); removeEventListener('keydown', this.onKey, true); this.mo.disconnect(); this.mo2.disconnect(); return { seenMarks: this.seenMarks, blockAdds: this.blockAdds, frames: this.frames, loaf: this.loaf, keys: this.keys, attr: this.attr, remounts: this.remounts }; },
  };
};
const CDP_KEYS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount'];
async function metrics() { const { metrics } = await cdp.send('Performance.getMetrics'); return Object.fromEntries(metrics.map(m => [m.name, m.value])); }
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null; };
const DOM = () => ({ nodes: document.getElementsByTagName('*').length, turns: document.querySelectorAll('[data-turn-key]').length, katex: document.querySelectorAll('.katex').length });

async function startTrace() {
  const heavy = process.env.TRACE === 'heavy' ? ['disabled-by-default-devtools.timeline.invalidationTracking', 'blink.debug', 'disabled-by-default-blink.debug'] : [];
  await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: [
    'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute',
    'disabled-by-default-devtools.timeline.frame', ...(process.env.TRACE === 'stack' ? [] : ['disabled-by-default-v8.cpu_profiler']), ...heavy] } });
}
async function stopTrace(file) {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); const { stream } = await done;
  const out = fs.createWriteStream(file);
  for (;;) { const { data, eof, base64Encoded } = await cdp.send('IO.read', { handle: stream, size: 1 << 20 }); out.write(base64Encoded ? Buffer.from(data, 'base64') : data); if (eof) break; }
  out.end(); await cdp.send('IO.close', { handle: stream });
}

async function runOnce(rep) {
  await page.goto(CHAT); await page.locator('.ProseMirror').first().waitFor({ timeout: 60_000 }); await sleep(8000);
  const sc = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); s.scrollTop = s.scrollHeight; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await sleep(1500);
  const before = await page.evaluate(DOM);
  await page.locator('.ProseMirror').first().click();
  await page.keyboard.insertText(`[r${rep}] replay benchmark`);
  await page.evaluate(INSTRUMENT); await page.evaluate(() => window.__lab.start());
  const m0 = await metrics(); const t0 = Date.now();
  await page.keyboard.press('Enter');
  await page.mouse.move(sc.x, sc.y);
  let lastWheel = 0, dir = -1, typed = 0, tracing = false, probed = false; const wheelMs = [];
  const total = REPLAY.schedule.at(-1)[0];
  for (;;) {
    const st = await page.evaluate(() => window.__replay);
    const el = Date.now() - t0;
    if (st.done && el > total) break;
    if (el > total + 60_000) { log('replay did not finish', st); break; }
    if (process.env.TRACE && rep === 1 && !tracing && el > +(process.env.TRACE_AT ?? 45_000)) { await startTrace(); tracing = 'on'; tracing = Date.now(); }
    if (tracing && tracing !== true && Date.now() - tracing > +(process.env.TRACE_LEN ?? 12_000)) { await stopTrace(path.join(OUT, 'trace.json')); tracing = true; log('trace saved'); }
    if (st.started && el - lastWheel > 1500) {
      for (let k = 0; k < 3; k++) { const w0 = Date.now(); await page.mouse.wheel(0, dir * 250); wheelMs.push(Date.now() - w0); await sleep(30); }
      dir = -dir; lastWheel = el;
    }
    // Type into the composer mid-stream, like drafting the next question.
    if (st.started && typed < 2 && el > (typed + 1) * total / 3) {
      await page.locator('.ProseMirror').first().click({ timeout: 10_000 }).catch(() => {});
      await page.keyboard.type('abcdefghij', { delay: 120 });
      for (let k = 0; k < 10; k++) await page.keyboard.press('Backspace');
      await page.mouse.move(sc.x, sc.y); typed++;
    }
    // PROBE=1: snapshot running animations mid-stream (they force a style recalc every frame).
    if (process.env.PROBE && !probed && el > total / 2) {
      probed = true;
      const anims = await page.evaluate(() => document.getAnimations().map(a => {
        const t = a.effect?.target; const kf = a.effect?.getKeyframes?.() ?? [];
        return { type: a.constructor.name, name: a.animationName || a.transitionProperty || a.id, state: a.playState,
          props: [...new Set(kf.flatMap(k => Object.keys(k).filter(p => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))].join(','),
          target: t ? `${t.tagName}.${String(t.className).slice(0, 90)}` : null, pseudo: a.effect?.pseudoElement ?? null,
          descendants: t ? t.getElementsByTagName('*').length : 0 };
      }));
      fs.writeFileSync(path.join(OUT, 'animations.json'), JSON.stringify(anims, null, 1));
      log(`probe: ${anims.length} running animations`);
    }
    await sleep(250);
  }
  await sleep(3000);
  // Correctness: the fully streamed answer must match across variants.
  const answer = await page.evaluate(async () => {
    const roots = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
    const txt = roots.at(-1)?.textContent ?? '';   // innerText drops content-visibility-skipped blocks
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return { chars: txt.length, katex: roots.at(-1)?.querySelectorAll('.katex').length ?? 0, sha: [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('') };
  });
  const wall = Date.now() - t0; const r = await page.evaluate(() => window.__lab.stop()); const m1 = await metrics();
  const d = Object.fromEntries(CDP_KEYS.map(k => [k, +(m1[k] - m0[k]).toFixed(3)]));
  const f = r.frames.slice(1);
  const res = {
    variant, rep, wallMs: wall, answer, before, after: await page.evaluate(DOM), chunksSent: (await page.evaluate(() => window.__replay)).chunksSent, butter: await page.evaluate(() => window.__butterStats ?? null),
    fps: +(f.length / (wall / 1000)).toFixed(1), p50: q(f, 0.5), p95: q(f, 0.95), maxFrame: Math.max(...f), jankPct: +(100 * f.filter(x => x > 50).length / f.length).toFixed(1),
    loafBlockMs: r.loaf.reduce((a, e) => a + e.block, 0), loafMaxMs: Math.max(0, ...r.loaf.map(e => e.dur)), loafCount: r.loaf.length,
    keyP50: q(r.keys, 0.5), keyP95: q(r.keys, 0.95), keyMax: Math.max(0, ...r.keys), wheelP95: q(wheelMs, 0.95),
    busyPct: +(100 * d.TaskDuration / (wall / 1000)).toFixed(1),
    stylePct: +(100 * d.RecalcStyleDuration / (wall / 1000)).toFixed(1), scriptPct: +(100 * d.ScriptDuration / (wall / 1000)).toFixed(1), layoutPct: +(100 * d.LayoutDuration / (wall / 1000)).toFixed(1),
    remounts: r.remounts, seenMarks: r.seenMarks, blockAdds: r.blockAdds, cdp: d, topLoaf: r.loaf.sort((a, b) => b.dur - a.dur).slice(0, 5),
    attr: { renderSLs: +(r.attr.renderSL / 1000).toFixed(1), renderOthers: +(r.attr.renderOther / 1000).toFixed(1),
      forcedSLs: +(Object.values(r.attr.forced).reduce((a, b) => a + b, 0) / 1000).toFixed(1), scripts: +(Object.values(r.attr.script).reduce((a, b) => a + b, 0) / 1000).toFixed(1),
      topForced: Object.entries(r.attr.forced).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [Math.round(v), k]),
      topScript: Object.entries(r.attr.script).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [Math.round(v), k]) },
  };
  fs.writeFileSync(path.join(OUT, `rep-${rep}.json`), JSON.stringify(res, null, 1));
  await page.screenshot({ path: path.join(OUT, `rep-${rep}.png`) });
  log(`rep ${rep}: fps=${res.fps} p95=${res.p95} jank=${res.jankPct}% busy=${res.busyPct}% style=${res.stylePct}% blocked=${(res.loafBlockMs / 1000).toFixed(1)}s maxFreeze=${res.loafMaxMs} keyP95=${res.keyP95} keyMax=${res.keyMax} wheelP95=${res.wheelP95} LoAF[renderSL=${res.attr.renderSLs}s forcedSL=${res.attr.forcedSLs}s script=${res.attr.scripts}s] answer=${res.answer.chars}c/${res.answer.katex}k/${res.answer.sha} remounts=${res.remounts.length} blockAdds=${res.blockAdds} seenMarks=${res.seenMarks} butter=${JSON.stringify(res.butter)} nodes=${res.after.nodes} turns=${res.after.turns} chunks=${res.chunksSent}/${REPLAY.schedule.length}`);
  return res;
}

log(`replaying ${REPLAY.schedule.length} chunks over ${(REPLAY.schedule.at(-1)[0] / 1000).toFixed(0)}s, ${reps} reps`);
for (let i = 1; i <= reps; i++) await runOnce(i);
await browser.close();
