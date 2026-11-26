# Final veil acceptance, stage C2 commands (#177)

The commands ran in the Stage C2 worktree. Its starting commit was
`d3b178bd136ffaf0f2af5f0970e270dcb53e82ee`. The `lab/` tree matches
`aed9523`. The main checkout's current branch was checked read-only.

```sh
git rev-parse HEAD
git diff --stat aed9523 HEAD -- lab
git -C ~/Dev/butter branch --show-current
git switch -c veil/177-final-c2
D=~/snap/chromium/common/veil-accept
for b in main3 veil3; do jq -r .version_name "$D/$b/butter/manifest.json"; done
```

```text
d3b178bd136ffaf0f2af5f0970e270dcb53e82ee
main
Switched to a new branch 'veil/177-final-c2'
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil3
```

A file-by-file comparison against `git ls-tree -r --name-only <commit> extension`
and `git show <commit>:<path>` returned the following.

```text
main3: 83 files match 3b9c3d5, with the expected manifest version_name suffix
veil3: 83 files match aed9523, with the expected manifest version_name suffix
```

## Lock, replays, restore and release

The driver adapts [round 2's sequence](../../round2/stage-C2/commands.md) to
the two final builds and the six standard-delay runs. The timeout protects the
lab's 30 minute budget. The driver retries an acquire that exits 75.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2
umask 077
mkdir -p "$C"
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The syntax check exited 0 with no output. `seq.sh` as run:

```bash
#!/bin/bash
# Final stage C2: interleave three control and three veil replays under one lock.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2
D=~/snap/chromium/common/veil-accept
OWN=veil-final-C2

until
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --perf --wait 3600 --owner "$OWN")
  rc=$?
  echo "acquire lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -eq 0 ] && [ -n "$LAB" ]
do
  [ "$rc" -eq 75 ] || exit 2
done

T0=$(date +%s)
n=0
cleanup() {
  "$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.raw.log" 2>&1
  local restore_rc=$?
  echo "restore exit=$restore_rc at $(date -u +%FT%TZ)"
  if [ "$restore_rc" -ne 0 ]; then
    "$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore-retry.raw.log" 2>&1
    echo "restore retry exit=$? at $(date -u +%FT%TZ)"
  fi
  "$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "done $(date -u +%FT%TZ) runs=$n since-lock=$(( $(date +%s) - T0 ))s"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run() {
  local BUILD=$1 NAME=$2
  local el=$(( $(date +%s) - T0 ))
  if [ "$el" -gt 1500 ] || [ "$n" -ge 10 ]; then
    echo "skip $NAME: ${el}s since lock, $n runs"
    return 99
  fi
  if rg -l '^FAIL (no-escape|server-unchanged)' "$C" -g '*-u2-*.raw.log'; then
    echo "stop $NAME: guard FAIL"
    return 99
  fi
  n=$((n+1))
  local started=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  timeout --kill-after=5s "$((1780 - el))s" env -u U2_DELAY LAB_ID="$LAB" LAB_OWNER="$OWN" \
    EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
    PHASES=stream UX=u2 U2_BLOCK=306 'OPTS={"rail":true,"bookmark":true}' \
    node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  local rc=$?
  echo "$NAME exit=$rc took=$(( $(date +%s) - started ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee "$C/$NAME.time"
  if [ "$rc" -ne 0 ] && ! rg -q '^PASS replay-hook' "$C/$NAME.raw.log"; then
    echo "stop: $NAME failed before the replay"
    return 2
  fi
  return 0
}

for i in 1 2 3; do
  for BUILD in main3 veil3; do
    run "$BUILD" "$BUILD-ats12-u2-$i" || exit "$?"
  done
done
```

## Execution output

```text
acquire start 2026-11-26T18:39:54Z
lab-lock: no lab free within 3600.0s (lab 2: veil-final-C3; perf: veil-final-C3)
acquire lab= exit=75 at 2026-11-26T19:39:54Z
acquire start 2026-11-26T19:39:54Z
acquire lab=2 exit=0 at 2026-11-26T19:42:03Z
run 1 main3-ats12-u2-1 start 2026-11-26T19:42:03Z
main3-ats12-u2-1 exit=0 took=200s since-lock=200s at 2026-11-26T19:45:23Z
run 2 veil3-ats12-u2-1 start 2026-11-26T19:45:23Z
veil3-ats12-u2-1 exit=0 took=205s since-lock=405s at 2026-11-26T19:48:48Z
run 3 main3-ats12-u2-2 start 2026-11-26T19:48:48Z
main3-ats12-u2-2 exit=0 took=201s since-lock=606s at 2026-11-26T19:52:09Z
run 4 veil3-ats12-u2-2 start 2026-11-26T19:52:09Z
veil3-ats12-u2-2 exit=0 took=198s since-lock=804s at 2026-11-26T19:55:27Z
run 5 main3-ats12-u2-3 start 2026-11-26T19:55:27Z
main3-ats12-u2-3 exit=0 took=204s since-lock=1008s at 2026-11-26T19:58:51Z
run 6 veil3-ats12-u2-3 start 2026-11-26T19:58:51Z
veil3-ats12-u2-3 exit=0 took=204s since-lock=1212s at 2026-11-26T20:02:15Z
restore exit=0 at 2026-11-26T20:02:25Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T20:02:25Z runs=6 since-lock=1222s
```

The driver exited 0. The restore reported `ok:true`. Each replay’s report and verdict lines are in its stripped log.

## Extraction and log stripping

```sh
R=notes/runs/2026-11-24-veil-acceptance/final/stage-C2
node --check "$C/u2.mjs"
node "$C/u2.mjs" "$C"/{main3,veil3}-ats12-u2-{1,2,3}.json > "$R/u2.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
```

The extractor is a local copy of [round 2's extractor](../../round2/stage-C2/commands.md).
It adds the write-to-first-text sample time, the second frame interval and its
matching long-animation-frame render part, pre-write geometry changes and the
long frames whose start is at least 1 s after `in_progress gone`. It matches
the second sample's timestamp to the rendering callback interval from
`start + script` to `start + duration - render` with 0.2 ms tolerance for rounding.
See [summary.md](summary.md) for measurement definitions.

The strip filter keeps the harness reports, summaries and verdict lines. It
drops button labels and dumped callback source and replaces URLs, identifiers
and machine paths. The raw logs, full JSON captures and local scripts remain
in `C`. [u2.jsonl](u2.jsonl) contains only sampled geometry, flags, timings,
font family and public asset file names, and script attribution labels.

## Verification

```sh
(cd "$R" && grep -c '^FAIL' -- *.log)
git diff --cached --check
~/.local/share/chatgpt-lab/bin/lab-lock status
```

The extraction and strip commands exited 0. The anchored grep returned the following counts and exited 1 because there were no matches.

```text
main3-ats12-u2-1.log:0
main3-ats12-u2-2.log:0
main3-ats12-u2-3.log:0
release.log:0
restore.log:0
veil3-ats12-u2-1.log:0
veil3-ats12-u2-2.log:0
veil3-ats12-u2-3.log:0
```

The scan of logs and extracted data found no URLs, UUIDs, extension IDs, email addresses or absolute home paths. The post-release status read returned:

```json
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-E"}
{"lab": "perf", "held": true, "owner": "veil-final-E"}
```
