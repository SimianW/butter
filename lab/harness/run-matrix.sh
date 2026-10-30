#!/usr/bin/env bash
# Run bench variants sequentially: run-matrix.sh reps name=extdirs ...  (extdirs may be empty for baseline)
cd "$(dirname "$0")"; reps=$1; shift
for spec in "$@"; do name=${spec%%=*}; ext=${spec#*=}; EXT="$ext" node bench.mjs "$name" "$reps" 2>&1 | grep -v '^chromium:'; done
