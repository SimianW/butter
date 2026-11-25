# Commands: veil acceptance, stage B (#177), 2026-11-24

Run from the worktree of branch `veil/177-stage-b` (based on `feat/implement-spec-170` at `72ad24a`; the
harness is this checkout's `lab/harness`). `B` is `~/.local/share/chatgpt-lab/bin`; `C` is
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-B` (raw logs and per-run JSON, kept local);
`D` is `~/snap/chromium/common/veil-accept`. Times are UTC, 2026-11-25.

## Builds (reused from stage A, not rebuilt)

```sh
for n in head veil; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n check ok"; done
grep -c veil $D/*/butter/stream/containment.css
diff -rq $D/head/butter $D/veil/butter
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head check ok
  "version_name": "0.1.0-alpha.22+veilaccept.veil",
veil check ok
.../veil/butter/stream/containment.css:16
.../head/butter/stream/containment.css:0
Files .../head/butter/dev/allowlist.js and .../veil/butter/dev/allowlist.js differ
Files .../head/butter/manifest.json and .../veil/butter/manifest.json differ
Files .../head/butter/stream/containment.css and .../veil/butter/stream/containment.css differ
Files .../head/butter/stream/offscreen.js and .../veil/butter/stream/offscreen.js differ
```

- head = `547fa0a` (`main` before the change), veil = `e5f480e` (integration branch at #176's merge), as
  stage A built them; the `version_name` suffixes and the same four differing files confirm it.

## Lock, runs, restore and release (one script, one lock)

A driver script (`/tmp/va177b/seq.sh`, run once, in the background) did the whole sequence. It took the
lock with the fixture named (stage A lost a run to `--lab auto` picking lab 1), ran head and veil in
turn, refused to start a run after 1500 s of the budget clock, after 10 runs, or after a
`FAIL no-escape`/`FAIL server-unchanged`, and ran restore and release from an exit trap:

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture math9 --owner veil-accept-B --wait 1800 --perf)
# for i in 1 2 3, for BUILD in head veil:
env LAB_ID=$LAB LAB_OWNER=veil-accept-B EXT=$D/<build>/butter LABEL=<name> FIXTURE=math9 OUT=$C/<name>.json \
  PHASES=stream 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-B
$B/lab-lock release --lab $LAB --owner veil-accept-B
$B/lab-lock status
```
```text
acquire start 2026-11-25T02:30:15Z
lab=2 exit=0 at 2026-11-25T02:37:31Z
```

Lab 2 was held by another task (`rail-pin-171d`) at the start; the acquire waited 7 min 16 s. The budget
clock starts at 02:37:31Z, when the lock was taken.

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-math9-1` | head | 0 | 198 s | 198 s |
| 2 | `veil-math9-1` | veil | 0 | 195 s | 393 s |
| 3 | `head-math9-2` | head | 0 | 197 s | 590 s |
| 4 | `veil-math9-2` | veil | 0 | 198 s | 788 s |
| 5 | `head-math9-3` | head | 0 | 201 s | 989 s |
| 6 | `veil-math9-3` | veil | 0 | 201 s | 1190 s |

```text
restore exit=0 (restarted the browser without extensions; "ok":true)   # 02:57:32Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-25T02:57:32Z since-lock=1201s
```

Six harness runs, 20 min 1 s from lock to release.

## Logs

`<name>.log` is each run's full harness output plus the driver's exit/time line; `restore.log` and
`release.log` as printed (home URL replaced by `<home-url>`, the home folder by `~`). The raw logs and
per-run JSON (every long animation frame) stay in `C`. A scan of the committed files for chat URLs,
email addresses and home paths found none after those two replacements.
