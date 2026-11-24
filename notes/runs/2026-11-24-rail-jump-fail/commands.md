# Commands — 2026-11-24 rail-jump-fail

```sh
# Prepare (before the lock)
git worktree add --detach /tmp/rjf1124/wt-e09235b e09235b    # HEAD is now at e09235b
(cd /tmp/rjf1124/wt-e09235b && python3 scripts/package.py --dev)    # dist/butter-0.1.0-alpha.21+dev.1.zip
unzip -q …/butter-0.1.0-alpha.21+dev.1.zip -d ~/snap/chromium/common/rail-jump-fail-1124/e09-dev
# byte-compare rail/ stream/ seek/ of both unpacked builds with git show <commit>:extension/<file>: no DIFF lines
git worktree remove /tmp/rjf1124/wt-e09235b
# /tmp/rjf1124/run.sh NAME EST EXTDIR [VARS]: refuses past 1740 s of the lock or after 10 runs; runs
#   env LAB_ID=2 LAB_OWNER=rail-jump-fail-1124 EXT=$EXTDIR FIXTURES=math12 LABEL=$NAME OUT=<captures>/$NAME.json \
#       ONLY='[{"from":"top","to":0},{"from":"top","to":1},{"from":"top","to":2},{"from":"top","to":3},
#              {"from":"bottom","to":0},{"from":"bottom","to":1},{"from":"bottom","to":2},{"from":"bottom","to":3}]' \
#       VARS node lab/harness/rail-jump-live.mjs          # VARS ONLY= (empty) runs the full 30 jumps
B=~/.local/share/chatgpt-lab/bin
$B/lab-lock acquire --lab 2 --owner rail-jump-fail-1124 --wait 1800 --perf    # 2, 21:52:38 UTC
```

| # | Run | EXT | Extra env | UTC | Exit |
|---|---|---|---|---|---:|
| 1 | r1-head | head-dev | — | 21:52:41–21:55:16 | 1 |
| 2 | r2-head-smoother-off | head-dev | `SMOOTHER=off` | 21:55:19–21:58:04 | 1 |
| — | `node /tmp/rjf1124/opts-check.mjs` | head-dev | | | `OPTS null` |
| 3 | r3-e09235b | e09-dev | — | 21:58:12–22:00:53 | 1 |
| 4 | r4-head-seek-off | head-dev | `OPTS={"seek":false}` | 22:00:58–22:03:36 | 1 |
| 5 | r5-e09235b-full | e09-dev | `ONLY=` | 22:03:45–22:09:22 | 1 |
| 6 | r6-head-smoother-off-full | head-dev | `SMOOTHER=off ONLY=` | 22:09:27–22:15:02 | 1 |

```sh
node /tmp/rjf1124/opts-check.mjs        # EXT ~/snap/…/head-dev/butter OPTS null
$B/lab-restore --lab 2 --owner rail-jump-fail-1124       # restored … "ok":true; exit 0
$B/lab-lock release --lab 2 --owner rail-jump-fail-1124  # {"lab": 2, "lab_released": true, "perf_released": true}
$B/lab-lock status                                       # lab 1, 2, perf: "held": false
python3 -I /tmp/rjf1124/build.py        # data.json and sanitized logs (home → ~, URLs → <url>, ids → <id>)
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-rail-jump-fail/*   # exit 1
git status --short extension/           # (empty)
git worktree list | grep -c rjf1124     # 0
```

Scroll writes attributed with `/tmp/rjf1124/writers.py` over the raw captures; the 11-19 reference is
`~/.local/share/chatgpt-lab/captures/2026-11-19-live-recheck/railjump.json` and
`notes/runs/2026-11-19-live-recheck/railjump.log`.
