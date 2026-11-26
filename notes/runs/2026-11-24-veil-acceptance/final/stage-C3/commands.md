# Commands for final veil acceptance stage C3 (#177)

All timestamps are UTC on 2026-11-26. The worktree started at `2cbaeb4`, the
integration tip after the final A and B reports. The harness matches `aed9523`.

## Setup

```sh
git status --short --branch
git log -6 --oneline
git worktree list
gh issue view 177 --repo SimianW/butter
gh issue view 170 --repo SimianW/butter
git diff --stat aed9523 HEAD -- lab/harness
rg -n 'version_name' ~/snap/chromium/common/veil-accept/{main3,veil3}/butter/manifest.json
git switch -c veil/177-final-c3
```

```text
## test/veil-177-final-c3
2cbaeb4 Merge veil/177-final-b: final round stage B, math9: veil3 median completion frame 641.6 vs main3 1925.9 ms, blocking 68.5% below; one control run flags ChatGPT's own opacity-0 block at the stream's start (#177)
  "version_name": "0.1.0-alpha.22+veilaccept.main3",
  "version_name": "0.1.0-alpha.22+veilaccept.veil3",
Switched to a new branch 'veil/177-final-c3'
```

The harness diff had empty output. The worktree list showed the main checkout on
`main` at `3b9c3d5`. Playwright was already installed. The two issue reads
exited 0. [Ticket #177](https://github.com/SimianW/butter/issues/177) ·
[Spec #170](https://github.com/SimianW/butter/issues/170)

## Lock, runs, restore and release

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C3
mkdir -p "$C"
bash -n "$C/seq.sh"
set -o pipefail
bash "$C/seq.sh" | tee "$C/sequence.log"
```

The driver is round 1 C3's `/tmp/va177c3/seq.sh` adapted for this branch,
the final builds and owner. Its two additions to the replay environment were
`TAIL_MS=16000` for hydration and LoAF sampling through the full UX window,
and `TRACE_AT=110000 TRACE_SPAN=26000` for both runs of the last pair. The trace
threshold starts at 97 s after Enter, ahead of the completion frame. The
`u1` frame probe keeps its default 16 s from completion in all six runs.

```bash
#!/bin/bash
# Final stage C3 driver: one lock, 3 main3 + 3 veil3 ats12 PHASES=stream UX=u1 runs interleaved, then restore + release.
set -u -o pipefail
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-C3
D=~/snap/chromium/common/veil-accept
WT=$PWD
OWN=veil-final-C3
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
for i in 1 2 3; do for BUILD in main3 veil3; do
  NAME=$BUILD-ats12-u1-$i
  el=$(( $(date +%s) - T0 ))
  if [ $el -gt 1500 ]; then echo "REFUSE $NAME: ${el}s since lock"; exit 0; fi
  if [ $n -ge 10 ]; then echo "REFUSE $NAME: $n runs"; exit 0; fi
  if grep -l -E 'FAIL (no-escape|server-unchanged)' $C/*.raw.log 2>/dev/null; then echo "REFUSE $NAME: guard FAIL"; exit 0; fi
  n=$((n+1)); s=$(date +%s)
  echo "run $n $NAME start $(date -u +%FT%TZ)"
  trace=()
  if [ "$i" -eq 3 ]; then trace=(TRACE_AT=110000 TRACE_SPAN=26000); fi
  ( cd "$WT" && timeout --kill-after=5s "$((1770 - el))s" env LAB_ID="$LAB" LAB_OWNER="$OWN" \
      EXT="$D/$BUILD/butter" LABEL="$NAME" FIXTURE=ats12 OUT="$C/$NAME.json" PHASES=stream UX=u1 \
      TAIL_MS=16000 'OPTS={"rail":true,"bookmark":true}' "${trace[@]}" \
      node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1 )
  rc=$?
  echo "exit=$rc elapsed=$(( $(date +%s) - s ))s since-lock=$(( $(date +%s) - T0 ))s" | tee $C/$NAME.time
  grep -E '^(PASS|FAIL|SUMMARY)' $C/$NAME.raw.log
  grep -E '^REPORT (completion frame|build|veil-effective|ux)' $C/$NAME.raw.log | cut -c1-400
  if [ $rc -ne 0 ] && ! grep -q '^PASS replay-hook' $C/$NAME.raw.log; then echo "STOP: $NAME failed before the replay"; exit 1; fi
done; done
```

The sequence exited 0. The driver's timing and lock output follows. The
stripped logs contain each run's full harness output.

```text
acquire start 2026-11-26T19:04:54Z
lab=2 exit=0 at 2026-11-26T19:21:20Z
run 1 main3-ats12-u1-1 start 2026-11-26T19:21:20Z
exit=0 elapsed=211s since-lock=211s
run 2 veil3-ats12-u1-1 start 2026-11-26T19:24:51Z
exit=0 elapsed=207s since-lock=418s
run 3 main3-ats12-u1-2 start 2026-11-26T19:28:18Z
exit=0 elapsed=201s since-lock=619s
run 4 veil3-ats12-u1-2 start 2026-11-26T19:31:39Z
exit=0 elapsed=203s since-lock=822s
run 5 main3-ats12-u1-3 start 2026-11-26T19:35:02Z
exit=0 elapsed=202s since-lock=1024s
run 6 veil3-ats12-u1-3 start 2026-11-26T19:38:24Z
exit=0 elapsed=209s since-lock=1233s
restore start 2026-11-26T19:41:53Z
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T19:42:03Z since-lock=1243s
```

The release status was taken immediately after release. [Restore output](restore.log) ·
[Release output](release.log)

## Data extraction

The round 1 C3 numeric cut was copied from `/tmp/va177c3/u1.mjs` into `C`.
The local Python extractor invokes it with the six captures in run order,
cross-checks its blank counts and durations against the harness values, and
writes `u1.jsonl` under `C`. It also reads late frame intervals from
`ux.compact` and the sample counts, storage values and verdicts from the JSON
and logs.

```sh
set -o pipefail
python3 "$C/extract.py" "$C" | tee "$C/measurements.txt"
for build in main3 veil3; do
  python3 -I notes/runs/2026-11-24-veil-acceptance/round2/stage-A/prelayout-trace.py "$C/$build-ats12-u1-3.json" > "$C/$build-prelayout-callbacks.jsonl" || exit
  head -1 "$C/$build-prelayout-callbacks.jsonl"
done
```

The initial local extraction stopped on an assertion that the last frame's
timestamp must be at least 16,000 ms. The probe stops after the 16 s cutoff,
which can be crossed during the final sample. The corrected extraction retains
the actual final timestamps, exited 0, and printed these medians.

```text
main3 {"blankFrames": 2, "blankMs": 106.5, "writeToClear": 207.5, "completion": 2047.5}
veil3 {"blankFrames": 2, "blankMs": 108, "writeToClear": 145.4, "completion": 671.1}
```

Both trace extracts exited 0. Selected values from their first JSON lines
follow. Callback offsets are relative to the mutation probe's
`in_progress`-gone mark.

```text
main3-ats12-u1-3: 0 callbacks, first None, last end None, longest None, total 0 ms
veil3-ats12-u1-3: 240 callbacks, first 1057.4, last end 11123.4, longest 24.2, total 1680.5 ms
```

## Log curation and checks

```sh
R=notes/runs/2026-11-24-veil-acceptance/final/stage-C3
python3 "$C/strip.py" "$C" "$R"
grep -c '^FAIL' "$R"/*.log
git diff --check
```

The stripper records harness output and the driver's exit/time line. It
removes private URLs and machine or account identifiers. Raw logs, JSON and
traces stay in `C`. The fail counts below use basenames. A scan of the stripped logs found no
full URLs, account UUIDs, extension IDs, email addresses, private endpoints
or home-directory prefixes.

```text
main3-ats12-u1-1.log:0
main3-ats12-u1-2.log:0
main3-ats12-u1-3.log:0
release.log:0
restore.log:0
veil3-ats12-u1-1.log:0
veil3-ats12-u1-2.log:0
veil3-ats12-u1-3.log:0
```

`grep` exited 1 for zero matches. [Per-run table and stage verdicts](summary.md)
