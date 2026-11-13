// The dense rail before and after the device-pixel nudge (#115): compositor layers, cc tile
// memory, frame times during a hover sweep, the resting bars' brightness spread, and how far each
// bar's top is from where the rail's model put it. Real unpacked Butter, synthetic chat with N
// questions (default 200; the rail has no tick cap), no network.
// Run: xvfb-run -a node lab/harness/rail-tick-cost.mjs
// N=200 ZOOMS=1,0.9 REPS=3 BASE=549aeb5 narrow a run; OUT=<file> keeps every run as JSON. Prints
// one JSON line per run and a summary table. "before" is extension/ at BASE (git archive);
// "after" is this checkout's extension/. The rail is drawn at 100% and then zoomed, so the
// rail's re-layout on zoom is what places the ticks.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const n = Number(process.env.N || 200);
const zooms = (process.env.ZOOMS || '1,0.9').split(',').map(Number);
const reps = Number(process.env.REPS || 3);
const base = process.env.BASE || '549aeb5';
const conversation = '00000000-0000-0000-0000-000000000001';
const html = `<!doctype html><html class="dark"><style>
html,body{margin:0;background:#000;color:#ececec;color-scheme:dark}
.thread-scroll-container{height:900px;overflow:auto;overflow-anchor:none}
.content{container-type:inline-size}article{box-sizing:border-box;height:600px;padding:100px 200px}
</style><div class="thread-scroll-container"><div class="content">${Array.from(
  { length: n },
  (_, i) =>
    `<article data-turn-key="q${i}"><div data-talvt-turn-state="complete"><div data-user-message-bubble>Artificial question ${i + 1}</div><div data-message-author-role="assistant"><div data-markdown-text-style="assistant-message"><p>Artificial answer.</p></div></div></div></article>`,
).join('')}</div></div></html>`;

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-tick-cost-'));
const variants = { before: path.join(tmp, 'extension'), after: path.join(root, 'extension') };
execFileSync('tar', ['-x', '-C', tmp], {
  input: execFileSync('git', ['-C', root, 'archive', base, 'extension'], {
    maxBuffer: 64 * 1024 * 1024,
  }),
});

// Grayscale pixels of a device-resolution PNG.
function gray(png) {
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  const px = execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
    { input: png, maxBuffer: 64 * 1024 * 1024 },
  );
  return { width, height, px };
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function tileMemory(cdp) {
  const events = [];
  cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: ['disabled-by-default-memory-infra'],
      memoryDumpConfig: { triggers: [] },
    },
  });
  const dump = await cdp.send('Tracing.requestMemoryDump', {
    deterministic: true,
    levelOfDetail: 'detailed',
  });
  await cdp.send('Tracing.end');
  await done;
  const bytes = {};
  for (const e of events) {
    for (const [name, d] of Object.entries(e.args?.dumps?.allocators || {})) {
      if (!/^cc\/(tile_memory|resource_memory)$/.test(name)) continue;
      bytes[name] = (bytes[name] || 0) + parseInt(d.attrs?.size?.value || '0', 16);
    }
  }
  return { success: dump.success, bytes };
}

async function run(variant, zoom) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-tick-cost-profile-'));
  const ext = variants[variant];
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: false,
      viewport: { width: 1400, height: 950 },
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    });
    await context.route('**/*', (route) =>
      route.request().isNavigationRequest()
        ? route.fulfill({ contentType: 'text/html', body: html })
        : route.abort(),
    );
    const page = context.pages()[0];
    await page.goto(`https://chatgpt.com/c/${conversation}`);
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
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
    await page.mouse.move(10, 10);
    await page.evaluate(
      ({ conversation, n }) =>
        document.dispatchEvent(
          new CustomEvent('butter-nav', {
            detail: JSON.stringify({
              type: 'page',
              conv: conversation,
              before: null,
              hasPrev: false,
              items: Array.from({ length: n }, (_, i) => ({
                id: `q${i}`,
                q: `Artificial question ${i + 1}`,
              })),
            }),
          }),
        ),
      { conversation, n },
    );
    await page.waitForFunction(
      (n) =>
        document.querySelector('chatgpt-butter-nav')?.shadowRoot?.querySelectorAll('.bar')
          .length === n,
      n,
    );
    await page.waitForTimeout(800);
    const tops = () =>
      page.evaluate(() =>
        [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bar')].map(
          (b) => b.style.top,
        ),
      );
    const topsAt100 = await tops();
    if (zoom !== 1) {
      await worker.evaluate(async (zoom) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((t) => t.url?.startsWith('https://chatgpt.com/')) || tabs[0];
        await chrome.tabs.setZoom(tab.id, zoom);
      }, zoom);
      await page.waitForFunction((z) => Math.abs(devicePixelRatio - z) < 0.002, zoom);
      await page.waitForTimeout(800);
    }
    const topsNow = await tops();
    const geo = await page.evaluate(() => {
      const bars = [
        ...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bar'),
      ];
      const a = bars[0].getBoundingClientRect(),
        b = bars.at(-1).getBoundingClientRect();
      const host = document.querySelector('chatgpt-butter-nav'),
        shadow = host.shadowRoot;
      const px = (name) => parseFloat(getComputedStyle(host).getPropertyValue(name));
      const pitch = px('--pitch'),
        more = shadow.querySelector('.more').hidden ? 0 : 16;
      // Each bar: its top, how far (1/64 device px) from where the model put it (the rail's top,
      // its 10 px padding, the three dots' row, i pitches, the 2 px bar centred, its nudge), its
      // opacity, and its centre for the brightness bands.
      const each = bars.map((el, i) => {
        const r = el.getBoundingClientRect();
        const model =
          px('--y') + 10 + more + i * pitch + (pitch - 2) / 2 + (parseFloat(el.style.top) || 0);
        return {
          off: (r.top - model) * devicePixelRatio * 64,
          opacity: getComputedStyle(el).opacity,
          y: r.top + r.height / 2,
          right: r.right,
        };
      });
      return {
        dpr: devicePixelRatio,
        each,
        hint: getComputedStyle(bars[0]).willChange,
        x: a.x + a.width / 2,
        y0: a.y,
        y1: b.y + b.height,
        pitch: getComputedStyle(document.querySelector('chatgpt-butter-nav')).getPropertyValue(
          '--pitch',
        ),
      };
    });
    if (Math.abs(geo.dpr - zoom) > 0.002) throw Error(`zoom not applied: ${geo.dpr}`);
    // Resting bars' brightness: the device-resolution viewport cropped to the ticks' 12 px column,
    // summed in bands split halfway between bar centres. Bars next to a lit one are left out, so a
    // lit bar's wider, brighter rows never fall in a resting bar's band.
    const shot = gray(await page.screenshot({ scale: 'device' }));
    const d = geo.dpr,
      x1 = Math.round(geo.each[0].right * d),
      x0 = x1 - Math.round(12 * d) - 2;
    const centres = geo.each.map((b) => b.y * d);
    const sums = centres.map((c, i) => {
      const a = i ? Math.round((centres[i - 1] + c) / 2) : Math.round(c - 4 * d);
      const z = i + 1 < centres.length ? Math.round((c + centres[i + 1]) / 2) : Math.round(c + 4 * d);
      let sum = 0;
      for (let y = a; y < z; y++) for (let x = x0; x < x1 + 2; x++) sum += shot.px[y * shot.width + x];
      return sum;
    });
    const resting = geo.each.flatMap((b, i) =>
      [i - 1, i, i + 1].every((k) => !geo.each[k] || geo.each[k].opacity === '0.28') ? [sums[i]] : [],
    );
    const offs = geo.each.map((b) => Math.abs(b.off));

    const cdp = await context.newCDPSession(page);
    let layers = [];
    cdp.on('LayerTree.layerTreeDidChange', (e) => e.layers && (layers = e.layers));
    await cdp.send('LayerTree.enable');
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await page.waitForTimeout(300);
    const restLayers = layers.length;
    const restDrawing = layers.filter((l) => l.drawsContent).length;
    const restMemory = await tileMemory(cdp);

    // Under browser zoom, Playwright's mouse takes the page's CSS px, like DOM rectangles.
    const { x, y0, y1 } = geo;
    await page.mouse.move(x, y0);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__frames = [];
      window.__maxScale = 0;
      let last = performance.now();
      const shadow = document.querySelector('chatgpt-butter-nav').shadowRoot;
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        for (const b of shadow.querySelectorAll('.bar')) {
          const m = /scale\(([\d.]+)/.exec(b.style.transform);
          if (m) window.__maxScale = Math.max(window.__maxScale, +m[1]);
        }
        if (window.__frames) window.__raf = requestAnimationFrame(tick);
      };
      window.__raf = requestAnimationFrame(tick);
    });
    let peakLayers = 0;
    const start = Date.now();
    for (let el = 0; el < 2000; el = Date.now() - start) {
      const f = el < 1000 ? el / 1000 : 2 - el / 1000; // down 1 s, back up 1 s
      await page.mouse.move(x, y0 + (y1 - y0) * f);
      peakLayers = Math.max(peakLayers, layers.length);
    }
    const sweep = await page.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const f = window.__frames.slice(1);
      window.__frames = null;
      return { frames: f, maxScale: window.__maxScale };
    });
    const hotMemory = await tileMemory(cdp);
    return {
      variant,
      zoom,
      n,
      pitch: geo.pitch,
      barWillChange: geo.hint,
      nudged: topsNow.filter(Boolean).length,
      reNudgedOnZoom: zoom !== 1 && topsNow.some((t, i) => t !== topsAt100[i]),
      maxOffLU: +Math.max(...offs).toFixed(2),
      restingBars: resting.length,
      restMin: Math.min(...resting),
      restMax: Math.max(...resting),
      restSpread: +((1 - Math.min(...resting) / Math.max(...resting)) * 100).toFixed(1),
      restSums: resting,
      restLayers,
      restDrawing,
      peakLayers,
      restTileBytes: restMemory.bytes,
      sweepTileBytes: hotMemory.bytes,
      frames: sweep.frames.length,
      median: +pct(sweep.frames, 50).toFixed(2),
      p95: +pct(sweep.frames, 95).toFixed(2),
      max: +Math.max(...sweep.frames).toFixed(2),
      waveMaxScale: sweep.maxScale,
      deltas: sweep.frames.map((d) => +d.toFixed(2)),
    };
  } finally {
    await context?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
}

const results = [];
try {
  for (const zoom of zooms)
    for (let rep = 0; rep < reps; rep++)
      for (const variant of rep % 2 ? ['after', 'before'] : ['before', 'after']) {
        const r = await run(variant, zoom);
        results.push(r);
        const { deltas, restSums, ...line } = r;
        console.log(JSON.stringify({ rep, ...line }));
      }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
if (process.env.OUT) await fs.writeFile(process.env.OUT, JSON.stringify(results, null, 2) + '\n');
console.log(
  '| Zoom | Build | Layers at rest (drawing) | Peak layers | cc tile+resource memory at rest / after sweep | Frames | Median ms | p95 ms | Resting bars: brightness min-max (spread) | Max top offset, 1/64 device px |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const zoom of zooms)
  for (const variant of ['before', 'after']) {
    const rs = results.filter((r) => r.zoom === zoom && r.variant === variant);
    const all = rs.flatMap((r) => r.deltas);
    const mem = (k) =>
      rs
        .map((r) => (Object.values(r[k]).reduce((a, b) => a + b, 0) / 1024).toFixed(0) + ' KiB')
        .join(', ');
    console.log(
      `| ${zoom * 100}% | ${variant} | ${rs.map((r) => `${r.restLayers} (${r.restDrawing})`).join(', ')} | ${rs.map((r) => r.peakLayers).join(', ')} | ${mem('restTileBytes')} / ${mem('sweepTileBytes')} | ${all.length} | ${pct(all, 50).toFixed(2)} | ${pct(all, 95).toFixed(2)} | ${rs.map((r) => `${r.restMin}-${r.restMax} (${r.restSpread}%)`).join(', ')} | ${rs.map((r) => r.maxOffLU).join(', ')} |`,
    );
  }
