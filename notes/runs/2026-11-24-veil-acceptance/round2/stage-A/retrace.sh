#!/bin/bash
# One corrected traced veil2 run inside stage A's budget clock (first lock 01:23:01Z).
set -u
B=~/.local/share/chatgpt-lab/bin; C=~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-A
D=~/snap/chromium/common/veil-accept; W=~/.t3/worktrees/butter/t3-0068d185-0b95d2f26964b1c1; OWNER=veil-accept-r2-A
T0=$(date -d 2026-11-26T01:23:01Z +%s)
LAB=$($B/lab-lock acquire --lab 2 --needs-fixture ats12 --owner $OWNER --wait 30 --perf); rc=$?
echo "acquire lab=$LAB exit=$rc at $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"; [ $rc -eq 0 ] || exit 1
el=$(( $(date +%s) - T0 ))
if [ $el -le 1550 ]; then
  NAME=veil2-ats12-trace-2; s=$(date +%s)
  (cd $W && env LAB_ID=$LAB LAB_OWNER=$OWNER EXT=$D/veil2/butter LABEL=$NAME FIXTURE=ats12 OUT=$C/$NAME.json \
    PHASES=stream 'OPTS={"rail":true,"bookmark":true}' TRACE_AT=111100 TRACE_SPAN=10000 TAIL_MS=12000 \
    node lab/harness/stream-replay-live.mjs > $C/$NAME.raw.log 2>&1)
  echo "$NAME exit=$? took=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee $C/$NAME.time
  grep -E '^(PASS|FAIL)' $C/$NAME.raw.log | tr '\n' ' '; echo
else echo "REFUSE: ${el}s since lock"; fi
$B/lab-restore --lab $LAB --owner $OWNER > $C/restore-2.log 2>&1; echo "restore exit=$? at $(date -u +%FT%TZ)"
$B/lab-lock release --lab $LAB --owner $OWNER 2>&1 | tee $C/release-2.log
$B/lab-lock status 2>&1 | tee -a $C/release-2.log
echo "RETRACE DONE since-lock=$(( $(date +%s) - T0 ))s"
