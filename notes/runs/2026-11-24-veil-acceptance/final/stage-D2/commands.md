# Final veil acceptance, stage D2 commands (#177)

The worktree and `feat/implement-spec-170` started at `8c53186`.
The harness and extension diff from `aed9523` was empty.
Commands ran in the stage worktree. Times are UTC.

## Preflight

```sh
git switch -c veil/177-final-d2
D=~/snap/chromium/common/veil-accept
rg 'version_name' "$D"/{main3,veil3}/butter/manifest.json
node --check lab/harness/stream-replay-live.mjs
node --check lab/harness/stream-findbar-probe.mjs
node -e 'console.log(require.resolve("playwright").split("/node_modules/").at(-1))'
test -s ~/Dev/butter/lab/harness/recordings/en-t09.json
git diff --exit-code aed9523..HEAD -- lab/harness extension
```

```text
Switched to a new branch 'veil/177-final-d2'
~/snap/chromium/common/veil-accept/veil3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
~/snap/chromium/common/veil-accept/main3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.main3",
playwright/index.js
```

The syntax, recording and diff checks exited 0. The supplied builds were reused.

## Lock, runs and cleanup

The foreground driver adapted [round 1's D2 driver](../../stage-D2/driver.sh)
and used Stage E's wheel probe and cleanup trap. It retried acquisition
on exit 75. The second wheel run required room in the budget for the higher
of the first wheel run's duration and Stage E's slowest run (232 seconds),
plus a 25-second cleanup allowance. The driver and raw output stay in
the local captures directory.

```sh
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D2
D=~/snap/chromium/common/veil-accept
OWN=veil-final-D2
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

These are the driver commands. The six find-bar calls were in main3,
veil3 order for each of `i=1 2 3`, followed by the wheel control calls.
The driver's `elapsed` is seconds since acquisition. `"$@"` is the
mode-specific environment assignment list passed to `run`.

```sh
LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --owner "$OWN" --wait 3600 --perf)
opts='{"rail":true,"bookmark":true}'
# run "$build-ats12-findbar-$i" PHASES=stream UX=u4 U4_FINDBAR=1
# run main3-ats12-all-default-1 VEILPROBE=1
# run main3-ats12-all-default-2 VEILPROBE=1
timeout -k 5 "$((1780 - elapsed))s" env -u PHASES -u UX -u U4_FINDBAR -u VEILPROBE \
  LAB_ID="$LAB" LAB_OWNER="$OWN" EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 \
  OUT="$C/$NAME.json" OPTS="$opts" "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
"$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.raw.log" 2>&1
"$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
"$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
```

The stripped logs retain the harness's verdicts and measurement lines
and omit button labels, function snippets and private endpoints.
[Restore output](restore.log) and [lock release output](release.log).

```text
acquire attempt=1 start 2026-11-26T20:21:03Z
acquire attempt=1 lab=2 exit=0 waited=1969s at 2026-11-26T20:53:52Z
run 1 main3-ats12-findbar-1 start 2026-11-26T20:53:52Z
main3-ats12-findbar-1 exit=0 elapsed=208s since-lock=208s at 2026-11-26T20:57:20Z
run 2 veil3-ats12-findbar-1 start 2026-11-26T20:57:20Z
veil3-ats12-findbar-1 exit=0 elapsed=210s since-lock=418s at 2026-11-26T21:00:50Z
run 3 main3-ats12-findbar-2 start 2026-11-26T21:00:50Z
main3-ats12-findbar-2 exit=0 elapsed=208s since-lock=626s at 2026-11-26T21:04:18Z
run 4 veil3-ats12-findbar-2 start 2026-11-26T21:04:18Z
veil3-ats12-findbar-2 exit=0 elapsed=214s since-lock=840s at 2026-11-26T21:07:52Z
run 5 main3-ats12-findbar-3 start 2026-11-26T21:07:52Z
main3-ats12-findbar-3 exit=0 elapsed=214s since-lock=1054s at 2026-11-26T21:11:26Z
run 6 veil3-ats12-findbar-3 start 2026-11-26T21:11:26Z
veil3-ats12-findbar-3 exit=0 elapsed=209s since-lock=1263s at 2026-11-26T21:14:55Z
run 7 main3-ats12-all-default-1 start 2026-11-26T21:14:55Z
main3-ats12-all-default-1 exit=0 elapsed=237s since-lock=1500s at 2026-11-26T21:18:52Z
run 8 main3-ats12-all-default-2 start 2026-11-26T21:18:52Z
main3-ats12-all-default-2 exit=0 elapsed=225s since-lock=1725s at 2026-11-26T21:22:37Z
restore start 2026-11-26T21:22:37Z
restore exit=0 at 2026-11-26T21:22:48Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0 at 2026-11-26T21:22:48Z
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T21:22:48Z runs=8 since-lock=1736s
```

## Extraction and verification

```sh
E=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-E
R=notes/runs/2026-11-24-veil-acceptance/final/stage-D2
findbar=()
for i in 1 2 3; do
  for build in main3 veil3; do
    findbar+=("$C/$build-ats12-findbar-$i.json")
  done
done
wheels=("$C"/main3-ats12-all-default-*.json)
node "$C/findbar-extract.mjs" "${findbar[@]}" > "$C/findbar.jsonl"
python3 -I "$E/extract.py" "$E"/veil3-ats12-all-default-{1,2}.json > "$C/wheel-reference.jsonl"
python3 -I "$E/extract.py" "${wheels[@]}" > "$C/wheel.jsonl"
python3 -I "$C/details.py" "${findbar[@]}" "${wheels[@]}" > "$C/details.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
for table in findbar wheel verdicts completion; do
  python3 -I "$C/tables.py" "$C" "$table" > "$C/$table.md"
done
python3 -I "$C/verify.py" "$C" "$R" | tee "$C/verification.log"
{ grep -c '^FAIL' "$R"/*.log || test "$?" -eq 1; } | tee -a "$C/verification.log"
grep -nEi 'https?://|wss?://|chrome-extension://|/home/|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|\b[a-p]{32}\b|(localhost|127\.0\.0\.1)|@[a-z0-9.-]+\.[a-z]{2,}' "$R"/*.log "$R/summary.md"
"$B/lab-lock" status | tee -a "$C/verification.log"
git add -- "$R"
git diff --cached --check
```

The extractors and verifier exited 0. The verifier compared the full
PASS and FAIL lines in each stripped log to its raw log. Anchored
`grep -c '^FAIL'` found zero lines in every run and cleanup log. The private-data
search found no matches, and the staged whitespace check exited 0.
Stage L held lab 2 and the performance lock by the post-release status check.

```text
main3-ats12-findbar-1: 12 PASS, 0 FAIL, opts null, restored True
veil3-ats12-findbar-1: 13 PASS, 0 FAIL, opts null, restored True
main3-ats12-findbar-2: 12 PASS, 0 FAIL, opts null, restored True
veil3-ats12-findbar-2: 13 PASS, 0 FAIL, opts null, restored True
main3-ats12-findbar-3: 12 PASS, 0 FAIL, opts null, restored True
veil3-ats12-findbar-3: 13 PASS, 0 FAIL, opts null, restored True
main3-ats12-all-default-1: 13 PASS, 0 FAIL, opts null, restored True
main3-ats12-all-default-2: 13 PASS, 0 FAIL, opts null, restored True
{"lab": 2, "held": true, "owner": "veil-final-L"}
{"lab": "perf", "held": true, "owner": "veil-final-L"}
```
