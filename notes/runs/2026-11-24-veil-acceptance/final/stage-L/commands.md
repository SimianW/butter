# Final veil acceptance stage L commands (#177)

Run in the Stage L worktree. Timestamps are UTC on 2026-11-26. Raw logs and
captures are under `~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-L/`.

## Preparation

```sh
git status --short --branch
git rev-parse HEAD feat/implement-spec-170 aed9523
git -C /home/simon/Dev/butter branch --show-current
git diff --exit-code aed9523 HEAD -- lab/harness extension
gh issue view 183 --repo SimianW/butter
jq -r .version_name ~/snap/chromium/common/veil-accept/veil3/butter/manifest.json
```

The worktree was already on `veil/177-final-l` and clean. The first two
`rev-parse` results were `1405df7562d3c21348c754294223bd9269e86051`.
`aed9523` resolved to `aed952361352d58de4a41ef211df8a289df893a5`.
The main checkout printed `main`, the source diff was empty, and the manifest
printed `0.1.0-alpha.22+veilaccept.veil3`. Issue #183 was open and recorded that
ChatGPT had stopped making the `clientWidth` read that triggers `restore()`.

```sh
P=notes/runs/2026-11-24-veil-acceptance
mkdir -p "$P/final/stage-L"
cp "$P/stage-D3/stored-layout-check.mjs" "$P/final/stage-L/stored-layout-check.mjs"
# After editing the copy:
node --check "$P/final/stage-L/stored-layout-check.mjs"
```

The syntax check exited 0 with no output.

## Lock

```sh
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-L
mkdir -p "$C"
"$B/lab-lock" acquire --lab auto --needs-fixture math12 --perf --wait 3600 --owner veil-final-L
jq '.labs | map({id,account,fixtures:(.fixtures|keys)})' ~/.local/share/chatgpt-lab/labs.json
jq '[.labs[].fixtures.math12] | length == (unique|length)' ~/.local/share/chatgpt-lab/labs.json
pgrep -af '^python3 .*lab-lock acquire --lab auto --needs-fixture math12 --perf --wait 3600 --owner veil-final-L$'
kill -TERM 1292936
"$B/lab-lock" status
```

The first acquire started at 20:40:34 and exited 143 at 20:42:47 after the
signal. The fixture lookup printed `true` for distinct `math12` URLs. The
status check showed lab 1 free and both lab 2 and the perf lock held by
`veil-final-C2b`. The retry specifies account 2 to use the round-one chat.

```sh
while true; do
  printf 'acquire started %s\n' "$(date -u +%FT%TZ)" | tee -a "$C/sequence.raw.log"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture math12 --perf --wait 3600 --owner veil-final-L --account 2 2>>"$C/acquire.raw.log")
  status=$?
  printf 'acquire finished %s exit=%s lab=%s\n' "$(date -u +%FT%TZ)" "$status" "$LAB" | tee -a "$C/sequence.raw.log"
  if [ "$status" -eq 75 ]; then continue; fi
  if [ "$status" -eq 0 ]; then printf '%s\n' "$LAB" > "$C/lab"; fi
  exit "$status"
done
```

## Runs

```sh
bash -n "$C/runs.sh"
bash "$C/runs.sh"
```

Initial driver:

```bash
#!/usr/bin/env bash
set -u

B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-L
D=~/snap/chromium/common/veil-accept
P=notes/runs/2026-11-24-veil-acceptance/final/stage-L
LAB=$(cat "$C/lab")
T0=$(date -u -d "$(awk '/^acquire finished .* exit=0 / {print $3}' "$C/sequence.raw.log" | tail -1)" +%s)

for n in 1 2 3; do
  label=veil3-math12-scroll-$n
  started=$(date +%s)
  remaining=$((1740 - (started - T0)))
  if [ "$remaining" -le 0 ]; then exit 124; fi
  printf 'start %s %s\n' "$label" "$(date -u +%FT%TZ)" | tee -a "$C/sequence.raw.log"
  timeout --kill-after=5s "${remaining}s" env LAB_ID="$LAB" LAB_OWNER=veil-final-L EXT="$D/veil3/butter" LABEL="$label" FIXTURE=math12 TRIGGER=1 OUT="$C/$label.json" \
    node "$P/stored-layout-check.mjs" > "$C/$label.raw.log" 2>&1
  rc=$?
  printf 'finish %s %s exit=%s took=%ss\n' "$label" "$(date -u +%FT%TZ)" "$rc" "$(( $(date +%s) - started ))" | tee -a "$C/sequence.raw.log"
  rg '^(PASS|FAIL|SUMMARY) ' "$C/$label.raw.log"
  if ! rg -qx 'PASS stored-layout-opts-put-back' "$C/$label.raw.log"; then
    printf 'storage put-back unverified after %s\n' "$label" | tee -a "$C/sequence.raw.log"
    exit 2
  fi
done
```

The initial driver ran three setup attempts. Each reached the settings readback
and exited 2 before the fixture navigation. The settings had the requested
values with keys returned in a different order. Each attempt printed
`PASS stored-layout-opts-put-back` and the old `SUMMARY PASS (0 FAIL)` on that
error path. The corrected script compares the values without relying on key
order and prints `SUMMARY ERROR` when setup fails. The corrected driver stops
on a setup error after checking put-back.

```sh
for path in "$C"/veil3-math12-scroll-*; do mv -- "$path" "$C/setup-${path##*/}"; done
cp "$C/runs.sh" "$C/runs-initial.sh"
sed -i '/^  fi$/a\  if [ "$rc" -gt 1 ]; then exit "$rc"; fi' "$C/runs.sh"
node --check notes/runs/2026-11-24-veil-acceptance/final/stage-L/stored-layout-check.mjs
bash -n "$C/runs.sh"
bash "$C/runs.sh"
```

Both syntax checks exited 0.

See [sequence.log](sequence.log) for the actual start, finish and exit
lines. The three setup attempts took 11, 9 and 10 seconds and exited 2.
The three completed fixture runs took 139, 138 and 139 seconds and
exited 0, each printing the following lines.

```text
PASS stored-layout-restored
PASS stored-layout-none-opacity0
PASS stored-layout-cv-not-veiled
PASS stored-layout-opts-put-back
SUMMARY PASS (0 FAIL)
```

## Restore and release

```sh
LAB=$(cat "$C/lab")
"$B/lab-restore" --lab "$LAB" --owner veil-final-L > "$C/restore.raw.log" 2>&1
rc=$?
printf 'restore finished %s exit=%s\n' "$(date -u +%FT%TZ)" "$rc" | tee -a "$C/sequence.raw.log"
```

```sh
set -o pipefail
"$B/lab-lock" release --lab "$LAB" --owner veil-final-L 2>&1 | tee "$C/release.raw.log"
rc=$?
printf 'release finished %s exit=%s\n' "$(date -u +%FT%TZ)" "$rc" | tee -a "$C/sequence.raw.log"
"$B/lab-lock" status | tee "$C/status.raw.log"
```

```text
restore finished 2026-11-26T21:30:54Z exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release finished 2026-11-26T21:31:01Z exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Counts and curation

```sh
python3 -I "$C/result-counts.py"
jq -c 'select(.rows == 0) | {butter,clearedPresent:has("cleared"),rows}' "$C"/veil3-math12-scroll-{1,2,3}.json.before.json

P=notes/runs/2026-11-24-veil-acceptance/final/stage-L
for label in setup-veil3-math12-scroll-{1,2,3} veil3-math12-scroll-1; do
  rg '^(REPORT |PASS |FAIL |SUMMARY |ERROR Error: stored settings do not match the requested settings$)' "$C/$label.raw.log" > "$P/$label.log"
done
for label in veil3-math12-scroll-{2,3}; do
  rg '^(REPORT |PASS |FAIL |SUMMARY |ERROR Error: stored settings do not match the requested settings$)' "$C/$label.raw.log" > "$P/$label.log"
done
sed -n 's/^restored //p' "$C/restore.raw.log" |
  jq -c '{lab,restarted,ok,tabCount:(.pages|length),composerEmpty:(.composer == ""),extensions:(.browser.extensions|length),at}' > "$P/restore.log"
cat "$C/sequence.raw.log" "$C/release.raw.log" "$C/status.raw.log" > "$P/sequence.log"
rg -n '(https?://|wss?://|file://|chrome-extension://|[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}|/home/|127\.0\.0\.1|password|cookie|token)' "$P" -g '*.log' || test "$?" -eq 1
```

The three count records are in the [summary table](summary.md). The
baseline query returned the same line three times.

```text
{"butter":{"defaultsVersion":2},"clearedPresent":false,"rows":0}
```

The private-data pattern check returned no matches. Per-sample raw JSON
and setup error stacks stay in the capture directory.

An assertion pass over the private JSON checked the sample counts, restored
turn and block counts, computed opacity, settings, persistence hits,
restore-trigger counters and storage put-back.

```text
PASS veil3-math12-scroll-1 capture agrees with summary
PASS veil3-math12-scroll-2 capture agrees with summary
PASS veil3-math12-scroll-3 capture agrees with summary
```

```sh
git add -- "$P"
git diff --cached --check
git commit -m "Record final veil stage L acceptance results (#177)"
git status --short --branch
git log -1 --oneline
"$B/lab-lock" status
```

The staged diff check exited 0 without output.
