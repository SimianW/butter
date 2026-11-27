// The live replay script's veil verdicts (lab/harness/stream-veil-verdicts.mjs): veil-none-rendered
// and veil-effective, judged from the samples and frames the probes collect. No browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRenderedVeil,
  veilEffective,
  veilNoneRendered,
  veilVerdicts,
} from '../lab/harness/stream-veil-verdicts.mjs';

// The completion frames of the 2026-11-24 stream veil study (head-ats12 and pv-ats12), as
// stream-laf-report.mjs keeps them.
const headFrame = {
  s: 105025.6,
  d: 1844.5,
  scripts: [
    {
      invokerType: 'user-callback',
      invoker: 'FrameRequestCallback',
      src: 'chatgpt:299268.5b3cdf27e2.js',
      d: 1233.7,
      forced: 1181.2,
    },
    {
      invokerType: 'user-callback',
      invoker: 'TimerHandler:setTimeout',
      src: 'other',
      d: 586.9,
      forced: 182.1,
    },
  ],
};
const veilFrame = {
  s: 105022.7,
  d: 659.8,
  scripts: [
    {
      invokerType: 'user-callback',
      invoker: 'TimerHandler:setTimeout',
      src: 'other',
      d: 625.2,
      forced: 175.9,
    },
    {
      invokerType: 'user-callback',
      invoker: 'FrameRequestCallback',
      src: 'chatgpt:299268.5b3cdf27e2.js',
      d: 14.7,
      forced: 6.6,
    },
  ],
};

test('veil-effective: not judged when no block was veiled just before the completion frame', () => {
  const v = veilEffective({ veiledBefore: 0, frame: headFrame, laf: true });
  assert.equal(v.judged, false);
  assert.equal(v.ok, true);
});

test("veil-effective: fails when ChatGPT's rAF callback in the completion frame forces 100 ms or more", () => {
  const v = veilEffective({ veiledBefore: 585, frame: headFrame, laf: true });
  assert.equal(v.judged, true);
  assert.equal(v.ok, false);
  assert.equal(v.forced, 1181.2);
});

test("veil-effective: passes on the study's veil frame (6.6 ms forced in ChatGPT's rAF callback)", () => {
  const v = veilEffective({ veiledBefore: 585, frame: veilFrame, laf: true });
  assert.deepEqual([v.judged, v.ok, v.forced], [true, true, 6.6]);
});

test('veil-effective: judged without long-animation-frame data, it fails (nothing was measured)', () => {
  const v = veilEffective({ veiledBefore: 3, frame: null, laf: false });
  assert.deepEqual([v.judged, v.ok], [true, false]);
  assert.match(v.why, /long-animation-frame/);
});

test('veil-effective: no long frame at completion passes (no frame of 50 ms can force 100 ms)', () => {
  const v = veilEffective({ veiledBefore: 3, frame: null, laf: true });
  assert.deepEqual([v.judged, v.ok, v.forced], [true, true, 0]);
});

test('isRenderedVeil: opacity 0 counts only on a block that is not content-visibility auto or whose content is rendered', () => {
  assert.equal(
    isRenderedVeil({ opacity: '0', contentVisibility: 'visible', rendered: false }),
    true,
    'left the auto rules',
  );
  assert.equal(
    isRenderedVeil({ opacity: '0', contentVisibility: 'auto', rendered: true }),
    true,
    'auto but rendered',
  );
  assert.equal(
    isRenderedVeil({ opacity: '0', contentVisibility: 'auto', rendered: false }),
    false,
    'skipped: paints nothing anyway',
  );
  assert.equal(
    isRenderedVeil({ opacity: '1', contentVisibility: 'visible', rendered: true }),
    false,
  );
  assert.equal(
    isRenderedVeil({ opacity: '0.5', contentVisibility: 'visible', rendered: true }),
    false,
    'only exactly 0',
  );
});

const rows = (...leaks) => leaks.map((n, i) => ({ t: i * 1000, leaks: n }));

test('veil-none-rendered: passes with no leak in any sample, after the window or in any probed frame', () => {
  const v = veilNoneRendered({
    samples: rows(0, 0, 0),
    after: 0,
    frames: [{ name: 'veil probe', sampled: 1248, start: 0, drawn: 0 }],
  });
  assert.equal(v.ok, true);
});

test("veil-none-rendered: fails on the first prototype's 19 blocks left at opacity 0 after completion", () => {
  const v = veilNoneRendered({ samples: rows(0, 0, 19, 19), after: 19, frames: [] });
  assert.equal(v.ok, false);
  assert.match(v.why, /19 after the window/);
  assert.match(v.why, /2 of 4 samples/);
});

test('veil-none-rendered: fails on one probed frame with a rendered veiled block after drawing', () => {
  const v = veilNoneRendered({
    samples: rows(0, 0),
    after: 0,
    frames: [{ name: 'ux', sampled: 900, start: 0, drawn: 1 }],
  });
  assert.equal(v.ok, false);
  assert.match(v.why, /ux: 0 at the frame's start, 1 after drawing/);
});

test('veil-none-rendered: fails when nothing was sampled', () => {
  assert.equal(veilNoneRendered({ samples: [], after: null, frames: [] }).ok, false);
  assert.equal(
    veilNoneRendered({ samples: [{ t: 0 }], after: 0, frames: [] }).ok,
    false,
    'samples without a leak count',
  );
  assert.equal(
    veilNoneRendered({
      samples: rows(0),
      after: 0,
      frames: [{ name: 'ux', sampled: 0, start: 0, drawn: 0 }],
    }).ok,
    false,
    'a probe that sampled no frame',
  );
});

// What stream-replay-live.mjs keeps in its summary, for a run on main with VEILPROBE=1 and UX=u1.
const mainSummary = () => ({
  lafDetail: { frames: [headFrame] },
  completion: headFrame,
  hydration: { rows: rows(0, 0, 0) },
  veil: { beforeCompletion: { t: 104371.2, veiled: 0 } },
  answerGeo: { leaks: 0 },
  veilProbe: {
    wheel: { n: 1275, leakStart: 0, leakDrawn: 0 },
    mid: { n: 30, leakStart: 0, leakDrawn: 0 },
  },
  ux: { leaks: { sampled: 950, start: 0, drawn: 0 } },
});

test('veilVerdicts: on main, veil-none-rendered passes and veil-effective is reported as not judged', () => {
  const out = veilVerdicts(mainSummary());
  assert.deepEqual(
    out.filter((x) => x.check).map((x) => [x.check, x.ok]),
    [['veil-none-rendered', true]],
  );
  assert.ok(
    out.some((x) => /^veil-effective: not judged/.test(x.line ?? '')),
    JSON.stringify(out),
  );
});

test('veilVerdicts: veiled blocks before a 1.2 s forced completion callback fail veil-effective', () => {
  const s = mainSummary();
  s.veil.beforeCompletion.veiled = 585;
  assert.deepEqual(
    veilVerdicts(s)
      .filter((x) => x.check)
      .map((x) => [x.check, x.ok]),
    [
      ['veil-none-rendered', true],
      ['veil-effective', false],
    ],
  );
});

test('veilVerdicts: the per-frame probes count toward veil-none-rendered only when they ran', () => {
  const s = mainSummary();
  delete s.ux;
  s.veilProbe.mid.leakDrawn = 2;
  const v = veilVerdicts(s).find((x) => x.check === 'veil-none-rendered');
  assert.equal(v.ok, false);
  assert.doesNotMatch(v.why, /ux/);
});
