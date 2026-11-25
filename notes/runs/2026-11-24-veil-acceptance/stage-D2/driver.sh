#!/bin/bash
# Stage D2 driver. seq.sh acquire | run <name>... | end. One lock across all steps; state in $ST.
set -u
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/stage-D2
D=~/snap/chromium/common/veil-accept
WT=~/.t3/worktrees/butter/t3-8d4d43e2-85defe235f1b5f54
OWN=veil-accept-D2
ST=/tmp/va177d2/state
mkdir -p $C
case "$1" in
acquire)
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner $OWN --wait 3600 --perf); rc=$?
  echo "lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ $rc -eq 0 ] && [ -n "$LAB" ] || exit 1
  echo "LAB=$LAB T0=$(date +%s) N=0" > $ST ;;
run)
  shift; . $ST
  for NAME in "$@"; do
    BUILD=${NAME%%-*}
    el=$(( $(date +%s) - T0 ))
    if [ $el -gt 1550 ]; then echo "REFUSE $NAME: ${el}s since lock"; exit 3; fi
    if [ $N -ge 10 ]; then echo "REFUSE $NAME: $N runs"; exit 3; fi
    if grep -l -E 'FAIL (no-escape|server-unchanged)' $C/*.raw.log 2>/dev/null; then echo "REFUSE $NAME: guard FAIL"; exit 3; fi
    N=$((N+1)); echo "LAB=$LAB T0=$T0 N=$N" > $ST; s=$(date +%s)
    echo "run $N $NAME start $(date -u +%FT%TZ)"
    ( cd $WT && env LAB_ID=$LAB LAB_OWNER=$OWN EXT=$D/$BUILD/butter LABEL=$NAME FIXTURE=ats12 OUT=$C/$NAME.json \
        PHASES=stream UX=u4 U4_FINDBAR=1 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/$NAME.raw.log 2>&1 )
    rc=$?
    echo "exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s" | tee $C/$NAME.time
    grep -E '^(PASS|FAIL|SUMMARY)' $C/$NAME.raw.log | tr '\n' ' '; echo
    grep -E '^REPORT (completion frame|build|veil-effective|ux .*find bar)' $C/$NAME.raw.log | cut -c1-700
    if [ $rc -ne 0 ] && ! grep -q '^PASS replay-hook' $C/$NAME.raw.log; then echo "STOP: $NAME failed before the replay"; tail -5 $C/$NAME.raw.log; exit 4; fi
    if ! grep -q 'find bar match: settled in view +' $C/$NAME.raw.log; then echo "STOP: $NAME find bar did not reach the block"; exit 5; fi
  done ;;
end)
  . $ST
  echo "restore start $(date -u +%FT%TZ)"
  $B/lab-restore --lab "$LAB" --owner $OWN 2>&1 | tee $C/restore.log; echo "restore exit=${PIPESTATUS[0]}"
  $B/lab-lock release --lab "$LAB" --owner $OWN 2>&1 | tee $C/release.log
  $B/lab-lock status 2>&1 | tee -a $C/release.log
  echo "done $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s runs=$N" ;;
esac
