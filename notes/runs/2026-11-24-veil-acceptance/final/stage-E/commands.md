# Final veil acceptance, stage E commands (#177)

The worktree started at `fae14fa`, the same commit as `feat/implement-spec-170`
when the stage began. `git switch -c veil/177-final-e` created the stage branch.
The diff from `aed9523` was empty under `lab/harness` and `extension`.

## Build and harness checks

```sh
D=~/snap/chromium/common/veil-accept
node --check lab/harness/stream-replay-live.mjs
node --check "$D/veil3/butter/stream/offscreen.js"
rg 'version_name' "$D/veil3/butter/manifest.json"
node -e 'console.log(require.resolve("playwright"))'
T=$(mktemp -d)
git archive aed9523 extension | tar -x -C "$T"
diff -rq "$T/extension" "$D/veil3/butter"
diff -u "$T/extension/manifest.json" "$D/veil3/butter/manifest.json"
rm -rf "$T"
git diff --stat aed9523..HEAD -- lab/harness extension
```

Both syntax checks passed and Playwright resolved from this worktree's
`node_modules`. The archive diff found one differing file, `manifest.json`,
whose `version_name` was `0.1.0-alpha.22+veilaccept.veil3` in the frozen build
and `0.1.0-alpha.22` at `aed9523`. The build was reused as supplied.

## Lock, replays, restore and release

The prior Stage E driver's acquire, run and trap structure was reused in
`$C/seq.sh`. The script ran from the stage worktree in one foreground shell.
The acquire repeats on exit 75. The driver checks the requested options, both
stored snapshots and their matching fingerprints before moving to the next run.
It uses the 30-minute stage budget, with time reserved for lab restore.

```sh
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-E
D=~/snap/chromium/common/veil-accept
OWN=veil-final-E
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The acquisition and replay invocations in that script follow. The labels
expand in the order `default-1`, `scroll-1`, `default-2`, `scroll-2`, all with
the `veil3-ats12-all-` prefix. `elapsed` is seconds since lock acquisition.

```sh
LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --owner "$OWN" --wait 3600 --perf)
for i in 1 2; do
  for setting in default scroll; do
    case "$setting" in
      default) opts='{"rail":true,"bookmark":true}' ;;
      scroll) opts='{"rail":true,"bookmark":true,"older":true,"seek":true}' ;;
    esac
    NAME=veil3-ats12-all-$setting-$i
    elapsed=$(( $(date +%s) - T0 ))
    timeout -k 5 "$((1780 - elapsed))s" env -u PHASES LAB_ID="$LAB" LAB_OWNER="$OWN" \
      EXT="$D/veil3/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
      VEILPROBE=1 OPTS="$opts" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  done
done
# Exit trap
"$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.raw.log" 2>&1
"$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
"$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
```

## Execution output

Each replay's verdict and report lines are in its stripped log. The driver's
sequence timings and cleanup status follow in UTC.

```text
acquire attempt=1 start 2026-11-26T19:25:00Z
acquire attempt=1 lab=2 exit=0 waited=2246s at 2026-11-26T20:02:26Z
run 1 veil3-ats12-all-default-1 start 2026-11-26T20:02:26Z
veil3-ats12-all-default-1 exit=0 elapsed=231s since-lock=231s at 2026-11-26T20:06:17Z
run 2 veil3-ats12-all-scroll-1 start 2026-11-26T20:06:17Z
veil3-ats12-all-scroll-1 exit=0 elapsed=227s since-lock=458s at 2026-11-26T20:10:04Z
run 3 veil3-ats12-all-default-2 start 2026-11-26T20:10:04Z
veil3-ats12-all-default-2 exit=0 elapsed=225s since-lock=683s at 2026-11-26T20:13:49Z
run 4 veil3-ats12-all-scroll-2 start 2026-11-26T20:13:49Z
veil3-ats12-all-scroll-2 exit=0 elapsed=232s since-lock=915s at 2026-11-26T20:17:41Z
restore start 2026-11-26T20:17:41Z
restore exit=0 at 2026-11-26T20:17:51Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0 at 2026-11-26T20:17:51Z
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T20:17:51Z runs=4 since-lock=925s
```

## Extraction and verification

```sh
R=notes/runs/2026-11-24-veil-acceptance/final/stage-E
python3 -I "$C/extract.py" "$C"/veil3-ats12-all-{default-1,scroll-1,default-2,scroll-2}.json > "$C/details.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
grep -c '^PASS ' "$R"/veil3-ats12-all-*.log
grep -c '^FAIL' "$R"/*.log
grep -nEi 'https?://|wss?://|/home/|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|[a-p]{32}|(localhost|127\.0\.0\.1)|@[a-z0-9.-]+\.[a-z]{2,}' "$R"/*.log
"$B/lab-lock" status
git diff --cached --check
```

The Python commands exited 0. The stripped logs retain verdicts, measurement
reports and exit times. They omit button labels, function snippets and raw
endpoint reports. The raw JSON, raw logs and helper scripts remain in `$C`.
Restore returned `ok:true` in [restore.log](restore.log).

```text
veil3-ats12-all-default-1.log:14 PASS, 0 FAIL
veil3-ats12-all-default-2.log:14 PASS, 0 FAIL
veil3-ats12-all-scroll-1.log:14 PASS, 0 FAIL
veil3-ats12-all-scroll-2.log:14 PASS, 0 FAIL
restore.log:0 FAIL
release.log:0 FAIL
```

Both the anchored FAIL count and the private-data search exited 1 with zero
matches. A post-release status read showed Stage A2 holding lab 2 and the
performance lock. The staged whitespace check exited 0.
