#!/bin/bash
# run.sh NAME: runs lab/harness/rail-jump-live.mjs under the already-held lock `rail-pin-171e` on lab 2,
# with the caller's env (EXT, FIXTURES, LABEL, ONLY, RECORD...). Raw log and JSON go to the local
# capture dir (out of the repo); a scrubbed log goes to notes/runs/2026-11-25-rail-jump-fix/NAME.log.
W=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
C=~/.local/share/chatgpt-lab/captures/2026-11-25-rail-jump-fix
D=notes/runs/2026-11-25-rail-jump-fix
mkdir -p $C; cd "$W"
n=$(grep -c '^START' $C/runs.txt 2>/dev/null); n=${n:-0}
[ "$n" -ge 10 ] && { echo "budget: 10 runs done"; exit 9; }
echo "START $1 $(date -u +%T)" | tee -a $C/runs.txt
s=$(date +%s)
LAB_ID=2 LAB_OWNER=rail-pin-171e OUT=$C/$1.json timeout 1500 node lab/harness/rail-jump-live.mjs > $C/$1.raw.log 2>&1
code=$?
echo "END $1 $(date -u +%T) exit $code duration $(( $(date +%s) - s ))s" | tee -a $C/runs.txt
sed -E -e 's#(https?|chrome-extension)://[^ "'"'"'):]+#<url>#g' -e 's#[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}#<id>#gI' \
  -e "s#$HOME#~#g" -e 's#/tmp/rail-jump-[0-9]+-#/tmp/rail-jump-<pid>-#g' $C/$1.raw.log > $D/$1.log
exit $code
