# Commands: veil acceptance round 2, stage D (#177), 2026-11-26

Run from the worktree of branch `veil/177-r2-stage-d`, based on `feat/implement-spec-170` at `552b8db`. The
harness is this checkout's `lab/harness` (with `U4_FINDS` from round 1, `1bea5f0`).

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/round2/stage-D`: raw logs and per-run JSON, kept local.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC.

## Branch and builds

```sh
git merge-base --is-ancestor feat/implement-spec-170 HEAD && echo ANCESTOR_OK   # ANCESTOR_OK (HEAD = 552b8db)
git switch -c veil/177-r2-stage-d
for n in head veil2; do grep version_name $D/$n/butter/manifest.json; node --check $D/$n/butter/stream/offscreen.js && echo "$n check ok"; grep -c prelayout $D/$n/butter/stream/offscreen.js; done
for p in head:547fa0a veil2:552b8db; do n=${p%%:*}; s=${p#*:}; T=$(mktemp -d); git archive $s extension | tar -x -C $T; echo "== $n vs $s"; diff -rq $T/extension $D/$n/butter; rm -rf $T; done
```
```text
  "version_name": "0.1.0-alpha.22+veilaccept.head",
head check ok
0
  "version_name": "0.1.0-alpha.22+veilaccept.veil2",
veil2 check ok
4
== head vs 547fa0a
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/head/butter/manifest.json differ
== veil2 vs 552b8db
Files /tmp/.../extension/manifest.json and ~/snap/chromium/common/veil-accept/veil2/butter/manifest.json differ
```

Only the manifest differs (the `version_name` suffix). veil2's `stream/offscreen.js` has 4 lines with
`prelayout`; head's has none.

## Lock, runs, judge, restore and release (one script, one lock)

The driver (`/tmp/va177r2d/seq.sh`, kept local) is round 1's stage D driver with these changes:

- build `veil2` in place of `veil`, owner `veil-accept-r2-D`, captures under `round2/stage-D`;
- the judge is this folder's `u4-extract.mjs` (round 1's, with the build key `veil2`);
- no part 2 (round 2's row D has none).

As before, it refuses to start a run after 1,500 s, after 9 runs or after a `FAIL no-escape` or
`FAIL server-unchanged`, and it runs restore and release from an exit trap.

```sh
LAB=$($B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-accept-r2-D --wait 3600 --perf)
# for i in 1 2 3, for BUILD in head veil2:
env LAB_ID=$LAB LAB_OWNER=veil-accept-r2-D EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
node u4-extract.mjs $C/{head,veil2}-ats12-u4-{1,2,3}.json > $C/u4.jsonl
# trap on exit:
$B/lab-restore --lab $LAB --owner veil-accept-r2-D
$B/lab-lock release --lab $LAB --owner veil-accept-r2-D
$B/lab-lock status
```

After the sequence:

```sh
node prelayout-extract.mjs $C/{head,veil2}-ats12-u4-{1,2,3}.json > prelayout.jsonl
```

```text
acquire start 2026-11-26T00:13:50Z
lab=2 exit=0 at 2026-11-26T00:13:50Z
judge exit=0
restore exit=0 (restarted the browser without extensions; "ok":true)   # 00:34:31Z
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
done 2026-11-26T00:34:31Z since-lock=1241s
```

| # | Name | Build | Exit | Took | Budget clock at end |
|---:|---|---|---:|---:|---:|
| 1 | `head-ats12-u4-1` | head | 0 | 208 s | 208 s |
| 2 | `veil2-ats12-u4-1` | veil2 | 0 | 205 s | 413 s |
| 3 | `head-ats12-u4-2` | head | 0 | 203 s | 616 s |
| 4 | `veil2-ats12-u4-2` | veil2 | 0 | 204 s | 820 s |
| 5 | `head-ats12-u4-3` | head | 0 | 206 s | 1,026 s |
| 6 | `veil2-ats12-u4-3` | veil2 | 0 | 204 s | 1,230 s |

Six harness runs, 20 min 41 s from lock to release; no wait for the lock.

## Files

- **`<name>.log`:** each run's full harness output plus the driver's exit and time line.
- **`seq.sh`, `seq-short.log`:** the driver and its run, exit, judge and release lines.
- **`restore.log`, `release.log`:** as printed.
- **`u4.jsonl`:** one line per run (blocks, string lengths, ms, flags, scrollTop, select-all lengths and
  times), then the medians and the rule. It holds no chat text.
- **`prelayout.jsonl`:** one line per run: long animation frames from completion to the window's end, Butter
  scripts in them (none), Butter's block marks after completion, and the ux sampler's scrollTop,
  scrollHeight and frame gaps to +16 s.
- **`u4-extract.mjs`, `prelayout-extract.mjs`:** the extractors.

The ChatGPT project URL was replaced by `<home-url>` and the home folder by `~`. A scan of this folder for
`chatgpt.com`, `/home/` and email addresses found nothing.
