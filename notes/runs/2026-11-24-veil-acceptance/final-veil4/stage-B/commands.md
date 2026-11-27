# Veil4 acceptance stage B commands (#177)

The harness ran in the stage worktree on `veil/177-veil4-b`. The starting branch
`test/veil4-acceptance-stage-b` pointed to the same commit as
`feat/implement-spec-170`. Times are UTC on 2026-11-26.

## Setup

```sh
git status --short --branch
git rev-parse HEAD
git -C ~/Dev/butter branch --show-current
for build in main3 veil4; do jq -r .version_name ~/snap/chromium/common/veil-accept/"$build"/butter/manifest.json; done
node --version
test -r lab/harness/stream-replay-live.mjs
git switch -c veil/177-veil4-b
```

```text
## test/veil4-acceptance-stage-b
6a2288efb16ab550d4bd2bdfe2baf34625f19d25
main
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil4
v24.17.0
Switched to a new branch 'veil/177-veil4-b'
```

`test -r` exited 0. The final-round plan identifies these existing builds as main3
(`3b9c3d5`) and veil4 (`004851d`).

## Sequence

The driver adapts [veil3 stage B](../../final/stage-B/commands.md) for the new
build and the six acceptance runs.

```sh
umask 077
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-B
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-B
mkdir -p "$C"
sed -e 's/^# Final stage B:.*/# Veil4 stage B: six interleaved acceptance runs./' -e 's@/final/stage-B@/final-veil4/stage-B@g' -e 's/veil-final-B/veil4-B/g' -e '/^run veil3 veil3-math9-default-prelayout /d' -e 's/veil3/veil4/g' -e '/^trap cleanup EXIT/a trap '\''exit 130'\'' INT\ntrap '\''exit 143'\'' TERM' "$P/seq.sh" > "$C/seq.sh"
bash -n "$C/seq.sh" && (set -o pipefail; bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log")
```

The complete driver as executed follows.

```bash
#!/bin/bash
# Veil4 stage B: six interleaved acceptance runs.
set -u -o pipefail
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-B
D=~/snap/chromium/common/veil-accept
OWNER=veil4-B
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
trap 'exit 130' INT
trap 'exit 143' TERM
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
  run veil4 "veil4-math9-default-$i" || exit $?
done
```

## Continuation after the tool session disconnected

The original shell stopped during the first `main3` replay before it could
record the process exit or run the cleanup trap. The surviving harness process
finished and wrote its JSON. The checks below confirmed its summary and that
no veil4 replay had started. The lab and perf locks still belonged to
`veil4-B`. The resumed driver used the original acquisition time for the same
budget and ran the remaining five replays.

```sh
test -s "$C/main3-math9-default-1.json"
rg -qx 'SUMMARY main3-math9-default-1: 0 FAILs' "$C/main3-math9-default-1.raw.log"
test ! -e "$C/veil4-math9-default-1.raw.log"
awk '
  /^while true; do/ {
    print "LAB=2"
    print "T0=$(date -u -d 2026-11-26T22:57:48Z +%s)"
    print "\"$B/lab-lock\" status | jq -es --arg owner \"$OWNER\" \x27any(.[]; .lab == 2 and .owner == $owner) and any(.[]; .lab == \"perf\" and .owner == $owner)\x27 > /dev/null || exit 1"
    print "echo \"resume lab=$LAB at $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s\""
    skipping=1
    next
  }
  skipping && /^T0=/ { skipping=0; next }
  skipping { next }
  /^n=0/ { print "n=1"; next }
  /^for i in 1 2 3;/ {
    print "run veil4 veil4-math9-default-1 || exit $?"
    print "for i in 2 3; do"
    next
  }
  { print }
' "$C/seq.sh" > "$C/resume.sh"
bash -n "$C/resume.sh"
printf '%s\n' 'main3-math9-default-1 exit=unobserved elapsed=unobserved (0 FAILs in harness summary)' > "$C/main3-math9-default-1.time"
setsid --wait bash -c 'set -o pipefail; bash "$1/resume.sh" 2>&1 | tee -a "$1/sequence.log"' bash "$C"
```

The validation commands and driver syntax check exited 0 with no output.
The first replay's raw log includes these lines.

```text
PASS no-escape
PASS server-unchanged
SUMMARY main3-math9-default-1: 0 FAILs
```

## Sequence output

The timing and cleanup lines follow. The individual stripped logs contain the
full timing reports and verdicts from each replay. The continuation command
exited 0.

```text
acquire start 2026-11-26T22:35:30Z
lab=2 exit=0 at 2026-11-26T22:57:48Z
run 1 main3-math9-default-1 start 2026-11-26T22:57:48Z
resume lab=2 at 2026-11-26T23:01:40Z since-lock=232s
run 2 veil4-math9-default-1 start 2026-11-26T23:01:40Z
veil4-math9-default-1 exit=0 elapsed=197s since-lock=429s
run 3 main3-math9-default-2 start 2026-11-26T23:04:57Z
main3-math9-default-2 exit=0 elapsed=194s since-lock=623s
run 4 veil4-math9-default-2 start 2026-11-26T23:08:11Z
veil4-math9-default-2 exit=1 elapsed=195s since-lock=818s
ERROR: veil4-math9-default-2 exited 1; see its private raw log
run 5 main3-math9-default-3 start 2026-11-26T23:11:26Z
main3-math9-default-3 exit=0 elapsed=195s since-lock=1013s
run 6 veil4-math9-default-3 start 2026-11-26T23:14:41Z
veil4-math9-default-3 exit=0 elapsed=207s since-lock=1220s
restore start 2026-11-26T23:18:08Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T23:18:20Z since-lock=1232s
```

Restore restarted lab 2 with its default empty extension set, cleared the
composer and returned `"ok":true`. [Restore log](restore.log) · [Release log](release.log)

## Extraction and log checks

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-B
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-B
python3 -I "$C/extract.py" "$C" > "$C/measurements.txt"
python3 -I "$C/strip.py" "$C" "$R"
(cd "$R" && grep -Hc '^FAIL' -- *.log)
(cd "$R" && grep -Hn '^FAIL ' -- *.log)
(cd "$R" && rg -Hc '^PASS ' *math9*.log | sort)
```

The extractor checked completion-frame duration and blocking, window
blocking, the completion rAF and the count of frames at least 1 s against
the reports in each log. It also extracted late frames, geometry and flagged
opacity samples. Its measured values are in the [summary](summary.md).
The local filter retains timing reports and verdicts, drops button
inventories and rAF source snippets, and redacts private identifiers and
endpoints. Raw JSON and raw logs stay in the capture directory.

```text
main3-math9-default-1.log:0
main3-math9-default-2.log:0
main3-math9-default-3.log:0
release.log:0
restore.log:0
veil4-math9-default-1.log:0
veil4-math9-default-2.log:1
veil4-math9-default-3.log:0

veil4-math9-default-2.log:52:FAIL veil-none-rendered: blocks at opacity 0 that are not content-visibility auto or whose content is rendered: 1 of 123 samples (most 1); 0 after the window

main3-math9-default-1.log:12
main3-math9-default-2.log:12
main3-math9-default-3.log:12
veil4-math9-default-1.log:13
veil4-math9-default-2.log:12
veil4-math9-default-3.log:13
```

```sh
rg -l -i '((https?|wss?|chrome-extension)://|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|[[:alnum:].+_-]+@[[:alnum:]._-]+\.[a-z]{2,}|\b[a-p]{32}\b|\b(127\.0\.0\.1|localhost|dev-2a1m)\b|/home/|\b(acct|org|user|proj)-[a-z0-9_]{12,}\b)' "$R"/*.log
rg -H '^HARNESS ERROR:' "$R"/*math9*.log
~/.local/share/chatgpt-lab/bin/lab-lock status
git -C ~/Dev/butter branch --show-current
```

The two searches returned no matches. The lock and main-checkout checks
returned the following.

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil4-D"}
{"lab": "perf", "held": true, "owner": "veil4-D"}
main
```

The first report verification hit `AssertionError` because its regex expected
a backtick before each rule number. The corrected check returned the following.

```text
Verified six timing rows, applied and restored opts, four rule statuses, and the quoted FAIL.
```

```sh
git add -- "$R"
git diff --cached --check
git commit -m "Record veil4 stage B acceptance for #177"
```

The staged whitespace check exited 0 with no output.
