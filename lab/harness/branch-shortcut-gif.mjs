// Records the Ask in branch key (#126) on the branch fixture, for a PR's before/after GIFs: the
// quote selected, Alt+Shift+Q pressed as real X input (a caption shows the press), Esc, then Ask in
// branch's cell hovered so its label shows. On a build with the key the box opens and the label reads
// "Ask in branch" + "Alt Shift Q"; on one without, nothing happens and the label has no key.
// EXT_DIR picks the unpacked build (default this checkout's extension/), so the same steps run on
// another build, e.g. a `git worktree` of main. Headed, so run it under an X display:
//   EXT_DIR=/tmp/main/extension OUT=/tmp/before.gif \
//     xvfb-run -n 201 -s '-screen 0 1600x1000x24' node lab/harness/branch-shortcut-gif.mjs
// (-n with a number away from the labs' displays, :98 and :99.) Writes the MP4 beside OUT and the
// GIF (800 px wide, 12 fps) to OUT. No ChatGPT requests: the fixture serves every page.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBranch } from './branch/harness.mjs';
import { butter, chipOf, select } from './branch/driver.mjs';
import { repo } from './runner/chromium.mjs';

if (!process.env.DISPLAY) { console.error('needs an X display: run under xvfb-run'); process.exit(2); }
const ext = path.resolve(process.env.EXT_DIR || path.join(repo, 'extension'));
const out = path.resolve(process.env.OUT || '/tmp/branch-shortcut.gif');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-shortcut-gif-'));
const cleanups = [];
const defer = (fn) => cleanups.push(fn);

// launchButter, with the chosen build and a screen recording.
const launch = async ({ viewport, options }) => {
  const context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    channel: 'chromium',
    viewport,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    ...options,
    headless: false,
    recordVideo: { dir: path.join(tmp, 'video'), size: viewport },
  });
  defer(() => context.close());
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  return { context, worker, errors: [] };
};

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// A caption at the page's bottom left while the key is pressed, so the GIF shows when it was.
const caption = (page, text) =>
  page.evaluate((text) => {
    let el = document.getElementById('gif-caption');
    if (!el) {
      el = document.body.appendChild(document.createElement('div'));
      el.id = 'gif-caption';
      el.style.cssText =
        'position:fixed;left:16px;bottom:16px;z-index:2147483647;padding:6px 12px;border-radius:8px;' +
        'background:#111;color:#fff;font:600 15px system-ui,sans-serif;box-shadow:0 2px 8px #0004';
    }
    el.textContent = text;
    el.hidden = !text;
  }, text);

try {
  const { start } = await launchBranch({ shots: path.join(tmp, 'shots'), defer, keys: true, launch });
  const qa = await start({ name: 'gif' }, () => {});
  const page = await qa.open();
  await pause(800);
  await select(page);
  await chipOf(page).waitFor();
  await pause(900);
  await caption(page, 'Alt+Shift+Q');
  await qa.shortcut(page); // real X input; waits 400 ms
  await pause(1400);
  await caption(page, '');
  const opened = await page.evaluate(() => !!document.querySelector('chatgpt-butter-branch')?.shadowRoot?.querySelector('.qpop'));
  console.log(`REPORT the box ${opened ? 'opened' : 'did not open'}`);
  if (opened) {
    await caption(page, 'Esc');
    await page.keyboard.press('Escape');
    await pause(700);
    await caption(page, '');
  }
  await chipOf(page).waitFor();
  const p = await butter(page).hoverCell('branch', 450);
  console.log(`REPORT label ${JSON.stringify(p?.tip?.text)} key ${JSON.stringify(p?.tip?.kbd)}`);
  await pause(1800);
  const video = page.video();
  await page.close();
  const mp4src = await video.path();
  const mp4 = out.replace(/\.gif$/, '.mp4');
  // Trim the blank start before the fixture painted.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', mp4src, '-vf', 'scale=800:-2', '-pix_fmt', 'yuv420p', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf',
    'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    out]);
  console.log(`wrote ${out} and ${mp4}`);
} finally {
  for (const fn of cleanups.reverse()) await Promise.resolve(fn()).catch(() => {});
  await fs.rm(tmp, { recursive: true, force: true });
}
