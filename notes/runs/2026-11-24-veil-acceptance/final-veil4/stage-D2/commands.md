# Final veil4 acceptance, stage D2 commands (#177)

Commands ran in the stage worktree. The initial branch was
`test/veil4-find-bar-d2`, at the integration head
`a1d42289389836889c1a04c21ffd3643003003d9`. Times are UTC.

## Preflight

```sh
git status --short --branch
git rev-parse HEAD
git switch -c veil/177-veil4-d2
rg 'version_name' ~/snap/chromium/common/veil-accept/{main3,veil3,veil4}/butter/manifest.json
node --check lab/harness/stream-replay-live.mjs
node --check lab/harness/stream-findbar-probe.mjs
node -e 'console.log(require.resolve("playwright").split("/node_modules/").at(-1))'
test -s ~/Dev/butter/lab/harness/recordings/en-t09.json
```

```text
## test/veil4-find-bar-d2
a1d42289389836889c1a04c21ffd3643003003d9
Switched to a new branch 'veil/177-veil4-d2'
~/snap/chromium/common/veil-accept/veil4/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil4",
~/snap/chromium/common/veil-accept/veil3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
~/snap/chromium/common/veil-accept/main3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.main3",
playwright/index.js
```

The syntax and recording checks exited 0 without output. The frozen
builds and worktree harness were used as supplied.

## Lock, harness and cleanup

The prior D2 driver was adapted to the requested order with one
performance lock and an exit trap that restores and releases the lab.
Each lock attempt waited up to 3,600 s, retrying only on exit 75. The
harness timeout used the remaining stage budget with 20 s left for
cleanup. The sequence ran in the foreground.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D2
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The driver was saved locally as `$C/seq.sh`.

```bash
#!/bin/bash
# Final veil4 D2 real find-bar replay sequence, adapted from final D2.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D2
D=~/snap/chromium/common/veil-accept
OWN=veil4-D2
opts='{"rail":true,"bookmark":true}'
stamp() { date -u +%FT%TZ; }

attempt=0
while :; do
  attempt=$((attempt + 1))
  started=$(date +%s)
  echo "acquire attempt=$attempt start $(stamp)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --owner "$OWN" --wait 3600 --perf)
  rc=$?
  echo "acquire attempt=$attempt lab=$LAB exit=$rc waited=$(( $(date +%s) - started ))s at $(stamp)"
  if [ "$rc" -eq 0 ] && [ -n "$LAB" ]; then break; fi
  if [ "$rc" -ne 75 ]; then exit 2; fi
done

T0=$(date +%s)
n=0
cleanup() {
  local prior=$? restored released
  trap - EXIT
  echo "restore start $(stamp)"
  "$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.raw.log" 2>&1
  restored=$?
  echo "restore exit=$restored at $(stamp)"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
  released=${PIPESTATUS[0]}
  echo "release exit=$released at $(stamp)"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "done $(stamp) runs=$n since-lock=$(( $(date +%s) - T0 ))s"
  if [ "$restored" -ne 0 ] || [ "$released" -ne 0 ]; then exit 2; fi
  exit "$prior"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run() {
  local NAME=$1 BUILD=${1%%-*} elapsed s rc
  shift
  elapsed=$(( $(date +%s) - T0 ))
  if [ "$elapsed" -ge 1780 ] || [ "$n" -ge 10 ]; then
    echo "STOP: budget before $NAME, ${elapsed}s and $n prior runs"
    return 2
  fi
  n=$((n + 1))
  s=$(date +%s)
  echo "run $n $NAME start $(stamp)"
  timeout -k 5 "$((1780 - elapsed))s" env -u PHASES -u UX -u U4_FINDBAR -u VEILPROBE \
    LAB_ID="$LAB" LAB_OWNER="$OWN" EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 \
    OUT="$C/$NAME.json" OPTS="$opts" "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  echo "$NAME exit=$? elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s at $(stamp)" | tee "$C/$NAME.time"
  rc=$(sed -E 's/.* exit=([0-9]+) .*/\1/' "$C/$NAME.time")
  if rg -q '^FAIL (no-escape|server-unchanged)' "$C/$NAME.raw.log"; then
    echo 'STOP: send guard verdict failed'
    return 2
  fi
  if [ "$rc" -ne 0 ] && ! rg -q '^PASS replay-hook' "$C/$NAME.raw.log"; then
    echo "STOP: $NAME failed before the replay"
    return 2
  fi
  if [ "$rc" -ge 2 ] || [ ! -s "$C/$NAME.json" ]; then
    echo "STOP: $NAME did not complete the harness"
    return 2
  fi
  if ! rg -q '^REPORT ux u4 u4 find bar before paint .*frames drawn with the matched block rendered at opacity 0, Ctrl[+]F to Escape: [0-9]+ [(]of [0-9]+ before-paint samples[)]$' "$C/$NAME.raw.log"; then
    echo "STOP: $NAME did not produce the before-paint report"
    return 2
  fi
}

for NAME in veil4-ats12-findbar-1 veil3-ats12-findbar-1 main3-ats12-findbar-1 \
            veil4-ats12-findbar-2 veil3-ats12-findbar-2 main3-ats12-findbar-2 \
            veil4-ats12-findbar-3; do
  run "$NAME" PHASES=stream UX=u4 U4_FINDBAR=1 || exit "$?"
done
```

The driver exited 0 and printed the following.

```text
acquire attempt=1 start 2026-11-26T22:23:10Z
acquire attempt=1 lab=2 exit=0 waited=587s at 2026-11-26T22:32:57Z
run 1 veil4-ats12-findbar-1 start 2026-11-26T22:32:57Z
veil4-ats12-findbar-1 exit=0 elapsed=213s since-lock=213s at 2026-11-26T22:36:30Z
run 2 veil3-ats12-findbar-1 start 2026-11-26T22:36:30Z
veil3-ats12-findbar-1 exit=0 elapsed=208s since-lock=421s at 2026-11-26T22:39:58Z
run 3 main3-ats12-findbar-1 start 2026-11-26T22:39:58Z
main3-ats12-findbar-1 exit=0 elapsed=208s since-lock=629s at 2026-11-26T22:43:26Z
run 4 veil4-ats12-findbar-2 start 2026-11-26T22:43:26Z
veil4-ats12-findbar-2 exit=0 elapsed=208s since-lock=837s at 2026-11-26T22:46:54Z
run 5 veil3-ats12-findbar-2 start 2026-11-26T22:46:54Z
veil3-ats12-findbar-2 exit=0 elapsed=214s since-lock=1051s at 2026-11-26T22:50:28Z
run 6 main3-ats12-findbar-2 start 2026-11-26T22:50:28Z
main3-ats12-findbar-2 exit=0 elapsed=214s since-lock=1265s at 2026-11-26T22:54:02Z
run 7 veil4-ats12-findbar-3 start 2026-11-26T22:54:02Z
veil4-ats12-findbar-3 exit=0 elapsed=214s since-lock=1479s at 2026-11-26T22:57:36Z
restore start 2026-11-26T22:57:36Z
restore exit=0 at 2026-11-26T22:57:47Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0 at 2026-11-26T22:57:47Z
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T22:57:47Z runs=7 since-lock=1490s
```

[Restore output](restore.log) and [release output](release.log).

## Extraction and verification

```sh
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D2
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-D2
python3 -I "$C/strip.py" "$C" "$R"
python3 -I "$C/extract.py" "$C" "$R" "$P" > "$C/results.jsonl"
for table in findbar verdicts drawn completion post; do
  python3 -I "$C/tables.py" "$C/results.jsonl" "$table" | tee "$C/$table.md"
done
{ grep -c '^FAIL' "$R"/*.log || test "$?" -eq 1; }
rg -n -i 'https?://|wss?://|chrome-extension://|/home/|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|\b[a-p]{32}\b|(localhost|127\.0\.0\.1)|@[a-z0-9.-]+\.[a-z]{2,}' "$R"/*.log "$R/summary.md"
~/.local/share/chatgpt-lab/bin/lab-lock status
git add -- "$R"
git diff --cached --check
git commit -m "Record veil4 D2 browser find-bar acceptance runs"
git status --short --branch
git log --oneline a1d4228..HEAD
```

The extractor verified that all verdict and find-bar measurement lines
in the stripped logs match the raw logs, and that the drawn-frame counts
match the JSON. The stripped logs retain the harness's measurements and
verdicts. The raw captures and scripts stay outside the repository.
The private-data search found no matches. The verdict totals, settings
and per-run measurement output are in [the summary](summary.md).

The `grep -c '^FAIL'` output below uses basenames.

```text
main3-ats12-findbar-1.log:0
main3-ats12-findbar-2.log:0
release.log:0
restore.log:0
seq.log:0
veil3-ats12-findbar-1.log:0
veil3-ats12-findbar-2.log:0
veil4-ats12-findbar-1.log:0
veil4-ats12-findbar-2.log:0
veil4-ats12-findbar-3.log:0
```

After release, the status command showed that stage B had acquired lab 2
and the performance lock.

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil4-B"}
{"lab": "perf", "held": true, "owner": "veil4-B"}
```
