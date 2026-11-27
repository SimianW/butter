# Veil4 acceptance, stage A commands (#177)

Run in the Stage A worktree. The harness is this worktree's `lab/harness` at
`004851d`. Timestamps are UTC on 2026-11-26.

```sh
git rev-parse HEAD
git switch -c veil/177-veil4-a
git -C ~/Dev/butter branch --show-current
D=~/snap/chromium/common/veil-accept
for build in main3 veil4 veil3; do jq -r .version_name "$D/$build/butter/manifest.json"; done
```

```text
004851dc49a01f80df9fae8dc663da128d55cfc7
Switched to a new branch 'veil/177-veil4-a'
main
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil4
0.1.0-alpha.22+veilaccept.veil3
```

The sequence used the prebuilt directories as supplied. The driver adapts
[veil3 stage A's driver](../../final/stage-A/commands.md). Its raw captures,
exact script and combined output stay in the local capture directory.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-A
bash -n "$C/seq.sh" && (set -o pipefail && bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log")
```

## Driver as executed

```bash
#!/bin/bash
# Veil4 stage A: run the interleaved comparison and the veil3 anchor.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-A
D=~/snap/chromium/common/veil-accept
OWNER=veil4-A
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
  echo "release exit=${PIPESTATUS[0]}"
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
  run "veil4-ats12-stream-$i" veil4 || exit "$?"
done
run veil3-ats12-stream-anchor veil3
```

## Execution output

Each replay’s verdicts and timing reports are in its stripped log.

```text
acquire start 2026-11-26T22:10:02Z
acquire lab=2 exit=0 at 2026-11-26T22:10:02Z
start main3-ats12-stream-1 at 2026-11-26T22:10:02Z
main3-ats12-stream-1 exit=0 took=195s since-lock=195s at 2026-11-26T22:13:17Z
start veil4-ats12-stream-1 at 2026-11-26T22:13:17Z
veil4-ats12-stream-1 exit=0 took=197s since-lock=392s at 2026-11-26T22:16:34Z
start main3-ats12-stream-2 at 2026-11-26T22:16:34Z
main3-ats12-stream-2 exit=0 took=196s since-lock=588s at 2026-11-26T22:19:50Z
start veil4-ats12-stream-2 at 2026-11-26T22:19:50Z
veil4-ats12-stream-2 exit=0 took=197s since-lock=785s at 2026-11-26T22:23:07Z
start main3-ats12-stream-3 at 2026-11-26T22:23:07Z
main3-ats12-stream-3 exit=0 took=190s since-lock=975s at 2026-11-26T22:26:17Z
start veil4-ats12-stream-3 at 2026-11-26T22:26:17Z
veil4-ats12-stream-3 exit=0 took=195s since-lock=1170s at 2026-11-26T22:29:32Z
start veil3-ats12-stream-anchor at 2026-11-26T22:29:32Z
veil3-ats12-stream-anchor exit=0 took=194s since-lock=1364s at 2026-11-26T22:32:46Z
restore exit=0 at 2026-11-26T22:32:56Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
SEQ DONE 2026-11-26T22:32:57Z runs=7 since-lock=1375s
```

## Extraction and stripping

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-A
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-A
H=notes/runs/2026-11-24-veil-acceptance/final/stage-A
runs=("$C"/{main3,veil4}-ats12-stream-{1,2,3}.json "$C/veil3-ats12-stream-anchor.json")
python3 -I "$C/runs.py" "${runs[@]}" > "$C/timing.jsonl"
python3 -I "$P/details.py" "${runs[@]}" > "$C/details.jsonl"
python3 -I "$P/strip.py" "$C" "$R"
python3 -I "$C/tables.py" "$C" > "$C/tables.md"
python3 -I "$C/comparison.py" "$C" "$H/summary.md" > "$C/comparison.md"
grep -c '^FAIL' -- "$R"/*.log | tee "$C/fail-counts.txt"
python3 -I "$C/document-commands.py" "$C" "$R" > "$R/commands.md"
```

The extraction commands wrote the timing and geometry rows and the tables used
in the [summary](summary.md). The log filter keeps timing reports and verdicts.
It drops button inventories and rAF source snippets, replaces private URLs
and identifiers, and abbreviates the home path. Raw captures stay local.

```text
main3-ats12-stream-1.log:0
main3-ats12-stream-2.log:0
main3-ats12-stream-3.log:0
release.log:0
restore.log:0
veil3-ats12-stream-anchor.log:0
veil4-ats12-stream-1.log:0
veil4-ats12-stream-2.log:0
veil4-ats12-stream-3.log:0
```

The first comparison extraction stopped with `ValueError: not enough values
to unpack (expected at least 8, got 6)`. The local parser was adjusted to read
the historical per-run table, and the extraction then succeeded. The captures
were used as recorded.

## Verification

```sh
~/.local/share/chatgpt-lab/bin/lab-lock status
git -C ~/Dev/butter branch --show-current
git diff --cached --check
```

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
main
```

The staged whitespace check exited 0 without output. The log scan found no
private URLs, UUIDs, email addresses, extension IDs or absolute home paths.
