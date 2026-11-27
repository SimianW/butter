# Commands for veil4 acceptance stage C3 (#177)

All timestamps use UTC. The starting worktree branch was `test/veil4-c3-acceptance`.
Its head and the local `feat/implement-spec-170` integration tip both pointed to
`e6e9bc8`. The main checkout was on `main`.

## Setup

```sh
git status --short --branch
git rev-parse HEAD feat/implement-spec-170
git -C /home/simon/Dev/butter status --short --branch
git diff --stat 004851d HEAD -- lab/harness
rg 'version_name' ~/snap/chromium/common/veil-accept/{main3,veil4}/butter/manifest.json
git switch -c veil/177-veil4-c3
```

```text
## test/veil4-c3-acceptance
e6e9bc8a0156abdb58b96bd4a4abd686f66b94a3
e6e9bc8a0156abdb58b96bd4a4abd686f66b94a3
## main...origin/main
 lab/harness/stream-findbar-probe.mjs | 39 +++++++++++++++++++++++++----
 lab/harness/stream-ux-probe.mjs      | 48 ++++++++++++++++++++++++++++++------
 2 files changed, 74 insertions(+), 13 deletions(-)
main3 manifest: "version_name": "0.1.0-alpha.22+veilaccept.main3",
veil4 manifest: "version_name": "0.1.0-alpha.22+veilaccept.veil4",
Switched to a new branch 'veil/177-veil4-c3'
```

The harness changes on the integration tip since `004851d` are for the
`u4` find and scroll-into-view probes. The `u1` measurement is unchanged.
Build paths in the manifest output above are shortened to their labels.

## Lock, runs, restore and release

```sh
set -e -o pipefail
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-C3
mkdir -m 700 -p "$C"
bash -n "$C/seq.sh"
rg -n 'OWNER|acquire|TAIL_MS|TRACE|OPTS|BUILD in' "$C/seq.sh"
bash "$C/seq.sh" | tee "$C/sequence.log"
```

The driver below comes from final stage C3 on veil3. This round uses the
default 16 s `u1` frame sampler and default 5 s standard hydration and LoAF
window. The two builds were already available.

```bash
#!/bin/bash
# Final stage C3 driver: one lock, 3 main3 + 3 veil4 ats12 PHASES=stream UX=u1 runs interleaved, then restore + release.
set -u -o pipefail
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil4/stage-C3
D=~/snap/chromium/common/veil-accept
WT=$PWD
OWN=veil4-C3
mkdir -p $C
while true; do
  echo "acquire start $(date -u +%FT%TZ)"
  LAB=$("$B/lab-lock" acquire --lab auto --needs-fixture ats12 --owner "$OWN" --wait 3600 --perf); rc=$?
  echo "lab=$LAB exit=$rc at $(date -u +%FT%TZ)"
  [ "$rc" -ne 75 ] && break
done
[ "$rc" -eq 0 ] && [ -n "$LAB" ] || exit 1
T0=$(date +%s); echo "T0=$T0"
cleanup() {
  echo "restore start $(date -u +%FT%TZ)"
  "$B/lab-restore" --lab "$LAB" --owner "$OWN" > "$C/restore.log" 2>&1
  local restore_rc=$?
  echo "restore exit=$restore_rc"
  "$B/lab-lock" release --lab "$LAB" --owner "$OWN" 2>&1 | tee "$C/release.log"
  local release_rc=$?
  echo "release exit=$release_rc"
  "$B/lab-lock" status 2>&1 | tee -a "$C/release.log"
  echo "done $(date -u +%FT%TZ) since-lock=$(( $(date +%s) - T0 ))s"
  if (( restore_rc || release_rc )); then exit 1; fi
}
trap cleanup EXIT
n=0
for i in 1 2 3; do for BUILD in main3 veil4; do
  NAME=$BUILD-ats12-u1-$i
  el=$(( $(date +%s) - T0 ))
  if [ $el -gt 1500 ]; then echo "REFUSE $NAME: ${el}s since lock"; exit 0; fi
  if [ $n -ge 10 ]; then echo "REFUSE $NAME: $n runs"; exit 0; fi
  if grep -l -E 'FAIL (no-escape|server-unchanged)' $C/*.raw.log 2>/dev/null; then echo "REFUSE $NAME: guard FAIL"; exit 0; fi
  n=$((n+1)); s=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  ( cd "$WT" && timeout --kill-after=5s "$((1770 - el))s" env -u TAIL_MS -u TRACE -u TRACE_AT -u TRACE_SPAN -u UX_SAMPLE_MS LAB_ID="$LAB" LAB_OWNER="$OWN" \
      EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" PHASES=stream UX=u1 \
      'OPTS={"rail":true,"bookmark":true}' \
      node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1 )
  rc=$?
  echo "exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s" | tee $C/$NAME.time
  grep -E '^(PASS|FAIL|SUMMARY)' $C/$NAME.raw.log
  grep -E '^REPORT (completion frame|build|veil-effective|ux)' $C/$NAME.raw.log | cut -c1-400
  if [ $rc -ne 0 ] && ! grep -q '^PASS replay-hook' $C/$NAME.raw.log; then echo "STOP: $NAME failed before the replay"; exit 1; fi
done; done

```

The driver exited 0. Each replay's unabridged verdict lines and reported
measurements are in its stripped log. The sequence timing and lock output follows.

```text
acquire start 2026-11-26T23:22:44Z
lab=2 exit=0 at 2026-11-26T23:39:02Z
run 1 main3-ats12-u1-1 start 2026-11-26T23:39:02Z
exit=0 elapsed=199s since-lock=199s
run 2 veil4-ats12-u1-1 start 2026-11-26T23:42:21Z
exit=0 elapsed=200s since-lock=399s
run 3 main3-ats12-u1-2 start 2026-11-26T23:45:41Z
exit=0 elapsed=199s since-lock=598s
run 4 veil4-ats12-u1-2 start 2026-11-26T23:49:00Z
exit=0 elapsed=205s since-lock=803s
run 5 main3-ats12-u1-3 start 2026-11-26T23:52:25Z
exit=0 elapsed=210s since-lock=1013s
run 6 veil4-ats12-u1-3 start 2026-11-26T23:55:55Z
exit=0 elapsed=198s since-lock=1211s
restore start 2026-11-26T23:59:13Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil4-C2"}
{"lab": "perf", "held": true, "owner": "veil4-C2"}
done 2026-11-26T23:59:24Z since-lock=1222s
```

[Restore output](restore.log) · [Release output](release.log)

## Extraction and log checks

```sh
R=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-C3
python3 "$C/extract.py" "$C" | tee "$C/measurements.txt" | tail -2
python3 "$C/strip.py" "$C" "$R"
python3 "$C/report.py" "$C" "$R/summary.md"
grep -c '^FAIL' "$R"/*.log
~/.local/share/chatgpt-lab/bin/lab-lock status
```

The previous C3 `u1.mjs` numeric cut and `strip.py` were reused. The adapted
`extract.py` cross-checks the compact UX frames against the harness's blank
frame count and duration. The raw captures, sequence driver and local report
scripts are under `C`.

```text
main3 {"blankFrames": 2, "blankMs": 141.5, "writeToClear": 199.5, "completion": 1944.8, "blocking": 7050.5}
veil4 {"blankFrames": 2, "blankMs": 100.4, "writeToClear": 136.7, "completion": 682.3, "blocking": 1842.5}
./main3-ats12-u1-1.log:0
./main3-ats12-u1-2.log:0
./main3-ats12-u1-3.log:0
./release.log:0
./restore.log:0
./veil4-ats12-u1-1.log:0
./veil4-ats12-u1-2.log:0
./veil4-ats12-u1-3.log:0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": true, "owner": "veil4-C2"}
{"lab": "perf", "held": true, "owner": "veil4-C2"}
```

The FAIL count check returned exit 1 for zero matches. The privacy scan returned
zero matches for URL schemes, machine or account identifiers, email addresses,
localhost endpoints, absolute home paths and credential patterns in the stripped
logs. All six run logs confirm stored options `null` before the run, applied
`{"rail":true,"bookmark":true}` and exact restoration.

[Per-run data and acceptance verdicts](summary.md)
