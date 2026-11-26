# Commands for final veil acceptance stage B (#177)

Run on 2026-11-26 UTC from the worktree at `aed9523` on `veil/177-final-b`. The main checkout stayed on `main`.
The acceptance runs used `math9`, `PHASES=stream`, and the shipped settings with rail and bookmarks enabled.
Both builds came from the final-round plan.

## Setup

```sh
git status --short --branch
git rev-parse --short HEAD
gh issue view 177 --repo SimianW/butter
gh issue view 170 --repo SimianW/butter --json body --jq .body
for build in main3 veil3; do
  rg 'version_name' "$HOME/snap/chromium/common/veil-accept/$build/butter/manifest.json"
done
git switch -c veil/177-final-b
```

```text
## test/veil-177-final-b
aed9523
  "version_name": "0.1.0-alpha.22+veilaccept.main3",
  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
Switched to a new branch 'veil/177-final-b'
```

Both issue reads succeeded. [Ticket #177](https://github.com/SimianW/butter/issues/177) and the
Acceptance runs table in [spec #170](https://github.com/SimianW/butter/issues/170) give the thresholds.
The worktree already had Playwright. The final-round plan identifies `main3` as `3b9c3d5` and
`veil3` as `aed9523`.

## Lock, timed runs, trace, restore and release

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-B
mkdir -p "$C"
bash -n "$C/seq.sh" && (set -o pipefail; bash "$C/seq.sh" | tee "$C/sequence.log")
```

An initial acquire began at 18:13:37Z. I terminated that wait at 18:14:23Z, exit 143, while stage A
still held the lab and perf locks. It acquired no lock and started no run. I started the revised
driver at 18:14:41Z to include the post-completion diagnostic after the six acceptance runs.
The two acquire attempts used the same fixture, owner and wait settings. The complete second
driver is below.

```bash
#!/bin/bash
# Final stage B: six interleaved acceptance runs and one post-completion diagnostic.
set -u -o pipefail
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-B
D=~/snap/chromium/common/veil-accept
OWNER=veil-final-B
WT=$PWD
while true; do
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture math9 --perf --wait 3600 --owner "$OWNER"); rc=$?
  echo "lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -ne 75 ] && break
done
[ "$rc" -eq 0 ] && [ -n "$LAB" ] || exit 1
T0=$(date +%s)
cleanup() {
  echo "restore start $(date -u +%FT%TZ)"
  "$B/lab-restore" --lab "$LAB" --owner "$OWNER" > "$C/restore.log" 2>&1
  local restore_rc=$?
  echo "restore exit=$restore_rc"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWNER" 2>&1 | tee "$C/release.log"
  local release_rc=$?
  echo "release exit=$release_rc"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "done $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"
  if (( restore_rc || release_rc )); then exit 1; fi
}
trap cleanup EXIT
n=0
run() {
  local BUILD=$1 NAME=$2
  shift 2
  local elapsed=$(( $(date +%s) - T0 ))
  if (( elapsed > 1500 || n >= 10 )); then echo "REFUSE $NAME: ${elapsed}s since lock, $n runs"; return 99; fi
  if grep -qE '^FAIL (no-escape|server-unchanged)' "$C"/*.raw.log 2>/dev/null; then
    echo "REFUSE $NAME: guard FAIL"
    return 99
  fi
  n=$((n+1))
  local start=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  ( cd "$WT" && timeout --kill-after=5s "$((1770 - elapsed))s" env LAB_ID="$LAB" LAB_OWNER="$OWNER" \
      EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=math9 OUT="$C/$NAME.json" PHASES=stream \
      'OPTS={"rail":true,"bookmark":true}' "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1 )
  local rc=$?
  echo "$NAME exit=$rc elapsed=$(( $(date +%s) - start ))s since-lock=$(( $(date +%s) - T0 ))s" | tee "$C/$NAME.time"
  grep -E '^PASS [a-z-]+$|^SUMMARY ' "$C/$NAME.raw.log"
  grep -E '^REPORT (completion frame|laf histogram|long animation frames|build|veil-effective|trace:)' "$C/$NAME.raw.log" | cut -c1-350
  if (( rc != 0 )); then echo "ERROR: $NAME exited $rc; see its private raw log"; fi
}
for i in 1 2 3; do
  run main3 "main3-math9-default-$i" || exit $?
  run veil3 "veil3-math9-default-$i" || exit $?
done
run veil3 veil3-math9-default-prelayout TRACE_AT=113600 TRACE_SPAN=15000 TAIL_MS=16000
```

The driver printed the following timing and cleanup lines. Each run's complete harness
output is in its own stripped log.

```text
acquire start 2026-11-26T18:14:41Z
lab=2 exit=0 at 2026-11-26T18:36:31Z
run 1 main3-math9-default-1 start 2026-11-26T18:36:31Z
main3-math9-default-1 exit=0 elapsed=197s since-lock=197s
run 2 veil3-math9-default-1 start 2026-11-26T18:39:48Z
veil3-math9-default-1 exit=0 elapsed=197s since-lock=394s
run 3 main3-math9-default-2 start 2026-11-26T18:43:05Z
main3-math9-default-2 exit=1 elapsed=200s since-lock=594s
run 4 veil3-math9-default-2 start 2026-11-26T18:46:25Z
veil3-math9-default-2 exit=0 elapsed=207s since-lock=801s
run 5 main3-math9-default-3 start 2026-11-26T18:49:52Z
main3-math9-default-3 exit=0 elapsed=200s since-lock=1001s
run 6 veil3-math9-default-3 start 2026-11-26T18:53:12Z
veil3-math9-default-3 exit=0 elapsed=201s since-lock=1202s
run 7 veil3-math9-default-prelayout start 2026-11-26T18:56:33Z
veil3-math9-default-prelayout exit=0 elapsed=217s since-lock=1419s
restore start 2026-11-26T19:00:10Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T19:00:21Z since-lock=1430s
```

`lab-restore` restarted the browser without extensions, cleared the composer and reported
`"ok":true`. Both locks had been released when the driver's `lab-lock status` ran.
[Restore output](restore.log) · [Release output](release.log)

## Pre-layout and per-run measurements

The seventh run took a post-completion CDP trace with the harness's default trace categories and
a 16 s tail. I launched a read-only CDP sampler alongside that run. It took a sample about every
500 ms, reading the active thread scroller's `scrollTop` and `scrollHeight` and mapping timestamps
to the harness's Enter and `in_progress gone` marks.

```sh
node "$C/observe-geometry.mjs" "$C" > "$C/geometry.log" 2> "$C/geometry.err"
python3 -I notes/runs/2026-11-24-veil-acceptance/round2/stage-A/prelayout-trace.py \
  "$C/veil3-math9-default-prelayout.json" > "$C/prelayout-callbacks.jsonl"
python3 "$C/extract.py" "$C" > "$C/measurements.txt"
```

The geometry command exited 0 and stderr was empty. It wrote 30 rows from +423 ms to +15230 ms,
all with `scrollTop` 142801 and `scrollHeight` 228685. The trace extractor found 167 idle callbacks
in `stream/offscreen.js`, with the last ending at +4928.5 ms. The timing extractor read the
JSON and checked each completion, blocking and rAF value against its corresponding log line.
The medians and late frames are in [summary.md](summary.md).

## Stripped logs and verification

```sh
R=notes/runs/2026-11-24-veil-acceptance/final/stage-B
python3 "$C/strip.py" "$C" "$R"
grep -c FAIL "$R"/*.log
grep -n '^FAIL ' "$R"/*.log
rg -c '^PASS ' "$R"/*math9*.log
```

```text
geometry.log:0
main3-math9-default-1.log:1
main3-math9-default-2.log:2
main3-math9-default-3.log:1
release.log:0
restore.log:0
veil3-math9-default-1.log:1
veil3-math9-default-2.log:1
veil3-math9-default-3.log:1
veil3-math9-default-prelayout.log:1
main3-math9-default-2.log:56:FAIL veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 1 of 119 samples (most 1); 0 after the window
```

The counts above include each harness's `SUMMARY` line. The anchored match is the single failing
verdict. The privacy scan found no full URLs, email addresses, account UUIDs, extension IDs,
private endpoints or home-directory prefixes in the stripped logs. Raw logs, per-run JSON,
trace, and local helper scripts are in `C`.
