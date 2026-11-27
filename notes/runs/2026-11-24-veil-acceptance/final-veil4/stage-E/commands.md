# Final veil4 acceptance, stage E commands (#177)

The stage worktree and `feat/implement-spec-170` both started at
`ac8a156ef08caecc405e6dcc59b9ece465a7be3c`. The lab's main checkout was on `main`.

## Branch, harness and frozen builds

```sh
git switch -c veil/177-veil4-e
git rev-parse HEAD feat/implement-spec-170
git -C /home/simon/Dev/butter branch --show-current
D=~/snap/chromium/common/veil-accept
rg version_name "$D"/{veil4,veil3}/butter/manifest.json
node --check lab/harness/stream-replay-live.mjs
node --check "$D/veil4/butter/stream/offscreen.js"
node --check "$D/veil3/butter/stream/offscreen.js"
node -e 'console.log(require.resolve("playwright"))'
git diff --stat 004851d..HEAD -- lab/harness
```

```text
Switched to a new branch 'veil/177-veil4-e'
ac8a156ef08caecc405e6dcc59b9ece465a7be3c
ac8a156ef08caecc405e6dcc59b9ece465a7be3c
main
~/snap/chromium/common/veil-accept/veil3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
~/snap/chromium/common/veil-accept/veil4/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil4",
<worktree>/node_modules/playwright/index.js
 lab/harness/stream-findbar-probe.mjs | 39 +++++++++++++++++++++++++----
 lab/harness/stream-ux-probe.mjs      | 48 ++++++++++++++++++++++++++++++------
 2 files changed, 74 insertions(+), 13 deletions(-)
```

All three syntax checks exited 0 without output. The harness diff affects
optional find and UX probes. The wheel probe is the same as in veil3 stage E.

```sh
D=~/snap/chromium/common/veil-accept
set -e
for build_ref in veil4:004851d veil3:aed9523; do
  build=${build_ref%%:*}
  ref=${build_ref#*:}
  archive_dir=$(mktemp -d)
  git archive "$ref" extension | tar -x -C "$archive_dir"
  printf '%s vs %s\n' "$build" "$ref"
  diff -rq "$archive_dir/extension" "$D/$build/butter" | sed -E 's@/tmp/[^ /]+@<archive>@g; s@/home/[^ /]+@~@g'
  diff -u "$archive_dir/extension/manifest.json" "$D/$build/butter/manifest.json" | rg '^[+-]  '
  rm -r -- "$archive_dir"
done
```

```text
veil4 vs 004851d
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/veil4/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.veil4",
veil3 vs aed9523
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/veil3/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
```

## Lock, replays, restore and release

The [veil3 driver](../../final/stage-E/commands.md) was reused with the new
capture directory, owner and labels, and the veil3 anchor appended. The
driver checks the stored options and fingerprints before and after every run.
It retries lock acquisition on exit 75 and reserves time to restore the lab
within the 30-minute budget. It ran in the foreground from the stage worktree.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-E
bash -n "$C/seq.sh" && set -o pipefail && bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The executed driver follows.

````sh
#!/bin/bash
# Adapted from Stage E's round-one driver. Run from this Stage E worktree.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-E
D=~/snap/chromium/common/veil-accept
OWN=veil4-E
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

for slot in default-1 scroll-1 default-2 scroll-2 default-anchor; do
    setting=${slot%-*}
    case "$setting" in
      default) opts='{"rail":true,"bookmark":true}' ;;
      scroll) opts='{"rail":true,"bookmark":true,"older":true,"seek":true}' ;;
    esac
    build=veil4
    if [ "$slot" = default-anchor ]; then build=veil3; fi
    NAME=$build-ats12-all-$slot
    elapsed=$(( $(date +%s) - T0 ))
    if [ "$elapsed" -gt 1500 ] || [ "$n" -ge 10 ]; then
      echo "STOP: budget guard before $NAME, ${elapsed}s and $n prior runs"
      exit 2
    fi
    n=$((n + 1))
    s=$(date +%s)
    echo "run $n $NAME start $(stamp)"
    timeout -k 5 "$((1780 - elapsed))s" env -u PHASES LAB_ID="$LAB" LAB_OWNER="$OWN" \
      EXT="$D/$build/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
      VEILPROBE=1 OPTS="$opts" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
    rc=$?
    echo "$NAME exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s at $(stamp)" | tee "$C/$NAME.time"
    rg '^(PASS|FAIL|SUMMARY|REPORT (completion frame|storage before the run|OPTS put back))' "$C/$NAME.raw.log" \
      | sed -E 's@https?://[^[:space:]]+@<private-url>@g; s@/home/[^/[:space:]]+@~@g'
    python3 -I - "$C/$NAME.raw.log" "$opts" <<'PY'
import json
from pathlib import Path
import re
import sys

lines = Path(sys.argv[1]).read_text().splitlines()
before = [re.fullmatch(r"REPORT storage before the run: sha256 (\w+), .* opts (.*); OPTS (.*)", line)
          for line in lines if line.startswith("REPORT storage before the run:")]
after = [re.fullmatch(r"REPORT OPTS put back: sha256 (\w+), same as before true, opts (.*)", line)
         for line in lines if line.startswith("REPORT OPTS put back:")]
if len(before) != 1 or len(after) != 1 or before[0] is None or after[0] is None:
    sys.exit("STOP: required options snapshot or matching restore is absent")
before_hash, before_opts, applied = before[0].groups()
after_hash, after_opts = after[0].groups()
stored = json.loads(before_opts)
if (before_hash != after_hash or stored != json.loads(after_opts)
        or any(key in (stored or {}) for key in ("older", "seek"))
        or json.loads(applied) != json.loads(sys.argv[2])):
    sys.exit("STOP: stored or applied options differ from the Stage E requirement")
PY
    if [ "$?" -ne 0 ]; then exit 2; fi
    if rg -q '^FAIL (no-escape|server-unchanged)' "$C/$NAME.raw.log"; then
      echo "STOP: send guard verdict failed"
      exit 2
    fi
    if [ "$rc" -ne 0 ] && ! rg -q '^PASS replay-hook' "$C/$NAME.raw.log"; then
      echo "STOP: $NAME failed before the replay"
      exit 2
    fi
done
````

## Execution output

The sequence exited 0. Each replay's stripped log contains its measured report
lines, verdicts, exit code and elapsed time. The sequence timings follow in UTC.

```sh
rg '^(acquire|run [0-9]|veil[34]-.* exit=|restore (start|exit)|release exit|done |\{"lab":)' "$C/sequence.log"
```

```text
acquire attempt=1 start 2026-11-26T23:42:52Z
acquire attempt=1 lab=2 exit=0 waited=2220s at 2026-11-27T00:19:52Z
run 1 veil4-ats12-all-default-1 start 2026-11-27T00:19:52Z
veil4-ats12-all-default-1 exit=0 elapsed=230s since-lock=230s at 2026-11-27T00:23:42Z
run 2 veil4-ats12-all-scroll-1 start 2026-11-27T00:23:42Z
veil4-ats12-all-scroll-1 exit=0 elapsed=225s since-lock=455s at 2026-11-27T00:27:27Z
run 3 veil4-ats12-all-default-2 start 2026-11-27T00:27:27Z
veil4-ats12-all-default-2 exit=0 elapsed=225s since-lock=680s at 2026-11-27T00:31:12Z
run 4 veil4-ats12-all-scroll-2 start 2026-11-27T00:31:12Z
veil4-ats12-all-scroll-2 exit=0 elapsed=230s since-lock=910s at 2026-11-27T00:35:02Z
run 5 veil3-ats12-all-default-anchor start 2026-11-27T00:35:02Z
veil3-ats12-all-default-anchor exit=0 elapsed=231s since-lock=1141s at 2026-11-27T00:38:53Z
restore start 2026-11-27T00:38:53Z
restore exit=0 at 2026-11-27T00:39:03Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0 at 2026-11-27T00:39:03Z
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-27T00:39:03Z runs=5 since-lock=1151s
```

[Lab restore](restore.log) reported `ok:true`. [Lock release](release.log)
reported both the lab and performance lock released.

## Extraction and verification

The reused extractor also selected LoAF totals, maximum absolute shifts and
all the requested hydration fields. The raw logs, JSON and helper scripts
are in `$C`. The stripped logs omit button labels, function snippets and
raw endpoint reports.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-E
H=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-E
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-E
python3 -I "$C/extract.py" "$H"/veil3-ats12-all-{default-1,scroll-1,default-2,scroll-2}.json > "$C/historical-details.jsonl"
python3 -I "$C/extract.py" "$C"/veil4-ats12-all-{default-1,scroll-1,default-2,scroll-2}.json "$C/veil3-ats12-all-default-anchor.json" > "$C/details.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
grep -c '^PASS ' "$R"/veil*.log
grep -c '^FAIL' "$R"/*.log
printf 'FAIL search exit=%d\n' "$?"
grep -nEi '(https?|wss?|chrome-extension)://|/home/|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|[a-p]{32}|(localhost|127\.0\.0\.1)|@[a-z0-9.-]+\.[a-z]{2,}' "$R"/*.log
printf 'private-data search exit=%d\n' "$?"
~/.local/share/chatgpt-lab/bin/lab-lock status
```

The extraction and stripping commands exited 0 with no terminal output. The
PASS counts and FAIL counts from the two `grep` invocations follow with the
common directory prefix removed. The privacy scan found no matches.

```text
veil3-ats12-all-default-anchor.log:14
veil4-ats12-all-default-1.log:14
veil4-ats12-all-default-2.log:14
veil4-ats12-all-scroll-1.log:14
veil4-ats12-all-scroll-2.log:14
release.log:0
restore.log:0
veil3-ats12-all-default-anchor.log:0
veil4-ats12-all-default-1.log:0
veil4-ats12-all-default-2.log:0
veil4-ats12-all-scroll-1.log:0
veil4-ats12-all-scroll-2.log:0
FAIL search exit=1
private-data search exit=1
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```
