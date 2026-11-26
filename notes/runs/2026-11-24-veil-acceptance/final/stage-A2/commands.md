# Final veil acceptance, stage A2 commands (#177)

Run in the Stage A2 worktree. Timestamps are UTC on 2026-11-26. The harness
matches `aed9523`.

```sh
git rev-parse HEAD feat/implement-spec-170
git diff --exit-code aed9523 HEAD -- lab/harness
git switch -c veil/177-final-a2
git -C ~/Dev/butter branch --show-current
D=~/snap/chromium/common/veil-accept
for build in main3 veil3; do jq -r .version_name "$D/$build/butter/manifest.json"; done
```

```text
5ae6accb8e7d2526ae2f7c5669c4991bdf2a872e
5ae6accb8e7d2526ae2f7c5669c4991bdf2a872e
Switched to a new branch 'veil/177-final-a2'
main
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil3
```

Both prebuilt trees matched their source commits file by file, including the
expected manifest version-name suffixes.

```text
main3: 83 files match 3b9c3d5, with the expected manifest version_name suffix
veil3: 83 files match aed9523, with the expected manifest version_name suffix
```

## Sequence

The driver uses the [stage A sequence](../stage-A/commands.md) with the A2
labels, capture directory and scrolling options. It omits the trace replay
and checks the restoration lines before proceeding to the next run. Replay
stdout and stderr go to the private raw logs.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A2
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The syntax check exited 0 without output. Driver as run below.

```bash
#!/bin/bash
# Final stage A2: run three interleaved pairs with Smoother scrolling on.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A2
D=~/snap/chromium/common/veil-accept
OWNER=veil-final-A2
until
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --perf --wait 3600 --owner "$OWNER")
  rc=$?
  echo "acquire lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -eq 0 ]
do
  [ "$rc" -eq 75 ] || exit "$rc"
done

T0=$(date +%s)
N=0
cleanup() {
  "$B/lab-restore" --lab "$LAB" --owner "$OWNER" > "$C/restore.log" 2>&1
  echo "restore exit=$? at $(date -u +%FT%TZ)"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWNER" 2>&1 | tee "$C/release.log"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "SEQ DONE $(date -u +%FT%TZ) runs=$N since-lock=$(( $(date +%s) - T0 ))s"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run() {
  local NAME=$1 BUILD=$2
  shift 2
  local el=$(( $(date +%s) - T0 ))
  if [ "$el" -gt 1550 ] || [ "$N" -ge 10 ]; then
    echo "SKIP $NAME: ${el}s since lock, $N runs"
    return 99
  fi
  if rg -l '^FAIL (no-escape|server-unchanged)' "$C" -g '*.raw.log'; then
    echo "STOP $NAME: guard FAIL"
    return 99
  fi
  N=$((N+1))
  local started=$(date +%s)
  echo "start $NAME at $(date -u +%FT%TZ)"
  timeout --kill-after=5s "$((1780 - el))s"     env LAB_ID="$LAB" LAB_OWNER="$OWNER" EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
      PHASES=stream 'OPTS={"rail":true,"bookmark":true,"older":true,"seek":true}' "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  local rc=$?
  echo "$NAME exit=$rc took=$(( $(date +%s) - started ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee "$C/$NAME.time"
  if ! python3 - "$C/$NAME.raw.log" <<'CHECK'
import json
import re
import sys
from pathlib import Path

lines = Path(sys.argv[1]).read_text().splitlines()
before = [re.search(r"opts (.*); OPTS ", line) for line in lines if "storage before the run" in line]
after = [re.search(r"same as before true, opts (.*)$", line) for line in lines if "OPTS put back" in line]
if len(before) != 1 or len(after) != 1 or before[0] is None or after[0] is None:
    sys.exit("Cannot confirm options were restored")
before_opts = json.loads(before[0][1])
after_opts = json.loads(after[0][1])
if before_opts != after_opts or {"older", "seek"} & (after_opts or {}).keys():
    sys.exit("Unexpected stored options after replay")
CHECK
  then
    echo "STOP $NAME: options check failed"
    return 99
  fi
  return 0
}
for i in 1 2 3; do
  run "main3-ats12-stream-scroll-$i" main3 || exit "$?"
  run "veil3-ats12-stream-scroll-$i" veil3 || exit "$?"
done
```

## Execution output

```text
acquire start 2026-11-26T19:45:51Z
acquire lab=2 exit=0 at 2026-11-26T20:17:51Z
start main3-ats12-stream-scroll-1 at 2026-11-26T20:17:51Z
main3-ats12-stream-scroll-1 exit=0 took=190s since-lock=190s at 2026-11-26T20:21:01Z
start veil3-ats12-stream-scroll-1 at 2026-11-26T20:21:01Z
veil3-ats12-stream-scroll-1 exit=0 took=190s since-lock=380s at 2026-11-26T20:24:11Z
start main3-ats12-stream-scroll-2 at 2026-11-26T20:24:11Z
main3-ats12-stream-scroll-2 exit=0 took=190s since-lock=570s at 2026-11-26T20:27:21Z
start veil3-ats12-stream-scroll-2 at 2026-11-26T20:27:21Z
veil3-ats12-stream-scroll-2 exit=0 took=190s since-lock=760s at 2026-11-26T20:30:31Z
start main3-ats12-stream-scroll-3 at 2026-11-26T20:30:31Z
main3-ats12-stream-scroll-3 exit=0 took=189s since-lock=949s at 2026-11-26T20:33:40Z
start veil3-ats12-stream-scroll-3 at 2026-11-26T20:33:40Z
veil3-ats12-stream-scroll-3 exit=0 took=190s since-lock=1139s at 2026-11-26T20:36:50Z
restore exit=0 at 2026-11-26T20:37:00Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-C2b"}
{"lab": "perf", "held": true, "owner": "veil-final-C2b"}
SEQ DONE 2026-11-26T20:37:00Z runs=6 since-lock=1149s
```

The driver's shell pipeline exited 0. `restore.log` records `"ok":true`.
The six replay logs retain the reports and verdicts.

## Extraction and stripping

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A2
P=notes/runs/2026-11-24-veil-acceptance/round2/stage-A
R=notes/runs/2026-11-24-veil-acceptance/final/stage-A2
python3 -I "$P/runs.py" "$C"/{main3,veil3}-ats12-stream-scroll-{1,2,3}.json > "$C/timing.jsonl"
python3 -I "$C/details.py" "$C"/{main3,veil3}-ats12-stream-scroll-{1,2,3}.json > "$C/details.jsonl"
python3 -I "${C%/*}/stage-A/strip.py" "$C" "$R"
python3 -I "$C/tables.py" "$C" "$R" > "$C/tables.md"
python3 -I "$C/summary.py" "$C" "$R" > "$R/summary.md"
```

All extraction commands exited 0. The driver, helpers, JSON, and raw logs
stay in `C`. The stage A filter removes page button labels and dumped rAF
function snippets and replaces private URLs and identifiers. The extracted
tables are in [the summary](summary.md).

## Verification

```sh
(cd "$R" && grep -c '^FAIL' -- *.log)
(cd "$R" && grep -c 'same as before true, opts null' -- *-scroll-*.log)
(cd "$R" && grep -c 'data-butter-off "layout"' -- *-scroll-*.log)
~/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
main3-ats12-stream-scroll-1.log:0
main3-ats12-stream-scroll-2.log:0
main3-ats12-stream-scroll-3.log:0
release.log:0
restore.log:0
veil3-ats12-stream-scroll-1.log:0
veil3-ats12-stream-scroll-2.log:0
veil3-ats12-stream-scroll-3.log:0
```

The anchored grep exited 1 with zero matches. Restoration and off-list checks each returned the following six counts.

```text
main3-ats12-stream-scroll-1.log:1
main3-ats12-stream-scroll-2.log:1
main3-ats12-stream-scroll-3.log:1
veil3-ats12-stream-scroll-1.log:1
veil3-ats12-stream-scroll-2.log:1
veil3-ats12-stream-scroll-3.log:1
```

A separate lock check returned the same ownership as the driver’s status output.

```json
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil-final-C2b"}
{"lab": "perf", "held": true, "owner": "veil-final-C2b"}
```

The privacy scan found no URLs, email addresses, UUIDs, extension IDs, private endpoints, or absolute home paths in the stripped logs.
