// Records the new chat key (Alt+Shift+O, #163) on live ChatGPT for a PR's before/after GIFs, on a
// lock you hold. Same steps on any build: open a project chat fixture, focus its composer, wait 1 s,
// press Alt+Shift+O as real X input (xtest-keys.py; chrome.commands ignores DevTools key events),
// hold 3.5 s. Without the feature nothing happens; with it the page moves to the project's new chat.
//
//   LAB_ID=$LAB LAB_OWNER=<owner> EXT=<snap-readable extension dir> LABEL=before|after CAPTION='...' \
//     OUT=<file.gif> [FIXTURE=ats12] node lab/harness/new-chat-demo.mjs
//
// The recording is `ffmpeg -f x11grab` on the lab's display, as rail-demo.mjs does. CROP, measured on
// the page: the chat column under the header, as wide as the composer plus 16 px a side (no URL bar,
// tab strip, header, sidebar or account). The repo is public, so in the GIF:
// - everything but the composer is pixelated in 20 px blocks (chat turns, the project page's
//   heading and chat list);
// - the composer is sharp only in frames where it matches the settled page (the first frame for the
//   chat's composer, the last for the new chat's), found by comparing frames; frames in between are
//   pixelated whole;
// - the project name in "New chat in <project>" is a solid box.
// The raw MP4 and the measured rects stay out of the repo (~/.local/share/chatgpt-lab/captures/new-chat-demo/).
// Watch every frame of the GIF before committing it: `<OUT stem>-frames/` holds them as PNGs.
// Exit 2 on a setup error; it judges nothing.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { heldLab, startLab } from './seek-live-page.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = process.env;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
if (env.EXT === undefined || !env.OUT || !env.LABEL) { console.error('EXT=, LABEL= and OUT= are required'); process.exit(2); }
const lab = heldLab(L, env);
const FIXTURE = env.FIXTURE || 'ats12';
const ED = '.ProseMirror[contenteditable="true"]';
const BLOCK = 20, FPS = 30;
const CAP = path.join(L.root(), 'captures/new-chat-demo');
fs.mkdirSync(CAP, { recursive: true });
const mp4 = path.join(CAP, `${env.LABEL}.mp4`);
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

// Viewport rects on the screen: the visible composer and, when its label is "New chat in <name>",
// the name's box.
const measure = (page) =>
  page.evaluate((ED) => {
    const shown = (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0;
    const ed = [...document.querySelectorAll(ED)].find(shown);
    const ox = window.screenX + (window.outerWidth - window.innerWidth), oy = window.screenY + (window.outerHeight - window.innerHeight);
    const box = (r) => ({ x: Math.round(r.left + ox), y: Math.round(r.top + oy), w: Math.round(r.width), h: Math.round(r.height) });
    const form = ed.closest('form') || ed.parentElement;
    const header = document.querySelector('#page-header, main header');
    const label = ed.getAttribute('aria-label') || '';
    let name = null;
    const p = ed.querySelector('p[data-placeholder], p.placeholder') || ed.querySelector('p');
    if (label.startsWith('New chat in ') && p) {
      // The placeholder is ::before content, so measure its text on a canvas in its own font
      // (from the longhands: the `font` shorthand can come back empty, which leaves canvas at 10 px).
      const st = getComputedStyle(p, '::before');
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const text = p.getAttribute('data-placeholder') || label;
      const r = p.getBoundingClientRect(), left = r.left + parseFloat(st.paddingLeft || 0);
      const x0 = left + ctx.measureText('New chat in ').width, x1 = left + ctx.measureText(text).width;
      name = box({ left: x0 - 2, top: r.top - 2, width: x1 - x0 + 12, height: r.height + 4 });
    }
    return { composer: box(form.getBoundingClientRect()), header: header ? box(header.getBoundingClientRect()) : null,
      viewport: { x: ox, y: oy, w: innerWidth, h: innerHeight }, labelIsProject: label.startsWith('New chat in '), name };
  }, ED);

let browser, page;
try {
  ({ browser, page } = await startLab(L, lab, env, env.EXT));
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator(ED).first().waitFor({ state: 'visible', timeout: 60000 });
  await pause(6000);
  await page.locator(`${ED}:visible`).first().click(); // focus in the message box
  await page.mouse.move(5, 5);
  await pause(1500);
  const before = await measure(page);
  // CROP: under the header to the viewport's bottom, the composer's width plus 16 px a side; whole blocks.
  const top = before.header ? before.header.y + before.header.h : before.viewport.y + 60;
  const w = Math.ceil((before.composer.w + 32) / BLOCK) * BLOCK;
  const h = Math.floor((before.viewport.y + before.viewport.h - top) / BLOCK) * BLOCK;
  const CROP = { x: Math.round(before.composer.x + before.composer.w / 2 - w / 2), y: before.viewport.y + before.viewport.h - h, w, h };
  const at = await page.evaluate(() => ({ x: window.screenX + 700, y: window.screenY + 20 }));

  const ff = spawn('ffmpeg', ['-hide_banner', '-y', '-f', 'x11grab', '-draw_mouse', '0', '-framerate', String(FPS),
    '-video_size', `${CROP.w}x${CROP.h}`, '-i', `${lab.display}+${CROP.x},${CROP.y}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-pix_fmt', 'yuv420p', mp4], { stdio: ['pipe', 'ignore', 'pipe'] });
  const t0 = await new Promise((r) => ff.stderr.on('data', function f(d) { if (/frame=/.test(d)) { ff.stderr.off('data', f); r(Date.now()); } }));
  ff.stderr.resume(); // keep draining ffmpeg's progress output
  await pause(1000);
  const tPress = (Date.now() - t0) / 1000;
  execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), 'Alt+Shift+O', String(at.x), String(at.y)], { env: { ...env, DISPLAY: lab.display } });
  await pause(3500);
  ff.stdin.write('q');
  await new Promise((r) => ff.on('close', r));
  const after = await measure(page);
  await browser.close().catch(() => {});
  const rel = (b) => b && { x: b.x - CROP.x, y: b.y - CROP.y, w: b.w, h: b.h };
  const pad = (b) => b && clip({ x: b.x - 8, y: b.y - 8, w: b.w + 16, h: b.h + 16 });
  const clip = (b) => { const x = Math.max(0, b.x), y = Math.max(0, b.y); return { x, y, w: Math.min(CROP.w, b.x + b.w) - x, h: Math.min(CROP.h, b.y + b.h) - y }; };
  const R = { before: pad(rel(before.composer)), after: pad(rel(after.composer)), name: after.name && rel(after.name) };
  console.log(`REPORT crop ${JSON.stringify(CROP)} composer before ${JSON.stringify(R.before)} after ${JSON.stringify(R.after)} name ${JSON.stringify(R.name)} label is project ${after.labelIsProject} press at ${tPress.toFixed(2)} s`);
  fs.writeFileSync(path.join(CAP, `${env.LABEL}.json`), JSON.stringify({ CROP, R, tPress }, null, 2));

  // Which frames show each composer as settled: compare its rect, in gray, with the reference frame.
  const gray = (b) => execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', `crop=${b.w}:${b.h}:${b.x}:${b.y},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const settled = (b, ref) => {
    const buf = gray(b), n = b.w * b.h, frames = buf.length / n, r = ref === 'first' ? 0 : frames - 1;
    return Array.from({ length: frames }, (_, f) => {
      let off = 0;
      for (let i = 0; i < n; i++) if (Math.abs(buf[f * n + i] - buf[r * n + i]) > 40) off++;
      return off / n < 0.003;
    });
  };
  const ranges = (ok) => {
    const out = [];
    ok.forEach((v, f) => { if (v) { if (out.length && out.at(-1)[1] === f - 1) out.at(-1)[1] = f; else out.push([f, f]); } });
    return out.length ? out.map(([a, b]) => `between(n,${a},${b})`).join('+') : '0';
  };
  const okB = settled(R.before, 'first'), okA = settled(R.after, 'last');
  // The chat's composer only up to the first frame where the new chat's shows (the two can overlap).
  const firstA = okA.findIndex((v, f) => v && okA.slice(f).every(Boolean));
  const okB2 = okB.map((v, f) => v && (firstA < 0 || f < firstA || env.LABEL === 'before'));
  console.log(`REPORT frames ${okB.length}: chat composer sharp ${ranges(okB2)}; new chat composer sharp ${ranges(okA)}`);
  const caption = (env.CAPTION || env.LABEL).replace(/[:',\\]/g, ''); // drawtext's special characters
  const box = R.name ? `,drawbox=x=${R.name.x}:y=${R.name.y}:w=${R.name.w}:h=${R.name.h}:color=0x808080:t=fill:enable='${ranges(okA)}'` : '';
  const graph =
    `[0:v]split=3[a][b][c];` +
    `[a]scale=${CROP.w / BLOCK}:${CROP.h / BLOCK}:flags=area,scale=${CROP.w}:${CROP.h}:flags=neighbor[pix];` +
    `[b]crop=${R.before.w}:${R.before.h}:${R.before.x}:${R.before.y}[sb];[c]crop=${R.after.w}:${R.after.h}:${R.after.x}:${R.after.y}[sa];` +
    `[pix][sb]overlay=${R.before.x}:${R.before.y}:enable='${ranges(okB2)}'[m1];` +
    `[m1][sa]overlay=${R.after.x}:${R.after.y}:enable='${env.LABEL === 'before' ? '0' : ranges(okA)}'${box},` +
    `pad=${CROP.w}:${CROP.h + 64}:0:0:color=white,` +
    `drawtext=fontfile=${font}:text='${caption}':x=16:y=${CROP.h + 10}:fontsize=20:fontcolor=black,` +
    `drawtext=fontfile=${font}:text='Alt+Shift+O pressed':x=16:y=${CROP.h + 36}:fontsize=20:fontcolor=0xc02020:enable='gte(t,${tPress.toFixed(2)})',` +
    `drawtext=fontfile=${font}:text='Page pixelated outside the composer for privacy':x=${CROP.w - 470}:y=${CROP.h + 36}:fontsize=16:fontcolor=0x707070,` +
    `fps=12,scale=${Math.min(800, CROP.w)}:-2:flags=lanczos,setsar=1,split[g1][g2];[g1]palettegen=max_colors=128:stats_mode=diff[p];[g2][p]paletteuse=dither=sierra2_4a[gif]`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-filter_complex', graph, '-map', '[gif]', '-loop', '0', env.OUT]);
  const frames = env.OUT.replace(/\.gif$/, '') + '-frames';
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames);
  execFileSync('ffmpeg', ['-v', 'error', '-i', env.OUT, '-vsync', '0', path.join(frames, '%03d.png')]);
  console.log(`REPORT gif ${env.OUT} ${fs.statSync(env.OUT).size} bytes; frames in ${frames}`);
} catch (e) {
  console.error('setup error:', e.stack || e);
  await browser?.close().catch(() => {});
  process.exit(2);
}
