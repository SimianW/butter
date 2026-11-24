// The synthetic chat for the veil's headless check (test/stream-veil-chromium.test.mjs), and what
// runs in it: a frame sampler that records every rendered block computing opacity 0, the
// effectiveness check, and a reduced copy of ChatGPT's paint-readiness walk. Functions marked
// "in the page" are passed to page.evaluate and must not use anything from this module.
/* global document, window, getComputedStyle, requestAnimationFrame, setTimeout -- in the page */

// The answer's blocks are kept in a column (`answerRoot`): the markdown root in the classic
// renderer, the DilResponseRoot inside the Dil source wrapper in the Dil renderer.
export const BLOCK_PX = 40;

// In the page: completed history turns (classic answers, `blocks` each) and one empty answer that
// is `in_progress`, in the given renderer. The answer starts with a wide block and a table frame,
// which are never skipped and so never veiled.
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
// block that computes opacity 0 while its first child is rendered is a violation; so is any turn,
// wide block, table frame or Dil source wrapper at opacity 0. After the frame is drawn (a task
// queued from the frame), the blocks that were rendered at its start, and so drawn, are checked
// again. A block that the browser decides to render only after the frame is drawn (its proximity
// to the view is computed after paint) is not counted there: it renders in the next frame, whose
// start sample checks it. Also counts opacity transitions, and remembers which blocks rendered.
export function installSampler() {
  const w = window;
  w.veilStep = 'setup';
  w.violations = [];
  w.opacityTransitions = [];
  w.everRendered = new WeakSet();
  w.samples = 0;
  const blocks = () =>
    document.querySelectorAll(
      '[data-markdown-text-style] > *, [data-markdown-text-style] [class*="DilResponseRoot"] > *',
    );
  const never = () =>
    document.querySelectorAll(
      '[data-turn-key], [data-wide-block], [class*="TableFrame-"], [data-dil-source-message-id]',
    );
  const violation = (phase, kind) => w.violations.push({ step: w.veilStep, phase, kind });
  const sample = (phase, list) => {
    w.samples++;
    const drawn = new Set();
    for (const b of list) {
      if (!b.firstElementChild?.checkVisibility({ contentVisibilityAuto: true })) continue;
      drawn.add(b);
      w.everRendered.add(b);
      if (getComputedStyle(b).opacity === '0') violation(phase, 'rendered block at opacity 0');
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
    (e) => e.skipped || w.everRendered.add(e.target),
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
    (b) =>
      underAuto(b) &&
      !window.everRendered.has(b) &&
      !b.firstElementChild.checkVisibility({ contentVisibilityAuto: true }),
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

// In the page: appends `n` blocks to the in_progress answer, `perFrame` at a time.
export async function stream({ n, perFrame }) {
  const column =
    document.querySelector('[data-talvt-turn-state="in_progress"] [class*="DilResponseRoot"]') ??
    document.querySelector('[data-talvt-turn-state="in_progress"] [data-markdown-text-style]');
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const start = column.children.length;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('p');
    p.innerHTML = `Streamed ${start + i}: <span class="katex"><span>y</span></span> more.`;
    column.append(p);
    if ((i + 1) % perFrame === 0) await frame();
  }
  await frame();
}

// In the page: waits `n` frames.
export function frames(n) {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}
