# Veil4 acceptance, stage C2 commands (#177)

The starting commit was `e36a63c9cd7b5d1b33d5f512763123388251cf95`. Its
harness includes the before-paint probe for u4. The u2 extraction is from
[the veil3 C2 run](../../final/stage-C2/commands.md).

## Worktree and build checks

```sh
git status --short --branch
git rev-parse HEAD
git diff --stat aed9523 HEAD -- lab
git -C ~/Dev/butter branch --show-current
git switch -c veil/177-veil4-c2
```

```text
## test/veil4-c2-acceptance
e36a63c9cd7b5d1b33d5f512763123388251cf95
 lab/README.md                        |  2 +-
 lab/harness/stream-findbar-probe.mjs | 39 +++++++++++++++++++++++++----
 lab/harness/stream-ux-probe.mjs      | 48 ++++++++++++++++++++++++++++++------
 3 files changed, 75 insertions(+), 14 deletions(-)
main
Switched to a new branch 'veil/177-veil4-c2'
```

```sh
python3 - <<'PY'
import json
import subprocess
from pathlib import Path

build_root = Path.home() / 'snap/chromium/common/veil-accept'
for build, commit in [('main3', '3b9c3d5'), ('veil4', '004851d')]:
    root = build_root / build / 'butter'
    files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', commit, 'extension'], text=True).splitlines()
    version_name = None
    for file in files:
        expected = subprocess.check_output(['git', 'show', f'{commit}:{file}'])
        actual = (root / Path(file).relative_to('extension')).read_bytes()
        if file == 'extension/manifest.json':
            expected_manifest = json.loads(expected)
            actual_manifest = json.loads(actual)
            version_name = actual_manifest.pop('version_name')
            assert version_name.endswith(f'+veilaccept.{build}'), version_name
            expected_manifest.pop('version_name', None)
            assert actual_manifest == expected_manifest, file
        else:
            assert actual == expected, file
    subprocess.run(['node', '--check', root / 'stream/offscreen.js'], check=True)
    print(f'{build}: {len(files)} tracked extension files match {commit} with manifest version_name {version_name}', flush=True)
PY
```

```text
main3: 83 tracked extension files match 3b9c3d5 with manifest version_name 0.1.0-alpha.22+veilaccept.main3
veil4: 83 tracked extension files match 004851d with manifest version_name 0.1.0-alpha.22+veilaccept.veil4
```

## Lock, replays, restore and release

```sh
umask 077
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-C2
mkdir -p "$C" &&
sed -e 's/final\/stage-C2/final-veil4\/stage-C2/g' -e 's/veil-final-C2/veil4-C2/g' -e 's/veil3/veil4/g' "$P/seq.sh" > "$C/seq.sh" &&
bash -n "$C/seq.sh" &&
set -o pipefail &&
bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log"
```

The syntax check exited 0 with no output. The driver as run follows.

```bash
#!/bin/bash
# Final stage C2: interleave three control and three veil replays under one lock.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-C2
D=~/snap/chromium/common/veil-accept
OWN=veil4-C2

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
  for BUILD in main3 veil4; do
    run "$BUILD" "$BUILD-ats12-u2-$i" || exit "$?"
  done
done
```

## Execution output

```text
acquire start 2026-11-26T23:02:27Z
acquire lab=2 exit=0 at 2026-11-26T23:59:24Z
run 1 main3-ats12-u2-1 start 2026-11-26T23:59:24Z
main3-ats12-u2-1 exit=0 took=204s since-lock=204s at 2026-11-27T00:02:48Z
run 2 veil4-ats12-u2-1 start 2026-11-27T00:02:48Z
veil4-ats12-u2-1 exit=0 took=200s since-lock=404s at 2026-11-27T00:06:08Z
run 3 main3-ats12-u2-2 start 2026-11-27T00:06:08Z
main3-ats12-u2-2 exit=0 took=199s since-lock=603s at 2026-11-27T00:09:27Z
run 4 veil4-ats12-u2-2 start 2026-11-27T00:09:27Z
veil4-ats12-u2-2 exit=0 took=211s since-lock=814s at 2026-11-27T00:12:58Z
run 5 main3-ats12-u2-3 start 2026-11-27T00:12:58Z
main3-ats12-u2-3 exit=0 took=204s since-lock=1018s at 2026-11-27T00:16:22Z
run 6 veil4-ats12-u2-3 start 2026-11-27T00:16:22Z
veil4-ats12-u2-3 exit=0 took=199s since-lock=1217s at 2026-11-27T00:19:41Z
restore exit=0 at 2026-11-27T00:19:51Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-27T00:19:52Z runs=6 since-lock=1228s
```

The driver exited 0. [Restore](restore.log) reported `ok:true`, and
[release](release.log) reported both locks released. The harness reports
and verdicts are in each run's stripped log.

## Extraction and log stripping

```sh
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C2
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-C2
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-C2
cp "$P/u2.mjs" "$P/strip.py" "$C/"
node --check "$C/u2.mjs"
python3 -I -m py_compile "$C/strip.py"
node "$C/u2.mjs" "$C"/{main3,veil4}-ats12-u2-1.json "$C"/{main3,veil4}-ats12-u2-2.json "$C"/{main3,veil4}-ats12-u2-3.json > "$R/u2.jsonl"
python3 -I "$C/strip.py" "$C" "$R"
python3 -I "$C/report-data.py" "$C" "$R" > "$C/report-data.txt"
python3 -I "$C/tables.py" "$C/report-data.txt" "$C/veil3-comparison.txt" > "$C/tables.md"
```

These commands exited 0 and printed no terminal output. The extractor and
strip filter are the same as in [veil3 C2](../../final/stage-C2/commands.md).
The local reporting helpers checked the extracted count against the
harness count in every capture and generated the tables in
[summary.md](summary.md). The strip filter dropped page text and callback
source and removed private URLs, identifiers and home paths. Only numeric
geometry, timing, flags, public font file names and script attribution
labels remain in [u2.jsonl](u2.jsonl).

## Verification

```sh
(cd "$R" && grep -c '^FAIL' -- *.log)
rg -il '((https?|wss?|chrome-extension)://|\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|\b[a-p]{32}\b|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|/home/|127\.0\.0\.1|localhost|authorization:|bearer )' "$R" -g '*.log' -g '*.jsonl'
~/.local/share/chatgpt-lab/bin/lab-lock status
git add -- "$R"
git diff --cached --check
git commit -m "Record veil4 stage C2 acceptance for #177"
git status --short --branch
git log -1 --oneline
```

The anchored grep exited 1 with these counts.

```text
main3-ats12-u2-1.log:0
main3-ats12-u2-2.log:0
main3-ats12-u2-3.log:0
release.log:0
restore.log:0
veil4-ats12-u2-1.log:0
veil4-ats12-u2-2.log:0
veil4-ats12-u2-3.log:0
```

The privacy scan found no matches. The post-release status showed the
following, after stage E acquired the lab and performance locks.

```json
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil4-E"}
{"lab": "perf", "held": true, "owner": "veil4-E"}
```
