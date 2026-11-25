#!/bin/bash
# run.sh NAME PHASES [N]: runs gesture.mjs with no extension under the already-held lock `rail-pin-171b`; the raw log
# and JSON go to the local capture dir (out of the repo); a scrubbed copy of the log goes next to this script.
W=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
C=~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-gesture
mkdir -p $C
cd "$W"
echo "START $1 $(date -u +%T)" | tee -a $C/runs.txt
LAB_ID=2 LAB_OWNER=rail-pin-171b EXT= LP=notes/runs/2026-11-24-rail-jump-gesture/adhoc/lp.json LP_URL='/76629\.HASH\.js' \
  PHASES="$2" N="${3:-10}" OUT=$C/$1.json \
  timeout 1200 node notes/runs/2026-11-24-rail-jump-gesture/adhoc/gesture.mjs > $C/$1.raw.log 2>&1
code=$?
echo "END $1 $(date -u +%T) exit $code" | tee -a $C/runs.txt
sed -E -e 's#(https?|chrome-extension)://[^ "'"'"'):]+#<url>#g' -e 's#[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}#<id>#gI' -e "s#$HOME#~#g" $C/$1.raw.log > notes/runs/2026-11-24-rail-jump-gesture/adhoc/$1.log
exit $code
