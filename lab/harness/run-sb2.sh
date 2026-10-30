#!/usr/bin/env bash
# Speed Booster comparison, second pass. Speed Booster resets its settings whenever the browser
# restarts, so: restart with the extensions, apply settings, then bench without another restart.
# (run-sb.sh's "cmp-sb-limit1" runs therefore ran with the default limit of 10; renamed cmp-sb-default.)
cd "$(dirname "$0")"
SB=${SB:?set SB=<unpacked Speed Booster Toolkit 4.6.1>}
TURBO=$(cd ../../extension && pwd)
lab() { ../lab "$@"; }
prep() { LAB_EXTENSIONS=$1 lab restart-browser >/dev/null 2>&1; sleep 6; node sb-config.mjs "$2" | tr -d '\n' | grep -o '"requests[^]]*]\|"turns": [0-9]*\|"modal": "[^"]*"'; echo; }
run() { node bench.mjs "$1" 2 2>&1 | grep -v '^chromium:'; }
prep "$SB" '{"messageLimit":10}';  run cmp-sb-default-r2
prep "$SB" '{"messageLimit":1}';   run cmp-sb-limit1
prep "$SB,$TURBO" '{"messageLimit":1}'; run cmp-sb-limit1-turbo
