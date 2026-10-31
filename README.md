# ChatGPT Turbo

Chrome extension (MV3) that keeps long, math-heavy chatgpt.com conversations smooth while an
answer streams in. In a 9-turn math chat it cuts main-thread blocking during an answer from 75.6 s
to 6.3 s (12×) and the p95 frame time from 300 ms to 33 ms.

![Side by side while a long answer streams: ChatGPT without the extension (left) and with ChatGPT Turbo (right)](docs/media/demo-en.gif)

Full 75-second video with captions: [docs/media/demo-en.mp4](docs/media/demo-en.mp4). Both sides
play back the same recorded ChatGPT answer in the same 9-turn math chat and get identical keyboard
and mouse-wheel input. During this answer the page without the extension was frozen for 75.8 s in
total, with ChatGPT Turbo for 8.0 s.

中文测试报告和中文演示视频：[docs/REPORT.md](docs/REPORT.md)

Current version: **0.0.1-alpha** ([changelog](CHANGELOG.md)). Alpha: it depends on ChatGPT's current
DOM and may stop helping when ChatGPT changes it.

## Install (Windows, macOS, Linux)

1. Download `chatgpt-turbo-<version>.zip` from the
   [releases page](https://github.com/SimianW/chatgpt-turbo/releases) and unzip it. You get a
   `chatgpt-turbo` folder; keep it somewhere permanent, Chrome loads it from there.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `chatgpt-turbo` folder.
4. Reload any open chatgpt.com tabs.

Works in Chrome, Edge, Brave, Arc and other Chromium browsers (version 95 or later). Not in Safari
or Firefox.

To tune or switch off the stream throttle, edit `smoothMs` in `config.js` (`0` disables it), then
click the reload icon on the extension card. To turn everything off, toggle the extension off and
reload the tab.

## What it changes

| File | Change | Why |
|---|---|---|
| `turbo.css` | `container-type: normal` on the thread's inner wrapper. | As a size container around the whole conversation it makes Chrome redo style for everything inside on every streamed update. Most of the win. |
| `turbo.css` + `turbo-cv.js` | `content-visibility: auto` on turns and answer blocks, but only after they have rendered once (`data-turbo-seen`); blocks of the answer being streamed get it right away. | Off-screen content skips style and layout. Waiting for the first render means the browser already knows each block's real height, so scrolling never jumps. |
| `turbo-main.js` (page world) | Lets ChatGPT's stream smoother publish at most every 250 ms instead of every frame. Only the exact callback `()=>{this.frame=void 0,this.publish()}` is touched; anything else passes through. | Each publish re-renders the answer and restyles the page. Text still streams; it arrives in slightly bigger steps. |

The extension makes no network requests, stores nothing, and doesn't touch messages.

## Measured effect

Replaying the same recorded answer into a 9-turn math chat (~90k DOM nodes), scrolling and typing
while it streams. Lab Chromium 156 on Linux without GPU, so absolute numbers are worse than on a
typical laptop; compare the ratios. Not yet measured on Windows or macOS:
[`lab/measure-console.js`](lab/measure-console.js) measures it on your own machine.

| Metric | ChatGPT as is | With Turbo |
|---|---|---|
| Main thread blocked during the answer | 75.6 s | 6.3 s |
| Frame time p95 while scrolling | 300 ms | 33 ms |
| Slowest keystroke while typing | 3.5 s | 0.8 s |
| Longest single freeze | 2.1 s | 0.6 s |
| Longest frame scrolling the whole chat | 3.6 s | 0.7 s |

The fully streamed answer is byte-identical with and without the extension. Comparison with other
extensions, ablations, method and raw tables: [docs/REPORT.md](docs/REPORT.md),
[results/](results).

## Known trade-offs

- Wide tables and visualizations are sized against the app's main content area instead of the
  thread column: about 10 px wider at a 1600 px window.
- A block that streams in while you are scrolled far up is skipped before it's ever drawn; when
  you scroll down to it, content below the viewport may settle by a few pixels.
- Selectors depend on ChatGPT's current DOM (`data-turn-key`, `data-markdown-text-style`,
  `data-talvt-turn-state`, one Tailwind class). If ChatGPT changes them the extension stops
  helping; it doesn't break the page.

## Repository

| Path | What |
|---|---|
| `extension/` | The extension. |
| `docs/REPORT.md` | Test report: method, all results, risks (Chinese). |
| `docs/oss-survey.md` | Survey of existing long-chat extensions. |
| `results/` | Result tables from every benchmark run, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Risk review of the extension code. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/chatgpt-turbo-<version>.zip`. |
| `CHANGELOG.md` | Versions. |

Test: `node test/raf.test.mjs`.

MIT license.
