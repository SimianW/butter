// The synthetic chat for the veil's headless check (test/stream-veil-chromium.test.mjs), and what
// runs in it: a frame sampler that records every rendered block computing opacity 0, the
// effectiveness check, and a reduced copy of ChatGPT's paint-readiness walk. Functions marked
// "in the page" are passed to page.evaluate and must not use anything from this module.
/* global document, window, getComputedStyle, requestAnimationFrame, setTimeout -- in the page */

// Opens the synthetic chat in a new page of `browser`, with Butter's containment stylesheet and
// marker from `extension` (a directory path ending in /), the sampler running, and the history
// blocks marked seen. `opts` go to build(). `sources` ({ css, js }) replace the stylesheet and the
// marker read from `extension` (test/helpers/veil-variants.mjs). With `opts.sampler` false the
// sampler does not run, so that nothing but the page forces style or layout.
export async function openChat(browser, extension, opts, sources = {}) {
  const { readFileSync } = await import('node:fs');
  const read = (file) => readFileSync(`${extension}${file}`, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.route('**/*', (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>veil</title>' })
      : route.abort(),
  );
  await page.goto('https://butter.invalid/c/00000000-0000-0000-0000-000000000000');
  await page.addStyleTag({ content: sources.css ?? read('stream/containment.css') });
  await page.addScriptTag({ content: sources.js ?? read('stream/offscreen.js') });
  await page.evaluate(build, { blockPx: BLOCK_PX, ...opts });
  if (opts.sampler !== false) await page.evaluate(installSampler);
  const history = opts.turns * opts.blocks;
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll('[data-talvt-turn-state="complete"] p[data-butter-seen]').length ===
      n,
    history,
  );
  return page;
}

// The answer's blocks are kept in a column (`answerRoot`): the markdown root in the classic
// renderer, the DilResponseRoot inside the Dil source wrapper in the Dil renderer.
export const BLOCK_PX = 40;

// In the page: completed history turns (classic answers, `blocks` each) and one empty answer that
// is `in_progress`, in the given renderer. The answer starts with a wide block and a table frame,
// which are never skipped and so never veiled. An <hr> is styled as on chatgpt.com (Tailwind's
// preflight): `height: 0` in a border box, so its content box stays 0 px even when skipped and the
// marker never queues it (notes/runs/2026-11-24-veil-unmarked/report.md).
export function build({ turns, blocks, renderer, transition, blockPx }) {
  const p = (i) => `<p>Block ${i}: <span class="katex"><span>x</span></span> and some prose.</p>`;
  const answer = (n) => Array.from({ length: n }, (_, i) => p(i)).join('');
  const column = (inner, dil) =>
    dil
      ? `<div data-dil-source-message-id="a"><div class="DilResponseRoot-q1">${inner}</div></div>`
      : inner;
  const turn = (
    i,
    state,
    inner,
    dil,
  ) => `<article data-turn-key="q${i}" id="${state === 'in_progress' ? 'answer' : `t${i}`}">
      <div data-talvt-turn-state="${state}">
        <div data-message-author-role="user"><div data-user-message-bubble>Question ${i}</div></div>
        <div data-message-author-role="assistant">
          <div class="MarkdownRoot-rZKhxa" data-markdown-text-style="assistant-message">${column(inner, dil)}</div>
        </div>
      </div>
    </article>`;
  const fixed = `<div data-wide-block><span>wide</span></div><div class="TableFrame-x"><span>table</span></div>`;
  document.body.innerHTML = `<style>
      body { margin: 0 } p { margin: 0; height: ${blockPx}px; line-height: 24px }
      hr { box-sizing: border-box; height: 0; border: 0 solid; border-top-width: 1px; margin: 24px 0 }
      #chat { height: 700px }
      .thread-scroll-container { height: 700px; overflow: auto; width: 768px }
      ${transition ? '[data-markdown-text-style] *, [data-turn-key] { transition: opacity 0.4s }' : ''}
    </style>
    <div id="chat"><div class="thread-scroll-container"><div>${Array.from(
      { length: turns },
      (_, i) => turn(i, 'complete', answer(blocks), false),
    ).join('')}${turn(turns, 'in_progress', fixed, renderer === 'dil')}</div></div></div>`;
}

// In the page: starts the sampler. On every frame, at its start (requestAnimationFrame), every
// block that computes opacity 0 while its content is rendered is a violation; so is any turn,
// wide block, table frame or Dil source wrapper at opacity 0. A block's content is rendered when
// its first element child is; a block without one (an <hr>) renders when it is not under
// `content-visibility: auto`, or when its last state-change event said it is not skipped
// (window.blockRendered). After the frame is drawn (a task queued from the frame), the blocks
// that were rendered at its start, and so drawn, are checked again. A block that the browser
// decides to render only after the frame is drawn (its proximity to the view is computed after
// paint) is not counted there: it renders in the next frame, whose start sample checks it.
// A block that was drawn once (rendered after a frame was drawn, or reported not skipped) and
// computes opacity 0 later is veiled again, also a violation. A frame-start sample alone does not
// make a block drawn: reading a new block before the browser first decides whether to skip it
// lays it out without drawing it. Also counts opacity transitions, and remembers which blocks
// rendered.
export function installSampler() {
  const w = window;
  w.veilStep = 'setup';
  w.violations = [];
  w.opacityTransitions = [];
  w.everRendered = new WeakSet();
  w.samples = 0;
  const lastSkipped = new WeakMap(),
    drawnOnce = new WeakSet();
  const rendered = (w.blockRendered = (b) =>
    b.firstElementChild
      ? b.firstElementChild.checkVisibility({ contentVisibilityAuto: true })
      : getComputedStyle(b).contentVisibility !== 'auto' || lastSkipped.get(b) !== true);
  const blocks = () =>
    document.querySelectorAll(
      '[data-markdown-text-style] > *, [data-markdown-text-style] [class*="DilResponseRoot"] > *',
    );
  const never = () =>
    document.querySelectorAll(
      '[data-turn-key], [data-wide-block], [class*="TableFrame-"], [data-dil-source-message-id]',
    );
  const violation = (phase, kind, tag) =>
    w.violations.push({ step: w.veilStep, phase, kind, ...(tag && { tag }) });
  const sample = (phase, list) => {
    w.samples++;
    const drawn = new Set();
    for (const b of list) {
      if (!rendered(b)) {
        if (drawnOnce.has(b) && getComputedStyle(b).opacity === '0')
          violation(phase, 'veiled again after it rendered', b.tagName);
        continue;
      }
      drawn.add(b);
      w.everRendered.add(b);
      if (phase === 'after drawing') drawnOnce.add(b);
      if (getComputedStyle(b).opacity === '0')
        violation(phase, 'rendered block at opacity 0', b.tagName);
    }
    for (const el of never())
      if (getComputedStyle(el).opacity === '0')
        violation(phase, `opacity 0 on ${el.outerHTML.slice(0, 60)}`);
    return drawn;
  };
  const frame = () => {
    const drawn = sample('frame start', blocks());
    setTimeout(() => sample('after drawing', drawn));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener(
    'contentvisibilityautostatechange',
    (e) => {
      lastSkipped.set(e.target, e.skipped);
      if (!e.skipped) (w.everRendered.add(e.target), drawnOnce.add(e.target));
    },
    true,
  );
  document.addEventListener('transitionrun', (e) => {
    if (e.propertyName === 'opacity') w.opacityTransitions.push({ step: w.veilStep });
  });
}

// In the page: the effectiveness check. Every skipped block under the two `content-visibility:
// auto` rules for unmarked blocks (in a turn that is in_progress, or held) that never rendered must
// compute opacity exactly "0"; and a reduced copy of ChatGPT's walk over the last answer (computed
// style, return at display none or opacity "0", recurse) must enter no veiled block.
export function effectiveness() {
  const blocks = [
    ...document.querySelectorAll(
      '[data-markdown-text-style] > :not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]), [data-markdown-text-style] [class*="DilResponseRoot"] > :not([data-wide-block]):not([class*="TableFrame-"])',
    ),
  ];
  const underAuto = (b) =>
    b.closest('[data-talvt-turn-state="in_progress"]') || b.hasAttribute('data-butter-unrendered');
  const target = blocks.filter(
    (b) => underAuto(b) && !window.everRendered.has(b) && !window.blockRendered(b),
  );
  const notZero = target.filter((b) => getComputedStyle(b).opacity !== '0').length;
  const entered = [];
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.opacity === '0') return;
    if (el.parentElement?.closest('[data-butter-veil]')) entered.push(el.tagName);
    for (const c of el.children) walk(c);
  };
  walk(document.getElementById('answer'));
  return {
    skippedNeverRendered: target.length,
    notZero,
    veiled: document.querySelectorAll('[data-butter-veil]').length,
    enteredVeiled: entered.length,
  };
}

// In the page: appends `n` blocks to the in_progress answer, `perFrame` at a time; with `hrEvery`,
// every `hrEvery`-th block is an <hr>. With `math`, each block holds six KaTeX-like spans nested
// `math` deep (about 13 layout objects per level), as a long math answer's do, and the word
// `zq<i>zq` for a find to land on.
export async function stream({ n, perFrame, hrEvery = 0, math = 0 }) {
  const column =
    document.querySelector('[data-talvt-turn-state="in_progress"] [class*="DilResponseRoot"]') ??
    document.querySelector('[data-talvt-turn-state="in_progress"] [data-markdown-text-style]');
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const start = column.children.length;
  for (let i = 0; i < n; i++) {
    if (hrEvery && (start + i) % hrEvery === hrEvery - 1) {
      column.append(document.createElement('hr'));
    } else {
      const p = document.createElement('p');
      const nest = (k, d) =>
        d ? `<span class="katex">x${k}<span class="mord">${nest(k, d - 1)}</span></span>` : `y${k}`;
      p.innerHTML = math
        ? `Streamed zq${start + i}zq ${Array.from({ length: 6 }, (_, k) => nest(k, math)).join(' ')}`
        : `Streamed ${start + i}: <span class="katex"><span>y</span></span> more.`;
      column.append(p);
    }
    if ((i + 1) % perFrame === 0) await frame();
  }
  await frame();
}

// In the page: moves the view so that `el`'s top is `offset` px below the view's top.
export function scrollTo({ selector, index, offset = 0 }) {
  const sc = document.querySelector('.thread-scroll-container');
  const all = [...document.querySelectorAll(selector)];
  const el = all.at(index < 0 ? index : Math.min(index, all.length - 1));
  sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - offset;
  return all.length;
}

// In the page: waits `n` frames.
export function frames(n) {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}
