// Evidence shots: a screenshot kept as evidence of how something looks, taken so that a pixel-level
// fault can be neither hidden nor invented by the capture. It is cropped to the region under test
// (an element, or a rect in CSS px, plus an optional margin), cut to the viewport, taken at the
// device scale (one PNG pixel per device pixel, never downscaled), and saved with a JSON sidecar,
// `<file>.json`, that records how: page URL, viewport, devicePixelRatio, browser zoom, the clip
// and the PNG's size in device pixels. Read the sidecar before judging a 1 px difference.
//
// Coordinates: DOM rects are in the page's CSS px, which browser zoom scales; Playwright's clip is
// in pre-zoom viewport px (DIPs), so a DIP is `zoom` CSS px. The PNG has `scale` device pixels per
// DIP, where `scale` is the emulated device scale factor (devicePixelRatio / zoom). Measured on
// Chromium 1254: at zoom 1.25 and scale 2, a 251 × 39 DIP clip comes out 502 × 78.
import fs from 'node:fs/promises';
import path from 'node:path';

const EPSILON = 1e-3; // as Playwright's enclosingIntRect, so a 100.0001 px edge stays at 100
const round4 = (v) => Number(v.toFixed(4));

// The clip for the region `rect` (CSS px, as getBoundingClientRect reports it) widened by `margin`
// (CSS px: a number, or { top, right, bottom, left }), at browser `zoom` and device `scale`, cut to
// `viewport` (Playwright's, in DIPs). Returns `clip` (whole DIPs, for page.screenshot), `css` (the
// same region in the page's CSS px), `device` (the PNG's size, rounded half up as Chromium does)
// and `clamped` (whether the viewport cut it). Throws when nothing of the region is in the viewport.
export function shotClip({ rect, margin = 0, viewport, zoom = 1, scale = 1 }) {
  const m = typeof margin === 'number' ? { top: margin, right: margin, bottom: margin, left: margin } : { top: 0, right: 0, bottom: 0, left: 0, ...margin };
  const left = Math.floor((rect.x - m.left) * zoom + EPSILON),
    top = Math.floor((rect.y - m.top) * zoom + EPSILON),
    right = Math.ceil((rect.x + rect.width + m.right) * zoom - EPSILON),
    bottom = Math.ceil((rect.y + rect.height + m.bottom) * zoom - EPSILON);
  const x = Math.max(0, left),
    y = Math.max(0, top),
    width = Math.min(viewport.width, right) - x,
    height = Math.min(viewport.height, bottom) - y;
  if (width <= 0 || height <= 0) throw new Error(`the region ${JSON.stringify(rect)} is outside the viewport ${viewport.width} × ${viewport.height}`);
  return {
    clip: { x, y, width, height },
    css: { x: round4(x / zoom), y: round4(y / zoom), width: round4(width / zoom), height: round4(height / zoom) },
    device: { width: Math.round(width * scale), height: Math.round(height * scale) },
    clamped: x !== left || y !== top || x + width !== right || y + height !== bottom,
  };
}

// The PNG's size, from its IHDR chunk.
const pngSize = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

// Takes an evidence shot of `target` on `page` into `file` (a PNG) and writes `<file>.json`.
// `target` is a Playwright locator (scrolled into view first) or a rect in CSS px of the viewport.
// `margin` is CSS px, as for shotClip; `note` is copied into the sidecar; any other option goes to
// page.screenshot (`animations`, say), except `clip`, `scale`, `fullPage` and `path`, which this
// sets. Returns the sidecar's record.
export async function evidenceShot(page, file, { target, margin = 0, note, ...options } = {}) {
  if (!target) throw new Error('evidenceShot needs a target: a locator or a CSS rect');
  const locator = typeof target.boundingBox === 'function';
  if (locator) await target.scrollIntoViewIfNeeded();
  const rect = locator
    ? await target.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
    : { x: target.x, y: target.y, width: target.width, height: target.height };
  const view = await page.evaluate(() => ({
    url: location.href,
    devicePixelRatio,
    css: { width: innerWidth, height: innerHeight },
    pinch: visualViewport?.scale ?? 1,
  }));
  const viewport = page.viewportSize();
  const zoom = await browserZoom(page, viewport, view);
  const scale = round4(view.devicePixelRatio / zoom.value);
  const shot = shotClip({ rect, margin, viewport, zoom: zoom.value, scale });
  const { clip: _c, scale: _s, fullPage: _f, path: _p, ...rest } = options;
  const png = await page.screenshot({ ...rest, path: file, clip: shot.clip, scale: 'device' });
  const device = pngSize(png);
  const record = {
    png: path.basename(file),
    takenAt: new Date().toISOString(),
    url: view.url,
    browser: page.context().browser()?.version() ?? null,
    viewport,
    cssViewport: view.css,
    devicePixelRatio: view.devicePixelRatio,
    deviceScaleFactor: scale,
    browserZoom: zoom.value,
    browserZoomFrom: zoom.from,
    pinchZoom: view.pinch,
    target: locator ? target.toString() : 'rect',
    rect,
    margin,
    clip: shot.css,
    viewportClip: shot.clip,
    clamped: shot.clamped,
    device,
    ...(note ? { note } : {}),
  };
  if (device.width !== shot.device.width || device.height !== shot.device.height) {
    record.expectedDevice = shot.device;
    console.log(`evidence shot ${file}: PNG is ${device.width} × ${device.height}, expected ${shot.device.width} × ${shot.device.height}`);
  }
  await fs.writeFile(`${file}.json`, JSON.stringify(record, null, 2) + '\n');
  return record;
}

// Chrome's per-tab browser zoom: exact from the DevTools protocol (Chromium only), else estimated
// from how many CSS px the pre-zoom viewport holds.
async function browserZoom(page, viewport, view) {
  try {
    const cdp = await page.context().newCDPSession(page);
    try {
      const { cssVisualViewport } = await cdp.send('Page.getLayoutMetrics');
      if (cssVisualViewport?.zoom > 0) return { value: round4(cssVisualViewport.zoom), from: 'Page.getLayoutMetrics' };
    } finally {
      await cdp.detach().catch(() => {});
    }
  } catch {
    // Not Chromium, or no protocol access: estimate below.
  }
  return { value: round4(viewport.width / view.css.width), from: 'viewport width / innerWidth' };
}
