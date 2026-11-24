# Commands — Smoother streaming stage 5 (stream ux), 2026-11-24

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`).
- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-ux`.
- `H` is `~/snap/chromium/common/stream-audit-1123/butter`.
- `P` is `~/snap/chromium/common/stream-proto-1124`.

Each replay ran through a wrapper outside the repo (`/tmp/ux1124/run.sh NAME EXT [VAR=value…]`):
- It refused to start after 1500 s of the lock, after 10 runs, or after any earlier `FAIL no-escape` / `FAIL server-unchanged`.
- It then ran `env LAB_ID=2 LAB_OWNER=stream-ux-1124 EXT=<dir> LABEL=<name> FIXTURE=ats12 PHASES=stream UX=… [U2_BLOCK=…] TAIL_MS=… OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log`.

## Before the lock

```sh
npx eslint lab/harness/stream-*.mjs; echo eslint-exit=$?          # 0
node --check lab/harness/stream-ux-probe.mjs && node --check lab/harness/stream-replay-live.mjs   # syntax-ok
wc -l lab/harness/stream-replay-live.mjs lab/harness/stream-ux-probe.mjs   # 500, 329 (339 after the runs' two changes)
RUNS="pvh:u1" node /tmp/ux1124/dry.mjs                                    # synthetic page, headless snap Chromium
RUNS="pvh:u2 pvh:u3 pv:u1,u4 head:u1,u4" node /tmp/ux1124/dry.mjs
```
```text
pvh u1: 1021 frames; jump at +6 ms; 2 frames veiled (77777--); view shift 0; last block in view; errs []
pvh u2: block 150 of 301 (flags 15, 21/21 held around); 2 frames veiled; shift 0
pvh u3: 120 notches every 100 ms; 0 doc shift; last (closing) step dY 0
pv u1,u4: find true, no scroll; scrollIntoView rendered at frame 1; select 56705 vs innerText 8503 (synthetic)
head u1,u4: same, skipped instead of veiled
```

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-ux-1124 --wait 1800 --perf
```
```text
LAB=2 exit=0    # taken 21:15:30 UTC, after waiting for another task's lock
```

## Runs

| # | Name | EXT | Options | UTC | Exit |
|---|---|---|---|---|---:|
| 1 | `pvh-u1` | P/pvh | `UX=u1 TAIL_MS=18000` | 21:15:35–21:19:07 | 1 |
| — | probe: sample after each frame is drawn (MessageChannel from rAF), eslint 0, dry pvh u1 | | | 21:19–21:20 | |
| 2 | `head-u1u4` | H | `UX=u1,u4 TAIL_MS=24000` | 21:20:16–21:23:47 | 0 |
| 3 | `pvh-u2` | P/pvh | `UX=u2 TAIL_MS=18000` | 21:23:51–21:27:16 | 0 |
| 4 | `head-u2-nostart` | H | `UX=u2 U2_BLOCK=306 TAIL_MS=18000` | 21:27:20–21:31:30 | 0 (probe saw no in_progress) |
| — | probe: sampler starts 8 s (was 2.5 s) before the last chunk | | | 21:31 | |
| 5 | `head-u2` | H | `UX=u2 U2_BLOCK=306 TAIL_MS=18000` | 21:31:47–21:35:11 | 0 |
| 6 | `pvh-u3` | P/pvh | `UX=u3 TAIL_MS=16000` | 21:35:14–21:38:41 | 0 |
| 7 | `pv-u1u4` | P/pv | `UX=u1,u4 TAIL_MS=24000` | 21:38:46–21:42:20 | 0 |

Every run printed `PASS` for `replay-hook`, `replay-streams`, `in-progress`, `cv-blocks`, `seen-marks`, `throttle-matched`, `rail-new-tick`, `rail-new-tick-lit`, `no-escape` and `server-unchanged`. `stream-no-jump` passed except in run 1:
`FAIL stream-no-jump: scrollTop fell by more than a viewport 6 times while streaming: 94726 → 91808, 91808 → 90603, 90603 → 89483`.

Key lines: see the REPORT quotes in report.md; every `REPORT ux …` line is in the run logs and in `data.json` (`reportUx`).

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-ux-1124          # 21:42:24–21:42:34
$B/lab-lock release --lab 2 --owner stream-ux-1124
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":495006,"extensions":[],"flags":[]},"at":"2026-11-24T21:42:34.501Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

```sh
python3 /tmp/ux1124/build.py   # sanitized logs (home → ~, URLs → <url>, ids → <id>) and data.json from $C/*.json
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-stream-ux/*; echo $?   # 1: no match
for f in notes/runs/2026-11-24-stream-ux/*.log; do tail -n 1 $f; done   # 7 × SUMMARY (pvh-u1: 1 FAIL, others 0 FAILs)
git status --short extension/    # (empty)
npx eslint lab/harness/stream-*.mjs; echo $?   # 0
```
