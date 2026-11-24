# Commands — 2026-11-24 stream-ux-loaded

```sh
# Prepare (before the lock)
npx eslint lab/harness/stream-loaded-probe.mjs; echo eslint-exit=$?    # 0 (also after each edit)
node /tmp/lu1124/dry.mjs                     # page probe on a fake page, headless; samples, keys and report all fine
# /tmp/lu1124/run.sh NAME EST SCRIPT VARS: refuses past 1740 s of the lock, after 10 runs, or after a send attempt;
#   runs `env LAB_ID=<lab> LAB_OWNER=stream-ux-loaded-1124 VARS node lab/harness/SCRIPT`
B=~/.local/share/chatgpt-lab/bin
$B/lab-lock acquire --lab 1 --owner stream-ux-loaded-1124 --wait 1800 --perf    # 1, 20:50:47
LAB_ID=1 $B/lab start     # first try: Xvfb ":99 already active" (another task's xvfb-run); second try started
run.sh l1-pvh … FIXTURE=math12           # lab 1: exit 2, chat 1314 px / 5 turns, composer draft → not usable
$B/lab-restore --lab 1 …; LAB_ID=1 $B/lab stop; $B/lab-lock release --lab 1 …    # ok true; released
$B/lab-lock acquire --lab 2 --owner stream-ux-loaded-1124 --wait 1800 --perf    # 2, 20:52:55
```

| # | Run | Script and options | UTC | Exit |
|---|---|---|---|---:|
| 1 | `l1-pvh-lab1` | `stream-loaded-probe.mjs` pvh `math12` (lab 1) | 20:51:23–20:52:23 | 2 |
| 2 | `l1-pvh` | `stream-loaded-probe.mjs` pvh `math12` | 20:52:59–20:53:59 | 2 (refused to type over a draft) |
| 3 | `l1-head` | `stream-loaded-probe.mjs` head `math12`, `TYPE_FIXTURE=ats12` | 20:54:36–20:55:42 | 0 |
| 4 | `l2-rail-pvh-testbuild` | `rail-jump-live.mjs` pvh `FIXTURES=math12` | 20:56:19–20:56:57 | 2 (no dev rail trace) |
| — | `package.py --dev`; unzip to `head-dev` and `pvh-dev`; copy pvh's 2 files | | | |
| 5 | `l2-rail-pvh` | `rail-jump-live.mjs` pvh-dev `math12` | 20:57:19–21:02:56 | 1 |
| 6 | `l2-rail-head` | `rail-jump-live.mjs` head-dev `math12` | 21:03:02–21:08:36 | 1 |
| 7 | `l3-landing-pvh` | `seek-landing-live.mjs` pvh `math12` `TRACE=2000` | 21:08:47–21:11:08 | 0 |
| 8 | `l3-pin-pvh` | `seek-pin-live.mjs` pvh `math12` | 21:11:12–21:13:17 | 0 |
| 9 | `l4-wheel-pvh` | `wheel-jump-live.mjs` pvh `FIXTURES=ats12 LOADS=2` | 21:13:28–21:14:49 | 0 |
| 10 | `l5-typing-pvh` | `stream-loaded-probe.mjs` pvh `IDLE=0 TYPE_FIXTURE=ats12` | 21:14:54–21:15:14 | 0 |

```sh
$B/lab-restore --lab 2 --owner stream-ux-loaded-1124      # restored … "ok":true; exit 0
$B/lab-lock release --lab 2 --owner stream-ux-loaded-1124 # {"lab": 2, "lab_released": true, "perf_released": true}
python3 -I <build script>   # sanitized logs and data.json (home → ~, URLs → <url>, ids → <id>)
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-stream-ux-loaded/*   # exit 1
git status --short extension/                             # (empty)
```

`l1-pvh-lab1.log`'s evidence line names `l1-pvh.json`; that capture was renamed to `l1-pvh-lab1.json`
before the re-run on lab 2.
