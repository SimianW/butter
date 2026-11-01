#!/usr/bin/env bash
# Non-streaming scenarios (reload, full scroll, idle typing) for the Speed Booster comparison.
# Speed Booster settings reset on browser restart, so settings are applied after the restart and
# scenarios.mjs runs without EXT (no second restart).
cd "$(dirname "$0")"
SB=${SB:?set SB=<unpacked Speed Booster Toolkit 4.6.1>}
BUTTER=$(cd ../../extension && pwd)
lab() { ../lab "$@"; }
prep() { LAB_EXTENSIONS=$1 lab restart-browser >/dev/null 2>&1; sleep 6; node sb-config.mjs "$2" | tr -d '\n' | grep -o '"turns": [0-9]*\|"modal": "[^"]*"'; echo; }
EXT='' node scenarios.mjs cmp-baseline 2 2>&1 | grep -v '^chromium:'
EXT="$BUTTER" node scenarios.mjs cmp-butter 2 2>&1 | grep -v '^chromium:'
prep "$SB" '{"messageLimit":10}'; node scenarios.mjs cmp-sb-default 2 2>&1 | grep -v '^chromium:'
prep "$SB" '{"messageLimit":1}';  node scenarios.mjs cmp-sb-limit1 2 2>&1 | grep -v '^chromium:'
