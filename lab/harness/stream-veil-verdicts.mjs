// Veil verdicts for stream-replay-live.mjs (spec #170, ticket #173). Measured from the page's
// computed styles, never from Butter's veil attribute, so they hold for any build, main included.
//
// - veil-none-rendered: no answer block computes opacity 0 while it can be drawn (isRenderedVeil):
//   in every stream-window sample (the last turn's blocks), after the window (every answer block in
//   the page), and, with VEILPROBE=1 or UX on, in no probed frame under a tested point, both at the
//   frame's start and after drawing. A miss is invisible text.
// - veil-effective: judged only when blocks were veiled just before the completion frame. ChatGPT's
//   requestAnimationFrame callback in that frame forces less than 100 ms of style and layout (study:
//   6.4-7.0 ms with the veil, 1181-1203 ms without). A FAIL is the alarm for a change in ChatGPT's
//   paint-readiness telemetry: its walk no longer stops at an element that computes opacity "0".
//
// installVeilCheck runs in the page (MAIN world, init script, from stream-api-probe.mjs) and gives
// the samplers window.__veilCheck. A block's content counts as rendered by its last
// contentvisibilityautostatechange event (Butter unveils in that same event, before the content
// draws); before any event, by its first child's checkVisibility({ contentVisibilityAuto: true }).

const r1 = v => Math.round(v * 10) / 10;
export const EFFECTIVE_MS = 100;

// Forced style and layout in ChatGPT's requestAnimationFrame callbacks of one long animation frame
// (scripts of 5 ms or more; the browser lists no shorter ones).
export const chatgptRafForced = frame =>
  r1((frame?.scripts || []).filter(x => x.invoker === 'FrameRequestCallback' && x.src.startsWith('chatgpt:')).reduce((a, x) => a + x.forced, 0));

// veiledBefore: veiled blocks in the last sample before the completion frame; frame: the completion
// frame (null when no long frame was found around completion); laf: long-animation-frame data exists.
export function veilEffective({ veiledBefore, frame, laf }) {
  if (!(veiledBefore > 0)) return { judged: false, ok: true, why: 'no block was veiled just before the completion frame' };
  if (!laf) return { judged: true, ok: false, why: `${veiledBefore} blocks veiled before completion, but there is no long-animation-frame data to judge` };
  const forced = chatgptRafForced(frame);
  const ok = forced < EFFECTIVE_MS;
  return { judged: true, ok, forced, why: `${veiledBefore} blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced ${forced} ms of style and layout${frame ? ` (frame ${frame.d} ms at ${frame.s} ms)` : ' (no long frame at completion)'}${ok ? '' : `, ${EFFECTIVE_MS} ms or more: its paint-readiness walk no longer stops at veiled blocks?`}` };
}

// A block that computes opacity 0 while it can be drawn: it is not content-visibility auto, or it
// is and its content is rendered (not skipped). A skipped block paints nothing either way.
// Self-contained: the page runs this same function (installVeilCheck).
export function isRenderedVeil({ opacity, contentVisibility, rendered }) {
  return opacity === '0' && (contentVisibility !== 'auto' || rendered);
}

// samples: the stream window's samples ({ leaks }: rendered veiled blocks in the last turn); after:
// the same over the whole page after the window; frames: per-frame probes (VEILPROBE, UX), each
// { name, sampled, start, drawn }: frames with a rendered veiled block under a tested point at the
// frame's start (rAF) and after drawing (a task posted from that rAF).
export function veilNoneRendered({ samples, after, frames }) {
  const counted = samples.filter(r => r && typeof r.leaks === 'number');
  const bad = counted.filter(r => r.leaks > 0);
  const most = Math.max(0, ...counted.map(r => r.leaks));
  const parts = [`${bad.length} of ${counted.length} samples (most ${most})`, `${after ?? '-'} after the window`,
    ...frames.map(f => `${f.name}: ${f.start} at the frame's start, ${f.drawn} after drawing (of ${f.sampled} frames)`)];
  const none = !counted.length || after == null || frames.some(f => !f.sampled);
  const ok = !none && !bad.length && after === 0 && frames.every(f => !f.start && !f.drawn);
  return { ok, why: `${none ? 'not everything was sampled; ' : ''}blocks at opacity 0 that are not content-visibility auto or whose content is rendered: ${parts.join('; ')}` };
}

// From stream-replay-live.mjs's summary after the stream (and the wheel phase): verdicts
// ({ check, ok, why }) and REPORT lines ({ line }).
export function veilVerdicts(summary) {
  const frames = [];
  const vp = summary.veilProbe;
  if (vp) for (const [k, r] of [['wheel', vp.wheel], ['mid', vp.mid]]) frames.push({ name: `veil probe ${k}`, sampled: r?.n ?? 0, start: r?.leakStart ?? 0, drawn: r?.leakDrawn ?? 0 });
  if (summary.ux?.leaks) frames.push({ name: 'ux', ...summary.ux.leaks });
  const none = veilNoneRendered({ samples: summary.hydration?.rows || [], after: summary.answerGeo?.leaks ?? null, frames });
  const eff = veilEffective({ veiledBefore: summary.veil?.beforeCompletion?.veiled ?? 0, frame: summary.completion ?? null, laf: !!summary.lafDetail });
  summary.veilVerdicts = { noneRendered: none, effective: eff };
  return [
    { line: `veil-none-rendered: ${none.why}` },
    { check: 'veil-none-rendered', ok: none.ok, why: none.why },
    { line: `veil-effective: ${eff.judged ? '' : 'not judged, '}${eff.why}` },
    ...(eff.judged ? [{ check: 'veil-effective', ok: eff.ok, why: eff.why }] : []),
  ];
}

// In the page, before ChatGPT's scripts. isRenderedVeil is passed in as source (veilCheckScript).
export function installVeilCheck(isRenderedVeil) {
  if (window.__veilCheck) return;
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const skipped = new WeakMap();
  document.addEventListener('contentvisibilityautostatechange', e => skipped.set(e.target, e.skipped), true);
  const rendered = b => {
    const s = skipped.get(b);
    if (s !== undefined) return !s;
    const c = b.firstElementChild;
    return c ? c.checkVisibility({ contentVisibilityAuto: true }) : false;
  };
  const leaking = b => {
    const cs = getComputedStyle(b), cv = cs.contentVisibility;
    return isRenderedVeil({ opacity: cs.opacity, contentVisibility: cv, rendered: cv === 'auto' && rendered(b) });
  };
  window.__veilCheck = { leaking, count: root => (root ? [...root.querySelectorAll(BLOCKS)].filter(leaking).length : 0) };
}
export const veilCheckScript = () => `(${installVeilCheck})(${isRenderedVeil})`;
