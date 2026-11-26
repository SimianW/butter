# Final veil acceptance, stage C2b commands (#177)

Commands ran in the stage C2b worktree, from starting commit
`72bfd15420f9e58e7ef950fc5cd9f09e7b5635eb`. The main checkout was read
only. The lab harness matches `aed9523`.

```sh
git rev-parse HEAD
git diff --stat aed9523 -- lab
git -C ~/Dev/butter branch --show-current
D=~/snap/chromium/common/veil-accept
for b in main3 veil3; do jq -r .version_name "$D/$b/butter/manifest.json"; done
git switch -c veil/177-final-c2b
```

```text
72bfd15420f9e58e7ef950fc5cd9f09e7b5635eb
main
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil3
Switched to a new branch 'veil/177-final-c2b'
```

The file-by-file check used the packaged files in each frozen build.

```sh
python3 -I - "$D" <<'PY'
from pathlib import Path
import json
import subprocess
import sys

root = Path(sys.argv[1])
for label, commit in [('main3', '3b9c3d5'), ('veil3', 'aed9523')]:
    build = root / label / 'butter'
    sources = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', commit, 'extension'], text=True).splitlines()
    for source in sources:
        expected = subprocess.check_output(['git', 'show', f'{commit}:{source}'])
        actual = (build / Path(source).relative_to('extension')).read_bytes()
        if source == 'extension/manifest.json':
            expected, actual = json.loads(expected), json.loads(actual)
            expected['version_name'] = f"{expected['version_name']}+veilaccept.{label}"
        assert expected == actual, f'{label}: {source}'
    print(f'{label}: {len(sources)} source files match {commit}, with the expected manifest version_name suffix')
PY
```

```text
main3: 83 source files match 3b9c3d5, with the expected manifest version_name suffix
veil3: 83 source files match aed9523, with the expected manifest version_name suffix
```

## Sampler preflight

The current probe schedules the write and stops sampling on the same
completion clock. It accepts 14000 ms as the requested delay and defaults to
16000 ms of sampling. The prior stage's captures from this harness each
recorded 60 samples between +14 s and +15 s.

```sh
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2
jq -cr '[.label, .ux.compact[-1][0], ([.ux.compact[] | .[0] | select(. >= 14000 and . <= 15000)] | length)]' "$P"/*-ats12-u2-*.json
node --input-type=module -e 'import {u2DelayMs} from "./lab/harness/stream-ux-probe.mjs"; const delay=u2DelayMs({U2_DELAY:"14000"}); const window=16000; if(window-delay<1000) process.exit(1); console.log({delay,window,nominalPostWrite:window-delay});'
```

```text
["main3-ats12-u2-1",16006.9,60]
["main3-ats12-u2-2",16004.7,60]
["main3-ats12-u2-3",15993.4,60]
["veil3-ats12-u2-1",15995.2,60]
["veil3-ats12-u2-2",16004.5,60]
["veil3-ats12-u2-3",16001.3,60]
{ delay: 14000, window: 16000, nominalPostWrite: 2000 }
```

## Lock, replays, restore and release

The driver comes from [final C2](../stage-C2/commands.md). It sets the later
write, uses the C2b paths and labels, and runs veil3 first in the five-run
sequence.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2b
umask 077
mkdir -p "$C"
cp "$P"/{u2.mjs,strip.py} "$C/"
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The syntax check exited 0 with no output. `seq.sh` as run follows.

```bash
#!/bin/bash
# Final stage C2b: interleave two control and three veil replays under one lock.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2b
D=~/snap/chromium/common/veil-accept
OWN=veil-final-C2b

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
  if rg -l '^FAIL (no-escape|server-unchanged)' "$C" -g '*-u2late-*.raw.log'; then
    echo "stop $NAME: guard FAIL"
    return 99
  fi
  n=$((n+1))
  local started=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  timeout --kill-after=5s "$((1780 - el))s" env LAB_ID="$LAB" LAB_OWNER="$OWN" \
    EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
    PHASES=stream UX=u2 U2_BLOCK=306 U2_DELAY=14000 'OPTS={"rail":true,"bookmark":true}' \
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
  run veil3 "veil3-ats12-u2late-$i" || exit "$?"
  if [ "$i" -lt 3 ]; then
    run main3 "main3-ats12-u2late-$i" || exit "$?"
  fi
done
```

## Execution output

```text
acquire start 2026-11-26T20:06:03Z
acquire lab=2 exit=0 at 2026-11-26T20:37:00Z
run 1 veil3-ats12-u2late-1 start 2026-11-26T20:37:00Z
veil3-ats12-u2late-1 exit=0 took=199s since-lock=199s at 2026-11-26T20:40:19Z
run 2 main3-ats12-u2late-1 start 2026-11-26T20:40:19Z
main3-ats12-u2late-1 exit=0 took=200s since-lock=399s at 2026-11-26T20:43:39Z
run 3 veil3-ats12-u2late-2 start 2026-11-26T20:43:39Z
veil3-ats12-u2late-2 exit=0 took=199s since-lock=598s at 2026-11-26T20:46:58Z
run 4 main3-ats12-u2late-2 start 2026-11-26T20:46:58Z
main3-ats12-u2late-2 exit=0 took=199s since-lock=797s at 2026-11-26T20:50:17Z
run 5 veil3-ats12-u2late-3 start 2026-11-26T20:50:17Z
veil3-ats12-u2late-3 exit=0 took=205s since-lock=1002s at 2026-11-26T20:53:42Z
restore exit=0 at 2026-11-26T20:53:52Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-D2"}
{"lab": "perf", "held": true, "owner": "veil-final-D2"}
done 2026-11-26T20:53:52Z runs=5 since-lock=1012s
```

The driver exited 0. All five replay processes exited 0. The restore
reported `ok:true` and the lab returned to its default extension list.
The stripped restore output is in [restore.log](restore.log). The next
stage had acquired the lab by the time the driver checked lock status.

## Extraction and log stripping

```sh
R=notes/runs/2026-11-24-veil-acceptance/final/stage-C2b
files=("$C"/veil3-ats12-u2late-1.json "$C"/main3-ats12-u2late-1.json "$C"/veil3-ats12-u2late-2.json "$C"/main3-ats12-u2late-2.json "$C"/veil3-ats12-u2late-3.json)
cmp "$C/u2.mjs" "${C%b}/u2.mjs"
cmp "$C/strip.py" "${C%b}/strip.py"
node --check "$C/u2.mjs"
node "$C/u2.mjs" "${files[@]}" > "$C/u2.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
jq -c '(.ux.acts[] | select(.kind == "mid").rt) as $write | {run:.label, lastFrame:.ux.compact[-1][0], postWriteMs: (((.ux.compact[-1][0] - $write) * 10) | round / 10), errors:.ux.errors, flaggedSamples:[.hydration.rows[] | select(.leaks > 0) | {t,veiled,veiledNotAuto,leaks}], opts:.storage0.opts, restored:.optsRestore.same}' "${files[@]}"
```

The comparisons, syntax check, extractor and log filter exited 0.
The extraction redirects to the local captures directory. The JSON check
printed the following.

```json
{"run":"veil3-ats12-u2late-1","lastFrame":15996.2,"postWriteMs":1964.9,"errors":[],"flaggedSamples":[],"opts":null,"restored":true}
{"run":"main3-ats12-u2late-1","lastFrame":15993.5,"postWriteMs":1977.7,"errors":[],"flaggedSamples":[],"opts":null,"restored":true}
{"run":"veil3-ats12-u2late-2","lastFrame":15998.9,"postWriteMs":1969.7,"errors":[],"flaggedSamples":[],"opts":null,"restored":true}
{"run":"main3-ats12-u2late-2","lastFrame":16005.8,"postWriteMs":1976.2,"errors":[],"flaggedSamples":[],"opts":null,"restored":true}
{"run":"veil3-ats12-u2late-3","lastFrame":16002.9,"postWriteMs":1979.7,"errors":[],"flaggedSamples":[],"opts":null,"restored":true}
```

The extractor and strip filter are byte-for-byte copies from final C2.
The filter keeps reports, verdicts and summaries, drops button labels
and callback source, and strips private URLs, identifiers and machine
paths. The stripped logs passed the scan for URLs, loopback endpoints,
UUIDs, extension IDs, emails and home paths.

The medians were computed from the extractor's per-run rows.

```sh
python3 -I - "$C/u2.jsonl" <<'PY'
import json
import statistics
import sys
from decimal import Decimal

rows = [json.loads(line, parse_float=Decimal) for line in open(sys.argv[1])]
for build in ('main3', 'veil3'):
    group = [r for r in rows if r['name'].startswith(build)]
    fields = [(r['blank']['longestFrames'], r['blank']['longestMs'], r['writeToFirstTextSampleMs'],
               r['blank']['writeToClearMs'], r['frame2To3Ms'], r['completionFrame']) for r in group]
    medians = tuple(statistics.median(column) for column in zip(*fields))
    print(build, *(str(x) for x in medians))
    if build == 'main3':
        control = medians[1]
    else:
        print('blank duration gap', medians[1] - control)
PY
```

```text
main3 3.0 120.45 98.1 137.05 44.45 1985.2
veil3 3 125 99.6 141 47.4 693.5
blank duration gap 4.55
```

## Verification

```sh
(cd "$R" && grep -c '^PASS' -- *-u2late-*.log)
(cd "$R" && grep -c '^FAIL' -- *.log)
git diff --cached --check
~/.local/share/chatgpt-lab/bin/lab-lock status
```

The verdict counts matched the per-run table. The FAIL grep exited 1
with zero matches. The staged whitespace check exited 0 without output.

```text
main3-ats12-u2late-1.log:12
main3-ats12-u2late-2.log:12
veil3-ats12-u2late-1.log:13
veil3-ats12-u2late-2.log:13
veil3-ats12-u2late-3.log:13

main3-ats12-u2late-1.log:0
main3-ats12-u2late-2.log:0
release.log:0
restore.log:0
veil3-ats12-u2late-1.log:0
veil3-ats12-u2late-2.log:0
veil3-ats12-u2late-3.log:0

{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-D2"}
{"lab": "perf", "held": true, "owner": "veil-final-D2"}
```
