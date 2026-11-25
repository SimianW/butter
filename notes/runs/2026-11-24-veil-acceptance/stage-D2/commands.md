# Commands: veil acceptance, stage D2 (#177), 2026-11-25

Run from the worktree of branch `veil/177-stage-d2`, based on `feat/implement-spec-170` at `01865e6`,
with the find-bar mode committed first (`9acab44`). The harness is this checkout's `lab/harness`.

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/stage-D2`: raw logs and per-run JSON, kept local.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC.

## The probe, before the lab

- `U4_FINDBAR=1` (with `UX=u4`): `lab/harness/stream-findbar-probe.mjs` drives the find bar through
  `lab/harness/xtest-type.py`, which runs a JSON key sequence from stdin as XTest input and prints
  one epoch time stamp per key press (never the characters). `stream-ux-probe.mjs` exposes u4's block
  pick (`pickHeld`) and helpers. `stream-replay-live.mjs` passes the lab's display to the probe.
- `findbarAnalyse` (pure) is unit-tested in `test/stream-findbar-probe.test.mjs` (5 tests).
- Local proof on Xvfb (`xvfb-run -n 207 -s '-screen 0 1600x1000x24'`, Playwright's Chromium headed, a
  600-block `content-visibility: auto` page, a fake `window.__ux`), calling `findbarDrive` itself:
  - the page saw only Ctrl+F (ControlLeft, KeyF), 1.2–1.9 ms from the helper's stamp;
  - the scroller moved from 0 to 25,242 to the match;
  - after Escape the 23-character match was selected inside the block.

```sh
node --test test/stream-findbar-probe.test.mjs   # tests 5, pass 5, fail 0
npm run check                                    # exit 0; tests 972, pass 972; python 174 OK
```

## Builds (reused from stage A, not rebuilt)

```sh
for n in head veil; do grep version_name $D/$n/butter/manifest.json; done
for p in head:547fa0a veil:e5f480e; do n=${p%%:*}; s=${p#*:}; T=$(mktemp -d); git archive $s extension | tar -x -C $T; echo "== $n vs $s"; diff -rq $T/extension $D/$n/butter; rm -rf $T; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
  "version_name": "0.1.0-alpha.22+veilaccept.veil",
== head vs 547fa0a
Files <tmp>/extension/manifest.json and ~/snap/chromium/common/veil-accept/head/butter/manifest.json differ
== veil vs e5f480e
Files <tmp>/extension/manifest.json and ~/snap/chromium/common/veil-accept/veil/butter/manifest.json differ
```

## Lock, runs, restore and release

The driver is [driver.sh](driver.sh) (`acquire`, `run <name>...`, `end`), with one lock across all
three steps, so that a failed dry run could be fixed without dropping the lock.

- It refuses a run after 1,550 s from the lock, after 10 runs, or after a `FAIL no-escape` or
  `FAIL server-unchanged`.
- It stops when a run fails before the replay, or when the find bar did not reach the block.
- Its output is in [seq.log](seq.log).

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-D2 --wait 3600 --perf)
# per run, the dry run first: head-1, then veil-1, head-2, veil-2, head-3, veil-3
env LAB_ID=$LAB LAB_OWNER=veil-accept-D2 EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u4 U4_FINDBAR=1 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
node findbar-extract.mjs $C/{head,veil}-ats12-u4fb-{1,2,3}.json > findbar.jsonl   # exit 0
$B/lab-restore --lab $LAB --owner veil-accept-D2
$B/lab-lock release --lab $LAB --owner veil-accept-D2
$B/lab-lock status
```
```text
acquire start 2026-11-25T22:59:40Z
lab=2 exit=0 at 2026-11-25T23:20:42Z
restore exit=0 (restarted the browser without extensions; "ok":true)   # 23:42:15Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T23:42:15Z since-lock=1293s runs=6
```

| # | Name | Build | Exit | Took | Budget clock at end | Verdicts |
|---:|---|---|---:|---:|---:|---|
| 1 | `head-ats12-u4fb-1` (dry run) | head | 0 | 208 s | 212 s | 12 PASS, 0 FAIL |
| 2 | `veil-ats12-u4fb-1` | veil | 0 | 210 s | 427 s | 13 PASS, 0 FAIL |
| 3 | `head-ats12-u4fb-2` | head | 0 | 209 s | 636 s | 12 PASS, 0 FAIL |
| 4 | `veil-ats12-u4fb-2` | veil | 0 | 208 s | 844 s | 13 PASS, 0 FAIL |
| 5 | `head-ats12-u4fb-3` | head | 0 | 214 s | 1,058 s | 12 PASS, 0 FAIL |
| 6 | `veil-ats12-u4fb-3` | veil | 0 | 213 s | 1,271 s | 13 PASS, 0 FAIL |

Six harness runs, 21 min 33 s from lock to release. The acquire waited 21 min behind `veil-accept-D3`.

## Files

- **`<name>.log`:** each run's full harness output plus the driver's exit and time line.
- **`seq.log`, `restore.log`, `release.log`:** as printed.
- **`findbar.jsonl`:** one line per run, then the medians per build. It holds no chat text.
- **`findbar-extract.mjs`:** makes `findbar.jsonl`.
- **`driver.sh`:** the driver.

The ChatGPT project URL was replaced by `<home-url>` and the home folder by `~`. A scan of this folder
for `chatgpt.com`, `/home/` and email addresses found none.
