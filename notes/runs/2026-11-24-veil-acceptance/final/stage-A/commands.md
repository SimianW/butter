# Final veil acceptance, stage A commands (#177)

Run in the Stage A worktree. Timestamps are UTC on 2026-11-26. The harness is this
worktree's `lab/harness` at `aed9523`.

```sh
git rev-parse HEAD
git switch -c veil/177-final-a
git -C ~/Dev/butter branch --show-current
D=~/snap/chromium/common/veil-accept
for build in main3 veil3; do jq -r .version_name "$D/$build/butter/manifest.json"; done
```

```text
aed952361352d58de4a41ef211df8a289df893a5
Switched to a new branch 'veil/177-final-a'
main
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil3
```

The prebuilt directories were used as supplied. The file-by-file check against the two
commits found the expected `version_name` suffix as the only build-time edit to each tree.

```text
main3: 83 files match 3b9c3d5, with the expected manifest version_name suffix
veil3: 83 files match aed9523, with the expected manifest version_name suffix
```

## Sequence

The driver below adapts [round 2's sequence](../../round2/stage-A/seq.sh) and runs
the corrected trace from [round 2's retrace](../../round2/stage-A/retrace.sh) under the
same lock. Raw captures, the driver and its combined output stay in the local `C`
directory. The driver was syntax-checked with `bash -n "$C/seq.sh"` (exit 0, no output).

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

`seq.sh` as run:

```bash
#!/bin/bash
# Final stage A: run the interleaved comparison and then trace pre-layout if time allows.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A
D=~/snap/chromium/common/veil-accept
OWNER=veil-final-A
until
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --perf --wait 3600 --owner "$OWNER")
  rc=$?
  echo "acquire lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -eq 0 ]
do
  [ "$rc" -eq 75 ] || exit "$rc"
done

T0=$(date +%s)
N=0
cleanup() {
  "$B/lab-restore" --lab "$LAB" --owner "$OWNER" > "$C/restore.log" 2>&1
  echo "restore exit=$? at $(date -u +%FT%TZ)"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWNER" 2>&1 | tee "$C/release.log"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "SEQ DONE $(date -u +%FT%TZ) runs=$N since-lock=$(( $(date +%s) - T0 ))s"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run() {
  local NAME=$1 BUILD=$2
  shift 2
  local el=$(( $(date +%s) - T0 ))
  if [ "$el" -gt 1550 ] || [ "$N" -ge 10 ]; then
    echo "SKIP $NAME: ${el}s since lock, $N runs"
    return 99
  fi
  if rg -l '^FAIL (no-escape|server-unchanged)' "$C" -g '*.raw.log'; then
    echo "STOP $NAME: guard FAIL"
    return 99
  fi
  N=$((N+1))
  local started=$(date +%s)
  echo "start $NAME at $(date -u +%FT%TZ)"
  timeout --kill-after=5s "$((1780 - el))s"     env LAB_ID="$LAB" LAB_OWNER="$OWNER" EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
      PHASES=stream 'OPTS={"rail":true,"bookmark":true}' "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  local rc=$?
  echo "$NAME exit=$rc took=$(( $(date +%s) - started ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee "$C/$NAME.time"
  rg '^(PASS|FAIL|REPORT completion frame:|REPORT long animation frames,)' "$C/$NAME.raw.log"
  return 0
}
for i in 1 2 3; do
  run "main3-ats12-stream-$i" main3 || exit "$?"
  run "veil3-ats12-stream-$i" veil3 || exit "$?"
done
run veil3-ats12-trace-1 veil3 TRACE_AT=111100 TRACE_SPAN=10000 TAIL_MS=12000
```

## Execution output

The acquire and run timings, exit statuses, and release output below are from the
driver. Each replay's report and verdict lines are in its stripped `.log`.

```text
acquire start 2026-11-26T18:13:28Z
acquire lab=2 exit=0 at 2026-11-26T18:13:28Z
start main3-ats12-stream-1 at 2026-11-26T18:13:28Z
main3-ats12-stream-1 exit=0 took=199s since-lock=199s at 2026-11-26T18:16:47Z
start veil3-ats12-stream-1 at 2026-11-26T18:16:47Z
veil3-ats12-stream-1 exit=0 took=190s since-lock=389s at 2026-11-26T18:19:57Z
start main3-ats12-stream-2 at 2026-11-26T18:19:57Z
main3-ats12-stream-2 exit=0 took=190s since-lock=579s at 2026-11-26T18:23:07Z
start veil3-ats12-stream-2 at 2026-11-26T18:23:07Z
veil3-ats12-stream-2 exit=0 took=196s since-lock=775s at 2026-11-26T18:26:23Z
start main3-ats12-stream-3 at 2026-11-26T18:26:23Z
main3-ats12-stream-3 exit=0 took=195s since-lock=970s at 2026-11-26T18:29:38Z
start veil3-ats12-stream-3 at 2026-11-26T18:29:38Z
veil3-ats12-stream-3 exit=0 took=202s since-lock=1172s at 2026-11-26T18:33:00Z
start veil3-ats12-trace-1 at 2026-11-26T18:33:00Z
veil3-ats12-trace-1 exit=0 took=200s since-lock=1372s at 2026-11-26T18:36:20Z
restore exit=0 at 2026-11-26T18:36:30Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
SEQ DONE 2026-11-26T18:36:31Z runs=7 since-lock=1383s
```

## Extraction and stripping

```sh
P=notes/runs/2026-11-24-veil-acceptance/round2/stage-A
R=notes/runs/2026-11-24-veil-acceptance/final/stage-A
python3 -I "$P/runs.py" "$C"/{main3,veil3}-ats12-stream-{1,2,3}.json "$C/veil3-ats12-trace-1.json" > "$C/timing.jsonl"
python3 -I "$C/details.py" "$C"/{main3,veil3}-ats12-stream-{1,2,3}.json "$C/veil3-ats12-trace-1.json" > "$C/details.jsonl"
python3 -I "$P/prelayout-trace.py" "$C/veil3-ats12-trace-1.json" > "$C/prelayout-callbacks.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
python3 -I "$C/tables.py" "$C" > "$C/tables.md"
```

The extraction commands exited 0. The detailed output and helper scripts stay in
`C`. The trace parser selects the renderer main thread by `UpdateLayoutTree`
events and aligns its timestamps with `lab-trace-start`. Source attribution for
pre-layout is the offscreen script within each `FireIdleCallback`. The trace
reported 25,459 events. [Extracted results](summary.md).

The stripped logs retain verdicts and timing reports. The filter drops button
labels and the dumped rAF function snippets. It replaces private URLs and
identifiers and abbreviates the home directory. Raw logs, captures, and trace
events stay in `C`. The lab's restore result was `ok:true`.

## Verification

```sh
(cd "$R" && grep -c FAIL -- *.log)
(cd "$R" && grep -c '^FAIL ' -- *.log)
~/.local/share/chatgpt-lab/bin/lab-lock status
```

The first grep returned 1 match in each of the seven replay logs and 0 in both
cleanup logs. The anchored grep returned 0 in all nine logs. Its exit code was 1
because none of the lines matched. The private-data scan found no matches for chat
URLs, private endpoints, email addresses, UUIDs, extension IDs or absolute home paths.

A separate post-release status read returned this output after Stage B took the lab.

```json
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-B"}
{"lab": "perf", "held": true, "owner": "veil-final-B"}
```
