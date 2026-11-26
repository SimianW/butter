#!/bin/bash
# Round 2 stage D driver: one lock; 3 head + 3 veil2 ats12 PHASES=stream UX=u4 U4_FINDS=3 interleaved;
# judge the window.find rule; restore + release. (Round 1's part 2 is not part of round 2's row D.)
set -u
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-D
D=~/snap/chromium/common/veil-accept
WT=~/.t3/worktrees/butter/t3-ce06b4ad-0cdf8c5007c29538
R=$WT/notes/runs/2026-11-24-veil-acceptance/round2/stage-D
OWN=veil-accept-r2-D
mkdir -p $C
echo "acquire start $(date -u +%FT%TZ)"
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner $OWN --wait 3600 --perf); rc=$?
echo "lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
[ $rc -eq 0 ] && [ -n "$LAB" ] || exit 1
T0=$(date +%s); echo "T0=$T0"
cleanup() {
  echo "restore start $(date -u +%FT%TZ)"
  $B/lab-restore --lab "$LAB" --owner $OWN 2>&1 | tee $C/restore.log; echo "restore exit=${PIPESTATUS[0]}"
  $B/lab-lock release --lab "$LAB" --owner $OWN 2>&1 | tee $C/release.log
  $B/lab-lock status 2>&1 | tee -a $C/release.log
  echo "done $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"
}
trap cleanup EXIT
n=0
for i in 1 2 3; do for BUILD in head veil2; do
  NAME=$BUILD-ats12-u4-$i
  el=$(( $(date +%s) - T0 ))
  if [ $el -gt 1500 ]; then echo "REFUSE $NAME: ${el}s since lock"; exit 0; fi
  if [ $n -ge 9 ]; then echo "REFUSE $NAME: $n runs"; exit 0; fi
  if grep -l -E 'FAIL (no-escape|server-unchanged)' $C/*.raw.log 2>/dev/null; then echo "REFUSE $NAME: guard FAIL"; exit 0; fi
  n=$((n+1)); s=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  ( cd $WT && env LAB_ID=$LAB LAB_OWNER=$OWN EXT=$D/$BUILD/butter LABEL=$NAME FIXTURE=ats12 OUT=$C/$NAME.json \
      PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' node lab/harness/stream-replay-live.mjs > $C/$NAME.raw.log 2>&1 )
  rc=$?
  echo "exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s" | tee $C/$NAME.time
  grep -E '^(PASS|FAIL|SUMMARY)' $C/$NAME.raw.log
  grep -E '^REPORT (completion frame|build|veil-effective|ux .*u4)' $C/$NAME.raw.log | cut -c1-500
  if [ $rc -ne 0 ] && ! grep -q '^PASS replay-hook' $C/$NAME.raw.log; then echo "STOP: $NAME failed before the replay"; tail -5 $C/$NAME.raw.log; exit 0; fi
done; done
node $R/u4-extract.mjs $C/{head,veil2}-ats12-u4-{1,2,3}.json > $C/u4.jsonl; jr=$?
tail -1 $C/u4.jsonl
echo "judge exit=$jr"
