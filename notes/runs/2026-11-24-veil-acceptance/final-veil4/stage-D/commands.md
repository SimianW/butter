# Final veil4 acceptance commands for stage D (#177)

Run from this stage's worktree at `a1d4228` on 2026-11-26. Times are UTC. The fixture was
`ats12`, the control was `main3` (`3b9c3d5`), and the fixed build was `veil4` (`004851d`).
Raw captures and local analysis scripts are in
`~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D/`.

## Branch, driver and build verification

```bash
git switch -c veil/177-veil4-d &&
git rev-parse HEAD &&
git status --short --branch &&
umask 077 &&
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D &&
mkdir -p "$C" &&
sed -e 's@captures/veil-accept/final/stage-D@captures/veil-accept/final-veil4/stage-D@' -e 's/veil-final-D/veil4-D/' -e 's/main3 veil3/main3 veil4/' ~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D/seq.sh > "$C/seq.sh" &&
bash -n "$C/seq.sh" &&
bash "$C/seq.sh" 2>&1 | tee "$C/seq.log"
exit ${PIPESTATUS[0]}
```

```text
Switched to a new branch 'veil/177-veil4-d'
a1d42289389836889c1a04c21ffd3643003003d9
## veil/177-veil4-d
```

```bash
rg 'version_name' ~/snap/chromium/common/veil-accept/{main3,veil4}/butter/manifest.json && node -p 'require.resolve("playwright")'

set -e
for build_ref in main3:3b9c3d5 veil4:004851d; do
  build=${build_ref%%:*}
  ref=${build_ref#*:}
  dir=~/snap/chromium/common/veil-accept/$build/butter
  node --check "$dir/stream/offscreen.js"
  archive_dir=$(mktemp -d)
  git archive "$ref" extension | tar -x -C "$archive_dir"
  printf '%s vs %s\n' "$build" "$ref"
  diff -rq "$archive_dir/extension" "$dir" | sed -E 's@/tmp/[^ /]+@<archive>@g; s@/home/[^ /]+@~@g'
  diff -u "$archive_dir/extension/manifest.json" "$dir/manifest.json" | rg '^[+-]  '
  rm -r -- "$archive_dir"
done
```

```text
~/snap/chromium/common/veil-accept/veil4/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.veil4",
~/snap/chromium/common/veil-accept/main3/butter/manifest.json:  "version_name": "0.1.0-alpha.22+veilaccept.main3",
<worktree>/node_modules/playwright/index.js
main3 vs 3b9c3d5
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/main3/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.main3",
veil4 vs 004851d
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/veil4/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.veil4",
```

## Lock, interleaved runs, restore and release

The [previous stage D driver](../../final/stage-D/commands.md) was reused with the capture path,
owner and extension label updated. It retries only a timed-out acquire (exit 75). Each replay
uses the default 16 s frame sampler and default 500 ms pause before u4. The executed `$C/seq.sh`
follows.

```bash
#!/bin/bash
# Final stage D driver, adapted from round 2. Run from this stage's worktree.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D
D=~/snap/chromium/common/veil-accept
OWN=veil4-D

while :; do
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --owner "$OWN" --wait 3600 --perf)
  rc=$?
  echo "lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -eq 75 ] || break
done
[ "$rc" -eq 0 ] && [ -n "$LAB" ] || exit 1

T0=$(date +%s)
cleanup() {
  local sequence_exit=$?
  trap - EXIT
  echo "restore start $(date -u +%FT%TZ)"
  "$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.log" 2>&1
  local restore_exit=$?
  echo "restore exit=$restore_exit"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
  local release_exit=${PIPESTATUS[0]}
  echo "release exit=$release_exit"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "done $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"
  if [ "$restore_exit" -ne 0 ] || [ "$release_exit" -ne 0 ]; then exit 2; fi
  exit "$sequence_exit"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

n=0
sequence_exit=0
for i in 1 2 3; do
  for BUILD in main3 veil4; do
    NAME=$BUILD-ats12-u4-$i
    el=$(( $(date +%s) - T0 ))
    if [ "$el" -gt 1500 ]; then echo "REFUSE $NAME: ${el}s since lock"; exit 2; fi
    if [ "$n" -ge 9 ]; then echo "REFUSE $NAME: $n runs"; exit 2; fi
    if rg -l '^FAIL (no-escape|server-unchanged)' "$C" -g '*.raw.log'; then
      echo "REFUSE $NAME: guard FAIL"
      exit 2
    fi
    n=$((n+1))
    s=$(date +%s)
    echo "run $n $NAME start $(date -u +%FT%TZ)"
    timeout --kill-after=2s "$((1780 - el))s" env -u UX_SAMPLE_MS -u U4_DELAY_MS \
      LAB_ID="$LAB" LAB_OWNER="$OWN" EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" \
      PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' \
      node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
    rc=$?
    echo "exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s" | tee "$C/$NAME.time"
    rg -c '^PASS ' "$C/$NAME.raw.log"
    rg -e '^REPORT (completion frame|veil-effective)' "$C/$NAME.raw.log"
    if [ "$rc" -ne 0 ]; then
      sequence_exit=1
      if ! rg -q '^PASS replay-hook' "$C/$NAME.raw.log"; then
        echo "STOP: $NAME failed before the replay"
        exit 2
      fi
    fi
  done
done
exit "$sequence_exit"
```

The full sequence output is in [seq.log](seq.log). The [restore log](restore.log) and
[release log](release.log) record the cleanup.

The first acquire began at 22:23:21Z and was interrupted while queued. At 23:01:25Z the
lock status still showed `veil4-B` holding lab 2 and perf. Stage D had acquired neither lock
and run no harness. The following command restarted the same driver and kept the first
attempt in the sequence log.

```bash
set -u
umask 077
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D
printf 'first acquire interrupted at %s (no stage D lock or runs)\n' "$(date -u +%FT%TZ)" >> "$C/seq.log"
bash -n "$C/seq.sh" && bash "$C/seq.sh" 2>&1 | tee -a "$C/seq.log"
exit ${PIPESTATUS[0]}
```

```text
acquire start 2026-11-26T23:01:33Z
lab=2 exit=0 at 2026-11-26T23:18:20Z
run 1 main3-ats12-u4-1 start 2026-11-26T23:18:20Z
```

The sequence exited 0. Run and lock lines from [seq.log](seq.log) follow.

```text
acquire start 2026-11-26T22:23:21Z
first acquire interrupted at 2026-11-26T23:01:33Z (no stage D lock or runs)
acquire start 2026-11-26T23:01:33Z
lab=2 exit=0 at 2026-11-26T23:18:20Z
run 1 main3-ats12-u4-1 start 2026-11-26T23:18:20Z
exit=0 elapsed=210s since-lock=210s
run 2 veil4-ats12-u4-1 start 2026-11-26T23:21:50Z
exit=0 elapsed=204s since-lock=414s
run 3 main3-ats12-u4-2 start 2026-11-26T23:25:14Z
exit=0 elapsed=204s since-lock=618s
run 4 veil4-ats12-u4-2 start 2026-11-26T23:28:38Z
exit=0 elapsed=205s since-lock=823s
run 5 main3-ats12-u4-3 start 2026-11-26T23:32:03Z
exit=0 elapsed=204s since-lock=1027s
run 6 veil4-ats12-u4-3 start 2026-11-26T23:35:27Z
exit=0 elapsed=204s since-lock=1231s
restore start 2026-11-26T23:38:51Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T23:39:02Z since-lock=1242s
```

## Extract, cross-check and strip the captures

```bash
umask 077
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-D
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-D
cp "$P/strip-logs.py" "$C/strip-logs.py"
sed 's/veil3/veil4/g' "$P/u4-extract.mjs" > "$C/u4-extract.mjs"
sed 's/veil3/veil4/g' "$P/final-report-data.py" > "$C/final-report-data.py"
node --check "$C/u4-extract.mjs"
python3 -c 'import ast, sys; [ast.parse(open(path).read()) for path in sys.argv[1:]]' "$C/final-report-data.py" "$C/strip-logs.py"
node --check "$C/check-stage-d.mjs"
python3 -c 'import ast, sys; ast.parse(open(sys.argv[1]).read())' "$C/tables.py"

set +e
node "$C/u4-extract.mjs" "$C"/{main3,veil4}-ats12-u4-{1,2,3}.json > "$C/u4.jsonl"
judge_exit=$?
tail -n 1 "$C/u4.jsonl"
printf 'judge exit=%s\n' "$judge_exit"
set -e
python3 "$C/final-report-data.py" "$C" > "$C/final-report-data.txt"
python3 "$C/strip-logs.py" "$C" "$R"
node "$C/check-stage-d.mjs" "$C" "$R" > "$C/checks.jsonl"
python3 "$C/tables.py" "$C" "$R" | tee "$C/tables.md"
grep -c '^FAIL' "$R"/*.log || test "$?" -eq 1
if rg -il 'https?://|wss?://|chrome-extension://|/home/|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}|127\.0\.0\.1|dev-[[:alnum:]]+|authorization:|bearer +[[:alnum:]]' "$R" -g '*.log'; then exit 1; fi
cat "$R/restore.log" "$R/release.log"
```

The previous stage D extractor checked the all-call bound. The local Python extractor
cross-checked find and select-all measurements against the text logs and extracted geometry and
long frames. The local `check-stage-d.mjs` checked verdict lines against the raw logs, checked
`hydration.rows` for `leaks > 0`, and compared the before-paint lines with the harness formatter
run on the saved JSON records. The local `tables.py` formatted the measurements in the
[summary](summary.md).

```text
{"medians":{"main3":{"n":9,"first":[97.3,96.4,97.7],"later":[84.2,83.9,87.2,92.7,82.3,82.7],"medAll":87.2,"medFirst":97.3,"medLater":84.1,"selLens":[35863,35863,35863],"selMs":[120.3,112.1,111],"medSelMs":112.1},"veil4":{"n":9,"first":[90.1,90.7,93.7],"later":[81.5,84.8,85,84.1,82,82.1],"medAll":84.8,"medFirst":90.7,"medLater":83.1,"selLens":[35863,35863,35863],"selMs":[113,114.9,115.2],"medSelMs":114.9}},"rule":{"headMedian":87.2,"veilMedian":84.8,"twiceHead":174.4,"headPlus150":237.2,"within":true,"selectAllSameLength":true}}
judge exit=0

grep -c '^FAIL' (paths relative to the stage D folder)
./main3-ats12-u4-1.log:0
./main3-ats12-u4-2.log:0
./main3-ats12-u4-3.log:0
./release.log:0
./restore.log:0
./seq.log:0
./veil4-ats12-u4-1.log:0
./veil4-ats12-u4-2.log:0
./veil4-ats12-u4-3.log:0

Before-paint lines matching their JSON records: 24 of 24.
Hydration samples with leaks > 0: 0 on every run.
```

The privacy scan found zero matching log paths. The redacted logs preserve the original verdict
lines. Raw logs, JSON and temporary extractors stay in the capture directory.
