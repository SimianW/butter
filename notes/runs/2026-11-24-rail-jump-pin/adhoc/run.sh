#!/bin/bash
# run.sh NAME STEPS_JSON: runs rpin.mjs under the already-held lock `rail-pin-171a`; the raw log and JSON go to the
# local capture dir (out of the repo). As run on 2026-11-24 (the worktree path was absolute then).
W=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
C=~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-pin
cd "$W"
echo "START $1 $(date -u +%T)" | tee -a $C/runs.txt
LAB_ID=2 LAB_OWNER=rail-pin-171a EXT=~/snap/chromium/common/rail-pin-171a/dev/butter \
  LP=notes/runs/2026-11-24-rail-jump-pin/adhoc/lp.json LP_URL='/76629\.HASH\.js' STEPS="$2" OUT=$C/$1.json \
  timeout 900 node notes/runs/2026-11-24-rail-jump-pin/adhoc/rpin.mjs > $C/$1.raw.log 2>&1
code=$?
echo "END $1 $(date -u +%T) exit $code" | tee -a $C/runs.txt
