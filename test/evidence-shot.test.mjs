// The evidence shot's clip (lab/harness/runner/shot.mjs): which part of the viewport a screenshot
// takes and how many device pixels it comes out at, from the region under test in CSS px, the
// browser zoom and the emulated device scale. No browser: the expected values are worked by hand
// from what Chromium 1254 produced in a probe (clip in pre-zoom DIPs, output = DIPs × device scale).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shotClip } from '../lab/harness/runner/shot.mjs';

const viewport = { width: 1000, height: 700 };

test('a fractional CSS rect at zoom 1 is widened to whole pixels, as an element screenshot is', () => {
  const s = shotClip({
    rect: { x: 100.3, y: 50.6, width: 200.2, height: 30.7 },
    viewport,
    zoom: 1,
    scale: 1,
  });
  assert.deepEqual(s.clip, { x: 100, y: 50, width: 201, height: 32 });
  assert.deepEqual(s.device, { width: 201, height: 32 });
  assert.equal(s.clamped, false);
});

test('a margin widens the clip on every side, and the viewport edge cuts it', () => {
  const s = shotClip({
    rect: { x: 5, y: 680, width: 100, height: 10 },
    margin: 12,
    viewport,
    zoom: 1,
    scale: 1,
  });
  assert.deepEqual(s.clip, { x: 0, y: 668, width: 117, height: 32 });
  assert.equal(s.clamped, true);
  // Per side: { top, right, bottom, left }.
  const t = shotClip({
    rect: { x: 100, y: 100, width: 50, height: 20 },
    margin: { top: 20, right: 8, bottom: 0, left: 16 },
    viewport,
    zoom: 1,
    scale: 1,
  });
  assert.deepEqual(t.clip, { x: 84, y: 80, width: 74, height: 40 });
  assert.equal(t.clamped, false);
});

test('under browser zoom the clip is in pre-zoom pixels and the shot comes out at the device scale', () => {
  // At 125% zoom and device scale 2 the page reports this rect in zoomed CSS px; DIPs are 1.25×.
  const s = shotClip({
    rect: { x: 100.3, y: 50.6, width: 200.2, height: 30.7 },
    viewport,
    zoom: 1.25,
    scale: 2,
  });
  assert.deepEqual(s.clip, { x: 125, y: 63, width: 251, height: 39 });
  assert.deepEqual(s.css, { x: 100, y: 50.4, width: 200.8, height: 31.2 });
  assert.deepEqual(s.device, { width: 502, height: 78 });
  // The margin is in CSS px too: 8 CSS px is 10 pre-zoom px.
  const m = shotClip({
    rect: { x: 100, y: 100, width: 40, height: 40 },
    margin: 8,
    viewport,
    zoom: 1.25,
    scale: 1,
  });
  assert.deepEqual(m.clip, { x: 115, y: 115, width: 70, height: 70 });
});

test('a fractional device scale rounds the shot to whole device pixels, half up, as Chromium does', () => {
  // Chromium 1254 at deviceScaleFactor 1.5: a 101 × 33 clip came out 152 × 50.
  const s = shotClip({
    rect: { x: 10, y: 10, width: 101, height: 33 },
    viewport,
    zoom: 1,
    scale: 1.5,
  });
  assert.deepEqual(s.device, { width: 152, height: 50 });
});

test('a region wholly outside the viewport is an error, not an empty shot', () => {
  assert.throws(
    () =>
      shotClip({ rect: { x: 1200, y: 10, width: 50, height: 50 }, viewport, zoom: 1, scale: 1 }),
    /outside the viewport/,
  );
  assert.throws(
    () => shotClip({ rect: { x: 10, y: 10, width: 0, height: 50 }, viewport, zoom: 1, scale: 1 }),
    /outside the viewport/,
  );
});
