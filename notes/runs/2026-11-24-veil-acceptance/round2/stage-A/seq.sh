#!/bin/bash
# Round 2 stage A sequence: lock, 3 head + 3 veil2 interleaved, 1 traced veil2, restore, release.
set -u
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-A
D=~/snap/chromium/common/veil-accept
W=~/.t3/worktrees/butter/t3-0068d185-0b95d2f26964b1c1
OWNER=veil-accept-r2-A
CATS=disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.cpu_profiler
echo "acquire start $(date -u +%FT%TZ)"
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner $OWNER --wait 3600 --perf); rc=$?
echo "acquire lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
[ $rc -eq 0 ] || exit 1
T0=$(date +%s); N=0
run() { # NAME BUILD [extra env...]
  local NAME=$1 BUILD=$2; shift 2
  local el=$(( $(date +%s) - T0 ))
  if [ $el -gt 1550 ]; then echo "REFUSE $NAME: ${el}s since lock"; return 99; fi
  if [ $N -ge 10 ]; then echo "REFUSE $NAME: $N runs"; return 99; fi
  if grep -l -E 'FAIL (no-escape|server-unchanged)' $C/*.raw.log 2>/dev/null; then echo "REFUSE $NAME: guard FAIL"; return 99; fi
  N=$((N+1)); local s=$(date +%s)
  (cd $W && env LAB_ID=$LAB LAB_OWNER=$OWNER EXT=$D/$BUILD/butter LABEL=$NAME FIXTURE=ats12 OUT=$C/$NAME.json \
     PHASES=stream 'OPTS={"rail":true,"bookmark":true}' "$@" node lab/harness/stream-replay-live.mjs > $C/$NAME.raw.log 2>&1)
  local rc=$?
  echo "$NAME exit=$rc took=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee $C/$NAME.time
  grep -E '^(PASS|FAIL)' $C/$NAME.raw.log | tr '\n' ' ' | cut -c1-600; echo
}
for i in 1 2 3; do run head-ats12-stream-$i head; run veil2-ats12-stream-$i veil2; done
run veil2-ats12-trace-1 veil2 TRACE_AT=109000 TRACE_SPAN=11000 TAIL_MS=12000 TRACE_CATS=$CATS
$B/lab-restore --lab $LAB --owner $OWNER > $C/restore.log 2>&1; echo "restore exit=$? at $(date -u +%FT%TZ)"
$B/lab-lock release --lab $LAB --owner $OWNER 2>&1 | tee $C/release.log
$B/lab-lock status 2>&1 | tee -a $C/release.log
echo "SEQ DONE $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"
