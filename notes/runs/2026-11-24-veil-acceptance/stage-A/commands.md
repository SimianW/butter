# Commands: veil acceptance, stage A (#177), 2026-11-24

Run from the worktree of branch `veil/177-stage-a` (based on `feat/implement-spec-170` at `e5f480e`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-A` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

## Builds (outside the repo; later stages reuse them)

```sh
for pair in head:547fa0a veil:e5f480e; do n=${pair%%:*}; s=${pair#*:}
  mkdir -p $D/$n && git archive $s extension | tar -x -C $D/$n && mv $D/$n/extension $D/$n/butter \
  && node --check $D/$n/butter/stream/offscreen.js && echo "$n ($s) ok"; done
grep -c veil $D/*/butter/stream/containment.css
# then version_name "0.1.0-alpha.22" -> "0.1.0-alpha.22+veilaccept.<n>" in each manifest.json
```
```text
head (547fa0a) ok
veil (e5f480e) ok
.../head/butter/stream/containment.css:0
.../veil/butter/stream/containment.css:16
```

- head = `547fa0a` (`main` before the change; merge of #169). veil = `e5f480e` (integration branch
  `feat/implement-spec-170`, merge of #176). The two builds differ only in `stream/containment.css`,
  `stream/offscreen.js` and `dev/allowlist.js` (`diff -rq`).

## Lock

```sh
LAB=$($B/lab-lock acquire --lab auto --owner veil-accept-A --wait 1800 --perf)   # 02:06:43Z
```
```text
lab=1 exit=0
```

`--lab auto` without `--needs-fixture` took lab 1, which has no `ats12` fixture (labs.json: lab 1
has `math12` only) and whose browser was stopped. The first run there (`lab1-attempt.log`) failed at
`connectOverCDP` (`ECONNREFUSED 127.0.0.1:9222`) before it loaded a page; its `restart-browser` had no
display and died. Lab 1 was put back as found (`LAB_ID=1 $B/lab stop`, stale `run/extensions` removed,
status all stopped), its lock released, and lab 2 taken:

```sh
$B/lab-lock release --lab 1 --owner veil-accept-A
LAB=$($B/lab-lock acquire --lab 2 --needs-fixture ats12 --owner veil-accept-A --wait 1800 --perf)   # 02:07:59Z
```
```text
{"lab": 1, "lab_released": true, "perf_released": true}
lab=2 exit=0
```

The budget clock kept running from 02:06:43Z and the failed attempt counted as a harness run.

## Runs (lab 2, one lock, interleaved head, veil, head, veil, head, veil)

Each run went through a wrapper (`/tmp/va177a/run.sh NAME BUILD`) that refused to start after
1500 s of the budget clock, after 10 runs, or after a `FAIL no-escape`/`FAIL server-unchanged`, then ran:

```sh
env LAB_ID=2 LAB_OWNER=veil-accept-A EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `lab1-attempt` | head | 2 | 35 s | 37 s |
| 2 | `head-ats12-1` | head | 0 | 194 s | 273 s |
| 3 | `veil-ats12-1` | veil | 0 | 191 s | 467 s |
| 4 | `head-ats12-2` | head | 0 | 199 s | 668 s |
| 5 | `veil-ats12-2` | veil | 0 | 190 s | 860 s |
| 6 | `head-ats12-3` | head | 0 | 190 s | 1053 s |
| 7 | `veil-ats12-3` | veil | 0 | 190 s | 1245 s |

## Restore and release

```sh
$B/lab-restore --lab 2 --owner veil-accept-A
$B/lab-lock release --lab 2 --owner veil-accept-A
$B/lab-lock status
```
```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 02:27:41Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Logs

`<name>.log` holds each run's `PASS`/`FAIL`/`REPORT`/`SUMMARY` lines plus the wrapper's exit/time
line; `restore.log` and `release.log` as printed (home URL replaced by `<home-url>`). The raw logs and
the per-run JSON (every long animation frame) stay in `C`. A scan of the raw logs for chat URLs, email
addresses and home paths found none.
