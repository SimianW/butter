# Commands: veil verdicts check runs (#173), 2026-11-24

Run from the worktree of branch `veil/173-verdicts` (harness at `6989b91`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-24-veil-verdicts`
(raw logs and per-run JSON, kept local); `D` is `~/snap/chromium/common/veil-verdicts-1124`.

## Builds (outside the repo)

```sh
for n in main pv0 pv; do mkdir -p $D/$n && git archive main extension | tar -x -C $D/$n && mv $D/$n/extension $D/$n/butter; done
(cd $D/pv0/butter && patch -p2 < <repo>/notes/runs/2026-11-24-stream-veil/pv0.patch)
(cd $D/pv/butter && patch -p2 < <repo>/notes/runs/2026-11-24-stream-veil/pv.patch)
# version_name += "+veilcheck.<n>" in each manifest.json; node --check stream/offscreen.js
grep -c veil $D/*/butter/stream/containment.css
```
```text
pv0 applied
pv applied
main ok / pv0 ok / pv ok
main 0, pv0 2, pv 4 (lines with "veil" in containment.css)
```

`main` is `547fa0a`. On `main` a new install has the rail and Bookmarks off, so every run after the
first sets `OPTS={"rail":true,"bookmark":true}` (the study's build had them on by the old defaults);
the harness puts the stored options back after each run (`REPORT OPTS put back: … same as before true`).

## Lock and runs

```sh
LAB=$($B/lab-lock acquire --lab 2 --owner veil-verdicts-173 --wait 1800 --perf)
```
```text
lab=2 exit=0     # 23:39:34Z
```

Each run went through a wrapper (`/tmp/vv1124/run.sh NAME BUILD [VAR=value…]`) that refused to start
after 1560 s of the lock, after 10 runs, or after a `FAIL no-escape`/`FAIL server-unchanged`, then ran:

```sh
env LAB_ID=2 LAB_OWNER=veil-verdicts-173 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  [VEILPROBE=1 | PHASES=stream UX=u1,u2] 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
```

| # | Name | Build | Options | UTC | Exit |
|---|---|---|---|---|---:|
| 1 | `main-ats12-noopts` | main | `VEILPROBE=1`, no `OPTS` | 23:39:36–23:40:25 | 2 (rail off: `chatgpt-butter-nav[data-on]` never came) |
| 2 | `main-ats12` | main | `VEILPROBE=1`, `OPTS` | 23:40:55–23:44:45 | 0 |
| 3 | `pv0-ats12` | main + `pv0.patch` | `VEILPROBE=1`, `OPTS` | 23:44:49–23:48:36 | 1 |
| 4 | `pv-ats12` | main + `pv.patch` | `VEILPROBE=1`, `OPTS` | 23:48:41–23:52:37 | 0 |
| 5 | `pv-ats12-ux` | main + `pv.patch` | `PHASES=stream UX=u1,u2`, `OPTS` | 23:52:43–23:56:02 | 0 |

Key lines:

```text
# 2 main-ats12
REPORT completion frame: start 105028.7 ms, duration 1976, …; scripts 1295.4/1241.1 forced chatgpt:299268.ee6ad9ecda.js user-callback "FrameRequestCallback"; …
PASS veil-none-rendered
REPORT veil-effective: not judged, no block was veiled just before the completion frame
SUMMARY main-ats12: 0 FAILs

# 3 pv0-ats12
FAIL veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 29 of 126 samples (most 19); 19 after the window; veil probe wheel: 0 at the frame's start, 0 after drawing (of 1251 frames); veil probe mid: 0 at the frame's start, 0 after drawing (of 30 frames)
PASS veil-effective
SUMMARY pv0-ats12: 1 FAIL

# 4 pv-ats12
PASS veil-none-rendered
REPORT veil-effective: 586 blocks veiled before completion; ChatGPT's rAF callback in the completion frame forced 6.1 ms of style and layout (frame 639.8 ms at 105047 ms)
PASS veil-effective
SUMMARY pv-ats12: 0 FAILs

# 5 pv-ats12-ux
REPORT veil-none-rendered: … 0 of 125 samples (most 0); 0 after the window; ux: 0 at the frame's start, 0 after drawing (of 1018 frames)
PASS veil-none-rendered
PASS veil-effective
SUMMARY pv-ats12-ux: 0 FAILs
```

## Clean-up

```sh
$B/lab-restore --lab 2 --owner veil-verdicts-173    # restore.log: exit 0
$B/lab-lock release --lab 2 --owner veil-verdicts-173
$B/lab-lock status                                  # release.log: labs 1, 2 and perf free
```

The logs here are the raw logs with URLs, ids and the home path replaced. Checked with:

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-veil-verdicts/*; echo $?   # 1: no match
```
