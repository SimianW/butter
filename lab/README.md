# Test lab

Tools used to measure Butter for ChatGPT. Current method and results are in
[benchmarks](../docs/benchmarks.md); the [original report](../docs/REPORT.md) is historical.
Curated reports and numeric summaries go in [`notes/runs/`](../notes/runs/README.md), after
removing private data. Raw captures stay local.

## Browser (`lab`)

The live lab runs outside the repo: two headed Chromium instances, one per ChatGPT account, with
locks, fixtures and a send guard. Its README, `~/.local/share/chatgpt-lab/README.md`, is the source
of truth (it is kept out of the repo because it holds account chat URLs). Read it before any lab run.
Before starting a run, take a lock and wait for it, rather than polling `lock.d` yourself:

```sh
B=~/.local/share/chatgpt-lab/bin
LAB=$($B/lab-lock acquire --lab auto --owner <task> --wait 1800 [--perf])   # --perf for timing runs
# ... run, then $B/lab-restore --lab "$LAB" --owner <task>
$B/lab-lock release --lab "$LAB" --owner <task>
```

Scripts can import `lib/lab.mjs` or `lib/lab.py` from `~/.local/share/chatgpt-lab/` instead. The `lab` script in this folder is the original
single-lab launcher, kept for setting up a lab on a new machine.

Not on this Linux box: on Windows or macOS, measure with [`measure-console.js`](measure-console.js)
in DevTools, or start Chrome with `--remote-debugging-port=9222 --user-data-dir=<new profile>` and
run the harness scripts without `EXT=`.

## Harness (`harness/`)

Run `npm ci --prefix lab/harness` from the repository root. Live-chat scripts generally need
`CHAT=<url of a long ChatGPT chat>`; fixture-only and isolated popup scripts do not. `EXT=<dirs>` restarts
the lab browser with exactly those unpacked extensions (`EXT=` empty = no extensions); without
`EXT` the scripts use the browser as it is.

| Script | What it does |
|---|---|
| `dil-renderer.mjs` | Synthetic Dil-wrapper and direct-markdown regression: real recorder, formula sizing and resize, preview clamp, anchor indexes and containment. Separate headless browser; no ChatGPT requests or shared lab lock. |
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
