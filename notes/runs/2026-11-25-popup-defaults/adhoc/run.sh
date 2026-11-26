#!/bin/bash
# run.sh NAME SCRIPT: runs SCRIPT (repo-relative) under the already-held lock `rail-pin-171h` on lab 2,
# with the caller's env (EXT, FIXTURE, AT, KINDS, ONLY, LABEL...). The raw log goes to the local
# capture dir (out of the repo); a scrubbed log, ending in an EXIT line, goes to
# notes/runs/2026-11-25-popup-defaults/live/NAME.log. Budget: 6 harness runs.
W=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
C=~/.local/share/chatgpt-lab/captures/2026-11-25-popup-defaults
D=notes/runs/2026-11-25-popup-defaults/live
mkdir -p $C "$W/$D"; cd "$W"
n=$(grep -c '^START' $C/runs.txt 2>/dev/null); n=${n:-0}
[ "$n" -ge 6 ] && { echo "budget: 6 runs done"; exit 9; }
echo "START $1 $(date -u +%T)" | tee -a $C/runs.txt
s=$(date +%s)
LAB_ID=2 LAB_OWNER=rail-pin-171h OUT=$C/$1.json timeout 1200 node "$2" > $C/$1.raw.log 2>&1
code=$?
echo "END $1 $(date -u +%T) exit $code duration $(( $(date +%s) - s ))s" | tee -a $C/runs.txt
{ cat $C/$1.raw.log; echo "EXIT $code"; } | sed -E -e 's#(https?|chrome-extension)://[^ "'"'"'):]+#<url>#g' \
  -e 's#[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}#<id>#gI' -e "s#$HOME#~#g" \
  -e 's#/tmp/rail-jump-[0-9]+-#/tmp/rail-jump-<pid>-#g' > $D/$1.log
exit $code
