// Rendering red: real unpacked Butter, synthetic four-question conversation, no network.
// Run: xvfb-run -a node lab/harness/rail-tick-thin.mjs
// OUT=<dir>, SCALES=1,0.9,... and METHODS=device,zoom narrow an investigation.
// The assertions are on real browser zoom (`zoom`). They compare integrated grayscale
// brightness, including antialiased edges, of resting ticks: a >10% deficit against the
// brightest resting tick is a failure. Each resting tick must also be drawn round(2 × dpr)
// full-strength rows thick (see `full` below), so equal but uniformly thin or thick ticks fail
// too, and sit where the rail's model put it, to 1/64 CSS px (#115).
// Real zoom is set after the rail is drawn at 100%, so the rail's re-layout on zoom is what
// places the ticks.
// Device-scale emulation (`device`, Playwright's deviceScaleFactor) lays out in 1/64 CSS px and
// antialiases a bar's rows instead of snapping them to device pixels, so the rail's grid does not
// reach it: the same checks run there and print as REPORT lines, which do not fail the run.
// The forced-equal and paint probes are fixture-only CSS; product files stay untouched.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.resolve(
  process.env.OUT || path.join(root, 'notes/runs/2026-11-13-rail-tick-thin'),
);
const scales = (process.env.SCALES || '1,0.9,1.1,1.25,1.5,1.75').split(',').map(Number);
const methods = (process.env.METHODS || 'device,zoom').split(',');
const tolerance = 0.1;
// A full-strength row: its brightest pixel is more than half the full-coverage value of a
// resting bar, the brightest pixel of any resting bar in that capture (66 of 255 here: #ececec
// at opacity .28 on black). A half-covered antialiased edge row reaches at most half of it.
const full = 0.5;
const conversation = '00000000-0000-0000-0000-000000000001';
const html = `<!doctype html><html class="dark"><style>
html,body{margin:0;background:#000;color:#ececec;color-scheme:dark}
.thread-scroll-container{height:900px;overflow:auto;overflow-anchor:none}
.content{container-type:inline-size}article{box-sizing:border-box;height:1600px;padding:100px 200px}
</style><div class="thread-scroll-container"><div class="content">${Array.from(
  { length: 4 },
  (_, i) =>
    `<article data-turn-key="q${i}"><div data-talvt-turn-state="complete"><div data-user-message-bubble>Artificial question ${i + 1}</div><div data-message-author-role="assistant"><div data-markdown-text-style="assistant-message"><p>Artificial answer.</p></div></div></div></article>`,
).join('')}</div></div></html>`;
const forced =
  '.bar{transform:scale(1,1)!important;opacity:.28!important;animation:none!important}';
const probes = {
  native: '',
  equal: forced,
  'no-transform': forced + '.bar{transform:none!important}',
  square: forced + '.bar{border-radius:0!important}',
  layer: forced + '.bar{will-change:transform!important}',
  phase: forced + '.ticks{position:relative;top:2px!important}',
};
await fs.mkdir(out, { recursive: true });
const results = [],
  failures = [],
  reports = [];
let browserVersion;

function pixels(png) {
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  const gray = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ],
    { input: png },
  );
  if (gray.length !== width * height) throw Error('Unexpected decoded pixel count');
  return { width, height, gray };
}

function measure(png, clip, bars, dpr) {
  const { width, height, gray } = pixels(png);
  const centers = bars.map((b) => (b.rect.y + b.rect.height / 2 - clip.y) * dpr);
  return bars.map((_, i) => {
    const start = i ? Math.round((centers[i - 1] + centers[i]) / 2) : 0;
    const end = i + 1 < bars.length ? Math.round((centers[i] + centers[i + 1]) / 2) : height;
    const rows = [],
      rowPeaks = [];
    let minX = width,
      maxX = -1,
      sum = 0;
    for (let y = start; y < end; y++) {
      let peak = 0;
      for (let x = 0; x < width; x++) {
        const v = gray[y * width + x];
        sum += v;
        peak = Math.max(peak, v);
        if (v > 25) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      if (peak > 25) {
        rows.push(y);
        rowPeaks.push(peak);
      }
    }
    return { bar: i + 1, rows, length: maxX < 0 ? 0 : maxX - minX + 1, rowPeaks, sum };
  });
}

async function capture(page, requested, dpr) {
  // Playwright's clip is in pre-zoom viewport coordinates, whereas DOM rectangles
  // are in zoomed CSS coordinates. Crop the device-resolution viewport bitmap.
  const full = await page.screenshot({ scale: 'device' });
  const x = Math.floor(requested.x * dpr),
    y = Math.floor(requested.y * dpr);
  const width = Math.ceil(requested.width * dpr),
    height = Math.ceil(requested.height * dpr);
  const png = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-vf',
      `crop=${width}:${height}:${x}:${y}`,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1',
    ],
    { input: full, maxBuffer: 16 * 1024 * 1024 },
  );
  return {
    png,
    clip: { x: x / dpr, y: y / dpr, width: width / dpr, height: height / dpr },
    viewportBitmap: { width: full.readUInt32BE(16), height: full.readUInt32BE(20) },
  };
}

async function state(page) {
  return page.evaluate(() => {
    const host = document.querySelector('chatgpt-butter-nav'),
      shadow = host.shadowRoot;
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      dpr: devicePixelRatio,
      innerWidth,
      innerHeight,
      visualScale: visualViewport.scale,
      pitch: getComputedStyle(host).getPropertyValue('--pitch'),
      railOpacity: getComputedStyle(shadow.querySelector('.rail')).opacity,
      railClass: shadow.querySelector('.rail').className,
      moreHidden: shadow.querySelector('.more').hidden,
      bookmarkDots: shadow.querySelectorAll('.bdot').length,
      rail: rect(shadow.querySelector('.rail')),
      bars: [...shadow.querySelectorAll('.tick > .bar')].map((el, i) => {
        const css = getComputedStyle(el);
        // Where the model put this bar's top: the rail's top (--y), its 10 px padding, the three
        // dots' 16 px row when shown, i pitches, the 2 px bar centred in its tick, and its nudge.
        const px = (name) => parseFloat(getComputedStyle(host).getPropertyValue(name));
        const pitch = px('--pitch'),
          more = shadow.querySelector('.more').hidden ? 0 : 16;
        const model =
          px('--y') + 10 + more + i * pitch + (pitch - 2) / 2 + (parseFloat(el.style.top) || 0);
        const top = el.getBoundingClientRect().top;
        return {
          modelTop: model,
          offByLU: Math.round((top - model) * devicePixelRatio * 64 * 100) / 100,
          devicePhase: top * devicePixelRatio - Math.round(top * devicePixelRatio),
          inlineTop: el.style.top,
          tag: el.tagName,
          parent: el.parentElement.className,
          inlineTransform: el.style.transform,
          inlineOpacity: el.style.opacity,
          transform: css.transform,
          opacity: css.opacity,
          animation: css.animationName,
          radius: css.borderRadius,
          color: css.color,
          rect: rect(el),
        };
      }),
    };
  });
}

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

for (const method of methods) {
  for (const scale of scales) {
    for (const extension of [false, true]) {
      if (method === 'zoom' && !extension) {
        results.push({
          method,
          scale,
          extension: false,
          skipped:
            'No worker to set arbitrary browser zoom; device control covers extension absence',
        });
        continue;
      }
      const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-tick-thin-'));
      const ext = path.join(root, 'extension');
      let context;
      try {
        context = await chromium.launchPersistentContext(profile, {
          headless: false,
          viewport: { width: 1400, height: 950 },
          deviceScaleFactor: method === 'device' ? scale : 1,
          serviceWorkers: 'allow',
          args: extension ? [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] : [],
        });
        browserVersion = context.browser().version();
        let fulfilled = 0,
          aborted = 0;
        await context.route('**/*', (route) => {
          if (
            route.request().isNavigationRequest() &&
            route.request().resourceType() === 'document'
          ) {
            fulfilled++;
            return route.fulfill({ contentType: 'text/html', body: html });
          }
          aborted++;
          return route.abort();
        });
        const page = context.pages()[0];
        await page.goto(`https://chatgpt.com/c/${conversation}`);
        let worker;
        if (extension) {
          worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
          await worker.evaluate(() =>
            chrome.storage.local.set({
              butter: {
                enabled: true,
                layoutConsent: 'granted',
                opts: {
                  container: true,
                  cv: true,
                  throttle: true,
                  older: true,
                  rail: true,
                  seek: true,
                  layout: true,
                  branch: true,
                  bookmark: true,
                },
              },
            }),
          );
        }
        await page.mouse.move(10, 10);
        if (!extension) {
          await settle(page);
          const info = await page.evaluate(() => ({
            dpr: devicePixelRatio,
            innerWidth,
            count: document.querySelectorAll('chatgpt-butter-nav').length,
          }));
          const clip = { x: info.innerWidth - 100, y: 352, width: 80, height: 112 };
          const { png } = await capture(page, clip, info.dpr);
          const decoded = pixels(png);
          const sum = decoded.gray.reduce((a, b) => a + b, 0);
          if (info.count || sum) throw Error('No-extension control unexpectedly drew rail pixels');
          await fs.writeFile(path.join(out, `${method}-${scale}-absent.png`), png);
          results.push({ method, scale, extension, ...info, sum, fulfilled, aborted });
          console.log(`CONTROL ${method}=${scale} without Butter: host=0 brightness=0`);
          continue;
        }
        await page.evaluate(
          (conversation) =>
            document.dispatchEvent(
              new CustomEvent('butter-nav', {
                detail: JSON.stringify({
                  type: 'page',
                  conv: conversation,
                  before: null,
                  hasPrev: false,
                  items: Array.from({ length: 4 }, (_, i) => ({
                    id: `q${i}`,
                    q: `Artificial question ${i + 1}`,
                  })),
                }),
              }),
            ),
          conversation,
        );
        await page.waitForFunction(() => {
          const root = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
          const bars = [...(root?.querySelectorAll('.bar') || [])];
          return (
            bars.length === 4 &&
            bars
              .slice(1)
              .every((b) => b.style.opacity === '0.28' && b.style.transform === 'scale(1, 1)')
          );
        });
        // chrome.tabs.setZoom is Chrome's real per-tab browser zoom, not CSS zoom or
        // Emulation.setPageScaleFactor (pinch zoom). No permission/profile edits are needed.
        // Set once the rail is drawn, so the rail's own re-layout on zoom places the ticks.
        if (method === 'zoom' && scale !== 1) {
          await worker.evaluate(async (scale) => {
            const tabs = await chrome.tabs.query({});
            const tab = tabs.find((t) => t.url?.startsWith('https://chatgpt.com/')) || tabs[0];
            await chrome.tabs.setZoom(tab.id, scale);
          }, scale);
          await page.waitForFunction((s) => Math.abs(devicePixelRatio - s) < 0.002, scale);
          await settle(page);
          await settle(page);
        }
        await page.waitForTimeout(450); // finish rail's opacity transition
        for (const [probe, css] of Object.entries(probes)) {
          if (probe === 'phase' && scale !== 0.9) continue;
          await page.evaluate((css) => {
            const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
            root.querySelector('#fixture-probe')?.remove();
            const style = document.createElement('style');
            style.id = 'fixture-probe';
            style.textContent = css;
            root.append(style);
          }, css);
          await settle(page);
          const info = await state(page);
          if (Math.abs(info.dpr - scale) > 0.002)
            throw Error(`Scale not applied: ${method}=${scale}, dpr=${info.dpr}`);
          const requested = {
            x: Math.floor(info.rail.x + info.rail.width - 80),
            y: Math.floor(info.rail.y - 16),
            width: 80,
            height: Math.ceil(info.rail.height + 32),
          };
          const { png, clip, viewportBitmap } = await capture(page, requested, info.dpr);
          const measured = measure(png, clip, info.bars, info.dpr);
          const name = `${method}-${scale}-${probe}.png`;
          await fs.writeFile(path.join(out, name), png);
          const rest =
            probe === 'native'
              ? measured.filter((_, i) => info.bars[i].opacity === '0.28')
              : measured;
          if (rest.length < 3) throw Error('Fixture did not establish three resting ticks');
          const max = Math.max(...rest.map((b) => b.sum));
          const peak = Math.max(...rest.flatMap((b) => b.rowPeaks));
          for (const b of measured) b.fullRows = b.rowPeaks.filter((v) => v > peak * full).length;
          const thick = Math.round(2 * info.dpr);
          const bad = rest.filter((b) => b.sum < max * (1 - tolerance));
          const record = {
            method,
            scale,
            extension,
            probe,
            screenshot: name,
            clip,
            viewportBitmap,
            ...info,
            measurements: measured,
            maxRestBrightness: max,
            fullStrengthPeak: peak,
            targetRows: thick,
            tolerance,
            fulfilled,
            aborted,
          };
          results.push(record);
          console.log(
            `MEASURE ${method}=${scale} ${probe}: sums=${measured.map((b) => b.sum).join(',')} rows=${measured.map((b) => b.rows.length).join(',')} full=${measured.map((b) => b.fullRows).join(',')} lengths=${measured.map((b) => b.length).join(',')} offByLU=${info.bars.map((b) => b.offByLU).join(',')}`,
          );
          if (probe === 'native' || probe === 'equal') {
            const fail = method === 'zoom' ? failures : reports;
            for (const b of bad)
              fail.push(
                `FAIL ${method}=${scale} ${probe} bar ${b.bar}: brightness ${b.sum} vs ${max}, deficit ${((1 - b.sum / max) * 100).toFixed(1)}% > 10%`,
              );
            // The browser puts each bar where the model's numbers say, to 1/64 CSS px (offByLU
            // is in 1/64 device px).
            info.bars.forEach((b, i) => {
              if (Math.abs(b.offByLU) > info.dpr + 1e-6)
                fail.push(
                  `FAIL ${method}=${scale} ${probe} bar ${i + 1}: top ${b.offByLU}/64 device px from the model's`,
                );
            });
            for (const b of rest.filter((b) => b.fullRows !== thick))
              fail.push(
                  `FAIL ${method}=${scale} ${probe} bar ${b.bar}: ${b.fullRows} full-strength rows, not ${thick}`,
                );
          }
        }
      } finally {
        await context?.close();
        await fs.rm(profile, { recursive: true, force: true });
      }
    }
  }
}
await fs.writeFile(
  path.join(out, 'measurements.json'),
  JSON.stringify(
    {
      browser: 'Playwright headed Chromium under Xvfb',
      browserVersion,
      tolerance,
      threshold: 25,
      sum: 'All grayscale pixels, including values <=25, partitioned at tick-center midpoints',
      results,
      failures,
      reports,
    },
    null,
    2,
  ) + '\n',
);
for (const report of reports) console.log(report.replace(/^FAIL/, 'REPORT'));
for (const failure of failures) console.error(failure);
console.log(
  `RED: ${failures.length} real-zoom failures, ${reports.length} device-scale reports; tolerance=10%; browser=${browserVersion}`,
);
process.exitCode = failures.length ? 1 : 0;
