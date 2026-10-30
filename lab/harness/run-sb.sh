#!/usr/bin/env bash
# Speed Booster Toolkit comparison, 2026-10-30. Same replay, same chat, back to back.
cd "$(dirname "$0")"
SB=${SB:?set SB=<unpacked Speed Booster Toolkit 4.6.1>}
TURBO=$(cd ../../extension && pwd)
lab() { ../lab "$@"; }
sbset() { LAB_EXTENSIONS=$1 lab restart-browser >/dev/null 2>&1; sleep 6; node sb-config.mjs "$2" | tr -d '\n' | grep -o '"requests[^]]*]\|"turns": [0-9]*'; }
run() { EXT="$2" node bench.mjs "$1" 2 2>&1 | grep -v '^chromium:'; }
run cmp-baseline ''
run cmp-turbo "$TURBO"
sbset "$SB" '{"messageLimit":10,"manualPaging":false,"alwaysLoadFull":false}'
run cmp-sb-default "$SB"
sbset "$SB" '{"messageLimit":1}'
run cmp-sb-limit1 "$SB"
run cmp-sb-limit1-turbo "$SB,$TURBO"
sbset "$SB" '{"messageLimit":10}'
