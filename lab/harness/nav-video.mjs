// Screen-record a history-rail jump made soon after a chat loads, to judge smoothness from the video
// (the slide-in runs on the compositor, so main-thread frame times don't show it). Prints, per video
// frame after the click, 'm' if the picture changed. Look at the frames too: scratch/jump-*.mp4.
// Usage: CHAT=<url> node nav-video.mjs [ms after the rail appears=1500] [tick index=1]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WAIT = +(process.argv[2] ?? 1500), TICK = +(process.argv[3] ?? 1), OUT = `scratch/jump-${WAIT}-${TICK}.mp4`;
fs.mkdirSync('scratch', { recursive: true });
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const p = b.contexts()[0].pages().find(x => x.url().startsWith('https://chatgpt.com'));
await p.goto(process.env.CHAT); await p.locator('.ProseMirror').first().waitFor();
await p.waitForFunction(() => document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'), null, { timeout: 30000 });
const g = await p.evaluate(() => { const r = document.querySelector('chatgpt-butter-nav').shadowRoot, b = r.querySelector('.rail').getBoundingClientRect(); const more = !r.querySelector('.more').hidden, n = r.querySelectorAll('.tick').length; return { x: b.x + b.width / 2, y0: b.y + 10 + (more ? 16 : 0), pitch: (b.height - 20 - (more ? 16 : 0)) / n }; });
const ff = spawn('ffmpeg', ['-hide_banner', '-y', '-f', 'x11grab', '-framerate', '30', '-video_size', '880x780', '-i', ':99+590,160', '-t', '9', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', OUT], { stdio: ['ignore', 'ignore', 'pipe'] });
let start = null, err = ''; ff.stderr.on('data', d => { err += d; const m = /start: (\d+\.\d+)/.exec(err); if (m && !start) start = +m[1] * 1000; });
while (!start) await sleep(20);
await sleep(Math.max(0, WAIT - 300));
await p.mouse.move(g.x, g.y0 + (TICK + 0.5) * g.pitch); await sleep(300);
const click = Date.now(); await p.mouse.click(g.x, g.y0 + (TICK + 0.5) * g.pitch); await p.mouse.move(1200, 700);
await new Promise(r => ff.on('close', r));
const clickS = (click - start) / 1000;
const stats = execFileSync('ffmpeg', ['-hide_banner', '-i', OUT, '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const luma = execFileSync('ffmpeg', ['-hide_banner', '-i', OUT, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const parse = s => [...s.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map(m => [+m[1], +m[2]]);
const D = parse(stats), Y = parse(luma);
console.log(`wait=${WAIT} tick=${TICK} click at ${clickS.toFixed(2)}s`);
let line = '';
for (let k = 0; k < Y.length; k++) {
  const t = Y[k][0] - clickS; if (t < -0.2 || t > 6) continue;
  const d = D[k - 1]?.[1] ?? 0;
  line += `${t.toFixed(2)}:${d > 0.05 ? 'm' : '.'} `;
}
console.log(line);
await b.close();
