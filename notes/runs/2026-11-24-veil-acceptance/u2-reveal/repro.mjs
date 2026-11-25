// Headless repro of stage C2's u2 finding: a scrollTop write onto held, veiled blocks in the middle
// of a long just-completed answer, with Butter's real stream/containment.css and stream/offscreen.js
// against the same sources with the veil cut out. Prints, per run, the frames from the write until
// no blank block is under the view (6 points down the view at each frame start: B blank, - drawn,
// . no block), and with --trace the main thread's style/layout/paint/script work from the write to
// the clear frame. The page carries a generated stylesheet of `--rules` rules, so style work per
// element is closer to chatgpt.com's than a bare page's.
// Usage: node notes/runs/2026-11-24-veil-acceptance/u2-reveal/repro.mjs [--runs N] [--trace]
//          [--variants real,noveil] [--blocks 612] [--spans 12] [--rules 3000] [--list]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? dflt : process.argv[i + 1];
};
const RUNS = Number(arg('runs', 3));
const TRACE = process.argv.includes('--trace');
const LIST = process.argv.includes('--list');
const BLOCKS = Number(arg('blocks', 612));
const SPANS = Number(arg('spans', 12));
const RULES = Number(arg('rules', 3000));
const ext = (f) => readFileSync(`${root}extension/${f}`, 'utf8');
const swap = (s, a, b, what) => {
  const out = s.replace(a, b);
  if (out === s) throw new Error(`variant: ${what} not found`);
  return out;
};
const JS = ext('stream/offscreen.js'),
  CSS = ext('stream/containment.css');
const ALT = process.env.ALT_JS ? readFileSync(process.env.ALT_JS, 'utf8') : null;
const ALT_CSS = process.env.ALT_CSS ? readFileSync(process.env.ALT_CSS, 'utf8') : CSS;
export const VARIANTS = {
  real: () => ({ js: JS, css: CSS }),
  // The veil cut out: the marker never sets the attribute (head's behaviour).
  noveil: () => ({ js: swap(JS, "el.setAttribute(VEIL, '');", ';', 'the veil set'), css: CSS }),
  // Veiled as usual, but no data-butter-unveiled set on unveil (no transition guard frame).
  noguard: () => ({
    js: swap(
      JS,
      /el\.setAttribute\(UNVEILED, ''\);\n\s*unveiled\.add\(el\);\n\s*if \(unveiled\.size === 1\) requestAnimationFrame\(settle\);/,
      '',
      'the transition guard',
    ),
    css: CSS,
  }),
  // Veiled as usual, but the opacity rule never applies (attribute churn without opacity 0).
  noopacity: () => ({ js: JS, css: swap(CSS, 'opacity: 0;', 'opacity: 1;', 'the veil rule') }),
  // Veiled as usual, but the rule sets a paint-only property instead of opacity 0.
  veilcolor: () => ({ js: JS, css: swap(CSS, 'opacity: 0;', 'color: red;', 'the veil rule') }),
  // Veiled as usual, but opacity 0.5 instead of 0.
  veilhalf: () => ({ js: JS, css: swap(CSS, 'opacity: 0;', 'opacity: 0.5;', 'the veil rule') }),
  // Every block under the auto rules is a stacking context by style (isolation), so the veil's
  // opacity change no longer toggles that.
  isolate: () => ({
    js: JS,
    css: swap(CSS, 'content-visibility: auto;', 'content-visibility: auto;\n  isolation: isolate;', 'the auto rule'),
  }),
  // The same, on the cut-out build: what isolation costs by itself.
  isolatenoveil: () => ({
    js: VARIANTS.noveil().js,
    css: swap(CSS, 'content-visibility: auto;', 'content-visibility: auto;\n  isolation: isolate;', 'the auto rule'),
  }),
  alt: () => ({ js: ALT, css: ALT_CSS }),
};
const pick = arg('variants', 'real,noveil').split(',');

/* global document, requestAnimationFrame, performance, getComputedStyle, setTimeout, console -- in the page */
function build({ blocks, spans, rules }) {
  // A generated stylesheet: utility classes, and descendant rules under the answer column.
  const css = [];
  for (let i = 0; i < rules; i++) {
    css.push(`.u${i} { margin-left: ${i % 7}px }`);
    if (i % 3 === 0) css.push(`.markdown .k${i % 97} .m${i} { padding-top: ${i % 3}px }`);
    if (i % 5 === 0) css.push(`[data-x${i % 50}] .v${i} { color: rgb(${i % 255} 0 0) }`);
  }
  const katex = (i) =>
    `<span class="katex u${i * 7} k${i % 97}"><span class="katex-html"><span class="base"><span class="strut"></span><span class="mord mathnormal">x</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist"><span class="sizing">${i}</span></span></span></span></span></span></span></span>`;
  const p = (i) =>
    `<p class="u${i % 400}">Block ${i}: ${Array.from({ length: spans }, (_, k) => `w${k} ${katex(k)}`).join(' ')}.</p>`;
  document.body.innerHTML = `<style>
      body { margin: 0; font: 16px/24px sans-serif } p { margin: 0 0 12px }
      .thread-scroll-container { height: 700px; overflow: auto; width: 768px }
      .katex { font-size: 1.1em } .vlist { display: inline-block; vertical-align: -0.2em }
      ${css.join('\n')}
    </style>
    <div class="thread-scroll-container"><div>
      <article data-turn-key="q0" id="answer"><div data-talvt-turn-state="in_progress">
        <div data-message-author-role="user"><div data-user-message-bubble>Question</div></div>
        <div data-message-author-role="assistant">
          <div class="MarkdownRoot-rZKhxa markdown" data-markdown-text-style="assistant-message"></div>
        </div>
      </div></article>
    </div></div>`;
  const md = document.querySelector('[data-markdown-text-style]');
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  return (async () => {
    for (let i = 0; i < blocks; i++) {
      md.insertAdjacentHTML('beforeend', p(i));
      if (i % 6 === 5) await frame();
    }
    await frame();
  })();
}

function complete() {
  document
    .querySelector('[data-talvt-turn-state="in_progress"]')
    .setAttribute('data-talvt-turn-state', 'complete');
}

function state() {
  const b = [...document.querySelectorAll('[data-markdown-text-style] > *')];
  return {
    blocks: b.length,
    nodes: document.querySelectorAll('*').length,
    held: b.filter((x) => x.hasAttribute('data-butter-unrendered')).length,
    veiled: b.filter((x) => x.hasAttribute('data-butter-veil')).length,
    seen: b.filter((x) => x.hasAttribute('data-butter-seen')).length,
  };
}

// The write puts block `index` 40 px above the view's centre; then every frame start samples 6
// points down the view, until a frame with no blank point.
function jump({ index }) {
  const sc = document.querySelector('.thread-scroll-container');
  const all = document.querySelectorAll('[data-markdown-text-style] > *');
  const box = sc.getBoundingClientRect();
  const target = all[index];
  const flags = `held=${target.hasAttribute('data-butter-unrendered')} veil=${target.hasAttribute('data-butter-veil')}`;
  const h0 = sc.scrollHeight;
  return new Promise((resolve) => {
    const frames = [];
    let t0;
    const tick = (ts) => {
      let s = '';
      for (let k = 1; k <= 6; k++) {
        const el = document.elementFromPoint(box.left + 100, box.top + (box.height * k) / 7);
        const b = el?.closest('[data-markdown-text-style] > *');
        if (!b) s += '.';
        else
          s +=
            !b.firstElementChild.checkVisibility({ contentVisibilityAuto: true }) ||
            getComputedStyle(b).opacity === '0'
              ? 'B'
              : '-';
      }
      frames.push({ t: +(ts - t0).toFixed(1), points: s, h: sc.scrollHeight });
      if ((!s.includes('B') && frames.length > 1) || frames.length >= 40) {
        console.timeStamp('u2-clear');
        const clear = performance.now() - t0;
        return setTimeout(() => resolve({ flags, h0, frames, clear: +clear.toFixed(1) }));
      }
      requestAnimationFrame(tick);
    };
    console.timeStamp('u2-write');
    sc.scrollTop += target.getBoundingClientRect().top - box.top - (box.height / 2 - 40);
    t0 = performance.now();
    requestAnimationFrame(tick);
  });
}

// Main-thread work in the trace from the write to the clear frame: totals per event name, and
// with --list every event over 1 ms (offset from the write, ms).
const NAMES = new Set([
  'UpdateLayoutTree',
  'Layout',
  'PrePaint',
  'Paint',
  'Layerize',
  'Commit',
  'FireAnimationFrame',
  'EventDispatch',
  'TimerFire',
  'FunctionCall',
  'ResizeObserver',
  'IntersectionObserverController::computeIntersections',
  'UpdateLayer',
  'HitTest',
]);
function summarize(trace) {
  const ev = trace.traceEvents;
  const write = ev.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'u2-write');
  const clear = ev.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'u2-clear');
  if (!write || !clear) return { error: 'no marks' };
  const main = ev.filter(
    (e) => e.pid === write.pid && e.tid === write.tid && e.ph === 'X' && e.ts >= write.ts && e.ts <= clear.ts,
  );
  const sum = {};
  for (const e of main) {
    if (!NAMES.has(e.name)) continue;
    const k = e.name === 'EventDispatch' ? `EventDispatch:${e.args?.data?.type}` : e.name;
    sum[k] ??= { ms: 0, n: 0, elements: 0 };
    sum[k].ms += e.dur / 1000;
    sum[k].n++;
    sum[k].elements += e.args?.elementCount ?? 0;
  }
  for (const k in sum) sum[k].ms = +sum[k].ms.toFixed(1);
  const list = LIST
    ? main
        .filter((e) => e.dur >= 1000 && NAMES.has(e.name))
        .map(
          (e) =>
            `${((e.ts - write.ts) / 1000).toFixed(1)} ${e.name}${e.name === 'EventDispatch' ? `:${e.args?.data?.type}` : ''} ${(e.dur / 1000).toFixed(1)}${e.args?.elementCount ? ` el=${e.args.elementCount}` : ''}`,
        )
    : undefined;
  const dump = process.env.DUMP
    ? ev
        .filter((e) => e.pid === write.pid && e.tid === write.tid && e.ts >= write.ts && e.ts <= clear.ts && (e.ph !== 'X' || e.dur >= 50))
        .map(
          (e) =>
            `${((e.ts - write.ts) / 1000).toFixed(2)} ${e.ph} ${e.name}${e.args?.data?.type ? `:${e.args.data.type}` : ''}${e.args?.data?.message ? `:${e.args.data.message}` : ''} ${e.dur ? (e.dur / 1000).toFixed(2) : ''}${e.args?.elementCount ? ` el=${e.args.elementCount}` : ''}${e.args?.beginData?.stackTrace ? ' forced' : ''}${e.name === 'Layout' ? ' ' + JSON.stringify({ d: e.args?.beginData?.dirtyObjects, t: e.args?.beginData?.totalObjects, p: e.args?.beginData?.partialLayout }) : ''}${e.args?.data?.stackTrace ? ' stack=' + e.args.data.stackTrace.map((f) => f.functionName + ':' + f.lineNumber).join('<') : ''}${e.args?.data?.functionName ? ' fn=' + e.args.data.functionName + ':' + e.args.data.lineNumber : ''}`,
        )
    : undefined;
  return { window: +((clear.ts - write.ts) / 1000).toFixed(1), sum, list, dump };
}

const browser = await chromium.launch();
const results = {};
try {
  for (let run = 1; run <= RUNS; run++)
    for (const v of pick) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      await page.route('**/*', (route) =>
        route.request().isNavigationRequest()
          ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>u2</title>' })
          : route.abort(),
      );
      await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
      const src = VARIANTS[v]();
      await page.addStyleTag({ content: src.css });
      await page.addScriptTag({ content: src.js });
      await page.evaluate(build, { blocks: BLOCKS, spans: SPANS, rules: RULES });
      await page.waitForTimeout(1500); // the flush holds the streamed blocks
      await page.evaluate(complete);
      await page.waitForTimeout(2000);
      const before = await page.evaluate(state);
      if (TRACE) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack'] });
      const r = await page.evaluate(jump, { index: Math.floor(BLOCKS / 2) });
      const tr = TRACE ? summarize(JSON.parse(await browser.stopTracing())) : undefined;
      (results[v] ??= []).push(r.clear);
      console.log(
        JSON.stringify({
          run,
          v,
          before,
          flags: r.flags,
          clear: r.clear,
          frames: r.frames.map((f) => `${f.t}:${f.points}:${f.h}`).join(' '),
          ...(tr && { trace: tr }),
        }),
      );
      await page.close();
    }
} finally {
  await browser.close();
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const v in results)
  console.log(`${v}: write -> clear ms ${results[v].join(', ')} (median ${med(results[v])})`);
