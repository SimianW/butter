# Final veil acceptance commands for stage D (#177)

Run from this stage's worktree at `aed9523` on 2026-11-26. Times are UTC.
The live fixture is `ats12`. The control is `3b9c3d5` (`main3`), and the final veil build is
`aed9523` (`veil3`). The harness is the worktree's copy at `aed9523`.
The raw captures, temporary analysis scripts and unstripped sequence log are in
`~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D/`.

## Branch and build verification

```sh
git switch -c veil/177-final-d && git rev-parse HEAD && git status --short --branch
for build in main3 veil3; do
  dir=~/snap/chromium/common/veil-accept/$build/butter
  rg 'version_name' "$dir/manifest.json" && node --check "$dir/stream/offscreen.js"
done
node -e 'console.log(require.resolve("playwright"))'
for p in main3:3b9c3d5 veil3:aed9523; do
  n=${p%%:*}
  s=${p#*:}
  T=$(mktemp -d)
  git archive "$s" extension | tar -x -C "$T"
  printf '%s\n' "$n vs $s"
  diff -rq "$T/extension" ~/snap/chromium/common/veil-accept/"$n"/butter | sed -E 's@/tmp/[^ /]+@<archive>@g; s@/home/[^ /]+@~@g'
  diff -u "$T/extension/manifest.json" ~/snap/chromium/common/veil-accept/"$n"/butter/manifest.json | rg '^[+-]  '
  rm -r -- "$T"
done
```

```text
Switched to a new branch 'veil/177-final-d'
aed952361352d58de4a41ef211df8a289df893a5
## veil/177-final-d
  "version_name": "0.1.0-alpha.22+veilaccept.main3",
  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
<worktree>/node_modules/playwright/index.js
main3 vs 3b9c3d5
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/main3/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.main3",
veil3 vs aed9523
Files <archive>/extension/manifest.json and ~/snap/chromium/common/veil-accept/veil3/butter/manifest.json differ
-  "version_name": "0.1.0-alpha.22",
+  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
```

## Lock, interleaved runs, restore and release

The sequence uses the [round 2 driver](../../round2/stage-D/seq.sh) with the frozen builds,
final-round owner and capture path. An acquire that exits 75 retries. Each replay uses the
harness defaults for the 16 s sampler and the delay before u4. The driver gives the last
run until 20 s before the budget limit, leaving time for the restore and release.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D
bash -n "$C/seq.sh" && bash "$C/seq.sh" 2>&1 | tee "$C/seq.log"
exit ${PIPESTATUS[0]}
```

Contents of the executed `$C/seq.sh`.

```bash
#!/bin/bash
# Final stage D driver, adapted from round 2. Run from this stage's worktree.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D
D=~/snap/chromium/common/veil-accept
OWN=veil-final-D

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
  for BUILD in main3 veil3; do
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

The sequence exited 0. Its [log](seq.log) contains the acquire, run exit codes, completion-frame
reports and lock operations. Here are the run and lock lines.

```text
acquire start 2026-11-26T18:13:57Z
lab=2 exit=0 at 2026-11-26T19:00:21Z
run 1 main3-ats12-u4-1 start 2026-11-26T19:00:21Z
exit=0 elapsed=204s since-lock=204s
run 2 veil3-ats12-u4-1 start 2026-11-26T19:03:45Z
exit=0 elapsed=211s since-lock=415s
run 3 main3-ats12-u4-2 start 2026-11-26T19:07:16Z
exit=0 elapsed=203s since-lock=618s
run 4 veil3-ats12-u4-2 start 2026-11-26T19:10:39Z
exit=0 elapsed=212s since-lock=830s
run 5 main3-ats12-u4-3 start 2026-11-26T19:14:11Z
exit=0 elapsed=210s since-lock=1040s
run 6 veil3-ats12-u4-3 start 2026-11-26T19:17:41Z
exit=0 elapsed=208s since-lock=1248s
restore start 2026-11-26T19:21:09Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T19:21:20Z since-lock=1259s
```

The [restore log](restore.log) records a successful restart with the lab's default extension set,
the home tab, an empty composer and `"ok":true`.

## Extract and strip the captures

The local `u4-extract.mjs` is the [round 2 extractor](../../round2/stage-D/u4-extract.mjs) with
the build keys changed. A local Python extraction cross-checked the find and select-all values
against the text logs and read the scroll positions, turn heights and long animation frames from
the JSON captures. The strip command removed private URLs, home paths and DOM IDs from the
text logs. The JSON captures remain in the lab's captures directory.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-D
R=notes/runs/2026-11-24-veil-acceptance/final/stage-D
node "$C/u4-extract.mjs" "$C"/{main3,veil3}-ats12-u4-{1,2,3}.json > "$C/u4.jsonl"
judge_exit=$?
tail -n 1 "$C/u4.jsonl"
printf 'judge exit=%s\n' "$judge_exit"
python3 "$C/final-report-data.py" "$C" > "$C/final-report-data.txt"
python3 "$C/strip-logs.py" "$C" "$R" && grep -c FAIL "$R"/*.log
grep -c '^FAIL ' "$R"/*.log
rg -l 'https?://|wss?://|chrome-extension://|/home/|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}' "$R" -g '*.log'
```

```text
{"medians":{"main3":{"n":9,"first":[99.3,98.2,94.7],"later":[83.3,86.5,82.9,85.7,83.2,86.2],"medAll":86.2,"medFirst":98.2,"medLater":84.5,"selLens":[35863,35863,35863],"selMs":[112.2,112.2,111.6],"medSelMs":112.2},"veil3":{"n":9,"first":[92.8,158.7,91.6],"later":[81.7,82.9,81.7,86.7,83.2,95.5],"medAll":86.7,"medFirst":92.8,"medLater":83.1,"selLens":[35863,35863,35863],"selMs":[114.6,112.7,111.4],"medSelMs":112.7}},"rule":{"headMedian":86.2,"veilMedian":86.7,"twiceHead":172.4,"headPlus150":236.2,"within":true,"selectAllSameLength":true}}
judge exit=0
Medians, ranges and bound checks
0 {'main3': [3, 94.7, 99.3, Decimal('98.2')], 'veil3': [3, 91.6, 158.7, Decimal('92.8')]}
  bounds 196.4 / 248.2; inside True / True
1 {'main3': [3, 82.9, 83.3, Decimal('83.2')], 'veil3': [3, 81.7, 83.2, Decimal('81.7')]}
  bounds 166.4 / 233.2; inside True / True
2 {'main3': [3, 85.7, 86.5, Decimal('86.2')], 'veil3': [3, 82.9, 95.5, Decimal('86.7')]}
  bounds 172.4 / 236.2; inside True / True
all {'main3': [9, 82.9, 99.3, Decimal('86.2')], 'veil3': [9, 81.7, 158.7, Decimal('86.7')]}
  bounds 172.4 / 236.2; inside True / True
select {'main3': [3, 111.6, 112.2, Decimal('112.2')], 'veil3': [3, 111.4, 114.6, Decimal('112.7')]}
completion {'main3': [3, 1960.8, 2058.3, Decimal('1964.2')], 'veil3': [3, 625.1, 664.1, Decimal('642.1')]}

grep -c FAIL (paths relative to the stage D folder)
main3-ats12-u4-1.log:1
main3-ats12-u4-2.log:1
main3-ats12-u4-3.log:1
release.log:0
restore.log:0
seq.log:0
veil3-ats12-u4-1.log:1
veil3-ats12-u4-2.log:1
veil3-ats12-u4-3.log:1

grep -c '^FAIL ' (paths relative to the stage D folder)
main3-ats12-u4-1.log:0
main3-ats12-u4-2.log:0
main3-ats12-u4-3.log:0
release.log:0
restore.log:0
seq.log:0
veil3-ats12-u4-1.log:0
veil3-ats12-u4-2.log:0
veil3-ats12-u4-3.log:0
```

The privacy scan returned zero matching log paths. The full measurements and verdicts are in
[summary.md](summary.md).
