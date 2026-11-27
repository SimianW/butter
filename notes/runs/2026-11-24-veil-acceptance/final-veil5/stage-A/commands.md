# Veil5 acceptance, stage A commands (#177)

Run in the Stage A worktree. The harness is this worktree's `lab/harness` at
`ece7cb4`. Timestamps are UTC on 2026-11-27.

```sh
git status --short --branch
git rev-parse HEAD
git -C ~/Dev/butter branch --show-current
git switch -c veil/177-veil5-a
D=~/snap/chromium/common/veil-accept
for build in main3 veil5 veil4; do jq -r .version_name "$D/$build/butter/manifest.json"; done
```

```text
## test/veil5-stage-a
ece7cb4264549ef06f5d3164f3836e49b9e7d8ac
main
Switched to a new branch 'veil/177-veil5-a'
0.1.0-alpha.22+veilaccept.main3
0.1.0-alpha.22+veilaccept.veil5
0.1.0-alpha.22+veilaccept.veil4
```

The sequence used the prebuilt directories as supplied. The build check compared
the installed stream file with each corresponding commit and compared the two
veil manifests with their build labels removed.

```bash
D=~/snap/chromium/common/veil-accept
diff -u <(jq -S 'del(.version_name)' "$D/veil4/butter/manifest.json") <(jq -S 'del(.version_name)' "$D/veil5/butter/manifest.json")
for pair in main3:3b9c3d5 veil5:ece7cb4 veil4:004851d; do
  git show "${pair#*:}:extension/stream/offscreen.js" | cmp - "$D/${pair%:*}/butter/stream/offscreen.js" || exit
  printf '%s stream/offscreen.js matches\n' "$pair"
done
```

```text
main3:3b9c3d5 stream/offscreen.js matches
veil5:ece7cb4 stream/offscreen.js matches
veil4:004851d stream/offscreen.js matches
```

The manifest check exited 0 without output. The driver adapts
[veil4 stage A's driver](../../final-veil4/stage-A/commands.md). Its raw captures,
exact script and combined output stay in the local capture directory.

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil5/stage-A
bash -n "$C/seq.sh" && (set -o pipefail && bash "$C/seq.sh" 2>&1 | tee "$C/sequence.log")
```

## Driver as executed

```bash
#!/bin/bash
# Veil5 stage A: run the interleaved comparison and the veil4 anchor.
set -u
umask 077
B=~/.local/share/chatgpt-lab/bin
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil5/stage-A
D=~/snap/chromium/common/veil-accept
OWNER=veil5-A
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
  echo "release exit=${PIPESTATUS[0]}"
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
      PHASES=stream 'OPTS={"rail":true,"bookmark":true}' "$@" node lab/harness/stream-replay-live.mjs > "$C/$NAME.raw.log" 2>&1
  local rc=$?
  echo "$NAME exit=$rc took=$(( $(date +%s) - started ))s since-lock=$(( $(date +%s) - T0 ))s at $(date -u +%FT%TZ)" | tee "$C/$NAME.time"
  rg '^(PASS|FAIL|REPORT completion frame:|REPORT long animation frames,)' "$C/$NAME.raw.log"
  return 0
}
for i in 1 2 3; do
  run "main3-ats12-stream-$i" main3 || exit "$?"
  run "veil5-ats12-stream-$i" veil5 || exit "$?"
done
run veil4-ats12-stream-anchor veil4
```

## Execution output

Each replay’s verdicts and timing reports are in its stripped log. The foreground sequence command exited 0.

```text
acquire start 2026-11-27T03:40:13Z
acquire lab=2 exit=0 at 2026-11-27T03:40:13Z
start main3-ats12-stream-1 at 2026-11-27T03:40:13Z
main3-ats12-stream-1 exit=0 took=198s since-lock=198s at 2026-11-27T03:43:31Z
start veil5-ats12-stream-1 at 2026-11-27T03:43:31Z
veil5-ats12-stream-1 exit=0 took=205s since-lock=403s at 2026-11-27T03:46:56Z
start main3-ats12-stream-2 at 2026-11-27T03:46:56Z
main3-ats12-stream-2 exit=0 took=190s since-lock=593s at 2026-11-27T03:50:06Z
start veil5-ats12-stream-2 at 2026-11-27T03:50:06Z
veil5-ats12-stream-2 exit=0 took=190s since-lock=783s at 2026-11-27T03:53:16Z
start main3-ats12-stream-3 at 2026-11-27T03:53:16Z
main3-ats12-stream-3 exit=0 took=197s since-lock=980s at 2026-11-27T03:56:33Z
start veil5-ats12-stream-3 at 2026-11-27T03:56:33Z
veil5-ats12-stream-3 exit=0 took=198s since-lock=1178s at 2026-11-27T03:59:51Z
start veil4-ats12-stream-anchor at 2026-11-27T03:59:51Z
veil4-ats12-stream-anchor exit=0 took=197s since-lock=1375s at 2026-11-27T04:03:08Z
restore exit=0 at 2026-11-27T04:03:19Z
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
SEQ DONE 2026-11-27T04:03:19Z runs=7 since-lock=1386s
```

## Extraction and stripping

```sh
C=~/.local/share/chatgpt-lab/captures/veil-accept/final-veil5/stage-A
P=~/.local/share/chatgpt-lab/captures/veil-accept/final/stage-A
R=notes/runs/2026-11-24-veil-acceptance/final-veil5/stage-A
H=notes/runs/2026-11-24-veil-acceptance/final-veil4/stage-A
runs=("$C"/{main3,veil5}-ats12-stream-{1,2,3}.json "$C/veil4-ats12-stream-anchor.json")
python3 -I "$C/runs.py" "${runs[@]}" > "$C/timing.jsonl"
python3 -I "$P/details.py" "${runs[@]}" > "$C/details.jsonl"
python3 -I "$P/strip.py" "$C" "$R"
python3 -I "$C/tables.py" "$C" > "$C/tables.md"
python3 -I "$C/comparison.py" "$C" "$H/summary.md" > "$C/comparison.md"
rg --sort path -c --include-zero '^FAIL' -- "$R"/*.log | tee "$C/fail-counts.txt"
python3 -I "$C/document-commands.py" "$C" "$R" > "$R/commands.md"
```

The extraction commands wrote the timing and geometry rows and the tables used
in the [summary](summary.md). The FAIL scan exited 1 with zero matches,
and each file count is shown below. The log filter keeps timing reports and verdicts.
It drops button inventories and rAF source snippets, replaces private URLs
and identifiers, and abbreviates the home path. Raw captures stay local.

```text
main3-ats12-stream-1.log:0
main3-ats12-stream-2.log:0
main3-ats12-stream-3.log:0
release.log:0
restore.log:0
veil4-ats12-stream-anchor.log:0
veil5-ats12-stream-1.log:0
veil5-ats12-stream-2.log:0
veil5-ats12-stream-3.log:0
```

## Verification

```sh
R=notes/runs/2026-11-24-veil-acceptance/final-veil5/stage-A
awk '/^## Per run$/{p=1;next} /^## /{p=0} p && /^\| `/{n++} END{print n+0 " per-run rows"; exit(n!=7)}' "$R/summary.md"
git -C ~/Dev/butter branch --show-current
~/.local/share/chatgpt-lab/bin/lab-lock status
git add -- "$R"
git diff --cached --check
```

```text
7 per-run rows
main
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

The staged whitespace check exited 0 with no output. The privacy scan of
all eleven files exited 1 with zero matches for URLs, absolute home paths,
UUIDs, email addresses, extension IDs, loopback endpoints, or bearer and
JWT credentials. The storage and veil count lines were checked against the
seven stripped replay logs.
