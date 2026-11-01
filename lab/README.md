# Test lab

Everything used to measure Butter for ChatGPT. The method and results are in
[`../docs/REPORT.md`](../docs/REPORT.md).

## Browser (`lab`)

Headed Chromium on a virtual display, viewable in a web browser over noVNC, scriptable over CDP.
Linux only (Xvfb, snap Chromium). On Windows or macOS, measure with
[`measure-console.js`](measure-console.js) in DevTools instead, or start Chrome yourself with
`--remote-debugging-port=9222 --user-data-dir=<new profile>` and run the harness scripts without
`EXT=` (they then use whatever extensions that Chrome has loaded).

- Control: `lab start|stop|restart|status|restart-browser`
- Load unpacked extensions: `LAB_EXTENSIONS=/abs/ext-a,/abs/ext-b lab restart-browser`
  (snap Chromium can't read hidden directories in `$HOME`).
- View: `http://<LAB_WEB_HOST>:6080/vnc.html?autoconnect=1&resize=scale`. `LAB_WEB_HOST` defaults
  to 127.0.0.1; set it to a Tailscale or LAN address to view from another machine.
- Log in to ChatGPT yourself through the viewer; the profile keeps the login.

| Piece | Where |
|---|---|
| Browser | `/snap/bin/chromium` (sandbox on), profile `~/snap/chromium/common/chatgpt-lab-profile`, CDP on 127.0.0.1:9222 |
| Display | Xvfb :99, 1600x1000 |
| VNC | x11vnc on 127.0.0.1:5999, password file `$LAB_HOME/vncpass` |
| Web | noVNC + websockify from `$LAB_HOME/novnc` and `$LAB_HOME/venv` |
| Logs / pids | `$LAB_HOME/log`, `$LAB_HOME/run` (`LAB_HOME` defaults to `~/.local/share/chatgpt-lab`) |

## Harness (`harness/`)

`npm install` once. Every script needs `CHAT=<url of a long ChatGPT chat>`. `EXT=<dirs>` restarts
the lab browser with exactly those unpacked extensions (`EXT=` empty = no extensions); without
`EXT` the scripts use the browser as it is.

| Script | What it does |
|---|---|
| `baseline.mjs` | Chats for real, turn by turn, in a project (`PROJECT=<project url>`) with the prompts in `prompts-baseline.mjs`; measures every answer. `build-report.mjs` turns its output into an HTML page. |
| `record.mjs` | Sends one real prompt and records the streamed SSE answer with chunk timing. |
| `bench.mjs` | The main benchmark: replays a recording into `CHAT` via a `fetch` hook (nothing reaches OpenAI), scrolls and types while it streams, and measures frames, Long Animation Frames, keystrokes, CDP metrics and the answer's SHA-256. `TRACE=1|heavy|stack` also saves a Chrome trace. |
| `scenarios.mjs` | Reload, scroll the whole chat, idle typing. |
| `qa.mjs` | Screenshots at fixed anchors, wide-block widths, find-in-page, select-all, scroll jumps after reload. |
| `analyze-trace.py` | Main-thread time by category, forced-layout stacks and hottest JS functions from a trace. |
| `demo.mjs` | Screen-records one replayed answer with a fixed human-like input script (type, scroll, type) for the demo video. Run once without and once with the extension. |
| `convcheck.mjs` | Lists the user turns the server has for `CHAT`, to confirm replays never reached it. |
| `sb-config.mjs` | Applies Speed Booster Toolkit settings in the lab browser and reports the `num_turns` it requested. |
| `run-matrix.sh`, `run-sb*.sh` | Batches used for the report. |

`python3 lab/make-demo.py` edits the two `demo.mjs` recordings into the side-by-side video with
captions (`dist/demo/chatgpt-butter-demo.mp4` and a GIF excerpt).

Raw output goes to `harness/results/` and stays local (screenshots show the account; JSON holds
chat ids). `python3 lab/summarize.py` writes the tables in [`../results/`](../results).

## Variants (`variants/`)

One unpacked extension per ablation step in the report: `cv` (turn-level `content-visibility`),
`nocq` (size containers removed), `cv-nocq`, `butter-60|120|250|400` (plus the smoother throttle at
that interval), `smooth-only`, `butter-250-blocks` (aggressive block-level skipping),
`safe*` (gated block skipping with different container choices), `v2-blocks`, `v4-flush5`.
