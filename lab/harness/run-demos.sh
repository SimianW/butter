#!/usr/bin/env bash
# Demo videos as made for the README and report: build the English chat, record its 9th answer,
# record both languages without and with the extension, then edit the videos.
# Usage: PROJECT=<project url> ZH_CHAT=<chinese chat url, with recordings/t09.json recorded in it> ./run-demos.sh
set -e
cd "$(dirname "$0")"
: "${PROJECT:?set PROJECT}" "${ZH_CHAT:?set ZH_CHAT}"
PROMPTS=./prompts-en.mjs MAX_TURNS=8 node baseline.mjs results/baseline-en
EN_CHAT=$(python3 -c "import json;print(json.load(open('results/baseline-en/meta.json'))['chatUrl'])")
P9=$(node -e "import('./prompts-en.mjs').then(m => console.log(m.default[8]))")
node record.mjs "$EN_CHAT" '[t09]' "$P9" recordings/en-t09.json | tail -2
EXT_T=$(cd ../../extension && pwd)
CHAT="$EN_CHAT" REC=recordings/en-t09.json EXT='' node demo.mjs en/stock | grep -v '^chromium:'
CHAT="$EN_CHAT" REC=recordings/en-t09.json EXT="$EXT_T" node demo.mjs en/butter | grep -v '^chromium:'
CHAT="$ZH_CHAT" EXT='' node demo.mjs zh/stock | grep -v '^chromium:'
CHAT="$ZH_CHAT" EXT="$EXT_T" node demo.mjs zh/butter | grep -v '^chromium:'
cd ../.. && python3 lab/make-demo.py en | tail -13 && python3 lab/make-demo.py zh | tail -13
